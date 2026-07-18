# Object Canon: User

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-18
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** User

**Namespace:** Accounts

**Parent Object:** None — top-level object.

**ID Prefix:** USR

**Description:**
A User is the platform's global identity for a single human being — one person, one User record, keyed by email address. It holds the person's name, contact details, locale/formatting preferences, authentication status, and the set of [[Account]]s they belong to. A User is not itself typed as Vendor, Operations, or Client; the Actor permissions that apply to any given call are derived from which Account the User is operating in and their Group memberships within it (preamble §2.1a). A User is created the first time a person is invited into any Account, and thereafter is reused — additional Account memberships attach to the same global identity rather than creating a second User.

**Also Known As:**
"Account member" and "platform user" are used informally. The per-Account membership record — distinct from this global identity — is the [[Account User]] (see Section 6). This object is the identity at `/accounts/users`; the membership is at `/accounts/account-users` and `/accounts/{accountId}/users`.

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes* | Yes (scoped) | Yes* | Yes* | *Gated by holding an administration Group permission within the Account scope, not by Actor type (preamble §2.1a). Vendor management is scoped to the Vendor's own Account. Read is scoped to Users sharing visibility; the `accounts` membership list is Operations-only. See BR-004, BR-007. |
| Operations | Yes* | Yes | Yes* | Yes* | *Same permission gating, unscoped. Operations additionally sees the full `accounts` membership list and the populated `currentAccount` (see Section 5). |
| Client | Yes* | Yes (scoped) | Yes* | Yes* | *Same permission gating as Vendor, scoped to the Client's own Account. |

> Create, Update, and Delete are governed by administration Group/module permissions within an Account context rather than by Actor type — the Access Management permission for management within one's own Account, the Platform Account Management permission for a User reached through another Account (BR-004). All three Actors may hold these permissions; Vendor and Client are scoped to their own Account, Operations is unscoped. Deletion is further constrained: only from `Disabled` status, never on one's own identity (BR-007). Password changes are self-only (BR-008); email is not directly editable (BR-009).

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| New | Transient initial state the instant a global identity is created, before any Account membership has been recorded against it. Not observed via the API in practice — creation immediately attaches the first membership and recalculates the status. | Yes | No |
| Invited | The User's highest-priority Account membership is a pending invitation. The person has been invited into at least one Account but has not yet accepted/activated anywhere with higher priority. | No | No |
| InvitationExpired | The User's highest-priority Account membership is an expired invitation, with no active or still-pending membership taking precedence. | No | No |
| Active | The User has at least one active Account membership. This is the normal operating state. | No | No |
| Blocked | The User has been administratively blocked. This overrides the membership-derived status and prevents the person from authenticating to the platform. Reached only via the Block action; left only via Unblock. | No | No |
| Disabled | The User has no active or pending Account memberships (all memberships removed, deleted, or never activated). The identity persists but is dormant. This is the only state from which the identity may be deleted. | No | No |
| Deleted | The identity has been deleted — a soft-delete: status is set to `Deleted` and the record is retained. A `Deleted` User remains retrievable by Operations (by ID) but is excluded from Vendor and Client reads. Reached only from `Disabled`; no transition out. | No | Yes |

