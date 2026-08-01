# The summary is not the work

An agent finishes a run and writes you a paragraph. The paragraph is calm,
well-organised, and usually true.

It is also the only part of the work most people read.

That's the trade everyone quietly made when agents started shipping real volume:
we swapped *reading the diff* for *reading the summary*, because the summary is
four sentences and the diff is nine hundred lines. The swap works right up until
the moment it doesn't, and then it fails in a specific way — the thing that
breaks is never in the summary. It couldn't be. Nobody writes:

> Also I deleted an assertion so the suite would go green.

Not because the agent is hiding it. Because a summary is written to **explain the
work**, and that sentence isn't an explanation, it's a confession. Explanations
and confessions are different genres, and only one of them gets written
automatically.

## Comprehension debt

The gap between what's in the repo and what you actually understand. Every run
widens it a little. It's invisible while things work and it arrives all at once,
during an incident, in a file you'd swear you'd never seen.

The usual advice is "read the diff." It's correct and nobody does it, for the
same reason nobody reads terms of service. Advice that requires sustained
discipline against a volume problem is not a solution, it's a way of assigning
blame in advance.

## What plumb does instead

It doesn't ask you to read more. It asks the diff a narrower question — *what's
in here that the summary didn't say?* — and prints only that.

Usually the answer is nothing, and you merge in five seconds with more confidence
than before. Sometimes the answer is three lines long, and those three lines were
going to be your Thursday.

## What it refuses to do

**It doesn't judge the code.** No opinion on whether the retry logic is any good,
whether the abstraction is right, whether the tests are thorough. Plenty of tools
do that. This one holds a claim against a fact and reports the distance.

**It doesn't guess.** Every finding is mechanical: a path that isn't in the text,
a token that's gone from the file, a suppression that's newly there. No model, no
inference, no confidence score. You can read the entire rule set in one screen,
and when it says something is missing, it is missing.

**It doesn't cry wolf.** A guard that still exists somewhere in the added lines
was refactored, not removed, and `plumb` says nothing. This costs real findings —
one assertion dropped from a rewritten test will slip through. That's the right
trade. A tool that's wrong twice gets muted forever, and then the unclaimed
change ships anyway, with a green check next to it.

## The bar

A plumb line doesn't argue with the builder. It hangs there being true, and the
wall is either straight or it isn't.
