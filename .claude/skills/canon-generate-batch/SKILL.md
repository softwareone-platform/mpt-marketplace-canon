---
name: canon-generate-batch
description: Run canon-generate's evidence-gathering and drafting concurrently across several objects at once, via the Workflow tool, with one consolidated human checkpoint instead of a per-object one. Never writes directly into objects/ — same draft/promotion boundary as canon-generate.
---

# canon-generate-batch

A thin orchestrator over `.claude/skills/canon-generate/SKILL.md` — it does not restate that Skill's per-object rules (wikilinking conventions, mandatory Endpoint/Verb column, language standards, the full evidence-gathering mechanics). It exists solely to solve the three problems that make running several single-object `canon-generate` invocations *at the same time* unsafe or impractical:

1. `scripts/canon_repo_sync.py` has no concurrency protection, and most namespaces share the same underlying repo cache directory — concurrent syncs race.
2. `questions/CANON_OPEN_QUESTIONS.md`'s `ENV-NNN` prefix and `questions/CANON_BACKLOG.md` are single shared files with no locking — concurrent bookkeeping writes race.
3. A `Workflow`-spawned subagent cannot interactively ask the human anything — the per-object "resolve candidates with the human" step in `canon-generate` has to become one consolidated round across the whole batch instead.

If you only need one object, use `/canon-generate` directly — nothing here replaces it.

## Invocation

```
/canon-generate-batch
<namespace> <object> [--parent <parent-object>]
<namespace> <object> [--parent <parent-object>]
...
```

One object-spec per line, each using the exact same grammar as single-object `/canon-generate`. Example:

```
/canon-generate-batch
catalog product
catalog parameter --parent product
commerce order
```

Soft guidance: 3–5 objects per batch keeps concurrent STAGING/PROD load and the resulting review batch manageable. This is not a hard cap — a larger list is not refused, just discouraged.

## Step A — Batched preflight (do this directly, sequentially — no agents, no Workflow)

For each line:
1. Normalise `<namespace>`/`<object>`/`<parent>` exactly as `canon-generate` Step 0.1 does.
2. Compute the target filename (preamble §5.1).
3. Check `objects/<target filename>` — if it exists, read it fully (including Section 10); this object is a **refresh**. Otherwise it's a **fresh draft**.
4. Read `questions/CANON_BACKLOG.md` for this object's row.
5. Grep `questions/CANON_OPEN_QUESTIONS.md` and `objects/*.md`/`platform/*.md` for the object's expected ID prefix — ask the human directly if genuinely unknown, same as `canon-generate` Step 0.5.

**Dedupe on the normalised `(namespace, object, parent)` tuple** before continuing — two literal input lines could normalise to the same target filename. Drop duplicates and note them for Step G.

## Step B — One consolidated environment/ID/token round

This is open-ended data collection (object IDs are strings, not discrete choices) — ask in one plain conversational message, not `AskUserQuestion`. Before asking, run `test -n "$CANON_TOKEN_<ENV>_<ACTOR>"` (Bash) for every `CANON_TOKEN_<ENV>_<ACTOR>` var the whole batch will need, and only surface genuinely missing ones. Then list every object that needs a STAGING and/or PROD object ID and ask for all of them at once (per preamble §7, environments are fully isolated — a separate ID is required per environment, per object).

If the human can't supply an ID or fix a missing token for a given object, **drop that object from the batch** — note it for Step G — rather than blocking the objects that are ready.

## Step C — Serial repo pre-sync (Bash, not Workflow)

Compute the distinct **namespaces** present in the surviving batch. Run `python scripts/canon_repo_sync.py <namespace>` once per distinct namespace, **strictly one at a time** — never concurrently, even though the rest of the batch fans out in Step D. Redundantly re-syncing a repo shared by two namespaces is safe when done sequentially (just a few wasted seconds); do not attempt to dedupe by underlying repo name — dedupe by namespace only, since that's what the script takes.

If a namespace's sync fails (unmapped `namespaceRepoMap` entry, auth failure), **exclude every object in that namespace** from Step D and report it in Step G with the exact error — do not skip or guess at a repo location, matching `canon-generate`'s own Step 4 behavior.

## Step D — Parallel per-object evidence + draft assembly (`Workflow` tool)

