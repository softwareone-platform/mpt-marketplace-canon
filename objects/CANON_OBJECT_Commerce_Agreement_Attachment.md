# Object Canon: Agreement Attachment

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-17
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Agreement Attachment

**Namespace:** Commerce

**Parent Object:** Commerce: Agreement

**ID Prefix:** ATT

**Description:**
An Agreement Attachment is a supporting document or license-key record held against a Commerce [[Agreement]]. It exists to carry transaction evidence and deliverables that are not modelled as structured fields — for example a signed contract, order paperwork, or the license key issued to the customer. Each attachment is one of two kinds: a **File** (an uploaded binary document) or a **LicenseKey** (key text carried inline, with no file). An attachment may optionally reference a single [[Order]] within the same [[Agreement]], but it always belongs to the [[Agreement]] and is created, listed, and retrieved through the [[Agreement]]'s attachments collection — Order-scoped and Agreement-scoped attachments are one shared collection, not two. Attachments are added by the [[Agreement]]'s Vendor or by Operations.

**Also Known As:**
Order Attachment — the same object when it is created with a reference to an [[Order]]. There is no separate Order attachment collection or endpoint.

---

## 2. Ownership & Visibility

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor     | Yes        | Yes      | Yes        | Yes        | Only on [[Agreement]]s where the Vendor is the [[Agreement]]'s Vendor (BR-009). |
| Operations | Yes        | Yes      | Yes        | Yes        | Full access across all [[Agreement]]s. |
| Client     | No         | Yes      | No         | No         | Read-only, and only on [[Agreement]]s where the Client is the [[Agreement]]'s Client. An update attempt is refused (403). |

> Visibility is inherited from the parent [[Agreement]], not from any owner recorded on the attachment — there is no attachment-level owner or created-by scoping field. See BR-009 and Section 5.

---

## 3. State Machine

