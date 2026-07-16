# Object Canon: Authorization

> **Version:** 0.4
> **Owner:** Stu
> **Last Updated:** 2026-07-15
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Authorization

**Namespace:** Catalog

**Parent Object:** None — top-level Catalog object.

**ID Prefix:** AUT

**Description:**
An Authorization is the formal record of a commercial relationship between a SoftwareOne [[Seller]] and a Vendor, scoped to a specific [[Product]] and currency. It represents the contractual basis under which the Seller is permitted to transact that Product in that currency on behalf of SoftwareOne. An Authorization is a precondition for creating a [[Listing]] — no Listing can exist without an Authorization. It carries billing cadence, eligibility rules, and an optional schemaless settings blob for Vendor-specific configuration.

---

**Also Known As:**
None known.

---

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | No | Yes | Yes* | No | Read is self-scoped to Authorizations where they are the Vendor — no field-level suppression at all; Vendor sees every field, including `notes` and `statistics`. *Vendor can only write `settings`. All other fields are Operations-managed. |
| Operations | Yes | Yes | Yes | Yes | Full access. Creates and manages Authorizations. Deletion subject to BR-006. |
| Client | No | Yes** | No | No | **Client can query Authorizations directly (list and by-ID) — this is a real, implemented row-scoping rule, not an oversight: Client's read access is restricted to Authorizations whose [[Product]] is Published. Field visibility is nearly identical to Operations/Vendor — every field is visible except `statistics`, which is suppressed for Client only. |

---

## 3. State Machine

