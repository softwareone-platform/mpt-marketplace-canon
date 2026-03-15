# Object Canon: Seller

> **Version:** 0.2
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

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
|-------|------------|----------|------------|------------|-------|
| Vendor | No | Contextual | No | No | Seller is surfaced as a reference on Authorizations and Listings. Vendor cannot query Sellers directly. |
| Operations | Yes | Yes | Yes | No | Sellers cannot be deleted in any state. See BR-001. |
| Client | No | Contextual | No | No | Seller is surfaced as a reference on Agreements and Orders. Client cannot query Sellers directly. |

---

## 3. State Machine

### 3.1 States

| State | Description |
|-------|-------------|
| Active | The Seller is operational. Available as the Owner on new Authorizations and as the transacting party on new Listings and Orders. |
| Disabled | The Seller is inactive. Observed on legacy entities — typically SoftwareOne legal entities that have been superseded following an acquisition or ERP consolidation. The platform effect of `Disabled` status on downstream objects (Authorizations, Listings, and active transactions) is not confirmed. See SEL-001. |

### 3.2 Transitions

| ID | From State | To State | Action | Actor | Precondition | Notes |
|----|-----------|---------|--------|-------|-------------|-------|
| T1a | — | Active | Create | Operations | None | Sellers may be created directly into Active status. |
| T1b | — | Disabled | Create | Operations | None | Sellers may be created directly into Disabled status. |
| T2 | Active | Disabled | Disable | Out-of-band | Not confirmed | Status transitions do not occur via the platform API. Believed to be managed by a dedicated operational tooling process outside the API surface. See SEL-001. |
| T3 | Disabled | Active | Enable | Out-of-band | Not confirmed | As T2 — not confirmed to occur in practice. See SEL-001. |

### 3.3 State Diagram

