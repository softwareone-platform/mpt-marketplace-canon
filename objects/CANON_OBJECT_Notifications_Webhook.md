# Object Canon: Webhook

> **Version:** 0.3
> **Owner:** Stu
> **Last Updated:** 2026-07-15
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Webhook

**Namespace:** Notifications

**Parent Object:** None — top-level object.

**ID Prefix:** WBH (confirmed via `preamble/PLATFORM_CANON_PREAMBLE.md` §5.3 and observed real object IDs, e.g. `WBH-8684-4304`).

**Description:**
A Webhook is an Account-owned integration hook that causes the platform to call an external HTTP endpoint when a specific platform event occurs. For the event types currently confirmed (see BR-003), this is a **synchronous validation/mutation callout**, not a fire-and-forget notification — the platform waits for the endpoint's response and applies it as a mutation (`Delta`) back onto the triggering object (e.g. `Commerce: Order`, Enrollment). Webhooks belong to an Account, not to a specific Product or other object — the object reference in a Webhook is a scoping filter that determines which single object instance's events it listens for, not a parent relationship.

**Also Known As:** None known.

---

## 2. Ownership & Visibility

> High-level orientation to Actor authority and visibility over this object.
> State-specific nuances belong in Section 4 (Business Rules).

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes | Yes | Yes | Yes | Owns Webhooks scoped to their Account. Confirmed via live fetch: identical response to Operations, no field suppression observed. |
| Operations | Yes | Yes | Yes | Yes | Owns Webhooks scoped to the Operations Account. Treated as the suppression baseline (preamble §5.5). |
| Client | No | No | No | No | Confirmed empirically: a `GET` on a real Webhook ID with a Client token returns `404 Not Found` (not `403`), consistent with Clients having no visibility into this object at all rather than a narrower field-level restriction. |

---

## 3. State Machine

> Each transition specifies which Actor(s) are permitted to execute it.
> Where more than one Actor is listed, any one of them may execute the transition.
> Each execution instance is always attributable to exactly one Actor.

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Enabled | Webhook is active. The platform will call the configured endpoint when matching events occur. | Yes | No |
| Disabled | Webhook is inactive. The platform will not call the endpoint. Events are not queued. | No | No |
| Deleted | Webhook has been soft-deleted. No longer visible via the API in any context. | No | Yes |

**Important mechanism note (confirmed directly in source):** "Deleted" is **not** a value of the `status` field — the public `WebhookStatus` enum contains only `{Enabled, Disabled}` (`Platform.Models.Core/Notifications/Webhooks/WebhookStatus.cs`, matches the OpenAPI schema exactly). Deletion is tracked via a separate internal `IsDeleted` boolean (`Webhook.cs:60`), set by `Webhook.Delete()` (`Webhook.cs:107-111`) and persisted as an `UPDATE`, never a `DELETE`, via a generic soft-delete mechanism shared across many aggregates (`DbContextBase.BeforeSaveProcessExtraFlags`, `Infrastructure.Persistence/DbContextBase.cs:184-207`). The `status` field's last value (Enabled or Disabled) is retained unchanged after deletion — it is not overwritten. Exclusion from query results is done by explicit `!IsDeleted` predicates in each Webhook-specific query specification (e.g. `WebhookByIdSpecification`), not a global EF query filter — this is worth noting because some other objects in this codebase (e.g. Product) do use a global filter for the same purpose, but Webhook does not.

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
|----|-----------|---------|--------|-----------------|-------|-------------|-------|
| T1 | — | Enabled | Create Webhook | `POST` (base collection endpoint) | Vendor, Operations | The `criteria` block must include the mandatory anchor key for the given `type` (see BR-005a) | Webhook created in Enabled state by default (BR-002). |
| T2 | Enabled | Disabled | Disable Webhook | `disable` (`POST .../{id}/disable`) | Vendor, Operations | None found — `ChangeWebhookStatusCommandHandler` applies no guard beyond "exists, belongs to this account, not deleted" | Webhook stops intercepting events. No queuing of missed events. |
| T3 | Disabled | Enabled | Enable Webhook | `enable` (`POST .../{id}/enable`) | Vendor, Operations | Same as T2 — no additional guard confirmed | Webhook resumes intercepting matching events. |
| T4 | Enabled | Deleted | Delete Webhook | `DELETE /{id}` | Vendor, Operations | None found | Sets the internal deletion flag (see 3.1 note); `status` value is retained but unused. Permanently removed — no longer retrievable via the API. |
| T5 | Disabled | Deleted | Delete Webhook | `DELETE /{id}` | Vendor, Operations | None found | Same as T4. |

