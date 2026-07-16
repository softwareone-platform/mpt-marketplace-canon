# Object Canon: Parameter Group

> **Version:** 0.5
> **Owner:** Stu
> **Last Updated:** 2026-07-15
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Parameter Group

**Namespace:** Catalog

**Parent Object:** Catalog: Product

**ID Prefix:** PGR

**Description:**
A Parameter Group is an organisational container for [[Parameter]]s under a [[Product]]. It controls how Parameters are presented during the ordering and configuration process. Parameter Groups are part of the Product Definition and are scoped to the Product under which they are created.

**Also Known As:**
None known.

---

## 2. Ownership & Visibility

> High-level orientation to Actor authority and visibility over this object.
> State-specific nuances belong in Section 4 (Business Rules).

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes | Yes | Yes | Yes | Full lifecycle ownership. No field suppression relative to Operations. |
| Operations | No | Yes | No | No | — |
| Client | No | Yes | No | No | Clients see Parameter Groups during the ordering and configuration process. No field suppression. |

---

## 3. State Machine

This object has no state machine. It is created and modified as a unit, with no intermediate states.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Parameter Group belongs to exactly one [[Product]] and cannot be shared across Products. | N/A | All | — |
| BR-002 | Exactly one Parameter Group per [[Product]] must be marked as Default. | N/A | All | — |
| BR-002a | A Parameter Group cannot be directly un-marked as Default. The only way to change which group is Default is to mark a different group as Default, which automatically demotes the current one. | N/A | Vendor | Same pattern as [[Parameter]] canon BR-005a and [[Template]] canon BR-005a. |
| BR-003 | A [[Parameter]] is optional on most Parameter Groups — see [[Parameter]] canon BR-005 for when a Group is required vs. optional at Parameter creation. | N/A | All | There is no automatic assignment of ungrouped Parameters to the Default Group. |
| BR-004 | The `displayOrder` attribute controls the sequence in which Parameter Groups are presented during the ordering and configuration process. Two Parameter Groups on the same Product cannot share a `displayOrder` value. | N/A | All | Enforced at creation and update — a conflicting value is rejected. |
| BR-005 | Parameter Group creation, modification, and deletion are not restricted by the state of the parent [[Product]]. | N/A | Vendor | Consistent with [[Product]] canon BR-001 and [[Item Group]] canon BR-007. |
| BR-006 | The Default Parameter Group cannot be deleted. To delete a Default Parameter Group, the Vendor must first designate another Parameter Group as Default. | N/A | Vendor | Consistent with Default protection pattern in [[Template]] canon BR-004 and [[Item Group]] canon BR-008. |
| BR-007 | A Parameter Group cannot be deleted if it contains [[Parameter]]s. All Parameters must be removed or reassigned before the group can be deleted. | N/A | Vendor | Consistent with [[Item Group]] canon BR-009. |
| BR-008 | Name, Label, and Display Order are required at creation; Description is optional. | N/A | Vendor | The Default flag is also always supplied at creation (defaults are the platform's choice, not the Vendor's — see Section 7.1 for the auto-created Default Group). |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| Name | String | Internal name of the Parameter Group | Vendor | Yes | Required on creation. |
| Label | String | Display label shown to users during ordering and configuration | Vendor | Yes | Required on creation. |
| Description | String | Descriptive text shown to users during ordering and configuration | Vendor | Yes | Optional. Nullable. |
| Display Order | Integer | Controls the sequence in which this group is presented | Vendor | Yes | Required on creation. Must be unique among a Product's Parameter Groups — see BR-004. |
| Default | Boolean | Marks this Parameter Group as the Default for the Product | Vendor | Yes | Exactly one Parameter Group per Product must be Default. Not automatically assigned to new Parameters — see BR-003. Cannot be directly unset — see BR-002a. |
| Parameter Count | Integer | Number of Parameters currently assigned to this group | System | N/A | Read-only. A maintained counter updated whenever a Parameter is added to, removed from, or moved out of this group — not computed live at read time. |
| Product | Object (reference: id, name, icon, revision, externalIds, status) | Reference to the parent Product | System | No | Set at creation. |
| Revision | Integer | Increments when the Parameter Group's own attributes change | System | N/A | Does not increment when child Parameters are added, modified, or removed. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Product | Parent | Many:1 | A Parameter Group belongs to exactly one Product. | Yes — cascade-deleted if the parent Product is deleted while still in Draft state, regardless of whether the group is empty or Default. Products cannot be deleted once they leave Draft. |
| Catalog: Product Parameter | Child | 1:Many (optional) | A Parameter Group contains a collection of Parameters. | Yes — a Parameter Group cannot be deleted through its own endpoint while it contains Parameters (BR-007); this guard does not apply when the parent Product itself is deleted. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Parameter Group created | Vendor creates Parameter Group under a [[Product]] | Vendor | Parameter Group becomes available for Parameter assignment. |
| Default Parameter Group auto-created | Parent [[Product]] is created | Platform | The platform automatically creates one Default Parameter Group with the following values: Name: "Parameters", Label: "Parameters", Display order: 100, Description: "Default parameter group", Default: true. This ensures the one-and-only-one Default invariant is satisfied from the moment the Product exists. |
| Parameter Group marked as Default | Vendor sets Default = true | Vendor | Any existing Default Parameter Group is automatically demoted. |
| Parameter Group deleted | Vendor deletes Parameter Group | Vendor | Soft delete — permanently removed, no longer retrievable via the API. Only permitted when the group contains no Parameters and is not the Default. |
| Parent Product deleted (Draft state only) | Vendor deletes the parent [[Product]] | Vendor | All of the Product's Parameter Groups are soft-deleted along with it — including the Default group and groups that still contain Parameters. The normal deletion guards (BR-006, BR-007) do not apply in this case. |

