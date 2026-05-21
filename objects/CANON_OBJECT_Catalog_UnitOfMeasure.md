# Object Canon: Unit of Measure

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-03-09
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Unit of Measure

**Namespace:** Catalog

**Parent Object:** None — platform-level Catalog reference object. Not scoped to any Product, Vendor, or Account.

**ID Prefix:** None.

**Description:**
A Unit of Measure is a platform-managed reference object that describes what is being counted or measured when an Item is ordered. Vendors select a Unit of Measure when creating a Product Item to communicate the commercial unit of the Item (e.g. User, License, Gigabytes). The set of available Units of Measure is fixed and maintained exclusively by Operations. Units of Measure are not Product-scoped — the same unit is available to all Vendors across all Products.

---

**Also Known As:**
UNT (API identifier prefix); Unit

---

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | No | Yes | No | No | Vendors read the full list when selecting a Unit of Measure during Item creation. |
| Operations | Yes | Yes | Yes | No | Full management of the reference set. Units of Measure cannot be deleted. |
| Client | No | Yes | No | No | Clients can read Units of Measure. Typically encountered in the context of Item display. |

---

## 3. State Machine

This object has no state machine. A Unit of Measure exists as a persistent platform reference record. It cannot be deleted.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | Units of Measure are platform-level reference objects. They are not scoped to any Product, Vendor, Account, or namespace. The same set is available to all Actors across all Products. | N/A | All | — |
| BR-002 | The set of available Units of Measure is fixed and maintained exclusively by Operations. Vendors cannot create, modify, or delete Units of Measure. | N/A | All | — |
| BR-003 | A Unit of Measure cannot be deleted regardless of whether it is in use. | N/A | All | — |
| BR-004 | A Vendor selects exactly one Unit of Measure when creating a Product Item. The Unit of Measure is immutable after Item creation. | N/A | Vendor | See Catalog: Product Item canon. |
| BR-005 | Operations may update the name and description of a Unit of Measure at any time. Updates propagate immediately to all Items referencing that Unit of Measure. | N/A | Operations | — |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| name | String | Display name of the Unit of Measure (e.g. User, Gigabytes, License) | Operations | Yes | Visible To: All |
| description | String | Human-readable explanation of what this unit represents and how it is used commercially | Operations | Yes | Visible To: All |
| statistics.itemCount | Integer | Number of Catalog: Product Items currently referencing this Unit of Measure across all Products | System | N/A | Visible To: All. Computed. Read-only. A value of 0 indicates the unit is defined but not currently in use. |

> **Note:** Units of Measure do not have a `revision` field. This is consistent with their nature as a simple, stable reference object managed outside the normal Product Definition lifecycle.

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Product Item | Reference | One:Many | A Product Item references exactly one Unit of Measure. The reference is immutable after Item creation. | No — Unit of Measure cannot be deleted, so no orphan risk. Updates to name/description propagate to all referencing Items. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Unit of Measure created | Operations creates a new unit | Operations | Unit becomes available for selection by Vendors when creating Product Items. |
| Unit of Measure updated | Operations updates name or description | Operations | Updated values immediately visible on all Product Items referencing this unit. |

### 7.2 Cross-Object State Effects

No automated cross-object state transitions. Updates to name and description propagate by reference — all Items referencing the unit will reflect the updated values at read time.

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Not applicable — this object has no state machine.

**Deletion:**
- Units of Measure cannot be deleted.

**Audit & history requirements:**
The audit block records the `created` event only. No `revision` field exists on this object. Whether `name` and `description` changes are tracked in an audit history is not confirmed.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Operations updates name or description of a Unit of Measure in active use | Update succeeds. All Product Items referencing this unit immediately reflect the new values. | Vendor, Client | Low | Operations should exercise care when updating units with high itemCount, as changes propagate immediately to all referencing Items across all Products and Vendors. |
| Vendor cannot find a suitable Unit of Measure for their Item | Vendor must select the closest available unit or request Operations to create a new one. Platform does not allow Vendors to create units. | Vendor | Low | Operations maintains the reference set and can add new units on request. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-03-09 | Stu | Initial canon. Derived from PROD JSON sample (13 units). |
