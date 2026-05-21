# Object Canon: Account

> **Version:** 0.3
> **Owner:** Stu
> **Last Updated:** 2026-04-05
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
| Vendor | No | Yes* | Yes** | No | *A Vendor can read its own Account and all Client Accounts that have transacted its products. Non-transacting Accounts return 404 — their existence is masked entirely. **A Vendor can update its own Account only. |
| Operations | Yes | Yes | Yes | No | Full read/write access to all Accounts. No DELETE endpoint exists in the spec. |
| Client | No | Yes* | Yes** | No | *A Client can read its own Account only. All other Accounts return 404 — their existence is masked entirely. **A Client can update its own Account only. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Active | Applies to Vendor and Client Accounts. On Client Accounts, `Active` means the `externalId` (CDG) is present and has been validated against SoftwareOne's ERP — the Account can transact and be billed. On Vendor Accounts, `Active` is the default creation state; no ERP validation is required or performed. | — | — |
| Enabled | Applies to Client and Operations Accounts. On Client Accounts, `Enabled` means the Account is not Disabled but the CDG has not been ERP-validated — the Account cannot transact or be billed. On the Operations Account, `Enabled` is the default creation state; ERP validation is not applicable. | — | — |
| Disabled | Applies to Vendor and Client Accounts. The Account is inactive. Set via ERP sync — not via the platform UI. The Operations Account cannot be set to `Disabled`. Downstream effects on Users, API Tokens, and active transactions are not confirmed. See ACC-003. | — | — |

### 3.2 Transitions

| # | From State | To State | Action / Trigger | Permitted Actor(s) | Preconditions | Outcome / Side Effects |
| --- | --- | --- | --- | --- | --- | --- |
| T1a | — | Active | Create | Operations | None | Vendor Accounts are created directly into `Active` status. No ERP validation required. |
| T1b | — | Enabled | Create | Operations | None | Client and Operations Accounts are created directly into `Enabled` status. |
| T2 | Enabled | Active | ERP Activate Account | Operations | CDG present in `externalId` and validated against ERP | Client Accounts only. Driven by ERP sync, not by a direct platform UI action. |
| T3a | Active | Disabled | ERP Disable Account | Operations | Not confirmed | Applies to Vendor and Client Accounts only. Driven by ERP sync, not by the platform UI. |
| T3b | Enabled | Disabled | ERP Disable Account | Operations | Not confirmed | Applies to Vendor and Client Accounts only. Driven by ERP sync, not by the platform UI. |
| T4a | Disabled | Active | ERP Re-enable Account | Operations | Not confirmed | Reversal of T3. Driven by ERP sync. |
| T4b | Disabled | Enabled | ERP Re-enable Account | Operations | Not confirmed | Reversal of T3. Driven by ERP sync. |

### 3.3 State Diagram

