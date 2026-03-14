# Object Canon: Authorization

> **Version:** 0.2
> **Owner:** Stu
> **Last Updated:** 2026-03-14
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Authorization

**Parent Object:** None — top-level Catalog object.

**Also Known As:**
AUT (API identifier prefix)

**Description:**
An Authorization is the formal record of a commercial relationship between a SoftwareOne Seller and a Vendor, scoped to a specific Product and currency. It represents the contractual basis under which the Seller is permitted to transact that Product in that currency on behalf of SoftwareOne. An Authorization is a precondition for creating a Listing — no Listing can exist without an Authorization. It carries billing cadence, eligibility rules, and an optional schemaless settings blob for Vendor-specific configuration.

---

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
|-------|------------|----------|------------|------------|-------|
| Vendor | No | Yes* | Yes** | No | *Vendor can read all fields except notes. **Vendor can only write settings. All other fields are Operations-managed. |
| Operations | Yes | Yes | Yes | Yes | Full access. Creates and manages Authorizations. Deletion subject to BR-006. |
| Client | No | Yes*** | No | No | ***Client sees Authorization id and name only, surfaced contextually on Agreement and Order detail. Clients cannot query Authorizations directly. |

---

## 3. State Machine

This object has no state machine. An Authorization exists as a persistent record from creation until deletion. Its availability as a precondition for Listings is controlled by its existence, not by a state.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
|---------|---------------|---------------------|-------------|-------|
| BR-001 | An Authorization records the commercial relationship between exactly one Administration: Seller (the Authorization Owner), one Vendor, one Catalog: Product, and one currency. This four-part tuple is the identity of the Authorization. | N/A | All | |
| BR-002 | Multiple Authorizations may exist with the same Seller, Vendor, Product, and currency. The platform does not enforce uniqueness on this tuple. Duplicate Authorizations may represent valid commercial configurations or may represent misconfiguration — the Vendor and Operations are responsible for managing this. | N/A | All | |
| BR-003 | An Authorization is a precondition for creating a Listing. A Listing cannot exist without a parent Authorization. | N/A | All | |
| BR-004 | An Authorization may be referenced by more than one Listing. | N/A | All | |
| BR-005 | journal.firstInvoiceDate and journal.frequency are set by Operations only. These fields record the billing cadence established under the commercial relationship. No platform behaviour is automatically triggered by these values — they serve as a reference for billing operations. | N/A | Operations | |
| BR-006 | An Authorization can only be deleted if it has no Listings. The presence of any Listing — regardless of that Listing's state or whether it has downstream active Agreements — blocks deletion. | N/A | Operations | Deletion of the Authorization's Listings is a precondition for Authorization deletion. Listing deletion is itself subject to Listing-level deletion guards — see Listing canon. |
| BR-007 | settings is an optional schemaless JSON blob. It must be valid JSON but is not validated against any schema. It may be read and written by Vendor and Operations at any time. It has a maximum size of 4,000 characters. | N/A | Vendor, Operations | Intended for non-sensitive Vendor-specific configuration such as Vendor IDs used during Order fulfilment. Clear text — sensitive credentials should not be stored here. |
| BR-008 | notes is a plain-text internal documentation field set by Operations. It is readable by Vendor and Operations. It is not visible to Clients. | N/A | Operations | Intended for internal operational notes about the Authorization. |
| BR-009 | eligibility controls which Client types may transact under this Authorization. client and partner are independent boolean flags set by Operations based on contract terms with the Vendor. | N/A | Operations | See Open Questions AUT-001 for full semantics of partner eligibility. |
| BR-010 | externalIds.operations is an Operations-set external identifier for the Authorization, used to correlate with external systems. There is no vendor external ID namespace on Authorization. | N/A | Operations | |
| BR-011 | Authorization creation, modification, and deletion are not restricted by the state of the parent Product. | N/A | Operations | Consistent with platform permissiveness philosophy. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Visible To | Notes |
|-----------|------|-------------|--------|------------------------|------------|-------|
| name | String | Human-readable label for the Authorization | Operations | Yes | Vendor, Operations, Client (id and name only) | Required on creation. |
| currency | String | ISO 4217 currency code. The currency in which this Authorization permits the Seller to transact. | Operations | No | Vendor, Operations | Required on creation. Immutable after creation. |
| vendor | Object (AccountRef) | Reference to the Vendor Account associated with this Authorization | System | No | Vendor, Operations | Set at creation. Immutable. |
| externalIds.operations | String | Operations-set external identifier, used to correlate with external systems | Operations | Yes | Vendor, Operations | Optional. No vendor external ID namespace exists on this object. |
| notes | String | Internal plain-text documentation field | Operations | Yes | Vendor, Operations | Optional. Not visible to Clients. |
| settings | Object | Schemaless JSON blob for Vendor-specific configuration | Vendor, Operations | Yes | Vendor, Operations | Optional. Max 4,000 characters. Must be valid JSON. No schema enforced. Omitted from API responses when null — use select=+settings to include. Clear text only — not suitable for credentials. |
| journal.firstInvoiceDate | DateTime | The date from which billing begins under this Authorization | Operations | Yes | Vendor, Operations | Required on creation. No platform behaviour is automatically triggered by this value. Used as a billing reference. |
| journal.frequency | Enum | Billing reconciliation frequency. One of: 1m, 3m, 6m, 1y, 3y, one-time | Operations | Yes | Vendor, Operations | Required on creation. |
| eligibility.client | Boolean | Whether standard Clients may transact under this Authorization | Operations | Yes | Vendor, Operations | Required on creation. Set based on contract terms with Vendor. |
| eligibility.partner | Boolean | Whether Partner Clients may transact under this Authorization | Operations | Yes | Vendor, Operations | Required on creation. See Open Questions AUT-001. |
| statistics.subscriptions | Integer | Number of active Subscriptions under this Authorization | System | N/A | Vendor, Operations | Computed by platform. Read-only. |
| statistics.agreements | Integer | Number of Agreements under this Authorization | System | N/A | Vendor, Operations | Computed by platform. Read-only. |
| statistics.sellers | Integer | Number of Sellers transacting under this Authorization via Listings | System | N/A | Vendor, Operations | Computed by platform. Read-only. |
| statistics.listings | Integer | Number of Listings referencing this Authorization | System | N/A | Vendor, Operations | Computed by platform. Read-only. |
| revision | Integer | Increments on each update | System | N/A | All | Read-only. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
|----------------|------------------|-------------|-------------|----------------------|
| Administration: Seller | Owner | Many:1 | The Seller that owns this Authorization — the SoftwareOne entity that holds the commercial relationship with the Vendor. Known as the Authorization Owner. | Yes — Authorization cannot exist without an Owner Seller. |
| Catalog: Product | Association | Many:1 | An Authorization is scoped to exactly one Product. | No — deletion of Product behaviour not yet confirmed. |
| Catalog: Listing | Parent of | One:Many | A Listing cannot exist without a parent Authorization. An Authorization may have multiple Listings. | Yes — Listings cannot exist without an Authorization. Authorization cannot be deleted while any Listing exists. |
| Commerce: Agreement | Indirect | One:Many | Agreements are downstream of Listings which are downstream of Authorizations. Surfaced to Client on Agreement detail as id and name only. | No — direct lifecycle dependency is at Listing level. |
| Commerce: Order | Indirect | One:Many | Orders are downstream of Listings which are downstream of Authorizations. Surfaced to Client on Order detail as id and name only. | No — as above. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
|-------|---------|-------------------|---------------------------------|
| Authorization created | Operations creates Authorization | Operations | Authorization becomes available as a precondition for Listing creation under the same Product. |
| settings updated | Vendor or Operations writes settings blob | Vendor, Operations | Updated settings immediately available to any process reading the Authorization. No downstream cascade. |
| Authorization deleted | Operations deletes Authorization | Operations | All downstream Listings must have been deleted prior to this action — deletion is blocked if any Listing exists. |

