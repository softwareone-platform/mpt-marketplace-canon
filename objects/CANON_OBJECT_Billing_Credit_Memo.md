# Object Canon: Credit Memo

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-20
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Credit Memo

**Namespace:** Billing

**Parent Object:** None — top-level object.

**ID Prefix:** CRD

**Description:**
A Credit Memo is the platform's synced representation of a credit memo generated in the ERP system (NAV) — the negative-amount counterpart of an Invoice. It is created only by an automated bulk sync process, never by direct Vendor, Operations, or Client action, and is linked 1:1 to the NAV credit memo document it mirrors. A Credit Memo is typically (though not validated as) linked to a Credit-type [[Statement]], from which it inherits its [[Product]], vendor [[Account]], and [[Licensee]]; its own [[Buyer]] and [[Seller]] are resolved independently at sync time. Its official PDF is exposed through a child Credit Memo Attachment (not yet canonised).

**Also Known As:**
NAV credit memo; ERP credit memo. Distinct from the [[Invoice]] (the positive/debit-amount counterpart) and from the embedded credit memo lines (which have no independent existence or endpoint of their own).

---

## 2. Ownership & Visibility

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor     | No | No | No | No | The endpoint's access policy excludes the Vendor Actor entirely — a Vendor token is refused before any action executes (confirmed via a live PROD fetch: HTTP 403). |
| Operations | Yes | Yes | No | No | The only Actor permitted to submit the bulk ERP sync that creates and refreshes Credit Memos (see BR-001). No update or delete endpoint exists for any Actor — see BR-003. |
| Client     | No | Yes (own only) | No | No | Reads are scoped to the Client's own Account; requesting a Credit Memo belonging to a different Client returns not found (confirmed via a live PROD fetch against a different tenant's Credit Memo). |

---

## 3. State Machine

