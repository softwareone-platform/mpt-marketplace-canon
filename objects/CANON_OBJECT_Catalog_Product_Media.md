# Object Canon: Media

> **Version:** 0.2
> **Owner:** Stu
> **Last Updated:** 2026-03-14
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Media

**Parent Object:** Catalog: Product

**Description:**
A Media object is a vendor-authored visual asset associated with a Product, used to support the presentation of the Product on the Marketplace. Media can be an uploaded image file or a reference to an externally hosted video. Media objects are part of the Product Definition and are scoped to the Product under which they are created.

**Also Known As:**
MED (API identifier prefix)

---

## 2. Ownership & Visibility

> High-level orientation to Actor authority and visibility over this object.
> State-specific nuances belong in Section 4 (Business Rules).

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
|------------|------------|----------|------------|------------|-------|
| Vendor     | Yes        | Yes      | Yes        | Yes        | Full lifecycle ownership |
| Operations | No         | Yes      | No         | No         | Read across all states including Draft |
| Client     | No         | Yes      | No         | No         | Assets accessible by direct URL in all states. Only Published Media is listed on the Product page. |

---

## 3. State Machine

> Each transition specifies which Actor(s) are permitted to execute it.
> Where more than one Actor is listed, any one of them may execute the transition.
> Each execution instance is always attributable to exactly one Actor.

### 3.1 States

| State | Description | Initial State? | Terminal State? |
|-------|-------------|---------------|-----------------|
| Draft | Media has been created by the Vendor. The asset is accessible by direct URL but is not listed on the Product page for any Actor. | Yes | No |
| Pending | Media has been submitted for publication review. Accessible by direct URL. Not yet listed on the Product page for Clients. Vendor cannot withdraw. | No | No |
| Published | Media is live. Listed and accessible on the Product page for Clients. | No | No |
| Unpublished | Media has been removed from the Product page listing. The asset remains accessible by direct URL but is no longer advertised by the platform. | No | No |

### 3.2 Transitions

| # | From State | To State | Action / Trigger | Permitted Actor(s) | Preconditions | Outcome / Side Effects |
|---|------------|----------|-----------------|-------------------|---------------|----------------------|
| T1 | — | Draft | Create Media | Vendor | None | Media created in Draft state. |
| T2 | Draft | Pending | Submit for publication | Vendor | None | Media enters review queue. Vendor cannot reverse this transition. |
| T3 | Pending | Published | Publish | Operations | None | Media becomes visible to Clients on the Product page. |
| T4 | Published | Unpublished | Unpublish | Vendor, Operations | None | Media removed from Client view. |
| T5 | Unpublished | Published | Republish | Vendor, Operations | None | Media restored to Client view. |
| T6 | Draft | Deleted | Delete | Vendor | Media must be in Draft state | Permanently removed — no longer retrievable via the API. |

### 3.3 State Diagram

