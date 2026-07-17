# Object Canon: Order Subscription

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-17
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Order Subscription

**Namespace:** Commerce

**Parent Object:** Commerce: Order

**ID Prefix:** SUB (shared with Commerce: Subscription)

**Description:**
An Order Subscription is the Order-scoped, in-flight representation of a Commerce [[Subscription]] that a Commerce [[Order]] is creating or changing. It is the working draft the Vendor edits while an [[Order]] is being processed — carrying the name, parameters, terms, pricing, template, and auto-renewal setting that the resulting live [[Subscription]] will have. For a Purchase [[Order]] it is a net-new record assembled during processing and promoted to a new live [[Subscription]] (retaining the same SUB identifier) when the [[Order]] completes; for a Change, Configuration, or Termination [[Order]] it is materialised from the existing live [[Subscription]], edited in place, and merged back into that same [[Subscription]] on completion. It is distinct from the live [[Subscription]] (the agreement-scoped, recurring fulfilment record): an Order Subscription exists only in the context of one [[Order]] and reflects the change that [[Order]] is making. See Commerce: [[Subscription]] canon for the promotion relationship and the live record's own lifecycle.

**Also Known As:**
OrderSubscription (API schema name). Informally "the subscription on the order" or "the draft subscription."

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes | Yes | Yes | Yes | Creates net-new Order Subscriptions during [[Order]] processing (not on a Draft [[Order]]) and edits them: `name`, `autoRenew`, `template`, `startDate`, `commitmentDate`/`terms.commitment`, `parameters.fulfillment`, `externalIds.vendor`, and line assignment. May delete only while the Order Subscription is in Draft status. Scoped to [[Order]]s on [[Agreement]]s where they are the Vendor (BR-011). |
| Operations | No | Yes | Yes | No | Cannot create or delete. May update only `commitmentDate` and `externalIds.operations`. Read is not self-scoped — Operations sees all Order Subscriptions. |
| Client | No | Yes | Yes | Yes | Cannot create. May update only `externalIds.client`. May delete only while the Order Subscription is in Draft status, on an [[Order]] belonging to their own [[Account]]. Scoped to [[Order]]s on [[Agreement]]s belonging to their own [[Account]] (BR-011). |

---

## 3. State Machine

> An Order Subscription's status tracks the change its parent [[Order]] is making. A net-new Order Subscription begins in Draft; an Order Subscription materialised from an existing live [[Subscription]] inherits that [[Subscription]]'s current status. All status changes other than Create and Delete are driven by the parent [[Order]]'s own state transitions — there is no endpoint that writes an Order Subscription's status directly.

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Draft | A net-new Order Subscription being assembled during [[Order]] processing, before the [[Order]] completes. Editable and deletable by the Vendor (or owning Client). Not yet promoted to a live [[Subscription]]. | Yes | No |
| Active | The Order Subscription mirrors a live [[Subscription]] that is Active — either an existing one referenced by a Change/Configuration/Termination [[Order]], or a net-new one immediately after the [[Order]] completes and promotes it. | No | No |
| Updating | The Order Subscription mirrors a live [[Subscription]] whose Change or Configuration [[Order]] is being processed. | No | No |
| Terminating | The Order Subscription mirrors a live [[Subscription]] whose Termination [[Order]] is being processed. | No | No |
| Terminated | The Order Subscription mirrors a live [[Subscription]] that has been terminated. Terminal — no outbound transitions. | No | Yes |
| Deleted | A Draft Order Subscription that was deleted. Permanently removed — no longer retrievable via the API. Terminal — no outbound transitions. | No | Yes |

