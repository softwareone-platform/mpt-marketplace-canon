# Object Canon: Terms Variant

> **Version:** 0.4
> **Owner:** Stu
> **Last Updated:** 2026-03-14
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Terms Variant

**Parent Object:** Catalog: Product Terms

**Also Known As:**
TCV (API identifier prefix)

**Description:**
A Terms Variant delivers the actual content of a Terms object — either as a binary file upload or as an external URL. Variants are used to provide language-specific versions of Terms content, or a single Variant may cover multiple languages. A Terms object may have multiple Variants. Only Published Variants are shown to Clients when Terms are presented for acceptance. Variants have their own independent state machine; their state is not coupled to the parent Terms state.

---

## 2. Ownership & Visibility

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
|------------|------------|----------|------------|------------|-------|
| Vendor     | Yes        | Yes      | Yes        | Yes        | Full lifecycle ownership. Can create, modify, submit to Pending, and delete (Draft only). Cannot unpublish. |
| Operations | No         | Yes      | No         | No         | Can read. Can transition from Pending to Published, and between Published and Unpublished. |
| Client     | No         | Yes*     | No         | No         | *Clients see Published Variants only, when presented with the parent Terms for acceptance during Order creation. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
|-------|-------------|---------------|-----------------|
| Draft | Variant created but not yet submitted for publishing. Visible to Vendor and Operations. Not visible to Client. | Yes | No |
| Pending | Vendor has submitted Variant for review. Awaiting Operations approval to publish. | No | No |
| Published | Variant is live. Visible to Client when parent Terms are presented for acceptance. | No | No |
| Unpublished | Variant has been withdrawn from Client visibility. Visible to Vendor and Operations. | No | No |

### 3.2 Transitions

| # | From State | To State | Action / Trigger | Permitted Actor(s) | Preconditions | Outcome / Side Effects |
|---|------------|----------|-----------------|-------------------|---------------|----------------------|
| T1 | — | Draft | Create Variant | Vendor | None | Variant created under Terms. |
| T2 | Draft | Pending | Submit for publishing | Vendor | None | Variant awaiting Operations review. |
| T3 | Pending | Published | Approve and publish | Operations | None | Variant visible to Client when parent Terms are presented. |
| T4 | Published | Unpublished | Unpublish | Operations | None | Variant withdrawn from Client visibility. Parent Terms state unaffected. |
| T5 | Unpublished | Published | Republish | Operations | None | Variant restored to Client visibility. |
| T6 | Draft | Deleted | Delete | Vendor | Variant must be in Draft state | Permanently removed — no longer retrievable via the API. |

### 3.3 State Diagram

