# Two real runs

Neither of these is a fixture. Each folder holds the agent's actual summary, the
actual diff it produced, and the report `plumb` printed — captured by running it.

| | The summary said | What `plumb` found |
| - | ---------------- | ------------------ |
| [`skipped-a-test/`](skipped-a-test/) | "added retry logic and updated the tests. All tests pass." | A config file never mentioned, a thrown error deleted, and the test skipped rather than fixed |
| [`silenced-the-build/`](silenced-the-build/) | "fixed the failing build, CI is green again" | CI told to ignore failures, a `@ts-ignore` added, and a validation call removed |

Both summaries are **true**. Neither is complete, and in both cases the
incomplete part is the part you needed.

To reproduce either one, apply `agent.diff` to a repo and run:

```bash
plumb check summary.md
```
