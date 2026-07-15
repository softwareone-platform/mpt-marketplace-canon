# Object Canon: Seller

> **Version:** 0.6
> **Owner:** Stu
> **Last Updated:** 2026-07-15
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
A Seller is a SoftwareOne legal entity registered in the SoftwareOne Marketplace. Each Seller has a 1:1 relationship with an instance of SoftwareOne's ERP system. Sellers exist for every country or jurisdiction in which SoftwareOne conducts business, including entities acquired through mergers and acquisitions that continue to transact independently until ERP consolidation. A Seller acts as the owner of [[Authorization]]s and as the transacting party on [[Listing]]s — it is the named SoftwareOne entity on a commercial transaction with a Client.

**Also Known As:**
None known.

---

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | No | No (query returns empty) | No | No | Seller is surfaced as a reference on Authorizations and Listings only — never fetched directly. |
| Operations | Yes | Yes | Yes | Yes* | *Deletion is a soft-delete: sets status to `Deleted`, only permitted from `Active`, blocked while any related Licensee is `Active` or `Enabled`. See BR-001, BR-007. |
| Client | No | Yes (unfiltered, direct) | No | No | Client's direct `GET` access to the Seller collection and by-ID endpoints returns the same unfiltered representation as Operations — no field-level suppression observed. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Active | The Seller is operational. Available as the Owner on new Authorizations and as the transacting party on new Listings and Orders. | Yes (default) | No |
| Disabled | The Seller is inactive. Observed on legacy entities — typically SoftwareOne legal entities that have been superseded following an acquisition or ERP consolidation. New Orders are blocked under any Listing referencing a Disabled Seller. | Yes (may be created directly into this status) | No |
| Offline | Reached only from `Active`, via the Deactivate action (e.g. for maintenance). Returns to `Active` via the Activate action. No downstream Buyer-synchronization effect is triggered by entering or leaving this state (unlike Disabled). | No | No |
| Deleted | Reached only from `Active`, via the Delete action. A soft-delete: the Seller record is not removed and remains retrievable via the API — including in standard list responses — with `status: "Deleted"`. No transition out of this state exists. A Deleted Seller cannot be referenced when forming a new Buyer:Seller relationship. | No | Yes |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1a | — | Active | Create | `POST /v1/accounts/sellers` | Operations | None | Initial status defaults to `Active` if omitted from the request. |
| T1b | — | Disabled | Create | `POST /v1/accounts/sellers` | Operations | None | Created directly into `Disabled` by supplying that value explicitly. |
| T2 | Active | Disabled | Disable Seller | `POST /v1/accounts/sellers/{id}/disable` | Operations | No related Licensee in `Active` or `Enabled` status (BR-007) | Triggers Buyer synchronization and ERP cache invalidation. |
| T3 | Active | Offline | Deactivate Seller | `POST /v1/accounts/sellers/{id}/deactivate` | Operations | No related Licensee in `Active` or `Enabled` status (BR-007) | Triggers ERP cache invalidation only — does not trigger Buyer synchronization. |
| T4a | Disabled | Active | Activate Seller | `POST /v1/accounts/sellers/{id}/activate` | Operations | No related Licensee in `Active` or `Enabled` status (BR-007) | Triggers Buyer synchronization (source status was `Disabled`) and ERP cache invalidation. |
| T4b | Offline | Active | Activate Seller | `POST /v1/accounts/sellers/{id}/activate` | Operations | No related Licensee in `Active` or `Enabled` status (BR-007) | Triggers ERP cache invalidation only — does not trigger Buyer synchronization (source status was `Offline`, not `Disabled`). |
| T5 | Active | Deleted | Delete Seller | `DELETE /v1/accounts/sellers/{id}` (returns 204) | Operations | No related Licensee in `Active` or `Enabled` status (BR-007) | Soft-delete — see BR-001. Triggers Buyer synchronization and ERP cache invalidation. Terminal; no further transitions exist out of `Deleted`. |

