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
- `templates/CANON_AUTHORING_SESSION_PROMPT.md` — section-by-section authoring guidance and the language standards (never "hard delete"/"cascade deletion"; use "permanently removed — no longer retrievable via the API"; atomic numbered `BR-NNN`; `Namespace: Object` cross-references; raw JSON is working material, never pasted into canon output; no internal source-code identifiers anywhere in canon — this repo is public; short Rule Statements with supplementary detail in Notes; Notes hold behavioral information only, never citations/attribution/"corrects prior canon" framing).

## Step 0 — Preflight

1. Normalise `<namespace>`/`<object>` (lowercase, hyphenate multi-word names — matches `scripts/extract_canon_schema.py`'s `normalise()`).
2. Determine the target filename per preamble §5.1: `CANON_OBJECT_<Namespace>_<Object>.md`, or `CANON_OBJECT_<Namespace>_<Parent>_<Object>.md` if `--parent` was given.
3. Check `objects/<target filename>` — if it exists, **read it fully**, including its Section 10 Open Questions. This run is a **refresh**: at Step 6 you will produce a diff against the existing content in your final chat summary, not a blind rewrite. If it doesn't exist, this is a fresh draft.
4. Read `questions/CANON_BACKLOG.md` for this object's row (existing notes, prior status).
5. Grep `questions/CANON_OPEN_QUESTIONS.md` and `objects/*.md`/`platform/*.md` for the object's expected ID prefix (`preamble/PLATFORM_CANON_PREAMBLE.md` §5.3 — ask the human if the prefix isn't yet known, do not guess) so you know the next free `NNN` before Step 7 — resolved questions are cited inline in canon rather than tracked in a separate file, so canon itself is the record of IDs already used.
6. Decide which environments/Actors you'll need (ask the human for STAGING and/or PROD object IDs — per preamble §7, environments are fully isolated, so **a separate ID is required per environment**, never assume one ID resolves in both). In the same round, **ask the human whether there is a Confluence page (or pages) documenting this object** — for business context, terminology, and cross-system mapping. It's optional (there may be none, one, or several) and best-effort; capture whatever links they give for Step 5.5.
7. Confirm the required `CANON_TOKEN_<ENV>_<ACTOR>` env vars are set for the environments/Actors you'll use — e.g. `test -n "$CANON_TOKEN_STAGING_OPERATIONS"` — before doing anything else. If missing, stop and tell the human exactly which var to set (see `.env.example`).
8. Create the run directory: `.evidence/<namespace>_<object>/<UTC timestamp, e.g. 20260715T143000Z>/`.

## Step 1 — Schema grounding

STAGING's OpenAPI spec is always authoritative for schema grounding — do not rely on a manually-downloaded spec file, and do not fetch or diff against PROD's spec. STAGING can be ahead of PROD (preamble §7: STAGING is used for early access to major releases before PROD promotion), so there's no need to reconcile the two — just use STAGING's:

```
python scripts/canon_fetch_openapi_spec.py staging --out .evidence/<namespace>_<object>/<run>/schema/openapi_staging.json
```

This is an unauthenticated GET (no token needed). Then extract the object's schema from it with the existing script, unmodified:

```
python scripts/extract_canon_schema.py .evidence/<namespace>_<object>/<run>/schema/openapi_staging.json <namespace> <object> [--exact]
```

