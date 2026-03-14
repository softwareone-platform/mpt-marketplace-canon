# Object Canon: Template

> **Version:** 0.6
> **Owner:** Stu
> **Last Updated:** 2026-03-14
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Template

**Parent Object:** Catalog: Product

**Description:**
A Template is a vendor-authored markdown/html document associated with a Product, used to communicate contextual information to users about the current state of an Order, Agreement, Asset, or Subscription. Templates are part of the Product Definition and are scoped to the Product under which they are created. They are a vendor-agnostic capability available to all Vendors on the platform.

**Also Known As:**
TPL (API identifier prefix)

---

## 2. Ownership & Visibility

> High-level orientation to Actor authority and visibility over this object.
> State-specific nuances belong in Section 4 (Business Rules).

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
|------------|------------|----------|------------|------------|-------|
| Vendor     | Yes        | Yes      | Yes        | Yes        | Full lifecycle ownership |
| Operations | No         | Yes      | No         | No         | |
| Client     | No         | Yes      | No         | No         | Clients see the rendered Template on the General tab of the relevant object |

---

## 3. State Machine

This object has no state machine. It is created and modified as a unit, with no intermediate states.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
|---------|---------------|---------------------|-------------|-------|
| BR-001 | A Template belongs to exactly one Product and cannot be shared across Products. | N/A | All | |
| BR-002 | A Template has a type. Valid types are: Asset, Subscription, OrderProcessing, OrderQuerying, OrderCompleted. | N/A | All | Type determines which object and state the Template can be applied to. See BR-003. Note: the API spec also includes `RequestProcessing` as a valid enum value — this type is deprecated and pending removal in v5. Do not use it in new Templates. |
| BR-003 | A Template can only be applied to an object whose type and state match the Template type: Asset (any state), Subscription (any state), OrderProcessing (Order in Processing state only), OrderQuerying (Order in Querying state only), OrderCompleted (Order in Completed state only). | N/A | All | |
| BR-004 | For each of the three Order Template types (OrderProcessing, OrderQuerying, OrderCompleted), exactly one Template of that type must be marked as Default. Default Templates cannot be deleted. To delete a Default Template, the Vendor must first demote it by marking another Template of the same type as Default. | N/A | Vendor | |
| BR-005 | If a Vendor marks a Template as Default and another Template of the same type is already marked as Default, the existing Default is automatically demoted. | N/A | Vendor | There is always exactly one Default per Order Template type — no more, no less. |
| BR-006 | Asset and Subscription Template types have no Default mechanism and are never applied automatically by the platform. The Vendor is solely responsible for explicitly applying their chosen Template. | N/A | Vendor | Contrast with Order Template types, where the platform applies the Default Template automatically on state transition if no Template is specified (BR-007). |
| BR-007 | When an Order changes state and no Template is specified, the Default Template for the target state is applied automatically. | N/A | All | Applies to Order Template types only. |
| BR-008 | When a Vendor moves an Order to Querying state, they may specify which OrderQuerying Template to apply. | N/A | Vendor | If none specified, Default OrderQuerying Template is used per BR-007. |
| BR-009 | When a Vendor moves an Order to Completed state, they may specify which OrderCompleted Template to apply. | N/A | Vendor | If none specified, Default OrderCompleted Template is used per BR-007. |
| BR-010 | When an Order moves from Querying to Processing (initiated by the Client), the Default OrderProcessing Template is applied. The Client cannot specify a Template. | N/A | Client | The Client does not have the context to select an appropriate OrderProcessing Template. |
| BR-011 | When an Order reaches Completed state, the OrderCompleted Template on that Order is referenced by ID on the resulting Active Agreement. The Agreement holds a reference, not a copy — updates to the Template content under the Product definition propagate to the Agreement. | N/A | All | |
| BR-012 | The Vendor can change the Template on an Order at any time while the Order is in Processing or Querying state. | N/A | Vendor | |
| BR-013 | The Vendor can change the Template on an Agreement at any time while the Agreement is in Active state. | N/A | Vendor | |
| BR-014 | The Vendor can change the Template on an Asset at any time while the Asset is in Active state. | N/A | Vendor | |
| BR-015 | The Vendor can change the Template on a Subscription at any time while the Subscription is in Active state. | N/A | Vendor | |
| BR-016 | A non-Default Template may be deleted by the Vendor even if it is currently applied to an active Order, Agreement, Asset, or Subscription. In this case, the Template will fail to render on those objects. Default Templates cannot be deleted. | N/A | Vendor | See BR-004 for Default demotion process. See Section 9 for failure mode detail. |
| BR-017 | Templates have a maximum length of 4,000 characters, including all markdown/html tags. | N/A | Vendor | |
| BR-018 | Templates may include parameter value substitution fields in the format {{ PAR-XXXX-XXXX-XXXX }}, where the ID references a Parameter defined under the same Product. At render time, the token is replaced with the current value of that Parameter on the target object. Only parameter values are supported — object properties (e.g. Order or Agreement fields) cannot be substituted. | N/A | Vendor | |
| BR-019 | There can exist more than one Template of the same type under a single Product. | N/A | Vendor | The Vendor selects the appropriate Template based on the specific state and context of the target object. |
| BR-020 | When a Template is rendered and a parameter substitution field references a parameter with a null or empty value, the field is rendered as a zero-length string. | N/A | All | No error is raised. The substitution token is silently replaced with an empty string. |
| BR-021 | Template creation, modification, and deletion are not restricted by the state of the parent Product. | N/A | Vendor | |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Mutable After [State]? | Notes |
|-----------|------|-------------|--------|------------------------|----------------------|-------|
| Name | String | Human-readable label for the Template | Vendor | Yes | N/A | Required on creation. Used to identify the Template in the UI and API. Not required to be unique within a Product. |
| Type | Enum | One of: Asset, Subscription, OrderProcessing, OrderQuerying, OrderCompleted | Vendor | No | N/A | Required on creation — the API spec omits this from the required array, but this is a spec inaccuracy. Determines which object and state this Template can be applied to. Note: `RequestProcessing` also exists as an enum value in the API spec but is deprecated and pending removal in v5. |
| Is Default | Boolean | Marks this Template as the Default for its Order Template type | Vendor | Yes | N/A | Applicable to OrderProcessing, OrderQuerying, OrderCompleted types only. Setting this to true demotes the existing Default of the same type. Absent from the API response (null-suppressed) for Asset and Subscription types, which have no Default mechanism. |
| Content | String | The markdown/html body of the Template | Vendor | Yes | N/A | Required on creation. Max 4,000 characters including tags. Rendered against background #f4f6f8. Where used in notifications, must use html compatible with email clients. |
| Parameter Fields | String (embedded) | Substitution tokens in the format {{ PAR-XXXX-XXXX-XXXX }} embedded within Content | Vendor | Yes | N/A | References a Parameter ID defined under the same Product. Resolved at render time against the current parameter value on the target object. |
| Revision | Integer | Monotonically incrementing version counter, incremented on each content update | System | N/A | N/A | Read-only. Enables change detection. |
| External IDs | Object | Optional map of external system identifiers for this Template | Vendor | Yes | N/A | Key is the external system name (e.g. `vendor`); value is the Vendor's own identifier. Optional — may be absent or empty. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
|----------------|------------------|-------------|-------------|----------------------|
| Catalog: Product | Parent | Many:1 | A Template belongs to exactly one Product. | Yes — Template cannot exist without a parent Product. |
| Commerce: Order | Association | Many:Many | A Template of an Order type may be applied to an Order in the matching state. | No — deletion of Template does not delete the Order, but causes render failure. |
| Commerce: Agreement | Association | Many:Many | A Template may be applied to an Agreement. Referenced by ID from Order on Order completion. | No — as above. |
| Commerce: Asset | Association | Many:Many | A Template of type Asset may be applied to an Asset in any state. | No — as above. |
| Commerce: Subscription | Association | Many:Many | A Template of type Subscription may be applied to a Subscription in any state. | No — as above. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
|-------|---------|-------------------|---------------------------------|
| Template created | Vendor creates Template under a Product | Vendor | Template becomes available for application to eligible objects of the matching type. |
| Default Templates auto-created | Parent Product is created | Platform | The platform automatically creates one Default Template of each Order type: OrderProcessing, OrderQuerying, and OrderCompleted (all with Default = true). A Default RequestProcessing Template is also created today; this will stop being created when RequestProcessing is removed in v5. This ensures the one-and-only-one Default invariant for each Order Template type is satisfied from the moment the Product exists. |
| Template marked as Default | Vendor sets Is Default = true | Vendor | Any existing Default Template of the same type is automatically demoted (Is Default set to false). |
| Template deleted | Vendor deletes Template | Vendor | Any Order, Agreement, Asset, or Subscription currently referencing this Template will fail to render it. No cascade deletion. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
|-----------------|----------------|--------------------------|------------|-----------|-------|
| Order reaches Completed state | Agreement | The OrderCompleted Template applied to the Order is referenced by ID on the resulting Active Agreement | Yes | Always — occurs on every Order completion | The Agreement holds a reference, not a copy. Updates to the Template under the Product definition propagate to the Agreement. |
| Order changes state with no Template specified | Order | Default Template for the target state is applied by reference | Yes | Order Template types only. Asset and Subscription Templates are never applied automatically — always an explicit Vendor action. | |
| Template content updated under Product definition | Order, Agreement, Asset, Subscription | All objects referencing this Template by ID will render the updated content | Yes | Any object currently referencing the Template | All four object types hold a reference by ID, not a deep copy. There is no snapshot of Template content at time of application. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
Not applicable — this object has no state machine.