### 3.3 State Diagram

```
                    ---(Activate, from Disabled — triggers Buyer sync)--->
[—] --(Create)--> [Active] <---------------------------------------------- [Disabled]
       |     |        |     ---(Disable — triggers Buyer sync)--------------->
       |     |        |
       |     |        +---(Deactivate)---> [Offline] ---(Activate, no Buyer sync)---> [Active]
       |     |
       |     +--(Create directly into Disabled)--> [Disabled]
       |
       +---(Delete, from Active only — soft-delete, terminal)---> [Deleted]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | Deleting a Seller is a soft-delete: it is only permitted while the Seller is `Active`, and sets its status to `Deleted` rather than removing the record. | Active | Operations | The Seller remains retrievable via the API afterward, including in standard list responses, with `status: "Deleted"`. A Deleted Seller cannot be referenced when forming a new Buyer:Seller relationship. Existing [[Authorization]]s or [[Listing]]s referencing a Deleted Seller are not otherwise affected — no guard or cascade runs against them; see BR-007 and Section 6. |
| BR-002 | Each Seller has a 1:1 relationship with an instance of SoftwareOne's ERP system, tracked via `externalId`. `externalId` is functionally required and enforced unique across all Sellers of any status at creation. | All | Operations | `externalId` is marked nullable/optional in the API schema, but a Create request with a null or empty `externalId` is rejected. Uniqueness is checked against every Seller regardless of status (a `Deleted` Seller's `externalId` still blocks reuse) but only at creation — Update does not re-check uniqueness, so an Update can set a Seller's `externalId` to a value already used elsewhere. This is a confirmed platform gap, not an intentional asymmetry. `externalId` may be overridden by Operations via the API. Multiple Sellers may exist for the same country where acquisition history has produced multiple ERP instances. |
| BR-003 | A Seller's `currencies` collection defines the set of currencies it may transact in, plus per-currency billing and default flags; it must contain between 1 and 1000 entries, with exactly one entry flagged as default and at least one entry flagged as billing-enabled. | All | Operations | Each entry is `{ value, billingEnabled, isDefault }`; `value` is validated against the ISO 4217 code list. These constraints are enforced on both Create and Update. Updating `currencies` replaces the full set with whatever is submitted — any existing currency code not included in the update request is dropped; for a code that is included, only the sub-fields present in that entry change, unmentioned sub-fields keep their prior value. Removing a currency this way is not blocked or validated against existing [[Authorization]]/[[Listing]] usage — the platform only validates that a [[Listing]]'s [[Price List]] currency is one of the Seller's currencies at the moment that Listing is created, and never re-checks it afterward. |
| BR-004 | A Seller's `name` is a freeform string with a minimum length of 1 and a maximum length of 500 characters. The platform enforces no naming convention beyond these constraints. | All | Operations | In practice, Operations uses country names for active Sellers and appends `(old)` or a legacy identifier to names of superseded entities. Convention only. |
| BR-005 | The `buyers` collection is never returned on the Seller resource — it appears in `$meta.omitted` unconditionally, even when `select=+buyers` is requested. | All | All | [[Buyer]] data associated with a Seller must be queried via the Buyer resource's own endpoint: `v1/accounts/buyers?any(sellers,eq(id,{{sellerId}}))`. |
| BR-006 | Vendor cannot query Sellers directly under any circumstance — the collection and by-ID endpoints both return no results for Vendor. Client can query Sellers directly with the same unfiltered access as Operations. | All | Vendor, Client | Vendor sees Seller identity only as a reference on [[Authorization]]s and [[Listing]]s. Client's direct read access carries no observed field-level suppression relative to Operations. |
| BR-007 | None of Activate, Disable, Deactivate, or Delete may be performed on a Seller that has any related Licensee (Accounts: Licensee — not yet canonised) currently in `Active` or `Enabled` status. | Active, Disabled, Offline | Operations | Applies uniformly to all four status-change actions. This related-Licensee check is the only guard on these actions — an existing [[Authorization]] or [[Listing]] referencing the Seller imposes no additional guard. Whether this guard is enforced identically in PROD is not confirmed — see preamble Section 7.3. |
| BR-008 | A Seller's `icon` follows the platform's jdenticon behaviour (preamble Section 9): it defaults to a server-generated jdenticon, and a custom icon may be uploaded or removed via the parent object's own `PUT` endpoint using `multipart/form-data`. | All | Operations | A custom icon is set via the `logo` binary field on the multipart request. Submitting that same multipart request *without* a `logo` file part removes any existing custom icon and reverts to the jdenticon — this happens regardless of whether removal was the caller's intent, since the platform derives "remove icon" from the simple absence of a logo file on that request. The plain JSON `PUT` path never affects the icon. See Section 9. |
| BR-009 | A Seller's `attributes.navision` holds a freeform JSON object of Navision (ERP) metadata. Updates are applied as a merge (existing keys not mentioned are preserved; a key set to `null` in the update is removed; a top-level `null` clears the object). | All | Operations | Only the `companyCode` sub-key is confirmed queryable/filterable; other sub-keys may be stored but are not confirmed filterable. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| id | String | Platform-assigned unique identifier. Format: `SEL-NNNN-NNNN`. | System | No | Immutable. Assigned at creation. |
| name | String | Human-readable label for the Seller. Freeform — no naming convention enforced by the platform. | Operations | Yes | Required on creation. `minLength: 1`, `maxLength: 500`. See BR-004. |
| externalId | String | The ERP-side identifier for this Seller. Represents the 1:1 relationship between a Seller and an ERP instance. | ERP Sync | Yes | Marked nullable in the API schema, but functionally required — a null/empty value is rejected on creation. Enforced unique across all Sellers (any status) at creation only. See BR-002. |
| status | Enum | Operational status of the Seller. One of: `Active`, `Disabled`, `Offline`, `Deleted`. | Operations (via action endpoints) | Yes | Managed via dedicated action endpoints (`/activate`, `/disable`, `/deactivate`) plus `DELETE` for the transition into `Deleted`. See Section 3. |
| currencies | Array of Object | The set of currencies this Seller may transact in. Each entry: `value` (ISO 4217 code), `billingEnabled` (Boolean), `isDefault` (Boolean). | Operations | Yes | 1–1000 entries; exactly one `isDefault: true`; at least one `billingEnabled: true`. Update replaces the full set — see BR-003. |
| address.addressLine1 | String | First line of the Seller's registered address. | Operations | Yes | Marked nullable in the API schema, but functionally required — a null/empty value is rejected whenever the address is set. |
| address.addressLine2 | String | Second line of the Seller's registered address. | Operations | Yes | Optional — no non-empty requirement observed. Absent from response when null. |
| address.postCode | String | Postal code of the Seller's registered address. | Operations | Yes | Marked nullable in the API schema, but functionally required — a null/empty value is rejected whenever the address is set. Freeform string — no format validation observed. `"N/A"` used where not applicable. |
| address.city | String | City of the Seller's registered address. | Operations | Yes | Marked nullable in the API schema, but functionally required — a null/empty value is rejected whenever the address is set. |
| address.state | String | State or region of the Seller's registered address. | Operations | Yes | Marked nullable in the API schema, but functionally required — a null/empty value is rejected whenever the address is set. `"N/A"` used where not applicable. |
| address.country | String | ISO 3166-1 alpha-2 country code of the Seller's registered address. | Operations | Yes | Marked nullable in the API schema, but functionally required — a null/empty value is rejected whenever the address is set. Not unique across Sellers — multiple Sellers may share the same country. |
| attributes.navision | Object | Freeform Navision (ERP) metadata attached to the Seller. | Operations | Yes | Merge-patch update semantics — see BR-009. Only the nested `companyCode` key is confirmed queryable. |
| erpLink | Object (ErpLinkRef) | Present in the schema as a single reference, but not populated on the standalone Seller resource in practice (absent from live responses, and not listed in `$meta.omitted`). | System | N/A | A Seller may in fact have many ErpLinks — one per linked Buyer, since an ErpLink pairs exactly one Buyer with one Seller (Accounts: ErpLink). The singular `erpLink` field does not represent this collection. |
| icon | String | URL path to the Seller's icon. Follows the jdenticon behaviour — defaults to a server-generated jdenticon; a custom icon may be uploaded to replace it. | Operations | Yes | Returns jdenticon URL by default. Nullable in the spec. Uploaded via the `logo` binary field on the multipart `PUT` endpoint; removed automatically by any multipart `PUT` that omits a `logo` file. See BR-008. One entry in production data has no `icon` field — see SEL-004. |
| buyers | Collection | The collection of Buyers associated with this Seller via ErpLinks. | System | N/A | Omitted from API responses unconditionally — appears in `$meta.omitted` even when `select=+buyers` is requested. Query Buyers via the Buyer resource's own endpoint instead — see BR-005. |
| audit | Object | Standard platform audit block. Records `created` and `updated` timestamps and Actor references. | System | N/A | Returned by default on this object's responses in current observation (no `select=+audit` was needed to see it in this run's live sample) — this differs from the platform-wide default of omitting `audit` unless requested (preamble Section 6.2); treat as object-specific pending further confirmation. |
| revision | Integer | Increments on each update. | System | N/A | Read-only. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Authorization | Parent of | One:Many | A Seller acts as the Owner of Authorizations. An Authorization cannot exist without an Owner Seller. | Yes — Authorization cannot exist without an Owner Seller. Existing Authorizations impose no additional guard on Seller status changes beyond the related-Licensee guard (BR-007). |
| Catalog: Listing | Association | One:Many | A Seller acts as the transacting party on Listings. A Listing references a Seller as its transacting entity. | No direct lifecycle dependency — a Listing's direct parent is its Authorization. A new Listing cannot be created at all against a Disabled or Deleted Seller. Once a Listing already exists, when its Seller is Disabled, new Orders cannot be placed under it — but the Listing itself is not otherwise affected by later Seller status changes, including Delete. |
| Accounts: ErpLink | Association | One:Many | An ErpLink pairs exactly one Buyer with one Seller, so a Seller may have many ErpLinks (one per linked Buyer). The single `erpLink` reference field in the Seller schema is not populated on the standalone Seller resource. | Whenever a related ErpLink is next synchronized, its own status is set to match whether the Seller is Disabled (forced Disabled if the Seller is Disabled; re-enabled otherwise). Blocking an ErpLink is prevented while its related Seller is Disabled or Deleted. |
| Accounts: Buyer | Association | Many:Many | Buyers are associated with Sellers through ErpLinks, not directly. A Buyer may be linked to more than one Seller where the MDM team has replicated a Buyer across multiple ERP instances. A Seller may be linked to many Buyers. | No direct lifecycle dependency between Seller and Buyer — the dependency is mediated by ErpLink. A Deleted Seller cannot be used to form a new Buyer:Seller association. Seller status changes that affect Buyer synchronization are described in Section 7. |
| Accounts: Licensee | Association | One:Many | A Licensee (not yet canonised) is related to exactly one Seller. | Any Licensee related to this Seller currently in `Active` or `Enabled` status blocks Activate, Disable, Deactivate, and Delete on this Seller (BR-007). |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Seller created | Operations creates a Seller | Operations | Seller becomes available as the Owner on new [[Authorization]]s and as the transacting party on new [[Listing]]s. Initial status is `Active` (default) or `Disabled` (if specified) — no other initial status is permitted. |
| Seller disabled | Operations calls the Disable action | Operations | Blocked if a related Licensee is `Active` or `Enabled` (BR-007). Seller is no longer available as the transacting party for new Orders under any referencing [[Listing]]. Existing [[Agreement]]s and [[Subscription]]s are unaffected. Triggers Buyer synchronization and ERP cache invalidation. |
| Seller activated | Operations calls the Activate action | Operations | Blocked if a related Licensee is `Active` or `Enabled` (BR-007). Seller returns to `Active`. Triggers Buyer synchronization only if the prior status was `Disabled` (not `Offline`). Triggers ERP cache invalidation in all cases. |
| Seller deactivated | Operations calls the Deactivate action | Operations | Blocked if a related Licensee is `Active` or `Enabled` (BR-007). Status becomes `Offline`. Does not trigger Buyer synchronization. Triggers ERP cache invalidation. |
| Seller deleted (soft) | Operations calls the Delete action | Operations | Blocked if a related Licensee is `Active` or `Enabled` (BR-007), and only permitted from `Active`. Status becomes `Deleted`; the record remains retrievable via the API (BR-001). Triggers Buyer synchronization and ERP cache invalidation. |
| externalId updated | ERP Sync process updates externalId, or Operations overrides via the API | ERP Sync, Operations | ERP-side correlation identifier updated. No downstream platform state changes triggered. Uniqueness is not re-checked on this path — see SEL-012. |
| currencies updated | Operations updates the currencies collection | Operations | Updated currency set is immediately reflected on the Seller, replacing the prior full set (BR-003). Effect on existing [[Authorization]]s and [[Listing]]s denominated in a removed currency is not confirmed. See SEL-005. |
| icon uploaded | Operations uploads a custom icon via the `logo` field on the multipart `PUT` | Operations | Custom icon replaces the jdenticon. Returned as the value of the `icon` field in subsequent API responses. |
| icon removed | Operations submits the multipart `PUT` without a `logo` file part | Operations | Any existing custom icon is removed and the Seller reverts to the jdenticon default — regardless of whether the caller intended to touch the icon on that request. See BR-008, Section 9. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Seller disabled | Catalog: Listing | New Orders cannot be placed under any [[Listing]] referencing this Seller. | Yes | Seller status = Disabled | Confirmed in [[Listing]] canon BR-012. Existing [[Agreement]]s and [[Subscription]]s continue normally. |
| Seller status changes | Accounts: ErpLink | On the [[ErpLink]]'s next synchronization, its status is forced to Disabled if the Seller is Disabled, or re-enabled if the Seller is not Disabled. | Yes | Evaluated at each ErpLink synchronization under a background synchronization context — not fired the instant the Seller's own status changes. | See Accounts: [[ErpLink]] canon for the full ErpLink lifecycle. |
| Seller Disabled or Deleted | Accounts: ErpLink | Explicitly blocking the ErpLink is prevented. | Yes | Seller status = Disabled or Deleted | — |
| Seller Deleted | Accounts: Buyer | Forming a new Buyer:Seller association referencing this Seller is blocked. | Yes | Seller status = Deleted | Existing associations are unaffected — no cascade updates them when the Seller is Deleted. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
The `Active` ↔ `Disabled` cycle is reversible via the Disable and Activate actions. The `Active` ↔ `Offline` cycle (via Deactivate and Activate) is likewise reversible. No limit on cycles has been confirmed for either. `Active → Deleted` is not reversible — no transition out of `Deleted` exists.

**Deletion:**
Seller deletion is soft-delete only. A Seller may be deleted by Operations when it is `Active` and has no related Licensee currently `Active` or `Enabled` (BR-001, BR-007). Deleted Sellers are not removed from the platform and remain fully retrievable via the API, including in standard list responses, with `status: "Deleted"`. A Deleted Seller cannot be referenced when forming a new Buyer:Seller relationship (Section 7.2).

**Audit & history requirements:**
The audit block captures `created` and `updated` timestamps and Actor references, consistent with the standard platform audit schema. In this run's live sample, `audit` was present without requesting `select=+audit` — differing from the platform-wide default of omitting `audit` by default (preamble Section 6.2); flagged for further confirmation rather than treated as settled. Three distinct automated Actors have been observed writing to Sellers in production: a migration token (used during initial platform population), an ERP Sync token, and an account management monitoring token.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Seller disabled | No new Orders can be placed under any [[Listing]] referencing this Seller, and no new [[Listing]] can be created against it. Existing [[Agreement]]s and [[Subscription]]s continue normally. | Client, Operations | High | Downstream impact on ErpLinks is confirmed in Section 7.2. No other dependent object type is affected beyond [[Listing]] and ErpLink. |
| Multipart Update omits the logo file | Any existing custom icon is silently removed and the Seller reverts to the jdenticon default, even if the caller only intended to update unrelated fields via that endpoint. | Operations | Medium | See BR-008. Operations should use the plain JSON `PUT` path when not intending to change the icon. |
| Currency removed from Seller currencies collection | Update replaces the full currency set; a currency omitted from the update payload is dropped. Any existing [[Authorization]] or [[Listing]] already relying on the removed currency is unaffected and not re-validated — the platform only checks currency compatibility at [[Listing]] creation time. | Operations, Vendor, Client | High | Operations should exercise caution when modifying `currencies` on an active Seller, since existing [[Listing]]s are not protected from becoming inconsistent with the Seller's current currency set. See BR-003. |
| externalId set to a value already used by another Seller, via Update | Not rejected — the uniqueness check only runs at creation. A confirmed platform gap. | Operations | Medium | See BR-002. |
| Multiple Sellers exist for the same country | Platform permits this — address.country is not unique across Sellers. Multiple active Sellers for the same country is a valid configuration resulting from acquisition history. | Operations | Low | Operations is responsible for managing the Seller inventory and ensuring [[Listing]]s reference the correct Seller for each transaction context. |
| Seller deleted (soft) | Status becomes Deleted; the record remains retrievable via the API. Existing [[Authorization]]s and [[Listing]]s referencing the Seller are unaffected — no cascade or additional guard runs against them. Only new [[Listing]] creation and new Orders under existing [[Listing]]s are blocked going forward. | Operations, Client, Vendor | High | See BR-001, BR-007, and Section 6. |
| Missing icon field | One Seller in production (`BG_CPX`, `SEL-9696-0728`, Disabled) has no `icon` field in its API response, where all other Sellers return a jdenticon URL. This Seller was disabled when a new ERP instance (Navision) was created following Bulgaria's switch to EUR — the missing icon is a legacy artifact of that transition and not considered platform behavior worth tracking further. | Operations | Low | — |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-03-15 | Stu | Initial canon. |
| 0.2 | 2026-03-15 | Stu | Administration namespace renamed to Accounts throughout — Sections 1, 4, 6, and 7 updated. |
| 0.3 | 2026-03-15 | Stu | OpenAPI spec review. Section 3: state machine revised — status transitions confirmed as API endpoints (/activate, /disable, /deactivate); Offline and Deleted states added. Section 2: Delete column updated — DELETE endpoint exists in spec. BR-001 rewritten — deletion endpoint confirmed, guard unknown (SEL-010). BR-003 updated — minItems: 1 confirmed. BR-004 updated — name length constraints added. Section 5: name length constraints added; address fields corrected to nullable; erpLink field added; revision added; icon upload mechanism clarified (logo field on PUT). Section 6: ErpLink relationship updated to reflect single erpLink reference on Seller object. Section 7: transition events updated to reference API endpoints. Section 8: reversibility and deletion updated. Section 9: Seller deleted failure mode added. SEL-001 closed (transitions confirmed as API endpoints). SEL-006 closed (minItems: 1 confirmed). SEL-007, SEL-008, SEL-009, SEL-010 added. |
| 0.4 | 2026-07-15 | Stu / canon-generate | Refreshed from OpenAPI spec, live STAGING fetch (Operations and Client Actors; Vendor query genuinely returns no results, confirmed at the platform's query layer), and source-code research. Section 3: Deactivate confirmed to produce `Offline` (distinct from Disable's `Disabled`); Delete confirmed as a soft-delete only permitted from `Active`, terminal, with the record remaining retrievable via the API — resolves SEL-008 and SEL-009, both removed. Section 4: BR-001 rewritten for the confirmed soft-delete mechanism; BR-002 corrected — externalId uniqueness is enforced (at creation only) and the field is functionally required despite its nullable schema type; BR-003 rewritten — currencies is an array of `{value, billingEnabled, isDefault}` objects (not plain strings), with cardinality (1–1000), exactly-one-default, and at-least-one-billing-enabled constraints, and full-replace update semantics, all newly confirmed — resolves SEL-006's follow-on ambiguity and SEL-010's guard question; BR-006 corrected — Client can query Sellers directly with unfiltered access (previously stated Client could not); BR-007 added — a related-Licensee guard blocks all four status-change actions; BR-008 added — icon upload/removal mechanism, including a previously undocumented implicit-removal risk; BR-009 added — attributes.navision merge-patch semantics. Section 5: address subfields corrected — functionally required despite nullable schema type; attributes.navision and invoiceFormats added; erpLink and buyers notes updated with confirmed access mechanism. Section 6: Licensee relationship added; ErpLink cardinality corrected to One:Many. Section 7: Seller deleted and icon removed events added; ErpLink sync and blocking effects added. Section 8: deletion language corrected from "permanently removed" to soft-delete, matching confirmed behavior. Section 9: icon-removal and externalId-duplicate failure modes added. SEL-010 removed (superseded by BR-001/BR-007 plus narrower SEL-013). SEL-007 removed (erpLink cardinality and non-population on the standalone resource now confirmed). SEL-002 narrowed. SEL-005 narrowed to the downstream-effect question only. SEL-011, SEL-012, SEL-013 added. ENV-005 added (environment-parity question for the Licensee guard). |
| 0.5 | 2026-07-15 | Stu / canon-generate | All remaining open questions resolved via canon-generate-batch's consolidated human round plus follow-up source-code tracing and one live re-check. SEL-002 resolved — Buyer-by-Seller query mechanism confirmed (BR-005). SEL-004 resolved — BG_CPX's Disabled status traced to a new Navision ERP instance created after Bulgaria's switch to EUR; the missing icon field is a legacy artifact, not pursued further. SEL-005 resolved by source — removing a currency from a Seller is never re-validated against existing Authorizations/Listings; currency compatibility is checked only at Listing creation (BR-003, Section 9). SEL-011 descoped — `invoiceFormats` is an unreleased feature and is intentionally not documented; its absence does not block this canon's completeness. SEL-012 resolved — confirmed as a genuine platform gap, not intentional design (BR-002). SEL-013 resolved by source — the related-Licensee guard (BR-007) is the only guard on all four status-change actions; no additional guard or cascade runs against existing Authorizations/Listings when a Seller's status changes (BR-001, BR-007, Section 6, Section 7.2, Section 9). New confirmed finding surfaced while tracing SEL-005/SEL-013: a new Listing cannot be created at all against a Disabled or Deleted Seller (Section 6). ENV-005 (Licensee-guard PROD parity) remains open — tracked centrally in the preamble (Section 7.3), not in this file, per the existing ENV-NNN convention. Section 10 now empty. |
| 0.6 | 2026-07-15 | Stu / canon-generate | ErpLink and Buyer now canonised — updated the stale "not yet canonised" notes to proper `[[ErpLink]]`/`[[Buyer]]` cross-references (BR-005, Section 5 erpLink, Section 7.2), and softened the Section 7.2 actor attribution for the Seller-driven ErpLink status sync (a background synchronization context, not a specific "ERP Sync" Actor). Surfaced while canonising Accounts: Buyer and Accounts: ErpLink. |
