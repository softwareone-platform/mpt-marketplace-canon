---
name: canon-submit-pr
description: Promote a reviewed canon-generate draft into objects/ and open a PR — branch, commit (draft + any pending bookkeeping edits), push, and gh pr create. Always confirms with the human before any git/GitHub action.
---

# canon-submit-pr

The explicit, human-triggered promotion step referred to by `canon-generate`'s Step 8. `canon-generate` never writes into `objects/` and never opens a PR — this Skill is what actually does that, only after the PM has reviewed the draft. Branch creation, commits, pushes, and PR creation are shared-state and hard-to-reverse actions — **always confirm with the human before each of push and PR creation**, even if they invoked this Skill directly; do not treat the invocation itself as blanket approval for every step.

## Core rules — do not relax without the human explicitly overriding

1. **One PR = one platform object.** A PR touches exactly one object's canon file in `objects/` (plus only that object's rows in the `questions/*.md` trackers). If evidence gathered during canon-generate revealed a dependency requiring changes to a *different* object's canon, that is out of scope for this PR — it needs its own `canon-generate` run and its own `canon-submit-pr` run, resulting in a separate PR. Never bundle two objects' changes into one commit or one PR, even if they were discovered in the same session.
2. **One commit per PR.** A PR is always exactly one commit. If this Skill is invoked again for the same object/branch (e.g. the draft was revised after review, or bookkeeping changed), **amend** the existing commit — never add a second commit. Push the amended commit with `git push --force-with-lease` (not a bare `--force`, so a push is rejected rather than silently clobbering someone else's work if the remote branch moved unexpectedly).

## Invocation

```
/canon-submit-pr <namespace> <object> [--parent <parent-object>] [--run <run-timestamp>]
```

`--run` selects a specific `.evidence/<namespace>_<object>/<run>/` directory if more than one exists; omit it to use the most recent (run directories are UTC timestamps, so lexical sort = chronological sort).

## Step 1 — Locate and validate the draft

1. Normalise `<namespace>`/`<object>`; compute the target filename per preamble §5.1: `objects/CANON_OBJECT_<Namespace>_<Object>.md`, or the `_<Parent>_<Object>.md` variant if `--parent` was given.
2. Find `.evidence/<namespace>_<object>/<run>/draft/<target filename>`. If it doesn't exist (no run at all, or no draft in the selected run), stop and tell the human to run `/canon-generate <namespace> <object>` first — do not fabricate a draft.
3. Read the draft in full.

## Step 2 — Show the human what will change

1. If `objects/<target filename>` already exists, diff it against the draft and show the human a summary of what's changing section by section (this mirrors the refresh-diff `canon-generate` produces, but is the actual promotion this time).
2. Run `git status --porcelain`. The working tree will typically already carry uncommitted edits to `questions/CANON_OPEN_QUESTIONS.md`, `CANON_RESOLVED_QUESTIONS.md`, `CANON_SPEC_DISCREPANCIES.md`, and `CANON_BACKLOG.md` — these are `canon-generate`'s bookkeeping edits from the same run, meant to be committed together with the promoted draft. Show the human this diff too.
3. **Check the bookkeeping diff is scoped to this one object only.** Inspect the rows/IDs actually being added or changed in each `questions/*.md` file — they should all carry this object's ID prefix (or reference this object). If you find edits belonging to a *different* object's prefix mixed in (a sign of the cross-object dependency case in Core Rule 1), stop: tell the human this must be split into a separate `canon-generate` + `canon-submit-pr` run/PR for that other object, and do not include those rows in this commit.
4. **If `git status` shows anything else** — changes unrelated to this object's canon/questions files, or pre-existing work you don't recognize — stop and ask the human how to proceed. Do not assume it's safe to bundle unrelated changes into this PR, and do not stash or discard anything without being told to.
5. Ask the human to confirm they're happy with the draft content and the (single-object) bookkeeping diff before continuing. Do not proceed to Step 3 without an explicit go-ahead.

## Step 3 — Branch

1. `git fetch origin`. If local `main` is behind `origin/main`, tell the human and ask how they want to reconcile it (pull first, or proceed anyway) rather than silently rebasing or merging.
2. Check whether `canon/<namespace>-<object>` already exists (locally or on the remote):
   - **If it exists and this is a re-run for the same object** (revised draft, updated bookkeeping) — check it out; you'll amend its single commit in Step 5, not add a new one.
   - **If it doesn't exist** — create it fresh from an up-to-date `main`: `git checkout -b canon/<namespace>-<object>`.
   - Never invent a differently-named branch for the same object to work around a naming collision — a second branch for the same object is exactly the "more than one commit/PR" problem Core Rule 2 exists to prevent. If the existing branch turns out to belong to unrelated/stale work, stop and ask the human how to proceed rather than silently branching around it.

## Step 4 — Promote the draft

1. Copy the draft's content into `objects/<target filename>` (new file, or overwrite if this was a refresh — the diff was already shown and confirmed in Step 2).
2. Do not modify `questions/*.md` further here — their bookkeeping edits already sitting in the working tree (from `canon-generate`) are committed as-is, scoped to this one object per Step 2.3.

## Step 5 — Commit (exactly one)

Stage exactly: the promoted `objects/<target filename>`, and any of `questions/CANON_OPEN_QUESTIONS.md`, `CANON_RESOLVED_QUESTIONS.md`, `CANON_SPEC_DISCREPANCIES.md`, `CANON_BACKLOG.md` that show pending changes **for this object only**. Do not use `git add -A`.

- **First promotion for this object/branch:** `git commit` with a fresh commit.
- **Re-run on an existing branch (Step 3 reused it):** `git commit --amend` — the branch must never accumulate a second commit.

Commit message, matching this repo's existing convention (see `git log`, e.g. "Added Order canon", "Add Subscription canon"):
- New object: `Add <Namespace>: <Object> canon`
- Refresh: `Update <Namespace>: <Object> canon`

## Step 6 — Push and open the PR (confirm before each)

1. **Confirm with the human before pushing.** Then:
   - First push for this branch: `git push -u origin canon/<namespace>-<object>`.
   - Push after an amend: `git push --force-with-lease -u origin canon/<namespace>-<object>` — never a bare `--force`.
2. **Confirm with the human before opening the PR.** Check first whether a PR already exists for this branch (`gh pr view canon/<namespace>-<object>`) — if so, the amended push already updated it; don't create a duplicate. Otherwise create it with `gh pr create`, title matching the commit message, and a body that:
   - States the object canonised and whether this is new or a refresh.
   - Lists the evidence sources actually used (OpenAPI spec, which environments/Actors were live-fetched, whether repo research ran).
   - Lists open questions added and/or resolved in this run (IDs).
   - States explicitly: *"Generated via `/canon-generate` — requires PM review before merge (per README: canon that has not been reviewed by a domain expert is not canon)."*
3. Report the PR URL back to the human.

## What this Skill never does

- Never combines changes for more than one platform object into a single commit or PR (Core Rule 1) — cross-object dependencies become separate runs/PRs, never a bundled one.
- Never lets a PR branch accumulate more than one commit (Core Rule 2) — always amends, never appends.
- Never marks `questions/CANON_BACKLOG.md` status as 🟢 Complete — that remains a human call after merge and review, not something either canon Skill decides.
- Never bare-force-pushes (`--force-with-lease` only), never merges its own PR, never bypasses the confirmation checkpoints in Steps 2 and 6 even on a repeat invocation.
