# Object Canon: Listing

> **Version:** 0.3
> **Owner:** Stu
> **Last Updated:** 2026-03-14
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Listing

**Parent Object:** Catalog: Authorization

**Also Known As:**
LST (API identifier prefix)

**Description:**
A Listing is the configuration record that governs a Seller's eligibility to transact and a Client's ability to place Orders under a given Authorization against a given Price List. It connects an Authorization (the commercial relationship between the Authorization Owner and the Vendor), a Seller (the SoftwareOne entity that will invoice the Client), and a Price List (the currency-scoped set of Items and prices available for purchase). When the Listing Seller differs from the Authorization Owner, intercompany invoicing is automatically triggered between the two entities during billing.

---

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
|-------|------------|----------|------------|------------|-------|
| Vendor | No | Yes* | No | No | *Vendor sees Listing id and name only, surfaced contextually on Agreement and Order detail. Vendor cannot query Listings directly in a meaningful way. |
| Operations | Yes | Yes | Yes | Yes | Full access. Creates and manages Listings. Deletion subject to BR-007. |
| Client | No | Yes** | No | No | **Client sees Listing id and name only, surfaced contextually on Agreement and Order detail. Clients cannot query Listings directly. |

---

## 3. State Machine

This object has no state machine. A Listing exists as a persistent record from creation until deletion. Whether a Listing is effectively available to Clients is controlled by its `eligibility` flags, not by a state.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
|---------|---------------|---------------------|-------------|-------|
| BR-001 | A Listing belongs to exactly one Authorization. It cannot be reassigned to a different Authorization after creation. | N/A | All | |
| BR-002 | A Listing references exactly one Price List. The currency of the Price List must match the currency of the Authorization. | N/A | All | Platform-enforced constraint. A Listing cannot be created with a mismatched currency between Price List and Authorization. |
| BR-003 | A Listing references exactly one Seller — the SoftwareOne entity that will invoice the Client for Orders placed under this Listing. The Seller may be the same as the Authorization Owner or a different Seller. | N/A | All | When Listing Seller ≠ Authorization Owner, intercompany invoicing is triggered between the two entities during billing. See BR-008. |
| BR-004 | Among all Listings sharing the same Seller and Authorization, exactly one must be marked as primary. When a new Order is placed under that Seller and Authorization, it is placed under the primary Listing. | N/A | All | Consistent with the platform Default Protection Pattern. See BR-005. |
| BR-005 | Marking a Listing as primary automatically demotes any existing primary Listing with the same Seller and Authorization combination. There is always exactly one primary per Seller+Authorization combination. | N/A | Operations | A primary Listing may be deleted directly if the deletion guard (BR-007) is satisfied — demotion is not required before deletion. |
| BR-006 | eligibility.client and eligibility.partner control which Client types may place Orders under this Listing. Setting both to false effectively suspends the Listing — no Client can place new Orders under it. This is a valid operational configuration for temporary order suspension. | N/A | Operations | eligibility flags on the Listing are independent of eligibility flags on the parent Authorization. They are not platform-enforced as consistent — misconfiguration is possible and may produce unexpected results. See BR-006a. |
| BR-006a | The Listing cannot grant more eligibility than the Authorization permits. However, this is not platform-enforced — a Listing may be configured with broader eligibility than its Authorization, which constitutes a misconfiguration. Operations is responsible for ensuring Listing eligibility is consistent with Authorization eligibility. | N/A | Operations | Known misconfiguration risk. Documented per platform permissiveness philosophy. |
| BR-007 | A Listing can only be deleted if it has no Agreements in an active state. Specifically, deletion is permitted only when all associated Agreements are in Deleted, Failed, or Terminated states. | N/A | Operations | An Order always has an associated Agreement — co-created when the Order is first persisted. The deletion guard therefore covers both Orders and Agreements implicitly. |
| BR-008 | When the Listing Seller differs from the Authorization Owner, intercompany invoicing is automatically triggered between the Authorization Owner and the Listing Seller during billing reconciliation. | N/A | All | This is a billing-namespace side effect. Common in Vendor configurations with regional Authorizations (e.g. Adobe). Less common where each Seller has its own Authorization (e.g. Microsoft). |
| BR-009 | notes is a plain-text internal documentation field set by Operations. It is readable by Vendor and Operations. It is not visible to Clients. | N/A | Operations | Consistent with Authorization notes pattern. |
| BR-010 | A Listing's name is system-generated and identical to its id. It carries no independent semantic value. | N/A | All | |
| BR-011 | Listing creation is not restricted by the state of the parent Product or the state of the parent Authorization. | N/A | Operations | Consistent with platform permissiveness philosophy. |
| BR-012 | Sellers are never deleted, only disabled. When a Seller referenced by a Listing is disabled, the platform prevents new Orders from being placed under that Listing. Existing Agreements and Subscriptions are unaffected. | N/A | All | A disabled Seller cannot invoice customers. The platform enforces this as a guard on Order creation. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Visible To | Notes |
|-----------|------|-------------|--------|------------------------|------------|-------|
| name | String | System-generated. Always identical to id. | System | No | All (id and name only for Vendor and Client) | No semantic value. |
| primary | Boolean | Marks this Listing as the primary for its Seller+Authorization combination | Operations | Yes | Vendor, Operations | Optional on creation — null is treated as false. Exactly one primary must exist per Seller+Authorization. Setting to true automatically demotes the existing primary. |
| eligibility.client | Boolean | Whether standard Clients may place Orders under this Listing | Operations | Yes | Vendor, Operations | Required on creation. Independent of Authorization eligibility. Not platform-enforced as consistent. |
| eligibility.partner | Boolean | Whether Partner Clients may place Orders under this Listing | Operations | Yes | Vendor, Operations | Required on creation. Independent of Authorization eligibility. See Open Questions AUT-001. |
| notes | String | Internal plain-text documentation field | Operations | Yes | Vendor, Operations | Optional. Not visible to Clients. |
| vendor | Object (AccountRef) | Reference to the Vendor Account associated with this Listing | System | No | Vendor, Operations | Convenience field — derivable from the parent Authorization or Product. No distinct purpose. |
| statistics.subscriptions | Integer | Number of active Subscriptions under this Listing | System | N/A | Vendor, Operations | Computed by platform. Read-only. Intentionally restricted from Clients — Client visibility of aggregate usage data (number of agreements, subscriptions, etc.) is hidden to prevent exposure of information about other Clients. |
| statistics.agreements | Integer | Number of Agreements under this Listing | System | N/A | Vendor, Operations | Computed by platform. Read-only. Intentionally restricted from Clients — same rationale as statistics.subscriptions. |
| revision | Integer | Increments on each update | System | N/A | All | Read-only. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
|----------------|------------------|-------------|-------------|----------------------|
| Catalog: Authorization | Parent | Many:1 | A Listing belongs to exactly one Authorization. Cannot be reassigned. | Yes — Listing cannot exist without a parent Authorization. Authorization cannot be deleted while any Listing exists. |
| Catalog: Price List | Association | Many:1 | A Listing references exactly one Price List. Currency must match Authorization currency. | Yes (deletion guard) — a Price List cannot be deleted while any Listing references it. All referencing Listings must be deleted before the Price List can be deleted. |
| Administration: Seller | Association | Many:1 | The Seller that will invoice Clients for Orders placed under this Listing. May differ from the Authorization Owner. | No — Sellers are never deleted, only disabled. When a Seller is disabled, new Orders cannot be placed under this Listing. The Listing itself is unaffected. |
| Commerce: Agreement | Association | One:Many | Agreements are created under a Listing. A Listing cannot be deleted while any Agreement is in a non-terminal state. | Yes (deletion guard) — Listing deletion blocked while active Agreements exist. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
|-------|---------|-------------------|---------------------------------|
| Listing created | Operations creates Listing under an Authorization | Operations | Listing becomes available for Order placement subject to eligibility flags. |
| Listing marked as primary | Operations sets primary = true | Operations | Any existing primary Listing with the same Seller+Authorization combination is automatically demoted. |
| eligibility flags set to false | Operations sets eligibility.client = false and eligibility.partner = false | Operations | No new Orders can be placed under this Listing. Existing Agreements and Subscriptions are unaffected. |
| Listing deleted | Operations deletes Listing | Operations | Listing removed. All associated Agreements must be in terminal states (Deleted, Failed, or Terminated) for deletion to succeed. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect | Automated? | Condition | Notes |
|-----------------|----------------|--------|------------|-----------|-------|
| New Order placed under Seller+Authorization | Order | Order is placed under the primary Listing for that Seller+Authorization combination | Yes | Always — primary Listing routing is automatic | |
| Listing Seller ≠ Authorization Owner at billing time | Billing: intercompany invoice | Intercompany invoicing triggered between Authorization Owner and Listing Seller | Yes | Always when Seller differs from Authorization Owner | Billing-namespace side effect. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Not applicable — this object has no state machine.

