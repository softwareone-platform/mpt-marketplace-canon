# Object Canon: Item Group

> **Version:** 0.4
> **Owner:** Stu
> **Last Updated:** 2026-07-16
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Item Group

**Namespace:** Catalog

**Parent Object:** Catalog: Product

**ID Prefix:** IGR (confirmed via `preamble/PLATFORM_CANON_PREAMBLE.md` §5.3 and observed real object IDs, e.g. `IGR-2873-8874-0001`).

**Description:**
An Item Group is an organisational container for [[Item]]s under a [[Product]]. It governs how Items are grouped and presented for selection during the ordering experience — including whether more than one Item from the group may be selected, and whether a selection from the group is expected. Item Groups are part of the Product Definition and are scoped to the single Product under which they are created. Every Product has exactly one Default Item Group, created automatically with the Product.

**Also Known As:**
None known.

---

## 2. Ownership & Visibility

> High-level orientation to Actor authority and visibility over this object.
> State-specific nuances belong in Section 4 (Business Rules).

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes | Yes | Yes | Yes | Full authoring ownership under the Vendor's own Products. |
| Operations | No | Yes | Yes — Delete only | Yes | Reads all Item Groups; may delete an Item Group (subject to the deletion guards in BR-008/BR-009) but cannot create or update one. |
| Client | No | Yes | No | No | Item Groups are visible to Clients as part of the ordering experience. |

---

## 3. State Machine

This object has no state machine. It is created and modified as a unit, with no intermediate states.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An Item Group belongs to exactly one [[Product]] and cannot be shared across Products. | N/A | All | — |
| BR-002 | Each [[Product]] has exactly one Default Item Group at all times. Marking another Item Group as Default automatically demotes the current one; the Default cannot be un-marked directly. | N/A | Vendor | Follows the Default protection pattern (preamble §3.4). To change the Default, promote another group — which demotes the former Default. |
| BR-003 | Every [[Item]] belongs to exactly one Item Group, specified explicitly when the Item is created. The platform does not assign a group automatically. | N/A | All | An Item creation request that omits a valid Item Group is rejected. Any pre-selection of the Default group is a function of the ordering interface, not a platform rule. |
| BR-004 | The `multiple` attribute expresses whether a Client may select more than one [[Item]] from the group when placing an [[Order]]. | N/A | All | Advisory selection semantics surfaced by the ordering experience (UI / Vendor Extension). Not enforced by the platform core at Order submission. |
| BR-005 | The `required` attribute expresses whether a Client is expected to select at least one [[Item]] from the group when placing an [[Order]]. | N/A | All | Advisory selection semantics surfaced by the ordering experience (UI / Vendor Extension). Not enforced by the platform core at Order submission. |
| BR-006 | The `displayOrder` attribute controls the sequence in which Item Groups are presented during ordering, and must be a positive integer. | N/A | All | Not required to be unique within a Product — two Item Groups may share a `displayOrder`, in which case their relative order is not guaranteed (see Section 9). |
| BR-007 | Item Group creation, modification, and deletion are not restricted by the state of the parent [[Product]]. | N/A | Vendor, Operations | Consistent with [[Product]] canon BR-001. |
| BR-008 | The Default Item Group cannot be deleted. Another Item Group must first be designated as Default (which demotes the former Default) before it can be deleted. | N/A | Vendor, Operations | Deletion guard (preamble §3.5). |
| BR-009 | An Item Group cannot be deleted while it contains [[Item]]s. All Items must be removed or reassigned to another group first. | N/A | Vendor, Operations | Deletion guard (preamble §3.5). |
| BR-010 | Creating an Item Group requires a name, a label, and a positive `displayOrder`. | N/A | Vendor | `description` is optional. `multiple`, `required`, and `default` are booleans that default to false when omitted. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| Name | String | Internal name of the Item Group | Vendor | Yes | Required on creation. |
| Label | String | Display label shown to Clients during ordering | Vendor | Yes | Required on creation. |
| Description | String | Descriptive text shown to Clients during ordering | Vendor | Yes | Optional. Absent from response when null. |
| Display Order | Integer | Controls the sequence in which this group is presented during ordering | Vendor | Yes | Required on creation. Must be a positive integer; not required to be unique (see BR-006). |
| Default | Boolean | Marks this Item Group as the Default for the Product | Vendor | Yes | Exactly one per Product is Default (see BR-002). Setting this true demotes the current Default; the current Default cannot be set false directly. Defaults to false on creation if omitted. |
| Multiple | Boolean | Whether a Client may select more than one Item from this group when ordering | Vendor | Yes | Advisory — see BR-004. Defaults to false on creation if omitted. |
| Required | Boolean | Whether a Client is expected to select at least one Item from this group when ordering | Vendor | Yes | Advisory — see BR-005. Defaults to false on creation if omitted. |
| Item Count | Integer | Number of Items currently assigned to this group | System | No | Read-only. Reflects current membership. |
| Revision | Integer | Increments when the Item Group's own attributes change | System | No | Read-only. |
| Audit | Object | Created and updated events, each with timestamp and Actor attribution | System | No | Read-only. Records created and updated only. Absent sub-keys when the corresponding event has not occurred. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Product | Parent | Many:1 | An Item Group belongs to exactly one Product. | Yes — an Item Group cannot exist without a parent Product, and is removed when its parent Product is deleted (which the platform permits only while the Product is in Draft state). See Catalog: Product canon BR-002. |
| Catalog: Product Item | Child | 1:Many | An Item Group contains a collection of Items. | Yes — an Item Group cannot be deleted while it contains Items (BR-009). Deleting an Item Group does not delete its Items. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Default Item Group auto-created | Parent [[Product]] is created | Platform | The platform automatically creates one Default Item Group with these values: name "Items", label "Items", description "Default item group", display order 100, multiple true, required true, default true. This satisfies the exactly-one-Default invariant from the moment the Product exists. |
| Item Group created | Vendor creates an Item Group under a [[Product]] | Vendor | Item Group becomes available for [[Item]] assignment. Publishes a creation event to the platform notification subsystem (Catalog module). |
| Item Group marked as Default | Vendor sets `default` = true | Vendor | The existing Default Item Group is automatically demoted. Publishes an update event. |
| Item Group updated | Any attribute change | Vendor | Revision incremented. Publishes an update event. |
| Item Group deleted | Vendor or Operations deletes the Item Group | Vendor, Operations | Permanently removed — no longer retrievable via the API. Permitted only when the group is not the Default and contains no Items (BR-008, BR-009). Publishes a deletion event. |

