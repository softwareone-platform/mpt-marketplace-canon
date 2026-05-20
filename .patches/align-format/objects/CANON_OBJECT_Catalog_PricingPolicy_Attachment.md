# Object Canon: Attachment

> **Version:** 0.3
> **Owner:** Stu
> **Last Updated:** 2026-03-16
> **Status:** Stub (spun off from CANON_OBJECT_Catalog_PricingPolicy.md)

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Attachment

**Namespace:** Catalog

**Parent Object:** Catalog: Pricing Policy

**ID Prefix:** None.

**Description:**
Stub spun off from Pricing Policy's embedded sub-object section. Full canonisation pending — see open questions.

**Also Known As:**
None known.

---

---

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | — | — | — | — | Pending canonisation. |
| Operations | — | — | — | — | Pending canonisation. |
| Client | — | — | — | — | Pending canonisation. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |

### 3.2 Transitions

| # | From State | To State | Action / Trigger | Permitted Actor(s) | Preconditions | Outcome / Side Effects |
| --- | --- | --- | --- | --- | --- | --- |

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| Name | String | Display name of the Attachment | Operations | Yes | — |
| Description | String | Descriptive text for the Attachment | Operations | Yes | — |
| Type | String | Type of the Attachment document | Operations | Yes | — |
| File Name | String | Original filename of the uploaded file | System | N/A | Set on upload. |
| Size | Integer | File size in bytes | System | N/A | Set on upload. Nullable. |
| Content Type | String | MIME type of the uploaded file | System | N/A | Set on upload. |
| Status | String | Status of the Attachment | System | Via transitions | — |
| Revision | Integer | Increments on each update | System | N/A | Read-only. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Pricing Policy | Parent | Many:1 | A Attachment is owned by a Pricing Policy. | — |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Pending canonisation.

**Deletion:**
Pending canonisation.

**Audit & history requirements:**
Pending canonisation.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |

---

## 10. Open Questions

- [ ] [ATTACHMENT-001]: Fill in remaining canonical sections (state machine, business rules, ownership, ...).

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | auto | align.js | Stub spun off from CANON_OBJECT_Catalog_PricingPolicy.md Section 5.1. |
