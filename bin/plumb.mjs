#!/usr/bin/env node
// plumb — hold the agent's summary against what it actually changed.
// Zero dependencies. Node 18+.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

const VERSION = '1.1.0';

// ---------------------------------------------------------------- git

function git(args) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'], // git's line-ending warnings are not ours to print
    });
  } catch (err) {
    const msg = (err.stderr || err.message || '').trim().split('\n')[0];
    die(`git ${args.join(' ')} failed — ${msg}`);
  }
}

// Files changed, as [{ status, path }]. base is a ref, or null for the working
// tree (staged + unstaged, which is what you have right after an agent run).
//
// Untracked files count. `git diff` never lists them, and an agent that drops a
// new .env.local or deploy.sh is doing the exact thing this tool exists to
// catch — so they are collected separately and merged in.
function changedFiles(base) {
  const args = base
    ? ['diff', '--name-status', '--find-renames', base]
    : ['diff', '--name-status', '--find-renames', 'HEAD'];
  const tracked = git(args)
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      // Renames are "R100\told\tnew" — report the destination.
      return { status: parts[0][0], path: parts[parts.length - 1] };
    });

  // --exclude-standard honours .gitignore, so build output and node_modules
  // stay out of the report.
  const untracked = git(['ls-files', '--others', '--exclude-standard'])
    .split('\n')
    .filter(Boolean)
    .map((path) => ({ status: 'U', path }));

  const seen = new Set(tracked.map((f) => f.path));
  return tracked.concat(untracked.filter((f) => !seen.has(f.path)));
}

function unifiedDiff(base) {
  const args = base ? ['diff', '-U0', base] : ['diff', '-U0', 'HEAD'];
  return git(args);
}

// ---------------------------------------------------------------- the claim

// Pull every path-ish token out of the agent's prose. Agents write paths three
// ways: in backticks, bare with a slash, and as a bare filename with an
// extension. All three count.
const EXT = 'js|mjs|cjs|jsx|ts|tsx|py|rb|go|rs|java|kt|php|cs|swift|sh|bash|sql|css|scss|html|md|json|yml|yaml|toml|ini|env|lock|txt|xml|vue|svelte';
const TOKEN = new RegExp(`[\\w.\\-/\\\\]+\\.(?:${EXT})\\b`, 'gi');

