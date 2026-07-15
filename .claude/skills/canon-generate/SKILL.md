---
name: canon-generate
description: Generate or refresh a canon object document from real evidence — OpenAPI schema, live multi-Actor API samples (STAGING/PROD), and platform source code — instead of the fully manual authoring session. Always produces a draft for human review; never writes directly into objects/.
---

# canon-generate

Orchestrates evidence-gathering and drafting for one platform object canon document. Replaces the manual `templates/CANON_SESSION_START.md` conversational flow with automated fetching, while keeping its editorial principles: the PM is the authority, not this Skill (`README.md`: "Canon that has not been reviewed by a domain expert is not canon"). This Skill only ever produces a **draft** for review — it never writes into `objects/` or `platform/`. Promotion into canon is a separate step, done by the `canon-submit-pr` Skill after the PM has reviewed the draft.

## Invocation

```
/canon-generate <namespace> <object> [--parent <parent-object>]
```

Examples: `/canon-generate catalog authorization`, `/canon-generate catalog terms-variant --parent terms`.

## Required reading before drafting

Read these in full before Step 6 (they are not restated here):
- `preamble/PLATFORM_CANON_PREAMBLE.md` — authoritative invariants; never contradicted, conflicts flagged explicitly.
- `templates/CANON_OBJECT_TEMPLATE.md` — the 11-section structure to fill in.
- `templates/CANON_AUTHORING_SESSION_PROMPT.md` — section-by-section authoring guidance and the language standards (never "hard delete"/"cascade deletion"; use "permanently removed — no longer retrievable via the API"; atomic numbered `BR-NNN`; `Namespace: Object` cross-references; raw JSON is working material, never pasted into canon output).

## Step 0 — Preflight

1. Normalise `<namespace>`/`<object>` (lowercase, hyphenate multi-word names — matches `scripts/extract_canon_schema.py`'s `normalise()`).
2. Determine the target filename per preamble §5.1: `CANON_OBJECT_<Namespace>_<Object>.md`, or `CANON_OBJECT_<Namespace>_<Parent>_<Object>.md` if `--parent` was given.
3. Check `objects/<target filename>` — if it exists, **read it fully**, including its Section 10 Open Questions. This run is a **refresh**: at Step 6 you will produce a diff against the existing content in your final chat summary, not a blind rewrite. If it doesn't exist, this is a fresh draft.
4. Read `questions/CANON_BACKLOG.md` for this object's row (existing notes, prior status).
5. Grep `questions/CANON_OPEN_QUESTIONS.md` and `questions/CANON_RESOLVED_QUESTIONS.md` for the object's expected ID prefix (`preamble/PLATFORM_CANON_PREAMBLE.md` §5.3 — ask the human if the prefix isn't yet known, do not guess) so you know the next free `NNN` before Step 7.
6. Decide which environments/Actors you'll need (ask the human for STAGING and/or PROD object IDs — per preamble §7, environments are fully isolated, so **a separate ID is required per environment**, never assume one ID resolves in both).
7. Confirm the required `CANON_TOKEN_<ENV>_<ACTOR>` env vars are set for the environments/Actors you'll use — e.g. `test -n "$CANON_TOKEN_STAGING_OPERATIONS"` — before doing anything else. If missing, stop and tell the human exactly which var to set (see `.env.example`).
8. Create the run directory: `.evidence/<namespace>_<object>/<UTC timestamp, e.g. 20260715T143000Z>/`.

## Step 1 — Schema grounding

Run the existing script unmodified:

```
python scripts/extract_canon_schema.py <spec_path> <namespace> <object> [--exact]
```