This object has no state machine. It is created as a unit and either exists or is permanently removed (see Section 8). There are no intermediate states — the object carries no status field, and its `type` (File or LicenseKey) is fixed at creation.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An Agreement Attachment belongs to exactly one [[Agreement]] and cannot be moved to another. | N/A | Vendor, Operations | — |
| BR-002 | Every attachment has a `type` fixed at creation and never changed thereafter. | N/A | Vendor, Operations | One of: `File`, `LicenseKey`. |
| BR-003 | A `File` attachment requires an uploaded file; its `filename`, `size`, and `contentType` are derived from that upload. A `LicenseKey` attachment carries its key as inline text and has no file. | N/A | Vendor, Operations | — |
| BR-004 | The create request is rejected when its total request body exceeds 30,000,000 bytes. | N/A | Vendor, Operations | Limit is on the whole multipart request (file plus metadata), roughly 30 MB. Rejected with a 400. |
| BR-005 | A `File` attachment's uploaded file must be one of the allowed document types; any other type is rejected. | N/A | Vendor, Operations | Allowed: PDF, Word (`.docx`), Excel (`.xlsx`), PowerPoint (`.pptx`), and CSV. Does not apply to `LicenseKey` attachments. |
| BR-006 | `name` is limited to 180 characters, `description` to 250 characters, and `licenseKey` to 1000 characters. | N/A | Vendor, Operations | — |
| BR-007 | After creation, only `name` and `description` may be changed. The `type`, the uploaded file (and its derived `filename`/`size`/`contentType`), the `licenseKey`, and the `orderId` are immutable. | N/A | Vendor, Operations | To change a file or key, delete the attachment and create a new one. |
| BR-008 | An attachment may optionally reference one [[Order]]; that [[Order]] must belong to the same [[Agreement]]. | N/A | Vendor, Operations | Set at creation and immutable. No [[Order]]-status or [[Agreement]]-status condition applies (BR-010). Referencing an [[Order]] outside the [[Agreement]] is refused. |
| BR-009 | Attachments are managed by Operations or by the [[Agreement]]'s Vendor. The Client cannot create, update, or delete an attachment, but can read attachments on its own [[Agreement]]s. | N/A | All | Visibility and management authority derive from the parent [[Agreement]]'s Vendor and Client; the attachment carries no owner field of its own. |
| BR-010 | Adding or deleting an attachment is permitted regardless of the parent [[Agreement]]'s status. | N/A | Vendor, Operations | No [[Agreement]]-state guard exists on create or delete. |
| BR-011 | An [[Agreement]] may hold any number of attachments — there is no per-Agreement cap. | N/A | Vendor, Operations | — |
| BR-012 | Deleting an attachment permanently removes it — it is no longer retrievable via the API. Deleting an already-deleted attachment is refused. | N/A | Vendor, Operations | For a `File` attachment the stored file is also removed. See Section 8. |
| BR-013 | A `File` attachment's file is retrieved by requesting the attachment with an `Accept` header matching the file's content type; the platform responds with a redirect to a private, time-limited download URL. Requesting with `Accept: application/json` returns the metadata record instead. | N/A | Vendor, Operations, Client | An `Accept` header that matches neither the file's content type nor `application/json` is refused. A `LicenseKey` attachment has no file and cannot be downloaded. |
| BR-014 | The platform does not enforce mutual exclusivity between the two `type`s at the field level: a `licenseKey` value supplied on a `File` attachment is stored as given, and a file supplied on a `LicenseKey` attachment is ignored. | N/A | Vendor, Operations | The `type` remains authoritative for behaviour (download, allowed content types). Consistent with the platform's permissive-by-default philosophy (preamble §3.1). |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| id | String | Platform identifier (`ATT` prefix) | System | No | — |
| name | String | Display name for the attachment | Vendor / Operations | Yes | Max 180 characters (BR-006). |
| description | String | Free-text description | Vendor / Operations | Yes | Max 250 characters (BR-006). |
| type | Enum | Kind of attachment | Vendor / Operations | No | One of: `File`, `LicenseKey` (BR-002). |
| filename | String | Original filename of the uploaded file | System | No | `File` type only; derived from the upload. Absent for `LicenseKey`. |
| size | Integer | File size in bytes | System | No | `File` type only. Absent for `LicenseKey`. |
| contentType | String | MIME type of the uploaded file | System | No | `File` type only, e.g. `application/pdf`. Absent for `LicenseKey`. |
| licenseKey | String | License-key text | Vendor / Operations | No | Populated for `LicenseKey`; returned as an empty string for `File`. Max 1000 characters. See BR-014. |
| orderId | String | Optional reference to an [[Order]] within the same [[Agreement]] | Vendor / Operations | No | Absent when not set (null suppression). See BR-008. |
| agreement | Object (AgreementRef) | Summary reference to the parent [[Agreement]] | System | No | Carries the [[Agreement]]'s `id`, `name`, `revision`, and `status`. |
| revision | Integer | Increments on each update | System | N/A | Read-only. |
| audit | Object | Records `created` and `updated` events, each with timestamp and Actor | System | N/A | Omitted by default; request via `select=+audit`. A deletion is not observable via audit (BR-012). |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Commerce: Agreement | Parent | Many:1 | An attachment belongs to exactly one Agreement and is created, listed, and retrieved through the Agreement's attachments collection. | Yes — an attachment cannot exist without its parent Agreement. |
| Commerce: Order | Association | Many:1 (optional) | An attachment may reference one Order within the same Agreement via `orderId`. The reference is what makes an attachment "Order-scoped"; the attachment still lives in the shared Agreement collection. | No cascade. The reference is a plain link — the Order and the attachment are deleted independently. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Attachment created | The [[Agreement]]'s Vendor or Operations uploads a file or records a license key, optionally against an [[Order]] | Vendor, Operations | The attachment is persisted in the [[Agreement]]'s shared collection and a creation message is published to the notification bus, carrying the [[Agreement]] and the referenced [[Order]] (if any). For a `File`, the file is stored privately. |
| Attachment deleted | The [[Agreement]]'s Vendor or Operations deletes an attachment | Vendor, Operations | The attachment is permanently removed (BR-012); for a `File`, the stored file is removed. No message is published for this event. |

