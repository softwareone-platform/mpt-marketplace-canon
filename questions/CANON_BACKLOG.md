# Canon Backlog

> **Version:** 1.4
> **Owner:** Stu
> **Last Updated:** 2026-03-25
> **Status:** Living Document — updated continuously as canon is developed

---

## Purpose

This document is the authoritative backlog and coverage tracker for platform canon. It tracks every known platform object across all namespaces — whether not started, in progress, or complete — in a single unified reference.

---

## Status Legend

| Status | Meaning |
|--------|---------|
| 🟢 Complete | Canon document exists and is considered current. No open questions. |
| 🟡 In Progress | Canon session started; document exists but has open questions or is unreviewed. |
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

| Object | Parent | Status | Canon File | Notes |
|--------|--------|--------|------------|-------|
| account-users | — | 🔴 Not Started | | |
| groups | account-users | 🔴 Not Started | | |
| accounts | — | 🟡 In Progress | [CANON_OBJECT_Accounts_Account.md](../objects/CANON_OBJECT_Accounts_Account.md) | 8 open questions (ACC-001 through ACC-008). |
| users | accounts | 🔴 Not Started | | |
| groups | users | 🔴 Not Started | | |
| api-tokens | — | 🔴 Not Started | | |
| buyers | — | 🔴 Not Started | | Referenced on Agreement JSON. |
| cloud-tenants | — | 🔴 Not Started | | |
| erp-links | — | 🔴 Not Started | | |
| licensees | — | 🔴 Not Started | | Referenced on Agreement JSON. |
| modules | — | 🔴 Not Started | | |
| sellers | — | 🟡 In Progress | [CANON_OBJECT_Accounts_Seller.md](../objects/CANON_OBJECT_Accounts_Seller.md) | SoftwareOne subsidiary. Acts as Owner on Authorization and as transacting party on Listing. |
| services | — | 🔴 Not Started | | |
| user-groups | — | 🔴 Not Started | | |
| users | — | 🔴 Not Started | | |
| accounts | users | 🔴 Not Started | | |
| sso | users | 🔴 Not Started | | |
| sso-check | users | 🔴 Not Started | | |

---

## Audit

| Object | Parent | Status | Canon File | Notes |
|--------|--------|--------|------------|-------|
| event-types | — | 🔴 Not Started | | |
| records | — | 🔴 Not Started | | Platform-wide. Generated for significant events on objects across all namespaces. JSON example available. Prefix: AUD. |

---

## Billing

| Object | Parent | Status | Canon File | Notes |
|--------|--------|--------|------------|-------|
| analytics | — | 🔴 Not Started | | |
| credit-memos | — | 🔴 Not Started | | |
| attachments | credit-memos | 🔴 Not Started | | |
| custom-ledgers | — | 🔴 Not Started | | |
| attachments | custom-ledgers | 🔴 Not Started | | |
| charges | custom-ledgers | 🔴 Not Started | | |
| queue | custom-ledgers | 🔴 Not Started | | |
| upload | custom-ledgers | 🔴 Not Started | | |
| invoices | — | 🔴 Not Started | | |
| attachments | invoices | 🔴 Not Started | | |
| journals | — | 🔴 Not Started | | |
| attachments | journals | 🔴 Not Started | | |
| charges | journals | 🔴 Not Started | | |
| enquiry | journals | 🔴 Not Started | | |
| sellers | journals | 🔴 Not Started | | |
| upload | journals | 🔴 Not Started | | |
| ledgers | — | 🔴 Not Started | | |
| attachments | ledgers | 🔴 Not Started | | |
| charges | ledgers | 🔴 Not Started | | |
| queue | ledgers | 🔴 Not Started | | |
| manual-overrides | — | 🔴 Not Started | | |
| statements | — | 🔴 Not Started | | |
| attachments | statements | 🔴 Not Started | | |
| charges | statements | 🔴 Not Started | | |
| children | statements | 🔴 Not Started | | |
| error | statements | 🔴 Not Started | | |
| pending | statements | 🔴 Not Started | | |
| queue | statements | 🔴 Not Started | | |

---

## Catalog

