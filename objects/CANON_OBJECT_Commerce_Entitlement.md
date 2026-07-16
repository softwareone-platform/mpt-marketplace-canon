# Object Canon: Entitlement

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-16
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Entitlement

**Namespace:** Commerce

**Parent Object:** Commerce: Agreement

**ID Prefix:** ALI

**Description:**
An Entitlement is a single line within a Commerce: [[Agreement]] recording that a specific Catalog: [[Item]] is entitled at a given quantity under that Agreement. Entitlements are the persisted, current-state line items of the relationship: recurring Items are entitled through a Commerce: [[Subscription]], one-time Items through a Commerce: [[Asset]]. They are read-only over the API — an Entitlement is never created or changed directly, only as a side effect of the [[Order]], [[Subscription]], and [[Asset]] operations that shape the Agreement. The API term is "line"; the UI and internal SoftwareOne term is "Entitlement".

**Also Known As:**
Agreement Line; Line (the API/endpoint term). Distinct from Commerce: Order Line — a separate object representing the in-flight, proposed line change on an Order — which shares the same `ALI` identifier because a line's identity is preserved when an Order completes and its lines are promoted into the Agreement.

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | No | Yes* | No | No | *Read scoped to Entitlements of Agreements where it is the Vendor. Sees purchase-price fields, not selling-price fields (see Section 5). |
| Operations | No | Yes | No | No | Read is platform-wide. Sees all price fields including markup/margin. |
| Client | No | Yes* | No | No | *Read scoped to Entitlements of Agreements belonging to its own Account. Sees selling-price fields, not purchase-price fields (see Section 5). |

No Actor can create, update, or delete an Entitlement — it is a read-only projection of the Agreement's lines. Entitlements come into being and change status only through Commerce: [[Order]], [[Subscription]], and [[Asset]] operations (see Sections 3 and 4).

---

## 3. State Machine