### 7.2 Cross-Object State Effects

None. An attachment's events do not change the state of the parent [[Agreement]], the referenced [[Order]], or any other object, and no statistics counter is maintained.

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
None — this object has no state machine.

**Deletion:**
An Agreement Attachment may be deleted by Operations or by the parent [[Agreement]]'s Vendor, at any time and regardless of the [[Agreement]]'s status. Once deleted, it is permanently removed — no longer retrievable via the API (absent from both direct retrieval and list responses). For a `File` attachment, the stored file is removed as well as the metadata record. Deleting an attachment that is already deleted is refused.

**Audit & history requirements:**
The `audit` block records `created` and `updated` events, each with a timestamp and the acting Actor. A deletion is not observable through the audit block, because a deleted attachment is no longer retrievable. Only the creation event is published to the notification bus — updates and deletions publish no message.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Create request whose total body exceeds 30,000,000 bytes | Rejected with a 400 ("request body too large"). The attachment is not created. | Vendor, Operations | Low | Limit covers the whole multipart request, not the file alone (BR-004). |
| `File` upload of a disallowed document type | Rejected. The attachment is not created. | Vendor, Operations | Low | Allowed types: PDF, Word, Excel, PowerPoint, CSV (BR-005). |
| Requesting a `File` attachment with an `Accept` header matching neither the file's content type nor `application/json` | Rejected. | Vendor, Operations, Client | Low | Use the file's content type to download, or `application/json` for metadata (BR-013). |
| Attempting to download a `LicenseKey` attachment as a file | Rejected — a `LicenseKey` attachment has no file. | Vendor, Operations, Client | Low | The key text is read from the metadata record. |
| Referencing an [[Order]] that does not belong to the [[Agreement]] | Rejected (not found). The attachment is not created. | Vendor, Operations | Low | `orderId` must resolve to an [[Order]] on the same [[Agreement]] (BR-008). |
| `licenseKey` supplied on a `File` attachment, or a file supplied on a `LicenseKey` attachment | Accepted silently — the `licenseKey` is stored, the file is ignored. | Vendor, Operations | Medium | The platform does not prevent the mismatch (BR-014); the `type` governs behaviour, so the extra value is inert and can mislead a later reader. |
| A previously retrieved `File` download URL is reused after it expires | The link no longer resolves. | Vendor, Operations, Client | Low | The download target is time-limited; re-request the attachment to obtain a fresh URL (BR-013). |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-17 | Stu / canon-generate | Initial canon via live STAGING OpenAPI schema, a multi-Actor live fetch of both a `File` and a `LicenseKey` attachment, and source-code research. Object Name set to "Agreement Attachment"; ID prefix ATT recorded (to be added to preamble §5.3 at promotion). Documents: the single shared Order/Agreement collection accessed only via the Agreement's `/attachments` endpoint (no Order attachments endpoint exists); the stateless model (no status field); the File vs LicenseKey types and their type-conditional fields; the 30,000,000-byte request-body limit; the allowed File content types (PDF/Word/Excel/PowerPoint/CSV, no images); name/description/licenseKey max lengths; update limited to name and description; the optional immutable `orderId` (must belong to the same Agreement, no status gate); Vendor(own-Agreement)/Operations management with agreement-participant-scoped read visibility and Client read-only (update 403); no per-Agreement cap and no Agreement-status guard; permanent deletion (stored File removed, already-deleted refused); creation-only notification event; and the private, time-limited File download redirect. Permissive-by-default type/field handling (licenseKey stored on any type, file ignored for LicenseKey) documented as observed behaviour per PM direction. 0 open questions. |
