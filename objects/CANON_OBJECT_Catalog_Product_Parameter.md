# Object Canon: Parameter

> **Version:** 0.3
> **Owner:** Stu
> **Last Updated:** 2026-03-14
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Parameter

**Namespace:** Catalog

**Parent Object:** Catalog: Product

**ID Prefix:** None.

**Description:**
A Parameter is a vendor-defined data field associated with a Product, used to collect, store, and communicate data values across the lifecycle of Orders, Agreements, Assets, and Subscriptions. Parameters are part of the Product Definition and are scoped to the Product under which they are created. Each Parameter has a scope (which platform object type it is associated with) and a phase (when in the lifecycle it is relevant). Parameter definitions are authored by the Vendor; parameter values are written by the Vendor, Operations, or Client depending on scope, phase, and object state.

**Also Known As:**
PAR (API identifier prefix)

---

---

## 2. Ownership & Visibility

> High-level orientation to Actor authority and visibility over this object.
> "Ownership" here refers to the Parameter definition. Parameter value read/write rules
> are governed by scope, phase, and object state — see Section 4 (Business Rules).

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes | Yes | Yes | Yes | Full ownership of Parameter definitions. Primary writer of parameter values across all scopes. |
| Operations | No | Yes | No | No | Can read Parameter definitions. Can edit parameter values on live objects in exceptional circumstances. |
| Client | No | Yes | No | No | Can read Parameter definitions. Can write parameter values on Agreement-scoped and Order-scoped, Order-phase parameters while an Order is in Draft or Querying state. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Active | Parameter is available for use on eligible objects. | Yes | No |
| Deleted | Parameter has been soft-deleted. No longer visible in normal API responses. Parameter values already written to live objects are preserved and remain resolvable. | No | Yes |

### 3.2 Transitions

| # | From State | To State | Action / Trigger | Permitted Actor(s) | Preconditions | Outcome / Side Effects |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Active | Create Parameter | Vendor | None | Parameter available for use on eligible objects of the matching scope. If no group specified, auto-assigned to Default Parameter Group. |
| T2 | Active | Deleted | Delete Parameter | Vendor | None | Soft delete. Parameter values on live objects preserved and remain resolvable. Templates referencing this Parameter via substitution tokens continue to render correctly. |

### 3.3 State Diagram

