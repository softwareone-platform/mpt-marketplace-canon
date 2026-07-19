# Object Canon: API Token

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-19
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** API Token

**Namespace:** Accounts

**Parent Object:** Accounts: Account

**ID Prefix:** TKN

**Description:**
An API Token is a non-human authentication credential used to call the platform API on behalf of an [[Account]]. It is the mechanism by which Extensions, integrations, and automation authenticate — the machine equivalent of a [[User]]'s interactive session. Each API Token is scoped to exactly one [[Account]] and carries a permission set derived from that Account's type and the [[Module]]s assigned to the token, so a token can never act outside the Account it belongs to or beyond the permissions granted to it (preamble §2.1a and §67). A token is created by an administrator when an integration needs programmatic access, and its secret credential is used thereafter to authenticate every call the integration makes.

**Also Known As:**
"Token", "robot account", and "service token" are used informally. The credential string it carries is referred to as the "token value" or "token secret".

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes* | Yes (scoped) | Yes* | Yes* | *Gated by holding the Access Management permission within the token's Account, not by Actor type (preamble §2.1a). Scoped to tokens in the Vendor's own Account. See BR-003, BR-004. |
| Operations | Yes* | Yes | Yes* | Yes* | *Same permission gating. With Platform Account Management, Operations manages and reads tokens across Accounts; with Platform Account Management plus Access Management it also sees tokens in Operations Accounts. See BR-004. |
| Client | Yes* | Yes (scoped) | Yes* | Yes* | *Same permission gating as Vendor, scoped to the Client's own Account. |

> Create, Read, Update, Enable, Disable, and Delete are governed by administration Group/module permissions within an Account context rather than by Actor type — the Access Management permission for a token in one's own Account, the Platform Account Management permission for a token reached through another Account (BR-003, BR-004). No field is suppressed by Actor for a token the Actor is permitted to see: an Actor either sees the whole token (including its secret — see BR-005 and Section 9) or cannot see it at all. Cross-Account invisibility is Account scoping, not field-level suppression.

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Active | The token can authenticate to the platform and exercise its permission set. This is the state every token is created in. | Yes | No |
| Disabled | The token is administratively suspended. It is retained with all its configuration but can no longer authenticate. Reached via Disable; left via Enable. | No | No |
| Deleted | The token has been deleted — a soft-delete: its status is set to `Deleted` and the record is retained, but it can no longer authenticate. It remains retrievable by Operations (holding Platform Account Management) but is removed from Vendor and Client API visibility. Reached from `Active` or `Disabled`; no transition out. | No | Yes |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Active | Create | `POST` (base collection endpoint) | Actor with Access Management permission in the target Account | Account exists; token name valid | Created directly in `Active`; the token secret is generated and returned in this response (BR-005). |
| T2 | Active | Disabled | Disable | `disable` | Actor with the applicable administration permission (BR-004) | Token is `Active` | Suspends authentication without discarding configuration. Reversible via T3. |
| T3 | Disabled | Active | Enable | `enable` | Actor with the applicable administration permission (BR-004) | Token is `Disabled` | Restores authentication. |
| T4 | Active | Deleted | Delete | `DELETE` (`/{id}`, returns 204) | Actor with the applicable administration permission (BR-004) | None | Soft-delete: status set to `Deleted`, record retained and still Operations-retrievable; removed from Vendor/Client visibility (BR-009). Not reversible; secret not regenerable (BR-005). |
| T5 | Disabled | Deleted | Delete | `DELETE` (`/{id}`, returns 204) | Actor with the applicable administration permission (BR-004) | None | As T4, from `Disabled`. |

> Enable is rejected on an already-`Active` token and Disable on an already-`Disabled` token — only the transitions listed above are permitted. Delete is permitted from both non-terminal states.

### 3.3 State Diagram

