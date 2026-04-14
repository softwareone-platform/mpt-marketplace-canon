# Object Canon: Asset

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-04-14
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
An Asset is the platform's record of a one-time purchase fulfilment for a Client under a specific Agreement. Assets represent Items with a one-time billing model — as opposed to Subscriptions, which represent recurring Items. Like Subscriptions, Assets are owned by the Vendor. They are created during Order Processing as an OrderAsset (a temporary representation scoped to the Order) and promoted to a live Asset when the Purchase or Change Order completes, retaining the same ID. The Vendor may also create Assets directly without an Order for migration and edge-case scenarios. Assets carry their own parameters, pricing, template, and Lines, but unlike Subscriptions have no renewal service, no commitment date, and no expiry path. A Terminated Asset has no effect on its parent Agreement's status — Active Assets can exist under Terminated Agreements.

**Also Known As:**
None known.

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
|-------|-----------|---------|-----------|-----------|-------|
| Vendor | Yes | Yes | Yes | No | Can create Assets directly (migration/edge cases) or via Order Processing. Can update `name`, `template`, `parameters.fulfillment`, `externalIds.vendor`. Can terminate via `/terminate` endpoint. Read is scoped to Assets on Agreements where they are the Vendor. |
| Operations | No | Yes | Yes | No | Can update `price.defaultMarkup`, `price.defaultMargin`, and manage markup on Asset Lines. Read is not self-scoped — Operations sees all Assets platform-wide. |
| Client | No | Yes | Yes | No | Can update `name` and `externalIds.client`. Cannot create, terminate, or delete Assets. Read is scoped to Assets on Agreements belonging to their own Account. |

---

## 3. State Machine

### 3.1 States

| State | Description |
|-------|-------------|
| Draft | The Asset exists only within the scope of a Processing Order as an OrderAsset. It is a temporary representation created by the Vendor Extension during Order Processing. Accessible via `/orders/{id}/assets`. The Draft state is not visible on the live Asset — the live Asset is created directly in Active status when the Order completes. |
| Active | The Asset is live. The Vendor owns and maintains it. There is no renewal service — Active is the permanent state for a live Asset unless the Vendor terminates it. |
| Terminated | The Asset has been permanently ended by direct Vendor action via the `/terminate` endpoint. Terminal state — no outbound transitions. |

> **Note on New:** `New` appears in the `AssetStatus` enum as a transient pre-creation state. It is not a stable state visible on live Assets and is not documented as an operational state.

> **Note on Draft:** During Order Processing, the Vendor creates an `OrderAsset` object (a temporary representation scoped to the Order, accessible via `/orders/{id}/assets`). When the Purchase or Change Order completes, the platform promotes the OrderAsset to a live Asset, retaining the same ID. The live Asset is created directly in Active status — the Draft state is scoped to the Order only and is not visible on the live Asset endpoint.

### 3.2 Transitions

| ID | From State | To State | Action | Actor | Precondition | Notes |
|----|-----------|---------|--------|-------|-------------|-------|
| T1 | — | Active | Order completed — promoted from OrderAsset | Platform | Purchase or Change Order transitions to Completed | Platform promotes the OrderAsset to a live Asset under Vendor token context. Same ID retained. Asset linked to Agreement simultaneously. |
| T2 | — | Active | Vendor creates directly | Vendor | None — Vendor discretion | Used for migration scenarios or direct vendor sync. Asset created directly in Active status without an Order. |
| T3 | Active | Terminated | Vendor terminates directly | Vendor | Asset must be Active | Via `/terminate` endpoint. No effect on parent Agreement status. |

### 3.3 State Diagram