Call `Workflow` with a script that runs one `agent()` per surviving object via `parallel()` — this is a genuine barrier (Step E needs every object's candidates together for one human round), not an artificial one. Do not use `pipeline()` here; there is no cross-item multi-stage transform, just fan-out-then-gather. Do not set `isolation: 'worktree'` — each agent only writes to its own `.evidence/<namespace>_<object>/<run>/draft/`, already isolated by directory and gitignored.

Each agent's prompt must:
1. Tell it to read `.claude/skills/canon-generate/SKILL.md`'s "Required reading" list in full, then perform the equivalent of that Skill's **Steps 1 (schema), 2 (live fetch), 3 (actor diff), and the research-and-draft-assembly parts of Steps 5 and 6** for its one object — passing in the object ID(s)/environment(s) gathered in Step B.
2. Tell it to do the source-code research **directly** (grep/read within the repo path `canon_repo_sync.py` printed for its namespace in Step C) rather than delegating to a further nested sub-agent — a nested Agent-tool call from inside a Workflow-spawned agent isn't a supported pattern here, and this `agent()` call already **is** the isolated research sub-agent Step 5 originally wanted.
3. Include Step 5's actual research brief **verbatim** (the per-template-section bullet list, `file:line` citation discipline, "confirmed vs. inferred," the cross-object-correction escape hatch) — do not paraphrase it down; that brief is real quality control.
4. Tell it to **skip repo-sync entirely** (already done in Step C) and **never ask the human anything** — instead of resolving candidate open questions (`canon-generate`'s own Step 6 sub-process), it must emit them as data in its return value.
5. Tell it: if a parent object referenced by this object is itself a fresh (non-refresh) draft elsewhere in this same batch, do **not** `[[WikiLink]]` it — plain prose only, same "never link an object that isn't yet canonised" rule as always. Only link if that parent is a refresh of an already-canonised object.
6. Tell it to write its own draft to `.evidence/<namespace>_<object>/<run>/draft/...` (Section 10 left as a clearly-marked list of unresolved candidates, not finalized), and to return a small structured object via a JSON schema — never the full draft text, to keep the join payload light:
   ```json
   {
     "namespace": "...", "object": "...", "isRefresh": true, "idPrefix": "...",
     "draftPath": ".evidence/.../draft/...",
     "candidateQuestions": [{ "scope": "object", "text": "..." }],
     "correctionsToOtherCanonisedObjects": [{ "file": "...", "what": "...", "why": "..." }],
     "newObjectCandidatesFound": [{ "namespace": "...", "object": "...", "why": "..." }]
   }
   ```

**Partial failure:** if one object's agent errors, finalize the objects that succeeded and report the failure separately in Step G with a pointer to re-run `/canon-generate <namespace> <object>` directly for it — do not abort the whole batch. Nothing past Step D depends across objects except the shared human round in Step E.

## Step E — One consolidated human Q&A round (you, not Workflow)

Collect every surviving object's `candidateQuestions`. **Dedupe `scope: "env"` candidates that more than one object raised independently** (e.g. two objects both surface the same STAGING/PROD suppression disagreement for the same underlying platform behavior) into a single question — never ask the same underlying ambiguity twice.

Present the result as one plain conversational batched round, numbered and grouped by object, matching `canon-generate`'s own Step 6 style — do not force this into `AskUserQuestion`'s discrete-choice format, since most of these are open-ended confirmations, not multiple-choice.

Apply the same three outcomes as `canon-generate` Step 6 to each answer: a confirmable fact gets incorporated directly; a lead gets chased with another evidence check before deciding; a genuine "I don't know" becomes a real tracked open question.

## Step F — Serial finalization (you, directly — Edit tool, not agents)

One object at a time, in sequence — never concurrently, even though gathering was parallel:

1. Edit that object's draft Section 10: fold in confirmed facts (worded plainly, no inline provenance — a changelog row is enough of a record), or add genuinely-unresolved questions (numbered with the object's correct prefix).
2. Apply the Step 7-equivalent bookkeeping edits for that object: `questions/CANON_OPEN_QUESTIONS.md`, `questions/CANON_BACKLOG.md`, `config/canon_path_segment_exclusions.json`, and any new preamble §5.3 ID-prefix rows — using `canon-generate` Step 7's exact mechanics (heading/table insertion above the trailing `## Changelog`, backlog status → 🟡 Known Pending Issues, never 🟢).
3. **Re-grep every shared file immediately before each edit** — never off a snapshot taken back in Step A. This applies to every shared file this step touches, not only the `ENV-NNN` case.
4. A deduped `ENV-NNN` candidate (Step E) gets **exactly one** fresh number, cited from every object's Section 10/inline reference that raised it — never re-derive "next free NNN" separately per object for the same deduped item.

Still promotes nothing into `objects/` — every draft stays under `.evidence/.../draft/`, same boundary as single-object `canon-generate`.

## Step G — Batched human checkpoint

Summarize the whole batch: what was generated per object (new vs. refresh), where each draft lives, what changed in bookkeeping, any direct corrections made to other already-canonised objects, any new-object candidates surfaced, and every object dropped along the way (Step A dedup, Step B missing ID/token, Step C namespace sync failure, Step D agent failure) with the specific reason for each.

Tell the human to review everything, then run `/canon-submit-pr <namespace> <object>` per object or bundled, exactly as with single-object `canon-generate` output — `canon-submit-pr` already handles multi-object bundling (its own "Scoping a PR" guidance) and needs no changes to consume a batch's output.