### 7.2 Cross-Object State Effects

No automated cross-object state effects. The Authorization is a precondition object — its existence gates downstream creation, but it does not drive state transitions on other objects.

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Not applicable — this object has no state machine.

**Deletion:**
- Authorizations may be deleted by Operations, subject to BR-006 (no Listings may exist). Once deleted, permanently removed — no longer retrievable via the API.
- Deletion is blocked if any Listing references this Authorization, regardless of the Listing's state or downstream Agreement activity.

**Audit & history requirements:**
Audit block captures `created` and `updated` timestamps and Actors, consistent with the standard PlatformObjectAudit schema.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
|----------|--------------------------|---------------|------------|-------|
| Duplicate Authorization created (same Seller, Vendor, Product, currency) | Second Authorization created successfully. Platform does not enforce uniqueness on this tuple. | Operations, Vendor | Medium | May represent a valid configuration (e.g. separate billing cadences) or misconfiguration. Operations is responsible for managing Authorization inventory. |
| Operations attempts to delete an Authorization with active Listings | Deletion blocked. Authorization cannot be deleted while any Listing exists. | Operations | Low | Operations must delete all Listings first. Listing deletion is itself subject to Listing-level guards. |
| settings blob contains sensitive credentials | Platform accepts the value — no content validation beyond well-formed JSON. Credentials stored in clear text. | Vendor | High | Canon explicitly documents this as unsupported use. Vendor is responsible for not storing sensitive data in settings. |
| journal.firstInvoiceDate is set incorrectly | No platform behaviour is triggered — the field is a reference value only. Incorrect date may cause missed billing reminders or operational confusion. | Operations | Low | No automated enforcement. Operational risk only. |

---

## 10. Open Questions

- AUT-001: What are the full semantics of eligibility.partner = true/false? What specifically does partner eligibility gate, and how does it interact with the Partner actor model and Programs/Administration canon?

---

## 11. Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2026-03-09 | Stu / Claude | Initial canon. |
| 0.2 | 2026-03-14 | Stu / Claude | Schema review against OpenAPI extract. Section 2: Vendor write access clarified — settings only, not all update fields. Section 5: name marked required; currency marked required and immutable; vendor reference field added; journal and eligibility fields marked required on creation; revision marked read-only; statistics fields noted as platform-computed. Section 8: audit note corrected — both created and updated events recorded. Section 10: AUT-002 removed (resolved). SD-004 and SD-005 raised in spec discrepancy tracker. |
