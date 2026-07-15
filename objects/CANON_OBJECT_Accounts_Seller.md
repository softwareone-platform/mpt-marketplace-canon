# Object Canon: Seller

> **Version:** 0.3
> **Owner:** Stu
> **Last Updated:** 2026-03-15
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Seller

**Namespace:** Accounts

**Parent Object:** None — top-level Accounts object.

**ID Prefix:** SEL

**Description:**
A Seller is a SoftwareOne legal entity registered in the SoftwareOne Marketplace. Each Seller has a 1:1 relationship with an instance of SoftwareOne's ERP system. Sellers exist for every country or jurisdiction in which SoftwareOne conducts business, including entities acquired through mergers and acquisitions that continue to transact independently until ERP consolidation. A Seller acts as the owner of Authorizations and as the transacting party on Listings — it is the named SoftwareOne entity on a commercial transaction with a Client.

**Also Known As:**
None known.

---

---

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | No | Contextual | No | No | Seller is surfaced as a reference on Authorizations and Listings. Vendor cannot query Sellers directly. |
| Operations | Yes | Yes | Yes | Yes* | *DELETE endpoint exists in the API spec. Whether a deletion guard exists in practice is not confirmed. See SEL-010. |
| Client | No | Contextual | No | No | Seller is surfaced as a reference on Agreements and Orders. Client cannot query Sellers directly. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Active | The Seller is operational. Available as the Owner on new Authorizations and as the transacting party on new Listings and Orders. | — | — |
| Disabled | The Seller is inactive. Observed on legacy entities — typically SoftwareOne legal entities that have been superseded following an acquisition or ERP consolidation. The platform effect of `Disabled` status on downstream objects is confirmed for Listings (new Orders blocked) but not fully confirmed for all downstream objects. | — | — |
| Offline | Status value present in the API spec. Semantics, transition mechanics, and downstream effects are not confirmed. See SEL-009. | — | — |
| Deleted | Status value present in the API spec. Distinct from the DELETE endpoint — whether this represents a soft-delete state or is synonymous with deletion is not confirmed. See SEL-009. | — | — |
| Unknown | — | No | No |

### 3.2 Transitions

| # | From State | To State | Action / Trigger | Permitted Actor(s) | Preconditions | Outcome / Side Effects |
| --- | --- | --- | --- | --- | --- | --- |
| T1a | — | Active | Create | Operations | None | Sellers may be created directly into Active status. |
| T1b | — | Disabled | Create | Operations | None | Sellers may be created directly into Disabled status. |
| T2 | Active | Disabled | Disable Seller | Operations | Not confirmed | Dedicated action endpoint in the API spec. Preconditions not confirmed. |
| T3 | Disabled | Active | Activate Seller | Operations | Not confirmed | Dedicated action endpoint in the API spec. Preconditions not confirmed. |
| T4 | Unknown | Unknown | POST `/deactivate` | Operations | Not confirmed | Dedicated action endpoint in the API spec. How `deactivate` differs from `disable`, and which state it produces, is not confirmed. See SEL-008. |
| T5 | Unknown | Deleted | DELETE `/{id}` | Operations | Not confirmed | DELETE endpoint exists in the API spec (returns 204). Whether a deletion guard exists in practice is not confirmed. See SEL-010. |

### 3.3 State Diagram

