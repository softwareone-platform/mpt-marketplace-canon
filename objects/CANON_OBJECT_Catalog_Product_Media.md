# Object Canon: Media

> **Version:** 0.3
> **Owner:** Stu
> **Last Updated:** 2026-07-16
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Media

**Namespace:** Catalog

**Parent Object:** Catalog: Product

**ID Prefix:** MED (confirmed via `preamble/PLATFORM_CANON_PREAMBLE.md` §5.3 and observed real object IDs, e.g. `MED-2873-8874-0021`).

**Description:**
A Media object is a Vendor-authored visual asset attached to a [[Product]], used to enrich how the Product is presented on the Marketplace. A Media object is either an uploaded image or a reference to an externally hosted video accompanied by an uploaded thumbnail image. Media objects are part of the Product Definition and are scoped to the single Product under which they are created. Each Media object carries its own publication lifecycle, independent of the parent Product's lifecycle.

**Also Known As:**
None known.

---

## 2. Ownership & Visibility

> High-level orientation to Actor authority and visibility over this object.
> State-specific nuances belong in Section 4 (Business Rules).

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes | Yes | Yes | Yes — Draft state only | Full authoring ownership, scoped to the Vendor's own Products. Creates, updates, submits for review, unpublishes, and deletes (Draft only). Cannot publish or republish — that is Operations-only (BR-015). |
| Operations | No | Yes | No | Yes — Draft state only | Reads Media across all states, on any Product. Publishes and republishes Media (BR-015), unpublishes it, and may delete it while in Draft. Cannot create or update Media attributes. |
| Client | Yes — Published only | Yes | No | No | Can read a Media *record* only while it is Published and its parent Product is Published or Unpublished; otherwise the record is not returned (404). The underlying asset remains retrievable by direct URL regardless of state — see BR-011. |

---

## 3. State Machine

> Each transition specifies which Actor(s) are permitted to execute it.
> Where more than one Actor is listed, any one of them may execute the transition.
> Each execution instance is always attributable to exactly one Actor.

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Draft | Media has been created by the Vendor and has not yet been submitted for review. The asset is retrievable by direct URL but the record is not listed for Clients. The only state from which deletion is permitted (BR-005). | Yes | No |
| Pending | Media has been submitted for publication review. The Vendor cannot withdraw it; the only forward exit is publication by Operations. | No | No |
| Published | Media is live. The record is listed and readable by Clients on the Product page. | No | No |
| Unpublished | Media has been removed from the Client-facing listing. The asset remains retrievable by direct URL. Not terminal — may be returned to Pending for re-review or republished directly (BR-014). | No | No |
| Deleted | Media has been permanently removed — no longer retrievable via the API. No Deleted status value is retained; the record ceases to exist. Reachable only from Draft (BR-005). | No | Yes |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Draft | Create Media | `POST` (base collection endpoint, `multipart/form-data`) | Vendor | Required fields present (BR-013); a `file` is always required, and a Video also requires a valid `url` (BR-004). | Media created in Draft state under the parent Product. |
| T2 | Draft | Pending | Submit for Publication | `review` (`POST .../{id}/review`) | Vendor | Media must be in Draft or Unpublished. | Media enters the Operations review queue. Vendor cannot reverse this (BR-006/BR-007). |
| T3 | Pending | Published | Publish | `publish` (`POST .../{id}/publish`) | Operations | Media must be in Pending or Unpublished. | Media becomes listed and readable by Clients. |
| T4 | Published | Unpublished | Unpublish | `unpublish` (`POST .../{id}/unpublish`) | Vendor, Operations | Media must be in Published. | Media removed from the Client-facing listing. |
| T5 | Unpublished | Published | Republish | `publish` (same route as T3) | Operations | Media must be in Unpublished. | Republish uses the same Operations-only action as the original Publish — it is not a separate Vendor-accessible action. |
| T6 | Unpublished | Pending | Submit for Publication | `review` (same route as T2) | Vendor | Media must be in Draft or Unpublished. | The same action handles both `Draft -> Pending` and `Unpublished -> Pending`; lets a Vendor return an Unpublished Media to the review queue rather than relying on a direct republish. |
| T7 | Draft | Deleted | Delete Media | `DELETE /{id}` | Vendor, Operations | Media must be in Draft state; the platform rejects the request otherwise. | Permanently removed — no longer retrievable via the API. No cascade — Media is a leaf object. |

