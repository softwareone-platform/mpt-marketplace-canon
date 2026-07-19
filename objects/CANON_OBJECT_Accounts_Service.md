# Object Canon: Service

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-18
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Service

**Namespace:** Accounts

**Parent Object:** None — top-level object.

**ID Prefix:** SVC

**Description:**
A Service is the platform's identity for an internal, non-human component (for example, the billing or scheduler component). It sits alongside the human identity ([[User]]) and the programmatic identity ([[API Token]]) as one of the platform's identity types, so that actions performed autonomously by an internal component can be attributed to a named identity in the audit trail. Service identities are provisioned and maintained by the platform itself, not by any Actor; the public API exposes them as read-only reference data.

**Also Known As:**
Service Identity; internal service identity.

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor     | No | Yes | No | No | Read access via the public list and get-by-id endpoints. |
| Operations | No | Yes | No | No | No elevated authority over this object — same read-only access as other Actors. |
| Client     | No | Yes | No | No | Read access via the public list and get-by-id endpoints. |

No Actor can create, update, or delete a Service through the public API — the public surface exposes read operations only (list and get-by-id). All three Actors receive identical field content; no Actor-based field suppression applies (see Section 5).

---

## 3. State Machine

This object has no state machine. It is created and modified as a unit, with no intermediate states.

A Service carries a `status` field with two values, `Active` and `Deleted` (see Section 5), but the public API exposes no transition between them — there is no create, update, or delete operation on the public surface. Provisioning of a Service and any change to its `status` are performed internally by the platform, not by an Actor, so no Actor-driven lifecycle transition exists to model here.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Service is read-only on the public API. No Actor can create, update, or delete a Service through the public surface. | N/A | All | Public surface exposes list and get-by-id only. |
| BR-002 | A Service is provisioned and maintained by the platform itself, not by any Actor. | N/A | All | It is the identity of an internal component, alongside [[User]] (human identity) and [[API Token]] (programmatic identity). |
| BR-003 | A Service represents exactly one internal platform component and exists independently of any Account. | N/A | All | Access is governed by platform configuration, not by Account membership. |
| BR-004 | A Service's `status` is either `Active` or `Deleted`; there is no public operation to change it. | N/A | All | See Section 8 for the deletion model. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| id | string | Unique identifier, prefixed `SVC-`. | Platform (internal provisioning) | No | Read-only. |
| name | string | Human-readable name of the internal component (e.g. `platform`, `scheduler`, `Billing`). | Platform (internal provisioning) | No public write | — |
| description | string | Free-text description of the component's purpose. | Platform (internal provisioning) | No public write | Nullable. Absent from response when null. |
| icon | string | Reference to a visual identity image for the component (see preamble §9). | Platform (internal provisioning) | No public write | Nullable; null in observed data. Absent from response when null. |
| status | string | Lifecycle status of the Service. | Platform (internal provisioning) | No public write | Enum: `Active`, `Deleted`. No public transition — see Section 3. |
| revision | integer | Monotonic revision counter for the record. | Platform | No public write | Increments on internal modification. |
| audit | object | Creation and last-modification events, each with a timestamp and the attributed identity. | Platform | No public write | Omitted by default — request via `select=+audit`. Contains `created` and `updated`. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Accounts: User | Association | N/A | Both are platform identity types. A User is a human identity; a Service is the identity of an internal component. They are independent. | None. |
| Audit: Audit Record | Association | 1 Service → many Audit Records | A Service can be the identity attributed to an event when an action is performed autonomously by an internal component. | None — deleting or deactivating a Service does not alter historical Audit Records. |

Audit: Audit Record is not yet canonised. API Token is a platform identity type in the same family as Service and [[User]].

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

> Events that are significant for this object but do not necessarily change its state.

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| — | — | — | No Actor-triggered events exist on the public surface; provisioning and status changes are internal to the platform. |

### 7.2 Cross-Object State Effects

> Effects this object's events have on *other* objects.

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Internal component performs an action | Audit: Audit Record | The recorded event's attributed identity is the acting Service. | Yes | Action is performed autonomously by an internal component rather than by a human [[User]] or API Token. | Attribution only; the Service does not itself change state. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
This object has no state machine, so there are no state transitions to reverse.

**Deletion:**
A Service cannot be created, updated, or deleted by any Actor through the public API. A Service carries a `status` of `Active` or `Deleted`, but that status is set internally by the platform, not by an Actor; there is no public create, update, or delete operation.

**Audit & history requirements:**
The `audit` attribute records the creation and last-modification events for the Service, each with a timestamp and the attributed identity (omitted by default; request via `select=+audit`). No retention of prior field values beyond the audit events is documented.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| An Actor attempts to create, update, or delete a Service | The operation is unavailable — the public surface exposes read operations only. | Vendor, Operations, Client | Low | Service is read-only reference data. |
| A Service referenced as the acting identity in an Audit Record is later removed or marked `Deleted` | The historical Audit Record is unchanged; the reference remains as recorded. | Operations | Low | Attribution is preserved regardless of the Service's current status. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-19 | Stu / canon-generate-batch | Initial draft. Public API is read-only (list + get-by-id); no state machine (status is set internally, no public transition). Documents Service as the identity of an internal platform component alongside User and API Token, with no Actor-based field suppression and an identity-attribution relationship to Audit Records. Derived from the OpenAPI schema, a multi-Actor live fetch, source research, and the Service Identity business-context page. 0 open questions. |
</content>
</invoke>
