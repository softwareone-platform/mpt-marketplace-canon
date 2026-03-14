# Object Canon: Webhook

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-03-08
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Webhook

**Parent Object:** None (primary object — Notifications namespace)

**Description:**
A Webhook is an account-owned integration hook that causes the platform to call an external HTTP endpoint when a specific platform event occurs. Webhooks are the primary mechanism by which Extensions intercept and respond to platform events in real time. A Webhook is scoped to a specific object type and optionally filtered by criteria to control which events trigger it. Webhooks belong to an Account, not to a specific Product or other object — the object reference in a Webhook is a scoping filter, not a parent relationship.

**Also Known As:**
WBH (API identifier prefix)

---

## 2. Ownership & Visibility

> High-level orientation to Actor authority and visibility over this object.
> State-specific nuances belong in Section 4 (Business Rules).

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
|------------|------------|----------|------------|------------|-------|
| Vendor     | Yes        | Yes      | Yes        | Yes        | Owns Webhooks scoped to their Account |
| Operations | Yes        | Yes      | Yes        | Yes        | Owns Webhooks scoped to the Operations Account |
| Client     | No         | No       | No         | No         | Clients cannot create or interact with Webhooks |

---

## 3. State Machine

> Each transition specifies which Actor(s) are permitted to execute it.
> Where more than one Actor is listed, any one of them may execute the transition.
> Each execution instance is always attributable to exactly one Actor.

### 3.1 States

| State | Description | Initial State? | Terminal State? |
|-------|-------------|---------------|-----------------|
| Enabled | Webhook is active. The platform will call the configured endpoint when matching events occur. | Yes | No |
| Disabled | Webhook is inactive. The platform will not call the endpoint. Events are not queued. | No | No |
| Deleted | Webhook has been soft-deleted. No longer active or visible in normal API responses. | No | Yes |

### 3.2 Transitions

| # | From State | To State | Action / Trigger | Permitted Actor(s) | Preconditions | Outcome / Side Effects |
|---|------------|----------|-----------------|-------------------|---------------|----------------------|
| T1 | — | Enabled | Create Webhook | Vendor, Operations | None | Webhook created in Enabled state and begins intercepting matching events. |
| T2 | Enabled | Disabled | Disable Webhook | Vendor, Operations | None | Webhook stops intercepting events. No queuing of missed events. |
| T3 | Disabled | Enabled | Enable Webhook | Vendor, Operations | None | Webhook resumes intercepting matching events. |
| T4 | Enabled | Deleted | Delete Webhook | Vendor, Operations | None | Webhook soft-deleted. |
| T5 | Disabled | Deleted | Delete Webhook | Vendor, Operations | None | Webhook soft-deleted. |

### 3.3 State Diagram

