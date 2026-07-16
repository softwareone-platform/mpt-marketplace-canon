# Object Canon: Agreement

> **Version:** 0.6
> **Owner:** Stu
> **Last Updated:** 2026-07-16
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Agreement

**Namespace:** Commerce

**Parent Object:** None — top-level object.

**ID Prefix:** AGR

**Description:**
An Agreement is the platform's record of the ongoing commercial relationship between a Client and a Vendor for a specific Catalog: [[Product]]. It is the container for all [[Subscription]]s, [[Asset]]s, Lines ([[Entitlement]]s), and Commerce: [[Order]]s associated with that relationship, and it carries the relationship's own Agreement-scoped parameter state. An Agreement is normally co-created by the platform when a Purchase [[Order]] is first persisted, and thereafter its lifecycle is driven by the state transitions of its Orders and Subscriptions — from Draft through Active to the terminal states Terminated, Failed, or Deleted. Operations can additionally create an Agreement directly, outside the Order flow, for reconciliation and back-office scenarios.

**Also Known As:**
None known.

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | No | Yes | Yes | No | Read scoped to Agreements where it is the Vendor. Updates `name`, `template` (Active/Terminated only), `externalIds.vendor`, `certificates` (Active only), purchase-price estimates (`PPxM`/`PPxY`), and Agreement-scoped parameters. No DELETE endpoint exists. |
| Operations | No* | Yes | Yes | No | *No routine create, but Operations **can** create an Agreement directly via `POST` (status Active or Terminated) — see BR-001. Read is platform-wide. Updates `name`, `externalIds.operations`, `certificates` (Draft only), `price.defaultMarkup`, and purchase- and sell-price estimates. No DELETE endpoint exists. |
| Client | No | Yes | Yes | No | Read scoped to Agreements belonging to its own [[Account]]. Updates `name`, `billingCurrency`, and `externalIds.client`. Cannot create or delete Agreements. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Draft | The Agreement has been co-created with a Purchase Order that has not yet been placed. It has no active Subscriptions or Assets, and no parameters yet. | Yes (co-creation) | No |
| Provisioning | The Purchase Order against this Agreement has been placed and is being processed by the Vendor's fulfilment Extension. | No | No |
| Updating | A Change, Configuration, Termination, Suspend, or Resume Order against this Agreement has been placed and is being processed. | No | No |
| Active | The Agreement is active with at least one live Subscription or Asset. It returns to Active when a Change, Configuration, or Termination Order completes or fails. | Yes (Operations direct create) | No |
| Terminated | All Subscriptions on the Agreement have been terminated. Terminal — no outbound transitions. | Yes (Operations direct create) | Yes |
| Failed | The Purchase Order against this Agreement failed. The Agreement cannot be transacted against and cannot be recovered. Terminal — no outbound transitions. | No | Yes |
| Deleted | The Agreement has been soft-deleted — moves to Deleted status and remains retrievable via the API including in standard list responses. Only reachable from Draft when the co-created Purchase Order is deleted. Terminal — no outbound transitions. Deviates from Platform Invariant 7. | No | Yes |

