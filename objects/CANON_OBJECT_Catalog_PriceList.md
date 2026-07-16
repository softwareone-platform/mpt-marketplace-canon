# Object Canon: Price List

> **Version:** 0.5
> **Owner:** Stu
> **Last Updated:** 2026-07-16
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Price List

**Namespace:** Catalog

**Parent Object:** Catalog: Product

**ID Prefix:** PRC

**Description:**
A Price List is a currency-scoped container that holds pricing for all Items in a [[Product]]. Each Price List is associated with exactly one [[Product]] and one currency. A [[Product]] may have multiple Price Lists — one per currency it trades in, and potentially multiple per currency for different market segments. When a Price List is created, a [[Price List Item]] is created for every reviewed Item currently in the [[Product]]. A Client can read a Price List only through an eligible [[Listing]] relationship; the Price List itself is never independently marketed to Clients.

**Also Known As:**
None known.

---

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes | Yes* | Yes* | Yes** | *Vendor cannot see `defaultMarkup`, `defaultMargin`, or the margin/sales-pricing statistics, and cannot set `defaultMarkup`/`defaultMargin` (see BR-006, BR-008). **Only the owning Vendor may delete, subject to BR-005. |
| Operations | No | Yes | Yes | Yes | Full read and write access including all pricing and margin fields. Deletion subject to BR-005. |
| Client | No | Yes* | No | No | *Scoped read only — a Client sees a Price List solely via an eligible [[Listing]] relationship (see BR-009). All margin fields and the entire statistics block are suppressed. |

---

## 3. State Machine

