# Canon Open Questions

> **Version:** 2.0
> **Last Updated:** 2026-04-05
> **Status:** Living Document — updated continuously as canon is developed

---

## Purpose

This document tracks unresolved questions deferred during canon development. Questions are grouped by the canon file they belong to.

When a question is resolved, it is removed from this file and moved to CANON_RESOLVED_QUESTIONS.md. The relevant canon file is updated at the same time.

Question IDs use the API identifier prefix of the object they concern (e.g. PAR-001 for a Parameter question). Exception: ENV-NNN for platform/environment questions that span multiple objects.

---

## CANON_OBJECT_Catalog_Authorization.md

| # | Question |
|---|----------|
| AUT-001 | What are the full semantics of eligibility.partner = true/false? What specifically does partner eligibility gate, and how does it interact with the Partner actor model and Programs/Accounts canon? |

---

## CANON_OBJECT_Catalog_PricingPolicy.md

| # | Question |
|---|----------|
| PRP-001 | What is the full behaviour of the `None` status? Not observed in real API responses — may be purely transitional immediately after creation. Needs testing to confirm. |
| PRP-002 | What is the difference between `None` and `Inactive`? Can a policy go from `None` directly to `Inactive` without ever being activated? |
| PRP-004 | When multiple active Pricing Policies exist for the same Client and eligibility, how does the platform resolve which cap to apply? |

---

## PLATFORM_CANON_PREAMBLE.md

| # | Question |
|---|----------|
| ENV-001 | Which platform constraints are relaxed in non-PROD environments due to external system dependencies (e.g. ERP, vendor provisioning systems, payment processors)? Is there a complete list maintained anywhere, or is this tribal knowledge? This should be documented centrally and referenced from the preamble. |
| ENV-002 | Beyond the ERP-linked Licensee status constraint, are there other external system dependencies that cause constraint relaxation in non-PROD environments (e.g. vendor provisioning systems, payment processors)? |
| ENV-004 | Icon removal mechanism: how is a custom icon removed from an object with jdenticon behaviour? The `/icon` endpoint exposes GET only — the removal mechanism is not confirmed from the spec. |

---

## CANON_OBJECT_Accounts_Seller.md

| # | Question |
|---|----------|
| SEL-002 | The mechanism for accessing Buyer data associated with a Seller is not confirmed. The `buyers` field appears in `$meta.omitted` on Seller responses unconditionally — even when `select=+buyers` is explicitly requested. It is unclear whether Buyers can be queried via the Seller endpoint at all, or whether Buyer access is always via a dedicated Buyer endpoint. |
| SEL-004 | One Seller in production (`BG_CPX`, `SEL-9696-0728`, Disabled) has no `icon` field in its API response, where all other Sellers return a jdenticon URL. Cause unknown — may be a data anomaly from migration or an edge case in icon behaviour for early-created or Disabled records. |
| SEL-005 | The effect of removing a currency from a Seller's `currencies` array on existing Authorizations and Listings denominated in that currency is not confirmed. Whether the platform permits the removal of a currency that is actively referenced downstream is also unconfirmed. |
| SEL-007 | The `erpLink` field on the Seller object is a single `ErpLinkRef` reference, not a collection. The relationship between this field and the broader Seller:Buyer association model is not confirmed. Suspected to represent the Seller's relationship to its ERP instance rather than to a specific Buyer. Requires engineering input. |
| SEL-008 | The `/deactivate` action endpoint exists in the API spec alongside `/disable`. How `deactivate` differs from `disable`, which state it produces, and what its downstream effects are, is not confirmed. |
| SEL-009 | The `SellerStatus` enum includes `Offline` and `Deleted` in addition to `Active` and `Disabled`. The semantics, transition mechanics, and downstream effects of `Offline` and `Deleted` status values are not confirmed. `Deleted` may represent a soft-delete state distinct from the DELETE endpoint. |
| SEL-010 | A `DELETE /v1/accounts/sellers/{id}` endpoint exists in the API spec (returns 204). Whether the platform enforces a deletion guard in practice — and what conditions permit or block deletion — is not confirmed. The downstream impact on Authorizations, Listings, and ErpLinks if a Seller is deleted is not confirmed. |

---

## CANON_OBJECT_Accounts_Account.md

| # | Question |
|---|----------|
| ACC-003 | The downstream effects of setting an Account to `Disabled` are not confirmed. Specifically: whether associated Users are locked out from logging in, whether associated API Tokens are invalidated, and whether active transactions are affected. Requires confirmation. |
| ACC-004 | Whether the platform technically prevents creation of a second Operations Account or a second Account for the same Vendor entity is not confirmed. In PROD these are observed as 1:1 constraints but may be operational discipline rather than platform enforcement. |
| ACC-006 | Whether `externalIds.pyraTenantId` is immutable after creation is not confirmed. Whether the platform enforces uniqueness of `pyraTenantId` across Accounts is also not confirmed. |
| ACC-007 | The purpose and ownership of the `externalName` field is not confirmed. It is present in the spec on `AccountCreate` and `AccountUpdate` but was not observed in the production JSON samples. Whether it applies to all Account types or specific types is not confirmed. |
| ACC-008 | The relationship between a Client Account and Buyers is not fully confirmed. Whether Buyers are directly associated with the Account, or only via ErpLinks, requires engineering input. |

---

## Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
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
