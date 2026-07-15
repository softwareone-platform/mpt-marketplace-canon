---
name: canon-submit-pr
description: Promote a reviewed canon-generate draft into objects/ and open a PR — branch, commit (draft + any pending bookkeeping edits), push, and gh pr create. Always confirms with the human before any git/GitHub action.
---

# canon-submit-pr

The explicit, human-triggered promotion step referred to by `canon-generate`'s Step 8. `canon-generate` never writes into `objects/` and never opens a PR — this Skill is what actually does that, only after the PM has reviewed the draft. Branch creation, commits, pushes, and PR creation are shared-state and hard-to-reverse actions — **always confirm with the human before each of push and PR creation**, even if they invoked this Skill directly; do not treat the invocation itself as blanket approval for every step.

## Core rule — do not relax without the human explicitly overriding

**One commit per PR.** A PR is always exactly one commit. If this Skill is invoked again for the same branch (e.g. a draft was revised after review, bookkeeping changed, or another related object's changes are being added to the same PR), **amend** the existing commit — never add a second commit. Push the amended commit with `git push --force-with-lease` (not a bare `--force`, so a push is rejected rather than silently clobbering someone else's work if the remote branch moved unexpectedly).

## Scoping a PR — multi-object bundling is expected, not a special case

Platform objects routinely reference and depend on one another, so a PR is **not** restricted to one object's canon file. Bundle related canon changes into the same PR whenever they belong together — e.g. a cross-object dependency surfaced while researching one object (a correction to `Notifications: Webhook` discovered while refreshing `Catalog: Product`), or several objects reviewed together in one session. Splitting purely to keep a PR "single-object" is no longer required and should not be done reflexively.

That said, still use judgment and still confirm with the human (Step 2) rather than silently stacking everything in the working tree — two objects' changes that are genuinely unrelated (touched in the same session by coincidence, not because one depends on the other) are still cleaner as separate PRs. When unsure, ask.

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
2. Run `git status --porcelain`. The working tree will typically already carry uncommitted edits to `questions/CANON_OPEN_QUESTIONS.md`, `CANON_BACKLOG.md`, and possibly `config/canon_path_segment_exclusions.json` — these are `canon-generate`'s bookkeeping edits from the same run, meant to be committed together with the promoted draft. Show the human this diff too.
3. **Identify everything the diff touches, object by object.** Inspect the rows/IDs actually being added or changed in each `questions/*.md` file and note which object(s) each belongs to. If other objects' canon files or rows are also sitting in the working tree (from an earlier `canon-generate`/hand-edit this session), surface them explicitly rather than silently folding them in or silently excluding them — see "Scoping a PR" above. Confirm with the human which of it belongs in this PR.
4. **If `git status` shows anything you don't recognize** (not attributable to any canon-generate run or a change the human has already told you about) — stop and ask the human how to proceed. Do not assume it's safe to bundle unrecognized changes into this PR, and do not stash or discard anything without being told to.
5. Ask the human to confirm they're happy with the draft content and the full bookkeeping diff (whatever objects it now spans) before continuing. Do not proceed to Step 3 without an explicit go-ahead.

## Step 2.5 — Completion checkpoint

`canon-generate` always leaves `questions/CANON_BACKLOG.md`'s status at 🟡 Known Pending Issues — it never marks 🟢 Up to Date itself, since that's a PM judgment call. This is the point where that call actually gets made, so it doesn't get silently skipped: for each object being promoted in this PR, ask the human directly — "is `<Object>`'s canon coverage complete now, or are there known gaps (deferred sections, follow-ups flagged for another object, etc.)?"

- **Complete** — update its `CANON_BACKLOG.md` row: status → 🟢 Up to Date, set **Last Updated** to today's date, fill in the `Canon File` column if not already set, and clear/finalize the Notes column (remove the "pending PM review" language). This edit is staged and committed as part of this same PR (Step 5) — no separate follow-up PR needed. Remember 🟢 means "accurate as of Last Updated," not a permanent guarantee — the platform keeps evolving, so this object will need re-verifying again eventually.
- **Known gaps remain** — leave the row at 🟡 Known Pending Issues, and update its Notes column to describe what's still outstanding (not just "pending PM review" — the actual gap, e.g. "Split Billing deferred to a future session").

Never infer completeness yourself from the absence of Section 10 open questions — a clean Section 10 means no *known unknowns*, not that coverage is exhaustive. Always ask.

## Step 3 — Branch

