# Object Canon: Journal Attachment

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-19
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Journal Attachment

**Namespace:** Billing

**Parent Object:** Billing: Journal

**ID Prefix:** JOA

**Description:**
A Journal Attachment is a file stored against a Billing [[Journal]] — its source and supporting files. Two roles occur in practice: a general supporting file uploaded by a Vendor or Operations (for example, the vendor's raw reconciliation export), and a system-registered input file that captures the source data the Journal's charge entries were derived from during data upload. Journal Attachments give the Vendor and Operations a durable, downloadable record of what a Journal was built from, alongside any supplementary documentation. They are visible only to the owning Vendor [[Account]] and to Operations; they are never exposed to the Client.

**Also Known As:**
Recon file; reconciliation file; journal source file; journal input file.

---

## 2. Ownership & Visibility

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor     | Yes | Yes | Yes | Conditional | Update is limited to name and description. Delete only for general (non-input/output) attachments — see BR-005. |
| Operations | Yes | Yes | Yes | Conditional | May act on behalf of the Vendor. Same update/delete limits as Vendor. |
| Client     | No | No | No | No | The Client has no access to Journal Attachments at all — every operation is refused. |

---

## 3. State Machine

This object has no state machine. It is created and modified as a unit, with no intermediate states.

A Journal Attachment carries no lifecycle status field. Its behaviour is governed instead by two immutable-or-terminal attributes: `type` (fixed at creation — see BR-003) determines whether the attachment may be deleted, and `isDeleted` marks a removed attachment. Availability of the underlying file is controlled by deletion (BR-005, BR-009), not by any state transition.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Journal Attachment belongs to exactly one [[Journal]] and is only retrievable through that Journal's attachment path. | N/A | All | Requesting an attachment under a Journal it does not belong to returns not-found. |
| BR-002 | Journal Attachments are accessible only to the Vendor and Operations Actors; the Client Actor is refused all operations. | N/A | All | A Client request is rejected outright, not returned empty. |
| BR-003 | An attachment's `type` is set at creation and cannot be changed. The public create endpoint always produces a general attachment; input attachments are registered by the platform during a Journal's data upload. | N/A | All | `type` values on a Journal Attachment are only `Attachment` (general supporting/source file, user-uploaded) or `Input` (platform-registered Journal source data). The `Output` value exists in the shared billing-attachment enum but is never produced for a Journal — it is used only for Invoice and Credit Memo output files. |
| BR-004 | After creation, only `name` and `description` may be changed. File content, `type`, `filename`, `size`, and `contentType` are immutable. | N/A | Vendor, Operations | The update endpoint accepts only `name` and `description`; other supplied fields have no effect. |
| BR-005 | An attachment of type `Input` or `Output` cannot be deleted. Only a general (`Attachment`) attachment may be deleted. | N/A | Vendor, Operations | This is a deletion guard (preamble §3.5) keyed on `type`, not on Actor — neither Vendor nor Operations can delete an input/output attachment. |
| BR-006 | An uploaded file must have a content type on the platform's accepted-format list; any other content type is rejected. | N/A | Vendor, Operations | Accepted: PDF; Word (`.doc`/`.docx`); Excel (`.xls`/`.xlsx`); CSV; RTF; plain text; JPEG/PNG/TIFF images; JSON and JSONL; HTML; XML; and ZIP/7z/gzip archives. |
| BR-007 | A single uploaded attachment file may not exceed 500 MB. | N/A | Vendor, Operations | Enforced at upload; a larger request is rejected. |
| BR-008 | Retrieving an attachment returns either its metadata or its file, selected by the request's `Accept` header. Files are stored privately and served via a time-limited download link. | N/A | Vendor, Operations | Requesting `application/json` returns metadata; any other accepted media type redirects to a private, expiring file-download URL. An `Accept` header that does not match the file's content type is refused. |
| BR-009 | Deleting a general attachment is a soft-delete: it permanently removes the underlying file but retains the metadata record, which stays retrievable via the API with `isDeleted` set to true. | N/A | Vendor, Operations | The file blob is removed and cannot be recovered; the record itself is not filtered from reads. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| id | string | Unique identifier of the attachment. | Platform | No | Format `JOA-NNNN-NNNN`. |
| type | enum | Role of the attachment. | Platform | No | On a Journal, only `Attachment` (public create) or `Input` (platform-registered from Journal source data) occur; the shared enum's `Output` value never arises for a Journal. Governs the deletion guard — see BR-003, BR-005. |
| name | string | Human-readable label for the attachment. | Vendor / Operations on create; Platform for input attachments | Yes | Editable via update. Platform-registered input attachments default the name to the source file name. |
| description | string | Free-text description of the attachment. | Vendor / Operations on create; Platform for input attachments | Yes | Editable via update. |
| filename | string | Name of the uploaded file. | Platform (from the uploaded file) | No | Derived from the file at upload. |
| contentType | string | MIME type of the file content. | Platform (from the uploaded file) | No | Restricted to the accepted-format list — see BR-006. |
| size | integer | File size in bytes. | Platform (from the uploaded file) | No | Capped at 500 MB — see BR-007. |
| isDeleted | boolean | Whether the attachment has been marked deleted. | Platform | No (system-set on deletion) | Set when a general attachment is deleted; the record remains retrievable via the API with this flag true (BR-009). |
| revision | integer | Record revision counter. | Platform | No | Increments as the platform revises the record. |
| journal | reference | The Journal this attachment belongs to. | Platform | No | Set to the parent Journal at creation — see BR-001. |
| vendor | reference | The owning Vendor account. | Platform | No | The Vendor Account that owns the attachment; scopes event visibility — see Section 7. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Billing: Journal | Parent | Many attachments to one Journal | An attachment cannot exist without its Journal and is only reachable through that Journal's attachment path. | Yes — the attachment depends on its Journal for identity and access. |
| Accounts: Account | Association | One owning Vendor Account | The attachment records the owning Vendor Account, which scopes who may see its published events. | No — a reference only. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Attachment created | A Vendor or Operations uploads a file to a Journal, or the platform registers a Journal's source data as an input attachment | Vendor, Operations, Platform | The file is stored privately; a platform event is published, with access scoped to the owning Vendor [[Account]]. |
| Attachment updated | A Vendor or Operations edits the name or description | Vendor, Operations | A platform event is published for the change. |
| Attachment deleted | A Vendor or Operations deletes a general attachment | Vendor, Operations | The stored file is permanently removed; the record is marked deleted; a platform event is published. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | Creating, updating, or deleting a Journal Attachment does not change the state of any other object. The input attachment records the Journal's uploaded source data, but the Journal's charge generation reads that uploaded data directly rather than being driven by the attachment. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
This object has no state machine, so there are no state transitions to reverse.

**Deletion:**
A general (`Attachment`-type) Journal Attachment may be deleted by the Vendor or Operations Actor; deletion permanently removes the underlying file and cannot be undone. Attachments of type `Input` or `Output` cannot be deleted in any circumstance (BR-005). Deleting a general attachment is a soft-delete: the underlying file blob is permanently removed, but the attachment metadata record is retained and remains retrievable via the API with `isDeleted` set to true.

**Audit & history requirements:**
Journal Attachments carry the standard platform audit trail; the `audit` field records the creating and modifying Actors and timestamps. No retention of prior file content is provided — an attachment's file is fixed at upload and cannot be replaced (BR-004), so there are no superseded file versions to retain.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| A raw reconciliation file is uploaded as a general attachment rather than being the platform's input file | The file is stored as a deletable general attachment; it is not treated as the Journal's processing input | Vendor, Operations | Low | General attachments are supplementary; the Journal's charge generation is driven by the platform-registered input data, not by an arbitrary uploaded attachment. |
| A Vendor deletes a general reconciliation attachment still needed for reference | The file is permanently removed and cannot be recovered | Vendor, Operations | Medium | Only general attachments can be deleted; the platform-registered `Input` file is protected by the deletion guard (BR-005). |
| A file is retrieved with an `Accept` header that does not match its content type | The request is refused (not acceptable) | Vendor, Operations | Low | Metadata is retrievable with an `application/json` `Accept` header; the file itself requires a matching (or wildcard) media type. |
| A download link is used after it expires | Access is denied | Vendor, Operations | Low | File access is served through a private, time-limited link; a fresh retrieval issues a new link. |
| The parent Journal is no longer retrievable | The attachment is no longer reachable, as it is only accessible under its Journal's attachment path | Vendor, Operations | Medium | Attachments are always scoped to a Journal (BR-001); the platform does not cascade deletions (preamble Invariant 6). |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-19 | Stu / canon-generate-batch | Initial draft from OpenAPI schema, live multi-Actor PROD fetch (Operations/Vendor; Client refused), Actor diff, and Billing source research. Documents the Journal Attachment as a stateless CRUD file object: Vendor/Operations-only access, the `Attachment`/`Input`/`Output` type model and its deletion guard, name/description-only mutability, the accepted-format and 500 MB upload limits, and private time-limited file download. Deletion confirmed as a soft-delete (metadata retained and retrievable with isDeleted=true, file blob removed); `Output` type confirmed never to occur on a Journal (only Attachment/Input do). 0 open questions. |