> Item Group publishes events to the platform notification subsystem on creation, update, and deletion. These are available to the Notification subsystem for [[Webhook]] delivery (see preamble §8). The exact message structure is not documented at the PM level.

### 7.2 Cross-Object State Effects

No cross-object state effects. An Item Group event changes no other object's state. (The auto-creation of the Default Item Group is driven by [[Product]] creation and is recorded in 7.1; removal on parent-Product deletion is driven by the Product and documented in Catalog: Product canon — see Section 6.)

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Not applicable — this object has no state machine.

**Deletion:**
A non-Default Item Group containing no Items may be deleted by the Vendor or by Operations. Once deleted, permanently removed — no longer retrievable via the API. Deletion does not cascade to the group's [[Item]]s — a group containing Items cannot be deleted until they are removed or reassigned (BR-009). The Default Item Group cannot be deleted (BR-008).

**Audit & history requirements:**
The Item Group audit object records the created and updated events, each with a timestamp and the attributed Actor. The revision counter provides a change sequence over the group's own attribute updates. Creation, update, and deletion each publish an event to the platform notification subsystem (Catalog module). Full attribute history is retained via the platform Audit Trail — see Audit: Audit Record canon (pending canonisation).

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Vendor or Operations attempts to delete the Default Item Group | The platform blocks the deletion. Another Item Group must first be designated Default. | Vendor, Operations | Low | BR-008. |
| Vendor or Operations attempts to delete an Item Group that contains [[Item]]s | The platform blocks the deletion. Items must be removed or reassigned first. | Vendor, Operations | Low | BR-009. |
| Two Item Groups under the same [[Product]] share a `displayOrder` | The platform permits it. The relative presentation order of the two groups is not guaranteed. | Client, Vendor | Low | `displayOrder` is not required to be unique (BR-006). |
| A Client places an [[Order]] that violates a group's `multiple`/`required` intent | The platform core does not reject the Order on these grounds — the flags are advisory (BR-004/BR-005). Any enforcement depends on the ordering UI or Vendor Extension. | Client | Medium | A misselection is not prevented by the platform core; a Vendor relying on `required`/`multiple` for correctness must enforce it in its own ordering surface. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.4 | 2026-07-16 | Stu / canon-generate | Refresh via live OpenAPI schema (STAGING), live-fetched real object (multi-Actor), and source-code research. ID Prefix corrected (was "None", is IGR). **Significant corrections**: the auto-assignment of a group-less Item to the Default group (former BR-003) is not platform behaviour — an Item requires an explicit Item Group on creation; BR-003 reframed accordingly. `multiple`/`required` are advisory ordering semantics consumed by the UI/Vendor Extension, not enforced by the platform core at Order submission — corrects the prior "one of the few platform-enforced constraints" claim in BR-004/BR-005. Delete is now Vendor or Operations (was Vendor-only) — Section 2 and BR-008/BR-009 actor scope updated. Section 5: required-on-creation fields documented (name, label, positive displayOrder; description optional; multiple/required/default default to false), Audit attribute added, Item Count/Revision marked read-only. Section 6: parent-Product Draft-deletion removal documented. Section 7: Item Group publishes notification-subsystem events on create/update/delete; the former auto-assignment cross-object effect removed. Section 8: audit filled in; deletion (Vendor or Operations) and no-cascade stated. Section 9: duplicate-displayOrder and advisory-flag failure modes added. Self-references corrected from the mislinked `[[Item]] Group` to plain "Item Group"; `[[Item]]` reserved for real Item references. |
| 0.3 | 2026-03-14 | Stu | Section 7.1: auto-creation event added — platform creates one Default Item Group on Product creation with known default values. |
| 0.2 | 2026-03-09 | Stu | Namespace qualification applied to Parent Object and Section 6 relationship references. |
| 0.1 | 2026-03-07 | Stu | Initial canon. Derived from JSON and conversation. |