This object has no state machine. An Authorization exists as a persistent record from creation until deletion. Its availability as a precondition for Listings is controlled by its existence, not by a state.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An Authorization records the commercial relationship between exactly one Accounts: [[Seller]] (the Authorization Owner), one Vendor, one Catalog: [[Product]], and one currency. | N/A | All | Owner, Vendor, and Product are fixed at creation and immutable thereafter. Currency is set at creation but — unlike the other three — can be changed afterward by Operations (see BR-013); it is not a rigid part of the Authorization's identity in the way Owner/Vendor/Product are. |
| BR-002 | Multiple Authorizations may exist with the same [[Seller]], Vendor, [[Product]], and currency. The platform does not enforce uniqueness on this tuple. Duplicate Authorizations may represent valid commercial configurations or may represent misconfiguration — the Vendor and Operations are responsible for managing this. | N/A | All | No uniqueness check exists at creation, and no database constraint enforces it either. |
| BR-003 | An Authorization is a precondition for creating a [[Listing]]. A [[Listing]] cannot exist without a parent Authorization. | N/A | All | — |
| BR-004 | An Authorization may be referenced by more than one [[Listing]]. | N/A | All | — |
| BR-005 | journal.firstInvoiceDate and journal.frequency are set by Operations only. These fields record the billing cadence established under the commercial relationship. No platform behaviour is automatically triggered by these values — they serve as a reference for billing operations. | N/A | Operations | — |
| BR-006 | An Authorization can only be deleted if it has no Listings. The presence of any [[Listing]] — regardless of that [[Listing]]'s state or whether it has downstream active Agreements — blocks deletion. | N/A | Operations | Deletion of the Authorization's Listings is a precondition for Authorization deletion. [[Listing]] deletion is itself subject to [[Listing]]-level deletion guards — see [[Listing]] canon. |
| BR-007 | settings is an optional schemaless JSON blob. It must be valid JSON but is not validated against any schema. It may be read and written by Vendor and Operations at any time. It has a maximum size of 4,000 characters. | N/A | Vendor, Operations | Intended for non-sensitive Vendor-specific configuration such as Vendor IDs used during [[Order]] fulfilment. Clear text — sensitive credentials should not be stored here. |
| BR-008 | notes is a plain-text internal documentation field set by Operations. It is readable by Vendor, Operations, and Client alike — there is no suppression on this field for any Actor. | N/A | Operations | Intended for internal operational notes about the Authorization. Despite the field's name and intent, it is not hidden from Client. |
| BR-009 | eligibility controls a client/partner distinction recorded against this Authorization. client and partner are independent boolean flags set by Operations based on contract terms with the Vendor. | N/A | Operations | These flags are a contractual record only — no platform logic (Listing, Agreement, Order, PricingPolicy, or Program creation/validation) reads or enforces them. Each of those objects that has its own client/partner eligibility model maintains its own independent value, not derived from the Authorization's. |
| BR-010 | externalIds.operations is an Operations-set external identifier for the Authorization, used to correlate with external systems. There is no vendor external ID namespace on Authorization. | N/A | Operations | — |
| BR-011 | Authorization creation, modification, and deletion are not restricted by the state of the parent [[Product]]. | N/A | Operations | Consistent with platform permissiveness philosophy. Exception: if the parent Product is deleted while still in Draft state, the Authorization is cascade-removed along with it — see Section 6 and Section 7.2. |
| BR-012 | The `vendor` reference is not an input field on creation — it is always derived from the parent [[Product]]'s own vendor Account and cannot be set or changed independently. An Authorization's vendor can never differ from its Product's vendor. | N/A | Operations | Enforced at creation by resolving the Product first, then validating the resulting Account is genuinely of type Vendor. |
| BR-013 | `currency` may be changed by Operations after creation via a standard update. | N/A | Operations | Unlike Owner, Vendor, and Product (all immutable after creation), currency is not fixed for the life of the Authorization — see BR-001. The new currency is not validated against the Owner Seller's supported currencies — see Section 9. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| name | String | Human-readable label for the Authorization | Operations | Yes | Visible To: Vendor, Operations, Client. Required on creation despite the OpenAPI schema's `required` array omitting it — a spec-generation gap, not real optionality. |
| currency | String | ISO 4217 currency code. The currency in which this Authorization permits the Seller to transact. | Operations | Yes | Visible To: Vendor, Operations, Client. Required on creation (same spec-generation gap as `name`). Mutable via update — see BR-013. Not validated against the Owner [[Seller]]'s supported currencies at creation or update. |
| vendor | Object (AccountRef) | Reference to the Vendor Account associated with this Authorization | System | No | Visible To: Vendor, Operations, Client. Derived from the parent [[Product]]'s own vendor Account at creation — see BR-012. Immutable. |
| externalIds.operations | String | Operations-set external identifier, used to correlate with external systems | Operations | Yes | Visible To: Vendor, Operations, Client. Optional. No vendor external ID namespace exists on this object. |
| notes | String | Internal plain-text documentation field | Operations | Yes | Visible To: Vendor, Operations, Client — see BR-008. Optional. |
| settings | Object | Schemaless JSON blob for Vendor-specific configuration | Vendor, Operations | Yes | Visible To: Vendor, Operations, Client. Optional. Max 4,000 characters. Must be valid JSON. No schema enforced. Omitted from API responses when null — use select=+settings to include. Clear text only — not suitable for credentials. |
| journal.firstInvoiceDate | DateTime | The date from which billing begins under this Authorization | Operations | Yes | Visible To: Vendor, Operations, Client. Required on creation. No platform behaviour is automatically triggered by this value. Used as a billing reference. |
| journal.frequency | Enum | Billing reconciliation frequency. One of: 1m, 3m, 6m, 1y, 3y, one-time | Operations | Yes | Visible To: Vendor, Operations, Client. Required on creation. |
| eligibility.client | Boolean | Whether standard Clients may transact under this Authorization | Operations | Yes | Visible To: Vendor, Operations, Client. Required on creation. Contractual record only — see BR-009. |
| eligibility.partner | Boolean | Whether Partner Clients may transact under this Authorization | Operations | Yes | Visible To: Vendor, Operations, Client. Required on creation. Contractual record only, not read by any platform logic — see BR-009. |
| statistics.subscriptions | Integer | Number of active Subscriptions under this Authorization | System | N/A | Visible To: Vendor, Operations. Computed by platform. Read-only. Suppressed for Client. |
| statistics.agreements | Integer | Number of Agreements under this Authorization | System | N/A | Visible To: Vendor, Operations. Computed by platform. Read-only. Suppressed for Client. |
| statistics.sellers | Integer | Number of Sellers transacting under this Authorization via Listings | System | N/A | Visible To: Vendor, Operations. Computed by platform. Read-only. Suppressed for Client. |
| statistics.listings | Integer | Number of Listings referencing this Authorization | System | N/A | Visible To: Vendor, Operations. Computed by platform. Read-only. Suppressed for Client. |
| revision | Integer | Increments on each update | System | N/A | Visible To: All. Read-only. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Accounts: Seller | Owner | Many:1 | The Seller that owns this Authorization — the SoftwareOne entity that holds the commercial relationship with the Vendor. Known as the Authorization Owner. | Yes — Authorization cannot exist without an Owner Seller. |
| Catalog: Product | Association | Many:1 | An Authorization is scoped to exactly one Product, and its `vendor` is always derived from that Product's own vendor Account (BR-012). | Yes — if the parent Product is deleted while still in Draft state, this Authorization is cascade-removed along with it. Products cannot be deleted once they leave Draft state, so this dependency only ever applies pre-publication. |
| Catalog: Listing | Parent of | One:Many | A Listing cannot exist without a parent Authorization. An Authorization may have multiple Listings. | Yes — Listings cannot exist without an Authorization. Authorization cannot be deleted while any Listing exists. |
| Commerce: Agreement | Indirect | One:Many | Agreements are downstream of Listings which are downstream of Authorizations. Surfaced to Client on Agreement detail as id and name only. | No — direct lifecycle dependency is at Listing level. |
| Commerce: Order | Indirect | One:Many | Orders are downstream of Listings which are downstream of Authorizations. Surfaced to Client on Order detail as id and name only. | No — as above. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Authorization created | Operations creates Authorization | Operations | Authorization becomes available as a precondition for [[Listing]] creation under the same [[Product]]. `vendor` is derived from the Product's own vendor Account (BR-012). |
| settings updated | Vendor or Operations writes settings blob | Vendor, Operations | Updated settings immediately available to any process reading the Authorization. No downstream cascade. |
| currency updated | Operations updates currency | Operations | New currency takes effect immediately. Not validated against the Owner [[Seller]]'s supported currencies. |
| Authorization deleted | Operations deletes Authorization | Operations | All downstream Listings must have been deleted prior to this action — deletion is blocked if any Listing exists. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Product deleted (Draft state only) | Catalog: Authorization | Authorization permanently removed | Yes | Parent [[Product]] is in Draft state | See Catalog: [[Product]] canon BR-002. Products cannot be deleted once they leave Draft state, so this only ever applies pre-publication. |