This object has no state machine. A Price List is created and exists as a persistent container. Availability to Clients is controlled entirely by whether a [[Listing]] references this Price List and whether individual Price List Items are ForSale.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Price List belongs to exactly one [[Product]] and cannot be shared across Products. | N/A | All | — |
| BR-002 | A Price List is scoped to exactly one currency (ISO 4217). Multiple Price Lists for the same currency may exist under a single [[Product]]. | N/A | All | e.g. separate USD Price Lists for local and global market segments. |
| BR-003 | When a Price List is created, a [[Price List Item]] is created for every Item in the parent [[Product]] that has been submitted for review at least once (i.e. every Item past Draft). Each new Price List Item is created in Draft status. | N/A | All | Draft Items are not included at creation. Items are added later on first review — see BR-004 and [[Price List Item]] canon. |
| BR-004 | When an Item in the [[Product]] is submitted for review for the first time (its first Draft→Pending transition), a [[Price List Item]] is created in Draft status in every existing Price List under that [[Product]]. | N/A | All | Ensures Price List Items mirror the [[Product]]'s reviewed Item catalogue. Not triggered by Item creation. |
| BR-005 | A Price List cannot be deleted while it is referenced by any [[Listing]]. All Listings referencing the Price List must be deleted before it can be deleted. | N/A | Vendor, Operations | Deletion guard (preamble §3.5). Applies to both the owning Vendor and Operations. |
| BR-006 | `defaultMarkup` and `defaultMargin` are set and readable by Operations only. A Vendor cannot set either field; a Vendor-created Price List receives a system-assigned default markup. | N/A | Operations | `defaultMarkup`/`defaultMargin` reflect SoftwareOne's commercial position (see BR-008). |
| BR-007 | `defaultMarkup` and `defaultMargin` are both stored. When only one is supplied, the other is derived from it (`defaultMargin` = `defaultMarkup` / (100 + `defaultMarkup`) × 100). On update, supplying both requires them to be mutually consistent or the update is rejected. | N/A | Operations | Margin and markup are a linked pair. See Section 9 for the create-time consistency edge case. |
| BR-008 | `defaultMarkup`, `defaultMargin`, and the margin/sales-pricing statistics are suppressed for Vendor and Client tokens; the entire statistics block is suppressed for Client tokens. | N/A | All | markup and margin reflect SoftwareOne's commercial position and are not disclosed to Vendors or Clients. See Section 5 for the per-field breakdown. |
| BR-009 | A Client can read a Price List only when all of the following hold: the parent [[Product]] is Published; a [[Listing]] that references the Price List is offered by a [[Seller]] for which the Client is an active [[Buyer]]; that Buyer has an active [[ErpLink]] to the Seller; and the Client's eligibility matches the Listing's. | N/A | Client | Client access is always mediated by an eligible Listing — there is no direct Client access to a Price List. |
| BR-010 | `defaultMarkup` is carried onto an [[Order]] created against the [[Product]] as a fallback markup, used when item-level purchase/sale pricing is unavailable to derive estimated pricing. | N/A | All | Cross-object effect on Commerce: [[Order]] pricing. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| currency | String | ISO 4217 currency code (e.g. USD, EUR, JPY) | Vendor | No | Visible To: All. Required on creation. Immutable. |
| precision | Integer | Number of decimal places for prices in this currency | Vendor | No | Visible To: All. Required on creation. Immutable. e.g. 2 for USD/EUR/GBP, 0 for JPY. |
| notes | String | Free-text field for Vendor-authored internal documentation about this Price List | Vendor | Yes | Visible To: All. Optional. Absent from response when null. |
| defaultMarkup | Decimal | Default markup % for the Price List | Operations | Yes | Visible To: Operations only. Vendor cannot set (see BR-006). Vendor-created lists receive a system-assigned default. |
| defaultMargin | Decimal | Default gross margin %, the linked counterpart of `defaultMarkup` | Operations | Yes | Visible To: Operations only. Stored; derived from `defaultMarkup` when only markup is supplied (see BR-007). |
| externalIds.vendor | String | Vendor's own identifier for this Price List | Vendor | Yes | Visible To: All. Optional. |
| product | Object (ProductRef) | Reference to the parent [[Product]] | System | No | Visible To: All. Summary reference (id, name, icon, status, externalIds). |
| vendor | Object (AccountRef) | Reference to the owning Vendor account | System | No | Visible To: All. Summary reference (id, name, icon, type, status). |
| statistics.sellers | Integer | Number of Sellers associated with this Price List via Listings | System | N/A | Visible To: Vendor, Operations. Computed. |
| statistics.listings | Integer | Number of Listings referencing this Price List | System | N/A | Visible To: Vendor, Operations. Computed. |
| statistics.priceListItems | Integer | Total number of Price List Items in this Price List | System | N/A | Visible To: Vendor, Operations. Computed. |
| statistics.purchasePriceItems | Integer | Number of Price List Items with unitPP set | System | N/A | Visible To: Vendor, Operations. Computed. |
| statistics.purchasePriceCompleteness | Integer | Percentage of Price List Items with unitPP set | System | N/A | Visible To: Vendor, Operations. Computed. Truncated integer percentage. |
| statistics.salesPriceItems | Integer | Number of Price List Items with unitSP set | System | N/A | Visible To: Operations only. Computed. |
| statistics.salesPriceCompleteness | Integer | Percentage of Price List Items with unitSP set | System | N/A | Visible To: Operations only. Computed. Truncated integer percentage. |
| statistics.averageMarkup | Decimal | Average markup across all priced Price List Items | System | N/A | Visible To: Operations only. Computed. |
| statistics.averageMargin | Decimal | Average margin across all priced Price List Items | System | N/A | Visible To: Operations only. Computed. |
| statistics | Object | Container of computed platform metrics (sub-fields above). | System | N/A | Visible To: Vendor, Operations. The entire block is suppressed for Client tokens. |
| revision | Integer | Increments on each update | System | N/A | Visible To: All. |
| audit | Object | Records the `created` and `updated` events for this Price List, including timestamp and Actor reference for each | System | N/A | Visible To: All. Returned by default. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Product | Parent | Many:1 | A Price List belongs to exactly one Product. | Yes — Price List cannot exist without a parent Product. |
| Catalog: Price List Item | Child | One:Many | Every reviewed Item in the Product has a corresponding Price List Item in each Price List. | Yes — Price List Items cannot exist without a parent Price List. |
| Catalog: Listing | Association | Many:Many | A Price List may be referenced by one or more Listings, controlling which SoftwareOne subsidiaries can sell Items at these prices and in this currency, and mediating Client read access. | Yes — a Price List cannot be deleted while any Listing references it. All referencing Listings must be deleted first. |
| Commerce: Order | Association | Many:Many | `defaultMarkup` is carried onto an Order created against the Product as a fallback for estimated pricing (BR-010). | No |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Price List created | Vendor creates Price List under a [[Product]] | Vendor | A [[Price List Item]] is created in Draft status for every reviewed Item (past Draft) currently in the Product. |
| defaultMarkup updated | Operations sets or changes `defaultMarkup` | Operations | `defaultMargin` is recomputed to stay consistent. No effect on individual Price List Item pricing. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Item submitted for review for the first time | Price List Item | A new [[Price List Item]] is created in Draft status in every Price List under the [[Product]] | Yes | On the Item's first Draft→Pending transition only | Ensures Price List Items mirror the Product's reviewed Item catalogue. |
| Order created against the Product | Commerce: Order | `defaultMarkup` is copied onto the [[Order]]'s pricing as a fallback for estimates | Yes | Order created while the Price List applies | Used only when item-level pricing is unavailable (BR-010). |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Not applicable — this object has no state machine.

