# Object Canon: Terms

> **Version:** 0.5
> **Owner:** Stu
> **Last Updated:** 2026-07-16
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Terms

**Namespace:** Catalog

**Parent Object:** Catalog: Product

**ID Prefix:** TCS (confirmed via `preamble/PLATFORM_CANON_PREAMBLE.md` §5.3 and observed real object IDs, e.g. `TCS-2873-8874-0001`).

**Description:**
A Terms object represents a set of terms and conditions associated with a [[Product]] that a Client accepts during [[Order]] creation. Terms are part of the Product Definition and are scoped to the Product under which they are created. The Terms object itself carries the name, description, and display order; the actual content (an online reference or an uploaded file) is delivered through one or more child [[Terms Variant]]s. A Product may have multiple Terms objects, each representing a distinct set of terms (e.g. vendor terms and reseller terms). Acceptance is recorded at the Terms level, not the Variant level.

**Also Known As:**
Terms and Conditions.

---

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes | Yes | Yes | Yes — Draft state only | Full authoring ownership under the Vendor's own Products. Submits for review (`review`) and unpublishes, but cannot publish or republish — those are Operations-only (BR-010). |
| Operations | No | Yes | No | No | Reads all Terms. Publishes and republishes Terms; may also unpublish. Cannot create, update, or delete. |
| Client | No | Yes* | No | No | *Clients see Published Terms only, presented during Order creation for acceptance. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Draft | Terms created but not yet submitted for publishing. Visible to Vendor and Operations. Not visible to Client. The only state from which deletion is permitted (BR-009). | Yes | No |
| Pending | Vendor has submitted Terms for review. Awaiting Operations approval to publish. | No | No |
| Published | Terms are live. Visible to Client during Order creation. | No | No |
| Unpublished | Terms have been withdrawn from Client visibility. Visible to Vendor and Operations. Not terminal — may return to Pending for re-review or be republished directly. | No | No |
| Deleted | Terms permanently removed — no longer retrievable via the API. No Deleted status value is retained; the record ceases to exist. Reachable only from Draft (BR-009). | No | Yes |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Draft | Create Terms | `POST` (base collection endpoint) | Vendor | Name required (BR-011). | Terms created under the Product in Draft state. |
| T2 | Draft | Pending | Submit for Publishing | `review` (`POST .../{id}/review`) | Vendor | None | Terms enters the Operations review queue. |
| T3 | Pending | Published | Approve and Publish | `publish` (`POST .../{id}/publish`) | Operations | None | Terms visible to Client during Order creation. |
| T4 | Published | Unpublished | Unpublish | `unpublish` (`POST .../{id}/unpublish`) | Vendor, Operations | None | Terms withdrawn from Client visibility. |
| T5 | Unpublished | Published | Republish | `publish` (same route as T3) | Operations | None | Republish uses the same Operations-only action as the original Publish — not a separate Vendor-accessible one. |
| T6 | Unpublished | Pending | Submit for Publishing | `review` (same route as T2) | Vendor | None | The same action handles both `Draft -> Pending` and `Unpublished -> Pending`; lets a Vendor return Unpublished Terms to the review queue rather than republishing directly. |
| T7 | Draft | Deleted | Delete Terms | `DELETE /{id}` | Vendor | Terms must be in Draft state; the platform rejects the request otherwise. | Permanently removed — no longer retrievable via the API. |

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
| BR-001 | A Terms object belongs to exactly one [[Product]] and cannot be shared across Products. | All | All | — |
| BR-002 | A [[Product]] may have multiple Terms objects. All Published Terms on a Product are presented to the Client during [[Order]] creation. | All | All | — |
| BR-003 | Terms are presented to the Client in ascending displayOrder sequence during [[Order]] creation. | Published | Client | — |
| BR-004 | When an [[Order]] is placed against a [[Product]], every Published Terms on that Product is recorded as accepted on the resulting [[Agreement]]. The platform captures acceptance as a side effect of Order processing rather than blocking submission on a prior explicit acceptance step. | Published | Client | Any "must accept before submitting" gating is a function of the ordering UI / Vendor Extension, not the platform core. |
| BR-005 | Acceptance is recorded at the Terms level, not the Variant level. The acceptance record captures the Terms ID, a timestamp, and the accepting Actor. | Published | Client | Written onto the resulting [[Agreement]] on Order completion. |
| BR-006 | Only Published Variants are shown to the Client when Terms are presented for acceptance. A Published Terms object with no Published Variants is valid platform state — the Client sees the Terms entry but has no content to read. | Published | Client | The platform does not prevent this misconfiguration (preamble §3.1); the Vendor is responsible for ensuring at least one Published [[Terms Variant]] exists before a Client encounters the Terms. |
| BR-007 | Terms and their [[Terms Variant]]s have fully independent state machines. Publishing or unpublishing a Terms object does not affect its Variants, and vice versa. | All | All | — |
| BR-008 | Terms creation, modification, and deletion are not restricted by the state of the parent [[Product]]. | All | Vendor | — |
| BR-009 | Only Draft Terms may be deleted, and only by the Vendor. Published, Pending, and Unpublished Terms cannot be deleted. Deletion permanently removes the Terms — no longer retrievable via the API. | Draft | Vendor | — |
| BR-009a | Deleting a Terms object is intended to be blocked while it has any child [[Terms Variant]]s (they should be removed first). The platform core does not currently enforce this: deleting a Draft Terms neither checks for nor removes its Variants, leaving any Variants orphaned. | Draft | Vendor | Intent-vs-implementation gap. The platform never cascades deletions, so the Variants are not removed with the Terms — see Section 9. |
| BR-010 | A Vendor submits Terms for review (`review`) and may unpublish Published Terms, but only Operations can publish or republish Terms. | Pending, Published, Unpublished | Vendor (submit, unpublish), Operations (publish, republish, unpublish) | Mirrors the collaborative publication model of the parent [[Product]]. |
| BR-011 | Creating a Terms object requires a name; description and displayOrder are optional. | Draft (creation) | Vendor | Name maximum 128 characters. Description is optional (maximum 300 characters) and may be empty. displayOrder defaults to 100 when omitted, must be a positive integer, and is not required to be unique. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| Name | String | Display name of the Terms | Vendor | Yes | Required on creation. Maximum 128 characters. |
| Description | String | Short summary of what the Terms cover, displayed to the Client alongside the Terms name | Vendor | Yes | Optional. Maximum 300 characters; may be empty. Absent from response when null. |
| Display Order | Integer | Controls the sequence in which this Terms object is presented relative to other Terms on the same Product (ascending) | Vendor | Yes | Optional on creation — defaults to 100. Must be a positive integer; not required to be unique. |
| Status | Enum | One of: Draft, Pending, Published, Unpublished | System | Yes — via state transitions only | Does not include a Deleted value — see Section 3.1. |
| Revision | Integer | Increments on each update | System | No | Read-only. |
| Audit | Object | created, updated, pending, published, and unpublished events, each with timestamp and Actor attribution | System | No | Read-only. Absent sub-keys when the corresponding event has not occurred. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Product | Parent | Many:1 | A Terms object belongs to exactly one Product. | Yes — Terms cannot exist without a parent Product, and are removed when the parent Product is deleted (which the platform permits only while the Product is in Draft state). |
| Catalog: Product Terms Variant | Child | One:Many | A Terms object has zero or more Variants, each delivering the actual content (an online reference or an uploaded file) for a language. | Deleting a Draft Terms does not remove its Variants (BR-009a) — the platform does not cascade deletions. Terms and Variant state machines are independent (BR-007). |
| Commerce: Agreement | Association | Many:Many | Published Terms accepted during Order creation are recorded on the resulting Agreement, by Terms ID, timestamp, and accepting Actor. | No — removing Terms does not affect existing acceptance records on Agreements. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Terms created | Vendor creates Terms under a [[Product]] | Vendor | Terms enters Draft state. Publishes a creation event to the platform notification subsystem (Catalog module). |
| Terms submitted | T2 / T6 — Draft or Unpublished to Pending | Vendor | Terms enters the Operations review queue. Publishes a state-changed event. |
| Terms published | T3 — Pending to Published | Operations | Terms visible to Client during Order creation. Publishes a state-changed event. |
| Terms unpublished | T4 — Published to Unpublished | Vendor, Operations | Terms withdrawn from Client visibility. Variant states unaffected. Publishes a state-changed event. |
| Terms republished | T5 — Unpublished to Published | Operations | Terms restored to Client visibility. Publishes a state-changed event. |
| Terms updated | Any attribute change | Vendor | Revision incremented. Publishes an update event. |
| Terms deleted | T7 — Draft to Deleted | Vendor | Permanently removed — no longer retrievable via the API. Publishes a deletion event. |

