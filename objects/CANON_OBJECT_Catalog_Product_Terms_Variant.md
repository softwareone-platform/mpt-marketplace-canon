# Object Canon: Terms Variant

> **Version:** 0.5
> **Owner:** Stu
> **Last Updated:** 2026-07-16
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Terms Variant

**Namespace:** Catalog

**Parent Object:** Catalog: Product Terms

**ID Prefix:** TCV (confirmed via observed real object IDs, e.g. `TCV-2873-8874-0001-0001`).

**Description:**
A Terms Variant delivers the actual content of a [[Terms]] object — either as an uploaded file or as an external URL reference. Variants provide language-specific versions of Terms content, or (for an online reference) a single Variant may cover multiple languages. A Terms object may have multiple Variants. Only Published Variants are shown to Clients when Terms are presented for acceptance during [[Order]] creation. Variants have their own independent state machine; their state is not coupled to the parent Terms state.

**Also Known As:**
None known.

---

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes | Yes | Yes | Yes — Draft state only | Full authoring ownership under the Vendor's own Products. Submits for review (`review`) and may unpublish, but cannot publish or republish — those are Operations-only (BR-010). |
| Operations | No | Yes | No | No | Reads all Variants. Publishes and republishes Variants; may also unpublish. Cannot create, update, or delete. |
| Client | No | Yes* | No | No | *Clients see Published Variants only, when the parent [[Terms]] is presented for acceptance during Order creation. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Draft | Variant created but not yet submitted for publishing. Visible to Vendor and Operations. Not visible to Client. The only state from which deletion is permitted (BR-009). | Yes | No |
| Pending | Vendor has submitted the Variant for review. Awaiting Operations approval to publish. | No | No |
| Published | Variant is live. Visible to Client when the parent Terms are presented for acceptance. | No | No |
| Unpublished | Variant has been withdrawn from Client visibility. Visible to Vendor and Operations. Not terminal — may return to Pending for re-review or be republished directly. | No | No |
| Deleted | Variant permanently removed — no longer retrievable via the API. No Deleted status value is retained; the record ceases to exist. Reachable only from Draft (BR-009). | No | Yes |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Draft | Create Variant | `POST` (base collection endpoint, `multipart/form-data`) | Vendor | Required fields present (BR-011); type-specific content required (BR-003/BR-004). | Variant created under the Terms object in Draft state. |
| T2 | Draft | Pending | Submit for Publishing | `review` (`POST .../{id}/review`) | Vendor | None | Variant enters the Operations review queue. |
| T3 | Pending | Published | Approve and Publish | `publish` (`POST .../{id}/publish`) | Operations | None | Variant visible to Client when the parent Terms are presented. |
| T4 | Published | Unpublished | Unpublish | `unpublish` (`POST .../{id}/unpublish`) | Vendor, Operations | None | Variant withdrawn from Client visibility. Parent [[Terms]] state unaffected. |
| T5 | Unpublished | Published | Republish | `publish` (same route as T3) | Operations | None | Republish uses the same Operations-only action as the original Publish — not a separate Vendor-accessible one. |
| T6 | Unpublished | Pending | Submit for Publishing | `review` (same route as T2) | Vendor | None | The same action handles both `Draft -> Pending` and `Unpublished -> Pending`; lets a Vendor return an Unpublished Variant to the review queue rather than republishing directly. |
| T7 | Draft | Deleted | Delete Variant | `DELETE /{id}` | Vendor | Variant must be in Draft state; the platform rejects the request otherwise. | Permanently removed — no longer retrievable via the API. For a File Variant, the stored file is also removed. |

### 3.3 State Diagram

