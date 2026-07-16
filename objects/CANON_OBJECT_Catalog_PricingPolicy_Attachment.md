# Object Canon: Pricing Policy Attachment

> **Version:** 0.4
> **Owner:** Stu
> **Last Updated:** 2026-07-16
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Pricing Policy Attachment

**Namespace:** Catalog

**Parent Object:** Catalog: Pricing Policy

**ID Prefix:** PPA

**Description:**
A Pricing Policy Attachment is a supporting document attached to a [[Pricing Policy]] — for example a signed contract or an approval record that evidences or justifies the policy's yield cap. Each Attachment belongs to exactly one [[Pricing Policy]] and carries an uploaded file (PDF, Excel, CSV, or image) along with an Operations-authored name and description. Attachments are internal to Operations; they are not visible to Vendors or Clients.

**Also Known As:**
None known.

---

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | No | No | No | No | Not visible to Vendors; a Vendor request is refused. |
| Operations | Yes | Yes | Yes | Yes | Full lifecycle ownership. Only `name` and `description` are updatable (BR-007). |
| Client | No | No | No | No | Not visible to Clients; a Client request is refused. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Active | Attachment exists and is retrievable. An Attachment is created directly in this state. | Yes | No |
| Deleted | Attachment has been deleted. No longer retrievable via the API. | No | Yes |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Active | Create Attachment | `POST` (base collection endpoint) | Operations | Parent [[Pricing Policy]] must exist; the policy has fewer than the maximum active Attachments (BR-006); valid file supplied (BR-003). | Created by uploading a file. Enforced regardless of the parent policy's status. |
| T2 | Active | Deleted | Delete Attachment | `DELETE` | Operations | Attachment is not already Deleted. | Soft delete; the record is no longer retrievable via the API (BR-009). Deleting an already-Deleted Attachment is refused. |

### 3.3 State Diagram