> Terms publishes events to the platform notification subsystem on creation, update, deletion, and every state transition. These are available to the Notification subsystem for [[Webhook]] delivery (see preamble §8). The exact message structure is not documented at the PM level.

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Order placed against the Product | Commerce: Agreement | Every Published Terms on the Product is recorded as accepted on the resulting Agreement (Terms ID, timestamp, accepting Actor) | Yes | On Order creation/completion | Under the acting Actor's token context. Acceptance recorded at the Terms level, not the Variant level (BR-005). |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
- Published → Unpublished is reversible. No limit on cycles.
- Unpublished → Pending (re-review) is available as an alternative to direct republication.
- Draft → Pending cannot be undone by the Vendor — the only forward path is publication by Operations.

**Deletion:**
Only Draft Terms may be deleted, by the Vendor. Once deleted, permanently removed — no longer retrievable via the API; no Deleted status value is retained. The platform does not cascade deletions — deleting a Terms does not remove its [[Terms Variant]]s, and a variant-blocking guard is not currently enforced (BR-009a). Published, Pending, and Unpublished Terms cannot be deleted.

**Audit & history requirements:**
The Terms audit object records created, updated, pending, published, and unpublished events, each with a timestamp and the attributed Actor. Creation, update, deletion, and every state transition publish an event to the platform notification subsystem (Catalog module). Full attribute history is retained via the platform Audit Trail — see Audit: Audit Record canon (pending canonisation).

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Terms Published with no Published Variants | The Terms entry is shown to the Client during Order creation but no content is available to read. | Client | Medium | The Vendor is responsible for ensuring Published [[Terms Variant]]s exist before Client exposure. The platform does not prevent this (BR-006). |
| A Draft Terms with child Variants is deleted | The platform permits the deletion (no variant-blocking guard is enforced) and does not cascade — the Variants are left orphaned. | Vendor | Medium | BR-009a documents this as an intent-vs-implementation gap. The Vendor should delete Variants first. |
| Terms remain in Pending indefinitely (Operations never acts) | Terms stay in Pending. The Vendor can submit and unpublish but cannot publish (BR-010). | Vendor | Medium | Operational process dependency; no system-level resolution path. |
| Terms unpublished after a Client has already accepted them on an Agreement | Existing acceptance records on Agreements are unaffected. The Terms are simply no longer presented to new Clients. | None | Low | Acceptance is a historical record; it is not invalidated by later Terms state changes. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-03-08 | Stu | Initial canon. Derived from Terms and Variant JSON examples and conversation. |
| 0.2 | 2026-03-09 | Stu | "Re-publish" normalised to "Republish" throughout for consistency. |
| 0.3 | 2026-03-09 | Stu | T4 corrected — Vendors cannot unpublish Terms. Unpublish and Republish are Operations-only transitions. Section 2 and Section 7.1 updated accordingly. |
| 0.4 | 2026-03-14 | Stu | Schema review against OpenAPI extract. Section 5: required fields on creation noted, Revision marked read-only. Section 8: unpublished audit event added. T6: hard delete language corrected. Section 10: cleaned up. |
| 0.5 | 2026-07-16 | Stu / canon-generate | Full refresh via live OpenAPI schema (STAGING), live-fetched real objects (multi-Actor; a Published and an Unpublished Terms), and source-code research. ID Prefix corrected (was "None", is TCS). §3.2 endpoints filled (`review`/`publish`/`unpublish`/`DELETE`), replacing "Unconfirmed"; new T6 transition (Unpublished→Pending via `review`, Vendor). **Significant corrections**: unpublish is Vendor **or** Operations, reversing the v0.3 "Operations-only, Vendor cannot unpublish" claim (only republish — the `publish` action — is Operations-only); `description` is optional, not required (BR-011, Section 5); `displayOrder` is optional (defaults to 100), positive, non-unique. BR-004 reframed — the platform auto-records acceptance of all Published Terms onto the Agreement during Order processing rather than gating submission on prior acceptance. BR-009a reframed — the variant-blocking delete guard is intended but not enforced (deleting a Draft Terms orphans its Variants). Deletion is a permanent removal (no retained Deleted status). Terms publishes notification-subsystem events (Section 7). Confirmed Terms↔Variant independence (BR-007) and that Terms are removed on parent-Product deletion (Section 6). Also Known As reduced to "Terms and Conditions". |