> An Entitlement carries a stored status, but there are no state-transition endpoints — every transition is a side effect of an operation on the parent Order, Subscription, or Asset.

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Active | The Entitlement is live — the Item is currently entitled at its quantity. | Yes | No |
| Terminated | The Entitlement's quantity was set to 0 by an Order, or its parent Subscription or Asset was terminated. Reports quantity 0. | No | Yes |
| Expired | The Entitlement's parent Subscription expired (was not renewed / reached the end of its commitment). Reports quantity 0. | No | Yes |
| Deleted | The Entitlement was superseded — a replacement line for the same Item on the same Subscription tombstoned this one. Remains retrievable via the API. | No | Yes |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Active | Create | (no dedicated endpoint — a completed Order's lines are promoted into the Agreement) | Platform | An Order completes and its lines are copied into the Agreement | The resulting Entitlement preserves the originating Order line's `ALI` id. |
| T2 | Active | Terminated | Terminate | (no dedicated endpoint — Order line quantity set to 0, or parent Subscription/Asset terminated) | Platform | The line's quantity reaches 0, or its parent Subscription/Asset is terminated | Quantity becomes 0. |
| T3 | Active | Expired | Expire | (no dedicated endpoint — parent Subscription expiry) | Platform | The parent Subscription expires | Quantity becomes 0. |
| T4 | Terminated | Deleted | Supersede | (no dedicated endpoint — a replacement line is added for the same Item on the same Subscription) | Platform | A new line supersedes this Terminated line for the same Item and Subscription | The superseded line is tombstoned, not reactivated. |

### 3.3 State Diagram

```
— ---(Order completes, lines promoted : Platform)---> [Active]
[Active] ---(quantity → 0 / Subscription or Asset terminated : Platform)---> [Terminated]
[Active] ---(Subscription expires : Platform)---> [Expired]
[Terminated] ---(superseded by a replacement line : Platform)---> [Deleted]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An Entitlement is a persisted line within exactly one Commerce: [[Agreement]], recording an entitled Catalog: [[Item]] at a quantity. | All | All | The Agreement is the owning aggregate; the same Entitlement is also reachable through its parent [[Subscription]] or [[Asset]] and through the marketplace-wide lines list. |
| BR-002 | Entitlements are read-only over the API — there are no create, update, delete, or state-transition endpoints. They come into being and change status only as a side effect of Commerce: [[Order]], [[Subscription]], and [[Asset]] operations. | All | All | All `/lines` endpoints are read (`GET`) only. |
| BR-003 | An Entitlement is created by promoting a completed Order's line into the Agreement, preserving that line's identity. | — (creation) | Platform | The in-flight Commerce: Order Line and the resulting Entitlement share one `ALI` id. Order Line is a distinct object (not yet canonised). |
| BR-004 | Each Entitlement is tied to exactly one of a Commerce: [[Subscription]] (recurring Items) or a Commerce: [[Asset]] (one-time Items). | All | All | The `order` reference is retained only for one-time (Asset) Entitlements; recurring Entitlements carry no order reference. |
| BR-005 | `quantity` is the current entitled quantity for the line. | All | All | It is 0 for Items where quantity is not applicable, and for Terminated and Expired lines. It is a per-line value, not a sum across the Subscription or Asset. |
| BR-006 | An Entitlement's status is stored but is driven by its parent's lifecycle. | All | Platform | Active on creation; Terminated when the line's quantity is set to 0 by an Order or its [[Subscription]]/[[Asset]] is terminated; Expired when its Subscription expires; Deleted when superseded by a replacement line for the same Item on the same Subscription. See Section 3. |
| BR-007 | Terminated, Expired, and Deleted Entitlements remain returned by the lines endpoints — the platform applies no status filter. | All | All | Consumers filter by `status`. A non-Active Entitlement typically reports quantity 0. |
| BR-008 | `description` and the price `info` block are copied from the Catalog: [[Price List Item]] at line creation. | All | All | `info` carries a `visible` flag and a `description`. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | String | Unique platform identifier. | Platform | No | Format `ALI-XXXX-XXXX-XXXX-NNNN` (rooted on the Agreement id). Shared with the originating Order Line — see BR-003. |
| `status` | Enum | Lifecycle status: `Active`, `Terminated`, `Deleted`, `Expired`. | Platform | Yes — platform-managed | Not directly writable; driven by parent operations — see BR-006. |
| `quantity` | Integer | Current entitled quantity for the line. | Platform | Yes — platform-managed | 0 when quantity is not applicable, or for Terminated/Expired lines — see BR-005. |
| `item` | Object (reference) | The entitled Catalog: Product Item. | Platform | No | Source of billing frequency, commitment term, and quantity applicability. |
| `price` | Object | The line's price. Contains `currency`, `unitSP`/`unitPP`, `SPx1`/`PPx1`, `SPxY`/`SPxM`, `PPxY`/`PPxM`, `markup`, `margin`, `markupSource`, `defaultMarkupSource`. | Platform | Yes — platform-managed | Purchase-price fields (`PP…`, `unitPP`) visible to Vendor and Operations; selling-price fields (`SP…`, `unitSP`) visible to Client and Operations; `markup`, `margin`, `markupSource` visible to Operations only; `currency` visible to all. |
| `order` | Object (reference) | The one-time Order that produced this Entitlement. | Platform | No | Present only for one-time (Asset) Entitlements; absent for recurring (Subscription) Entitlements. See BR-004. |
| `subscription` | Object (reference) | The parent Subscription, for recurring Items. | Platform | No | Present when the Entitlement is recurring; mutually exclusive with `asset`. |
| `asset` | Object (reference) | The parent Asset, for one-time Items. | Platform | No | Present when the Entitlement is one-time; mutually exclusive with `subscription`. |
| `agreement` | Object (reference) | The owning Agreement. | Platform | No | — |
| `client` | Object (reference) | The Client Account. | Platform (from the Agreement) | No | Denormalised from the parent Agreement. |
| `vendor` | Object (reference) | The Vendor Account. | Platform (from the Agreement) | No | Denormalised from the parent Agreement. |
| `buyer` | Object (reference) | The Buyer. | Platform (from the Agreement) | No | Denormalised from the parent Agreement. |
| `seller` | Object (reference) | The Seller. | Platform (from the Agreement) | No | Denormalised from the parent Agreement. |
| `product` | Object (reference) | The Product. | Platform (from the Agreement) | No | Denormalised from the parent Agreement. |
| `description` | String | Line description. | Platform (from the Price List Item) | No | Copied from the Price List Item — see BR-008. Absent from response when null. |
| `info` | Object | Price info: `visible` (boolean), `description` (string). | Platform (from the Price List Item) | No | Copied from the Price List Item. |
| `audit` | Object | Audit block. Sub-keys: `created`, `updated`, `terminated`, `deleted`. | Platform | No | There is no `expired` sub-key — expiry is not separately timestamped in the audit block. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Commerce: Agreement | Parent | One Agreement to many Entitlements | The owning aggregate; every Entitlement belongs to exactly one Agreement. | Cannot exist without the Agreement. |
| Commerce: Subscription | Parent | One Subscription to many Entitlements | Recurring Entitlements belong to a Subscription; the same line row is navigated from the Subscription. | A Subscription's termination or expiry transitions its Entitlements to Terminated/Expired. |
| Commerce: Asset | Parent | One Asset to many Entitlements | One-time Entitlements belong to an Asset; the same line row is navigated from the Asset. | An Asset's termination transitions its Entitlements to Terminated. |
| Commerce: Order | Association | Many Entitlements to one Order | Entitlements are created by promoting a completed Order's lines. One-time Entitlements retain the originating Order reference. | Created on Order completion; no ongoing dependency. |
| Commerce: Order Line | Association | One Entitlement to one Order Line (shared id) | The in-flight, proposed line change on an Order, which becomes this Entitlement on Order completion — sharing the `ALI` id. Order Line is a separate, not-yet-canonised object. | Identity-preserving promotion; no ongoing dependency. |
| Catalog: Item | Association | Many Entitlements to one Item | The entitled Product Item. | Immutable after creation. |
| Catalog: Price List Item | Association | Many Entitlements to one Price List Item | Source of the Entitlement's `description` and price `info`. | Copied at creation; no ongoing dependency. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Entitlement created | A completed Commerce: [[Order]]'s lines are promoted into the Agreement | Platform | A new Entitlement is persisted in Active status, preserving the originating Order line's `ALI` id. Recorded in the audit `created` event. |
| Entitlement terminated | The line's quantity is set to 0 by an [[Order]], or its parent [[Subscription]]/[[Asset]] is terminated | Platform | Status → Terminated, quantity → 0. Recorded in the audit `terminated` event. |
| Entitlement expired | The parent [[Subscription]] expires | Platform | Status → Expired, quantity → 0. |
| Entitlement superseded | A replacement line is added for the same [[Item]] on the same [[Subscription]] | Platform | The prior Terminated line's status → Deleted. Recorded in the audit `deleted` event. |

### 7.2 Cross-Object State Effects

> An Entitlement is a read projection; its own status changes are effects *of* parent Order/Subscription/Asset operations rather than triggers of effects on other objects.

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| — | — | Entitlements do not themselves trigger state changes on other objects. | — | — | See Commerce: [[Subscription]] and [[Asset]] canon for the parent-side lifecycle that drives Entitlement status. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
None. An Entitlement does not return to Active once Terminated, Expired, or Deleted. Re-ordering the same Item produces a new Entitlement rather than reactivating a prior line.

**Deletion:**
There is no delete endpoint. `Deleted` is a superseded-tombstone status applied when a replacement line takes over for the same [[Item]] on the same [[Subscription]] — the record is retained and remains retrievable via the lines endpoints. There is no hard delete.

**Audit & history requirements:**
The audit block records `created`, `updated`, `terminated`, and `deleted` events. There is no `expired` audit sub-key — expiry is not separately timestamped. Prior quantity or price values are not retained beyond the audit trail.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| A consumer lists lines expecting only live entitlements | Terminated, Expired, and Deleted Entitlements are returned alongside Active ones — the platform applies no status filter. | Vendor, Operations, Client | Medium | Consumers must filter by `status` (BR-007). |
| An Entitlement shows `status: Active` but `quantity: 0` | Treated as not-active in Subscription roll-ups — an Active line counts as live only when its quantity is greater than 0. | Vendor, Client | Low | A zero-quantity line is normal for a non-applicable-quantity Item. |
| An Entitlement references a Terminated or Expired [[Subscription]] or [[Asset]] | The line and its parent are separate records updated by the same operation; a brief or edge-case mismatch is possible. | Operations | Low | Status consistency is maintained by the driving operation, not enforced on the line itself. |
| Re-ordering an Item that had a Terminated Entitlement | A new Entitlement is created and the prior Terminated line is tombstoned to Deleted — it is not reactivated. | Client, Vendor | Low | See BR-006 and Section 3 (T4). |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-16 | Stu / canon-generate | Initial canon. Generated via live OpenAPI schema (STAGING), a multi-Actor live fetch of an Agreement's lines, and source-code research. Object Name set to "Entitlement" (API term "line"; schema `AgreementLine`). Documents the read-only, no-endpoints nature (created and transitioned only as a side effect of Order/Subscription/Asset operations); the persisted-entity model shared across the Agreement, Subscription, Asset, and marketplace-wide lines views; the `ALI` id shared with the in-flight Order Line via identity-preserving promotion; the Active/Terminated/Expired/Deleted status model and its parent-driven transitions; the one-of-{Subscription, Asset} tie and the one-time-only `order` reference; per-Actor price-field visibility; and the no-status-filter listing behaviour. 0 open questions. |
