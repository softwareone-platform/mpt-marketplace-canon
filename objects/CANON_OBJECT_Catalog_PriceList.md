# Object Canon: Price List

> **Version:** 0.4
> **Owner:** Stu
> **Last Updated:** 2026-03-14
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Price List

**Parent Object:** Catalog: Product

**Also Known As:**
PRC (API identifier prefix)

**Description:**
A Price List is a currency-scoped container that holds pricing for all Items in a Product. Each Price List is associated with exactly one Product and one currency. A Product may have multiple Price Lists — one per currency it trades in, and potentially multiple per currency for different market segments. When a Price List is created, a Price List Item is automatically created for every Item currently in the Product. Price Lists are not independently available to Clients; availability is controlled by Listings that reference them.

---

## 2. Ownership & Visibility

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
|------------|------------|----------|------------|------------|-------|
| Vendor     | Yes        | Yes*     | Yes*       | No         | *Vendor cannot read or set markup, margin, defaultMarkup, defaultMargin, or any statistics fields that reflect margin or sales pricing. See Section 5. |
| Operations | No         | Yes      | Yes        | Yes        | Full read and write access including all pricing and margin fields. Deletion subject to BR-005. |
| Client     | No         | No       | No         | No         | Clients do not interact with Price Lists directly. Pricing is surfaced via Listings. |

---

## 3. State Machine

This object has no state machine. A Price List is created and exists as a persistent container. Availability to Clients is controlled entirely by whether a Listing references this Price List and whether individual Price List Items are ForSale.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
|---------|---------------|---------------------|-------------|-------|
| BR-001 | A Price List belongs to exactly one Product and cannot be shared across Products. | N/A | All | |
| BR-002 | A Price List is scoped to exactly one currency (ISO 4217). Multiple Price Lists for the same currency may exist under a single Product. | N/A | All | e.g. separate USD Price Lists for local and global market segments. |
| BR-003 | When a Price List is created, a Price List Item is automatically created for every Item currently in the Product. All Price List Items are created in Draft status. | N/A | All | See Price List Item canon for behaviour when new Items are added to the Product after Price List creation. |
| BR-004 | A Price List may be referenced by one or more Listings. The same Price List may appear in multiple Listings. | N/A | All | |
| BR-005 | A Price List cannot be deleted while it is referenced by any Listing. All Listings referencing the Price List must be deleted before the Price List can be deleted. | N/A | Operations | Consistent with the platform no-cascade deletion invariant and deletion guard pattern. |
| BR-006 | defaultMarkup serves two roles. First, it is a billing fallback applied to a Billing: Charge during reconciliation when the Charge cannot be reconciled against a Commerce: Subscription or Commerce: Agreement (reconciliation chain: Subscription → Agreement → Price List). Second, when a Price List Item's unitLP is not supported, the platform applies defaultMarkup as the markup for that item rather than computing markup from unitLP. | N/A | All | defaultMarkup is not applied to Price List Items at creation time. It is applied per-item only when unitLP is unsupported. |
| BR-007 | defaultMargin is computed from defaultMarkup and is never stored. | N/A | All | |
| BR-008 | defaultMarkup, defaultMargin, and all margin and sales pricing statistics are not present in API responses when using a Vendor or Client token. These fields are visible to Operations only. | N/A | All | markup and margin reflect SoftwareOne's commercial position and are not disclosed to Vendors or Clients. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Visible To | Notes |
|-----------|------|-------------|--------|------------------------|------------|-------|
| currency | String | ISO 4217 currency code (e.g. USD, EUR, JPY) | Vendor | No | All | Immutable after creation. Required on creation. |
| precision | Integer | Number of decimal places for prices in this currency | Vendor | No | All | Explicitly set by Vendor on creation. Immutable after creation. Required on creation. e.g. 2 for USD/EUR/GBP, 0 for JPY. |
| notes | String | Free-text field for Vendor-authored internal documentation about this Price List | Vendor | Yes | Vendor, Operations | Optional. Absent from response when null. |
| defaultMarkup | Decimal | Fallback markup % applied during Billing: Charge reconciliation when a Charge cannot be matched to a Subscription or Agreement | Operations | Yes | Operations only | Billing fallback only — not applied to Price List Items. |
| defaultMargin | Decimal | Computed gross margin % derived from defaultMarkup | System | N/A | Operations only | Never stored. Computed on read. |
| externalIds.vendor | String | Vendor's own identifier for this Price List | Vendor | Yes | Vendor, Operations | Optional. |
| statistics.sellers | Integer | Number of Sellers associated with this Price List via Listings | System | N/A | All | Computed. Read-only. |
| statistics.listings | Integer | Number of Listings referencing this Price List | System | N/A | All | Computed. Read-only. |
| statistics.priceListItems | Integer | Total number of Price List Items in this Price List | System | N/A | All | Computed. Always equal to the total number of Items in the parent Product. |
| statistics.purchasePriceItems | Integer | Number of Price List Items with unitPP set | System | N/A | All | Computed. Read-only. |
| statistics.purchasePriceCompleteness | Decimal | Percentage of Price List Items with unitPP set | System | N/A | All | Computed. Read-only. |
| statistics.salesPriceItems | Integer | Number of Price List Items with unitSP set (i.e. with markup set) | System | N/A | Operations only | Computed. Read-only. |
| statistics.salesPriceCompleteness | Decimal | Percentage of Price List Items with unitSP set | System | N/A | Operations only | Computed. Read-only. |
| statistics.averageMarkup | Decimal | Average markup across all priced Price List Items | System | N/A | Operations only | Computed. Read-only. |
| statistics.averageMargin | Decimal | Average margin across all priced Price List Items | System | N/A | Operations only | Computed. Read-only. |
| revision | Integer | Increments on each update | System | N/A | All | |
| audit | Object | Records the `created` and `updated` events for this Price List, including timestamp and Actor reference for each | System | N/A | All | Omitted from response by default — request via `select=+audit`. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
|----------------|------------------|-------------|-------------|----------------------|
| Catalog: Product | Parent | Many:1 | A Price List belongs to exactly one Product. | Yes — Price List cannot exist without a parent Product. |
| Catalog: Price List Item | Child | One:Many | Every Item in the Product has a corresponding Price List Item in each Price List. | Yes — Price List Items cannot exist without a parent Price List. |
| Catalog: Listing | Association | Many:Many | A Price List may be referenced by one or more Listings, controlling which SoftwareOne subsidiaries can sell Items at these prices and in this currency. | Yes — a Price List cannot be deleted while any Listing references it. All referencing Listings must be deleted first. |
| Commerce: Subscription | Association | Many:Many | Used as the primary target in billing charge reconciliation. | No |
| Commerce: Agreement | Association | Many:Many | Used as the secondary fallback in billing charge reconciliation. | No |
| Billing: Charge | Association | Many:Many | defaultMarkup is applied to a Charge when it cannot be reconciled against a Subscription or Agreement. | No |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
|-------|---------|-------------------|---------------------------------|
| Price List created | Vendor creates Price List under a Product | Vendor | A Price List Item is automatically created in Draft status for every Item currently in the Product. |
| defaultMarkup updated | Operations sets or changes defaultMarkup | Operations | defaultMargin is recomputed. No effect on individual Price List Item pricing. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
|-----------------|----------------|--------------------------|------------|-----------|-------|
| New Item added to Product | Price List Item | A new Price List Item is created in Draft status in every Price List under the Product | Yes | Always — occurs whenever a new Item is created under the Product | Ensures Price List Items always mirror the full Product Item catalogue. |
| Billing: Charge reconciliation fails against Subscription and Agreement | Billing: Charge | defaultMarkup is applied to the Charge | Yes | Charge cannot be matched to a Subscription or Agreement | Price List acts as the last resort in the reconciliation fallback chain. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Not applicable — this object has no state machine.

