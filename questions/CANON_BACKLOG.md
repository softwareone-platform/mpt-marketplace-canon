# Canon Backlog

> **Version:** 1.1
> **Owner:** Stu
> **Last Updated:** 2026-03-15
> **Status:** Living Document — updated continuously as canon is developed

---

## Purpose

This document is the authoritative backlog and coverage tracker for platform canon. It tracks every known platform object across all namespaces — whether not started, in progress, or complete — in a single unified table.

---

## Status Legend

| Status | Meaning |
|--------|---------|
| 🟢 Complete | Canon document exists and is considered current |
| 🟡 In Progress | Canon session started; document exists but is incomplete or unreviewed |
| 🔴 Not Started | Object identified; no canon work begun |

---

## Object Backlog

| Namespace | Object | Parent | Status | Canon File | Notes |
|-----------|--------|--------|--------|------------|-------|
| Accounts | account-users | — | 🔴 Not Started | | |
| Accounts | groups | account-users | 🔴 Not Started | | |
| Accounts | accounts | — | 🔴 Not Started | | |
| Accounts | users | accounts | 🔴 Not Started | | |
| Accounts | groups | users | 🔴 Not Started | | |
| Accounts | api-tokens | — | 🔴 Not Started | | |
| Accounts | buyers | — | 🔴 Not Started | | |
| Accounts | cloud-tenants | — | 🔴 Not Started | | |
| Accounts | erp-links | — | 🔴 Not Started | | |
| Accounts | licensees | — | 🔴 Not Started | | |
| Accounts | modules | — | 🔴 Not Started | | |
| Accounts | sellers | — | 🟡 In Progress | [CANON_OBJECT_Accounts_Seller.md](../objects/CANON_OBJECT_Accounts_Seller.md) | SoftwareOne subsidiary. Acts as Owner on Authorization and as transacting party on Listing. |
| Accounts | services | — | 🔴 Not Started | | |
| Accounts | user-groups | — | 🔴 Not Started | | |
| Accounts | users | — | 🔴 Not Started | | |
| Accounts | accounts | users | 🔴 Not Started | | |
| Accounts | sso | users | 🔴 Not Started | | |
| Accounts | sso-check | users | 🔴 Not Started | | |
| Audit | event-types | — | 🔴 Not Started | | |
| Audit | records | — | 🔴 Not Started | | Platform-wide. Generated for significant events on objects across all namespaces. JSON example available. Prefix: AUD. |
| Billing | analytics | — | 🔴 Not Started | | |
| Billing | credit-memos | — | 🔴 Not Started | | |
| Billing | attachments | credit-memos | 🔴 Not Started | | |
| Billing | custom-ledgers | — | 🔴 Not Started | | |
| Billing | attachments | custom-ledgers | 🔴 Not Started | | |
| Billing | charges | custom-ledgers | 🔴 Not Started | | |
| Billing | queue | custom-ledgers | 🔴 Not Started | | |
| Billing | upload | custom-ledgers | 🔴 Not Started | | |
| Billing | invoices | — | 🔴 Not Started | | |
| Billing | attachments | invoices | 🔴 Not Started | | |
| Billing | journals | — | 🔴 Not Started | | |
| Billing | attachments | journals | 🔴 Not Started | | |
| Billing | charges | journals | 🔴 Not Started | | |
| Billing | enquiry | journals | 🔴 Not Started | | |
| Billing | sellers | journals | 🔴 Not Started | | |
| Billing | upload | journals | 🔴 Not Started | | |
| Billing | ledgers | — | 🔴 Not Started | | |
| Billing | attachments | ledgers | 🔴 Not Started | | |
| Billing | charges | ledgers | 🔴 Not Started | | |
| Billing | queue | ledgers | 🔴 Not Started | | |
| Billing | manual-overrides | — | 🔴 Not Started | | |
| Billing | statements | — | 🔴 Not Started | | |
| Billing | attachments | statements | 🔴 Not Started | | |
| Billing | charges | statements | 🔴 Not Started | | |
| Billing | children | statements | 🔴 Not Started | | |
| Billing | error | statements | 🔴 Not Started | | |
| Billing | pending | statements | 🔴 Not Started | | |
| Billing | queue | statements | 🔴 Not Started | | |
| Catalog | authorizations | — | 🟡 In Progress | [CANON_OBJECT_Catalog_Authorization.md](../objects/CANON_OBJECT_Catalog_Authorization.md) | |
| Catalog | items | — | 🟢 Complete | [CANON_OBJECT_Catalog_Product_Item.md](../objects/CANON_OBJECT_Catalog_Product_Item.md) | Top-level Item collection (cross-product). |
| Catalog | listings | — | 🟢 Complete | [CANON_OBJECT_Catalog_Listing.md](../objects/CANON_OBJECT_Catalog_Listing.md) | |
| Catalog | price-lists | — | 🟢 Complete | [CANON_OBJECT_Catalog_PriceList.md](../objects/CANON_OBJECT_Catalog_PriceList.md) | |
| Catalog | items | price-lists | 🟢 Complete | [CANON_OBJECT_Catalog_PriceList_Item.md](../objects/CANON_OBJECT_Catalog_PriceList_Item.md) | |
| Catalog | pricing-policies | — | 🟡 In Progress | [CANON_OBJECT_Catalog_PricingPolicy.md](../objects/CANON_OBJECT_Catalog_PricingPolicy.md) | |
| Catalog | attachments | pricing-policies | 🔴 Not Started | | |
| Catalog | products | — | 🟢 Complete | [CANON_OBJECT_Catalog_Product.md](../objects/CANON_OBJECT_Catalog_Product.md) | |
| Catalog | documents | products | 🔴 Not Started | | |
| Catalog | item-groups | products | 🟢 Complete | [CANON_OBJECT_Catalog_Product_ItemGroup.md](../objects/CANON_OBJECT_Catalog_Product_ItemGroup.md) | |
| Catalog | items | products | 🟢 Complete | [CANON_OBJECT_Catalog_Product_Item.md](../objects/CANON_OBJECT_Catalog_Product_Item.md) | |
| Catalog | media | products | 🟢 Complete | [CANON_OBJECT_Catalog_Product_Media.md](../objects/CANON_OBJECT_Catalog_Product_Media.md) | |
| Catalog | parameter-groups | products | 🟢 Complete | [CANON_OBJECT_Catalog_Product_ParameterGroup.md](../objects/CANON_OBJECT_Catalog_Product_ParameterGroup.md) | |
| Catalog | parameters | products | 🟢 Complete | [CANON_OBJECT_Catalog_Product_Parameter.md](../objects/CANON_OBJECT_Catalog_Product_Parameter.md) | |
| Catalog | templates | products | 🟢 Complete | [CANON_OBJECT_Catalog_Product_Template.md](../objects/CANON_OBJECT_Catalog_Product_Template.md) | |
| Catalog | terms | products | 🟢 Complete | [CANON_OBJECT_Catalog_Product_Terms.md](../objects/CANON_OBJECT_Catalog_Product_Terms.md) | |
| Catalog | variants | terms | 🟢 Complete | [CANON_OBJECT_Catalog_Product_Terms_Variant.md](../objects/CANON_OBJECT_Catalog_Product_Terms_Variant.md) | |
| Catalog | units-of-measure | — | 🟢 Complete | [CANON_OBJECT_Catalog_UnitOfMeasure.md](../objects/CANON_OBJECT_Catalog_UnitOfMeasure.md) | Platform-level reference object. 13 units in PROD as of 2026-03-09. |
| Commerce | agreements | — | 🔴 Not Started | | Active state. Holds parameter value snapshot from Order completion. Associated with one Listing. |
| Commerce | attachments | agreements | 🔴 Not Started | | |
| Commerce | lines | agreements | 🔴 Not Started | | |
| Commerce | split | agreements | 🔴 Not Started | | |
| Commerce | template | agreements | 🔴 Not Started | | |
| Commerce | assets | — | 🔴 Not Started | | Vendor-written parameters during fulfilment. |
| Commerce | lines | assets | 🔴 Not Started | | |
| Commerce | lines | — | 🔴 Not Started | | |
| Commerce | orders | — | 🔴 Not Started | | Four types: Purchase, Change, Termination, Configuration. Has lines with old/new quantity. Querying state exists for Client parameter correction. |
| Commerce | assets | orders | 🔴 Not Started | | |
| Commerce | lines | orders | 🔴 Not Started | | |
| Commerce | quote | orders | 🔴 Not Started | | |
| Commerce | subscriptions | orders | 🔴 Not Started | | |
| Commerce | template | orders | 🔴 Not Started | | |
| Commerce | requests | — | 🔴 Not Started | | |
| Commerce | attachments | requests | 🔴 Not Started | | |
| Commerce | messages | requests | 🔴 Not Started | | |
| Commerce | template | requests | 🔴 Not Started | | |
| Commerce | subscriptions | — | 🔴 Not Started | | Referenced by Configuration Orders. Has auto-renewal flag. |
| Commerce | lines | subscriptions | 🔴 Not Started | | |
| Commerce | split | subscriptions | 🔴 Not Started | | |
| Exchange | currencies | — | 🔴 Not Started | | |
| Exchange | pairs | — | 🔴 Not Started | | |
| Exchange | rates | pairs | 🔴 Not Started | | |
| Exchange | rates | — | 🔴 Not Started | | |
| Extensibility | categories | — | 🔴 Not Started | | |
| Extensibility | extensions | — | 🔴 Not Started | | |
| Extensibility | documents | extensions | 🔴 Not Started | | |
| Extensibility | installations | extensions | 🔴 Not Started | | |
| Extensibility | instances | extensions | 🔴 Not Started | | |
| Extensibility | media | extensions | 🔴 Not Started | | |
| Extensibility | terms | extensions | 🔴 Not Started | | |
| Extensibility | variants | terms | 🔴 Not Started | | |
| Extensibility | token | extensions | 🔴 Not Started | | |
| Extensibility | installations | — | 🔴 Not Started | | |
| Extensibility | token | installations | 🔴 Not Started | | |
| Helpdesk | cases | — | 🔴 Not Started | | |
| Helpdesk | channels | — | 🔴 Not Started | | |
| Helpdesk | messages | channels | 🔴 Not Started | | |
| Helpdesk | chats | — | 🔴 Not Started | | |
| Helpdesk | attachments | chats | 🔴 Not Started | | |
| Helpdesk | links | chats | 🔴 Not Started | | |
| Helpdesk | messages | chats | 🔴 Not Started | | |
| Helpdesk | participants | chats | 🔴 Not Started | | |
| Helpdesk | feedback | — | 🔴 Not Started | | |
| Helpdesk | attachments | feedback | 🔴 Not Started | | |
| Helpdesk | download | attachments | 🔴 Not Started | | |
| Helpdesk | forms | — | 🔴 Not Started | | |
| Helpdesk | parameter-groups | forms | 🔴 Not Started | | |
| Helpdesk | parameters | forms | 🔴 Not Started | | |
| Helpdesk | parameter-groups | — | 🔴 Not Started | | |
| Helpdesk | parameters | parameter-groups | 🔴 Not Started | | |
| Helpdesk | parameters | — | 🔴 Not Started | | |
| Helpdesk | queues | — | 🔴 Not Started | | |
| Integration | categories | — | 🔴 Not Started | | |
| Integration | extensions | — | 🔴 Not Started | | |
| Integration | documents | extensions | 🔴 Not Started | | |
| Integration | installations | extensions | 🔴 Not Started | | |
| Integration | instances | extensions | 🔴 Not Started | | |
| Integration | media | extensions | 🔴 Not Started | | |
| Integration | terms | extensions | 🔴 Not Started | | |
| Integration | variants | terms | 🔴 Not Started | | |
| Integration | token | extensions | 🔴 Not Started | | |
| Integration | installations | — | 🔴 Not Started | | |
| Integration | token | installations | 🔴 Not Started | | |
| Notifications | accounts | — | 🔴 Not Started | | |
| Notifications | categories | accounts | 🔴 Not Started | | |
| Notifications | contacts | categories | 🔴 Not Started | | |
| Notifications | batches | — | 🔴 Not Started | | |
| Notifications | attachments | batches | 🔴 Not Started | | |
| Notifications | categories | — | 🔴 Not Started | | |
| Notifications | contacts | — | 🔴 Not Started | | |
| Notifications | directories | — | 🔴 Not Started | | |
| Notifications | footers | — | 🔴 Not Started | | |
| Notifications | messages | — | 🔴 Not Started | | |
| Notifications | subscribers | — | 🔴 Not Started | | |
| Notifications | templates | — | 🔴 Not Started | | |
| Notifications | variants | templates | 🔴 Not Started | | |
| Notifications | webhooks | — | 🟢 Complete | [CANON_OBJECT_Notifications_Webhook.md](../objects/CANON_OBJECT_Notifications_Webhook.md) | |
| Procurement | erp-items | — | 🔴 Not Started | | |
| Procurement | sales-orders | — | 🔴 Not Started | | |
| Procurement | attachments | sales-orders | 🔴 Not Started | | |
| Procurement | sales-quotes | — | 🔴 Not Started | | |
| Procurement | attachments | sales-quotes | 🔴 Not Started | | |
| Program | certificates | — | 🔴 Not Started | | |
| Program | enrollments | — | 🔴 Not Started | | |
| Program | attachments | enrollments | 🔴 Not Started | | |
| Program | programs | — | 🔴 Not Started | | |
| Program | documents | programs | 🔴 Not Started | | |
| Program | media | programs | 🔴 Not Started | | |
| Program | parameter-groups | programs | 🔴 Not Started | | |
| Program | parameters | programs | 🔴 Not Started | | |
| Program | templates | programs | 🔴 Not Started | | |
| Program | terms | programs | 🔴 Not Started | | |
| Program | variants | terms | 🔴 Not Started | | |
| Public-catalog | categories | — | 🔴 Not Started | | |
| Public-catalog | industries | — | 🔴 Not Started | | |
| Public-catalog | product-profiles | — | 🔴 Not Started | | |
| Public-catalog | media | product-profiles | 🔴 Not Started | | |
| Public-catalog | segments | — | 🔴 Not Started | | |
| Public-catalog | vendor-profiles | — | 🔴 Not Started | | |
| Spotlight | objects | — | 🔴 Not Started | | |
| Spotlight | queries | — | 🔴 Not Started | | |
| System | tasks | — | 🔴 Not Started | | |
| System | logs | tasks | 🔴 Not Started | | |
| System | queue | tasks | 🔴 Not Started | | |
| System | result | tasks | 🔴 Not Started | | |

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