### 7.2 Cross-Object State Effects

No cross-object state effects flow from Parameter Group events to other platform objects. Parameter creation without a Group does not touch or affect the Default Parameter Group in any way — see [[Parameter]] canon BR-003.

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Not applicable — this object has no state machine.

**Deletion:**
Parameter Groups are soft-deleted only. Once deleted, a Parameter Group is no longer visible in normal API responses. Deletion is permitted, subject to two guards: the group must not be the Default, and it must contain no Parameters (see BR-006, BR-007) — except when deletion is a side effect of the parent Product being deleted while in Draft state, which bypasses both guards.

**Audit & history requirements:**
Not yet defined.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Vendor attempts to delete the Default Parameter Group | Action is blocked. Default Parameter Group cannot be deleted. | Vendor | N/A | Vendor must first designate another Parameter Group as Default, then delete the former Default. |
| Vendor attempts to delete a Parameter Group that contains [[Parameter]]s | Action is blocked. Parameter Group cannot be deleted while it contains Parameters. | Vendor | N/A | Vendor must first remove or reassign all Parameters before deletion is permitted. |
| A [[Product]] has only one Parameter Group, and it is the Default | That group can never be deleted through the Parameter Group's own delete action — even after removing all its Parameters, there is no other group to promote as Default, so the Default guard alone still blocks it. | Vendor | Low | The only way to remove it is to delete the entire parent [[Product]] while still in Draft state, which removes all of the Product's Parameter Groups together. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.5 | 2026-07-15 | Stu / canon-generate | Full refresh via live OpenAPI schema, one live-fetched real object (STAGING, all Actors — no suppression found), and source-code research. ID Prefix corrected (was "None", is PGR) and moved out of Also Known As. **Significant additions/corrections**: Section 8's previously-unresolved deletion-permanence question is now confirmed — deletion is soft-delete only (row retained, excluded from queries), matching the platform-wide pattern. New BR-002a: a Default Parameter Group cannot be directly un-marked, only demoted by promoting another (same pattern already documented for Parameter and Template). New BR-004 detail and BR-008: Display Order must be unique per Product (previously undocumented, DB-enforced) and Name/Label/Display Order are genuinely required at creation (the live OpenAPI schema's missing `required` array was a spec-generation gap, not real optionality). Parameter Count's description corrected — it's a maintained counter, not a live-computed value. New Product attribute documented. Section 6/7 now document that deleting the parent Product in Draft state cascade-deletes all of its Parameter Groups, bypassing the Default/non-empty guards — not previously documented. New failure mode: a Product's sole Default Parameter Group can never be deleted through its own endpoint, only by deleting the whole Product. |
| 0.4 | 2026-07-15 | Stu / canon-generate | Corrected BR-003, the Default attribute, and Section 7.2 — a Parameter created without a Group is not automatically assigned to the Default Group; it may remain groupless. A Group is only required at creation for Agreement-scoped Order-phase and Order-scoped Parameters. Surfaced during the Catalog: Product Parameter canon refresh. |
| 0.3 | 2026-03-14 | Stu | Section 7.1: auto-creation event added — platform creates one Default Parameter Group on Product creation with known default values. |
| 0.2 | 2026-03-09 | Stu | Namespace qualification applied to Parent Object and Section 6 relationship references. |
| 0.1 | 2026-03-07 | Stu | Initial canon. Derived from JSON and conversation. |
