# Object Canon: Parameter

> **Version:** 0.4
> **Owner:** Stu
> **Last Updated:** 2026-07-15
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Parameter

**Namespace:** Catalog

**Parent Object:** Catalog: Product

**ID Prefix:** PAR

**Description:**
A Parameter is a vendor-defined data field associated with a [[Product]], used to collect, store, and communicate data values across the lifecycle of [[Order]]s, [[Agreement]]s, [[Asset]]s, and [[Subscription]]s. Parameters are part of the Product Definition and are scoped to the Product under which they are created. Each Parameter has a scope (which platform object type it is associated with) and a phase (when in the lifecycle it is relevant). Parameter definitions are authored by the Vendor; parameter values are written by the Vendor, Operations, or Client depending on scope, phase, and object state.

**Also Known As:**
None known.

---

## 2. Ownership & Visibility

> High-level orientation to Actor authority and visibility over this object.
> "Ownership" here refers to the Parameter definition. Parameter value read/write rules
> are governed by scope, phase, and object state — see Section 4 (Business Rules).

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes | Yes | Yes | Yes | Full ownership of Parameter definitions. Primary writer of parameter values across all scopes. No field suppression relative to Operations. |
| Operations | No | Yes | No | No | Can read Parameter definitions. Can edit parameter values on live objects in exceptional circumstances. |
| Client | No | Yes | No | No | Can read Parameter definitions — no field suppression. Can write parameter values on Agreement-scoped and Order-scoped, Order-phase parameters while an Order is in Draft or Querying state. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Active | Parameter is available for use on eligible objects. | Yes | No |
| Deleted | Parameter has been soft-deleted. No longer visible in normal API responses. Parameter values already written to live objects are preserved and remain resolvable. | No | Yes |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Active | Create Parameter | `POST` (base collection endpoint) | Vendor | None | Parameter available for use on eligible objects of the matching scope. |
| T2 | Active | Deleted | Delete Parameter | `DELETE /{id}` | Vendor | Parameter must not already be deleted, and must not be in use by any Template. | Soft delete. Parameter values on live objects preserved and remain resolvable. |

### 3.3 State Diagram

