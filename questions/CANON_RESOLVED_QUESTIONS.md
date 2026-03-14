# Canon Resolved Questions

> **Version:** 0.5
> **Last Updated:** 2026-03-14
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

## Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2026-03-09 | Stu / Claude | Initial file. All questions resolved to date migrated from CANON_OPEN_QUESTIONS.md. |
| 0.2 | 2026-03-14 | Stu / Claude | TPL-002 added. PRD-003 added. |
| 0.3 | 2026-03-14 | Stu / Claude | PRD-002 added. |
| 0.4 | 2026-03-14 | Stu / Claude | PRD-001 added. |
| 0.5 | 2026-03-14 | Stu / Claude | ENV-003 added — icon upload endpoint confirmed as GET-only; upload via multipart/form-data on parent object. |
