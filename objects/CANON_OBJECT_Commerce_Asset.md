# Object Canon: Asset

> **Version:** 0.4
> **Owner:** Stu
> **Last Updated:** 2026-07-15
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Asset

**Namespace:** Commerce

**Parent Object:** Commerce: Agreement

**ID Prefix:** AST

**Description:**
An Asset is the platform's record of a one-time purchase fulfilment for a Client under a specific [[Agreement]]. Assets represent [[Item]]s billed once rather than on a recurring schedule — as opposed to [[Subscription]]s, which represent recurring Items. Like Subscriptions, Assets are owned by the Vendor. They are created during [[Order]] Processing as an OrderAsset (a temporary representation scoped to the Order) and promoted to a live Asset when the Purchase or Change Order completes, retaining the same ID. The Vendor may also create Assets directly without an Order for migration and edge-case scenarios — this direct-creation path requires at least one Line and requires the parent Agreement to be in New, Draft, or Active status. Assets carry their own parameters, pricing, template, and Lines, but unlike Subscriptions have no renewal service, no commitment date, and no expiry path. A Terminated Asset has no effect on its parent Agreement's status — Active Assets can exist under Terminated Agreements.

**Also Known As:**
None known.

---

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes | Yes | Yes | No | Can create Assets directly (migration/edge cases) or via Order Processing — direct creation and every subsequent Vendor update require the parent Agreement to be in New, Draft, or Active status (see BR-019). Can update `name`, `template`, `parameters.fulfillment`, `externalIds.vendor`, and Lines — not gated by the Asset's own status (see BR-020). Can terminate via the terminate action. Read is scoped to Assets on Agreements where they are the Vendor. |
| Operations | No | Yes | Yes | No | Can update `externalIds.operations` at any time; can update `price.defaultMarkup`, `price.defaultMargin`, and markup/sale-price fields on Asset Lines only while the Asset is Active. Read is not self-scoped — Operations sees all Assets platform-wide. |
| Client | No | Yes | Yes | No | Can update `externalIds.client` at any time; can update `name` only while the Asset is Active. Cannot create, terminate, or delete Assets. Read is scoped to Assets on Agreements belonging to their own Account. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Draft | The Asset exists only within the scope of a Processing Order as an OrderAsset. It is a temporary representation created by the Vendor Extension during Order Processing. Accessible via `/orders/{id}/assets`. The Draft state is not visible on the live Asset — the live Asset is created directly in Active status when the Order completes. | — | — |
| Active | The Asset is live. The Vendor owns and maintains it. There is no renewal service — Active is the permanent state for a live Asset unless the Vendor terminates it. | — | — |
| Terminated | The Asset has been permanently ended by direct Vendor action via the terminate action. Terminal state — no outbound transitions. | — | — |

> **Note on New:** `New` appears in the `AssetStatus` enum as a transient pre-creation state. It is not a stable state visible on live Assets and is not documented as an operational state.

> **Note on Draft:** During Order Processing, the Vendor creates an `OrderAsset` object (a temporary representation scoped to the Order, accessible via `/orders/{id}/assets`). When the Purchase or Change Order completes, the platform promotes the OrderAsset to a live Asset, retaining the same ID. The live Asset is created directly in Active status — the Draft state is scoped to the Order only and is not visible on the live Asset endpoint. If the OrderAsset has no Lines at the point the Order completes, it is discarded rather than promoted — no live Asset is created.

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Active | Order completed — promoted from OrderAsset | No dedicated Asset endpoint — a plain, platform-driven status write. The promotion happens automatically as part of the parent [[Order]]'s own completion processing; there is no separate Asset-facing action to invoke it. | Platform | Purchase or Change Order transitions to Completed; the OrderAsset has at least one Line (an OrderAsset with no Lines is discarded, not promoted). | Platform promotes the OrderAsset to a live Asset under Vendor token context. Same ID retained. Asset linked to Agreement simultaneously. Terms are set from the OrderAsset's own terms. |
| T2 | — | Active | Vendor creates directly | `POST` `/commerce/assets` (Vendor-only) | Vendor | Parent Agreement must be New, Draft, or Active. At least one Line must be supplied, each referencing a valid Item and a quantity of zero or greater. | Used for migration scenarios or direct vendor sync. Asset created directly in Active status without an Order. |
| T3 | Active | Terminated | Terminate Asset | `POST` `/commerce/assets/{id}/terminate` (Vendor-only) | Vendor | Asset must be Active | No effect on parent Agreement status (Agreement price is recalculated). Each of the Asset's still-Active Lines is also transitioned to Terminated with quantity set to zero. |