```
[Draft] ---(review : Vendor)---> [Pending]
[Draft] ---(DELETE /{id} : Vendor)---> [Deleted]
[Pending] ---(publish : Operations)---> [Published]
[Published] ---(unpublish : Vendor, Operations)---> [Unpublished]
[Unpublished] ---(publish : Operations)---> [Published]
[Unpublished] ---(review : Vendor)---> [Pending]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Terms Variant belongs to exactly one [[Terms]] object and cannot be shared across Terms objects. | All | All | — |
| BR-002 | A Terms Variant has a type that is immutable after creation. | All | All | Valid types: Online, File. Determines the content model — see BR-003 and BR-004. |
| BR-003 | An Online Variant delivers content via an external URL (`assetUrl`). File attributes (filename, size, contentType, fileId) do not apply. | All | Vendor | The platform validates that `assetUrl` is a well-formed absolute HTTP/HTTPS URL (maximum 2048 characters) but does not verify that the target is reachable — availability is the Vendor's responsibility. |
| BR-004 | A File Variant delivers content as an uploaded file, stored on the platform and referenced by `fileId`. The `assetUrl` attribute does not apply. | All | Vendor | The file must be a PDF or Word document no larger than 5 MB. |
| BR-005 | A Terms Variant carries a language code identifying the language of its content. | All | All | Must be a recognised language code (maximum 5 characters). Required for a File Variant. Optional for an Online Variant — omitting it indicates the Variant covers multiple languages. A single Terms object may have multiple Variants for different languages. |
| BR-006 | A Terms Variant's state is independent of the parent [[Terms]] state. Publishing, unpublishing, or deleting a Terms object does not change its Variants' states, and Variant state changes do not change the parent Terms state. | All | All | The platform never cascades deletions. Deleting a Terms object is intended to require its Variants be removed first, but the platform does not enforce this — deleting a Draft Terms leaves its Variants orphaned (see [[Terms]] canon BR-009a). |
| BR-007 | Only Published Variants are shown to the Client when the parent [[Terms]] is presented for acceptance. | Published | Client | A Published Terms object with no Published Variants is valid platform state — the platform does not prevent this configuration. |
| BR-008 | Variant creation, modification, and deletion are not restricted by the state of the parent [[Terms]] or the parent [[Product]]. | All | Vendor | — |
| BR-009 | Only Draft Variants may be deleted, and only by the Vendor. Published, Pending, and Unpublished Variants cannot be deleted. Deletion permanently removes the Variant — no longer retrievable via the API. | Draft | Vendor | For a File Variant, the stored file is removed as well. |
| BR-010 | A Vendor submits a Variant for review (`review`) and may unpublish a Published Variant, but only Operations can publish or republish a Variant. | Pending, Published, Unpublished | Vendor (submit, unpublish), Operations (publish, republish, unpublish) | A Vendor can take a Published Variant to Unpublished but cannot bring it back — republication is Operations-only. |
| BR-011 | Creating a Variant requires a name and a type; description is optional. | Draft (creation) | Vendor | Name maximum 300 characters. Description is optional (maximum 4000 characters) and may be empty. Name and description are the only attributes mutable after creation; type, `assetUrl`, language code, and the uploaded file are immutable. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| Name | String | Display name of the Variant | Vendor | Yes | Required on creation. Maximum 300 characters. |
| Description | String | Short summary of the Variant content | Vendor | Yes | Optional. Maximum 4000 characters; may be empty. |
| Type | Enum | One of: Online, File | Vendor | No | Required on creation. Immutable. |
| Asset URL | String | External URL to the terms content | Vendor | No | Required on creation for Online type; not applicable to File type. Validated as a well-formed HTTP/HTTPS URL (≤ 2048 chars); reachability not checked (see BR-003). |
| Language Code | String | Recognised language code (e.g. en-US) identifying the Variant's language | Vendor | No | Maximum 5 characters. Required for File type; optional for Online (null indicates multiple languages) — see BR-005. |
| File | Binary | Uploaded file containing the terms content | Vendor | No | Required on creation for File type; not applicable to Online. PDF or Word, ≤ 5 MB. Uploaded as multipart; no update path re-uploads it. |
| Filename | String | Name of the uploaded file | System | No | File type only. Set on upload. |
| Size | Integer | File size in bytes | System | No | File type only. Set on upload. |
| Content Type | String | MIME type of the uploaded file (e.g. application/pdf) | System | No | File type only. Set on upload. |
| File ID | String | Reference to the stored file object | System | No | File type only. Set on upload. |
| Status | Enum | One of: Draft, Pending, Published, Unpublished | System | Yes — via state transitions only | Does not include a Deleted value — see Section 3.1. |
| Revision | Integer | Increments on each update | System | No | Read-only. |
| Audit | Object | created and updated events, each with timestamp and Actor attribution | System | No | Read-only. Records created and updated only — state transitions are not recorded as audit sub-keys. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Product Terms | Parent | Many:1 | A Variant belongs to exactly one Terms object. | A Variant cannot exist without a parent Terms object. Deleting a Terms object does not remove its Variants — the platform neither enforces a "remove Variants first" guard nor cascades, so a deleted Draft Terms leaves its Variants orphaned (see Catalog: Product Terms canon BR-009a). Variant and Terms state machines are independent (BR-006). |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Variant created | Vendor creates a Variant under a [[Terms]] object | Vendor | Variant enters Draft state. Publishes a creation event to the platform notification subsystem (Catalog module). |
| Variant submitted | T2 / T6 — Draft or Unpublished to Pending | Vendor | Variant enters the Operations review queue. Publishes a state-changed event. |
| Variant published | T3 — Pending to Published | Operations | Variant visible to Client when the parent [[Terms]] is presented for acceptance. Publishes a state-changed event. |
| Variant unpublished | T4 — Published to Unpublished | Vendor, Operations | Variant withdrawn from Client visibility. Parent Terms state unaffected. Publishes a state-changed event. |
| Variant republished | T5 — Unpublished to Published | Operations | Variant restored to Client visibility. Publishes a state-changed event. |
| Variant updated | Name or description change | Vendor | Revision incremented. No state change. Publishes an update event. |
| Variant deleted | T7 — Draft to Deleted | Vendor | Permanently removed — no longer retrievable via the API; the stored file is removed for a File Variant. Publishes a deletion event. |

> A Terms Variant publishes events to the platform notification subsystem on creation, update, deletion, and every state transition. These are available to the Notification subsystem for [[Webhook]] delivery (see preamble §8). The exact message structure is not documented at the PM level.

### 7.2 Cross-Object State Effects

No cross-object state effects. A Variant event changes no other object's state — in particular, Variant state changes never affect the parent [[Terms]] state (BR-006).

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
- Published → Unpublished is reversible. No limit on cycles.
- Unpublished → Pending (re-review) is available as an alternative to direct republication.
- Draft → Pending cannot be undone by the Vendor — the only forward path is publication by Operations.

**Deletion:**
Only Draft Variants may be deleted, by the Vendor. Once deleted, permanently removed — no longer retrievable via the API; no Deleted status value is retained. For a File Variant, the stored file is removed as well. Published, Pending, and Unpublished Variants cannot be deleted. The platform does not cascade deletions — deleting the parent [[Terms]] does not remove its Variants (BR-006).

**Audit & history requirements:**
The Variant audit object records the created and updated events, each with a timestamp and the attributed Actor — state transitions are not recorded as audit sub-keys. Creation, update, deletion, and every state transition publish an event to the platform notification subsystem (Catalog module). Full attribute history is retained via the platform Audit Trail — see Audit: Audit Record canon (pending canonisation).

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Parent [[Terms]] Published with all Variants in Draft | Variant content is not shown to the Client. The Client sees the Terms entry but has no content to read. | Client | Medium | The platform does not prevent this; Vendor responsibility (BR-007). |
| Online Variant URL becomes unavailable after publishing | The platform validated the URL format at creation but never checks reachability, so a Client encounters a broken link. | Client | Medium | URL availability is the Vendor's responsibility (BR-003). |
| A Vendor unpublishes a Published Variant | The Variant moves to Unpublished, but the Vendor cannot republish it — only Operations can (BR-010). The Variant stays Unpublished until Operations acts. | Client, Vendor | Medium | — |
| Name or description of a Published Variant is edited | The update is applied immediately with no re-review, and the Variant stays Published. | Client | Low | No status guard on name/description edits. Type, URL, language code, and file cannot be changed after creation. |
| A Draft [[Terms]] with child Variants is deleted | The Terms is removed and its Variants are left orphaned — the platform neither blocks the deletion nor cascades to the Variants. | Vendor | Medium | See [[Terms]] canon BR-009a. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-03-08 | Stu | Initial canon. Derived from Terms Variant JSON examples (Online and File types) and conversation. |
| 0.2 | 2026-03-09 | Stu | BR-006 and BR-009 reconciled — cascade exception from parent Terms deletion made explicit and prominent. Deletion section updated. |
| 0.3 | 2026-03-09 | Stu | T4 corrected — Vendors cannot unpublish Terms Variants. Unpublish and Republish are Operations-only transitions. Section 2 and Section 7.1 updated accordingly. |
| 0.4 | 2026-03-14 | Stu | Schema review against OpenAPI extract. BR-005 updated: File type Variants always require a language code — multi-language not supported for File type. Section 5: required fields on creation documented, language and file upload requirements noted per type, Revision marked read-only. Section 8: audit uncertainty resolved — Variant uses PlatformObjectAudit (created/updated only). T6 and Section 7.1: hard delete language corrected. Section 10: cleaned up. |
| 0.5 | 2026-07-16 | Stu / canon-generate | Full refresh via live OpenAPI schema (STAGING), a live-fetched real Online Variant (multi-Actor), and source-code research. ID Prefix corrected (was "None", is TCV). §3.2 endpoints filled (`review`/`publish`/`unpublish`/`DELETE`), replacing "Unconfirmed"; new T6 transition (Unpublished→Pending via `review`, Vendor). **Significant corrections**: unpublish is Vendor **or** Operations, reversing the v0.3 "Operations-only, Vendor cannot unpublish" claim (only republish — the `publish` action — is Operations-only); `assetUrl` and `languageCode` are immutable after creation (Section 5 previously marked them mutable) — only name and description are mutable (BR-011); `description` is optional, not required (BR-011, Section 5); the platform validates the Online `assetUrl` format (well-formed HTTP/HTTPS, ≤2048), correcting BR-003's "does not validate the URL" (reachability still unchecked); File content constraints added (PDF/Word, ≤5 MB — BR-004); language code is an allow-list value (≤5 chars) — BR-005. BR-006/Section 6/Section 8 reframed to match [[Terms]] canon BR-009a — deleting a Terms is intended to require Variant removal first but is not enforced, orphaning the Variants (no cascade). Variant publishes notification-subsystem events (Section 7). Deletion is permanent (no retained Deleted status); File Variant's stored file removed on delete. Also Known As reduced to "None known" (TCV moved to ID Prefix). |