### 3.3 State Diagram

```
[Enabled] ---(disable : Vendor, Operations)---> [Disabled]
[Disabled] ---(enable : Vendor, Operations)---> [Enabled]
[Enabled] ---(DELETE /{id} : Vendor, Operations)---> [Deleted]
[Disabled] ---(DELETE /{id} : Vendor, Operations)---> [Deleted]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Webhook belongs to exactly one [[Account]]. The owning Account determines which Actor controls it. | All | All | Unchanged from prior canon; consistent with confirmed live data (`account` reference on every fetched record). |
| BR-002 | A Webhook is created in Enabled state by default. | N/A | All | Confirmed directly: `CreateWebhookCommandHandler`. |
| BR-003 | A Webhook has a `type` that determines both which platform event triggers it and, via BR-003a, its `objectType`. Confirmed values: `ValidatePurchaseOrderDraft`, `ValidatePurchaseOrderQuerying`, `ValidateChangeOrderDraft`, `ValidateTerminateOrder`, `SelectOrderLines`, `ValidateEnrollmentDraft`, `ValidateEnrollmentQuerying`, `ValidateReEnrollment`, `ValidateReEnrollmentQuerying`, `ValidateConfigurationOrderDraft`, `ValidateAnswer`. | All | All | Confirmed via live OpenAPI schema (`WebhookType` enum) — supersedes prior canon's 5-value list, one of which (`ValidateRequest`) does not exist in the real enum at all. |
| BR-003a | `objectType` is **derived** from `type` via a platform-hardcoded mapping — it cannot be set independently. Confirmed mappings: Order-family types (`ValidatePurchaseOrderDraft/Querying`, `ValidateChangeOrderDraft`, `ValidateConfigurationOrderDraft`, `ValidateTerminateOrder`, `SelectOrderLines`) → `Order`; Enrollment-family types (`ValidateEnrollmentDraft/Querying`, `ValidateReEnrollment`, `ValidateReEnrollmentQuerying`) → `Enrollment`; `ValidateAnswer` → `Answer`. These three are the only reachable `objectType` values. | All | All | Confirmed directly: `Webhook.MapTypeToObjectType` (`Webhook.cs:124-141`). Confirmed by Stu (PM), 2026-07-15: the public schema's `objectType` enum also lists `Account` and `Request`, but `Request` refers to an object that has been deprecated and removed from the platform, and `Account` was never a reachable value. Logged as a spec discrepancy — see `questions/CANON_SPEC_DISCREPANCIES.md` SD-007. |
| BR-004 | `object` is a reference to the exact single object instance (id/name/icon snapshot) this Webhook is scoped to, resolved from the `criteria` block's mandatory anchor key at create/update time. | All | All | Resolution confirmed directly (`ChangeWebhookCommandHandler.GetBusinessObject`). If the referenced object cannot be found, creation/update fails with `EntityNotFoundException` — though per BR-004a this is not reachable via deletion for Product/Program specifically. |
| BR-004a | Products and Programs cannot be hard-deleted — they can only be Unpublished. The "referenced object deleted" scenario in BR-004 therefore never actually occurs for a Webhook scoped to a Product or Program. | All | All | Confirmed by Stu (PM), 2026-07-15. Consistent with `Catalog: Product` canon (Products cannot be deleted in any state — see the resolved question AUT-002 in `questions/CANON_RESOLVED_QUESTIONS.md`). |
| BR-005 | `criteria` is a flat set of key/value string pairs, not a single freeform RQL expression. Each key is a JSON property path (dot notation) into the triggering event's payload (e.g. `product.id`, `status`). | All | All | **Corrects prior canon**, which described `criteria` as "any valid RQL expression." Confirmed both by live fetch (`{"type": "Purchase", "status": "in(status,(Draft,Quoted))", "product.id": "PRD-2873-8874"}`) and directly in source (`WebhookCriteriaService.TryGetPropertyByPath`). Also see `questions/CANON_SPEC_DISCREPANCIES.md` SD-006 — the OpenAPI schema declares `criteria` as an *array* of `{key,value}` objects, but the real, observed shape is a flat object. |
| BR-005a | Every `type` has a mandatory anchor criteria key that must be present or creation/update fails (`InvalidDomainModelException`): Order-family types require `product.id`; Enrollment-family types require `program.id`; `ValidateAnswer` requires `form.id`. | All | All | Confirmed directly: `WebhookCriteriaService.GetObjectIdPathForType`, `ChangeWebhookCommandHandler.HandleObjectReference`. |
| BR-005b | The `status` criteria key is the only key that may hold multiple values simultaneously (OR-matched against the event payload). Every other criteria key is deduplicated to a single value when user-supplied criteria are combined with the type's default anchor key. | All | All | Confirmed directly: `WebhookCriteriaCollection.Join`. |
| BR-005c | Bulk/dictionary criteria input accepts an RQL-style `in(key,(v1,v2))` value syntax, which the platform explodes into multiple individual criteria entries. | All | All | Confirmed directly: `WebhookCriteriaCollection.FromDictionary`. |
| BR-006 | When a Webhook fires (for the `type` values confirmed in BR-003, all currently Order/Enrollment/Answer-validation events), the platform makes a synchronous HTTP call and applies the response as a mutation (`Delta`) back onto the triggering object. Only the first Enabled, non-deleted Webhook whose criteria match is called — the platform does not fan out to every matching Webhook. | Enabled | All | **Corrects prior canon**, which described this as a generic fire-and-forget notification call with no response handling. Confirmed directly: `CallWebhookCommandHandler.Handle`, `OrderValidationRequest`. The exact trigger point within each of the 11 `type` values' respective state machines was not traced line-by-line for every case — treat the *mechanism* (synchronous, single-webhook, mutation-applying) as confirmed, and the specific trigger moment per `type` as inferred from naming/context. |
| BR-006a | `secret`, when set, is the signing key for a JWT the platform generates and sends as a Bearer token to authenticate itself to the vendor's endpoint. When `secret` is null/empty, the platform instead uses an ambient service token, distinguishing vendor-owned Webhooks (JWT-authenticated) from platform-Extension-owned Webhooks. | All | All | Confirmed directly in code (`DefaultWebhookHttpClient.GenerateJwtToken`, `WebhookClient.SendImpl`) and confirmed correct by Stu (PM), 2026-07-15. Not previously documented at all in prior canon. |
| BR-007 | The platform does not auto-disable a Webhook based on failure thresholds. The `failuresSinceLastSuccess` statistic is purely informational. | All | All | Unchanged from prior canon; consistent with confirmed live statistics data. |
| BR-008 | When a Webhook is Disabled, events that would have triggered it are not queued. Missed events are lost. | Disabled | All | Consistent with the matching engine only querying `Status == Enabled` Webhooks (`CallWebhookCommandHandler`). |
| BR-009 | Deletion is a soft delete via a separate internal flag (see 3.1). Deleted Webhooks are not visible in any normal API response. | Deleted | Vendor, Operations | Language corrected from prior canon to reflect the confirmed mechanism (3.1) rather than implying a third `status` value. |
| BR-010 | A Webhook is always scoped to exactly one object instance via its mandatory anchor criteria key (BR-005a). It cannot be configured to fire across multiple object instances. | All | All | Unchanged from prior canon. |
| BR-011 | Clients cannot create, read, update, or delete Webhooks. | All | Client | Confirmed empirically (Section 2) — a live `GET` with a Client token returns `404`. |
| BR-012 | The platform retries a Webhook call only when the endpoint returns a successful HTTP status but the response body cannot be parsed into the expected response type — up to 2 additional attempts, 1 second apart. Network failures, timeouts, and non-2xx HTTP statuses are recorded as a single failed attempt with no retry. | All | All | **Corrects prior canon**, which stated the platform "does not retry failed Webhook calls" without qualification. Confirmed directly: `WebhookClient.Send`, `ParseCallResult`. Whether `IDefaultWebhookHttpClient`/`IExtensionsWebhookHttpClient` implementations add further resilience (a `Polly` import was seen but no policy usage was found in the traced file) was raised and explicitly descoped by Stu (PM), 2026-07-15 — an internal engineering "how" detail, not a business rule; this rule's confirmed observable behaviour is sufficient for canon. |
| BR-013 | Webhooks are unaffected by the state of their owning [[Account]]. Since Accounts cannot be deleted, there is no cascade deletion path from Account to Webhook. | All | All | Unchanged from prior canon. |
| BR-014 | At most one non-deleted Webhook may exist per (Account, `type`, `object.id`) combination. Creating or updating a Webhook that would violate this throws a conflict error. | All | Vendor, Operations | Confirmed directly: `WebhookByObjectIdAndWebhookTypeSpecification` / `AnotherWebhookByObjectIdAndWebhookTypeSpecification`, `WebhookAlreadyExistsException`. Not documented in prior canon at all. |
| BR-015 | `statistics` and call-history (`lastCall`/`lastSuccess`/`lastFailure`) updates are applied via an internal asynchronous queue and do not generate a normal audit/update event on the Webhook. | All | All | Confirmed directly: `WebhookClient.UpdateStatistics` → `UpdateWebhookStatisticsCommand`, marked `EventHints.Silent`. Relevant to Section 8 audit expectations — not documented in prior canon. |

---

## 5. Key Attributes

> All attribute writes are Actor-attributed, following the same rules as transitions.

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| Name | String | Name of the Webhook. Defaults to the Webhook ID if not specified. | Vendor, Operations | Yes | — |
| Description | String | Optional description of the Webhook's purpose | Vendor, Operations | Yes | — |
| Status | Enum | One of: `Enabled`, `Disabled`. Does **not** include a `Deleted` value — see Section 3.1. | System (via T2/T3) | Yes — via state transitions only | — |
| Type | Enum | The platform event type that triggers this Webhook. See BR-003 for the full confirmed list (11 values). | Vendor, Operations | No | Immutable after creation. |
| Object Type | Enum | Derived from `Type` — see BR-003a. Only reachable values: `Order`, `Enrollment`, `Answer`. The schema also lists `Account` (never reachable) and `Request` (deprecated, object removed from the platform) — see SD-007. | System (derived) | No | Immutable after creation; not independently settable. |
| Object | Object | Reference (id, name, icon) to the single object instance this Webhook is scoped to. See BR-004. | System (derived from `criteria`) | No — re-derived on update if criteria's anchor key changes | — |
| URL | String | The external HTTP endpoint the platform calls when the Webhook fires | Vendor, Operations | Yes | URL validity is the owning Actor's responsibility. |
| Secret | String | Nullable. JWT signing key used to authenticate the platform to the vendor's endpoint when set — see BR-006a. | Vendor, Operations | Yes | Omitted by default — request via `select=+secret`. Absent from response when null. Changing it fires an internal `WebhookSecretUpdatedEvent` with the value redacted from the emitted event payload. Not documented at all in prior canon. |
| Criteria | Object (flat key/value map) | JSON-payload-path keyed filter scoping this Webhook to one object instance and, optionally, additional match conditions. See BR-005/BR-005a/BR-005b/BR-005c. | Vendor, Operations | Yes | **Structure corrected from prior canon** — not a single RQL expression; see BR-005 and SD-006 (spec discrepancy: schema declares an array, real shape is a flat object). |
| Statistics | Object | Running totals: `total`, `successes`, `failures`, `failuresSinceLastSuccess` | System | N/A | Read-only. Omitted by default — request via `select=+statistics`. Purely informational (BR-007). |
| Last Call | Object | The most recent call **regardless of outcome** — success or failure. | System | N/A | Read-only, computed at query time (not separately stored). Omitted by default. Not documented at all in prior canon; distinct from Last Success/Last Failure below. |
| Last Success | Object | Details of the most recent **successful** call. | System | N/A | Read-only, computed at query time from the same retained `WebhookCall` history as Last Call/Last Failure. Omitted by default. |
| Last Failure | Object | Details of the most recent **failed** call. | System | N/A | Read-only. Omitted by default. Only the single most recent success and single most recent failure are retained internally — older call history is discarded, not archived (see Section 8). |
| Revision | Integer | Increments when the Webhook's own attributes change | System | N/A | Statistics/call-history changes do **not** increment this the same way other field changes do — see BR-015. |

---

## 6. Relationships to Other Objects

> Captures structural and associative links between this object and others.

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Accounts: Account | Parent | Many:1 | A Webhook belongs to exactly one Account. | No — Accounts cannot be deleted, and Webhooks are unaffected by Account state changes (BR-013). |
| Catalog: Product | Association | Many:1 | A Webhook may be scoped to a specific Product via its `criteria` anchor key (Order-family `type` values). | None — Products cannot be deleted in any state (BR-004a), only Unpublished, so the referenced-object-deleted scenario does not apply. |
| Catalog: Program | Association | Many:1 | A Webhook may be scoped to a specific Program via its `criteria` anchor key (Enrollment-family `type` values). | Same as Product above (BR-004a). |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Webhook created | Actor creates Webhook | Vendor, Operations | Webhook enters Enabled state and begins intercepting matching events immediately. `object` is resolved and snapshotted from the `criteria` anchor key (BR-004). |
| Webhook disabled | T2 — Enabled to Disabled | Vendor, Operations | Platform stops calling the Webhook endpoint. No event queuing. |
| Webhook enabled | T3 — Disabled to Enabled | Vendor, Operations | Platform resumes calling the Webhook endpoint for matching events. |
| Webhook deleted | T4/T5 — any state to Deleted | Vendor, Operations | Internal `IsDeleted` flag set (Section 3.1). No longer visible in any API response. |
| Webhook secret updated | Actor updates `secret` | Vendor, Operations | `WebhookSecretUpdatedEvent` fires with the secret value redacted from the emitted payload (BR-006a). Not documented in prior canon. |
| Webhook fires | Matching platform event occurs, and this is the first Enabled/non-deleted Webhook whose criteria match | System (on behalf of owning Actor) | Platform makes a synchronous HTTP call; for the confirmed `type` values, the response is applied as a mutation (`Delta`) back onto the triggering object (BR-006). Success or failure recorded — but see BR-015: these updates go through an internal queue marked Silent and do not generate a normal audit event. |

### 7.2 Cross-Object State Effects

No cross-object state effects flow *from* Webhook events *to* other platform objects beyond the confirmed `Delta` mutation applied by BR-006 back onto the specific object instance that triggered the call. Webhook firing does not otherwise directly cause state transitions on unrelated platform objects.

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
- Enabled → Disabled is reversible (T2/T3), with no confirmed limit on cycles.
- Deleted is terminal and not reversible.

**Deletion:**
Webhook is soft-deleted via a separate internal flag, not a `status` value (Section 3.1). Once deleted, a Webhook is permanently removed — no longer retrievable via the API in any context (unlike the platform's known soft-delete exceptions, Catalog: Pricing Policy and Commerce: Order, which remain retrievable after deletion — Webhook is not such an exception).

**Audit & history requirements:**
Standard field changes (name, description, url, secret, criteria, status transitions) generate normal audit events. Statistics and call-history (`lastCall`/`lastSuccess`/`lastFailure`) updates are the exception — they're applied via an internal queue marked Silent and do not generate a normal audit/update event (BR-015). Only the single most recent successful call and single most recent failed call are retained internally at any time; older call history is discarded, not archived — there is no full call-history audit trail beyond these two most-recent records.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Webhook endpoint returns a successful HTTP status but an unparseable response body | Platform retries up to 2 additional times, 1 second apart. If still unparseable, recorded as a failure. | Vendor / Operations | Medium | Confirmed directly (BR-012). Corrects prior canon's blanket "no retry" claim. |
| Webhook endpoint is unreachable, times out, or returns a non-2xx status | Recorded as a single failure. `failuresSinceLastSuccess` incremented. No retry. | Vendor / Operations | Medium | Confirmed directly — this narrower case (not the parse-failure case above) truly has no retry. |
| Webhook's `criteria` anchor object (Product/Program) is deleted | Not a real scenario — Products and Programs cannot be hard-deleted in any state, only Unpublished (BR-004a). | N/A | N/A | Confirmed by Stu (PM), 2026-07-15. Prior draft of this table speculated about a stale-reference risk here based on an absence-of-evidence repo finding; removed as moot. |
| Webhook's `createdBy`/`modifiedBy` identity no longer resolves to a valid User, ApiToken, or Service identity | The call proceeds anyway, with no resolvable acting-user security context. | Platform (internal) | Low | Confirmed directly; source references a pending ticket (`MPT-14615`) for the Service-identity case. |

---

## 10. Open Questions

No open questions at this time. WBH-001, WBH-002, and WBH-004 were resolved directly with the PM during this drafting session (see `questions/CANON_RESOLVED_QUESTIONS.md`); WBH-003 was raised and explicitly descoped as an internal engineering detail rather than a canon-worthy business rule. Two spec-vs-reality discrepancies remain tracked separately in `questions/CANON_SPEC_DISCREPANCIES.md` (SD-006, SD-007) — those are reports for engineering, not open canon questions.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-03-08 | Stu | Initial canon. Derived from Product-scoped and global Webhook JSON exports and conversation. |
| 0.2 | 2026-07-15 | Stu / canon-generate | Refresh via live OpenAPI schema (STAGING+PROD, identical apart from build version), live-fetched real object (multi-Actor: Vendor/Operations identical, Client 404 confirms BR-011), and source-code research (swo-platform). Corrected: ID Prefix (was "None", is WBH); 3-state model mechanism (Deleted is a separate `IsDeleted` flag, not a third `status` value); `type` enum (11 confirmed values, was 5 with one nonexistent value); `objectType` enum and its derivation from `type` (BR-003a, new); `criteria` structure (flat key/value map with JSON-payload-path keys, not a single RQL expression — BR-005/a/b/c, new); retry behavior (narrow parse-failure-only retry, not a blanket no-retry — BR-012); firing mechanism (synchronous validation/mutation callout with response Delta applied back, not fire-and-forget — BR-006). Added: `secret` and `Last Call` attributes (undocumented previously); BR-006a (secret/JWT purpose), BR-014 (uniqueness constraint), BR-015 (statistics/call updates are Silent, no audit event). Namespace naming corrected in Section 6 (Accounts, not Administration). Endpoint / Verb column added to Section 3.2 per template v0.3. Opened WBH-001 through WBH-004; logged SD-006 (criteria schema discrepancy) in `questions/CANON_SPEC_DISCREPANCIES.md`. |
| 0.3 | 2026-07-15 | Stu / canon-generate | WBH-001 through WBH-004 resolved directly with the PM in the same session, per the updated canon-generate process (ask before parking). WBH-001: `Request` object confirmed deprecated/removed from the platform, `Account` never reachable — added BR-003a note, logged SD-007. WBH-002: Products/Programs confirmed non-deletable (Unpublish only) — added BR-004a, simplified Section 6 and Section 9 accordingly, removed the speculative stale-reference failure mode. WBH-003: explicitly descoped as an internal engineering "how" detail, not a canon business rule — noted in BR-012, not tracked as resolved-with-an-answer. WBH-004: confirmed correct as originally inferred — BR-006a citation updated. Section 10 now empty. |