```
           ---(Create Active : Operations)---> [Active] <---(Enable : out-of-band)---+
—                                                  |                                 |
           ---(Create Disabled : Operations)--->   +---(Disable : out-of-band)---> [Disabled]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
|---------|---------------|---------------------|-------------|-------|
| BR-001 | A Seller cannot be deleted in any state. Deletion is not available to any Actor via the platform API. | All | All | The downstream impact on Authorizations, Listings, ErpLinks, and active transactions would be catastrophic. Not enforced via a deletion guard — deletion is simply not exposed via the API surface. |
| BR-002 | Each Seller has a 1:1 relationship with an instance of SoftwareOne's ERP system. The `externalId` field is the ERP-side identifier, synced by the ERP Sync process. Uniqueness of `externalId` is not enforced by the platform. | All | All | `externalId` may be overridden by Operations via the API. Multiple Sellers may exist for the same country where acquisition history has produced multiple ERP instances. |
| BR-003 | A Seller's `currencies` array defines the set of currencies in which that Seller may transact. One or more currencies must be present. | All | Operations | Whether the platform enforces a minimum cardinality of one on creation is not confirmed. See SEL-006. |
| BR-004 | A Seller's `name` is a freeform string. The platform enforces no naming convention. | All | Operations | In practice, Operations uses country names for active Sellers and appends `(old)` or a legacy identifier to names of superseded entities. This is convention only — not enforced by the platform. |
| BR-005 | The `buyers` collection is not returned in Seller API responses. It appears in `$meta.omitted` regardless of whether `select=+buyers` is included in the request — the platform suppresses it unconditionally. | All | All | This differs from the standard default-omission pattern where `select=+fieldName` successfully includes the field. Suppression is believed to be a performance constraint given the size of the Buyers collection. The mechanism for accessing Buyer data associated with a Seller is not confirmed. See SEL-002. |
| BR-006 | Vendor and Client Actors cannot query Sellers directly via the platform API. Seller identity is surfaced contextually — to Vendors on Authorizations and Listings, and to Clients on Agreements and Orders. | All | Vendor, Client | |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
|-----------|------|-------------|--------|------------------------|-------|
| id | String | Platform-assigned unique identifier. Format: `SEL-NNNN-NNNN`. | System | No | Immutable. Assigned at creation. |
| name | String | Human-readable label for the Seller. Freeform — no naming convention enforced by the platform. | Operations | Yes | Required on creation. |
| externalId | String | The ERP-side identifier for this Seller. Represents the 1:1 relationship between a Seller and an ERP instance. | ERP Sync | Yes | Synced from the ERP by the ERP Sync process. Can be overridden by Operations via the API. Uniqueness not enforced by the platform. |
| status | Enum | Operational status of the Seller. One of: `Active`, `Disabled`. | Out-of-band | See Section 3 | Not managed via the platform API. Transitions are handled by operational tooling outside the API surface. See SEL-001. |
| currencies | Array of String | The set of ISO 4217 currency codes in which this Seller may transact. | Operations | Yes | One or more values required. See BR-003 and SEL-006. |
| address.addressLine1 | String | First line of the Seller's registered address. | Operations | Yes | Required on creation. |
| address.addressLine2 | String | Second line of the Seller's registered address. | Operations | Yes | Optional. Absent from response when null. |
| address.postCode | String | Postal code of the Seller's registered address. | Operations | Yes | Required on creation. Freeform string — no format validation observed. `"N/A"` used where not applicable. |
| address.city | String | City of the Seller's registered address. | Operations | Yes | Required on creation. |
| address.state | String | State or region of the Seller's registered address. | Operations | Yes | Optional in practice. `"N/A"` used where not applicable. |
| address.country | String | ISO 3166-1 alpha-2 country code of the Seller's registered address. | Operations | Yes | Required on creation. Not unique across Sellers — multiple Sellers may share the same country. |
| icon | String | URL path to the Seller's icon. Follows the jdenticon behaviour — defaults to a server-generated jdenticon; a custom icon may be uploaded to replace it. | Operations | Yes | Returns jdenticon URL by default. Never null in practice. See Preamble Section 9. One entry in production data has no `icon` field — see SEL-004. |
| buyers | Collection | The collection of Buyers associated with this Seller via ErpLinks. | System | N/A | Omitted from API responses unconditionally — appears in `$meta.omitted` even when `select=+buyers` is requested. See BR-005 and SEL-002. |
| audit | Object | Standard platform audit block. Records `created` and `updated` timestamps and Actor references. | System | N/A | Omitted from API responses by default. Request via `select=+audit`. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
|----------------|------------------|-------------|-------------|----------------------|
| Catalog: Authorization | Parent of | One:Many | A Seller acts as the Owner of Authorizations. An Authorization cannot exist without an Owner Seller. | Yes — Authorization cannot exist without an Owner Seller. Seller deletion is not possible, so Authorization orphaning via Seller deletion cannot occur. |
| Catalog: Listing | Association | One:Many | A Seller acts as the transacting party on Listings. A Listing references a Seller as its transacting entity. | No direct lifecycle dependency — a Listing's direct parent is its Authorization. Seller deletion is not possible. When a Seller is disabled, new Orders cannot be placed under any Listing referencing that Seller. |
| Accounts: ErpLink | Parent of | One:Many | An ErpLink joins a Seller to a Buyer, carrying the ERP-side customer identifiers for that relationship. A Seller may have many ErpLinks. | Yes — an ErpLink cannot exist without a Seller. Seller deletion is not possible, so ErpLink orphaning via Seller deletion cannot occur. ErpLink canon is pending. |
| Accounts: Buyer | Association | Many:Many | Buyers are associated with Sellers through ErpLinks, not directly. A Buyer may be linked to more than one Seller where the MDM team has replicated a Buyer across multiple ERP instances. A Seller may be linked to many Buyers. | No direct lifecycle dependency between Seller and Buyer — the dependency is mediated by ErpLink. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
|-------|---------|-------------------|---------------------------------|
| Seller created | Operations creates a Seller | Operations | Seller becomes available as the Owner on new Authorizations and as the transacting party on new Listings. |
| Seller disabled | Out-of-band operational tooling | Out-of-band | Seller is no longer available as the transacting party for new Orders under any referencing Listing. Existing Agreements and Subscriptions are unaffected. See SEL-001. |
| externalId updated | ERP Sync process updates externalId, or Operations overrides via the API | ERP Sync, Operations | ERP-side correlation identifier updated. No downstream platform state changes triggered. |
| currencies updated | Operations updates the currencies array | Operations | Updated currency set is immediately reflected on the Seller. Effect on existing Authorizations and Listings denominated in a removed currency is not confirmed. See SEL-005. |
| icon uploaded | Operations uploads a custom icon | Operations | Custom icon replaces the jdenticon. Returned as the value of the `icon` field in subsequent API responses. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect | Automated? | Condition | Notes |
|-----------------|----------------|--------|------------|-----------|-------|
| Seller disabled | Catalog: Listing | New Orders cannot be placed under any Listing referencing this Seller. | Yes | Seller status = Disabled | Confirmed in Listing canon BR-012. Existing Agreements and Subscriptions continue normally. |
| Seller disabled | Accounts: ErpLink | Effect on associated ErpLinks not confirmed. | Not confirmed | — | See SEL-001. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Both creation target states (Active and Disabled) are reachable from either state via out-of-band tooling, so transitions are technically reversible. However, reversal does not occur via the platform API and the mechanics are not confirmed. See SEL-001.

**Deletion:**
Sellers cannot be deleted in any state. Deletion is not available to any Actor via the platform API. See BR-001.

**Audit & history requirements:**
The audit block captures `created` and `updated` timestamps and Actor references, consistent with the standard platform audit schema. Audit is omitted from API responses by default — request via `select=+audit`. Three distinct automated Actors have been observed writing to Sellers in production: a migration token (used during initial platform population), an ERP Sync token, and an account management monitoring token.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
|----------|--------------------------|---------------|------------|-------|
| Seller disabled | No new Orders can be placed under any Listing referencing this Seller. Existing Agreements and Subscriptions continue normally. | Client, Operations | High | Downstream impact on active Listings is immediate. Effect on ErpLinks and other dependent objects is not confirmed. See SEL-001. |
| Currency removed from Seller currencies array | Effect on existing Authorizations and Listings denominated in the removed currency is not confirmed. | Operations, Vendor, Client | High | Operations should exercise caution when modifying the currencies array on an active Seller. See SEL-005. |
| externalId overridden by Operations | ERP-side correlation is broken until the ERP Sync process reconciles or the override is reverted. | Operations | Medium | externalId is the ERP-side identifier — manual override should only be performed with full understanding of the ERP integration impact. |
| Multiple Sellers exist for the same country | Platform permits this — address.country is not unique across Sellers. Multiple active Sellers for the same country is a valid configuration resulting from acquisition history. | Operations | Low | Operations is responsible for managing the Seller inventory and ensuring Listings reference the correct Seller for each transaction context. |
| Seller created with no currencies | Not confirmed whether the platform enforces a minimum of one currency on creation. If permitted, the Seller would be unable to transact. | Operations | Medium | See SEL-006. |
| Missing icon field | One Seller in production (`BG_CPX`, `SEL-9696-0728`, Disabled) has no `icon` field in its API response, where all other Sellers return a jdenticon URL. Cause unknown — may be a data anomaly from migration or an edge case in icon behaviour for early-created or Disabled records. | Operations | Low | See SEL-004. |

---

## 10. Open Questions

- [ ] SEL-001: Status transition mechanics for Sellers are not confirmed. Transitions between `Active` and `Disabled` do not appear to be available via the platform API to any Actor. The executing mechanism, preconditions, and downstream platform effects of `Disabled` status on Authorizations, Listings, ErpLinks, and active transactions are unconfirmed. Believed to be managed by operational tooling outside the platform API surface.
- [ ] SEL-002: The mechanism for accessing Buyer data associated with a Seller is not confirmed. The `buyers` field appears in `$meta.omitted` on Seller responses unconditionally — even when `select=+buyers` is explicitly requested. It is unclear whether Buyers can be queried via the Seller endpoint at all, or whether Buyer access is always via a dedicated Buyer endpoint.
- [ ] SEL-004: One Seller in production (`BG_CPX`, `SEL-9696-0728`, Disabled) has no `icon` field in its API response, where all other Sellers return a jdenticon URL. Cause unknown — may be a data anomaly from migration or an edge case in icon behaviour for early-created or Disabled records.
- [ ] SEL-005: The effect of removing a currency from a Seller's `currencies` array on existing Authorizations and Listings denominated in that currency is not confirmed. Whether the platform permits the removal of a currency that is actively referenced downstream is also unconfirmed.
- [ ] SEL-006: Whether the platform enforces a minimum cardinality of one on the `currencies` array at creation time is not confirmed.

---

## 11. Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2026-03-15 | Stu | Initial canon. |
| 0.2 | 2026-03-15 | Stu | Administration namespace renamed to Accounts throughout — Sections 1, 4, 6, and 7 updated. |
