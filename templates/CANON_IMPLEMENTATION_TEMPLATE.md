# Implementation Canon: [Implementation Name]

> **Version:** 0.1
> **Owner:** [PM Name]
> **Last Updated:** [YYYY-MM-DD]
> **Status:** Draft

---

## How this template relates to the Concept template

**An Implementation document is a Concept document with bindings.** Same sections, same meanings, same emitters — plus one column in §4 and §5 naming the element of the abstraction that each row realises. Nothing else differs, because an Implementation is not a different sort of thing from a Concept: it is a Concept that has stopped being general.

| Concept section | In an Implementation | Difference |
|---|---|---|
| 1. Identity | **yes** | **Implements:** replaces **Parent Concept:** — it names the abstraction this document realises |
| 4. Business Rules | **yes**, + column | An `Implements` column. A rule may bind a rule of the abstraction, or stand alone |
| 5. Key Concepts | **yes**, + column | An `Implements` column. A concept may bind a concept of the abstraction, or stand alone |
| 7. Lifecycle Events & Side Effects | **yes**, verbatim | No binding — see *What cannot be bound* below |
| 9. Failure Modes & Edge Cases | **yes**, verbatim | |
| 10. Open Questions | **yes**, verbatim | |
| 11. Changelog | **yes**, verbatim | |

Sections 2, 3, 6 and 8 are absent for exactly the reasons they are absent from a Concept: they presume the platform owns the subject.

### Concept, Implementation, or object?

Three questions, in order:

1. **Does the platform own it** — does an Actor create it through the API, and would it stop existing if the platform did? Then it is an **object**. Use `CANON_OBJECT_TEMPLATE.md`.
2. **Is it general** — does it describe a *kind* of thing, so that a sentence about it holds for every instance? Then it is a **Concept**. Use `CANON_CONCEPT_TEMPLATE.md`.
3. **Is it one named thing** — Microsoft's integration, this ERP product, that vendor's marketplace — realising an abstraction canon already records? Then it is an **Implementation**. Use this template.

Question 2 is the one that gets answered wrongly. "Back-office ERP integration" is a Concept even though it is narrower than "Integration", because it is still a *kind*: it declares a contract without saying which ERP product holds up its end. Beware the near miss: "vendor system integration" looks like the same shape and is not one, because a vendor registers whichever declared channels it needs and what it operates is a deployment unit, not a kind. Narrowing between Concepts is inheritance, and it happens through **Parent Concept**. Instantiation is a different edge and it happens here, through **Implements**.

**File naming:** `implementations/CANON_IMPLEMENTATION_<Name>.md`. No namespace segment. The directory need not exist until the first document creates it.

*Delete this whole section when you author a real document.*

---

## Binding, and what it means not to bind

A binding is a claim that a row here **is** the abstraction's element, made concrete. Write the element's **full id** — `integration:actor-credential`, not `Actor credential`. Bare child names collide across subjects, which is the same reason `[[WikiLink]]` refuses them.

Three things are checked, and a document that fails any of them does not validate:

- the abstraction named in §1 exists — an implementation of nothing cannot have its bindings checked at all, so unlike an unresolved **Parent Object** this does not degrade quietly to a `future:` stub;
- every bound element belongs to **that** abstraction's own subtree;
- types match — a rule binds a rule, a concept binds a concept.

**An empty `Implements` cell is not an omission.** It says the row is this implementation's own: a concept the abstraction never declared, a rule that applies to this realisation and no other. Extending the abstraction is half of what an Implementation is for.

**An element the abstraction declares and no row here names is unbound.** Canon reports it as unbound and stops there, because it genuinely cannot tell "this implementation does not do that" from "nobody has written it down yet", and a document that picked one would be asserting something it does not know. If you *do* know it is deliberate, say so: add the row, bind the element, and let the value state that there is nothing to state. It then reads as bound, which is the truth — the question has been answered.

```
canon coverage marketplace:<name>
```

prints all three lists: bound, unbound, and own.

### What cannot be bound

