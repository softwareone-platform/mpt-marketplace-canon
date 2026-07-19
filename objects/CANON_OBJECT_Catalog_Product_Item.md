# Object Canon: Item

> **Version:** 0.6
> **Owner:** Stu
> **Last Updated:** 2026-07-19
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Item

**Namespace:** Catalog

**Parent Object:** Catalog: Product

**ID Prefix:** ITM (confirmed via `preamble/PLATFORM_CANON_PREAMBLE.md` §5.3 and observed real object IDs, e.g. `ITM-2873-8874-3774`).

**Description:**
An Item is a Vendor-defined orderable unit within a [[Product]]. Items represent the full union of all orderable SKUs across all regions and currencies for that Product. Whether a given Item is available for sale in a given currency is controlled by the [[Price List]]; whether a Price List is available through a given SoftwareOne subsidiary is controlled by the [[Listing]]. Items carry commercial terms (billing model, period, commitment) and are ordered with an integer quantity. At scale, Item catalogues are typically managed by Vendor Extensions rather than manually.

**Also Known As:**
SKU.

---

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes | Yes | Yes | Yes — Draft state only | Full authoring ownership of Item definitions under the Vendor's own Products. Submits for review and unpublishes, but cannot publish — that is Operations-only (BR-016). At scale, Item management is typically automated via Vendor Extension. |
| Operations | No | Yes | Yes — `externalIds.operations` only | No | Reads all Items. The only attribute Operations may write is `externalIds.operations` (the SoftwareOne ERP part number). Publishes and republishes Items (BR-016); may also unpublish. Cannot create or delete. |
| Client | No | Yes | No | No | Clients see Published Items only, filtered to those available in their Listing's Price List. |

---

## 3. State Machine

> Each transition specifies which Actor(s) are permitted to execute it.
> Where more than one Actor is listed, any one of them may execute the transition.
> Each execution instance is always attributable to exactly one Actor.

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Draft | Item created but not yet submitted for publishing. Visible to Vendor and Operations. Not visible to Client. The only state from which deletion is permitted (BR-017). | Yes | No |
| Pending | Vendor has submitted the Item for review. Awaiting Operations approval to publish. | No | No |
| Published | Item is live. Visible to Client subject to Price List availability. | No | No |
| Unpublished | Item has been withdrawn from Client visibility. Visible to Vendor and Operations. Not terminal — may return to Pending for re-review or be republished directly. | No | No |
| Deleted | Item deleted from Draft state. Permanently removed — no longer retrievable via the API. Reachable only from Draft (BR-017). | No | Yes |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Draft | Create Item | `POST` (base collection endpoint) | Vendor | Required fields present (BR-018); the Item must reference a valid [[Item Group]], [[Unit of Measure]], and terms. | Item created under the Product in Draft state. |
| T2 | Draft | Pending | Submit Item for Publishing | `review` (`POST .../{id}/review`) | Vendor | None | Item enters the Operations review queue. First submission auto-creates its [[Price List Item]]s (Section 7.2). |
| T3 | Pending | Published | Approve and Publish Item | `publish` (`POST .../{id}/publish`) | Operations | None enforced by the platform | Item available for inclusion in Price Lists and ordering by Clients. |
| T4 | Published | Unpublished | Unpublish Item | `unpublish` (`POST .../{id}/unpublish`) | Vendor, Operations | None | Item withdrawn from Client visibility. |
| T5 | Unpublished | Published | Republish Item | `publish` (same route as T3) | Operations | None enforced by the platform | Republish uses the same Operations-only action as the original Publish — not a separate Vendor-accessible one. |
| T6 | Unpublished | Pending | Submit Item for Publishing | `review` (same route as T2) | Vendor | None | The same action handles both `Draft -> Pending` and `Unpublished -> Pending`; lets a Vendor return an Unpublished Item to the review queue rather than republishing it directly. Does not re-create Price List Items (Section 7.2). |
| T7 | Draft | Deleted | Delete Item | `DELETE /{id}` | Vendor | Item must be in Draft state; the platform rejects the request otherwise. | Permanently removed — no longer retrievable via the API. No cascade. |

