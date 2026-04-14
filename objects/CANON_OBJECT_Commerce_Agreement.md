# Object Canon: Agreement

> **Version:** 0.2
> **Owner:** Stu
> **Last Updated:** 2026-04-13
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
An Agreement is the platform's record of the ongoing commercial relationship between a Client and a Vendor for a specific Product. Every Agreement is created automatically by the platform when a Purchase Order is first persisted, and serves as the container for all Subscriptions, Assets, Lines (Entitlements), and Orders associated with that relationship. An Agreement progresses through a defined lifecycle driven by the state transitions of its associated Orders and Subscriptions, from Draft through to Active or terminal states of Terminated, Failed, or Deleted. The Agreement carries its own parameter state — Agreement-scoped parameters set during the original Purchase Order and maintained by the Vendor Extension throughout the Agreement's lifecycle.

**Also Known As:**
None known.

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
|-------|-----------|---------|-----------|-----------|-------|
| Vendor | No | Yes | Yes | No | Read is scoped to Agreements where they are the Vendor. Can update `parameters.ordering`, `parameters.fulfillment`, `template`, and `externalIds.vendor`. No DELETE endpoint exists. |
| Operations | No | Yes | Yes | No | Read is not self-scoped — Operations sees all Agreements platform-wide. Can update `externalIds.operations`. No DELETE endpoint exists. |
| Client | No | Yes | Yes | No | Read is scoped to Agreements belonging to their own Account. Can update `name`, `billingCurrency`, and `externalIds.client`. Cannot create or delete Agreements directly. |

---

## 3. State Machine

### 3.1 States

| State | Description |
|-------|-------------|
| Draft | The Agreement has been co-created with a Purchase Order but the Order has not yet been placed. The Agreement exists but has no active Subscriptions or Assets. Parameters are not yet present. |
| Provisioning | The Purchase Order against this Agreement has been placed and is being processed by the Vendor's fulfilment Extension. |
| Updating | A Change, Configuration, or Termination Order against this Agreement has been placed and is being processed. |
| Active | The Agreement is active. At least one Subscription or Asset is live. The Agreement returns to Active when a Change, Configuration, or Termination Order completes or fails. |
| Terminated | All Subscriptions on the Agreement have been terminated. Assets are unaffected. Terminal state — no outbound transitions. |
| Failed | The Purchase Order against this Agreement failed. The Agreement cannot be transacted against and cannot be recovered. Terminal state — no outbound transitions. |
| Deleted | The Agreement has been soft-deleted — moves to Deleted status and remains retrievable via the API including in standard list responses. Only reachable from Draft when the co-created Purchase Order is deleted. Terminal state — no outbound transitions. Deviates from Platform Invariant 7. |

### 3.2 Transitions

| ID | From State | To State | Action | Actor | Precondition | Notes |
|----|-----------|---------|--------|-------|-------------|-------|
| T1 | — | Draft | Co-created with Purchase Order | Platform | Purchase Order created by Client | Automated — executed by the platform under the Client's token context. Cannot be created independently. |
| T2 | — | Provisioning | Co-created with Purchase Order (direct to Processing) | Platform | Purchase Order created and placed in a single call by Client | Agreement is created directly in Provisioning when a Client creates and places a Purchase Order without saving as Draft. Automated under Client's token context. |
| T3 | Draft | Provisioning | Purchase Order placed | Platform | Purchase Order transitions to Processing | Automated — executed under Client's token context. |
| T4 | Draft | Deleted | Purchase Order deleted | Platform | Draft or Quoted Purchase Order deleted by any Actor | Soft-deleted — remains retrievable via the API. Automated under the deleting Actor's token context. |
| T5 | Provisioning | Active | Purchase Order completed | Platform | Purchase Order transitions to Completed | Automated under Vendor token context. All Draft Subscriptions and Assets → Active simultaneously. |
| T6 | Provisioning | Failed | Purchase Order failed | Platform | Purchase Order transitions to Failed | Automated under Vendor or Operations token context. Terminal — cannot be recovered. |
| T7 | Active | Updating | Change, Configuration, or Termination Order placed | Platform | Order transitions to Processing | Automated under Client's token context. |
| T8 | Updating | Active | Order completed or failed | Platform | Change, Configuration, or Termination Order transitions to Completed or Failed | Automated under Vendor or Operations token context. For failed Orders, Agreement and Subscriptions revert to Active unchanged. |
| T9 | Active | Terminated | Final Subscription terminated | Platform | All Subscriptions on the Agreement reach Terminated status | Automated. Triggered when the last Subscription terminates — whether via a Termination Order or direct Vendor action. |