> **Note on mirrored statuses:** An Order Subscription mirrors the status of the [[Subscription]] it references. In addition to `Draft`, `Active`, `Updating`, `Terminating`, `Terminated`, and `Deleted`, it can therefore reflect `Suspending`, `Suspended`, `Resuming`, and `Expired` when the referenced [[Subscription]] is in one of those states (see Commerce: [[Subscription]] for the suspend/resume and expiry lifecycle).

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Draft | Vendor creates a net-new Order Subscription | `POST` (base collection endpoint) | Vendor | Parent [[Order]] is past Draft (in processing); at least one order line supplied, each with matching billing model, billing frequency, and commitment term | Net-new subscription assembly during a Purchase or Change [[Order]]. |
| T2 | — | Active | Materialised from the referenced live [[Subscription]] | No dedicated endpoint — created on first edit/reference during [[Order]] processing | Vendor | Parent [[Order]] references an existing [[Subscription]] | Inherits the live [[Subscription]]'s status, terms, parameters, and external IDs — so the initial state is whatever the referenced [[Subscription]] currently is (Active shown as the common case). |
| T3 | Draft | Deleted | Delete a draft Order Subscription | `DELETE` (`/{id}`) | Vendor, owning Client | Order Subscription status is Draft | Permanently removed — no longer retrievable via the API. Assigned order lines are unassigned first. |
| T4 | Draft | Active | Net-new Order Subscription promoted on [[Order]] completion | No dedicated endpoint — driven by [[Order]] completion | Platform | Purchase or Change [[Order]] transitions to Completed | A live [[Subscription]] is created with the same SUB identifier, in Active. Under the completing Actor's token context. |
| T5 | Active | Updating | Change or Configuration [[Order]] enters processing | No dedicated endpoint — driven by [[Order]] state | Platform | Change or Configuration [[Order]] enters Processing | Mirrors the live [[Subscription]] → Updating. |
| T6 | Updating | Active | Change or Configuration [[Order]] completes or fails | No dedicated endpoint — driven by [[Order]] state | Platform | [[Order]] transitions to Completed or Failed | On completion the edits are merged into the live [[Subscription]] (same ID). |
| T7 | Active | Terminating | Termination [[Order]] enters processing | No dedicated endpoint — driven by [[Order]] state | Platform | Termination [[Order]] enters Processing | Mirrors the live [[Subscription]] → Terminating. |
| T8 | Terminating | Terminated | Termination [[Order]] completes | No dedicated endpoint — driven by [[Order]] completion | Platform | Termination [[Order]] transitions to Completed | `terminationDate` set; `autoRenew` forced false. Merged into the live [[Subscription]] (same ID). |
| T9 | Terminating | Active | Termination [[Order]] fails | No dedicated endpoint — driven by [[Order]] state | Platform | Termination [[Order]] transitions to Failed | Reverts to the pre-[[Order]] status. |
| T10 | Draft | Terminating | Net-new subscription carried into a termination during the same processing cycle | No dedicated endpoint — driven by [[Order]] state | Platform | Termination signature applies to a still-Draft Order Subscription | Domain-permitted edge; may proceed to Terminated in the same cycle. Not observed in a live sample. |

> **Guidance:** Suspending/Suspended/Resuming transitions mirror the live [[Subscription]]'s Operations-driven suspend/resume flow (see the Section 3.1 note). They are not enumerated as separate rows here.

### 3.3 State Diagram