Only §4 rules and §5 concepts. They are the sections whose rows become addressable nodes; everything else in a canon document — internal events, cross-object effects, failure modes — is emitted as an anonymous ref with no id to point at.

So an implementation states its own §7 events and its own §9 failures, and cannot declare that one of them realises an event of the abstraction. That is a real limit, deliberately accepted rather than worked around: making §7.1 events bindable means promoting 243 rows across the object corpus to nodes, which is a change to how *objects* work and belongs in its own patch. Until then, note the correspondence in prose in the row's Notes.

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. Invariants 1–3 — Actor attribution, Actor-contextual automation, and Actor-attributable audit — apply to this implementation without exception. Everything this document does not bind is unbound: the abstraction still declares it, and canon does not distinguish "not implemented here" from "not recorded here".

---

## 1. Identity

**Implementation Name:** [The name canon uses for this one realisation. Usually the vendor or product name — "Microsoft", "Adobe", "NetSuite".]

**Implements:** [The abstraction, by name — "Integration", "Vendor System Integration", "Commerce: Order". Exactly one, and it must already exist in canon.]

**Description:**
[2–4 sentences. What is this particular thing, who runs it, and what does the platform's relationship with it consist of? Say what canon has established about it and how — a named implementation attracts hearsay, and this is where you mark the line between what was verified and what was reported.]

**Also Known As:**
[Internal names, product names, codenames. The same warning as for a Concept: do not claim a name that also names a platform object.]

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Implements | Notes |
|---------|---------------|---------------------|-------------|------------|-------|
| BR-001 | | N/A | | | |

> **Guidance:**
> - `Implements` holds the full id of a rule of the abstraction (`integration:br-004`), or is left empty.
> - A bound rule **narrows** the one it binds; it does not contradict it. "Tokens expire after 90 days" binds "tokens expire"; "tokens do not expire" is not a binding, it is a disagreement, and a disagreement between an implementation and its abstraction means one of the two documents is wrong.
> - An unbound rule is this implementation's own — something true here that is not true of the abstraction in general.
> - "Applies In State(s)" is `N/A` throughout, as for a Concept.

---

## 5. Key Concepts

> The entities this implementation introduces or makes concrete.

| Concept | Description | Implements | Notes |
|---------|-------------|------------|-------|
| [Name] | [What it is *here*] | [`abstraction:element` or empty] | |

> **Guidance:**
> - A bound row's Description says what the abstraction's element **is** in this case: not "the credential", but what the credential concretely is here — its form, its issuer, its lifetime.
> - **`[[WikiLink]]` the platform entities a term is defined against**, in the Description and not in Notes (a term's Notes are not scanned). This is where an implementation's private vocabulary gets grounded: a vendor-defined value carried in a `[[Parameter]]` is typed by that link, and the platform's own canon already states what such a field is — do not restate it here.
> - An unbound row introduces something the abstraction has no notion of. That is expected: a named implementation almost always brings vocabulary of its own.
> - Description is mandatory, as everywhere.

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

> This implementation's own workings, to the extent canon has established them. Not bindable — if an event here corresponds to one the abstraction declares, say so in Notes.

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
|-------|---------|-------------------|---------------------------------|
| | | — | |

### 7.2 Cross-Object State Effects

> What this implementation causes in the domain, named as `Namespace: Object` in the Affected Object column.

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
|-----------------|----------------|--------------------------|------------|-----------|-------|
| | | | | | |

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
|----------|--------------------------|---------------|------------|-------|
| | | | High / Medium / Low | |

> The abstraction's failure modes are not inherited into this document and should not be copied into it. Record what fails **here** — the quota this vendor enforces, the maintenance window that one takes.

---

## 10. Open Questions

> Question IDs use a three-letter prefix for the implementation (e.g. `MSF-001`), distinct from the abstraction's. Track them in `CANON_OPEN_QUESTIONS.md`.

- [ ] [XXX-001]: [Question statement.]

*If there are no open questions, write: "No open questions at this time."*

---

## 11. Changelog

> **Order newest-first.** Add each new entry at the top, immediately under the header separator.

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | [YYYY-MM-DD] | [Author] | Initial draft. |
