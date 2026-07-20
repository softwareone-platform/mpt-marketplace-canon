# Object Canon: Ledger

> **Version:** 0.2
> **Owner:** Stu
> **Last Updated:** 2026-07-20
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Ledger

**Namespace:** Billing

**Parent Object:** None — top-level object.

**ID Prefix:** BLE

**Description:**
A Ledger is the per-Seller rating output of the platform's billing pipeline, sitting between the [[Journal]] and the [[Statement]] (the pipeline is Journal → Ledger → Statement). When the Operations Actor accepts a [[Journal]], the platform generates one Ledger for each [[Seller]] whose [[Charge]] entries appear in that Journal, and rates those charges into the Ledger scoped to that one Seller. A Ledger inherits its [[Authorization]], [[Product]], owning [[Seller]], and currency from its parent Journal; it carries the rated pricing roll-ups and a processing summary for its slice of the Journal's charges. Operations reviews each rated Ledger and accepts it, which produces the client-facing Statements; the Ledger then queues for ERP integration and completes automatically once all of its Statements complete. A Ledger is not created or deleted directly through the API — it exists only as a consequence of its Journal's lifecycle.

**Also Known As:**
Billing ledger; seller ledger. Distinct from the Custom Ledger (the Operations manual-upload billing path), which is a separate object with its own lifecycle and is not yet canonised.

---

## 2. Ownership & Visibility

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor     | No | No | No | No | The Ledger endpoint is Operations-only; a Vendor request is refused. See BR-003. |
| Operations | No | Yes | Yes | No | Cannot create or delete a Ledger — creation is a side effect of accepting the parent Journal, and there is no delete endpoint. Reviews, accepts, queues, and recalculates a Ledger, and may set the assignee (the only field a PUT changes — BR-004). Full field visibility. |
| Client     | No | No | No | No | The Ledger endpoint is Operations-only; a Client request is refused. See BR-003. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Review | Charges rated with no errors; the Ledger is awaiting Operations acceptance. | Yes | No |
| Error | Rating completed with one or more charge errors, or a critical rating/processing failure occurred. Recalculate can re-run rating from here. | Yes | No |
| Rating | The rating function is (re)computing the Ledger's rated charges and pricing roll-ups. Transient; reached via recalculate. | No | No |
| Generating | Accepted; Statements are being created (one per Agreement). Transient. | No | No |
| Generated | All Statements created; the Ledger is awaiting queue for ERP integration. | No | No |
| Queued | Queued for ERP integration; the Ledger's Statements have been pushed to the ERP. | No | No |
| Completed | All of the Ledger's Statements reached a final status; the Ledger is finalised. | No | Yes |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Review | Create (rated, no errors) | system (via Journal `accept`) | Operations | Parent Journal accepted; the Seller has charges in the Journal; the Seller's charges rated with no errors. | One Ledger is created per distinct Seller in the Journal. No dedicated Ledger creation endpoint. |
| T2 | — | Error | Create (rating errors) | system (via Journal `accept`) | Operations | Parent Journal accepted; the Seller has charges in the Journal; rating produced one or more charge errors. | Same creation event as T1; the outcome state depends on whether any charge failed rating. |
| T3 | Review | Rating | Recalculate | `recalculate` | Operations | Ledger in Review. | Re-runs the rating function over the Ledger's charges; clears the current error. |
| T4 | Error | Rating | Recalculate | `recalculate` | Operations | Ledger in Error. | Re-runs the rating function; clears the current error. |
| T5 | Rating | Review | Rating completed, no errors | system (automatic) | — | No charge rating errors. | — |
| T6 | Rating | Error | Rating completed with errors | system (automatic) | — | One or more charges failed rating, or a critical rating failure. | — |
| T7 | Review | Generating | Accept | `accept` | Operations | Ledger in Review. | Creates the Ledger's Statements (one per Agreement); clears the current error. |
| T8 | Generating | Generated | Statement creation succeeded | system (automatic) | — | All Statements created. | Also rolls the parent Journal to its Accepted state once all its Ledgers are Generated. |
| T9 | Generating | Review | Statement creation failed | system (automatic) | — | One or more Statements failed to generate, or a critical failure. | Returns to Review with an error recorded. |
| T10 | Generated | Queued | Queue | `queue` | Operations | Ledger in Generated. | Pushes the Ledger's Statements to the ERP; also sets the parent Journal to its Queued state. |
| T11 | Queued | Completed | All Statements completed | system (automatic) | — | Every Statement in the Ledger reached a final status (issued or cancelled). | Terminal roll-up; completing all of a Journal's Ledgers completes the Journal. |

