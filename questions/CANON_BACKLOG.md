# Canon Backlog

> **Version:** 0.8
> **Owner:** Stu
> **Last Updated:** 2026-03-14
> **Status:** Living Document — updated continuously as canon is developed

---

## Purpose

This document serves two purposes:

1. **Curated Backlog** — objects that have been identified and contextualised during canon development. Includes status, notes, and sequencing intent.
2. **Full Object Inventory** — a complete checklist of all objects identified from the OpenAPI spec, grouped by namespace. Used as the authoritative coverage tracker.

---

## Curated Backlog

### Catalog Namespace

| Object | Status | Notes | Identified During |
|--------|--------|-------|------------------|
| Unit of Measure | 🟢 Complete | See CANON_OBJECT_Catalog_UnitOfMeasure.md. Platform-level reference object. 13 units in PROD as of 2026-03-09. | Item canon |
| Price List | 🟢 Complete | See CANON_OBJECT_Catalog_PriceList.md | Price List canon session |
| Price List Item | 🟢 Complete | See CANON_OBJECT_Catalog_PriceList_Item.md | Price List canon session |
| Authorization | 🟢 Complete | See CANON_OBJECT_Catalog_Authorization.md | Listing/Authorization discussion |
| Listing | 🟢 Complete | See CANON_OBJECT_Catalog_Listing.md | Listing/Authorization discussion |
| Pricing Policy | 🔴 Not started | Catalog namespace. No further detail captured yet. | 2026-03-09 session |

### Commerce Namespace

| Object | Status | Notes | Identified During |
|--------|--------|-------|------------------|
| Order | 🔴 Not started | Four types: Purchase, Change, Termination, Configuration. Has lines with old/new quantity. Querying state exists for Client parameter correction. | Parameter canon, Item discussion |
| Agreement | 🔴 Not started | Active state. Holds parameter value snapshot from Order completion. Associated with one Listing. | Parameter canon, Template canon |
| Subscription | 🔴 Not started | Referenced by Configuration Orders. Has auto-renewal flag. | Item discussion |
| Asset | 🔴 Not started | Vendor-written parameters during fulfilment. | Parameter canon |

### Administration Namespace

| Object | Status | Notes | Identified During |
|--------|--------|-------|------------------|
| Seller | 🔴 Not started | SoftwareOne subsidiary. Acts as Owner on Authorization, and as transacting party on Listing. | Listing/Authorization discussion |
| Buyer | 🔴 Not started | Referenced on Agreement JSON. | Agreement JSON |
| Licensee | 🔴 Not started | Referenced on Agreement JSON. | Agreement JSON |

### Audit Namespace

| Object | Status | Notes | Identified During |
|--------|--------|-------|------------------|
| Audit Record | 🔴 Not started | Platform-wide. Generated for significant events on objects across all namespaces. JSON example available. Prefix: AUD. | 2026-03-09 session |

---

## Investigation Items

| Item | Description | Priority |
|------|-------------|----------|
| Webhook type / Product settings relationship | Explore the link between Webhook.type values and Product.settings fields. Likely relevant to how product-level settings determine which webhook event types are fired or available. | To be scheduled |

---

## Full Object Inventory

Generated from OpenAPI spec. One entry per object identified from path structure. Update status as canon is completed.

`icon` endpoints are excluded — icon behaviour is a platform-wide pattern documented in `PLATFORM_CANON_PREAMBLE.md` Section 9, not a per-object canon concern.

Legend: `[ ]` = not started · `[~]` = in progress · `[x]` = complete

### Accounts

- [ ] account-users
  - [ ] groups
- [ ] accounts
  - [ ] settings
  - [ ] users
    - [ ] groups
- [ ] api-tokens
- [ ] buyers
- [ ] cloud-tenants
- [ ] erp-links
- [ ] licensees
- [ ] modules
- [ ] sellers
- [ ] services
- [ ] user-groups
- [ ] users
  - [ ] accounts
  - [ ] sso
  - [ ] sso-check

### Audit

- [ ] event-types
- [ ] records

### Billing

- [ ] analytics
- [ ] credit-memos
  - [ ] attachments
- [ ] custom-ledgers
  - [ ] attachments
  - [ ] charges
  - [ ] queue
  - [ ] upload
