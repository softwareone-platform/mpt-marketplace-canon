# Object Canon: Ledger Attachment

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-19
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Ledger Attachment

**Namespace:** Billing

**Parent Object:** Billing: Ledger

**ID Prefix:** LEA

**Description:**
A Ledger Attachment is a file stored against a Billing [[Ledger]]. In practice these are the output artifacts of the billing pipeline's rating and statement-issuance steps — for example a per-statement ERP-order confirmation PDF or a Navision export spreadsheet — attached to the Ledger for reference by SoftwareOne. Unlike the raw and normalized input files carried by a Billing [[Journal Attachment]], Ledger Attachments accumulate on the sell-side Ledger after a [[Journal]] has been accepted. They follow the shared billing-attachment model, but access is narrower: a Ledger Attachment is visible and manageable only to the Operations Actor — the Vendor and Client Actors have no access to it at all.

**Also Known As:**
Ledger output file; ledger file. No distinct legacy name is confirmed.

---

## 2. Ownership & Visibility

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor     | No | No | No | No | The Ledger Attachment endpoint is Operations-only; every Vendor request is refused. |
| Operations | Yes | Yes | Yes | Yes | The only Actor with any access. Update is limited to name and description (BR-004). Delete is governed by the shared type-based deletion guard, which never blocks a Ledger Attachment in practice — see BR-005. |
| Client     | No | No | No | No | The Client Actor has no access to Ledger Attachments; every request is refused. |

---

## 3. State Machine

This object has no state machine. It is created and modified as a unit, with no intermediate states.

A Ledger Attachment carries no lifecycle status field. Its behaviour is governed by two immutable-or-terminal attributes: `type` (fixed at creation — see BR-003) and `isDeleted` (set when the attachment is removed — see BR-009). Availability of the underlying file is controlled by deletion, not by any state transition.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Ledger Attachment belongs to exactly one [[Ledger]] and is only retrievable through that Ledger's attachment path. | N/A | Operations | Requesting an attachment under a Ledger it does not belong to returns not-found. |
| BR-002 | Ledger Attachments are accessible only to the Operations Actor; the Vendor and Client Actors are refused all operations, including read. | N/A | All | This is narrower than the Billing [[Journal Attachment]] model, where the Vendor Actor also has access. |
| BR-003 | An attachment's `type` is set at creation and cannot be changed. Creating a Ledger Attachment always produces a general attachment (`type` `Attachment`). | N/A | Operations | The shared billing-attachment enum is `Attachment` / `Input` / `Output`, but on a Ledger only `Attachment` ever occurs — the `Input` value is produced only by a Journal's source-data upload, and `Output` only by Invoice and Credit Memo generation. |
| BR-004 | After creation, only `name` and `description` may be changed. File content, `type`, `filename`, `size`, and `contentType` are immutable. | N/A | Operations | The update endpoint accepts only `name` and `description`; other supplied fields have no effect. |
| BR-005 | An attachment of type `Input` or `Output` cannot be deleted; a general (`Attachment`) attachment may be deleted. | N/A | Operations | This deletion guard (preamble §3.5) is part of the shared billing-attachment model. Because a Ledger only ever carries `Attachment`-type files (BR-003), the guard never blocks deletion of a Ledger Attachment. |
| BR-006 | An uploaded file must have a content type on the platform's accepted-format list; any other content type is rejected. | N/A | Operations | Accepted: PDF; Word (`.doc`/`.docx`); Excel (`.xls`/`.xlsx`); CSV; RTF; plain text; JPEG/PNG/TIFF images; JSON and JSONL; HTML; XML; and ZIP/7z/gzip archives. |
| BR-007 | A single uploaded attachment file may not exceed 500 MB. | N/A | Operations | Enforced at upload; a larger request is rejected. |
| BR-008 | Retrieving an attachment returns either its metadata or its file, selected by the request's `Accept` header. Files are stored privately and served via a time-limited download link. | N/A | Operations | Requesting `application/json` returns metadata; any other accepted media type redirects to a private, expiring file-download URL. An `Accept` header that matches neither the file's content type nor `*/*` is refused. |
| BR-009 | Deleting a Ledger Attachment is a soft-delete: it permanently removes the underlying file but retains the metadata record, which stays retrievable via the API with `isDeleted` set to true. | N/A | Operations | The file blob is removed and cannot be recovered; the record itself is not filtered from reads. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| id | string | Unique identifier of the attachment. | Platform | No | Format `LEA-NNNN-NNNN`. |
| type | enum | Role of the attachment. | Platform | No | On a Ledger, only `Attachment` occurs; the shared enum's `Input` and `Output` values never arise for a Ledger — see BR-003. Governs the deletion guard (BR-005). |
| name | string | Human-readable label for the attachment. | Operations | Yes | Required at creation; editable via update. |
| description | string | Free-text description of the attachment. | Operations | Yes | Editable via update. Absent from response when null. |
| filename | string | Name of the uploaded file. | Platform (from the uploaded file) | No | Derived from the file at upload. |
| contentType | string | MIME type of the file content. | Platform (from the uploaded file) | No | Restricted to the accepted-format list — see BR-006. |
| size | integer | File size in bytes. | Platform (from the uploaded file) | No | Capped at 500 MB — see BR-007. Absent from response when null. |
| isDeleted | boolean | Whether the attachment has been marked deleted. | Platform | No (system-set on deletion) | Set when an attachment is deleted; the record remains retrievable via the API with this flag true (BR-009). |
| revision | integer | Record revision counter. | Platform | No | Increments as the platform revises the record. |
| ledger | reference | The Ledger this attachment belongs to. | Platform | No | Set to the parent Ledger at creation — see BR-001. A Ledger identifier has the format `BLE-NNNN-NNNN-NNNN-NNNN`. |
| audit | object | Created/updated event record (Actor and timestamp). | Platform | No | Omitted by default — request via `select=+audit`. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Billing: Ledger | Parent | Many attachments to one Ledger | An attachment cannot exist without its Ledger and is only reachable through that Ledger's attachment path. | Yes — the attachment depends on its Ledger for identity and access. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Attachment created | An Operations request uploads a file to a Ledger | Operations | The file is stored privately as a general (`Attachment`) attachment; a platform event is published. In practice the billing pipeline's own integration attaches the Ledger's ERP/statement output artifacts this way, under an Operations token. |
| Attachment updated | An Operations request edits the name or description | Operations | A platform event is published for the change. |
| Attachment deleted | An Operations request deletes an attachment | Operations | The stored file is permanently removed; the record is marked deleted (`isDeleted` true); a platform event is published. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | Creating, updating, or deleting a Ledger Attachment does not change the state of any other object. The Ledger's own lifecycle is driven by rating and statement issuance, not by its attachments. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
This object has no state machine, so there are no state transitions to reverse.

