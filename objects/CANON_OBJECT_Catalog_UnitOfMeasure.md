# Object Canon: Unit of Measure

> **Version:** 0.2
> **Owner:** Stu
> **Last Updated:** 2026-07-16
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Unit of Measure

**Namespace:** Catalog

**Parent Object:** None — platform-level Catalog reference object. Not scoped to any Product, Vendor, or Account.

**ID Prefix:** UNT (confirmed via observed real object IDs, e.g. `UNT-1593`, `UNT-3691`).

**Description:**
A Unit of Measure is a platform-managed reference object that describes what is being counted or measured when an [[Item]] is ordered. Vendors select a Unit of Measure when creating a Product [[Item]] to communicate the commercial unit of the Item (e.g. User, Licenses, Gigabytes). The set of available Units of Measure is maintained exclusively by Operations. Units of Measure are not Product-scoped — the same unit is available to all Vendors across all Products.

**Also Known As:**
Unit

---

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | No | Yes | No | No | Vendors read the full set when selecting a Unit of Measure during Item creation. |
| Operations | Yes | Yes | Yes | No | Sole manager of the reference set. Creates units and updates their name/description. No Actor can delete a Unit of Measure. |
| Client | No | Yes | No | No | Reads Units of Measure, typically in the context of Item display. |

---

## 3. State Machine

This object has no state machine. A Unit of Measure exists as a persistent platform reference record. It cannot be deleted.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | Units of Measure are platform-level reference objects. They are not scoped to any [[Product]], Vendor, [[Account]], or namespace. The same set is available to all Actors across all Products. | N/A | All | — |
| BR-002 | The set of available Units of Measure is maintained exclusively by Operations. Vendors and Clients cannot create or modify Units of Measure. | N/A | All | — |
| BR-003 | A Unit of Measure cannot be deleted, deactivated, or retired by any Actor, regardless of whether it is in use. | N/A | All | The platform exposes no removal mechanism of any kind — once created, a unit is permanent and always selectable. |
| BR-004 | A Vendor selects a Unit of Measure when creating a Product [[Item]]. The reference may be changed afterwards by updating the Item. | N/A | Vendor | See Catalog: [[Item]] canon (the Item's Unit of Measure is mutable via update). |
| BR-005 | Operations may update the name and description of a Unit of Measure at any time, including while it is in use. There is no rename guard based on usage. | N/A | Operations | Updates propagate immediately to all referencing Items — the Item holds a live reference, not a copy (see Section 9). |
| BR-006 | A Unit of Measure's name is required and globally unique across the platform. | N/A | Operations | Maximum 128 characters; leading/trailing whitespace is rejected. A create or rename to an already-used name is rejected. |
| BR-007 | A Unit of Measure's description is required. | N/A | Operations | Maximum 256 characters; leading/trailing whitespace is rejected. (The OpenAPI schema marks the field nullable, but the platform enforces it as required on both create and update.) |
| BR-008 | `statistics.itemCount` reflects the number of Published Items referencing the unit. It increases when an Item is published and decreases when an Item is unpublished. | N/A | All | Draft and Unpublished Items are not counted; creating or deleting a non-published Item does not change the count. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| name | String | Display name of the Unit of Measure (e.g. User, Licenses, Gigabytes) | Operations | Yes | Required. Globally unique. Maximum 128 characters; no leading/trailing whitespace (see BR-006). |
| description | String | Human-readable explanation of what this unit represents and how it is used commercially | Operations | Yes | Required — see BR-007. Maximum 256 characters. Marked nullable in the schema but enforced as required. |
| revision | Integer | Increments on each update to the Unit of Measure | System | Yes — auto-incremented | Read-only. Starts at 1. |
| statistics.itemCount | Integer | Number of Published Items referencing this Unit of Measure across all Products | System | No — computed | Read-only. Reflects Published Items only (see BR-008). A value of 0 indicates no Published Item currently uses the unit. |
| audit | Object | created and updated events, each with timestamp and Actor attribution | System | No | Read-only. `updated` is populated once the unit has been updated. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Product Item | Reference | One:Many | A Product Item references exactly one Unit of Measure; the reference is validated at Item creation and may be changed by updating the Item. | No — Unit of Measure cannot be deleted, so no orphan risk. The reference is live: name/description updates are reflected on all referencing Items. Publishing/unpublishing an Item adjusts this unit's `itemCount` (BR-008). |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Unit of Measure created | Operations creates a new unit | Operations | Unit becomes available for selection by Vendors when creating Product [[Item]]s. `revision` initialised to 1. |
| Unit of Measure updated | Operations updates name or description | Operations | Updated values are immediately visible on all Product [[Item]]s referencing this unit. `revision` incremented. |

> A Unit of Measure does not publish a message-bus event on create or update — it is not a Notification-subsystem event producer.

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Unit of Measure name/description updated | Product Item | Every referencing Item reflects the updated value at read time | Yes | Always — the Item holds a live reference, not a copy | No Item record is rewritten; the change surfaces through the reference. |

> The reverse effect — an Item's publish/unpublish adjusting this unit's `statistics.itemCount` — is driven by the Item and recorded in BR-008.

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Not applicable — this object has no state machine.

**Deletion:**
Units of Measure cannot be deleted. The platform exposes no delete, deactivate, or retire mechanism (BR-003).

**Audit & history requirements:**
The audit object records the `created` and `updated` events, each with a timestamp and the attributed Actor. The `revision` counter provides a change sequence over the unit's updates. Full attribute history is retained via the platform Audit Trail — see Audit: Audit Record canon (pending canonisation).

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Operations renames a Unit of Measure that is in active use | The rename succeeds with no usage guard. Because the reference is live, every referencing [[Item]] immediately displays the new name. | Vendor, Client | Medium | Operations should exercise care renaming units with a high `itemCount` — a rename silently relabels the unit on all referencing Items across all Products and Vendors. |
| A Unit of Measure is created in error, or becomes obsolete | The unit remains permanently — there is no delete, deactivate, or retire path. It stays selectable by Vendors indefinitely. | Operations | Low | Operations should curate the set carefully at creation time, since units cannot be removed. |
| Vendor cannot find a suitable Unit of Measure for their Item | The Vendor must select the closest available unit or ask Operations to create a new one. Vendors cannot create units. | Vendor | Low | Operations maintains the reference set and can add new units on request. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.2 | 2026-07-16 | Stu / canon-generate | Refresh via live OpenAPI schema (STAGING), live-fetched real object (multi-Actor), and source-code research. ID Prefix corrected (was "None", is UNT — also added to preamble §5.3). **Significant corrections**: the object HAS a `revision` field that increments on update (Section 5 — removes the prior "no revision field" note); `audit` records both `created` and `updated`, not created-only (Section 5, Section 8); `description` is required, not optional (BR-007, corrects the schema-nullable reading); `name` is required, globally unique, and length-limited (BR-006); `statistics.itemCount` counts Published Items and moves on Item publish/unpublish, not on item create/delete (BR-008 — corrects the prior "currently referencing" wording); the Unit of Measure reference on an Item is mutable, not immutable after Item creation (BR-004, corrects prior canon and matches the Catalog: Product Item refresh). Confirmed create/update are Operations-only and no delete mechanism exists (BR-003). Section 7: no message-bus event is published on create/update. Also Known As reduced to "Unit" (UNT moved to ID Prefix). |
| 0.1 | 2026-03-09 | Stu | Initial canon. Derived from PROD JSON sample (13 units). |
