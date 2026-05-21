# Object Canon: Item

> **Version:** 0.3
> **Owner:** Stu
> **Last Updated:** 2026-03-14
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Item

**Namespace:** Catalog

**Parent Object:** Catalog: Product

**ID Prefix:** None.

**Description:**
An Item is a vendor-defined orderable unit within a Product. Items represent the full union of all orderable SKUs across all regions and currencies for that Product. Whether a given Item is available for sale in a given currency is controlled by the Price List; whether a Price List is available through a given SoftwareOne subsidiary is controlled by the Listing. Items carry commercial terms (billing model, period, commitment) and are ordered with an integer quantity. At scale, Item catalogues are typically managed by Vendor Extensions rather than manually.

---

**Also Known As:**
ITM (API identifier prefix); SKU

---

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes | Yes | Yes | Yes | Full lifecycle ownership of Item definitions. At scale, Item creation and management is typically automated via Vendor Extension. |
| Operations | No | Yes | Yes* | No | *Operations can set externalIds.operations (the SoftwareOne ERP part number). Cannot otherwise update Item definitions. |
| Client | No | Yes** | No | No | **Clients see Published Items only, filtered to those available in their Listing's Price List. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Draft | Item created but not yet submitted for publishing. Visible to Vendor and Operations. Not visible to Client. | Yes | No |
| Pending | Vendor has submitted Item for review. Awaiting Operations approval to publish. | No | No |
| Published | Item is live. Visible to Client subject to Price List availability. | No | No |
| Unpublished | Item has been withdrawn. Visible to Vendor and Operations. Not visible to Client. | No | No |
| Deleted | Item hard-deleted from Draft state. Permanently removed — no longer retrievable via the API. | No | Yes |

### 3.2 Transitions

| # | From State | To State | Action / Trigger | Permitted Actor(s) | Preconditions | Outcome / Side Effects |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Draft | Create Item | Vendor | None | Item created under Product. Auto-assigned to Default Item Group if no group specified. |
| T2 | Draft | Pending | Submit Item for Publishing | Vendor | None | Item awaiting Operations review. |
| T3 | Pending | Published | Approve and Publish Item | Operations | None | Item available for inclusion in Price Lists and ordering by Clients. |
| T4 | Published | Unpublished | Unpublish Item | Vendor, Operations | None | Item withdrawn from Client visibility. |
| T5 | Unpublished | Published | Re-publish Item | Operations | None | Item restored to Client visibility. |
| T6 | Draft | Deleted | Delete Item | Vendor | Item must be in Draft state | Permanently removed — no longer retrievable via the API. |

### 3.3 State Diagram

