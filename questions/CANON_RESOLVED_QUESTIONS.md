# Canon Resolved Questions

> **Version:** 0.6
> **Last Updated:** 2026-03-15
> **Status:** Living Document — append-only reference

---

## Purpose

This document is the archive of resolved questions from CANON_OPEN_QUESTIONS.md. Questions are moved here when resolved. The relevant canon file is updated at the same time.

Question IDs use the API identifier prefix of the object they concern. Exception: ENV-NNN for platform/environment questions.

---

## CANON_OBJECT_Catalog_Authorization.md

| # | Question | Resolution | Canon Reference |
|---|----------|------------|-----------------|
| AUT-002 | What happens to an Authorization when its parent Product is deleted? | Products cannot be deleted in any state — platform architectural invariant. Question is moot. | Product canon BR-002 |

---

## CANON_OBJECT_Catalog_Product.md

| # | Question | Resolution | Canon Reference |
|---|----------|------------|-----------------|
| PRD-001 | Are there any preconditions or completeness requirements for the Draft → Pending transition? | No preconditions. A Product with no child objects can be submitted. Product creation requires name, icon, and website only. | Product canon Section 3.2, Section 5 |
| PRD-002 | What other child object types exist under Product beyond those currently documented? | All child object types under Product have been canonised: Template, Parameter, Parameter Group, Item, Item Group, Terms, Terms Variant, Media, Price List. No further child types are known. | Product canon Section 6 |
| PRD-003 | What is the full settings schema and the behavioral effect of each setting on downstream objects? | Full settings schema documented from OpenAPI spec. Sub-fields: productOrdering, productRequests, itemSelection, orderQueueChanges, preValidation, splitBilling (Client/Operations only), sendCostToErp (Operations only), subscriptionCessation. | Product canon Section 5.1 |

---

## CANON_OBJECT_Catalog_Listing.md

| # | Question | Resolution | Canon Reference |
|---|----------|------------|-----------------|
| LST-001 | What happens to a Listing when its referenced Price List is deleted? | Price Lists can be deleted, but only when not referenced by any Listings. The Listing is the deletion guard on the Price List — it cannot be deleted while any Listing references it. | Price List canon BR-005, Listing canon Section 6 |
| LST-002 | What happens to a Listing when its referenced Seller is deleted or deactivated? | Sellers are never deleted, only disabled. A Listing is unaffected when its Seller is disabled. When a Seller is disabled, new Orders cannot be placed under any Listing referencing that Seller. Existing Agreements and Subscriptions are unaffected. | Listing canon BR-012, Section 9 |

---

## CANON_OBJECT_Catalog_Product.md

| # | Question | Resolution | Canon Reference |
|---|----------|------------|-----------------|
| PRD-001 | What happens to Price Lists when their parent Product is deleted? | Products cannot be deleted in any state — platform architectural invariant. Question is moot. | Product canon BR-002 |

---

## CANON_OBJECT_Catalog_Product_Template.md

| # | Question | Resolution | Canon Reference |
|---|----------|------------|-----------------|
| TPL-001 | Does the platform retain Template content history (prior versions)? | Template content history is captured in the Audit Trail. Templates are overwritten in place — no version history on the Template object itself. Prior versions accessible via Audit namespace. | Template canon Section 8 |
| TPL-002 | The API spec does not mark `type` as required in `CreateTemplateRequest`. Is type optional on creation? | Type is always required on creation. The API spec omission is a spec inaccuracy. | Template canon Section 5 |

---

## CANON_OBJECT_Catalog_PriceList_Item.md

| # | Question | Resolution | Canon Reference |
|---|----------|------------|-----------------|
| PRI-001 | When the "Supported" checkbox for unitLP or unitPP is unchecked, does the platform store null or a sentinel value? | Platform stores null. Field is absent from the API response when null, consistent with null suppression convention. Write null to clear a supported field and mark it unsupported. | Price List Item canon BR-009 |

---

## CANON_OBJECT_Catalog_Product_Item.md

| # | Question | Resolution | Canon Reference |
|---|----------|------------|-----------------|
| ITM-001 | Does terms.model = usage imply quantityNotApplicable = true? Or are these independent? | Confirmed coupled — when terms.model = usage is selected, quantityNotApplicable is automatically set to true and cannot be modified. | Item canon BR-008 |
| ITM-002 | Is deletion of Items permitted for Draft Items only, consistent with other objects? | Confirmed: Draft-only deletion. Once deleted, permanently removed — no longer retrievable via the API. | Item canon Section 8 |

---

## CANON_OBJECT_Catalog_Product_Terms.md

| # | Question | Resolution | Canon Reference |
|---|----------|------------|-----------------|
| TCS-001 | Must a Terms object have at least one Published Variant before it can be submitted to Pending or Published? | No. A Terms with no Published Variants is a valid, if misconfigured, platform state. The platform is permissive — misconfiguration is the Vendor's responsibility. | Terms canon BR-006 |

---

## CANON_OBJECT_Catalog_Product_Parameter.md

