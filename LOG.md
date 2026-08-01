# Change log

What changed here and why. Appended every session — see [`CLAUDE.md`](CLAUDE.md).
Newest first.

---

## 2026-08-01 — v1.0.0, the build

- **Shipped `plumb check`** — reads the agent's summary, reads `git diff`, and
  reports only the difference: changes never mentioned, guards and tests quietly
  removed, mutes quietly added, files claimed but never touched.
- **Rejected a policy file.** The first design was a committed "done means this"
  file plus a linter — which is the third governance file in a row across these
  repos, and reads as generic. Flipped the shape: **no file to author, zero
  config**, the tool reads what already exists.
- **Rejected building anything in loop engineering or graph engineering.** Both
  were researched first. Loop is closed — Anthropic shipped `/goal` and `/loop`
  natively and the GitHub topic already holds dozens of runners. Graph is earlier
  but is a framework category owned by LangGraph and friends, and its buyer is an
  enterprise platform team. Neither is a solo dev's problem.
- **Added the survival check after a real false positive.** `return
  verifyPassword(user, pass)` reformatted to `verifyPassword(u, p)` was reported
  as "check removed". A cut now only counts if the matched token appears nowhere
  in that file's added lines. False positives are the one fatal bug here.
- **Added the skeleton check** so `it(...)` → `it.skip(...)` reports as *test
  skipped*, not *test case removed*. Saying the wrong true-sounding thing is how
  a tool like this loses trust.
- **Kept it to one verb.** `check` and nothing else. No `init`, because there is
  nothing to scaffold — that was the whole point of dropping the policy file.
- **Banner:** blueprint archetype, cyan palette, mono/mono type — a plumb bob
  hanging true against a wall of code that is four degrees out, with the gap
  dimensioned. The drawing is the mechanism, not decoration.
- **Headless Edge would not screenshot at all** on this machine, on a path with
  or without spaces. Chrome with `--headless=new` worked first try.
