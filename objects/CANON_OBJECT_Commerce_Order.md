# Object Canon: Order

> **Version:** 0.3
> **Owner:** Stu
> **Last Updated:** 2026-07-17
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Order

**Namespace:** Commerce

**Parent Object:** None — top-level object.

**ID Prefix:** ORD

**Description:**
An Order is the platform's record of a request to create, modify, configure, or terminate the commercial relationship between a Client and a Vendor for a specific Product. Every Order exists within the scope of an Agreement and carries a type — Purchase, Change, Configuration, or Termination — that defines the nature of the requested change. Orders are created and placed by the Client Actor, processed by the Vendor's fulfilment Extension, and drive coupled state transitions on the Agreement and its associated Subscriptions and Assets. An Order moves through a defined lifecycle from Draft to a terminal state of Completed, Failed, or Deleted.

**Also Known As:**
None known.

---

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | No | Yes | Yes | Yes | Cannot create or place Orders — requires Client Actor context. Can update `parameters.ordering` and `parameters.fulfillment` during Processing. Can set `assignee` and `statusNotes`. Can transition Order status. Can delete Draft and Quoted Orders directly. Read is scoped to Orders on Agreements where they are the Vendor. |
| Operations | No | Yes | Yes | Yes | Cannot create or place Orders — a User must switch to a Client Account to do so. Can transition Order status including failing an Order. Can delete Draft and Quoted Orders directly. Read is not self-scoped — Operations sees all Orders platform-wide. |
| Client | Yes | Yes | Yes | Yes | Can create, update, and place Orders. Can delete Draft and Quoted Orders only. Can update `parameters.ordering` during Draft and Querying only. Read is scoped to Orders belonging to their own Account. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Draft | The Order has been created and saved but not yet placed. The Client can edit ordering parameters and the Order can be updated by Operations. The Order has not yet been submitted for fulfilment. | — | — |
| Quoted | The Order has been marked as ready for Client placement. Functionally equivalent to Draft except that no parameter values can be edited. Signals to the Client that the Order is ready to be placed. Draft → Quoted is a one-way transition. | — | — |
| Processing | The Order has been placed by the Client and is being processed by the Vendor's fulfilment Extension. The Vendor can update ordering and fulfilment parameters and transition the Order to Querying, Completed, or Failed. | — | — |
| Querying | The Order has been paused by the Vendor pending Client action — either correction of invalid parameter values or completion of an external task. The Client can update ordering parameters. The Order must return to Processing before it can be Completed or Failed. | — | — |
| Completed | The Order has been successfully fulfilled. All Lines have been mapped to Subscriptions or Assets. Terminal state — no outbound transitions. | — | — |
| Failed | The Order could not be fulfilled. A `statusNotes` object may be present explaining the reason for failure. A new Order must be created to retry. Terminal state — no outbound transitions. | — | — |
| Deleted | The Order has been soft-deleted — it moves to Deleted status and remains retrievable via the API including in standard list responses. Only reachable from Draft or Quoted. Terminal state — no outbound transitions. Deviates from Platform Invariant 7 — see Section 8. | — | — |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Draft | Create Order | Unconfirmed — pending refresh | Client | Listing must be Active. Seller of Listing must match Seller of Licensee. Parameter values must be valid. | Platform simultaneously creates a corresponding Draft Agreement for Purchase Orders. For Change, Configuration, and Termination Orders, the Order is created against an existing Active Agreement. |
| T2 | — | Quoted | Create Order as Quoted | Unconfirmed — pending refresh | Client | Same as T1. | Order created directly in Quoted status without passing through Draft. |
| T3 | — | Processing | Create and place Order | Unconfirmed — pending refresh | Client | Same as T1. | Order created and placed in a single API call without persisting as Draft or Quoted. Agreement → Provisioning (Purchase) or Updating (Change, Configuration, Termination). Affected pre-existing Subscriptions → Updating (Change only). All other Draft/Quoted Orders on the same Agreement → Deleted. |
| T4 | Draft | Draft | Update Order | Unconfirmed — pending refresh | Client, Operations | Order must be in Draft. | Client can update `parameters.ordering`. Operations can update the Order. |
| T5 | Draft | Quoted | Quote Order | Unconfirmed — pending refresh | Client | Order must be in Draft. | Signals to the Client that the Order is ready to be placed. No parameter edits permitted after this transition. Draft → Quoted is a one-way transition. |
| T6 | Draft | Processing | Place Order | Unconfirmed — pending refresh | Client | Parameter values must be valid. | Agreement → Provisioning (Purchase) or Updating (Change, Configuration, Termination). Affected pre-existing Subscriptions → Updating (Change only). All other Draft/Quoted Orders on the same Agreement → Deleted — executed under the placing Client's token context. |
| T7 | Draft | Deleted | Delete Order | Unconfirmed — pending refresh | Client, Vendor, Operations | — | Soft-deleted — moves to Deleted status, remains retrievable via the API. For Purchase Orders, the corresponding Draft Agreement is also moved to Deleted status. |
| T8 | Quoted | Processing | Place Order | Unconfirmed — pending refresh | Client | Parameter values must be valid. | Same coupled transitions as T6. All other Draft/Quoted Orders on the same Agreement → Deleted. |
| T9 | Quoted | Deleted | Delete Order | Unconfirmed — pending refresh | Client, Vendor, Operations | — | Same soft-delete behaviour as T7. For Purchase Orders, corresponding Draft Agreement also → Deleted. |
| T10 | Processing | Completed | Complete Order | Unconfirmed — pending refresh | Vendor | All Lines must be mapped to a Subscription or Asset. For Configuration Orders, no precondition — Vendor completes at their discretion. | Order → Completed. Agreement → Active. Draft Subscriptions and Assets created during Processing → Active and linked to Agreement. For Termination Orders, terminated Subscriptions → Terminated. If all Subscriptions on the Agreement are Terminated, Agreement → Terminated. |
| T11 | Processing | Failed | Fail Order | Unconfirmed — pending refresh | Vendor, Operations | — | `statusNotes` may optionally be set by the failing Actor. Purchase: Agreement → Failed. Change, Configuration, Termination: Agreement → Active, Subscriptions and Assets unchanged. |
| T12 | Processing | Querying | Move to Querying | Unconfirmed — pending refresh | Vendor | — | See ORD-001: whether Operations can also make this transition is unconfirmed. |
| T13 | Querying | Processing | Return to Processing | Unconfirmed — pending refresh | Client, Vendor, Operations | — | Client may have updated `parameters.ordering` before returning to Processing. |
| T14 | Querying | Failed | Fail Order | Unconfirmed — pending refresh | — | — | See ORD-002: whether this transition is possible is unconfirmed. Parked pending confirmation. |