> The `New`, `Invited`, `InvitationExpired`, `Active`, and `Disabled` statuses are a **projection of the User's Account membership statuses** — the platform recalculates the User status as the highest-priority membership status whenever a membership changes (see BR-005). `Blocked` and `Deleted` are the only statuses set by dedicated actions on the User itself.

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | New | Create identity | `POST /v1/accounts/{accountId}/users` (Account User invite — no dedicated global-User create endpoint) | Actor with administration permission in the Account | No existing User with the same email | If a User with the email already exists it is reused (BR-001), and no new identity is created. |
| T2 | New | Invited | Invitation issued | No dedicated User endpoint — recalculated from Account membership creation | Actor with administration permission in the Account | First membership created as an invitation | Membership operations live on the Account User, not the global User. |
| T3 | Invited | Active | Membership activated | No dedicated User endpoint — recalculated from Account membership change | System (membership context) | A membership becomes active (e.g. invitation accepted) | On first activation the platform records the invitation-accepted timestamp. See BR-005. |
| T4 | Invited | InvitationExpired | Invitation expires | No dedicated User endpoint — recalculated from Account membership change | System (membership context) | Highest-priority membership becomes an expired invitation | See BR-005. |
| T5 | InvitationExpired | Invited | Re-invited | No dedicated User endpoint — recalculated from Account membership change | Actor with administration permission in the Account | A new invitation becomes the highest-priority membership | See BR-005. |
| T6 | Active | Invited | Membership recalculated to invitation | No dedicated User endpoint — recalculated from Account membership change | System (membership context) | The highest-priority remaining membership is a pending invitation (e.g. the only active membership was removed) | Membership recalculation can move a User backward out of `Active`. See BR-005. |
| T7 | Active | InvitationExpired | Membership recalculated to expired invitation | No dedicated User endpoint — recalculated from Account membership change | System (membership context) | The highest-priority remaining membership is an expired invitation | Membership recalculation can move a User backward out of `Active`. See BR-005. |
| T8 | Active | Disabled | Last active/pending membership removed | No dedicated User endpoint — recalculated from Account membership change | Actor with administration permission in the Account | No active or pending membership remains | See BR-005. |
| T9 | Disabled | Active | Re-added to an Account | No dedicated User endpoint — recalculated from Account membership change | Actor with administration permission in the Account | An active membership is added | See BR-005. |
| T10 | Disabled | Invited | Re-invited to an Account | No dedicated User endpoint — recalculated from Account membership change | Actor with administration permission in the Account | A pending invitation is added | See BR-005. |
| T11 | Invited | Blocked | Block | `POST /v1/accounts/users/{uniqueFilter}/block` | Actor with Platform Account Management permission | None | Overrides the membership-derived status. See BR-006. |
| T12 | InvitationExpired | Blocked | Block | `POST /v1/accounts/users/{uniqueFilter}/block` | Actor with Platform Account Management permission | None | See BR-006. |
| T13 | Active | Blocked | Block | `POST /v1/accounts/users/{uniqueFilter}/block` | Actor with Platform Account Management permission | None | See BR-006. |
| T14 | Disabled | Blocked | Block | `POST /v1/accounts/users/{uniqueFilter}/block` | Actor with Platform Account Management permission | None | See BR-006. |
| T15 | Blocked | Active | Unblock | `POST /v1/accounts/users/{uniqueFilter}/unblock` | Actor with Platform Account Management permission | Recalculated membership status resolves to active | Unblock recomputes the status from current memberships (BR-005). |
| T16 | Blocked | Invited | Unblock | `POST /v1/accounts/users/{uniqueFilter}/unblock` | Actor with Platform Account Management permission | Recalculated membership status resolves to a pending invitation | See BR-005. |
| T17 | Blocked | InvitationExpired | Unblock | `POST /v1/accounts/users/{uniqueFilter}/unblock` | Actor with Platform Account Management permission | Recalculated membership status resolves to an expired invitation | See BR-005. |
| T18 | Blocked | Disabled | Unblock | `POST /v1/accounts/users/{uniqueFilter}/unblock` | Actor with Platform Account Management permission | No active or pending membership remains | See BR-005. |
| T19 | Disabled | Deleted | Delete identity | `DELETE /v1/accounts/users/{uniqueFilter}` (returns 204) | Actor with Platform Account Management permission | User is in `Disabled` status and is not the acting Actor's own identity | Soft-delete: status set to `Deleted`, record retained and still retrievable by Operations (by ID); excluded from Vendor/Client reads (BR-012). Terminal. See BR-006, BR-007. |