### 3.3 State Diagram

```
[Draft] ---(review : Vendor)---> [Pending]
[Draft] ---(DELETE /{id} : Vendor)---> [Deleted]
[Pending] ---(publish : Operations)---> [Published]
[Published] ---(unpublish : Vendor, Operations)---> [Unpublished]
[Unpublished] ---(publish : Operations)---> [Published]
[Unpublished] ---(review : Vendor)---> [Pending]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An Item belongs to exactly one [[Product]] and cannot be shared across Products. | All | All | — |
| BR-002 | Every Item belongs to exactly one [[Item Group]], specified explicitly when the Item is created. The platform does not assign a group automatically. | All | All | A creation request omitting a valid Item Group is rejected. See [[Item Group]] canon BR-003. |
| BR-003 | An [[Item Group]]'s `multiple` and `required` flags express intended selection semantics for the ordering experience; the platform core does not enforce them at [[Order]] submission. | All | All | Advisory metadata consumed by the ordering UI / Vendor Extension. See [[Item Group]] canon BR-004/BR-005. |
| BR-004 | Items represent the full union of all orderable SKUs across all regions and currencies. Availability of an Item for sale in a given currency is controlled by the [[Price List]], not by the Item itself. | All | All | — |
| BR-005 | Items are ordered with an integer quantity. Fractional quantities are not supported. | All | All | — |
| BR-006 | Item quantity constraints (min, max) are not enforced by the platform. Quantity validation is the responsibility of the Vendor Extension, typically during Draft [[Order]] validation. | All | All | The platform has no opinion on whether a given quantity is commercially valid. |
| BR-007 | An Item has commercial terms comprising a billing model, a billing period, and a commitment. Terms are set by the Vendor at creation and are immutable afterwards. | All | Vendor | See BR-008 to BR-011 for valid values and combinations. |
| BR-008 | Valid `terms.model` values are: quantity, usage, one-time. | All | All | quantity bills per unit of quantity; usage bills on consumption; one-time is a single non-recurring charge. |
| BR-009 | Valid `terms.period` values are: 1m, 1y, 3y, one-time. | All | All | Period is the billing cycle. |
| BR-010 | Valid `terms.commitment` values are: 1m, 1y, 2y, 3y, 4y, 5y. Commitment is nullable — when absent, no minimum contractual term applies. | All | All | Commitment is the minimum contractual term. `one-time` is not a valid commitment value. |
| BR-011 | The permitted `terms.commitment` values depend on `terms.period`. | All | All | 1m period: commitment is unconstrained (may be null or any value). 1y period: commitment is required and may be 1y, 2y, 3y, 4y, or 5y (not 1m). 3y period: commitment must be exactly 3y. one-time period (with the one-time model): commitment must be null. |
| BR-012 | The `quantityNotApplicable` flag marks an Item for which quantity is not collected or displayed. It is set at creation and immutable afterwards. | All | Vendor | Intended to always be true when `terms.model` = usage. The platform core does not currently enforce this coupling — a usage Item with `quantityNotApplicable` = false is accepted. |
| BR-013 | An Item has a [[Unit of Measure]] describing what is being counted or measured (e.g. User, Licenses, Gigabytes). Units of Measure are platform-level reference objects; the Vendor selects one at creation and may change it afterwards. | All | Vendor | See CANON_OBJECT_Catalog_UnitOfMeasure.md. |
| BR-014 | An Item has two external ID namespaces, managed independently: `externalIds.vendor` (the Vendor's own SKU identifier) and `externalIds.operations` (the SoftwareOne ERP part number). | All | Vendor, Operations | `externalIds.vendor` is Vendor-writable and required at creation. `externalIds.operations` is Operations-writable only, must be null at creation, and is set later. An Item may be published without `externalIds.operations`. |
| BR-015 | Item creation, modification, and deletion are not restricted by the state of the parent [[Product]]. | All | Vendor | Consistent with platform permissiveness philosophy. |
| BR-016 | A Vendor submits an Item for review but cannot publish it; only Operations can publish or republish an Item. | Pending, Unpublished | Vendor (submit only), Operations (publish/republish) | Mirrors the collaborative publication model of the parent [[Product]]. No content-completeness criteria are enforced before publication beyond the current-state check. |
| BR-017 | An Item may be deleted only while in Draft state, and only by the Vendor. Deletion permanently removes it — no longer retrievable via the API — and does not cascade. | Draft | Vendor | Because deletion is Draft-only and [[Price List Item]]s are created at first review (post-Draft), a deletable Item never yet has Price List Items. |
| BR-018 | Creating an Item requires a name, a description, `externalIds.vendor`, an [[Item Group]], a [[Unit of Measure]], and terms. | Draft (creation) | Vendor | `name` is mandatory even though it is absent from the OpenAPI schema's `required` array (a spec inaccuracy). `externalIds.operations` must be null at creation. |
| BR-019 | Item-scoped [[Parameter]]s store Vendor-defined metadata about an Item, surfaced in the Items list during ordering and filterable by Clients. | All | Vendor | The only available constraint for Item-scoped Parameters is `required`. See [[Parameter]] canon BR-022. |
| BR-020 | An Item's mutable attributes (name, description, Unit of Measure, Item Group, external IDs, parameters) may be changed in any non-terminal state, including Published. Terms and `quantityNotApplicable` are the exceptions — immutable after creation. | Draft, Pending, Published, Unpublished | Vendor | The platform applies no "locked once published" guard. The Vendor is responsible for the downstream consequences of editing a Published Item that already has [[Price List Item]]s or live [[Order]]s. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| Name | String | Display name of the Item | Vendor | Yes | Required on creation (absent from the schema's `required` array, but enforced — see BR-018). |
| Description | String | Description of the Item | Vendor | Yes | Optional on creation. |
| externalIds.vendor | String | Vendor's own SKU identifier for this Item | Vendor | Yes | Required on creation. |
| externalIds.operations | String | SoftwareOne ERP part number for this Item | Operations | Yes | Must be null at creation; set later by Operations, independently of the Vendor. Not required to publish. |
| Group | Reference | The Item Group this Item belongs to | Vendor | Yes | Required on creation — a valid Item Group must be specified. May be reassigned to another group after creation. |
| Unit of Measure | Reference | Platform-defined unit describing what is being counted or measured (e.g. User, Licenses, Gigabytes) | Vendor | Yes | Required on creation. Mutable after creation. References a platform-level Catalog: Unit of Measure object. |
| terms.model | Enum | One of: quantity, usage, one-time | Vendor | No | Required on creation. Immutable after creation. See BR-008. |
| terms.period | Enum | One of: 1m, 1y, 3y, one-time | Vendor | No | Required on creation. Immutable after creation. See BR-009. |
| terms.commitment | Enum | One of: 1m, 1y, 2y, 3y, 4y, 5y. Nullable. | Vendor | No | Required on creation where the period demands it (see BR-011). Immutable after creation. Valid values depend on period (BR-011). |
| quantityNotApplicable | Boolean | When true, quantity is not collected or displayed for this Item | Vendor | No | Immutable after creation. Intended to be true for the usage model, but not enforced (BR-012). |
| Parameters | Collection | Item-scoped Parameter instances. Rarely used. | Vendor | Yes | See Parameter canon. |
| Status | Enum | One of: Draft, Pending, Published, Unpublished | System | Yes — via state transitions only | Does not include a Deleted value — see Section 3.1. |
| Revision | Integer | Increments on update | System | No | Read-only. |
| Audit | Object | created, updated, pending, published, and unpublished events, each with timestamp and Actor attribution | System | No | Read-only. Absent sub-keys when the corresponding event has not occurred. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Product | Parent | Many:1 | An Item belongs to exactly one Product. | An Item cannot be created without a parent Product. Deleting the Product does not remove its Items — Items are independent records and are not part of the Product deletion. |
| Catalog: Product Item Group | Parent | Many:1 | An Item belongs to an Item Group, specified explicitly on creation and reassignable afterwards. | An Item Group cannot be deleted while it contains Items (see Catalog: Product Item Group canon BR-009). |
| Catalog: Price List | Association | Many:Many | Price Lists reference Items to define which Items are available in a given currency and at what price. | A Price List Item is auto-created for this Item in each of the Product's Price Lists on the Item's first review (Section 7.2). Item state changes do not delete Price List Items. |
| Commerce: Order | Association | Many:Many | Orders contain lines referencing Items with integer quantities. Change Orders carry both old and new quantities per line. Configuration Orders reference Items linked to existing Subscriptions. | No |
| Catalog: Product Parameter | Association | Many:Many | Item-scoped Parameters may be associated with Items. | No |
| Catalog: Unit of Measure | Reference | Many:1 | An Item references a platform-level Unit of Measure object describing what is being counted or measured. | No — Unit of Measure cannot be deleted, so no orphan risk. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Item created | Vendor creates Item under a [[Product]] | Vendor | Item enters Draft state under its explicitly specified [[Item Group]]. Publishes a creation event to the platform notification subsystem (Catalog module). |
| Item submitted | T2 / T6 — Draft or Unpublished to Pending | Vendor | Item enters the Operations review queue. On the first submission (from Draft) only, one [[Price List Item]] is created for the Item in each of the Product's Price Lists. Publishes a state-changed event. |
| Item published | T3 — Pending to Published | Operations | Item becomes available for inclusion in Price Lists and for ordering by Clients via an appropriate [[Listing]]. Publishes a state-changed event. |
| Item unpublished | T4 — Published to Unpublished | Vendor, Operations | Item withdrawn from Client visibility. Existing [[Order]] lines referencing this Item are unaffected. Its [[Price List Item]]s are not removed. Publishes a state-changed event. |
| Item republished | T5 — Unpublished to Published | Operations | Item restored to Client visibility. Publishes a state-changed event. |
| Item updated | Any attribute change | Vendor, Operations | Revision incremented. Publishes an update event. |
| externalIds.operations set | Operations sets the ERP part number | Operations | Operations part number written to the Item. The Vendor's `externalIds.vendor` is unaffected. |
| Item deleted | T7 — Draft deleted | Vendor | Permanently removed — no longer retrievable via the API. Publishes a deletion event. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Item first submitted for review | Price List Item | One Price List Item is created for this Item in each of the Product's Price Lists | Yes | Only on the first review (Draft → Pending), not on a later Unpublished → Pending re-review | Under the acting Vendor's token context. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
- Published → Unpublished → Published (Operations republish). No limit on cycles.
- Unpublished → Pending (re-review) is available as an alternative to direct republication.
- Draft → Pending cannot be undone by the Vendor — the only forward path is publication by Operations.

**Deletion:**
An Item may be deleted by the Vendor only while in Draft state. Once deleted, permanently removed — no longer retrievable via the API. Deletion does not cascade. Items beyond Draft state cannot be deleted. Deleting the parent [[Product]] does not remove its Items — Items are independent records.

**Audit & history requirements:**
The Item audit object records created, updated, pending, published, and unpublished events, each with a timestamp and the attributed Actor. The revision counter provides a change sequence. Creation, update, deletion, and every state transition publish an event to the platform notification subsystem (Catalog module). Full attribute history is retained via the platform Audit Trail — see Audit: [[Audit Record]] canon.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Item unpublished while referenced in active [[Price List]]s | Item is no longer visible to Clients in the storefront. Existing [[Order]] lines and [[Agreement]]s referencing this Item are unaffected. Its Price List Items are not removed. | Client (cannot order Item) | Medium | The Vendor is responsible for managing Price List coherence after unpublishing. |
| Item unpublished while referenced on an active [[Agreement]] or [[Subscription]] | Existing Agreements and Subscriptions are unaffected. The Item simply cannot be ordered again until republished. | None | Low | — |
| Vendor submits an [[Order]] quantity the Extension considers invalid | The platform accepts the quantity. The Vendor Extension is responsible for validation during Draft Order processing, typically via a Webhook. | Vendor, Client | Medium | The platform enforces no quantity constraints (BR-006). |
| Vendor edits the Unit of Measure, Item Group, or other attributes of a Published Item | The update is applied immediately, with no state guard. The Item may already have [[Price List Item]]s or live [[Order]]s referencing it. | Client, Vendor | Medium | BR-020 permits editing in all non-terminal states. The Vendor takes responsibility for downstream consequences. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.6 | 2026-07-19 | Stu / canon-maintenance | Wikilinked the now-canonised `[[Audit Record]]` reference (Section 8) and removed the stale "pending canonisation" qualifier. No behavioural change. |
| 0.5 | 2026-07-16 | Stu / canon-generate | Full refresh via live OpenAPI schema (STAGING), live-fetched real object (multi-Actor), and source-code research. ID Prefix corrected (was "None", is ITM). §3.2 Endpoint/Verb column filled (`review`/`publish`/`unpublish`/`DELETE`), replacing "Unconfirmed — pending refresh"; new T6 transition (Unpublished→Pending via `review`, Vendor); publish/republish confirmed Operations-only, delete Vendor-only (Draft). **Terms corrections**: `terms.period` now includes `3y` (BR-009 — reverses the prior "3y not a valid period" note); `terms.commitment` now `1m/1y/2y/3y/4y/5y` (BR-010, adds 2y/4y/5y); new BR-011 documents the period↔commitment validity combinations. Unit of Measure is mutable after creation (BR-013, Section 5 — corrects prior "immutable"); Item Group is reassignable. quantityNotApplicable coupling to the usage model reframed as intended-but-unenforced (BR-012). New BR-020 (attributes mutable in all non-terminal states, no publish lock; terms/quantityNotApplicable immutable). Section 5: Audit attribute added; externalIds.operations must be null at creation and is not required to publish (BR-014, corrects a prior failure-mode framing). Section 6: Product deletion does NOT remove Items (Items are independent records) — corrects the prior cascade claim (also corrected in Product canon and preamble Invariant 6). Section 7: Item publishes notification-subsystem events; Price List Items are auto-created on an Item's first review (§7.2). Also Known As reduced to "SKU" (ITM moved to ID Prefix). |
| 0.4 | 2026-07-16 | Stu / canon-generate | Scoped correction from the Item Group refresh: BR-002 (explicit group required, no auto-assignment) and BR-003 (Item Group multiple/required advisory, not Order-time-enforced). |
| 0.3 | 2026-03-14 | Stu | Schema review against OpenAPI extract. BR-009 corrected: 3y removed from terms.period (valid for commitment only). BR-010 corrected: one-time removed from terms.commitment (valid for period only), nullable documented. Section 5: required fields on creation noted, terms enums corrected. Section 8: unpublished audit event added, history retention confirmed. Section 10 cleaned up. SD-001 raised in spec discrepancy tracker (name not in required array). |
| 0.2 | 2026-03-09 | Stu | BR-008 updated to reflect I-001 resolution (usage model → quantityNotApplicable = true, coupled). Section 10 updated. Unit of Measure references updated from earlier review. |
| 0.1 | 2026-03-08 | Stu | Initial canon. Derived from Items JSON and conversation. |
