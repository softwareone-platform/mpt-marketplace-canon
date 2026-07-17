# Object Canon: Order Line

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-17
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Order Line

**Namespace:** Commerce

**Parent Object:** Commerce: Order

**ID Prefix:** ALI

**Description:**
An Order Line is a single in-flight line within a Commerce: [[Order]] — one line per Catalog: [[Item]] at a requested quantity, and the unit of work the Order acts on. Each line records a proposed change to what a Client is entitled to: the move from a prior quantity (`oldQuantity`) to a requested quantity (`quantity`). Order Lines are authored through the Order — the Client shapes them while building the Order and the Vendor maps them to a Commerce: [[Subscription]] (recurring Items) or a one-time Asset (one-time Items) during fulfilment. When the Order completes, each line is promoted into the Commerce: [[Agreement]] as a Commerce: [[Entitlement]], preserving its identity: the Order Line and the resulting Entitlement share the same `ALI` id. The API term for both is "line".

**Also Known As:**
Order line item; Line (the API/endpoint term). Distinct from Commerce: [[Entitlement]] — the persisted, Agreement-scoped line — even though the two share the same `ALI` identifier, because a line's identity is preserved when an Order completes and its lines are promoted into the Agreement.

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | No* | Yes* | No* | No | *No dedicated line endpoint. Line content is authored through the parent Order: the Vendor edits lines and maps them to a Subscription or Asset while the Order is Processing. Read scoped to Orders where it is the Vendor. Sees purchase-price fields, not selling-price fields (see Section 5). |
| Operations | No* | Yes | No* | No | *No dedicated line endpoint. Operations authors line content through the parent Order. Read is platform-wide. Sees all price fields including markup/margin. |
| Client | No* | Yes* | No* | No | *No dedicated line endpoint. The Client authors lines through the parent Order while it is Draft. Read scoped to Orders belonging to its own Account. Sees selling-price fields, not purchase-price fields (see Section 5). |

No Actor creates, updates, or deletes an Order Line through a dedicated line endpoint — the only line endpoint is a read (`GET`). Lines come into being, change, and are removed only as part of authoring the parent Order (see Sections 3 and 4).

---

## 3. State Machine

