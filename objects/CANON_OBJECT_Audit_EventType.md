# Object Canon: Event Type

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-19
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Event Type

**Namespace:** Audit

**Parent Object:** None — top-level object.

**ID Prefix:** AET

**Description:**
An Event Type is a catalog entry naming one kind of event that the Audit Trail records. Each entry pairs a stable machine-readable event key (e.g. `platform.catalog.listing.updated`) with a human-readable name and an optional description, so that individual audit log entries can be grouped and labelled by the kind of event they represent. Event Types are not authored directly by any Actor — the platform provisions a new entry automatically the first time an audit log entry carrying a previously-unseen event key is recorded. The Audit Trail's per-entry concerns — private/public visibility, per-Actor field masking, and the entry's summary and detail text — live on each individual audit log entry (see Audit: [[Audit Record]]), not on the Event Type; the Event Type is purely the shared code-to-label catalog those entries reference.

**Also Known As:**
Audit event type. Referred to in prose as an event "kind" or "category".

---

## 2. Ownership & Visibility

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor     | No | Yes | See AET-002 | No | Reads the full catalog with no field suppression. |
| Operations | No | Yes | See AET-002 | No | Reads the full catalog with no field suppression. |
| Client     | No | Yes | See AET-002 | No | Reads the full catalog with no field suppression. |

No Actor creates Event Types through the API — they are system-provisioned (see BR-003). The catalog is global and identical for every Actor: read access is unscoped and no field is suppressed by Actor (this is distinct from Audit: Audit Record, whose visibility is per-record and per-Actor). Update is via `PUT`. The implementation applies no actor-specific authorization to the update endpoint — no permission or account-type gate — unlike Audit: Audit Record creation, which is restricted to Vendor and Operations; whether Event Type curation is intended to be restricted (e.g. to Operations, consistent with how names are curated) is unresolved (AET-002). There is no delete operation.

---

## 3. State Machine

This object has no state machine. It is created and modified as a unit, with no intermediate states. An Event Type carries no status, enabled/disabled, or active field; once provisioned it exists permanently and its only mutable content is its name and description (see BR-004). Availability is not state-controlled — every Event Type is always readable by every Actor.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An Event Type is uniquely identified by its key; at most one Event Type exists per key. | N/A | All | Key format: `platform.<domain>.<object>.<verb>` for platform-defined ("standard") events, `extensions.<extension>.<event>` for extension-defined ("custom") events. This key prefix is the only distinction between standard and custom event types — there is no separate classification field. |
| BR-002 | An Event Type's key is immutable and cannot be changed after the entry is created. | N/A | All | A key value supplied on update is rejected. |
| BR-003 | Event Types are not created through the API. The platform provisions a new Event Type automatically the first time an audit log entry carrying a previously-unseen event key is recorded. | N/A | System (Actor-contextual per Invariant 2) | Created under the token of whichever Actor recorded the triggering entry. The initial name is populated at provisioning from the triggering entry, then curated by Operations; description is left empty. |
| BR-004 | Updating an Event Type modifies only its name and description; no other property may be changed. | N/A | See AET-002 | Name and description must each be non-empty when supplied. Update is a partial write — only supplied fields change. |
| BR-005 | An Event Type cannot be deleted in any circumstance. | N/A | All | No delete operation exists on the object. |
| BR-006 | The full Event Type catalog is readable by every Actor with no per-Actor field suppression and no per-Actor scoping. | N/A | All | Contrast Audit: [[Audit Record]], whose entries are private or public and scoped per Actor. |
| BR-007 | Visibility type, per-Actor field masking, and summary/detail text are properties of each audit log entry, not of the Event Type. An Event Type carries no default visibility, no message template, and no masking configuration. | N/A | All | By design — the Event Type is purely a label catalog; those per-entry concerns live on Audit: Audit Record. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| id | string | Platform identifier for the Event Type, prefix `AET`. | System | No | Format `AET-####-####`. |
| key | string | Stable machine-readable code for the kind of event. Unique across all Event Types. | System | No | Immutable (see BR-002). Platform events use `platform.<domain>.<object>.<verb>`; extension events use `extensions.<extension>.<event>`. |
| name | string | Human-readable label for the event kind. | System at creation; editable via update | Yes | Populated at provisioning from the triggering entry, then curated by Operations via `PUT`. Must be non-empty when supplied on update. |
| description | string | Optional longer description of the event kind. | Update caller | Yes | Empty by default at provisioning; absent from response when null. Must be non-empty when supplied on update. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Audit: Audit Record | Association | One Event Type to many Audit Records | Each Audit Record names the kind of event it represents by carrying the Event Type's key. The Event Type is the shared label catalog those records reference. | Recording an Audit Record with a new key provisions its Event Type (see BR-003). Event Types are never deleted, so a record's referenced Event Type always resolves. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Event Type provisioned | An [[Audit Record]] carrying a previously-unseen event key is recorded | Any Actor permitted to record an Audit Record (Actor-contextual) | A new Event Type is created for that key, with an initial name and no description. |
| Name backfilled | An Audit Record is recorded for an existing key whose Event Type still has an empty name | Same as above | The Event Type's name is populated; entries with an already-populated name are unaffected. |
| Event Type edited | Update request against an existing Event Type | See AET-002 | Name and/or description updated. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Event Type name edited | Audit: Audit Record | The human-readable label shown for the kind of event changes for every Audit Record carrying that key; the records themselves are not modified. | Yes | Applies to all records referencing the edited Event Type's key | The label is resolved from the shared catalog, not copied onto each record. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
This object has no state machine, so there are no state transitions to reverse. Name and description edits are freely re-editable with no cycle limit (subject to AET-002).

