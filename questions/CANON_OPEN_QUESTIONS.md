# Canon Open Questions

> **Version:** 3.3
> **Last Updated:** 2026-07-15
> **Status:** Living Document — updated continuously as canon is developed

---

## Purpose

This document tracks unresolved questions deferred during canon development. Questions are grouped by the canon file they belong to.

When a question is resolved, it is removed from this file and the answer is stated as a plain fact directly in the relevant canon section — there is no separate resolved-questions tracker, and no need for inline "confirmed by/on" provenance in canon content itself (a changelog row is enough of a record).

Question IDs use the API identifier prefix of the object they concern (e.g. PAR-001 for a Parameter question). Exception: ENV-NNN for platform/environment questions that span multiple objects.

---

## PLATFORM_CANON_PREAMBLE.md

| # | Question |
|---|----------|
| ENV-001 | Which platform constraints are relaxed in non-PROD environments due to external system dependencies (e.g. ERP, vendor provisioning systems, payment processors)? Is there a complete list maintained anywhere, or is this tribal knowledge? This should be documented centrally and referenced from the preamble. |
| ENV-002 | Beyond the ERP-linked Licensee status constraint, are there other external system dependencies that cause constraint relaxation in non-PROD environments (e.g. vendor provisioning systems, payment processors)? |
| ENV-004 | Icon removal mechanism: how is a custom icon removed from an object with jdenticon behaviour? Confirmed for `Accounts: Seller` (a multipart `PUT` omitting the `logo` file part removes the custom icon) — whether this same mechanism holds for every jdenticon-capable object is not confirmed, since icon behaviour is implemented per object type. |
| ENV-005 | Accounts: Seller's related-Licensee guard (blocking Activate/Disable/Deactivate/Delete while a related Licensee is Active/Enabled) was confirmed via STAGING only. Whether it is enforced identically in PROD, or is one of the non-PROD relaxations already noted in Section 7.3, is not confirmed. |

---

## CANON_OBJECT_Commerce_Order.md

| # | Question |
|---|----------|
| ORD-001 | Can Operations move a Processing Order to Querying status, or is that transition Vendor-only? Gut says both Vendor and Operations, but unconfirmed. |
| ORD-002 | Can a Querying Order transition directly to Failed, or must it return to Processing first? The state machine diagram suggests a direct transition is possible; prior discussion suggests it is not. |
| ORD-003 | When submitting a new Order to the API, which initial status values are valid — is the Client limited to `Draft`, `Quoted`, and `Processing`, or can other values be set directly? |
| ORD-004 | During Processing and Querying status, can Operations write to `parameters.ordering` and/or `parameters.fulfillment` directly, or must they switch to a Client or Vendor Account to do so? |
| ORD-005 | Whether the platform handles simultaneous Order placement attempts against the same Agreement atomically — preventing race conditions where two Orders could both reach Processing status simultaneously — is not confirmed. |
| ORD-006 | Split Billing is enabled at the Agreement level and has implications for Order behaviour. This section requires updating once Split Billing has been canonised in the Agreement canon. |
| ORD-007 | The `certificates` array on the Order is always empty in observed samples where no Program is assigned to the Product. The full structure of a populated `certificates` entry, which Actors can read it, and whether it is suppressed for any Actor type is not confirmed. See Programs and Certificates canon — pending canonisation. |

---

## CANON_OBJECT_Catalog_PriceList_Item.md

| # | Question |
|---|----------|
| PRI-002 | After a Price List is deleted directly (not via a parent Product deletion), are its Price List Items still retrievable via the API? The Items are not cascade-deleted and their records persist, but the owning Price List no longer resolves. A Vendor is expected to no longer retrieve them; the behaviour for Operations and Client is unconfirmed and requires a live create-then-delete test. |

---

## Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 3.3 | 2026-07-17 | Stu / canon-generate | SUB-001, SUB-002, SUB-003 all resolved/closed via live schema + multi-Actor fetch + source-code research and removed (Subscription section retired). SUB-001 — the `/terminate` body is applied as a Vendor update then terminates immediately (no effective-date field). SUB-002 — `commitmentDate` defaults to `startDate + terms.commitment`, Vendor-settable at creation, advanced by `terms.commitment` on renewal. SUB-003 — subscription-side split fields documented; the full Split Billing Subscription object stays tracked in the backlog (`split | subscriptions`). Incorporated into the Commerce: Subscription refresh. |
| 3.2 | 2026-07-16 | Stu / canon-generate | AGR-001, AGR-002, AGR-003, AGR-007, AGR-008 all resolved via live schema + multi-Actor fetch + source-code research and removed (Agreement section retired) — `startDate`/`endDate`/`error` are vestigial contract fields; Order and Agreement attachments are one shared collection; the audit block genuinely has no `failed` sub-key; Split Billing documented in the Agreement canon (BR-018). SUB-003's stale "See AGR-007" reference repointed to Agreement BR-018. Incorporated into the Commerce: Agreement canon refresh. |
| 3.1 | 2026-07-16 | Stu / canon-generate | PRP-001, PRP-002, PRP-004 resolved via source-code research and removed (section retired) — `None` status is defined-but-unused (policies are created Active); multiple-match resolution is deterministic (Product-level over Client-level, lowest markup). Incorporated into Pricing Policy canon. |
| 3.0 | 2026-07-16 | Stu / canon-generate | PRI-002 added from Price List Item canon-generate run — retrievability of Price List Items after a direct Price List deletion (not via Product deletion) is unconfirmed for Operations/Client and needs a live test. |
| 2.9 | 2026-07-15 | Stu / canon-generate | WBH-002 resolved via direct source-code research and removed — Product deletion has no reactive effect on a Webhook referencing it; see Webhook canon BR-004a and Section 9. |
| 2.8 | 2026-07-15 | Stu / canon-generate | WBH-002 reopened: its 2.7 closure assumed Products could never be deleted at all, which the `Catalog: Product` canon refresh (same date) disproved — Draft-state deletion is possible and cascades. The real question (what happens to a Webhook whose anchor Product is deleted while in Draft) was never actually answered, only mooted on a false premise. |
| 2.7 | 2026-07-15 | Stu / canon-generate | WBH-001 through WBH-004 (added in 2.6, same session) resolved directly with the PM before ever being finalized as tracked open questions, per the updated canon-generate process — moved straight to CANON_RESOLVED_QUESTIONS.md (WBH-001, WBH-002, WBH-004) or descoped (WBH-003). Section removed from this file entirely — no open questions remain for Webhook. |
| 2.6 | 2026-07-15 | Stu / canon-generate | WBH-001 through WBH-004 added from Webhook canon refresh run (live schema + multi-Actor fetch + source-code research). Related spec discrepancy (`criteria` schema type) logged as SD-006 in CANON_SPEC_DISCREPANCIES.md instead, not tracked here. |
| 0.1 | 2026-03-08 | Stu | Initial document. |
| 0.2 | 2026-03-09 | Stu | Added ENV-001, ENV-002, PRI-001, ITM-001, AUT-001. |
| 0.3 | 2026-03-09 | Stu | Added TPL-001, AUT-002, LST-001, LST-002, PRD-001, TCS-001, PAR-001, PAR-002, PAR-003. |
| 0.4 | 2026-03-09 | Stu | ITM-001 resolved and moved to resolved file. |
| 0.5 | 2026-03-09 | Stu | AUT-002, LST-001, LST-002, PRD-001, TPL-001, PRI-001, ITM-002, TCS-001, PAR-001, PAR-002, PAR-003 resolved and moved to resolved file. |
| 0.6 | 2026-03-09 | Stu | Restructured: resolved questions moved to CANON_RESOLVED_QUESTIONS.md. Question IDs corrected to match object API prefixes. Status column removed — this file contains open questions only. |
| 0.7 | 2026-03-14 | Stu | TPL-002 added: behaviour when Template created without a type field. |
| 0.8 | 2026-03-14 | Stu | TPL-002 resolved and removed — Type is always required; API spec omission is a spec inaccuracy. |
| 0.9 | 2026-03-14 | Stu | PRD-001, PRD-002 added. |
| 1.0 | 2026-03-14 | Stu | PRD-002 resolved and removed. |
| 1.1 | 2026-03-14 | Stu | PRD-001 resolved and removed. |
| 1.2 | 2026-03-14 | Stu | ENV-003 added: icon upload HTTP method (PUT vs POST) unconfirmed. |
| 1.3 | 2026-03-14 | Stu | ENV-003 resolved and moved to resolved file — /icon endpoint is GET only; icon upload is via multipart/form-data on the parent object endpoint. |
| 1.4 | 2026-03-14 | Stu | ENV-004 added: icon removal mechanism unconfirmed. |
| 1.5 | 2026-03-15 | Stu | SEL-001 through SEL-006 added from Seller canon session. Note: SEL-003 was resolved during the session (externalId is mutable via the API) and is not tracked here. |
| 1.6 | 2026-03-15 | Stu | SEL-001 resolved and removed — status transitions confirmed as API endpoints (/activate, /disable, /deactivate). SEL-006 resolved and removed — currencies minItems: 1 confirmed in SellerCreate schema. SEL-007 through SEL-010 added from OpenAPI spec review. |
| 1.7 | 2026-03-16 | Stu | PRP-001, PRP-002, PRP-004 added from Pricing Policy canon session. |
| 1.8 | 2026-03-25 | Stu | ACC-001 through ACC-008 added from Account canon session. |
| 1.9 | 2026-04-05 | Stu | ACC-001 resolved and removed — externalId applies to Vendor Accounts (ERP manufacturer code) and Client Accounts (CDG); irrelevant on Operations Account. Operations-only write confirmed. |
| 2.0 | 2026-04-05 | Stu | ACC-002 resolved and removed — Vendor visibility is transaction-relationship-scoped; Client visibility is self-only; non-visible Accounts return 404. ACC-003 rewritten — state semantics and Disabled scope confirmed; downstream effects remain open. ACC-005 resolved and removed — automatic Administrators User Group creation confirmed. |
| 2.1 | 2026-04-12 | Stu | ORD-001 through ORD-007 added from Order canon session. |
| 2.2 | 2026-04-12 | Stu | AGR-001 through AGR-007 added from Agreement canon stub session. |
| 2.3 | 2026-04-13 | Stu | AGR-004, AGR-005, AGR-006 resolved and removed — parameters model confirmed, icon confirmed as not applicable, writable fields confirmed. AGR-008 added: failed audit sub-key presence unconfirmed in schema. |
| 2.4 | 2026-04-13 | Stu | SUB-001 through SUB-003 added from Subscription canon session. |
| 2.5 | 2026-04-14 | Stu | AST-001 added from Asset canon session. |
| 3.0 | 2026-07-15 | Stu / canon-generate-batch | SEL-002, SEL-004, SEL-005, SEL-007, SEL-008, SEL-009, SEL-010 resolved and removed — Seller heading removed entirely (no open questions remain). AST-001 replaced by AST-002 (audit draft/active sub-keys never populated) — AST-003 was resolved directly via a live re-check and never tracked here. ENV-005 added — Seller's related-Licensee status-change guard, PROD-parity unconfirmed. All from a canon-generate-batch dry run refreshing Accounts: Seller and Commerce: Asset concurrently. |
| 3.1 | 2026-07-15 | Stu / canon-generate-batch | AST-002 resolved and removed — confirmed as a deliberate simplification, not an unimplemented feature. Asset heading removed entirely (no open questions remain). |
| 3.2 | 2026-07-15 | Stu / canon-generate | AUT-001 resolved and removed — exhaustive search across all synced source repositories found eligibility.client/eligibility.partner are never read by any downstream platform logic; confirmed as a contractual record only. Authorization heading removed entirely (no open questions remain). |
| 3.3 | 2026-07-15 | Stu / canon-generate | ACC-003, ACC-004, ACC-006, ACC-007, ACC-008 resolved and removed — Account heading removed entirely (no open questions remain). Resolved via live OpenAPI schema, live-fetched real objects (all three Account types, all Actors), and source-code research. |
