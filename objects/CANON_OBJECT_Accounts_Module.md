# Object Canon: Module

> **Version:** 0.2
> **Owner:** Stu
> **Last Updated:** 2026-07-19
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Module

**Namespace:** Accounts

**Parent Object:** None — top-level object.

**ID Prefix:** MOD

**Description:**
A Module is a platform-defined functional area of the Marketplace — for example the Marketplace storefront, Access Management, or Billing — that a permission set grants or withholds access to. Modules are the catalog of access scopes that [[User Group]]s and API Token permission sets reference when they are configured, and each Module declares which account types it applies to and how it may be enabled. Modules are reference data maintained by the platform itself: no Actor creates, edits, or deletes them through the API, and they are introduced or changed only through platform releases. A Module exists so that granular access within an [[Account]] can be described in terms of stable, named capabilities rather than ad-hoc permission flags.

**Also Known As:**
None known.

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor     | No         | No       | No         | No         | A read request returns 403 — the module catalog is not exposed to the Vendor Actor. |
| Operations | No         | Yes      | No         | No         | Read-only, and only for a User operating in an Operations Account that holds the platform account-management permission. |
| Client     | No         | No       | No         | No         | A read request returns 403 — the module catalog is not exposed to the Client Actor. |

> No Actor can create, update, or delete a Module. The object is platform-managed reference data exposed through GET endpoints only (see BR-001). The schema's field-level access metadata lists all three Actors, but endpoint authorization restricts read access to Operations.

---

## 3. State Machine

This object has no state machine. It is created and modified as a unit, with no intermediate states. Modules are seeded and maintained by the platform; their availability to a permission set is governed by their attributes (`accountTypes`, `settings.default`, `settings.configurable`) rather than by any lifecycle state — see Section 4.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Module is platform-managed reference data. It cannot be created, updated, or deleted by any Actor through the API. | N/A | All | Only GET (list and get-by-id) endpoints exist. Module records are introduced and changed through platform releases; the `audit.created.by` identity is the platform itself, not an Actor. |
| BR-002 | A Module is readable only by the Operations Actor, and only when the requesting [[User]] (or Token) holds the platform account-management permission. | N/A | Operations | Vendor and Client read requests are rejected with 403. |
| BR-003 | A Module's `accountTypes` declares which account types the Module applies to. A Module may only be referenced by a [[User Group]] or [[API Token]] permission set within an Account whose type is listed in the Module's `accountTypes`. | N/A | Operations | Observed values: `Vendor`, `Client`, `Operations`. |
| BR-004 | A Module with `settings.default` true and `settings.configurable` false is mandatory: it is present in the permission set of every applicable Account and cannot be removed. | N/A | Operations | Enforced when a permission set for an applicable account type is configured. |
| BR-005 | A Module with `settings.default` false and `settings.configurable` false cannot be added to a permission set. | N/A | Operations | Such a Module is neither enabled by default nor selectable. |
| BR-006 | A Module with `settings.configurable` true is optional: a permission set may include or omit it. `settings.default` determines whether it is included by default. | N/A | Operations | — |
| BR-007 | `settings.eligibility.multi` and `settings.eligibility.single` declare whether a Module is usable in multi-account and single-account contexts respectively. | N/A | Operations | `settings.sharedAccount` is deprecated and superseded by `settings.eligibility.multi`. |
| BR-008 | A Module declares its supported [[Buyer]]-visibility scope, which constrains the buyer scope a referencing permission set may choose: not applicable (no buyer scoping), selected buyers only, all buyers, or both. | N/A | Operations | Surfaced via `filters.group.buyers` with values `selected` (specifically selected Buyers) and `all` (all Buyers); absent for Modules that do not support buyer scoping. A permission set's buyer scope is validated against the aggregate of its Modules' declared scopes. |
| BR-009 | A change to a Module's gating attributes (e.g. `accountTypes`) is not retroactively enforced on permission sets that already reference it. An existing reference is re-validated only when the referencing User Group or API Token is next saved. | N/A | Operations | Removing a Module from an Account's Default permission group additionally cascades the removal to that Account's non-default groups. |