**Deletion:**
- Templates may be deleted by the Vendor. Once deleted, a Template is permanently removed and no longer retrievable via the API. Default Templates cannot be deleted. Non-Default Templates may be deleted even when applied to active objects.

**Audit & history requirements:**
Template content history is captured via the Audit Trail. Templates are overwritten in place on update; the Audit Trail records each change, and the `revision` counter increments on every update. No separate version store exists for Template content.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
|----------|--------------------------|---------------|------------|-------|
| Template deleted while applied to an active Order, Agreement, Asset, or Subscription | Template fails to render on the affected object(s). No other behavior is affected. | Client (cannot see rendered Template), Vendor (responsible for resolution) | Medium | Vendor should replace the Template reference on affected objects or recreate the Template. Non-Default Templates only — Default Templates cannot be deleted (see BR-004 update). |
| Parameter referenced in a substitution field is soft-deleted | Template renders correctly. Soft-deleted parameters are preserved and their values remain resolvable at render time. | None | Low | Parameters are soft-deleted only and remain resolvable after deletion, so substitution fields referencing them will not break. |
| Vendor attempts to delete a Default Template | Action is blocked. Default Templates cannot be deleted. | Vendor | N/A | Vendor must first demote the Default by marking another Template of the same type as Default, then delete the former Default. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2026-03-07 | Stu | Converted from early canon notes |
| 0.2 | 2026-03-09 | Stu / Claude | Namespace-qualified all related object references. BR-011 corrected — reference by ID not copy. BR-018 tightened against Parameter canon. Attributes table rendering notes moved to Notes column. Section 8 deletion format normalised. Audit history open question moved to tracker as TPL-001. |
| 0.3 | 2026-03-09 | Stu / Claude | TPL prefix added to Also Known As. Section 5: Name, Revision, External IDs attributes added. Is Default Notes clarified — null-suppressed for Asset and Subscription types. Section 8 audit note finalised — TPL-001 resolved, revision counter confirmed. RequestProcessing type excluded — deprecated, pending removal in v5. |
| 0.4 | 2026-03-09 | Stu / Claude | Platform Invariants block replaced with reference to PLATFORM_CANON_PREAMBLE.md. Example JSON section removed. |
| 0.5 | 2026-03-14 | Stu / Claude | Schema review against OpenAPI extract. BR-002 updated: RequestProcessing noted as deprecated enum value pending v5 removal. Section 5: Name and Content marked as required on creation; Type noted as optional on creation with TPL-002 raised; RequestProcessing noted in Type attribute. |
| 0.6 | 2026-03-14 | Stu / Claude | Section 7.1: auto-creation event added — platform creates one Default Template of each Order type on Product creation. RequestProcessing also auto-created today, pending removal in v5. |
