# Object Canon: Document

> **Version:** 0.2
> **Owner:** Stu
> **Last Updated:** 2026-07-19
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Document

**Namespace:** Catalog

**Parent Object:** Catalog: Product

**ID Prefix:** PDC (confirmed via observed real object IDs, e.g. `PDC-2873-8874-0001`).

**Description:**
A Document is a Vendor-authored supporting document attached to a [[Product]] — either an uploaded file (PDF or Word) or a reference to an externally hosted URL. Documents provide supplementary material about the Product (e.g. datasheets, guides, buying information) in a specific language. Documents are part of the Product Definition and are scoped to the Product under which they are created. Each Document carries its own publication lifecycle, independent of the parent Product's lifecycle.

**Also Known As:**
None known.

---

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes | Yes | Yes | Yes — Draft state only | Full authoring ownership under the Vendor's own Products. Submits for review (`review`) and may unpublish, but cannot publish or republish — those are Operations-only (BR-008). |
| Operations | No | Yes | No | No | Reads all Documents. Publishes and republishes Documents; may also unpublish. Cannot create, update, or delete. |
| Client | No | Yes* | No | No | *Clients read a Document record only while it is Published; a Draft, Pending, or Unpublished Document is not returned to a Client (404) — see BR-011. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Draft | Document created but not yet submitted for publishing. Visible to Vendor and Operations. Not visible to Client. The only state from which deletion is permitted (BR-009). | Yes | No |
| Pending | Vendor has submitted the Document for review. Awaiting Operations approval to publish. | No | No |
| Published | Document is live and readable by Clients. | No | No |
| Unpublished | Document has been withdrawn from Client visibility. Visible to Vendor and Operations. Not terminal — may return to Pending for re-review or be republished directly. | No | No |
| Deleted | Document permanently removed — no longer retrievable via the API. No Deleted status value is retained; the record ceases to exist. Reachable only from Draft (BR-009). | No | Yes |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Draft | Create Document | `POST` (base collection endpoint, `multipart/form-data`) | Vendor | Required fields present (BR-006); type-specific content required (BR-003/BR-004). | Document created under the Product in Draft state. |
| T2 | Draft | Pending | Submit for Publishing | `review` (`POST .../{id}/review`) | Vendor | None | Document enters the Operations review queue. |
| T3 | Pending | Published | Approve and Publish | `publish` (`POST .../{id}/publish`) | Operations | None | Document becomes readable by Clients. |
| T4 | Published | Unpublished | Unpublish | `unpublish` (`POST .../{id}/unpublish`) | Vendor, Operations | None | Document withdrawn from Client visibility. |
| T5 | Unpublished | Published | Republish | `publish` (same route as T3) | Operations | None | Republish uses the same Operations-only action as the original Publish — not a separate Vendor-accessible one. |
| T6 | Unpublished | Pending | Submit for Publishing | `review` (same route as T2) | Vendor | None | The same action handles both `Draft -> Pending` and `Unpublished -> Pending`; lets a Vendor return an Unpublished Document to the review queue rather than republishing directly. |
| T7 | Draft | Deleted | Delete Document | `DELETE /{id}` | Vendor | Document must be in Draft state; the platform rejects the request otherwise. | Permanently removed — no longer retrievable via the API. The stored file (File type) is removed as well. |

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
| BR-001 | A Document belongs to exactly one [[Product]] and cannot be shared across Products. | All | All | — |
| BR-002 | A Document has a type that is immutable after creation. | All | All | Valid types: Online, File. Determines the content model — see BR-003 and BR-004. |
| BR-003 | An Online Document references content at an external URL. No file is stored. | All | Vendor | The `url` is required and validated to be an HTTP/HTTPS URL, but reachability is not checked — availability is the Vendor's responsibility. |
| BR-004 | A File Document delivers content as an uploaded file, stored on the platform. The `url` attribute does not apply. | All | Vendor | The file must be a PDF or Word document no larger than 5 MB. The stored file is served through an authenticated download, not a public URL. |
| BR-005 | A Document carries a language identifying the language of its content, required on creation. | All | Vendor | Must be one of the platform's supported locale codes (a fixed allow-list, e.g. en-US, en-GB, de-DE, fr-FR, es-ES, it-IT, ja-JP, zh-CN) — not free text. |
| BR-006 | Creating a Document requires a name, a description, a type, and a language. | Draft (creation) | Vendor | Name maximum 128 characters; description maximum 4000. Online requires a `url`; File requires an uploaded file (BR-003/BR-004). |
| BR-007 | Document creation, modification, and deletion are not restricted by the state of the parent [[Product]]. | All | Vendor | — |
| BR-008 | A Vendor submits a Document for review (`review`) and may unpublish a Published Document, but only Operations can publish or republish a Document. | Pending, Published, Unpublished | Vendor (submit, unpublish), Operations (publish, republish, unpublish) | Mirrors the collaborative publication model of the parent [[Product]]. |
| BR-009 | A Document may be deleted only while in Draft state, and only by the Vendor. Deletion permanently removes it — no longer retrievable via the API — along with its stored file for a File Document. | Draft | Vendor | Operations cannot delete a Document. |
| BR-010 | A Document's name, description, and language are mutable after creation; its type, url, and uploaded file are not. | All | Vendor | The language of an Unpublished Document cannot be changed. |
| BR-011 | A Client can read a Document *record* only while it is Published — a Draft, Pending, or Unpublished Document is not returned to a Client (404). The Document's file content, however, is not state-gated: any authenticated Actor that knows the Document ID can download the file regardless of the Document's state. | All | Client | State controls discoverability of the record, not accessibility of the content (preamble §3.2). The download requires authentication (it is not a public URL, unlike a [[Media]] image) but is not restricted by publication state — a Vendor should treat an uploaded file as reachable by any authenticated party once it exists. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| Name | String | Display name of the Document | Vendor | Yes | Required on creation. Maximum 128 characters. |
| Description | String | Description of the Document | Vendor | Yes | Required on creation. Maximum 4000 characters. |
| Type | Enum | One of: Online, File | Vendor | No | Required on creation. Immutable. Determines the content model (BR-003/BR-004). |
| URL | String | External URL of an Online Document's content | Vendor | No | Required on creation for Online type; not applicable to File type. Validated as an HTTP/HTTPS URL (reachability not checked). |
| Language | String | Locale code identifying the Document's language (e.g. en-US) | Vendor | Yes | Required on creation. One of the platform's supported locale codes (see BR-005). Cannot be changed while the Document is Unpublished. |
| File | Binary | Uploaded file containing the Document content | Vendor | No | Required on creation for File type; not applicable to Online. PDF or Word, ≤ 5 MB. Uploaded as multipart; no update path re-uploads it. |
| Filename | String | Name of the uploaded file | System | No | File type only. Set on upload. |
| Size | Integer | File size in bytes | System | No | File type only. Set on upload. |
| Content Type | String | MIME type of the uploaded file (e.g. application/pdf) | System | No | File type only. Set on upload. |
| Status | Enum | One of: Draft, Pending, Published, Unpublished | System | Yes — via state transitions only | Does not include a Deleted value — see Section 3.1. |
| Revision | Integer | Increments on each update | System | No | Read-only. |
| Audit | Object | created and updated events, each with timestamp and Actor attribution | System | No | Read-only. Records created and updated only. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Product | Parent | Many:1 | A Document belongs to exactly one Product. | Yes — a Document cannot exist without a parent Product, and is removed (record and stored file) when the parent Product is deleted, which the platform permits only while the Product is in Draft state. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Document created | Vendor creates a Document under a [[Product]] | Vendor | Document enters Draft state. Publishes a creation event to the platform notification subsystem (Catalog module). |
| Document submitted | T2 / T6 — Draft or Unpublished to Pending | Vendor | Document enters the Operations review queue. Publishes a state-changed event. |
| Document published | T3 — Pending to Published | Operations | Document becomes readable by Clients. Publishes a state-changed event. |
| Document unpublished | T4 — Published to Unpublished | Vendor, Operations | Document withdrawn from Client visibility. Publishes a state-changed event. |
| Document republished | T5 — Unpublished to Published | Operations | Document restored to Client visibility. Publishes a state-changed event. |
| Document updated | Name, description, or language change | Vendor | Revision incremented. Publishes an update event. |
| Document deleted | T7 — Draft to Deleted | Vendor | Permanently removed — no longer retrievable via the API; the stored file is removed for a File Document. Publishes a deletion event. |