This object has no state machine. An Order Line carries no `status` field of its own; it is created and modified as a unit within the parent Commerce: [[Order]], and its lifecycle is governed entirely by that Order. It is authored while the Order is Draft (by the Client) or Processing (by the Vendor), mapped to a [[Subscription]] or Commerce: [[Asset]] during fulfilment, and on Order completion promoted into the [[Agreement]] as a Commerce: [[Entitlement]] — from which point it takes on that Entitlement's stored status (see Commerce: [[Entitlement]] Section 3). The authoring, mapping, and promotion mechanics are documented in Section 4 (Business Rules) and Section 7 (Lifecycle Events), not as line-level state transitions.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An Order Line belongs to exactly one Commerce: [[Order]] and references exactly one Catalog: [[Item]] at a requested quantity. It is the unit of work the Order acts on. | All | All | One line per Item at one quantity. A single Order carries one or more lines. |
| BR-002 | Order Lines have no dedicated create, update, or delete endpoint — the only line endpoint is a read. Lines are authored, changed, and removed only by editing the parent Commerce: [[Order]]. | All | All | The `orders/{orderId}/lines` endpoint is read (`GET`) only. |
| BR-003 | An Order Line records a requested change as the pair `oldQuantity` → `quantity`; the difference is the change the line applies. | All | All | Signatures by Order type: Purchase 0 → N (new line); Change M → N (quantity change); Configuration N → N (no delta — the change is to parameters, not quantity); Termination N → 0. |
| BR-004 | Each Order Line maps to exactly one of a Commerce: [[Subscription]] (recurring Items) or a one-time Asset (one-time Items), determined by the billing model of the referenced Catalog: [[Item]]. | All | All | One-time is signalled by one-time (`x1`) price fields on the line; recurring by per-year/per-month (`xY`/`xM`) fields. Commerce: [[Order Asset]] and Commerce: [[Order Subscription]] are the in-flight parents; on completion they become the Agreement's Asset and Subscription. |
| BR-005 | A line changing an existing Subscription or Asset carries that reference from authoring; a net-new line is mapped during Processing, and a one-time line without an Asset has one generated when the Order completes. | Draft, Quoted, Processing | Client, Vendor | In Quoted and early Draft a net-new line's Subscription/Asset reference is absent until fulfilment maps it. |
| BR-006 | When an Order completes, each line is promoted into the Commerce: [[Agreement]] as a Commerce: [[Entitlement]], preserving the line's identity. | Processing → Completed | Vendor | The in-flight Order Line and the resulting Entitlement share one `ALI` id. This is why the `ALI` prefix is registered to the Entitlement and reused by the Order Line (preamble §5.3). |
| BR-007 | On authoring, a line with no id is created new; a line whose id matches an existing Agreement line brings that Commerce: [[Entitlement]] into the Order for change; a line id matching neither the Order nor the Agreement is rejected. | Draft, Quoted, Processing | Client, Vendor | The three cases are: create (no id), change an existing Entitlement (id in the Agreement), and update a line already on the Order (id already on the Order). |
| BR-008 | An Order cannot be completed if the change would leave every applicable line at quantity 0 — at least one line in the affected Commerce: [[Agreement]] or Commerce: [[Subscription]] must remain at quantity 1 or higher, unless the Order is terminating it. | Processing → Completed | Vendor | Prevents a Change Order from silently zeroing out an entire Agreement/Subscription; genuine reduction to zero is done through a Termination Order. |
| BR-009 | An Order Line quantity is never negative — a requested quantity below 0 is clamped to 0. | All | All | A quantity of 0 on a line with applicable quantity is the termination signature (see BR-003). |
| BR-010 | Order Line price fields are visible per Actor: purchase-price fields to Vendor and Operations, selling-price fields to Client and Operations, and markup/margin to Operations only. | All | All | Purchase: `unitPP`, `PPx1`, `PPxY`, `PPxM`. Selling: `unitSP`, `SPx1`, `SPxY`, `SPxM`. `markup`, `margin`, `markupSource`, `defaultMarkupSource`: Operations only. `currency`: all Actors. Consistent with preamble §6.3. |
| BR-011 | An Order Line's `description` and price `info` block are copied from the Catalog: [[Price List Item]] at line creation. | All | All | `info` carries a `visible` flag and a `description`. |
| BR-012 | A Configuration Order carries a line for the Subscription it configures, with `oldQuantity` equal to `quantity` (no quantity delta) — the change is to Subscription parameters, not quantity. | All | Client, Vendor | The line references the configured Commerce: [[Subscription]]. Configuration does not create or terminate a Subscription. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | String | Unique platform identifier for the line. | Platform | No | Format `ALI-XXXX-XXXX-XXXX-NNNN` (rooted on the Agreement id). Shared with the Entitlement the line becomes — see BR-006. A net-new line has no id until first persisted. |
| `oldQuantity` | Integer | The line's quantity before this Order's change. | Platform | Yes — while the Order is editable | 0 for a net-new line; the current entitled quantity for a change to an existing line — see BR-003. |
| `quantity` | Integer | The requested quantity after this Order's change. | Client (Draft), Vendor (Processing) | Yes — while the Order is editable | Clamped to a minimum of 0 — see BR-009. 0 is the termination signature. |
| `price` | Object | The line's price. Contains `currency`, `unitSP`/`unitPP`, `SPx1`/`PPx1`, `SPxY`/`SPxM`, `PPxY`/`PPxM`, `markup`, `margin`, `markupSource`, `defaultMarkupSource`. | Platform | Yes — while the Order is editable | One-time lines populate `x1` fields; recurring lines populate `xY`/`xM` fields. Per-Actor visibility — see BR-010. |
| `item` | Object (reference) | The referenced Product Item. | Client | No | Source of the line's billing model/frequency, which determines Subscription vs Asset mapping — see BR-004. |
| `subscription` | Object (reference) | The mapped Subscription, for recurring Items. | Platform / Vendor | Yes — until mapped | Present when the line is recurring and mapped; absent for one-time lines and for net-new lines not yet mapped — see BR-005. |
| `asset` | Object (reference) | The mapped Asset, for one-time Items. | Platform / Vendor | Yes — until mapped | Present when the line is one-time and mapped; a one-time Asset is generated at completion if absent — see BR-005. |
| `agreement` | Object (reference) | The Agreement the Order acts on. | Platform | No | The Agreement into which the line is promoted on completion. |
| `order` | Object (reference) | The parent Order. | Platform | No | Every Order Line belongs to exactly one Order. |
| `client` | Object (reference) | The Client Account. | Platform | No | Denormalised from the Order/Agreement. |
| `vendor` | Object (reference) | The Vendor Account. | Platform | No | Denormalised from the Order/Agreement. |
| `buyer` | Object (reference) | The Buyer. | Platform | No | Denormalised from the Order/Agreement. |
| `seller` | Object (reference) | The Seller. | Platform | No | Denormalised from the Order/Agreement. |
| `product` | Object (reference) | The Product. | Platform | No | Denormalised from the Order/Agreement. |
| `description` | String | Line description. | Platform (from the Price List Item) | No | Copied from the Price List Item — see BR-011. Absent from response when null. |
| `info` | Object | Price info: `visible` (boolean), `description` (string). | Platform (from the Price List Item) | No | Copied from the Price List Item — see BR-011. |
| `audit` | Object | Audit block. | Platform | No | Omitted by default — request via `select=+audit`. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Commerce: Order | Parent | One Order to many Order Lines | The owning Order; every Order Line is authored within, and belongs to, exactly one Order. | Cannot exist without the Order. Discarded when the Order is soft-deleted from Draft/Quoted. |
| Commerce: Entitlement | Association | One Order Line to one Entitlement (shared id) | The persisted Agreement line the Order Line becomes on Order completion, sharing the `ALI` id via identity-preserving promotion. | Promoted on Order completion; no ongoing dependency. |
| Commerce: Agreement | Association | Many Order Lines to one Agreement | The Agreement the Order acts on and into which the line is promoted. | Referenced; the line is copied into the Agreement on completion. |
| Commerce: Subscription | Association | Many Order Lines to one Subscription | Recurring lines map to a Subscription. Multiple lines may map to one Subscription. | Mapped during fulfilment; a zero-quantity line can terminate its Subscription on completion. |
| Commerce: Asset | Association | Many Order Lines to one Asset | One-time lines map to an Asset. Multiple lines may map to one Asset. | Mapped or generated at completion. |
| Commerce: Order Subscription | Association | Many Order Lines to one Order Subscription | The in-flight Subscription within the Order that recurring lines attach to before completion. Order Subscription is a separate object drafted alongside this one. | Mapped during fulfilment; becomes the Agreement's Subscription on completion. |
| Commerce: Order Asset | Association | Many Order Lines to one Order Asset | The in-flight Asset within the Order that one-time lines attach to before completion. Order Asset is a separate object drafted alongside this one. | Generated/mapped during fulfilment; becomes the Agreement's Asset on completion. |
| Catalog: Item | Association | Many Order Lines to one Item | The referenced Product Item; its billing model determines Subscription vs Asset mapping. | Immutable after creation. |
| Catalog: Price List Item | Association | Many Order Lines to one Price List Item | Source of the line's `description` and price `info`, and of its price. | Copied at creation; no ongoing dependency. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