Use `--exact` for top-level objects to avoid pulling in child-object paths (see the script's own docstring for guidance).

This feeds template §1 (Identity) and §5 (Key Attributes — field names, types, required-ness, enum values). Note any spec ambiguity directly in the relevant canon section, with a citation (e.g. "field X is absent from the schema's `required` array, but confirmed always-required via live fetch/repo research") — there is no separate spec-discrepancy tracker; the confirmed fact belongs in the canon document itself, not a side file.

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

If it exits with a `CANON_REPOMAP_<NAMESPACE>` (or `CANON_AZDO_ORG_URL`) missing-variable error, stop and tell the human exactly which `.env` variable needs the Azure DevOps org/project/repo details (see `.env.example`) — do not skip this step silently or guess at repo locations. (The namespace→repo map lives in gitignored `.env`, not the committed config, so private repo names aren't published.)

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
> If you find that correctly documenting `<Object>` requires a change to a *different* object's existing canon (e.g. a relationship, cross-reference, or business rule in another object's file is wrong or incomplete because of what you learned here), do not edit that other file yourself — report it back to me with namespace, object, file, and exactly what needs to change and why, so I can make the correction directly as part of this same session (see Step 6).

Write its findings to `.evidence/<namespace>_<object>/<run>/repo_notes.md`.

## Step 5.5 — Business-context documentation (Confluence, optional)

For any Confluence link(s) the human gave in Step 0.6, fetch the page(s) via the Atlassian MCP (`getConfluencePage`) and read them for business context. Save what you use to `.evidence/<namespace>_<object>/<run>/confluence/` (a short extract or the fetched markdown), the same way other evidence is retained. Use only pages the human explicitly pointed to — **do not search Confluence for the object yourself**; an automated keyword search returns unreliable, easily-mismatched hits, and building on the wrong page is worse than having no page at all. If the human gave no link, skip this step.

- **All of this is evidence for a PM-curated document — no source is automatically "the truth".** Everything gathered (OpenAPI schema, live JSON, repo code, Confluence) is context for a canon document that a domain-expert PM reviews, curates, and owns (README: "canon that has not been reviewed by a domain expert is not canon"). Confluence adds the *why* the other sources don't carry — intent, terminology, business rationale, cross-system mapping (ERP, Cloud-iQ, etc.). No source ranks above the others by default; in particular, **implemented code is not the arbiter of intended behaviour** — it can be buggy, incomplete, or lag the intent a design page describes, just as a spec can be generated wrong or live data can be an unrepresentative edge case. Weigh the sources; don't let any one silently override another.
- **When sources disagree, surface the divergence — never resolve it by fiat.** A Confluence page describing intended behaviour the code doesn't implement (or implements differently) is a signal to raise, not a doc to discard in favour of the code. Bring any such divergence — and any behaviour a page describes that the other evidence doesn't corroborate — to the human's Step 6 resolution round; the PM decides what the canon states (a confirmed rule, a documented intent-vs-implementation gap, a tracked open question, or an unreleased-and-omit call, as with ship-to/bill-to vs. `invoiceFormats`). One use of this canon is to **audit the platform's code against intended behaviour**, so it must not simply mirror what the code does — a document that parrots the implementation can't catch the implementation being wrong. Capturing an intent-vs-implementation divergence (rather than conforming canon to the code) is exactly what makes that audit possible; how it's captured is the PM's call, not an automatic "code wins".
- **Never paste Confluence prose verbatim into the draft** — same rule as raw JSON and source identifiers. Derive the business rule, terminology, or relationship from it; the page is working material.
- **Availability is not guaranteed.** The Atlassian MCP may not be connected, and many objects have no page. If there's nothing to consult, proceed on the other evidence and note in the Step 8 summary that no Confluence context was available — its absence never blocks the draft or the object being marked complete.

## Step 6 — Draft assembly

Using the preamble, template, `CANON_AUTHORING_SESSION_PROMPT.md`'s guidance, and everything gathered in Steps 1–5, fill in every template section. Rules:

- This run's draft is for `<namespace>`/`<object>`. If drafting surfaces a needed correction to a *different*, already-canonised object (e.g. this object's evidence disproves a claim in another object's file — a real, recurring case, since platform objects reference and depend on one another), make that correction directly in the other object's file in `objects/` now, with its own changelog row citing what was learned in this run. `canon-submit-pr` no longer requires a PR to stay scoped to one object (see its "Scoping a PR" guidance) — bundling a small, evidence-driven correction to a related object alongside this run's own draft is expected, not a special case. Reserve the Step 8 follow-up flag for changes big enough to warrant their own full `canon-generate` run (a new object, or a correction needing its own evidence-gathering rather than something already confirmed here).
- **Every row in §3.2 Transitions must have its Endpoint / Verb column filled — this is mandatory, not optional (template v0.3).** Prefer Step 1's matched OpenAPI paths as the source (they give the literal, confirmed segment for any dedicated action endpoint); use Step 5's repo findings to corroborate or to identify transitions that are plain field/status writes with no dedicated endpoint. Never leave this column blank and never paraphrase the Action column's human description into it — if the literal mechanism genuinely isn't confirmed by either source, that's an open question (Section 10), not a blank cell or a guess. This is exactly the gap that caused `config/canon_path_segment_exclusions.json` to need re-deriving from the live spec instead of the existing docs — do not reintroduce it.
- Raw JSON never appears in the draft — only prose/tables derived from it, exactly like the manual process already requires.
- Every business rule is atomic and numbered `BR-NNN`; every cross-reference uses `Namespace: Object` (preamble §5.2) or `[[WikiLink]]`-style object-name links matching existing canon style (see e.g. `objects/CANON_OBJECT_Catalog_Product.md`) — see "Wikilinking other objects" below for exactly where each form applies.

### Wikilinking other objects

`[[WikiLink]]` brackets are what `.canon/`'s graph parser (`MENTION_RE`) actually resolves into cross-object edges — plain text or backtick-only mentions create no error, but also no edge, so they're a silent completeness gap, not a validation failure. Apply these rules to every section, not just the one you're actively editing — a refresh touches the whole document's mentions, not only the lines you changed.

- **Link the object's canonical `Object Name`, never your own object.** Grep the target file's `**Object Name:**` field before linking anything ambiguous — e.g. `[[Item]]` (Catalog: Product Item) and `[[Price List Item]]` (Catalog: Price List Item) are different entities and easy to conflate. Self-mentions of the current object are never bracketed (the graph parser excludes them anyway).
- **Plural form goes outside the brackets:** `[[Order]]s`, not `[[Orders]]` — the parser only resolves the exact bracketed text, and pluralizing inside the brackets breaks the lookup.
- **Never combine backticks with brackets** — `` [[`Order`]] `` breaks resolution (backtick characters become part of the lookup key). If a word is both a real object reference and something you'd otherwise wrap in code formatting, drop the backticks and bracket it instead.
- **Never link an object that isn't yet canonised** (no `objects/`/`platform/` file exists for it) — this creates a broken mention. If BR text needs to reference such an object, name it in plain prose and say so explicitly (e.g. "Programs are not yet canonised").
- **Co-promoted siblings are a trap — flag their cross-links for the promotion step.** When two (or more) mutually-referential objects are drafted in the same session/batch and will be promoted together (e.g. Buyer + ErpLink), a draft written before its sibling exists in `objects/` cannot bracket-link that sibling without a broken mention, so it leaves the sibling in plain text. Those plain mentions will *not* auto-correct — once both land in `objects/` in the same PR the links become valid, but only if someone adds them. So: when you draft such an object, leave the not-yet-canonised sibling in plain prose **and** record, in your Step 8 summary, that its `[[Sibling]]` cross-links must be bracketed at promotion time. The `canon-submit-pr` promotion step is where they actually get added (see that Skill's Step 4). This applies in both directions — check every co-promoted object for plain mentions of every other, not just the one drafted last.
- **First mention per cell/paragraph is enough** — within a single table cell or prose paragraph, link the first occurrence of each distinct object; repeated mentions of the same object in that same cell don't need re-linking. Each column in the same table row is its own cell for this purpose (a Trigger cell and its row's Notes cell each get their own first mention).
- **Enum values vs. real objects — link only when the word asserts object identity.** When an enum's possible values are literally the names of real, separately-canonised objects (e.g. Parameter's `scope`: Agreement/Asset/Item/Order/Subscription), drop backticks and bracket-link them. When enum values *don't* correspond to real objects, or the word names something else that happens to share spelling with an object (e.g. Parameter's `phase` enum includes `Order`, naming a lifecycle phase, not the Order object), keep it backtick-only — even in the same sentence as a real bracketed reference to that same word used as an object.
- **Section-by-section policy:**
  - **DO bracket-link:** Section 1 Description; Section 4 Business Rules (Rule Statement and Notes columns); Section 7 Lifecycle Events (Trigger / Effect / Notes columns); Section 8 narrative prose; Section 9 Failure Modes (Scenario / Behavior / Notes columns).
  - **DO NOT bracket-link:** Section 5 Key Attributes' Description column (plain English; cross-reference via "see BR-XXX" instead); Section 6 Relationships table's Description column (redundant with the Related Object column, which already uses `Namespace: Object`); Section 7's "Affected Object" identifier column (it's a plain identifier, not prose); `preamble/PLATFORM_CANON_PREAMBLE.md` (uses `Namespace: Object` only, never brackets); Changelog rows (Section 11); Section 2/3 annotation blockquotes and Section 3 state/transition tables (not in scope — matches existing canon style).
  - A `Namespace: Object` citation (e.g. "See Commerce: Order canon BR-001") still gets the object name bracketed even with the namespace prefix present: `Commerce: [[Order]]` — this hybrid form is the established style wherever Notes cite another object's canon.
