# Object Canon: Subscription

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-04-13
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Subscription

**Namespace:** Commerce

**Parent Object:** Commerce: Agreement

**ID Prefix:** SUB

**Description:**
A Subscription is the platform's record of a recurring fulfilment relationship between a Client and a Vendor for a specific Product Item. Subscriptions are owned by the Vendor — the Vendor Extension creates and maintains them as the authoritative fulfilment record. A Subscription is created during Order Processing and linked to its parent Agreement on Order completion, or created directly by the Vendor in migration and edge-case scenarios. Subscriptions carry their own parameters, pricing, terms, and template, and are renewed or expired automatically by the platform's daily renewal service based on the `autoRenew` flag and `commitmentDate`.

**Also Known As:**
None known.

---

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes | Yes | Yes | No | Can create Subscriptions directly (migration/edge cases) or via Order Processing. Can update `name`, `template`, `autoRenew`, `parameters.fulfillment`, `externalIds.vendor`. Can terminate via `/terminate` endpoint. Read is scoped to Subscriptions on Agreements where they are the Vendor. |
| Operations | No | Yes | Yes | No | Can update `price.defaultMarkup`, `price.defaultMargin`, and manage Split Billing via `/split` endpoint. Can also manage markup on Subscription Lines. Read is not self-scoped — Operations sees all Subscriptions platform-wide. |
| Client | No | Yes | Yes | No | Can update `name` and `externalIds.client`. Cannot create, terminate, or delete Subscriptions. Read is scoped to Subscriptions on Agreements belonging to their own Account. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Active | The Subscription is live and fulfilling. The Vendor owns and maintains it. It will be renewed or expired by the platform's daily renewal service based on `autoRenew` and `commitmentDate`. | — | — |
| Updating | A Change, Configuration, or Termination Order affecting this Subscription has been placed and is being processed. The Subscription returns to Active when the Order completes or fails. | — | — |
| Terminating | A Termination Order affecting this Subscription has been placed and is being processed. The Subscription transitions to Terminated when the Termination Order completes. | — | — |
| Terminated | The Subscription has been permanently ended — either by a completed Termination Order or by direct Vendor action via the `/terminate` endpoint. Terminal state — no outbound transitions. | — | — |
| Expired | The Subscription's `commitmentDate` passed with `autoRenew = false`. The platform's daily renewal service moved it to Expired. Terminal state — no outbound transitions. | — | — |

> **Note on Draft:** Subscriptions have no Draft state. During Order Processing, the Vendor creates an `OrderSubscription` object (a temporary representation scoped to the Order, accessible via `/orders/{id}/subscriptions`). When the Purchase or Change Order completes, the platform copies the OrderSubscription to create the live Subscription, retaining the same ID. The live Subscription is created directly in Active status.

### 3.2 Transitions

| # | From State | To State | Action / Trigger | Permitted Actor(s) | Preconditions | Outcome / Side Effects |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Active | Order completed — copied from OrderSubscription | Platform | Purchase or Change Order transitions to Completed | Platform copies the OrderSubscription to create the live Subscription under Vendor token context. Same ID retained. Subscription linked to Agreement simultaneously. |
| T2 | — | Active | Vendor creates directly | Vendor | None — Vendor discretion | Used for migration scenarios or direct vendor sync. Subscription created directly in Active status without an Order. |
| T3 | Active | Updating | Change or Configuration Order placed | Platform | Change or Configuration Order transitions to Processing | Automated under Client token context. Subscription returns to Active when the Order completes or fails. |
| T4 | Active | Terminating | Termination Order placed | Platform | Termination Order transitions to Processing | Automated under Client token context. |
| T5 | Active | Terminated | Terminate Subscription | Vendor | Subscription must be Active | Via `/terminate` endpoint. `terminationDate` set automatically by platform. If this is the last Active Subscription on the Agreement, Agreement → Terminated. |
| T6 | Active | Expired | Renewal service — not renewed | Platform | `autoRenew = false` and `commitmentDate < today` | Automated daily. Executed by the platform's renewal service. Terminal state. |
| T7 | Active | Active | Renewal service — renewed | Platform | `autoRenew = true` and `commitmentDate < today` | Not a state transition — Subscription remains Active. `commitmentDate` updated to `commitmentDate + term`. `renewed` audit event recorded. |
| T8 | Updating | Active | Change or Configuration Order completed or failed | Platform | Order transitions to Completed or Failed | Automated under Vendor or Operations token context. |
| T9 | Terminating | Terminated | Termination Order completed | Platform | Termination Order transitions to Completed | Automated under Vendor token context. `terminationDate` set automatically by platform. If this is the last Active/Terminating Subscription on the Agreement, Agreement → Terminated. |
| T10 | Terminating | Active | Termination Order failed | Platform | Termination Order transitions to Failed | Automated under Vendor or Operations token context. Subscription reverts to Active unchanged. |

