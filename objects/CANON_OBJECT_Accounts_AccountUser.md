# Object Canon: Account User

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-18
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Account User

**Namespace:** Accounts

**Parent Object:** Accounts: Account

**ID Prefix:** AUSR

**Description:**
An Account User is the membership object that links one platform User identity to one [[Account]], carrying the User's Group assignments, Buyer visibility scope, and invitation state within that Account. It is the object that grants a User the ability to operate as an Actor in an Account: a User with no Account User memberships has no Actor permissions (Preamble Section 2.1a), and the effective permission set for any action is the intersection of the Account's type and the Groups held through this membership. Account Users are created when an existing User is added to an Account or a new User is invited to it, and are managed by Actors holding Access Management permission in that Account.

**Also Known As:**
Account membership; user-account link. The account-scoped API view addresses it as a User "in" an Account (`accounts/{accountId}/users/{userId}`); the standalone view addresses it by its own `AUSR` identifier. Both address the same membership object.

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor     | Yes | Yes | Yes | Yes | All operations are scoped to the Actor's own Account and require Access Management permission there. Can create only in Invited state (an invitation is issued); cannot create a directly-Active membership (BR-004). Cannot delete own membership (BR-006). |
| Operations | Yes | Yes | Yes | Yes | May additionally create a membership directly in Active state, bypassing the invitation (BR-004), and is the only Actor permitted to update `notes` (BR-010). Cannot delete own membership (BR-006). |
| Client     | Yes | Yes | Yes | Yes | Same as Vendor — own Account only, Access Management permission required, Invited-state creation only, no self-deletion. Clients operate only in PROD (Preamble Section 7.2). |

> Authority is permission-based, not Actor-type-based: any Actor operating in an Account with Access Management permission manages that Account's memberships. The one Actor-type distinction is the directly-Active creation path and `notes` editing, both Operations-only. Accepting an invitation is not an administrative action — it is performed by the invited User themselves (BR-005). A membership is only visible to Actors operating in (or with authority over) its Account; an Actor in an unrelated Account cannot read it. No Actor-based field suppression applies — Vendor, Operations, and Client that can read a membership see the same fields.

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Invited | The membership exists and an invitation has been issued to the User, but the User has not yet accepted. The invitation carries a time-limited code (see BR-007). The User does not yet have active access through this membership. | Yes (via invite) | No |
| Active | The invitation has been accepted, or the membership was created directly as Active by Operations. The User has working access to the Account, subject to their Group permissions. | Yes (Operations direct-add) | No |
| InvitationExpired | The invitation lapsed without being accepted within its validity window (BR-007). The User cannot accept from the lapsed invitation; a new invitation must be issued to return the membership to Invited. | No | No |
| Deleted | The membership has been removed. The User loses access to the Account through this membership. | No | Yes |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Invited | Invite User to Account | `POST /v1/accounts/accounts/{accountId}/users` | Vendor, Operations, Client (own Account) | At least one Group supplied; no `invitation.status` of `Active` on the request | An invitation is issued. If the User identity does not yet exist it is created (see Accounts: User). |
| T2 | — | Active | Add existing User to Account | `POST /v1/accounts/accounts/{accountId}/users` | Operations | Request carries `invitation.status` = `Active`; the User identity already exists | Operations-only (BR-004). No invitation is sent — the membership is Active immediately. |
| T3 | Invited | Active | Accept invitation | `POST .../{userId}/accept-invite` | The invited User (self) | Invitation not expired | Performed by the invited User, not an administrator (BR-005). Firing accept-invite on an already-Active membership is a no-op. |
| T4 | Invited | Invited | Resend invitation | `POST .../{userId}/resend-invite` | Vendor, Operations, Client (own Account) | Membership is Invited | Re-entry. Renews the invitation and extends its expiry (BR-007). |
| T5 | Invited | InvitationExpired | Expire invitation | No dedicated endpoint (system-initiated status write) | System (Preamble Invariant 2) | Invitation past its expiry instant | Executed by a platform background process, not an Actor-invoked endpoint. |
| T6 | Invited | Deleted | Delete membership | `DELETE .../{userId}` | Vendor, Operations, Client (own Account) | Actor is not deleting own membership (BR-006) | Permanently removed — no longer retrievable via the API. |
| T7 | InvitationExpired | Invited | Send new invitation | `POST .../{userId}/send-new-invite` | Vendor, Operations, Client (own Account) | Membership is InvitationExpired | Regenerates the invitation, returning it to Invited with a fresh expiry (BR-007). |
| T8 | InvitationExpired | Deleted | Delete membership | `DELETE .../{userId}` | Vendor, Operations, Client (own Account) | Actor is not deleting own membership (BR-006) | Permanently removed — no longer retrievable via the API. |
| T9 | Active | Deleted | Delete membership | `DELETE .../{userId}` | Vendor, Operations, Client (own Account) | Actor is not deleting own membership (BR-006) | Permanently removed — no longer retrievable via the API. Revokes the User's access to the Account and propagates the removal to integrated downstream identity/ERP systems (see Section 7.2). |

