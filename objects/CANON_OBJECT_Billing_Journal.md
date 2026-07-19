# Object Canon: Journal

> **Version:** 0.2
> **Owner:** Stu
> **Last Updated:** 2026-07-19
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Journal

**Namespace:** Billing

**Parent Object:** None — top-level object.

**ID Prefix:** BJO

**Description:**
A Journal is the entry point of the platform's billing pipeline: the normalized set of billing charges a Vendor submits for one [[Authorization]] and one billing period. A Vendor creates it in the scope of a single [[Authorization]], which fixes the Vendor [[Account]], the [[Product]], the owning [[Seller]], the currency, and the submission cadence; the Vendor then uploads charge data, which the platform validates and enriches with matched commercial identities. Once the Vendor submits the Journal to SoftwareOne, the Operations Actor reviews it and either returns it to the Vendor for clarification or accepts it. Accepting a Journal rates its charges into one [[Ledger]] per Seller, and the Journal completes automatically when all of its Ledgers complete.

**Also Known As:**
Billing journal. The upload template Vendors normalize their raw data into is referred to as the "Journal template" (v2.0).

---

## 2. Ownership & Visibility

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor     | Yes | Yes | Yes | Yes | Creates the Journal, uploads charge data, and submits it to SoftwareOne. Cannot see sell-side pricing (markup, margin, total sale price), the processing summary, or the backup summary. Delete is state-guarded — see BR-011. |
| Operations | No | Yes | Yes | No | Cannot create or delete a Journal. Reviews and adjudicates a submitted Journal — return to vendor (enquiry), accept, regenerate, recalculate, reset — and may re-upload charge data. Full field visibility. |
| Client     | No | No | No | No | A Journal is never readable by the Client Actor (BR-015); client-facing billing figures surface downstream via the Statement (not yet canonised), not the Journal. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Draft | Journal created; awaiting a charge-data upload. | Yes | No |
| Validating | Uploaded charges are being processed, enriched, and validated. Transient. | No | No |
| Validated | All charges processed with no upload errors; ready for the Vendor to submit to SoftwareOne. | No | No |
| Error | Charge processing finished with one or more errors, or a critical processing failure occurred. | No | No |
| Review | Submitted to SoftwareOne; awaiting Operations adjudication. | No | No |
| Enquiring | Returned to the Vendor for clarification or correction. | No | No |
| Reconciling | An Operations reconciliation action on one or more charges is in progress; awaiting recalculate. | No | No |
| Generating | Accepted; Ledgers are being created (one per Seller). Transient. | No | No |
| Generated | All Ledgers created; awaiting per-Ledger review and acceptance. | No | No |
| Accepted | All Ledgers generated. | No | No |
| Queued | Ledgers queued for downstream statement issuance. | No | No |
| Resetting | A reset is removing generated Ledgers and their Statements. Transient. | No | No |
| Completed | All Ledgers completed; the Journal is finalised. | No | Yes |
| Deleted | Permanently removed — no longer retrievable via the API. | No | Yes |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Draft | Create | `POST` (base collection endpoint) | Vendor | None | Name and Authorization required. |
| T2 | Draft | Validating | Upload charge data | `upload` | Vendor / Operations | A charge file has been registered on the Journal. | XLSX or JSONL. |
| T3 | Validated | Validating | Re-upload charge data | `upload` | Vendor / Operations | — | Replaces prior charges. |
| T4 | Error | Validating | Re-upload charge data | `upload` | Vendor / Operations | — | Replaces prior charges. |
| T5 | Enquiring | Validating | Re-upload charge data | `upload` | Vendor / Operations | — | Replaces prior charges. |
| T6 | Validating | Validated | Validation completed, no errors | system (automatic) | — | No charge upload errors. | — |
| T7 | Validating | Error | Validation completed with errors | system (automatic) | — | One or more charges failed processing, or a critical failure. | — |
| T8 | Validating | Review | Re-processing completed | system (automatic) | — | Reached via regenerate or recalculate (re-process straight to Review). | — |
| T9 | Validated | Review | Submit to SoftwareOne | `submit` | Vendor | — | — |
| T10 | Enquiring | Review | Submit to SoftwareOne | `submit` | Vendor | — | Re-submission after clarification. |
| T11 | Review | Enquiring | Return to vendor | `enquiry` | Operations | — | — |
| T12 | Review | Reconciling | Reconcile a charge | charge match / ignore / reset action (no dedicated Journal endpoint) | Operations | A reconciliation action is performed on a child Charge. | Journal must be in Review or Reconciling. |
| T13 | Reconciling | Validating | Recalculate charges | `recalculate` | Operations | — | Re-processes reconciled charges, then to Review (T8). |
| T14 | Review | Validating | Regenerate charges | `regenerate` | Operations | — | Re-processes charges, then to Review (T8). |
| T15 | Generated | Validating | Regenerate charges | `regenerate` | Operations | — | Re-processes charges, then to Review (T8). |
| T16 | Review | Generating | Accept | `accept` | Operations | — | Creates one Ledger per Seller. |
| T17 | Generating | Generated | Ledger creation succeeded | system (automatic) | — | All Ledgers created. | — |
| T18 | Generating | Review | Ledger creation failed | system (automatic) | — | Returns to Review with an error. | — |
| T19 | Generated | Accepted | All Ledgers generated | system (automatic) | — | Driven by the Ledger lifecycle. | — |
| T20 | Generated | Queued | Ledgers queued | system (automatic) | — | Queueing a Ledger sets the Journal to Queued directly, without requiring Accepted first (intended). | — |
| T21 | Accepted | Queued | Ledgers queued | system (automatic) | — | Driven by the Ledger lifecycle. | — |
| T22 | Queued | Completed | All Ledgers completed | system (automatic) | — | Terminal roll-up. | — |
| T23 | Generated | Resetting | Reset | `reset` | Operations | — | — |
| T24 | Accepted | Resetting | Reset | `reset` | Operations | — | — |
| T25 | Resetting | Review | Reset completed | system (automatic) | — | Ledgers and their Statements removed. | On failure the Journal reverts to its pre-reset state (Generated or Accepted). |
| T26 | Draft | Deleted | Delete | `delete` | Vendor | — | Also removes child Charges and Attachments (BR-011). |
| T27 | Validated | Deleted | Delete | `delete` | Vendor | — | Also removes child Charges and Attachments (BR-011). |
| T28 | Error | Deleted | Delete | `delete` | Vendor | — | Also removes child Charges and Attachments (BR-011). |
| T29 | Enquiring | Deleted | Delete | `delete` | Vendor | — | Also removes child Charges and Attachments (BR-011). |

