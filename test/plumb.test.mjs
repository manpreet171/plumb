// One runnable check. Builds a throwaway git repo, plays an agent run through it,
// and asserts on `plumb check --json`. Run: node test/plumb.test.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { ghostSymbols, fetchBase } from '../bin/plumb.mjs';

const CLI = fileURLToPath(new URL('../bin/plumb.mjs', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'plumb-'));
const run = (args, opts = {}) =>
  execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });

function write(rel, body) {
  writeFileSync(join(dir, rel), body);
}

// plumb exits 1 when it finds something, which execFileSync treats as a throw.
// The exit code is part of the contract, so capture it rather than dodge it.
function plumb(...args) {
  const opts = { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
  try {
    return { status: 0, out: JSON.parse(execFileSync(process.execPath, [CLI, ...args], opts)) };
  } catch (err) {
    return { status: err.status, out: JSON.parse(err.stdout) };
  }
}

try {
  run(['init', '-q']);
  run(['config', 'user.email', 't@t.t']);
  run(['config', 'user.name', 't']);

  write('auth.js', 'function login(u, p) {\n  if (!u) throw new Error("no user");\n  return check(u, p);\n}\n');
  write('suite.test.js', "it('rejects blanks', () => { expect(login('')).toThrow(); });\n");
  write('config.js', 'export const RETRIES = 3;\n');
  run(['add', '-A']);
  run(['commit', '-qm', 'init']);

  // The agent: drops a guard, skips a test, edits a file it never mentions,
  // and renames a parameter (which must NOT be read as a removed check).
  write('auth.js', 'function login(user, pass) {\n  return check(user, pass);\n}\n');
  write('suite.test.js', "it.skip('rejects blanks', () => { expect(login('')).toThrow(); });\n");
  write('config.js', 'export const RETRIES = 3;\nexport const TIMEOUT = 0;\n');
  write('summary.md', 'Simplified auth.js and touched suite.test.js. Also updated src/ghost.js.\n');

  const first = plumb('check', 'summary.md', '--json');
  const r = first.out;
  assert.equal(first.status, 1, 'findings must exit 1 so CI can gate on it');

  assert.deepEqual(r.unclaimed.map((f) => f.path), ['config.js'], 'config.js changed but was never named');
  assert.equal(r.claimedCount, 2);

  const labels = r.cuts.map((c) => c.label);
  assert.ok(labels.includes('error path removed'), 'the thrown error is gone and should be reported');
  assert.ok(labels.includes('test skipped'), 'it.skip should be reported');
  assert.ok(!labels.includes('test case removed'), 'a skipped test is not a deleted test');
  assert.ok(
    !r.cuts.some((c) => c.body.includes('return check')),
    'renaming a parameter is a refactor, not a removed check',
  );

  assert.deepEqual(r.phantom, ['src/ghost.js'], 'a file named in the summary but never touched');

  // The bug that shipped in 1.0.0: `git diff` never lists untracked files, so an
  // agent that quietly drops a new .env.local got a clean bill of health. This is
  // the headline feature, so it gets its own regression test.
  write('.env.local', 'AWS_SECRET=hunter2\n');
  const leak = plumb('check', 'summary.md', '--json');
  assert.ok(
    leak.out.unclaimed.some((f) => f.path === '.env.local'),
    'a new untracked file the summary never mentioned must be reported',
  );
  assert.equal(leak.status, 1, 'an unmentioned untracked file must fail the check');
  rmSync(join(dir, '.env.local'));

  // A summary that tells the whole truth exits 0.
  rmSync(join(dir, 'summary.md')); // scratch file from the case above, not agent work
  write('config.js', 'export const RETRIES = 3;\n');
  write('auth.js', 'function login(u, p) {\n  if (!u) throw new Error("no user");\n  return check(u, p);\n}\nexport const X = 1;\n');
  write('suite.test.js', "it('rejects blanks', () => { expect(login('')).toThrow(); });\n");
  write('honest.md', 'Added an export to auth.js. Nothing else.\n');
  const second = plumb('check', 'honest.md', '--json');
  const c = second.out;
  assert.equal(c.unclaimed.length + c.cuts.length + c.phantom.length, 0, 'an honest summary should hold');
  assert.equal(second.status, 0, 'nothing found means exit 0');

  // The curl failure, and the whole reason `--pr` exists: a description citing
  // functions that exist nowhere. Exercised against a local repo so the test
  // never depends on GitHub being reachable.
  run(['add', '-A']);
  run(['commit', '-qm', 'settle']);
  write('token.js', 'export function validateToken(t) { return !!t; }\n');
  run(['add', '-A']);
  run(['commit', '-qm', 'token']);
  const ghostBase = run(['rev-parse', 'HEAD']).trim();
  write('token.js', 'export function validateToken(t) { return !!t; }\nexport function refreshToken(t) { return t; }\n');
  run(['add', '-A']);
  run(['commit', '-qm', 'add refresh']);
  const ghostHead = run(['rev-parse', 'HEAD']).trim();

  const claimText = 'Updated `validateToken` and added `refreshToken`. Also hardens `sanitizeUserInput`, '
    + 'fixes `legacyAuthHandler()`, reads `TokenStore.refreshToken` and calls `AuthGate.verifyOrDie`.';
  process.chdir(dir); // the real check runs git in the current directory
  const ghosts = ghostSymbols(claimText, ghostBase, ghostHead);
  assert.ok(ghosts.includes('sanitizeUserInput'), 'an invented symbol must be reported');
  assert.ok(ghosts.includes('legacyAuthHandler'), 'an invented function must be reported');
  assert.ok(!ghosts.includes('validateToken'), 'a symbol already in the repo is not a ghost');
  assert.ok(!ghosts.includes('refreshToken'), 'a symbol added by this change is not a ghost');
  // adaptive-lighting #1616: the PR added `adaptation_holds`, the description
  // said `AdaptiveLightingManager.adaptation_holds`, and 1.1.0 called it invented.
  assert.ok(!ghosts.includes('TokenStore.refreshToken'), 'Class.member is real when this change adds the member');
  assert.ok(ghosts.includes('AuthGate.verifyOrDie'), 'a dotted name with no part anywhere is still reported');

  // apollographql/rover #3924: a stacked PR whose base branch was deleted after
  // it merged. 1.1.0 fetched the base by branch name and died on it.
  const up = mkdtempSync(join(tmpdir(), 'plumb-up-'));
  const origin = mkdtempSync(join(tmpdir(), 'plumb-origin-'));
  const chk = mkdtempSync(join(tmpdir(), 'plumb-chk-'));
  const g = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    g(origin, ['init', '-q', '--bare']);
    g(up, ['init', '-q']);
    g(up, ['config', 'user.email', 't@t.t']);
    g(up, ['config', 'user.name', 't']);
    g(up, ['checkout', '-q', '-b', 'main']);
    writeFileSync(join(up, 'a.txt'), 'one\n');
    g(up, ['add', '-A']);
    g(up, ['commit', '-qm', 'main']);
    g(up, ['checkout', '-q', '-b', 'feature-a']);
    writeFileSync(join(up, 'a.txt'), 'one\ntwo\n');
    g(up, ['commit', '-qam', 'the base PR']);
    const stackedBase = g(up, ['rev-parse', 'HEAD']).trim();
    g(up, ['checkout', '-q', '-b', 'feature-b']);
    writeFileSync(join(up, 'a.txt'), 'one\ntwo\nthree\n');
    g(up, ['commit', '-qam', 'the stacked PR']);
    g(up, ['push', '-q', origin, 'main', 'HEAD:refs/pull/7/head']); // feature-a is never pushed: it was deleted

    g(chk, ['init', '-q']);
    g(chk, ['remote', 'add', 'origin', origin]);
    g(chk, ['fetch', '--quiet', 'origin', 'pull/7/head:refs/plumb/pr-7']);
    assert.throws(() => g(chk, ['fetch', '--quiet', 'origin', 'feature-a']), 'the base branch really is gone');
    process.chdir(chk);
    fetchBase({ base: stackedBase, branch: 'feature-a', label: '#7' }); // exits 2 if it can't recover
    assert.doesNotThrow(() => g(chk, ['cat-file', '-e', `${stackedBase}^{commit}`]), 'the base commit is available');
  } finally {
    process.chdir(tmpdir());
    for (const d of [up, origin, chk]) rmSync(d, { recursive: true, force: true });
  }

  console.log('ok — plumb reports the gap, stays quiet when there is none, names invented symbols, and survives a deleted base branch');
} finally {
  process.chdir(tmpdir());
  rmSync(dir, { recursive: true, force: true });
}
