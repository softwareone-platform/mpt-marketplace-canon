# Object Canon: User Group

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-18
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** User Group

**Namespace:** Accounts

**Parent Object:** Accounts: Account

**ID Prefix:** UGR

**Description:**
A User Group is a named permission set within a single [[Account]] that grants its members access to a specific selection of platform [[Module]]s. It is the granular half of the platform's permission model described in preamble §2.1a — Account type sets the broad Actor profile, while the User Group determines which platform features (Marketplace, Access management, Billing, and so on) a member can use within that Account. Groups are created and maintained by an Actor with the appropriate access-management permission in the Account; members are assigned to groups from the [[Account User]] side. Every Account has one system-provisioned Default group (named "Administrators") that grants the account's full module set.

**Also Known As:**
Group; Permission Group; Access Group.

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor     | Yes | Yes | Yes | Conditional | Only within Accounts the Actor operates in, subject to holding the relevant access-management permission. The Default group cannot be created or deleted. Delete requires no assigned members (BR-005). |
| Operations | Yes | Yes | Yes | Conditional | Same scope as above. Modifying the Default group's module grant additionally requires the Account management module permission (BR-008). |
| Client     | Yes | Yes | Yes | Conditional | Same scope as above. |

> No field-level Actor suppression applies to this object — all fields are visible to Vendor, Operations, and Client alike.

---

## 3. State Machine

This object has no state machine. It is created and modified as a unit, with no intermediate states. A User Group's availability is not governed by a lifecycle state; it exists from creation until deletion and is governed instead by its Default designation (BR-002/BR-004) and the deletion guards in Section 4. There is no enable/disable or publish concept for a User Group.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A User Group belongs to exactly one [[Account]], fixed at creation. | N/A | All | The owning Account cannot be reassigned after creation. |
| BR-002 | Each Account has exactly one Default User Group, provisioned automatically when the Account is created. | N/A | All | Named "Administrators" and described "Manages administrative tasks and resources within an organization." by default; grants the Account's full available module set. Realises the Default-protection pattern (preamble §3.4). |
| BR-003 | The Default User Group cannot be deleted. | N/A | All | Deletion guard (preamble §3.5). |
| BR-004 | The Default designation (`isDefault`) is fixed at Account provisioning: it is immutable and non-transferable — a group's `isDefault` cannot be changed, no Default group can be created through the API, and Default status cannot be moved to another group. | N/A | All | Only non-default groups are creatable via the API. This is intentionally stricter than preamble §3.4's demote-to-reassign sub-rule — for a User Group, Default status never moves once provisioned. |
| BR-005 | A User Group cannot be deleted while it has members ([[User]]s) assigned. | N/A | All | Deletion guard (preamble §3.5). Members must first be removed from the group (managed from the Account User side). |
| BR-006 | A non-default group's [[Module]]s must be a subset of the Default group's Modules. | N/A | All | A non-default group can never grant a Module the Default (Administrators) group does not itself hold. |
| BR-007 | The Default group's Modules must be within the Account type's available Modules; mandatory Modules cannot be removed and forbidden Modules cannot be added. | N/A | All | Mandatory = enabled-by-default and non-configurable; forbidden = not-enabled-by-default and non-configurable. Configurable Modules may be freely added or removed. |
| BR-008 | Modifying the Default group's Module grant requires the Account management module permission in that Account. | N/A | All | Other edits (name, description, logo, and any non-default group's Modules) require only the account's access-management permission. |
| BR-009 | Extension scope can be configured only on non-default groups. | N/A | All | The Default group's extension scope is always "all extensions" and cannot be narrowed. |
| BR-010 | A group's selected Extensions must be installed on the Account. | N/A | All | Selecting an extension not installed on the Account is rejected. |
| BR-011 | Buyer-visibility scope applies only to Modules that support it; when scoped to selected [[Buyer]]s, at least one Buyer must be listed. | N/A | All | Modules that require all-buyer visibility force an "all buyers" scope; Modules with no buyer visibility force a not-applicable scope. |
| BR-012 | Removing a Module from the Default group automatically removes that Module from every non-default group that held it. | N/A | All (automated) | See Section 7.2. Executes under a platform service context (preamble Invariant 2). |
| BR-013 | There is no minimum-Module-count constraint on a non-default User Group; it may be created or updated with zero Modules, granting its members no module access. | N/A | All | The OpenAPI "at least one module" description is not enforced by validation. The Default group is effectively never empty, because mandatory (default and non-configurable) Modules are always retained (BR-007). |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| id | string | Platform identifier, `UGR-NNNN-NNNN`. | System | No | — |
| name | string | Human-readable group name. | Actor (create/update) | Yes | Required; bounded maximum length. |
| description | string | Free-text description of the group's purpose. | Actor (create/update) | Yes | Optional; bounded maximum length. Absent from response when null. |
| logo | string | URL of the group's display logo. | Actor (create/update) | Yes | Optional plain URL string (not the `/icon` upload pattern of preamble §9). Absent from response when null. |
| isDefault | boolean | Whether this is the Account's Default (Administrators) group. | System | No | Set only by system provisioning; see BR-002/BR-004. |
| account | reference | The owning Account. | Actor (create) | No | Summary reference (id, name, type, status). See BR-001. |
| modules | collection | The Modules this group grants access to. | Actor (create/update) | Yes | Referenced summary collection. Constrained by BR-006/BR-007. |
| users | collection | The members currently assigned to this group. | System (derived) | No (via this endpoint) | Read-only reverse view; membership is changed from the Account User side, not by writing this field. |
| buyers | collection | Buyer-visibility scope for buyer-aware Modules. | Actor (create/update) | Yes | Absent from response when not applicable. See BR-011. |
| extensions | collection | Extension scope (non-default groups only). | Actor (create/update) | Yes | Absent from response when null/all. See BR-009/BR-010. |
| revision | integer | Monotonic revision counter. | System | Yes | Increments on each update. |
| audit | object | Created/updated event metadata (at / by). | System | No | Automated platform updates are attributed to a platform service context. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Accounts: Account | Parent | N:1 | Every User Group belongs to exactly one Account and cannot exist without it. | Yes — a group is scoped to its Account for its whole life. |
| Accounts: Module | Association | N:M | A group grants a selected subset of the platform Modules available to its Account. | No — Modules are platform-defined; a group references them. |
| Accounts: User | Association | N:M | Users are assigned to groups to receive the group's Module permissions; the group's member list is the reverse view. | No — a deletion guard prevents deleting a group with assigned members (BR-005). |
| Accounts: Account User | Association | N:M | The Account-scoped membership through which a User is placed into a group; group assignment is managed on this object. | No — assignments are edited from the Account User side. |
| Accounts: Buyer | Association | N:M | Buyer-visibility scope may reference specific Buyers for buyer-aware Modules. | No — see Section 9 for stale-reference risk. |