> **Guidance on business rules:** BR-003 through BR-008 describe how a Module's attributes constrain the permission sets that reference it. The constraint is enforced when the referencing object (a User Group or API Token permission set) is configured, not on the Module itself — the Module is inert reference data.

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | string | Platform identifier, prefix `MOD`. | Platform | No (platform-managed) | — |
| `revision` | integer | Monotonic revision counter for the Module record. | Platform | No (platform-managed) | — |
| `name` | string | Human-readable Module name. | Platform | No (platform-managed) | e.g. `Marketplace`, `Invoices`. |
| `code` | string | Stable machine code for the Module. | Platform | No (platform-managed) | e.g. `new-marketplace`, `access-management`. |
| `description` | string | Human-readable description of the Module's purpose. | Platform | No (platform-managed) | — |
| `accountTypes` | array of string | Account types the Module applies to (see BR-003). | Platform | No (platform-managed) | Values are title-case: `Vendor`, `Client`, `Operations` (the response form; the schema example's lower-case is illustrative only). |
| `settings.configurable` | boolean | Whether the Module can be optionally included in a permission set (see BR-006). | Platform | No (platform-managed) | — |
| `settings.default` | boolean | Whether the Module is enabled by default in a permission set (see BR-004/BR-006). | Platform | No (platform-managed) | — |
| `settings.paid` | boolean | Whether the Module is designated as paid. | Platform | No (platform-managed) | — |
| `settings.type` | array of string | Module classification. | Platform | No (platform-managed) | Observed values: `new`, `legacy`. |
| `settings.obsolete` | boolean | Whether the Module is retained for compatibility but no longer current. | Platform | No (platform-managed) | — |
| `settings.eligibility.multi` | boolean | Whether the Module is usable in a multi-account context (see BR-007). | Platform | No (platform-managed) | — |
| `settings.eligibility.single` | boolean | Whether the Module is usable in a single-account context (see BR-007). | Platform | No (platform-managed) | — |
| `settings.sharedAccount` | boolean | Deprecated. | Platform | No (platform-managed) | Superseded by `settings.eligibility.multi`. |
| `filters.group.buyers` | array of string | Buyer-scope options for a permission set (see BR-008). | Platform | No (platform-managed) | Values `selected`, `all`. Absent from response when null. |
| `audit` | object | Creation/modification audit block. | Platform | No (platform-managed) | Omitted by default — request via `select=+audit`. |

> All Module attributes are set by the platform and are not mutable by any Actor through the API (see BR-001). This object has no state, so there is no state-specific mutability column.

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Accounts: Account | Association | Module (many) ↔ Account (many) | An Account's type determines which Modules are available to its permission sets; `accountTypes` on the Module is the gating attribute. | No cascade. Modules are not deleted when an Account is deleted. |
| Accounts: User Group | Association | Module (many) ↔ User Group (many) | A User Group's permission set references the Modules it grants access to, subject to the Module's `accountTypes`, `default`, and `configurable` attributes. | No cascade. A referenced Module is not affected by User Group deletion. |
| Accounts: API Token | Association | Module (many) ↔ API Token (many) | An API Token's permission set references Modules in the same way as a User Group. | No cascade. A referenced Module is not affected by API Token deletion. |

> Modules are inert reference data. They hold no reference to any other object; the referencing direction is always from a permission set (User Group or API Token) to the Module.

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

> Events that are significant for this object but do not necessarily change its state.

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| — | — | — | No Actor-driven events. Modules are seeded and changed only through platform releases; there is no API surface that emits a Module lifecycle event. |

### 7.2 Cross-Object State Effects

> Effects this object's events have on *other* objects.

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Platform introduces a new mandatory Module | Account | Default permission group for each applicable Account is recalculated to include the new mandatory Module. | Yes (platform token context, per Invariant 2) | Triggered by a platform release, not by any Actor action. Applies only to Modules that are default and non-configurable. | The platform-release mechanism that seeds and changes Modules is outside the Actor-facing API surface. |

> **Guidance:** The only cross-object effect is platform-initiated, not Actor-initiated. No Module event deletes any other object.

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
This object has no state machine, so there are no reversible transitions.

**Deletion:**
A Module cannot be deleted by any Actor in any state. It is platform-managed reference data exposed through read-only endpoints. Whether the platform itself retires a Module (and if so, whether it is removed or flagged via `settings.obsolete`) is a platform-release concern outside the API surface.

**Audit & history requirements:**
Each Module carries an `audit` block recording creation (and any modification) with a timestamp and the acting identity, which for Modules is the platform itself. The `audit` block is omitted from responses by default and retrievable via `select=+audit`. No claim is made about retention of prior Module field values beyond the audit block.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| A Vendor or Client integration attempts to read the module catalog. | Request is rejected with 403; the catalog is never returned to these Actors. | Vendor, Client | Low | The module catalog is an Operations-only surface (see BR-002). |
| The platform changes a Module's `accountTypes` to exclude an account type that already has permission sets referencing the Module. | The change is not retroactively enforced; the existing reference persists until the referencing [[User Group]] or API Token is next saved, at which point it is re-validated. | Operations | Medium | See BR-009. A removal from an Account's Default group additionally cascades to its non-default groups. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

> **Order newest-first.** The most recent version is the top data row and the oldest is at the bottom.

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.2 | 2026-07-19 | Stu / canon-maintenance | Wikilinked the now-canonised `[[API Token]]` (BR-003) and `[[User]]` (BR-002), and removed the stale "User Group and API Token not yet canonised" notes (BR-003, BR-009, Section 6). No behavioural change. |
| 0.1 | 2026-07-18 | Stu / canon-generate-batch | Initial draft from OpenAPI schema, live STAGING fetch (Operations; Vendor and Client returned 403), and platform source research. Documents Module as read-only, platform-managed reference data governing User Group and API Token permission sets. `accountTypes` recorded as title-case (STAGING matches PROD; Modules are stable). Buyer-visibility capability (BR-008) and non-retroactive gating-change behaviour (BR-009) confirmed from source. Cross-links to User Group bracketed at promotion; the API Token cross-link is pending its canonisation. |
</content>
</invoke>