- **Canon documents business rules and observed behavior, not technical implementation.** The OpenAPI spec, live JSON samples, and Step 5's source-code research are evidence used to arrive at a confirmed fact — the mechanism by which it was established (an internal class/method name, a file path, a line number, a migration name, query-filter mechanics) never appears in the draft itself, even worded generically. This matters doubly because this repo is public and the synced source (Step 4) is from a separate, private engineering repo — a class or method name leaking into canon is an out-of-place disclosure, not just a style issue.
- **Rule Statements are short and to the point** — one or two sentences for the general constraint. Supplementary detail (an enumerated list of concrete values, a mapping, an illustrative example) belongs in the Notes column, not folded into the Rule Statement (see `CANON_OBJECT_TEMPLATE.md` §4 guidance for the pattern).
- **The Notes column (in every table, not just Business Rules) holds additional behavioral information only** — never a citation ("Confirmed directly", "Confirmed by [name]"), never attribution, never a reference to what a prior canon version said ("Corrects prior canon", "New, not in prior canon"). Canon is always a present-state snapshot; corrections and their provenance belong only in the Changelog (Section 11). An empty Notes cell is `—`, not filler text.
- **The Section 11 Changelog is ordered newest-first** — the most recent version is the top data row (directly under the header separator), the oldest is at the bottom. When you add this run's changelog row (to this object's draft, or to another already-canonised object you're correcting per the first rule above), insert it at the **top** of the table, never appended to the bottom.
- When Section 10 has no open questions, write exactly "No open questions at this time." — do not recap which questions were resolved, descoped, or reopened during this run; that belongs in the Changelog.
- Anything not confirmed by evidence (Steps 1–5) is a **candidate** open question, not an automatic one — see "Resolve candidates with the human" below before it's allowed into Section 10.
- If this is a **refresh** (Step 0.3), also write a short section-by-section diff summary against the current `objects/` version into your final chat response (not a file).