> Events significant for the Order Line that do not change a status of its own (it has none) — they are points in the parent Order's lifecycle.

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Line authored | The Client builds or updates a Draft Commerce: [[Order]] | Client | A line is added to the Order with its `oldQuantity`, requested `quantity`, Catalog: [[Item]] reference, and price copied from the Catalog: [[Price List Item]]. |
| Line mapped | The Vendor updates the Order during Processing | Vendor | The line is associated with a Commerce: [[Subscription]] (recurring) or an Asset (one-time). |
| One-time Asset generated | A one-time line without an Asset is present when the Order completes | Vendor | A one-time Asset is generated and the line is attached to it, then promoted with the rest. |
| Line promoted | The parent Commerce: [[Order]] completes | Vendor | The line is copied into the Commerce: [[Agreement]] as a Commerce: [[Entitlement]], preserving the `ALI` id. |

### 7.2 Cross-Object State Effects

> Effects the line's events have on other objects. The Order Line has no status of its own; the effects below are driven by the parent Order's completion acting on the line's mapped targets.

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Order completes with a line at quantity 0 that is the last active line of its Subscription | Commerce: Subscription | The Commerce: [[Subscription]] is terminated | Yes — platform, under the Vendor token context | The zero-quantity line leaves no remaining lines on the Subscription | Termination Order signature — see BR-003 and BR-008. |
| Order completes | Commerce: Entitlement | A Commerce: [[Entitlement]] is created (or updated) in the Agreement from the line, preserving the `ALI` id | Yes — platform, under the Vendor token context | The Order reaches Completed | See Commerce: [[Entitlement]] canon Section 3. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Order Line has no state machine, so there are no reversible state transitions. While the parent Commerce: [[Order]] is Draft or Processing, a line's quantity, price, and mapping can be edited freely by rewriting the Order's lines. Once the Order reaches Completed the line is fixed and its identity continues as a Commerce: [[Entitlement]]; changing the entitled quantity thereafter requires a new Order.