```
[Active] ---(DELETE /{id} : Vendor)---> [Deleted]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Parameter belongs to exactly one [[Product]] and cannot be shared across Products. | All | All | — |
| BR-002 | A Parameter has a scope, which determines which platform object type the Parameter is associated with. | All | All | Confirmed values: [[Agreement]], [[Asset]], [[Item]], [[Order]], [[Subscription]]. |
| BR-002a | The `context` property is applicable to [[Order]]-scoped Parameters only. It defines the type of Order the Parameter is designed for. | All | All | Valid values: `Purchase`, `Change`, `Configuration`, `Termination`, `None`. `None` means the Parameter applies to all Order types. For all other scopes, `context` is always `None`. |
| BR-003 | A Parameter has a phase, which determines when in the lifecycle the parameter is relevant. | All | All | Confirmed values: `Configuration`, `Order`, `Fulfillment`. |
| BR-004 | Each scope is only valid for specific phases — not every scope/phase combination is permitted. | All | All | [[Agreement]] scope: `Order` or `Fulfillment` phase. [[Order]] scope: `Order` phase only. [[Item]] scope: `Configuration` phase only. [[Asset]] and [[Subscription]] scopes: `Fulfillment` phase only. |
| BR-005 | A [[Parameter Group]] is optional on most Parameters — a Parameter may be created, and remain, with no Group at all. | All | All | The platform requires a Group at creation only for [[Agreement]]-scoped, Order-phase Parameters and [[Order]]-scoped Parameters — creation is rejected without one. Consistent with [[Parameter Group]] canon BR-003. |
| BR-006 | A Parameter has a type that determines the shape of its value and how it is rendered in the UI. | All | All | Confirmed values: `SingleLineText`, `MultiLineText`, `Choice`, `DropDown`, `Checkbox`, `Address`, `Contact`, `Email`, `Date`, `DataObject`, `Subdomain`, `Heading`. `DropDown` is similar to `Choice` but its options have no description property. `Subdomain` collects a subdomain string value; the platform validates that it does not contain a dot (`.`). `Heading` is presentational only — it carries no value. |
| BR-006a | `Address`, `Contact`, and `Email` type Parameters may declare a default-value preset (e.g. `Buyer`, `Seller`, `Licensee` for Address; `CurrentlySignedInUser` for Contact/Email). | All | All | This is a hint to the API consumer, not a platform-enforced default — the platform does not itself resolve the preset into a real value; a consuming UI may choose to use the hint to pre-populate a default, but is not required to. |
| BR-007 | A Parameter has a `multiple` flag. When true, multiple values can be associated with a single parameter instance. | All | All | — |
| BR-007a | A `multiple` Parameter requires a `capacity` constraint bounding how many values may be set; a non-`multiple` Parameter must not have one. | All | All | `capacity.min` must be 0 when the Parameter is not required, and greater than 0 when it is required. Maximum capacity is 10. Unlike the other constraints (BR-012), `capacity` is available regardless of scope or phase — it is gated only by the `multiple` flag. |
| BR-008 | A Parameter has an `externalId` — a Vendor-defined identifier used to reference the parameter in integrations and Extensions. | All | All | — |
| BR-009 | Parameter creation, modification, and deletion are not restricted by the state of the parent [[Product]]. | All | Vendor | — |
| BR-010 | Parameters are soft-deleted only. Soft-deleted Parameters remain retrievable in some contexts (e.g. [[Template]] substitution rendering) but are no longer visible in normal API listing responses. | All | Vendor | — |
| BR-011 | A Parameter's values already written to live objects ([[Order]]s, [[Agreement]]s, [[Asset]]s, [[Subscription]]s) are unaffected by later changes to the Parameter definition — including the definition being soft-deleted. Templates referencing soft-deleted Parameters via substitution tokens continue to render correctly. | Deleted | All | Live object Parameter values are independent copies, not references to the definition — see Section 6. |

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-012 | Parameters have constraints that control visibility and editability. Available constraints differ by scope. | All | All | [[Agreement]] and [[Order]] scoped parameters support `required`, `hidden`, and `readonly`. [[Asset]], [[Subscription]], and [[Item]] scoped parameters support `required` only. `capacity` (BR-007a) is exempt from this table — it's available to any scope. |
| BR-013 | Constraints operate at two layers: definition-level and instance-level. Definition-level constraints are set on the Parameter definition and serve as the default applied when a new object instance is created. Instance-level constraints are set by the Vendor Extension on a specific live object and override the definition-level constraints for that instance. Instance-level always wins. | All | All | — |
| BR-014 | The Vendor Extension can modify instance-level constraints on any live object type ([[Order]], [[Agreement]], [[Asset]], [[Subscription]]) independently of the Parameter definition. | All | Vendor | Enables operational patterns such as hiding deprecated parameter instances via migration tooling, without modifying the underlying Parameter definition. |
| BR-015 | Definition-level constraints are a default template, not a contract. Once a live object instance exists, the definition-level constraints are irrelevant to that instance. Definition-level constraints only apply at the moment a new instance is created and the defaults are first applied. | All | All | — |

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-016 | [[Agreement]]-scoped and [[Order]]-scoped, Order-phase parameter values are collected from the Client when an Order is being created (Order in Draft state). | Active | Client | — |
| BR-017 | A Client can edit [[Agreement]]-scoped and [[Order]]-scoped parameter values while an Order is in Draft or Querying state. Querying state exists specifically to allow the Client to correct invalid parameter values. | Active | Client | — |
| BR-018 | Fulfillment-phase parameter values are written by the Vendor (via Extension). Clients cannot write Fulfillment-phase parameter values. Operations may edit Fulfillment-phase parameter values in exceptional circumstances. | Active | Vendor, Operations | — |
| BR-019 | [[Asset]]-scoped and [[Subscription]]-scoped parameter values are exclusively written by the Vendor during fulfillment. Clients cannot write these values. | Active | Vendor, Operations | — |
| BR-020 | When an [[Order]] reaches Completed state, [[Agreement]]-scoped, Order-phase parameter values are copied to the resulting Agreement. The copy is a value snapshot — it includes both the parameter values and the instance-level constraints as they existed on the Order at the time of completion. | Active | All | This is not a reference to the Parameter definition. If the Vendor Extension modified instance-level constraints on the [[Order]] prior to completion, those modified constraints are what is copied — not the definition defaults. |
| BR-021 | After an [[Order]] reaches Completed state and the [[Agreement]] becomes Active, the Vendor can continue to modify instance-level constraints on Agreement parameter instances at any time. This is independent of the Parameter definition. | Active | Vendor | — |
| BR-022 | [[Item]]-scoped Parameters store Vendor-defined metadata about a Product Item. They are surfaced in the Items list during the ordering UI and are filterable. | Active | Vendor | A common use case is a "Product Family" parameter (e.g. values: "Document Cloud", "Creative Cloud") that allows Clients to filter Items by family during ordering. |

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
| Scope | Enum | One of: `Agreement`, `Asset`, `Item`, `Order`, `Subscription` | Vendor | No | Required on creation. Immutable after creation. |
| Phase | Enum | One of: `Configuration`, `Order`, `Fulfillment` | Vendor | No | Required on creation. Immutable after creation. See BR-004 for which phases are valid for which scope. |
| Type | Enum | One of: `SingleLineText`, `MultiLineText`, `Choice`, `DropDown`, `Checkbox`, `Address`, `Contact`, `Email`, `Date`, `DataObject`, `Subdomain`, `Heading` | Vendor | No | Required on creation. Immutable after creation. See BR-006 for type-specific notes. |
| Multiple | Boolean | Whether multiple values can be associated with a single parameter instance | Vendor | No | Immutable after creation. See BR-007a for the paired `capacity` constraint. |
| Context | Enum | Applicable to Order-scoped Parameters only. One of: `Purchase`, `Change`, `Configuration`, `Termination`, `None` | Vendor | Yes | Optional. Nullable. See BR-002a. |
| Display Order | Integer | Controls the sequence in which this Parameter is presented | Vendor | Yes | Required on creation. |
| Group | Object (reference: id, name, revision) | Reference to the parent Parameter Group, if assigned | Vendor | Yes | Optional for most scope/phase combinations — see BR-005. Absent (null) when unassigned, not defaulted. |
| Constraints | Object | Definition-level default constraints: `hidden`, `readonly`, `required`, `capacity`. Shape varies by scope — see BR-012, BR-007a. | Vendor | Yes | Required on creation. Instance-level overrides on live objects take precedence per BR-013. |
| Options | Object | Type-specific configuration (`optionsList`, `hintText`, `placeholderText`, `defaultValue`, `dateRange`, `phoneMandatory`, etc.) | Vendor | Yes | Optional. Shape varies by type. For Address/Contact/Email types, `defaultValue` may hold a preset name — see BR-006a. |
| Product | Object (reference: id, name, icon, revision, externalIds, status) | Reference to the parent Product | System | No | Set at creation. |
| Status | Enum | One of: `Active`, `Deleted` | System | Via state transitions only | — |
| Revision | Integer | Increments on each update to the Parameter definition | System | N/A | Read-only. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Product | Parent | Many:1 | A Parameter belongs to exactly one Product. | Yes — Parameter cannot exist without a parent Product. |
| Catalog: Product Parameter Group | Parent | Many:1 (optional) | A Parameter may belong to a Parameter Group — see BR-005 for when a Group is required vs. optional. | Yes, when assigned — deletion of a Parameter Group is blocked while it contains Parameters. |
| Commerce: Order | Association | Many:Many | Agreement-scoped and Order-scoped, Order-phase Parameters are collected and held on Orders as independent value copies. Instance-level constraint overrides may be applied by the Vendor Extension. | No — soft-deletion of the Parameter definition preserves values already on live Orders. |
| Commerce: Agreement | Association | Many:Many | Agreement-scoped Parameters are held on Agreements. Order-phase values and instance-level constraints are copied from the Order instance on completion. Fulfillment-phase values are written by Vendor post-completion. Instance-level constraint overrides may be applied by the Vendor Extension at any time. | No — as above. |
| Commerce: Asset | Association | Many:Many | Asset-scoped Parameters are held on Assets. Values written by Vendor during fulfillment. | No — as above. |
| Commerce: Subscription | Association | Many:Many | Subscription-scoped Parameters are held on Subscriptions. Values written by Vendor during fulfillment. | No — as above. |
| Catalog: Product Template | Association | Many:Many | Templates may reference Parameters via substitution tokens in the format `{{ PAR-XXXX-XXXX-XXXX }}`. Soft-deleted Parameters remain resolvable in Templates. | No — soft-deletion does not break Template rendering. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Parameter created | Vendor creates Parameter under a [[Product]] | Vendor | Parameter enters Active state. Assigned to a Parameter Group only if one was specified (or if one is required — see BR-005); otherwise remains groupless. |
| Parameter deleted | T2 — Active to Deleted | Vendor | Soft delete. Parameter values on all live objects preserved. Templates referencing this Parameter continue to render correctly. |
| Instance-level constraint overridden | Vendor Extension writes constraint override to a live object instance | Vendor | Constraint on that specific object instance updated. Definition-level constraints unchanged. All other instances of that Parameter on other objects are unaffected. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| [[Order]] reaches Completed state | Commerce: Agreement | [[Agreement]]-scoped, Order-phase parameter values and instance-level constraints are copied to the Agreement as a snapshot | Yes | Always — on every Order completion | Snapshot includes both values and constraints as they existed on the [[Order]] instance at time of completion. Not a reference to the Parameter definition. |
| [[Order]] enters Draft state | Commerce: Order | [[Agreement]]-scoped and [[Order]]-scoped, Order-phase parameters are presented to the Client for input, using definition-level constraints as the initial defaults | Yes | Always | — |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
None. Soft deletion is terminal and not reversible.

**Deletion:**
- Parameters are soft-deleted only. Once soft-deleted, a Parameter is no longer visible in normal API listing responses but its values on all live objects are preserved indefinitely and remain resolvable.

**Audit & history requirements:**
Historical parameter values (prior values before each change) are not retained on the Parameter definition or on a dedicated history store. They are captured only in the Audit log of the object that exposes the parameter value — [[Order]], [[Agreement]], [[Subscription]], [[Asset]], [[Item]], etc. — not in a Parameter-specific audit trail.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Parameter soft-deleted while referenced by a [[Template]] substitution token | Template continues to render correctly. Soft-deleted parameter values are preserved and resolvable. | None | Low | See Template canon Section 9 and BR-011. |
| Parameter soft-deleted while referenced by a live [[Order]], [[Agreement]], [[Asset]], or [[Subscription]] | Parameter values are preserved on all live objects. No render failure. No cascade. | None | Low | Soft delete is designed specifically to preserve this behavior. |
| Vendor Extension modifies instance-level constraints on an [[Order]] prior to completion | Modified constraints — not definition defaults — are copied to the [[Agreement]] on [[Order]] completion. | None | Low | Expected behavior per BR-020. Vendor is responsible for intentional constraint state at completion time. |
| Vendor updates definition-level constraints after live object instances exist | Definition-level change has no effect on existing instances. Instance-level constraints on live objects are unaffected regardless of whether they were previously overridden or defaulted from the definition. | None | Low | Instance-level always wins per BR-013 and BR-015. |
| Required parameter has no value when [[Order]] is submitted | Behavior governed by shared Commerce-wide parameter validation logic, triggered from [[Order]] transitions and (for [[Agreement]]-scoped parameters) independently from Agreement creation. | Client | Medium | Not yet fully documented in Commerce: [[Order]] or Commerce: [[Agreement]] canon. |

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
| 0.4 | 2026-07-15 | Stu / canon-generate | Refresh via live OpenAPI schema, one live-fetched real object (STAGING, all Actors — no suppression found), and source-code research. **Significant corrections**: Request scope is fully removed from the platform (not merely deprecated) — dropped from BR-002 and the Scope attribute. BR-004 corrected — Item-scoped Parameters are Configuration-phase only, not Fulfillment-phase as previously stated (grouped incorrectly with Asset/Subscription). BR-005 corrected — a Parameter is *not* automatically assigned to the Default Parameter Group when created without one (it may remain groupless); a Group is genuinely required only for Agreement-scoped Order-phase and Order-scoped Parameters. New BR-006a (Address/Contact/Email default-value presets are a hint to the API consumer, not platform-enforced) and BR-007a (the previously-undocumented `capacity` constraint, paired with `multiple`, exempt from the per-scope constraint table) — both resolved directly with the PM. New `Group` and `Product` attributes documented (not previously listed). Section 8 audit note resolved — parameter value history lives only in the exposing object's own Audit log, not a Parameter-specific store. Section 9's last failure mode row refined — the validation logic is shared Commerce-wide infrastructure, not Order-exclusive. Also corrected `Catalog: Product Parameter Group` canon (BR-003, Default attribute, Section 7.2) for the same Default-Group auto-assignment error. |
