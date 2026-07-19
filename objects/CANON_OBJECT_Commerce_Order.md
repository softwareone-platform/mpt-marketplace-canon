# Object Canon: Order

> **Version:** 0.5
> **Owner:** Stu
> **Last Updated:** 2026-07-19
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
An Order is the platform's record of a request to create, modify, configure, terminate, suspend, or resume the commercial relationship between a Client and a Vendor for a specific [[Product]]. Every Order exists within the scope of an [[Agreement]] and carries a type — Purchase, Change, Configuration, Termination, Suspend, or Resume — that defines the nature of the requested change. Purchase, Change, Configuration, and Termination Orders are created and placed by the Client Actor; Suspend and Resume Orders are created and placed by Operations and act on existing [[Subscription]]s. All Order types are fulfilled by the Vendor, driving coupled state transitions on the [[Agreement]] and its associated [[Subscription]]s and [[Asset]]s. An Order moves through a defined lifecycle from Draft to a terminal state of Completed, Failed, or Deleted.

**Also Known As:**
None known.

---

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | No | Yes | Yes | Yes | Cannot create, place, or quote Orders — requires Client Actor context. Fulfils Orders during Processing: can update `parameters.ordering` and `parameters.fulfillment`, set `assignee` and `statusNotes`, and set the Order Template. Is the only Actor that can complete an Order and the only Actor that can move an Order to Querying. Can fail an Order that is Processing (but not one that is Querying). Can delete Draft and Quoted Orders. Read is scoped to Orders on Agreements where they are the Vendor. Sees purchase prices, not selling prices — see Section 5. |
| Operations | Suspend/Resume only | Yes | Yes | Yes | Creates and places Suspend and Resume Orders (which act on existing Subscriptions); cannot create the Client-facing Order types (Purchase, Change, Configuration, Termination). An Operations update to a Draft Order transitions it to Quoted (BR-007). Can fail an Order that is Processing, and is the only Actor that can fail an Order that is Querying. Cannot complete an Order and cannot move an Order to Querying. Can delete Draft and Quoted Orders. Read is not self-scoped — Operations sees all Orders platform-wide, and sees all price fields. |
| Client | Yes | Yes | Yes | Yes | Can create, update, quote, and place Orders. Can delete Draft and Quoted Orders only. Can update `parameters.ordering` during Draft and Querying only. Cannot complete, fail, or move an Order to Querying. Read is scoped to Orders belonging to their own Account. Sees selling prices, not purchase prices — see Section 5. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Draft | The Order has been created and saved but not yet placed. The Client can edit ordering parameters. The Order has not yet been submitted for fulfilment. | Yes | — |
| Quoted | The Order has been marked as ready for Client placement. Functionally equivalent to Draft except that no parameter values can be edited. Signals to the Client that the Order is ready to be placed. Draft → Quoted is a one-way transition. | Yes | — |
| Processing | The Order has been placed by the Client and is being fulfilled by the Vendor. The Vendor can update ordering and fulfilment parameters and transition the Order to Querying, Completed, or Failed. | Yes | — |
| Querying | The Order has been paused by the Vendor pending Client action — either correction of invalid parameter values or completion of an external task. The Client can update ordering parameters. The Order must return to Processing before it can be Completed. It can be Failed directly, but only by Operations. | — | — |
| Completed | The Order has been successfully fulfilled. All Lines have been mapped to a Subscription or Asset. Terminal state — no outbound transitions. | — | Yes |
| Failed | The Order could not be fulfilled. A `statusNotes` object is present explaining the reason for failure. A new Order must be created to retry. Terminal state — no outbound transitions. | — | Yes |
| Deleted | The Order has been soft-deleted — it moves to Deleted status and remains retrievable via the API including in standard list responses. Only reachable from Draft or Quoted. Terminal state — no outbound transitions. Deviates from Platform Invariant 7 — see Section 8. | — | Yes |

> An Order is persisted directly into Draft, Quoted, or Processing at creation (see T1–T3); no other initial status can be requested. An internal, transient pre-persistence status exists but is never surfaced through the API.

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Draft | Create Order | `POST` (base collection endpoint) | Client | Product must be Published. Listing must resolve for the Product and Licensee. Licensee must belong to the Client's Account. Parameter values must be valid. | Platform simultaneously creates a corresponding Draft Agreement for Purchase Orders. For Change, Configuration, and Termination Orders, the Order is created against an existing Active Agreement. |
| T2 | — | Quoted | Create Order as Quoted | `POST` (base collection endpoint) | Client | Same as T1. | Order created directly in Quoted status without passing through Draft. |
| T3 | — | Processing | Create and place Order | `POST` (base collection endpoint) | Client | Same as T1. | Order created and placed in a single API call without persisting as Draft or Quoted. Coupled Agreement/Subscription/Asset transitions are the same as T6. |
| T4 | Draft | Draft | Update Order | `PUT` (`/{id}`) | Client, Operations | Order must be in Draft. | Client can update `parameters.ordering`. Operations can update the Order. |
| T5 | Draft | Quoted | Quote Order (two mechanisms) | `/quote` (`POST`, Client) or `PUT` `/{id}` (Operations) | Client, Operations | Order must be in Draft. | Two mechanisms reach Quoted: (a) the Client's explicit `/quote` call — the `/quote` endpoint is Client-only, rejecting Operations and the Vendor; and (b) a side effect of any Operations update to a Draft Order (e.g. adjusting an Order Line margin). A Vendor cannot move an Order to Quoted by any path. No parameter edits are permitted after this transition; Draft → Quoted is one-way. |
| T6 | Draft | Processing | Place Order | `/process` (`POST`) | Client | Order must have at least one Line (Purchase, Change, Termination). Parameter values are validated. | Agreement → Provisioning (Purchase) or Updating (Change, Configuration, Termination). Affected pre-existing Subscriptions → Updating (Change), Terminating (Termination), Updating (Configuration). If ordering parameters are invalid, the Order is moved to Processing and then immediately to Querying rather than being rejected. |
| T7 | Draft | Deleted | Delete Order | `DELETE` (`/{id}`) | Client, Vendor, Operations | Order must be in Draft. | Soft-deleted — moves to Deleted status, remains retrievable via the API. For Purchase Orders, the corresponding Draft Agreement is also moved to Deleted status. |
| T8 | Quoted | Processing | Place Order | `/process` (`POST`) | Client | Same as T6. | Same coupled transitions and auto-query-on-invalid-parameters behaviour as T6. |
| T9 | Quoted | Deleted | Delete Order | `DELETE` (`/{id}`) | Client, Vendor, Operations | Order must be in Quoted. | Same soft-delete behaviour as T7. For Purchase Orders, corresponding Draft Agreement also → Deleted. |
| T10 | Processing | Completed | Complete Order | `/complete` (`POST`) | Vendor | Every Line must be mapped to a Subscription or Asset (Purchase, Change, Termination). Fulfilment parameters must be valid. | Completion is Vendor-only — the Client and Operations are rejected. Agreement → Active. Draft Subscriptions and Assets created during Processing → Active and linked to Agreement. For Termination Orders, terminated Subscriptions → Terminated; if all Subscriptions on the Agreement are Terminated, Agreement → Terminated. On completion of a Change or Termination Order, all other Draft and Quoted Orders on the Agreement → Deleted. |
| T11 | Processing | Failed | Fail Order | `/fail` (`POST`) | Vendor, Operations | `statusNotes` must contain a message. | The Client cannot fail an Order. Purchase: Agreement → Failed. Change, Configuration, Termination: Agreement → Active, Subscriptions and Assets reverted. |
| T12 | Processing | Querying | Move to Querying | `/query` (`POST`) | Vendor | Agreement must not be Deleted, Failed, or Terminated. | Moving an Order to Querying is Vendor-only — Operations and the Client are rejected. |
| T13 | Querying | Processing | Return to Processing | `/process` (`POST`) | Client, Vendor, Operations | Agreement must be in a status that permits processing. | Client typically updates `parameters.ordering` before returning. If the Client returns the Order while parameters are still invalid, the platform rejects the return and the Order remains in Querying. A Vendor returning the Order bypasses the parameter-validity gate. |
| T14 | Querying | Failed | Fail Order | `/fail` (`POST`) | Operations | `statusNotes` must contain a message. | Failing a Querying Order is Operations-only — the Vendor cannot fail an Order while it is Querying. Same Agreement effects as T11. |

