# Concept Canon: [Concept Name]

> **Version:** 0.1
> **Owner:** [PM Name]
> **Last Updated:** [YYYY-MM-DD]
> **Status:** Draft

---

## How this template relates to the Object template

**A Concept document is a partial of an object document.** It uses only section numbers the object template already defines, and means by them what the object means. The sections that are missing are missing because they presume the platform *owns* the thing being described:

| Object section | In a Concept | Why |
|---|---|---|
| 1. Identity | **yes**, reduced | No Namespace and no ID Prefix — a Concept sits outside the namespace model and the platform issues it no identifier |
| 2. Ownership & Visibility | no | Nobody creates, reads, updates or deletes it through the API |
| 3. State Machine | no | The platform cannot observe its states. *If you are writing one, you are writing an object* |
| 4. Business Rules | **yes**, verbatim | Write `N/A` in "Applies In State(s)", as the object template already prescribes for a stateless subject |
| 5. Key Attributes → **Key Concepts** | **yes**, reframed | Same slot — what the subject exposes — but a Concept exposes *introduced entities*, not fields, so the columns that presume ownership are gone |
| 6. Relationships to Other Objects | no | A relationship to a platform object is a fact that object owns. It belongs in *that* object's §6, pointing here |
| 7. Lifecycle Events & Side Effects | **yes**, verbatim | A Concept *has* an inside — canon simply does not claim to know all of it. 7.1 records the significant, confirmed part; 7.2 what it causes in the domain |
| 8. Reversibility & Data Retention | no | Nothing here is created or deleted by the platform |
| 9. Failure Modes & Edge Cases | **yes**, verbatim | What happens at the boundary when the other side misbehaves is nobody else's to document |
| 10. Open Questions | **yes**, verbatim | Question IDs take a short prefix of the concept's own (`INT-001`, `VAL-001`) |
| 11. Changelog | **yes**, verbatim | |

The numbering gaps are deliberate. They are the shape of what a Concept is not, and they are visible at a glance to anyone who knows the object template.

**Use this template when all of the following hold:**

- The thing is **not** owned by the platform. No Actor creates it through the API, and it would exist if the platform did not.
- It has no states or transitions the platform can observe.
- It nevertheless contacts the domain across a contract that can be written down.

If it has an API collection, an ID prefix and a lifecycle, it is an object — use `CANON_OBJECT_TEMPLATE.md`. If it is platform-wide behaviour rather than a thing (a renderer, a query language), it goes in `platform/` as free prose — and note that `platform/` is not parsed into the graph.

**File naming:** `concepts/CANON_CONCEPT_<Name>.md`, or `concepts/CANON_CONCEPT_<Parent>_<Name>.md` for a concept that narrows another. No namespace segment. The parent's word in the filename groups the family on disk and nothing more — narrowing is stated by **Parent Concept**, and the id stays top-level either way.

*Delete this whole section when you author a real document.*

---

## 1. Identity

**Concept Name:** [The name canon uses. Prefer a term that does not already name a platform object, so the two cannot be confused.]

**Parent Concept:** ["None — top-level concept.", or the broader Concept this one *narrows* — see below. Narrowing is how a subject too large for one document is divided — but it is not a filing device, so name a parent only when this concept is a genuine kind of that one.]