| # | Question | Resolution | Canon Reference |
|---|----------|------------|-----------------|
| PAR-001 | What does the `context` property on a Parameter do? What are the valid values beyond `None`? | context is applicable to Order-scoped Parameters only. Valid values: Purchase, Change, Configuration, Termination, None. None means the Parameter applies to all Order types. For all other scopes, context is always None. | Parameter canon BR-002a |
| PAR-002 | What is the full behaviour of Item-scoped parameters? | Item-scoped Parameters store Vendor-defined metadata about a Product Item. Surfaced in the Items list during ordering and filterable by Clients (e.g. a "Product Family" parameter with values "Document Cloud" / "Creative Cloud"). | Parameter canon BR-022 |
| PAR-003 | What constraints are available for Item-scoped parameters? | Item-scoped Parameters support the required constraint only. | Parameter canon BR-012 |

---

## PLATFORM_CANON_PREAMBLE.md

| # | Question | Resolution | Canon Reference |
|---|----------|------------|-----------------|
| ENV-003 | Icon upload endpoint HTTP method: is the custom icon upload a PUT or POST to the `/icon` endpoint? | The `/icon` endpoint exposes GET only. Icon upload is performed via a `multipart/form-data` request on the parent object's own endpoint. | Preamble Section 9.3 |

---

## CANON_OBJECT_Catalog_PricingPolicy.md

| # | Question | Resolution | Canon Reference |
|---|----------|------------|-----------------|
| PRP-003 | Does `Deleted` mean permanently removed from the API, or is this a soft delete? | Soft delete confirmed. Deleted Pricing Policies remain fully retrievable via the API, including in standard list responses. | Pricing Policy canon Section 3.1, Section 8 |

---

## CANON_OBJECT_Accounts_Seller.md

| # | Question | Resolution | Canon Reference |
|---|----------|------------|-----------------|
| SEL-001 | Status transition mechanics for Sellers are not confirmed. Transitions between `Active` and `Disabled` do not appear to be available via the platform API to any Actor. | Resolved via OpenAPI spec review. Status transitions are available via dedicated action endpoints: `POST /activate` (Disabled → Active), `POST /disable` (Active → Disabled), and `POST /deactivate` (semantics unconfirmed — see SEL-008). | Seller canon Section 3.2 |
| SEL-003 | Is `externalId` immutable via the API, or can Operations overwrite it directly? | Confirmed mutable — Operations can override `externalId` via the API. ERP Sync is the source of truth but the field is writable. | Seller canon Section 5 |
| SEL-006 | Whether the platform enforces a minimum cardinality of one on the `currencies` array at creation time is not confirmed. | Confirmed via OpenAPI spec — `SellerCreate` schema has `minItems: 1` on the `currencies` array. Platform-enforced on creation. | Seller canon BR-003, Section 5 |

---

## CANON_OBJECT_Notifications_Webhook.md

| # | Question | Resolution | Canon Reference |
|---|----------|------------|-----------------|
| WBH-001 | The public `objectType` enum includes `Account` and `Request` values, but no confirmed `type`→`objectType` mapping in source produces either. Is there an unconfirmed `type` value that maps to one of these, or are `Account`/`Request` reserved/vestigial in the public schema? | Confirmed by PM: the `Request` object has been deprecated and removed from the platform; `Account` was never a reachable value. Logged as spec discrepancy SD-007 (schema still lists both). | Webhook canon BR-003a, Section 5 |
| WBH-002 | When a Webhook's referenced object (Product/Program) is deleted after the Webhook was created, does anything reactively invalidate, disable, or flag the Webhook — or does it silently go stale? | Confirmed by PM: Products and Programs cannot be hard-deleted — only Unpublished. The referenced-object-deleted scenario does not apply; the speculative stale-reference failure mode was removed from canon. | Webhook canon BR-004a, Section 6, Section 9 |
| WBH-003 | Do `IDefaultWebhookHttpClient`/`IExtensionsWebhookHttpClient` implementations apply any additional resilience beyond the confirmed narrow parse-failure retry? | Descoped by PM — an internal engineering "how" detail, not a business rule for canon; BR-012's confirmed observable retry behaviour is sufficient. Not resolved with a factual answer, but explicitly out of scope rather than left open. | Webhook canon BR-012 |
| WBH-004 | `secret`'s purpose (JWT signing key distinguishing vendor-owned vs platform-Extension-owned Webhooks) was inferred from code, not confirmed — is that framing correct? | Confirmed correct by PM. | Webhook canon BR-006a |

---

## Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2026-03-09 | Stu | Initial file. All questions resolved to date migrated from CANON_OPEN_QUESTIONS.md. |
| 0.2 | 2026-03-14 | Stu | TPL-002 added. PRD-003 added. |
| 0.3 | 2026-03-14 | Stu | PRD-002 added. |
| 0.4 | 2026-03-14 | Stu | PRD-001 added. |
| 0.5 | 2026-03-14 | Stu | ENV-003 added — icon upload endpoint confirmed as GET-only; upload via multipart/form-data on parent object. |
| 0.6 | 2026-03-15 | Stu | SEL-001, SEL-003, SEL-006 added — resolved during Seller canon session and OpenAPI spec review. |
| 0.7 | 2026-03-16 | Stu | PRP-003 added — Deleted is a soft delete confirmed from real API responses. |
| 0.8 | 2026-07-15 | Stu / canon-generate | WBH-001, WBH-002, WBH-004 added — resolved directly with the PM during the same canon-generate session that raised them (never tracked in CANON_OPEN_QUESTIONS.md), per the updated ask-before-parking process. WBH-003 also recorded here as descoped (out of canon scope) rather than answered. |
