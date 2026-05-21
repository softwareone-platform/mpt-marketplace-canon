# Object Canon: Terms

> **Version:** 0.4
> **Owner:** Stu
> **Last Updated:** 2026-03-14
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Terms

**Namespace:** Catalog

**Parent Object:** Catalog: Product

**ID Prefix:** None.

**Description:**
A Terms object represents a set of terms and conditions associated with a Product that a Client must accept during Order creation. Terms are part of the Product Definition and are scoped to the Product under which they are created. The Terms object itself carries the name, description, and display order; the actual content (document or URL) is delivered through one or more child Term Variants. A Product may have multiple Terms objects, each representing a distinct set of terms (e.g. vendor terms and reseller terms). Acceptance is recorded at the Terms level, not the Variant level.

---

**Also Known As:**
TCS (API identifier prefix); "Terms and Conditions"

---

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes | Yes | Yes | Yes | Full lifecycle ownership. Can create, modify, submit to Pending, and delete (Draft only). Cannot unpublish. |
| Operations | No | Yes | No | No | Can read. Can transition from Pending to Published, and between Published and Unpublished. |
| Client | No | Yes* | No | No | *Clients see Published Terms only, presented during Order creation for acceptance. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Draft | Terms created but not yet submitted for publishing. Visible to Vendor and Operations. Not visible to Client. | Yes | No |
| Pending | Vendor has submitted Terms for review. Awaiting Operations approval to publish. | No | No |
| Published | Terms are live. Visible to Client during Order creation. | No | No |
| Unpublished | Terms have been withdrawn from Client visibility. Visible to Vendor and Operations. | No | No |
| Deleted | Permanently removed from Draft. No longer retrievable via the API. | No | Yes |

### 3.2 Transitions

| # | From State | To State | Action / Trigger | Permitted Actor(s) | Preconditions | Outcome / Side Effects |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Draft | Create Terms | Vendor | None | Terms created under Product. |
| T2 | Draft | Pending | Submit for Publishing | Vendor | None | Terms awaiting Operations review. |
| T3 | Pending | Published | Approve and Publish | Operations | None | Terms visible to Client during Order creation. |
| T4 | Published | Unpublished | Unpublish | Operations | None | Terms withdrawn from Client visibility. |
| T5 | Unpublished | Published | Republish | Operations | None | Terms restored to Client visibility. |
| T6 | Draft | Deleted | Delete Terms | Vendor | Terms must be in Draft state. All child Variants must be deleted first. | Permanently removed — no longer retrievable via the API. |

### 3.3 State Diagram

