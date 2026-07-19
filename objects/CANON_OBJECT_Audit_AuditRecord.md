# Object Canon: Audit Record

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-19
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Audit Record

**Namespace:** Audit

**Parent Object:** None — top-level object.

**ID Prefix:** AUD

**Description:**
An Audit Record is a single, immutable log entry capturing a significant change or action on a platform object. The Audit namespace is platform-wide (preamble §4): records are produced for objects across every namespace — an [[Agreement]] update, a [[User]] login, an [[Account]] module change, and so on. Most records are generated automatically by the platform when an object event occurs, but the record can also be submitted through the API by an automation or extension that needs to log a business-critical action, including actions on objects the platform does not itself persist. Each record identifies what happened, which object it concerned, who did it, and — for public records — which accounts are permitted to see it. Every record belongs to exactly one [[Event Type]], which classifies the kind of event it represents.

**Also Known As:**
Audit Trail entry; audit log entry.

---

## 2. Ownership & Visibility

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor     | Yes (conditional) | Yes (linked records only) | No | No | May submit records only for objects it is already linked to as a viewer (see BR-007); submitted event names must use the extension format (BR-004). Reads only records whose account links include its own account. |
| Operations | Yes | Yes (all records) | No | No | May submit records for any object, including explicitly Private records (BR-008). Reads every record regardless of account links. |
| Client     | No | Yes (linked public records only) | No | No | Cannot submit records. Reads only public records whose account links include its own account. |

Most records are created automatically by the platform from object events rather than by any Actor's API call; the "Can Create" column reflects the API submission path (BR-002, BR-003). No Actor can update or delete an Audit Record — records are append-only and immutable (BR-001). Separately, an individual may read Audit Records whose target object is their own identity (e.g. their own login records), regardless of account links (BR-016).

---

## 3. State Machine