### 3.3 State Diagram

```
[Draft] ---(review : Vendor)---> [Pending]
[Draft] ---(DELETE /{id} : Vendor, Operations)---> [Deleted]
[Pending] ---(publish : Operations)---> [Published]
[Published] ---(unpublish : Vendor, Operations)---> [Unpublished]
[Unpublished] ---(publish : Operations)---> [Published]
[Unpublished] ---(review : Vendor)---> [Pending]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Media object belongs to exactly one [[Product]] and cannot be shared across Products. | All | All | — |
| BR-002 | A Media object has a type that is immutable after creation. | All | All | Valid types: Image, Video. Type determines which storage model applies — see BR-003 and BR-004. A type value supplied on an update is ignored, not applied. |
| BR-003 | For Image type Media, the content is an uploaded binary image file. The filename, size, and contentType attributes are set by the platform on upload. The url attribute is not used. | All | Vendor | — |
| BR-004 | For Video type Media, the primary content is a reference to an externally hosted video stored in the url attribute, and a thumbnail image file must also be uploaded at creation time. | All | Vendor | The uploaded file is the thumbnail; the video itself is external. The url is required for a Video and must match an allowed provider format — see BR-012. |
| BR-005 | A Media object can be deleted only while in Draft state. Deletion permanently removes it — no longer retrievable via the API — and does not cascade to any other object. | Draft | Vendor, Operations | Media is a leaf object with no children. Consistent with the state-based deletion guard in preamble §3.5. |
| BR-006 | Once a Media object is submitted to Pending, the Vendor cannot withdraw it. The only forward exit from Pending is publication by Operations. | Pending | Vendor, Operations | Operations collaborates with the Vendor to reach a publishable state rather than rejecting (preamble §3.3). Consistent with [[Product]] canon BR-003. |
| BR-007 | A Media object in Pending state cannot be returned to Draft. | Pending | All | There is no reject or withdraw transition. Consistent with [[Product]] canon BR-004. |
| BR-008 | A Media object can cycle between Published and Unpublished states without limit. | Published, Unpublished | Vendor, Operations | Consistent with [[Product]] canon BR-008. |
| BR-009 | Media creation, modification, and deletion are not restricted by the state of the parent [[Product]]. | All | Vendor, Operations | No parent-Product-state precondition gates Media operations. Consistent with [[Product]] canon BR-001. |
| BR-010 | The displayOrder attribute controls the sequence in which Media objects are presented on the [[Product]] page, and must be a positive integer. | All | Vendor | Mutable after creation. |
| BR-011 | Media state controls discoverability of the record, not accessibility of the asset. The Media record is readable by Clients only while Published; the underlying asset is always retrievable by direct URL regardless of state. | All | All | A Media asset URL embedded directly in HTML (e.g. in a [[Product]] long description) continues to resolve even when the Media is Unpublished or in Draft. The asset endpoint requires no authentication. |
| BR-012 | The platform validates that a Video url matches an allowed provider format but does not verify that the target is reachable. | All | Vendor | Allowed providers: YouTube and Vimeo. A well-formed but dead link is accepted. URL reachability is the Vendor's responsibility, consistent with the platform preferring permissiveness over constraint. |
| BR-013 | Creating a Media object requires a name, a description, a displayOrder, and an uploaded file. | Draft (creation) | Vendor | The file must be a JPEG or PNG image no larger than 5 MB, and is required for both Image and Video type (for Video it is the thumbnail). Name is limited to 128 characters. |
| BR-014 | Unpublished is not a terminal state — an Unpublished Media may be returned to Pending for re-review (T6) or republished directly (T5). | Unpublished | Vendor (re-review), Operations (republish) | Consistent with [[Product]] canon BR-009. |
| BR-015 | A Vendor submits Media for review but cannot publish it; only Operations can publish or republish Media. | Pending, Unpublished | Vendor (submit only), Operations (publish/republish) | Mirrors the collaborative publication model of the parent [[Product]]. No content-completeness criteria are enforced before publication beyond the current-state check. |
| BR-016 | The name, description, and displayOrder of a Media object are mutable after creation; the type, url, uploaded file, filename, size, and contentType are not. | All | Vendor | Updates are metadata-only — there is no path to replace the uploaded file or change the video url after creation. |

---

## 5. Key Attributes

> All attribute writes are Actor-attributed, following the same rules as transitions.

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| Type | Enum | One of: Image, Video | Vendor | No | Required on creation. Determines storage model (BR-002). |
| Name | String | Internal name of the Media object | Vendor | Yes | Required on creation. Maximum 128 characters. |
| Description | String | Descriptive text for the Media object | Vendor | Yes | Required on creation. |
| Display Order | Integer | Controls presentation sequence on the Product page | Vendor | Yes | Required on creation. Must be a positive integer (BR-010). |
| File | Binary | The uploaded file. For Image type: the image itself. For Video type: a thumbnail image. | Vendor | No | Required on creation for both types. JPEG or PNG, ≤ 5 MB. Uploaded as multipart. No update path re-uploads it. |
| URL | String | External URL of the hosted video | Vendor | No | Required on creation for Video type; must be a YouTube or Vimeo URL (BR-012). Not used for Image type. Absent from response when empty. |
| Status | Enum | One of: Draft, Pending, Published, Unpublished | System | Yes — via state transitions only | Does not include a Deleted value — see Section 3.1. |
| Filename | String | Original filename of the uploaded file | System | No | Set on upload. For Video type reflects the thumbnail filename. |
| Size | Integer | File size in bytes | System | No | Set on upload. |
| Content Type | String | MIME type of the uploaded file (e.g. image/jpeg) | System | No | Set on upload. |
| Revision | Integer | Increments when the Media object's own attributes change | System | No | Read-only. |
| Audit | Object | Created and updated events, each with timestamp and Actor attribution | System | No | Read-only. Records created and updated only. Absent sub-keys when the corresponding event has not occurred. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Product | Parent | Many:1 | A Media object belongs to exactly one Product. | Yes — Media cannot exist without a parent Product, and is removed when its parent Product is deleted (which the platform permits only while the Product is in Draft state). See Catalog: Product canon BR-002. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Media created | Vendor creates Media under a [[Product]] | Vendor | Media enters Draft state. Publishes a creation event to the platform notification subsystem (Catalog module). |
| Media submitted | T2 / T6 — Draft or Unpublished to Pending | Vendor | Media enters the Operations review queue. Publishes a state-changed event. |
| Media published | T3 — Pending to Published | Operations | Media becomes listed and readable by Clients. Publishes a state-changed event. |
| Media unpublished | T4 — Published to Unpublished | Vendor, Operations | Media removed from Client-facing listing. Publishes a state-changed event. |
| Media republished | T5 — Unpublished to Published | Operations | Media restored to the Client-facing listing. Publishes a state-changed event. |
| Media updated | Any attribute change (name, description, displayOrder) | Vendor | Revision incremented. No state change. Publishes an update event. |
| Media deleted | T7 — Draft deleted | Vendor, Operations | Permanently removed — no longer retrievable via the API. Publishes a deletion event. |

> Media publishes events to the platform notification subsystem on creation, update, deletion, and every state transition. These are available to the Notification subsystem for [[Webhook]] delivery (see preamble §8). The exact message structure is not documented at the PM level.

### 7.2 Cross-Object State Effects

No cross-object state effects. A Media event changes no other object's state. (Removal of Media when its parent [[Product]] is deleted is driven by the Product and documented in Catalog: Product canon — see Section 6.)

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
- Published → Unpublished is reversible (T4/T5). No limit on cycles.
- Unpublished → Pending (T6) is available as an alternative to direct republication, returning the Media to the review queue.
- Draft → Pending (T2) cannot be undone by the Vendor (BR-006/BR-007) — the only forward path is publication by Operations.

**Deletion:**
A Media object may be deleted by the Vendor (owner) or by Operations only while in Draft state (T7). Once deleted, permanently removed — no longer retrievable via the API; no Deleted status value is retained. Deletion does not cascade — Media is a leaf object. Media beyond Draft state cannot be deleted.

**Audit & history requirements:**
The Media audit object records the created and updated events, each with a timestamp and the attributed Actor (via the acting API Token). The revision counter provides a change sequence over attribute updates. Every state transition, along with creation, update, and deletion, publishes an event to the platform notification subsystem (Catalog module). Full attribute history is retained via the platform Audit Trail — see Audit: Audit Record canon (pending canonisation).

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Media remains in Pending indefinitely (Operations never acts) | Media stays in Pending. The Vendor has no exit mechanism — only Operations can publish (BR-015). | Vendor | Medium | Operational process dependency. No system-level resolution path. |
| Video type Media created with a well-formed but dead or unreachable provider URL | The platform accepts and stores the URL after a format-only check (YouTube/Vimeo); it never verifies reachability. Client-facing rendering may fail silently. | Client | Medium | The platform validates URL format but not reachability (BR-012). |
| Attempt to delete a Media object that is not in Draft | The platform rejects the deletion. Deletion is permitted only from Draft (BR-005). | Vendor, Operations | Low | Applies to Pending, Published, and Unpublished Media. |
| Asset of a Draft or Unpublished Media retrieved by direct URL | The asset resolves and is served to any caller who knows the URL, even though the Media record is hidden from Clients. | Client | Medium | Discoverability is state-gated; asset accessibility is not, and the asset endpoint requires no authentication (BR-011). A Vendor should treat any uploaded asset URL as effectively public. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-03-07 | Stu | Initial canon. Derived from JSON and conversation. |
| 0.2 | 2026-03-14 | Stu | Schema review against OpenAPI extract. BR-003 and BR-004 updated: Video type requires a thumbnail file upload in addition to the URL. Section 5: required fields on creation documented, File attribute added, filename/size/contentType notes corrected for both types, Revision marked read-only. Section 8: deletion language cleaned up. Section 9: Video URL failure mode updated. |
| 0.3 | 2026-07-16 | Stu / canon-generate | Major refresh via live OpenAPI schema (STAGING), live-fetched real object (multi-Actor), and source-code research. ID Prefix corrected (was "None", is MED). §3.2 Endpoint/Verb column completed with confirmed literal mechanisms (`review`/`publish`/`unpublish`/`DELETE`), replacing "Unconfirmed — pending refresh". **Significant corrections**: submit-for-publication endpoint is `review`, not `submit`; publish and republish (Unpublished→Published) are Operations-only, not Vendor+Operations (T5); new T6 transition (Unpublished→Pending via the same `review` action, Vendor); delete is permitted to Vendor **or** Operations (was Vendor-only) and Media is permanently removed with no cascade (no soft-delete/retained Deleted status); Video url IS format-validated (YouTube/Vimeo only), correcting the prior "not validated" claim (BR-012); url and uploaded file are immutable after creation, correcting Section 5 (were "Yes"); Client record visibility is state-gated to Published while the asset URL stays publicly retrievable (BR-011, Ownership table); file constraints added (JPEG/PNG ≤5MB, always required — BR-013); name/description/displayOrder confirmed as the only mutable fields (BR-016); displayOrder must be positive (BR-010). Media publishes notification-subsystem events on create/update/delete/state-change (Section 7). Section 8 audit filled in (created/updated). |
