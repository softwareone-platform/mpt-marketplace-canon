# Object Canon: Statement Attachment

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-20
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Statement Attachment

**Namespace:** Billing

**Parent Object:** Billing: Statement

**ID Prefix:** STA

**Description:**
A Statement Attachment is a file stored against a Billing [[Statement]] — the ERP-bound billing document generated per Agreement from a [[Ledger]]'s charges, ultimately producing a sales order or credit memo (and eventually an invoice) on the ERP side. In practice a Statement Attachment carries the Statement's own generated Excel export alongside any other supporting documentation Operations attaches for the record. Statement Attachments follow the shared billing-attachment model established by [[Ledger Attachment]] and [[Journal Attachment]], but their read split is different from both: the Client and Operations Actors can read a Statement Attachment while the Vendor Actor has no access at all, whereas a Ledger Attachment is Operations-only and a Journal Attachment is Vendor-and-Operations. Creating, updating, and deleting a Statement Attachment are all restricted to the Operations Actor.

**Also Known As:**
Statement file; statement export. No distinct legacy name is confirmed.

---

## 2. Ownership & Visibility

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor     | No | No | No | No | The endpoint requires a Client or Operations token; every Vendor request is refused. |
| Operations | Yes | Yes | Yes | Yes | The only Actor that may create, update, or delete an attachment (BR-004). Delete is governed by the shared type-based deletion guard, which never blocks a Statement Attachment in practice — see BR-006. |
| Client     | No | Yes | No | No | Read-only by design — every Statement Attachment mutation is Operations-only (BR-004). An implementation gap currently lets a Client delete one — see STA-002. |

---

## 3. State Machine

This object has no state machine. It is created and modified as a unit, with no intermediate states.

A Statement Attachment carries no lifecycle status field. Its behaviour is governed by two immutable-or-terminal attributes: `type` (fixed at creation — see BR-003) and `isDeleted` (set when the attachment is removed — see BR-010). Availability of the underlying file is controlled by deletion, not by any state transition.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Statement Attachment belongs to exactly one [[Statement]] and is only retrievable through that Statement's attachment path. | N/A | Client, Operations | Requesting an attachment under a Statement it does not belong to returns not-found. |
| BR-002 | Read access to a Statement Attachment is limited to the Client and Operations Actors; the Vendor Actor is refused entirely. | N/A | All | The read split is distinct within the billing-attachment family: [[Ledger Attachment]] is Operations-only and [[Journal Attachment]] is Vendor-and-Operations, while a Statement Attachment is readable by Client and Operations. |
| BR-003 | An attachment's `type` is set at creation and cannot be changed. Creating a Statement Attachment always produces a general attachment (`type` `Attachment`). | N/A | Operations | The shared billing-attachment enum is `Attachment` / `Input` / `Output`, but on a Statement only `Attachment` ever occurs — no code path assigns `Input` or `Output` to a Statement Attachment. |
| BR-004 | Every Statement Attachment mutation — create, update, and delete — is restricted to the Operations Actor; the Client and Operations Actors may only read. | N/A | Operations (mutation); Client, Operations (read) | The Operations-only restriction on delete is not currently enforced, so a Client request can delete an attachment — an intent-vs-implementation gap tracked as STA-002. |
| BR-005 | After creation, only `name` and `description` may be changed, and only by Operations. File content, `type`, `filename`, `size`, and `contentType` are immutable. | N/A | Operations | The update endpoint accepts only `name` and `description`; other supplied fields have no effect. |
| BR-006 | An attachment of type `Input` or `Output` cannot be deleted; a general (`Attachment`) attachment may be deleted. | N/A | Operations | This deletion guard (preamble §3.5) is part of the shared billing-attachment model. Because a Statement only ever carries `Attachment`-type files (BR-003), the guard never blocks deletion of a Statement Attachment in practice. |
| BR-007 | An uploaded file must have a content type on the platform's accepted-format list; any other content type is rejected. | N/A | Operations | Accepted: PDF; Word (`.doc`/`.docx`); Excel (`.xls`/`.xlsx`); CSV; RTF; plain text; JPEG/PNG/TIFF images; JSON and JSONL; HTML; XML; and ZIP/7z/gzip archives. |
| BR-008 | A single uploaded attachment file may not exceed 500 MB. | N/A | Operations | Enforced at upload; a larger request is rejected. |
| BR-009 | Retrieving an attachment returns either its metadata or its file, selected by the request's `Accept` header. Files are stored privately and served via a time-limited download link. | N/A | Client, Operations | Requesting `application/json` returns metadata; any other accepted media type redirects to a private, expiring file-download URL. An `Accept` header that matches neither the file's content type nor `*/*` is refused. |
| BR-010 | Deleting a Statement Attachment is a soft-delete: it permanently removes the underlying file but retains the metadata record, which stays retrievable via the API with `isDeleted` set to true. | N/A | Operations | The file blob is removed and cannot be recovered; the record itself is not filtered from reads. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| id | string | Unique identifier of the attachment. | Platform | No | Format `STA-NNNN-NNNN`. |
| type | enum | Role of the attachment. | Platform | No | Only `Attachment` occurs on a Statement; the shared enum's `Input` and `Output` values never arise — see BR-003. Governs the deletion guard (BR-006). |
| name | string | Human-readable label for the attachment. | Operations | Yes (Operations only) | Required at creation; editable via update, both restricted to Operations (BR-004). |
| description | string | Free-text description of the attachment. | Operations | Yes (Operations only) | Editable via update, restricted to Operations (BR-004). |
| filename | string | Name of the uploaded file. | Platform (from the uploaded file) | No | Derived from the file at upload. |
| contentType | string | MIME type of the file content. | Platform (from the uploaded file) | No | Restricted to the accepted-format list — see BR-007. |
| size | integer | File size in bytes. | Platform (from the uploaded file) | No | Capped at 500 MB — see BR-008. |
| isDeleted | boolean | Whether the attachment has been marked deleted. | Platform | No (system-set on deletion) | Set when an attachment is deleted; the record remains retrievable via the API with this flag true (BR-010). |
| revision | integer | Record revision counter. | Platform | No | Increments as the platform revises the record. |
| statement | reference | The Statement this attachment belongs to. | Platform | No | Set to the parent Statement at creation — see BR-001. |
| audit | object | Created/updated event record (Actor and timestamp). | Platform | No | Included in the default response for a Statement Attachment (not omitted by default, unlike the equivalent field on the Ledger Attachment and Journal Attachment). |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Billing: Statement | Parent | Many attachments to one Statement | An attachment cannot exist without its Statement and is only reachable through that Statement's attachment path. | Yes — the attachment depends on its Statement for identity and access. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Attachment created | An Operations request uploads a file to a Statement | Operations | The file is stored privately as a general (`Attachment`) attachment; a platform event is published. In practice, the Statement's own generated Excel export is attached this way under an Operations-scoped automation token, alongside any manually uploaded supporting documentation. |
| Attachment updated | An Operations request edits the name or description | Operations | A platform event is published for the change. |
| Attachment deleted | An Operations request deletes an attachment | Operations | The stored file is permanently removed; the record is marked deleted (`isDeleted` true); a platform event is published. |

