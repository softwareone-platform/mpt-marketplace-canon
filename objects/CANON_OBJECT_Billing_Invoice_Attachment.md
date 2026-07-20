# Object Canon: Invoice Attachment

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-20
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Invoice Attachment

**Namespace:** Billing

**Parent Object:** Billing: Invoice

**ID Prefix:** INA

**Description:**
An Invoice Attachment is a file stored against a parent Billing: [[Invoice]]. Unlike the general-purpose billing-attachment family established by [[Statement Attachment]] and [[Ledger Attachment]], an Invoice Attachment most commonly carries the official ERP-generated invoice PDF — created automatically by the platform the moment the parent Invoice is created, and stored externally in the ERP system rather than in platform blob storage. Operations can additionally upload supplementary attachments to an Invoice by hand, stored internally like any other billing attachment. Invoice Attachments follow the shared billing-attachment access model in part: the Client and Operations Actors can read them (a Client only for Invoices belonging to its own Account), while the Vendor Actor has no access at all. Creating, updating, and deleting an Invoice Attachment are restricted to the Operations Actor by design.

**Also Known As:**
Invoice PDF; invoice file. No distinct legacy name is confirmed.

---

## 2. Ownership & Visibility

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor     | No | No | No | No | The endpoint requires a Client or Operations token; every Vendor request is refused. The underlying data query additionally returns no rows at all for a Vendor token, as a second, independent block. |
| Operations | Yes | Yes | Yes | Yes (guard-limited) | The only Actor that may create or update an attachment (BR-006). The auto-generated invoice PDF is always type `Output` and can never be deleted through this endpoint (BR-008); only a manually-uploaded general attachment can be deleted. |
| Client     | No | Yes (own Invoices only) | No | No | Read is scoped to Invoice Attachments whose Invoice belongs to the Client's own Account. Every mutating action — create, update, and delete — is Operations-only (BR-006). |

---

## 3. State Machine

This object has no state machine. It is created and modified as a unit, with no intermediate states.