```
[Enabled] ---(Disable : Vendor, Operations)---> [Disabled]
[Disabled] ---(Enable : Vendor, Operations)---> [Enabled]
[Enabled] ---(Delete : Vendor, Operations)---> [Deleted]
[Disabled] ---(Delete : Vendor, Operations)---> [Deleted]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
|---------|---------------|---------------------|-------------|-------|
| BR-001 | A Webhook belongs to exactly one Account. The owning Account determines which Actor controls it. | All | All | |
| BR-002 | A Webhook is created in Enabled state by default. | N/A | All | |
| BR-003 | A Webhook has a type that determines which platform event triggers it. Valid types are extensible as new object types and states are added to the platform. | All | All | See Section 5 for known types at time of writing. |
| BR-004 | A Webhook has an objectType that determines which platform object type it listens to. | All | All | Observed values: Order, Enrollment, Request. Extensible as new object types are added. |
| BR-005 | A Webhook may have a criteria block containing any valid RQL expression, provided the expression is executable against the specified objectType. | All | All | Criteria validity is evaluated against the objectType's known fields. Invalid RQL or fields not applicable to the objectType will not match any events. |
| BR-006 | When a Webhook fires, the platform makes an HTTP call to the configured URL. The owning Actor's Extension is responsible for handling the call. | Enabled | All | |
| BR-007 | The platform does not auto-disable a Webhook based on failure thresholds. The failuresSinceLastSuccess statistic is purely informational. | All | All | Consistent with platform philosophy of permissiveness over automated constraint. |
| BR-008 | When a Webhook is Disabled, events that would have triggered it are not queued. Missed events are lost. | Disabled | All | |
| BR-009 | Deletion is a soft delete. Deleted Webhooks are not visible in normal API responses. Soft-deleted Webhooks are permanently removed from normal API visibility. | Deleted | Vendor, Operations | |
| BR-010 | A Webhook is always scoped to exactly one object instance via criteria. It cannot be configured to fire across multiple object instances. | All | All | e.g. A Webhook scoped to product.id fires only for that specific Product, not across all Products on the Account. |
| BR-011 | Clients cannot create, read, update, or delete Webhooks. | All | Client | |
| BR-012 | The platform does not retry failed Webhook calls. A failed call is recorded in statistics and lost. | All | All | The owning Actor's Extension is responsible for handling failures and implementing any retry logic externally if required. |
| BR-013 | Webhooks are unaffected by the state of their owning Account. Since Accounts cannot be deleted, there is no cascade deletion path from Account to Webhook. | All | All | |

---

## 5. Key Attributes

> All attribute writes are Actor-attributed, following the same rules as transitions.

| Attribute | Type | Description | Set By | Mutable After Creation? | Mutable After [State]? | Notes |
|-----------|------|-------------|--------|------------------------|----------------------|-------|
| Name | String | Name of the Webhook. Defaults to the Webhook ID if not specified. | Vendor, Operations | Yes | N/A | |
| Description | String | Optional description of the Webhook's purpose | Vendor, Operations | Yes | N/A | |
| Status | Enum | One of: Enabled, Disabled, Deleted | System | Yes — via state transitions only | N/A | |
| Type | Enum | The platform event type that triggers this Webhook | Vendor, Operations | No | N/A | Immutable after creation. Known types at time of writing: ValidatePurchaseOrderDraft, ValidatePurchaseOrderQuerying, ValidateChangeOrderDraft, ValidateEnrollmentDraft, ValidateRequest. Extensible. |
| Object Type | Enum | The platform object type this Webhook listens to. Determines which objects can trigger this Webhook. | Vendor, Operations | No | N/A | Immutable after creation. Observed values: Order, Enrollment, Request. Extensible as new object types are added to the platform. The full set of triggerable object types is documented per-namespace in their respective canon files. |
| URL | String | The external HTTP endpoint the platform calls when the Webhook fires | Vendor, Operations | Yes | N/A | URL validity is the owning Actor's responsibility. Consistent with platform validation philosophy. |
| Criteria | Object | An RQL expression scoping this Webhook to exactly one object instance and optionally filtering by additional fields. Must be executable against the specified objectType. | Vendor, Operations | Yes | N/A | Always scoped to a single object instance. Any valid RQL expression is permitted provided it is applicable to the objectType. |
| Statistics | Object | Running totals of total calls, successes, failures, and failuresSinceLastSuccess | System | N/A | N/A | Read-only. Purely informational — no automated platform behavior is triggered by failure counts. |
| Last Success | Object | Details of the most recent successful call, including timing and response headers | System | N/A | N/A | Read-only. |
| Last Failure | Object | Details of the most recent failed call, including timing and response headers | System | N/A | N/A | Read-only. |
| Revision | Integer | Increments when the Webhook's own attributes change | System | N/A | N/A | |

---

## 6. Relationships to Other Objects

> Captures structural and associative links between this object and others.

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
|----------------|------------------|-------------|-------------|----------------------|
| Administration: Account | Parent | Many:1 | A Webhook belongs to exactly one Account. | No — Accounts cannot be deleted, and Webhooks are unaffected by Account state changes. |
| Catalog: Product | Association | Many:1 | A Webhook may be scoped to a specific Product via criteria. | No — deletion of a Product does not delete associated Webhooks. |
| Catalog: Program | Association | Many:1 | A Webhook may be scoped to a specific Program via criteria. | No — as above. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
|-------|---------|-------------------|---------------------------------|
| Webhook created | Actor creates Webhook | Vendor, Operations | Webhook enters Enabled state and begins intercepting matching events immediately. |
| Webhook disabled | T2 — Enabled to Disabled | Vendor, Operations | Platform stops calling the Webhook endpoint. No event queuing. |
| Webhook enabled | T3 — Disabled to Enabled | Vendor, Operations | Platform resumes calling the Webhook endpoint for matching events. |
| Webhook deleted | T4/T5 — any state to Deleted | Vendor, Operations | Webhook soft-deleted. No longer visible in normal API responses. |
| Webhook fires | Matching platform event occurs | System (on behalf of owning Actor) | Platform makes HTTP call to configured URL. Success or failure recorded in statistics. |

### 7.2 Cross-Object State Effects

No cross-object state effects. Webhook firing does not directly cause state transitions on platform objects — that is the responsibility of the Extension handling the call.

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
- Enabled → Disabled is reversible (T3).
- Deleted is terminal and not reversible.

**Deletion:**
- Hard delete not applicable — Webhooks are soft-deleted only
- [x] Soft delete — Webhook is soft-deleted and no longer visible in normal API responses.
- [ ] Deletion not permitted

**Audit & history requirements:**
Call history (lastSuccess, lastFailure, statistics) is retained on the Webhook object. Retention policy for soft-deleted Webhooks not yet defined.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
|----------|--------------------------|---------------|------------|-------|
| Webhook endpoint is unreachable or returns an error | Call recorded as failure in statistics. failuresSinceLastSuccess incremented. No automated platform response. No retry. | Vendor / Operations (responsible for resolution) | Medium | Extensions requiring reliable delivery must implement their own retry logic externally. |
| Webhook fires while Extension is being deployed or restarted | Call fails. Recorded as failure. No retry or queuing. | Vendor / Operations | Medium | No at-least-once delivery guarantee. |
| Criteria references a deleted or unpublished object (e.g. deleted Product) | Webhook may continue to fire or may never match — depends on criteria evaluation. | Vendor / Operations | Medium | See Open Questions. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2026-03-08 | Stu / Claude | Initial canon. Derived from Product-scoped and global Webhook JSON exports and conversation. |