```
[—] --(Create : Actor w/ Access Management)--> [Active]
[Active] --(Disable)--> [Disabled]
[Disabled] --(Enable)--> [Active]
[Active] --(Delete)--> [Deleted]
[Disabled] --(Delete)--> [Deleted]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An API Token is scoped to exactly one [[Account]], set at creation and immutable thereafter. | All | All | The token can only ever act within, and is only ever visible within, its owning Account. |
| BR-002 | A token's effective permission set is the intersection of its [[Account]]'s type-derived Actor profile and the [[Module]]s assigned to the token (preamble §2.1a, §67). | All | All | The assignable [[Module]]s are those available to the Account (its default [[User Group]]); a token cannot be granted a Module the Account does not have. |
| BR-003 | Creating, reading, updating, enabling, disabling, and deleting a token is gated by administration Group/module permissions held within an Account context, not by Actor type. | All | All | All three Actors may hold these permissions; Vendor and Client are scoped to their own Account. |
| BR-004 | Managing or reading a token in one's own Account requires the Access Management permission; reaching a token through another Account requires the Platform Account Management permission. | All | All | Operations with Platform Account Management operates across Accounts; the same permission model applies to the [[User]] object (Accounts: [[User]] BR-004). |
| BR-005 | The token secret is generated by the platform at creation and cannot be changed, rotated, or regenerated; there is no rotation endpoint. | All | All | The secret has the form `idt:<token id>:<opaque value>`. To replace a compromised secret, the token must be deleted and a new one created. See Section 9. |
| BR-006 | A token `name` is required, at most 200 characters, and restricted to letters, digits, spaces, hyphens, periods, apostrophes, and double quotes. `description` is optional and at most 2000 characters. | All | All | `name` is not required to be unique within an Account. |
| BR-007 | Removing a [[Module]] from the Account's default [[User Group]] automatically removes that Module from every token that held it. | All | System | The token's permission set can therefore narrow without a direct update to the token (see Section 7.2). |
| BR-008 | A token's status changes only via Enable, Disable, and Delete; `name`, `description`, `icon`, `modules`, and `extensions` change via Update; `account` and the token secret never change after creation. | All | All | Update is a delta operation — only supplied fields are changed. |
| BR-009 | Deletion is a soft-delete: it sets the token's status to `Deleted` and retains the record rather than removing it; a deleted token can never again authenticate. A `Deleted` token remains retrievable by Operations (holding Platform Account Management) but is removed from Vendor and Client API visibility. | Active, Disabled | All | Mirrors the deletion model of Accounts: [[User]] — retained and Operations-retrievable, hidden from Vendor/Client. |
| BR-010 | The `extensions` scope limits which platform Extensions the token may act through: a null scope permits all Extensions, an empty list permits none, and a populated list permits only those named. | All | All | Extensions are not yet canonised. |
| BR-011 | The token secret is returned in full in every API response for the token — on read (`GET`) as well as at creation — for any Actor permitted to read the token. | All | All | Intended behaviour. Reading a token is gated by the Access Management permission (BR-004), so obtaining the secret requires that permission; any token read exposes a live credential (see Section 9). |
| BR-012 | At least one Module is not enforced at creation; a token may be created with an empty Module list, in which case it authenticates but carries no granular permissions. | — (creation) | All | Permissive-by-default (preamble §3.1). The API description's "at least one module" is not enforced by validation. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| id | string | Platform identifier, `TKN-NNNN-NNNN`. | System | No | — |
| name | string | Human-readable label for the token. | Creator | Yes (Update) | Required; max 200 chars; restricted charset (BR-006). |
| description | string | Free-text description of the token's purpose. | Creator | Yes (Update) | Optional; max 2000 chars. Absent from response when null. |
| status | string | Lifecycle state. | System | Via Enable/Disable/Delete only | Values: `Active`, `Disabled`, `Deleted`. `Deleted` is internal and not reachable on a readable token for Vendor/Client (BR-009). |
| token | string | The authentication secret used to call the API as this token. | System | No | Form `idt:<id>:<opaque value>`. Generated once at creation and not regenerable (BR-005). Returned in full on read as well as at creation, by design (BR-011) — see Section 9. |
| account | reference | The owning [[Account]]. | Creator | No | Set at creation from the request; immutable (BR-001). |
| modules | array of reference | The Modules that define the token's granular permission scope. | Creator | Yes (Update) | See BR-002. Can also narrow automatically when the Account's Modules change (BR-007). |
| extensions | array of reference | The Extensions the token may act through. | Creator | Yes (Update) | Null = all Extensions; empty = none; populated = only those listed (BR-010). Absent from response when null. Extensions are not yet canonised. |
| icon | string | Optional URL of a custom image for the token. | Creator | Yes (Update) | Optional; no server-generated default is produced when absent (this object is not in the preamble §9 jdenticon set). Absent from response when null. |
| lastAccessAt | date-time | Approximate timestamp of the token's most recent authenticated access. | System | Yes (system) | Updated only when the token's session token is refreshed, so it is approximate, not per-call. Absent from response when null. |
| revision | integer | Monotonic revision counter. | System | Yes (system) | Increments on change. |
| audit | object | Created/updated (and enabled/disabled) event metadata with acting identity. | System | Yes (system) | Omitted by default — request via `select=+audit`. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Accounts: Account | Parent | Many tokens : one Account | The token is scoped to exactly one Account and cannot exist without it. | A token cannot exist without its Account; the token secret authenticates as that Account. |
| Accounts: Module | Association | One token : one or more Modules | The Modules assigned to the token define its granular permission scope. | If a Module is removed from the Account's default Group, it is removed from the token (BR-007). No effect on token existence. |
| Accounts: User Group | Association | One token : one derived Group | The token's assignable Modules are drawn from the Account's default Group; its permission set is governed like a Group membership. | The available Modules track the Account's default Group; the token itself is not deleted by Group changes. |
| Accounts: User | Association | One creating/managing User : many tokens | A token is created and managed by a User acting with administration permission; the acting identity is recorded in the token's audit. | None — deleting or disabling the creating User does not affect the token. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

> Events that are significant for this object but do not necessarily change its state.

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Token created | `POST` to the collection endpoint | Actor with Access Management permission in the Account | Token created in `Active`; secret generated and returned; the token's permission set is registered with the platform authentication layer so the token can authenticate. |
| Token enabled / disabled | `enable` / `disable` | Actor with the applicable administration permission (BR-004) | The platform authentication layer is updated so the token can (Enabled) or cannot (Disabled) authenticate. |
| Token modules changed | Update with a `modules` delta | Actor with the applicable administration permission (BR-004) | The token's authorization is updated, and a platform event is published to the notification bus (see preamble §8) reflecting the permission change. |
| Token authenticated | The token calls the API and its session token is refreshed | The token itself | `lastAccessAt` is updated (approximate — only on session-token refresh). |

### 7.2 Cross-Object State Effects

> Effects this object's events have on *other* objects.

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Module removed from the Account's default Group | Accounts: API Token | The removed [[Module]] is stripped from every token in the Account that held it, narrowing the token's permission set | Yes (system) | The token currently holds the removed Module | Reverse direction of BR-007: a [[User Group]]/[[Module]] change drives a token change, not the other way around. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
`Active → Disabled` (Disable) is reversible via `Disabled → Active` (Enable), with no limit on the number of cycles. `Deleted` is terminal and not reversible.

**Deletion:**
An API Token may be deleted by an Actor holding the applicable administration permission (BR-003, BR-004), from either `Active` or `Disabled`. Deletion is a soft-delete: it sets the token's status to `Deleted` and retains the record rather than physically removing it (BR-009). A `Deleted` token can no longer authenticate; it remains retrievable by Operations (holding Platform Account Management) but is removed from Vendor and Client API visibility — for those Actors it is no longer retrievable via the API. This mirrors the deletion model of Accounts: [[User]]. The token secret is never regenerated, so deletion permanently ends that credential's usefulness — a replacement integration credential requires creating a new token.

**Audit & history requirements:**
The token carries audit metadata for its created and updated events, and for enable/disable, each recording the acting identity and timestamp (omitted by default; request via `select=+audit`). No prior-value history of `name`, `description`, `modules`, or `extensions` is retained on the object beyond the audit trail.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Any Actor who can read the token obtains a working credential | By design, the full secret is returned in API responses on read as well as at creation (BR-011), so anyone permitted to read the token can authenticate as it | Vendor, Operations, Client | High | Intended behaviour, not a leak: reading is gated by the Access Management permission (BR-004), which bounds who can obtain the secret. Integrators should treat any token read as exposing a live credential. |
| A token secret is compromised | There is no rotation or regeneration path; the only remedy is to delete the token and create a replacement, then re-key every integration that used it | Vendor, Operations, Client | Medium | See BR-005. |
| A token still in use by an integration is deleted or disabled | The credential immediately stops authenticating; any Extension or automation relying on it fails until re-keyed with a new token | Vendor, Operations, Client | Medium | Disable is the reversible option; Delete is permanent. |
| A [[Module]] the token depends on is removed from the Account's default Group | The Module is silently stripped from the token (BR-007); calls requiring that permission begin failing without any direct change to the token | Vendor, Operations, Client | Medium | The token remains `Active` and valid — only its permission set narrows. |
| A token is created with no Modules | The token authenticates but carries no granular permissions, so most calls are refused | Vendor, Operations, Client | Low | Permitted — at least one Module is not enforced at creation (BR-012). |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-19 | Stu / canon-generate-batch | Initial draft from OpenAPI schema, live multi-Actor STAGING fetch, Actor diff, and platform source research. States Active/Disabled/Deleted with enable/disable and delete transitions; Account scoping, Access Management / Platform Account Management permission gating, Module-derived permission set, immutable non-regenerable secret. Confirmed intended: the token secret is returned in full on read as well as at creation (BR-011); deletion is a soft-delete, retained and Operations-retrievable, hidden from Vendor/Client (BR-009, mirroring Accounts: User); at least one Module is not enforced at creation (BR-012). 0 open questions. |