```
             T2 (Vendor)         T3 (Operations)
[Draft] ----------------> [Pending] ----------------> [Published]
  |                                                        |    ^
  | T6 (Vendor)                          T4 (Vendor/Ops)  |    | T5 (Operations)
  v                                                        v    |
[Deleted]                                            [Unpublished]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An Item belongs to exactly one Product and cannot be shared across Products. | All | All | — |
| BR-002 | An Item belongs to an Item Group. If no group is specified on creation, the Item is automatically assigned to the Default Item Group. | All | All | Consistent with Item Group canon. |
| BR-003 | Item Group flags (multiple, required) are enforced by the platform at Order submission. This is one of the few places where the platform itself enforces constraints rather than delegating to the Vendor Extension. | All | All | See Item Group canon for full detail. |
| BR-004 | Product Items represent the full union of all orderable SKUs across all regions and currencies. Availability of an Item for sale in a given currency is controlled by the Price List, not by the Item itself. | All | All | — |
| BR-005 | Items are ordered with an integer quantity. Fractional quantities are not supported. | All | All | — |
| BR-006 | Item quantity constraints (min, max) are not enforced by the platform. Quantity validation is the responsibility of the Vendor Extension, typically during Draft Order validation. | All | All | The platform has no opinion on whether a given quantity is commercially valid. |
| BR-007 | An Item has commercial terms comprising a billing model, a billing period, and a commitment period. These are set by the Vendor and are immutable after creation. | All | Vendor | — |
| BR-008 | Valid terms.model values are: quantity, usage, one-time. The quantity model bills per unit of quantity. The usage model bills based on consumption — when terms.model = usage, quantityNotApplicable is always true (these are coupled; setting usage model implies quantity is not applicable). The one-time model represents a single non-recurring charge. | All | All | — |
| BR-009 | Valid terms.period values are: 1m, 1y, one-time. Period represents the billing cycle. | All | All | Note: 3y is not a valid period value — it is only valid for commitment. |
| BR-010 | Valid terms.commitment values are: 1m, 1y, 3y. Commitment is nullable — when absent, no minimum contractual term applies. Commitment represents the minimum contractual term. Period and commitment may differ — for example, a 1-month billing period with a 1-year commitment is valid. | All | All | Note: one-time is not a valid commitment value — it is only valid for period. |
| BR-011 | When quantityNotApplicable is true, quantity is not relevant for this Item and is not collected or displayed. When terms.model = usage, quantityNotApplicable is always true — the two are coupled. | All | All | — |
| BR-012 | An Item has a Unit of Measure that describes what is being counted or measured (e.g. User, Licenses, Gigabytes). Units of Measure are platform-level reference objects scoped to the Catalog namespace; Vendors select from the available set when creating an Item. | All | Vendor | See CANON_OBJECT_Catalog_UnitOfMeasure.md. |
| BR-013 | An Item has two external ID namespaces: externalIds.vendor (set by the Vendor — the vendor's own SKU identifier) and externalIds.operations (set by Operations — the SoftwareOne ERP part number). These are managed independently by different Actors. | All | Vendor, Operations | externalIds.vendor is set by the Vendor. externalIds.operations is set by Operations. |
| BR-014 | Item creation, modification, and deletion are not restricted by the state of the parent Product. | All | Vendor | Consistent with platform permissiveness philosophy. |
| BR-015 | Item-scoped Parameters store Vendor-defined metadata about an Item. They are surfaced in the Items list during ordering and are filterable by Clients (e.g. a "Product Family" parameter with values "Document Cloud" / "Creative Cloud"). The only available constraint for Item-scoped Parameters is required. See Parameter canon BR-022. | All | Vendor | — |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| Name | String | Display name of the Item | Vendor | Yes | Required on creation. |
| Description | String | Description of the Item | Vendor | Yes | Optional on creation. |
| externalIds.vendor | String | Vendor's own SKU identifier for this Item | Vendor | Yes | Required on creation. |
| externalIds.operations | String | SoftwareOne ERP part number for this Item | Operations | Yes | Optional — set by Operations independently of Vendor. |
| Group | Reference | The Item Group this Item belongs to | Vendor | Yes | Required on creation. Auto-assigned to Default group if not specified at creation. |
| Unit of Measure | Reference | Platform-defined unit describing what is being counted or measured (e.g. User, Licenses, Gigabytes) | Vendor | No | Required on creation. Immutable after creation. References a platform-level Catalog: Unit of Measure object. |
| terms.model | Enum | One of: quantity, usage, one-time | Vendor | No | Required on creation. Immutable after creation. |
| terms.period | Enum | One of: 1m, 1y, one-time | Vendor | No | Required on creation. Immutable after creation. Note: 3y is not a valid period value. |
| terms.commitment | Enum | One of: 1m, 1y, 3y. Nullable. | Vendor | No | Required on creation. Immutable after creation. Nullable — when absent, no minimum contractual term applies. Note: one-time is not a valid commitment value. |
| quantityNotApplicable | Boolean | When true, quantity is not relevant for this Item and is not collected or displayed. Always true when terms.model = usage. | Vendor | No | Immutable after creation. |
| Parameters | Collection | Item-scoped Parameter instances. Rarely used. | Vendor | Yes | See Parameter canon. |
| Status | Enum | One of: Draft, Pending, Published, Unpublished | System | Via state transitions only | — |
| Revision | Integer | Increments on each update | System | N/A | Read-only. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Product | Parent | Many:1 | An Item belongs to exactly one Product. | Yes — Item cannot exist without a parent Product. |
| Catalog: Product Item Group | Parent | Many:1 | An Item belongs to an Item Group. Auto-assigned to Default group if none specified. | Yes — deletion of an Item Group is blocked while it contains Items. |
| Catalog: Price List | Association | Many:Many | Price Lists reference Items to define which Items are available in a given currency and at what price. | No — Item state changes do not cascade to Price Lists. |
| Commerce: Order | Association | Many:Many | Orders contain lines referencing Items with integer quantities. Change Orders carry both old and new quantities per line. Configuration Orders reference Items linked to existing Subscriptions. | No |
| Catalog: Product Parameter | Association | Many:Many | Item-scoped Parameters may be associated with Items. | No |
| Catalog: Unit of Measure | Reference | Many:1 | An Item references a platform-level Unit of Measure object describing what is being counted or measured. | No — Unit of Measure cannot be deleted, so no orphan risk. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Item created | Vendor creates Item under a Product | Vendor | Item enters Draft state. Auto-assigned to Default Item Group if no group specified. |
| Item submitted | T2 — Draft to Pending | Vendor | Item awaiting Operations review. |
| Item published | T3 — Pending to Published | Operations | Item becomes available for inclusion in Price Lists and for ordering by Clients via appropriate Listing. |
| Item unpublished | T4 — Published to Unpublished | Vendor, Operations | Item withdrawn from Client visibility. Existing Order lines referencing this Item are unaffected. |
| Item re-published | T5 — Unpublished to Published | Operations | Item restored to Client visibility. |
| externalIds.operations set | Operations sets ERP part number | Operations | Operations part number written to Item. Vendor's externalIds.vendor is unaffected. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
- Published → Unpublished → Published (via Operations re-publish)

**Deletion:**
- Draft Items may be deleted by the Vendor. Once deleted, permanently removed — no longer retrievable via the API.
- Items beyond Draft state cannot be deleted.

**Audit & history requirements:**
Audit block captures `created`, `updated`, `pending`, `published`, and `unpublished` timestamps and Actors. Full attribute history is retained via the platform Audit Trail.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Item unpublished while referenced in active Price Lists | Item is no longer visible to Clients in the storefront. Existing Order lines and Agreements referencing this Item are unaffected. | Client (cannot order Item) | Medium | Vendor is responsible for managing Price List coherence after unpublishing. |
| Item unpublished while referenced on an active Agreement or Subscription | Existing Agreements and Subscriptions are unaffected. The Item simply cannot be ordered again until re-published. | None | Low | — |
| Vendor submits an Order quantity the Extension considers invalid | The platform accepts the quantity. The Vendor Extension is responsible for validation during Draft Order processing, typically via a Webhook. | Vendor, Client | Medium | Platform has no quantity constraints — validation is entirely Extension-managed. |
| externalIds.operations not set | Item has no SoftwareOne ERP reference. Operational processes that depend on this field (e.g. billing, procurement) may fail or require manual intervention. | Operations | Medium | Platform does not require this field to be set. |

---

## 10. Open Questions

No open questions at this time.
---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-03-08 | Stu | Initial canon. Derived from Items JSON and conversation. |
| 0.2 | 2026-03-09 | Stu | BR-008 updated to reflect I-001 resolution (usage model → quantityNotApplicable = true, coupled). Section 10 updated. Unit of Measure references updated from earlier review. |
| 0.3 | 2026-03-14 | Stu | Schema review against OpenAPI extract. BR-009 corrected: 3y removed from terms.period (valid for commitment only). BR-010 corrected: one-time removed from terms.commitment (valid for period only), nullable documented. Section 5: required fields on creation noted, terms enums corrected. Section 8: unpublished audit event added, history retention confirmed. Section 10 cleaned up. SD-001 raised in spec discrepancy tracker (name not in required array). |
