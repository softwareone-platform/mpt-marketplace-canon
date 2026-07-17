# Object Canon: Subscription

> **Version:** 0.4
> **Owner:** Stu
> **Last Updated:** 2026-07-17
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
A Subscription is the platform's record of a recurring fulfilment relationship between a Client and a Vendor for a specific Item under a Commerce [[Agreement]]. Subscriptions are owned by the Vendor — the Vendor creates and maintains them as the authoritative fulfilment record — while SoftwareOne (Operations) owns the parent [[Agreement]]. A Subscription is created during [[Order]] processing and promoted to a live record when the Purchase or Change [[Order]] completes, or created directly by the Vendor for migration and edge-case scenarios. Subscriptions carry their own parameters, pricing, terms, and rendered [[Template]], and are renewed or expired automatically by the platform's daily renewal service. A Subscription can also be suspended and resumed.

**Also Known As:**
None known.

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes | Yes | Yes | No | Creates Subscriptions directly (migration/edge cases) or via [[Order]] processing. Updates `name`, `template`, `autoRenew`, `commitmentDate`, `parameters.fulfillment`, `externalIds.vendor`. Terminates, suspends, and resumes via dedicated endpoints. Read is scoped to Subscriptions on [[Agreement]]s where they are the Vendor (BR-020). |
| Operations | No | Yes | Yes | No | Updates `commitmentDate` and `price.defaultMarkup` (only while Active or Suspended), and manages Split Billing via the `/split` endpoint. Suspend and resume Orders are Operations-driven. Read is not self-scoped — Operations sees all Subscriptions platform-wide. |
| Client | No | Yes | Yes | No | Updates `name` and `externalIds.client`. Cannot create, terminate, suspend, resume, or delete. Read is scoped to Subscriptions on [[Agreement]]s belonging to their own [[Account]] (BR-020). |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Active | The Subscription is live and fulfilling. It is evaluated daily by the platform's renewal service and may be renewed, expired, suspended, updated, or terminated. | Yes | No |
| Updating | A Change or Configuration Order affecting this Subscription is being processed. The Subscription returns to Active when the Order completes or fails. | No | No |
| Terminating | A Termination Order affecting this Subscription is being processed. The Subscription transitions to Terminated when the Order completes, or reverts when it fails. | No | No |
| Suspending | A Suspend Order affecting this Subscription is being processed. The Subscription transitions to Suspended when the Order completes, or reverts to Active when it fails. | No | No |
| Suspended | Fulfilment is paused. The Subscription can be resumed, terminated, or expired. | No | No |
| Resuming | A Resume Order affecting this Subscription is being processed. The Subscription transitions to Active when the Order completes, or reverts to Suspended when it fails. | No | No |
| Terminated | The Subscription has been permanently ended — by a completed Termination Order or by direct Vendor action. Terminal — no outbound transitions. | No | Yes |
| Expired | The Subscription's `commitmentDate` passed without renewal and the platform's daily service moved it to Expired. Terminal — no outbound transitions. | No | Yes |