An Invoice Attachment carries no lifecycle status field. Its behaviour is governed by three fixed-at-creation attributes: `type` (BR-004), `isExternal` (BR-011), and the terminal `isDeleted` flag set when a deletable attachment is removed (BR-012). Availability of the underlying file is controlled by these attributes and by deletion, not by any state transition.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An Invoice Attachment belongs to exactly one parent [[Invoice]] and is only retrievable through that Invoice's attachment path. | N/A | Client, Operations | Requesting an attachment under an Invoice it does not belong to returns not-found. |
| BR-002 | Read access to an Invoice Attachment is limited to the Client and Operations Actors; the Vendor Actor is refused entirely. | N/A | All | The read split matches [[Statement Attachment]] (Client and Operations) and is broader than [[Ledger Attachment]] (Operations-only). |
| BR-003 | A Client's read access to Invoice Attachments is scoped to Invoices belonging to the Client's own Account; Operations has no such scoping. | N/A | Client, Operations | Vendor's equivalent query is unconditionally empty, independent of the endpoint-level refusal in BR-002. |
| BR-004 | An attachment's `type` is fixed at creation. Two of the shared billing-attachment enum's three values occur on an Invoice: `Output` for the platform-generated ERP invoice PDF, and `Attachment` for a manually uploaded supplementary file. | N/A | Operations | `Input` never occurs on an Invoice — that value is produced only by a Journal's source-data upload. `Output` governs the deletion guard (BR-008). |
| BR-005 | Creating an Invoice auto-generates one `Output`-type attachment carrying the ERP invoice PDF. | N/A (creation) | System | The auto-generated attachment is created once, at Invoice creation only; a later re-sync of the same Invoice's ERP data does not create another one. |
| BR-006 | Creating, updating, and deleting an Invoice Attachment are restricted to the Operations Actor; the Client Actor may only read. | N/A | Operations (mutation); Client, Operations (read) | Manually uploading a supplementary attachment (BR-004) uses this same Operations-only creation path. |
| BR-007 | After creation, only `name` and `description` may be changed, and only by Operations. File content, `type`, `isExternal`, `filename`, `size`, and `contentType` are immutable. | N/A | Operations | The update endpoint accepts only `name` and `description`; other supplied fields have no effect. |
| BR-008 | An attachment of type `Input` or `Output` cannot be deleted; a general (`Attachment`) attachment may be deleted. | N/A | Operations | This deletion guard (preamble §3.5) is part of the shared billing-attachment model. Because the auto-generated ERP invoice PDF is always type `Output` (BR-004/BR-005), it can never be deleted through this endpoint — only a manually-uploaded `Attachment`-type file is ever deletable. |
| BR-009 | An uploaded file must have a content type on the platform's accepted-format list; any other content type is rejected. | N/A | Operations | Accepted: PDF; Word (`.doc`/`.docx`); Excel (`.xls`/`.xlsx`); CSV; RTF; plain text; JPEG/PNG/TIFF images; JSON and JSONL; HTML; XML; and ZIP/7z/gzip archives. Applies to a manually uploaded attachment; the auto-generated attachment is always `application/pdf`. |
| BR-010 | A single uploaded attachment file may not exceed 500 MB. | N/A | Operations | Enforced at upload; a larger request is rejected. Applies to a manually uploaded attachment only. |
| BR-011 | Retrieval behaviour depends on where the file is stored (`isExternal`). An externally-stored attachment is fetched live from the ERP system and returned directly (200) on every request; an internally-stored attachment redirects (301) to a private, time-limited blob download link, gated by an Accept-header content-type match. | N/A | Client, Operations | Requesting `application/json` returns metadata for either kind. The Accept-header match check that applies to an internally-stored attachment does not apply to the externally-stored ERP PDF — a mismatched Accept header still returns the PDF. |
| BR-012 | Deleting a deletable (general `Attachment`-type) Invoice Attachment is a soft-delete: it permanently removes the underlying file but retains the metadata record, which stays retrievable via the API with `isDeleted` set to true. | N/A | Operations | Does not apply to the `Output`-type ERP invoice PDF, which cannot be deleted at all (BR-008). |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| id | string | Unique identifier of the attachment. | Platform | No | Format `INA-NNNN-NNNN-NNNN-NNNN`. |
| type | enum | Role of the attachment. | Platform | No | `Output` for the auto-generated ERP invoice PDF, `Attachment` for a manually uploaded file — see BR-004. Governs the deletion guard (BR-008). |
| name | string | Human-readable label for the attachment. | Platform (auto-generated attachment) or Operations (manual upload) | Yes (Operations only) | The auto-generated attachment's name follows an `{Invoice ID}.pdf` pattern; a manually uploaded attachment's name is supplied by Operations at upload and is editable afterward. |
| description | string | Free-text description of the attachment. | Platform (auto-generated attachment, fixed descriptive text) or Operations (manual upload) | Yes (Operations only) | Editable via update, restricted to Operations (BR-006). |
| filename | string | Name of the underlying file. | Platform | No | Follows the same `{Invoice ID}.pdf` pattern for the auto-generated attachment; derived from the uploaded file for a manual attachment. |
| contentType | string | MIME type of the file content. | Platform | No | Always `application/pdf` for the auto-generated attachment; restricted to the accepted-format list for a manual upload — see BR-009. |
| size | integer | File size in bytes. | Platform (from the uploaded file) | No | Never populated for the auto-generated (externally-stored) attachment — no local file size is recorded, since the content is not held in platform blob storage. Populated, and capped at 500 MB, for a manually uploaded attachment — see BR-010. |
| isExternal | boolean | Whether the attachment's file is stored externally (in the ERP system) rather than in platform blob storage. | Platform | No | True only for the auto-generated ERP invoice PDF; false for a manually uploaded attachment. Governs retrieval behaviour — see BR-011. |
| isDeleted | boolean | Whether the attachment has been marked deleted. | Platform | No (system-set on deletion) | Only ever set for a deletable (`Attachment`-type) attachment — see BR-008/BR-012. |
| revision | integer | Record revision counter. | Platform | No | Increments as the platform revises the record. |
| invoice | reference | The parent Invoice this attachment belongs to. | Platform | No | Set to the parent Invoice at creation — see BR-001. |
| audit | object | Created/updated event record (Actor and timestamp). | Platform | No | Included in the default response for an Invoice Attachment (not omitted by default). |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Billing: Invoice | Parent | Many attachments to one Invoice | An attachment cannot exist without its parent Invoice and is only reachable through that Invoice's attachment path. | Yes — the attachment depends on its parent Invoice for identity and access. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Attachment created (auto-generated) | The parent Invoice is created (via ERP sync) | System | An `Output`-type attachment referencing the ERP invoice PDF is created; a platform event is published. See BR-005. |
| Attachment created (manual upload) | An Operations request uploads a supplementary file to an Invoice | Operations | The file is stored privately as a general (`Attachment`-type) attachment; a platform event is published. |
| Attachment updated | An Operations request edits the name or description | Operations | A platform event is published for the change. |
| Attachment deleted | An Operations request deletes a deletable (`Attachment`-type) attachment | Operations | The stored file is permanently removed; the record is marked deleted (`isDeleted` true); a platform event is published. |