> A Document publishes events to the platform notification subsystem on creation, update, deletion, and every state transition. These are available to the Notification subsystem for [[Webhook]] delivery (see preamble §8). The exact message structure is not documented at the PM level.

### 7.2 Cross-Object State Effects

No cross-object state effects. A Document event changes no other object's state.

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
- Published → Unpublished is reversible. No limit on cycles.
- Unpublished → Pending (re-review) is available as an alternative to direct republication.
- Draft → Pending cannot be undone by the Vendor — the only forward path is publication by Operations.

**Deletion:**
A Document may be deleted by the Vendor only while in Draft state. Once deleted, permanently removed — no longer retrievable via the API; for a File Document the stored file is removed as well. Operations cannot delete a Document, and Documents beyond Draft state cannot be deleted. Deleting the parent [[Product]] (Draft state only) also removes the Document and its stored file.

**Audit & history requirements:**
The Document audit object records the created and updated events, each with a timestamp and the attributed Actor. Creation, update, deletion, and every state transition publish an event to the platform notification subsystem (Catalog module). Full attribute history is retained via the platform Audit Trail — see Audit: [[Audit Record]] canon.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Online Document's external URL becomes unavailable after publishing | The platform validated the URL format at creation but never checks reachability, so a Client following it encounters a broken link. | Client | Medium | URL availability is the Vendor's responsibility (BR-003). |
| A `displayOrder` is supplied when creating a Document | The value is accepted by the request but silently ignored — Documents are not ordered by a `displayOrder`, and the value is neither stored nor returned. | Vendor | Low | A Vendor expecting to control Document ordering via `displayOrder` will find it has no effect. |
| A Vendor unpublishes a Published Document | The Document moves to Unpublished and is no longer readable by Clients, but the Vendor cannot republish it — only Operations can (BR-008). | Client, Vendor | Medium | — |
| A Client requests the file of a Draft or Unpublished Document by ID | The file downloads for any authenticated Actor that knows the Document ID, even though the record itself is hidden from the Client (404 on read). | Client | Medium | Discoverability of the record is state-gated; accessibility of the content is not (BR-011). A Vendor should not treat an unpublished Document's file as private. |
| Document remains in Pending indefinitely (Operations never acts) | The Document stays in Pending. The Vendor can submit and unpublish but cannot publish (BR-008). | Vendor | Medium | Operational process dependency; no system-level resolution path. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.2 | 2026-07-19 | Stu / canon-maintenance | Wikilinked the now-canonised `[[Audit Record]]` reference (Section 8) and removed the stale "pending canonisation" qualifier. No behavioural change. |
| 0.1 | 2026-07-16 | Stu / canon-generate | Initial canon. Generated via live OpenAPI schema (STAGING), a live-fetched real File Document across its Published and Unpublished states (multi-Actor), and source-code research. Documents the Online/File content model, the Draft/Pending/Published/Unpublished state machine (`review`/`publish`/`unpublish`; review and publish each also handle the Unpublished path; publish/republish Operations-only, review Vendor-only, unpublish Vendor-or-Operations), Draft-only Vendor-only deletion with permanent removal of the record and stored file, the required allow-listed language, PDF/Word ≤5 MB file constraint, HTTP-format-only URL validation for Online, and Client read visibility gated to the Published state — the record is hidden from a Client (404) once Unpublished, but the file content remains downloadable by any authenticated Actor (including a Client) that knows the Document ID regardless of state (BR-011; both confirmed empirically by fetching the Document as each Actor in its Published and Unpublished states). ID Prefix PDC added to preamble §5.3. |