| Object | Parent | Status | Canon File | Notes |
|--------|--------|--------|------------|-------|
| authorizations | — | 🟡 In Progress | [CANON_OBJECT_Catalog_Authorization.md](../objects/CANON_OBJECT_Catalog_Authorization.md) | |
| items | — | 🟢 Complete | [CANON_OBJECT_Catalog_Product_Item.md](../objects/CANON_OBJECT_Catalog_Product_Item.md) | Top-level Item collection (cross-product). |
| listings | — | 🟢 Complete | [CANON_OBJECT_Catalog_Listing.md](../objects/CANON_OBJECT_Catalog_Listing.md) | |
| price-lists | — | 🟢 Complete | [CANON_OBJECT_Catalog_PriceList.md](../objects/CANON_OBJECT_Catalog_PriceList.md) | |
| items | price-lists | 🟢 Complete | [CANON_OBJECT_Catalog_PriceList_Item.md](../objects/CANON_OBJECT_Catalog_PriceList_Item.md) | |
| pricing-policies | — | 🟡 In Progress | [CANON_OBJECT_Catalog_PricingPolicy.md](../objects/CANON_OBJECT_Catalog_PricingPolicy.md) | |
| attachments | pricing-policies | 🔴 Not Started | | |
| products | — | 🟡 In Progress | [CANON_OBJECT_Catalog_Product.md](../objects/CANON_OBJECT_Catalog_Product.md) | Refresh draft generated 2026-07-15 via canon-generate — pending PM review. 0 open questions. Major corrections found vs. current canon (deletion was wrongly documented as impossible; T5 actor scope; new T6 transition; endpoint verb corrections; settings actor restrictions; vendor field schema over-declares its shape vs. real behaviour). See .evidence/catalog_product/20260715T070201Z/draft/. |
| documents | products | 🔴 Not Started | | |
| item-groups | products | 🟢 Complete | [CANON_OBJECT_Catalog_Product_ItemGroup.md](../objects/CANON_OBJECT_Catalog_Product_ItemGroup.md) | |
| items | products | 🟢 Complete | [CANON_OBJECT_Catalog_Product_Item.md](../objects/CANON_OBJECT_Catalog_Product_Item.md) | |
| media | products | 🟢 Complete | [CANON_OBJECT_Catalog_Product_Media.md](../objects/CANON_OBJECT_Catalog_Product_Media.md) | |
| parameter-groups | products | 🟢 Complete | [CANON_OBJECT_Catalog_Product_ParameterGroup.md](../objects/CANON_OBJECT_Catalog_Product_ParameterGroup.md) | |
| parameters | products | 🟢 Complete | [CANON_OBJECT_Catalog_Product_Parameter.md](../objects/CANON_OBJECT_Catalog_Product_Parameter.md) | |
| templates | products | 🟢 Complete | [CANON_OBJECT_Catalog_Product_Template.md](../objects/CANON_OBJECT_Catalog_Product_Template.md) | |
| terms | products | 🟢 Complete | [CANON_OBJECT_Catalog_Product_Terms.md](../objects/CANON_OBJECT_Catalog_Product_Terms.md) | |
| variants | terms | 🟢 Complete | [CANON_OBJECT_Catalog_Product_Terms_Variant.md](../objects/CANON_OBJECT_Catalog_Product_Terms_Variant.md) | |
| units-of-measure | — | 🟢 Complete | [CANON_OBJECT_Catalog_UnitOfMeasure.md](../objects/CANON_OBJECT_Catalog_UnitOfMeasure.md) | Platform-level reference object. 13 units in PROD as of 2026-03-09. |

---

## Commerce

| Object | Parent | Status | Canon File | Notes |
|--------|--------|--------|------------|-------|
| agreements | — | 🔴 Not Started | | Active state. Holds parameter value snapshot from Order completion. Associated with one Listing. |
| attachments | agreements | 🔴 Not Started | | |
| lines | agreements | 🔴 Not Started | | |
| split | agreements | 🔴 Not Started | | |
| template | agreements | 🔴 Not Started | | |
| assets | — | 🔴 Not Started | | Vendor-written parameters during fulfilment. |
| lines | assets | 🔴 Not Started | | |
| lines | — | 🔴 Not Started | | |
| orders | — | 🔴 Not Started | | Four types: Purchase, Change, Termination, Configuration. Has lines with old/new quantity. Querying state exists for Client parameter correction. |
| assets | orders | 🔴 Not Started | | |
| lines | orders | 🔴 Not Started | | |
| quote | orders | 🔴 Not Started | | |
| subscriptions | orders | 🔴 Not Started | | |
| template | orders | 🔴 Not Started | | |
| requests | — | 🔴 Not Started | | |
| attachments | requests | 🔴 Not Started | | |
| messages | requests | 🔴 Not Started | | |
| template | requests | 🔴 Not Started | | |
| subscriptions | — | 🔴 Not Started | | Referenced by Configuration Orders. Has auto-renewal flag. |
| lines | subscriptions | 🔴 Not Started | | |
| split | subscriptions | 🔴 Not Started | | |

---

## Exchange

| Object | Parent | Status | Canon File | Notes |
|--------|--------|--------|------------|-------|
| currencies | — | 🔴 Not Started | | |
| pairs | — | 🔴 Not Started | | |
| rates | pairs | 🔴 Not Started | | |
| rates | — | 🔴 Not Started | | |

---

## Extensibility

| Object | Parent | Status | Canon File | Notes |
|--------|--------|--------|------------|-------|
| categories | — | 🔴 Not Started | | |
| extensions | — | 🔴 Not Started | | |
| documents | extensions | 🔴 Not Started | | |
| installations | extensions | 🔴 Not Started | | |
| instances | extensions | 🔴 Not Started | | |
| media | extensions | 🔴 Not Started | | |
| terms | extensions | 🔴 Not Started | | |
| variants | terms | 🔴 Not Started | | |
| token | extensions | 🔴 Not Started | | |
| installations | — | 🔴 Not Started | | |
| token | installations | 🔴 Not Started | | |

---