**Deletion:**
- Price Lists may be deleted by the owning Vendor or by Operations, subject to BR-005 (no [[Listing]] may reference the Price List). Once deleted, permanently removed — no longer retrievable via the API.
- Clients cannot delete Price Lists.

**Audit & history requirements:**
The audit block records `created` and `updated` events, returned by default. Prior attribute values are not retained beyond the audit trail.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Price List created for a currency already used by another Price List under the same [[Product]] | Second Price List created successfully. No constraint prevents multiple Price Lists per currency. | Vendor | Low | Vendor is responsible for managing which Price List is referenced by which [[Listing]]. |
| Price List referenced by a [[Listing]] but has no ForSale Price List Items | Price List and Listing exist. No Items are available for purchase by Clients. | Client | Medium | Vendor is responsible for ensuring Price List Items are priced and ForSale before the Listing is made available to Clients. |
| Operations attempts to delete a Price List still referenced by one or more Listings | Action is blocked. The Price List cannot be deleted while any [[Listing]] references it. | Operations | N/A | All referencing Listings must be deleted first. See BR-005. |
| Operations supplies both `defaultMarkup` and `defaultMargin` with inconsistent values on creation | The mismatched pair is accepted and stored as-is at creation time; the same mismatch is rejected on update. | Operations | Medium | Create does not enforce the markup/margin consistency check that update applies (BR-007). |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.5 | 2026-07-16 | Stu / canon-generate | Major refresh via live OpenAPI schema (STAGING), live-fetched real object (multi-Actor), and source-code research. ID Prefix corrected (was "None", is PRC) and the redundant "PRC" Also Known As removed. **Significant corrections:** Client read is permitted, scoped to an eligible Listing relationship (new BR-009; Section 2 Client Can Read No→Yes) — corrects the prior "Clients cannot read" claim. Deletion corrected to a soft delete (no longer retrievable via the API) — removed the prior "hard delete / exception to Invariant 7 / no audit record" claims (Section 8); the owning Vendor can delete (Section 2 Vendor Can Delete No→Yes, BR-005). `defaultMargin` is stored, not "never computed/stored", and is the linked counterpart of `defaultMarkup` (BR-007); both are Operations-only, Vendors cannot set them and receive a system-assigned default (BR-006). Removed the unverifiable Billing Charge-reconciliation fallback and the contradicted per-item unitLP markup role from the old BR-006, plus the Subscription/Agreement/Charge relationships and related failure mode; added the confirmed `defaultMarkup`→Order estimate fallback (BR-010, Section 6/7.2). Price List Item auto-creation corrected: only reviewed Items at creation, and later additions trigger on an Item's first review (Draft→Pending), not Item creation (BR-003/BR-004, Section 7). Section 5: added `product` and `vendor` reference attributes; `audit` returned by default (was "omitted by default"); statistics completeness fields are integers (were Decimal); statistics visibility corrected — Client sees no statistics, and salesPriceItems/salesPriceCompleteness/averageMarkup/averageMargin are Operations-only; `externalIds` visible to all. Added a create-time markup/margin consistency edge case (Section 9). |
| 0.4 | 2026-03-14 | Stu | Section 5: `precision` corrected — Vendor-set on creation, not system-derived from currency; marked as required on creation. `notes` added — optional Vendor-authored free-text, absent when null. `audit` block added — omitted by default, retrievable via `select=+audit`. Section 8: deletion updated to document hard delete as confirmed exception to platform norm; audit events corrected to `created` and `updated` only — `deleted` removed (no audit record generated on deletion). |
| 0.3 | 2026-03-09 | Stu | LST-001 resolved — Price Lists can be deleted by Operations when not referenced by any Listings. BR-005 corrected from absolute prohibition to deletion guard. Ownership table, Section 6 lifecycle dependency, Section 8 deletion, and Section 9 failure mode all updated accordingly. |
| 0.2 | 2026-03-09 | Stu | BR-006 updated — defaultMarkup documented as serving dual role: billing fallback and item-level markup default when unitLP unsupported. |
| 0.1 | 2026-03-09 | Stu | Initial canon. |
