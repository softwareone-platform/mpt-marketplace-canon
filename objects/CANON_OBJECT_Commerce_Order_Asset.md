# Object Canon: Order Asset

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-17
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Order Asset

**Namespace:** Commerce

**Parent Object:** Commerce: Order

**ID Prefix:** AST

**Description:**
An Order Asset is the Order-scoped, in-flight representation of a one-time-purchase [[Asset]] being created or changed by an [[Order]]. It is the working draft the Vendor builds out while the [[Order]] is being fulfilled — carrying the prospective Asset's name, template, fulfilment parameters, price, and its mapped [[Order Line]]s — and it exists only as a child of its parent [[Order]], reachable through that [[Order]]'s `assets` sub-resource. When the [[Order]] completes, each Order Asset is promoted into a live Commerce: [[Asset]], retaining the same `AST` identifier. It is distinct from Commerce: [[Asset]], which is the [[Agreement]]-scoped, live one-time-purchase record; the Order Asset is the transient, Order-scoped precursor to it. Order Assets exist only for one-time-purchase [[Item]]s — recurring [[Item]]s are represented during fulfilment by [[Order Subscription]]s instead.

**Also Known As:**
`OrderAsset` (the API schema/component name).

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes | Yes | Yes | Yes | The only Actor that can create an Order Asset, map/replace its Lines, or update its fulfilment parameters — these operations are Vendor-only (see BR-002). May also update `name`, `template`, and `externalIds.vendor`. Delete is permitted only while the Order Asset is Draft (see BR-011). Read is scoped as for the parent Order. |
| Operations | No | Yes | No (effectively) | No | An update request is accepted but writes only `externalIds.operations`; `price.defaultMarkup` is writable only while the Order Asset is Active (it is Draft throughout fulfilment, so this never applies in practice — see BR-006). Cannot add/change Lines or parameters. Delete is rejected. Read is not self-scoped — Operations sees all Orders' assets. |
| Client | No | Yes | No (effectively) | No | An update request is accepted but writes only `externalIds.client`; `name` is writable only while the Order Asset is Active (it is Draft throughout fulfilment, so this never applies in practice — see BR-006). Cannot add/change Lines or parameters. Delete is rejected. Read is scoped as for the parent Order (own Account's Orders only). |

> **Guidance:** "Can Delete" is Yes for the Vendor, but only in the Draft state — see BR-011 and Section 3.2 (T4). Operations and Client delete requests are rejected outright.

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Draft | The in-flight working state. The Order Asset exists as a child of a not-yet-completed Order and is built out by the Vendor during fulfilment — mapping Order Lines and setting name, template, and fulfilment parameters. Only a Draft Order Asset can be deleted. This is the only state in which the Order Asset is actively edited. | Yes | No |
| Active | Set on every remaining Order Asset when the parent Order transitions to Completed, at which point the Order Asset is promoted into a live Commerce: Asset with the same identifier. The Order Asset record persists on the completed Order as an Order-scoped view of the promoted Asset. | No | Yes |
| Deleted | The Order Asset was deleted while Draft. Permanently removed — no longer retrievable via the API. | No | Yes |

> **Note on `New` and `Terminated`:** The underlying `AssetStatus` enum defines `New`, `Draft`, `Active`, and `Terminated`. An Order Asset is created directly in `Draft` and only ever reaches `Active` (on Order completion) — `New` is never used for an Order Asset, and `Terminated` applies only to the live Commerce: Asset, never to the Order-scoped record. Termination has no Order Asset representation.

> **Note on promotion:** Promotion to the live Commerce: Asset happens as part of the parent Order's own completion processing — there is no separate Order-Asset-facing action that triggers it. The live Asset retains the Order Asset's `AST` identifier. An Order Asset with no Lines at completion is removed rather than promoted (see BR-010). If a live Asset with the same identifier already exists on the Agreement, it is updated from the Order Asset; otherwise a new live Asset is created (see BR-012).

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Draft | Vendor creates the Order Asset | `POST` `/commerce/orders/{orderId}/assets` (Vendor-only) | Vendor | A non-empty `name` and at least one Line, each Line referencing an existing Order Line (`ALI`) that is part of the parent Order (see BR-003). | A fresh `AST` identifier is minted at creation. Price is seeded from the parent Order's currency and default markup. |
| T2 | — | Draft | Platform auto-generates an Order Asset for an unmapped one-time Line | Plain platform-driven write, no dedicated endpoint (occurs during the parent Order's completion processing) | Platform (under the completing Actor's token context) | Parent Order is completing and has one or more one-time Lines not already mapped to an Order Asset. | The platform creates one Order Asset per such Line so that no one-time Line reaches completion without an Asset. Created in Draft, then immediately transitioned to Active by the same completion (T3). |
| T3 | Draft | Active | Order completed — Order Asset promoted to live Asset | Plain platform-driven status write, no dedicated endpoint (occurs during the parent Order's completion processing) | Platform (under the completing Actor's token context) | Parent Order transitions to Completed; every one-time Line has an Order Asset; each Order Asset has at least one Line (empty ones are removed, not promoted); each Order Asset's terms match its Lines' billing model and frequency. | Same `AST` identifier retained on the live Commerce: Asset. Existing same-id Asset is updated from the Order Asset; otherwise a new live Asset is created. |
| T4 | Draft | Deleted | Vendor deletes the Order Asset | `DELETE` `/commerce/orders/{orderId}/assets/{id}` (Vendor-only) | Vendor | Order Asset must be in Draft status; the request must be made by the Vendor (Operations and Client are rejected). | The Order Asset's Lines are unassigned and the Order Asset is permanently removed — no longer retrievable via the API. |

> **Note:** Editing a Draft Order Asset (name, template, fulfilment parameters, Line mapping, `externalIds`) does not change its state — it remains Draft. Those edits are covered in Section 7.1.

### 3.3 State Diagram

```
— ---(Vendor creates : Vendor)---> [Draft]
— ---(auto-generated for unmapped one-time Line at completion : Platform)---> [Draft]
[Draft] ---(Order completed, promoted to live Asset : Platform)---> [Active]
[Draft] ---(Vendor deletes : Vendor)---> (permanently removed)
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An Order Asset belongs to exactly one [[Order]] and exists only as a child of that [[Order]]. It is created, read, updated, and deleted through the [[Order]]'s `assets` sub-resource and has no independent top-level endpoint. | All | All | The live Commerce: [[Asset]] it is promoted into is the [[Agreement]]-scoped equivalent, reached through the Asset endpoints — see Section 6. |
| BR-002 | Creating an Order Asset, mapping or replacing its Lines, and setting its fulfilment parameters are Vendor-only operations. A Client or Operations update request is accepted but silently applies none of these — only that Actor's own `externalIds` entry is written (see BR-006). | All | Vendor | Reflects the Vendor's ownership of one-time fulfilment, mirroring Vendor ownership of the live Commerce: [[Asset]]. |
| BR-003 | On creation the Vendor must supply a non-empty `name` and at least one Line, each Line referencing an existing [[Order Line]] that is part of the parent [[Order]]. A fresh `AST` identifier is minted for the new Order Asset. | Draft | Vendor | Lines are referenced by their `ALI` identifier — the same identifier the Line carries as an [[Order]] Line and later as a Commerce: [[Entitlement]]. |
| BR-004 | A given [[Order Line]] can be mapped to only one Order Asset. A create or update that references a Line already assigned to a different Order Asset is rejected. | Draft | Vendor | Prevents a one-time Line being fulfilled by two Assets. |
| BR-005 | An update that sets `lines` is full-set: every referenced Line must already be part of the parent [[Order]], no Line identifier may be duplicated within the request, and each referenced Line must have a one-time billing frequency. A Line that is not part of the [[Order]], a duplicate, or a non-one-time Line causes the update to be rejected. | Draft | Vendor | One-time billing frequency is required because Order Assets represent one-time purchases only; recurring Lines are carried by [[Order Subscription]]s. |
| BR-006 | Field-level write authority follows the shared Asset model: the Vendor may set `name`, `template`, `externalIds.vendor`, fulfilment parameters, and Lines; the Client may set `externalIds.client` at any time and `name` only while the Order Asset is Active; Operations may set `externalIds.operations` at any time and `price.defaultMarkup` only while the Order Asset is Active. | All | Vendor, Operations, Client | Because an Order Asset is Draft for its entire editable life and only becomes Active at the instant of promotion, the Client `name` write and the Operations `price.defaultMarkup` write never apply to an Order Asset in practice — they apply to the live Commerce: [[Asset]]. |
| BR-007 | An Order Asset's `terms.period` is always `one-time`. `terms.model` reflects the shared billing model of its Lines — `one-time`, `usage`, or `quantity` — and every Line under one Order Asset must share the same billing model and frequency. | All | All | Terms are derived from the Lines, not set directly. A mismatch between an Order Asset's terms and its Lines blocks the parent [[Order]]'s completion (see BR-008). |
| BR-008 | The parent [[Order]] cannot complete while any one-time Line has no Order Asset, or while any Order Asset's terms do not match its Lines' billing model and frequency. Any Order Asset that has no Lines at completion is removed rather than promoted. | Draft | Platform | The platform first auto-generates an Order Asset for each unmapped one-time Line (see BR-009), so in practice the "Line without an Asset" block only arises if generation itself cannot resolve a Line. |
| BR-009 | When the parent [[Order]] completes, the platform auto-generates one Order Asset for each one-time Line not already mapped to an Order Asset, mapping that single Line to it. | Draft | Platform | A Vendor need not explicitly create an Order Asset for a straightforward one-time Line — the platform will create it at completion. The Vendor creates one explicitly when it needs to set the name, template, or parameters before completion, or group Lines deliberately. |
| BR-010 | Only a Draft Order Asset can be deleted, and only by the Vendor. A delete request from the Client or Operations is rejected, and a delete request against a non-Draft (Active) Order Asset is rejected. | Draft | Vendor | On deletion the Order Asset's Lines are unassigned and the Order Asset is permanently removed — no longer retrievable via the API. |
| BR-011 | On the parent [[Order]]'s completion, each remaining Order Asset is promoted into a live Commerce: [[Asset]] retaining the same `AST` identifier. If a live [[Asset]] with that identifier already exists on the [[Agreement]] it is updated from the Order Asset; otherwise a new live [[Asset]] is created. | Draft → Active | Platform | The live [[Asset]] is created directly in Active status. The Order Asset record persists on the completed [[Order]] as an Order-scoped view. |
| BR-012 | An Order Asset's `template`, when set, must be an Asset-type [[Template]] belonging to the parent [[Order]]'s [[Product]]. | Draft | Vendor | Validated at write time; a template of the wrong type or from another [[Product]] is rejected. |
| BR-013 | Order Asset pricing uses one-time price fields. `PPx1` (one-time purchase price) is visible to Vendor and Operations; `SPx1` (one-time selling price) is visible to Client and Operations; `markup`, `margin`, `defaultMarkup`, and `defaultMargin` are visible to Operations only. | All | All | Same Actor-based suppression as the live Commerce: [[Asset]]; applies to both the aggregate `price` and the per-Line price. |
| BR-014 | The `audit` block is omitted from API responses by default. | All | All | Request via `select=+audit`. Records `created` and `updated` (timestamp and Actor). |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | String | Unique platform identifier for the Order Asset. | Platform | No | Format: `AST-XXXX-XXXX-XXXX`. Preserved onto the live Commerce: Asset at promotion (see BR-011). |
| `revision` | Integer | Increments each time the Order Asset is updated. | Platform | Yes — platform-managed | — |
| `name` | String | Human-readable name for the prospective Asset. | Vendor (at creation) | Yes — see BR-006 | Vendor may update while Draft; the Client `name` write applies only in Active and so never applies to an Order Asset in practice. |
| `status` | Enum | Current status. Values observed for an Order Asset: `Draft`, `Active`. (`New` and `Terminated` exist in the shared `AssetStatus` enum but are not used for Order Assets — see Section 3.1.) | Platform | Yes — platform-managed | Driven by parent Order completion; not directly writable. |
| `terms` | Object | Billing terms. `period` is always `one-time`; `model` reflects the Lines' shared billing model (`one-time`, `usage`, or `quantity`). No `commitment` value observed. | Platform (derived from Lines) | No — derived | See BR-007. |
| `price` | Object | Aggregate one-time pricing. Contains `PPx1`, `SPx1`, `currency`, `markup`, `margin`, `defaultMarkup`, `defaultMargin`. | Platform (computed) | Yes — recalculated on create/update | Seeded from the parent Order's currency and default markup at creation. Actor suppression per BR-013. |
| `parameters.fulfillment` | Array | Asset-scoped fulfilment parameters (`phase: Fulfillment`, `scope: Asset`) written and maintained by the Vendor. | Vendor | Yes — Vendor only | Cannot be written by Client or Operations (see BR-002). |
| `template` | Object | Reference to the Asset-type Catalog: Template assigned to the prospective Asset. | Vendor | Yes — Vendor | Must belong to the parent Order's Product (see BR-012). Absent from response when null. |
| `lines` | Array | The Order Lines mapped to this Order Asset. | Vendor | Yes — see BR-005 | Each Line referenced by its `ALI` identifier. Full-set replacement semantics; each Line must be one-time and part of the parent Order. A Line can map to only one Order Asset (BR-004). |
| `externalIds.vendor` | String | Vendor's own reference. | Vendor | Yes | Optional. Absent from response when null. |
| `externalIds.client` | String | Client's own reference. | Client | Yes | Optional. Absent from response when null. |
| `externalIds.operations` | String | Operations' own reference. | Operations | Yes | Optional. Absent from response when null. |
| `audit` | Object | Audit timestamps (`created`, `updated`) with Actor. | Platform | No | Omitted by default — request via `select=+audit`. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Commerce: Order | Parent | Many Order Assets to one Order | Every Order Asset belongs to one Order and is reachable only through that Order's `assets` sub-resource. | The Order Asset exists only for the life of the in-flight Order. On completion it is promoted; if the Order fails, the Order Asset is abandoned with it and never promoted. |
| Commerce: Asset | Association | One Order Asset to one live Asset | The live, Agreement-scoped one-time-purchase record the Order Asset is promoted into on Order completion, retaining the same identifier. | On completion the Order Asset is promoted into (or updates) the live Asset of the same identifier; an Order Asset with no Lines is removed, not promoted. |
| Commerce: Order Line | Child | One Order Asset to many Order Lines | The one-time Lines mapped to this Order Asset. Referenced by their `ALI` identifier. Not yet canonised as its own object. | A Line can map to only one Order Asset. Deleting a Draft Order Asset unassigns its Lines. |
| Commerce: Agreement | Association | Many Order Assets to one Agreement | The Agreement the parent Order belongs to and onto which the promoted live Asset attaches. | The promoted live Asset attaches to this Agreement on completion. |
| Catalog: Product | Association | Many Order Assets to one Product | The Product the parent Order's Agreement covers. A mapped Line's Item, and the Order Asset's Template, must belong to this Product. | No direct lifecycle dependency on the Order Asset itself. |
| Catalog: Template | Association | Many Order Assets to one Template | The Asset-type Template assigned to the prospective Asset, determining its rendered content. | No lifecycle dependency — Template changes do not change Order Asset state. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

> Events that are significant for this object but do not necessarily change its state.

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Order Asset created | Vendor calls `POST` on the Order's `assets` sub-resource | Vendor | New Order Asset in Draft with a fresh `AST` identifier; supplied Lines mapped; parent [[Order]]'s price recalculated. |
| Name / template / `externalIds.vendor` updated | Vendor updates via `PUT` | Vendor | Values persisted; no state change. Template validated against the parent [[Order]]'s [[Product]] (BR-012). |
| Fulfilment parameters updated | Vendor updates `parameters.fulfillment` via `PUT` | Vendor | Values persisted; no state change. |
| Lines mapped / replaced | Vendor includes `lines` in a `PUT` | Vendor | Line set replaced (full-set semantics, BR-005); Order Asset price recalculated; no state change. |
| `externalIds` (own entry) updated | Client or Operations updates via `PUT` | Client, Operations | Only that Actor's own `externalIds` entry is written; no other field changes and no state change (BR-006). |
| Template rendered | Vendor, Operations, or Client calls the render endpoint | Vendor, Operations, Client | Returns the rendered [[Template]] content for display; no state change, no persisted side effect. |
| Order Asset deleted | Vendor calls `DELETE` on a Draft Order Asset | Vendor | Lines unassigned; Order Asset permanently removed; parent [[Order]]'s price recalculated (BR-010). |

### 7.2 Cross-Object State Effects

> Effects this object's events have on *other* objects.

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Parent Order completed | Commerce: Asset | The Order Asset is promoted into a live [[Asset]] of the same identifier — creating a new live [[Asset]] in Active status, or updating the existing same-id [[Asset]] from the Order Asset. | Yes — platform, under the completing Actor's token context | Order Asset has at least one Line at completion | An Order Asset with no Lines is removed, not promoted (BR-008, BR-011). |
| Parent Order completed | Commerce: Order Line | Each remaining Order Asset is set to Active; its mapped Lines become the live [[Asset]]'s Lines (promoted as Commerce: [[Entitlement]]s under the [[Agreement]]). | Yes — platform, under the completing Actor's token context | Order transitions to Completed | Line identity (`ALI`) is preserved through promotion. |
| Order Asset created, updated, or deleted | Commerce: Order | The parent [[Order]]'s aggregate price is recalculated. | Yes — platform, under the acting Actor's token context | N/A | The Order Asset's own price is also recalculated on create/update. |

> **Guidance:** None of these effects deletes another object. Deleting a Draft Order Asset unassigns its Lines (a reference change), it does not remove them.

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
There are no reversible transitions. Draft → Active (promotion) is one-way and happens as part of the parent [[Order]]'s completion. There is no path back from Active to Draft, and no Order-Asset-level reactivation.

**Deletion:**
An Order Asset may be deleted by the Vendor only while it is Draft. Once deleted it is permanently removed — no longer retrievable via the API. Operations and Client delete requests are rejected, and a non-Draft (Active) Order Asset cannot be deleted. There is no soft-delete model for Order Assets — deletion is only ever available in the Draft state, before promotion.

**Audit & history requirements:**
The `audit` block records `created` and `updated` (each a timestamp and the acting Actor) and is omitted from API responses by default — request via `select=+audit`. Audit Records generated for Order Asset events on the platform-wide Audit bus are not separately confirmed here (see Section 10). After promotion, the live Commerce: [[Asset]] carries its own audit trail; the Order Asset record persists on the completed [[Order]] as an Order-scoped view.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| One-time [[Order]] Line left unmapped by the Vendor | At completion the platform auto-generates an Order Asset for the Line, so completion is not blocked. The auto-generated Asset takes a system-derived name rather than a Vendor-curated one. | Vendor, Client | Low | The Vendor should create the Order Asset explicitly when a curated name, template, or parameters are required before completion (BR-009). |
| Order Asset left with no Lines at completion | The empty Order Asset is removed during completion and is never promoted — no live [[Asset]] is created for it. | Vendor | Low | Removal of empty Order Assets is part of completion processing (BR-008). |
| Order Asset terms do not match its Lines | The parent [[Order]] cannot be moved to Completed — completion is blocked until the mismatch is resolved. | Vendor | Medium | All Lines under one Order Asset must share the same billing model and frequency (BR-007). |
| Vendor references a Line already mapped to another Order Asset | The create or update is rejected — a Line can be mapped to only one Order Asset. | Vendor | Low | See BR-004. |
| Parent [[Order]] fails after Order Assets were built | The Order Assets are abandoned with the [[Order]] and never promoted — no `AST`-prefixed live [[Asset]] is created from them. They remain reachable only through the failed [[Order]]'s `assets` sub-resource. | Vendor | Low | The Vendor must treat a failed [[Order]] as terminal for its Order Assets. |
| Client or Operations attempts to edit Lines or parameters | The `PUT` succeeds at the HTTP level but applies only that Actor's own `externalIds` entry — Line and parameter changes are silently not applied. | Client, Operations | Medium | The absence of an error can mask that the intended change did not take effect (BR-002, BR-006). |

---

## 10. Open Questions

- [ ] **AST-004:** The Order Asset write endpoints (`POST`/`PUT`) enforce no parent-Order-status precondition — no guard requires the parent Order to be in-flight (Draft/Quoted/Processing). Whether the platform blocks creating or updating an Order Asset against an already-Completed or Failed Order by another mechanism is unconfirmed; only in-flight Orders were exercised in the captured evidence. (DELETE is separately guarded to Draft-status Order Assets only.)
- [ ] **AST-005:** What Audit Records (on the platform-wide Audit bus) are generated for Order Asset create/update/delete/promotion events, if any, is not confirmed — only the inline `audit` block (`created`/`updated`) is observed.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-17 | Stu / canon-generate-batch | Initial draft. Covers the Order-scoped Draft/Active lifecycle, Vendor-only create/line/parameter/delete authority, Draft-only deletion guard, one-time-Line auto-generation and empty-Order-Asset removal at completion, promotion to the live Commerce: Asset with identity preserved, terms/price derivation, and Actor-based price suppression. Drafted alongside the Commerce: Order refresh and the fresh Order Line and Order Subscription siblings. |
</content>
</invoke>