Whether attachment events (created, updated, deleted) carry an owning-account visibility grant for the Client Account is not confirmed — see INA-001.

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | Creating, updating, or deleting an Invoice Attachment does not change the state of any other object. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
This object has no state machine, so there are no state transitions to reverse.

**Deletion:**
An Invoice Attachment's deletion model depends on its `type`. The auto-generated ERP invoice PDF (`Output`) cannot be deleted through this endpoint at all — the shared deletion guard (BR-008) blocks it unconditionally. A manually uploaded general (`Attachment`-type) file may be deleted by the Operations Actor; deletion is a soft-delete — the underlying file blob is permanently removed and cannot be recovered, but the attachment metadata record is retained and remains retrievable via the API with `isDeleted` set to true.

**Audit & history requirements:**
Invoice Attachments carry the standard platform audit trail; the `audit` field records the creating and modifying Actor and timestamps and is included in the default response. No platform-side retention of prior file content is provided. For the auto-generated ERP invoice PDF, content is not stored by the platform at all — each retrieval fetches the current document live from the ERP system, so any change made on the ERP side is reflected immediately with no platform-level version history. For a manually uploaded attachment, the file is fixed at upload and cannot be replaced (BR-007), so there are no superseded file versions to retain.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Operations attempts to delete the auto-generated ERP invoice PDF | The request is rejected — an attachment of type `Output` cannot be deleted (BR-008) | Operations | Low | Protective: prevents the official invoice document from being removed from the Invoice's attachment listing. |
| The ERP invoice PDF is retrieved before the parent Invoice's ERP posting is complete (missing document number or a Seller without a Navision company code on file) | The download request fails instead of returning the PDF | Client, Operations | Medium | The auto-generated attachment has no stored file of its own — every retrieval depends on the Invoice's current ERP reference data being resolvable. |
| A manually uploaded attachment's file is retrieved with an Accept header that matches neither its content type nor `*/*` | The request is refused (not acceptable) | Client, Operations | Low | Does not apply to the auto-generated ERP invoice PDF, which bypasses this check — see BR-011. |
| A download link for a manually uploaded attachment is used after it expires | Access is denied | Client, Operations | Low | File access is served through a private, time-limited link; a fresh retrieval issues a new link. |
| The parent Invoice is no longer retrievable | The attachment is no longer reachable, as it is only accessible under its Invoice's attachment path | Client, Operations | Medium | Attachments are always scoped to their parent Invoice (BR-001); the platform does not cascade deletions (preamble Invariant 6). |

---

## 10. Open Questions

- [ ] [INA-001]: Do Invoice Attachment events (created, updated, deleted) carry an owning-account visibility grant for the Client Account, or are they Operations/internal-only? No explicit grant appears in the shared lifecycle framework in source (mirroring Statement Attachment's STA-001); the effective visibility resolves in a compiled framework base class not visible in source, so it awaits engineering confirmation.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-20 | Stu / canon-generate-batch | Initial draft from the PROD OpenAPI schema, a live multi-Actor PROD fetch (Operations and Client both read identical data; Vendor refused with 403), an Actor diff (no suppression between Operations and Client), Confluence business context for the parent Invoice/Credit Memo pairing, and Billing source research. Documents the Invoice Attachment as a stateless file object readable by Client (scoped to its own Invoices) and Operations, with the Vendor Actor refused, and all mutation (create, update, delete) restricted to Operations. An Invoice Attachment occurs as either the auto-generated `Output`-type ERP invoice PDF (externally stored, fetched live from the ERP on every read, exempt from the Accept-header match) or a manually uploaded `Attachment`-type file (internally stored, blob-backed); the `Output` PDF is protected from deletion by the shared type guard. 1 open question (INA-001: attachment event visibility scope). |