**Deletion:**
A Ledger Attachment may be deleted by the Operations Actor. Because a Ledger only ever carries general (`Attachment`-type) attachments, the shared `Input`/`Output` deletion guard (BR-005) never blocks the deletion of a Ledger Attachment. Deletion is a soft-delete: the underlying file blob is permanently removed and cannot be recovered, but the attachment metadata record is retained and remains retrievable via the API with `isDeleted` set to true.

**Audit & history requirements:**
Ledger Attachments carry the standard platform audit trail; the `audit` field records the creating and modifying Actor and timestamps and is omitted by default (request via `select=+audit`). No retention of prior file content is provided — an attachment's file is fixed at upload and cannot be replaced (BR-004), so there are no superseded file versions to retain.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| A Ledger output artifact (e.g. an ERP-order PDF or statement export) is deleted | The file is permanently removed and cannot be recovered | Operations | Medium | Ledger output artifacts are stored as general `Attachment`-type files, which carry no deletion guard — unlike a [[Journal]]'s `Input` file, they are not protected from deletion. |
| A file is retrieved with an `Accept` header that matches neither its content type nor `*/*` | The request is refused (not acceptable) | Operations | Low | Metadata is retrievable with an `application/json` `Accept` header; the file itself requires a matching (or wildcard) media type. |
| A download link is used after it expires | Access is denied | Operations | Low | File access is served through a private, time-limited link; a fresh retrieval issues a new link. |
| A Vendor or Client attempts to read or manage a Ledger Attachment | The request is refused | Vendor, Client | Low | The endpoint is Operations-only (BR-002); sell-side billing artifacts are not exposed to the Vendor or Client through this path. |
| The parent Ledger is no longer retrievable | The attachment is no longer reachable, as it is only accessible under its Ledger's attachment path | Operations | Medium | Attachments are always scoped to a Ledger (BR-001); the platform does not cascade deletions (preamble Invariant 6). |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-19 | Stu / canon-generate-batch | Initial draft from the PROD OpenAPI schema, a live multi-Actor PROD fetch (Operations read; Vendor and Client both refused with 403), and Billing source research. Documents the Ledger Attachment as a stateless, Operations-only CRUD file object — narrower than the Billing Journal Attachment, which the Vendor can also access. Confirmed that on a Ledger only the `Attachment` type ever occurs (no `Input`/`Output` code path), so the shared deletion guard never blocks a Ledger Attachment; name/description-only mutability, the accepted-format and 500 MB upload limits, private time-limited download, and soft-delete (metadata retained with isDeleted=true, file blob removed) all follow the shared billing-attachment model. Confirmed intended: Ledger output artifacts (ERP/statement files) are stored as general `Attachment`-type files (no platform-native `Output` type on a Ledger, hence no deletion guard on them), and Ledger Attachment access is Operations-only by design (Vendor/Client 403). 0 open questions. |