**Deletion:**
An Order Line has no delete endpoint. A line is removed by editing the parent Commerce: [[Order]]'s `lines` while the Order is Draft or Quoted, or discarded when the Order is soft-deleted (the Order moves to Deleted status and remains retrievable via the API, including in standard list responses — see Commerce: [[Order]] canon Section 8). A promoted line persists as a Commerce: [[Entitlement]] on the Agreement and is never removed as part of the Order.

**Audit & history requirements:**
The line carries an `audit` block, omitted by default and retrievable via `select=+audit`. Prior `oldQuantity`/`quantity` or price values on a line are not retained beyond the audit trail; the completed line's values are carried forward into the resulting Commerce: [[Entitlement]].

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| A net-new line is inspected before fulfilment maps it | The line's `subscription`/`asset` reference is absent until the Vendor maps it during Processing (or, for one-time lines, until an Asset is generated at completion). | Vendor, Client | Low | Absence of a mapping reference on a Draft/Quoted line is expected — see BR-005. |
| An Order is submitted whose change reduces every applicable line to quantity 0 | The platform prevents completion — at least one line in the affected Agreement or Subscription must remain at quantity 1 or higher; genuine reduction to zero is done through a Termination Order. | Client, Vendor | Medium | Platform-enforced at completion — see BR-008. |
| A line is supplied with an id that exists on neither the Order nor the Agreement | The platform rejects the line as an orphan rather than creating it. | Client, Vendor | Low | See BR-007. |
| A one-time line reaches completion with no Asset mapped | The platform generates a one-time Asset for the line and attaches it before promotion. | Vendor | Low | Expected fulfilment behaviour, not an error — see BR-005. |
| A consumer expects an Order Line to carry a status like a Commerce: [[Entitlement]] | Order Lines have no `status` field; a line's lifecycle is that of the parent Commerce: [[Order]] until promotion, after which status lives on the Commerce: [[Entitlement]]. | Vendor, Operations, Client | Low | The `status` seen on a completed line is the Entitlement's, read via the Agreement/Subscription/Asset lines. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-17 | Stu / canon-generate | Initial canon. Generated from the live OpenAPI schema (STAGING), multi-Actor live fetches of Orders across Purchase/Change/Configuration/Termination types and Draft/Quoted/Processing/Completed states, an Actor-suppression diff, and source-code research. Documents: the in-flight, Order-scoped nature of the line (no dedicated create/update/delete endpoint; authored through the Order); the absence of an independent state machine and status field; the `oldQuantity` → `quantity` change signature per Order type; the Subscription-vs-Asset mapping by Item billing model; identity-preserving promotion into the Agreement as an Entitlement (shared `ALI` id); the create/change/orphan authoring rule; the at-least-one-non-zero-line completion guard; per-Actor price-field visibility; and the corrected finding that Configuration Orders do carry a line. 1 candidate open question. |
</content>
</invoke>