### 3.3 State Diagram

```
                          (Create : Vendor)
                                 |
                                 v
                              [Draft] ----------(delete : Vendor)---------> [Deleted]
                                 |
                  (upload : Vendor/Operations)
                                 v
                          [Validating] --(system, errors)--> [Error] --(upload)--> [Validating]
                                 |                               |
                    (system, no errors)                    (delete : Vendor) --> [Deleted]
                                 v
                           [Validated] --(delete : Vendor)--> [Deleted]
                                 |
                       (submit : Vendor)
                                 v
   [Enquiring] <--(enquiry : Operations)-- [Review] --(accept : Operations)--> [Generating]
        |  ^                                  |  ^                                   |
 (submit:Vendor)                    (regenerate/recalculate : Operations)   (system, all created)
        |  |                                  |  |  \--(charge recon)--> [Reconciling]     v
        v  |                                  |  |                            |       [Generated]
   [Review]|                             [Validating] <--(recalculate)--------/          |
        |  \--(delete : Vendor)-->[Deleted]   |                                (system, all generated)
        |                                (system) --> [Review]                            v
        |                                                                            [Accepted]
        |                                                                                 |
   (regenerate from Generated : Operations) --> [Validating]                     (system, queued)
                                                                                          v
   [Generated]/[Accepted] --(reset : Operations)--> [Resetting] --(system)--> [Review]  [Queued]
                                                                                          |
                                                                          (system, all Ledgers completed)
                                                                                          v
                                                                                     [Completed]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Journal is created in the scope of exactly one [[Authorization]]. The Vendor [[Account]], [[Product]], owning [[Seller]], and currency are derived from that Authorization. | All | All | The Authorization also defines the submission cadence via its Due Date. |
| BR-002 | Only the Vendor Actor may create a Journal. | N/A (creation) | Vendor | Operations can upload and update an existing Journal but cannot create one. |
| BR-003 | Creating a Journal requires a Name and an Authorization; Due Date, the vendor external ID, and notes are optional. | Draft | Vendor | — |
| BR-004 | Charge data is supplied by uploading an XLSX or JSONL file to the Journal; upload is permitted only in Draft, Validated, Error, or Enquiring and moves the Journal to Validating. | Draft, Validated, Error, Enquiring | Vendor, Operations | Re-uploading replaces the Journal's existing charges. |
| BR-005 | The `submit` action moves a Journal to Review (submission to SoftwareOne) and is restricted to the Vendor Actor. | Validated, Enquiring | Vendor | — |
| BR-006 | Review-stage adjudication is Operations-only: enquiry (return to vendor), accept, regenerate, recalculate, and reset are all Operations actions. | Review, Reconciling, Generated, Accepted | Operations | The Vendor cannot accept, reject, or recalculate a submitted Journal. |
| BR-007 | Accepting a Journal generates one [[Ledger]] per Seller that has charges in it, and moves the Journal to Generating. | Review | Operations | The set of Sellers is exposed via the Journal's `sellers` sub-resource. |
| BR-008 | A Journal rolls up automatically once accepted: Generated when all Ledgers are created, Accepted when all Ledgers are generated, Queued when Ledgers are queued, and Completed when all Ledgers complete. A Journal may move to Queued directly from Generated — queueing a Ledger sets the Journal to Queued without first requiring Accepted. | Generating, Generated, Accepted, Queued | System | Driven by the Ledger lifecycle, not by a Journal endpoint. |
| BR-009 | Reconciling a charge (match, ignore, or reset) requires the Journal to be in Review or Reconciling and moves it to Reconciling; recalculate then re-processes the reconciled charges and returns the Journal to Review. | Review, Reconciling | Operations | Reconciliation actions are performed on the child Charge, not the Journal. |
| BR-010 | A charge may be matched only to an [[Agreement]], [[Subscription]], or [[Asset]] whose Authorization matches the Journal's Authorization; a [[Subscription]] with split billing enabled cannot be used as a match target. | Reconciling | Operations | Detailed matching semantics belong to the Charge canon. |
| BR-011 | A Journal may be deleted only in Draft, Validated, Error, or Enquiring, and only by the Vendor Actor. Deletion also permanently removes the Journal's child Charge entries and Attachment files — no longer retrievable via the API. This is a documented exception to Preamble Invariant 6. | Draft, Validated, Error, Enquiring | Vendor | A Journal that has entered Review or any later state cannot be deleted. |
| BR-012 | Resetting a Journal permanently removes the Ledgers generated from it and those Ledgers' Statements, then returns the Journal to Review. | Generated, Accepted | Operations | On reset failure the Journal reverts to its pre-reset state. |
| BR-013 | An Operations reviewer may be recorded on the Journal via the assignee field; only the Operations Actor may set it. | All | Operations | — |
| BR-014 | Sell-side pricing (markup, margin, total sale price) and the processing and backup summaries are visible only to the Operations Actor. | All | All | The Vendor sees purchase-price totals, currency, and the upload summary. See Section 5. |
| BR-015 | A Journal is never readable by the Client Actor in any state. | All | Client | Client-facing billing surfaces only via the Statement (not yet canonised), never the Journal. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| id | String | Unique identifier, format `BJO-NNNN-NNNN`. | System | No | — |
| name | String | Human-readable Journal name. | Vendor | Yes | Required at creation. |
| description | String | Free-text description of the Journal. | Vendor / Operations | Yes | Absent from response when null. |
| notes | String | Additional notes or comments. | Vendor / Operations | Yes | Absent from response when null. |
| status | Enum | Current lifecycle state — one of the Section 3.1 states. | System | Yes | Changes only through the Section 3.2 transitions, never by a direct field write. |
| externalIds.vendor | String | The Vendor's own reference for this Journal. | Vendor | Yes | Absent from response when null. |
| externalIds.operations | String | An Operations-side external reference. | Operations | Yes | Absent from response when null. |
| authorization | Reference | The Authorization the Journal is billed under. | Vendor | No | Required at creation; fixes vendor, product, owner, and currency — see BR-001. |
| vendor | Reference | The Vendor Account. | System | No | Derived from the Authorization. |
| product | Reference | The Product being billed. | System | No | Derived from the Authorization. |
| owner | Reference | The owning Seller — always the Authorization's Seller. | System | No | The Journal's charges may span multiple Sellers, each of which yields a Ledger on accept. |
| dueDate | Date-time | The billing due date for the period. | Vendor / Operations | Yes | Cadence is defined by the Authorization. |
| assignee | Reference | The Operations reviewer assigned to the Journal. | Operations | Yes | Operations-set only. Absent from response when null. |
| price | Object | Pricing summary: currency, total purchase price (totalPP), total sale price in buyer currency (totalBSP), markup, margin. | System | Yes | markup and margin are Operations-only; totalBSP is not visible to the Vendor; totalPP and currency are visible to the Vendor. Recalculated on each processing run. See BR-014. |
| upload | Object | Upload summary: total, split, ready, error counts from the latest upload. | System | Yes | Visible to Vendor and Operations. |
| processing | Object | Processing summary: total, ready, error, split, skipped, ignored counts. | System | Yes | Visible to Operations only; omitted for the Vendor. |
| backup | Object | Backup summary: status and date of the Journal's data backup. | System | Yes | Visible to Operations only. |
| error.code / error.message | Object | The current error code and message, when the Journal is in an error condition. | System | Yes | Visible to Vendor and Operations. Absent from response when null. |
| audit | Object | Created/updated events plus a per-status event history (Draft, Validating, Validated, Error, Review, Enquiring, Generating, Generated, Accepted, Completed, Deleted). | System | Yes | — |
| revision | Integer | Monotonic revision counter. | System | Yes | Increments on each change. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Authorization | Parent | Many Journals to one Authorization | The Journal is billed under, and derives its scope from, one Authorization. | A Journal cannot exist without its Authorization. |
| Catalog: Product | Association | Many Journals to one Product | The Product being billed, derived from the Authorization. | Reference only. |
| Accounts: Account | Association | Many Journals to one Vendor Account | The Vendor Account that owns the Journal, derived from the Authorization. | Reference only. |
| Accounts: Seller | Association | Many Journals to one owning Seller; charges may span many Sellers | The owning Seller, and the distinct Sellers whose charges the Journal contains (one Ledger is created per such Seller). | Reference only. |
| Billing: Charge | Child | One Journal to many Charges | The Journal's normalized billing entries. | Charges are removed when the Journal is deleted (BR-011). |
| Billing: Journal Attachment | Child | One Journal to many Attachments | The raw and normalized reconciliation files uploaded for the Journal. | Attachments are removed when the Journal is deleted (BR-011). |
| Billing: Ledger | Child | One Journal to one Ledger per Seller | Created by accepting the Journal; the Journal completes when all its Ledgers complete. | Ledgers (and their Statements) are removed when the Journal is reset (BR-012). |
| Commerce: Agreement | Association | A charge matches to one Agreement | A charge-matching target; must share the Journal's Authorization. | Reference only. |
| Commerce: Subscription | Association | A charge matches to one Subscription | A charge-matching target; must share the Journal's Authorization. | Reference only. |
| Commerce: Asset | Association | A charge matches to one Asset | A charge-matching target; must share the Journal's Authorization. | Reference only. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Charge data uploaded | `upload` | Vendor, Operations | Prior charges are cleared and the uploaded file is processed asynchronously — charges are extracted, enriched with matched commercial identities, and the upload/processing/price summaries are populated. |
| Status changed | Any transition in Section 3.2 | Vendor, Operations, System | A status-changed event is published to the platform notification bus (see Preamble Section 8) and the corresponding per-status audit event is recorded. |
| Charge reconciled | Charge match / ignore / reset | Operations | Moves the Journal to Reconciling; the reconciliation is applied to the child [[Asset]], [[Subscription]], or [[Agreement]] linkage on the Charge. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Accept | Billing: Ledger | One [[Ledger]] is created per [[Seller]] with charges in the Journal. | Yes (Operations token context) | Journal in Review. | — |
| Ledger lifecycle progression | Billing: Journal | The Journal rolls up to Generated → Accepted → Queued → Completed as its [[Ledger]]s progress. | Yes (System) | Driven by the Ledger states. | See BR-008. |
| Reset | Billing: Ledger, Billing: Statement | The Journal's Ledgers and their Statements are permanently removed. | Yes (Operations token context) | Journal in Generated or Accepted. | See BR-012. |
| Delete | Billing: Charge, Billing: Journal Attachment | The Journal's Charge entries and Attachment files are permanently removed. | Yes (Vendor token context) | Journal in Draft, Validated, Error, or Enquiring. | See BR-011. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
- Review → Enquiring → Review is reversible: Operations returns a Journal to the Vendor (enquiry), and the Vendor re-submits (submit). No limit on cycles.
- Validated / Error / Enquiring → Validating is reversible via re-upload, replacing the Journal's charges.
- Generated / Accepted → Review is reachable via reset, which permanently removes the generated [[Ledger]]s and their Statements (see BR-012).
- Completed and Deleted are terminal — neither can be reversed.

**Deletion:**
A Journal may be deleted by the Vendor Actor only while it is in Draft, Validated, Error, or Enquiring. Once deleted, it is permanently removed — no longer retrievable via the API. Deletion also permanently removes the Journal's child [[Charge]] entries and [[Journal Attachment]] files (no longer retrievable via the API) — a documented exception to Preamble Invariant 6's no-cascade rule. A Journal that has entered Review or any later state cannot be deleted; it must be reset first where reset is permitted.

**Audit & history requirements:**
The Journal records a created and updated event plus a per-status event history (the timestamp and Actor for the most recent entry into Draft, Validating, Validated, Error, Review, Enquiring, Generating, Generated, Accepted, Completed, and Deleted). Every transition also publishes a status-changed event to the platform notification bus. Re-uploading fully replaces the Journal's charges; prior uploaded charge sets are not retained beyond the audit event trail.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Upload contains charges that fail processing | The Journal moves to Error with an error code and message; the Vendor must correct and re-upload. | Vendor | Medium | The Journal is not submittable to SoftwareOne while in Error. |
| Reset after Ledgers and Statements exist | Reset permanently removes the generated [[Ledger]]s and their Statements before returning the Journal to Review; downstream Statement data is lost and must be regenerated. | Operations, Client | High | Statement not yet canonised. |
| Delete removes child records | Deleting a Journal in a deletable state permanently removes its Charges and Attachments. | Vendor | Medium | Guarded once the Journal reaches Review. |
| Journal enters Queued directly from Generated | Queueing a Ledger sets the Journal to Queued directly, without first passing through Accepted. | Operations | Low | Intended behaviour (BR-008); a Journal may reach Queued from either Generated or Accepted. |
| Charge matched to a valid but incorrect [[Agreement]] / [[Subscription]] / [[Asset]] | The platform enforces that the match target shares the Journal's Authorization but does not otherwise prevent an incorrect-yet-valid match. | Operations | Medium | Consistent with the platform's permissive-by-default philosophy (Preamble Section 3.1). |
| Client attempts to read a Journal | The request is refused in every state. | Client | Low | Journals are never client-readable (BR-015); client-facing figures surface via the Statement, not the Journal. |

---

## 10. Open Questions

> The following are unresolved candidate questions from this generation run, pending PM/engineering confirmation.

- [ ] [BJO-005]: The action policy restricts Journal creation to the Vendor Actor, but business context describes Operations acting "on behalf of the Vendor." Is there a separate Operations path for injecting billing data (e.g. a manual-upload / custom-ledger flow), and if so is it a distinct object rather than a Journal? Source research during the Ledger batch found a distinct **Custom Ledger** object (its own controller, create/upload/accept/queue/delete actions, and status enum, with no Journal parent) that is very likely this path — to be confirmed when Custom Ledger is canonised.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.2 | 2026-07-19 | Stu / canon-generate-batch | Billing: Ledger now canonised — bracket-linked the `[[Ledger]]` cross-references (Section 1, BR-007, Section 7, Section 8, Section 9) and dropped the stale "not yet canonised" notes (Section 1, BR-007, Section 6). BJO-005 annotated with the Custom Ledger lead surfaced during the Ledger batch. No behavioural change. |
| 0.1 | 2026-07-19 | Stu / canon-generate-batch | Initial draft generated from the PROD OpenAPI schema, a live multi-Actor PROD fetch, an Actor-suppression diff, and billing source research. Full state machine derived from source (14 states; upload/submit/enquiry/accept/regenerate/recalculate/reset/delete verbs and the automatic Ledger-driven roll-up to Completed). Actor authority, sell-side field suppression, and the delete-removes-Charges-and-Attachments and reset-removes-Ledgers-and-Statements behaviours documented. Client visibility confirmed (Journals are never client-readable), owner Seller confirmed as the Authorization's Seller, re-upload confirmed to fully replace prior charges, and the Generated→Queued roll-up confirmed intended. Delete-removes-child-Charges-and-Attachments recorded as a Preamble Invariant 6 exception. One open question (BJO-005: a possible Operations manual-upload/custom-ledger path). |
</content>
</invoke>