### 3.3 State Diagram

```
— ---(Order completed, copied from OrderSubscription : Platform)---> [Active]
— ---(Vendor creates directly : Vendor)---> [Active]
[Active] ---(Change or Configuration Order placed : Platform)---> [Updating]
[Active] ---(Termination Order placed : Platform)---> [Terminating]
[Active] ---(Vendor terminates directly : Vendor)---> [Terminated]
[Active] ---(Renewal service, not renewed : Platform)---> [Expired]
[Active] ---(Renewal service, renewed : Platform)---> [Active] (commitmentDate updated)
[Updating] ---(Order completed or failed : Platform)---> [Active]
[Terminating] ---(Termination Order completed : Platform)---> [Terminated]
[Terminating] ---(Termination Order failed : Platform)---> [Active]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | Subscriptions are owned by the Vendor. The Vendor Extension creates and maintains Subscriptions as the authoritative fulfilment record. SoftwareOne (Operations) owns the Agreement; the Vendor owns the Subscriptions under it. | All | Vendor | This ownership distinction drives the write permission model — the Vendor has broad direct write access to Subscriptions without requiring an Order. |
| BR-002 | A Subscription is normally created during Order Processing as an OrderSubscription and promoted to a live Subscription when the Purchase or Change Order completes. The platform copies the OrderSubscription to create the live Subscription, retaining the same ID. The Subscription is created directly in Active status — there is no Draft state. | — (creation) | Vendor | The Vendor may also create a Subscription directly in Active status without an Order for migration or vendor sync scenarios. |
| BR-003 | When a Termination Order completes, the affected Subscriptions transition to Terminated. When a Vendor terminates a Subscription directly via the `/terminate` endpoint, the Subscription transitions immediately to Terminated. In both cases, `terminationDate` is set automatically by the platform. | Active, Terminating | Vendor | If the terminated Subscription is the last Active or Terminating Subscription on the Agreement, the Agreement automatically transitions to Terminated. |
| BR-004 | Expired and Terminated are permanently terminal states. A Subscription cannot be reactivated from either state. A new Subscription must be created — typically via a new Purchase or Change Order — to replace a terminated or expired Subscription. | Terminated, Expired | All | — |
| BR-005 | The platform runs a daily renewal service that evaluates all Active Subscriptions. For Subscriptions where `autoRenew = true` and `commitmentDate < today`: the `renewed` audit event is recorded and `commitmentDate` is updated to `commitmentDate + terms.period`. The Subscription status does not change. | Active | Platform | The renewal service is a platform-level automated process. |
| BR-006 | The platform runs a daily renewal service that evaluates all Active Subscriptions. For Subscriptions where `autoRenew = false` and `commitmentDate < today`: the Subscription transitions to Expired. `commitmentDate` is not updated. Expired is a terminal state. | Active | Platform | Expiry is driven by the same daily service as renewal. |
| BR-007 | The `autoRenew` flag can only be updated directly by the Vendor. The Client cannot update `autoRenew` directly — it may be toggled via a Configuration Order, which the Vendor Extension processes. | All | Vendor | Configuration Orders are the standard mechanism for Clients to request auto-renewal changes. The Vendor Extension implements the business logic and updates `autoRenew` directly. |
| BR-008 | Subscription-scoped `parameters.fulfillment` are written and maintained exclusively by the Vendor. The Client cannot update Subscription parameters directly. | All | Vendor | Parameters with `hidden=true` are suppressed from Client API responses — consistent with the parameter suppression model on Orders and Agreements. |
| BR-009 | The `terms` object on a Subscription (`model`, `period`, `commitment`) is set at Subscription creation and is immutable thereafter. The terms of all Lines under a Subscription must match the terms of the Subscription. | All | All | Valid values: `model` — `one-time`, `usage`, `quantity`; `period` — `1m`, `1y`, `one-time`; `commitment` — `1m`, `1y`, `3y`. |
| BR-010 | There is no DELETE endpoint on Subscription. The only paths to terminal states are Termination (via Termination Order or direct Vendor action) and Expiry (via the platform's daily renewal service). | All | All | — |
| BR-011 | The `name` field on a Subscription can be updated by any Actor. | All | All | — |
| BR-012 | The `template` field on a Subscription can be set and updated by the Vendor in any non-terminal status. The template is absent from the Subscription response when null — consistent with null suppression. | Active, Updating, Terminating | Vendor | The Subscription template determines the rendered content shown to the Client when viewing their Subscription. |
| BR-013 | Operations can update `price.defaultMarkup` and `price.defaultMargin` directly on a Subscription, and can manage Split Billing via the `/split` endpoint. Operations can also manage markup on Subscription Lines. These are the only direct update capabilities available to the Operations Actor on a Subscription. | Active | Operations | — |
| BR-014 | The `split` field and `splitStatus` field are suppressed from Vendor API responses — visible to Client and Operations only. See AGR-007 for Split Billing canon — pending canonisation. | All | Client, Operations | `split` is absent from response when null (null suppression). `splitStatus` valid values: `Disabled`, `Active`, `Review`. |
| BR-015 | Subscription pricing field visibility mirrors the Agreement and Order pricing model: `PPxY` and `PPxM` are visible to Vendor and Operations; `SPxY` and `SPxM` are visible to Client and Operations; `markup`, `margin`, `defaultMarkup`, `defaultMargin`, `defaultMarkupSource`, and `markupSource` are visible to Operations only. | All | All | — |
| BR-016 | The `commitmentDate` field represents the date by which the Subscription must be renewed or it will expire. It is evaluated daily by the platform's renewal service. After a successful renewal, it is updated to `commitmentDate + terms.period`. | Active | Platform | See SUB-001 for whether `commitmentDate` can be set by the Vendor at creation or via the `/terminate` endpoint. |
| BR-017 | Subscription visibility is self-scoped per Actor: Vendor sees only Subscriptions on Agreements where they are the Vendor; Client sees only Subscriptions on Agreements belonging to their own Account; Operations sees all Subscriptions platform-wide. | All | All | — |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | String | Unique platform identifier for the Subscription. | Platform | No | Format: SUB-XXXX-XXXX-XXXX. Same ID as the OrderSubscription it was promoted from. |
| `revision` | Integer | Increments each time the Subscription is updated. | Platform | Yes — platform-managed | — |
| `name` | String | Human-readable name for the Subscription. | Platform (at creation) | Yes — all Actors | Typically auto-generated as "Subscription for [Item Name]". |
| `status` | Enum | Current status. Valid values: `Active`, `Updating`, `Terminating`, `Terminated`, `Expired`. | Platform | Yes — platform-managed | Driven by Order transitions, direct Vendor action, or the platform's renewal service. Not directly writable. |
| `autoRenew` | Boolean | Whether the Subscription will be automatically renewed by the platform's daily renewal service when `commitmentDate` is reached. | Vendor | Yes — Vendor only | Client cannot update directly. May be toggled via Configuration Order. |
| `commitmentDate` | DateTime | The date by which the Subscription must be renewed or it will expire. Updated by the renewal service after each successful renewal (`commitmentDate + terms.period`). | Vendor (at creation), Platform (on renewal) | Yes — platform-managed after creation | See SUB-001. |
| `startDate` | DateTime | The date the Subscription became active. | Vendor (at creation) | No | Set at Subscription creation. Immutable. |
| `terminationDate` | DateTime | The date the Subscription was terminated. | Platform | No | Set automatically by the platform when a Subscription transitions to Terminated. Absent from response when null — consistent with null suppression. |
| `terms` | Object | The billing terms for this Subscription. Contains `model` (`one-time`, `usage`, `quantity`), `period` (`1m`, `1y`, `one-time`), and `commitment` (`1m`, `1y`, `3y`). | Vendor (at creation) | No | Immutable after creation. All Lines under this Subscription must have matching terms. |
| `price` | Object | Aggregate pricing for the Subscription. Contains `SPxY`, `SPxM`, `PPxY`, `PPxM`, `currency`, `markup`, `margin`, `defaultMarkup`, `defaultMargin`, `defaultMarkupSource`, `markupSource`. | Platform (computed), Operations (defaultMarkup/defaultMargin) | Yes — Operations only for markup fields | `PPxY`, `PPxM` visible to Vendor and Operations. `SPxY`, `SPxM` visible to Client and Operations. `markup`, `margin`, `defaultMarkup`, `defaultMargin`, `defaultMarkupSource`, `markupSource` visible to Operations only. |
| `parameters.fulfillment` | Array | Subscription-scoped fulfilment parameters written and maintained by the Vendor Extension. Contains parameters with `phase: "Fulfillment"` and `scope: "Subscription"`. | Vendor | Yes — Vendor only | Parameters with `hidden=true` suppressed from Client API responses. Not writable by Client or Operations directly. |
| `template` | Object | Reference to the Catalog: Template assigned to this Subscription. Determines rendered content shown to the Client when viewing their Subscription. | Vendor | Yes — Vendor, non-terminal states only | Absent from response when null. |
| `lines` | Array | Lines (Entitlements) associated with this Subscription. Accessible via `/subscriptions/{id}/lines` endpoint. | Platform | No | Each Line maps one SKU at one quantity to this Subscription. Line terms must match Subscription terms. |
| `externalIds.vendor` | String | Vendor's reference for this Subscription — e.g. the vendor-side subscription identifier. | Vendor | Yes | Optional. Absent from response when null. |
| `externalIds.client` | String | Client's own reference for this Subscription. | Client | Yes | Optional. Absent from response when null. |
| `split` | Object | Split Billing configuration for this Subscription. Accessible via `/split` endpoint. | Operations | Yes | Suppressed for Vendor Actor. Absent from response when null. See AGR-007. |
| `splitStatus` | Enum | Current Split Billing status. Valid values: `Disabled`, `Active`, `Review`. | Platform | Yes — platform-managed | Suppressed for Vendor Actor. |
| `agreement` | Object | Reference to the parent Commerce: Agreement. | Platform | No | Immutable after creation. |
| `product` | Object | Reference to the Catalog: Product. | Platform | No | Immutable after creation. Derived from the Agreement. |
| `buyer` | Object | Reference to the Accounts: Buyer. | Platform | No | Immutable after creation. Derived from the Agreement. |
| `licensee` | Object | Reference to the Accounts: Licensee. | Platform | No | Immutable after creation. Derived from the Agreement. |
| `seller` | Object | Reference to the Accounts: Seller. | Platform | No | Immutable after creation. Derived from the Agreement. |
| `audit` | Object | Audit timestamps for key lifecycle events. Contains `created`, `updated`, `active`, `terminated`, `terminating`, `updating`, `expired`, `renewed`. | Platform | No | Omitted by default — request via `select=+audit`. State-specific entries only present if the Subscription has reached that state. `renewed` is an event sub-key — not a state — updated each time the renewal service renews the Subscription. |
| References | — | Group of immutable reference fields derived from the parent Agreement at Subscription creation. Includes agreement, product, buyer, licensee, and seller. None of these can be changed after creation. | — | — | — |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Commerce: Agreement | Parent | Many Subscriptions to one Agreement | Every Subscription belongs to an Agreement. Created and linked during Order Processing. | If all Subscriptions on an Agreement reach Terminated status, the Agreement automatically transitions to Terminated. |
| Commerce: Order | Association | Many Subscriptions to many Orders | Subscriptions are created during Purchase or Change Order Processing and linked to the Agreement on completion. Termination Orders affect Subscriptions in Terminating status. | Subscription state is driven by Order state transitions. See Commerce: Order canon Section 7.2. |
| Commerce: Order Line | Child | One Subscription to many Lines | Lines are the unit of work mapped to this Subscription. Accessible via `/subscriptions/{id}/lines`. Also accessible via the Agreement `/lines` endpoint as Entitlements. | Line terms must match Subscription terms. Lines reflect the current quantity of each Item under this Subscription. |
| Catalog: Product | Association | Many Subscriptions to one Product | The Product this Subscription covers. Derived from the Agreement. | Immutable after creation. |
| Catalog: Template | Association | Many Subscriptions to one Template | The Template determining rendered content shown to the Client when viewing their Subscription. Set and updated by the Vendor. | No lifecycle dependency — Template changes do not affect Subscription status. |
| Accounts: Agreement (Buyer) | Association | Many Subscriptions to one Buyer | The Buyer associated with the Subscription's Agreement. | Immutable after creation. |
| Accounts: Licensee | Association | Many Subscriptions to one Licensee | The Licensee associated with the Subscription's Agreement. | Immutable after creation. |
| Accounts: Seller | Association | Many Subscriptions to one Seller | The Seller associated with the Subscription's Agreement. | Immutable after creation. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Subscription renewed | Platform renewal service runs; `autoRenew = true` and `commitmentDate < today` | Platform | `commitmentDate` updated to `commitmentDate + terms.period`. `renewed` audit event recorded. No status transition. |
| `autoRenew` updated | Vendor updates `autoRenew` directly via PUT | Vendor | Value persisted immediately. Affects next renewal service evaluation. No state transition. |
| Parameters updated | Vendor updates `parameters.fulfillment` via PUT | Vendor | Values persisted immediately. No state transition. |
| Template updated | Vendor updates `template` via PUT | Vendor | Rendered content shown to Client updates immediately. No state transition. |
| Subscription terminated directly | Vendor calls `/terminate` endpoint | Vendor | Subscription → Terminated. `terminationDate` set by platform. If last Active/Terminating Subscription on Agreement, Agreement → Terminated. |
| Split Billing updated | Operations updates Split Billing via `/split` endpoint | Operations | Split Billing allocations updated. `splitStatus` updated by platform. No state transition on Subscription. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| All Subscriptions on Agreement reach Terminated or Expired | Commerce: Agreement | Agreement → Terminated | Yes — platform | All Subscriptions are in Terminated or Expired status | Whether via Termination Order, direct Vendor action, or platform expiry. |
| Subscription transitions to Terminating (Termination Order placed) | Commerce: Agreement | Agreement → Updating | Yes — platform, under Client token context | Termination Order placed | Agreement remains in Updating until the Termination Order completes or fails. |
| Termination Order completed | Commerce: Subscription | Subscription → Terminated | Yes — platform, under Vendor token context | Termination Order transitions to Completed | `terminationDate` set automatically by platform. |
| Termination Order failed | Commerce: Subscription | Subscription → Active | Yes — platform, under Vendor or Operations token context | Termination Order transitions to Failed | Subscription reverts to Active unchanged. Agreement → Active. |
| Change or Configuration Order completed or failed | Commerce: Subscription | Subscription → Active | Yes — platform, under Vendor or Operations token context | Order type is Change or Configuration | Subscription reverts to Active regardless of whether the Order completed or failed. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Updating → Active is reversible with no limit on cycles — each new Order placed against the Agreement returns Updating Subscriptions to Active when the Order completes or fails.

Terminating → Active is reversible if the Termination Order fails.

All other transitions are irreversible. Terminated and Expired are permanently terminal states. A Subscription cannot be reactivated from either state.

**Deletion:**
There is no DELETE endpoint on Subscription. Subscriptions cannot be deleted. The only terminal states are Terminated and Expired — both permanently remove the Subscription from the active fulfilment picture but it remains retrievable via the API. Consistent with Platform Invariant 7 — terminated and expired Subscriptions are not removed from API visibility.

**Audit & history requirements:**
The Subscription audit block captures `created`, `updated`, `active`, `terminated`, `terminating`, `updating`, `expired`, and `renewed` timestamps and Actor references. The `renewed` sub-key is updated each time the renewal service successfully renews the Subscription — it reflects the most recent renewal event. The audit block is omitted from API responses by default — request via `select=+audit`.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| `autoRenew` not set to false before `commitmentDate` | The platform's renewal service will renew the Subscription automatically, extending `commitmentDate` and generating a billing event. The Client may be charged for an unintended renewal period. | Client, Vendor | High | The Client must ensure `autoRenew = false` before `commitmentDate` if they do not wish to renew. Only the Vendor can update `autoRenew` directly — the Client must request this via a Configuration Order. |
| Termination Order fails — Subscription reverts to Active | The Subscription reverts to Active unchanged. The Agreement reverts to Active. A new Termination Order must be created to retry. The renewal service will continue to evaluate the Subscription on its normal schedule. | Client, Vendor | Medium | If the `commitmentDate` passes while the Termination Order is in Processing, the renewal service may renew the Subscription before the Order can complete. |
| Subscription remains in Updating indefinitely | No platform-level safeguard. If the associated Order is abandoned, the Subscription remains in Updating indefinitely. | Client, Operations | High | Operations should monitor long-running Orders. See Commerce: Order canon Section 9. |
| Vendor creates Subscription directly without Order | The Subscription is created directly in Active status and linked to the Agreement. No Order audit trail exists for this Subscription. | Operations, Client | Medium | Used for migration scenarios. The absence of an Order means there is no Order-level audit for this Subscription's creation. Operations should ensure direct creations are documented externally. |
| All Subscriptions on an Agreement expire | The platform transitions each Subscription to Expired individually as their `commitmentDate` passes. Once all Subscriptions are Expired, the Agreement transitions to Terminated. Assets are unaffected. | Client | Medium | Expiry-driven Agreement termination may surprise Clients who did not actively place a Termination Order. |
| Terms mismatch between Subscription and Line | The platform enforces that Line terms must match the parent Subscription's terms. A Line with mismatched terms cannot be added to the Subscription. | Vendor | Low | Platform-enforced — see BR-009. |

---

## 10. Open Questions

- [ ] **SUB-001:** What fields are meaningful in the request body of the `/terminate` endpoint? Specifically whether `terminationDate` or other Subscription fields can be set by the Vendor at termination time, or whether the body is unused.
- [ ] **SUB-002:** Whether `commitmentDate` is set by the Vendor Extension at Subscription creation, computed by the platform from `startDate + terms.commitment`, or both, is not confirmed.
- [ ] **SUB-003:** Split Billing on Subscription — full semantics, write rules, and `splitStatus` lifecycle — to be canonised separately. See AGR-007.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-04-13 | Stu | Initial canon. Covers all five Subscription statuses, the OrderSubscription promotion model, the daily renewal and expiry service, Vendor ownership model, parameter write rules, pricing visibility, Split Billing noted as pending. |
