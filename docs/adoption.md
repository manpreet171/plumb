# Adoption — a timed walkthrough

No config, no scaffold, nothing to commit. This is the whole thing.

## Minute 0–1 · Install

```bash
npm install -g github:manpreet171/plumb
```

Through GitHub, not a bare npm name — `plumb` on npm belongs to an unrelated
package, and `npx plumb` would run a stranger's code.

## Minute 1–3 · Run it against work you already did

Find a branch where an agent did something recently. Paste what it told you into
a file and hold it up:

```bash
plumb check summary.md
```

Do this on a run you've **already reviewed and merged**. That's the honest test:
if it finds nothing, you reviewed well and now you know how it behaves on a clean
run. If it finds something in code you already shipped, that's the pitch.

## Minute 3–5 · Wire it into the habit

The only change to your routine: keep the agent's last message instead of
scrolling past it.

```bash
pbpaste | plumb check          # macOS
Get-Clipboard | plumb check    # PowerShell
xclip -o | plumb check         # Linux
```

Or point it at a branch instead of the working tree:

```bash
plumb check summary.md --base main
```

## Minute 5–10 · CI, if you want it

```yaml
- run: npx github:manpreet171/plumb check summary.md
```

Exit `1` fails the job. Start with `--warn-only` so it reports without blocking,
and turn that off once you've seen a week of real output and trust it.

## If you can't install anything

Copy [`PLUMB.md`](../PLUMB.md) into your project. Same four checks, written as
instructions your agent follows itself. Weaker — it's the agent auditing the
agent — but it costs one file and no install.

## Uninstall

```bash
npm uninstall -g plumb-diff
```

Nothing was written outside your repo. No config, no cache, no state directory,
no dotfile in your home folder. Delete `PLUMB.md` if you copied it in, and
`plumb` is gone.
