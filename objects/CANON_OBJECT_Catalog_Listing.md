# Object Canon: Listing

> **Version:** 0.5
> **Owner:** Stu
> **Last Updated:** 2026-07-16
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Listing

**Namespace:** Catalog

**Parent Object:** Catalog: Authorization

**ID Prefix:** LST

**Description:**
A Listing makes a [[Product]] available for purchase through a specific SoftwareOne [[Seller]] at the prices held in a specific [[Price List]], under a specific [[Authorization]]. It ties those four references together — [[Authorization]], [[Product]], [[Seller]], and [[Price List]] — and governs which Client types may transact against it through its eligibility flags. When an [[Order]] is placed without naming a Listing explicitly, the platform routes it to the primary Listing matching the ordering Client's [[Seller]], [[Product]], and eligibility. The [[Authorization]], [[Product]], [[Seller]], and [[Price List]] a Listing references are fixed at creation and cannot be changed afterward.

---

**Also Known As:**
None known.

---

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | No | Yes | No | No | A Vendor reads only Listings whose [[Product]] it owns, and receives the full object — there is no field-level suppression for the Vendor. |
| Operations | Yes | Yes | Yes | Yes | Full access. All write operations are Operations-only. Deletion subject to BR-012. |
| Client | No | Yes | No | No | Scoped read only, mediated by an eligible Listing relationship (see BR-007). Where readable, the Client sees the full object except the `statistics` block, which is suppressed. A Listing that does not satisfy the eligibility relationship is not returned at all (404). |

---

## 3. State Machine