### Resolve candidates with the human before finalizing Section 10

This Skill is always invoked interactively — there is no unattended mode where asking isn't possible, so never park something the human might just know. Before Section 10 is written into the draft, take every candidate open question (from this step, from Step 3's `ENV-NNN` case, from anywhere else) and ask the human directly. Batch them into one round of questions rather than trickling them one at a time.

- **The human answers with a confirmable fact** — incorporate it directly into the relevant section, stated plainly as a fact about platform behaviour — no inline "confirmed by/on" provenance needed in the section itself; a changelog row noting what was resolved and how is enough of a record. It never appears in Section 10 at all, and there is no separate resolved-questions file to log it to either.
- **The human gives a lead, not a final answer** (e.g. "check field X" or "I think it's Y, confirm in the code") — chase the lead with another Step 1/Step 5-style evidence check before deciding whether it's now confirmed or still open. Don't take the lead itself as confirmation without checking it.
- **The human genuinely doesn't know** — only now does it become a real, tracked open question: numbered (correct ID prefix, next free `NNN` from Step 0.5), cross-referenced inline in the relevant section, added to Section 10.

Never guess or assume by analogy to other objects at any point in this process — an unconfirmed answer from any source (evidence or human) stays a candidate until it's actually confirmed one way or the other.

Write the draft to `.evidence/<namespace>_<object>/<run>/draft/CANON_OBJECT_<Namespace>_<Object>.md` (or the `_<Parent>_<Object>.md` variant). **Never** write to `objects/` or `platform/` directly, even for a refresh.

