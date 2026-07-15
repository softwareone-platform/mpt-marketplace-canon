# Canon Spec Discrepancies

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-03-14
> **Status:** Living Document — updated continuously during canon development

---

## Purpose

This document records cases where confirmed platform behaviour differs from what the OpenAPI specification states. These discrepancies should be fed back to engineering for spec correction.

Canon always reflects observed and confirmed platform behaviour. Where the spec conflicts with confirmed knowledge, the spec is treated as inaccurate and this document is updated.

---

## Discrepancies

| ID | Object | Field / Behaviour | Spec Says | Confirmed Behaviour | Identified During | Status |
|----|--------|-------------------|-----------|--------------------|--------------------|--------|
| SD-001 | Catalog: Product Item | `CreateProductItemRequest.name` | Not listed in `required` array — implies optional on creation | `name` is always required on creation | Item canon spec review, 2026-03-14 | Pending engineering feedback |
| SD-002 | Catalog: Product Terms | `CreateTermsAndConditionsRequest` — `name`, `description`, `displayOrder` | No `required` array — all fields appear optional | All three fields are required on creation | Terms canon spec review, 2026-03-14 | Pending engineering feedback |
| SD-003 | Catalog: Product Terms Variant | Variant creation | No `CreateTermsVariantRequest` schema exposed in the spec — Variant creation is entirely undocumented | Variant creation is supported. Required fields differ by type — see Terms Variant canon Section 5. | Terms canon spec review, 2026-03-14 | Pending engineering feedback |
| SD-004 | Catalog: Authorization | `CreateAuthorizationRequest.currency` | Not listed in `required` array — implies optional on creation | `currency` is always required on creation | Authorization canon spec review, 2026-03-14 | Pending engineering feedback |
| SD-005 | Catalog: Authorization | `AuthorizationUpdate` — Vendor access annotations | All update fields show `access: ["Client", "Vendor", "Operations"]` — implies Vendor can update name, notes, journal, eligibility, currency, externalIds | Vendor can only write `settings`. All other fields are Operations-managed. | Authorization canon spec review, 2026-03-14 | Pending engineering feedback |
| SD-006 | Notifications: Webhook | `Webhook.criteria` | Declared as an array of `WebhookCriteria` objects (`{key, value}` pairs) | Both a live-fetched real record and direct source review (`WebhookCriteriaService`) confirm `criteria` is actually returned/accepted as a flat object with named keys (e.g. `{"type": "Purchase", "status": "in(status,(Draft,Quoted))", "product.id": "PRD-2873-8874"}`), not an array | Webhook canon refresh, 2026-07-15 | Pending engineering feedback |
| SD-007 | Notifications: Webhook | `objectType` enum | Lists five values: `Order`, `Request`, `Account`, `Enrollment`, `Answer` | Confirmed by PM: only `Order`, `Enrollment`, `Answer` are reachable via any `type`→`objectType` mapping. `Request` refers to an object deprecated and removed from the platform; `Account` was never reachable. Spec should drop both. | Webhook canon refresh, 2026-07-15 | Pending engineering feedback |

---

## Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2026-03-14 | Stu / Claude | Initial file. SD-001 added from Item canon spec review. |
| 0.2 | 2026-03-14 | Stu / Claude | SD-002 removed — was a resolved canon question (TPL-002), not a spec inaccuracy requiring engineering feedback. |
| 0.3 | 2026-03-14 | Stu / Claude | SD-002 added: CreateTermsAndConditionsRequest missing required array. SD-003 added: Terms Variant creation entirely undocumented in spec. |
| 0.4 | 2026-03-14 | Stu / Claude | SD-004 added: CreateAuthorizationRequest.currency not in required array. SD-005 added: AuthorizationUpdate access annotations imply Vendor can update all fields when Vendor can only write settings. |
| 0.5 | 2026-07-15 | Stu / canon-generate | SD-006 added: Webhook.criteria declared as an array in the OpenAPI schema, confirmed to actually be a flat object both via live fetch and source review. |
| 0.6 | 2026-07-15 | Stu / canon-generate | SD-007 added: Webhook.objectType enum lists Request (deprecated/removed) and Account (never reachable) — confirmed by PM, spec should drop both. |