### 3.3 State Diagram

```
                 (Journal accept : Operations)
                          |
             +------------+------------+
   (rated, no errors)          (rating errors)
             v                         v
         [Review] <---------------> [Error]
             |     (recalculate)      ^
             |         |              |
   (recalculate : Operations)        |
             v         v             |
          [Rating] --(system, errors)+
             |
   (system, no errors) --> [Review]
             |
    (accept : Operations)
             v
       [Generating] --(system, statement failure)--> [Review]
             |
   (system, all statements created)
             v
        [Generated]
             |
     (queue : Operations)
             v
         [Queued]
             |
   (system, all statements completed)
             v
       [Completed]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Ledger is generated by the platform when a [[Journal]] is accepted — one Ledger per distinct [[Seller]] that has [[Charge]] entries in that Journal. It is never created directly through the API. | N/A (creation) | Operations | Creation is a side effect of the Journal `accept` action; there is no Ledger creation endpoint. |
| BR-002 | A Ledger inherits its parent [[Journal]], [[Authorization]], [[Product]], owning [[Seller]], scoped [[Seller]], and currency; none of these can be changed on the Ledger. | All | All | The Ledger scopes the Journal's data to the one Seller it is generated for. |
| BR-003 | Reading a Ledger and every Ledger action (accept, queue, recalculate, update) are restricted to the Operations Actor; the Vendor and Client Actors cannot read or act on a Ledger. | All | All | A Vendor or Client request to the Ledger endpoint is refused. See BR-010 for the field-level pricing visibility the schema defines but that this restriction currently makes unreachable. |
| BR-004 | The only Ledger field a PUT may change is the assignee. The pricing, processing, backup, status, and audit fields are not writable through update. | All | Operations | Status changes only through the Section 3.2 transitions, never by a direct field write. |
| BR-005 | The `accept` action is permitted only when the Ledger is in Review; it moves the Ledger to Generating and creates its [[Statement]]s, one per Agreement. | Review | Operations | — |
| BR-006 | The `queue` action is permitted only when the Ledger is in Generated; it moves the Ledger to Queued, pushes its Statements to the ERP, and sets the parent [[Journal]] to its Queued state. | Generated | Operations | ERP integration is the point at which billing data leaves the platform for the finance system. |
| BR-007 | The `recalculate` action is permitted only when the Ledger is in Review or Error; it re-runs the rating function (Rating), returning the Ledger to Review on success or Error on failure. | Review, Error | Operations | Recalculation re-derives pricing, margins, and totals for the Ledger's charges. |
| BR-008 | A Ledger rolls up automatically after acceptance: Generating → Generated when all its Statements are created, and Queued → Completed when all its Statements reach a final status. Completing every Ledger of a [[Journal]] completes that Journal. | Generating, Queued | System | Driven by the Statement lifecycle, not by a Ledger endpoint. |
| BR-009 | A Ledger has no API create or delete endpoint. It is removed only when its parent [[Journal]] is reset, which permanently removes that Journal's Ledgers and their Statements. | All | Operations | Removal is part of the Journal reset operation (see Billing: [[Journal]] canon BR-012), not a Ledger action. |
| BR-010 | Sell-side pricing on a Ledger — markup and margin — is confidential and visible only to the Operations Actor. | All | All | The schema also carries narrower per-Actor visibility for the other totals (total purchase price Vendor/Operations; total buyer sale price and currency Client/Operations), but because Ledger read is Operations-only by design (BR-003), only Operations reaches any Ledger field in practice. |
| BR-011 | The assignee records the Operations reviewer responsible for the Ledger and is set only by the Operations Actor. | All | Operations | — |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| id | String | Unique identifier, format `BLE-NNNN-NNNN-NNNN-NNNN`. | System | No | Deterministic per (parent Journal, Seller) pair. |
| status | Enum | Current lifecycle state — one of the Section 3.1 states. | System | Yes | Changes only through the Section 3.2 transitions, never by a direct field write. |
| journal | Reference | The parent Journal this Ledger was generated from. | System | No | Fixes the Ledger's scope — see BR-002. |
| authorization | Reference | The Authorization the billing is under, inherited from the Journal. | System | No | Carries the currency. |
| product | Reference | The Product being billed, inherited from the Journal. | System | No | — |
| owner | Reference | The owning Seller — the parent Journal's owning Seller. | System | No | See BR-002. |
| seller | Reference | The Seller this Ledger is scoped to. | System | No | Each distinct Seller in the Journal yields one Ledger — see BR-001. |
| assignee | Reference | The Operations reviewer assigned to the Ledger. | Operations | Yes | The only field a PUT changes (BR-004). Operations-set only. Absent from response when null. |
| price | Object | Pricing roll-up for the Ledger: currency, total purchase price (totalPP), total buyer sale price (totalBSP), markup, margin. | System | Yes | markup and margin are Operations-only; per the schema totalPP is Vendor/Operations and totalBSP/currency are Client/Operations, but Ledger read is Operations-only by design (BR-003), so only Operations reaches them in practice. Recalculated on each rating run. See BR-010. |
| processing | Object | Processing summary for the Ledger's charges: total, ready, error, split, skipped, ignored counts. | System | Yes | Visible to Operations only. |
| error.errorCode / error.errorMessage | Object | The current error code and message when the Ledger is in an error condition. | System | Yes | Visible to Operations only. Absent from response when null. |
| backup | Object | Backup summary: status and date of the Ledger's data backup. | System | Yes | Visible to Operations only. `status` is one of Pending, Exporting, Exported, Verifying, Completed, Failed, Skipped. |
| audit | Object | Created and updated events plus a per-status event history (Rating, Error, Review, Generating, Generated, Queued, Completed). | System | Yes | Records the timestamp and Actor for the most recent entry into each status. |
| revision | Integer | Monotonic revision counter. | System | Yes | Increments on each change. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Billing: Journal | Dependency | Many Ledgers to one Journal (one per Seller) | The Ledger is generated from, and scoped by, an accepted Journal, and drives that Journal's roll-up to Accepted, Queued, and Completed. | A Ledger cannot exist without its Journal, and is removed when the Journal is reset (see BR-009). |
| Accounts: Seller | Association | One scoped Seller and one owning Seller | The Seller the Ledger is scoped to, plus the parent Journal's owning Seller. | Reference only. |
| Catalog: Authorization | Association | Many Ledgers to one Authorization | The Authorization the billing is under, inherited from the Journal. | Reference only. |
| Catalog: Product | Association | Many Ledgers to one Product | The Product being billed, inherited from the Journal. | Reference only. |
| Billing: Charge | Association | Many Charges to one Ledger | The rated charge entries assigned to this Ledger — the Journal's charges for this Seller. | Charges belong to the Journal; they are removed with the Journal, not independently by the Ledger. |
| Billing: Statement | Child | One Ledger to many Statements (one per Agreement) | Created when the Ledger is accepted; the Ledger completes when all its Statements complete. | Statements are removed when the parent Journal is reset (see BR-009). |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Ledger rated | Creation from a [[Journal]] accept, or a `recalculate` action | Operations, System | The rating function computes the Ledger's price and processing roll-ups from its [[Charge]] entries; the Ledger lands in Review (no errors) or Error. |
| Status changed | Any transition in Section 3.2 | Operations, System | A status-changed event is published to the platform notification bus (see Preamble Section 8) and the corresponding per-status audit event is recorded. |
| Ledger accepted | `accept` | Operations | The Ledger's [[Statement]]s are created (one per Agreement) and the Ledger moves to Generating. |
| Ledger queued | `queue` | Operations | The Ledger's Statements are pushed to the ERP for integration; the parent [[Journal]] is set to its Queued state. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Accept | Billing: Statement | One Statement is created per Agreement in the Ledger. | Yes (Operations token context) | Ledger in Review. | — |
| Statement creation completed | Billing: Journal | The parent Journal rolls up to its Accepted state once all its Ledgers are Generated. | Yes (System) | All of the Journal's Ledgers reached Generated. | See BR-008. |
| Queue | Billing: Journal | The parent Journal is set to its Queued state, and the Ledger's Statements are pushed to the ERP. | Yes (Operations token context) | Ledger in Generated. | — |
| Ledger completed | Billing: Journal | The parent Journal completes once all of its Ledgers are Completed. | Yes (System) | Every Ledger of the Journal is Completed. | See BR-008. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
- Review → Rating → Review (and Error → Rating → Review) via recalculate: Operations may re-run rating from Review or Error any number of times.
- Generating → Review occurs automatically when Statement creation fails, returning the Ledger to Review with an error so Operations can re-accept.
- There is no dedicated action that reverses an accepted or queued Ledger; the only way to unwind a generated Ledger is to reset its parent [[Journal]], which removes the Ledger entirely (see below).
- Completed is terminal and cannot be reversed.

**Deletion:**
A Ledger has no API delete endpoint and cannot be deleted directly by any Actor. A Ledger is removed only as part of resetting its parent [[Journal]] (permitted while the Journal is in its Generated or Accepted state), which permanently removes that Journal's Ledgers and their [[Statement]]s — no longer retrievable via the API. This removal is the Journal reset operation, not a cascade from deleting the Ledger (the platform never cascades deletions — Preamble Invariant 6).

**Audit & history requirements:**
The Ledger records a created and updated event plus a per-status event history (the timestamp and Actor for the most recent entry into Rating, Error, Review, Generating, Generated, Queued, and Completed). Every transition also publishes a status-changed event to the platform notification bus. The `backup` field records the status and date of the Ledger's data backup taken during Statement generation. Re-running rating replaces the Ledger's pricing and processing roll-ups; prior roll-up values are not retained beyond the audit event trail.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Rating produces one or more charge errors | The Ledger lands in (or returns to) Error with an error code and message; Operations must resolve the underlying charges and recalculate. | Operations | Medium | A Ledger in Error cannot be accepted until recalculated to Review. |
| [[Statement]] creation fails after accept | The Ledger returns from Generating to Review with an error recorded; Operations can re-accept once the cause is resolved. | Operations | Medium | The parent [[Journal]] does not advance to Accepted while any Ledger fails to generate its Statements. |
| Recalculate fails critically | The Ledger is left in Error with a recalculation error recorded. | Operations | Medium | Operations must re-attempt recalculate. |
| A Ledger stays in Queued because its Statements never reach a final status | The Ledger cannot complete while any Statement is outstanding; the platform periodically re-evaluates queued Ledgers and retries completion once their Statements settle. | Operations, Client | Medium | ERP integration delays surface here — downstream Statement issuance is what drives completion. |
| All of a [[Journal]]'s Ledgers complete but the Journal stays Queued | The platform periodically re-evaluates such Journals and re-drives the completion roll-up so the Journal reaches Completed. | Operations | Low | A convergence safeguard for concurrent Ledger completions; no Actor action required. |
| The parent [[Journal]] is reset | The Ledger and its Statements are permanently removed; any downstream Statement data is lost and must be regenerated by re-accepting the Journal. | Operations, Client | High | See BR-009. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.2 | 2026-07-20 | Stu / canon-generate-batch | Billing: Statement now canonised — bracket-linked the `[[Statement]]` cross-references (Section 1, BR-005, Section 7, Section 8, Section 9) and dropped the stale "not yet canonised" notes (Section 1, BR-005, Section 6, Section 7). No behavioural change. |
| 0.1 | 2026-07-19 | Stu / canon-generate-batch | Initial draft generated from the PROD OpenAPI schema, a live multi-Actor PROD fetch, and Billing source research. Full state machine derived from source (7 states — Review, Error, Rating, Generating, Generated, Queued, Completed; accept/queue/recalculate verbs and the automatic Statement-driven roll-up to Completed). Confirmed the Ledger is generated one-per-Seller from an accepted Journal and is never created or deleted directly via the API (removed only by a Journal reset). Confirmed the Ledger endpoint is Operations-only in PROD (Vendor and Client both refused with 403), documented the confidential markup/margin fields, and recorded the assignee-only update policy. Confirmed intended: Ledger read is Operations-only (Vendor/Client 403 by design), a Ledger lands directly in Review or Error at creation (no Rating state until recalculate), and accept moves the Ledger to Generating (there is no Accepted status). Modelled as a top-level Billing object with a strong dependency on its generating Journal. 0 open questions. |
