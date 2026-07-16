# Object Canon: Account

> **Version:** 0.6
> **Owner:** Stu
> **Last Updated:** 2026-07-15
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Account

**Namespace:** Accounts

**Parent Object:** None — top-level Accounts object.

**ID Prefix:** ACC

**Description:**
An Account is the platform identity record for an Actor — either a Vendor (a software manufacturer transacting through the SoftwareOne Marketplace), an Operations entity (SoftwareOne itself, acting as platform steward), or a Client (a customer organisation purchasing through the SoftwareOne Marketplace). Every Account has a `type` field that determines which Actor permission profile applies to its Users and API Tokens. In PROD, there is exactly one Operations Account, one Account per Vendor entity, and one Account per Client organisation. Client Accounts have a 1:1 relationship with a CDG (Customer Discount Group) in SoftwareOne's ERP.

**Also Known As:**
None known.

---

---

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | No | Yes* | Yes** | No | *A Vendor can read its own Account and any Client Account with a Commerce: [[Agreement]] where this Vendor is the Agreement's Vendor. Non-visible Accounts return 404 — their existence is masked entirely. No field-level suppression exists once an Account is visible. **A Vendor can update its own Account only. |
| Operations | Yes | Yes* | Yes | No | *Platform-wide read access requires the Account Management module permission. Without it, an Operations user is scoped to their own Account only — the same restriction as Client. No DELETE endpoint exists in the spec. |
| Client | No | Yes* | Yes** | No | *A Client can read its own Account only. All other Accounts return 404 — their existence is masked entirely. **A Client can update its own Account only. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Active | Applies to Vendor and Client Accounts. On Client Accounts, `Active` means the `externalId` (CDG) is present and has been validated against SoftwareOne's ERP — the Account can transact and be billed. On Vendor Accounts, `Active` is the default creation state; no ERP validation is required or performed. | — | — |
| Enabled | Applies to Client and Operations Accounts. On Client Accounts, `Enabled` means the Account is not Disabled but the CDG has not been ERP-validated — the Account cannot transact or be billed. On the Operations Account, `Enabled` is the default creation state; ERP validation is not applicable. | — | — |
| Disabled | Applies to Vendor and Client Accounts. The Account is inactive. The Operations Account cannot be set to `Disabled`. While Disabled, the Account cannot place new Orders or participate in Programs. Existing Users and API Tokens are unaffected — see BR-015. | — | — |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1a | — | Active | Create | `POST /v1/accounts/accounts` | Operations | None | Vendor Accounts are created directly into `Active` status. No ERP validation required. |
| T1b | — | Enabled | Create | `POST /v1/accounts/accounts` | Operations | None | Client and Operations Accounts are created directly into `Enabled` status. |
| T2 | Enabled | Active | Activate Account | `POST /v1/accounts/accounts/{id}/activate` | Operations | CDG present in `externalId` and validated against ERP | Client Accounts only — the platform rejects this action outright on Vendor or Operations Accounts. |
| T3a | Active | Disabled | Disable Account | `POST /v1/accounts/accounts/{id}/disable` | Operations | Not confirmed | Applies to Vendor and Client Accounts only. |
| T3b | Enabled | Disabled | Disable Account | `POST /v1/accounts/accounts/{id}/disable` | Operations | Not confirmed | Applies to Vendor and Client Accounts only. |
| T4a | Disabled | Active | Enable Account | `POST /v1/accounts/accounts/{id}/enable` | Operations | Not confirmed | Reversal of T3a. |
| T4b | Disabled | Enabled | Enable Account | `POST /v1/accounts/accounts/{id}/enable` | Operations | Not confirmed | Reversal of T3b. |
| T5 | Active | Enabled | Deactivate Account | `POST /v1/accounts/accounts/{id}/deactivate` | Operations | None confirmed | Client Accounts only — the platform rejects this action outright on Vendor or Operations Accounts. Previously undocumented. |

All four action endpoints (Activate, Disable, Enable, Deactivate) are gated to the Operations Actor, further restricted to holders of the Account Management module permission — full platform-wide (any Account) for a scoped subset of Operations users, self-Account-only otherwise. Whether these are called by an automated process, a human Operations user, or both is not confirmed.

### 3.3 State Diagram

