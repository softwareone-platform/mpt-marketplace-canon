# Canon Open Questions

> **Version:** 1.3
> **Last Updated:** 2026-03-14
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
| AUT-001 | What are the full semantics of eligibility.partner = true/false? What specifically does partner eligibility gate, and how does it interact with the Partner actor model and Programs/Administration canon? |

---

## PLATFORM_CANON_PREAMBLE.md

| # | Question |
|---|----------|
| ENV-001 | Which platform constraints are relaxed in non-PROD environments due to external system dependencies (e.g. ERP, vendor provisioning systems, payment processors)? Is there a complete list maintained anywhere, or is this tribal knowledge? This should be documented centrally and referenced from the preamble. |
| ENV-002 | Beyond the ERP-linked Licensee status constraint, are there other external system dependencies that cause constraint relaxation in non-PROD environments (e.g. vendor provisioning systems, payment processors)? |
| ENV-004 | Icon removal mechanism: how is a custom icon removed from an object with jdenticon behaviour? The `/icon` endpoint exposes GET only — the removal mechanism is not confirmed from the spec. |

---

## Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2026-03-08 | Stu / Claude | Initial document. |
| 0.2 | 2026-03-09 | Stu / Claude | Added ENV-001, ENV-002, PRI-001, ITM-001, AUT-001. |
| 0.3 | 2026-03-09 | Stu / Claude | Added TPL-001, AUT-002, LST-001, LST-002, PRD-001, TCS-001, PAR-001, PAR-002, PAR-003. |
| 0.4 | 2026-03-09 | Stu / Claude | ITM-001 resolved and moved to resolved file. |
| 0.5 | 2026-03-09 | Stu / Claude | AUT-002, LST-001, LST-002, PRD-001, TPL-001, PRI-001, ITM-002, TCS-001, PAR-001, PAR-002, PAR-003 resolved and moved to resolved file. |
| 0.6 | 2026-03-09 | Stu / Claude | Restructured: resolved questions moved to CANON_RESOLVED_QUESTIONS.md. Question IDs corrected to match object API prefixes. Status column removed — this file contains open questions only. |
| 0.7 | 2026-03-14 | Stu / Claude | TPL-002 added: behaviour when Template created without a type field. |
| 0.8 | 2026-03-14 | Stu / Claude | TPL-002 resolved and removed — Type is always required; API spec omission is a spec inaccuracy. |
| 0.9 | 2026-03-14 | Stu / Claude | PRD-001, PRD-002 added. |
| 1.0 | 2026-03-14 | Stu / Claude | PRD-002 resolved and removed. |
| 1.1 | 2026-03-14 | Stu / Claude | PRD-001 resolved and removed. |
| 1.2 | 2026-03-14 | Stu / Claude | ENV-003 added: icon upload HTTP method (PUT vs POST) unconfirmed. |
| 1.3 | 2026-03-14 | Stu / Claude | ENV-003 resolved and moved to resolved file — /icon endpoint is GET only; icon upload is via multipart/form-data on the parent object endpoint. |
| 1.4 | 2026-03-14 | Stu / Claude | ENV-004 added: icon removal mechanism unconfirmed. |