`<spec_path>` is the OpenAPI spec file the human provides (ask for it if not already available locally). Use `--exact` for top-level objects to avoid pulling in child-object paths (see the script's own docstring for guidance). Copy/move its output JSON into `.evidence/<namespace>_<object>/<run>/schema/`.

This feeds template §1 (Identity) and §5 (Key Attributes — field names, types, required-ness, enum values). Note any spec ambiguity (e.g. a field plainly always-required but absent from the schema's `required` array — see existing precedent in `questions/CANON_SPEC_DISCREPANCIES.md` SD-001 through SD-005) as a candidate discrepancy for Step 7.

The matched `paths` in the schema extract tell you the concrete API path template(s) (e.g. `/public/v1/catalog/products/{id}`) to use in Step 2 — pick the one that fetches a single object by ID (not a list endpoint).

## Step 2 — Live API fetch (multi-Actor, multi-environment)

For each environment in scope, using the object ID the human gave you for that environment:

```
python scripts/canon_fetch_live.py <namespace> <object> <id> \
  --path <path from Step 1> --env staging --actor all \
  --out-dir .evidence/<namespace>_<object>/<run>
```

Repeat with `--env prod` and the PROD object ID if PROD is in scope. This script is architecturally GET-only (see its docstring) — do not attempt to make it do anything else. If it exits with a missing-config or missing-token error, stop and report the exact fix needed rather than working around it.

This feeds real observed values for §5 (Key Attributes), and raw material for §2/§6.3 (see Step 3).

## Step 3 — Actor diff

For each environment fetched in Step 2:

```
python scripts/canon_diff_actors.py \
  --operations .../live/<env>/operations.json \
  --vendor .../live/<env>/vendor.json \
  --client .../live/<env>/client.json \
  --out .../diff/<env>_diff.json
```

Operations is the suppression baseline (preamble §5.5). Read both diff outputs. If STAGING and PROD diffs *disagree* about which fields are suppressed for the same Actor, do not silently pick one — record it as a new `ENV-NNN` open question instead (Step 7).

This is the primary empirical input to template §2 (Ownership & Visibility) and §6.3 (Actor-Based Field Suppression) — but you still write the actual table/prose; the script only produces the raw suppressed/unexpected-field lists.

## Step 4 — Repo sync

```
python scripts/canon_repo_sync.py <namespace>
```

If it exits with a `namespaceRepoMap.<namespace>` error, stop and tell the human exactly which key in `config/canon_pipeline.config.json` needs the Azure DevOps project/repo details — do not skip this step silently or guess at repo locations.

## Step 5 — Source-code research (delegate to a sub-agent)

Launch a general-purpose or Explore sub-agent (read-only — it must never write, commit, or push into the synced repo) scoped to the path(s) `canon_repo_sync.py` reported. Give it this brief, filled in for the specific object:

> Search `<synced repo path(s)>` for the `<Object>` object (namespace: `<namespace>`). Report findings back to me, tagged by canon template section, with `file:line` citations for every claim:
> - **§3 State Machine** — the state enum/type, every transition method and its guard conditions, any precondition not visible from the OpenAPI spec alone.
> - **§4 Business Rules** — validation logic, deletion guards, Default-protection pattern implementation (see preamble §3.4/§3.5 if applicable), cardinality constraints.
> - **§6/§7 Relationships & Lifecycle Events** — event publishers, cross-object writes, downstream triggers.
> - **§9 Failure Modes** — exception/error-handling branches revealing permitted-but-risky states.
>
> Distinguish explicitly between "read directly in code" and "inferred" for every claim. If logic spans multiple services or is ambiguous, say so — do not present an inference as a confirmed fact. When in doubt, flag it rather than guess (same principle as the manual authoring process's Open Questions Protocol).
>
> If you find that correctly documenting `<Object>` requires a change to a *different* object's existing canon (e.g. a relationship, cross-reference, or business rule in another object's file is wrong or incomplete because of what you learned here), do not edit that other file. Report it back as a flagged follow-up instead — namespace, object, and what needs to change — for Step 8.

Write its findings to `.evidence/<namespace>_<object>/<run>/repo_notes.md`.

## Step 6 — Draft assembly

Using the preamble, template, `CANON_AUTHORING_SESSION_PROMPT.md`'s guidance, and everything gathered in Steps 1–5, fill in every template section. Rules:

- This draft covers `<namespace>`/`<object>` only. If drafting surfaces a needed change to a *different* object's canon, do not make that edit here (not even in that other object's `.evidence/` draft) — carry it forward as a flagged follow-up for Step 8. One `canon-generate` run touches exactly one object, so that a later `canon-submit-pr` can keep to one object per PR (its Core Rule 1).
- Raw JSON never appears in the draft — only prose/tables derived from it, exactly like the manual process already requires.
- Every business rule is atomic and numbered `BR-NNN`; every cross-reference uses `Namespace: Object` (preamble §5.2) or `[[WikiLink]]`-style object-name links matching existing canon style (see e.g. `objects/CANON_OBJECT_Catalog_Product.md`).
- Anything not confirmed by evidence becomes a numbered open question (correct ID prefix, next free `NNN` from Step 0.5) cross-referenced inline in the relevant section — never a guess, never an assumption based on analogy to other objects.
- If this is a **refresh** (Step 0.3), also write a short section-by-section diff summary against the current `objects/` version into your final chat response (not a file).

Write the draft to `.evidence/<namespace>_<object>/<run>/draft/CANON_OBJECT_<Namespace>_<Object>.md` (or the `_<Parent>_<Object>.md` variant). **Never** write to `objects/` or `platform/` directly, even for a refresh.

## Step 7 — Bookkeeping (the only tracked-tree edits this Skill makes)

All edits below are scoped to `<namespace>`/`<object>` only — rows, IDs, and backlog entries for any other object (including one flagged as a Step 6 follow-up) are out of scope for this run, so that `canon-submit-pr` can keep each PR to one object (its Core Rule 1).

- **`questions/CANON_OPEN_QUESTIONS.md`** — if a `## CANON_OBJECT_<Namespace>_<Object>.md` heading doesn't already exist, insert one (with its `| # | Question |` table) directly above the file's trailing `## Changelog` section, matching its existing organic (non-alphabetical) ordering. Add new question rows using the next free `NNN` for the object's prefix. Append a new row to its own `## Changelog` table, e.g. `| 2.1 | <date> | Stu / canon-generate | XXX-001 added from <Object> canon-generate run. |`.
- **`questions/CANON_RESOLVED_QUESTIONS.md`** — anything resolved by evidence gathered *in this same run* (e.g. a diff empirically confirms field suppression that was previously an open question) goes straight here with `Resolution` and `Canon Reference` filled in — it never touches the open-questions file at all (matches the existing SEL-003 precedent in this file's Changelog). Add its own Changelog row.
- **`questions/CANON_SPEC_DISCREPANCIES.md`** — any confirmed spec-vs-observed-reality mismatch from Steps 1/2/5 becomes a new `SD-NNN` row in its existing table format, plus a Changelog row.
- **`questions/CANON_BACKLOG.md`** — update the object's row: Status → 🟡 In Progress (**never** 🟢 Complete — promotion and completeness are a human call, made via `canon-submit-pr` and PM review, never by this Skill). Notes → e.g. `"Draft generated <date> via canon-generate — pending PM review. N open question(s). See .evidence/<namespace>_<object>/<run>/draft/."`. Leave the `Canon File` column empty until the draft is actually promoted into `objects/`. Add a changelog row if the file has one for this kind of change.

## Step 8 — Human checkpoint

End with a summary: what was generated (or how it diffs from the existing canon file, if a refresh), where the draft lives, what open questions/spec discrepancies were added or resolved, and what changed in the backlog. Explicitly tell the human to review the draft, then run `/canon-submit-pr <namespace> <object>` when they're ready to open a PR — this Skill never promotes its own output into `objects/` or opens a PR itself.

If Step 5 or Step 6 flagged a needed change to a different object's canon, list each one explicitly here — namespace, object, and what needs to change — and recommend the human run `/canon-generate` on that object as its own separate run. Never fold it into this run's draft or bookkeeping; it becomes its own future PR, per Core Rule 1 in `canon-submit-pr`.