This object has no state machine. It is created as a unit and never changes afterward — there is no API operation that updates or deletes an Audit Record. What controls who can see a given record is its type (Private or Public) and its account links, not any lifecycle state (see Section 4).

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An Audit Record is immutable once created. No API operation modifies or removes an existing record. | N/A | All | The API surface exposes only creation (POST) and read (GET); there is no update or delete endpoint. |
| BR-002 | Records are created by one of two paths: automatically by the platform when a significant object event occurs, or by API submission from an automation or extension. | N/A | All | Automatic records are the common case; API submission covers business-critical actions the standard events do not, including events on objects the platform does not persist. |
| BR-003 | API submission is permitted only to the Vendor and Operations Actors. The Client Actor cannot submit a record. | N/A | Vendor, Operations | — |
| BR-004 | A submitted record's event identifier must follow the `extensions.<extension>.<event>` format. | N/A | Vendor, Operations | Platform-generated records instead use a `platform.<namespace>.<object>.<action>` identifier (e.g. `platform.commerce.agreement.updated`). Each distinct identifier corresponds to one [[Event Type]]. |
| BR-005 | On submission, the record's identifier, timestamp, actor, and technical request details are set by the platform, not by the submitter. The summary, details, event identifier, target object, and structured data are supplied by the submitter. | N/A | Vendor, Operations | Summary and details must be non-empty. Any submitter-provided id is rejected. |
| BR-006 | A submitted record must identify its target object, either by an explicit object reference or by exactly one recognised platform object in its structured data. The object reference must resolve to a known platform object type. | N/A | Vendor, Operations | If structured data contains zero or more than one recognised platform object and no explicit object is given, the submission is rejected. |
| BR-007 | A non-Operations submitter may append a record only to an object it can already see; the target object must have an existing record whose account links include the submitter's account. Operations may append to any object. | N/A | Vendor, Operations | A submission targeting an object with no existing record, or one the Vendor is not linked to, is rejected as unauthorized. |
| BR-008 | A submitted record inherits its account links and type (Private/Public) from the object's most recent record — a submitter cannot set arbitrary visibility. The sole exception: Operations may submit an explicitly Private record, visible to Operations only. | N/A | Vendor, Operations | Prevents an extension from widening or narrowing who can see an object's audit history beyond what the object's existing records already permit. |
| BR-009 | A record's type is Private or Public. Private records are visible to Operations only. Public records are visible to Operations plus the linked Vendor and/or Client accounts. | N/A | All | Type is derived from the account links: a record is Public when any linked account is a Vendor or Client account, otherwise Private. The Operations account link is always present. |
| BR-010 | Read visibility is enforced by account link: Operations reads all records; Vendor and Client read only records whose account links include their own account. | N/A | All | A record not linked to the requesting Vendor/Client account is not returned (including a direct fetch by ID, which returns not-found). |
| BR-011 | Within a public record's structured data, individual fields may be hidden from the Vendor and/or Client. The same field-visibility rules that apply to the referenced object apply to its representation inside the record. | N/A | All | For example, sales-pricing fields (margin, markup, and derived sell prices) on an [[Agreement]] snapshot are hidden from Vendor and Client, consistent with preamble §6.3. |
| BR-012 | Sensitive credential fields carried in structured data are masked. A [[User]] password and an [[API Token]] secret are never exposed in an Audit Record's structured data. | N/A | All | Applies to every Actor, including Operations. |
| BR-013 | There is no distinct "deleted" record. The permanent removal of an object is logged as an ordinary status-change event recording the object's move to a deleted status. | N/A | All | Consistent with the platform's append-only audit model — deletion of an object is a status change, not a separate record kind. |
| BR-014 | Each record carries the revision number of its target object as at the time of the event, tying the record to a specific version of that object. | N/A | All | — |
| BR-015 | Summary and details are free-form text. The platform does not validate their semantic accuracy against the event. | N/A | All | They may contain templated placeholders resolving to object and actor references for navigation (e.g. `{{agreement.id}}`, `{{actor.name}}`). |
| BR-016 | Beyond the three Actors' account-link visibility, an individual may read Audit Records whose target object is their own [[User]] identity — for example, a person can see their own login records — even where no account link would otherwise grant that access. | N/A | All | A self-view read path over records about oneself; it does not expose records about other objects or identities. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| id | string | Unique record identifier, prefix `AUD`. | Platform | No | Four-segment form, e.g. `AUD-0698-3933-8032-5660`. |
| event | string | Identifier of the Event Type this record represents. | Submitter (extension format) / Platform (standard) | No | See BR-004 for the two naming forms. |
| type | enum | Visibility class of the record. | Platform (derived from account links) | No | Values: `Private`, `Public`. See BR-009. |
| summary | string | Short free-form description of the event. | Submitter / Platform | No | Required non-empty on submission. May contain templated references (BR-015). |
| details | string | Longer free-form description of the event. | Submitter / Platform | No | Required non-empty on submission. May contain templated references (BR-015). |
| object | reference | The primary platform object the event concerns — id, name, and object type. | Submitter / Platform | No | The object type is any platform object across any namespace. See BR-006. |
| timestamp | date-time | When the event occurred. | Platform | No | Set by the platform on creation; not submitter-controlled. |
| actor | reference | The identity the event is attributed to — a [[User]] or an [[API Token]] — together with its account (id, name, type). | Platform | No | When the triggering event carries no attributable identity, the actor is recorded as a system "Unknown" actor. |
| accountLinks | array | The accounts permitted to view the record (the record's viewers). | Platform | No | Operations always present. Vendor and/or Client present only on public records. Drives read visibility (BR-010) and type (BR-009). Omitted by default from list responses — request via `select=+`. |
| documents | object | Structured-data snapshot: a point-in-time JSON representation of the referenced object(s) at the event's revision. | Submitter / Platform | No | Omitted by default from list responses — request via `select=+`. Subject to per-actor field masking (BR-011) and credential masking (BR-012). |
| request | object | Technical context of the event: IP address, derived geolocation, user agent, and correlation identifiers. | Platform | No | Geolocation is derived from the IP and absent when it cannot be resolved. Absent sub-fields are absent from the response when null. |
| revision | integer | Revision of the target object as at the event. | Platform | No | See BR-014. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Audit: Event Type | Association | Many records → one Event Type | Each record's `event` classifies it under one Event Type. Creating a record ensures the corresponding Event Type exists. | No — records reference the Event Type by identifier; the Event Type is not deleted when records exist. |
| Accounts: Account | Association | Many records ↔ many accounts | A record's account links reference the accounts permitted to view it; the actor's account also references an Account. | No — account links are a point-in-time reference. Deleting an account does not delete records. |
| Accounts: User | Association | Many records → zero or one User | When the actor is an interactive identity, it references a User. | No — the actor is captured as a snapshot; the record persists if the User is removed. |
| Accounts: API Token | Association | Many records → zero or one API Token | When the actor is a programmatic identity, it references an API Token. | No — the actor is captured as a snapshot; the record persists if the token is removed. |
| Commerce: Agreement | Association | Many records → zero or one Agreement | Example of a target object: agreement events produce records referencing and snapshotting the Agreement. Any platform object can be a target. | No — the record retains a snapshot; deleting the Agreement does not delete the record (see Section 9). |

The target object and structured-data snapshot may reference any platform object in any namespace; Commerce: Agreement is listed as a representative example, not the only permitted target.

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Record generated from platform event | A significant, non-silent object event is published to the platform message bus | Platform (under the triggering Actor's context) | A record is written; the record's [[Event Type]] is registered if it does not yet exist. |
| Record submitted via API | An automation or extension acting as Vendor or Operations submits a record | Vendor, Operations | The record is written after access and inheritance checks (BR-006, BR-007, BR-008); its Event Type is registered if new; geolocation is derived from the request IP. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Record created | Event Type | The record's Event Type is created if it does not already exist | Yes (under the record-creating Actor's context) | Event Type for that `event` identifier not already registered | Ensures every record's Event Type is discoverable. |

Creating an Audit Record has no effect on the state of its target object or any other business object — the record is a downstream observation, not a driver of other objects' lifecycles.

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
None — an Audit Record has no state machine and no transitions to reverse.

**Deletion:**
An Audit Record cannot be deleted in any state. The API exposes no delete operation, and records are immutable once written (BR-001).

**Audit & history requirements:**
Audit Records *are* the platform's audit trail; no separate history mechanism sits above them. Each record is an immutable, point-in-time snapshot that captures the referenced object's structured data at the record's revision (BR-014), so an object's audit history is the ordered set of records referencing it. Because records are never mutated, prior versions of an object's content are preserved within the records that captured them, independent of the live object.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| The target object of a record is later permanently removed | The record and its structured-data snapshot persist, but live navigation from the record's object/actor reference to the removed object no longer resolves | Vendor, Operations, Client | Low | The audit history remains intact; only live drill-through to the removed object breaks. |
| An extension submits a public record whose structured data contains data that should not reach a linked Vendor or Client | The platform applies field and credential masking (BR-011, BR-012) but does not otherwise judge business sensitivity; unmasked fields are exposed to every linked account | Vendor, Client | Medium | Each public record must be designed deliberately — the submitting extension decides which structured-data fields to include and which to hide from Vendor and/or Client. |
| An extension submits a record with a summary or details that misdescribe the event | The record is stored as submitted; the platform does not validate semantic accuracy (BR-015) | Vendor, Operations, Client | Low | Permissive by default (preamble §3.1); an inaccurate entry can mislead readers of the audit trail. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-19 | Stu / canon-generate-batch | Initial draft from OpenAPI schema, live multi-Actor STAGING fetch, Actor-suppression diff, source research, and the Audit Trail business-context page. Documents the append-only immutable model, the automatic-vs-extension creation paths, Private/Public visibility via account links, per-actor structured-data masking, credential masking, and the self-view read path for records targeting one's own identity (BR-016). 0 open questions. |
