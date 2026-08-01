# The four findings

Everything `plumb` reports is one of these. There is no fifth category and no
scoring — a thing either is in the diff and not in the text, or it isn't.

---

## 1 · Changed but never mentioned

A path appears in `git diff --name-status` and its name appears nowhere in the
summary.

A file counts as mentioned if either its **full path** or its **basename** shows
up in the text, in any form — backticked, bare, or with a `./` on the front.
Agents write paths inconsistently and that's not worth punishing anyone for.

This is the finding that matters most. Read these files first, before anything
else in the diff, because they are the ones you would otherwise never open.

## 2 · Quiet cuts

A removed line matched one of these:

| Pattern | Reported as |
| ------- | ----------- |
| `assert…(` · `expect(` | assertion removed |
| `it(` · `test(` · `describe(` · `context(` at line start | test case removed |
| `try` · `catch` · `except` · `rescue` · `finally` | error handling removed |
| `throw` · `raise` | error path removed |
| `validate` · `verify` · `sanitize` · `escape` · `authoriz…` · `authenticat…` · `csrf` · `checksum` | check removed |
| `if (!…` at line start | guard removed |

Reported **whether or not the file was claimed**, because a removed assertion is
never in a summary even when the file is.

### The survival check

A cut is dropped if the matched token appears anywhere in that file's added
lines. Renaming `verifyPassword(user, pass)` to `verifyPassword(u, p)` is a
refactor; `verify` survived, so nothing is reported.

There's also a **skeleton check** for the specific case of a line coming back
wearing a mute: `it(...)` removed and `it.skip(...)` added is one test being
skipped, not a test being deleted. It's reported as *test skipped*, once.

This is deliberate under-reporting. One assertion dropped from a fully rewritten
test file will not be caught, because `expect(` is still all over the added
lines. That miss is cheaper than a false alarm — see the manifesto.

## 3 · Mutes

An added line matched one of these:

| Pattern | Reported as |
| ------- | ----------- |
| `.skip(` · `.only(` · `xit(` · `xdescribe(` | test skipped |
| `@pytest.mark.skip` · `@pytest.mark.xfail` | test skipped |
| `@ts-ignore` · `@ts-expect-error` · `eslint-disable` · `# type: ignore` · `# noqa` · `# nosec` | linter or type check silenced |
| `continue-on-error: true` | CI failure silenced |

A suppression is not a fix. It's a fix deferred to whoever is on call, and it is
the single most common way a run comes back "green".

## 4 · Mentioned but not changed

A path with a `/` in it is named in the summary and does not appear in the diff
at all.

Bare filenames are ignored here on purpose — prose is full of words that look
like filenames, and a false alarm in this category is the cheapest kind to avoid.

---

## Adding your own patterns

They're two arrays at the top of [`bin/plumb.mjs`](../bin/plumb.mjs), `CUTS` and
`MUTES`. Each entry is `[regex, label]`. There is no config file and there isn't
going to be one — a rule you can't see the source of is a rule you can't trust,
and the whole tool is 250 lines.

Before you add one, ask what it does on a large refactor. If the honest answer is
"fires a lot", leave it out.