No other automated cross-object state effects exist. The Authorization is otherwise a precondition object — its existence gates downstream creation, but it does not drive state transitions on other objects, and no other object's events feed back into it beyond its own read-only statistics counters (incremented when a Listing, Agreement, or Subscription referencing it is created/changed/terminated).

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Not applicable — this object has no state machine.

**Deletion:**
- Authorizations may be deleted by Operations, subject to BR-006 (no Listings may exist). Once deleted, permanently removed — no longer retrievable via the API.
- Deletion is blocked if any Listing references this Authorization, regardless of the Listing's state or downstream Agreement activity.
- Exception: an Authorization is cascade-removed without this guard if its parent Product is deleted while still in Draft state (Section 6, Section 7.2).

**Audit & history requirements:**
Audit block captures `created` and `updated` timestamps and Actors, consistent with the standard PlatformObjectAudit schema.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Duplicate Authorization created (same Seller, Vendor, Product, currency) | Second Authorization created successfully. Platform does not enforce uniqueness on this tuple. | Operations, Vendor | Medium | May represent a valid configuration (e.g. separate billing cadences) or misconfiguration. Operations is responsible for managing Authorization inventory. |
| Operations attempts to delete an Authorization with active Listings | Deletion blocked. Authorization cannot be deleted while any Listing exists. | Operations | Low | Operations must delete all Listings first. Listing deletion is itself subject to Listing-level guards. |
| Authorization created or updated with a currency the Owner Seller does not support | Platform accepts the value regardless. Unlike [[Listing]] creation, which validates the Listing's Price List currency against the Seller's supported currencies, Authorization creation and update perform no equivalent check against the Owner Seller's currencies. | Operations | Medium | A real, confirmed gap — Operations should verify currency compatibility with the Owner [[Seller]] manually. |
| settings blob contains sensitive credentials | Platform accepts the value — no content validation beyond well-formed JSON. Credentials stored in clear text. | Vendor | High | Canon explicitly documents this as unsupported use. Vendor is responsible for not storing sensitive data in settings. |
| journal.firstInvoiceDate is set incorrectly | No platform behaviour is triggered — the field is a reference value only. Incorrect date may cause missed billing reminders or operational confusion. | Operations | Low | No automated enforcement. Operational risk only. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-03-09 | Stu | Initial canon. |
| 0.2 | 2026-03-14 | Stu | Schema review against OpenAPI extract. Section 2: Vendor write access clarified — settings only, not all update fields. Section 5: name marked required; currency marked required and immutable; vendor reference field added; journal and eligibility fields marked required on creation; revision marked read-only; statistics fields noted as platform-computed. Section 8: audit note corrected — both created and updated events recorded. Section 10: AUT-002 removed (resolved). SD-004 and SD-005 raised in spec discrepancy tracker. |
| 0.3 | 2026-03-15 | Stu | Administration namespace renamed to Accounts throughout — BR-001 and Section 6 updated. |
| 0.4 | 2026-07-15 | Stu / canon-generate | Refreshed via live OpenAPI schema (STAGING), live-fetched real object (STAGING, all Actors), and source-code research. ID Prefix corrected (was "None", is AUT) and moved out of Also Known As. **Significant corrections**: Section 2 rewritten — Vendor has no field suppression at all (previously stated Vendor couldn't see `notes`); Client sees the entire object except `statistics` and can query Authorizations directly, scoped to Authorizations whose Product is Published (previously stated Client saw only id/name and couldn't query directly) — BR-008 corrected to match. `currency` is mutable via update, not immutable as previously stated (new BR-013); this softens BR-001's "identity tuple" framing. New BR-012: `vendor` is derived from the parent Product's vendor Account at creation, never independently settable. New failure mode: Authorization currency is never validated against the Owner Seller's supported currencies, unlike Listing creation's equivalent check. Section 6/7.2: Product-Draft-deletion cascade to Authorization now documented, matching Catalog: Product's own canon (previously marked "not yet confirmed"). `name`/`currency` required-on-creation gap in the OpenAPI spec confirmed as a generator limitation, not real optionality. AUT-001 resolved and removed — exhaustive search across all synced source repositories found `eligibility.client`/`eligibility.partner` are never read by any downstream platform logic; confirmed as a contractual record only, not runtime-enforced (BR-009). |