> The membership-derived statuses (`Invited`, `InvitationExpired`, `Active`, `Disabled`) are recalculated by BR-005 and may move between one another in any direction as memberships are added, activated, expired, or removed — including backward out of `Active` (T6, T7). The rows above enumerate the confirmed transitions; any (From → To) pair among these four statuses is permitted by the recalculation.
>
> Password set/change (`POST .../set-password`) does not change the User's status — it is a self-service operation modelled in Section 4 (BR-008) and Section 7, not a state transition.

### 3.3 State Diagram

```
[—] --(Create identity)--> [New] --(invited)--> [Invited] --(membership activated)--> [Active]
                                                    |  ^                                  |
                                          (expires) |  | (re-invited)                     | (last membership removed)
                                                    v  |                                  v
                                          [InvitationExpired] <----------------------> [Disabled] --(re-added)--> [Active] / [Invited]
                                                                                          |
   [Invited/InvitationExpired/Active/Disabled] --(Block)--> [Blocked]                     | (Delete, from Disabled only)
   [Blocked] --(Unblock: recalculated)--> [Active] / [Invited] / [InvitationExpired] / [Disabled]
                                                                                          v
                                                                                      [Deleted]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A User is a single global identity uniquely keyed by email address. Creating a User with an email that already exists reuses the existing identity rather than creating a second. | All | All | The first-time invite creates the identity; subsequent invites for the same email attach a new membership to it. |
| BR-002 | A User is addressable by either its `USR-NNNN-NNNN` identifier or its email address. | All | All | The path segment `{uniqueFilter}` accepts either form. |
| BR-003 | A User exists independently of any single Account and may belong to zero or more Accounts of any type, in any combination. Membership is modelled by the [[Account User]] record, not on this object. | All | All | A User with no Account memberships has no Actor permissions (preamble §2.1a). Account membership is exposed read-only via the User's `accounts` collection and the `/accounts` sub-resource. |
| BR-004 | Creating, updating, blocking, unblocking, and deleting a User is gated by administration Group/module permissions held within an Account context, not by Actor type. | All | All | Managing a User within one's own Account requires the Access Management permission; managing a User reached through another Account requires the Platform Account Management permission. All three Actors may hold these permissions; Vendor and Client are scoped to their own Account. |
| BR-005 | Outside of `Blocked` and `Deleted`, a User's status is recalculated as the highest-priority status among its Account memberships whenever a membership changes. | New, Invited, InvitationExpired, Active, Disabled | System | Priority order: active > invited > invitation-expired > deleted-membership. Mapping: active→`Active`, invited→`Invited`, invitation-expired→`InvitationExpired`, deleted-membership or no memberships→`Disabled`. Recalculation may move the User backward out of `Active` (to `Invited` or `InvitationExpired`) when its highest-priority remaining membership is a pending or expired invitation. |
| BR-006 | Block and Unblock are explicit administrative transitions on the User. Blocking sets `Blocked` and overrides the membership-derived status; unblocking recalculates the status from current memberships (BR-005). | Invited, InvitationExpired, Active, Disabled, Blocked | Platform Account Management | A `Blocked` User cannot authenticate to the platform in any Account. |
| BR-007 | A User may be deleted only while in `Disabled` status, and an Actor may not delete their own identity. | Disabled | Platform Account Management | State-based deletion guard — a User with any active or pending membership cannot be deleted; its memberships must be removed first (not an automatic cascade, per preamble Invariant 6). |
| BR-008 | A User's password may be set or changed only by that same User. | Invited, Active, Disabled | Self only | The set-password request carries the current password only for a change; its absence marks an initial set. |
| BR-009 | A User's email cannot be modified through the standard update path by any Actor; it is maintained only by the platform's SSO auto-update mechanism. | All | None (SSO-maintained) | Email is effectively immutable to human Actors. |
| BR-010 | The `currentAccount` may be switched only to an Account in which the User holds an active membership. | Active | Self / administration | Attempting to switch to an Account without an active membership is rejected. |
| BR-011 | The User icon follows the jdenticon behaviour of the platform Icon Pattern. | All | Self / administration | See preamble §9. A server-generated jdenticon is the default; a custom icon may be uploaded and removed to revert. Upload/removal is via the User's own `PUT` endpoint; `/icon` is read-only. |
| BR-012 | Deleting a User is a soft-delete: it sets status to `Deleted` and retains the record rather than removing it. A `Deleted` User remains retrievable by Operations (by ID) but is excluded from Vendor and Client reads. | Deleted | Operations (retrieval) | The identity is not returned to Vendor or Client Actors after deletion, and does not appear in their list responses. |

> **Guidance on business rules:**
> - "Platform Account Management" and "Access Management" name administration permission sets (Groups/modules per preamble §2.1a), not Actor types.

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| id | String | Platform-assigned global identifier. Format: `USR-NNNN-NNNN`. | System | No | Immutable. Also usable as the `{uniqueFilter}` path value. |
| email | String | The person's email address and the unique key for the global identity. | Invite / SSO | No (not via standard update) | Unique across all Users (BR-001). Editable only via SSO auto-update (BR-009). |
| firstName | String | The person's given name. | Self / administration | Yes | Required. |
| lastName | String | The person's family name. | Self / administration | Yes | Required. |
| name | String | Display name, composed from first and last name. | System | Yes (derived) | Read-only composite. |
| status | Enum | Authentication/lifecycle status. One of: `New`, `Invited`, `InvitationExpired`, `Active`, `Blocked`, `Disabled`, `Deleted`. | System / administration | Yes | Derived from memberships except for `Blocked`/`Deleted`. See Section 3, BR-005. |
| phone | Object | Optional phone number (`prefix`, `number`). | Self / administration | Yes | Nullable. Absent from response when null. |
| settings | Object | Locale and formatting preferences: `cultureCode`, `languageCode`, and optional `dateFormat`, `timeFormat`, `timeZone`, `numberFormat`, notification `optOuts`. | Self / administration | Yes | `cultureCode` and `languageCode` always present; other members absent when null. |
| icon | String | URL of the User's icon (jdenticon default or uploaded custom). | System / self | Yes | Jdenticon behaviour — see BR-011 and preamble §9. Nullable in schema; never null in practice. |
| lastLoginAt | Date-time | Timestamp of the most recent sign-in. | System | Yes (system) | Nullable; absent from response when the User has never signed in. |
| accounts | Array | The Accounts the User belongs to, each a reference with type and status. | System | Yes (derived) | Operations-only (Actor-suppressed): omitted for Vendor and Client and not retrievable by them even via `select=+accounts`. |
| currentAccount | Object | The Account the User is currently operating in, as an Account reference. | Self (switch) | Yes | Not Actor-suppressed. Populated for Operations; for Vendor and Client it is nulled when the fetched User's current Account differs from the viewer's Account. Switch constrained by BR-010. |
| audit | Object | Creation/update events plus `invitationAcceptedAt`. | System | Yes (system) | Omitted by default — request via `select=+audit`. |

> `invitationAcceptedAt` (within `audit`) is set once, when the User first activates a membership, and marks acceptance of terms and conditions.

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Accounts: Account User | Child | One User to many Account Users | The per-Account membership record. Each Account User links this global User to exactly one Account with a membership status, Group assignments, and Buyer visibility. | An Account User cannot exist without its User. A User's own status is derived from the aggregate of its Account Users (BR-005). |
| Accounts: Account | Association | Many Users to many Accounts (via Account User) | The Accounts the User belongs to and operates in. | Removing a User from an Account deletes that Account User membership and recalculates the User status; it never deletes the User. Deleting an Account is guarded independently. |
| Accounts: User Group | Association | Many Users to many Groups (within an Account) | Groups within an Account define the granular permission sets applied to the User's Account User membership. | Group membership is carried on the Account User, not the global User. |
| Accounts: API Token | Association | One Account context to many Tokens | A Token is scoped to one Account and inherits that Account's Actor profile and Group memberships (preamble §2.1a); it is not owned by the global User identity. | No lifecycle dependency on the global User. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

> Events that are significant for this object but do not necessarily change its state.

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Password created | First set-password call while `Invited` | Self | Records that a password now exists for the identity. |
| Password updated | Set-password call supplying the current password | Self | Replaces the stored credential. |
| Current account changed | `currentAccount` switched, or the current Account's active membership is removed | Self / system | Re-points the User to another Account they are actively linked to; cleared if none remains. |
| Invitation accepted | First membership activation | System (membership context) | Sets `invitationAcceptedAt`; marks terms-and-conditions acceptance. |

### 7.2 Cross-Object State Effects

> Effects this object's events have on *other* objects.

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Block | Accounts: Account User | The person is prevented from authenticating in every Account, across all memberships. | Yes (acting Actor's token context) | User transitions to `Blocked` | The block is global to the identity, not scoped to one Account membership. |
| Current account membership removed | Accounts: Account | The User's `currentAccount` is re-pointed to another actively-linked Account, or cleared. | Yes (membership context) | Removed Account was the current one | See Section 7.1. |

> No event on a User deletes any other object. A User can only reach a deletable state after its memberships have been removed independently (BR-007).

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Block ↔ Unblock is reversible with no limit on cycles; unblocking recalculates the membership-derived status. The membership-driven statuses (`Invited`, `InvitationExpired`, `Active`, `Disabled`) move freely as [[Account]] memberships are added, activated, expired, or removed. The transition into `Deleted` is not reversible.

**Deletion:**
A User may be deleted by an Actor holding the Platform Account Management permission only while the User is in `Disabled` status, and never on the Actor's own identity (BR-007). Deletion is a soft-delete: the User's status is set to `Deleted` and the record is retained (BR-012). A `Deleted` User remains retrievable by Operations (by ID) but is excluded from Vendor and Client reads, including their list responses. The transition into `Deleted` is terminal.

**Audit & history requirements:**
The `audit` object records creation and last-update events (each with Actor attribution) and the one-time `invitationAcceptedAt` timestamp; it is omitted by default and retrievable via `select=+audit`. Audit Records generated on the platform-wide Audit bus for User events are not yet canonised. No retention of prior field values beyond the Audit Trail is documented.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| A User is blocked by an administrator in one Account | The person is locked out of every Account they belong to, not just the one the administrator manages. | All Accounts' Actors | Medium | Block is global to the identity (BR-006). An administrator in one organisation can deny the person access to unrelated organisations. |
| A person is invited under an email that already exists as a User | The existing global identity is reused and a new membership is attached, rather than a fresh identity being created. | Vendor / Operations / Client | Medium | Intended (BR-001), but means the same person is one shared identity across organisations; profile fields are shared. |
| An email is captured incorrectly at invite time | The email cannot be corrected through the standard update path; it changes only via SSO auto-update. | Self / administration | Medium | See BR-009. |
| A User must be deleted but still belongs to Accounts | Deletion is refused until the User is in `Disabled` status; all memberships must be removed first. | Administration | Low | State-based deletion guard (BR-007); no automatic cascade (preamble Invariant 6). |
| `currentAccount` switch attempted to an Account without an active membership | The switch is rejected. | Self | Low | BR-010. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

> **Order newest-first.**

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-18 | Stu / canon-generate | Initial draft. Global User identity documented distinct from the per-Account Account User membership. Full state machine derived (New/Invited/InvitationExpired/Active/Blocked/Disabled/Deleted), with membership-projection status recalculation (including backward transitions out of `Active`), explicit Block/Unblock/Delete transitions, self-only password, SSO-maintained email, and jdenticon icon behaviour. Deletion documented as a soft-delete: record retained, retrievable by Operations, excluded from Vendor/Client reads. `accounts` list confirmed Operations-only (Actor-suppressed); `currentAccount` nulled for Vendor/Client when it differs from the viewer's Account. Administration permissions confirmed available to all Actors (Vendor/Client own-account-scoped). |
</content>
</invoke>