> The platform Extension objects referenced by `extensions` are not yet canonised.

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

> Events that are significant for this object but do not necessarily change its state.

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Module grant changed | An Actor updates the group's Modules | Vendor, Operations, Client (with access) | Recalculates the group's buyer-visibility scope to remain valid for the new Module set; for the Default group, propagates the change to non-default groups (see 7.2). |
| Buyer scope changed | An Actor updates the group's buyer scope, or a Module change forces recalculation | Vendor, Operations, Client (with access) | Group's buyer-visibility scope updated. |
| Extension scope changed | An Actor updates a non-default group's Extensions | Vendor, Operations, Client (with access) | Group's extension scope updated. |

### 7.2 Cross-Object State Effects

> Effects this object's events have on *other* objects.

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Module removed from the Default group | Accounts: User Group (non-default) | The removed Module is stripped from every non-default group that held it | Yes | The Module was present in the non-default group | Runs under a platform service context (preamble Invariant 2). Buyer visibility on affected groups is recalculated. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
This object has no state machine, so there are no state transitions to reverse. Attribute edits (name, description, logo, Modules, buyer scope, extension scope) are freely re-editable within the constraints of Section 4.

**Deletion:**
A non-default User Group may be deleted by an Actor with the appropriate access-management permission in the [[Account]] when the group has no members (Users) assigned (BR-005). Once deleted, it is permanently removed — no longer retrievable via the API. The Default (Administrators) group cannot be deleted in any circumstance (BR-003). The platform never cascades deletions (preamble Invariant 6): deleting a group does not delete its referenced Modules, Buyers, or member Users.

**Audit & history requirements:**
Created and updated events are captured in the object's audit metadata (timestamp and acting identity). Automated platform updates — such as the Module cascade in Section 7.2 — are attributed to a platform service context rather than a human Actor (preamble Invariant 2). No retention of prior attribute values beyond the platform Audit Trail is claimed by this canon.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| A [[Module]] is removed from the Default (Administrators) group | The Module is silently stripped from every non-default group that held it, revoking that access for all their members | Client, Vendor, Operations | Medium | Broad, non-obvious permission loss from a single Default-group edit (BR-012). |
| A group's buyer scope references a [[Buyer]] that is later removed | The scope entry becomes a stale reference to a Buyer no longer present | Client | Low | No cascade; the platform does not repair the reference automatically. |
| Many overlapping non-default groups grant subtly different Module subsets | All groups persist; effective permissions are the union of a member's groups | Client, Vendor, Operations | Low | Permissive by default (preamble §3.1); misconfiguration is the authoring Actor's responsibility. |
| A non-default group is left with no Modules | The group persists but grants no access to its members | Client, Vendor, Operations | Low | Permitted — there is no minimum-Module-count validation (BR-013). |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-18 | Stu / canon-generate | Initial draft generated from OpenAPI schema, live STAGING fetch (Operations/Client), and platform source research. Documents the no-state-machine CRUD model, the Default (Administrators) protection pattern and its intended non-transferability (stricter than preamble §3.4), module-subset and mandatory/forbidden-module rules, no minimum-Module-count constraint on non-default groups (BR-013), buyer and extension scoping, the no-assigned-members deletion guard, and the Default-group module cascade to non-default groups. |