### 3.3 State Diagram

```
— ---(Co-created with Purchase Order : Platform/Client)---> [Draft]
— ---(Co-created with Purchase Order, direct place : Platform/Client)---> [Provisioning]
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
|---------|---------------|---------------------|-------------|-------|
| BR-001 | An Agreement cannot be created independently. It is always co-created by the platform when a Purchase Order is first persisted. The Agreement and its originating Purchase Order are created simultaneously under the Client's token context. | All | Platform | See Commerce: Order canon BR-001. |
| BR-002 | There is no DELETE endpoint on the Agreement. An Agreement can only reach Deleted status when its co-created Draft or Quoted Purchase Order is deleted by any Actor. No Actor can directly delete an Agreement. | All | All | Soft-deleted — remains retrievable via the API including in standard list responses. Only reachable from Draft. |
| BR-003 | Agreement state transitions are driven entirely by the state transitions of its associated Orders and Subscriptions. No Actor can directly transition an Agreement's status via a dedicated endpoint. | All | All | See Commerce: Order canon Section 7.2 for the full cross-object state transition table. |
| BR-004 | The Agreement `name` is auto-generated by the platform at creation. The observed pattern is "[Product Name] for [Client/Licensee Name]". The name may be updated by the Client at any time after creation. | All | Client | |
| BR-005 | The Agreement `template` is set by the platform to the Template of the most recently completed Order when that Order completes. The Vendor may update the Template directly on the Agreement at any time while Active. | Active | Vendor | The Agreement Template determines the rendered content shown to the Client when viewing their Agreement. Template type is inherited from the completing Order — typically `OrderCompleted`. |
| BR-006 | When all Subscriptions on an Agreement are Terminated — whether via a Termination Order or direct Vendor action — the Agreement automatically transitions to Terminated. Assets are unaffected by this transition. | Active | Platform | Automated — executed by the platform. Agreement termination is driven by Subscription state, not directly by an Order. |
| BR-007 | A Failed Agreement is permanently terminal. It cannot be recovered or reactivated. A new Purchase Order must be created to establish a new Agreement — the platform will co-create a new Agreement automatically. | Failed | All | See Commerce: Order canon Section 9 for the Purchase Order failure failure mode. |
| BR-008 | Lines on the Agreement (accessible via the `/lines` endpoint) represent a flattened list of all Lines across all Subscriptions and Assets on the Agreement. These are referred to as Entitlements in the platform UI and in all internal SoftwareOne communications. The API term is Lines. | Active | All | "Entitlements" is the standard term everywhere except the API. |
| BR-009 | The Agreement uses a soft-delete model. Deleted Agreements remain retrievable via the API including in standard list responses. This deviates from Platform Invariant 7. | Deleted | All | Consistent with Commerce: Order soft-delete model. |
| BR-010 | Agreement-scoped parameters (`scope: "Agreement"`) are set during the Purchase Order and carried over to the Agreement on Order completion. Both `parameters.ordering` and `parameters.fulfillment` Agreement-scoped values persist on the Agreement. After the Purchase Order completes, the Client cannot modify any Agreement-scoped parameters. The Vendor can update both `parameters.ordering` and `parameters.fulfillment` directly on the Agreement at any time while Active. | Active | Vendor | The Agreement's `parameters` object is the persistent state record of the relationship, maintained by the Vendor Extension throughout the Agreement lifecycle. |
| BR-011 | Order-scoped parameters (`scope: "Order"`) exist only on Orders and are never carried over to the Agreement. Purchase Orders may carry both Agreement-scoped and Order-scoped parameters. Change, Configuration, and Termination Orders may only carry Order-scoped parameters — no Agreement-scoped parameter modification is possible via these Order types. | All | All | Order-scoped parameters are never visible on the Agreement regardless of Order type or status. |
| BR-012 | Parameters with `hidden=true` are suppressed from API responses for the Client Actor on both Orders and Agreements. Hidden parameters are readable by Vendor and Operations in all statuses. | All | Client | `hidden` is an API-level read suppression, not merely a UI display hint. Consistent with Commerce: Order canon BR-012. |
| BR-013 | The `billingCurrency` field specifies the currency in which the Client is invoiced. It must be a currency present in the Seller's `currencies` array. A forex conversion is applied between the Authorization currency and the billing currency for invoicing purposes. `billingCurrency` can only be updated by the Client while the Agreement is in Active status. | Active | Client | Absent from API response when null — consistent with null suppression. |
| BR-014 | The `termsAndConditions` array on the Agreement records the T&Cs accepted at the time of the original Purchase Order. T&Cs from subsequent Change, Configuration, or Termination Orders are not accumulated on the Agreement. | All | Client | Empty array on Draft — populated when the Purchase Order is placed. |
| BR-015 | The Agreement `price` object represents the aggregate pricing across all active Subscriptions and Assets by default. The Vendor may manually override the Agreement price when Entitlements are usage-based and carry no fixed price — for example, a pay-as-you-go cloud subscription where the Vendor sets the Agreement price to reflect the most recent invoice value. | Active | Vendor | The `source` field on the price object indicates whether the price is computed or manually set. |
| BR-016 | Each Actor can update their own `externalIds` field on the Agreement: `externalIds.client` (Client), `externalIds.operations` (Operations), `externalIds.vendor` (Vendor). All are optional. | All | All | |
| BR-017 | There can be only one Processing Order per Agreement at any time — the same constraint that applies at the Order level prevents concurrent Order processing. While an Order is Processing, the Agreement is in Updating or Provisioning status and no further Orders can be placed against it. | Provisioning, Updating | All | See Commerce: Order canon BR-005. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
|-----------|------|-------------|--------|------------------------|-------|
| `id` | String | Unique platform identifier for the Agreement. | Platform | No | Format: AGR-XXXX-XXXX-XXXX. Immutable. |
| `revision` | Integer | Increments each time the Agreement is updated. | Platform | Yes — platform-managed | |
| `name` | String | Human-readable name for the Agreement. | Platform (at creation), Client (updates) | Yes | Auto-generated at creation. Observed pattern: "[Product Name] for [Client/Licensee Name]". Updatable by Client. |
| `status` | Enum | Current status of the Agreement. Valid values: `Draft`, `Provisioning`, `Updating`, `Active`, `Terminated`, `Failed`, `Deleted`. | Platform | Yes — platform-managed | Driven by Order and Subscription state transitions. Not directly writable by any Actor. |
| `price` | Object | Aggregate pricing across all active Subscriptions and Assets. Contains `SPxY`, `SPxM` (selling price per year/month), `PPxY`, `PPxM` (purchase price per year/month), `currency`, `markup`, `margin`, `defaultMarkup`, `defaultMarkupSource`, `billingCurrency`, `source`. | Platform (computed) or Vendor (manual override) | Yes — Vendor can override | Absent on Draft. `PPxY`, `PPxM`, `markup`, `margin`, `defaultMarkup`, `defaultMarkupSource` suppressed for Vendor and Client — visible to Operations only. `SPxY`, `SPxM` visible to Client and Operations. `source` field indicates `Computed` or `Manual`. |
| `billingCurrency` | String | The currency in which the Client is invoiced. Must be a currency present in the Seller's `currencies` array. | Client | Yes — Active status only | Absent from response when null. Forex conversion applied between Authorization currency and billing currency for invoicing. |
| `template` | Object | Reference to the Catalog: Template currently assigned to this Agreement. | Platform (on Order completion), Vendor (updates) | Yes | Absent on Draft. Set to the Template of the most recently completed Order. Determines rendered content shown to Client when viewing their Agreement. |
| `lines` | Array | Flattened list of all Lines (Entitlements) across all Subscriptions and Assets. Accessible via `/lines` endpoint. | Platform | No | Called "Entitlements" in the UI and internal communications. API term is Lines. |
| `subscriptions` | Array | Subscriptions associated with this Agreement. Each Subscription carries its own parameters, pricing, terms, and template. | Platform | No | Populated as Subscriptions are created and linked during Order fulfilment. |
| `assets` | Array | Assets associated with this Agreement. | Platform | No | Populated as Assets are created and linked during Order fulfilment. |
| `parameters.ordering` | Array | Agreement-scoped ordering parameters. Set during the Purchase Order and carried over to the Agreement on completion. Contains parameters with `phase: "Order"` and `scope: "Agreement"`. | Client (via Purchase Order), Vendor (direct update on Agreement) | Yes — Vendor only after creation | Parameters with `hidden=true` suppressed from Client API responses. Client cannot modify after Purchase Order completes. |
| `parameters.fulfillment` | Array | Agreement-scoped fulfilment parameters. Written and maintained by the Vendor Extension. Contains parameters with `phase: "Fulfillment"` and `scope: "Agreement"`. | Vendor | Yes — Vendor at any time while Active | Parameters with `hidden=true` suppressed from Client API responses. |
| `externalIds.vendor` | String | Vendor's reference for this Agreement. | Vendor | Yes | Optional. Absent from response when null. |
| `externalIds.operations` | String | ERP or Operations reference for this Agreement. | Operations | Yes | Optional. Absent from response when null. |
| `externalIds.client` | String | Client's own reference for this Agreement. | Client | Yes | Optional. Absent from response when null. |
| `split` | Object | Split Billing configuration for this Agreement. Accessible via `/split` endpoint. | To be confirmed | To be confirmed | See AGR-007. Split Billing to be canonised separately. |
| `termsAndConditions` | Array | T&Cs accepted at the time of the original Purchase Order. Each entry records the Terms object, acceptance timestamp, and accepting User. | Client (at Purchase Order placement) | No — Purchase Order only | Empty array on Draft. Not updated by subsequent Orders. |
| `certificates` | Array | Certificates held by the Client relevant to this Agreement. | Platform | No | See ORD-007 and Programs and Certificates canon — pending canonisation. |
| `startDate` | DateTime | Purpose not confirmed. Nullable. Not observed in any Agreement API response. | To be confirmed | To be confirmed | See AGR-001. |
| `endDate` | DateTime | Purpose not confirmed. Nullable. Not observed in any Agreement API response. | To be confirmed | To be confirmed | See AGR-001. |
| `error` | Object | Suspected error information on Failed Agreements. Contains `id`, `message`, `parameters`. | To be confirmed | To be confirmed | See AGR-002 and AGR-008. Not observed in any API sample. |
| `listing` | Object | Reference to the Catalog: Listing under which this Agreement was established. | Platform | No | Immutable after creation. |
| `authorization` | Object | Reference to the Catalog: Authorization associated with the Listing. | Platform | No | Immutable after creation. Determines the transactional currency. |
| `product` | Object | Reference to the Catalog: Product this Agreement covers. | Platform | No | Immutable after creation. |
| `client` | Object | Reference to the Accounts: Account of the Client party to this Agreement. | Platform | No | Immutable after creation. |
| `vendor` | Object | Reference to the Accounts: Account of the Vendor party to this Agreement. | Platform | No | Immutable after creation. |
| `licensee` | Object | Reference to the Accounts: Licensee on whose behalf this Agreement was established. | Platform | No | Immutable after creation. |
| `buyer` | Object | Reference to the Accounts: Buyer associated with the Licensee. | Platform | No | Immutable after creation. |
| `seller` | Object | Reference to the Accounts: Seller associated with the Listing. | Platform | No | Immutable after creation. |
| `audit` | Object | Audit timestamps for key lifecycle events. Contains `created`, `updated`, `provisioning`, `active`, `terminated`, and `failed`. | Platform | No | Omitted by default — request via `select=+audit`. State-specific entries only present if the Agreement has reached that state. No `updating` audit sub-key — transitions to Updating are not individually timestamped. See AGR-008. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency |
|----------------|------------------|-------------|-------------|---------------------|
| Commerce: Order | Child | One Agreement to many Orders | Every Order of every type exists within the scope of this Agreement. Purchase Orders co-create the Agreement. Change, Configuration, and Termination Orders are placed against an existing Active Agreement. | Agreement state is driven by Order state transitions. Deletion of a Draft or Quoted Purchase Order moves the Agreement to Deleted. |
| Commerce: Subscription | Child | One Agreement to many Subscriptions | Subscriptions are created by the Vendor Extension during Order Processing and linked to the Agreement on Order completion. Each Subscription carries its own parameters, pricing, terms, template, and Lines. | All Subscriptions reaching Terminated status causes the Agreement to transition to Terminated — whether via Termination Order or direct Vendor action. |
| Commerce: Asset | Child | One Agreement to many Assets | Assets are created by the Vendor Extension during Order Processing and linked to the Agreement on Order completion. Assets represent one-time purchase items. | Assets are unaffected by Agreement termination. |
| Commerce: Order Line | Association | One Agreement to many Lines (Entitlements) | All Lines across all Subscriptions and Assets are accessible via the Agreement `/lines` endpoint. Referred to as Entitlements in the UI and internal communications. | No direct lifecycle dependency. |
| Commerce: Agreement Attachment | Child | One Agreement to many Attachments | Files and License Keys attached to the Agreement by Vendor or Operations. Relationship to Order Attachments to be confirmed — see AGR-003. | See AGR-003. |
| Catalog: Listing | Association | Many Agreements to one Listing | The Listing under which this Agreement was established. Determines the Seller, Price List, and Authorization. | Immutable after Agreement creation. |
| Catalog: Authorization | Association | Many Agreements to one Authorization | The Authorization associated with the Listing. Determines the transactional currency for the Agreement. | Immutable after Agreement creation. |
| Catalog: Product | Association | Many Agreements to one Product | The Product this Agreement covers. | Immutable after Agreement creation. |
| Catalog: Template | Association | Many Agreements to one Template | The Template determining rendered content shown to the Client when viewing their Agreement. Set from the most recently completed Order. Vendor may update directly. | No lifecycle dependency — Template changes do not affect Agreement status. |
| Accounts: Account (Client) | Association | Many Agreements to one Client Account | The Client Account party to this Agreement. | Immutable after Agreement creation. |
| Accounts: Account (Vendor) | Association | Many Agreements to one Vendor Account | The Vendor Account party to this Agreement. | Immutable after Agreement creation. |
| Accounts: Licensee | Association | Many Agreements to one Licensee | The Licensee on whose behalf this Agreement was established. | Immutable after Agreement creation. |
| Accounts: Buyer | Association | Many Agreements to one Buyer | The Buyer associated with the Licensee. | Immutable after Agreement creation. |
| Accounts: Seller | Association | Many Agreements to one Seller | The Seller associated with the Listing. `billingCurrency` must be a currency present in this Seller's `currencies` array. | Immutable after Agreement creation. |
| Catalog: Terms | Association | One Agreement to many Terms | T&Cs accepted at the time of the original Purchase Order. | Captured at Purchase Order placement. Not updated by subsequent Orders. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
|-------|---------|-------------------|---------------------------------|
| Agreement name updated | Client updates `name` field via PUT | Client | Name updated. No state transition. |
| Agreement template updated | Vendor updates `template` field via PUT | Vendor | Rendered content shown to Client updates immediately. No state transition. |
| Agreement parameters updated | Vendor updates `parameters.ordering` or `parameters.fulfillment` directly on the Agreement | Vendor | Parameter values updated on the Agreement. No state transition. Applies to Agreement-scoped parameters only. |
| Billing currency set | Client sets `billingCurrency` via PUT | Client | Forex conversion applied between Authorization currency and billing currency for invoicing. No state transition. Active status only. |
| Agreement price manually overridden | Vendor sets the Agreement price directly | Vendor | `source` field on price object changes from `Computed` to `Manual`. Used for usage-based Entitlements with no fixed price. No state transition. |
| Attachment added | Vendor or Operations adds an Attachment to the Agreement | Vendor, Operations | Attachment persisted and associated with the Agreement. No state transition. See Commerce: Agreement Attachment canon — pending canonisation. |

### 7.2 Cross-Object State Effects

> See Commerce: Order canon Section 7.2 for the full cross-object state transition table covering Agreement state changes driven by Order transitions.

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
|-----------------|----------------|--------------------------|------------|-----------|-------|
| All Subscriptions on Agreement reach Terminated | Commerce: Agreement | Agreement → Terminated | Yes — platform | All Subscriptions are Terminated | Whether via Termination Order or direct Vendor action. Assets are unaffected. |
| Purchase Order completes | Commerce: Agreement `parameters` | Agreement-scoped parameters from Purchase Order carried over to Agreement | Yes — platform | Order type is Purchase, transitions to Completed | Both `ordering` and `fulfillment` Agreement-scoped parameters are persisted on the Agreement. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Updating → Active is reversible with no limit on cycles — each new Order placed against an Active Agreement moves it to Updating, and each Order completion or failure returns it to Active.

All other transitions are irreversible. Provisioning → Active is one-way. Terminated, Failed, and Deleted are terminal states with no outbound transitions.

**Deletion:**
Agreements use a soft-delete model. An Agreement can only reach Deleted status when its co-created Draft or Quoted Purchase Order is deleted. There is no DELETE endpoint on Agreement — no Actor can delete an Agreement directly. Deleted Agreements remain retrievable via the API including in standard list responses. This deviates from Platform Invariant 7.

**Audit & history requirements:**
The Agreement audit block captures `created`, `updated`, `provisioning`, `active`, `terminated`, and `failed` timestamps and Actor references. There is no `updating` audit sub-key — transitions to Updating are not individually timestamped. The audit block is omitted from API responses by default — request via `select=+audit`. State-specific entries are only present if the Agreement has reached that state.

Audit Records are generated for Agreement state transitions. Prior versions of parameter values are not retained beyond the Audit Trail.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
|----------|--------------------------|---------------|------------|-------|
| Agreement remains in Provisioning or Updating indefinitely | No platform-level safeguard. The Agreement remains in a non-Active status if the associated Order is abandoned in Processing or Querying. No further Orders can be placed against the Agreement while it is in this state. | Client, Operations | High | Operations should monitor long-running Orders and intervene if necessary. See Commerce: Order canon Section 9. |
| Purchase Order fails after Agreement reaches Provisioning | Agreement → Failed. Permanently terminal. A new Purchase Order must be created to retry — the platform co-creates a new Agreement automatically. | Client | High | The Failed Agreement remains retrievable via the API but cannot be transacted against. |
| All Subscriptions terminated without a Termination Order | The platform automatically transitions the Agreement to Terminated when the last Subscription reaches Terminated status. Assets are unaffected and remain in their current state. | Client, Vendor | Medium | This can occur via direct Vendor action on Subscriptions outside of an Order. The Client may be surprised if the Agreement terminates without a Termination Order being placed. |
| Client attempts to modify Agreement-scoped parameters after Purchase Order completes | The platform does not permit the Client to modify Agreement-scoped parameters after the Purchase Order completes. Only the Vendor can update these parameters. | Client | Low | The Client can update Order-scoped parameters via subsequent Orders, but these are never carried back to the Agreement. |
| `billingCurrency` set to a currency not in Seller's `currencies` array | The platform rejects the update. `billingCurrency` must be a currency present in the Seller's `currencies` array. | Client | Low | Platform-enforced — see BR-013. |
| Agreement price manually overridden but underlying Subscriptions change | The manually set Agreement price is not automatically recomputed when Subscriptions are added, removed, or modified. The Vendor is responsible for keeping the manually overridden price current. | Vendor, Client | Medium | Applicable to usage-based Agreements only. The `source` field indicates whether the price is `Computed` or `Manual`. |
| Failed Agreement blocks new purchases for same Product and Client | A Failed Agreement remains visible in the API. A new Purchase Order creates a new Agreement — the Failed Agreement is not replaced or archived. Both exist simultaneously in the API. | Client, Operations | Medium | Operations should communicate to the Client that a new Purchase Order is required. The Failed Agreement has no operational impact once a new Agreement is Active. |

---

## 10. Open Questions

- [ ] **AGR-001:** `startDate` and `endDate` fields appear in the Agreement OpenAPI schema as nullable date-time fields with no `x-rql` annotations. Neither field is observed in any Agreement API response. Purpose, ownership, and whether these fields are actively used is not confirmed.
- [ ] **AGR-002:** `error` field appears in the Agreement OpenAPI schema as a nullable `ParametrisedMessage` (`id`, `message`, `parameters`). Not observed in any API sample — suspected to be a Failed-state-only field analogous to Order `statusNotes`. Confirmation required.
- [ ] **AGR-003:** Whether Attachments created via the Order `/attachments` endpoint are automatically visible via the Agreement `/attachments` endpoint, or whether they must be created against the Agreement separately, is not confirmed.
- [ ] **AGR-007:** Split Billing configuration on the Agreement — full semantics, write rules, and relationship to Order and Subscription Split Billing — to be canonised separately. See ORD-006.
- [ ] **AGR-008:** The `AgreementAudit` schema does not include a `failed` sub-key, but a Failed Agreement is expected to have a failure timestamp. Whether `failed` is a valid audit sub-key missing from the spec, or whether failure is recorded differently, is not confirmed.

---

## 11. Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1-stub | 2026-04-12 | Stu | Initial stub from Order canon session. State machine, core identity, and known business rules captured. Sections 4–9 incomplete. |
| 0.2 | 2026-04-13 | Stu | Full canon session completed. All sections authored. Parameters model documented — Agreement-scoped vs Order-scoped parameter distinction, Vendor write rules, Client read suppression. billingCurrency field documented including Seller currency constraint and forex model. Agreement price manual override model documented for usage-based Entitlements. Split Billing deferred to separate canon session. AGR-004, AGR-005, AGR-006 resolved and removed from open questions. AGR-008 added. |