```
[Active] ---(Delete : Vendor)---> [Deleted]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Parameter belongs to exactly one [[Product]] and cannot be shared across Products. | All | All | — |
| BR-002 | A Parameter has a scope. Valid scopes are: [[Agreement]], [[Asset]], [[Item]], [[Order]], Request, [[Subscription]]. Scope determines which platform object type the Parameter is associated with. Note: Request scope is deprecated and pending removal in v5. | All | All | — |
| BR-002a | The context property is applicable to [[Order]]-scoped Parameters only. It defines the type of [[Order]] the Parameter is designed for. Valid values are: Purchase, Change, Configuration, Termination, None. A value of None indicates the Parameter applies to all [[Order]] types. For all other scopes, context is None. | All | All | — |
| BR-003 | A Parameter has a phase. Valid phases are: Configuration, [[Order]], Fulfillment. Phase determines when in the lifecycle the parameter is relevant. Configuration phase is used for Orders of type Configuration. | All | All | — |
| BR-004 | Only [[Agreement]]-scoped and [[Order]]-scoped Parameters can use the [[Order]] or Configuration phase. [[Asset]], [[Item]], and [[Subscription]]-scoped Parameters are Fulfillment phase only. | All | All | — |
| BR-005 | A Parameter may belong to a [[Parameter Group]]. If no group is specified on creation, the Parameter is automatically assigned to the Default [[Parameter Group]]. | All | All | Consistent with [[Parameter Group]] canon. |
| BR-006 | A Parameter has a type that determines the shape of its value and how it is rendered in the UI. Valid types are: SingleLineText, MultiLineText, Choice, DropDown, Checkbox, Address, Contact, Email, Date, DataObject, Subdomain, Heading. DropDown is similar to Choice but its options have no description property. Subdomain collects a subdomain string value; the platform validates that it does not contain a dot (.). Heading is a presentational type only — it carries no value and is used to structure the UI. In a future version, Heading will support a markdown/html value field updatable by an Extension. | All | All | — |
| BR-007 | A Parameter has a multiple flag. When true, multiple values can be associated with a single parameter instance. | All | All | — |
| BR-008 | A Parameter has an externalId — a Vendor-defined identifier used to reference the parameter in integrations and Extensions. | All | All | — |
| BR-009 | Parameter creation, modification, and deletion are not restricted by the state of the parent [[Product]]. | All | Vendor | Consistent with platform permissiveness philosophy. |
| BR-010 | Parameters are soft-deleted only. Soft-deleted Parameters remain retrievable in some contexts (e.g. [[Template]] substitution rendering) but are no longer visible in normal API listing responses. | All | Vendor | — |
| BR-011 | When a Parameter is soft-deleted, its values on all live objects (Orders, Agreements, Assets, Subscriptions) are preserved and remain resolvable. Templates referencing soft-deleted Parameters via substitution tokens continue to render correctly. | Deleted | All | Established in [[Template]] canon Section 9. |

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-012 | Parameters have constraints that control visibility and editability. Available constraints differ by scope: [[Agreement]] and [[Order]] scoped parameters support required, hidden, and readonly. [[Asset]] and [[Subscription]] scoped parameters support required only. [[Item]]-scoped parameters support required only. | All | All | — |
| BR-013 | Constraints operate at two layers: definition-level and instance-level. Definition-level constraints are set on the Parameter definition and serve as the default applied when a new object instance is created. Instance-level constraints are set by the Vendor Extension on a specific live object and override the definition-level constraints for that instance. Instance-level always wins. | All | All | — |
| BR-014 | The Vendor Extension can modify instance-level constraints on any live object type ([[Order]], [[Agreement]], [[Asset]], [[Subscription]]) independently of the Parameter definition. | All | Vendor | Enables operational patterns such as hiding deprecated parameter instances via migration tooling, without modifying the underlying Parameter definition. |
| BR-015 | Definition-level constraints are a default template, not a contract. Once a live object instance exists, the definition-level constraints are irrelevant to that instance. Definition-level constraints only apply at the moment a new instance is created and the defaults are first applied. | All | All | — |

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-016 | [[Agreement]]-scoped and [[Order]]-scoped, [[Order]]-phase parameter values are collected from the Client when an [[Order]] is being created ([[Order]] in Draft state). | Active | Client | — |
| BR-017 | A Client can edit [[Agreement]]-scoped and [[Order]]-scoped parameter values while an [[Order]] is in Draft or Querying state. Querying state exists specifically to allow the Client to correct invalid parameter values. | Active | Client | — |
| BR-018 | Fulfillment-phase parameter values are written by the Vendor (via Extension). Clients cannot write Fulfillment-phase parameter values. Operations may edit Fulfillment-phase parameter values in exceptional circumstances. | Active | Vendor, Operations | — |
| BR-019 | [[Asset]]-scoped and [[Subscription]]-scoped parameter values are exclusively written by the Vendor during fulfillment. Clients cannot write these values. | Active | Vendor, Operations | — |
| BR-020 | When an [[Order]] reaches Completed state, [[Agreement]]-scoped, [[Order]]-phase parameter values are copied to the resulting [[Agreement]]. The copy is a value snapshot — it includes both the parameter values and the instance-level constraints as they existed on the [[Order]] at the time of completion. This is not a reference to the Parameter definition. If the Vendor Extension has modified instance-level constraints on the [[Order]] prior to completion, those modified constraints are what is copied — not the definition defaults. | Active | All | — |
| BR-021 | After an [[Order]] reaches Completed state and the [[Agreement]] becomes Active, the Vendor can continue to modify instance-level constraints on [[Agreement]] parameter instances at any time. This is independent of the Parameter definition. | Active | Vendor | — |
| BR-022 | [[Item]]-scoped Parameters store Vendor-defined metadata about a [[Product]] [[Item]]. They are surfaced in the Items list during the ordering UI and are filterable. A common use case is a "[[Product]] Family" parameter (e.g. values: "Document Cloud", "Creative Cloud") that allows Clients to filter Items by family during ordering. The only constraint available for [[Item]]-scoped Parameters is required. | Active | Vendor | — |

---

## 5. Key Attributes

> Attributes below describe the Parameter definition. Parameter values and instance-level
> constraint overrides are held on the target object (Order, Agreement, Asset, Subscription),
> not on the Parameter definition itself.

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| Name | String | Display name of the Parameter | Vendor | Yes | Required on creation. |
| Description | String | Descriptive text explaining the parameter's purpose | Vendor | Yes | Required on creation. |
| External ID | String | Vendor-defined identifier for use in integrations and Extensions | Vendor | Yes | Optional. Nullable. |
| Scope | Enum | One of: Agreement, Asset, Item, Order, Request, Subscription | Vendor | No | Required on creation. Immutable after creation. Note: Request scope is deprecated, pending removal in v5. |
| Phase | Enum | One of: Configuration, Order, Fulfillment | Vendor | No | Required on creation. Immutable after creation. Configuration phase is for Configuration Order type Parameters only. |
| Type | Enum | One of: SingleLineText, MultiLineText, Choice, DropDown, Checkbox, Address, Contact, Email, Date, DataObject, Subdomain, Heading | Vendor | No | Required on creation. Immutable after creation. See BR-006 for type-specific notes. |
| Multiple | Boolean | Whether multiple values can be associated with a single parameter instance | Vendor | No | Immutable after creation. |
| Context | Enum | Applicable to Order-scoped Parameters only. One of: Purchase, Change, Configuration, Termination, None. None means the Parameter applies to all Order types. For all other scopes this field is always None. | Vendor | Yes | Optional. Nullable. |
| Display Order | Integer | Controls the sequence in which this Parameter is presented | Vendor | Yes | Required on creation. |
| Constraints | Object | Definition-level default constraints. Shape varies by scope — see BR-012. | Vendor | Yes | Required on creation. Instance-level overrides on live objects take precedence per BR-013. |
| Options | Object | Type-specific configuration (optionsList, hintText, placeholderText, defaultValue, dateRange, phoneMandatory, etc.) | Vendor | Yes | Optional. Shape varies by type. |
| Status | Enum | One of: Active, Deleted | System | Via state transitions only | — |
| Revision | Integer | Increments on each update to the Parameter definition | System | N/A | Read-only. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Product | Parent | Many:1 | A Parameter belongs to exactly one Product. | Yes — Parameter cannot exist without a parent Product. |
| Catalog: Product Parameter Group | Parent | Many:1 | A Parameter belongs to a Parameter Group. Auto-assigned to Default group if none specified. | Yes — deletion of a Parameter Group is blocked while it contains Parameters. |
| Commerce: Order | Association | Many:Many | Agreement-scoped and Order-scoped, Order-phase Parameters are collected and held on Orders. Instance-level constraint overrides may be applied by the Vendor Extension. | No — soft-deletion of Parameter preserves values on live Orders. |
| Commerce: Agreement | Association | Many:Many | Agreement-scoped Parameters are held on Agreements. Order-phase values and instance-level constraints copied from the Order instance on completion. Fulfillment-phase values written by Vendor post-completion. Instance-level constraint overrides may be applied by the Vendor Extension at any time. | No — soft-deletion of Parameter preserves values on live Agreements. |
| Commerce: Asset | Association | Many:Many | Asset-scoped Parameters are held on Assets. Values written by Vendor during fulfillment. | No — as above. |
| Commerce: Subscription | Association | Many:Many | Subscription-scoped Parameters are held on Subscriptions. Values written by Vendor during fulfillment. | No — as above. |
| Catalog: Product Template | Association | Many:Many | Templates may reference Parameters via substitution tokens in the format {{ PAR-XXXX-XXXX-XXXX }}. Soft-deleted Parameters remain resolvable in Templates. | No — soft-deletion does not break Template rendering. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Parameter created | Vendor creates Parameter under a Product | Vendor | Parameter enters Active state. If no group specified, automatically assigned to Default Parameter Group. |
| Parameter deleted | T2 — Active to Deleted | Vendor | Soft delete. Parameter values on all live objects preserved. Templates referencing this Parameter continue to render correctly. |
| Instance-level constraint overridden | Vendor Extension writes constraint override to a live object instance | Vendor | Constraint on that specific object instance updated. Definition-level constraints unchanged. All other instances of that Parameter on other objects are unaffected. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Order reaches Completed state | Commerce: Agreement | Agreement-scoped, Order-phase parameter values and instance-level constraints are copied to the Agreement as a snapshot | Yes | Always — on every Order completion | Snapshot includes both values and constraints as they existed on the Order instance at time of completion. Not a reference to the Parameter definition. |
| Order enters Draft state | Commerce: Order | Agreement-scoped and Order-scoped, Order-phase parameters are presented to the Client for input, using definition-level constraints as the initial defaults | Yes | Always | — |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
None. Soft deletion is terminal and not reversible.

**Deletion:**
- Parameters are soft-deleted only. Once soft-deleted, a Parameter is no longer visible in normal API listing responses but its values on all live objects are preserved indefinitely and remain resolvable.

**Audit & history requirements:**
Not yet defined. Parameter value history (prior values before each change) is not yet confirmed as retained.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Parameter soft-deleted while referenced by a Template substitution token | Template continues to render correctly. Soft-deleted parameter values are preserved and resolvable. | None | Low | Confirmed in Template canon Section 9 and BR-011. |
| Parameter soft-deleted while referenced by a live Order, Agreement, Asset, or Subscription | Parameter values are preserved on all live objects. No render failure. No cascade. | None | Low | Soft delete is designed specifically to preserve this behavior. |
| Vendor Extension modifies instance-level constraints on an Order prior to completion | Modified constraints — not definition defaults — are copied to the Agreement on Order completion. | None | Low | Expected behavior per BR-020. Vendor is responsible for intentional constraint state at completion time. |
| Vendor updates definition-level constraints after live object instances exist | Definition-level change has no effect on existing instances. Instance-level constraints on live objects are unaffected regardless of whether they were previously overridden or defaulted from the definition. | None | Low | Instance-level always wins per BR-013 and BR-015. |
| Required parameter has no value when Order is submitted | Behavior governed by Order state machine validation — to be documented in Commerce: Order canon. | Client | Medium | — |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-03-08 | Stu | Initial draft. |
| 0.2 | 2026-03-08 | Stu | Added two-layer constraint model (BR-012–BR-015), scope-differentiated constraint availability, constraint copy behaviour on Order completion (BR-020), post-completion constraint mutability (BR-021). Expanded failure modes. |
| 0.3 | 2026-03-14 | Stu | Schema review against OpenAPI extract. BR-002: Request scope added (deprecated, pending v5 removal). BR-003: Configuration phase added. BR-004: Configuration phase included in Order/Agreement scope rule. BR-006: Subdomain, Heading, DropDown types added with descriptions. Section 5: required fields on creation noted, all enums corrected, Request scope and Heading type notes added. Section 8: deletion language cleaned up. Section 10: cleaned up. |