**Description:**
[2–4 sentences. What is this thing from the platform's point of view, and why does the platform have a relationship with it? Say what canon records about it and what it does not attempt — a Concept is a partial account by construction.]

**Also Known As:**
[Alternative names in engineering, support, or vendor usage. Do **not** list a name that also names a platform object — an alias claims that name in `[[WikiLink]]` resolution and would silently redirect every cross-reference here. Where a word genuinely names both, say so in the Description.]

> **On Parent Concept.** Narrowing works like inheritance, not like containment: the child is its own document with its own top-level id, and it *further attributes* the parent rather than replacing it. That is what makes the choice of level meaningful — where the platform's relationship holds for any instance, refer to the parent; where it is specific to one kind, refer to the child. Never enumerate children in the parent; a child declares itself here.
>
> **Two things narrow a concept, and both are legitimate.** A concept may be narrowed by **counterparty** — the kind of system on the other end, as a back-office ERP integration narrows an integration — or by **aspect**: the part of the contract in question, as validating an order narrows contacting the platform at all. An aspect concept is a real kind and not a filing device, and the test is the same one as always: a sentence about it must hold for *every* system that does that thing, whoever wrote it. If the sentence is only true of one vendor, it belongs in that vendor's Implementation.
>
> Narrowing by aspect is what lets a large realisation be written as several documents instead of one — see the *When one document is not enough* section of `CANON_IMPLEMENTATION_TEMPLATE.md`. Write the aspect concept first: an Implementation cannot be split along a joint that the abstraction does not have.
>
> A concept may be narrowed on both axes at once, and the two do not have to meet in one tree. Nothing forces a single hierarchy, and a concept has exactly one parent — so where an aspect and a counterparty genuinely cross, pick the narrowing that carries the contract and state the other in the Description.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
|---------|---------------|---------------------|-------------|-------|
| BR-001 | | N/A | | |

> **Guidance:**
> - Same `BR-NNN` ids and the same rules as an object's Section 4. "Applies In State(s)" is `N/A` throughout — a Concept has no states.
> - A rule here is an obligation or property of **the concept**, not of the platform. "The platform records a failed attempt" is the platform's rule and belongs in the relevant object's canon; "an Integration answering a validation callout answers synchronously" is this concept's.

---

## 5. Key Concepts

> The entities this concept introduces — its contact surface. Not fields: a Concept has no fields, because the platform does not hold it. This is where the vocabulary comes from that platform objects then reference.

| Concept | Description | Notes |
|---------|-------------|-------|
| [Name] | [What it is] | |

> **Guidance:**
> - Each row becomes an individually addressable node, so a platform object can reference one by its full id — `[[erp-system:identifier]]`. That is the direction of reference for *consumption*: the platform's object points inward at the concept it consumes, rather than this document reaching outward to enumerate platform objects.
> - **Link the platform entities a term is defined against.** Unlike an object's §5, this section is `[[WikiLink]]`ed — grounding a term on the platform entity it stands against is what the section is for, and an unlinked mention is a silent gap. Enumerating platform objects is still wrong; naming the one a term is defined against is not the same thing.
> - Put the link in the **Description**, never in Notes. A term's Notes column is not scanned for mentions, so a link there produces no edge and no error.
> - Description is mandatory — it is the node's description. An entity that cannot be described is not one.
> - Introduce an entity here only if something references it, or would want to. A glossary nobody points at is not a contact surface.
> - Interactions belong in §7, not here. "Identifier" is a key concept; "the Integration writes the identifier onto an Agreement" is a §7.2 effect.

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

> What is confirmed about the concept's own workings. A Concept *has* an inside — canon simply does not claim to know all of it, so record the significant part and no more. An internal event loop, an upstream system this one draws its data from, a schedule it runs on: each is internal, each matters at the boundary, and none of them is an effect.

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
|-------|---------|-------------------|---------------------------------|
| | | — | |

> "Permitted Actor(s)" is usually `—`: these are the concept's own workings, and no platform Actor performs them. Name an Actor only where a platform Actor genuinely triggers the event.

### 7.2 Cross-Object State Effects

> What the concept causes in the domain. This is the one place a Concept document names platform objects, and legitimately so: it is the acting subject describing its own effects, exactly as an object's §7.2 does. Describing what the platform *holds about* this concept is a different thing, and it belongs in that object's canon, not here.

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
|-----------------|----------------|--------------------------|------------|-----------|-------|
| | | | | | |

> Name the object as `Namespace: Object` in the Affected Object column — it resolves to a graph edge and is not `[[WikiLink]]`-bracketed. Bracket object mentions in the Effect and Notes columns as usual. `Automated?` is exactly `Yes` or `No`.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
|----------|--------------------------|---------------|------------|-------|
| | | | High / Medium / Low | |

> Concentrate on the boundary: what happens when the other side misbehaves, goes away, or sends something the platform did not expect. If the platform's behaviour in a case is not established, that is an open question, not a guessed row.

---

## 10. Open Questions

> Question IDs use a three-letter prefix for the concept (e.g. `INT-001`), so they never collide with the `BR-NNN` rule ids in Section 4. Track them in `CANON_OPEN_QUESTIONS.md`.

- [ ] [XXX-001]: [Question statement.]

*If there are no open questions, write: "No open questions at this time."*

---

## 11. Changelog

> **Order newest-first.** Add each new entry at the top, immediately under the header separator.

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | [YYYY-MM-DD] | [Author] | Initial draft. |