### 3.3 State Diagram

```
— ---(Order completed, promoted from OrderAsset : Platform)---> [Active]
— ---(Vendor creates directly : Vendor)---> [Active]
[Active] ---(Vendor terminates directly : Vendor)---> [Terminated]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | Assets are owned by the Vendor. The Vendor Extension creates and maintains Assets as the authoritative fulfilment record for one-time purchase Items. This mirrors the Vendor ownership model for Subscriptions. | All | Vendor | This ownership distinction drives the write permission model — the Vendor has broad direct write access to Assets without requiring an [[Order]]. |
| BR-002 | An Asset is normally created during [[Order]] Processing as an OrderAsset and promoted to a live Asset when the Purchase or Change [[Order]] completes. The platform promotes the OrderAsset to a live Asset, retaining the same ID. The live Asset is created directly in Active status — the Draft state is scoped to the [[Order]] only. | — (creation) | Vendor | The Vendor may also create an Asset directly in Active status without an [[Order]] for migration or vendor sync scenarios — see BR-019 and BR-021 for the preconditions on that path. |
| BR-003 | The only path to Terminated status is direct Vendor action via the terminate action. There is no Termination [[Order]] path for Assets — Termination Orders apply to Subscriptions only. Assets are unaffected by Termination Orders. | Active | Vendor | See Commerce: [[Order]] canon BR-022. |
| BR-004 | Terminated is a permanently terminal state. A Terminated Asset cannot be reactivated. A new Asset must be created — typically via a new Purchase or Change [[Order]] — to replace a terminated Asset. | Terminated | All | — |
| BR-005 | A Terminated Asset has no effect on its parent [[Agreement]]'s status. [[Agreement]] termination is driven exclusively by [[Subscription]] state. Active Assets can exist under Terminated Agreements, and Terminated Assets can exist under Active Agreements. | All | All | This is a key difference from Subscriptions, where all Subscriptions reaching Terminated status drives [[Agreement]] termination. Note this is about Agreement *status* only — see BR-019 for a separate Agreement-status precondition that does gate Vendor *writes* to an Asset. |
| BR-006 | There is no renewal service for Assets. Assets have no `commitmentDate` and no `autoRenew` flag. Once Active, an Asset remains Active indefinitely unless the Vendor terminates it. | Active | All | Assets represent one-time purchases — the one-time billing model has no concept of renewal or expiry. |
| BR-007 | Asset-scoped `parameters.fulfillment` are written and maintained exclusively by the Vendor. The Client cannot update Asset parameters directly. Parameters are retained on a Terminated Asset — they are not cleared on termination. | All | Vendor | Parameters with `hidden=true` are suppressed from Client API responses — consistent with the parameter suppression model on Orders, Agreements, and Subscriptions. Vendor parameter writes are gated by the parent Agreement's status (BR-019), not by the Asset's own status (BR-020). |
| BR-008 | An Asset's `terms.period` is always `"one-time"` — every Line under the Asset must have a one-time billing frequency, or the write is rejected. `terms.model` reflects the shared billing model of the Asset's Lines and is not necessarily `"one-time"` — it can also be `"usage"` or `"quantity"`, matching whichever model the Asset's Product Items use (see BR-023). The `commitment` field is absent in all observed samples. Terms are derived from the Asset's Lines and are not directly settable. | All | All | Corrects prior understanding that `terms.model` was always `"one-time"` — the constraint actually enforced is that all Lines share one model, which is not restricted to `"one-time"`. All Lines under an Asset must have matching terms. |
| BR-009 | There is no DELETE endpoint on the live Asset. The only path to a terminal state is Termination via the terminate action. | All | All | — |
| BR-010 | The `name` field can be updated by the Vendor (subject to BR-019's Agreement-status precondition, not gated by the Asset's own status) and by the Client (only while the Asset itself is Active). Operations cannot update `name`. | All | Vendor, Client | Client's `externalIds.client` remains updatable regardless of Asset status; only `name` is Active-gated for Client. |
| BR-011 | The `template` field on an Asset can be set and updated by the Vendor, subject to BR-019's Agreement-status precondition. The template is present on both Active and Terminated Assets in observed samples. | All | Vendor | The Asset's assigned [[Template]] determines the rendered content shown to the Client when viewing their Asset, and can also be rendered on demand (see BR-026). Absent from response when null — consistent with null suppression. |
| BR-012 | Operations can update `price.defaultMarkup` and `price.defaultMargin` directly on an Asset, and can manage markup/sale-price fields on existing Asset Lines — only while the Asset is Active. `externalIds.operations` can be updated regardless of Asset status. These are the only direct update capabilities available to the Operations Actor on an Asset. | Active (for pricing fields) | Operations | Operations cannot add new Lines — only adjust price fields on Lines that already exist on the Asset (see BR-022). |
| BR-013 | Asset pricing uses one-time price fields. `PPx1` (purchase price, one-time) is visible to Vendor and Operations. `SPx1` (selling price, one-time) is visible to Client and Operations. `markup`, `margin`, `defaultMarkup`, `defaultMargin`, `defaultMarkupSource`, and `markupSource` are visible to Operations only. | All | All | Unlike [[Subscription]]s, which use `PPxY`/`PPxM`/`SPxY`/`SPxM`, Assets use `PPx1`/`SPx1` consistent with their one-time billing model. |
| BR-014 | Asset visibility is self-scoped per Actor: Vendor sees only Assets on Agreements where they are the Vendor; Client sees only Assets on Agreements belonging to their own [[Account]]; Operations sees all Assets platform-wide. | All | All | Reconfirmed live for Client: `SPx1` and `currency` are visible; `PPx1`, `markup`, `margin`, `defaultMarkup`, `defaultMargin`, `defaultMarkupSource`, `markupSource` are suppressed. |
| BR-015 | The Asset carries `priceList` and `listing` references directly. This differs from [[Subscription]], which does not carry these fields at the top level. | All | All | Immutable after creation. Derived from the [[Agreement]] at the time of Asset creation. |
| BR-016 | The Asset does not carry `buyer` or `seller` as top-level references. These are accessible via the Asset's Lines. | All | All | This is by design — a deliberate structural difference from [[Subscription]], which carries `buyer` and `seller` directly. |
| BR-017 | The Asset audit block includes a `terminated` sub-key (timestamp and Actor) that is populated when the Asset transitions to Terminated. This is the authoritative record of termination time. | Terminated | All | `audit.updated` also changes at the same time, but reflects only the most recent modification of any kind — `audit.terminated` is the correct field to use for termination time specifically. |
| BR-018 | The Asset `audit` block's schema defines `created`, `updated`, `draft`, `active`, and `terminated` sub-keys. In practice, only `created`, `updated`, and `terminated` are ever populated — the platform does not record an audit event for the Draft or Active transitions, so those two sub-keys are permanently absent for every Asset. This is a deliberate simplification, not a placeholder for a future feature. | All | All | Omitted by default — request via `select=+audit`. |
| BR-019 | Any Vendor write to an Asset — creating it directly, or updating its name, `externalIds.vendor`, template, Lines, or fulfilment parameters — requires the parent [[Agreement]] to be in New, Draft, or Active status. If the Agreement is Terminated, the write is rejected. | All | Vendor | This is a write-time precondition on the Agreement, distinct from BR-005 (which is about the Agreement's status being *unaffected by* Asset termination). |
| BR-020 | Vendor writes to an Asset are not gated by the Asset's own status — a Vendor can still update a Terminated Asset's name, template, `externalIds.vendor`, fulfilment parameters, or Lines, subject only to BR-019's Agreement-status precondition. | All | Vendor | See Section 9 Failure Modes — this is platform-permitted but can be surprising. |
| BR-021 | When creating an Asset directly, the Vendor must supply at least one Line, each referencing a valid [[Item]] and a quantity of zero or greater. Each Line's Item must belong to the same [[Product]] as the parent [[Agreement]], or the write is rejected. | — (creation) | Vendor | — |
| BR-022 | An update that includes the Asset's `lines` array must include every existing Line — omitting one is rejected, as is including a Line ID that isn't already on this Asset, or a duplicate Line ID within the same request. A Line entry with no `id` adds a new Line; one with an `id` updates that Line's quantity or purchase price. | All | Vendor, Operations | Vendor may add new Lines or adjust quantity/purchase price on existing ones. Operations may adjust markup/sale-price fields on existing Lines only (while Active) and cannot add new Lines. |
| BR-023 | All Lines on an Asset must share the same billing frequency (always one-time) and the same billing model; a Line that doesn't match is rejected. | All | Vendor | See BR-008 — this is what determines the Asset's `terms.model`/`terms.period`. |
| BR-024 | Terminating an Asset also transitions each of its still-Active Lines to Terminated and sets their quantity to zero. | Active → Terminated | Vendor | Not a cascade deletion — Lines are status-transitioned, not removed. |
| BR-025 | An Asset's own aggregate `price` is not recalculated when the Asset is terminated — only the parent [[Agreement]]'s price recalculates. On Asset creation or update, both the Asset's own price and the Agreement's price are recalculated. | All | All | See Section 9 Failure Modes — a Terminated Asset's own `price` fields retain their pre-termination values. |
| BR-026 | The Asset's assigned [[Template]] can be rendered on demand, returning the rendered content for display without altering the Asset. | Active, Terminated | Vendor, Operations, Client | Available for any current or explicitly specified Template/language; has no effect on Asset state. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | String | Unique platform identifier for the Asset. | Platform | No | Format: AST-XXXX-XXXX-XXXX. Same ID as the OrderAsset it was promoted from. |
| `revision` | Integer | Increments each time the Asset is updated. | Platform | Yes — platform-managed | — |
| `name` | String | Human-readable name for the Asset. | Platform (at creation) | Yes — see BR-010 | Auto-generated at creation. Vendor may update at any time (subject to BR-019); Client only while Active. |
| `status` | Enum | Current status. Valid values: `Active`, `Terminated`. (`New` and `Draft` are transient states not visible on live Assets.) | Platform | Yes — platform-managed | Driven by Order completion or direct Vendor termination. Not directly writable. |
| `terms` | Object | The billing terms for this Asset. `period` is always `"one-time"`. `model` reflects the shared billing model of the Asset's Lines (`one-time`, `usage`, or `quantity` — see BR-008/BR-023). No `commitment` field observed. | Platform (derived from Lines) | No — see Notes | Re-derived from the Lines' shared billing model/frequency each time Lines are set; since all Lines must share one billing model (BR-023), the effective value cannot actually change once the first Line is set. |
| `price` | Object | Aggregate pricing for the Asset. Contains `PPx1`, `SPx1`, `currency`, `markup`, `margin`, `defaultMarkup`, `defaultMargin`, `defaultMarkupSource`, `markupSource`. | Platform (computed), Operations (defaultMarkup/defaultMargin) | Yes — Operations only for markup fields | `PPx1` visible to Vendor and Operations. `SPx1` visible to Client and Operations. `markup`, `margin`, `defaultMarkup`, `defaultMargin`, `defaultMarkupSource`, `markupSource` visible to Operations only. Recalculated automatically on Asset creation/update; not recalculated on termination (see BR-025). |
| `parameters.fulfillment` | Array | Asset-scoped fulfilment parameters written and maintained by the Vendor Extension. Contains parameters with `phase: "Fulfillment"` and `scope: "Asset"`. | Vendor | Yes — Vendor only, subject to BR-019 | Parameters with `hidden=true` suppressed from Client API responses. Retained on Terminated Assets — not cleared on termination. |
| `template` | Object | Reference to the Catalog: Template assigned to this Asset. Determines rendered content shown to the Client when viewing their Asset. | Vendor | Yes — Vendor, subject to BR-019 | Absent from response when null. Present on both Active and Terminated Assets in observed samples. Can also be rendered on demand (BR-026). |
| `lines` | Array | Lines (Entitlements) associated with this Asset. Accessible via `/assets/{id}/lines` endpoint. | Vendor (initial and subsequent additions), Platform (price fields) | Yes — see BR-022 | Each Line maps one Item at one quantity to this Asset. Line billing model/frequency must match the Asset's other Lines (BR-023). Updating Lines is full-replacement, not partial-patch (BR-022). |
| `externalIds.vendor` | String | Vendor's reference for this Asset. | Vendor | Yes, subject to BR-019 | Optional. Absent from response when null. |
| `externalIds.client` | String | Client's own reference for this Asset. | Client | Yes | Optional. Absent from response when null. |
| `externalIds.operations` | String | Operations' own reference for this Asset. | Operations | Yes | Optional. Absent from response when null. Not gated by Asset or Agreement status. |
| `priceList` | Object | Reference to the Catalog: Price List under which this Asset was priced. | Platform | No | Immutable after creation. Present directly on the Asset — differs from Subscription which does not carry this reference. |
| `listing` | Object | Reference to the Catalog: Listing under which this Asset was established. | Platform | No | Immutable after creation. Present directly on the Asset — differs from Subscription which does not carry this reference. |
| `agreement` | Object | Reference to the parent Commerce: Agreement. | Platform | No | Immutable after creation. |
| `product` | Object | Reference to the Catalog: Product. | Platform | No | Immutable after creation. |
| `licensee` | Object | Reference to the Accounts: Licensee. | Platform | No | Immutable after creation. |
| `audit` | Object | Audit timestamps. Schema defines `created`, `updated`, `draft`, `active`, and `terminated` sub-keys; only `created`, `updated`, and `terminated` are ever populated in practice (see BR-018). | Platform | No | Omitted by default — request via `select=+audit`. `audit.terminated` is the authoritative termination timestamp (see BR-017), not `audit.updated`. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Commerce: Agreement | Parent | Many Assets to one Agreement | Every Asset belongs to an Agreement. Created and linked during Order Processing. | Asset termination has no effect on Agreement status, but recalculates Agreement price. Active Assets can exist under Terminated Agreements. Vendor writes to an Asset require the Agreement to be New, Draft, or Active (BR-019). |
| Commerce: Order | Association | Many Assets to many Orders | Assets are created during Purchase or Change Order Processing and linked to the Agreement on completion. | Asset state is driven by Order completion only — there is no Termination Order path for Assets. |
| Commerce: Order Line | Child | One Asset to many Lines | Lines are the unit of work mapped to this Asset. Accessible via `/assets/{id}/lines`. Also accessible via the Agreement `/lines` endpoint as Entitlements. Not yet canonised as its own object. | Line billing model/frequency must match the Asset's other Lines (BR-023). Terminating the Asset also terminates each of its Active Lines and sets their quantity to zero (BR-024). |
| Catalog: Product | Association | Many Assets to one Product | The Product this Asset covers. Derived from the Agreement. A Line's Item must belong to this Product (BR-021). | Immutable after creation. |
| Catalog: Price List | Association | Many Assets to one Price List | The Price List under which this Asset was priced. Carried directly on the Asset. | Immutable after creation. |
| Catalog: Listing | Association | Many Assets to one Listing | The Listing under which this Asset was established. Carried directly on the Asset. | Immutable after creation. |
| Catalog: Template | Association | Many Assets to one Template | The Template determining rendered content shown to the Client when viewing their Asset. Set and updated by the Vendor; can also be rendered on demand. | No lifecycle dependency — Template changes do not affect Asset status. |
| Accounts: Licensee | Association | Many Assets to one Licensee | The Licensee associated with the Asset's Agreement. | Immutable after creation. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Parameters updated | Vendor updates `parameters.fulfillment` via PUT | Vendor | Values persisted immediately. No state transition. Subject to BR-019's Agreement-status precondition. |
| Template updated | Vendor updates `template` via PUT | Vendor | Rendered content shown to Client updates immediately. No state transition. Subject to BR-019. |
| Lines updated | Vendor or Operations includes `lines` in a PUT request | Vendor (add/update); Operations (price fields on existing Lines only, while Active) | New Lines created, or existing Lines' quantity/price updated. Full existing Line set must be included in the request or the update is rejected (BR-022). |
| Template rendered | Vendor, Operations, or Client calls the render action | Vendor, Operations, Client | Returns the rendered [[Template]] content for display. No state change, no persisted side effect. |
| Asset terminated directly | Vendor calls the terminate action | Vendor | Asset → Terminated. Each still-Active Line transitions to Terminated with quantity set to zero (BR-024). `audit.terminated` (and `audit.updated`) timestamps set by the platform. No effect on parent [[Agreement]] status. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Asset terminated | Commerce: Agreement | No effect on status | N/A | N/A | Agreement status is driven by [[Subscription]] state only. Asset termination does not affect the Agreement's status (see below for the Agreement's price effect). |
| Asset created, updated, or terminated | Commerce: Agreement | Agreement's aggregate price is recalculated. | Yes — platform, under the triggering Actor's token context | N/A | On create/update, the Asset's own price is also recalculated at the same time. On termination, only the Agreement's price recalculates — the Asset's own price fields retain their pre-termination values (BR-025). |
| Asset terminated | Commerce: Order Line (not yet canonised) | Each still-Active Line transitions to Terminated and its quantity is set to zero. | Yes — platform, under the terminating Vendor's own token context | Line was Active immediately before Asset termination | Not a cascade deletion — Lines are status-transitioned, not removed (BR-024). |
| Purchase or Change Order completed | Commerce: Asset | OrderAsset promoted to live Asset → Active | Yes — platform, under Vendor token context | Order type is Purchase or Change; Order transitions to Completed; the OrderAsset has at least one Line | Same ID retained. Asset linked to Agreement simultaneously. An OrderAsset with no Lines is discarded, not promoted. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
There are no reversible transitions. Once an Asset is Terminated it cannot be reactivated.

**Deletion:**
There is no DELETE endpoint on the live Asset. The only terminal state is Terminated — Terminated Assets remain retrievable via the API. Consistent with Platform Invariant 7.

**Audit & history requirements:**
The Asset audit block's schema defines `created`, `updated`, `draft`, `active`, and `terminated` sub-keys. In practice only `created`, `updated`, and `terminated` are ever populated — the platform does not record an audit event for the Draft or Active transitions, so those two sub-keys remain permanently absent for every Asset (see BR-018). When an Asset is terminated, `audit.terminated` (timestamp and Actor) is populated and is the authoritative record of when termination occurred — `audit.updated` reflects only the most recent modification of any kind and should not be used as a termination-time proxy (see BR-017). The audit block is omitted from API responses by default — request via `select=+audit`.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Vendor terminates Asset but parent [[Agreement]] is already Terminated | The Asset can be terminated regardless of Agreement status — Asset termination has no dependency on Agreement status, and vice versa. The terminate action is available on Active Assets regardless of Agreement state. | Vendor | Low | Consistent with the independence of Asset and [[Agreement]] lifecycle. |
| Active Assets remain after Agreement terminates | When all [[Subscription]]s on an [[Agreement]] are Terminated, the Agreement transitions to Terminated — but Active Assets are unaffected and remain Active. The Client retains access to their Asset records under the Terminated Agreement. | Client | Medium | Clients may be surprised to find Active Assets under a Terminated Agreement. Vendor Extensions should handle this case explicitly if business logic requires co-termination of Assets with the Agreement. |
| No `terminationDate` field on Asset | Unlike [[Subscription]], there is no `terminationDate` field on the Asset schema. `audit.terminated` (timestamp and Actor), populated when the Asset transitions to Terminated, is the authoritative source for termination time — not `audit.updated`, which reflects only the most recent modification of any kind. | Operations, Client | Low | Requires `select=+audit` to retrieve. |
| Vendor creates Asset directly without [[Order]] | The Asset is created directly in Active status and linked to the [[Agreement]]. No Order audit trail exists for this Asset's creation. | Operations, Client | Medium | Used for migration scenarios. Operations should ensure direct creations are documented externally. |
| Purchase or Change [[Order]] fails after OrderAsset created | The OrderAsset is abandoned with the Order. The live Asset is never promoted — no AST-prefixed Asset is created. The OrderAsset is only accessible via the Order endpoint and does not appear in the Assets list. | Vendor | Low | The Vendor Extension must handle abandoned OrderAssets as part of [[Order]] failure cleanup. An OrderAsset with no Lines is discarded during Order completion regardless of whether the Order itself succeeds. |
| Vendor writes to a Terminated Asset | The platform does not block Vendor writes (name, template, `externalIds.vendor`, fulfilment parameters, Lines) based on the Asset's own Terminated status — only the parent [[Agreement]]'s status is checked (BR-019). A Vendor Extension can therefore still add or modify Lines, or change the template/name, on an already-Terminated Asset. | Vendor, Operations, Client | Medium | Vendor Extensions should treat Terminated as a stop condition even though the platform permits further writes (BR-020). |
| Terminated Asset's own price fields go stale | Terminating an Asset zeroes its Lines' quantities and recalculates the parent Agreement's price, but does not recalculate the terminated Asset's own aggregate `price` fields — they retain their pre-termination values. | Operations, Vendor | Low | See BR-025. Tooling reading Asset-level price after termination should not treat it as a current entitlement value. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.4 | 2026-07-15 | Stu / canon-generate-batch | AST-002 resolved — the Asset audit block's permanently-absent `draft`/`active` sub-keys are a deliberate simplification, not a placeholder for a future feature (BR-018). Section 10 now empty. |
| 0.3 | 2026-07-15 | Stu / canon-generate | AST-003 resolved via a live re-fetch with a Client-visible test Asset ID: the existing Client-suppression claim (`SPx1`/`currency` visible; `PPx1`/markup/margin/defaultMarkup/defaultMargin suppressed) is reconfirmed (BR-014). AST-002 remains open — genuinely unconfirmed. |
| 0.2 | 2026-07-15 | Stu / canon-generate | Refresh via evidence pipeline (OpenAPI schema, live STAGING fetch, source-code research). Endpoint/Verb column filled in for all Transitions. Corrections: `terms.model` is not always `"one-time"` (can be `usage`/`quantity`, matching the Asset's Lines) — BR-008 corrected, BR-023 added; Asset audit block does define `draft`/`active`/`terminated` sub-keys, though only `terminated` is ever populated — BR-017/BR-018 corrected, resolving AST-001; new Agreement-status precondition on all Vendor writes to an Asset (BR-019); Vendor writes are not gated by the Asset's own status (BR-020); Lines requirements at creation and full-replacement semantics on update (BR-021/BR-022); Asset termination also terminates its own Active Lines with quantity zero (BR-024); Asset's own price is not recalculated on termination, only the parent Agreement's (BR-025); render capability added (BR-026); BR-010/BR-012 refined for Actor/state-specific write gating. New open questions AST-002 and AST-003 added; AST-001 resolved and removed. |
| 0.1 | 2026-04-14 | Stu | Initial canon. Covers Active and Terminated states, OrderAsset promotion model, Vendor ownership model, one-time billing model, absence of renewal service, Asset/Agreement lifecycle independence, no terminationDate field, simplified audit model. |