### 3.3 State Diagram

```
— ---(Create Order : Client)---> [Draft]
— ---(Create Order as Quoted : Client)---> [Quoted]
— ---(Create and place Order : Client)---> [Processing]
[Draft] ---(Update Order : Client, Operations)---> [Draft]
[Draft] ---(Quote Order : Client)---> [Quoted]
[Draft] ---(Operations updates a Draft Order : Operations)---> [Quoted]
[Draft] ---(Place Order : Client)---> [Processing]
[Draft] ---(Delete Order : Client, Vendor, Operations)---> [Deleted]
[Quoted] ---(Place Order : Client)---> [Processing]
[Quoted] ---(Delete Order : Client, Vendor, Operations)---> [Deleted]
[Processing] ---(Complete Order : Vendor)---> [Completed]
[Processing] ---(Fail Order : Vendor, Operations)---> [Failed]
[Processing] ---(Move to Querying : Vendor)---> [Querying]
[Querying] ---(Return to Processing : Client, Vendor, Operations)---> [Processing]
[Querying] ---(Fail Order : Operations)---> [Failed]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An Order must be created within the scope of an [[Agreement]]. For Purchase Orders, the platform automatically creates a corresponding Draft [[Agreement]] at the same moment the Order is first persisted. For Change, Configuration, and Termination Orders, the Order is created against an existing Active [[Agreement]]. | All | Client | The [[Agreement]] and Purchase Order are co-created — neither can exist without the other at Draft. |
| BR-002 | Purchase, Change, Configuration, and Termination Orders are created and placed by the Client Actor (a [[User]] must be operating in a Client [[Account]]). Suspend and Resume Orders are created and placed by Operations. The Vendor cannot create or place an Order of any type. | All | Client, Operations | Applies to all creation paths: Draft, Quoted, and direct to Processing. Suspend/Resume creation is Operations-only (BR-037). |
| BR-003 | At the time of Order creation, the platform validates: (a) the [[Product]] must be Published; (b) the [[Listing]] must resolve for the [[Product]] and Licensee; (c) the Licensee must belong to the creating Client's [[Account]]; (d) all supplied [[Parameter]] values must be valid according to their definitions. | — (creation) | Client | The Licensee, its [[Buyer]], and the Client [[Account]] must all be in a permitted status. In PROD, the Licensee must be Active; in STAGING this constraint is relaxed — see Preamble Section 7.3. |
| BR-004 | [[Parameter]] values are re-validated on every save, not only at Order creation. | Draft, Querying | Client | Applies when the Client updates `parameters.ordering` values. |
| BR-005 | There can be only one Order in Processing status for a given [[Agreement]] at any time. | Processing | All | Enforced by the [[Agreement]] status: while an Order is Processing the [[Agreement]] is in Provisioning or Updating, which the platform will not accept a new placement against. |
| BR-006 | When a Change or Termination Order completes, all other Draft and Quoted Orders on the same [[Agreement]] are automatically moved to Deleted status. This does not occur at placement, and does not occur on completion of a Purchase or Configuration Order. | Processing | Vendor | Executed under the completing Vendor's token context. A Purchase Order has no competing Orders because its [[Agreement]] is co-created. |
| BR-007 | An Order reaches Quoted status two ways: the Client explicitly quotes a Draft Order via the `/quote` endpoint, or the platform sets a Draft Order to Quoted as a side effect of any Operations update to that Order. An Order can also be created directly in Quoted status by the Client. | Draft | Client, Operations | The `/quote` endpoint is Client-only (Operations and the Vendor are rejected there); Operations instead reaches Quoted by updating a Draft Order — for example adjusting an [[Order Line]] margin. A Vendor cannot move an Order to Quoted by any path. No material difference between Draft and Quoted except that parameter values cannot be edited in Quoted. Draft → Quoted is one-way. |
| BR-008 | During Draft status, only the Client Actor can write to `parameters.ordering`. No Actor can write to `parameters.fulfillment`. | Draft | Client | A User must be operating in a Client [[Account]] context to update ordering parameters. |
| BR-009 | During Quoted status, no Actor can write to either `parameters.ordering` or `parameters.fulfillment`. | Quoted | All | Quoted is effectively a read-only snapshot of the Order as presented to the Client. |
| BR-010 | During Processing status, only the Vendor Actor can write to `parameters.ordering` and `parameters.fulfillment`. | Processing | Vendor | See ORD-004: whether Operations can write to parameters during Processing without switching [[Account]] context is unconfirmed. |
| BR-011 | During Querying status, only the Client Actor can write to `parameters.ordering`. No Actor can write to `parameters.fulfillment`. | Querying | Client | See ORD-004: whether Operations can write to ordering parameters during Querying without switching [[Account]] context is unconfirmed. |
| BR-012 | Parameters with `hidden=true` are suppressed from API responses for the Client Actor. Hidden parameters are readable by Vendor and Operations in all statuses. | All | Client | `hidden` is an API-level read suppression, not merely a UI display hint. |
| BR-012a | Order parameters carry a `scope` field that determines their lifecycle. [[Agreement]]-scoped parameters (`scope: "Agreement"`) on a Purchase Order are carried over to the [[Agreement]] on Order completion and persist on the [[Agreement]] independently of any individual Order. Order-scoped parameters (`scope: "Order"`) exist only on the Order and are never carried over. Purchase Orders may carry both [[Agreement]]-scoped and Order-scoped parameters. Change, Configuration, and Termination Orders may only carry Order-scoped parameters. | All | All | See Commerce: [[Agreement]] canon BR-010 and BR-011 for how [[Agreement]]-scoped parameters behave on the [[Agreement]] after carry-over. |
| BR-013 | An Order in Processing status can be moved to Querying status by the Vendor only — Operations and the Client cannot move an Order to Querying. The Order must return to Processing before it can be Completed. | Processing | Vendor | The Querying state is a communication mechanism between the Vendor and the Client. |
| BR-014 | When an Order is in Querying status, the Client should be directed to either correct invalid parameter values or complete an external task before the Order can proceed. It is good practice for the Vendor to set the Order [[Template]] to one that contains clear instructions for the Client. | Querying | Vendor | See Catalog: [[Template]] canon for [[Template]] types. |
| BR-015 | Only Draft and Quoted Orders can be deleted. Deletion moves the Order to Deleted status — it is not permanently removed and remains retrievable via the API including in standard list responses. | Draft, Quoted | Client, Vendor, Operations | Deviates from Platform Invariant 7. Deleted Orders remain visible in standard list responses. |
| BR-016 | When a Draft or Quoted Purchase Order is deleted, the platform automatically moves the corresponding Draft [[Agreement]] to Deleted status. When a Draft or Quoted Change, Configuration, or Termination Order is deleted, the [[Agreement]] is unaffected and remains Active. | Draft, Quoted | Client, Vendor, Operations | Executed for Purchase Orders under the deleting Actor's token context. |
| BR-017 | Failed is a terminal status. A Failed Order cannot be retried or reactivated. A new Order must be created to retry the intended change. | Failed | All | — |
| BR-018 | An Order cannot be moved to Failed unless `statusNotes` contains a message explaining the failure. | Processing, Querying | Vendor, Operations | `statusNotes` is a structured object with an error code (`id`) and a human-readable `message`; the `message` is required for the transition to succeed. |
| BR-019 | For Purchase Orders: when the Order transitions to Processing, the [[Agreement]] transitions to Provisioning. When the Order completes, the [[Agreement]] transitions to Active and all Draft [[Subscription]]s and [[Asset]]s created during Processing transition to Active. When the Order fails, the [[Agreement]] transitions to Failed. | Processing | Vendor | — |
| BR-020 | For Change Orders: when the Order transitions to Processing, the [[Agreement]] transitions to Updating and all affected pre-existing [[Subscription]]s transition to Updating. When the Order completes, the [[Agreement]] and affected [[Subscription]]s return to Active. When the Order fails, the [[Agreement]] and all [[Subscription]]s return to Active. | Processing | Vendor | New [[Subscription]]s and [[Asset]]s created during Processing of a Change Order follow the same Draft → Active pattern as Purchase Orders. |
| BR-021 | For Configuration and Termination Orders: when the Order transitions to Processing, the [[Agreement]] transitions to Updating. When the Order fails, the [[Agreement]] returns to Active with all [[Subscription]]s and [[Asset]]s unchanged. | Processing | Vendor | — |
| BR-022 | For Termination Orders: when the Order transitions to Processing, the targeted [[Subscription]]s transition to Terminating; when the Order completes, they transition to Terminated. If all [[Subscription]]s on the [[Agreement]] are Terminated as a result, the [[Agreement]] also transitions to Terminated. [[Asset]]s cannot be terminated and are unaffected. | Processing | Vendor | [[Agreement]] termination is triggered by the state of its [[Subscription]]s, not directly by the Order. An [[Agreement]] with other non-terminated [[Subscription]]s remains Active. |
| BR-023 | Configuration Orders operate on the properties of one or more existing [[Subscription]]s rather than creating, terminating, or changing the quantity of any [[Subscription]]. A Configuration Order must target at least one [[Subscription]] and carries a Line for each targeted [[Subscription]] with `oldQuantity` equal to `quantity` (no quantity delta). The Vendor completes a Configuration Order at their discretion. | Processing | Vendor | Configuration Orders are most commonly used to toggle auto-renewal on [[Subscription]]s, and can serve other Vendor-defined purposes when the [[Product]] enables custom Configuration Orders. The targeted [[Subscription]] transitions to Updating during Processing and returns to Active on completion. |
| BR-024 | Every Line in a Purchase, Change, or Termination Order must be mapped to a [[Subscription]] or [[Asset]] before the Order can be moved to Completed. Draft [[Subscription]]s and [[Asset]]s are created by the Vendor during Processing and linked to the Order. On completion, they are linked to the [[Agreement]] and transitioned to Active. | Processing | Vendor | Each [[Subscription]] or [[Asset]] may carry one or more Lines. The billing model of the [[Product]] [[Item]] on the Line determines whether it maps to a [[Subscription]] (recurring) or an [[Asset]] (one-time). Configuration [[Order Line]]s already reference an existing [[Subscription]] and require no further mapping. |
| BR-025 | The `assignee` field may be set by the Vendor to indicate the User or [[API Token]] responsible for processing the Order. It is optional and has no material effect on Order processing or state transitions. | Processing | Vendor | — |
| BR-026 | Orders have three external identifier fields: `externalIds.vendor` (Vendor's own order reference), `externalIds.operations` (ERP reference), and `externalIds.client` (Client reference such as a purchase order number). All are optional. | All | All | — |
| BR-027 | A Client must hold a valid Certificate for the Program assigned to a [[Product]] in order to place an Order for that [[Product]]. If no Program is assigned to the [[Product]], no Certificate is required. | — (creation) | Client | Programs and Certificates are not yet canonised. |
| BR-028 | The platform supports Vendor-defined pre-validation of Orders via a `/validate` endpoint. Pre-validation is enabled per Order type via boolean settings on the [[Product]]. | Draft, Querying | Vendor | Confirmed settings: `settings.preValidation.purchaseOrderDraft`, `changeOrderDraft`, `configurationOrderDraft`, `terminationOrder`, and `purchaseOrderQuerying`. See Catalog: [[Product]] canon for [[Product]] settings. |
| BR-029 | When `/validate` is called on an Order and the corresponding `preValidation` setting is `true`, the platform first persists the Order, then fires the corresponding [[Webhook]] to the Vendor. The Vendor may validate and optionally modify the Order — for example adjusting per-unit purchase price on Lines. The modified Order is persisted again and returned as the response. If the setting is `false`, `/validate` returns the unaltered Order body. The endpoint may be called multiple times on the same Order. | Draft, Querying | Vendor | Modifications made by the Vendor during pre-validation are visible in the `/validate` response. |
| BR-030 | Modifications made by the Vendor during pre-validation are subject to the same Actor-based write rules as direct API writes — for example, a Vendor token cannot modify `markup` or `margin`. | Draft, Querying | Vendor | Consistent with Preamble Section 6.3 — Actor-based field suppression applies to Vendor tokens whether operated by a human or an integration. |
| BR-031 | If the Vendor returns a validation failure, the failure is communicated to the caller in the `/validate` response with a 400 status and the Vendor-provided error message. The Order remains in its current status. | Draft, Querying | Vendor | The platform passes the Vendor's error response through to the caller unchanged. |
| BR-032 | Webhooks used for pre-validation are reverse proxied by the platform. If the platform cannot reach the Vendor, the `/validate` endpoint returns 200 OK with the unaltered Order body. No error is surfaced to the caller. | Draft, Querying | Vendor | A known failure mode — see Section 9. Vendors are expected to handle Orders that could not be validated at Draft during the Processing phase, including failing them if necessary. |
| BR-033 | The `settings.preValidation.purchaseOrderQuerying` setting applies specifically to Purchase Orders in Querying status. When `/validate` is called on a Purchase Order in Querying status and this setting is `true`, the corresponding Purchase-Order-Querying validation [[Webhook]] is fired. | Querying | Vendor | Only applicable to Purchase Orders in Querying status — not to other Order types in Querying status. |
| BR-034 | Only the Vendor can complete an Order. The Client and Operations are both rejected by the `/complete` endpoint. | Processing | Vendor | — |
| BR-035 | An Order can be created directly in Draft, Quoted, or Processing status. No other initial status can be requested at creation, and status is thereafter changed only via the dedicated transition endpoints, never by a direct field write. | — (creation) | Client | — |
| BR-036 | When a Client places an Order (Draft or Quoted → Processing) whose `parameters.ordering` values are invalid, the platform moves the Order to Processing and then immediately to Querying rather than rejecting the placement. | Draft, Quoted | Client | The Client must correct the parameters and return the Order to Processing before fulfilment can proceed. |
| BR-037 | Suspend and Resume Orders are created and placed by Operations and act on one or more existing [[Subscription]]s. Placing a Suspend Order moves its targeted [[Subscription]]s to Suspending and, on completion, to Suspended; placing a Resume Order moves them to Resuming and, on completion, back to Active. | All | Operations | Availability is gated by the [[Product]]'s Suspend/Resume setting. See Commerce: [[Subscription]] for the Subscription-side suspend/resume states. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | String | Unique platform identifier for the Order. | Platform | No | Format: ORD-XXXX-XXXX-XXXX. |
| `revision` | Integer | Increments each time the Order is updated. | Platform | Yes — platform-managed | — |
| `type` | Enum | The type of Order. Valid values: `Purchase`, `Change`, `Configuration`, `Termination`, `Suspend`, `Resume`. | Client (Purchase/Change/Configuration/Termination) or Operations (Suspend/Resume), at creation | No | Immutable after creation. Determines the semantics of the Order and its coupled state transitions. |
| `status` | Enum | The current status of the Order. Valid values: `Draft`, `Quoted`, `Processing`, `Querying`, `Completed`, `Failed`, `Deleted`. | Platform | Yes | Set at creation to one of `Draft`, `Quoted`, or `Processing` (see BR-035); thereafter changed only via the dedicated transition endpoints. |
| `notes` | String | Free-text notes field. Used operationally to record context about the Order — e.g. requester name, case reference. | Client, Operations | Yes | Optional. Visible to all Actors. |
| `statusNotes` | Object | Structured error information required when an Order is failed. Contains `id` (error code) and `message` (human-readable explanation). | Vendor, Operations | Yes — on Fail transition | A non-empty `message` is required to fail an Order (see BR-018). Only present on Failed Orders. Absent from response when null. |
| `assignee` | Object | Reference to the User or API Token responsible for processing the Order. | Vendor | Yes | Optional. Has no material effect on Order processing or state transitions. Absent from response when null. |
| `externalIds.vendor` | String | Vendor's own order reference. | Vendor | Yes | Optional. |
| `externalIds.operations` | String | ERP reference for the Order. | Operations | Yes | Optional. |
| `externalIds.client` | String | Client reference — e.g. a purchase order number. | Client | Yes | Optional. |
| `price` | Object | Aggregate pricing for the Order across all Lines. Contains `SPxY`, `SPxM`, `SPx1` (selling price per year/month/one-time), `PPxY`, `PPxM`, `PPx1` (purchase price per year/month/one-time), `currency`, `markup`, `margin`, `defaultMarkup`, and `defaultMarkupSource`. | Platform | No | `PPxY`, `PPxM`, `PPx1` (purchase prices) are suppressed for the Client. `SPxY`, `SPxM`, `SPx1` (selling prices) are suppressed for the Vendor. `markup`, `margin`, `defaultMarkup`, and `defaultMarkupSource` are suppressed for both Vendor and Client. All fields are visible to Operations. Present on all Order types including Configuration and Termination Orders; Termination Order prices carry negative values reflecting the reduction in committed spend. |
| `lines` | Array | The Order Lines — one entry per SKU at one quantity. Each Line references an Item, carries its own price object, and maps to a Subscription or Asset. | Client, Vendor | Yes | Child objects with ID prefix ALI. Present on all Order types, including Configuration Orders (where each Line references the Subscription being configured with `oldQuantity` equal to `quantity`). |
| `subscriptions` | Array | References to Subscriptions associated with this Order. For Purchase and Change Orders, populated during Processing as Draft Subscriptions are created. For Configuration Orders, references the Subscriptions being configured. For Termination Orders, references the Subscriptions being terminated. | Platform, Client (Configuration/Termination targets at creation) | Yes | Summary references only — not full Subscription objects. |
| `assets` | Array | References to Assets associated with this Order. Populated during Processing for Purchase and Change Orders where one-time purchase Items are present. | Platform | No | Summary references only. |
| `parameters.ordering` | Array | Ordering phase parameters — data collected from the Client to support Order placement and fulfilment. Each entry includes `id`, `name`, `type`, `phase`, `scope`, `multiple`, `constraints`, `value`, and `displayValue`. | Client (Draft, Querying), Vendor (Processing) | Yes | Per BR-008 through BR-011. Parameters with `hidden=true` are suppressed from Client API responses (BR-012). |
| `parameters.fulfillment` | Array | Fulfilment phase parameters — data written by the Vendor during Processing to record fulfilment state. | Vendor (Processing only) | Yes | Parameters with `hidden=true` are suppressed from Client API responses. Not writable by the Client in any status. |
| `template` | Object | Reference to the Catalog: Template assigned to this Order. Determines the rendered content shown to the Client at each Order status. | Vendor | Yes | A Template is required for an Order to move to Processing, Querying, Completed, or Quoted. The Vendor typically sets or updates the Template during Processing and Querying to provide contextually relevant instructions to the Client. |
| `listing` | Object | Reference to the Catalog: Listing under which this Order was placed. | Client (at creation) | No | Immutable after creation. |
| `authorization` | Object | Reference to the Catalog: Authorization associated with the Listing. | Platform | No | Derived from the Listing at creation. Immutable after creation. |
| `agreement` | Object | Reference to the Commerce: Agreement this Order belongs to. | Platform | No | Immutable after creation. For Purchase Orders, the Agreement is co-created with the Order. |
| `product` | Object | Reference to the Catalog: Product being ordered. | Platform | No | Derived from the Listing at creation. Immutable after creation. |
| `client` | Object | Reference to the Accounts: Account of the Client placing the Order. | Platform | No | Derived from the Actor context at creation. Immutable after creation. |
| `licensee` | Object | Reference to the Accounts: Licensee on whose behalf the Order is placed. | Client (at creation) | No | Immutable after creation. Must belong to the creating Client's Account (see BR-003). |
| `buyer` | Object | Reference to the Accounts: Buyer associated with the Licensee. | Platform | No | Derived from the Licensee at creation. Immutable after creation. |
| `seller` | Object | Reference to the Accounts: Seller associated with the Listing. | Platform | No | Derived from the Listing at creation. Immutable after creation. |
| `vendor` | Object | Reference to the Accounts: Account of the Vendor. | Platform | No | Derived from the Listing at creation. Immutable after creation. |
| `termsAndConditions` | Array | Terms and Conditions accepted by the Client at Order placement. Each entry references a Catalog: Terms object and records the acceptance timestamp and accepting User. | Client (at placement) | No | Captured at the point the Order is placed. Empty array if no Terms are required for the Product. |
| `certificates` | Array | Certificates held by the Client that qualify them to place this Order. | Client (Purchase/Change) | No | Only set on Purchase and Change Orders, and only while the Order is New, Draft, Quoted, or Processing. See ORD-007. Always empty in observed samples where no Program is assigned to the Product. |
| `audit` | Object | Audit timestamps and Actor references for key Order lifecycle events. Contains `created`, `updated`, and state-specific entries: `processing`, `querying`, `completed`, `failed`, `quoted`, `deleted`. | Platform | No | Omitted by default — request via `select=+audit`. State-specific audit entries are only present if the Order has reached that state. |
| References | group | Group of immutable reference fields set at Order creation: listing, authorization, agreement, product, client, licensee, buyer, seller, vendor. All derived from the Listing or Actor context. | Platform | No | — |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Commerce: Agreement | Parent | Many Orders to one Agreement | Every Order exists within the scope of an Agreement. For Purchase Orders, the Agreement is co-created with the Order at Draft. For all other Order types, the Order is created against an existing Active Agreement. | If a Draft or Quoted Purchase Order is deleted, the platform automatically moves the corresponding Draft Agreement to Deleted. Deletion of a Draft or Quoted Change, Configuration, or Termination Order has no effect on the Agreement. |
| Commerce: Order Line | Child | One Order to many Lines | Lines are the unit of work within an Order — one Line per SKU at one quantity. For Purchase, Change, and Termination Orders each Line must be mapped to a Subscription or Asset before the Order can complete. Configuration Orders also carry Lines, each referencing the Subscription being configured with no quantity change. | Lines are created within the scope of the Order. |
| Commerce: Order Subscription | Child | One Order to many Order Subscriptions | Subscription records associated with this Order. For Purchase and Change Orders, Draft Order Subscriptions are created during Processing and promoted to Agreement Subscriptions on completion. For Configuration and Termination Orders, references the existing Subscriptions being configured or terminated. | Created within the scope of the Order. |
| Commerce: Order Asset | Child | One Order to many Order Assets | Asset records associated with this Order, created during Processing for Purchase and Change Orders where one-time purchase Items are present. | Created within the scope of the Order. |
| Commerce: Subscription | Association | One Order to many Subscriptions | The Agreement Subscriptions an Order affects or produces. Order completion drives their state transitions. | Order completion drives Subscription state transitions — see BR-019 through BR-023. If all Subscriptions on an Agreement are Terminated, the Agreement also transitions to Terminated. |
| Commerce: Asset | Association | One Order to many Assets | The Agreement Assets an Order produces. Assets cannot be terminated. | Order completion drives Asset state transitions — see BR-019 and BR-020. Assets are unaffected by Termination Orders and by Agreement termination. |
| Commerce: Agreement Attachment | Association | One Order to many Attachments (optional) | Files or License Key text attached to the Order by the Agreement's Vendor or Operations. These belong to the shared Commerce: Agreement Attachment collection and reference this Order via their `orderId`. There is no Order attachments endpoint; they are created and retrieved through the parent Agreement's `/attachments` endpoint. Attachment creation and deletion are not gated by Order status. | No cascade. The `orderId` is a plain reference — the Order and its attachments are deleted independently. See Commerce: Agreement Attachment canon. |
| Catalog: Listing | Association | Many Orders to one Listing | The Listing under which the Order was placed. Determines the Seller, Price List, and Authorization applicable to the Order. | Immutable after Order creation. The Listing must resolve for the Product and Licensee at the time of Order creation. |
| Catalog: Authorization | Association | Many Orders to one Authorization | The Authorization associated with the Listing. Determines the currency and billing context for the Order. | Derived from the Listing at creation. Immutable after Order creation. |
| Catalog: Product | Association | Many Orders to one Product | The Product being ordered. Must be Published at Order creation. Derived from the Listing. | Immutable after Order creation. If the Product has a Program assigned, the Client must hold a valid Certificate to place an Order. |
| Catalog: Template | Association | Many Orders to one Template | The Template determining the rendered content shown to the Client at each Order status. The Vendor typically updates the Template during Processing and Querying to provide contextually relevant instructions. | An Order requires a Template to move to Processing, Querying, Completed, or Quoted. See Catalog: Template canon. |
| Accounts: Account (Client) | Association | Many Orders to one Client Account | The Client Account on whose behalf the Order is placed. Derived from the Actor context at creation. | Immutable after Order creation. |
| Accounts: Licensee | Association | Many Orders to one Licensee | The Licensee on whose behalf the Order is placed. Must belong to the creating Client's Account at Order creation. | Immutable after Order creation. |
| Accounts: Buyer | Association | Many Orders to one Buyer | The Buyer associated with the Licensee. Derived from the Licensee at creation. | Immutable after Order creation. |
| Accounts: Seller | Association | Many Orders to one Seller | The Seller associated with the Listing. Derived from the Listing at creation. | Immutable after Order creation. |
| Accounts: Account (Vendor) | Association | Many Orders to one Vendor Account | The Vendor Account for the Product being ordered. Derived from the Listing at creation. | Immutable after Order creation. |
| Catalog: Terms | Association | One Order to many Terms | Terms and Conditions accepted by the Client at Order placement. Acceptance is recorded on the Order with timestamp and accepting User. | Captured at placement. No lifecycle dependency after acceptance is recorded. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Order validated | Client calls `/validate` on a Draft or Querying Order | Client | Platform persists the Order, fires the corresponding pre-validation [[Webhook]] to the Vendor if enabled, and returns the validated (and optionally modified) Order body. No state transition occurs. |
| Order quoted | Client calls `/quote` on a Draft Order | Client | Order transitions to Quoted. A User must be operating in a Client [[Account]] context; Operations and the Vendor are rejected. |
| Order returned to Client | Vendor calls `/query` on a Processing Order | Vendor | Order transitions to Querying. Operations and the Client cannot perform this action. |
| Parameter values updated | Client updates `parameters.ordering` on a Draft or Querying Order | Client | Platform re-validates parameter values on save. Invalid values are rejected. |
| Parameter values updated | Vendor updates `parameters.ordering` or `parameters.fulfillment` on a Processing Order | Vendor | No state transition occurs. Changes are persisted immediately. |
| Assignee set | Vendor sets `assignee` on a Processing Order | Vendor | No material effect on Order processing. Persisted as a reference field only. |
| Order template rendered | Any permitted Actor requests `/template` or `/render` on an Order | Vendor, Operations, Client | Returns the rendered Markdown of the Order's [[Template]] for the requested language. No state transition occurs. |
| Order notification sent | Client or Operations calls `/notify` on an Order | Client, Operations | Sends an Order notification to the specified User. The Vendor cannot send Order notifications. No state transition occurs. |
| Attachment added | The [[Agreement]]'s Vendor or Operations uploads a file or records a License Key, optionally against this Order | Vendor, Operations | The attachment is persisted on the parent [[Agreement]]'s shared attachment collection and associated with this Order via `orderId`. No state transition occurs. See Commerce: [[Agreement Attachment]] canon. |
| Attachment deleted | The [[Agreement]]'s Vendor or Operations deletes an attachment | Vendor, Operations | The attachment is permanently removed — no longer retrievable via the API. No state transition occurs. |
| Template updated | Vendor updates the [[Template]] on a Processing or Querying Order | Vendor | The rendered content shown to the Client updates immediately. No state transition occurs. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Purchase Order created (Draft or direct to Processing) | Commerce: Agreement | Agreement co-created in Draft status | Yes — platform, under Client token context | Order type is Purchase | Agreement and Order are created simultaneously. |
| Any Order placed (→ Processing) | Commerce: Agreement | Agreement → Provisioning | Yes — platform, under Client token context | Order type is Purchase | — |
| Any Order placed (→ Processing) | Commerce: Agreement | Agreement → Updating | Yes — platform, under Client token context | Order type is Change, Configuration, or Termination | — |
| Change Order placed (→ Processing) | Commerce: Subscription | Affected pre-existing [[Subscription]]s → Updating | Yes — platform, under Client token context | Order type is Change; Subscriptions must be pre-existing | Newly created Draft Subscriptions do not exist yet at placement. |
| Configuration Order placed (→ Processing) | Commerce: Subscription | Targeted [[Subscription]]s → Updating | Yes — platform, under Client token context | Order type is Configuration | Subscriptions return to Active on completion. |
| Termination Order placed (→ Processing) | Commerce: Subscription | Targeted [[Subscription]]s → Terminating | Yes — platform, under Client token context | Order type is Termination | Subscriptions become Terminated on completion. |
| Suspend or Resume Order placed (→ Processing) | Commerce: Agreement | Agreement → Updating | Yes — platform, under Operations token context | Order type is Suspend or Resume | Agreement returns to Active on completion. |
| Suspend Order placed (→ Processing) | Commerce: Subscription | Targeted [[Subscription]]s → Suspending | Yes — platform, under Operations token context | Order type is Suspend | Become Suspended on completion. |
| Resume Order placed (→ Processing) | Commerce: Subscription | Targeted [[Subscription]]s → Resuming | Yes — platform, under Operations token context | Order type is Resume | Return to Active on completion. |
| Purchase or Change Order Processing | Commerce: Subscription | Draft [[Subscription]]s created under the Order | Yes — Vendor, under Vendor token context | Vendor creates Draft Subscriptions during Processing | One or more Draft Subscriptions may be created per Order. |
| Purchase or Change Order Processing | Commerce: Asset | Draft [[Asset]]s created under the Order | Yes — Vendor, under Vendor token context | Vendor creates Draft Assets during Processing where one-time purchase Items are present | One or more Draft Assets may be created per Order. |
| Purchase or Change Order completed (→ Completed) | Commerce: Agreement | Agreement → Active | Yes — platform, under Vendor token context | Order type is Purchase or Change | — |
| Purchase or Change Order completed (→ Completed) | Commerce: Subscription | Draft [[Subscription]]s → Active, linked to Agreement | Yes — platform, under Vendor token context | All Lines must be mapped to a Subscription or Asset | — |
| Purchase or Change Order completed (→ Completed) | Commerce: Asset | Draft [[Asset]]s → Active, linked to Agreement | Yes — platform, under Vendor token context | All Lines must be mapped to a Subscription or Asset | — |
| Configuration Order completed (→ Completed) | Commerce: Subscription | Targeted [[Subscription]]s → Active | Yes — platform, under Vendor token context | Order type is Configuration | Subscription property changes (e.g. auto-renewal) are applied. |
| Termination Order completed (→ Completed) | Commerce: Subscription | Terminated [[Subscription]]s → Terminated | Yes — platform, under Vendor token context | Order type is Termination | — |
| Suspend Order completed (→ Completed) | Commerce: Subscription | Targeted [[Subscription]]s → Suspended | Yes — platform | Order type is Suspend | — |
| Resume Order completed (→ Completed) | Commerce: Subscription | Targeted [[Subscription]]s → Active | Yes — platform | Order type is Resume | — |
| Termination Order completed (→ Completed) | Commerce: Agreement | Agreement → Terminated | Yes — platform, under Vendor token context | All Subscriptions on the Agreement are Terminated | Only triggered if all Subscriptions are Terminated as a result of this Order; otherwise the Agreement remains Active. |
| Purchase Order completed (→ Completed) | Commerce: Agreement `parameters` | Agreement-scoped parameters from Purchase Order carried over to Agreement | Yes — platform, under Vendor token context | Order type is Purchase; Order transitions to Completed | Order-scoped parameters are not carried over. |
| Change or Termination Order completed (→ Completed) | Commerce: Order | Competing Draft and Quoted Orders on the Agreement → Deleted | Yes — platform, under completing Vendor's token context | Order type is Change or Termination | Does not occur on Purchase or Configuration Order completion, nor at placement. |
| Purchase Order failed (→ Failed) | Commerce: Agreement | Agreement → Failed | Yes — platform, under Vendor or Operations token context | Order type is Purchase | — |
| Change, Configuration, or Termination Order failed (→ Failed) | Commerce: Agreement | Agreement → Active | Yes — platform, under Vendor or Operations token context | Order type is Change, Configuration, or Termination | Agreement reverts to Active. Subscriptions and Assets revert to their pre-Order state. |
| Draft or Quoted Purchase Order deleted (→ Deleted) | Commerce: Agreement | Agreement → Deleted | Yes — platform, under deleting Actor's token context | Order type is Purchase; Order must be in Draft or Quoted | Soft-deleted — Agreement remains retrievable via the API. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Processing → Querying → Processing is reversible with no limit on cycles. The Vendor may move an Order into Querying and it may be returned to Processing as many times as needed until the Order is Completed or Failed.

All other transitions are irreversible. Draft → Quoted is a one-way transition. Completed, Failed, and Deleted are terminal states with no outbound transitions.

**Deletion:**
Orders use a soft-delete model. Deleting an Order moves it to Deleted status — it is not permanently removed and remains retrievable via the API including in standard list responses. Only Orders in Draft or Quoted status can be deleted. This behaviour deviates from Platform Invariant 7 — see `PLATFORM_CANON_PREAMBLE.md`.

For Purchase Orders, deletion of a Draft or Quoted Order also moves the corresponding Draft [[Agreement]] to Deleted status under the same soft-delete model.

Separately, when a Change or Termination Order completes, all remaining Draft and Quoted Orders on the same [[Agreement]] are moved to Deleted. This is a completion side effect, not a deletion the Client requested (see BR-006).

**Audit & history requirements:**
The Order audit block captures timestamps and Actor references for key lifecycle events. In addition to the standard `created` and `updated` entries, the audit block includes state-specific entries populated as the Order progresses: `processing`, `querying`, `completed`, `failed`, `quoted`, and `deleted`. State-specific audit entries are only present if the Order has reached that state. The audit block is omitted from API responses by default — request via `select=+audit`.

Audit Records are generated for all Order state transitions. Prior versions of parameter values are not retained beyond the audit trail. If parameter value history is required, it must be reconstructed from Audit Records.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Pre-validation Webhook unreachable at Draft | The `/validate` endpoint returns 200 OK with the unaltered Order body. No error is surfaced to the caller. The Order proceeds as if validation passed. | Client, Vendor | High | The Vendor is expected to handle invalid Orders during Processing, including failing them if necessary. See BR-032. |
| Pre-validation Webhook unreachable at Querying | Same behaviour as Draft — `/validate` returns 200 OK with the unaltered Order body. A Querying Order with unvalidated parameters may be returned to Processing and subsequently fail during fulfilment. | Client, Vendor | High | Same mitigation applies. |
| Order placed with invalid ordering parameters | The platform does not reject the placement. The Order is moved to Processing and then immediately to Querying, and the Client must correct the parameters before it can proceed. | Client | Medium | See BR-036. A Client may be surprised to find a placed Order sitting in Querying. |
| Change or Termination Order completes with competing Draft/Quoted Orders on the same Agreement | All competing Draft and Quoted Orders on the [[Agreement]] are automatically moved to Deleted status. Clients who had prepared those Orders are not notified. | Client | Medium | See BR-006. This occurs at completion, not at placement, and not for Purchase or Configuration Orders. |
| Purchase Order fails after Agreement reaches Provisioning | The Order moves to Failed and the [[Agreement]] moves to Failed. The Client cannot transact against a Failed [[Agreement]]. A new Purchase Order must be created to retry — the platform will co-create a new [[Agreement]] automatically. | Client | High | See Commerce: [[Agreement]] canon for the semantics of a Failed [[Agreement]]. |
| Change, Configuration, or Termination Order fails | The [[Agreement]] reverts to Active with all [[Subscription]]s and [[Asset]]s restored to their pre-Order state. The failed Order remains visible in the API in Failed status. A new Order must be created to retry. | Client, Vendor | Medium | No data loss — the [[Agreement]] and its [[Subscription]]s and [[Asset]]s are restored. |
| Attempt to fail an Order without status notes | The platform rejects the transition — an Order cannot be moved to Failed unless `statusNotes` carries a message. | Vendor, Operations | Low | Platform-enforced — see BR-018. |
| Attempt to fail a Querying Order as the Vendor | The platform rejects the transition. Only Operations can fail an Order that is Querying; the Vendor must first return it to Processing. | Vendor | Low | See T14. |
| Order remains in Querying status indefinitely | The platform does not enforce a timeout on Querying status. If neither the Client nor the Vendor acts, the Order remains in Querying indefinitely, and the [[Agreement]] remains in Updating or Provisioning for the duration, which may block other operations against that [[Agreement]]. | Client, Vendor, Operations | High | Vendor or Operations should monitor Querying Orders and either return them to Processing or fail them. |
| Client places Order against a Licensee that does not belong to their Account | The platform rejects the Order at creation. The Order is not persisted. | Client | Low | Platform-enforced — see BR-003. |
| Client attempts to place Order without a required Certificate | The platform rejects the Order at creation. The Client must obtain the required Certificate before placing the Order. | Client | Medium | Programs and Certificates are not yet canonised. |
| Multiple Orders placed rapidly against the same Agreement | The platform permits only one Processing Order per [[Agreement]] — a second Order cannot be placed while the [[Agreement]] is Provisioning or Updating. A race condition may exist if two Orders are submitted simultaneously before either reaches Processing. | Client | Medium | See BR-005. See ORD-005. |
| Draft Subscriptions or Assets created during Processing not mapped before completion attempted | The platform prevents Order completion if any Line remains unmapped to a [[Subscription]] or [[Asset]]. The Vendor must map all Lines before the Order can be Completed. | Vendor | Low | Platform-enforced — see BR-024. Not applicable to Configuration Orders, whose Lines already reference an existing [[Subscription]]. |
| Agreement remains in Updating or Provisioning status due to a long-running Order | While an [[Agreement]] is in Updating or Provisioning status, other operations against that [[Agreement]] may be blocked. If a Processing or Querying Order is abandoned, the [[Agreement]] may remain in a non-Active status indefinitely. | Client, Operations | High | There are no platform-level safeguards against this. Operations should monitor long-running Orders and intervene. |

---

## 10. Open Questions

- [ ] **ORD-004:** During Processing and Querying status, can Operations write to `parameters.ordering` and/or `parameters.fulfillment` directly, or must they switch to a Client or Vendor Account to do so?
- [ ] **ORD-005:** Whether the platform handles simultaneous Order placement attempts against the same Agreement atomically — preventing a race where two Orders both reach Processing — is not confirmed.
- [ ] **ORD-006:** Split Billing is enabled at the Agreement level and has implications for Order behaviour. This canon requires updating once Split Billing behaviour on Orders is fully canonised.
- [ ] **ORD-007:** The `certificates` array on the Order is always empty in observed samples where no Program is assigned to the Product. The full structure of a populated `certificates` entry and its Actor-based read behaviour are not confirmed. Programs and Certificates are not yet canonised.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.5 | 2026-07-19 | Stu / canon-maintenance | Wikilinked the now-canonised `[[User]]` and `[[API Token]]` (BR-002, BR-025) and dropped the stale "pending canonisation" qualifiers on the Order Line / Order Subscription / Order Asset references (Sections 5 and 6) now that those objects are canonised. No behavioural change. |
| 0.4 | 2026-07-17 | Stu / canon-generate | Evidence-based refresh against live STAGING samples (all four Order types across Draft/Quoted/Processing/Completed) and source research. Filled every Section 3.2 Endpoint/Verb (create `POST` base, `/quote`, `/process`, `/complete`, `/query`, `/fail`, `DELETE`/`PUT` `/{id}`). Corrected `price` Actor suppression: purchase prices (`PPx*`) are suppressed for the Client and selling prices (`SPx*`) for the Vendor, with `markup`/`margin`/`defaultMarkup`/`defaultMarkupSource` suppressed for both — the prior "PP suppressed for both Vendor and Client" was wrong. Corrected the Configuration Order model: Configuration Orders DO carry a Line (one per targeted Subscription, `oldQuantity` = `quantity`) and a `price` object — removed the "not present on Configuration Orders" claims from BR-023/BR-024/Section 5/Section 6. Corrected BR-006: competing Draft/Quoted Orders are deleted on completion of a Change or Termination Order, not at placement, and not for Purchase/Configuration. Corrected BR-018: `statusNotes` with a message is required to fail an Order (not optional). Resolved ORD-001 (moving to Querying is Vendor-only; Operations cannot), ORD-002 (a Querying Order can be failed, but only by Operations), and ORD-003 (creation status limited to Draft/Quoted/Processing). Confirmed completion is Vendor-only (BR-034) and added BR-035 (valid creation statuses) and BR-036 (auto-query on invalid ordering parameters at placement). Added Order Subscription and Order Asset as child relationships. Fulfilment actions are now attributed throughout to the Vendor Actor directly (the word "extension" is not used — Vendor fulfilment is manual-first). Corrected the Draft→Quoted model: an Order reaches Quoted either by the Client's explicit `/quote` call (Client-only) or as a side effect of any Operations update to a Draft Order — the prior "quoting is Client-only" claim was wrong (BR-007, T5, new T5a, §2). Added Suspend and Resume as real Operations-created Order types that act on existing Subscriptions (§1, BR-002, BR-037, the `type` attribute, and the §7.2 Suspend/Resume cross-object effects). Remaining open questions: ORD-004, ORD-005, ORD-006, ORD-007. |
| 0.3 | 2026-07-17 | Stu / canon-generate | Attachment references corrected while canonising Commerce: Agreement Attachment. The former "Commerce: Order Attachment" child (§6) is not a distinct object — reframed as an Association to the shared Commerce: Agreement Attachment collection, referenced via `orderId` and served only through the parent Agreement's `/attachments` endpoint (there is no Order attachments endpoint). Removed the unsupported "attachments can be added in any status except Failed and Deleted" claim — attachment create/delete is not gated by Order (or Agreement) status. §7 attachment events repointed to the Commerce: Agreement Attachment canon, with `[[Agreement Attachment]]` bracket-linked now that the child object is canonised. Header version corrected (was 0.1 with a 0.2 changelog row already present). |
| 0.2 | 2026-04-13 | Stu | BR-012a added: parameter scope semantics — Agreement-scoped vs Order-scoped distinction, carry-over behaviour on Purchase Order completion, Order type constraints. Section 7.2 updated: Purchase Order completion parameter carry-over to Agreement added as a cross-object side effect. |
| 0.1 | 2026-04-12 | Stu | Initial canon. Commerce namespace — first object canonised. Covers all four Order types, full state machine, coupled Agreement/Subscription/Asset state transitions, parameter write rules, pre-validation webhook mechanism, pricing field visibility, soft-delete model, Attachment and Line child objects identified as pending canonisation. |