> **Note on Draft:** Subscriptions have no Draft state. During Order processing the Vendor works on an Order-scoped representation (accessible via `/orders/{id}/subscriptions`). When the Purchase or Change Order completes, the platform promotes it to the live Subscription, retaining the same ID, created directly in Active.
>
> **Note on the two suspend/resume paths:** A Vendor suspends or resumes *directly* via the `/suspend` and `/resume` endpoints, which move the Subscription straight to Suspended or Active without passing through the transient Suspending/Resuming states. The transient states occur only on the Operations-driven Suspend/Resume Order path, and resolve when that Order completes or fails.

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Active | Order completed — promoted from the Order-scoped representation | No dedicated endpoint — driven by Purchase/Change Order completion | Platform | Purchase or Change Order transitions to Completed | Under Vendor token context. Same ID retained. Linked to the Agreement simultaneously. |
| T2 | — | Active | Vendor creates directly | `POST` (base collection endpoint) | Vendor | Parent Agreement is Active, New, or Draft | Migration/vendor-sync. Created directly in Active without an Order. |
| T3 | Active | Updating | Change or Configuration Order placed | No dedicated endpoint — driven by Order state | Platform | Change or Configuration Order enters Processing | Under the placing Actor's token context. |
| T4 | Active | Terminating | Termination Order placed | No dedicated endpoint — driven by Order state | Platform | Termination Order enters Processing | Parent Agreement transitions to Updating. |
| T5 | Active | Terminated | Vendor terminates directly | `terminate` | Vendor | Parent Agreement is Active | Immediate. `terminationDate` set to now, `autoRenew` forced false, active Lines set to quantity 0 and terminated. If last, Agreement → Terminated (BR-003). |
| T6 | Active | Suspended | Vendor suspends directly | `suspend` | Vendor | Parent Agreement is Active; the Product's Suspend/Resume setting permits Vendor suspend | Immediate — skips Suspending. |
| T7 | Active | Suspending | Suspend Order placed | No dedicated endpoint — driven by Suspend Order state | Platform | Suspend Order (Operations) enters Processing; the Product's Suspend/Resume setting permits it | |
| T8 | Active | Expired | Renewal service — not renewed | No dedicated endpoint — daily renewal service | Platform | `commitmentDate` < today, `autoRenew` = false, parent Agreement Active, and the Product's cessation setting permits expiry (BR-006) | Terminal. |
| T9 | Active | Active | Renewal service — renewed | No dedicated endpoint — daily renewal service | Platform | `commitmentDate` < today and `autoRenew` = true | Not a state change. `commitmentDate` advanced by `terms.commitment`; `renewed` audit event recorded (BR-005). |
| T10 | Updating | Active | Change or Configuration Order completed or failed | No dedicated endpoint — driven by Order state | Platform | Order transitions to Completed or Failed | Returns to Active in both cases. |
| T11 | Terminating | Terminated | Termination Order completed | No dedicated endpoint — driven by Order state | Platform | Termination Order transitions to Completed | `terminationDate` set. If last, Agreement → Terminated (BR-003). |
| T12 | Terminating | Active | Termination Order failed | No dedicated endpoint — driven by Order state | Platform | Termination Order transitions to Failed | Reverts unchanged (or to Suspended if the Subscription was Suspended before the Order). |
| T13 | Suspending | Suspended | Suspend Order completed | No dedicated endpoint — driven by Suspend Order state | Platform | Suspend Order transitions to Completed | |
| T14 | Suspending | Active | Suspend Order failed | No dedicated endpoint — driven by Suspend Order state | Platform | Suspend Order transitions to Failed | Reverts unchanged. |
| T15 | Suspended | Active | Vendor resumes directly | `resume` | Vendor | Parent Agreement is Active; the Product's Suspend/Resume setting permits Vendor resume | Immediate — skips Resuming. `resumed` audit event recorded. |
| T16 | Suspended | Resuming | Resume Order placed | No dedicated endpoint — driven by Resume Order state | Platform | Resume Order (Operations) enters Processing; the Product's Suspend/Resume setting permits it | |
| T17 | Suspended | Terminating | Termination Order placed | No dedicated endpoint — driven by Order state | Platform | Termination Order enters Processing | |
| T18 | Suspended | Terminated | Vendor terminates directly | `terminate` | Vendor | Parent Agreement is Active | Immediate. |
| T19 | Suspended | Expired | Renewal service — not renewed | No dedicated endpoint — daily renewal service | Platform | `commitmentDate` < today, parent Agreement Active, and the Product's cessation setting permits expiry | Terminal. A Suspended Subscription past its commitment date is expired by the same daily service. |
| T20 | Resuming | Active | Resume Order completed | No dedicated endpoint — driven by Resume Order state | Platform | Resume Order transitions to Completed | |
| T21 | Resuming | Suspended | Resume Order failed | No dedicated endpoint — driven by Resume Order state | Platform | Resume Order transitions to Failed | Reverts to Suspended. |

### 3.3 State Diagram