function claimedNames(text) {
  const found = new Set();
  for (const raw of text.match(TOKEN) || []) {
    const clean = raw.replace(/\\/g, '/').replace(/^\.\//, '');
    found.add(clean.toLowerCase());
    found.add(basename(clean).toLowerCase());
  }
  return found;
}

// A file counts as claimed if its full path or its basename was named.
function isClaimed(path, names) {
  const p = path.toLowerCase();
  return names.has(p) || names.has(basename(p));
}

// ---------------------------------------------------------- the quiet cuts

// Things that get removed when an agent is making a problem go away rather than
// solving it. These are reported whether or not the file was claimed, because
// nobody writes "and I deleted an assertion" in a summary.
const CUTS = [
  [/\b(assert\w*|expect)\s*\(/i, 'assertion removed'],
  [/^\s*(it|test|describe|context)\s*\(/i, 'test case removed'],
  [/\b(try|catch|except|rescue|finally)\b\s*[:({]/i, 'error handling removed'],
  [/\b(throw|raise)\b/i, 'error path removed'],
  [/\b(validate|verify|sanitize|escape|authoriz|authenticat|csrf|checksum)\w*/i, 'check removed'],
  [/^\s*if\s*\(?\s*!/i, 'guard removed'],
];

// Things that get added for the same reason.
const MUTES = [
  [/\.(skip|only)\s*\(|^\s*x(it|describe)\s*\(/i, 'test skipped'],
  [/@pytest\.mark\.(skip|xfail)/i, 'test skipped'],
  [/@ts-(ignore|expect-error)|eslint-disable|# type:\s*ignore|# noqa|#\s*nosec/i, 'linter or type check silenced'],
  [/\bcontinue-on-error\s*:\s*true/i, 'CI failure silenced'],
];

// A line that came back wearing a mute is not a deletion. `it(...)` removed and
// `it.skip(...)` added is one line being skipped, not a test being deleted — say
// the true thing, or nobody believes the rest of the report.
function skeleton(s) {
  return s
    .replace(/\.(skip|only)\b/gi, '')
    .replace(/\bx(it|describe)\b/gi, '$1')
    .replace(/\s+/g, '')
    .toLowerCase();
}

// Walk a -U0 unified diff, tracking which file each hunk belongs to.
function scanDiff(text) {
  const hits = [];
  const added = new Set();
  const addedText = new Map(); // file -> everything added to it, for the survival check
  let file = null;
  let line = 0;
  for (const raw of text.split('\n')) {
    if (raw.startsWith('+++ ')) {
      file = raw.slice(4).replace(/^b\//, '');
      if (file === '/dev/null') file = null;
      continue;
    }
    if (raw.startsWith('@@')) {
      const m = raw.match(/@@ -\d+(?:,\d+)? \+(\d+)/);
      line = m ? Number(m[1]) : 0;
      continue;
    }
    if (!file) continue;
    if (raw.startsWith('-') && !raw.startsWith('---')) {
      const body = raw.slice(1);
      if (!body.trim()) continue;
      for (const [re, label] of CUTS) {
        const m = body.match(re);
        if (m) { hits.push({ file, line, label, body: body.trim(), cut: skeleton(body), token: m[0].toLowerCase().trim() }); break; }
      }
    } else if (raw.startsWith('+') && !raw.startsWith('+++')) {
      const body = raw.slice(1);
      if (body.trim()) {
        added.add(file + '|' + skeleton(body));
        addedText.set(file, (addedText.get(file) || '') + '\n' + body.toLowerCase());
        for (const [re, label] of MUTES) {
          if (re.test(body)) { hits.push({ file, line, label, body: body.trim() }); break; }
        }
      }
      line++;
    }
  }
  // Only report a cut if the thing is actually gone. A reformatted or renamed
  // line still has its guard, and crying wolf about a refactor is how a tool
  // like this stops being read.
  // ponytail: token-level survival check, not scope-aware — one assertion of
  // three dropped from a rewritten test goes unreported. Parse properly if that
  // ever bites.
  return hits.filter((h) => {
    if (!h.cut) return true;
    if (added.has(h.file + '|' + h.cut)) return false;
    return !(addedText.get(h.file) || '').includes(h.token);
  });
}

// ---------------------------------------------------------------- output

const C = process.stdout.isTTY && !process.env.NO_COLOR
  ? { dim: '\x1b[2m', red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', bold: '\x1b[1m', off: '\x1b[0m' }
  : { dim: '', red: '', yellow: '', green: '', bold: '', off: '' };

const STATUS = { A: 'added', M: 'modified', D: 'deleted', R: 'renamed', C: 'copied', T: 'retyped', U: 'new, untracked' };

function report(r) {
  const out = [];
  out.push(`${C.bold}plumb${C.off} ${C.dim}— ${r.changed.length} file${r.changed.length === 1 ? '' : 's'} changed, ${r.claimedCount} named in the summary${C.off}`);
  out.push('');

  if (r.unclaimed.length) {
    out.push(`${C.red}changed but never mentioned${C.off}  ${C.dim}(read these first)${C.off}`);
    for (const f of r.unclaimed) out.push(`  ${C.red}·${C.off} ${f.path} ${C.dim}${STATUS[f.status] || f.status}${C.off}`);
    out.push('');
  }
  if (r.cuts.length) {
    out.push(`${C.yellow}quiet cuts${C.off}  ${C.dim}(removed or silenced, whatever the summary says)${C.off}`);
    for (const h of r.cuts) {
      out.push(`  ${C.yellow}·${C.off} ${h.file}:${h.line} ${C.dim}${h.label}${C.off}`);
      out.push(`    ${C.dim}${h.body.length > 76 ? h.body.slice(0, 73) + '...' : h.body}${C.off}`);
    }
    out.push('');
  }
  if (r.phantom.length) {
    out.push(`${C.yellow}mentioned but not changed${C.off}`);
    for (const p of r.phantom) out.push(`  ${C.yellow}·${C.off} ${p}`);
    out.push('');
  }

  const n = r.unclaimed.length + r.cuts.length + r.phantom.length;
  if (n === 0) out.push(`${C.green}the summary holds.${C.off} ${C.dim}Every change was named, nothing was quietly cut.${C.off}`);
  else out.push(`${C.dim}${n} thing${n === 1 ? '' : 's'} the summary did not tell you.${C.off}`);
  return out.join('\n');
}

// ---------------------------------------------------------------- commands

function check(argv) {
  const base = flag(argv, '--base');
  const claimPath = flag(argv, '--claim') || argv.find((a) => !a.startsWith('-'));

  let claim = '';
  if (claimPath) {
    if (!existsSync(claimPath)) die(`no such file: ${claimPath}`);
    claim = readFileSync(claimPath, 'utf8');
  } else if (!process.stdin.isTTY) {
    claim = readFileSync(0, 'utf8');
  } else {
    die('nothing to hold the diff against.\n  Paste the agent\'s summary:  plumb check summary.md\n  Or pipe it:                 pbpaste | plumb check');
  }

  // The summary file is usually written into the repo you are checking. It is
  // not part of the agent's work, so reporting it every single time would be a
  // guaranteed false positive.
  const self = claimPath ? basename(claimPath).toLowerCase() : null;
  const changed = changedFiles(base).filter((f) => basename(f.path).toLowerCase() !== self);
  if (!changed.length) die('no changes to check — the working tree is clean.');

  const names = claimedNames(claim);
  const unclaimed = changed.filter((f) => !isClaimed(f.path, names));
  const changedSet = new Set(changed.flatMap((f) => [f.path.toLowerCase(), basename(f.path).toLowerCase()]));
  const phantom = [...names].filter((n) => !changedSet.has(n) && n.includes('/'));
  const cuts = scanDiff(unifiedDiff(base));

  const result = {
    changed,
    claimedCount: changed.length - unclaimed.length,
    unclaimed,
    phantom,
    cuts,
  };

  if (argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else console.log(report(result));

  const findings = unclaimed.length + cuts.length + phantom.length;
  process.exit(findings && !argv.includes('--warn-only') ? 1 : 0);
}

function flag(argv, name) {
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : null;
}

function die(msg) {
  console.error(`plumb: ${msg}`);
  process.exit(2);
}

const USAGE = `plumb ${VERSION} — hold the agent's summary against what it actually changed.

  plumb check <summary-file>     compare the summary to the working tree
  plumb check --base main        compare against a branch or commit instead
  cat summary.md | plumb check   read the summary from stdin

  --claim <file>   the agent's summary (same as the positional argument)
  --base <ref>     diff against this ref instead of HEAD
  --json           machine-readable output
  --warn-only      always exit 0, for a soft rollout

exit 0 clean · 1 findings · 2 usage error
`;

const [cmd, ...rest] = process.argv.slice(2);
switch (cmd) {
  case 'check': check(rest); break;
  case 'version': case '--version': case '-v': console.log(VERSION); break;
  default: console.log(USAGE); process.exit(cmd && cmd !== 'help' && cmd !== '--help' ? 2 : 0);
}
