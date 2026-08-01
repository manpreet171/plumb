# PLUMB.md — the zero-install version

Copy this file into your project. It is the same four checks the CLI runs,
written as instructions an agent can follow. Use it when you can't install
anything, or before you decide whether the CLI is worth it.

---

## Before I accept your summary

Run `git diff --name-status HEAD` and `git diff HEAD`, then answer these four
questions **in this order**, out loud, before I read anything else.

**1. What did you change that you did not mention?**
List every path in the diff whose name does not appear in your summary. These go
first, because they are the ones I would otherwise never look at.

**2. What did you remove?**
Search the removed lines for: assertions, test cases, `throw` / `raise`,
`try` / `catch`, guards (`if (!…`), and anything named `validate`, `verify`,
`sanitize`, `escape`, `auth…`, `csrf`, `checksum`. Report each one with its file
and line — even if you think it was the right call, and even if you mentioned the
file. If the same thing still appears in the added lines, it was a refactor: stay
quiet about it.

**3. What did you silence?**
Search the added lines for `.skip(`, `.only(`, `xit(`, `@pytest.mark.skip`,
`@ts-ignore`, `eslint-disable`, `# noqa`, `# nosec`, `continue-on-error: true`.
A suppression is not a fix, and it never appears in a summary on its own.

**4. What did you say you changed that you didn't?**
List every path named in your summary that the diff never touched.

If all four are empty, say so in one line: *"the summary holds."*

Do not soften any of the four. I am not asking whether the work was good — I am
asking what the summary left out.
