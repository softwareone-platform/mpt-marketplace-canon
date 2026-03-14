# Canon Backlog — Objects Requiring Future Canon

> **Version:** 0.5
> **Owner:** Stu
> **Last Updated:** 2026-03-09
> **Status:** Living Document — updated continuously as canon is developed

---

## Purpose

This document tracks platform objects that have been identified but not yet canonised. Items are added here when referenced during canon development of other objects. Priority and sequencing to be determined by Stu.

---

## Catalog Namespace

| Object | Status | Notes | Identified During |
|--------|--------|-------|------------------|
| Unit of Measure | 🟢 Complete | See CANON_OBJECT_Catalog_UnitOfMeasure.md. Platform-level reference object. 13 units in PROD as of 2026-03-09. | Item canon |
| Price List | 🟢 Complete | See CANON_OBJECT_Catalog_PriceList.md | Price List canon session |
| Price List Item | 🟢 Complete | See CANON_OBJECT_Catalog_PriceList_Item.md | Price List canon session |
| Authorization | 🟢 Complete | See CANON_OBJECT_Catalog_Authorization.md | Listing/Authorization discussion |
| Listing | 🟢 Complete | See CANON_OBJECT_Catalog_Listing.md | Listing/Authorization discussion |
| Pricing Policy | 🔴 Not started | Catalog namespace. No further detail captured yet. | 2026-03-09 session |

---

## Commerce Namespace

| Object | Notes | Identified During |
|--------|-------|------------------|
| Order | Four types: Purchase, Change, Termination, Configuration. Has lines with old/new quantity. Querying state exists for Client parameter correction. | Parameter canon, Item discussion |
| Agreement | Active state. Holds parameter value snapshot from Order completion. Associated with one Listing. | Parameter canon, Template canon |
| Subscription | Referenced by Configuration Orders. Has auto-renewal flag. | Item discussion |
| Asset | Vendor-written parameters during fulfillment. | Parameter canon |

---

## Administration Namespace

| Object | Notes | Identified During |
|--------|-------|------------------|
| Seller | SoftwareOne subsidiary. Acts as Owner on Authorization, and as transacting party on Listing. | Listing/Authorization discussion |
| Buyer | Referenced on Agreement JSON. | Agreement JSON |
| Licensee | Referenced on Agreement JSON. | Agreement JSON |

---

## Audit Namespace

| Object | Status | Notes | Identified During |
|--------|--------|-------|------------------|
| Audit Record | 🔴 Not started | Platform-wide. Generated for significant events on objects across all namespaces. JSON example available. Prefix: AUD. | 2026-03-09 session |

---

## Investigation Items

| Item | Description | Priority |
|------|-------------|----------|
| Webhook type / Product settings relationship | Explore the link between Webhook.type values and Product.settings fields. Likely relevant to how product-level settings determine which webhook event types are fired or available. | To be scheduled |

---

## Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2026-03-08 | Stu / Claude | Initial backlog. Seeded from Item canon development session. |
| 0.2 | 2026-03-09 | Stu / Claude | Price List and Price List Item marked complete. Authorization and Listing added as pending. |
| 0.3 | 2026-03-09 | Stu / Claude | Authorization and Listing marked complete. |
| 0.4 | 2026-03-09 | Stu / Claude | Unit of Measure marked complete. Catalog namespace canon queue complete. |
| 0.5 | 2026-03-09 | Stu / Claude | Pricing Policy added to Catalog namespace. Audit namespace and Audit Record added. |
| 0.6 | 2026-03-14 | Stu / Claude | Investigation Items section added. Webhook type / Product settings relationship added for future exploration. |
