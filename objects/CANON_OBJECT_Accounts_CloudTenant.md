# Object Canon: Cloud Tenant

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-18
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Cloud Tenant

**Namespace:** Accounts

**Parent Object:** None — top-level object.

**ID Prefix:** CLT

**Description:**
A Cloud Tenant represents a single cloud environment used for cloud-spend management — an AWS, Microsoft Azure, or Microsoft 365 subscription (CSP or EA), or an SLM or Virtual tenant — mapped onto a client [[Account]]. It is the Marketplace-side representation of a tenant that lives in SoftwareOne's legacy consumption-management system; the Marketplace object exists so that cloud-spend data can be attributed to the correct client Account and so that [[User]] access to spend data can be scoped per tenant. A Cloud Tenant does not provision or create anything in the external consumption-management system — creating one registers (maps) an already-existing consumption tenant to an Account.

**Also Known As:**
Cloud tenant, CLT. Sometimes referred to by its external anchors — the "PyraCloud tenant" or "consumption-management tenant" it maps to.

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor     | No | No | No | No | No access to the object on this API surface — requests are rejected. |
| Operations | Yes | Yes | Yes | Yes | Gated by the platform account-management permission. Delete is a soft-delete (see BR-009). |
| Client     | No | No | No | No | No access to the object on this API surface — requests are rejected. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Active | The tenant is enabled for cloud-spend management. Mirrors the enabled state of the mapped consumption-management tenant. | Yes | No |
| Disabled | The tenant is disabled for cloud-spend management. Mirrors the disabled state of the mapped consumption-management tenant. | Yes | No |
| Deleted | The tenant has been removed. It is no longer retrievable via the API (see BR-009 and Section 8). | No | Yes |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Active | Create | `POST` (base collection endpoint) | Operations | Valid `externalIds`; any supplied [[Account]] must share the tenant's `pyraTenantId`; an `SLM`/`Virtual` tenant may not map into a multi-account Pyra Tenant | Initial status is set from the create payload; a tenant registered as enabled starts Active. See BR-002, BR-003, BR-004. |
| T2 | — | Disabled | Create | `POST` (base collection endpoint) | Operations | Same as T1 | Initial status Disabled when the tenant is registered in a disabled state. |
| T3 | Active | Disabled | Disable | `PUT` (status field write, no dedicated endpoint) | Operations | None | Reflects a disable in consumption management, or a direct status write. |
| T4 | Disabled | Active | Enable | `PUT` (status field write, no dedicated endpoint) | Operations | None | Reflects an enable in consumption management, or a direct status write. |
| T5 | Active | Deleted | Delete | `DELETE` | Operations | None | Soft-delete — sets status to Deleted; the record is no longer retrievable via the API. Cannot be reached by a `PUT` status write (see BR-008). |
| T6 | Disabled | Deleted | Delete | `DELETE` | Operations | None | Soft-delete — as T5. |

### 3.3 State Diagram

