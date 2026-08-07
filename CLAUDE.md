# Working rules for this repo

`plumb` — one file, zero dependencies, Node 18+. Nothing to build.

## Always log what you did

**Every session that changes anything appends to [`LOG.md`](LOG.md) before it
finishes. Nobody should have to ask.** Newest date first, one line per change,
what changed and *why*. **Log decisions and rejected ideas too** — "skipped X
because Y" is worth more in six months than any diff. Get the date from the
system, never guess it.

## What this tool is, and is not

- It reports the **gap between a claim and a diff**. It is not a code reviewer,
  a linter, or a quality judge. Every feature request that drifts toward "is this
  code good?" belongs in a different tool.
- **False positives are the only fatal bug.** A tool that cries wolf about a
  refactor stops being read, and then the real unclaimed change ships. When a
  rule is ambiguous, stay quiet. A missed finding costs one review; a bogus one
  costs the whole product.
- That is why cuts are filtered by a **survival check**: a guard that still
  appears somewhere in the added lines of the same file is a refactor, not a
  removal.

## Content rules

- **Every command and every block of output in the README was produced by
  running the tool.** Never remembered, never plausible-looking.
- No invented metrics. No star counts, no "used by", no time-saved figures.
- Short, dry, a bit funny. If a sentence needs a second read, rewrite it shorter.

## Technical rules

- Node built-ins only. A dependency here would be embarrassing.
- `git` is invoked with `stdio: ['ignore', 'pipe', 'pipe']` — its CRLF warnings
  are not ours to print.
- Exit codes are contract: **0** clean · **1** findings · **2** usage error.
  CI gates on 1, so never repurpose it.
- `node test/plumb.test.mjs` must pass before anything ships. It builds a real
  git repo and plays a real agent run through it.

## Commits

One short human line. **Never a `Co-Authored-By: Claude` trailer and no AI
attribution of any kind** — GitHub renders it as a second Contributor on the
repo front page, beside the author. Commit as `manpreet171
<singh.manpreet171900@gmail.com>`. Saying "Claude Code" in a body as a technical
term is fine; the attribution trailer is not.