```
— ---(Create Active)---> [Active] <---(POST /activate)--- [Disabled] <--- ?
     ---(Create Disabled)--->  |                                |
                          (POST /disable)              (POST /deactivate?)
                               |                                |
                               +--------> [Disabled] ----------+

[Offline] and [Deleted]: transition mechanics not confirmed — see SEL-008, SEL-009
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A `DELETE` endpoint exists for Sellers in the API spec (`DELETE /v1/accounts/sellers/{id}`, returns 204). Whether the platform enforces a deletion guard in practice — and what conditions would permit or block deletion — is not confirmed. See SEL-010. | All | Operations | This supersedes earlier canon which stated deletion was not available via the API. The endpoint exists; the guard, if any, is unknown. |
| BR-002 | Each Seller has a 1:1 relationship with an instance of SoftwareOne's ERP system. The `externalId` field is the ERP-side identifier, synced by the ERP Sync process. Uniqueness of `externalId` is not enforced by the platform. | All | All | `externalId` may be overridden by Operations via the API. Multiple Sellers may exist for the same country where acquisition history has produced multiple ERP instances. |
| BR-003 | A Seller's `currencies` array defines the set of currencies in which that Seller may transact. A minimum of one currency is required — enforced by the platform (`minItems: 1` on the `SellerCreate` schema). | All | Operations | Platform-enforced on creation. Whether the platform also enforces this constraint on update (preventing removal of the last currency) is not confirmed. |
| BR-004 | A Seller's `name` is a freeform string with a minimum length of 1 and a maximum length of 500 characters. The platform enforces no naming convention beyond these constraints. | All | Operations | In practice, Operations uses country names for active Sellers and appends `(old)` or a legacy identifier to names of superseded entities. Convention only. |
| BR-005 | The `buyers` collection is not returned in Seller API responses. It appears in `$meta.omitted` regardless of whether `select=+buyers` is included in the request — the platform suppresses it unconditionally. | All | All | This differs from the standard default-omission pattern where `select=+fieldName` successfully includes the field. Suppression is believed to be a performance constraint given the size of the Buyers collection. The mechanism for accessing Buyer data associated with a Seller is not confirmed. See SEL-002. |
| BR-006 | Vendor and Client Actors cannot query Sellers directly via the platform API. Seller identity is surfaced contextually — to Vendors on Authorizations and Listings, and to Clients on Agreements and Orders. | All | Vendor, Client | — |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| id | String | Platform-assigned unique identifier. Format: `SEL-NNNN-NNNN`. | System | No | Immutable. Assigned at creation. |
| name | String | Human-readable label for the Seller. Freeform — no naming convention enforced by the platform. | Operations | Yes | Required on creation. `minLength: 1`, `maxLength: 500`. |
| externalId | String | The ERP-side identifier for this Seller. Represents the 1:1 relationship between a Seller and an ERP instance. | ERP Sync | Yes | Synced from the ERP by the ERP Sync process. Can be overridden by Operations via the API. Nullable. Uniqueness not enforced by the platform. |
| status | Enum | Operational status of the Seller. One of: `Active`, `Disabled`, `Offline`, `Deleted`. | Operations (via action endpoints) | Yes | Managed via dedicated action endpoints (`/activate`, `/disable`, `/deactivate`). Full state machine semantics not confirmed. See SEL-008, SEL-009. |
| currencies | Array of String | The set of ISO 4217 currency codes in which this Seller may transact. | Operations | Yes | Minimum of one currency required — platform-enforced (`minItems: 1`). Nullable on the full Seller schema but required on `SellerCreate`. |
| address.addressLine1 | String | First line of the Seller's registered address. | Operations | Yes | Nullable per API spec. |
| address.addressLine2 | String | Second line of the Seller's registered address. | Operations | Yes | Optional. Absent from response when null. |
| address.postCode | String | Postal code of the Seller's registered address. | Operations | Yes | Nullable per API spec. Freeform string — no format validation observed. `"N/A"` used where not applicable. |
| address.city | String | City of the Seller's registered address. | Operations | Yes | Nullable per API spec. |
| address.state | String | State or region of the Seller's registered address. | Operations | Yes | Nullable per API spec. `"N/A"` used where not applicable. |
| address.country | String | ISO 3166-1 alpha-2 country code of the Seller's registered address. | Operations | Yes | Nullable per API spec. Not unique across Sellers — multiple Sellers may share the same country. |
| erpLink | Object (ErpLinkRef) | A reference to an ErpLink associated with this Seller. | System | N/A | Present as a single reference on the Seller object in the API spec — not a collection. The relationship between this field and the broader Seller:Buyer association model is not confirmed. See SEL-007. |
| icon | String | URL path to the Seller's icon. Follows the jdenticon behaviour — defaults to a server-generated jdenticon; a custom icon may be uploaded to replace it. | Operations | Yes | Returns jdenticon URL by default. Nullable in the spec. Uploaded via the `logo` binary field on the PUT endpoint (`multipart/form-data`). See Preamble Section 9. One entry in production data has no `icon` field — see SEL-004. |
| buyers | Collection | The collection of Buyers associated with this Seller via ErpLinks. | System | N/A | Omitted from API responses unconditionally — appears in `$meta.omitted` even when `select=+buyers` is requested. See BR-005 and SEL-002. |
| audit | Object | Standard platform audit block. Records `created` and `updated` timestamps and Actor references. | System | N/A | Omitted from API responses by default. Request via `select=+audit`. |
| revision | Integer | Increments on each update. | System | N/A | Read-only. |
| Address | object | Registered address of the Seller. Sub-fields: addressLine1, addressLine2, postCode, city, state, country — all nullable per API spec. address.country is ISO 3166-1 alpha-2; not unique across Sellers. "N/A" used where a subfield is not applicable. | operations | — | — |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Authorization | Parent of | One:Many | A Seller acts as the Owner of Authorizations. An Authorization cannot exist without an Owner Seller. | Yes — Authorization cannot exist without an Owner Seller. Seller deletion guard not confirmed — see SEL-010. |
| Catalog: Listing | Association | One:Many | A Seller acts as the transacting party on Listings. A Listing references a Seller as its transacting entity. | No direct lifecycle dependency — a Listing's direct parent is its Authorization. When a Seller is disabled, new Orders cannot be placed under any Listing referencing that Seller. |
| Accounts: ErpLink | Association* | One:? | An ErpLink reference (`erpLink`) is exposed as a single field on the Seller object in the API spec. The full cardinality and nature of the Seller:ErpLink relationship is not confirmed. See SEL-007. | Not confirmed. |
| Accounts: Buyer | Association | Many:Many | Buyers are associated with Sellers through ErpLinks, not directly. A Buyer may be linked to more than one Seller where the MDM team has replicated a Buyer across multiple ERP instances. A Seller may be linked to many Buyers. | No direct lifecycle dependency between Seller and Buyer — the dependency is mediated by ErpLink. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Seller created | Operations creates a Seller | Operations | Seller becomes available as the Owner on new Authorizations and as the transacting party on new Listings. |
| Seller disabled | Operations calls POST `/disable` | Operations | Seller is no longer available as the transacting party for new Orders under any referencing Listing. Existing Agreements and Subscriptions are unaffected. |
| Seller activated | Operations calls POST `/activate` | Operations | Seller returns to Active status. Available again as the transacting party on Listings. |
| Seller deactivated | Operations calls POST `/deactivate` | Operations | Resulting state and downstream effects not confirmed. See SEL-008. |
| externalId updated | ERP Sync process updates externalId, or Operations overrides via the API | ERP Sync, Operations | ERP-side correlation identifier updated. No downstream platform state changes triggered. |
| currencies updated | Operations updates the currencies array | Operations | Updated currency set is immediately reflected on the Seller. Effect on existing Authorizations and Listings denominated in a removed currency is not confirmed. See SEL-005. |
| icon uploaded | Operations uploads a custom icon via the `logo` field on PUT | Operations | Custom icon replaces the jdenticon. Returned as the value of the `icon` field in subsequent API responses. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Seller disabled | Catalog: Listing | New Orders cannot be placed under any Listing referencing this Seller. | Yes | Seller status = Disabled | Confirmed in Listing canon BR-012. Existing Agreements and Subscriptions continue normally. |
| Seller disabled | Accounts: ErpLink | Effect on associated ErpLinks not confirmed. | Not confirmed | — | See SEL-008, SEL-009. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
The `Active` ↔ `Disabled` cycle is reversible via the `/activate` and `/disable` action endpoints. No limit on cycles has been confirmed. The semantics of `/deactivate` and whether it is reversible are not confirmed. See SEL-008.

**Deletion:**
A `DELETE /v1/accounts/sellers/{id}` endpoint exists in the API spec and returns 204. Whether the platform enforces a deletion guard in practice — and what conditions would permit or block it — is not confirmed. Once deleted, permanently removed — no longer retrievable via the API. See SEL-010.

**Audit & history requirements:**
The audit block captures `created` and `updated` timestamps and Actor references, consistent with the standard platform audit schema. Audit is omitted from API responses by default — request via `select=+audit`. Three distinct automated Actors have been observed writing to Sellers in production: a migration token (used during initial platform population), an ERP Sync token, and an account management monitoring token.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Seller disabled | No new Orders can be placed under any Listing referencing this Seller. Existing Agreements and Subscriptions continue normally. | Client, Operations | High | Downstream impact on active Listings is immediate. Effect on ErpLinks and other dependent objects is not confirmed. |
| Currency removed from Seller currencies array | Effect on existing Authorizations and Listings denominated in the removed currency is not confirmed. | Operations, Vendor, Client | High | Operations should exercise caution when modifying the currencies array on an active Seller. See SEL-005. |
| externalId overridden by Operations | ERP-side correlation is broken until the ERP Sync process reconciles or the override is reverted. | Operations | Medium | externalId is the ERP-side identifier — manual override should only be performed with full understanding of the ERP integration impact. |
| Multiple Sellers exist for the same country | Platform permits this — address.country is not unique across Sellers. Multiple active Sellers for the same country is a valid configuration resulting from acquisition history. | Operations | Low | Operations is responsible for managing the Seller inventory and ensuring Listings reference the correct Seller for each transaction context. |
| Seller deleted | Platform behaviour not confirmed — deletion guard and downstream effects are unknown. | Operations, Client, Vendor | High | See SEL-010. Do not attempt to delete a Seller without first confirming the guard conditions and downstream impact. |
| Missing icon field | One Seller in production (`BG_CPX`, `SEL-9696-0728`, Disabled) has no `icon` field in its API response, where all other Sellers return a jdenticon URL. Cause unknown — may be a data anomaly from migration or an edge case in icon behaviour for early-created or Disabled records. | Operations | Low | See SEL-004. |

---

## 10. Open Questions

- [ ] SEL-002: The mechanism for accessing Buyer data associated with a Seller is not confirmed. The `buyers` field appears in `$meta.omitted` on Seller responses unconditionally — even when `select=+buyers` is explicitly requested. It is unclear whether Buyers can be queried via the Seller endpoint at all, or whether Buyer access is always via a dedicated Buyer endpoint.
- [ ] SEL-004: One Seller in production (`BG_CPX`, `SEL-9696-0728`, Disabled) has no `icon` field in its API response, where all other Sellers return a jdenticon URL. Cause unknown — may be a data anomaly from migration or an edge case in icon behaviour for early-created or Disabled records.
- [ ] SEL-005: The effect of removing a currency from a Seller's `currencies` array on existing Authorizations and Listings denominated in that currency is not confirmed. Whether the platform permits the removal of a currency that is actively referenced downstream is also unconfirmed.
- [ ] SEL-007: The `erpLink` field on the Seller object is a single `ErpLinkRef` reference, not a collection. The relationship between this field and the broader Seller:Buyer association model is not confirmed. Suspected to represent the Seller's relationship to its ERP instance rather than to a specific Buyer. Requires engineering input.
- [ ] SEL-008: The `/deactivate` action endpoint exists in the API spec alongside `/disable`. How `deactivate` differs from `disable`, which state it produces, and what its downstream effects are, is not confirmed.
- [ ] SEL-009: The `SellerStatus` enum includes `Offline` and `Deleted` in addition to `Active` and `Disabled`. The semantics, transition mechanics, and downstream effects of `Offline` and `Deleted` status values are not confirmed. `Deleted` may represent a soft-delete state distinct from the DELETE endpoint.
- [ ] SEL-010: A `DELETE /v1/accounts/sellers/{id}` endpoint exists in the API spec (returns 204). Whether the platform enforces a deletion guard in practice — and what conditions permit or block deletion — is not confirmed. The downstream impact on Authorizations, Listings, and ErpLinks if a Seller is deleted is not confirmed.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-03-15 | Stu | Initial canon. |
| 0.2 | 2026-03-15 | Stu | Administration namespace renamed to Accounts throughout — Sections 1, 4, 6, and 7 updated. |
| 0.3 | 2026-03-15 | Stu | OpenAPI spec review. Section 3: state machine revised — status transitions confirmed as API endpoints (/activate, /disable, /deactivate); Offline and Deleted states added. Section 2: Delete column updated — DELETE endpoint exists in spec. BR-001 rewritten — deletion endpoint confirmed, guard unknown (SEL-010). BR-003 updated — minItems: 1 confirmed. BR-004 updated — name length constraints added. Section 5: name length constraints added; address fields corrected to nullable; erpLink field added; revision added; icon upload mechanism clarified (logo field on PUT). Section 6: ErpLink relationship updated to reflect single erpLink reference on Seller object. Section 7: transition events updated to reference API endpoints. Section 8: reversibility and deletion updated. Section 9: Seller deleted failure mode added. SEL-001 closed (transitions confirmed as API endpoints). SEL-006 closed (minItems: 1 confirmed). SEL-007, SEL-008, SEL-009, SEL-010 added. |