## Step 7 — Bookkeeping (the only tracked-tree edits this Skill makes)

These edits are primarily scoped to `<namespace>`/`<object>`. If Step 6 made a direct correction to a different, already-canonised object's file (or resolved a question already open for it), remove that object's own now-resolved row from `questions/CANON_OPEN_QUESTIONS.md` if it had one, in the same run — don't leave that object's bookkeeping stale just because this run's primary subject is `<namespace>`/`<object>`. A change big enough to need its own new evidence-gathering pass is still a Step 8 follow-up instead, not bookkeeping done here.

- **`questions/CANON_OPEN_QUESTIONS.md`** — only for candidates the human genuinely couldn't answer (per Step 6's resolution step). If a `## CANON_OBJECT_<Namespace>_<Object>.md` heading doesn't already exist, insert one (with its `| # | Question |` table) directly above the file's trailing `## Changelog` section, matching its existing organic (non-alphabetical) ordering. Add new question rows using the next free `NNN` for the object's prefix. Append a new row to its own `## Changelog` table, e.g. `| 2.1 | <date> | Stu / canon-generate | XXX-001 added from <Object> canon-generate run. |`. Anything resolved *in this same run* — whether by evidence or by the human answering directly in Step 6 — is simply removed from this file (if it was ever tracked here) and incorporated into canon with a citation; there is no separate resolved-questions file to move it to.
- **`questions/CANON_BACKLOG.md`** — update the object's row: Status → 🟡 Known Pending Issues (**never** 🟢 Up to Date — promotion and completeness are a human call, made via `canon-submit-pr` and PM review, never by this Skill). Notes → e.g. `"Draft generated <date> via canon-generate — pending PM review. N open question(s). See .evidence/<namespace>_<object>/<run>/draft/."`. Leave the `Canon File` column empty until the draft is actually promoted into `objects/`. Leave **Last Updated** as whatever it already was — it only advances once the draft is actually promoted (`canon-submit-pr` Step 2.5), since until then the live canon file hasn't changed. Add a changelog row if the file has one for this kind of change.
- **`config/canon_path_segment_exclusions.json`** — add any segments confirmed during Step 1's classification under this object's own scope key (`namespace.object[.child...]`), in whichever of `state_transition_verbs` / `action_verbs` / `non_object_resources` fits, with a short reason. Only use `_global` for a pattern confirmed to apply across many objects, not as a default. Do not add segments confirmed as real, distinct objects — those are Step 8 follow-ups instead, not exclusions.

## Step 8 — Human checkpoint

End with a summary: what was generated (or how it diffs from the existing canon file, if a refresh), where the draft lives, what open questions were added or resolved, and what changed in the backlog. If Step 6 made a direct correction to another already-canonised object's file, call that out explicitly (which file, what changed, why) so the human can review it alongside this run's primary draft. Explicitly tell the human to review everything, then run `/canon-submit-pr <namespace> <object>` when they're ready to open a PR — this Skill never promotes its own output into `objects/` or opens a PR itself.

If Step 1, Step 5, or Step 6 flagged something too large to fold into this run — a real, distinct object nobody's tracked yet (e.g. an action-suffix segment from Step 1 that turned out to be its own object), or a correction to another object that needs its own evidence-gathering rather than something already confirmed here — list each one explicitly: namespace, object, and what needs to change. Recommend the human run `/canon-generate` on that object as its own separate run.