### 3.3 State Diagram

```
— ---(Create Order : Client)---> [Draft]
— ---(Create Order as Quoted : Client)---> [Quoted]
— ---(Create and place Order : Client)---> [Processing]
[Draft] ---(Update Order : Client, Operations)---> [Draft]
[Draft] ---(Quote Order : Client)---> [Quoted]
[Draft] ---(Place Order : Client)---> [Processing]
[Draft] ---(Delete Order : Client, Vendor, Operations)---> [Deleted]
[Quoted] ---(Place Order : Client)---> [Processing]
[Quoted] ---(Delete Order : Client, Vendor, Operations)---> [Deleted]
[Processing] ---(Complete Order : Vendor)---> [Completed]
[Processing] ---(Fail Order : Vendor, Operations)---> [Failed]
[Processing] ---(Move to Querying : Vendor)---> [Querying]
[Querying] ---(Return to Processing : Client, Vendor, Operations)---> [Processing]
[Querying] ---(Fail Order : unconfirmed — see ORD-002)---> [Failed]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An Order must be created within the scope of an [[Agreement]]. For Purchase Orders, the platform automatically creates a corresponding Draft [[Agreement]] at the same moment the Order is first persisted. For Change, Configuration, and Termination Orders, the Order is created against an existing Active [[Agreement]]. | All | Client | The [[Agreement]] and Purchase Order are co-created — neither can exist without the other at Draft. |
| BR-002 | Only the Client Actor can create and place Orders. A User must switch to a Client [[Account]] to create or place an Order. The Vendor Actor cannot create or place Orders under any circumstance. | All | Client | This applies to all creation paths: Draft, Quoted, and direct to Processing. |
| BR-003 | At the time of Order creation, the platform validates: (a) the [[Listing]] must be Active; (b) the [[Seller]] of the [[Listing]] must match the [[Seller]] of the Licensee; (c) all supplied [[Parameter]] values must be valid according to their [[Parameter]] definitions. | — (creation) | Client | [[Parameter]] validation applies to string lengths, regex patterns, and other constraints defined on the [[Parameter]]. Orders that fail these validations are rejected by the platform. |
| BR-004 | [[Parameter]] values are re-validated on every save, not only at Order creation. | Draft, Querying | Client | Applies when the Client updates `parameters.ordering` values. |
| BR-005 | There can be only one Order in Processing status for a given [[Agreement]] at any time. | Processing | All | The platform enforces this constraint. A second Order cannot be placed against an [[Agreement]] while one is already Processing. |
| BR-006 | When an Order is placed (transitions to Processing), all other Draft and Quoted Orders on the same [[Agreement]] are automatically moved to Deleted status. This is executed under the placing Client's token context. | Draft, Quoted | Client | Affects all Draft and Quoted Orders on the [[Agreement]] regardless of type. |
| BR-007 | A Draft Order can be quoted by the Client Actor, moving it to Quoted status. An Order can also be created directly in Quoted status by the Client. Quoted status signals to the Client that the Order is ready to be placed. There is no material difference between Draft and Quoted except that parameter values cannot be edited in Quoted status. Draft → Quoted is a one-way transition. | Draft | Client | The `/quote` endpoint is used to transition a Draft Order to Quoted. A User must be operating in a Client [[Account]] context to quote an Order — this action is not available to the Operations or Vendor Actor directly. |
| BR-008 | During Draft status, only the Client Actor can write to `parameters.ordering`. No Actor can write to `parameters.fulfillment`. | Draft | Client | A User must be operating in a Client [[Account]] context to update ordering parameters. |
| BR-009 | During Quoted status, no Actor can write to either `parameters.ordering` or `parameters.fulfillment`. | Quoted | All | Quoted is effectively a read-only snapshot of the Order as presented to the Client. |
| BR-010 | During Processing status, only the Vendor Actor can write to `parameters.ordering` and `parameters.fulfillment`. | Processing | Vendor | See ORD-004: whether Operations can write to parameters during Processing without switching [[Account]] context is unconfirmed. |
| BR-011 | During Querying status, only the Client Actor can write to `parameters.ordering`. No Actor can write to `parameters.fulfillment`. | Querying | Client | See ORD-004: whether Operations can write to ordering parameters during Querying without switching [[Account]] context is unconfirmed. |
| BR-012 | Parameters with `hidden=true` are suppressed from API responses for the Client Actor. Hidden parameters are readable by Vendor and Operations in all statuses. | All | Client | `hidden` is an API-level read suppression, not merely a UI display hint. |
| BR-012a | Order parameters carry a `scope` field that determines their lifecycle. [[Agreement]]-scoped parameters (`scope: "[[Agreement]]"`) on a Purchase Order are carried over to the [[Agreement]] on Order completion and persist on the [[Agreement]] independently of any individual Order. Order-scoped parameters (`scope: "Order"`) exist only on the Order and are never carried over to the [[Agreement]]. Purchase Orders may carry both [[Agreement]]-scoped and Order-scoped parameters. Change, Configuration, and Termination Orders may only carry Order-scoped parameters — [[Agreement]]-scoped parameter modification is not possible via these Order types. | All | All | See Commerce: [[Agreement]] canon BR-010 and BR-011 for how [[Agreement]]-scoped parameters behave on the [[Agreement]] after carry-over. |
| BR-013 | An Order in Processing status can be moved to Querying status by the Vendor. The Order must return to Processing before it can be Completed or Failed. | Processing | Vendor | See ORD-001: whether Operations can also move a Processing Order to Querying is unconfirmed. See ORD-002: whether a Querying Order can transition directly to Failed is unconfirmed. |
| BR-014 | When an Order is in Querying status, the Client should be directed to either correct invalid parameter values or complete an external task before the Order can proceed. It is good practice for the Vendor to set the Order [[Template]] to one that contains clear instructions for the Client. | Querying | Vendor | The Querying state is a communication mechanism between the Vendor Extension and the Client. See Catalog: [[Template]] canon for [[Template]] types. |
| BR-015 | Only Draft and Quoted Orders can be deleted. Deletion moves the Order to Deleted status — it is not permanently removed and remains retrievable via the API including in standard list responses. | Draft, Quoted | Client, Vendor, Operations | Deviates from Platform Invariant 7. Deleted Orders remain visible in standard list responses. |
| BR-016 | When a Draft or Quoted Purchase Order is deleted, the platform automatically moves the corresponding Draft [[Agreement]] to Deleted status. When a Draft or Quoted Change, Configuration, or Termination Order is deleted, the [[Agreement]] is unaffected and remains Active. | Draft, Quoted | Client, Vendor, Operations | Automated for Purchase Orders — executed by the platform under the deleting Actor's token context. |
| BR-017 | Failed is a terminal status. A Failed Order cannot be retried or reactivated. A new Order must be created to retry the intended change. | Failed | All | — |
| BR-018 | When an Order fails, the failing Actor may optionally set `statusNotes` to communicate the reason for failure to the Client. `statusNotes` contains a structured object with an error code (`id`) and a human-readable `message`. | Processing | Vendor, Operations | `statusNotes` is optional — its absence does not indicate success. |
| BR-019 | For Purchase Orders: when the Order transitions to Processing, the [[Agreement]] transitions to Provisioning. When the Order completes, the [[Agreement]] transitions to Active and all Draft Subscriptions and Assets created during Processing transition to Active. When the Order fails, the [[Agreement]] transitions to Failed. | Processing | Vendor | — |
| BR-020 | For Change Orders: when the Order transitions to Processing, the [[Agreement]] transitions to Updating and all affected pre-existing Subscriptions transition to Updating. When the Order completes, the [[Agreement]] and affected Subscriptions return to Active. When the Order fails, the [[Agreement]] and all Subscriptions return to Active unchanged. | Processing | Vendor | New Subscriptions and Assets created during Processing of a Change Order follow the same Draft → Active pattern as Purchase Orders. |
| BR-021 | For Configuration and Termination Orders: when the Order transitions to Processing, the [[Agreement]] transitions to Updating. When the Order fails, the [[Agreement]] returns to Active with all Subscriptions and Assets unchanged. | Processing | Vendor | — |
| BR-022 | For Termination Orders: when the Order completes, the terminated Subscriptions transition to Terminated. If all Subscriptions on the [[Agreement]] are Terminated as a result, the [[Agreement]] also transitions to Terminated. Assets cannot be terminated and are unaffected by Termination Orders. | Processing | Vendor | [[Agreement]] termination is triggered by the state of its Subscriptions, not directly by the Order. |
| BR-023 | For Configuration Orders: the Order operates at the [[Subscription]] property level, not the Line level. Configuration Orders do not create or terminate Subscriptions. The `lines` array is not present on Configuration Orders. The Vendor completes a Configuration Order at their discretion — there is no Line mapping precondition. | Processing | Vendor | Configuration Orders are most commonly used to toggle auto-renewal on Subscriptions, but can serve other purposes as defined by the Vendor Extension. |
| BR-024 | Every Line in a Purchase, Change, or Termination Order must be mapped to a [[Subscription]] or [[Asset]] before the Order can be moved to Completed. Draft Subscriptions and Assets are created by the Vendor Extension during Processing and linked to the Order. On completion, they are linked to the [[Agreement]] and transitioned to Active. | Processing | Vendor | Each [[Subscription]] may have one or more Lines. Each [[Asset]] may have one or more Lines. The billing model of the [[Product]] [[Item]] on the Line determines whether it maps to a [[Subscription]] (recurring) or an [[Asset]] (one-time). |
| BR-025 | The `assignee` field may be set by the Vendor to indicate the User or API Token responsible for processing the Order. It is optional and has no material effect on Order processing or state transitions. | Processing | Vendor | — |
| BR-026 | Orders have three external identifier fields: `externalIds.vendor` (Vendor's own order reference), `externalIds.operations` (ERP reference), and `externalIds.client` (Client reference such as a purchase order number). All are optional. | All | All | — |
| BR-027 | A Client must hold a valid Certificate for the Program assigned to a [[Product]] in order to place an Order for that [[Product]]. If no Program is assigned to the [[Product]], no Certificate is required. | — (creation) | Client | See Programs and Certificates canon — pending canonisation. |
| BR-028 | The platform supports Vendor-defined pre-validation of Orders via a `/validate` endpoint. Pre-validation is enabled per Order type via boolean settings on the [[Product]]: `settings.preValidation.purchaseOrderDraft`, `settings.preValidation.changeOrderDraft`, `settings.preValidation.configurationOrderDraft`, `settings.preValidation.terminationOrder`, and `settings.preValidation.purchaseOrderQuerying`. | Draft, Querying | Vendor | See Catalog: [[Product]] canon for [[Product]] settings. |
| BR-029 | When `/validate` is called on an Order and the corresponding `preValidation` setting is `true`, the platform first persists the Order, then fires the corresponding [[Webhook]] to the Vendor Extension endpoint. The Extension may validate and optionally modify the Order — for example adjusting [[Unit]] PP on Lines. The modified Order is persisted again and returned as the response to `/validate`. If the corresponding `preValidation` setting is `false`, `/validate` returns the unaltered Order body. The `/validate` endpoint may be called multiple times on the same Order. | Draft, Querying | Vendor | Modifications made by the Extension are visible in the `/validate` response. |
| BR-030 | Modifications made by the Vendor Extension during pre-validation are subject to the same Actor-based write rules as direct API writes. For example, an Extension acting as a Vendor token cannot modify `markup` or `margin` fields. | Draft, Querying | Vendor | Consistent with Preamble Section 6.3 — Actor-based field suppression applies to Extension tokens as well as human Actor tokens. |
| BR-031 | If the Extension returns a validation failure, the failure is communicated to the caller in the `/validate` response with a 400 status and an error message provided by the Extension. The Order remains in its current status. | Draft, Querying | Vendor | The platform does not interpret or transform the Extension's error response — it is passed through to the caller as-is. |
| BR-032 | Webhooks used for pre-validation are reverse proxied by the platform. If the platform cannot reach the Vendor Extension, the `/validate` endpoint returns 200 OK with the unaltered Order body. No error is surfaced to the caller. | Draft, Querying | Vendor | This is a known failure mode — see Section 9. Vendors are expected to handle Orders that could not be validated at Draft during the Processing phase, including failing them if necessary. |
| BR-033 | The `settings.preValidation.purchaseOrderQuerying` setting applies specifically to Purchase Orders in Querying status. When `/validate` is called on a Purchase Order in Querying status and this setting is `true`, the corresponding `ValidatePurchaseOrderQuerying` [[Webhook]] is fired. | Querying | Vendor | Only applicable to Purchase Orders in Querying status — not to other Order types in Querying status. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | String | Unique platform identifier for the Order. | Platform | No | Mutable After Processing?: No. Format: ORD-XXXX-XXXX-XXXX. |
| `revision` | Integer | Increments each time the Order is updated. | Platform | Yes — platform-managed | Mutable After Processing?: Yes — platform-managed |
| `type` | Enum | The type of Order. Valid values: `Purchase`, `Change`, `Configuration`, `Termination`. | Client (at creation) | No | Mutable After Processing?: No. Immutable after creation. Determines the semantics of the Order and its coupled state transitions. |
| `status` | Enum | The current status of the Order. Valid values: `Draft`, `Quoted`, `Processing`, `Querying`, `Completed`, `Failed`, `Deleted`. | Platform | Yes | Mutable After Processing?: Yes. Controlled via state transitions — not directly writable as a field except at creation (see ORD-003). |
| `notes` | String | Free-text notes field. Used operationally to record context about the Order — e.g. requester name, case reference. | Client, Operations | Yes | Mutable After Processing?: Yes. Optional. Visible to all Actors. |
| `statusNotes` | Object | Structured error information set when an Order fails. Contains `id` (error code) and `message` (human-readable explanation). | Vendor, Operations | No | Mutable After Processing?: Yes — on Failed transition only. Optional. Only present on Failed Orders. Absent from response when null, consistent with null suppression. |
| `assignee` | Object | Reference to the User or API Token responsible for processing the Order. | Vendor | Yes | Mutable After Processing?: Yes. Optional. Has no material effect on Order processing or state transitions. Absent from response when null. |
| `externalIds.vendor` | String | Vendor's own order reference — e.g. the order number placed at the Vendor. | Vendor | Yes | Mutable After Processing?: Yes. Optional. |
| `externalIds.operations` | String | ERP reference for the Order. | Operations | Yes | Mutable After Processing?: Yes. Optional. |
| `externalIds.client` | String | Client reference — e.g. a purchase order number. | Client | Yes | Mutable After Processing?: Yes. Optional. |
| `price` | Object | Aggregate pricing for the Order across all Lines. Contains `SPxY`, `SPxM` (selling price per year/month), `PPxY`, `PPxM` (purchase price per year/month), `PPx1`, `SPx1` (one-time prices), `currency`, `markup`, `margin`, `defaultMarkup`, and `defaultMarkupSource`. | Platform | No | Mutable After Processing?: No. `PPxY`, `PPxM`, `PPx1`, `markup`, `margin`, `defaultMarkup`, `defaultMarkupSource` suppressed for Vendor and Client Actors — visible to Operations only. Not present on Configuration Orders. Present on Termination Orders — carries negative values reflecting reduction in committed spend. |
| `lines` | Array | The Order Lines — one entry per SKU at one quantity. Each Line references an Item, carries its own price object, and maps to a Subscription or Asset. | Client, Vendor | Yes | Mutable After Processing?: Yes — Vendor can modify during Processing. Child objects with ID prefix ALI. Not present on Configuration Orders. See Commerce: Order Line canon — pending canonisation. |
| `subscriptions` | Array | References to Subscriptions associated with this Order. For Purchase and Change Orders, populated during Processing as Draft Subscriptions are created. For Termination Orders, references the Subscriptions being terminated. | Platform | No | Mutable After Processing?: No. Summary references only — not full Subscription objects. |
| `assets` | Array | References to Assets associated with this Order. Populated during Processing for Purchase and Change Orders where one-time purchase Items are present. | Platform | No | Mutable After Processing?: No. Summary references only. |
| `parameters.ordering` | Array | Ordering phase parameters — data collected from the Client to support Order placement and fulfilment. Each entry includes `id`, `name`, `type`, `phase`, `scope`, `multiple`, `constraints`, `value`, and `displayValue`. | Client (Draft, Querying), Vendor (Processing) | Yes | Mutable After Processing?: Yes — per BR-008 through BR-011. Parameters with `hidden=true` are suppressed from Client API responses. See BR-012. |
| `parameters.fulfillment` | Array | Fulfilment phase parameters — data written by the Vendor Extension during Processing to record fulfilment state. | Vendor (Processing only) | Yes | Mutable After Processing?: Yes — Vendor only during Processing. Parameters with `hidden=true` are suppressed from Client API responses. Not writable by Client in any status. |
| `template` | Object | Reference to the Catalog: Template assigned to this Order. Determines the rendered content shown to the Client at each Order status. | Vendor | Yes | Mutable After Processing?: Yes. The Vendor Extension typically sets or updates the Template during Processing and Querying to provide contextually relevant instructions to the Client. |
| `listing` | Object | Reference to the Catalog: Listing under which this Order was placed. | Client (at creation) | No | Mutable After Processing?: No. Immutable after creation. |
| `authorization` | Object | Reference to the Catalog: Authorization associated with the Listing. | Platform | No | Mutable After Processing?: No. Derived from the Listing at creation. Immutable after creation. |
| `agreement` | Object | Reference to the Commerce: Agreement this Order belongs to. | Platform | No | Mutable After Processing?: No. Immutable after creation. For Purchase Orders, the Agreement is co-created with the Order. |
| `product` | Object | Reference to the Catalog: Product being ordered. | Platform | No | Mutable After Processing?: No. Derived from the Listing at creation. Immutable after creation. |
| `client` | Object | Reference to the Accounts: Account of the Client placing the Order. | Platform | No | Mutable After Processing?: No. Derived from the Actor context at creation. Immutable after creation. |
| `licensee` | Object | Reference to the Accounts: Licensee on whose behalf the Order is placed. | Client (at creation) | No | Mutable After Processing?: No. Immutable after creation. Seller of Licensee must match Seller of Listing — enforced at creation (BR-003). |
| `buyer` | Object | Reference to the Accounts: Buyer associated with the Licensee. | Platform | No | Mutable After Processing?: No. Derived from the Licensee at creation. Immutable after creation. |
| `seller` | Object | Reference to the Accounts: Seller associated with the Listing. | Platform | No | Mutable After Processing?: No. Derived from the Listing at creation. Immutable after creation. |
| `vendor` | Object | Reference to the Accounts: Account of the Vendor. | Platform | No | Mutable After Processing?: No. Derived from the Listing at creation. Immutable after creation. |
| `termsAndConditions` | Array | Terms and Conditions accepted by the Client at Order placement. Each entry references a Catalog: Terms object and records the acceptance timestamp and accepting User. | Client (at placement) | No | Mutable After Processing?: No. Captured at the point the Order is placed. Empty array if no Terms are required for the Product. |
| `certificates` | Array | Certificates held by the Client that qualify them to place this Order. | Platform | No | Mutable After Processing?: No. See ORD-007 and Programs and Certificates canon — pending canonisation. Always empty in observed samples where no Program is assigned to the Product. |
| `audit` | Object | Audit timestamps and Actor references for key Order lifecycle events. Contains `created`, `updated`, and state-specific entries: `processing`, `querying`, `completed`, `failed`. | Platform | No | Mutable After Processing?: No. Omitted by default — request via `select=+audit`. State-specific audit entries are only present if the Order has reached that state. |
| References | group | Group of immutable reference fields set at Order creation: listing, authorization, agreement, product, client, licensee, buyer, seller, vendor. All derived from the Listing or Actor context. None mutable after creation. | system | — | — |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Commerce: Agreement | Parent | Many Orders to one Agreement | Every Order exists within the scope of an Agreement. For Purchase Orders, the Agreement is co-created with the Order at Draft. For all other Order types, the Order is created against an existing Active Agreement. | If a Draft or Quoted Purchase Order is deleted, the platform automatically moves the corresponding Draft Agreement to Deleted. Deletion of a Draft or Quoted Change, Configuration, or Termination Order has no effect on the Agreement. |
| Commerce: Order Line | Child | One Order to many Lines | Lines are the unit of work within a Purchase, Change, or Termination Order — one Line per SKU at one quantity. Each Line must be mapped to a Subscription or Asset before the Order can complete. Not present on Configuration Orders. | Lines are created within the scope of the Order. See Commerce: Order Line canon — pending canonisation. |
| Commerce: Subscription | Association | One Order to many Subscriptions | Subscriptions associated with this Order. For Purchase and Change Orders, Draft Subscriptions are created by the Vendor Extension during Processing and linked to the Agreement on completion. For Termination Orders, references the Subscriptions being terminated. | Order completion drives Subscription state transitions — see BR-019 through BR-022. If all Subscriptions on an Agreement are Terminated, the Agreement also transitions to Terminated. |
| Commerce: Asset | Association | One Order to many Assets | Assets associated with this Order. For Purchase and Change Orders, Draft Assets are created by the Vendor Extension during Processing and linked to the Agreement on completion. Assets cannot be terminated. | Order completion drives Asset state transitions — see BR-019 and BR-020. Assets are unaffected by Termination Orders and by Agreement termination. |
| Commerce: Agreement Attachment | Association | One Order to many Attachments (optional) | Files or License Key text attached to the Order by the Agreement's Vendor or Operations. These are not a distinct object — they belong to the shared Commerce: Agreement Attachment collection and reference this Order via their `orderId`. There is no Order attachments endpoint; they are created and retrieved through the parent Agreement's `/attachments` endpoint. Attachment creation and deletion are not gated by Order status. | No cascade. The `orderId` is a plain reference — the Order and its attachments are deleted independently. See Commerce: Agreement Attachment canon. |
| Catalog: Listing | Association | Many Orders to one Listing | The Listing under which the Order was placed. Determines the Seller, Price List, and Authorization applicable to the Order. | Immutable after Order creation. The Listing must be Active at the time of Order creation. |
| Catalog: Authorization | Association | Many Orders to one Authorization | The Authorization associated with the Listing. Determines the currency and billing context for the Order. | Derived from the Listing at creation. Immutable after Order creation. |
| Catalog: Product | Association | Many Orders to one Product | The Product being ordered. Derived from the Listing at creation. | Immutable after Order creation. If the Product has a Program assigned, the Client must hold a valid Certificate to place an Order. |
| Catalog: Template | Association | Many Orders to one Template | The Template determining the rendered content shown to the Client at each Order status. The Vendor Extension typically updates the Template during Processing and Querying to provide contextually relevant instructions. | No lifecycle dependency — Template changes do not affect Order status. See Catalog: Template canon. |
| Accounts: Account (Client) | Association | Many Orders to one Client Account | The Client Account on whose behalf the Order is placed. Derived from the Actor context at creation. | Immutable after Order creation. |
| Accounts: Licensee | Association | Many Orders to one Licensee | The Licensee on whose behalf the Order is placed. The Seller of the Licensee must match the Seller of the Listing at Order creation. | Immutable after Order creation. |
| Accounts: Buyer | Association | Many Orders to one Buyer | The Buyer associated with the Licensee. Derived from the Licensee at creation. | Immutable after Order creation. |
| Accounts: Seller | Association | Many Orders to one Seller | The Seller associated with the Listing. Derived from the Listing at creation. | Immutable after Order creation. |
| Accounts: Account (Vendor) | Association | Many Orders to one Vendor Account | The Vendor Account for the Product being ordered. Derived from the Listing at creation. | Immutable after Order creation. |
| Catalog: Terms | Association | One Order to many Terms | Terms and Conditions accepted by the Client at Order placement. Acceptance is recorded on the Order with timestamp and accepting User. | Captured at placement. No lifecycle dependency after acceptance is recorded. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Order validated | Client calls `/validate` on a Draft or Querying Order | Client | Platform persists the Order, fires the corresponding pre-validation Webhook if enabled, and returns the validated (and optionally modified) Order body. No state transition occurs. |
| Order quoted | Client calls `/quote` on a Draft Order | Client | Order transitions to Quoted. No other state changes. A User must be operating in a Client Account context to perform this action. |
| Parameter values updated | Client updates `parameters.ordering` on a Draft or Querying Order | Client | Platform re-validates parameter values on save. Invalid values are rejected. |
| Parameter values updated | Vendor updates `parameters.ordering` or `parameters.fulfillment` on a Processing Order | Vendor | No state transition occurs. Changes are persisted immediately. |
| Assignee set | Vendor sets `assignee` on a Processing Order | Vendor | No material effect on Order processing. Persisted as a reference field only. |
| Attachment added | The [[Agreement]]'s Vendor or Operations uploads a file or records a License Key, optionally against this Order | Vendor, Operations | The attachment is persisted on the parent [[Agreement]]'s shared attachment collection and associated with this Order via `orderId`. No state transition occurs. See Commerce: [[Agreement Attachment]] canon. |
| Attachment deleted | The [[Agreement]]'s Vendor or Operations deletes an attachment | Vendor, Operations | The attachment is permanently removed — no longer retrievable via the API. No state transition occurs. |
| Template updated | Vendor updates the Template on a Processing or Querying Order | Vendor | The rendered content shown to the Client updates immediately. Typically used to provide contextually relevant instructions during Querying. No state transition occurs. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Purchase Order created (Draft or direct to Processing) | Commerce: Agreement | Agreement co-created in Draft status | Yes — platform, under Client token context | Order type is Purchase | Agreement and Order are created simultaneously. |
| Any Order placed (→ Processing) | Commerce: Agreement | Agreement → Provisioning | Yes — platform, under Client token context | Order type is Purchase | — |
| Any Order placed (→ Processing) | Commerce: Agreement | Agreement → Updating | Yes — platform, under Client token context | Order type is Change, Configuration, or Termination | — |
| Change Order placed (→ Processing) | Commerce: Subscription | Affected pre-existing Subscriptions → Updating | Yes — platform, under Client token context | Order type is Change; Subscriptions must be pre-existing | Newly created Draft Subscriptions are unaffected — they do not exist yet at placement. |
| Purchase or Change Order Processing | Commerce: Subscription | Draft Subscriptions created under the Order | Yes — Vendor Extension, under Vendor token context | Vendor Extension creates Draft Subscriptions during Processing | One or more Draft Subscriptions may be created per Order. |
| Purchase or Change Order Processing | Commerce: Asset | Draft Assets created under the Order | Yes — Vendor Extension, under Vendor token context | Vendor Extension creates Draft Assets during Processing where one-time purchase Items are present | One or more Draft Assets may be created per Order. |
| Purchase or Change Order completed (→ Completed) | Commerce: Agreement | Agreement → Active | Yes — platform, under Vendor token context | Order type is Purchase or Change | — |
| Purchase or Change Order completed (→ Completed) | Commerce: Subscription | Draft Subscriptions → Active, linked to Agreement | Yes — platform, under Vendor token context | All Lines must be mapped to a Subscription or Asset | — |
| Purchase or Change Order completed (→ Completed) | Commerce: Asset | Draft Assets → Active, linked to Agreement | Yes — platform, under Vendor token context | All Lines must be mapped to a Subscription or Asset | — |
| Termination Order completed (→ Completed) | Commerce: Subscription | Terminated Subscriptions → Terminated | Yes — platform, under Vendor token context | Order type is Termination | — |
| Termination Order completed (→ Completed) | Commerce: Agreement | Agreement → Terminated | Yes — platform, under Vendor token context | All Subscriptions on the Agreement are Terminated | Only triggered if all Subscriptions are Terminated as a result of this Order. |
| Purchase Order completed (→ Completed) | Commerce: Agreement `parameters` | Agreement-scoped parameters from Purchase Order carried over to Agreement | Yes — platform, under Vendor token context | Order type is Purchase; Order transitions to Completed | Both `parameters.ordering` and `parameters.fulfillment` Agreement-scoped values are persisted on the Agreement. Order-scoped parameters are not carried over. |
| Purchase Order failed (→ Failed) | Commerce: Agreement | Agreement → Failed | Yes — platform, under Vendor or Operations token context | Order type is Purchase | — |
| Change, Configuration, or Termination Order failed (→ Failed) | Commerce: Agreement | Agreement → Active | Yes — platform, under Vendor or Operations token context | Order type is Change, Configuration, or Termination | Agreement reverts to Active. All Subscriptions and Assets remain unchanged. |
| Draft or Quoted Purchase Order deleted (→ Deleted) | Commerce: Agreement | Agreement → Deleted | Yes — platform, under deleting Actor's token context | Order type is Purchase; Order must be in Draft or Quoted | Soft-deleted — Agreement remains retrievable via the API. |
| Any Order placed against an Agreement with competing Draft/Quoted Orders | Commerce: Order | Competing Draft and Quoted Orders → Deleted | Yes — platform, under placing Client's token context | Any Order placed against an Agreement that already has Draft or Quoted Orders | All competing Draft and Quoted Orders are soft-deleted simultaneously. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Processing → Querying → Processing is reversible with no limit on cycles. The Vendor may move an Order between Processing and Querying as many times as needed until the Order is Completed or Failed.

All other transitions are irreversible. Draft → Quoted is a one-way transition. Completed, Failed, and Deleted are terminal states with no outbound transitions.

**Deletion:**
Orders use a soft-delete model. Deleting an Order moves it to Deleted status — it is not permanently removed and remains retrievable via the API including in standard list responses. Only Orders in Draft or Quoted status can be deleted. This behaviour deviates from Platform Invariant 7 — see `PLATFORM_CANON_PREAMBLE.md`.

For Purchase Orders, deletion of a Draft or Quoted Order also moves the corresponding Draft Agreement to Deleted status under the same soft-delete model.

**Audit & history requirements:**
The Order audit block captures timestamps and Actor references for key lifecycle events. In addition to the standard `created` and `updated` entries, the audit block includes state-specific entries that are populated as the Order progresses: `processing`, `querying`, `completed`, and `failed`. State-specific audit entries are only present if the Order has reached that state. The audit block is omitted from API responses by default — request via `select=+audit`.

Audit Records are generated for all Order state transitions. Prior versions of parameter values are not retained beyond the audit trail. If parameter value history is required, it must be reconstructed from Audit Records.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Pre-validation Webhook unreachable at Draft | The `/validate` endpoint returns 200 OK with the unaltered Order body. No error is surfaced to the caller. The Order proceeds as if validation passed. | Client, Vendor | High | The Vendor Extension is expected to handle invalid Orders during Processing, including failing them if necessary. See BR-032. |
| Pre-validation Webhook unreachable at Querying | Same behaviour as Draft — `/validate` returns 200 OK with unaltered Order body. A Querying Order with unvalidated parameters may be returned to Processing and subsequently fail during fulfilment. | Client, Vendor | High | Same mitigation applies — Vendor Extension must handle during Processing. |
| Order placed with competing Draft/Quoted Orders on same Agreement | All competing Draft and Quoted Orders on the Agreement are automatically moved to Deleted status. Clients who had prepared those Orders are not notified. | Client | Medium | Clients should be aware that placing one Order will silently delete all other Draft and Quoted Orders on the same Agreement. |
| Purchase Order fails after Agreement reaches Provisioning | The Order moves to Failed and the Agreement moves to Failed. The Client cannot transact against a Failed Agreement. A new Purchase Order must be created to retry — the platform will co-create a new Agreement automatically. | Client | High | See Agreement canon — pending canonisation — for the full semantics of a Failed Agreement. |
| Change, Configuration, or Termination Order fails | The Agreement reverts to Active with all Subscriptions and Assets unchanged. The failed Order remains visible in the API in Failed status. A new Order must be created to retry the intended change. | Client, Vendor | Medium | No data loss — the Agreement and its Subscriptions and Assets are restored to their pre-Order state. |
| Order remains in Querying status indefinitely | The platform does not enforce a timeout on Querying status. If neither the Client nor the Vendor acts, the Order remains in Querying indefinitely. The Agreement remains in Updating status for the duration, which may affect other operations against that Agreement. | Client, Vendor, Operations | High | Vendor or Operations should monitor Querying Orders and either return them to Processing or fail them if the Client is unresponsive. |
| Parameter values modified by Vendor Extension exceed Actor write permissions | The platform enforces Actor-based write rules on Extension modifications during pre-validation. Modifications to suppressed fields — such as `markup` or `margin` — are rejected. | Vendor | Medium | Vendor Extension developers must ensure their validation logic respects the Actor-based write model. See BR-030. |
| Client places Order against a Listing whose Seller does not match the Licensee Seller | The platform rejects the Order at creation with a validation error. The Order is not persisted. | Client | Low | Platform-enforced validation — see BR-003. Misconfiguration of Licensee or Listing assignment is the typical cause. |
| Client attempts to place Order without a required Certificate | The platform rejects the Order at creation. The Client must obtain the required Certificate before placing the Order. | Client | Medium | See Programs and Certificates canon — pending canonisation. |
| Multiple Orders placed rapidly against the same Agreement | The platform enforces a single Processing Order constraint per Agreement. A second Order cannot be placed while one is already Processing. However, a race condition may exist if two Orders are submitted simultaneously before either reaches Processing status. | Client | Medium | See BR-005. See ORD-005. |
| Draft Subscriptions or Assets created during Processing not mapped before completion attempted | The platform prevents Order completion if any Lines remain unmapped to a Subscription or Asset. The Vendor must map all Lines before the Order can be Completed. | Vendor | Low | Platform-enforced — see BR-024. Not applicable to Configuration Orders. |
| Agreement remains in Updating or Provisioning status due to a long-running Order | While an Agreement is in Updating or Provisioning status, other operations against that Agreement may be blocked. If a Processing or Querying Order is abandoned, the Agreement may remain in a non-Active status indefinitely. | Client, Operations | High | There are no platform-level safeguards against this. Operations should monitor long-running Orders and intervene if necessary. |

---

## 10. Open Questions

- [ ] **ORD-001:** Can Operations move a Processing Order to Querying status, or is that transition Vendor-only? Gut says both Vendor and Operations, but unconfirmed.
- [ ] **ORD-002:** Can a Querying Order transition directly to Failed, or must it return to Processing first? The state machine diagram suggests a direct transition is possible; prior discussion suggests it is not.
- [ ] **ORD-003:** When submitting a new Order to the API, which initial status values are valid — is the Client limited to `Draft`, `Quoted`, and `Processing`, or can other values be set directly?
- [ ] **ORD-004:** During Processing and Querying status, can Operations write to `parameters.ordering` and/or `parameters.fulfillment` directly, or must they switch to a Client or Vendor Account to do so?
- [ ] **ORD-005:** Whether the platform handles simultaneous Order placement attempts against the same Agreement atomically — preventing race conditions where two Orders could both reach Processing status simultaneously — is not confirmed.
- [ ] **ORD-006:** Split Billing is enabled at the Agreement level and has implications for Order behaviour. This section requires updating once Split Billing has been canonised in the Agreement canon.
- [ ] **ORD-007:** The `certificates` array on the Order is always empty in observed samples where no Program is assigned to the Product. The full structure of a populated `certificates` entry, which Actors can read it, and whether it is suppressed for any Actor type is not confirmed. See Programs and Certificates canon — pending canonisation.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.3 | 2026-07-17 | Stu / canon-generate | Attachment references corrected while canonising Commerce: Agreement Attachment. The former "Commerce: Order Attachment" child (§6) is not a distinct object — reframed as an Association to the shared Commerce: Agreement Attachment collection, referenced via `orderId` and served only through the parent Agreement's `/attachments` endpoint (there is no Order attachments endpoint). Removed the unsupported "attachments can be added in any status except Failed and Deleted" claim — attachment create/delete is not gated by Order (or Agreement) status. §7 attachment events repointed to the Commerce: Agreement Attachment canon, with `[[Agreement Attachment]]` bracket-linked now that the child object is canonised. Header version corrected (was 0.1 with a 0.2 changelog row already present). |
| 0.2 | 2026-04-13 | Stu | BR-012a added: parameter scope semantics — Agreement-scoped vs Order-scoped distinction, carry-over behaviour on Purchase Order completion, Order type constraints. Section 7.2 updated: Purchase Order completion parameter carry-over to Agreement added as a cross-object side effect. |
| 0.1 | 2026-04-12 | Stu | Initial canon. Commerce namespace — first object canonised. Covers all four Order types, full state machine, coupled Agreement/Subscription/Asset state transitions, parameter write rules, pre-validation webhook mechanism, pricing field visibility, soft-delete model, Attachment and Line child objects identified as pending canonisation. |