```
— ---(Create : Operations)---> [Active]   (Vendor Accounts — no ERP validation required)
— ---(Create : Operations)---> [Enabled]  (Client and Operations Accounts)

[Enabled] ---(Activate : Operations)---> [Active]     (Client Accounts only — CDG ERP-validated)
[Active]  ---(Deactivate : Operations)---> [Enabled]  (Client Accounts only)
[Active]  ---(Disable : Operations)---> [Disabled]    (Vendor and Client Accounts only)
[Enabled] ---(Disable : Operations)---> [Disabled]    (Vendor and Client Accounts only)
[Disabled] ---(Enable : Operations)---> [Active / Enabled]  (reversal)
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An Account's `type` is immutable after creation. The `type` field determines the Actor permission profile for all Users and API Tokens associated with the Account and cannot be changed once set. | All | All | Required on creation. One of: `Vendor`, `Operations`, `Client`. |
| BR-002 | The platform technically prevents creating a second Operations Account — any Create request with `type: Operations` is rejected outright. | All | Operations | The single PROD Operations Account was established outside this validated path (initial platform bootstrap). |
| BR-003 | The platform does not enforce a 1:1 constraint between a Vendor or Client entity and its Account — multiple Accounts may share the same external/ERP entity as a deliberate, supported "multi-account" configuration, gated by module and cloud-tenant eligibility rather than blocked. | All | Operations | The observed PROD 1:1 for Vendor and Client entities is operational discipline, not a platform-enforced limit. |
| BR-004 | A Client Account has a 1:1 relationship with a CDG (Customer Discount Group) in SoftwareOne's ERP. The CDG is the global identifier for a customer organisation. The CDG is represented on the Client Account via the `externalId` field. The relationship is 1:1 but a Client Account may have a null CDG — `externalId` is nullable. | All | Operations | The platform does not enforce CDG uniqueness across Client Accounts — this is an operational discipline. |
| BR-005 | An Account cannot be deleted. No DELETE endpoint exists in the API spec. | All | All | — |
| BR-006 | Every Account has exactly one Default User Group, assigned automatically at Account creation. The Default User Group can never be deleted, and which group is Default can never be changed for the life of the Account. | All | Operations | Unlike the Default-protection pattern on other objects (e.g. Catalog: Parameter Group, Catalog: Template), there is no mechanism to promote a different group to Default — the assignment is permanent, not merely guarded against deletion. |
| BR-007 | The `eligibility` field is applicable to Client Accounts only. It controls whether the Client may transact as a standard Client (`eligibility.client`) and/or as a Partner (`eligibility.partner`). Setting `eligibility` on a Vendor or Operations Account is rejected — it is not merely suppressed from the response. | All | Operations | Consistent with the `eligibility` model on [[Authorization]] and [[Listing]] — each object maintains its own independent value; none is derived from another. |
| BR-008 | The `externalIds.pyraTenantId` field is a UUID that maps the Account to SoftwareOne's internal identity platform (Pyra). It is system-managed — no Actor can set or change it directly via the API — and is not required to be unique: multiple Accounts intentionally sharing one `pyraTenantId` is the basis of the multi-account configuration (BR-003). | All | Operations | Set automatically at creation from the platform's ERP integration, and re-synced automatically when a multi-account Client Account is deactivated. |
| BR-009 | The `externalId` field is Operations-managed on all Account types. On Vendor Accounts, it maps to the manufacturer code in SoftwareOne's ERP. On Client Accounts, it maps to the CDG (Customer Discount Group) — the global ERP identifier for a customer organisation. On the Operations Account, `externalId` is present in the spec but has no defined operational purpose. `externalId` is always set and maintained exclusively by Operations — no other Actor can write this field. | All | Operations | `maxLength: 250`. Nullable — absent from response when null, consistent with null suppression. |
| BR-010 | The `name` field has a minimum length of 1 and a maximum length of 500 characters. It is required on creation and on update. | All | Operations, Vendor, Client | The Account owner may update their own Account's name. |
| BR-011 | `technicalSupportEmail` has a maximum length of 320 characters and must be a valid email format. It is optional and available on all Account types — its absence on some Accounts reflects that the field was never set, not a type restriction. | All | Operations, Vendor, Client | — |
| BR-012 | `website` and `description` each have a maximum length of 2,000 characters. Both are optional and available on all Account types — their absence on some Accounts reflects that the fields were never set, not a type restriction. | All | Operations, Vendor, Client | — |
| BR-013 | `groups` and `audit` are omitted from Account API responses by default. Both must be explicitly requested via `select=+groups` and `select=+audit` respectively. | All | All | Standard platform default-omission pattern. See Preamble Section 6.2. |
| BR-014 | The `address` field is an object on all Account types. An empty address object (`{}`) is a valid representation — all address sub-fields are nullable. | All | Operations, Vendor, Client | Observed on the Client Account (Meeks Corp) which has `"address": {}`. |
| BR-015 | Disabling an Account is a status-field write only. It does not lock associated Users out of logging in and does not invalidate associated API Tokens — no such cascade exists. It does block the Account from placing new Orders and from participating in Programs while Disabled. | All | Operations | Existing Users, API Tokens, and already-placed Orders are unaffected by a Disable action. |
| BR-016 | An Account's `externalName` is not independently owned data — it is automatically populated (and overwritten on every `externalId` change) from SoftwareOne's ERP integration, reflecting the ERP's own display name for the entity identified by `externalId`. Any value submitted directly in a Create or Update request is ignored in favour of the ERP-derived value. | All | Operations | Stored with data-masking, consistent with `name`. Also surfaced through the Accounts: User "extended account" view. |
| BR-017 | A Client Account's [[Buyer]]s are held via a direct reference on each Buyer (not mediated by [[ErpLink]]). This differs from the Accounts: [[Seller]] relationship to Buyers, which is mediated by ErpLink. | All | All | — |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| id | String | Platform-assigned unique identifier. Format: `ACC-NNNN-NNNN`. | System | No | Immutable. Assigned at creation. |
| name | String | Human-readable name of the Account. | Operations, Vendor, Client | Yes | Required on creation and update. `minLength: 1`, `maxLength: 500`. |
| type | Enum | Actor type for this Account. One of: `Vendor`, `Operations`, `Client`. | Operations | No | Required on creation. Immutable after creation. Determines the Actor permission profile for all associated Users and API Tokens. Creation with `type: Operations` is rejected — see BR-002. |
| status | Enum | Operational status. One of: `Active`, `Enabled`, `Disabled`. | Operations, via the dedicated Activate/Deactivate/Disable/Enable action endpoints | Yes | `Active`: on Client Accounts, CDG is ERP-validated — can transact and be billed; on Vendor Accounts, default creation state with no ERP gate. `Enabled`: on Client Accounts, not Disabled but CDG not ERP-validated — cannot transact or be billed; on Operations Account, default creation state. `Disabled`: Vendor and Client Accounts only. See Section 3. |
| externalIds.pyraTenantId | String (UUID) | Maps the Account to SoftwareOne's internal identity platform (Pyra). | System | Yes — system-managed only | Not user-settable via the API. Not unique — see BR-008. |
| externalId | String | Operations-managed ERP reference. Meaning varies by Account type: on Vendor Accounts, maps to the ERP manufacturer code; on Client Accounts, maps to the CDG (Customer Discount Group) — the global ERP identifier for a customer organisation; on the Operations Account, has no defined operational purpose. Always set and maintained exclusively by Operations regardless of Account type. | Operations | Yes | `maxLength: 250`. Nullable. Absent from response when null. |
| externalName | String | The ERP's own display name for the entity identified by `externalId`. | System (ERP-derived) | No — always overwritten from the ERP on every `externalId` change | See BR-016. Nullable. Absent from response when null. |
| address | Object | Registered address of the Account. All sub-fields are nullable. An empty address object (`{}`) is valid. | Operations, Vendor, Client | Yes | Sub-fields: `addressLine1`, `addressLine2`, `postCode`, `city`, `state`, `country` — all nullable strings. |
| technicalSupportEmail | String | Technical support email address for the Account. | Operations, Vendor, Client | Yes | Optional. `maxLength: 320`. Must be valid email format. Available on all Account types — see BR-011. |
| website | String | Website URL for the Account. | Operations, Vendor, Client | Yes | Optional. `maxLength: 2000`. Available on all Account types — see BR-012. |
| description | String | Description of the Account. | Operations, Vendor, Client | Yes | Optional. `maxLength: 2000`. Available on all Account types — see BR-012. |
| defaultLanguageCode | String | BCP 47 language tag representing the Account's preferred language. | Operations, Vendor, Client | Yes | Optional. Observed as `"en-US"` on all three Account types in data sample. |
| eligibility | Object | Controls Client transacting eligibility. Sub-fields: `eligibility.client` (Boolean), `eligibility.partner` (Boolean). | Operations | Yes | Present on Client Accounts only — rejected on other types, see BR-007. Absent from response when null. |
| groups | Collection | User Groups associated with this Account. | System / Operations | N/A | Omitted from API responses by default. Request via `select=+groups`. Every Account has exactly one Default User Group, permanently assigned — see BR-006. |
| icon | String | URL path to the Account's icon. Defaults to a server-generated jdenticon; a custom icon may be uploaded to replace it. | Operations, Vendor, Client | Yes | Nullable. Uploaded via `logo` binary field on PUT (`multipart/form-data`). See Preamble Section 9. |
| revision | Integer | Increments on each update. | System | N/A | Read-only. |
| audit | Object | Standard platform audit block. Records `created` and `updated` timestamps and Actor references. | System | N/A | Omitted from API responses by default. Request via `select=+audit`. The Operations Account's `audit.created.by` is absent — believed to be a system-bootstrapped account predating Actor attribution. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Accounts: User Group | Parent of | One:Many | Every Account owns one or more User Groups, including exactly one permanent Default User Group. User Groups cannot exist without a parent Account. | Yes — User Groups cannot exist without a parent Account. Account deletion is not possible. The Default User Group can never be deleted or reassigned — see BR-006. |
| Accounts: User | Association | Many:Many | Users are associated with Accounts. A User may belong to multiple Accounts. A single Account may have many Users. | No direct lifecycle dependency — User membership is managed independently. |
| Accounts: API Token | Parent of | One:Many | API Tokens are scoped to an Account. A Token inherits the Actor permission profile of its parent Account. | Yes — API Tokens cannot exist without a parent Account. Account deletion is not possible. Disabling the parent Account does not invalidate existing Tokens — see BR-015. |
| Accounts: Buyer | Association | One:Many | Client Accounts hold a direct reference to their Buyers (not mediated by ErpLink) — see BR-017. | Not confirmed. |
| Catalog: Authorization | Association | One:Many | Vendor Accounts are referenced as the Vendor on Authorizations. | No direct lifecycle dependency — Authorization references the Vendor Account but the Vendor Account has no deletion guard from Authorizations. |
| Catalog: Listing | Association | One:Many | Vendor Accounts are referenced as the Vendor on Listings. | No direct lifecycle dependency. |
| Commerce: Agreement | Association | One:Many | A Vendor Account's read access to Client Accounts is scoped by shared Agreements — see Section 2. | No direct lifecycle dependency. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Account created | Operations creates an Account | Operations | Account becomes available for User and API Token association. The platform automatically creates a permanent Default "Administrators" User Group and assigns it to the Account. |
| Account activated | Operations calls the Activate action on a Client Account | Operations | Client Account becomes able to transact and be billed. Rejected outright on Vendor or Operations Accounts. |
| Account deactivated | Operations calls the Deactivate action on a Client Account | Operations | Client Account returns to `Enabled` — can no longer transact or be billed until reactivated. Rejected outright on Vendor or Operations Accounts. |
| Account disabled | Operations calls the Disable action on a Vendor or Client Account | Operations | Account can no longer place new Orders or participate in Programs. Existing Users, API Tokens, and already-placed Orders are unaffected — see BR-015. |
| Account re-enabled | Operations calls the Enable action, reversing a prior Disable | Operations | Account returns to operational status, restoring the ability to place new Orders and participate in Programs. |
| icon uploaded | Operations or Account owner uploads a custom icon via `logo` field on PUT | Operations, Vendor, Client | Custom icon replaces the jdenticon. Returned as the value of the `icon` field in subsequent API responses. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Account created | Accounts: User Group | A permanent Default "Administrators" User Group is created and linked to the Account | Yes | Always on Account creation | Cannot be deleted or reassigned — see BR-006. |
| Account disabled | Commerce: Order | New Order placement is blocked for this Account | Yes | Account status = Disabled | Already-placed Orders are unaffected. |
| Account disabled | Program | Program eligibility is blocked for this Account | Yes | Account status = Disabled | Programs are not yet canonised. |

No effect on Accounts: User or Accounts: API Token flows from an Account status change — see BR-015.

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
The `Active` / `Enabled` ↔ `Disabled` cycle is reversible via the dedicated Disable/Enable action endpoints. The `Active` ↔ `Enabled` cycle for Client Accounts is likewise reversible via the dedicated Activate/Deactivate action endpoints. No limit on cycles has been confirmed for either.

**Deletion:**
Accounts cannot be deleted. No DELETE endpoint exists in the API spec. See BR-005.

**Audit & history requirements:**
The audit block captures `created` and `updated` timestamps and Actor references, consistent with the standard platform audit schema. Audit is omitted from API responses by default — request via `select=+audit`. The Operations Account (`ACC-1032-0145`) has no `audit.created.by` — believed to be a system-bootstrapped account whose creation predates the platform's Actor attribution model.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Account disabled | New Order placement and Program participation are blocked. Existing Users, API Tokens, and already-placed Orders are unaffected — no cascade exists. | Operations, Vendor, Client | Medium | See BR-015. |
| Client Account created without ERP CDG linkage | The platform permits this — the 1:1 CDG constraint is an operational discipline, not a platform-enforced rule. A Client Account without a valid ERP CDG may cause billing and procurement failures. | Operations, Client | High | Operations is responsible for ensuring Client Accounts are properly linked to ERP records. |
| `eligibility` absent on Client Account | If both `eligibility.client` and `eligibility.partner` are false or absent, the Client may be unable to place Orders under any Listing. | Client | High | Operations is responsible for ensuring Client Account eligibility is correctly configured. |
| Multiple Accounts share the same `pyraTenantId` or ERP entity | Expected and supported — the basis of the platform's multi-account configuration, not a conflict. | Operations | Low | See BR-003, BR-008. |
| Second Account created with `type: Operations` | Rejected outright by the platform. | Operations | Low | See BR-002. |
| Missing icon field | An Account without an uploaded custom icon is expected to always return a jdenticon URL by default; an Account observed without an `icon` field at all is a data anomaly, not systemic Account-type behavior. | Operations | Low | Same pattern as an isolated anomaly previously observed on one Accounts: Seller record. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-03-25 | Stu | Initial canon. |
| 0.2 | 2026-04-05 | Stu | ACC-001 resolved: externalId applies to Vendor (ERP manufacturer code) and Client (CDG) Accounts; irrelevant on Operations Account; Operations-only write on all types. BR-004 updated to connect CDG relationship to externalId field and note nullability. BR-009 rewritten. Section 5 externalId attribute updated. |
| 0.3 | 2026-04-05 | Stu | ACC-002 resolved: Vendor visibility is transaction-relationship-scoped (own Account plus transacting Client Accounts); Client visibility is self-only; non-visible Accounts return 404. ACC-003 partially resolved: Active/Enabled/Disabled semantics confirmed; Disabled driven by ERP sync not UI; Operations Account cannot be Disabled; downstream effects on Users/Tokens/transactions remain open. ACC-005 resolved: platform automatically creates default Administrators User Group on Account creation. State machine rewritten — T2/T3 replaced with ERP-sync-driven transitions T2/T3/T4. Sections 2, 3, 4, 5, 7, 9, 10 updated throughout. |
| 0.4 | 2026-07-15 | Stu / canon-generate | BR-007 corrected — fixed a broken wikilink around the AUT-001 reference (a stray bracket wrapped around just the ID prefix instead of plain text, the same class of bug as an earlier Template fix) and updated the now-stale AUT-001 reference: Catalog: Authorization's own refresh confirmed `eligibility` is independently maintained per object, not derived across Account/Authorization/Listing. Surfaced during the Authorization canon refresh. |
| 0.5 | 2026-07-15 | Stu / canon-generate | Refreshed via live OpenAPI schema, live-fetched real objects (STAGING, all three Account types, all Actors), and source-code research. All five prior open questions resolved. ACC-003: Disabling an Account is a bare status write — no cascade to Users/API Tokens (unimplemented), but blocks new Orders and Program eligibility (BR-015). ACC-004/BR-002/BR-003: a second Operations Account is technically blocked; Vendor/Client entity duplication is intentionally unrestricted — a first-class "multi-account" configuration. ACC-006/BR-008: `pyraTenantId` is system-managed, not user-settable, and deliberately non-unique. ACC-007/BR-016: `externalName` is ERP-derived display data, not independently owned — any submitted value is overwritten. ACC-008/BR-017: Client Account:Buyer is a direct reference, not ErpLink-mediated (the opposite of the Seller:Buyer pattern). Section 2: Operations' platform-wide visibility is gated by the Account Management module permission, not unconditional — a previously undocumented nuance; Vendor's visibility scoping precisely tied to Commerce: Agreement. Section 3: real, named, RBAC-gated endpoints found for Enable/Disable/Activate/Deactivate (previously described as unconfirmed/ERP-only with no direct endpoint) — corrected, and a previously-undocumented Active→Enabled Deactivate transition added (T5). BR-006 corrected — the Default User Group has no demote/promote mechanism at all (a stronger, different guarantee than the Parameter Group/Template pattern it was compared to). BR-011/BR-012 resolved — technicalSupportEmail/website/description apply to all Account types; absence on some samples is incidental, not schema-restricted. Section 6 Buyer relationship corrected accordingly. |
| 0.6 | 2026-07-15 | Stu / canon-generate | BR-017 updated with `[[Buyer]]`/`[[ErpLink]]`/`[[Seller]]` cross-references now that Buyer and ErpLink are canonised. Surfaced while canonising Accounts: Buyer and Accounts: ErpLink. |
