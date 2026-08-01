// One runnable check. Builds a throwaway git repo, plays an agent run through it,
// and asserts on `plumb check --json`. Run: node test/plumb.test.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

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

  // A summary that tells the whole truth exits 0.
  write('config.js', 'export const RETRIES = 3;\n');
  write('auth.js', 'function login(u, p) {\n  if (!u) throw new Error("no user");\n  return check(u, p);\n}\nexport const X = 1;\n');
  write('suite.test.js', "it('rejects blanks', () => { expect(login('')).toThrow(); });\n");
  write('honest.md', 'Added an export to auth.js. Nothing else.\n');
  const second = plumb('check', 'honest.md', '--json');
  const c = second.out;
  assert.equal(c.unclaimed.length + c.cuts.length + c.phantom.length, 0, 'an honest summary should hold');
  assert.equal(second.status, 0, 'nothing found means exit 0');

  console.log('ok — plumb reports the gap, and stays quiet when there is none');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