**Deletion:**
An Event Type cannot be deleted in any circumstance. No delete operation exists on the object, and its key is immutable, so an Event Type provisioned from an erroneous or mistyped event key is permanent and cannot be re-keyed or removed.

**Audit & history requirements:**
Event Types are part of the Audit Trail's own infrastructure and are retained permanently — there is no delete operation. [[Audit Record]]s for events across the platform reference Event Types by key.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| An extension or module records an event under a mistyped or malformed key | A new Event Type is permanently provisioned for the erroneous key; it cannot be deleted or re-keyed | Operations | Medium | The catalog accumulates orphaned entries that can never be removed (see BR-002, BR-005). |
| A newly-provisioned Event Type carries an unhelpful auto-populated name until curated | The Event Type is readable immediately with whatever name provisioning produced | All readers | Low | Names are curated by Operations via update. |
| A caller expects to configure an Event Type's default visibility, message template, or field masking | The update is limited to name and description; no such configuration exists on the object | Operations | Low | Those concerns live on each Audit: [[Audit Record]], not the Event Type — by design (see BR-007). |

---

## 10. Open Questions

> The following are unresolved candidate questions from this draft's evidence-gathering. They are not yet confirmed and require PM/engineering adjudication before the draft is promoted.

- [ ] **AET-002:** The Event Type update (`PUT`) endpoint applies no actor-specific authorization in the implementation — no permission or account-type gate — unlike Audit: Audit Record creation, which is restricted to Vendor and Operations. Any authenticated Actor could therefore edit an Event Type's name/description, which diverges from the intended Operations-curated model (see BR-003, Section 7.1). Whether the missing restriction is a defect to be fixed or the intended behaviour is unresolved pending an engineering decision.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-19 | Stu / canon-generate-batch | Initial draft generated from OpenAPI schema, live multi-Actor STAGING fetch, Actor diff, source-code research, and the Audit Trail business-context page. Documents Event Type as a system-provisioned, immutable-key label catalog (key/name/description only — the thin model is intended; richer per-event concerns live on Audit: Audit Record by design); Operations-curated names; standard-vs-custom distinguished solely by the key prefix; no state machine; global unscoped read visibility; permanent (no delete). One open question: AET-002 (the update endpoint enforces no actor restriction, diverging from the Operations-curated intent).
</content>
</invoke>