```
— ---(Vendor creates net-new : Vendor)---> [Draft]
— ---(Materialised from existing Subscription : Vendor/Platform)---> [Active] (or live sub's current status)
[Draft] ---(Delete : Vendor/owning Client)---> [Deleted]
[Draft] ---(Order completed, promoted : Platform)---> [Active]
[Active] ---(Change/Configuration Order processing : Platform)---> [Updating]
[Updating] ---(Order completed or failed : Platform)---> [Active]
[Active] ---(Termination Order processing : Platform)---> [Terminating]
[Terminating] ---(Termination Order completed : Platform)---> [Terminated]
[Terminating] ---(Termination Order failed : Platform)---> [Active]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An Order Subscription belongs to exactly one [[Order]] and is scoped to that [[Order]] for its whole existence. It shares the SUB identifier of the live [[Subscription]] it creates or changes. | All | All | Reachable only via the parent [[Order]] at `/orders/{orderId}/subscriptions`. |
| BR-002 | Only the Vendor can create an Order Subscription, and only on an [[Order]] that is past Draft (in processing). Creation requires at least one order line, and every assigned line must share the Order Subscription's billing model, billing frequency, and commitment term. | Draft (creation) | Vendor | One-time-purchase lines cannot be assigned to an Order Subscription. A line already assigned to another subscription cannot be reassigned. |
| BR-003 | A net-new Order Subscription is promoted to a live [[Subscription]] when its [[Order]] completes, retaining the same SUB identifier; the live [[Subscription]] is created directly in Active. For an [[Order]] referencing an existing [[Subscription]], the Order Subscription's edits are merged back into that [[Subscription]] on completion. | Draft, Active, Updating, Terminating | Platform | An Order Subscription left with no assigned lines at completion is discarded and not promoted. See Commerce: [[Subscription]] canon. |
| BR-004 | An Order Subscription may be deleted only while in Draft status, by the Vendor or the owning Client. Operations cannot delete an Order Subscription. | Draft | Vendor, Client | Once past Draft the Order Subscription cannot be deleted — its lifecycle is thereafter driven by the [[Order]]. Deletion is permanent — no longer retrievable via the API. |
| BR-005 | The Vendor may update `name`, `autoRenew`, `template`, `startDate`, `commitmentDate`/`terms.commitment`, `parameters.fulfillment`, `externalIds.vendor`, and line assignment on an Order Subscription during [[Order]] processing. | Draft, Active, Updating, Terminating | Vendor | The `template` reference can be set only while Draft, Updating, or Terminating. Existing lines already on the live [[Subscription]] cannot be detached via an Order Subscription update. |
| BR-006 | Operations may update only `commitmentDate` and `externalIds.operations` on an Order Subscription. The Client may update only `externalIds.client`. | All (non-terminal) | Operations, Client | These are the sole direct write capabilities for each of these Actors. |
| BR-007 | `commitmentDate`, when supplied on create or update, must be in the future or within the past year; otherwise it is rejected. If not supplied, it is computed from `startDate` + `terms.commitment` when the [[Order]] completes. | Draft, Active, Updating, Terminating | Vendor, Operations | `startDate` and `commitmentDate` default to a computed value at completion when left unset during processing. |
| BR-008 | The `terms` object (`model`, `period`, `commitment`) is derived from the assigned order lines and all lines under an Order Subscription must share it. `terms` is not independently editable. | All | All | Valid values — `model`: `one-time`, `usage`, `quantity`; `period`: `1m`, `1y`, `3y`, `one-time`; `commitment`: `1m`, `1y`, `2y`, `3y`, `4y`, `5y` (may be absent). |
| BR-009 | Order Subscription pricing is aggregated from its assigned order lines and is recomputed by the platform when lines or parameters change; no Actor sets `price` directly. | All | All | Price field visibility per Actor is described in BR-010. |
| BR-010 | Order Subscription pricing field visibility is Actor-scoped: `PPxY`/`PPxM` are visible to Vendor and Operations; `SPxY`/`SPxM` to Client and Operations; `markup`, `margin`, `defaultMarkup`, `defaultMargin`, `defaultMarkupSource`, and `markupSource` to Operations only; `currency` to all Actors. | All | All | Mirrors the pricing-visibility model on [[Order]]s, [[Agreement]]s, and [[Subscription]]s. Suppressed fields are invisible to the Actor entirely (preamble §6.3). |
| BR-011 | Order Subscription visibility is self-scoped per Actor: the Vendor sees only those on [[Order]]s where they are the Vendor; the Client only those on [[Order]]s belonging to their own [[Account]]; Operations sees all. | All | All | — |
| BR-012 | An Order Subscription's `status` cannot be set through a plain field write. It is set at creation (Draft), on delete (Deleted), and thereafter driven entirely by the parent [[Order]]'s state transitions. | All | All | The Order Subscription has no dedicated terminate/suspend/resume endpoints of its own — those act on the live [[Subscription]]. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | String | Unique platform identifier, shared with the live Subscription it creates or changes. | Platform | No | Format: `SUB-XXXX-XXXX-XXXX`. |
| `revision` | Integer | Increments on each update. | Platform | Yes — platform-managed | — |
| `name` | String | Human-readable name. | Vendor | Yes — Vendor | Required and non-empty at creation. Typically derived from the Item name. |
| `status` | Enum | Current status. | Platform | Yes — platform-managed | Values: `Draft`, `Active`, `Deleted`, `Updating`, `Terminating`, `Terminated`, and — mirroring the referenced Subscription — `Suspending`, `Suspended`, `Resuming`, `Expired`. Not directly writable (see BR-012). See the Section 3.1 note. |
| `autoRenew` | Boolean | Whether the resulting live Subscription auto-renews at `commitmentDate`. | Vendor | Yes — Vendor | Forced to false when the Order Subscription reaches Terminated. |
| `startDate` | DateTime | The date the resulting Subscription becomes active. | Vendor | Yes — Vendor | Computed at Order completion if left unset during processing. Absent from response when null. |
| `commitmentDate` | DateTime | The date by which the resulting Subscription must be renewed or it expires. | Vendor / Operations | Yes | Must be in the future or within the past year when supplied (BR-007). Defaults to `startDate` + `terms.commitment` at completion. |
| `terminationDate` | DateTime | The date the resulting Subscription was terminated. | Platform | No | Set when the Order Subscription reaches Terminated. Absent from response when null. |
| `terms` | Object | Billing terms: `model`, `period`, `commitment`. | Platform (from assigned lines) | No | Derived from lines; enum values listed in BR-008. `commitment` may be absent. |
| `price` | Object | Aggregate pricing: `SPxY`, `SPxM`, `PPxY`, `PPxM`, `currency`, `markup`, `margin`, `defaultMarkup`, `defaultMargin`, `defaultMarkupSource`, `markupSource`. | Platform (computed) | Yes — platform-managed | Field-level visibility per Actor described in BR-010. Aggregated from assigned lines. |
| `parameters.fulfillment` | Array | Subscription-scoped fulfilment parameters carried by the Order Subscription. | Vendor | Yes — Vendor | Hidden parameters are suppressed from Client responses. Only fulfilment-phase parameters are present. |
| `template` | Object | Reference to the Catalog Template rendered for the Client (via the `/render` endpoint). | Vendor | Yes — Vendor | Absent from response when null. See BR-005. |
| `lines` | Array | The order lines assigned to this Order Subscription. | Vendor | Yes — Vendor | Reflected as the resulting Subscription's Lines on completion. Existing lines cannot be detached (BR-005). |
| `product` | Object | Reference to the Catalog Product, derived from the Agreement. | Platform | No | — |
| `agreement` | Object | Reference to the parent Commerce Agreement. | Platform | No | Omitted by default from list responses. |
| `externalIds.vendor` | String | The Vendor's own reference. | Vendor | Yes — Vendor | Optional. Absent when null. |
| `externalIds.operations` | String | Operations' own reference. | Operations | Yes — Operations | Optional. Absent when null. |
| `externalIds.client` | String | The Client's own reference. | Client | Yes — Client | Optional. Absent when null. |
| `audit` | Object | Lifecycle event timestamps and Actors: `created`, `updated`, `active`, `terminated`, `terminating`, `updating`. | Platform | No | Omitted by default — request via `select=+audit`. Only entries for states reached are present; Draft and Deleted are not audited. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Commerce: Order | Parent | Many Order Subscriptions to one Order | Every Order Subscription belongs to exactly one Order and is scoped to it. | The Order Subscription exists only for the Order's lifecycle; its status is driven by the Order's state. |
| Commerce: Subscription | Association | One Order Subscription to one Subscription | The live, agreement-scoped record the Order Subscription creates (on a Purchase/Change Order) or changes (on a Change/Configuration/Termination Order), sharing the SUB identifier. | On Order completion a net-new Order Subscription is promoted to a new Subscription; an existing Subscription is updated from the Order Subscription's edits. |
| Commerce: Entitlement | Child | One Order Subscription to many Entitlements | The order lines (Entitlements) assigned to this Order Subscription; each promoted line becomes an Agreement Line under the resulting Subscription. | Line terms must match the Order Subscription's terms. An Order Subscription with no assigned lines at completion is discarded. |
| Commerce: Agreement | Association | Many Order Subscriptions to one Agreement | The Agreement the parent Order belongs to; the resulting Subscription is linked to it on completion. | Immutable reference during processing. |
| Catalog: Product | Association | Many Order Subscriptions to one Product | The Product the resulting Subscription covers, derived from the Agreement. | Immutable after creation. |
| Catalog: Template | Association | Many Order Subscriptions to one Template | The Template rendered to the Client when viewing the Order Subscription. | No lifecycle dependency — Template changes do not affect the Order Subscription's status. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Order Subscription created | Vendor creates a net-new Order Subscription on an [[Order]] in processing | Vendor | Created in Draft; assigned order lines are attached and `price` is aggregated from them. |
| Order Subscription updated | Vendor edits fields; Operations edits `commitmentDate`/`externalIds.operations`; Client edits `externalIds.client` | Vendor, Operations, Client | Persisted immediately; `price` is recomputed if lines or parameters change. No status change. |
| Line assignment changed | Vendor assigns or removes order lines | Vendor | `price` is re-aggregated. Existing live-[[Subscription]] lines cannot be detached. An Order Subscription reduced to zero lines is removed from the [[Order]]. |
| Order Subscription deleted | Vendor or owning Client deletes a Draft Order Subscription | Vendor, Client | Assigned lines are unassigned, then the Order Subscription is permanently removed — no longer retrievable via the API. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Purchase or Change [[Order]] completed | Commerce: Subscription | A new live Subscription is created with the same SUB identifier, in Active | Yes — platform, under the completing Actor's token | Order Subscription is net-new (no pre-existing Subscription) and has at least one assigned line | See Commerce: [[Subscription]] canon. |
| Change, Configuration, or Termination [[Order]] completed | Commerce: Subscription | The existing Subscription is updated from the Order Subscription's edits (name, terms, dates, parameters, price, template, autoRenew) | Yes — platform, under the completing Actor's token | Order Subscription references an existing Subscription | Termination completion sets the Subscription's `terminationDate` and forces `autoRenew` false. |
| [[Order]] enters Processing | Commerce: Subscription | The referenced Subscription transitions to Updating/Terminating; the Order Subscription mirrors that status | Yes — platform | Order references an existing Subscription | See Commerce: [[Order]] and Commerce: [[Subscription]] canon Section 7.2. |
| Order Subscription reduced to zero lines at completion | Commerce: Subscription | No Subscription is created/updated for it | Yes — platform | Order Subscription has no assigned lines | The Order Subscription is discarded. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
- Draft → Active (promotion) is one-way; the promoted live [[Subscription]] then follows its own lifecycle.
- Updating → Active is reversible with no limit on cycles — each Change or Configuration [[Order]] returns the mirrored status to Active on completion or failure.
- Terminating → Active is reversible if the Termination [[Order]] fails.
- Deleted and Terminated are permanently terminal.

**Deletion:**
An Order Subscription may be deleted by the Vendor or the owning Client only while it is in Draft status. Once deleted, it is permanently removed — no longer retrievable via the API. Operations cannot delete an Order Subscription. Once an Order Subscription is past Draft it cannot be deleted; it is instead resolved (promoted, merged, or discarded) when its parent [[Order]] completes, fails, or is itself deleted. Deleting an Order Subscription does not remove any other object — its assigned order lines are unassigned first, not removed.

**Audit & history requirements:**
The audit block captures `created`, `updated`, `active`, `updating`, `terminating`, and `terminated` timestamps with Actor references; only entries for states the Order Subscription has reached are present. Draft and Deleted are not recorded as audited status events. The audit block is omitted from responses by default — request via `select=+audit`. Audit history of the resulting live [[Subscription]] is documented in Commerce: [[Subscription]] canon.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Vendor leaves an Order Subscription with no assigned lines at [[Order]] completion | The Order Subscription is silently discarded and no live [[Subscription]] is created or updated for it. | Vendor, Client | Medium | Intended item is not fulfilled; no error is raised at completion. |
| Vendor attempts to detach a line already on the live [[Subscription]] via an Order Subscription update | The platform rejects the update — existing lines cannot be detached through an Order Subscription. | Vendor | Low | Line removals on an existing [[Subscription]] must go through a Termination [[Order]]. |
| Owning Client deletes a Draft Order Subscription the Vendor is mid-way through assembling | The Draft Order Subscription is permanently removed and its lines unassigned, discarding the Vendor's in-progress work for that subscription. | Vendor | Medium | Both Vendor and owning Client may delete Draft Order Subscriptions; coordinating the [[Order]] is the operators' responsibility. |
| `commitmentDate` supplied more than a year in the past | The platform rejects the create/update. | Vendor, Operations | Low | `commitmentDate` must be in the future or within the past year (BR-007). |
| Order Subscription left in Draft because its parent [[Order]] is abandoned | The Order Subscription is never promoted and remains a Draft on the abandoned [[Order]] indefinitely; no live [[Subscription]] results. | Client, Operations | Medium | Tied to [[Order]] abandonment — see Commerce: [[Order]] canon Section 9. |
| One-time-purchase line assigned to an Order Subscription | The platform rejects the assignment. | Vendor | Low | One-time-purchase lines belong on [[Order Asset]]s, not Order Subscriptions. |

---

## 10. Open Questions

- [ ] **SUB-004:** Whether an Operations-created Suspend or Resume [[Order]] produces an Order Subscription record (and how it presents) is unconfirmed — the captured evidence covers Purchase and Change Orders only, not a Suspend/Resume Order.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-17 | Stu / canon-generate | Initial canon. Documents the Order-scoped, in-flight Subscription representation: Draft/Active/Updating/Terminating/Terminated/Deleted statuses; Vendor-only creation on a processing Order with matching-terms lines; the promotion-on-completion model (net-new promoted to a new live Subscription with the same SUB id; existing Subscription merged from edits); Actor write scoping (Vendor broad, Operations `commitmentDate`/`externalIds.operations`, Client `externalIds.client`); Draft-only deletion by Vendor or owning Client (not Operations); pricing-field Actor visibility; and self-scoped read visibility. Documents the mirrored suspend/resume/expiry statuses (Suspending/Suspended/Resuming/Expired) as real. SUB-004 parked on whether an Operations Suspend/Resume Order produces an Order Subscription record (no live sample). |
</content>
</invoke>
