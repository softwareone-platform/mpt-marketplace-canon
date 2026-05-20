# Object Canon: Parameter Group

> **Version:** 0.3
> **Owner:** Stu
> **Last Updated:** 2026-03-14
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Parameter Group

**Namespace:** Catalog

**Parent Object:** Catalog: Product

**ID Prefix:** None.

**Description:**
A Parameter Group is an organisational container for Parameters under a Product. It controls how Parameters are presented during the ordering and configuration process. Parameter Groups are part of the Product Definition and are scoped to the Product under which they are created.

**Also Known As:**
PGR (API identifier prefix)

---

---

## 2. Ownership & Visibility

> High-level orientation to Actor authority and visibility over this object.
> State-specific nuances belong in Section 4 (Business Rules).

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes | Yes | Yes | Yes | Full lifecycle ownership |
| Operations | No | Yes | No | No | — |
| Client | No | Yes | No | No | Clients see Parameter Groups during the ordering and configuration process |

---

## 3. State Machine

This object has no state machine. It is created and modified as a unit, with no intermediate states.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Parameter Group belongs to exactly one Product and cannot be shared across Products. | N/A | All | — |
| BR-002 | Exactly one Parameter Group per Product must be marked as Default. | N/A | All | — |
| BR-003 | If a new Parameter is created without specifying a Parameter Group, it is automatically assigned to the Default Parameter Group. | N/A | All | — |
| BR-004 | The `displayOrder` attribute controls the sequence in which Parameter Groups are presented during the ordering and configuration process. | N/A | All | — |
| BR-005 | Parameter Group creation, modification, and deletion are not restricted by the state of the parent Product. | N/A | Vendor | Consistent with Product canon BR-001 and Item Group canon BR-007. |
| BR-006 | The Default Parameter Group cannot be deleted. To delete a Default Parameter Group, the Vendor must first designate another Parameter Group as Default. | N/A | Vendor | Consistent with Default protection pattern in Template canon BR-004 and Item Group canon BR-008. |
| BR-007 | A Parameter Group cannot be deleted if it contains Parameters. All Parameters must be removed or reassigned before the group can be deleted. | N/A | Vendor | Consistent with Item Group canon BR-009. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| Name | String | Internal name of the Parameter Group | Vendor | Yes | — |
| Label | String | Display label shown to users during ordering and configuration | Vendor | Yes | — |
| Description | String | Descriptive text shown to users during ordering and configuration | Vendor | Yes | — |
| Display Order | Integer | Controls the sequence in which this group is presented | Vendor | Yes | — |
| Default | Boolean | Marks this Parameter Group as the Default for the Product | Vendor | Yes | Exactly one Parameter Group per Product must be Default. New Parameters without an assigned group are automatically added here. |
| Parameter Count | Integer | Number of Parameters currently assigned to this group | System | N/A | Read-only. Reflects current membership. |
| Revision | Integer | Increments when the Parameter Group's own attributes change | System | N/A | Does not increment when child Parameters are added, modified, or removed. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Product | Parent | Many:1 | A Parameter Group belongs to exactly one Product. | Yes — Parameter Group cannot exist without a parent Product. |
| Catalog: Product Parameter | Child | 1:Many | A Parameter Group contains a collection of Parameters. | Yes — a Parameter Group cannot be deleted while it contains Parameters. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Parameter Group created | Vendor creates Parameter Group under a Product | Vendor | Parameter Group becomes available for Parameter assignment. |
| Default Parameter Group auto-created | Parent Product is created | Platform | The platform automatically creates one Default Parameter Group with the following values: Name: "Parameters", Label: "Parameters", Display order: 100, Description: "Default parameter group", Default: true. This ensures the one-and-only-one Default invariant is satisfied from the moment the Product exists. |
| Parameter Group marked as Default | Vendor sets Default = true | Vendor | Any existing Default Parameter Group is automatically demoted. |
| Parameter Group deleted | Vendor deletes Parameter Group | Vendor | Permanently removed — no longer retrievable via the API. Only permitted when the group contains no Parameters and is not the Default. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Parameter created without assigned group | Parameter Group (Default) | Parameter is automatically assigned to the Default Parameter Group | Yes | Always — when no group is specified on Parameter creation | — |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Not applicable — this object has no state machine.

**Deletion:**
- Non-Default Parameter Groups containing no Parameters may be deleted by the Vendor. Once deleted, permanently removed — no longer retrievable via the API.
- [ ] Soft delete only
- [ ] Deletion not permitted

**Audit & history requirements:**
Not yet defined.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Vendor attempts to delete the Default Parameter Group | Action is blocked. Default Parameter Group cannot be deleted. | Vendor | N/A | Vendor must first designate another Parameter Group as Default, then delete the former Default. |
| Vendor attempts to delete a Parameter Group that contains Parameters | Action is blocked. Parameter Group cannot be deleted while it contains Parameters. | Vendor | N/A | Vendor must first remove or reassign all Parameters before deletion is permitted. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-03-07 | Stu | Initial canon. Derived from JSON and conversation. |
| 0.2 | 2026-03-09 | Stu | Namespace qualification applied to Parent Object and Section 6 relationship references. |
| 0.3 | 2026-03-14 | Stu | Section 7.1: auto-creation event added — platform creates one Default Parameter Group on Product creation with known default values. |