```
[Draft] ---(Submit : Vendor)---> [Pending]
[Pending] ---(Publish : Operations)---> [Published]
[Published] ---(Unpublish : Vendor, Operations)---> [Unpublished]
[Unpublished] ---(Republish : Vendor, Operations)---> [Published]
[Draft] ---(Delete : Vendor)---> [Deleted]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
|---------|---------------|---------------------|-------------|-------|
| BR-001 | A Media object belongs to exactly one Product and cannot be shared across Products. | All | All | |
| BR-002 | A Media object has a type. Valid types are: Image, Video. Type is immutable after creation. | All | All | Type determines which storage model applies. See BR-003 and BR-004. |
| BR-003 | For Image type Media, the content is an uploaded binary file. The filename, size, and contentType attributes are set by the platform on upload. The url attribute is not used. | All | Vendor | |
| BR-004 | For Video type Media, the content is a reference to an externally hosted video. The url attribute stores the external video URL (e.g. a YouTube link). A thumbnail image file must also be uploaded at creation time — this is stored as the binary content of the Media object. | All | Vendor | The thumbnail is required even though the primary content is external. |
| BR-005 | Media can only be deleted in Draft state. | Draft | Vendor | Consistent with Product canon BR-002. |
| BR-006 | Once a Media object is submitted to Pending, the Vendor cannot withdraw it. The only exit from Pending is publication by Operations. | Pending | Vendor, Operations | Consistent with Product canon BR-003. |
| BR-007 | A Media object in Pending state cannot be returned to Draft. | Pending | All | Consistent with Product canon BR-004. |
| BR-008 | A Media object can cycle between Published and Unpublished states without limit. | Published, Unpublished | Vendor, Operations | Consistent with Product canon BR-008. |
| BR-009 | Media creation, modification, and deletion are not restricted by the state of the parent Product. | All | Vendor | Consistent with Product canon BR-001. |
| BR-010 | The displayOrder attribute controls the sequence in which Media objects are presented on the Product page. | All | Vendor | |
| BR-011 | Media state controls discoverability, not accessibility. A Media asset is always accessible by direct URL regardless of state. State determines only whether the platform lists the URL in any UI or API response. | All | All | This means Media URLs embedded directly in HTML (e.g. in a Product long description) will continue to resolve even if the Media is Unpublished or in Draft. |
| BR-012 | The platform does not validate external Video URLs. URL validity is the Vendor's responsibility. | All | Vendor | Consistent with the platform philosophy of preferring permissiveness over constraint unless a constraint is imperative. |

---

## 5. Key Attributes

> All attribute writes are Actor-attributed, following the same rules as transitions.

| Attribute | Type | Description | Set By | Mutable After Creation? | Mutable After [State]? | Notes |
|-----------|------|-------------|--------|------------------------|----------------------|-------|
| Type | Enum | One of: Image, Video | Vendor | No | N/A | Required on creation. Determines storage model. Immutable after creation. |
| Name | String | Internal name of the Media object | Vendor | Yes | N/A | Required on creation. |
| Description | String | Descriptive text for the Media object | Vendor | Yes | N/A | Required on creation. |
| Display Order | Integer | Controls presentation sequence on the Product page | Vendor | Yes | N/A | Required on creation. |
| File | Binary | The uploaded file. For Image type: the image itself. For Video type: a thumbnail image. | Vendor | Yes | N/A | Required on creation for both types. Uploaded as binary (multipart). |
| Status | Enum | One of: Draft, Pending, Published, Unpublished | System | Yes — via state transitions only | N/A | |
| Filename | String | Original filename of the uploaded file | System | N/A | N/A | Set on upload. Applicable to Image type; for Video type reflects the thumbnail filename. |
| Size | Integer | File size in bytes | System | N/A | N/A | Set on upload. |
| Content Type | String | MIME type of the uploaded file (e.g. image/png) | System | N/A | N/A | Set on upload. |
| URL | String | External URL of the hosted video | Vendor | Yes | N/A | Required on creation for Video type. Not applicable to Image type. |
| Revision | Integer | Increments when the Media object's own attributes change | System | N/A | N/A | Read-only. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
|----------------|------------------|-------------|-------------|----------------------|
| Catalog: Product | Parent | Many:1 | A Media object belongs to exactly one Product. | Yes — Media cannot exist without a parent Product. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
|-------|---------|-------------------|---------------------------------|
| Media created | Vendor creates Media under a Product | Vendor | Media enters Draft state. |
| Media submitted | T2 — Draft to Pending | Vendor | Media enters Operations review queue. |
| Media published | T3 — Pending to Published | Operations | Media becomes visible to Clients on the Product page. |
| Media unpublished | T4 — Published to Unpublished | Vendor, Operations | Media removed from Client view. |
| Media republished | T5 — Unpublished to Published | Vendor, Operations | Media restored to Client view. |
| Media deleted | T6 — Draft deleted | Vendor | Permanently removed — no longer retrievable via the API. |

### 7.2 Cross-Object State Effects

No cross-object state effects at this time.

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
- Published → Unpublished is reversible (T5). No limit on cycles.
- No other transitions are reversible. Draft → Pending cannot be undone by the Vendor.

**Deletion:**
- Draft Media may be deleted by the Vendor. Once deleted, permanently removed — no longer retrievable via the API.
- Media beyond Draft state cannot be deleted.

**Audit & history requirements:**
Not yet defined.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
|----------|--------------------------|---------------|------------|-------|
| Media remains in Pending indefinitely (Operations never acts) | Media stays in Pending. Vendor has no exit mechanism. | Vendor | Medium | Consistent with Product canon. Operational process dependency. |
| Video type Media created with an invalid or unreachable URL | Platform accepts the value without validation. The URL is stored as supplied. Client-facing rendering may fail silently if the URL is invalid or unreachable. | Client | Medium | The platform does not validate external Video URLs — URL validity is the Vendor's responsibility per BR-012. |
| Published Media deleted — not possible | Deletion is blocked in all states except Draft. | Vendor | N/A | |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2026-03-07 | Stu | Initial canon. Derived from JSON and conversation. |
| 0.2 | 2026-03-14 | Stu | Schema review against OpenAPI extract. BR-003 and BR-004 updated: Video type requires a thumbnail file upload in addition to the URL. Section 5: required fields on creation documented, File attribute added, filename/size/contentType notes corrected for both types, Revision marked read-only. Section 8: deletion language cleaned up. Section 9: Video URL failure mode updated to reflect confirmed platform behaviour per BR-012. |
