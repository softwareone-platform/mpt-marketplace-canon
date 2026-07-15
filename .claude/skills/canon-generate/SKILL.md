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

Fetch the live OpenAPI spec for each environment in scope — do not rely on a manually-downloaded spec file, since STAGING can be ahead of PROD (preamble §7: STAGING is used for early access to major releases before PROD promotion), so a single cached spec can be stale for one environment even while current for the other:

```
python scripts/canon_fetch_openapi_spec.py <staging|prod> --out .evidence/<namespace>_<object>/<run>/schema/openapi_<env>.json
```

This is an unauthenticated GET (no token needed). Then extract the object's schema from it with the existing script, unmodified:

```
python scripts/extract_canon_schema.py .evidence/<namespace>_<object>/<run>/schema/openapi_<env>.json <namespace> <object> [--exact]
```

Use `--exact` for top-level objects to avoid pulling in child-object paths (see the script's own docstring for guidance).

This feeds template §1 (Identity) and §5 (Key Attributes — field names, types, required-ness, enum values). Note any spec ambiguity (e.g. a field plainly always-required but absent from the schema's `required` array — see existing precedent in `questions/CANON_SPEC_DISCREPANCIES.md` SD-001 through SD-005) as a candidate discrepancy for Step 7.

If both STAGING and PROD are in scope, fetch and extract from both and compare — if the two schemas disagree (a field or path present in one environment's spec but not the other's), that's a genuine environment-drift finding, not something to silently resolve one way. Treat it the same as a spec-vs-observed-reality discrepancy.

### Classify unrecognized action-suffix segments

Look at the matched paths' segments that immediately follow an `{id}` (e.g. `publish` in `/catalog/items/{id}/publish`). Load `config/canon_path_segment_exclusions.json`. Its top-level keys are scopes — `_global` for patterns confirmed to apply across many objects (e.g. `icon`), or a dotted `namespace.object[.child...]` path matching where the segment was found (e.g. `catalog.items`, `catalog.products.media`) — each holding three categories: `state_transition_verbs`, `action_verbs`, and `non_object_resources`. Check the segment against the current object's own scope key and `_global`.

For any segment **not classified at either scope**, confirm with the human before treating it either way — don't guess, and don't default to a flat/global classification when the evidence is really object-specific:
- **Confirmed as a state transition** (changes the object's own lifecycle state — i.e. it belongs, or should belong, as a row in *this object's* template §3.2 Transitions table) — add it under this object's own scope key's `state_transition_verbs`, with a short reason citing where it's confirmed (this draft's own evidence, since the object is being generated right now). The segment itself is exactly the value that row's Endpoint / Verb column needs (see Step 6) — use it there, don't just file it away in the exclusions list and leave the draft's own table incomplete.
- **Confirmed as a real action but not a lifecycle state change** (e.g. a supplementary operation named in Business Rules rather than the Transitions table — like "manage Split Billing" not itself moving the object between states) — add it under `action_verbs` at the same scope.
- **Confirmed as a non-object sub-resource** (like `icon`) — add it under `non_object_resources`. Only use the `_global` scope if the pattern is genuinely confirmed to apply platform-wide (per the preamble or multiple objects) — default to this object's own scope key otherwise, since the same word can mean something different for a different object.
- **Confirmed as something else** (a real, distinct object nobody's tracked yet) — do not add it to the exclusions file at all. Flag it in Step 8 as a candidate new object for its own future `canon-generate` run, the same way a cross-object dependency finding is flagged, rather than folding it into this draft.

This is how `scripts/extract_objects.py`'s checklist (used to refresh `questions/CANON_BACKLOG.md`) gets more accurate over time without ever needing a hardcoded verb list maintained by hand — coverage builds up incrementally, per object, as objects get run through this Skill.

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

Operations is the suppression baseline (preamble §5.5). Read both diff outputs. If STAGING and PROD diffs *disagree* about which fields are suppressed for the same Actor, do not silently pick one — this is a candidate `ENV-NNN` open question, subject to the same ask-before-parking rule as every other open question (see Step 6).

This is the primary empirical input to template §2 (Ownership & Visibility) and §6.3 (Actor-Based Field Suppression) — but you still write the actual table/prose; the script only produces the raw suppressed/unexpected-field lists.

## Step 4 — Repo sync

```
python scripts/canon_repo_sync.py <namespace>
```

If it exits with a `namespaceRepoMap.<namespace>` error, stop and tell the human exactly which key in `config/canon_pipeline.config.json` needs the Azure DevOps project/repo details — do not skip this step silently or guess at repo locations.

## Step 5 — Source-code research (delegate to a sub-agent)

Launch a general-purpose or Explore sub-agent (read-only — it must never write, commit, or push into the synced repo) scoped to the path(s) `canon_repo_sync.py` reported. Give it this brief, filled in for the specific object:

> Search `<synced repo path(s)>` for the `<Object>` object (namespace: `<namespace>`). Report findings back to me, tagged by canon template section, with `file:line` citations for every claim:
> - **§3 State Machine** — the state enum/type, every transition method and its guard conditions, any precondition not visible from the OpenAPI spec alone. For every transition, report the literal route/endpoint or action name as written in the code (e.g. the exact string in a route attribute or controller action) — not just a paraphrase of what it does. If a transition has no dedicated endpoint (a plain field/status write), say so explicitly rather than leaving it ambiguous.
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
- **Every row in §3.2 Transitions must have its Endpoint / Verb column filled — this is mandatory, not optional (template v0.3).** Prefer Step 1's matched OpenAPI paths as the source (they give the literal, confirmed segment for any dedicated action endpoint); use Step 5's repo findings to corroborate or to identify transitions that are plain field/status writes with no dedicated endpoint. Never leave this column blank and never paraphrase the Action column's human description into it — if the literal mechanism genuinely isn't confirmed by either source, that's an open question (Section 10), not a blank cell or a guess. This is exactly the gap that caused `config/canon_path_segment_exclusions.json` to need re-deriving from the live spec instead of the existing docs — do not reintroduce it.
- Raw JSON never appears in the draft — only prose/tables derived from it, exactly like the manual process already requires.
- Every business rule is atomic and numbered `BR-NNN`; every cross-reference uses `Namespace: Object` (preamble §5.2) or `[[WikiLink]]`-style object-name links matching existing canon style (see e.g. `objects/CANON_OBJECT_Catalog_Product.md`).
- Anything not confirmed by evidence (Steps 1–5) is a **candidate** open question, not an automatic one — see "Resolve candidates with the human" below before it's allowed into Section 10.
- If this is a **refresh** (Step 0.3), also write a short section-by-section diff summary against the current `objects/` version into your final chat response (not a file).

### Resolve candidates with the human before finalizing Section 10

This Skill is always invoked interactively — there is no unattended mode where asking isn't possible, so never park something the human might just know. Before Section 10 is written into the draft, take every candidate open question (from this step, from Step 3's `ENV-NNN` case, from anywhere else) and ask the human directly. Batch them into one round of questions rather than trickling them one at a time.

- **The human answers with a confirmable fact** — incorporate it directly into the relevant section as confirmed canon (cite it, e.g. "Confirmed by [name] during canon-generate session, `<date>`" — matching how prior canon already cites "conversation" as a source, e.g. Webhook v0.1's changelog). It never appears in Section 10 at all. If it's the kind of thing worth a permanent record, log it straight into `questions/CANON_RESOLVED_QUESTIONS.md` in Step 7 instead of ever touching the open-questions file — matches the existing precedent (e.g. SEL-003, resolved within its own session and never tracked as open).
- **The human gives a lead, not a final answer** (e.g. "check field X" or "I think it's Y, confirm in the code") — chase the lead with another Step 1/Step 5-style evidence check before deciding whether it's now confirmed or still open. Don't take the lead itself as confirmation without checking it.
- **The human genuinely doesn't know** — only now does it become a real, tracked open question: numbered (correct ID prefix, next free `NNN` from Step 0.5), cross-referenced inline in the relevant section, added to Section 10.

Never guess or assume by analogy to other objects at any point in this process — an unconfirmed answer from any source (evidence or human) stays a candidate until it's actually confirmed one way or the other.

Write the draft to `.evidence/<namespace>_<object>/<run>/draft/CANON_OBJECT_<Namespace>_<Object>.md` (or the `_<Parent>_<Object>.md` variant). **Never** write to `objects/` or `platform/` directly, even for a refresh.

## Step 7 — Bookkeeping (the only tracked-tree edits this Skill makes)

All edits below are scoped to `<namespace>`/`<object>` only — rows, IDs, and backlog entries for any other object (including one flagged as a Step 6 follow-up) are out of scope for this run, so that `canon-submit-pr` can keep each PR to one object (its Core Rule 1).

- **`questions/CANON_OPEN_QUESTIONS.md`** — only for candidates the human genuinely couldn't answer (per Step 6's resolution step). If a `## CANON_OBJECT_<Namespace>_<Object>.md` heading doesn't already exist, insert one (with its `| # | Question |` table) directly above the file's trailing `## Changelog` section, matching its existing organic (non-alphabetical) ordering. Add new question rows using the next free `NNN` for the object's prefix. Append a new row to its own `## Changelog` table, e.g. `| 2.1 | <date> | Stu / canon-generate | XXX-001 added from <Object> canon-generate run. |`.
- **`questions/CANON_RESOLVED_QUESTIONS.md`** — anything resolved *in this same run* — whether by evidence (e.g. a diff empirically confirms field suppression that was previously an open question) or by the human answering directly in Step 6 — goes straight here with `Resolution` and `Canon Reference` filled in — it never touches the open-questions file at all (matches the existing SEL-003 precedent in this file's Changelog). Add its own Changelog row.
- **`questions/CANON_SPEC_DISCREPANCIES.md`** — any confirmed spec-vs-observed-reality mismatch from Steps 1/2/5 becomes a new `SD-NNN` row in its existing table format, plus a Changelog row.
- **`questions/CANON_BACKLOG.md`** — update the object's row: Status → 🟡 In Progress (**never** 🟢 Complete — promotion and completeness are a human call, made via `canon-submit-pr` and PM review, never by this Skill). Notes → e.g. `"Draft generated <date> via canon-generate — pending PM review. N open question(s). See .evidence/<namespace>_<object>/<run>/draft/."`. Leave the `Canon File` column empty until the draft is actually promoted into `objects/`. Add a changelog row if the file has one for this kind of change.
- **`config/canon_path_segment_exclusions.json`** — add any segments confirmed during Step 1's classification under this object's own scope key (`namespace.object[.child...]`), in whichever of `state_transition_verbs` / `action_verbs` / `non_object_resources` fits, with a short reason. Only use `_global` for a pattern confirmed to apply across many objects, not as a default. Do not add segments confirmed as real, distinct objects — those are Step 8 follow-ups instead, not exclusions.

## Step 8 — Human checkpoint

End with a summary: what was generated (or how it diffs from the existing canon file, if a refresh), where the draft lives, what open questions/spec discrepancies were added or resolved, and what changed in the backlog. Explicitly tell the human to review the draft, then run `/canon-submit-pr <namespace> <object>` when they're ready to open a PR — this Skill never promotes its own output into `objects/` or opens a PR itself.

If Step 1, Step 5, or Step 6 flagged a needed change to a different object's canon — including an action-suffix segment from Step 1 confirmed as a real, distinct object rather than a verb/sub-resource — list each one explicitly here: namespace, object, and what needs to change. Recommend the human run `/canon-generate` on that object as its own separate run. Never fold it into this run's draft or bookkeeping; it becomes its own future PR, per Core Rule 1 in `canon-submit-pr`.