This object has no state machine. A Credit Memo is created directly in its single defined status, Issued, via the ERP sync process, and never transitions to any other status — the platform's `status` field currently has only one defined value.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Credit Memo is created only through a bulk, asynchronous ERP sync endpoint, restricted to the Operations Actor. | N/A | Operations | The endpoint requires `MPT-Upsert` and `MPT-Async` request headers and returns 202 Accepted with a task ID for tracking; each submitted item is processed independently, so one item's failure does not block the others in the same submission. |
| BR-002 | A Credit Memo's identity is keyed by the combination of its ERP document number and country code; resubmitting the same combination updates the existing record rather than creating a duplicate. | N/A | Operations | An incoming update whose ERP revision number is not newer than the stored one is skipped as a no-op, guarding against out-of-order sync delivery. |
| BR-003 | No update or delete endpoint exists for a Credit Memo; the only way to change its data is to resubmit the same document-number/country-code combination through the sync endpoint. | N/A | Operations | See Section 8. |
| BR-004 | A Credit Memo's Buyer is resolved at sync time from the ERP customer reference against Accounts: [[Buyer]]'s own ERP reference; its Seller is resolved from the country code against Accounts: [[Seller]]'s own ERP reference. Both are required for that item to sync successfully. | N/A | System | An unresolved Buyer is treated as a transient condition — Buyer sync runs on a separate cadence, so the item is silently skipped and expected to resolve on a later sync pass rather than failing outright. An unresolved Seller fails the item. |
| BR-005 | A Credit Memo's Agreement and Statement references are optionally resolved at sync time from ERP-supplied identifiers; neither is required for the sync to succeed. When a Statement is resolved, its own Agreement takes precedence over the value otherwise supplied for the Credit Memo's Agreement. | N/A | System | The platform does not validate that a linked Statement is specifically a Credit-type [[Statement]] — see candidate open question in Section 10. |
| BR-006 | A Credit Memo's Vendor, Product, and Licensee are populated only when it is linked to a [[Statement]]; a Credit Memo without a resolved Statement link carries no Vendor, Product, or Licensee even when its Buyer, Seller, and Agreement are populated. | N/A | System | See Section 6. |
| BR-007 | On first creation, a Credit Memo automatically receives a general PDF attachment carrying the ERP-generated document, unless its Seller is flagged as a legacy migrated Seller from a prior acquisition's platform. | N/A | System | The attachment is not recreated on subsequent resyncs of the same Credit Memo. |
| BR-008 | A Credit Memo's line-level detail is carried as an embedded array on the Credit Memo itself, not as a separate child collection. | N/A | All | Contrast Billing: [[Statement]], whose per-line detail ([[Charge]]) is a separate child collection rather than an embedded array. |
| BR-009 | Sell-side pricing detail — markup, margin, total purchase price, and the purchase-side fields on each line — is visible only to the Operations Actor. The Client Actor sees only the sale-side totals and sale-side line amounts. | N/A | All | Reference preamble §6.3. |
| BR-010 | A Credit Memo has no delete endpoint and cannot be deleted or otherwise permanently removed by any Actor once created. | N/A | Operations | See Section 8. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| id | String | Unique identifier, format `CRD-NNNN-NNNN-NNNN-NNNN`. | System | No | Deterministically assigned from the (document number, country code) combination — see BR-002. |
| status | Enum | Current status. | System | No | Only `Issued` is a defined value; never changes after creation. |
| countryCode | String | The Seller's own ERP reference code, used to resolve the Credit Memo's Seller at sync time. | System | No | Despite its name, this is not a geographic country code — it is the Seller-side ERP identifier used for the Seller lookup in BR-004. |
| documentNo | String | The ERP document number. | System | No | Combines with countryCode as the sync identity key — see BR-002. |
| externalIds | Object | Raw ERP reference strings for the linked Statement, Buyer (customer), and Agreement. | System | Yes (via resync) | Absent from response when null. |
| buyer | Reference | The Accounts: Buyer resolved from the ERP customer reference. | System | No | See BR-004. |
| seller | Reference | The Accounts: Seller resolved from countryCode. | System | No | See BR-004. |
| agreement | Reference | The Commerce: Agreement this Credit Memo relates to, if resolved. | System | No | See BR-005. |
| statement | Reference | The Billing: Statement this Credit Memo is linked to, if resolved. | System | No | See BR-005, BR-006. |
| client | Reference | The client Accounts: Account billed. | System | No | Derived from the Buyer's own Account — not independently resolved. |
| licensee | Reference | The Accounts: Licensee consuming the service. | System | No | Populated only via a linked Statement — see BR-006. |
| product | Reference | The Catalog: Product being credited. | System | No | Populated only via a linked Statement — see BR-006. |
| vendor | Reference | The vendor Accounts: Account. | System | No | Populated only via a linked Statement — see BR-006. |
| lines | Array | Embedded credit memo line items (item, quantity, period, and per-line price breakdown). | System | Yes (via resync) | See BR-008. Each line carries its own ERP item/contract references and a price object with the same Operations/Client visibility split as the header (BR-009). |
| price | Object | Header-level pricing summary: currency, total purchase price, total sale price, total tax, total gross, markup, margin. | System | Yes (via resync) | markup, margin, and total purchase price are Operations-only; total sale price, total tax, and total gross are Client/Operations. See BR-009. |
| attributes | Object | A curated subset of ERP fields (posting date, document date, external document numbers, customer reference) mirrored from `erpData` for display. | System | Yes (via resync) | Refreshed from `erpData` on every sync. |
| erpData | Object | The full ERP-specific detail: addresses, currency, dates, responsibility/sales codes, and sync revision/row-version fields. | System | Yes (via resync) | Operations, Vendor, and Client all see this object per the schema, though Vendor cannot reach the endpoint at all (see Section 2). |
| analytics | Object | Status of an internal, asynchronous reconciliation of the Credit Memo's totals against its linked Statement's charge-level detail. | System | Yes | One of Pending, Running, Ready, or Failed. Not a business status of the Credit Memo itself. |
| cloudiqInvoiceReference / cloudiqReportLayout | String / Integer | Cloud iQ integration reference and report layout code. | System | Yes (via resync) | Absent from response when null. |
| revision | Integer | Monotonic revision counter. | System | Yes | Increments on each resync. |
| audit | Object | Created, updated, and Issued-status event record. | System | Yes | See Section 8 and the candidate open question in Section 10 regarding the Issued sub-event. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Billing: Statement | Association | Many Credit Memos to one Statement (optional) | The Credit Memo this Statement produced downstream in the ERP, resolved at sync time from an ERP-supplied reference. Supplies the Credit Memo's Vendor, Product, and Licensee when present. | Reference only; no cascade. A Credit Memo synced before its Statement link resolves keeps a null Statement, Vendor, Product, and Licensee indefinitely unless resynced with a corrected reference. |
| Commerce: Agreement | Association | Many Credit Memos to one Agreement (optional) | The Agreement the Credit Memo relates to. | Reference only; no cascade. |
| Accounts: Buyer | Association | Many Credit Memos to one Buyer | The Buyer resolved at sync time. | Reference only; no cascade. |
| Accounts: Seller | Association | Many Credit Memos to one Seller | The Seller resolved at sync time. | Reference only; no cascade. |
| Accounts: Account | Association | Many Credit Memos to one client Account, one vendor Account | The client Account (derived from the Buyer) and vendor Account (derived from the linked Statement). | Reference only; no cascade. |
| Accounts: Licensee | Association | Many Credit Memos to one Licensee (optional) | The Licensee consuming the service, populated only via a linked Statement. | Reference only; no cascade. |
| Catalog: Product | Association | Many Credit Memos to one Product (optional) | The Product being credited, populated only via a linked Statement. | Reference only; no cascade. |
| Billing: Credit Memo Attachment | Child | One Credit Memo to many Attachments | The Credit Memo's supporting files, including its auto-generated ERP PDF. | No cascade (preamble Invariant 6); the attachment is reachable only via its Credit Memo. An auto-generated PDF attachment is created only on first sync — see BR-007. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Credit Memo created | First sync of a new (document number, country code) combination | Operations (via the ERP sync process) | Status is set to Issued; a general PDF attachment is created unless the Seller is a legacy migrated Seller (BR-007); an internal analytics reconciliation is queued (status Pending); a platform event is published. |
| Credit Memo resynced | A later sync submission for the same (document number, country code) combination, with a newer ERP revision | Operations (via the ERP sync process) | Fields are refreshed from the incoming data; no new attachment is created; because status never changes from Issued, no further status-changed event is published beyond the one at creation. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Credit Memo created | Credit Memo Attachment | A new attachment is created, carrying the ERP-generated PDF. | Yes (Operations token context) | Seller is not a legacy migrated Seller | See BR-007. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
This object has no state machine, so there are no state transitions to reverse.

