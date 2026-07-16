# Canon Backlog

> **Version:** 3.0
> **Owner:** Stu
> **Last Updated:** 2026-07-15
> **Status:** Living Document — updated continuously as canon is developed

---

## Purpose

This document is the authoritative backlog and coverage tracker for platform canon. It tracks every known platform object across all namespaces — whether not started, has known pending issues, or up to date — in a single unified reference.

---

## Status Legend

Status reflects trust level, not permanence — the platform keeps evolving, so no canon document is ever "done" forever. "Up to Date" means accurate as of the date in **Last Updated**, not a lasting guarantee.

| Status | Meaning |
|--------|---------|
| 🟢 Up to Date | Canon document exists and was confirmed accurate as of **Last Updated** — evidence-based (live API + source research), reviewed, no known gaps at that time. |
| 🟡 Known Pending Issues | Canon document exists but has a known gap, open question, or hasn't yet been re-verified against current live evidence — see Notes. |
| 🔴 Not Started | Object identified; no canon work begun. |

---

## Table of Contents

- [Accounts](#accounts)
- [Audit](#audit)
- [Billing](#billing)
- [Catalog](#catalog)
- [Commerce](#commerce)
- [Exchange](#exchange)
- [Extensibility](#extensibility)
- [Helpdesk](#helpdesk)
- [Integration](#integration)
- [Notifications](#notifications)
- [Procurement](#procurement)
- [Program](#program)
- [Public-catalog](#public-catalog)
- [Spotlight](#spotlight)
- [System](#system)
- [Investigation Items](#investigation-items)

---

## Accounts

| Object | Parent | Status | Last Updated | Canon File | Notes |
|--------|--------|--------|--------------|------------|-------|
| account-users | — | 🔴 Not Started | | | |
| groups | account-users | 🔴 Not Started | | | |
| accounts | — | 🟢 Up to Date | 2026-07-15 | [CANON_OBJECT_Accounts_Account.md](../objects/CANON_OBJECT_Accounts_Account.md) | — |
| users | accounts | 🔴 Not Started | | | |
| groups | users | 🔴 Not Started | | | |
| api-tokens | — | 🔴 Not Started | | | |
| buyers | — | 🟢 Up to Date | 2026-07-15 | [CANON_OBJECT_Accounts_Buyer.md](../objects/CANON_OBJECT_Accounts_Buyer.md) | — |
| cloud-tenants | — | 🔴 Not Started | | | |
| erp-links | — | 🟢 Up to Date | 2026-07-15 | [CANON_OBJECT_Accounts_ErpLink.md](../objects/CANON_OBJECT_Accounts_ErpLink.md) | — |
| licensees | — | 🟢 Up to Date | 2026-07-16 | [CANON_OBJECT_Accounts_Licensee.md](../objects/CANON_OBJECT_Accounts_Licensee.md) | — |
| modules | — | 🔴 Not Started | | | |
| sellers | — | 🟢 Up to Date | 2026-07-15 | [CANON_OBJECT_Accounts_Seller.md](../objects/CANON_OBJECT_Accounts_Seller.md) | — |
| services | — | 🔴 Not Started | | | |
| user-groups | — | 🔴 Not Started | | | |
| users | — | 🔴 Not Started | | | |
| accounts | users | 🔴 Not Started | | | |

---

## Audit

| Object | Parent | Status | Last Updated | Canon File | Notes |
|--------|--------|--------|--------------|------------|-------|
| event-types | — | 🔴 Not Started | | | |
| records | — | 🔴 Not Started | | | Platform-wide. Generated for significant events on objects across all namespaces. JSON example available. Prefix: AUD. |

---

## Billing

| Object | Parent | Status | Last Updated | Canon File | Notes |
|--------|--------|--------|--------------|------------|-------|
| analytics | — | 🔴 Not Started | | | |
| credit-memos | — | 🔴 Not Started | | | |
| attachments | credit-memos | 🔴 Not Started | | | |
| custom-ledgers | — | 🔴 Not Started | | | |
| attachments | custom-ledgers | 🔴 Not Started | | | |
| charges | custom-ledgers | 🔴 Not Started | | | |
| invoices | — | 🔴 Not Started | | | |
| attachments | invoices | 🔴 Not Started | | | |
| journals | — | 🔴 Not Started | | | |
| attachments | journals | 🔴 Not Started | | | |
| charges | journals | 🔴 Not Started | | | |
| sellers | journals | 🔴 Not Started | | | |
| ledgers | — | 🔴 Not Started | | | |
| attachments | ledgers | 🔴 Not Started | | | |
| charges | ledgers | 🔴 Not Started | | | |
| manual-overrides | — | 🔴 Not Started | | | |
| statements | — | 🔴 Not Started | | | |
| attachments | statements | 🔴 Not Started | | | |
| charges | statements | 🔴 Not Started | | | |

---

## Catalog

| Object | Parent | Status | Last Updated | Canon File | Notes |
|--------|--------|--------|--------------|------------|-------|
| authorizations | — | 🟢 Up to Date | 2026-07-15 | [CANON_OBJECT_Catalog_Authorization.md](../objects/CANON_OBJECT_Catalog_Authorization.md) | — |
| listings | — | 🟢 Up to Date | 2026-07-16 | [CANON_OBJECT_Catalog_Listing.md](../objects/CANON_OBJECT_Catalog_Listing.md) | — |
| price-lists | — | 🟢 Up to Date | 2026-07-16 | [CANON_OBJECT_Catalog_PriceList.md](../objects/CANON_OBJECT_Catalog_PriceList.md) | — |
| items | price-lists | 🟢 Up to Date | 2026-07-16 | [CANON_OBJECT_Catalog_PriceList_Item.md](../objects/CANON_OBJECT_Catalog_PriceList_Item.md) | 1 open question (PRI-002). |
| pricing-policies | — | 🟢 Up to Date | 2026-07-16 | [CANON_OBJECT_Catalog_PricingPolicy.md](../objects/CANON_OBJECT_Catalog_PricingPolicy.md) | — |
| attachments | pricing-policies | 🟢 Up to Date | 2026-07-16 | [CANON_OBJECT_Catalog_PricingPolicy_Attachment.md](../objects/CANON_OBJECT_Catalog_PricingPolicy_Attachment.md) | — |
| products | — | 🟢 Up to Date | 2026-07-16 | [CANON_OBJECT_Catalog_Product.md](../objects/CANON_OBJECT_Catalog_Product.md) | — |
| documents | products | 🟢 Up to Date | 2026-07-16 | [CANON_OBJECT_Catalog_Product_Document.md](../objects/CANON_OBJECT_Catalog_Product_Document.md) | — |
| item-groups | products | 🟢 Up to Date | 2026-07-16 | [CANON_OBJECT_Catalog_Product_ItemGroup.md](../objects/CANON_OBJECT_Catalog_Product_ItemGroup.md) | — |
| items | products | 🟢 Up to Date | 2026-07-16 | [CANON_OBJECT_Catalog_Product_Item.md](../objects/CANON_OBJECT_Catalog_Product_Item.md) | — |
| media | products | 🟢 Up to Date | 2026-07-16 | [CANON_OBJECT_Catalog_Product_Media.md](../objects/CANON_OBJECT_Catalog_Product_Media.md) | — |
| parameter-groups | products | 🟢 Up to Date | 2026-07-15 | [CANON_OBJECT_Catalog_Product_ParameterGroup.md](../objects/CANON_OBJECT_Catalog_Product_ParameterGroup.md) | — |
| parameters | products | 🟢 Up to Date | 2026-07-15 | [CANON_OBJECT_Catalog_Product_Parameter.md](../objects/CANON_OBJECT_Catalog_Product_Parameter.md) | — |
| templates | products | 🟢 Up to Date | 2026-07-15 | [CANON_OBJECT_Catalog_Product_Template.md](../objects/CANON_OBJECT_Catalog_Product_Template.md) | — |
| terms | products | 🟢 Up to Date | 2026-07-16 | [CANON_OBJECT_Catalog_Product_Terms.md](../objects/CANON_OBJECT_Catalog_Product_Terms.md) | — |
| variants | terms | 🟢 Up to Date | 2026-07-16 | [CANON_OBJECT_Catalog_Product_Terms_Variant.md](../objects/CANON_OBJECT_Catalog_Product_Terms_Variant.md) | — |
| units-of-measure | — | 🟢 Up to Date | 2026-07-16 | [CANON_OBJECT_Catalog_UnitOfMeasure.md](../objects/CANON_OBJECT_Catalog_UnitOfMeasure.md) | — |

---

## Commerce

| Object | Parent | Status | Last Updated | Canon File | Notes |
|--------|--------|--------|--------------|------------|-------|
| agreements | — | 🟢 Up to Date | 2026-07-16 | [CANON_OBJECT_Commerce_Agreement.md](../objects/CANON_OBJECT_Commerce_Agreement.md) | — |
| attachments | agreements | 🔴 Not Started | | | |
| lines | agreements | 🔴 Not Started | | | |
| split | agreements | 🔴 Not Started | | | Split Billing — confirmed a real object with its own endpoints (`/split`: GET/POST/PUT), not just a field. Agreement-side model documented in Commerce: Agreement BR-018. |
| assets | — | 🟢 Up to Date | 2026-07-15 | [CANON_OBJECT_Commerce_Asset.md](../objects/CANON_OBJECT_Commerce_Asset.md) | — |
| lines | assets | 🔴 Not Started | | | |
| lines | — | 🔴 Not Started | | | |
| orders | — | 🟡 Known Pending Issues | 2026-04-12 | [CANON_OBJECT_Commerce_Order.md](../objects/CANON_OBJECT_Commerce_Order.md) | 7 open questions. |
| assets | orders | 🔴 Not Started | | | |
| lines | orders | 🔴 Not Started | | | |
| subscriptions | orders | 🔴 Not Started | | | |
| subscriptions | — | 🟡 Known Pending Issues | 2026-04-13 | [CANON_OBJECT_Commerce_Subscription.md](../objects/CANON_OBJECT_Commerce_Subscription.md) | 3 open questions. |
| lines | subscriptions | 🔴 Not Started | | | |
| split | subscriptions | 🔴 Not Started | | | Split Billing — confirmed a real object with its own endpoints (`/split`: GET/PUT), not just a field. See SUB-003. |

---

## Exchange

| Object | Parent | Status | Last Updated | Canon File | Notes |
|--------|--------|--------|--------------|------------|-------|
| currencies | — | 🔴 Not Started | | | |
| pairs | — | 🔴 Not Started | | | |
| rates | pairs | 🔴 Not Started | | | |
| rates | — | 🔴 Not Started | | | |

---

## Extensibility

| Object | Parent | Status | Last Updated | Canon File | Notes |
|--------|--------|--------|--------------|------------|-------|
| categories | — | 🔴 Not Started | | | |
| extensions | — | 🔴 Not Started | | | |
| documents | extensions | 🔴 Not Started | | | |
| installations | extensions | 🔴 Not Started | | | |
| instances | extensions | 🔴 Not Started | | | |
| media | extensions | 🔴 Not Started | | | |
| terms | extensions | 🔴 Not Started | | | |
| variants | terms | 🔴 Not Started | | | |
| installations | — | 🔴 Not Started | | | |

---

## Helpdesk

| Object | Parent | Status | Last Updated | Canon File | Notes |
|--------|--------|--------|--------------|------------|-------|
| cases | — | 🔴 Not Started | | | |
| channels | — | 🔴 Not Started | | | |
| messages | channels | 🔴 Not Started | | | |
| chats | — | 🔴 Not Started | | | |
| attachments | chats | 🔴 Not Started | | | |
| links | chats | 🔴 Not Started | | | |
| messages | chats | 🔴 Not Started | | | |
| participants | chats | 🔴 Not Started | | | |
| feedback | — | 🔴 Not Started | | | |
| attachments | feedback | 🔴 Not Started | | | |
| forms | — | 🔴 Not Started | | | |
| parameter-groups | forms | 🔴 Not Started | | | |
| parameters | forms | 🔴 Not Started | | | |
| parameter-groups | — | 🔴 Not Started | | | |
| parameters | parameter-groups | 🔴 Not Started | | | |
| parameters | — | 🔴 Not Started | | | |
| queues | — | 🔴 Not Started | | | |

---

## Integration

| Object | Parent | Status | Last Updated | Canon File | Notes |
|--------|--------|--------|--------------|------------|-------|
| categories | — | 🔴 Not Started | | | |
| extensions | — | 🔴 Not Started | | | |
| documents | extensions | 🔴 Not Started | | | |
| installations | extensions | 🔴 Not Started | | | |
| instances | extensions | 🔴 Not Started | | | |
| media | extensions | 🔴 Not Started | | | |
| terms | extensions | 🔴 Not Started | | | |
| variants | terms | 🔴 Not Started | | | |
| installations | — | 🔴 Not Started | | | |

---

## Notifications

| Object | Parent | Status | Last Updated | Canon File | Notes |
|--------|--------|--------|--------------|------------|-------|
| accounts | — | 🔴 Not Started | | | |
| categories | accounts | 🔴 Not Started | | | |
| contacts | categories | 🔴 Not Started | | | |
| batches | — | 🔴 Not Started | | | |
| attachments | batches | 🔴 Not Started | | | |
| categories | — | 🔴 Not Started | | | |
| contacts | — | 🔴 Not Started | | | |
| directories | — | 🔴 Not Started | | | |
| footers | — | 🔴 Not Started | | | |
| messages | — | 🔴 Not Started | | | |
| subscribers | — | 🔴 Not Started | | | |
| templates | — | 🔴 Not Started | | | |
| variants | templates | 🔴 Not Started | | | |
| webhooks | — | 🟢 Up to Date | 2026-07-15 | [CANON_OBJECT_Notifications_Webhook.md](../objects/CANON_OBJECT_Notifications_Webhook.md) | — |

---

## Procurement

| Object | Parent | Status | Last Updated | Canon File | Notes |
|--------|--------|--------|--------------|------------|-------|
| erp-items | — | 🔴 Not Started | | | |
| sales-orders | — | 🔴 Not Started | | | |
| attachments | sales-orders | 🔴 Not Started | | | |
| sales-quotes | — | 🔴 Not Started | | | |
| attachments | sales-quotes | 🔴 Not Started | | | |

---

## Program

| Object | Parent | Status | Last Updated | Canon File | Notes |
|--------|--------|--------|--------------|------------|-------|
| certificates | — | 🔴 Not Started | | | |
| enrollments | — | 🔴 Not Started | | | |
| attachments | enrollments | 🔴 Not Started | | | |
| programs | — | 🔴 Not Started | | | |
| documents | programs | 🔴 Not Started | | | |
| media | programs | 🔴 Not Started | | | |
| parameter-groups | programs | 🔴 Not Started | | | |
| parameters | programs | 🔴 Not Started | | | |
| templates | programs | 🔴 Not Started | | | |
| terms | programs | 🔴 Not Started | | | |
| variants | terms | 🔴 Not Started | | | |

---

## Public-catalog

| Object | Parent | Status | Last Updated | Canon File | Notes |
|--------|--------|--------|--------------|------------|-------|
| categories | — | 🔴 Not Started | | | |
| industries | — | 🔴 Not Started | | | |
| product-profiles | — | 🔴 Not Started | | | |
| media | product-profiles | 🔴 Not Started | | | |
| segments | — | 🔴 Not Started | | | |
| vendor-profiles | — | 🔴 Not Started | | | |

---

## Spotlight

| Object | Parent | Status | Last Updated | Canon File | Notes |
|--------|--------|--------|--------------|------------|-------|
| objects | — | 🔴 Not Started | | | |
| queries | — | 🔴 Not Started | | | |

---

## System

| Object | Parent | Status | Last Updated | Canon File | Notes |
|--------|--------|--------|--------------|------------|-------|
| tasks | — | 🔴 Not Started | | | |
| logs | tasks | 🔴 Not Started | | | |

---

## Investigation Items

| Item | Description | Priority |
|------|-------------|----------|
| Webhook type / Product settings relationship | Explore the link between Webhook.type values and Product.settings fields. Likely relevant to how product-level settings determine which webhook event types are fired or available. | To be scheduled |

---

## Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2026-03-08 | Stu | Initial backlog. Seeded from Item canon development session. |
| 0.2 | 2026-03-09 | Stu | Price List and Price List Item marked complete. Authorization and Listing added as pending. |
| 0.3 | 2026-03-09 | Stu | Authorization and Listing marked complete. |
| 0.4 | 2026-03-09 | Stu | Unit of Measure marked complete. Catalog namespace canon queue complete. |
| 0.5 | 2026-03-09 | Stu | Pricing Policy added to Catalog namespace. Audit namespace and Audit Record added. |
| 0.6 | 2026-03-14 | Stu | Investigation Items section added. Webhook type / Product settings relationship added for future exploration. |
| 0.7 | 2026-03-14 | Stu | Full Object Inventory section added — generated from OpenAPI spec via extract_objects.py. Catalog namespace objects marked complete where canon exists. Document restructured into Curated Backlog and Full Object Inventory sections. |
| 0.8 | 2026-03-14 | Stu | Icon endpoints removed from Full Object Inventory — icon behaviour canonised as a platform-wide pattern in PLATFORM_CANON_PREAMBLE.md Section 9. Explanatory note added above inventory. |
| 0.9 | 2026-03-15 | Stu | settings removed from Full Object Inventory under products, accounts, and programs — settings is a property, not an object. |
| 1.0 | 2026-03-15 | Stu | image removed from under all media entries — image is a binary upload endpoint, not an object. |
| 1.1 | 2026-03-15 | Stu | Curated Backlog and Full Object Inventory merged into single unified Object Backlog table. Status legend added. Canon file links added using relative paths. Seller and Pricing Policy status updated from new files found in objects/. |
| 1.2 | 2026-03-16 | Stu | Authorization and Seller downgraded to In Progress — both have open questions. Open question IDs removed from backlog — maintained in CANON_OPEN_QUESTIONS.md only. |
| 1.3 | 2026-03-16 | Stu | Object Backlog split into per-namespace sections with headings. Table of contents added. Namespace column removed from tables. |
| 1.4 | 2026-03-25 | Stu | Account marked In Progress — initial canon session completed, 8 open questions logged (ACC-001 through ACC-008). |
| 1.5 | 2026-07-15 | Stu / canon-generate | Webhook downgraded from Complete to In Progress — canon-generate refresh pilot found substantial corrections vs. current canon (state mechanism, criteria structure, retry behaviour, firing semantics). 4 open questions logged (WBH-001 through WBH-004), 1 spec discrepancy (SD-006). Draft pending PM review before promotion. |
| 1.6 | 2026-07-15 | Stu / canon-generate | Webhook note updated — WBH-001/002/004 resolved directly with PM (never left open), WBH-003 descoped as an engineering detail, 0 open questions remain. SD-007 added (objectType enum lists two unreachable values). Still 🟡 pending PM review of the draft before promotion. |
| 1.7 | 2026-07-15 | Stu / canon-generate | Product downgraded from Complete to In Progress — canon-generate refresh found major corrections vs. current canon, most significantly that deletion was wrongly documented as impossible in any state (it's possible, and cascades, while a Product is in Draft) — also added as a known exception to preamble Invariant 6. Draft pending PM review before promotion. |
| 1.8 | 2026-07-15 | Stu / canon-generate | Template (Product child) downgraded from Complete to In Progress — canon-generate refresh found corrections vs. current canon (RequestProcessing fully removed, max Content length was wrong, missing Product attribute, External IDs shape). Draft pending PM review before promotion. |
| 1.9 | 2026-07-15 | Stu / canon-submit-pr | Template marked back to Complete — PM confirmed coverage is complete at the canon-submit-pr Step 2.5 checkpoint, no known gaps. |
| 2.0 | 2026-07-15 | Stu | Status model redesigned — "Complete" retired as a category since the platform is always evolving and no canon is ever permanently done. Replaced with 🟢 Up to Date (accurate as of Last Updated, not a lasting guarantee) and 🟡 Known Pending Issues (open questions, or not yet re-verified against live evidence); 🔴 Not Started unchanged. Added a Last Updated column, backfilled per object from each canon file's own header. Only Product, Product Template, and Webhook — the three objects actually run through the evidence-based canon-generate pipeline — are marked 🟢; every other previously-🟢 object is now 🟡, since "Complete" under the old manual process turned out not to hold up once re-verified (see Product/Webhook/Template's own corrections this session). Also fixed 5 stale rows where a canon file already existed but the row still said 🔴 Not Started with no link: Commerce Agreement, Asset, Order, Subscription, and Catalog Pricing Policy Attachment. |
| 2.1 | 2026-07-15 | Stu | Removed rows confirmed (via live OpenAPI spec and source research) to be action endpoints, reference fields, or removed platform features rather than real objects: `quote`\|orders, `template`\|agreements/orders/requests (reference fields to Catalog: Template, not separate objects), `download`\|attachments (Helpdesk), `upload`\|custom-ledgers/journals, `sso`/`sso-check`\|users, `queue`\|custom-ledgers/ledgers/statements/tasks (action verb — distinct from Helpdesk's real `queues` object, which has full CRUD and its own lifecycle and is unaffected), `error`/`pending`\|statements, `enquiry`\|journals, `children`\|statements (a linking action between existing Statement records, not a distinct object), `result`\|tasks, `token`\|extensions/installations (both Extensibility and Integration, which duplicate the same list). Removed the entire `requests` family (requests, attachments/messages/template\|requests) — Commerce: Request Management was fully removed from the platform (confirmed via source research, 2026-03-06); it's gone, not merely un-canonised. `split`\|agreements and `split`\|subscriptions kept and clarified as confirmed real objects (own `/split` endpoints) — see AGR-007/SUB-003. |
| 2.2 | 2026-07-15 | Stu / canon-generate | Parameter (Product child) refresh draft generated — corrections found vs. current canon (Request scope fully removed, Item-scope phase was wrong, Default Parameter Group auto-assignment was wrong, new capacity constraint). Draft pending PM review before promotion. |
| 2.3 | 2026-07-15 | Stu / canon-submit-pr | Parameter marked Up to Date — PM confirmed coverage is complete at the canon-submit-pr Step 2.5 checkpoint. Parameter Group's Last Updated bumped (one error corrected) but stays Known Pending Issues — PM confirmed it's not a full re-verification. |
| 2.4 | 2026-07-15 | Stu / canon-generate | Parameter Group (Product child) full refresh draft generated — resolved the long-standing soft-delete-vs-hard-delete ambiguity, plus new Display Order uniqueness and creation-required-field corrections. Draft pending PM review before promotion. |
| 2.5 | 2026-07-15 | Stu / canon-submit-pr | Parameter Group marked Up to Date — PM confirmed coverage is complete at the canon-submit-pr Step 2.5 checkpoint, no known gaps. |
| 2.6 | 2026-07-15 | Stu / canon-generate-batch | Sellers and Assets refresh drafts generated concurrently via canon-generate-batch's first dry run. Both marked Up to Date — PM confirmed coverage is complete at the canon-submit-pr Step 2.5 checkpoint. Sellers: 0 open questions remaining (down from 7). Assets: AST-002 confirmed as a deliberate simplification, not a gap — 0 open questions remaining. |
| 2.7 | 2026-07-15 | Stu / canon-submit-pr | Authorization marked Up to Date — PM confirmed coverage is complete at the canon-submit-pr Step 2.5 checkpoint, no known gaps. First object promoted in the Catalog completion push. 0 open questions remaining (down from 1, AUT-001 resolved). |
| 2.8 | 2026-07-15 | Stu / canon-submit-pr | Account marked Up to Date — PM confirmed coverage is complete at the canon-submit-pr Step 2.5 checkpoint, no known gaps. All 5 prior open questions resolved (ACC-003, ACC-004, ACC-006, ACC-007, ACC-008). |
| 2.9 | 2026-07-15 | Stu / canon-generate | Buyer and ErpLink drafts generated together (fresh canon; both promoted from 🔴 Not Started). 0 open questions each. ErpLink is the Buyer↔Seller join object. Drafts pending PM review before promotion. |
| 3.0 | 2026-07-15 | Stu / canon-submit-pr | Buyer and ErpLink marked Up to Date — PM confirmed coverage is complete, no known gaps. Both had 0 open questions at promotion. |
| 3.1 | 2026-07-16 | Stu / canon-generate | Media (Product child) refresh draft generated via live OpenAPI schema (STAGING), live-fetched real object (multi-Actor), and source-code research. Corrections found vs. current canon: submit endpoint is `review` not `submit`; publish/republish is Operations-only; new Unpublished→Pending transition; delete is Vendor or Operations (was Vendor-only) with no cascade; Video url is format-validated; url/file immutable after creation; Client record visibility state-gated while asset URL stays public. 0 open questions. Draft pending PM review before promotion. |
| 3.2 | 2026-07-16 | Stu / canon-generate | Product Last Updated bumped to 2026-07-16 — BR-002/§7.2 wording simplified to drop an implementation-level delete-mechanism distinction (surfaced during the Media refresh). No change to documented behaviour; stays 🟢 Up to Date. |
| 3.3 | 2026-07-16 | Stu / canon-submit-pr | Media marked 🟢 Up to Date — PM confirmed coverage is complete at the canon-submit-pr Step 2.5 checkpoint, no known gaps. 0 open questions. Promoted alongside the related Product wording correction in the same PR. |
| 3.4 | 2026-07-16 | Stu / canon-generate | Item Group (Product child) refresh draft generated via live OpenAPI schema (STAGING), live-fetched real object (multi-Actor), and source-code research. Corrections found vs. current canon: ID Prefix IGR (was "None"); auto-assignment of group-less Items to the Default group is not platform behaviour (an explicit group is required); `multiple`/`required` are advisory, not platform-enforced at Order submission; delete is Vendor or Operations (was Vendor-only). 0 open questions. Draft pending PM review. |
| 3.5 | 2026-07-16 | Stu / canon-generate | Item — two claims corrected directly (BR-002 auto-assignment, BR-003 Order-time flag enforcement) as a scoped cross-object fix surfaced by the Item Group refresh; Last Updated bumped, stays 🟡 (full evidence-based Item refresh still pending). |
| 3.6 | 2026-07-16 | Stu / canon-submit-pr | Item Group marked 🟢 Up to Date — PM confirmed coverage is complete at the canon-submit-pr Step 2.5 checkpoint, no known gaps. 0 open questions. Promoted alongside the scoped Item correction in the same PR (Item stays 🟡, full refresh pending). |
| 3.7 | 2026-07-16 | Stu / canon-generate | Item full-refresh draft generated via live OpenAPI schema (STAGING), live-fetched real object (multi-Actor), and source-code research. Corrections: ID Prefix ITM; §3.2 endpoints filled + new Unpublished→Pending transition; terms.period adds 3y and terms.commitment adds 2y/4y/5y (with period↔commitment combination rules); Unit of Measure is mutable; qNA/usage coupling reframed as intended-but-unenforced; publishing without externalIds.operations confirmed intended. 0 open questions. Draft pending PM review. Also removed the parentless `items | —` duplicate backlog row (same object/file as `items | products`). |
| 3.8 | 2026-07-16 | Stu / canon-generate | Product and preamble corrected directly: Catalog: Product Items removed from the Draft-deletion cascade (Product BR-002/§6/§7/§8/§9 and preamble Invariant 6) — source research confirmed Items are independent records Product deletion does not remove. Product Last Updated already 2026-07-16; stays 🟢. Only the Items cascade claim was re-verified; the other listed children were not re-examined (follow-up recommended). |
| 3.9 | 2026-07-16 | Stu / canon-submit-pr | Item marked 🟢 Up to Date — PM confirmed coverage is complete at the canon-submit-pr Step 2.5 checkpoint, no known gaps (the outstanding cascade re-verification is a Product-side follow-up). 0 open questions. Promoted alongside the Product-canon and preamble cascade corrections in the same PR. |
| 4.0 | 2026-07-16 | Stu | Normalised the Notes column to `—` for all 🟢 Up to Date rows (filled the empty Product/Parameter Group/Parameter/Template/Webhook cells; cleared the erp-links descriptive note). Cosmetic consistency only. |
| 4.1 | 2026-07-16 | Stu / canon-generate | Unit of Measure refresh draft generated via live OpenAPI schema (STAGING), live-fetched real object (multi-Actor), and source-code research. Corrections: ID Prefix UNT (added to preamble §5.3); revision field exists; audit created+updated; description required; name required/unique/max-length; itemCount counts Published Items (moves on publish/unpublish); Item's UoM reference is mutable (corrects prior "immutable"). 0 open questions. Draft pending PM review. |
| 4.2 | 2026-07-16 | Stu / canon-submit-pr | Unit of Measure marked 🟢 Up to Date — PM confirmed coverage is complete at the canon-submit-pr Step 2.5 checkpoint, no known gaps. 0 open questions. Promoted alongside the preamble §5.3 UNT-prefix addition in the same PR. |
| 4.3 | 2026-07-16 | Stu / canon-generate | Terms (Product child) refresh draft generated via live OpenAPI schema (STAGING), live-fetched real objects (a Published and an Unpublished Terms, multi-Actor), and source-code research. Corrections: ID Prefix TCS; §3.2 endpoints filled + new Unpublished→Pending transition; unpublish is Vendor **or** Operations (reverses v0.3 "Operations-only"); description optional; displayOrder optional/default 100; acceptance auto-recorded (BR-004 reframed); BR-009a variant-delete guard reframed as intended-but-unenforced. 0 open questions. Draft pending PM review. |
| 4.4 | 2026-07-16 | Stu / canon-generate | Product (v0.10) and preamble (v2.1) — Items RESTORED to the Product Draft-deletion cascade, reverting the v0.9/v1.9 removal. The Terms refresh found the delete-Product API path removes Items via a cleanup step (the earlier removal had inspected only the domain Product.Delete() method). A full re-verification of the cascade for every listed child was then completed and confirmed the entire list is removed on Draft-Product deletion as intended. |
| 4.5 | 2026-07-16 | Stu / canon-submit-pr | Terms marked 🟢 Up to Date — PM confirmed coverage is complete at the canon-submit-pr Step 2.5 checkpoint, no known gaps. 0 open questions. Promoted alongside the Product/preamble Items-cascade revert and the config/canon_path_segment_exclusions.json present-fact cleanup in the same PR. |
| 4.6 | 2026-07-16 | Stu / canon-generate | Terms Variant refresh draft generated via live OpenAPI schema (STAGING), a live-fetched Online Variant (multi-Actor), and source-code research. Corrections: ID Prefix TCV (added to preamble §5.3); §3.2 endpoints filled + new Unpublished→Pending transition; unpublish is Vendor or Operations (reverses v0.3 "Operations-only"); assetUrl/languageCode immutable (were mutable); description optional; assetUrl format-validated; File PDF/Word ≤5MB; language code allow-list; BR-006 aligned with Terms BR-009a (no variant-delete guard, orphaning). 0 open questions. Draft pending PM review. |
| 4.7 | 2026-07-16 | Stu / canon-submit-pr | Terms Variant marked 🟢 Up to Date — PM confirmed coverage is complete at the canon-submit-pr Step 2.5 checkpoint, no known gaps. 0 open questions. Promoted alongside the preamble §5.3 TCV-prefix addition in the same PR. |
| 4.8 | 2026-07-16 | Stu / canon-generate | Document (Product child) — fresh canon drafted (was 🔴 Not Started) via live OpenAPI schema (STAGING), a live-fetched File Document across Published and Unpublished states (multi-Actor), and source-code research. ID Prefix PDC (added to preamble §5.3). Online/File content model; full Draft/Pending/Published/Unpublished state machine; unpublish Vendor-or-Operations, publish/republish Operations-only, delete Draft-only Vendor-only; language allow-list; PDF/Word ≤5MB; displayOrder accepted-but-ignored; record discoverability state-gated to Published while the file stays downloadable by any authenticated actor. 0 open questions. Draft pending PM review. |
| 4.9 | 2026-07-16 | Stu / canon-submit-pr | Document marked 🟢 Up to Date — PM confirmed coverage is complete at the canon-submit-pr Step 2.5 checkpoint, no known gaps. 0 open questions. First Catalog: Product child canonised from scratch via the pipeline. Promoted alongside the preamble §5.3 PDC addition and the Product §6 Document relationship row + [[Document]] cross-links (co-promoted-sibling wiring) in the same PR. |
| 4.10 | 2026-07-16 | Stu / canon-generate | Price List — refresh drafted via live OpenAPI schema (STAGING), a live-fetched real object (multi-Actor), and source-code research. Major corrections found: Client read is permitted (scoped to an eligible Listing), deletion is a soft delete and the owning Vendor can delete, defaultMargin is stored (not "never stored") and Operations-only, the removed Charge-reconciliation and per-item unitLP markup roles, corrected Price List Item auto-creation trigger (first review), and Section 5 attribute/visibility/type fixes. 0 open questions. Draft pending PM review. |
| 4.11 | 2026-07-16 | Stu / canon-submit-pr | Price List marked 🟢 Up to Date — PM confirmed coverage is complete at the canon-submit-pr Step 2.5 checkpoint, no known gaps. 0 open questions. Refresh (v0.4→v0.5) promoted into objects/. |
| 4.12 | 2026-07-16 | Stu / canon-generate | Price List Item — refresh drafted via live OpenAPI schema (STAGING), live-fetched real objects in all three states (Draft/ForSale/Private, multi-Actor), and source-code research. Major corrections: field visibility (unitLP/LP variants visible to all incl. Client; unitSP/SP to Client+Ops not Vendor; markup/margin/reasonForChange Ops-only), Client read state-gated to ForSale, unitSP maintained by the platform (not "never stored"), removed the per-item defaultMarkup fallback (reconciles with Price List v0.5), corrected auto-creation trigger to first review, filled transition endpoints (status writes), deletion only via parent-Product delete, added description/reasonForChange/x3Y/unitLP≥unitPP rule and the unpublished audit event. 1 open question (PRI-002). Draft pending PM review. |
| 4.13 | 2026-07-16 | Stu / canon-submit-pr | Price List Item marked 🟢 Up to Date — PM confirmed at the canon-submit-pr Step 2.5 checkpoint. Refresh (v0.2→v0.3) promoted into objects/. One tracked open question remains (PRI-002 — retrievability after a direct Price List delete, pending a live test); PM judged coverage otherwise complete. |
| 4.14 | 2026-07-16 | Stu / canon-generate | Pricing Policy — refresh drafted via live OpenAPI schema (STAGING), a live multi-Actor fetch of two real policies, and source-code research. Resolved all three open questions (PRP-001/002 — None status is defined-but-unused, policies created Active; PRP-004 — deterministic resolution, Product-level over Client-level then lowest markup). Corrected yield-cap enforcement to a clamp (not a rejection) applied to newly-priced lines; filled transition endpoints; confirmed the soft-delete Invariant-7 exception. 0 open questions. Draft pending PM review. |
| 4.15 | 2026-07-16 | Stu / canon-generate | Pricing Policy Attachment — full canonisation from stub via live OpenAPI schema (STAGING), a live multi-Actor fetch of a real Attachment, and source-code research. Object Name set to "Pricing Policy Attachment" (was ambiguous "Attachment"); PPA prefix added to preamble §5.3. Active/Deleted state machine, Operations-only, file upload (25 MB, PDF/Excel/CSV/PNG/JPEG), 10 active-per-policy cap, fixed type discriminator, name/description mutable + file immutable, content-type-matched download redirect, and soft-delete that (unlike the parent policy) is no longer retrievable. 0 open questions. Bundled with the Pricing Policy refresh. Draft pending PM review. |
| 4.16 | 2026-07-16 | Stu / canon-submit-pr | Pricing Policy and Pricing Policy Attachment both marked 🟢 Up to Date — PM confirmed at the canon-submit-pr Step 2.5 checkpoint, no known gaps, 0 open questions each. Promoted together in one PR (Pricing Policy v0.3→v0.4; Pricing Policy Attachment stub→v0.4, renamed from "Attachment") with the preamble §5.3 PPA prefix. |
| 4.18 | 2026-07-16 | Stu / canon-submit-pr | Listing marked 🟢 Up to Date — PM confirmed at the canon-submit-pr Step 2.5 checkpoint, no known gaps, 0 open questions. Refresh (v0.4→v0.5) promoted into objects/. |
| 4.19 | 2026-07-16 | Stu / canon-generate | Licensee (Accounts) — fresh canon drafted (was 🔴 Not Started) via live OpenAPI schema (STAGING), a live-fetched real object (multi-Actor), source-code research (core platform + Navision ERP extension), and the Licensee (LCE) design doc. Status → 🟡 pending PM review; 0 open questions. ID prefix LCE confirmed from a live object ID (to be added to preamble §5.3 at promotion). Documents the Buyer–Seller pairing, the Buyer-mirrored Active/Enabled/Disabled/Deleted status model, create-requires-ErpLink, the Active-required-in-PROD transaction rule, soft-delete with the non-terminal-Agreement guard, and cross-object guards on Seller/ErpLink/Buyer. Bundled a scoped correction to Accounts: ErpLink v0.2 (block guard is Active-or-Enabled, not any non-Deleted Licensee). Draft pending PM review before promotion. |
| 4.17 | 2026-07-16 | Stu / canon-generate | Listing — refresh drafted via live OpenAPI schema (STAGING), a live-fetched real object (STAGING, all Actors), and source-code research. Major corrections: removed the false Price-List-vs-Authorization currency-match rule (real rule is Price List currency ∈ Seller currencies); Vendor reads its own Product's Listings in full (was "id/name only"), only statistics is Client-suppressed; Client read is a scoped eligibility-mediated read; `primary` re-scoped to Product+Seller with up to two primaries and reject-on-conflict (not a §3.4 Default, no auto-demote); deletion guard widened to any referencing Order/Agreement (any state) + active Subscriptions + primary, as a soft delete; creation preconditions added (Product Published, Seller not Disabled/Deleted); `product` documented; eligibility is read downstream and independent of the Authorization's; removed unverifiable intercompany-invoicing rule; stale AUT-001 removed. 0 open questions. Draft pending PM review. |
| 4.21 | 2026-07-16 | Stu / canon-generate | Commerce: Agreement full refresh draft generated via live OpenAPI schema (STAGING), a multi-Actor live fetch, and source-code research (incl. a deep dig on the price `Manual` source). Corrections: §3.2 transition mechanisms confirmed/filled; Operations direct-create via POST (BR-001); price field visibility (PPxY/PPxM are Vendor+Ops); BR-015 rewritten (Manual estimate source, transient); termination terminates Assets on the direct path (BR-006); billingCurrency Active-only removed; Split Billing documented (BR-018); attachments a shared collection; New/startDate/endDate/error/icon vestigial; audit has no failed/updating sub-key. All 5 open questions (AGR-001/002/003/007/008) resolved → 0 remaining. Stays 🟡 pending PM review. Draft pending PM review before promotion. |
| 4.20 | 2026-07-16 | Stu / canon-submit-pr | Licensee marked 🟢 Up to Date — PM confirmed coverage is complete at the canon-submit-pr Step 2.5 checkpoint, no known gaps, 0 open questions. Fresh canon (v0.1) promoted into objects/. Promoted in one PR with the preamble §5.3 LCE prefix, the Accounts: ErpLink v0.2 block-guard correction, and the co-promoted-sibling `[[Licensee]]` cross-link wiring into ErpLink (v0.2), Seller (v0.7), and Buyer (v0.3) — the Buyer edit also clarified that unassign is guarded by any attached Licensee including Deleted. |
| 4.22 | 2026-07-16 | Stu / canon-submit-pr | Commerce: Agreement marked 🟢 Up to Date — PM confirmed coverage is complete at the canon-submit-pr Step 2.5 checkpoint, no known gaps, 0 open questions (all 5 prior resolved). Refresh (v0.3→v0.4) promoted into objects/. The `split | agreements` backlog note repointed from the retired AGR-007 to Agreement BR-018. |
