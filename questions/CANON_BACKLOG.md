# Canon Backlog

> **Version:** 1.2
> **Owner:** Stu
> **Last Updated:** 2026-03-15
> **Status:** Living Document — updated continuously as canon is developed

---

## Purpose

This document serves two purposes:

1. **Curated Backlog** — objects that are in progress or not yet started, with contextual notes to guide future canon sessions. Completed objects are removed from this section — the Full Object Inventory below serves as the authoritative coverage tracker.
2. **Full Object Inventory** — a complete checklist of all objects identified from the OpenAPI spec, grouped by namespace. Used to track canon coverage across the full platform.

---

## Curated Backlog

### Catalog Namespace

| Object | Status | Notes | Identified During |
|--------|--------|-------|------------------|
| Pricing Policy | 🟡 In progress | See CANON_OBJECT_Catalog_PricingPolicy.md. Open questions: PRP-001, PRP-002, PRP-004. Soft-delete confirmed (PRP-003 resolved). | 2026-03-09 session |

### Commerce Namespace

| Object | Status | Notes | Identified During |
|--------|--------|-------|------------------|
| Order | 🔴 Not started | Four types: Purchase, Change, Termination, Configuration. Has lines with old/new quantity. Querying state exists for Client parameter correction. | Parameter canon, Item discussion |
| Agreement | 🔴 Not started | Active state. Holds parameter value snapshot from Order completion. Associated with one Listing. | Parameter canon, Template canon |
| Subscription | 🔴 Not started | Referenced by Configuration Orders. Has auto-renewal flag. | Item discussion |
| Asset | 🔴 Not started | Vendor-written parameters during fulfilment. | Parameter canon |

### Accounts Namespace

| Object | Status | Notes | Identified During |
|--------|--------|-------|------------------|
| Seller | 🟡 In progress | See CANON_OBJECT_Accounts_Seller.md. 5 open questions (SEL-001, SEL-002, SEL-004, SEL-005, SEL-006). | Listing/Authorization discussion, 2026-03-15 canon session |
| ErpLink | 🔴 Not started | Join object between Buyer and Seller. Carries ERP-side customer identifiers (erpCompanyContact, erpCustomer, accountExternalId). Has status (at least: Blocked). JSON sample available. | Seller canon session |
| Buyer | 🔴 Not started | Associated with Sellers via ErpLinks. May be replicated across multiple ERP instances by MDM team (many:many with Seller). Referenced on Agreement JSON. | Agreement JSON, Seller canon session |
| Licensee | 🔴 Not started | Referenced on Agreement JSON. Must have Active status to place an Order in PROD (ERP-linked constraint — relaxed in STAGING). | Agreement JSON |

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
  - [ ] users
    - [ ] groups
- [ ] api-tokens
- [ ] buyers
- [ ] cloud-tenants
- [ ] erp-links
- [ ] licensees
- [ ] modules
- [x] sellers
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
- [x] pricing-policies
  - [ ] attachments
- [x] products
  - [ ] documents
  - [x] item-groups
  - [x] items
  - [x] media
  - [x] parameter-groups
  - [x] parameters
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
  - [ ] parameter-groups
  - [ ] parameters
  - [ ] templates
  - [ ] terms
    - [ ] variants

### Public-catalog

- [ ] categories
- [ ] industries
- [ ] product-profiles
  - [ ] media
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
| 1.1 | 2026-03-15 | Stu | Seller marked complete in Full Object Inventory. ErpLink added to Accounts backlog. Buyer and Licensee notes expanded. |
| 1.2 | 2026-03-15 | Stu | Completed objects removed from Curated Backlog — purpose note updated. Seller marked in-progress (5 open questions). Authorization marked in-progress (1 open question). Administration namespace renamed to Accounts throughout. erp-links restored to [ ] in Full Object Inventory — curated backlog entry carries the contextual notes. |
| 1.3 | 2026-03-16 | Stu | Pricing Policy marked complete in Curated Backlog and Full Object Inventory. |