```
[—] ---(Create : Operations)---> [Active] ---(Delete : Operations)---> [Deleted]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Pricing Policy Attachment belongs to exactly one [[Pricing Policy]] and cannot be moved to another. | All | Operations | — |
| BR-002 | Pricing Policy Attachments are managed exclusively by Operations. Vendors and Clients cannot create, read, update, or delete them. | All | Operations | — |
| BR-003 | Creating an Attachment requires an uploaded file no larger than 25 MB, of an allowed type. | Active | Operations | Allowed types: PDF, Excel (`.xlsx`), CSV, PNG, and JPEG. |
| BR-004 | `name` and `description` are required on creation. | Active | Operations | `name` is limited to 128 characters. |
| BR-005 | `type` is a fixed system-assigned value identifying the document as a Pricing Policy Attachment. It is never supplied or changed by an Actor. | All | Operations | Always `PricingPolicyAttachment`. |
| BR-006 | A [[Pricing Policy]] may have at most 10 active Attachments. Deleted Attachments do not count toward this limit. | Active | Operations | — |
| BR-007 | After creation, only `name` and `description` may be changed. The uploaded file and its derived attributes (`fileName`, `size`, `contentType`) are immutable. | Active | Operations | To change the file, delete the Attachment and create a new one. |
| BR-008 | Attachments may be created on, or deleted from, a [[Pricing Policy]] regardless of the policy's own status (Active, Inactive, or Deleted). | All | Operations | The Attachment lifecycle is independent of the parent policy's status. |
| BR-009 | Deleting an Attachment is a soft delete: the record is no longer retrievable via the API — it is absent from both direct retrieval and list responses. | All | Operations | This differs from the parent [[Pricing Policy]], whose Deleted records remain retrievable (see Pricing Policy Section 8). |
| BR-010 | The uploaded file is retrieved by requesting the Attachment with an `Accept` header matching the file's content type; the platform responds with a redirect to the stored file. Requesting with `Accept: application/json` returns the metadata record instead. | Active | Operations | The stored file is private (the redirect target is not publicly accessible). An `Accept` header that does not match the file's content type is rejected. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| name | String | Operations-authored display name for the Attachment | Operations | Yes | Required. Max 128 characters. |
| description | String | Operations-authored description of the Attachment | Operations | Yes | Required. |
| type | String | Fixed document-type discriminator | System | No | Always `PricingPolicyAttachment`. See BR-005. |
| fileName | String | Original filename of the uploaded file | System | No | Derived from the upload. |
| size | Integer | File size in bytes | System | No | Derived from the upload. |
| contentType | String | MIME type of the uploaded file | System | No | Derived from the upload (e.g. `application/pdf`). |
| status | Enum | One of: Active, Deleted | System | Via state transitions only | Created directly in Active. |
| pricingPolicy | Object (PricingPolicyRef) | Reference to the parent [[Pricing Policy]] | System | No | Summary reference to the owning policy. |
| revision | Integer | Increments on each update | System | N/A | Read-only. |
| audit | Object | Records `created` and `updated` events, each with timestamp and Actor | System | N/A | A deletion is not observable via audit, since a deleted Attachment is no longer retrievable (BR-009). |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Pricing Policy | Parent | Many:1 | A Pricing Policy Attachment belongs to exactly one Pricing Policy. | Yes — an Attachment cannot exist without a parent Pricing Policy. Deleting the parent policy does not delete or alter its Attachments. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Attachment created | Operations uploads a supporting document to a [[Pricing Policy]] | Operations | Attachment enters Active state; the parent policy's `statistics.attachments` count is incremented. |
| Attachment deleted | T2 | Operations | Soft delete; the record is no longer retrievable. The parent policy's `statistics.attachments` count is decremented. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Attachment created or deleted | Catalog: Pricing Policy | The parent policy's `statistics.attachments` count is incremented or decremented | Yes | Always | Keeps the [[Pricing Policy]] statistic in step with its active Attachments. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
None — deletion is terminal. There is no transition from Deleted back to Active.

**Deletion:**
- Deleting an Attachment is a soft delete. Once deleted, it is permanently removed — no longer retrievable via the API (absent from both direct retrieval and list responses).
- This differs from the parent [[Pricing Policy]], whose Deleted records remain retrievable via the API.

**Audit & history requirements:**
The audit block records `created` and `updated` events. A deletion is not observable through the audit block, because a deleted Attachment is no longer retrievable.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Upload of a file exceeding 25 MB or of a disallowed type | Rejected. The Attachment is not created. | Operations | Low | Allowed types: PDF, Excel, CSV, PNG, JPEG. |
| Creating an 11th active Attachment on a [[Pricing Policy]] | Rejected. The active-Attachment limit is 10 (BR-006). | Operations | Low | Deleting an existing active Attachment frees a slot. |
| Deleting an Attachment that is already Deleted | Rejected. | Operations | Low | Deletion is not idempotent. |
| Requesting the file with an `Accept` header that does not match the stored content type | Rejected. | Operations | Low | Use the file's content type, or `Accept: application/json` for metadata (BR-010). |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.4 | 2026-07-16 | Stu / canon-generate | Full canonisation (was a stub) via live OpenAPI schema (STAGING), a live multi-Actor fetch of a real Attachment, and source-code research. Object Name set to "Pricing Policy Attachment" (was the ambiguous "Attachment") for unambiguous cross-referencing. ID Prefix PPA recorded (added to preamble §5.3). Documented the Active/Deleted state machine (create→Active, DELETE→Deleted, terminal, not idempotent); Operations-only ownership (Vendor/Client refused); file upload with a 25 MB limit and PDF/Excel/CSV/PNG/JPEG types; required name (≤128) and description; the fixed `type` discriminator; the 10 active-Attachment limit per policy; name/description mutable, file attributes immutable; independence from the parent policy's status; file download via a content-type-matched request returning a redirect to a private file; and the soft-delete behaviour — a deleted Attachment is no longer retrievable, which contrasts with the parent Pricing Policy. Added `statistics.attachments` increment/decrement side effects and the `pricingPolicy` reference attribute. Resolved the placeholder stub open question. |
| 0.1 | auto | align.js | Stub spun off from CANON_OBJECT_Catalog_PricingPolicy.md Section 5.1. |