**Deletion:**
- Listings may be deleted by Operations, subject to BR-007 (all associated Agreements must be in Deleted, Failed, or Terminated states). Once deleted, permanently removed — no longer retrievable via the API.
- A primary Listing may be deleted directly if the deletion guard is satisfied — demotion is not required before deletion.

**Audit & history requirements:**
Audit block captures `created` and `updated` timestamps and Actors, consistent with the standard PlatformObjectAudit schema.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
|----------|--------------------------|---------------|------------|-------|
| Listing eligibility grants more than Authorization eligibility | Platform does not enforce consistency. Misconfiguration is possible and may produce unexpected results for Clients attempting to order. | Client, Operations | Medium | Operations is responsible for ensuring Listing eligibility is consistent with Authorization eligibility. |
| Both eligibility flags set to false | No new Orders can be placed under this Listing. Existing Agreements and Subscriptions are unaffected. | Client | Low | Intentional configuration for temporary order suspension. Not an error state. |
| Operations attempts to delete a Listing with non-terminal Agreements | Deletion blocked. Listing cannot be deleted while any Agreement is in a non-terminal state. | Operations | Low | Operations must await Agreement termination or deletion before removing the Listing. |
| Primary Listing deleted without demoting first | Permitted if deletion guard is satisfied. If other Listings exist for the same Seller+Authorization, none will be primary after deletion — new Orders cannot be automatically routed until a new primary is designated. | Client, Operations | High | Operations must designate a new primary Listing promptly after deleting the current primary to prevent Order routing failure. |
| Listing Seller disabled | No new Orders can be placed under this Listing. Existing Agreements and Subscriptions continue normally. The Listing itself is unchanged — no state change, no deletion. | Client | Medium | Operations must update the Listing to reference an active Seller, or redirect Orders to a different Listing, to restore Order placement. |
| Listing Seller differs from Authorization Owner | Intercompany invoicing is triggered automatically during billing. No error — this is a supported and common configuration. | None | Low | Common for Vendors with regional Authorization structures (e.g. Adobe). |

---

## 10. Open Questions

- AUT-001: Full semantics of eligibility.partner = true/false — carried from Authorization canon, applies equally to Listing eligibility.

---

## 11. Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2026-03-09 | Stu | Initial canon. |
| 0.2 | 2026-03-09 | Stu | LST-001 and LST-002 resolved. Section 6 Price List and Seller lifecycle dependencies updated. Seller disabled failure mode added to Section 9. Open questions closed. |
| 0.3 | 2026-03-14 | Stu | Schema review against OpenAPI extract. Section 5: eligibility fields marked required on creation; primary noted as optional (null = false); vendor convenience field added with rationale; statistics fields marked read-only and restricted from Clients with rationale; revision marked read-only. Section 8: audit note corrected — both created and updated recorded. Section 10: cleaned up. |