**Deletion:**
- Price Lists may be deleted by Operations, subject to BR-005 (no Listings may reference the Price List). Once deleted, permanently removed — no longer retrievable via the API.
- Vendors cannot delete Price Lists.
- ⚠️ **Exception to platform norm:** Price List deletion is a hard delete. This is an explicitly confirmed exception to Platform Invariant 7, which defines deletion as meaning "no longer retrievable via the API" but makes no claim about physical retention. For Price Lists, no physical retention occurs. No audit record is generated on deletion.

**Audit & history requirements:**
The audit block records `created` and `updated` events. No audit record is generated on deletion — consistent with the hard delete model. Prior attribute values are not retained beyond the audit trail.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
|----------|--------------------------|---------------|------------|-------|
| Price List created for a currency already used by another Price List under the same Product | Second Price List created successfully. No constraint prevents multiple Price Lists per currency. | Vendor | Low | Vendor is responsible for managing which Price List is referenced by which Listing. |
| Price List referenced by a Listing but has no ForSale Price List Items | Price List and Listing exist. No Items are available for purchase by Clients. | Client | Medium | Vendor is responsible for ensuring Price List Items are priced and ForSale before the Listing is made available to Clients. |
| Operations attempts to delete a Price List that is still referenced by one or more Listings | Action is blocked. The Price List cannot be deleted while any Listing references it. | Operations | N/A | All referencing Listings must be deleted first. See BR-005. |
| Billing: Charge cannot be reconciled against Subscription, Agreement, or Price List | Behaviour not defined in this canon — outside scope of Price List object. | Operations | High | The Price List is the last resort in the reconciliation chain. Behaviour beyond this point is a Billing namespace concern. |

---

## 10. Open Questions

No open questions specific to this object at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2026-03-09 | Stu / Claude | Initial canon. |
| 0.2 | 2026-03-09 | Stu / Claude | BR-006 updated — defaultMarkup documented as serving dual role: billing fallback and item-level markup default when unitLP unsupported. |
| 0.3 | 2026-03-09 | Stu / Claude | LST-001 resolved — Price Lists can be deleted by Operations when not referenced by any Listings. BR-005 corrected from absolute prohibition to deletion guard. Ownership table, Section 6 lifecycle dependency, Section 8 deletion, and Section 9 failure mode all updated accordingly. |
| 0.4 | 2026-03-14 | Stu / Claude | Section 5: `precision` corrected — Vendor-set on creation, not system-derived from currency; marked as required on creation. `notes` added — optional Vendor-authored free-text, absent when null. `audit` block added — omitted by default, retrievable via `select=+audit`. Section 8: deletion updated to document hard delete as confirmed exception to platform norm; audit events corrected to `created` and `updated` only — `deleted` removed (no audit record generated on deletion). |
