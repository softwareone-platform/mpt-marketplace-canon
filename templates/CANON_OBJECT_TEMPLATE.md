# Object Canon: [Object Name]

> **Version:** 0.5
> **Owner:** [PM Name]
> **Last Updated:** 2026-07-15
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** [The canonical name of this object as used in the platform and API]

**Namespace:** [Catalog | Commerce | Billing | Administration | Notifications | Audit]

**Parent Object:** [If this is a child object, name the parent here using Namespace: Object format. If this is a top-level object, write "None — top-level object."]

**ID Prefix:** [The three-letter platform ID prefix for this object, e.g. PRD, PAR, TPL. Confirm with engineering if unknown — do not guess.]

**Description:**
[2–4 sentences. What is this object? What purpose does it serve? Who creates it and why? Avoid restating attribute names — describe the object's role in the platform.]

**Also Known As:**
[Any alternative names, legacy names, or informal names used by engineers, support, or vendors. If none, write "None known."]

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
|------------|------------|----------|------------|------------|-------|
| Vendor     |            |          |            |            |       |
| Operations |            |          |            |            |       |
| Client     |            |          |            |            |       |

> **Guidance:** "Can Delete" should be No for most objects. Refer to Platform Invariant 6 and Section 3.5 of the Preamble (Deletion Guards) before marking Yes. If deletion is permitted only in certain states, note the state constraint here and detail it in Section 4.

---

## 3. State Machine

> If this object has no state machine, replace this entire section with:
> "This object has no state machine. It is created and modified as a unit, with no intermediate states."

### 3.1 States

| State | Description |
|-------|-------------|
| [State] | [What does this state mean for the object and the Actors who interact with it?] |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | [Initial State] | Create | `POST` (base collection endpoint) | [Actor] | None | |
| T2 | | | | | | | |

> **Guidance on transitions:**
> - Every object must have a T1 creation transition from "—" to its initial state.
> - Terminal states (Deleted, Terminated, etc.) typically have no outbound transitions.
> - For deletion transitions, use "Permanently removed — no longer retrievable via the API" in the Notes column. Never use "hard delete."
> - Soft-deleted objects remain retrievable in some contexts — document this explicitly in Notes.
> - Do not model cascade deletions. If another object must be deleted first before this one can be deleted, that is a precondition on this transition — not an automatic side effect.
> - **Endpoint / Verb is mandatory and must be the literal API mechanism, not a paraphrase.** "Publish Product" in the Action column is a human-readable description; `publish` in this column is the literal, confirmable API mechanism (e.g. `POST .../publish`) — both are required, and one is not a substitute for the other. If the transition happens via a plain field/status write rather than a dedicated action endpoint, say so explicitly (e.g. `PATCH status field`, no dedicated endpoint) — never leave this column blank, and never guess at a literal name that isn't confirmed by the OpenAPI spec or source code. An unconfirmed mechanism is an open question, not an inferred value.

### 3.3 State Diagram

```
[State] ---(Action : Actor)---> [State]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
|---------|---------------|---------------------|-------------|-------|
| BR-001 | | | | |

> **Guidance on business rules:**
> - Number sequentially. Use sub-rules (BR-001a, BR-001b) for closely related constraints.
> - "Applies In State(s)" should be a specific state name, "All", or "N/A" for stateless objects.
> - Rules should be atomic — one constraint per rule.
> - **Keep the Rule Statement short and to the point** — one or two sentences stating the general constraint. Supplementary detail (an enumerated list of concrete values, a mapping, an illustrative example) belongs in the Notes column, not folded into the Rule Statement.
> - **The Notes column holds additional behavioral information only** — enumerated values, a cross-reference, a caveat about scope or confidence. Never citations ("Confirmed directly", "Confirmed by [name]"), never attribution, never a reference to what a prior canon version said ("Corrects prior canon", "New, not in prior canon"). Canon is a snapshot of the current state; corrections and their history belong only in the Changelog. If there's nothing left to add, write `—`.
> - Never name internal source-code identifiers (class/method names, file paths, line numbers, query-filter mechanics) anywhere in this table — this repo is public.
> - Common rule categories to consider:
>   - Ownership and scoping (e.g. "belongs to exactly one X")
>   - Default protection pattern (exactly one Default must exist; Default cannot be deleted; marking a new Default auto-demotes the existing one)
>   - Deletion guards (non-empty container, state-based, active-dependency-based)
>   - Mutability constraints (what can and cannot change after creation or after a given state transition)
>   - Cardinality constraints (how many of this object can exist in a given context)
>   - Interaction rules with other objects

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Mutable After [State]? | Notes |
|-----------|------|-------------|--------|------------------------|----------------------|-------|
| | | | | | | |

> **Guidance on attributes:**
> - List only attributes meaningful to product canon — not every API field.
> - "Mutable After [State]?" — replace [State] with the relevant state name (e.g. "Mutable After Published?"). Use N/A for stateless objects.
> - For fields suppressed from certain Actors (not visible in their API responses), note which Actors cannot see the field in the Notes column.
> - For fields omitted by default from API responses but retrievable via `?select=+fieldName`, note: "Omitted by default — request via select=+[fieldName]."
> - For fields absent from the API response when null (null suppression), note: "Absent from response when null."
> - For enum fields, list all valid values inline or cross-reference the BR that defines them.

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
|----------------|------------------|-------------|-------------|----------------------|
| | Parent / Child / Association | | | |

> **Guidance on relationships:**
> - Use fully namespace-qualified names: `Namespace: Object` (e.g. `Catalog: Product`, `Commerce: Order`).
> - This Related Object column itself, and this table's Description column, are not `[[WikiLink]]`-bracketed — the Related Object column already names the object plainly, and bracketing the Description column too would be redundant. Elsewhere in this document (Description, Business Rules, Lifecycle Events, Section 8, Section 9), do bracket-link object mentions — see `.claude/skills/canon-generate/SKILL.md`'s "Wikilinking other objects" for the full policy.
> - Relationship types:
>   - **Parent** — this object cannot exist without the related object.
>   - **Child** — the related object cannot exist without this object.
>   - **Association** — independent objects with a reference link between them.
> - Lifecycle Dependency: describe what happens to this object if the related object is deleted or changes state. The platform never cascades deletions — if this object is protected by a deletion guard on the related object, say so explicitly.
> - If deletion of a related object causes a broken reference or render failure on this object (rather than deletion of this object), document that explicitly.

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

> Events that are significant for this object but do not necessarily change its state.

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
|-------|---------|-------------------|---------------------------------|
| | | | |

### 7.2 Cross-Object State Effects

> Effects this object's events have on *other* objects.

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
|-----------------|----------------|--------------------------|------------|-----------|-------|
| | | | | | |

> **Guidance:**
> - "Automated?" means the platform executes this effect without Actor action. If Yes, note which Actor's token context applies (per Platform Invariant 2).
> - Do not model cascade deletions here. Side effects describe state changes, reference updates, or render/access failures — not automatic deletion of other objects.
> - If an effect is conditional, be explicit about the condition in the Condition column.

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
[List any state transitions that can be reversed and any limits on reversal (e.g. "Published → Unpublished is reversible. No limit on cycles."). If no transitions are reversible, or if this object has no state machine, say so explicitly.]

**Deletion:**
[Describe the deletion model. Use the following language patterns:]

- *If deletion is not permitted in any state:* "[Object name] cannot be deleted in any state. [Reason.]"
- *If deletion is permitted with conditions:* "[Object name] may be deleted [by Actor] when [condition]. Once deleted, permanently removed — no longer retrievable via the API."
- *If soft-delete only:* "[Object name] is soft-deleted only. Soft-deleted [objects] are no longer visible in normal API list responses but remain retrievable in [specific contexts]."
- *If both models apply:* Describe each case separately.

**Audit & history requirements:**
[Describe what Audit Records are generated for this object and by what events. Note whether prior versions of any content fields (e.g. document body, template content) are retained beyond the Audit Trail. If unknown, flag as an open question.]

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
|----------|--------------------------|---------------|------------|-------|
| | | | High / Medium / Low | |

> **Guidance:**
> - Focus on failure modes that are *permitted by the platform* but harmful if not managed — not validation errors that the platform prevents.
> - Common failure mode categories:
>   - Broken references after a related object is deleted
>   - Misconfiguration the platform allows but that causes downstream problems
>   - State combinations that produce unexpected behaviour
>   - Cross-object timing issues (e.g. object deleted mid-workflow)
> - Risk Level: **High** = data loss or significant client impact; **Medium** = degraded experience or Vendor resolution required; **Low** = edge case with minimal impact.

---

## 10. Open Questions

> List known unknowns that are blocking or limiting the completeness of this canon.
> Use the object's ID prefix as the question ID prefix (e.g. PAR-001 for Parameter questions, ENV-001 for platform/environment questions).
> Track all open questions in CANON_OPEN_QUESTIONS.md.
> When resolved, remove from CANON_OPEN_QUESTIONS.md and update the relevant section of this canon by stating the confirmed fact plainly — no separate resolved-questions tracker, and no inline "confirmed by/on" provenance needed in the section itself (a changelog row is enough of a record).
> When there are no open questions, this section should say exactly "No open questions at this time." and stop — do not recap which questions were previously resolved, descoped, or reopened. That history belongs in the Changelog, not here.

- [ ] [PRE-001]: [Question statement.]

*If there are no open questions, write: "No open questions at this time."*

---

## 11. Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | [YYYY-MM-DD] | [Author] | Initial draft |
| 0.2 | 2026-03-09 | Stu | Platform Invariants block replaced with reference to PLATFORM_CANON_PREAMBLE.md. ID Prefix field added to Section 1 with guidance note. Section 10 open questions guidance updated — question ID convention (object prefix), tracker workflow (CANON_OPEN_QUESTIONS.md → CANON_RESOLVED_QUESTIONS.md). No Example JSON section — JSON examples are not included in canon documents. |
| 0.3 | 2026-07-15 | Stu | Section 3.2 Transitions table: added mandatory "Endpoint / Verb" column for the literal API mechanism of each transition (e.g. `publish`, or an explicit note that it's a plain field/status write) — the existing "Action" column is a human description only and was found to be insufficient on its own for confirming real API behaviour without cross-referencing the live spec. |
| 0.4 | 2026-07-15 | Stu | Section 10 guidance updated — `CANON_RESOLVED_QUESTIONS.md` tracker removed entirely; a resolved question is now incorporated directly into the relevant canon section with an inline citation, not moved to a separate file. |
| 0.5 | 2026-07-15 | Stu | Refined further: no inline "confirmed by/on" provenance in canon content after all — a changelog row is enough of a record. Section 4 guidance added — keep Rule Statements short, move enumerated/supplementary detail to Notes; Notes hold behavioral information only, never citations, attribution, or "corrects prior canon" framing. Section 10 guidance added — an empty Open Questions section says only "No open questions at this time.", with no recap of previously resolved/descoped questions. |