```
             T2 (Vendor)         T3 (Operations)
[Draft] ----------------> [Pending] ----------------> [Published]
  |                                                        |    ^
  | T6 (Vendor)                          T4 (Operations)  |    | T5 (Operations)
  v                                                        v    |
[Deleted]                                            [Unpublished]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
|---------|---------------|---------------------|-------------|-------|
| BR-001 | A Terms Variant belongs to exactly one Terms object and cannot be shared across Terms objects. | All | All | |
| BR-002 | A Terms Variant has a type. Valid types are: Online, File. Type is immutable after creation. | All | All | |
| BR-003 | An Online Variant delivers content via an external URL (assetUrl). File attributes (filename, size, contentType, fileId) are not applicable. | All | All | The platform does not validate the URL. Vendor is responsible for URL availability and correctness. |
| BR-004 | A File Variant delivers content as a binary file upload. The file is stored on the platform and referenced by fileId. The assetUrl attribute is not applicable. | All | All | |
| BR-005 | A Terms Variant requires a language code on creation. For Online type, the language code may be null to indicate the Variant covers multiple languages. For File type, a specific language code is always required — multi-language is not supported for File Variants. | All | All | A single Terms object may have multiple Variants covering different languages. |
| BR-006 | Variant state is fully independent of the parent Terms state. Publishing, unpublishing, or deleting a Terms object does not automatically affect its Variants' states, and Variant state changes do not affect the parent Terms state. | All | All | The platform does not cascade deletions. A Terms object cannot be deleted while it has any child Variants. All Variants must be deleted independently before the Terms can be deleted — see Terms canon BR-009a. |
| BR-007 | Only Published Variants are shown to the Client when the parent Terms is presented for acceptance. | Published | Client | A Published Terms with no Published Variants is valid platform state. The platform does not prevent this configuration. |
| BR-008 | Variant creation, modification, and deletion are not restricted by the state of the parent Terms or the parent Product. | All | Vendor | Consistent with platform permissiveness philosophy. |
| BR-009 | Only Draft Variants may be deleted by the Vendor. Published, Pending, and Unpublished Variants cannot be deleted. | Draft | Vendor | Permanently removed — no longer retrievable via the API. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
|-----------|------|-------------|--------|------------------------|-------|
| Name | String | Display name of the Variant | Vendor | Yes | Required on creation. |
| Description | String | Short summary of the Variant content | Vendor | Yes | Required on creation. |
| Type | Enum | One of: Online, File | Vendor | No | Required on creation. Immutable after creation. |
| Asset URL | String | External URL to terms content. | Vendor | Yes | Required on creation for Online type. Not applicable to File type. Platform does not validate URL availability. |
| Language Code | String | BCP 47 language code (e.g. en-us) scoping this Variant to a specific language. | Vendor | Yes | Required on creation for both types. For Online type, may be null to indicate the Variant covers multiple languages. For File type, a language code is always required — multi-language is not supported. |
| File | Binary | Uploaded file containing the terms content. | Vendor | Yes | Required on creation for File type. Not applicable to Online type. Uploaded as binary (multipart). |
| Filename | String | Name of the uploaded file. Applicable to File type only. | System | N/A | Set on upload. |
| Size | Integer | File size in bytes. Applicable to File type only. | System | N/A | Set on upload. |
| Content Type | String | MIME type of the uploaded file (e.g. application/pdf). Applicable to File type only. | System | N/A | Set on upload. |
| File ID | String | Reference to the stored file object (FIL-...). Applicable to File type only. | System | N/A | Set on upload. |
| Status | Enum | One of: Draft, Pending, Published, Unpublished | System | Via state transitions only | |
| Revision | Integer | Increments on each update | System | N/A | Read-only. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
|----------------|------------------|-------------|-------------|----------------------|
| Catalog: Product Terms | Parent | Many:1 | A Variant belongs to exactly one Terms object. | Yes — a Terms object cannot be deleted while it has child Variants. All Variants must be deleted before the parent Terms can be deleted. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
|-------|---------|-------------------|---------------------------------|
| Variant created | Vendor creates Variant under Terms | Vendor | Variant enters Draft state. |
| Variant submitted | T2 — Draft to Pending | Vendor | Variant awaiting Operations review. |
| Variant published | T3 — Pending to Published | Operations | Variant visible to Client when parent Terms is presented for acceptance. |
| Variant unpublished | T4 — Published to Unpublished | Operations | Variant withdrawn from Client visibility. Parent Terms state unaffected. |
| Variant republished | T5 — Unpublished to Published | Operations | Variant restored to Client visibility. |
| Variant deleted | T6 — Draft to Deleted | Vendor | Permanently removed — no longer retrievable via the API. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
- Published → Unpublished → Published (via Operations republish)

**Deletion:**
- Draft Variants may be deleted by the Vendor. Once deleted, the Variant is permanently removed and no longer retrievable via the API.
- Published, Pending, and Unpublished Variants cannot be deleted.
- The platform does not cascade deletions — a Terms object cannot be deleted while it has any child Variants regardless of their state.

**Audit & history requirements:**
Variant audit block captures `created` and `updated` timestamps and Actors only. The Variant uses the standard `PlatformObjectAudit` schema — `pending` and `published` events are not recorded at the Variant level. This is by design, confirmed from the API spec.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
|----------|--------------------------|---------------|------------|-------|
| Parent Terms published with all Variants in Draft | Variant content is not shown to Client. Client sees the Terms entry but has no content to read or accept. | Client | Medium | Platform does not prevent this. Vendor responsibility. |
| Online Variant URL becomes unavailable after publishing | Platform does not validate URL availability. Client will encounter a broken link. | Client | Medium | Vendor is responsible for URL availability. |
| All Published Variants for a Terms object are unpublished while Terms remains Published | Same as above — Terms entry visible to Client but no content available. | Client | Medium | No cascade from Variant to Terms. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2026-03-08 | Stu | Initial canon. Derived from Terms Variant JSON examples (Online and File types) and conversation. |
| 0.2 | 2026-03-09 | Stu | BR-006 and BR-009 reconciled — cascade exception from parent Terms deletion made explicit and prominent. Deletion section updated. |
| 0.3 | 2026-03-09 | Stu | T4 corrected — Vendors cannot unpublish Terms Variants. Unpublish and Republish are Operations-only transitions. Section 2 and Section 7.1 updated accordingly. |
| 0.4 | 2026-03-14 | Stu | Schema review against OpenAPI extract. BR-005 updated: File type Variants always require a language code — multi-language not supported for File type. Section 5: required fields on creation documented, language and file upload requirements noted per type, Revision marked read-only. Section 8: audit uncertainty resolved — Variant uses PlatformObjectAudit (created/updated only) by design. T6 and Section 7.1: hard delete language corrected. Section 10: cleaned up. |
