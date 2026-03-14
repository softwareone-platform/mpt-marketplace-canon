# Object Canon: Price List Item

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-03-09
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Price List Item

**Parent Object:** Catalog: Price List

**Also Known As:**
PRI (API identifier prefix)

**Description:**
A Price List Item is the pricing record for one Catalog: Product Item within one Catalog: Price List. Price List Items are created automatically — one per Product Item — whenever a Price List is created, and again whenever a new Product Item is added to the Product. They are never created manually. A Price List Item carries the purchase price (what SoftwareOne pays the Vendor), the list price (the Vendor's RRP), and the markup (from which the sales price to the Client is derived). It also carries optional display information for the Client. Price List Items progress from Draft to either ForSale or Private, controlling whether the Item is available for new purchases, change orders, or neither.

---

## 2. Ownership & Visibility

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
|------------|------------|----------|------------|------------|-------|
| Vendor     | No         | Yes*     | Yes*       | No         | *Vendor can read and set unitLP and unitPP only. markup, margin, unitSP, and all derived SP fields are not present in Vendor API responses. Vendor can set info.visible and info.description. |
| Operations | No         | Yes      | Yes        | No         | Full read and write access to all fields. |
| Client     | No         | Yes**    | No         | No         | **Client sees unitSP and period-normalised SP variants only, plus info fields, on Items that are ForSale and referenced via an active Listing. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
|-------|-------------|---------------|-----------------|
| Draft | Price List Item created. Pricing may or may not be set. Not available for purchase or change orders. | Yes | No |
| ForSale | Item is available for new purchases and change orders by Clients via an active Listing. | No | No |
| Private | Item is available for change orders only. Not available for new purchases. Used to onboard existing customer subscriptions onto the platform without opening the Item for new sales. | No | No |

### 3.2 Transitions

| # | From | To | Action / Trigger | Permitted Actor(s) | Preconditions | Notes |
|---|------|----|-----------------|-------------------|---------------|-------|
| T1 | — | Draft | Price List created, or new Product Item added to Product | System | None | Created automatically. Never manually. |
| T2 | Draft | ForSale | Set status to ForSale | Vendor, Operations | None | Pricing not required. |
| T3 | Draft | Private | Set status to Private | Vendor, Operations | None | For migrating existing business onto platform. |
| T4 | ForSale | Private | Set status to Private | Vendor, Operations | None | Withdraws Item from new purchases. |
| T5 | Private | ForSale | Set status to ForSale | Vendor, Operations | None | Restores full availability. |

> **Note:** Transitions out of Draft are irreversible. A Price List Item cannot return to Draft once it has moved to ForSale or Private.

### 3.3 State Diagram

```
                    T2 (Vendor/Ops)
          ┌─────────────────────────────► [ForSale]
          │                                   ▲  │
[Draft] ──┤                              T5   │  │ T4
          │                                   │  ▼
          └─────────────────────────────► [Private]
                    T3 (Vendor/Ops)
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
|---------|---------------|---------------------|-------------|-------|
| BR-001 | A Price List Item is created automatically for every Product Item when a Price List is created. Price List Items are never created manually. | N/A | All | |
| BR-002 | When a new Product Item is added to a Product, a Price List Item in Draft status is automatically created in every Price List under that Product. | N/A | All | Ensures Price List Items always mirror the full Product Item catalogue. |
| BR-003 | Price List Items cannot be deleted. | N/A | All | |
| BR-004 | The transition from Draft to ForSale or Private is irreversible. A Price List Item cannot return to Draft. | N/A | All | |
| BR-005 | A ForSale Price List Item is available for new purchases and change orders, subject to the corresponding Product Item being Published and the Price List being referenced by an active Listing. | ForSale | All | |
| BR-006 | A Private Price List Item is available for change orders only. It is not available for new purchases. | Private | All | Used to migrate existing customer subscriptions onto the platform without opening the Item for new sales. |
| BR-007 | A Draft Price List Item is not available for purchase or change orders regardless of Product Item state. | Draft | All | |
| BR-008 | If a Product Item is Unpublished, it is unavailable for both new purchases and change orders regardless of Price List Item status. Product Item Unpublished overrides Price List Item ForSale or Private. | All | All | Effective availability is the intersection of Product Item state and Price List Item status. See Catalog: Product Item canon. |
| BR-009 | unitLP and unitPP are independently optional. Each has a "Supported" flag. When not supported, the field is absent from API responses. To clear a supported field and mark it unsupported, write null. unitLP can be unsupported while unitPP is supported, and vice versa. | All | All | |
| BR-010 | Whether unitLP and unitPP are present depends on the Supported flag, not on terms.model. For usage items, unitLP and unitPP may be set to zero (0) or absent depending on whether the Vendor's pricing model is known at time of sale. For items where pricing is not known until billing time, pricing fields are absent and the Vendor provides pricing via a Billing: Journal entry at billing time. | All | All | |
| BR-011 | markup is the stored source of truth for SoftwareOne's margin on a Price List Item. unitSP is never stored — it is computed as unitPP * (1 + markup). | All | All | |
| BR-012 | When a Vendor sets unitLP and unitPP, the platform automatically sets markup such that unitSP = unitLP. The default sales price to the Client is therefore the Vendor's RRP. Since unitPP is typically below unitLP, SoftwareOne retains margin at this default. Operations may subsequently adjust markup. When unitLP is not supported, the platform uses defaultMarkup from the parent Price List as the markup for this item instead. | All | Vendor, Operations | The platform default is pass-through pricing at RRP when unitLP is present. When unitLP is absent, defaultMarkup from the Price List is the fallback. Operations adjusts markup from either baseline per commercial strategy. |
| BR-013 | markup, margin, unitSP, and all derived SP fields (SPxM, SPxY, SPx1) are not present in API responses when using a Vendor or Client token. These fields are visible to Operations only. | All | All | markup and margin reflect SoftwareOne's commercial position and are not disclosed to Vendors or Clients. |
| BR-014 | All period-normalised pricing fields are computed from their respective unit prices and the terms.period of the associated Product Item. They are never stored. The applicable fields depend on terms.period: xM and xY variants for 1m, 1y, and 3y items; x1 variants for one-time items. | All | All | |
| BR-015 | All unit prices (unitLP, unitPP, unitSP) represent the price for one terms.period duration of the associated Product Item — not an assumed annual price. | All | All | e.g. for a 3-year Item, unitPP is the 3-year price. PPxY = unitPP / 3. PPxM = unitPP / 36. |
| BR-016 | info.visible controls whether info.description is rendered and shown to the Client. When info.visible = false, the description is not shown regardless of whether it is populated. info.visible applies to info.description only — it has no effect on Item availability, pricing visibility, or status. | All | All | |
| BR-017 | info.description has a maximum length of 400 characters including all markdown/html tags. | All | Vendor, Operations | |
| BR-018 | When info.visible = true and info.description is populated, a Client sees a circle-i icon next to the Item in the Price List. Hovering over the icon reveals the description. Applies to both ForSale items (new purchase context) and Private items (change order item selection context). Not shown for Draft items. | ForSale, Private | Client | |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Visible To | Notes |
|-----------|------|-------------|--------|------------------------|------------|-------|
| status | Enum | One of: Draft, ForSale, Private | Vendor, Operations | Yes — via state transitions only | All | Draft → ForSale or Private is irreversible. |
| name | String | System-generated identifier. Always identical to id. | System | No | All | Carries no independent semantic value. |
| unitLP | Decimal | Vendor's List Price (RRP) for one terms.period unit | Vendor, Operations | Yes | Vendor, Operations | Optional — controlled by Supported flag. Absent from response when not supported. Write null to clear and mark unsupported. |
| unitPP | Decimal | Purchase Price — what SoftwareOne pays the Vendor for one terms.period unit | Vendor, Operations | Yes | Vendor, Operations | Optional — controlled by Supported flag. Absent from response when not supported. Write null to clear and mark unsupported. |
| markup | Decimal | SoftwareOne's markup % applied to unitPP to derive unitSP | Operations | Yes | Operations only | Stored. Source of truth for SP. Automatically set by platform when Vendor sets unitLP/unitPP (defaulting to unitSP = unitLP). |
| unitSP | Decimal | Sales Price — what the Client pays SoftwareOne for one terms.period unit. Computed: unitPP * (1 + markup). | System | N/A | Client, Operations | Never stored. Computed on read. |
| margin | Decimal | Gross margin % derived from markup | System | N/A | Operations only | Never stored. Computed on read. |
| PPxM | Decimal | unitPP normalised to one month | System | N/A | Vendor, Operations | Computed. Present for 1m, 1y, 3y items only. |
| PPxY | Decimal | unitPP normalised to one year | System | N/A | Vendor, Operations | Computed. Present for 1m, 1y, 3y items only. |
| SPxM | Decimal | unitSP normalised to one month | System | N/A | Client, Operations | Computed. Present for 1m, 1y, 3y items only. |
| SPxY | Decimal | unitSP normalised to one year | System | N/A | Client, Operations | Computed. Present for 1m, 1y, 3y items only. |
| LPxM | Decimal | unitLP normalised to one month | System | N/A | Vendor, Operations | Computed. Present for 1m, 1y, 3y items only. |
| LPxY | Decimal | unitLP normalised to one year | System | N/A | Vendor, Operations | Computed. Present for 1m, 1y, 3y items only. |
| PPx1 | Decimal | unitPP for one-time items | System | N/A | Vendor, Operations | Computed. Present for one-time items only. |
| SPx1 | Decimal | unitSP for one-time items | System | N/A | Client, Operations | Computed. Present for one-time items only. |
| LPx1 | Decimal | unitLP for one-time items | System | N/A | Vendor, Operations | Computed. Present for one-time items only. |
| info.visible | Boolean | Controls whether info.description is shown to the Client | Vendor, Operations | Yes | All | Default: false. Scoped to info.description only — no effect on availability or pricing. |
| info.description | String | Optional markdown/html content providing the Client with additional pricing or billing context for this Item | Vendor, Operations | Yes | All (when info.visible = true) | Max 400 characters including tags. Rendered as a tooltip (circle-i icon) in the Client UI. |
| revision | Integer | Increments on each update | System | N/A | All | |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
|----------------|------------------|-------------|-------------|----------------------|
| Catalog: Price List | Parent | Many:1 | A Price List Item belongs to exactly one Price List. | Yes — Price List Item cannot exist without a parent Price List. |
| Catalog: Product Item | Mirror | One:1 | Each Price List Item permanently mirrors exactly one Product Item within the same Product. | Yes — Price List Item is created in permanent correspondence with its Product Item. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
|-------|---------|-------------------|---------------------------------|
| Price List Item created | Price List created, or new Product Item added to Product | System | Price List Item enters Draft status. No pricing fields are set. |
| unitLP / unitPP set by Vendor | Vendor sets list and/or purchase price | Vendor | Platform automatically sets markup such that unitSP = unitLP. unitSP, margin, and all normalised pricing fields are recomputed. |
| markup set or adjusted by Operations | Operations sets or changes markup | Operations | unitSP, margin, and all normalised SP fields are recomputed. |
| Status set to ForSale | T2 or T5 | Vendor, Operations | Item available for new purchases and change orders via active Listings. audit.published recorded. |
| Status set to Private | T3 or T4 | Vendor, Operations | Item restricted to change orders only. Not available for new purchases. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect | Automated? | Condition | Notes |
|-----------------|----------------|--------|------------|-----------|-------|
| Product Item Unpublished | Price List Item | Item becomes effectively unavailable for new purchases and change orders regardless of Price List Item status. Price List Item status is unchanged. | Yes | Always when Product Item is Unpublished | Product Item state overrides Price List Item status. Re-publishing the Product Item restores effective availability without requiring a Price List Item status change. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
- ForSale ↔ Private (bidirectional)

**Irreversible transitions:**
- Draft → ForSale (cannot return to Draft)
- Draft → Private (cannot return to Draft)

**Deletion:**
- Price List Items cannot be deleted.

**Audit & history requirements:**
The audit block records `created`, `updated`, and `published` events. `published` is recorded when the item first transitions to ForSale.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
|----------|--------------------------|---------------|------------|-------|
| Price List Item set to ForSale with no pricing set | Transition succeeds. Item is available for purchase but has no prices. Client experience and ordering behaviour in this state is not yet confirmed. | Client | High | Platform does not require pricing to be set before ForSale transition. Vendor is responsible for ensuring pricing is complete before making Items available. |
| unitLP not supported but unitPP is supported | Permitted. Vendor sets cost price without an RRP reference. Platform uses defaultMarkup from the parent Price List as the markup for this item (per Price List BR-006). | Vendor | Low | |
| info.description populated but info.visible = false | Description is stored but not shown to Client. No error. | None | Low | Intentional — allows Vendor to stage content before choosing to surface it. |
| Product Item Unpublished while Price List Item is ForSale | Price List Item status remains ForSale but Item is effectively unavailable. Re-publishing the Product Item restores availability without a Price List Item status change. | Client | Medium | Status reflects Vendor intent; effective availability is the intersection of Product Item state and Price List Item status. |

---

## 10. Open Questions

See CANON_OPEN_QUESTIONS.md for tracked open questions:

---

## 11. Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2026-03-09 | Stu | Initial canon. |
| 0.2 | 2026-03-09 | Stu | BR-012 updated with defaultMarkup fallback when unitLP unsupported. BR-018 updated to include Private items. name attribute added. |