**Deletion:**
A Credit Memo cannot be deleted in any state by any Actor — no delete endpoint exists, and no other object's action was found to remove one either directly or as a side effect. Once synced, a Credit Memo is expected to persist as a permanent record of the underlying ERP document.

**Audit & history requirements:**
A Credit Memo records created and updated events, plus a dedicated sub-event intended to capture the most recent transition into Issued status. Prior values of resynced fields (pricing, lines, ERP data) are not retained beyond this audit trail.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| A Credit Memo's Buyer cannot yet be resolved at sync time | The sync item is silently skipped for that pass rather than failing; it is expected to succeed once the Buyer's own sync catches up. | Operations | Medium | See BR-004. No Credit Memo exists in the interim, and nothing surfaces this to the Client. |
| A Credit Memo's Seller cannot be resolved at sync time | The sync item fails for that submission. | Operations | Medium | See BR-004. Unlike an unresolved Buyer, this is not treated as an expected transient condition. |
| A Credit Memo is synced without a resolvable Statement reference | Vendor, Product, and Licensee remain permanently null unless a later resync supplies a corrected reference. | Client, Operations | Medium | See BR-005, BR-006. |
| A Credit Memo's Seller is a legacy migrated Seller from a prior acquisition's platform | No PDF attachment is ever auto-generated for that Credit Memo. | Client | Medium | See BR-007. A Client relying on the attachment path to obtain the official document finds none unless one is separately supplied. |
| Internal analytics reconciliation fails for a Credit Memo | Its `analytics.status` remains Failed until a subsequent recalculation is run; the Credit Memo's own header data is unaffected. | Operations | Low | The reconciliation is an internal process separate from the Credit Memo's own displayed totals. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-20 | Stu / canon-generate-batch | Initial draft generated from the PROD OpenAPI schema, a live PROD fetch (Operations readable; Vendor refused with 403; Client refused with 404 against a different tenant's Credit Memo, as expected), the shared Invoices & Credit Memos Confluence page, and Billing source research. Documents the Credit Memo as a single-status (Issued), ERP-synced object created only via an Operations-restricted bulk async sync keyed by (document number, country code), with no update or delete endpoint of any kind. Confirmed the Buyer/Seller resolution split (Buyer-not-found is treated as a transient, retryable condition; Seller-not-found fails the item), the Statement-conditional population of Vendor/Product/Licensee, the automatic PDF-attachment creation on first sync (skipped for legacy migrated Sellers), and the embedded (not child-collection) line model, contrasting Billing: Statement's Charge collection. Resolved during PM review: the ERP is the source of truth — the platform intentionally does not validate that the resolved Statement is Credit-type nor that line-level totals reconcile with header totals; permanent, un-removable retention is the intended Credit Memo lifetime. 0 open questions. |