```
— ---(Order completed, promoted : Platform)---> [Active]
— ---(Vendor creates directly : Vendor)---> [Active]
[Active] ---(Change/Configuration Order placed : Platform)---> [Updating]
[Active] ---(Termination Order placed : Platform)---> [Terminating]
[Active] ---(Vendor suspends directly : Vendor)---> [Suspended]
[Active] ---(Suspend Order placed : Platform)---> [Suspending]
[Active] ---(Renewal service, not renewed : Platform)---> [Expired]
[Active] ---(Renewal service, renewed : Platform)---> [Active] (commitmentDate advanced)
[Active] ---(Vendor terminates directly : Vendor)---> [Terminated]
[Updating] ---(Order completed or failed : Platform)---> [Active]
[Terminating] ---(Termination Order completed : Platform)---> [Terminated]
[Terminating] ---(Termination Order failed : Platform)---> [Active] (or [Suspended])
[Suspending] ---(Suspend Order completed : Platform)---> [Suspended]
[Suspending] ---(Suspend Order failed : Platform)---> [Active]
[Suspended] ---(Vendor resumes directly : Vendor)---> [Active]
[Suspended] ---(Resume Order placed : Platform)---> [Resuming]
[Suspended] ---(Termination Order placed : Platform)---> [Terminating]
[Suspended] ---(Vendor terminates directly : Vendor)---> [Terminated]
[Suspended] ---(Renewal service, not renewed : Platform)---> [Expired]
[Resuming] ---(Resume Order completed : Platform)---> [Active]
[Resuming] ---(Resume Order failed : Platform)---> [Suspended]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | Subscriptions are owned by the Vendor, who creates and maintains them as the authoritative fulfilment record. SoftwareOne (Operations) owns the parent [[Agreement]]. | All | Vendor | This ownership distinction drives the write model — the Vendor has broad direct write access without requiring an [[Order]]. |
| BR-002 | A Subscription is normally created during [[Order]] processing and promoted to a live record when the Purchase or Change [[Order]] completes, retaining the same ID. It is created directly in Active — there is no Draft state. | — (creation) | Vendor | The Vendor may also create a Subscription directly in Active for migration or vendor-sync scenarios; this requires the parent [[Agreement]] to be Active, New, or Draft. |
| BR-003 | When a Termination [[Order]] completes, or when the Vendor terminates directly via the `/terminate` endpoint, the Subscription transitions to Terminated and `terminationDate` is set by the platform. If it is the last Subscription on the [[Agreement]] not already Terminated or Expired, the [[Agreement]] transitions to Terminated. | Active, Terminating, Suspended | Vendor | Direct termination also sets `autoRenew` to false and reduces the Subscription's Lines to quantity 0. |
| BR-004 | Terminated and Expired are permanently terminal. A Subscription cannot be reactivated from either state; a new Subscription must be created to replace it. | Terminated, Expired | All | — |
| BR-005 | The platform's daily renewal service renews Active Subscriptions where `autoRenew` = true and `commitmentDate` < today: `commitmentDate` is advanced and a `renewed` audit event is recorded. The status does not change. | Active | Platform | `commitmentDate` is advanced by `terms.commitment` (the commitment term), not `terms.period`. |
| BR-006 | The platform's daily service expires a Subscription whose `commitmentDate` has passed and which is not set to auto-renew, moving it to the terminal Expired state. | Active, Suspended | Platform | Expiry additionally requires the parent [[Agreement]] to be Active and the [[Product]]'s cessation setting to permit auto-renewal-based expiry. A Subscription whose Product does not permit it is not auto-expired even with `autoRenew` = false. |
| BR-007 | `autoRenew` can only be set directly by the Vendor. The Client cannot set it directly; it may be changed via a Configuration [[Order]] processed by the Vendor. | All | Vendor | — |
| BR-008 | Subscription-scoped `parameters.fulfillment` are written and maintained exclusively by the Vendor. | All | Vendor | Parameters marked hidden are suppressed from Client API responses, consistent with the parameter suppression model on [[Order]]s and [[Agreement]]s. |
| BR-009 | The `terms` object (`model`, `period`, `commitment`) is set at creation and is immutable thereafter. The terms of all Lines under a Subscription match the Subscription's terms. | All | All | Valid values — `model`: `one-time`, `usage`, `quantity`; `period`: `1m`, `1y`, `3y`, `one-time`; `commitment`: `1m`, `1y`, `2y`, `3y`, `4y`, `5y` (may be absent). |
| BR-010 | There is no delete endpoint on Subscription. The only terminal states are Terminated and Expired. | All | All | — |
| BR-011 | `name` can be updated by any Actor; `externalIds.vendor` by the Vendor and `externalIds.client` by the Client. | Non-terminal (Client name limited to Updating/Active/Suspended/Suspending/Resuming) | All | The Client can still update `externalIds.client` on a Terminating or Terminated Subscription. |
| BR-012 | The `template` reference can be set and updated by the Vendor. | Active, Expired, Terminated, Suspended | Vendor | Determines the content rendered to the Client (via the `/render` endpoint) when viewing the Subscription. Absent from the response when null. |
| BR-013 | Operations can update `commitmentDate` and `price.defaultMarkup` directly, and manage Split Billing via the `/split` endpoint. These are the only direct Operations write capabilities on a Subscription. | Active, Suspended | Operations | Operations does not set `price.defaultMargin` directly. |
| BR-014 | A Vendor may suspend an Active Subscription and resume a Suspended one via the `/suspend` and `/resume` endpoints; both act immediately, moving the Subscription straight to Suspended or Active. | Active (suspend), Suspended (resume) | Vendor | Permitted only when the parent [[Agreement]] is Active and the [[Product]]'s Suspend/Resume setting permits Vendor suspend/resume. Operations-driven Suspend/Resume [[Order]]s use the transient Suspending/Resuming states and additionally require the setting to permit Operations. |
| BR-015 | The `split` reference and `splitStatus` are visible to Client and Operations only — both are suppressed from Vendor responses. | All | Client, Operations | `split` is absent from the response when null. `splitStatus` values: `Disabled`, `Active`. The full split configuration is a separate object — see Commerce: [[Subscription Split Billing]]. |
| BR-016 | Subscription pricing field visibility mirrors the [[Agreement]] and [[Order]] model: `PPxY`/`PPxM` are visible to Vendor and Operations; `SPxY`/`SPxM` to Client and Operations; `markup`, `margin`, `defaultMarkup`, `defaultMargin`, `defaultMarkupSource`, and `markupSource` to Operations only; `currency` to Client and Operations. | All | All | — |
| BR-017 | `commitmentDate` is the date by which the Subscription must be renewed or it will expire. It defaults to `startDate` + `terms.commitment` at creation, may be supplied by the Vendor at direct creation, and is advanced by `terms.commitment` on each successful renewal. | Active, Suspended | Vendor, Operations, Platform | Also directly settable by the Vendor, or by Operations while Active or Suspended. |
| BR-018 | The `/terminate` endpoint's request body is applied as a Vendor update (the same fields a Vendor may update) immediately before termination; it carries no termination-date or effective-date field. Termination is immediate — `terminationDate` is always set to the current time. | Active, Terminating, Suspended | Vendor | There is no future-dated or effective-dated termination via this endpoint. |
| BR-019 | Subscription state transitions are driven by [[Order]] state, the platform's daily renewal service, or direct Vendor action (terminate/suspend/resume). No Actor can set `status` through a plain field write. | All | All | — |
| BR-020 | Subscription visibility is self-scoped per Actor: the Vendor sees only Subscriptions on [[Agreement]]s where they are the Vendor; the Client only those on [[Agreement]]s belonging to their own [[Account]]; Operations sees all. | All | All | — |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | String | Unique platform identifier. | Platform | No | Format: `SUB-XXXX-XXXX-XXXX`. Same ID as the Order-scoped representation it was promoted from. |
| `revision` | Integer | Increments on each update. | Platform | Yes — platform-managed | — |
| `name` | String | Human-readable name. | Platform (at creation) | Yes — all Actors | Typically auto-generated from the Item name. |
| `status` | Enum | Current status. | Platform | Yes — platform-managed | Values: `Active`, `Updating`, `Terminating`, `Suspending`, `Suspended`, `Resuming`, `Terminated`, `Expired`. Not directly writable (see BR-019). |
| `autoRenew` | Boolean | Whether the daily renewal service renews the Subscription at `commitmentDate`. | Vendor | Yes — Vendor only | Client cannot set directly; may be changed via a Configuration Order (see BR-007). |
| `commitmentDate` | DateTime | The date by which the Subscription must be renewed or it will expire. | Platform (computed) / Vendor / Operations | Yes | Defaults to `startDate` + `terms.commitment`; advanced by `terms.commitment` on renewal (see BR-017). |
| `startDate` | DateTime | The date the Subscription became active. | Vendor (at creation) | No | — |
| `terminationDate` | DateTime | The date the Subscription was terminated. | Platform | No | Set to the current time on termination. Absent from the response when null. |
| `terms` | Object | Billing terms: `model`, `period`, `commitment`. | Vendor (at creation) | No | Immutable. Enum values listed in BR-009. `commitment` may be absent. |
| `price` | Object | Aggregate pricing: `SPxY`, `SPxM`, `PPxY`, `PPxM`, `currency`, `markup`, `margin`, `defaultMarkup`, `defaultMargin`, `defaultMarkupSource`, `markupSource`. | Platform (computed); Operations (`defaultMarkup`) | `defaultMarkup` by Operations | Field-level visibility per Actor described in BR-016. |
| `parameters.fulfillment` | Array | Subscription-scoped fulfilment parameters. | Vendor | Yes — Vendor only | Hidden parameters are suppressed from Client responses. Subscriptions carry only fulfilment-phase parameters. |
| `template` | Object | Reference to the Catalog Template rendered for the Client. | Vendor | Yes — Vendor | Absent from the response when null. See BR-012. |
| `lines` | Array | Lines (Entitlements) under this Subscription. | Platform | No | Also reachable via `/subscriptions/{id}/lines`. Line terms match Subscription terms. See BR-009. |
| `externalIds.vendor` | String | The Vendor's own reference for this Subscription. | Vendor | Yes | Optional. Absent when null. |
| `externalIds.client` | String | The Client's own reference for this Subscription. | Client | Yes | Optional. Absent when null. |
| `split` | Object | Reference to the Subscription's Split Billing configuration. | Operations | Yes | Suppressed for the Vendor Actor. Absent when null. See BR-015. |
| `splitStatus` | Enum | Split Billing status: `Disabled`, `Active`. | Platform | Yes — platform-managed | Suppressed for the Vendor Actor. `Active` once a split is seeded, `Disabled` before. |
| `agreement` | Object | Reference to the parent Commerce Agreement. | Platform | No | — |
| `product` | Object | Reference to the Catalog Product. | Platform | No | Derived from the Agreement. |
| `buyer` | Object | Reference to the Accounts Buyer. | Platform | No | Derived from the Agreement. |
| `licensee` | Object | Reference to the Accounts Licensee. | Platform | No | Derived from the Agreement. |
| `seller` | Object | Reference to the Accounts Seller. | Platform | No | Derived from the Agreement. |
| `audit` | Object | Lifecycle event timestamps and Actors: `created`, `updated`, `active`, `terminated`, `terminating`, `updating`, `expired`, `renewed`. | Platform | No | Omitted by default — request via `select=+audit`. Only entries for states the Subscription has reached are present. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Commerce: Agreement | Parent | Many Subscriptions to one Agreement | Every Subscription belongs to an Agreement, created and linked during Order processing. | When every Subscription on the Agreement is Terminated or Expired, the Agreement transitions to Terminated. |
| Commerce: Order | Association | Many Subscriptions to many Orders | Subscriptions are created during Purchase or Change Order processing; Change, Configuration, Termination, Suspend, and Resume Orders drive the Subscription's state transitions. | Subscription state is driven by Order state. See Commerce: Order canon Section 7.2. |
| Commerce: Entitlement | Child | One Subscription to many Entitlements | The Subscription's Lines (Entitlements), reachable via `/subscriptions/{id}/lines` and via the Agreement's `/lines` endpoint. | Line terms match Subscription terms; Lines are terminated or expired with the Subscription. |
| Catalog: Product | Association | Many Subscriptions to one Product | The Product this Subscription covers, derived from the Agreement. The Product's cessation and suspend/resume settings gate the Subscription's expiry and suspend/resume behaviour. | Immutable after creation. |
| Catalog: Template | Association | Many Subscriptions to one Template | The Template rendered to the Client when viewing the Subscription. | No lifecycle dependency — Template changes do not affect Subscription status. |
| Accounts: Buyer | Association | Many Subscriptions to one Buyer | The Buyer on the Subscription's Agreement. | Immutable after creation. |
| Accounts: Licensee | Association | Many Subscriptions to one Licensee | The Licensee on the Subscription's Agreement. | Immutable after creation. |
| Accounts: Seller | Association | Many Subscriptions to one Seller | The Seller on the Subscription's Agreement. | Immutable after creation. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Subscription renewed | Daily renewal service; `autoRenew` = true and `commitmentDate` < today | Platform | `commitmentDate` advanced by `terms.commitment`; `renewed` audit event recorded. No status change. |
| `autoRenew` updated | Vendor updates `autoRenew` | Vendor | Persisted immediately; affects the next renewal evaluation. No state transition. |
| Parameters updated | Vendor updates `parameters.fulfillment` | Vendor | Persisted immediately. No state transition. |
| Template updated | Vendor updates `template` | Vendor | Rendered content shown to the Client updates immediately. No state transition. |
| Subscription terminated directly | Vendor calls `/terminate` | Vendor | Subscription → Terminated; `terminationDate` set; `autoRenew` forced false; Lines reduced to quantity 0. If last, parent [[Agreement]] → Terminated. |
| Subscription suspended directly | Vendor calls `/suspend` | Vendor | Subscription → Suspended immediately. Parent [[Agreement]] status unchanged. |
| Subscription resumed directly | Vendor calls `/resume` | Vendor | Subscription → Active immediately; `resumed` audit event recorded. Parent [[Agreement]] status unchanged. |
| Split Billing updated | Client or Operations updates Split Billing via `/split` | Client, Operations | Allocations updated and the parent [[Agreement]]'s split is recomputed. `splitStatus` is not changed by an update — it is set to Active only when the split is first seeded. No state transition on the Subscription. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Every Subscription on the Agreement reaches Terminated or Expired | Commerce: Agreement | Agreement → Terminated | Yes — platform | No Subscription remains that is not Terminated or Expired | Via Termination [[Order]], direct Vendor action, or expiry. |
| Termination Order placed on a Subscription | Commerce: Agreement | Agreement → Updating | Yes — platform, under the placing Actor's token | Termination [[Order]] enters Processing | Agreement remains Updating until the Order completes or fails. |
| Termination Order completed | Commerce: Subscription | Subscription → Terminated | Yes — platform, under Vendor token | Termination [[Order]] → Completed | `terminationDate` set. |
| Termination Order failed | Commerce: Subscription | Subscription → Active (or Suspended) | Yes — platform | Termination [[Order]] → Failed | Reverts to its pre-Order status. |
| Change or Configuration Order completed or failed | Commerce: Subscription | Subscription → Active | Yes — platform | [[Order]] type is Change or Configuration | Returns to Active in both cases. |
| Suspend/Resume Order completed or failed | Commerce: Subscription | Subscription → Suspended/Active, or reverts | Yes — platform, under Operations-driven flow | Suspend/Resume [[Order]] reaches a terminal state | The Operations Order path also moves the [[Agreement]] Active → Updating → Active. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
- Updating → Active is reversible with no limit on cycles — each Change or Configuration [[Order]] returns the Subscription to Active on completion or failure.
- Terminating → Active is reversible if the Termination [[Order]] fails.
- Suspending → Active is reversible if the Suspend [[Order]] fails; Resuming → Suspended if the Resume [[Order]] fails.
- Suspended ↔ Active is fully reversible — a Subscription may be suspended and resumed repeatedly.

Terminated and Expired are permanently terminal. A Subscription cannot be reactivated from either state.

**Deletion:**
There is no delete endpoint on Subscription. Subscriptions cannot be deleted. The only terminal states are Terminated and Expired; both remove the Subscription from the active fulfilment picture, but it remains retrievable via the API — consistent with Platform Invariant 7.

**Audit & history requirements:**
The audit block captures `created`, `updated`, `active`, `terminating`, `updating`, `terminated`, `expired`, and `renewed` timestamps with Actor references; a `resumed` event is recorded on direct resume. Only entries for states the Subscription has reached are present. The audit block is omitted from responses by default — request via `select=+audit`.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| `autoRenew` not set to false before `commitmentDate`, on a Product that permits expiry | The daily service renews the Subscription automatically, advancing `commitmentDate` and generating a billing event. The Client may be charged for an unintended renewal period. | Client, Vendor | High | Only the Vendor can set `autoRenew` directly; the Client must request the change via a Configuration [[Order]]. |
| `autoRenew` = false but the Product's cessation setting does not permit expiry | The Subscription is not auto-expired and remains Active past its `commitmentDate`. | Client, Vendor | Medium | Expiry is gated by the [[Product]]'s cessation setting; `autoRenew` = false alone does not guarantee expiry (BR-006). |
| Termination Order fails — Subscription reverts | The Subscription reverts to its pre-Order status (Active or Suspended) and the [[Agreement]] reverts to Active. A new Termination [[Order]] must be created to retry. | Client, Vendor | Medium | If `commitmentDate` passes while the Order is in Processing, the renewal service may act before the Order completes. |
| Subscription stuck in Updating, Terminating, Suspending, or Resuming | No platform-level timeout. If the driving [[Order]] is abandoned, the Subscription remains in the transient state indefinitely. | Client, Operations | High | Operations should monitor long-running [[Order]]s. See Commerce: Order canon Section 9. |
| Vendor creates a Subscription directly without an Order | Created directly in Active and linked to the [[Agreement]]; no [[Order]]-level audit trail exists for its creation. | Operations, Client | Medium | Used for migration. Operations should ensure direct creations are documented externally. |
| Renewal service races a pending Termination Order | An Active Subscription with a Termination [[Order]] not yet in Processing can still be picked up by the daily renewal. Once the Order moves the Subscription to Terminating it is excluded from renewal. | Client, Vendor | Medium | The renewal service re-checks `commitmentDate` to avoid double-renewal within a run. |
| Direct Vendor suspend/resume while an Operations Suspend/Resume Order is in flight | The direct endpoint jumps straight to Suspended/Active, bypassing the transient state the Order path expects, which can leave the in-flight Order inconsistent with the Subscription's status. | Operations, Vendor | Medium | The two suspend/resume paths are independent; coordinating them is the operator's responsibility (preamble §3.1). |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.4 | 2026-07-17 | Stu / canon-generate | Terminology corrected while refreshing Commerce: Order: fulfilment actions are attributed to "the Vendor" (the Actor), not a "Vendor Extension" — reflecting that Vendor fulfilment is manual-first and does not require an extension. §1 and BR-007 updated. |
| 0.3 | 2026-07-17 | Stu / canon-generate | `splitStatus` corrected while canonising Commerce: Subscription Split Billing: values are `Disabled` and `Active` only — the platform sets `Active` when a split is first seeded and never sets any other value (BR-015, attribute row). The §7 "Split Billing updated" event corrected — a split-allocation update does not change `splitStatus`, and the update is performed by Client or Operations (was "Operations"). BR-015 now points to the Commerce: Subscription Split Billing canon for the full split object. |
| 0.2 | 2026-07-17 | Stu / canon-generate | Full evidence-based refresh via live STAGING OpenAPI schema, a multi-Actor live fetch, and source-code research. Added the Suspend/Resume feature: three states (Suspending/Suspended/Resuming) and their transitions — a Vendor-direct immediate path (`/suspend`→Suspended, `/resume`→Active) and an Operations Suspend/Resume Order path using the transient states — gated by the Product's Suspend/Resume setting and not yet exposed on the public API surface. §3.2 transition mechanisms confirmed and filled (were "Unconfirmed"): direct `terminate`/`suspend`/`resume` endpoints vs plain status writes driven by Order state; direct create via `POST` with the Agreement Active/New/Draft precondition; renewal/expiry via the daily service. Resolved SUB-001 (the `/terminate` body is applied as a Vendor update then terminates immediately — no effective/termination-date field; BR-018) and SUB-002 (`commitmentDate` defaults to `startDate` + `terms.commitment`, Vendor-settable at creation, advanced by `terms.commitment` on renewal; BR-017). Corrected: BR-005 renewal advances `commitmentDate` by `terms.commitment` (was `terms.period`); BR-013 Operations sets `defaultMarkup` only, not `defaultMargin`, and can set `commitmentDate`, only while Active or Suspended; expiry (BR-006) is gated by the parent Agreement being Active and the Product's cessation setting, not `autoRenew` = false alone; `terms.period` enum adds `3y`; `terms.commitment` enum is `1m`/`1y`/`2y`/`3y`/`4y`/`5y` and may be absent. Documented the Agreement-termination condition as all Subscriptions Terminated-or-Expired. Closed SUB-003 — the subscription-side split fields are documented (Client/Operations-only, `splitStatus` Disabled/Active/Review, Vendor-suppressed, own `/split` endpoint); the full Split Billing Subscription object remains tracked separately. Removed the duplicate `---` after §1. |
| 0.1 | 2026-04-13 | Stu | Initial canon. Covers all five Subscription statuses, the OrderSubscription promotion model, the daily renewal and expiry service, Vendor ownership model, parameter write rules, pricing visibility, Split Billing noted as pending. |