```
—         ---(Create : Operations)---> Active
—         ---(Create : Operations)---> Disabled
Active    ---(Disable : Operations)--> Disabled
Disabled  ---(Enable : Operations)---> Active
Active    ---(Delete : Operations)---> Deleted
Disabled  ---(Delete : Operations)---> Deleted
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Cloud Tenant maps to at most one client [[Account]]. The mapping is optional — a tenant may exist unmapped. | All | Operations | The mapped Account is an association, not a parent; a Cloud Tenant can exist with no Account. |
| BR-002 | A Cloud Tenant is uniquely identified by its consumption-management mapping key. Creating a second Cloud Tenant with an already-registered key is rejected. | All | Operations | The mapping key is `externalIds.cloudConsumptionId`. This is why creation registers an existing consumption tenant rather than creating a new one. |
| BR-003 | A Cloud Tenant may only be mapped to an [[Account]] that shares its Pyra Tenant. A mapping to an Account with a different `pyraTenantId` is rejected. | All | Operations | Applies at both create and reassignment. The Pyra Tenant (`pyraTenantId`) is the common anchor between an Account and its Cloud Tenants. |
| BR-004 | A Cloud Tenant of type `SLM` or `Virtual` cannot be mapped to an [[Account]] when more than one Account shares the same Pyra Tenant (a multi-account configuration). | All | Operations | `SLM` and `Virtual` tenants are not supported in the multi-account-per-Pyra-Tenant scenario; the presence of such tenants also blocks forming a multi-account (see Section 7.2). |
| BR-005 | On creation, if no [[Account]] is supplied and exactly one Account shares the tenant's Pyra Tenant, the tenant is auto-mapped to that Account. If zero or more than one Account matches, the tenant is left unmapped. | All | Operations | Auto-mapping applies only at creation. |
| BR-006 | A mapped Cloud Tenant can be reassigned (transferred) to a different [[Account]] that shares the same Pyra Tenant. Supplying no account on update removes the mapping. | Active, Disabled | Operations | Reassignment does not auto-map — an update that clears the account leaves the tenant unmapped (contrast BR-005). |
| BR-007 | A Cloud Tenant's `name` is at most 100 characters. | All | Operations | — |
| BR-008 | A Cloud Tenant cannot be moved to Deleted by a status write. The Deleted state is reachable only through the delete operation. | Active, Disabled | Operations | An update that sets status to `Deleted` is rejected; `Active` and `Disabled` are the only status values a status write may set. |
| BR-009 | Deleting a Cloud Tenant sets its status to Deleted; the record is thereafter no longer retrievable via the API. | Active, Disabled | Operations | Consistent with Platform Invariant 7. Deleted tenants do not appear in list responses and are no longer retrievable via the API. |
| BR-010 | A Cloud Tenant's `type` is fixed at creation and cannot be changed via the API. | All | Operations | One of `AwsDirect`, `AwsService`, `Csp365`, `CspAzure`, `Ea365`, `EaAzure`, `Slm`, `Virtual`. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| id | String | Platform identifier, `CLT-NNNN-NNNN`. | Platform | No | — |
| name | String | Display name of the tenant; mirrors the consumption-management display name. | Operations / external sync | Yes | Max 100 characters (BR-007). |
| status | String (enum) | Lifecycle state. One of `Active`, `Disabled`, `Deleted`. | Operations / external sync | Yes | `Deleted` is not settable via update (BR-008). See Section 3. |
| type | String (enum) | Cloud environment kind. | Operations | No | `AwsDirect`, `AwsService`, `Csp365`, `CspAzure`, `Ea365`, `EaAzure`, `Slm`, `Virtual`. `Slm`/`Virtual` have a multi-account restriction (BR-004). Fixed after creation (BR-010). |
| account | Reference (Account) | The mapped client Account, if any. | Operations | Yes | Optional (BR-001); reassignable subject to BR-003/BR-004. Absent from response when null. |
| externalIds.cloudConsumptionId | String (UUID) | Identifier of the tenant in consumption management; the mapping key. | Operations / external sync | Yes | Uniqueness key — see BR-002. |
| externalIds.pyraTenantId | String (UUID) | The Pyra Tenant the cloud tenant belongs to; the anchor to a compatible Account. | Operations / external sync | Yes | Drives account-mapping eligibility (BR-003, BR-005). |
| externalIds.providerId | String (UUID) | Cloud-provider-side tenant identifier (e.g. CSP tenant id). | Operations / external sync | Yes | Optional. Absent from response when null. |
| revision | Integer | Monotonic revision counter. | Platform | Yes | Increments on change. |
| audit | Object | Created/updated actor and timestamp metadata. | Platform | Yes | Omitted by default — request via `select=+audit`. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Accounts: Account | Association | 0..N Cloud Tenants to 0..1 Account | A Cloud Tenant may be mapped to one client Account sharing its Pyra Tenant; an Account may have many Cloud Tenants. | No cascade. A mapped Account cannot be deactivated as part of a multi-account while it holds Cloud Tenants (see Section 7.2). |
| Accounts: User | Association | Many-to-many (via Account) | A User's access to a Cloud Tenant's cloud-spend data is derived from Account membership and recalculated when the mapping changes. | No cascade. Remapping a tenant triggers recalculation of affected Users' access (Section 7). |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Account mapping changed | Create with an account, reassignment, or clearing the account | Operations | Recalculation of affected [[User]]s' cloud-tenant access, scoped to the newly- and previously-mapped [[Account]]. |

### 7.2 Cross-Object State Effects

> Effects this object's events have on *other* objects.

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Cloud Tenant mapped to an Account | Accounts: Account | The Account's multi-account deactivation is guarded — a multi-account [[Account]] cannot be deactivated while it holds mapped Cloud Tenants. | Yes (Operations token context) | Account is part of a multi-account (shares its Pyra Tenant with other Accounts) | Guard is enforced on the Account operation, not here. |
| Existing `SLM`/`Virtual` Cloud Tenant present | Accounts: Account | Forming a multi-account (a second [[Account]] on the same Pyra Tenant) is blocked. | Yes (Operations token context) | An Account on the Pyra Tenant holds an `SLM` or `Virtual` tenant | See BR-004. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Active → Disabled and Disabled → Active are reversible with no limit on cycles. The transition to Deleted is terminal and not reversible.

**Deletion:**
A Cloud Tenant may be deleted by Operations in the Active or Disabled state. Deletion is a soft operation — it sets the tenant's status to Deleted rather than physically removing the record — but the deleted tenant is thereafter no longer retrievable via the API, consistent with Platform Invariant 7. Deletion via the API does not remove the tenant from the external consumption-management system; conversely, deleting the tenant in consumption management is what drives the Marketplace tenant to Deleted.

**Audit & history requirements:**
Standard created/updated audit metadata is retained and returned via `select=+audit`. No prior-value history of `name`, `status`, or mapping beyond the Audit Trail is confirmed.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Operations edits `name` or `status` directly while consumption management remains the system of record | The platform accepts the write; a subsequent one-way sync from consumption management may overwrite it, producing drift between the two systems. | Operations | Medium | The public write surface coexists with the one-way sync from consumption management; a direct write may later be overwritten by that sync. |
| Reassignment update sent with no account | The tenant is unmapped (mapping cleared) rather than kept or auto-remapped. | Operations | Medium | Contrast with create-time auto-mapping (BR-005); a caller expecting create-style behaviour may unintentionally orphan the tenant. |
| Attempt to map a tenant to an [[Account]] on a different Pyra Tenant | The mapping is rejected. | Operations | Low | BR-003. |
| Attempt to map an `SLM`/`Virtual` tenant into a multi-account Pyra Tenant | The mapping is rejected. | Operations | Low | BR-004. |
| Client Actor attempts to read cloud-spend tenant data via this API | Request is rejected — the object is not exposed to the Client Actor on this surface. | Client | Low | The Cloud Tenant object is Operations-only on this API surface. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-19 | Stu / canon-generate-batch | Initial draft from live OpenAPI schema, live-fetched STAGING object (Operations; Vendor/Client 403), source-code research, and the Cloud tenant (CLT) business-context page. State machine (Active/Disabled/Deleted), mapping and Pyra-Tenant eligibility rules, SLM/Virtual multi-account restriction, soft-delete behaviour, and the Account/User relationships captured. The public write surface (Operations create/update/delete) is documented as observed, alongside its one-way sync from consumption management. 0 open questions. |