### 3.3 State Diagram

```
—  ---(Invite User : Vendor/Operations/Client)---------> Invited
—  ---(Add existing User : Operations)-----------------> Active

Invited  ---(ResendInvite : Admin)---------------------> Invited   (re-entry)
Invited  ---(AcceptInvite : invited User)--------------> Active
Invited  ---(ExpireInvite : System)-------------------> InvitationExpired

InvitationExpired ---(SendNewInvite : Admin)----------> Invited

Invited            ---(Delete : Admin)----------------> Deleted
InvitationExpired  ---(Delete : Admin)----------------> Deleted
Active             ---(Delete : Admin)----------------> Deleted
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An Account User links exactly one [[User]] to exactly one [[Account]]. | All | All | The membership belongs to a single Account and references a single User identity; it is addressable both by its own `AUSR` id and by the (Account, User) pair. |
| BR-002 | At most one non-deleted Account User may exist for a given (User, [[Account]]) pair. | All | All | Attempting to create a second membership for the same User and Account is rejected. After a membership is deleted, the same User may be added again — this produces a new membership with a new `AUSR` id, not a restoration of the old one. |
| BR-003 | An Account User must always be assigned at least one Group. | All | All | Creation requires at least one Group. The last remaining Group cannot be unassigned. Groups define the User's granular permissions within the Account (Preamble Section 2.1a). |
| BR-004 | Creating a membership directly in Active state (bypassing the invitation) is restricted to the Operations Actor; all other permitted Actors create it only in Invited state. | — (creation) | Operations for Active; Vendor/Operations/Client for Invited | The request signals the directly-Active path with `invitation.status` = `Active` and requires the User identity to already exist. Every other creation issues an invitation and starts in Invited. |
| BR-005 | An invitation may be accepted only by the invited User themselves. | Invited | The invited User | An administrator cannot accept an invitation on another User's behalf. The accepting User must also hold the invitation permission. |
| BR-006 | An Actor cannot delete their own Account User membership in the Account they are operating in. | Invited, InvitationExpired, Active | All | Prevents an Actor from removing their own access. Another authorised Actor in the Account must perform the deletion. |
| BR-007 | An invitation expires 7 days after it is issued or last renewed. | Invited | System / Admin | `resend-invite` renews the invitation and resets the 7-day window while still Invited; once expired, `send-new-invite` regenerates it and returns the membership to Invited. |
| BR-008 | Buyer visibility is derived from the assigned Groups, not set directly. | All | All | Values: `All` (sees every [[Buyer]] in the Account), `Selected` (scoped to specific Buyers), `NotApplicable` (Buyer scoping does not apply). When `Selected`, the membership carries the specific Buyers it is scoped to. |
| BR-009 | The [[Module]]s granted through a membership are derived from its Group assignments and are read-only on the Account User. | All | All | Modules are computed from Groups; they cannot be set or edited directly on the membership. |
| BR-010 | The membership `notes` may be updated only by the Operations Actor. | All | Operations | `notes` is carried on the invitation record and is editable by Operations regardless of membership state. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | String | Unique platform identifier for the membership. | Platform | No | Format: AUSR-XXXX-XXXX-XXXX. Immutable. |
| `status` | Enum | Membership state. One of: `Invited`, `InvitationExpired`, `Active`, `Deleted`. | Platform (state machine) | Yes — via transitions only | Not directly writable to an arbitrary value. See Section 3. |
| `user` | Object | Reference to the User identity this membership belongs to. Sub-fields include `id`, `name`, `email`, `status`, `lastLoginAt`. | Platform (from the User) | No | The User is resolved or created at membership creation; the reference is fixed for the life of the membership. See BR-001. |
| `account` | Object | Reference to the Account this membership belongs to. Sub-fields: `id`, `name`, `type`, `status`. | Platform | No | `type` is one of `Client`, `Vendor`, `Operations`. Fixed for the life of the membership. |
| `groups` | Array | The Groups assigned to the User within this Account. Each entry carries `id`, `name`, `isDefault`. | Actor with Access Management permission | Yes | At least one always present — see BR-003. Drives permissions, Modules (BR-009), and Buyer visibility (BR-008). |
| `modules` | Array | The Modules the membership grants, derived from Groups. | Platform (derived) | Yes — via Group changes | Read-only on the membership — see BR-009. Each entry carries `id`, `name`, `settings`. |
| `buyers` | Array | The specific Buyers the membership is scoped to when Buyer visibility is `Selected`. | Platform (derived from Groups) | Yes — via Group changes | Absent when visibility is `All` or `NotApplicable`. See BR-008. Absent from response when null. |
| `invitation` | Object | The invitation record. Sub-fields: `status`, `url` (the accept-invite link), `notes`. | Platform / Operations (`notes`) | Yes | `url` is present while an invitation is outstanding. `notes` is Operations-editable (BR-010). |
| `lastLoginAt` | DateTime | Timestamp of the User's most recent sign-in through this membership. | Platform | Yes — platform-managed | Absent from response when null. |
| `revision` | Integer | Increments on each update. | Platform | N/A | Read-only. |
| `audit` | Object | Audit block. Sub-keys: `created`, `updated`, `invited`, `joined`, `access`, `invitationAcceptedAt`. | Platform | N/A | Omitted by default — request via `select=+audit`. State-specific sub-keys are written when the corresponding event occurs. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Accounts: Account | Parent | Exactly one | The membership belongs to one Account and cannot exist without it. | Yes — the membership is meaningless without its Account. |
| Accounts: User | Parent | Exactly one | The membership references one User identity. A User may hold many Account User memberships across Accounts. | Yes — the membership references a specific User. Deleting the membership does not delete the User; a User may exist with zero memberships (and then holds no Actor permissions). |
| Accounts: User Group | Association | One or more | Groups assigned through the membership define the User's granular permissions in the Account. | Deletion guard — at least one Group is always required (BR-003). |
| Accounts: Module | Association | Zero or more | Modules granted through the membership, derived from its Groups. | No direct dependency — Modules are computed from Groups (BR-009). |
| Accounts: Buyer | Association | Zero or more | When Buyer visibility is `Selected`, the membership is scoped to specific Buyers. | No lifecycle dependency — a scoped Buyer that is removed simply drops from the visibility set. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

> Events that are significant for this object but do not necessarily change its state.

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Invitation renewed | `resend-invite` while Invited, or `send-new-invite` after expiry | Vendor, Operations, Client (own Account) | The invitation code/link is regenerated and its 7-day expiry reset (BR-007). No membership state change on resend (re-entry). |
| Group assignment changed | Assign, unassign, or replace the membership's Groups | Vendor, Operations, Client (own Account) | Recomputes the derived Modules and Buyer visibility (BR-008, BR-009). At least one Group must remain (BR-003). |
| User signed in | The User authenticates through this membership | The User (self) | `lastLoginAt` and the audit `access` timestamp are updated. |
| Notes updated | Operations edits `notes` | Operations | Updates the invitation `notes` (BR-010). No state change. |

### 7.2 Cross-Object State Effects

> Effects this object's events have on *other* objects.

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Invite User (create in Invited) | User | A new [[User]] identity is created if one does not already exist for the supplied email. | Yes — under the creating Actor's token (Invariant 2) | User identity did not already exist | See Accounts: User. |
| Delete membership from Active | User | The User's access to the [[Account]] is revoked and the corresponding user-account link is removed in integrated downstream identity/ERP systems. | Yes — under the deleting Actor's token | Membership was Active at deletion | The User identity itself is not deleted. |

> Deletion of the membership never deletes the User, the Account, or any Group — the platform does not cascade deletions (Invariant 6).

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
- Invited → Invited (resend-invite) is a re-entry and may be repeated without limit while the membership remains Invited.
- Invited → InvitationExpired → Invited (send-new-invite) is reversible: an expired invitation can be regenerated back to Invited, and may cycle again if it expires once more.
- Invited → Active (accept-invite) is **not** reversible — there is no transition from Active back to Invited.
- Active → Deleted is **not** reversible. The same User may subsequently be re-added to the Account, but that creates a new membership (new `AUSR` id), not a restoration of the deleted one (BR-002).

**Deletion:**
An Account User may be deleted by any Actor with Access Management permission in its Account, from the Invited, InvitationExpired, or Active state, provided the Actor is not deleting their own membership (BR-006). Once deleted, it is permanently removed — no longer retrievable via the API. Deletion of an Active membership additionally revokes the [[User]]'s access to the Account (Section 7.2).

**Audit & history requirements:**
The audit block records `created`, `updated`, `invited`, `joined`, `access`, and `invitationAcceptedAt` events, omitted by default and retrievable via `select=+audit`. Audit Records are generated for the membership's creation and its state transitions. No prior-version history of mutable content (Groups, notes) is retained beyond the Audit Trail. A deleted membership is not retrievable via the API in any context (unlike a deleted Accounts: User, which Operations can still retrieve).

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Invitation link is shared or forwarded before acceptance | Any recipient of the link who authenticates as the invited User can accept; the link is single-invitation but time-limited (BR-007). | Client, Vendor | Medium | The invitation `url` grants acceptance for the specific invited User; treat it as sensitive. |
| Invitation not accepted within 7 days | The membership moves to InvitationExpired; the original link no longer accepts. An administrator must `send-new-invite`. | Client, Vendor | Low | Recoverable via BR-007. |
| Administrator adds an existing User directly as Active (Operations) | The User gains access with no invitation email; they may be unaware access was granted. | Operations | Low | Directly-Active creation is intentional and Operations-only (BR-004). |
| Groups assigned grant `All` Buyer visibility unintentionally | The User can see every [[Buyer]] in the [[Account]], not a scoped subset. | Client | Medium | Visibility is derived from Groups (BR-008); misconfigured Groups over-expose Buyer data. |
| Last administrator's membership deleted by another admin | The Account may be left with no Actor able to manage memberships until Operations intervenes. | Client, Operations | Medium | Self-deletion is blocked (BR-006), but a second admin can still remove the last remaining administrator. |
| A User's last membership across all Accounts is deleted | The [[User]] identity persists but holds no Actor permissions anywhere until re-added to an Account. | Client, Vendor | Low | Consistent with Preamble Section 2.1a. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-18 | Stu / canon-generate | Initial draft generated from OpenAPI schema, live STAGING multi-Actor fetch, and platform source research. Documents the invite lifecycle state machine (Invited / Active / InvitationExpired / Deleted), the two creation paths (invite vs. Operations-only directly-Active, confirmed intended), the at-least-one-Group and no-self-delete guards, Group-derived Modules and Buyer visibility, and the 7-day invitation expiry. A deleted membership is confirmed not retrievable via the API by any Actor; no Actor-based field suppression applies (Vendor visibility confirmed by live fetch). |