```
— ---(Order completed, promoted from OrderAsset : Platform)---> [Active]
— ---(Vendor creates directly : Vendor)---> [Active]
[Active] ---(Vendor terminates directly : Vendor)---> [Terminated]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
|---------|---------------|---------------------|-------------|-------|
| BR-001 | Assets are owned by the Vendor. The Vendor Extension creates and maintains Assets as the authoritative fulfilment record for one-time purchase Items. This mirrors the Vendor ownership model for Subscriptions. | All | Vendor | This ownership distinction drives the write permission model — the Vendor has broad direct write access to Assets without requiring an Order. |
| BR-002 | An Asset is normally created during Order Processing as an OrderAsset and promoted to a live Asset when the Purchase or Change Order completes. The platform promotes the OrderAsset to a live Asset, retaining the same ID. The live Asset is created directly in Active status — the Draft state is scoped to the Order only. | — (creation) | Vendor | The Vendor may also create an Asset directly in Active status without an Order for migration or vendor sync scenarios. |
| BR-003 | The only path to Terminated status is direct Vendor action via the `/terminate` endpoint. There is no Termination Order path for Assets — Termination Orders apply to Subscriptions only. Assets are unaffected by Termination Orders. | Active | Vendor | See Commerce: Order canon BR-022. |
| BR-004 | Terminated is a permanently terminal state. A Terminated Asset cannot be reactivated. A new Asset must be created — typically via a new Purchase or Change Order — to replace a terminated Asset. | Terminated | All | |
| BR-005 | A Terminated Asset has no effect on its parent Agreement's status. Agreement termination is driven exclusively by Subscription state. Active Assets can exist under Terminated Agreements, and Terminated Assets can exist under Active Agreements. | All | All | This is a key difference from Subscriptions, where all Subscriptions reaching Terminated status drives Agreement termination. |
| BR-006 | There is no renewal service for Assets. Assets have no `commitmentDate` and no `autoRenew` flag. Once Active, an Asset remains Active indefinitely unless the Vendor terminates it. | Active | All | Assets represent one-time purchases — the one-time billing model has no concept of renewal or expiry. |
| BR-007 | Asset-scoped `parameters.fulfillment` are written and maintained exclusively by the Vendor. The Client cannot update Asset parameters directly. Parameters are retained on a Terminated Asset — they are not cleared on termination. | All | Vendor | Parameters with `hidden=true` are suppressed from Client API responses — consistent with the parameter suppression model on Orders, Agreements, and Subscriptions. |
| BR-008 | The `terms` object on an Asset is always `model: "one-time"` and `period: "one-time"`. The `commitment` field is absent. Terms are set at Asset creation and are immutable thereafter. | All | All | All Lines under an Asset must have matching one-time terms. |
| BR-009 | There is no DELETE endpoint on Asset. The only path to a terminal state is Termination via the `/terminate` endpoint. | All | All | |
| BR-010 | The `name` field on an Asset can be updated by any Actor. | All | All | |
| BR-011 | The `template` field on an Asset can be set and updated by the Vendor in any non-terminal status. The template is present on both Active and Terminated Assets in observed samples. | Active | Vendor | The Asset template determines the rendered content shown to the Client when viewing their Asset. Absent from response when null — consistent with null suppression. |
| BR-012 | Operations can update `price.defaultMarkup` and `price.defaultMargin` directly on an Asset, and can manage markup on Asset Lines. These are the only direct update capabilities available to the Operations Actor on an Asset. | Active | Operations | |
| BR-013 | Asset pricing uses one-time price fields. `PPx1` (purchase price, one-time) is visible to Vendor and Operations. `SPx1` (selling price, one-time) is visible to Client and Operations. `markup`, `margin`, `defaultMarkup`, `defaultMargin`, `defaultMarkupSource`, and `markupSource` are visible to Operations only. | All | All | Unlike Subscriptions, which use `PPxY`/`PPxM`/`SPxY`/`SPxM`, Assets use `PPx1`/`SPx1` consistent with their one-time billing model. |
| BR-014 | Asset visibility is self-scoped per Actor: Vendor sees only Assets on Agreements where they are the Vendor; Client sees only Assets on Agreements belonging to their own Account; Operations sees all Assets platform-wide. | All | All | |
| BR-015 | The Asset carries `priceList` and `listing` references directly. This differs from Subscription, which does not carry these fields at the top level. | All | All | Immutable after creation. Derived from the Agreement at the time of Asset creation. |
| BR-016 | The Asset does not carry `buyer` or `seller` as top-level references. These are accessible via the Asset's Lines. | All | All | This is by design — a deliberate structural difference from Subscription, which carries `buyer` and `seller` directly. |
| BR-017 | There is no `terminationDate` field on the Asset schema. When an Asset is Terminated, the termination timestamp is recorded only in `audit.updated`. This differs from Subscription, which has an explicit `terminationDate` field set by the platform on termination. | Terminated | All | See AST-001. |
| BR-018 | The Asset `audit` block contains only `created` and `updated` sub-keys. There are no state-specific audit sub-keys (no `active`, `terminated`, etc.). This is simpler than the Subscription audit model. | All | All | Omitted by default — request via `select=+audit`. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
|-----------|------|-------------|--------|------------------------|-------|
| `id` | String | Unique platform identifier for the Asset. | Platform | No | Format: AST-XXXX-XXXX-XXXX. Same ID as the OrderAsset it was promoted from. |
| `revision` | Integer | Increments each time the Asset is updated. | Platform | Yes — platform-managed | |
| `name` | String | Human-readable name for the Asset. | Platform (at creation) | Yes — all Actors | Auto-generated at creation. |
| `status` | Enum | Current status. Valid values: `Active`, `Terminated`. (`New` and `Draft` are transient states not visible on live Assets.) | Platform | Yes — platform-managed | Driven by Order completion or direct Vendor termination. Not directly writable. |
| `terms` | Object | The billing terms for this Asset. Always `model: "one-time"` and `period: "one-time"`. No `commitment` field. | Vendor (at creation) | No | Immutable after creation. All Lines under this Asset must have matching one-time terms. |
| `price` | Object | Aggregate pricing for the Asset. Contains `PPx1`, `SPx1`, `currency`, `markup`, `margin`, `defaultMarkup`, `defaultMargin`, `defaultMarkupSource`, `markupSource`. | Platform (computed), Operations (defaultMarkup/defaultMargin) | Yes — Operations only for markup fields | `PPx1` visible to Vendor and Operations. `SPx1` visible to Client and Operations. `markup`, `margin`, `defaultMarkup`, `defaultMargin`, `defaultMarkupSource`, `markupSource` visible to Operations only. |
| `parameters.fulfillment` | Array | Asset-scoped fulfilment parameters written and maintained by the Vendor Extension. Contains parameters with `phase: "Fulfillment"` and `scope: "Asset"`. | Vendor | Yes — Vendor only | Parameters with `hidden=true` suppressed from Client API responses. Retained on Terminated Assets — not cleared on termination. |
| `template` | Object | Reference to the Catalog: Template assigned to this Asset. Determines rendered content shown to the Client when viewing their Asset. | Vendor | Yes — Vendor | Absent from response when null. Present on both Active and Terminated Assets in observed samples. |
| `lines` | Array | Lines (Entitlements) associated with this Asset. Accessible via `/assets/{id}/lines` endpoint. | Platform | No | Each Line maps one SKU at one quantity to this Asset. Line terms must match Asset terms (`one-time`). |
| `externalIds.vendor` | String | Vendor's reference for this Asset. | Vendor | Yes | Optional. Absent from response when null. |
| `externalIds.client` | String | Client's own reference for this Asset. | Client | Yes | Optional. Absent from response when null. |
| `priceList` | Object | Reference to the Catalog: Price List under which this Asset was priced. | Platform | No | Immutable after creation. Present directly on the Asset — differs from Subscription which does not carry this reference. |
| `listing` | Object | Reference to the Catalog: Listing under which this Asset was established. | Platform | No | Immutable after creation. Present directly on the Asset — differs from Subscription which does not carry this reference. |
| `agreement` | Object | Reference to the parent Commerce: Agreement. | Platform | No | Immutable after creation. |
| `product` | Object | Reference to the Catalog: Product. | Platform | No | Immutable after creation. |
| `licensee` | Object | Reference to the Accounts: Licensee. | Platform | No | Immutable after creation. |
| `audit` | Object | Audit timestamps. Contains `created` and `updated` only — no state-specific sub-keys. | Platform | No | Omitted by default — request via `select=+audit`. Simpler than Subscription audit. The `updated` timestamp serves as the proxy for termination time when the Asset is Terminated. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency |
|----------------|------------------|-------------|-------------|---------------------|
| Commerce: Agreement | Parent | Many Assets to one Agreement | Every Asset belongs to an Agreement. Created and linked during Order Processing. | Asset termination has no effect on Agreement status. Active Assets can exist under Terminated Agreements. |
| Commerce: Order | Association | Many Assets to many Orders | Assets are created during Purchase or Change Order Processing and linked to the Agreement on completion. | Asset state is driven by Order completion only — there is no Termination Order path for Assets. |
| Commerce: Order Line | Child | One Asset to many Lines | Lines are the unit of work mapped to this Asset. Accessible via `/assets/{id}/lines`. Also accessible via the Agreement `/lines` endpoint as Entitlements. | Line terms must match Asset terms (`one-time`). |
| Catalog: Product | Association | Many Assets to one Product | The Product this Asset covers. Derived from the Agreement. | Immutable after creation. |
| Catalog: Price List | Association | Many Assets to one Price List | The Price List under which this Asset was priced. Carried directly on the Asset. | Immutable after creation. |
| Catalog: Listing | Association | Many Assets to one Listing | The Listing under which this Asset was established. Carried directly on the Asset. | Immutable after creation. |
| Catalog: Template | Association | Many Assets to one Template | The Template determining rendered content shown to the Client when viewing their Asset. Set and updated by the Vendor. | No lifecycle dependency — Template changes do not affect Asset status. |
| Accounts: Licensee | Association | Many Assets to one Licensee | The Licensee associated with the Asset's Agreement. | Immutable after creation. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
|-------|---------|-------------------|---------------------------------|
| Parameters updated | Vendor updates `parameters.fulfillment` via PUT | Vendor | Values persisted immediately. No state transition. |
| Template updated | Vendor updates `template` via PUT | Vendor | Rendered content shown to Client updates immediately. No state transition. |
| Asset terminated directly | Vendor calls `/terminate` endpoint | Vendor | Asset → Terminated. `audit.updated` timestamp set by platform. No effect on parent Agreement status. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
|-----------------|----------------|--------------------------|------------|-----------|-------|
| Asset terminated | Commerce: Agreement | No effect | N/A | N/A | Agreement status is driven by Subscription state only. Asset termination does not affect the Agreement. |
| Purchase or Change Order completed | Commerce: Asset | OrderAsset promoted to live Asset → Active | Yes — platform, under Vendor token context | Order type is Purchase or Change; Order transitions to Completed | Same ID retained. Asset linked to Agreement simultaneously. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
There are no reversible transitions. Once an Asset is Terminated it cannot be reactivated.

**Deletion:**
There is no DELETE endpoint on Asset. The only terminal state is Terminated — Terminated Assets remain retrievable via the API. Consistent with Platform Invariant 7.

**Audit & history requirements:**
The Asset audit block contains only `created` and `updated` timestamps and Actor references. There are no state-specific audit sub-keys. The audit block is omitted from API responses by default — request via `select=+audit`. For Terminated Assets, the `updated` timestamp is the closest proxy for when termination occurred, as there is no `terminationDate` field.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
|----------|--------------------------|---------------|------------|-------|
| Vendor terminates Asset but parent Agreement is already Terminated | The Asset can be terminated regardless of Agreement status — Asset termination has no dependency on Agreement status, and vice versa. The `/terminate` endpoint is available on Active Assets regardless of Agreement state. | Vendor | Low | Consistent with the independence of Asset and Agreement lifecycle. |
| Active Assets remain after Agreement terminates | When all Subscriptions on an Agreement are Terminated, the Agreement transitions to Terminated — but Active Assets are unaffected and remain Active. The Client retains access to their Asset records under the Terminated Agreement. | Client | Medium | Clients may be surprised to find Active Assets under a Terminated Agreement. Vendor Extensions should handle this case explicitly if business logic requires co-termination of Assets with the Agreement. |
| No `terminationDate` on Asset | Unlike Subscription, there is no `terminationDate` field on the Asset schema. The only record of when an Asset was Terminated is the `audit.updated` timestamp, which requires `select=+audit` to retrieve. | Operations, Client | Low | See AST-001. Operations tooling that surfaces termination dates must use `audit.updated` for Assets. |
| Vendor creates Asset directly without Order | The Asset is created directly in Active status and linked to the Agreement. No Order audit trail exists for this Asset's creation. | Operations, Client | Medium | Used for migration scenarios. Operations should ensure direct creations are documented externally. |
| Purchase or Change Order fails after OrderAsset created | The OrderAsset is abandoned with the Order. The live Asset is never promoted — no AST-prefixed Asset is created. The OrderAsset is only accessible via the Order endpoint and does not appear in the Assets list. | Vendor | Low | The Vendor Extension must handle abandoned OrderAssets as part of Order failure cleanup. |

---

## 10. Open Questions

- [ ] **AST-001:** There is no `terminationDate` field on the Asset schema, unlike Subscription which has an explicit `terminationDate` set by the platform on termination. Whether this is an intentional design decision or a spec gap is not confirmed. The `audit.updated` timestamp is the current proxy for termination time.

---

## 11. Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2026-04-14 | Stu | Initial canon. Covers Active and Terminated states, OrderAsset promotion model, Vendor ownership model, one-time billing model, absence of renewal service, Asset/Agreement lifecycle independence, no terminationDate field, simplified audit model. |