1. `git fetch origin`. If local `main` is behind `origin/main`, tell the human and ask how they want to reconcile it (pull first, or proceed anyway) rather than silently rebasing or merging.
2. Check whether `canon/<namespace>-<object>` already exists (locally or on the remote):
   - **If it exists and this is a re-run for the same object** (revised draft, updated bookkeeping) — check it out; you'll amend its single commit in Step 5, not add a new one.
   - **If it doesn't exist** — ask the human whether this object's changes belong on a fresh branch, or should be bundled onto an existing open canon PR branch for a related object (per "Scoping a PR" above). If bundling onto an existing branch, check that branch out instead of creating a new one. Otherwise create fresh from an up-to-date `main`: `git checkout -b canon/<namespace>-<object>` (or a name describing the bundled scope, e.g. `canon/<namespace>-<object>-and-<other-object>`, if the human prefers).
   - Never invent a differently-named branch to work around a naming collision without the human's input — if an existing branch turns out to belong to unrelated/stale work, stop and ask how to proceed rather than silently branching around it.

## Step 4 — Promote the draft

1. Copy the draft's content into `objects/<target filename>` (new file, or overwrite if this was a refresh — the diff was already shown and confirmed in Step 2).
2. Do not modify `questions/*.md` further here — their bookkeeping edits already sitting in the working tree (from `canon-generate`) are committed as-is, per what was confirmed in scope in Step 2.3.
3. **Co-promoted sibling cross-links — resolve the deferred links now.** When this PR promotes two or more mutually-referential objects together (or promotes an object that an already-canonised object should now link, per a `canon-generate` Step 8 flag), the drafts will contain plain-text mentions of siblings that weren't in `objects/` when they were drafted — a `[[Sibling]]` link would have been a broken mention then, but resolves now that both are landing together. Once all the co-promoted files are copied into `objects/`, bracket-link those deferred cross-references in every direction (each object's plain first-mention of every other co-promoted or newly-linkable object, per `canon-generate`'s "Wikilinking other objects" section-by-section policy), and update the corresponding changelog rows. This is the one point where those links can be added without a broken mention, so don't skip it — a plain mention that never gets bracketed is a silent completeness gap, exactly the kind `.canon`'s graph parser won't flag. Then run `npm run validate` (Step 5's implicit precondition) and confirm 0 mention errors before committing.

## Step 5 — Commit (exactly one)

Stage the promoted `objects/<target filename>`, and whichever of `questions/CANON_OPEN_QUESTIONS.md`, `CANON_BACKLOG.md`, `config/canon_path_segment_exclusions.json` show pending changes that were confirmed in scope for this PR in Step 2 — this may now include rows/edits for more than one object when bundling was confirmed. Stage explicitly named files; do not use `git add -A`.

- **First promotion for this object/branch:** `git commit` with a fresh commit.
- **Re-run on an existing branch (Step 3 reused it):** `git commit --amend` — the branch must never accumulate a second commit.

Commit message, matching this repo's existing convention (see `git log`, e.g. "Added Order canon", "Add Subscription canon"):
- New object: `Add <Namespace>: <Object> canon`
- Refresh: `Update <Namespace>: <Object> canon`
- Bundled scope spanning more than one object: name all of them, e.g. `Update Catalog: Product and Notifications: Webhook canon`, or summarize if the list is long (the PR body carries the full breakdown either way).

## Step 6 — Push and open the PR (confirm before each)

1. **Confirm with the human before pushing.** Then:
   - First push for this branch: `git push -u origin canon/<namespace>-<object>`.
   - Push after an amend: `git push --force-with-lease -u origin canon/<namespace>-<object>` — never a bare `--force`.
2. **Confirm with the human before opening the PR.** Check first whether a PR already exists for this branch (`gh pr view canon/<namespace>-<object>`) — if so, the amended push already updated it; don't create a duplicate. Otherwise create it with `gh pr create`, title matching the commit message, and a body that:
   - States each object canonised and whether it's new or a refresh.
   - Lists the evidence sources actually used (OpenAPI spec, which environments/Actors were live-fetched, whether repo research ran) — per object if they differ.
   - Lists open questions added and/or resolved in this run (IDs), and if the PR spans multiple objects because one's evidence corrected another (e.g. a dependency finding), say so explicitly so reviewers understand why they're bundled.
   - States explicitly: *"Generated via `/canon-generate` — requires PM review before merge (per README: canon that has not been reviewed by a domain expert is not canon)."*
3. Report the PR URL back to the human.

## What this Skill never does

- Never lets a PR branch accumulate more than one commit (Core Rule) — always amends, never appends.
- Never bundles unrelated or unconfirmed changes into a PR without the human explicitly confirming scope (Step 2).
- Never marks `questions/CANON_BACKLOG.md` status as 🟢 Up to Date on its own inference — it only ever does so after the human explicitly confirms completeness at Step 2.5. `canon-generate` itself still never sets 🟢 under any circumstances.
- Never bare-force-pushes (`--force-with-lease` only), never merges its own PR, never bypasses the confirmation checkpoints in Steps 2 and 6 even on a repeat invocation.
