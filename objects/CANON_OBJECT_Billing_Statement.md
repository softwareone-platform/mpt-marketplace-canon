# Object Canon: Statement

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-20
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Statement

**Namespace:** Billing

**Parent Object:** None — top-level object.

**ID Prefix:** SOM

**Description:**
A Statement is the client-facing billing document the platform's billing pipeline produces from a [[Ledger]] (or, for manually-uploaded billing, a Custom Ledger — not yet canonised), scoped to exactly one Commerce: [[Agreement]]. Its net total determines its type — Debit (zero or positive, becoming an ERP Sales Order and, once posted, an Invoice) or Credit (negative, becoming an ERP Credit Memo) — and its per-line detail is exposed as a separate child [[Charge]] collection rather than an embedded array. A Statement can also be a Consolidated grouping — an Operations-created shell that rolls several existing standalone Statements together into a single ERP posting. Clients read their own Statements; every action on a Statement, including its own creation, is restricted to the Operations Actor.

**Also Known As:**
Billing statement; client statement. Distinct from the downstream ERP Invoice and Credit Memo documents a Statement produces (neither is yet canonised), and from the Custom Ledger (the Operations manual-upload billing path that produces Manual-type Statements, not yet canonised).

---

## 2. Ownership & Visibility

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor     | No | No | No | No | The Statement endpoint's access policy excludes the Vendor Actor entirely — a Vendor token is refused before any action executes (confirmed via a live PROD fetch: HTTP 403). |
| Operations | Yes (Consolidated only) | Yes | Yes (limited fields) | No | The only Actor that can create a Statement (a Consolidated grouping shell — see BR-005) and the only Actor permitted any Statement action, including every state transition. No delete endpoint exists. |
| Client     | No | Yes | No | No | Can read its own Statements (a token is accepted for the endpoint generally), but every mutating action — including update — is rejected: all Statement actions are Operations-only. See BR-004. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Generated | The Statement has been created (or re-enriched) and is awaiting queueing. | Yes | No |
| Cancelled | Excluded from billing. Reached either directly at creation (a blocked billing pairing) or by an explicit `cancel`. | Yes | Yes |
| Queued | Queued for ERP integration; also the required status for a standalone Statement to be added as a child of a Consolidated parent. | No | No |
| Pending | Awaiting further ERP-side processing after being queued. | No | No |
| Issued | Sent to the Client. | No | Yes |
| Error | A processing failure requiring attention; billing is blocked until recovered. | No | No |
| Generating | An Automated Statement's charges are being re-enriched following a `recalculate`. Transient. | No | No |
| Consolidating | A standalone Statement currently linked as a child of a Consolidated parent, pending the parent's own queueing. | No | No |
| Consolidated | A child Statement whose Consolidated parent has been queued; rolled into the parent's single ERP posting. | No | No |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Generated | Create | No dedicated endpoint — automatic on [[Ledger]] acceptance (Automated) or Custom Ledger acceptance (Manual); or `POST /statements` (Consolidated only) | System (Automated/Manual) or Operations (Consolidated) | Ledger/Custom Ledger accepted and the Vendor/Client billing pairing is not blocked (Automated/Manual); none for a Consolidated shell | One Automated Statement is created per distinct (Journal, Agreement, Buyer) combination in the accepted Ledger. A Consolidated Statement is created empty (no Agreement, zero statistics) and populated afterwards via T16. |
| T2 | — | Cancelled | Create (blocked) | No dedicated endpoint — automatic on Ledger/Custom Ledger acceptance | System | A manual billing override routes the Vendor/Client pairing to the other billing pipeline (or, Automated only, no Client could be resolved for the entry) | Never occurs for a Consolidated Statement, which is always created directly in Generated. See BR-006. |
| T3 | Generated | Queued | Queue | `POST /statements/{id}/queue` | Operations | Generated | For a Consolidated parent, requires at least one linked child (see T17). |
| T4 | Error | Queued | Queue, Retry, or Recalculate (Manual billing type only) | `POST .../queue`; `POST .../retry`; or `POST .../recalculate` (Manual only) | Operations | Error | Three independent recovery mechanisms land on the same state. `recalculate` on a Manual Statement returns it to Queued with no re-enrichment (contrast T13/T14, Automated only). |
| T5 | Queued | Pending | Move to pending | `POST .../pending` | Operations | Queued | — |
| T6 | Pending | Issued | Issue | `POST .../issue` | Operations | Pending | Issued or Cancelled is what allows the originating Ledger/Custom Ledger to complete — see BR-013. |
| T7 | Queued | Error | Mark error | `POST .../error` | Operations | Queued | — |
| T8 | Pending | Error | Mark error | `POST .../error` | Operations | Pending | — |
| T9 | Queued | Cancelled | Cancel | `POST .../cancel` | Operations | Queued | For a Consolidated parent, every linked child is instead detached and reset to Queued — see T19/T20, not this row. |
| T10 | Pending | Cancelled | Cancel | `POST .../cancel` | Operations | Pending | — |
| T11 | Error | Cancelled | Cancel | `POST .../cancel` | Operations | Error | — |
| T12 | Generated | Cancelled | Cancel | `POST .../cancel` | Operations | Generated | — |
| T13 | Error | Generating | Recalculate (Automated billing type only) | `POST .../recalculate` | Operations | Error, BillingType = Automated | Re-enriches the Statement's charges from the parent Journal; resolves automatically via T14/T15. |
| T14 | Generating | Queued | Recalculation completed, no processing errors | System (automatic) | — | All re-enriched charges processed without error | — |
| T15 | Generating | Error | Recalculation completed with processing errors, or failed critically | System (automatic) | — | One or more re-enriched charges have a processing error, or the operation failed | — |
| T16 | Queued | Consolidating | Add child | `POST /statements/{id}/children` (called on the Consolidated parent) | Operations | Child Queued, not already linked to another parent, not itself Consolidated; parent BillingType = Consolidated and Status = Generated; child's purchase currency, sale currency, Buyer, Seller, and Vendor match the parent | Recalculates the parent's statistics and price totals from all linked children. See BR-008. |
| T17 | Consolidating | Generated | Remove child | `DELETE /statements/{id}/children/{childId}` (called on the Consolidated parent) | Operations | Child Consolidating and linked to the specified parent; parent BillingType = Consolidated and Status = Generated | Recalculates the parent's statistics and price totals from the remaining children. |
| T18 | Consolidating | Consolidated | Queue (called on the Consolidated parent) | `POST /statements/{id}/queue` | Operations | Parent BillingType = Consolidated, Status = Generated, at least one linked child | Rejected if the parent has no linked children. Companion to T3 (the parent's own Generated → Queued). |
| T19 | Consolidating | Queued | Cancel (called on the Consolidated parent) | `POST /statements/{id}/cancel` | Operations | Parent BillingType = Consolidated | Child is detached (its parent link cleared) and reset to standalone Queued. Companion to T9 (the parent's own transition to Cancelled). |
| T20 | Consolidated | Queued | Cancel (called on the Consolidated parent) | `POST /statements/{id}/cancel` | Operations | Parent BillingType = Consolidated | Same detachment as T19, applied to a child that had already been rolled into the parent's ERP posting — see the Section 9 failure mode. |

### 3.3 State Diagram

```
                    (Ledger/Custom Ledger accept : System)         (POST /statements : Operations)
                              |    \ (blocked pairing)                    |
                              v     v                                     v
                        [Generated]  [Cancelled] <---------------------------------------------+
                          |    |         ^   ^  ^                                              |
              (queue)     |    |         |   |  |                                              |
                          v    +---------+   |  |                                              |
                      [Queued] ----(cancel)--+  |                                              |
                     /   |   \                  |                                              |
        (pending)   /    |    \ (error)          |                                              |
                    v     |     v                |                                              |
              [Pending]   |  [Error] ----(cancel)-+                                             |
                 |  \      |     |  \                                                           |
      (issue)    |   \(error) | (queue/retry/       \ (recalculate, Automated only)              |
                 v    v     |   recalculate:Manual)   v                                          |
             [Issued] [Error]|<-----------------+  [Generating] --(errors)--> [Error]            |
   (Client sees final)      +---(queue) --------+        |                                       |
                                                  (no errors)                                     |
                                                          v                                       |
                                                      [Queued]                                    |
                                                                                                   |
   Consolidated-parent-only, driven by the parent's own queue/cancel calls:                       |
                                                                                                   |
      child [Queued] --(add-child : Operations)--> [Consolidating] --(remove-child)--> [Generated]|
                                                          |                                        |
                                            (parent queued, Operations)                            |
                                                          v                                        |
                                                   [Consolidated]                                  |
                                                          |                                        |
                                       (parent cancelled : Operations, either child state) ---------+
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An Automated or Manual Statement is scoped to exactly one Commerce: [[Agreement]]. A Consolidated Statement has no Agreement of its own — it aggregates several underlying Statements, each with its own Agreement. | All | All | The Automated grouping key is the (Journal, Agreement, Buyer) combination — a Journal spanning multiple Buyers on the same Agreement yields one Statement per Buyer, not one per Agreement. |
| BR-002 | A Statement's net total determines its type: zero or positive produces Debit (an ERP Sales Order, and an Invoice once posted); negative produces Credit (an ERP Credit Memo). | All | All | Negative or return lines are converted to positive equivalents for the ERP import; multiple lines within one Statement net together (e.g. +200 and −150 nets to a single +50 order). |
| BR-003 | Reading a Statement is permitted to the Client and Operations Actors. The Vendor Actor cannot read a Statement at all. | All | All | A Vendor request is refused outright, not merely field-suppressed. |
| BR-004 | Every Statement action — creation, update, and every state transition in Section 3.2 — is restricted to the Operations Actor, even though the Client Actor is accepted for reads on the same endpoint. | All | Operations | A Client attempt at any mutating action is rejected. |
| BR-005 | The only Statement an Actor can create directly is an empty Consolidated grouping shell. Automated and Manual Statements arise only as a side effect of accepting the source [[Ledger]] or Custom Ledger. | N/A (creation) | Operations | See T1. |
| BR-006 | Automated/Manual Statement creation lands directly in Cancelled, rather than Generated, when an active manual billing override routes that Vendor/Client pairing to the other billing pipeline, or (Automated only) when the entry could not be resolved to a Client. | N/A (creation) | System | The override is a business configuration keyed by Vendor and Client that determines which of the two pipelines bills a given pairing; it is not yet canonised as its own object. |
| BR-007 | A Statement update may change only its status notes message (required when transitioning to Error) and its external IDs. Creating a Consolidated shell additionally requires its Vendor, Seller, Buyer, and purchase/sale currency. | All | Operations | Price, processing, status, backup, and audit fields are never directly writable. |
| BR-008 | Adding a child to a Consolidated parent requires the child to be Queued, unlinked, and not itself Consolidated, and requires its purchase currency, sale currency, Buyer, Seller, and Vendor to match the parent; the parent itself must be Consolidated and Generated. | Generated (parent); Queued (child) | Operations | See T16. Every add or remove recalculates the parent's statistics and price totals from its current children. |
| BR-009 | Queueing a Consolidated parent requires at least one linked child and rolls every Consolidating child to Consolidated. Cancelling a Consolidated parent instead detaches every linked child — Consolidating or already Consolidated — and resets it to standalone Queued. | Generated, Queued, Pending, Error (parent) | Operations | See T18–T20. Cancelling an already-queued Consolidated parent reopens children that may already have a corresponding ERP posting — see Section 9. |
| BR-010 | Every Statement status transition is permitted only from the specific prior statuses listed in Section 3.2; an out-of-sequence attempt is rejected. | All | Operations | See Section 3.2 for the full permitted-transition set. |
| BR-011 | `retry` and `recalculate` both recover a Statement from Error. `retry` resets it directly to Queued; `recalculate` on an Automated Statement re-enriches its charges via Generating before landing on Queued or Error again, while on a Manual Statement it returns directly to Queued with no re-enrichment. | Error | Operations | — |
| BR-012 | Sell-side pricing (markup, margin, total purchase price, purchase currency, and the exchange rate) and the processing summary are visible only to the Operations Actor. The Client Actor sees only the sale-side total and sale currency. | All | All | Reference preamble §6.3. |
| BR-013 | A Statement reaching Issued or Cancelled is what allows its originating [[Ledger]] or Custom Ledger to complete; the platform re-evaluates ledger completion whenever a Statement reaches either status. | Issued, Cancelled | System | See Billing: [[Ledger]] canon BR-008. |
| BR-014 | A Statement has no delete endpoint and cannot be deleted directly by any Actor. | All | Operations | See Section 8. |
| BR-015 | Per-line billing detail is exposed as a separate child [[Charge]] collection, not an embedded array on the Statement itself. | All | All | Each Charge entry carries its own matched [[Item]], [[Subscription]] or [[Asset]], and [[Agreement]] — see Billing: [[Charge]] canon Section 6. |
| BR-016 | A Statement's ERP posting is treated as intercompany when the [[Seller]] that owns the Statement's [[Authorization]] differs from the [[Licensee]]'s Seller; an intercompany posting generates additional mirrored ERP transactions to reconcile cross-subsidiary revenue and cost. | All | N/A | The determination is applied in the ERP integration layer, not stored as a field on the Statement object. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| id | String | Unique identifier, format `SOM-NNNN-NNNN-NNNN-NNNN`. | System | No | — |
| status | Enum | Current lifecycle state — one of the Section 3.1 states. | System | Yes | Changes only through Section 3.2 transitions, never by a direct field write. |
| type | Enum | Debit or Credit. | System | No | Derived from the sign of the net total. See BR-002. |
| billingType | Enum | Automated, Manual, or Consolidated. | System | No | Fixes which creation path produced the Statement (see T1) and governs the add/remove-child rules (BR-008). |
| externalIds | Object | Operations, Vendor, ERP, and Client reference identifiers. | System / Operations | Yes | Absent from response when null. |
| ledger | Reference | The source Ledger, for an Automated Statement. | System | No | Null for Manual and Consolidated Statements. |
| customLedger | Reference | The source Custom Ledger, for a Manual Statement. | System | No | Null for Automated and Consolidated Statements. Custom Ledger not yet canonised. |
| client / buyer / vendor / seller | Reference | The client and vendor Accounts, the Buyer, and the Seller. | System (Automated/Manual) or Operations (Consolidated, required at creation) | No | See BR-007. |
| product | Reference | The Product being billed. | System | No | Null for a Consolidated shell. |
| agreement | Reference | The Agreement the Statement is scoped to. | System | No | Null for a Consolidated shell — see BR-001. |
| licensee | Reference | The Licensee consuming the service. | System | No | — |
| price | Object | Pricing summary: currency (purchase, sale, rate), totalPP, totalSP, totalBSP, markup, margin. | System | Yes | markup, margin, totalPP, and purchase currency/rate are Operations-only; totalSP/totalBSP and sale currency are Client/Operations. Recalculated on every re-enrichment and on every add/remove-child. See BR-012. |
| processing | Object | Processing summary: total, ready, error, split, skipped, ignored counts. | System | Yes | Operations-only. |
| statusNotes | Object | A message and parameters describing the current status. | Operations | Yes | The message is required when transitioning to Error. Absent from response when null. |
| error.code / error.message | Object | Error code and message when in an error condition. | System | Yes | Visible to Client and Operations. Absent from response when null. |
| creditMemo | Reference | The downstream ERP Credit Memo, once created. | System | No | Populated only for a Credit-type Statement. Not yet canonised. |
| invoice | Reference | The downstream ERP Sales Order/Invoice, once created. | System | No | Populated only for a Debit-type Statement. Not yet canonised. |
| backup | Object | Status and date of the Statement's data export/backup. | System | Yes | Operations-only. |
| parent | Reference | The Consolidated parent Statement this Statement is linked to, if any. | System | Yes | Set by add-child, cleared by remove-child or by the parent's own cancel. See T16/T17/T19/T20. |
| statistics | Object | Counts of distinct child Statements, Products, Agreements, and Licensees — Consolidated parent only. | System | Yes | Client/Operations visible. Recalculated on every add/remove-child. |
| revision | Integer | Monotonic revision counter. | System | Yes | Increments on each change. |
| audit | Object | Created and updated events plus a per-status event history. | System | Yes | Records the timestamp and Actor for the most recent entry into each status. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Billing: Ledger | Association | Many Statements to one Ledger (Automated only) | The source Ledger a Statement was generated from. | The Statement is removed only when the parent Journal is reset (see Billing: Ledger BR-009), never by any action on the Ledger itself. |
| Billing: Charge | Association | Many Charges to one Statement | The per-line billing entries that make up the Statement, retrieved via a child collection rather than an embedded array. | Charges reference the Statement they feed; the reference is cleared if a Charge is later ignored. See BR-015. |
| Billing: Statement | Association (self) | One Consolidated parent to many child Statements | A Consolidated Statement groups several standalone Statements as children. | Each child is independently created and can exist without ever being consolidated; linkage is added and removed via T16/T17 and reversed in bulk by cancelling the parent (T19/T20). |
| Billing: Statement Attachment | Child | One Statement to many Attachments | Supporting files (e.g. supplementary billing documentation) attached to the Statement. | No cascade (preamble Invariant 6); the attachment is reachable only via its Statement. |
| Commerce: Agreement | Association | Many Statements to one Agreement (Automated/Manual only) | The Agreement the Statement bills. | Reference only; no cascade. Null for a Consolidated shell. |
| Catalog: Product | Association | Many Statements to one Product | The Product being billed. | Reference only; no cascade. |
| Accounts: Buyer | Association | Many Statements to one Buyer | The Buyer billed. | Reference only; no cascade. |
| Accounts: Seller | Association | Many Statements to one Seller | The owning Seller. | Reference only; no cascade. |
| Accounts: Account | Association | Many Statements to one client Account, one vendor Account | The client and vendor Accounts. | Reference only; no cascade. |
| Accounts: Licensee | Association | Many Statements to one Licensee | The Licensee consuming the service. | Reference only; no cascade. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Statement generated | Creation (T1/T2) | System, Operations | Status resolved to Generated or, if the billing pairing is blocked, Cancelled. |
| Statement recalculated | `recalculate` | Operations | An Automated Statement's [[Charge]] entries are re-enriched; a Manual Statement returns directly to Queued. See BR-011. |
| Status changed | Any transition in Section 3.2 | Operations, System | A status-changed event is published to the platform notification bus (see Preamble Section 8); the Client Account named on the Statement is granted visibility of that event. The corresponding per-status audit event is recorded. |
| Child linked / unlinked | `add-child` / `remove-child` (called on a Consolidated parent) | Operations | The parent's statistics and price totals are recalculated from its current children. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Issue or Cancel | Billing: Ledger | Ledger completion is re-evaluated for the [[Ledger]] the Statement belongs to. | Yes (Operations token context) | Statement reaches Issued or Cancelled | See BR-013. |
| Add child | Billing: Statement (child) | The child Statement moves to Consolidating and is linked to the parent. | Yes (Operations token context) | Child Queued, unlinked, not itself Consolidated; parent Consolidated and Generated | See T16. |
| Remove child | Billing: Statement (child) | The child Statement moves back to Generated and is unlinked. | Yes (Operations token context) | Child Consolidating and linked to the parent | See T17. |
| Queue (parent) | Billing: Statement (children) | Every Consolidating child moves to Consolidated. | Yes (Operations token context) | Parent Consolidated, Generated, has at least one linked child | See T18. |
| Cancel (parent) | Billing: Statement (children) | Every linked child (Consolidating or Consolidated) is detached and reset to Queued. | Yes (Operations token context) | Parent Consolidated | See T19/T20 and the Section 9 failure mode. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Error is not terminal — `queue`, `retry`, or `recalculate` (see BR-011) return a Statement to processing. Consolidation is fully reversible while the parent remains Generated: adding and removing a child (T16/T17) can be repeated freely, and cancelling a Consolidated parent (T19/T20) reverses consolidation in bulk for every linked child, regardless of whether the child had already reached Consolidated. Issued and Cancelled are both terminal; no action reverses either.

**Deletion:**
A [[Statement]] cannot be deleted directly in any state — there is no deletion endpoint. An Automated Statement is permanently removed — no longer retrievable via the API — only when the parent Journal is reset, which also removes its generating [[Ledger]] (see Billing: [[Ledger]] canon BR-009 and Section 8). Whether an equivalent removal path exists for a Manual Statement (tied to a Custom Ledger, not yet canonised) or a Consolidated Statement is not confirmed — see SOM-003.

**Audit & history requirements:**
A Statement records a created and updated event plus a per-status event history (the timestamp and Actor for the most recent entry into each Section 3.1 status). Every transition also publishes a status-changed event to the platform notification bus, with the Client Account named on the Statement granted visibility of that event. The `backup` field records the status and date of the data export taken when the Statement was generated or last recalculated. Recalculation and every add/remove-child replace the Statement's pricing and statistics; prior values are not retained beyond the audit event trail.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| A Consolidated parent already in Queued (or later) is cancelled | Every linked child — including one already rolled to Consolidated and reflected in the parent's single ERP posting — is detached and reset to standalone Queued, available to be requeued or re-consolidated independently. | Client, Operations | High | The platform does not reconcile the original consolidated ERP posting; Operations must manually confirm the ERP side to avoid double-billing. See BR-009. |
| `recalculate` is called on a Consolidated Statement in Error | The action succeeds (200 OK) but performs no state change — the code path only recalculates Automated or Manual Statements. The Statement stays in Error. | Operations | Medium | `retry` (Error → Queued, billing-type-agnostic) is the working recovery path for a Consolidated Statement stuck in Error. |
| An Automated/Manual Statement creation is blocked by a billing-pairing override | The Statement is created directly in Cancelled with no error surfaced to the Client; the underlying usage is not billed. | Operations | Medium | Only Operations reviewing the source [[Ledger]] or Journal would notice the missing Statement. See BR-006. |

---

## 10. Open Questions

- [ ] SOM-003: Is there any mechanism — direct or cascading — to permanently remove a Manual (Custom Ledger-sourced) or Consolidated Statement? No delete endpoint exists on the Statement itself, and no equivalent "reset" cascade was confirmed for a Custom Ledger or a Consolidated parent within the scope of this research.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-20 | Stu / canon-generate | Initial draft generated from the PROD OpenAPI schema, a live multi-Actor PROD fetch (Vendor refused with 403; Operations and Client both readable), an Operations-vs-Client actor-suppression diff, the Statement/Credit-Statement and Statement-object Confluence pages, and Billing source research. Documents the 9-state machine (Generated/Cancelled/Queued/Pending/Issued/Error/Generating/Consolidating/Consolidated), the three creation paths (Automated via Ledger acceptance, Manual via Custom Ledger acceptance, Consolidated via direct Operations creation), the manual-billing-override block-at-creation behaviour, the Operations-only action policy despite Client-readable GETs, the add-child/remove-child consolidated-grouping mechanics, and the Ledger-completion trigger on Issue/Cancel. Confirmed per-line detail is a child Charge collection, not an embedded array. Resolved during review: `retry` lands in Queued (its API description saying "Generated" is stale), and an ERP posting is intercompany when the Authorization owner's Seller differs from the Licensee's Seller (applied in the ERP integration layer, not a Statement field). One open question remains (SOM-003: whether a Manual or Consolidated Statement has any removal path). |