```
— ---(Create : Operations)---> [Active]   (Vendor Accounts — no ERP validation required)
— ---(Create : Operations)---> [Enabled]  (Client and Operations Accounts)

[Enabled] ---(ERP sync : Operations)---> [Active]    (Client Accounts only — CDG ERP-validated)
[Active]  ---(ERP sync : Operations)---> [Disabled]  (Vendor and Client Accounts only)
[Enabled] ---(ERP sync : Operations)---> [Disabled]  (Vendor and Client Accounts only)
[Disabled] ---(ERP sync : Operations)---> [Active / Enabled]  (reversal)
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An Account's `type` is immutable after creation. The `type` field determines the Actor permission profile for all Users and API Tokens associated with the Account and cannot be changed once set. | All | All | Required on creation. One of: `Vendor`, `Operations`, `Client`. |
| BR-002 | In PROD, there is exactly one Operations Account. It represents SoftwareOne as the platform steward and cannot be duplicated. | All | Operations | Platform convention, not a platform-enforced constraint. Whether the platform technically prevents creation of a second Operations Account is not confirmed. See ACC-004. |
| BR-003 | In PROD, there is exactly one Account per Vendor entity. One real-world software manufacturer maps to one Vendor Account. | All | Operations | Platform convention, not a confirmed platform-enforced constraint. See ACC-004. |
| BR-004 | A Client Account has a 1:1 relationship with a CDG (Customer Discount Group) in SoftwareOne's ERP. The CDG is the global identifier for a customer organisation. The CDG is represented on the Client Account via the `externalId` field. The relationship is 1:1 but a Client Account may have a null CDG — `externalId` is nullable. | All | Operations | The platform does not enforce CDG uniqueness across Client Accounts — this is an operational discipline. |
| BR-005 | An Account cannot be deleted. No DELETE endpoint exists in the API spec. | All | All | — |
| BR-006 | Every Account has at least one User Group. The Default Protection Pattern applies — exactly one group must be marked `isDefault: true` at all times. The default group cannot be deleted directly; it must first be demoted. Marking a new group as default automatically demotes the existing default. | All | Operations | Consistent with Preamble Section 3.4 (Default Protection Pattern). The platform automatically creates a default "Administrators" User Group on Account creation. |
| BR-007 | The `eligibility` field is applicable to Client Accounts only. It controls whether the Client may transact as a standard Client (`eligibility.client`) and/or as a Partner (`eligibility.partner`). For Vendor and Operations Accounts, `eligibility` is absent from the API response (null suppression). | All | Operations | Consistent with the `eligibility` model on [[Authorization]] and [[Listing]]. Full semantics of `eligibility.partner` are not confirmed — see [[AUT]]-001. |
| BR-008 | The `externalIds.pyraTenantId` field is a UUID that maps the Account to SoftwareOne's internal identity platform (Pyra). It is present on all Account types. | All | Operations | UUID format. Set at creation and believed to be immutable. See ACC-006. |
| BR-009 | The `externalId` field is Operations-managed on all Account types. On Vendor Accounts, it maps to the manufacturer code in SoftwareOne's ERP. On Client Accounts, it maps to the CDG (Customer Discount Group) — the global ERP identifier for a customer organisation. On the Operations Account, `externalId` is present in the spec but has no defined operational purpose. `externalId` is always set and maintained exclusively by Operations — no other Actor can write this field. | All | Operations | `maxLength: 250`. Nullable — absent from response when null, consistent with null suppression. |
| BR-010 | The `name` field has a minimum length of 1 and a maximum length of 500 characters. It is required on creation and on update. | All | Operations, Vendor, Client | The Account owner may update their own Account's name. |
| BR-011 | `technicalSupportEmail` has a maximum length of 320 characters and must be a valid email format. It is optional. Observed on Operations and Vendor Accounts; absent from the Client Account in the data sample. | All | Operations, Vendor, Client | Whether this field is restricted to specific Account types is not confirmed. |
| BR-012 | `website` and `description` each have a maximum length of 2,000 characters. Both are optional. Observed on Operations and Vendor Accounts; absent from the Client Account in the data sample. | All | Operations, Vendor, Client | Whether these fields are restricted to specific Account types is not confirmed. |
| BR-013 | `groups` and `audit` are omitted from Account API responses by default. Both must be explicitly requested via `select=+groups` and `select=+audit` respectively. | All | All | Standard platform default-omission pattern. See Preamble Section 6.2. |
| BR-014 | The `address` field is an object on all Account types. An empty address object (`{}`) is a valid representation — all address sub-fields are nullable. | All | Operations, Vendor, Client | Observed on the Client Account (Meeks Corp) which has `"address": {}`. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| id | String | Platform-assigned unique identifier. Format: `ACC-NNNN-NNNN`. | System | No | Immutable. Assigned at creation. |
| name | String | Human-readable name of the Account. | Operations, Vendor, Client | Yes | Required on creation and update. `minLength: 1`, `maxLength: 500`. |
| type | Enum | Actor type for this Account. One of: `Vendor`, `Operations`, `Client`. | Operations | No | Required on creation. Immutable after creation. Determines the Actor permission profile for all associated Users and API Tokens. |
| status | Enum | Operational status. One of: `Active`, `Enabled`, `Disabled`. | Operations / ERP sync | Yes | `Active`: on Client Accounts, CDG is ERP-validated — can transact and be billed; on Vendor Accounts, default creation state with no ERP gate. `Enabled`: on Client Accounts, not Disabled but CDG not ERP-validated — cannot transact or be billed; on Operations Account, default creation state. `Disabled`: Vendor and Client Accounts only — set via ERP sync, not via UI. Operations Account cannot be Disabled. |
| externalIds.pyraTenantId | String (UUID) | Maps the Account to SoftwareOne's internal identity platform (Pyra). | Operations | See ACC-006 | Present on all Account types. UUID format. |
| externalId | String | Operations-managed ERP reference. Meaning varies by Account type: on Vendor Accounts, maps to the ERP manufacturer code; on Client Accounts, maps to the CDG (Customer Discount Group) — the global ERP identifier for a customer organisation; on the Operations Account, has no defined operational purpose. Always set and maintained exclusively by Operations regardless of Account type. | Operations | Yes | `maxLength: 250`. Nullable. Absent from response when null. |
| externalName | String | An external name for the Account. Purpose and ownership not confirmed. | Operations | Yes | See ACC-007. Nullable. Absent from response when null. |
| address | Object | Registered address of the Account. All sub-fields are nullable. An empty address object (`{}`) is valid. | Operations, Vendor, Client | Yes | Sub-fields: `addressLine1`, `addressLine2`, `postCode`, `city`, `state`, `country` — all nullable strings. |
| technicalSupportEmail | String | Technical support email address for the Account. | Operations, Vendor, Client | Yes | Optional. `maxLength: 320`. Must be valid email format. |
| website | String | Website URL for the Account. | Operations, Vendor, Client | Yes | Optional. `maxLength: 2000`. |
| description | String | Description of the Account. | Operations, Vendor, Client | Yes | Optional. `maxLength: 2000`. |
| defaultLanguageCode | String | BCP 47 language tag representing the Account's preferred language. | Operations, Vendor, Client | Yes | Optional. Observed as `"en-US"` on all three Account types in data sample. |
| eligibility | Object | Controls Client transacting eligibility. Sub-fields: `eligibility.client` (Boolean), `eligibility.partner` (Boolean). | Operations | Yes | Present on Client Accounts only. Absent from response when null (consistent with null suppression). Full semantics of `eligibility.partner` not confirmed — see AUT-001. |
| groups | Collection | User Groups associated with this Account. | System / Operations | N/A | Omitted from API responses by default. Request via `select=+groups`. Every Account has at least one group; Default Protection Pattern applies. |
| icon | String | URL path to the Account's icon. Follows jdenticon behaviour — defaults to a server-generated jdenticon; a custom icon may be uploaded to replace it. | Operations, Vendor, Client | Yes | Nullable. Returns jdenticon URL by default. Uploaded via `logo` binary field on PUT (`multipart/form-data`). See Preamble Section 9. |
| revision | Integer | Increments on each update. | System | N/A | Read-only. |
| audit | Object | Standard platform audit block. Records `created` and `updated` timestamps and Actor references. | System | N/A | Omitted from API responses by default. Request via `select=+audit`. The Operations Account's `audit.created.by` is absent — believed to be a system-bootstrapped account predating Actor attribution. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Accounts: User Group | Parent of | One:Many | Every Account owns one or more User Groups. User Groups cannot exist without a parent Account. | Yes — User Groups cannot exist without a parent Account. Account deletion is not possible. Default Protection Pattern applies — exactly one User Group must be `isDefault: true` at all times. |
| Accounts: User | Association | Many:Many | Users are associated with Accounts. A User may belong to multiple Accounts. A single Account may have many Users. | No direct lifecycle dependency — User membership is managed independently. |
| Accounts: API Token | Parent of | One:Many | API Tokens are scoped to an Account. A Token inherits the Actor permission profile of its parent Account. | Yes — API Tokens cannot exist without a parent Account. Account deletion is not possible. |
| Accounts: Buyer | Association | One:Many | Client Accounts are associated with Buyers via ErpLinks. The exact relationship model between Account and Buyer is not fully confirmed. See ACC-008. | Not confirmed. |
| Catalog: Authorization | Association | One:Many | Vendor Accounts are referenced as the Vendor on Authorizations. | No direct lifecycle dependency — Authorization references the Vendor Account but the Vendor Account has no deletion guard from Authorizations. |
| Catalog: Listing | Association | One:Many | Vendor Accounts are referenced as the Vendor on Listings. | No direct lifecycle dependency. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Account created | Operations creates an Account | Operations | Account becomes available for User and API Token association. The platform automatically creates a default "Administrators" User Group and assigns it to the Account. |
| Account activated | ERP sync sets status = Active on a Client Account | Operations (via ERP sync) | Client Account becomes able to transact and be billed. |
| Account disabled | ERP sync sets status = Disabled on a Vendor or Client Account | Operations (via ERP sync) | Account becomes inactive. Downstream effects on Users, API Tokens, and active transactions not confirmed. See ACC-003. |
| Account re-enabled | ERP sync reverses Disabled status | Operations (via ERP sync) | Account returns to operational status. Downstream effects not confirmed. See ACC-003. |
| icon uploaded | Operations or Account owner uploads a custom icon via `logo` field on PUT | Operations, Vendor, Client | Custom icon replaces the jdenticon. Returned as the value of the `icon` field in subsequent API responses. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Account created | Accounts: User Group | A default "Administrators" User Group is created and linked to the Account | Yes | Always on Account creation | Platform-confirmed behaviour. |
| Account disabled | Accounts: User | Effect on associated Users' ability to log in and transact is not confirmed | Not confirmed | — | See ACC-003. |
| Account disabled | Accounts: API Token | Effect on associated API Tokens' ability to authenticate is not confirmed | Not confirmed | — | See ACC-003. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
The `Active` / `Enabled` ↔ `Disabled` cycle is believed to be reversible via PUT. No limit on cycles has been confirmed.

**Deletion:**
Accounts cannot be deleted. No DELETE endpoint exists in the API spec. See BR-005.

**Audit & history requirements:**
The audit block captures `created` and `updated` timestamps and Actor references, consistent with the standard platform audit schema. Audit is omitted from API responses by default — request via `select=+audit`. The Operations Account (`ACC-1032-0145`) has no `audit.created.by` — believed to be a system-bootstrapped account whose creation predates the platform's Actor attribution model.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Account disabled | Downstream effects on associated Users, API Tokens, and active transactions are not confirmed. | Operations, Vendor, Client | High | See ACC-003. Do not disable an Account without first confirming the downstream impact. |
| Client Account created without ERP CDG linkage | The platform permits this — the 1:1 CDG constraint is an operational discipline, not a platform-enforced rule. A Client Account without a valid ERP CDG may cause billing and procurement failures. | Operations, Client | High | Operations is responsible for ensuring Client Accounts are properly linked to ERP records. |
| `eligibility` absent on Client Account | If both `eligibility.client` and `eligibility.partner` are false or absent, the Client may be unable to place Orders under any Listing. | Client | High | Operations is responsible for ensuring Client Account eligibility is correctly configured. |
| `externalIds.pyraTenantId` conflict | If a `pyraTenantId` is reused or incorrectly assigned across Accounts, identity platform conflicts may occur. The platform does not confirm whether uniqueness is enforced. | Operations | High | See ACC-006. |
| User Group default deleted | The default User Group cannot be deleted directly — the Default Protection Pattern prevents this. Operations must first designate another group as default before the current default can be deleted. | Operations | Low | Consistent with Preamble Section 3.4. |

---

## 10. Open Questions

- [ ] ACC-003: The downstream effects of setting an Account to `Disabled` are not confirmed. Specifically: whether associated Users are locked out from logging in, whether associated API Tokens are invalidated, and whether active transactions are affected. Requires confirmation.
- [ ] ACC-004: Whether the platform technically prevents creation of a second Operations Account or a second Account for the same Vendor entity is not confirmed. In PROD these are observed as 1:1 constraints but may be operational discipline rather than platform enforcement.
- [ ] ACC-006: Whether `externalIds.pyraTenantId` is immutable after creation is not confirmed. Whether the platform enforces uniqueness of `pyraTenantId` across Accounts is also not confirmed.
- [ ] ACC-007: The purpose and ownership of the `externalName` field is not confirmed. It is present in the spec on `AccountCreate` and `AccountUpdate` but was not observed in the production JSON samples. Whether it applies to all Account types or specific types is not confirmed.
- [ ] ACC-008: The relationship between a Client Account and Buyers is not fully confirmed. Whether Buyers are directly associated with the Account, or only via ErpLinks, requires engineering input.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-03-25 | Stu | Initial canon. |
| 0.2 | 2026-04-05 | Stu | ACC-001 resolved: externalId applies to Vendor (ERP manufacturer code) and Client (CDG) Accounts; irrelevant on Operations Account; Operations-only write on all types. BR-004 updated to connect CDG relationship to externalId field and note nullability. BR-009 rewritten. Section 5 externalId attribute updated. |
| 0.3 | 2026-04-05 | Stu | ACC-002 resolved: Vendor visibility is transaction-relationship-scoped (own Account plus transacting Client Accounts); Client visibility is self-only; non-visible Accounts return 404. ACC-003 partially resolved: Active/Enabled/Disabled semantics confirmed; Disabled driven by ERP sync not UI; Operations Account cannot be Disabled; downstream effects on Users/Tokens/transactions remain open. ACC-005 resolved: platform automatically creates default Administrators User Group on Account creation. State machine rewritten — T2/T3 replaced with ERP-sync-driven transitions T2/T3/T4. Sections 2, 3, 4, 5, 7, 9, 10 updated throughout. |
