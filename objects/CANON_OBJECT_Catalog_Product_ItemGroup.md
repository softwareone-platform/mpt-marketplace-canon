# Object Canon: Item Group

> **Version:** 0.3
> **Owner:** Stu
> **Last Updated:** 2026-03-14
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Item Group

**Parent Object:** Catalog: Product

**Description:**
An Item Group is an organisational container for Items under a Product. It controls how Items are presented and selected during the ordering process — specifically whether a Client can select multiple Items from the group when placing an Order. Item Groups are part of the Product Definition and are scoped to the Product under which they are created.

**Also Known As:**
IGR (API identifier prefix)

---

## 2. Ownership & Visibility

> High-level orientation to Actor authority and visibility over this object.
> State-specific nuances belong in Section 4 (Business Rules).

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
|------------|------------|----------|------------|------------|-------|
| Vendor     | Yes        | Yes      | Yes        | Yes        | Full lifecycle ownership |
| Operations | No         | Yes      | No         | No         | |
| Client     | No         | Yes      | No         | No         | Clients see Item Groups during the ordering process |

---

## 3. State Machine

This object has no state machine. It is created and modified as a unit, with no intermediate states.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
|---------|---------------|---------------------|-------------|-------|
| BR-001 | An Item Group belongs to exactly one Product and cannot be shared across Products. | N/A | All | |
| BR-002 | Exactly one Item Group per Product must be marked as Default. | N/A | All | |
| BR-003 | If a new Item is created without specifying an Item Group, it is automatically assigned to the Default Item Group. | N/A | All | |
| BR-004 | The `multiple` attribute controls whether a Client can select more than one Item from the group when placing an Order. | N/A | All | This constraint is enforced by the platform at Order submission — one of the few platform-enforced constraints outside the Vendor Extension. |
| BR-005 | The `required` attribute controls whether a Client must select at least one Item from the group when placing an Order. | N/A | All | This constraint is enforced by the platform at Order submission — one of the few platform-enforced constraints outside the Vendor Extension. |
| BR-006 | The `displayOrder` attribute controls the sequence in which Item Groups are presented during the ordering process. | N/A | All | |
| BR-007 | Item Group creation, modification, and deletion are not restricted by the state of the parent Product. | N/A | Vendor | Consistent with Template canon BR-021 and Product canon BR-001. |
| BR-008 | The Default Item Group cannot be deleted. To delete a Default Item Group, the Vendor must first designate another Item Group as Default. | N/A | Vendor | Consistent with Default protection pattern established in Template canon BR-004. |
| BR-009 | An Item Group cannot be deleted if it contains Items. All Items must be removed or reassigned before the group can be deleted. | N/A | Vendor | |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Mutable After [State]? | Notes |
|-----------|------|-------------|--------|------------------------|----------------------|-------|
| Name | String | Internal name of the Item Group | Vendor | Yes | N/A | |
| Label | String | Display label shown to Clients during ordering | Vendor | Yes | N/A | |
| Description | String | Descriptive text shown to Clients during ordering | Vendor | Yes | N/A | |
| Display Order | Integer | Controls the sequence in which this group is presented during ordering | Vendor | Yes | N/A | |
| Default | Boolean | Marks this Item Group as the Default for the Product | Vendor | Yes | N/A | Exactly one Item Group per Product must be Default. New Items without an assigned group are automatically added here. |
| Multiple | Boolean | Controls whether a Client can select more than one Item from this group when placing an Order | Vendor | Yes | N/A | |
| Required | Boolean | Controls whether a Client must select at least one Item from this group when placing an Order | Vendor | Yes | N/A | |
| Item Count | Integer | Number of Items currently assigned to this group | System | N/A | N/A | Read-only. Reflects current membership. |
| Revision | Integer | Increments when the Item Group's own attributes change | System | N/A | N/A | Does not increment when child Items are added, modified, or removed. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
|----------------|------------------|-------------|-------------|----------------------|
| Catalog: Product | Parent | Many:1 | An Item Group belongs to exactly one Product. | Yes — Item Group cannot exist without a parent Product. |
| Catalog: Product Item | Child | 1:Many | An Item Group contains a collection of Items. | Yes — an Item Group cannot be deleted while it contains Items. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
|-------|---------|-------------------|---------------------------------|
| Item Group created | Vendor creates Item Group under a Product | Vendor | Item Group becomes available for Item assignment. |
| Default Item Group auto-created | Parent Product is created | Platform | The platform automatically creates one Default Item Group with the following values: Name: "Items", Label: "Items", Display order: 100, Description: "Default item group", Optional: false, Allow multiple: true, Default: true. This ensures the one-and-only-one Default invariant is satisfied from the moment the Product exists. |
| Item Group marked as Default | Vendor sets Default = true | Vendor | Any existing Default Item Group is automatically demoted. |
| Item Group deleted | Vendor deletes Item Group | Vendor | Permanently removed — no longer retrievable via the API. Only permitted when the group contains no Items and is not the Default. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
|-----------------|----------------|--------------------------|------------|-----------|-------|
| Item created without assigned group | Item Group (Default) | Item is automatically assigned to the Default Item Group | Yes | Always — when no group is specified on Item creation | |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Not applicable — this object has no state machine.

**Deletion:**
- Non-Default Item Groups containing no Items may be deleted by the Vendor. Once deleted, permanently removed — no longer retrievable via the API.
- [ ] Soft delete only
- [ ] Deletion not permitted

**Audit & history requirements:**
Not yet defined.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
|----------|--------------------------|---------------|------------|-------|
| Vendor attempts to delete the Default Item Group | Action is blocked. Default Item Group cannot be deleted. | Vendor | N/A | Vendor must first designate another Item Group as Default, then delete the former Default. |
| Vendor attempts to delete an Item Group that contains Items | Action is blocked. Item Group cannot be deleted while it contains Items. | Vendor | N/A | Vendor must first remove or reassign all Items before deletion is permitted. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2026-03-07 | Stu | Initial canon. Derived from JSON and conversation. |
| 0.2 | 2026-03-09 | Stu | Namespace qualification applied to Parent Object and Section 6 relationship references. |
| 0.3 | 2026-03-14 | Stu | Section 7.1: auto-creation event added — platform creates one Default Item Group on Product creation with known default values. |