- [ ] invoices
  - [ ] attachments
- [ ] journals
  - [ ] attachments
  - [ ] charges
  - [ ] enquiry
  - [ ] sellers
  - [ ] upload
- [ ] ledgers
  - [ ] attachments
  - [ ] charges
  - [ ] queue
- [ ] manual-overrides
- [ ] statements
  - [ ] attachments
  - [ ] charges
  - [ ] children
  - [ ] error
  - [ ] pending
  - [ ] queue

### Catalog

- [x] authorizations
- [x] items
- [x] listings
- [x] price-lists
  - [x] items
- [ ] pricing-policies
  - [ ] attachments
- [x] products
  - [ ] documents
  - [x] item-groups
  - [x] items
  - [x] media
    - [ ] image
  - [x] parameter-groups
  - [x] parameters
  - [ ] settings
  - [x] templates
  - [x] terms
    - [x] variants
- [x] units-of-measure

### Commerce

- [ ] agreements
  - [ ] attachments
  - [ ] lines
  - [ ] split
  - [ ] template
- [ ] assets
  - [ ] lines
- [ ] lines
- [ ] orders
  - [ ] assets
  - [ ] lines
  - [ ] quote
  - [ ] subscriptions
  - [ ] template
- [ ] requests
  - [ ] attachments
  - [ ] messages
  - [ ] template
- [ ] subscriptions
  - [ ] lines
  - [ ] split

### Exchange

- [ ] currencies
- [ ] pairs
  - [ ] rates
- [ ] rates

### Extensibility

- [ ] categories
- [ ] extensions
  - [ ] documents
  - [ ] installations
  - [ ] instances
  - [ ] media
    - [ ] image
  - [ ] terms
    - [ ] variants
  - [ ] token
- [ ] installations
  - [ ] token

### Helpdesk

- [ ] cases
- [ ] channels
  - [ ] messages
- [ ] chats
  - [ ] attachments
  - [ ] links
  - [ ] messages
  - [ ] participants
- [ ] feedback
  - [ ] attachments
    - [ ] download
- [ ] forms
  - [ ] parameter-groups
  - [ ] parameters
- [ ] parameter-groups
  - [ ] parameters
- [ ] parameters
- [ ] queues

### Integration

- [ ] categories
- [ ] extensions
  - [ ] documents
  - [ ] installations
  - [ ] instances
  - [ ] media
    - [ ] image
  - [ ] terms
    - [ ] variants
  - [ ] token
- [ ] installations
  - [ ] token

### Notifications

- [ ] accounts
  - [ ] categories
    - [ ] contacts
- [ ] batches
  - [ ] attachments
- [ ] categories
- [ ] contacts
- [ ] directories
- [ ] footers
- [ ] messages
- [ ] subscribers
- [ ] templates
  - [ ] variants
- [x] webhooks

### Procurement

- [ ] erp-items
- [ ] sales-orders
  - [ ] attachments
- [ ] sales-quotes
  - [ ] attachments

### Program

- [ ] certificates
- [ ] enrollments
  - [ ] attachments
- [ ] programs
  - [ ] documents
  - [ ] media
    - [ ] image
  - [ ] parameter-groups
  - [ ] parameters
  - [ ] settings
  - [ ] templates
  - [ ] terms
    - [ ] variants

### Public-catalog

- [ ] categories
- [ ] industries
- [ ] product-profiles
  - [ ] media
    - [ ] image
- [ ] segments
- [ ] vendor-profiles

### Spotlight

- [ ] objects
- [ ] queries

### System

- [ ] tasks
  - [ ] logs
  - [ ] queue
  - [ ] result

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
| 0.7 | 2026-03-14 | Stu / Claude | Full Object Inventory section added — generated from OpenAPI spec via extract_objects.py. Catalog namespace objects marked complete where canon exists. Document restructured into Curated Backlog and Full Object Inventory sections. |
| 0.8 | 2026-03-14 | Stu / Claude | Icon endpoints removed from Full Object Inventory — icon behaviour canonised as a platform-wide pattern in PLATFORM_CANON_PREAMBLE.md Section 9. Explanatory note added above inventory. |