> The `AgreementStatus` enum also includes `New`, but this is an internal persistence sentinel (the "unset" marker) that never appears on a real Agreement — every Agreement is created directly in Draft (Purchase-Order co-creation) or, for Operations direct creation, in Active or Terminated.

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Draft | Co-created with Purchase Order | (no dedicated Agreement endpoint — co-created when a Purchase Order is persisted via `POST /commerce/orders`) | Platform (Client token) | Purchase Order created by Client | Automated. The Agreement cannot be created this way independently of an Order. |
| T2 | — | Provisioning | Co-created and placed in one call | (no dedicated Agreement endpoint — Purchase Order created directly in Processing) | Platform (Client token) | Purchase Order created and placed without saving as Draft | Automated. |
| T3 | — | Active | Operations direct create | `POST /commerce/agreements` | Operations | Request body `status` = Active | Standalone create (Operations only). Built as Draft then advanced straight to Active, bypassing Order provisioning — see BR-001. |
| T4 | — | Terminated | Operations direct create (terminated) | `POST /commerce/agreements` | Operations | Request body `status` = Terminated | As T3, then advanced to Terminated. |
| T5 | Draft | Provisioning | Purchase Order placed | (no dedicated Agreement endpoint — Purchase Order → Processing) | Platform (Client token) | Purchase Order transitions to Processing | Automated. |
| T6 | Draft | Deleted | Purchase Order deleted | (no dedicated Agreement endpoint — Draft/Quoted Purchase Order deleted) | Platform (deleting Actor's token) | Co-created Purchase Order deleted | Soft-delete — remains retrievable via the API. |
| T7 | Provisioning | Active | Purchase Order completed | (no dedicated Agreement endpoint — Purchase Order → Completed) | Platform (Vendor token) | Purchase Order transitions to Completed | Draft Subscriptions and Assets become Active. Only the Vendor can complete an Order. |
| T8 | Provisioning | Failed | Purchase Order failed | (no dedicated Agreement endpoint — Purchase Order → Failed) | Platform (Vendor or Operations token) | Purchase Order transitions to Failed | Terminal — cannot be recovered. |
| T9 | Active | Updating | Change, Configuration, Termination, Suspend, or Resume Order placed | (no dedicated Agreement endpoint — non-Purchase Order → Processing) | Platform (Client token) | A non-Purchase Order transitions to Processing | Automated. |
| T10 | Updating | Active | Order completed, or non-Purchase Order failed | (no dedicated Agreement endpoint — Order → Completed/Failed) | Platform (Vendor or Operations token) | The Processing Order completes, or a non-Purchase Order fails (revert) | On failure of a non-Purchase Order, the Agreement and its Subscriptions revert to Active unchanged. |
| T11 | Active | Terminated | Final Subscription terminated | (no dedicated Agreement endpoint — driven by Subscription state / Termination Order completion) | Platform | All Subscriptions on the Agreement reach Terminated status | Triggered whether via a Termination Order or direct Vendor action on the last Subscription — see BR-006. Direct action transits Updating internally. |

### 3.3 State Diagram

```
— ---(Co-created with Purchase Order : Platform/Client)---> [Draft]
— ---(Co-created + placed in one call : Platform/Client)---> [Provisioning]
— ---(Operations direct create : Operations)---> [Active]
— ---(Operations direct create, terminated : Operations)---> [Terminated]
[Draft] ---(Purchase Order placed : Platform)---> [Provisioning]
[Draft] ---(Purchase Order deleted : Platform)---> [Deleted]
[Provisioning] ---(Purchase Order completed : Platform)---> [Active]
[Provisioning] ---(Purchase Order failed : Platform)---> [Failed]
[Active] ---(Change/Configuration/Termination Order placed : Platform)---> [Updating]
[Updating] ---(Order completed or failed : Platform)---> [Active]
[Active] ---(All Subscriptions terminated : Platform)---> [Terminated]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An Agreement is normally co-created by the platform when a Purchase [[Order]] is first persisted, under the Client's token context. Operations can also create an Agreement directly through the dedicated create endpoint, bypassing the Order provisioning flow. | All | Platform, Operations | Operations direct creation requires the request `status` to be Active or Terminated (no other value is accepted) and is not available to the Vendor or Client. Vendor and Client can never create an Agreement. |
| BR-002 | There is no DELETE endpoint on the Agreement. An Agreement can only reach Deleted status when its co-created Draft or Quoted Purchase [[Order]] is deleted. No Actor can directly delete an Agreement. | All | All | Soft-deleted — remains retrievable via the API including in standard list responses. Only reachable from Draft. |
| BR-003 | Once created, Agreement state transitions are driven entirely by the state transitions of its associated Orders and Subscriptions. No Actor can transition a persisted Agreement's status through a dedicated endpoint. | All | All | The sole exception is Operations direct creation (BR-001), which sets the initial status to Active or Terminated. See Commerce: [[Order]] canon Section 7.2 for the cross-object transition table. |
| BR-004 | The Agreement `name` defaults to "[Product Name] for [Client Account Name]" when not supplied at creation. It can be updated at any time by any Actor. | All | All | The account in the default name is the Client [[Account]] (via the [[Licensee]]), not the Licensee's own name. A supplied name overrides the default. |
| BR-005 | The Agreement `template` is set by the platform to the [[Template]] of the most recently completed [[Order]] when that [[Order]] completes. The Vendor may reassign the [[Template]] directly on the Agreement while it is Active or Terminated. | Active, Terminated | Vendor | The reassigned [[Template]] must be of type `OrderCompleted` and belong to the same [[Product]]. The Agreement [[Template]] determines the content rendered to the Client. |
| BR-005a | The Agreement template can be rendered in every status through the render endpoint; the platform returns status-appropriate content. | All | All | Draft/Deleted return canned placeholder content; Provisioning renders the in-flight Order's template; Failed renders a failure template carrying the failed [[Order]]'s status notes; Active/Terminated render the assigned [[Template]] with Agreement parameters. Reassigning the template (BR-005) is Active/Terminated only. |
| BR-006 | When all Subscriptions on an Agreement reach Terminated status the Agreement automatically transitions to Terminated. | Active | Platform | Automated. Via a Termination [[Order]], the Agreement's [[Asset]]s are unaffected. When the last [[Subscription]] is terminated by direct Vendor action outside an Order, the Agreement additionally terminates all of its [[Asset]]s. |
| BR-007 | A Failed Agreement is permanently terminal. It cannot be recovered or reactivated; a new Purchase [[Order]] must be created, which co-creates a new Agreement. | Failed | All | See Commerce: [[Order]] canon Section 9 for the Purchase [[Order]] failure mode. |
| BR-008 | Lines on the Agreement (via the `/lines` endpoint) are a flattened list of all Lines across all [[Subscription]]s and [[Asset]]s. These are called [[Entitlement]]s in the platform UI and internal communications; the API term is Lines. | Active | All | Each Line carries its own status (`Active`, `Terminated`, `Deleted`, `Expired`) and references its originating [[Order]], [[Subscription]] or [[Asset]], and Item. |
| BR-009 | The Agreement uses a soft-delete model. Deleted Agreements remain retrievable via the API including in standard list responses. This deviates from Platform Invariant 7. | Deleted | All | Consistent with the Commerce: [[Order]] soft-delete model. |
| BR-010 | Agreement-scoped parameters (`scope: "Agreement"`) are set during the Purchase [[Order]] and carried over to the Agreement when that [[Order]] completes. After completion the Client cannot modify any Agreement-scoped parameter; the Vendor can update both `parameters.ordering` and `parameters.fulfillment` directly on the Agreement while Active. | Active | Vendor | Both ordering-phase and fulfilment-phase Agreement-scoped values persist on the Agreement. The `parameters` object is the persistent state record of the relationship, maintained by the Vendor Extension across the Agreement lifecycle. |
| BR-011 | [[Order]]-scoped parameters (`scope: "Order"`) exist only on Orders and are never carried over to the Agreement. Purchase Orders may carry both Agreement-scoped and [[Order]]-scoped parameters; Change, Configuration, and Termination Orders may carry only [[Order]]-scoped parameters. | All | All | [[Order]]-scoped parameters are never visible on the Agreement regardless of [[Order]] type or status. |
| BR-012 | Parameters with `hidden=true` are suppressed from API responses for the Client on both Orders and Agreements; they remain readable by Vendor and Operations in all statuses. | All | Client | An API-level read suppression, not merely a UI hint. Consistent with Commerce: [[Order]] canon BR-012. |
| BR-013 | The `billingCurrency` specifies the currency in which the Client is invoiced and must be a currency present in the [[Seller]]'s `currencies` array. Only the Client can set it. | All | Client | When not set, invoicing falls back to the Price List currency. A forex conversion is applied between the transactional ([[Authorization]]) currency and the billing currency for invoicing. Absent from API response when null. |
| BR-014 | The `termsAndConditions` array records the T&Cs accepted at the time of the original Purchase [[Order]]. T&Cs from subsequent Change, Configuration, or Termination Orders are not accumulated on the Agreement. | All | Client | Each entry records the Catalog: [[Terms]] reference, acceptance timestamp, and accepting User. Empty on Draft. |
| BR-015 | The Vendor or Operations can set an estimated aggregate price on the Agreement by supplying price estimates on update; doing so sets the price `source` to `Manual` and records the acting User. The Vendor may set purchase-price estimates (`PPxM`/`PPxY`) only; Operations may set both purchase- and sell-price estimates (`SPxM`/`SPxY`). The Client cannot set estimates. | All | Vendor, Operations | Intended for reflecting estimated pricing on usage-based / pay-as-you-go entitlements. The platform does not gate this on status or billing model. A manually estimated price is not durable — any subsequent activity that recomputes the aggregate (an [[Order]] completing, a [[Subscription]] or [[Asset]] change, or expiry) resets `source` to `Computed`, discarding the estimate. |
| BR-016 | Each Actor can update its own `externalIds` field on the Agreement: `externalIds.client` (Client), `externalIds.operations` (Operations), `externalIds.vendor` (Vendor). All are optional. | All | All | — |
| BR-017 | There can be only one Processing [[Order]] per Agreement at any time. While an [[Order]] is Processing, the Agreement is in Provisioning or Updating and no further Orders can be placed against it. | Provisioning, Updating | All | See Commerce: [[Order]] canon BR-005. |
| BR-018 | Split Billing is configured on the Agreement via the `/split` sub-resource and can be managed only by the Client or Operations — never the Vendor. Activation requires the [[Product]] to have Split Billing enabled, requires the [[Licensee]]'s default [[Buyer]] to be included, and cannot be repeated once activated. | All | Client, Operations | Activation has no Agreement-status precondition. On activation, each [[Subscription]] is seeded with a split allocation to the default [[Buyer]] (100%; other buyers 0%). Allocation percentages are platform-computed from each [[Buyer]]'s share of Subscription selling price — not free-form Actor input. A [[Buyer]] with existing Subscription-level allocations cannot be removed. Full model in the Commerce: [[Agreement Split Billing]] canon. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | String | Unique platform identifier. | Platform | No | Format `AGR-XXXX-XXXX-XXXX`. |
| `revision` | Integer | Increments on each update. | Platform | Yes — platform-managed | — |
| `name` | String | Human-readable name. | Platform (default at creation), any Actor (updates) | Yes | Defaults to "[Product Name] for [Client Account Name]" — see BR-004. Updatable by Vendor, Operations, and Client. |
| `status` | Enum | Current status. Values: `Draft`, `Provisioning`, `Updating`, `Active`, `Terminated`, `Failed`, `Deleted` (`New` is an internal sentinel, never returned). | Platform | Yes — platform-managed | Driven by Order and Subscription state; not directly writable except at Operations direct creation (BR-001). |
| `price` | Object | Aggregate pricing across all active Subscriptions and Assets. | Platform (computed) or Vendor/Operations (estimate) | Yes | Absent on Draft. `source` is `Computed` or `Manual` (see BR-015). Field visibility differs by Actor — see the price-visibility note below. |
| `billingCurrency` | String | Currency in which the Client is invoiced. Must be a currency in the Seller's `currencies` array. | Client | Yes | Falls back to the Price List currency when unset. See BR-013. Absent from response when null. |
| `template` | Object | Reference to the Catalog: Template currently assigned to the Agreement. | Platform (on Order completion), Vendor (reassign) | Yes | Absent on Draft. Set from the most recently completed Order; Vendor reassignment is Active/Terminated only. See BR-005. |
| `lines` | Array | Flattened list of all Lines (Entitlements) across Subscriptions and Assets, via `/lines`. | Platform | No | Called "Entitlements" in the UI and internal communications. See BR-008. |
| `subscriptions` | Array | Subscriptions associated with this Agreement. | Platform | No | Populated as Subscriptions are created and linked during Order fulfilment. |
| `assets` | Array | Assets associated with this Agreement. | Platform | No | Populated as Assets are created and linked during Order fulfilment. |
| `parameters.ordering` | Array | Agreement-scoped ordering parameters (`phase: Order`, `scope: Agreement`). | Client (via Purchase Order), Vendor (direct update) | Yes — Vendor only after creation | Client cannot modify after the Purchase Order completes. `hidden=true` values suppressed from Client responses. See BR-010/BR-012. |
| `parameters.fulfillment` | Array | Agreement-scoped fulfilment parameters (`phase: Fulfillment`, `scope: Agreement`). | Vendor | Yes — Vendor at any time while Active | `hidden=true` values suppressed from Client responses. |
| `externalIds.vendor` | String | Vendor's reference. | Vendor | Yes | Optional. Absent when null. |
| `externalIds.operations` | String | ERP / Operations reference. | Operations | Yes | Optional. Absent when null. |
| `externalIds.client` | String | Client's own reference. | Client | Yes | Optional. Absent when null. |
| `split` | Object | Split Billing configuration (allocations across Buyers), via `/split`. | Client, Operations | Yes | Present only once Split Billing is activated. Visible to Client and Operations only — suppressed for the Vendor. See BR-018. |
| `termsAndConditions` | Array | T&Cs accepted at the original Purchase Order. Each entry: Terms reference, acceptance timestamp, accepting User. | Client (at Purchase Order placement) | No | Empty on Draft. Not updated by subsequent Orders. See BR-014. |
| `certificates` | Array | Certificates held by the Client relevant to this Agreement. | Platform, Operations (Draft only), Vendor (Active only) | Yes — state-gated | Programs and Certificates are not yet canonised. |
| `audit` | Object | Audit timestamps and Actor references. Sub-keys: `created`, `updated`, `provisioning`, `active`, `terminated`. | Platform | No | Omitted by default — request via `select=+audit`. There is no `failed` and no `updating` sub-key — those transitions are not individually timestamped. State-specific entries appear only once that state is reached. |
| `startDate` | DateTime | Present in the API contract but never populated by the platform. | — | — | Unused/vestigial — no code path sets it. Absent from responses. |
| `endDate` | DateTime | Present in the API contract but never populated by the platform. | — | — | Unused/vestigial. Absent from responses. |
| `error` | Object | Present in the API contract (a `ParametrisedMessage`) but never populated on the Agreement. | — | — | Unused/vestigial. The failure reason for a Failed Agreement surfaces via the failed [[Order]] (rendered into the Agreement's failure template), not this field. |
| `icon` | String | Present in the API contract but never populated. | — | — | Unused/vestigial — Agreements have no jdenticon or custom icon. Absent from responses. |
| `listing` | Object | Reference to the Catalog: Listing under which this Agreement was established. | Platform | No | Immutable. |
| `authorization` | Object | Reference to the Catalog: Authorization associated with the Listing. | Platform | No | Immutable. Determines the transactional currency. |
| `product` | Object | Reference to the Catalog: Product this Agreement covers. | Platform | No | Immutable. |
| `client` | Object | Reference to the Accounts: Account of the Client party. | Platform | No | Immutable. |
| `vendor` | Object | Reference to the Accounts: Account of the Vendor party. | Platform | No | Immutable. |
| `licensee` | Object | Reference to the Accounts: Licensee on whose behalf the Agreement was established. | Platform | No | Immutable. |
| `buyer` | Object | Reference to the Accounts: Buyer associated with the Licensee. | Platform | No | Immutable. |
| `seller` | Object | Reference to the Accounts: Seller associated with the Listing. | Platform | No | Immutable. |

> **Price field visibility by Actor** (the `price` object): `currency` is visible to all Actors. `PPxY`/`PPxM` (purchase price) are visible to Vendor and Operations. `SPxY`/`SPxM` (selling price) and `billingCurrency` are visible to Client and Operations. `markup`, `margin`, `defaultMarkup`, `defaultMargin`, `defaultMarkupSource`, `markupSource`, and `source` are visible to Operations only. `defaultMarkup` is writable by Operations while Active.

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Commerce: Order | Child | One Agreement to many Orders | Every Order exists within the scope of an Agreement. Purchase Orders co-create the Agreement; Change, Configuration, Termination, Suspend, and Resume Orders are placed against an existing Agreement. | Agreement state is driven by Order state. Deleting the co-created Draft/Quoted Purchase Order moves the Agreement to Deleted. |
| Commerce: Subscription | Child | One Agreement to many Subscriptions | Created by the Vendor Extension during Order processing and linked on Order completion. Each carries its own parameters, pricing, terms, template, and Lines. | All Subscriptions reaching Terminated causes the Agreement to transition to Terminated (BR-006). |
| Commerce: Asset | Child | One Agreement to many Assets | Created by the Vendor Extension during Order processing and linked on Order completion. Assets represent one-time purchase items. | Unaffected when the Agreement terminates via a Termination Order; terminated when the last Subscription is terminated by direct Vendor action (BR-006). |
| Commerce: Agreement Split Billing | Child | One Agreement to one split configuration | Optional split-billing configuration distributing the Agreement's billing across Buyers, via the `/split` sub-resource. See BR-018. | Cannot exist without the Agreement; permanent once activated (no deactivation or delete). |
| Commerce: Entitlement | Child | One Agreement to many Entitlements | The Agreement's lines (Entitlements) across all Subscriptions and Assets, via the `/lines` endpoint. Called Entitlements in the UI; "line" in the API. (Distinct from Commerce: Order Line, an in-flight Order-scoped object served at the Order's own `/lines`.) | Entitlements belong to the Agreement; their status is driven by Order/Subscription/Asset operations. |
| Commerce: Agreement Attachment | Child | One Agreement to many Attachments | Files and License Keys attached by Vendor or Operations. Order attachments and Agreement attachments are a single shared collection — an attachment created against an Order is visible via the Agreement's `/attachments` endpoint. Not yet canonised. | Owner-scoped visibility (Vendor by vendor, Client by client, Operations all). |
| Catalog: Listing | Association | Many Agreements to one Listing | The Listing under which the Agreement was established; determines Seller, Price List, and Authorization. | Immutable after creation. |
| Catalog: Authorization | Association | Many Agreements to one Authorization | The Authorization associated with the Listing; determines the transactional currency. | Immutable after creation. |
| Catalog: Product | Association | Many Agreements to one Product | The Product this Agreement covers. | Immutable after creation. |
| Catalog: Template | Association | Many Agreements to one Template | The Template determining content rendered to the Client. Set from the most recently completed Order; Vendor may reassign. | No lifecycle dependency — Template changes do not affect Agreement status. |
| Accounts: Account | Association | Many Agreements to one Client Account and one Vendor Account | The Client and Vendor parties to the Agreement. | Immutable after creation. |
| Accounts: Licensee | Association | Many Agreements to one Licensee | The Licensee on whose behalf the Agreement was established; resolves the Seller for billing-currency validation. | Immutable after creation. |
| Accounts: Buyer | Association | Many Agreements to one Buyer | The Buyer associated with the Licensee. Buyers are the allocation targets for Split Billing. | Immutable after creation. |
| Accounts: Seller | Association | Many Agreements to one Seller | The Seller associated with the Listing. `billingCurrency` must be one of this Seller's currencies. | Immutable after creation. |
| Catalog: Terms | Association | One Agreement to many Terms | T&Cs accepted at the original Purchase Order. | Captured at Purchase Order placement; not updated by later Orders. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Agreement created | Purchase [[Order]] co-creation, or Operations direct create | Client (via Order), Operations | Publishes a creation event on the Commerce bus. Operations direct create lands in Active or Terminated (BR-001). |
| Agreement status changed | An associated [[Order]] or [[Subscription]] transition moves the Agreement's status | Platform | Publishes a status-changed event carrying the new status. |
| Agreement name updated | Any Actor updates `name` | Vendor, Operations, Client | Name updated. No state transition. |
| Agreement template reassigned | Vendor updates `template` | Vendor | Rendered content shown to the Client updates. No state transition. Active/Terminated only. |
| Agreement parameters updated | Vendor updates `parameters.ordering`/`parameters.fulfillment` | Vendor | Agreement-scoped parameter values updated. No state transition. |
| Billing currency set | Client sets `billingCurrency` | Client | Forex conversion applied between [[Authorization]] currency and billing currency for invoicing. No state transition. |
| Price estimate applied | Vendor or Operations supplies price estimates on update | Vendor, Operations | `price.source` becomes `Manual` and the acting User is recorded. No state transition. Reset to `Computed` on the next recompute (BR-015). |
| Split Billing activated / updated | Client or Operations calls `POST`/`PUT` on `/split` | Client, Operations | Allocations persisted; on activation each [[Subscription]] is seeded with an allocation to the default [[Buyer]] (BR-018). No state transition. |
| Attachment added | Vendor or Operations adds an Attachment (optionally against an [[Order]]) | Vendor, Operations | Attachment persisted on the Agreement's shared attachment collection. No state transition. |

### 7.2 Cross-Object State Effects

> See Commerce: [[Order]] canon Section 7.2 for the full cross-object transition table covering Agreement state changes driven by Order transitions.

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| All [[Subscription]]s on the Agreement reach Terminated | Commerce: Agreement | Agreement → Terminated | Yes — platform | All Subscriptions Terminated | Via a Termination [[Order]], [[Asset]]s are unaffected; via direct Vendor termination of the last Subscription, [[Asset]]s are also terminated (BR-006). |
| Purchase [[Order]] completes | Commerce: Agreement `parameters` | Agreement-scoped parameters carried over to the Agreement | Yes — platform | [[Order]] is a Purchase Order transitioning to Completed | Both ordering and fulfilment Agreement-scoped values persist. |
| Split Billing activated | Commerce: Subscription | Each Subscription seeded with a split allocation to the default [[Buyer]] | Yes — platform | `POST /split` succeeds | See BR-018. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Active → Updating is reversible with no limit on cycles — each new [[Order]] placed against an Active Agreement moves it to Updating, and each Order completion or failure returns it to Active. All other transitions are irreversible: Provisioning → Active is one-way, and Terminated, Failed, and Deleted are terminal.

**Deletion:**
Agreements use a soft-delete model. An Agreement reaches Deleted only when its co-created Draft or Quoted Purchase [[Order]] is deleted; there is no DELETE endpoint and no Actor can delete an Agreement directly. Deleted Agreements remain retrievable via the API including in standard list responses. This deviates from Platform Invariant 7.

**Audit & history requirements:**
The audit block captures `created`, `updated`, `provisioning`, `active`, and `terminated` timestamps with Actor references. There is no `failed` and no `updating` audit sub-key — transitions to those states are not individually timestamped. The block is omitted from API responses by default (request via `select=+audit`), and a state-specific entry appears only once that state is reached. Audit Records are generated for Agreement state transitions; prior parameter values are not retained beyond the Audit Trail.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Agreement remains in Provisioning or Updating indefinitely | No platform-level safeguard. The Agreement stays non-Active if the associated [[Order]] is abandoned in Processing or Querying, and no further Orders can be placed against it. | Client, Operations | High | Operations should monitor long-running [[Order]]s. See Commerce: [[Order]] canon Section 9. |
| Purchase [[Order]] fails after the Agreement reaches Provisioning | Agreement → Failed, permanently terminal. A new Purchase [[Order]] must be created — the platform co-creates a new Agreement. | Client | High | The Failed Agreement remains retrievable but cannot be transacted against. |
| All [[Subscription]]s terminated by direct Vendor action | The platform transitions the Agreement to Terminated when the last [[Subscription]] terminates, and — on this direct path — also terminates the Agreement's [[Asset]]s. | Client, Vendor | Medium | Differs from termination via a Termination [[Order]], where Assets are left untouched (BR-006). The Client may be surprised if the Agreement and its Assets terminate without a Termination Order. |
| A manually estimated price is set, then Agreement activity occurs | The `Manual` price is not durable: the next event that recomputes the aggregate (an [[Order]] completing, a [[Subscription]]/[[Asset]] change, or expiry) resets `source` to `Computed`, discarding the estimate. | Vendor, Operations | Medium | The Vendor must re-apply the estimate after such activity if the estimated value is to persist. See BR-015. |
| Client attempts to modify Agreement-scoped parameters after the Purchase [[Order]] completes | The platform does not permit it — only the Vendor can update Agreement-scoped parameters thereafter. | Client | Low | The Client can update [[Order]]-scoped parameters via subsequent Orders, but these never carry back to the Agreement. |
| `billingCurrency` set to a currency not in the [[Seller]]'s `currencies` array | The platform rejects the update. | Client | Low | Platform-enforced — see BR-013. |
| Failed Agreement coexists with a new Agreement for the same [[Product]] and Client | A Failed Agreement remains visible in the API; a new Purchase [[Order]] creates a new Agreement rather than replacing it. Both exist simultaneously. | Client, Operations | Medium | The Failed Agreement has no operational impact once a new Agreement is Active. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.6 | 2026-07-16 | Stu / canon-generate | Section 6 corrected while canonising Commerce: Entitlement: the `/lines` association was mislabelled as "Commerce: Order Line" — it returns the Agreement's Entitlements (`AgreementLine`), so the row now points to Commerce: Entitlement (a Child relationship), noting Order Line is a distinct Order-scoped object. Added the `[[Entitlement]]` cross-links (Section 1, BR-008) now that the child object is canonised. |
| 0.5 | 2026-07-16 | Stu / canon-generate | BR-018 corrected while canonising the Agreement Split Billing child object: activation has no Agreement-status precondition (Applies In State(s) changed from Active to All), and the percentage note reworded — Agreement-level allocation percentages are a platform-computed roll-up of Subscription-level allocations and are not enforced to sum to 100 (that constraint is Subscription-level). Added the `[[Agreement Split Billing]]` cross-link (BR-018) and a Section 6 child-relationship row now that the child object is canonised. |
| 0.4 | 2026-07-16 | Stu / canon-generate | Full evidence-based refresh via live STAGING OpenAPI schema, a multi-Actor live fetch, and source-code research. §3.2 transition mechanisms confirmed and filled (all plain status writes driven by Order/Subscription state — no dedicated status endpoint). BR-001 corrected — Operations can create an Agreement directly via `POST` (status Active or Terminated), bypassing the Order flow; added the standalone-create transitions and set Operations `Can Create`. `name` default corrected to "[Product Name] for [Client Account Name]" and confirmed updatable by all Actors (BR-004). Price field visibility corrected (`PPxY`/`PPxM` are Vendor+Operations, not Operations-only; added `defaultMargin`, `markupSource`) and BR-015 rewritten — the `Manual` price source is set by Vendor (purchase-price estimates) or Operations (purchase + sell), ungated by status/billing model, and is reset to `Computed` by the next recompute. BR-006/§6/§9 corrected — Agreement termination terminates Assets on the direct last-Subscription path (unaffected via a Termination Order). `billingCurrency` "Active-only" claim removed (not enforced). BR-018 added for Split Billing (Client/Operations only, product-enabled, default-buyer seed, platform-computed percentages). Attachments confirmed a single shared Order/Agreement collection. `New` documented as an unused sentinel; `startDate`/`endDate`/`error`/`icon` documented as vestigial contract fields. Audit block confirmed to have no `failed`/`updating` sub-key. Resolved AGR-001, AGR-002, AGR-003, AGR-007, and AGR-008. |
| 0.3 | 2026-07-15 | Stu / canon-generate | BR-005a added — Template rendering is permitted in Terminated status too, not just Active; only reassigning the Template is Active-only. Surfaced during the Catalog: Product Template canon refresh. |
| 0.2 | 2026-04-13 | Stu | Full canon session completed. All sections authored. Parameters model documented — Agreement-scoped vs Order-scoped parameter distinction, Vendor write rules, Client read suppression. billingCurrency field documented including Seller currency constraint and forex model. Agreement price manual override model documented for usage-based Entitlements. Split Billing deferred to separate canon session. AGR-004, AGR-005, AGR-006 resolved and removed from open questions. AGR-008 added. |
| 0.1-stub | 2026-04-12 | Stu | Initial stub from Order canon session. State machine, core identity, and known business rules captured. Sections 4–9 incomplete. |