This object has no state machine. A Listing exists as a persistent record from creation until deletion. Whether a Listing is effectively available to Clients is governed by its `eligibility` flags, its `primary` designation, and the state of the [[Product]] and [[Seller]] it references — not by a state of its own.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Listing references exactly one [[Authorization]], one [[Product]], one [[Seller]], and one [[Price List]]. None of these four references can be changed after creation. | N/A | All | Only `primary`, `eligibility`, and `notes` are mutable after creation. |
| BR-002 | The [[Authorization]] and [[Price List]] referenced by a Listing must both belong to the Listing's [[Product]]. The Listing's Vendor is derived from that [[Product]] and is never supplied independently. | N/A | Operations | Creation is rejected if the [[Authorization]]'s or [[Price List]]'s product does not match the supplied [[Product]]. |
| BR-003 | The [[Price List]]'s currency must be one of the referenced [[Seller]]'s supported currencies. This is enforced at creation. | N/A | Operations | No constraint requires the [[Price List]] currency to match the [[Authorization]] currency — the two may differ (e.g. a EUR [[Authorization]] with a USD [[Price List]]). |
| BR-004 | The referenced [[Seller]] is the SoftwareOne entity that invoices the Client for [[Order]]s placed under the Listing. It may be the same as, or different from, the [[Authorization]] owner. | N/A | All | — |
| BR-005 | A Listing can only be created when its [[Product]] is Published and its [[Seller]] is neither Disabled nor Deleted. | N/A | Operations | The parent [[Authorization]]'s existence is itself a precondition (see Catalog: [[Authorization]] canon BR-003); a Listing imposes no further constraint on [[Authorization]] state. |
| BR-006 | `eligibility.client` and `eligibility.partner` control which Client types may transact under the Listing. At least one of the two must be `true` at creation. | N/A | Operations | Setting a flag to `false` withdraws the Listing from that Client type's order routing and read visibility. Setting both `false` is rejected at creation. |
| BR-007 | Listing eligibility is read by the platform. [[Order]] placement routes to the primary Listing whose eligibility matches the ordering Client, and a Client can read a Listing only where the Client's own eligibility overlaps the Listing's. | N/A | All | Distinct from the parent [[Authorization]], whose eligibility is a contractual record read by no platform logic. See BR-008 and Catalog: [[Authorization]] canon BR-009. |
| BR-008 | Listing eligibility is maintained independently of the parent [[Authorization]]'s eligibility. It is neither derived from nor validated against the [[Authorization]]'s eligibility. | N/A | All | A Listing may be configured with eligibility that differs from its [[Authorization]] — the platform does not reconcile the two. |
| BR-009 | The `primary` designation is scoped to the [[Product]]+[[Seller]] combination. Up to two primary Listings may coexist for a given [[Product]]+[[Seller]] — at most one client-eligible and one partner-eligible. | N/A | Operations | The two-primary allowance is what lets a single [[Product]]+[[Seller]] route both standard-Client and Partner-Client [[Order]]s. |
| BR-010 | Marking a Listing as primary does not demote any existing primary. If a primary already exists for the same [[Product]]+[[Seller]] and an overlapping eligibility target, the operation is rejected; the existing primary must first be unset. | N/A | Operations | This is not the platform Default Protection Pattern (preamble §3.4) — `primary` is not a §3.4 Default designation. Promotion never auto-demotes; a conflicting promotion is rejected instead. |
| BR-011 | When an [[Order]] is placed without an explicit Listing, it is routed to the primary Listing matching the ordering Client's [[Seller]], [[Product]], and eligibility. | N/A | All | If no matching primary Listing exists, the [[Order]] cannot be routed. |
| BR-012 | A Listing cannot be deleted while it is marked primary, while any [[Order]] or [[Agreement]] references it (regardless of that reference's state), or while it has any active [[Subscription]]s. A primary Listing must first be unset as primary before it can be deleted. | N/A | Operations | Deletion is a soft delete — once deleted, permanently removed — no longer retrievable via the API. |
| BR-013 | A referenced [[Seller]] may be Disabled or soft-deleted; [[Seller]]s are never permanently removed. While the referenced [[Seller]] is Disabled, new [[Order]]s are blocked under the Listing. Existing [[Agreement]]s and [[Subscription]]s are unaffected. | N/A | All | A new Listing cannot be created against a Disabled or Deleted [[Seller]] (see BR-005). The block on new [[Order]]s under a Disabled [[Seller]] operates through Client read visibility, which depends on an active [[ErpLink]] between the Client's [[Buyer]] and the [[Seller]]. See Accounts: [[Seller]] canon. |
| BR-014 | `notes` is a plain-text internal documentation field set by Operations. | N/A | Operations | Not suppressed for any Actor — it is returned to every Actor permitted to read the Listing. |
| BR-015 | A Listing's `name` is system-generated and identical to its `id`. It carries no independent semantic value. | N/A | All | — |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| name | String | System-generated. Always identical to `id`. | System | No | Visible To: All. No semantic value — see BR-015. |
| product | Object (ProductRef) | Reference to the Product this Listing makes available for purchase. Required on creation. | Operations | No | Visible To: All. Determines the derived `vendor`; the Authorization and Price List must belong to it — see BR-002. |
| primary | Boolean | Marks this Listing as the primary for its Product+Seller combination and eligibility target. | Operations | Yes | Visible To: All. Optional on creation — null is treated as false. See BR-009, BR-010. |
| eligibility.client | Boolean | Whether standard Clients may transact under this Listing. | Operations | Yes | Visible To: All. At least one of client/partner must be true at creation — see BR-006. |
| eligibility.partner | Boolean | Whether Partner Clients may transact under this Listing. | Operations | Yes | Visible To: All. At least one of client/partner must be true at creation — see BR-006. |
| notes | String | Internal plain-text documentation field. | Operations | Yes | Visible To: All. Optional. See BR-014. |
| vendor | Object (AccountRef) | Reference to the Vendor Account associated with this Listing. | System | No | Visible To: All. Derived from the referenced Product; never independently settable — see BR-002. |
| statistics.subscriptions | Integer | Number of active Subscriptions under this Listing. | System | N/A | Visible To: Vendor, Operations. Computed by the platform. Read-only. Suppressed from Client. |
| statistics.agreements | Integer | Number of Agreements under this Listing counted while not in a terminal state. | System | N/A | Visible To: Vendor, Operations. Computed by the platform. Read-only. Suppressed from Client. |
| revision | Integer | Increments on each update. | System | N/A | Visible To: All. Read-only. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Authorization | Parent | Many:1 | A Listing belongs to exactly one Authorization and cannot be reassigned. The Authorization must belong to the Listing's Product. | Yes — a Listing cannot exist without an Authorization, and an Authorization cannot be deleted while any Listing references it (any state). |
| Catalog: Product | Association | Many:1 | The Product the Listing makes available. The Vendor is derived from it, and the Authorization and Price List must belong to it. | Yes — a Listing can only be created against a Published Product. A Product carrying Listings cannot be deleted (only Draft Products are deletable, and a Draft Product cannot yet have Listings). |
| Catalog: Price List | Association | Many:1 | A Listing references exactly one Price List, whose currency must be one of the Seller's supported currencies. | Yes (deletion guard) — a Price List cannot be deleted while any Listing references it. |
| Accounts: Seller | Association | Many:1 | The Seller that invoices Clients for Orders placed under this Listing. May differ from the Authorization owner. | No — Sellers are soft-deleted or disabled, never permanently removed. A Disabled Seller blocks new Orders under the Listing; the Listing itself is unaffected. |
| Commerce: Order | Association | One:Many | Orders are placed under a Listing, routed via the primary designation and eligibility. | Yes (deletion guard) — a Listing cannot be deleted while any Order references it. |
| Commerce: Agreement | Association | One:Many | Agreements are created under a Listing. | Yes (deletion guard) — a Listing cannot be deleted while any Agreement references it. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Listing created | Operations creates a Listing under an [[Authorization]], for a Published [[Product]], a non-Disabled/non-Deleted [[Seller]], and a [[Price List]] whose currency the [[Seller]] supports | Operations | The Listing becomes available for [[Order]] placement subject to its eligibility flags and primary designation. |
| Listing marked as primary | Operations sets `primary = true` | Operations | Rejected if a primary already exists for the same [[Product]]+[[Seller]] and overlapping eligibility target; otherwise the Listing becomes the routing target for matching [[Order]]s. No existing primary is demoted. |
| Eligibility changed | Operations updates `eligibility.client` / `eligibility.partner` | Operations | Adjusts which Client types can route [[Order]]s to, and read, the Listing. At least one flag must remain true. |
| Listing deleted | Operations deletes the Listing | Operations | The Listing is soft-deleted and no longer retrievable via the API. Blocked while it is primary, referenced by any [[Order]] or [[Agreement]], or has active [[Subscription]]s. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| New Order placed without an explicit Listing | Order | The [[Order]] is routed to the primary Listing matching the ordering Client's [[Seller]], [[Product]], and eligibility | Yes | A matching primary Listing exists | If no matching primary Listing exists, the [[Order]] cannot be routed. |
| Referenced Seller Disabled | Order | New [[Order]]s can no longer be placed under the Listing | Yes | [[Seller]] enters Disabled | Operates via Client read visibility, which requires an active [[ErpLink]] to the [[Seller]]. Existing [[Agreement]]s and [[Subscription]]s continue. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Not applicable — this object has no state machine. Configuration attributes (`primary`, `eligibility`, `notes`) are freely mutable by Operations, subject to the primary-promotion rule (BR-010).

**Deletion:**
- A Listing may be deleted by Operations, subject to BR-012 — it cannot be deleted while marked primary, while any [[Order]] or [[Agreement]] references it (regardless of state), or while it has active [[Subscription]]s. Once deleted, permanently removed — no longer retrievable via the API.
- A primary Listing must first be unset as primary (`primary = false`) before it can be deleted; the platform does not permit deleting a primary Listing directly.

**Audit & history requirements:**
The `audit` block captures `created` and `updated` timestamps and Actors, consistent with the standard PlatformObjectAudit schema. A never-updated Listing carries only the `created` sub-key.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Price List currency not among the Seller's supported currencies | Creation is rejected. | Operations | Low | The only currency constraint at creation — see BR-003. |
| Price List currency differs from the Authorization currency | Permitted. No constraint links the two currencies. | Operations | Low | Observed on live data (EUR [[Authorization]], USD [[Price List]]). Not an error. |
| Attempt to create a Listing for a non-Published Product, or a Disabled/Deleted Seller | Creation is rejected. | Operations | Low | See BR-005. |
| Both eligibility flags set to false at creation | Creation is rejected — at least one of client/partner must be true. | Operations | Low | See BR-006. |
| Promoting a Listing to primary when a matching primary already exists | The operation is rejected (conflict). The existing primary is not demoted. | Operations | Medium | Operations must first unset the existing primary. Unlike the §3.4 Default Protection Pattern, there is no auto-demotion — see BR-010. |
| Operations attempts to delete a Listing referenced by any Order or Agreement | Deletion is blocked, regardless of the [[Order]]'s or [[Agreement]]'s state. | Operations | Low | See BR-012. |
| Operations attempts to delete a primary Listing | Deletion is blocked. The Listing must first be unset as primary. | Operations | Low | See BR-012. |
| Referenced Seller Disabled | New [[Order]]s can no longer be placed under the Listing. Existing [[Agreement]]s and [[Subscription]]s continue normally. The Listing itself is unchanged. | Client | Medium | Operates via loss of Client read visibility (active [[ErpLink]] required). Operations must reference an active [[Seller]] or route [[Order]]s to a different Listing to restore placement. |
| Client attempts to read a Listing for which it is not eligible | The Listing is not returned (404). | Client | Low | Client read is mediated entirely by the eligibility relationship — see BR-007 and Section 2. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.5 | 2026-07-16 | Stu / canon-generate | Refreshed via live OpenAPI schema (STAGING), a live-fetched real object (STAGING, all Actors), and source-code research. ID Prefix corrected (was "None", is LST) and moved out of Also Known As. **Significant corrections:** the "Price List currency must match Authorization currency" rule was false and is removed — the only enforced currency rule is Price List currency ∈ Seller's supported currencies (BR-003), and a live object confirms EUR/USD mismatch is permitted. Vendor read visibility corrected — the Vendor reads its own Product's Listings in full with no field suppression (previously "id and name only"); only the `statistics` block is suppressed, and only from the Client (Section 2, Section 5). Client read corrected to a scoped read mediated by the eligibility relationship (previously "id and name only, cannot query"). The `primary` model corrected — it is scoped to Product+Seller (not Seller+Authorization), allows up to two primaries (one client-eligible, one partner-eligible), and rejects a conflicting promotion rather than auto-demoting; it is explicitly not a §3.4 Default designation (BR-009, BR-010). Deletion guard corrected — deletion is blocked by any referencing Order or Agreement (any state), by active Subscriptions, and while primary; deletion is a soft delete (BR-012). Creation preconditions added — Product must be Published and Seller not Disabled/Deleted (BR-005). `product` added as a documented reference attribute and relationship; `vendor` clarified as derived from the Product (BR-002). Eligibility rules rewritten — Listing eligibility is read downstream for order routing and Client visibility (BR-007) and is independent of the Authorization's (BR-008); at least one flag required at creation (BR-006). BR-011 (Order routing) added. Former BR-008 (intercompany invoicing when Seller ≠ Authorization owner) removed — unverifiable in available evidence. BR-012/BR-013 (Seller) corrected — Sellers are soft-deleted or disabled, never permanently removed; the disabled-Seller order block operates via Client read visibility. `notes` corrected to visible to all readers (BR-014). Stale open question AUT-001 removed (resolved in the Authorization canon; Listing eligibility is read downstream, unlike the Authorization's). |
| 0.4 | 2026-03-15 | Stu | Administration namespace renamed to Accounts throughout — Section 6 updated. |
| 0.3 | 2026-03-14 | Stu | Schema review against OpenAPI extract. Section 5: eligibility fields marked required on creation; primary noted as optional (null = false); vendor convenience field added with rationale; statistics fields marked read-only and restricted from Clients with rationale; revision marked read-only. Section 8: audit note corrected — both created and updated recorded. Section 10: cleaned up. |
| 0.2 | 2026-03-09 | Stu | LST-001 and LST-002 resolved. Section 6 Price List and Seller lifecycle dependencies updated. Seller disabled failure mode added to Section 9. Open questions closed. |
| 0.1 | 2026-03-09 | Stu | Initial canon. |