## Helpdesk

| Object | Parent | Status | Canon File | Notes |
|--------|--------|--------|------------|-------|
| cases | — | 🔴 Not Started | | |
| channels | — | 🔴 Not Started | | |
| messages | channels | 🔴 Not Started | | |
| chats | — | 🔴 Not Started | | |
| attachments | chats | 🔴 Not Started | | |
| links | chats | 🔴 Not Started | | |
| messages | chats | 🔴 Not Started | | |
| participants | chats | 🔴 Not Started | | |
| feedback | — | 🔴 Not Started | | |
| attachments | feedback | 🔴 Not Started | | |
| download | attachments | 🔴 Not Started | | |
| forms | — | 🔴 Not Started | | |
| parameter-groups | forms | 🔴 Not Started | | |
| parameters | forms | 🔴 Not Started | | |
| parameter-groups | — | 🔴 Not Started | | |
| parameters | parameter-groups | 🔴 Not Started | | |
| parameters | — | 🔴 Not Started | | |
| queues | — | 🔴 Not Started | | |

---

## Integration

| Object | Parent | Status | Canon File | Notes |
|--------|--------|--------|------------|-------|
| categories | — | 🔴 Not Started | | |
| extensions | — | 🔴 Not Started | | |
| documents | extensions | 🔴 Not Started | | |
| installations | extensions | 🔴 Not Started | | |
| instances | extensions | 🔴 Not Started | | |
| media | extensions | 🔴 Not Started | | |
| terms | extensions | 🔴 Not Started | | |
| variants | terms | 🔴 Not Started | | |
| token | extensions | 🔴 Not Started | | |
| installations | — | 🔴 Not Started | | |
| token | installations | 🔴 Not Started | | |

---

## Notifications

| Object | Parent | Status | Canon File | Notes |
|--------|--------|--------|------------|-------|
| accounts | — | 🔴 Not Started | | |
| categories | accounts | 🔴 Not Started | | |
| contacts | categories | 🔴 Not Started | | |
| batches | — | 🔴 Not Started | | |
| attachments | batches | 🔴 Not Started | | |
| categories | — | 🔴 Not Started | | |
| contacts | — | 🔴 Not Started | | |
| directories | — | 🔴 Not Started | | |
| footers | — | 🔴 Not Started | | |
| messages | — | 🔴 Not Started | | |
| subscribers | — | 🔴 Not Started | | |
| templates | — | 🔴 Not Started | | |
| variants | templates | 🔴 Not Started | | |
| webhooks | — | 🟡 In Progress | [CANON_OBJECT_Notifications_Webhook.md](../objects/CANON_OBJECT_Notifications_Webhook.md) | Merged 2026-07-15 (PR #7); further corrected same day following the Product canon refresh (BR-004a, Section 9) and resolved via source-code research (WBH-002: Product deletion has no reactive effect on a referencing Webhook). WBH-001/004 resolved with PM, WBH-003 descoped. 0 open questions remain. Several corrections found vs. prior canon (state mechanism, criteria structure, retry behaviour, firing semantics). |

---

## Procurement

| Object | Parent | Status | Canon File | Notes |
|--------|--------|--------|------------|-------|
| erp-items | — | 🔴 Not Started | | |
| sales-orders | — | 🔴 Not Started | | |
| attachments | sales-orders | 🔴 Not Started | | |
| sales-quotes | — | 🔴 Not Started | | |
| attachments | sales-quotes | 🔴 Not Started | | |

---

## Program

| Object | Parent | Status | Canon File | Notes |
|--------|--------|--------|------------|-------|
| certificates | — | 🔴 Not Started | | |
| enrollments | — | 🔴 Not Started | | |
| attachments | enrollments | 🔴 Not Started | | |
| programs | — | 🔴 Not Started | | |
| documents | programs | 🔴 Not Started | | |
| media | programs | 🔴 Not Started | | |
| parameter-groups | programs | 🔴 Not Started | | |
| parameters | programs | 🔴 Not Started | | |
| templates | programs | 🔴 Not Started | | |
| terms | programs | 🔴 Not Started | | |
| variants | terms | 🔴 Not Started | | |

---

## Public-catalog

| Object | Parent | Status | Canon File | Notes |
|--------|--------|--------|------------|-------|
| categories | — | 🔴 Not Started | | |
| industries | — | 🔴 Not Started | | |
| product-profiles | — | 🔴 Not Started | | |
| media | product-profiles | 🔴 Not Started | | |
| segments | — | 🔴 Not Started | | |
| vendor-profiles | — | 🔴 Not Started | | |

---

## Spotlight

| Object | Parent | Status | Canon File | Notes |
|--------|--------|--------|------------|-------|
| objects | — | 🔴 Not Started | | |
| queries | — | 🔴 Not Started | | |

---

## System

| Object | Parent | Status | Canon File | Notes |
|--------|--------|--------|------------|-------|
| tasks | — | 🔴 Not Started | | |
| logs | tasks | 🔴 Not Started | | |
| queue | tasks | 🔴 Not Started | | |
| result | tasks | 🔴 Not Started | | |

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