```
             T2 (Vendor)         T3 (Operations)
[Draft] ----------------> [Pending] ----------------> [Published]
  |                                                        |    ^
  | T6 (Vendor)                          T4 (Operations)  |    | T5 (Operations)
  v                                                        v    |
[Deleted]                                            [Unpublished]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Terms object belongs to exactly one Product and cannot be shared across Products. | All | All | — |
| BR-002 | A Product may have multiple Terms objects. All Published Terms on a Product are presented to the Client during Order creation. | All | All | — |
| BR-003 | Terms are presented to the Client in ascending displayOrder sequence during Order creation. | Published | Client | — |
| BR-004 | A Client must accept all Published Terms on a Product before an Order can be submitted. | Published | Client | — |
| BR-005 | Acceptance is recorded at the Terms level, not the Variant level. The acceptance record captures the Terms ID, timestamp, and the Actor token of the accepting party. | Published | Client | Visible on the resulting Agreement. |
| BR-006 | Only Published Variants are shown to the Client when Terms are presented for acceptance. A Published Terms object with no Published Variants is valid platform state — the Client will see the Terms entry but have no content to read. The Vendor is responsible for ensuring at least one Published Variant exists before a Client encounters the Terms. | Published | Client | Consistent with platform permissiveness philosophy — the platform does not prevent misconfiguration. |
| BR-007 | Terms and their Variants have fully independent state machines. There is no state dependency or cascade in either direction — publishing or unpublishing a Terms object does not affect its Variants, and vice versa. | All | All | — |
| BR-008 | Terms creation, modification, and deletion are not restricted by the state of the parent Product. | All | Vendor | Consistent with platform permissiveness philosophy. |
| BR-009 | Only Draft Terms may be deleted by the Vendor. Published, Pending, and Unpublished Terms cannot be deleted. | Draft | Vendor | Permanently removed — no longer retrievable via the API. |
| BR-009a | A Terms object cannot be deleted while it has any child Variants, regardless of Variant state. All Variants must be deleted independently before the Terms can be deleted. The platform does not cascade deletions. | Draft | Vendor | Consistent with the platform no-cascade architectural invariant. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| Name | String | Display name of the Terms | Vendor | Yes | Required on creation. |
| Description | String | Short summary of what the Terms cover | Vendor | Yes | Required on creation. Displayed to Client alongside the Terms name during Order creation. |
| Display Order | Integer | Controls the sequence in which this Terms object is presented relative to other Terms on the same Product | Vendor | Yes | Required on creation. Ascending order. |
| Status | Enum | One of: Draft, Pending, Published, Unpublished | System | Via state transitions only | — |
| Revision | Integer | Increments on each update | System | N/A | Read-only. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Product | Parent | Many:1 | A Terms object belongs to exactly one Product. | Yes — Terms cannot exist without a parent Product. |
| Catalog: Product Terms Variant | Parent | One:Many | A Terms object has zero or more Variants. Each Variant delivers the actual content (document or URL) in a specific language or for multiple languages. | Yes — a Terms object cannot be deleted while it has any child Variants. All Variants must be deleted independently before the Terms can be deleted. |
| Commerce: Agreement | Association | Many:Many | Published Terms accepted during Order creation are recorded on the resulting Agreement. Acceptance is recorded by Terms ID, timestamp, and Actor token. | No — deletion of Terms does not affect existing acceptance records on Agreements. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Terms created | Vendor creates Terms under a Product | Vendor | Terms enters Draft state. |
| Terms submitted | T2 — Draft to Pending | Vendor | Terms awaiting Operations review. |
| Terms published | T3 — Pending to Published | Operations | Terms visible to Client during Order creation. Published Variants of this Terms become accessible to Client. |
| Terms unpublished | T4 — Published to Unpublished | Operations | Terms withdrawn from Client visibility. Variant states unaffected. |
| Terms republished | T5 — Unpublished to Published | Operations | Terms restored to Client visibility. |
| Terms deleted | T6 — Draft to Deleted | Vendor | Permanently removed — no longer retrievable via the API. All child Variants must have been deleted first. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Client accepts Terms during Order creation | Commerce: Agreement | Acceptance record written to Agreement on Order completion, capturing Terms ID, timestamp, and accepting Actor token | Yes | All Published Terms on the Product must be accepted | Acceptance recorded at Terms level, not Variant level. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
- Published → Unpublished → Published (via Operations republish)

**Deletion:**
- Draft Terms may be deleted by the Vendor, subject to BR-009a (all child Variants must be deleted first). Once deleted, the Terms object is permanently removed and no longer retrievable via the API.
- Published, Pending, and Unpublished Terms cannot be deleted.
- The platform does not cascade deletions.

**Audit & history requirements:**
Audit block captures `created`, `updated`, `pending`, `published`, and `unpublished` timestamps and Actors. Prior content versions not yet confirmed as retained.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Terms Published with no Published Variants | Terms entry is shown to Client during Order creation but no content is available to read. Client may still be required to accept. | Client | Medium | Vendor is responsible for ensuring Published Variants exist before Client exposure. Platform does not prevent this configuration. |
| Terms unpublished after Client has already accepted them on an Agreement | Existing acceptance records on Agreements are unaffected. The Terms is simply no longer presented to new Clients. | None | Low | Acceptance is a historical record; it is not invalidated by subsequent Terms state changes. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-03-08 | Stu | Initial canon. Derived from Terms and Variant JSON examples and conversation. |
| 0.2 | 2026-03-09 | Stu | "Re-publish" normalised to "Republish" throughout for consistency. |
| 0.3 | 2026-03-09 | Stu | T4 corrected — Vendors cannot unpublish Terms. Unpublish and Republish are Operations-only transitions. Section 2 and Section 7.1 updated accordingly. |
| 0.4 | 2026-03-14 | Stu | Schema review against OpenAPI extract. Section 5: required fields on creation noted, Revision marked read-only. Section 8: unpublished audit event added. T6: hard delete language corrected. Section 10: cleaned up. |