Attachment events (created, updated, deleted) carry no owning-account visibility grant. Unlike events for the parent Statement — which the Client Account can see — a Statement Attachment's events appear Operations/internal-only; see STA-001.

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | Creating, updating, or deleting a Statement Attachment does not change the state of any other object. The Statement's own lifecycle is driven by generation and ERP posting, not by its attachments. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
This object has no state machine, so there are no state transitions to reverse.

**Deletion:**
A Statement Attachment may be deleted only by the Operations Actor by design. Because a Statement only ever carries general (`Attachment`-type) attachments, the shared `Input`/`Output` deletion guard (BR-006) never blocks the deletion of a Statement Attachment in practice. Deletion is a soft-delete: the underlying file blob is permanently removed and cannot be recovered, but the attachment metadata record is retained and remains retrievable via the API with `isDeleted` set to true. The Operations-only restriction on delete is not currently enforced — see STA-002.

**Audit & history requirements:**
Statement Attachments carry the standard platform audit trail; the `audit` field records the creating and modifying Actor and timestamps and is included in the default response. No retention of prior file content is provided — an attachment's file is fixed at upload and cannot be replaced (BR-005), so there are no superseded file versions to retain.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| A Client deletes a Statement Attachment | Delete is intended to be Operations-only (BR-004), but the platform does not enforce that restriction, so a Client request succeeds: the file is permanently removed and cannot be recovered, and — because create and update are correctly Operations-only — the Client cannot re-upload a replacement. | Client, Operations | High | Intent-vs-implementation gap (STA-002); systemic — Invoice and Credit Memo attachments share it. Restoring a deleted file requires an Operations re-upload. |
| A Vendor attempts to read or manage a Statement Attachment | The request is refused | Vendor | Low | The endpoint requires a Client or Operations token (BR-002); sell-side generation detail is not exposed to the Vendor through this path. |
| A file is retrieved with an `Accept` header that matches neither its content type nor `*/*` | The request is refused (not acceptable) | Client, Operations | Low | Metadata is retrievable with an `application/json` `Accept` header; the file itself requires a matching (or wildcard) media type. |
| A download link is used after it expires | Access is denied | Client, Operations | Low | File access is served through a private, time-limited link; a fresh retrieval issues a new link. |
| The parent Statement is no longer retrievable | The attachment is no longer reachable, as it is only accessible under its Statement's attachment path | Client, Operations | Medium | Attachments are always scoped to a Statement (BR-001); the platform does not cascade deletions (preamble Invariant 6). |

---

## 10. Open Questions

- [ ] [STA-001]: A Statement Attachment's events carry no owning-account visibility grant in source (no event producer overrides permissions), so — unlike the parent Statement, whose events are granted to the Client Account — its attachment events appear Operations/internal-only. Confirm the effective visibility, since the default event-permission behaviour resolves in a compiled framework base class not visible in source.
- [ ] [STA-002]: Deleting a Statement Attachment is intended to be Operations-only (create and update are), but the platform does not enforce an Operations-only restriction on delete, so a Client request can delete one. The gap is systemic across the billing-attachment family — Invoice and Credit Memo attachments share it. Confirm the intended restriction and whether the missing enforcement is a defect.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-20 | Stu / canon-generate-batch | Initial draft from the PROD OpenAPI schema, a live multi-Actor PROD fetch (Operations and Client both read the same data; Vendor refused with 403), an Actor diff (no suppression between Operations and Client), Confluence business context for the parent Statement, and Billing source research. Documents the Statement Attachment as a stateless file object readable by Client and Operations (Vendor refused with 403) with all mutation intended Operations-only. Confirmed directly in code: only `Attachment` type ever occurs on a Statement (no `Input`/`Output` code path), so the shared deletion guard never blocks a Statement Attachment; the `audit` field is included in the default response (not omitted by default, unlike the Ledger/Journal Attachment equivalents). Two intent-vs-implementation gaps flagged from an Opus authorization/event dig: delete is not enforced Operations-only, so a Client can delete an attachment (STA-002, systemic across Invoice/Credit Memo attachments); and attachment events carry no owning-account grant, appearing Operations/internal-only unlike the parent Statement's Client-granted events (STA-001). 2 open questions. |
