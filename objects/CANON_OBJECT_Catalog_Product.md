# Object Canon: Product

> **Version:** 0.11
> **Owner:** Stu
> **Last Updated:** 2026-07-16
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Product

**Namespace:** Catalog

**Parent Object:** None (primary object)

**ID Prefix:** PRD (confirmed via `preamble/PLATFORM_CANON_PREAMBLE.md` §5.3 and observed real object IDs, e.g. `PRD-2873-8874`, `PRD-3427-4385`).

**Description:**
A Product is the top-level unit of a Vendor's commercial offering on the SoftwareOne Marketplace. It is the container for everything that defines what can be sold and how — [[Item]]s (orderable SKUs), [[Parameter]]s (data fields), [[Template]]s (contextual communications), [[Terms]] (acceptance requirements), [[Media]] (visual assets), and pricing via [[Price List]]s. A Product must go through a publication review before it is available to Clients. Once published, it can be made available through one or more [[Listing]]s, each of which connects the Product to a SoftwareOne [[Seller]], a currency, and an eligible Client population.

**Also Known As:**
None known.

---

## 2. Ownership & Visibility

> High-level orientation to Actor authority and visibility over this object.
> State-specific nuances belong in Section 4 (Business Rules).

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | Yes | Yes | Yes | Yes — Draft state only | Primary lifecycle owner. Deletion via `DELETE /catalog/products/{id}` is Vendor-only and rejected unless the Product is in Draft state — see BR-002. |
| Operations | No | Yes | No | No | Read across all states including Draft. Collaborates with Vendor to make Product publishable. Cannot delete under any circumstances. |
| Client | No | Yes | No | No | Visible in Published state only. Existing-Agreement Clients retain transactional access in Unpublished state. |

---

## 3. State Machine

> Each transition specifies which Actor(s) are permitted to execute it.
> Where more than one Actor is listed, any one of them may execute the transition.
> Each execution instance is always attributable to exactly one Actor.

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Draft | Product is being authored by the Vendor. Visible to Operations but not to Clients. The only state from which deletion is permitted (T7). | Yes | No |
| Pending | Product has been submitted for publication review. Visible to Operations. Vendor cannot withdraw. | No | No |
| Published | Product is live on the Marketplace. Visible and purchasable by Clients. | No | No |
| Unpublished | Product has been removed from the Marketplace. Not discoverable or purchasable by new Clients. Existing-Agreement Clients retain transactional access. Can be returned to Pending for re-review (T6). | No | No |
| Deleted | Product has been soft-deleted, along with its child objects (see BR-002, Section 8). No longer retrievable via the API in any context. | No | Yes |

**Mechanism note:** as with other soft-deleted objects on this platform, "Deleted" is tracked via an internal flag rather than a `Status` value — a deleted Product is automatically excluded from all normal API responses. `Status` retains whatever value it held (always `Draft`, since deletion is Draft-only) at the point of deletion.

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Draft | Create Product | `POST` (base collection endpoint) | Vendor | Name, icon, and website are required. No other preconditions. | Product created in Draft state. |
| T2 | Draft | Pending | Submit Product for Publication | `review` (`POST .../{id}/review`) | Vendor | None — no completeness requirements. A Product with no child objects can be submitted. | Product enters review queue. Vendor cannot reverse this transition (BR-004). |
| T3 | Pending | Published | Publish Product | `publish` (`POST .../{id}/publish`) | Operations | None enforced by the platform (BR-010) | Product becomes visible and purchasable by Clients. |
| T4 | Published | Unpublished | Unpublish Product | `unpublish` (`POST .../{id}/unpublish`) | Vendor, Operations | None | Product removed from Client discovery. Existing Agreements unaffected. |
| T5 | Unpublished | Published | Republish Product | `publish` (same route as T3) | Operations | None enforced by the platform (BR-010) | Product restored to Client discovery. Republish uses the exact same Operations-only action as the original Publish, not a separate Vendor-accessible one. |
| T6 | Unpublished | Pending | Review Product | `review` (same route as T2) | Vendor | None found | The same action handles both `Draft -> Pending` and `Unpublished -> Pending`; no state guard prevents this path. Lets a Vendor pull an Unpublished Product back into the review queue rather than only re-publishing it directly. |
| T7 | Draft | Deleted | Delete Product | `DELETE /{id}` | Vendor | Product must be in Draft state; the platform rejects the request otherwise. | Soft delete; cascades to child objects and removes Documents/Media/Icon — see Section 6 and Section 8. Permanently removed — no longer retrievable via the API. |

### 3.3 State Diagram

```
[Draft] ---(review : Vendor)---> [Pending]
[Draft] ---(DELETE /{id} : Vendor)---> [Deleted]
[Pending] ---(publish : Operations)---> [Published]
[Published] ---(unpublish : Vendor, Operations)---> [Unpublished]
[Unpublished] ---(publish : Operations)---> [Published]
[Unpublished] ---(review : Vendor)---> [Pending]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | [[Template]] creation, modification, and deletion under a Product are not restricted by the state of the Product. | All | Vendor | Also documented in [[Template]] canon BR-021. |
| BR-002 | A Product may be deleted by its Vendor only while in Draft state (T7). Deletion is a soft delete and cascades: [[Item]]s, [[Item Group]]s, [[Parameter]]s, [[Parameter Group]]s, [[Template]]s, [[Terms]] (and [[Terms Variant]]s), [[Price List]]s (and [[Price List Item]]s), [[Authorization]]s, and [[Listing]]s are removed, along with the Product's [[Document]]s, [[Media]], and Icon. Once a Product leaves Draft state (Pending, Published, or Unpublished), it can never be deleted by any Actor. | Draft (for the transition itself); all other states are permanently non-deletable | Vendor | This is a documented exception to Platform Invariant 6 — see preamble. |
| BR-003 | Once a Product is submitted to Pending, the Vendor cannot withdraw it. The only exit from Pending is publication by Operations. | Pending | Vendor, Operations | Operations collaborates with the Vendor to resolve any issues rather than rejecting the Product (preamble §3.3). |
| BR-004 | A Product in Pending state cannot be returned to Draft. | Pending | All | There is no reject or withdraw transition. |
| BR-005 | All Product attributes are mutable in all non-terminal states, including Published. | Draft, Pending, Published, Unpublished | Vendor | No distinction between presentational and behavioral attributes. Vendor is responsible for consequences of editing a Published Product with active downstream objects. |
| BR-006 | When a Product is Unpublished, it is no longer visible to Clients for new purchases. | Unpublished | All | — |
| BR-007 | When a Product is Unpublished, Clients with existing Agreements for that Product retain full transactional access. | Unpublished | Client | Unpublished does not break existing commercial relationships. |
| BR-008 | A Product can cycle between Published and Unpublished states without limit. | Published, Unpublished | Vendor, Operations | — |
| BR-009 | Unpublished is not a terminal state — an Unpublished Product may be returned to Pending for re-review (T6) or republished directly (T5). | Unpublished | Vendor, Operations | — |
| BR-010 | The platform enforces no publishability criteria before Operations may publish (or republish) a Product — no validator or precondition exists beyond the current-state check. | Pending, Unpublished | Operations | Any manual, out-of-band review Operations performs before publishing is an organizational practice, not a system-enforced gate. |
| BR-011 | `settings.suspendResume` has two independently-controlled sub-flags: `Vendor` (writable only via the Vendor settings command, visible to all Actors) and `Operations` (writable only via the Operations settings command, visible to Operations only). | All | Vendor (Vendor sub-flag), Operations (Operations sub-flag) | Same actor-scoped-split shape as `splitBilling`/`sendCostToErp` below. |
| BR-012 | `settings.splitBilling` and `settings.sendCostToErp` cannot be written by Vendor at all. Only Operations can set them. The settings endpoint rejects Client entirely. | All | Vendor (blocked), Client (blocked), Operations (sole writer) | This is a write-side rule distinct from the read-visibility restriction already noted in Section 5 for these same fields. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| Name | String | Display name of the Product | Vendor | Yes | Mutable After [State]?: No restrictions. Required on creation. |
| Short Description | String | Brief summary of the Product for catalogue display | Vendor | Yes | Mutable After [State]?: No restrictions. Nullable. |
| Long Description | String (html) | Full marketing description rendered on the Product page | Vendor | Yes | Mutable After [State]?: No restrictions. Nullable. |
| Icon | Image | Product icon displayed in the catalogue | Vendor | Yes | Mutable After [State]?: No restrictions. Required on creation. Uploaded as binary. Nullable after creation. |
| Website | URL | Vendor's product website | Vendor | Yes | Mutable After [State]?: No restrictions. Required on creation. |
| Status | Enum | Current state of the Product. One of: Draft, Pending, Published, Unpublished. Does **not** include a Deleted value — see Section 3.1. | System | Yes — via state transitions only | — |
| Revision | Integer | Increments on every update to the Product | System | Yes — auto-incremented | Read-only. Confirms Products are versioned in place. |
| External IDs | Object | External identifiers for the Product. Keys: `operations` (Operations-assigned ID), `defaultErpItem` (default ERP item code) | Vendor, Operations | Yes | Mutable After [State]?: No restrictions. Both keys are nullable strings. |
| Vendor | Object (AccountRef — lean summary shape: id, name, icon, revision, type, status) | Reference to the Account that owns this Product | System | No | Set at creation. Identifies the Vendor Account. Visible to all Actors. |
| Settings | Object | Behavioral configuration for the Product. See settings sub-fields below. | Vendor / Operations | Yes | Mutable After [State]?: No restrictions. Editable in all states including Published. Some sub-fields are restricted by Actor — see notes and BR-011/BR-012. |
| Statistics | Object | Computed platform metrics for this Product. Sub-fields: `itemCount`, `ordersPlacedCount`, `agreementCount`, `subscriptionCount`, `requestCount` | System | No — computed | Read-only. Computed by the platform. Visible to Vendor and Operations only — not Client. |
| settings.productOrdering | Boolean | Enables or disables ordering of this Product by Clients | Vendor | Yes | Actor Visibility: All. Vendor-writable only (no Operations command carries this field). |
| settings.productRequests | Object | Configures the Product Request feature. Sub-fields: `enabled` (boolean), `name` (string, nullable), `label` (string, nullable) | Vendor | Yes | Actor Visibility: All. Vendor-writable only. |
| settings.itemSelection | Boolean | Controls whether Clients can select individual Items when placing an Order | Vendor | Yes | Actor Visibility: All. Vendor-writable only. |
| settings.orderQueueChanges | Boolean | Enables queuing of Order changes | Vendor | Yes | Actor Visibility: All. Vendor-writable only. |
| settings.preValidation | Object | Configures pre-validation webhook triggers per Order type. Sub-fields: `purchaseOrderDraft`, `purchaseOrderQuerying`, `changeOrderDraft`, `configurationOrderDraft`, `terminationOrder`, `productRequest` (all boolean) | Vendor | Yes | Actor Visibility: All. Vendor-writable only. Each sub-field enables or disables pre-validation for that Order context. See `Notifications: Webhook` BR-003 for the corresponding `type` values this triggers. |
| settings.splitBilling | Object | Configures split billing. Sub-fields: `enabled` (boolean), `type` (string, nullable) | Operations | Yes | Actor Visibility: Client, Operations only — not Vendor (BR-012). Write access: Operations only, not Vendor, not Client (BR-012). When enabled, allows Clients to allocate percentages of subscription quantities to different Buyers, resulting in split invoicing. |
| settings.sendCostToErp | Boolean, nullable | Controls whether the billing module sends the real cost price to the SoftwareOne ERP | Operations | Yes | Actor Visibility: Operations only (read and write) — BR-012. When disabled, the billing module sends charges to the ERP with a zero cost price. |
| settings.subscriptionCessation | Object | Configures how subscription cessation is handled. Sub-fields: `enabled` (boolean), `mode` (enum: Termination, Auto-renewal, Termination or auto-renewal; nullable) | Vendor | Yes | Actor Visibility: All. Vendor-writable only. |
| settings.suspendResume.vendor | Boolean | Vendor-controlled sub-flag of the suspend/resume feature | Vendor | Yes | Actor Visibility: All (BR-011). Not observed as non-null in the fetched samples — likely unset/default on those specific Products. |
| settings.suspendResume.operations | Boolean | Operations-controlled sub-flag of the suspend/resume feature | Operations | Yes | Actor Visibility: Operations only (BR-011). |
| settings.customConfigurationOrders | Boolean | Enables custom Configuration Orders for this Product | Vendor | Yes | Actor Visibility: All. Not observed as non-null in the fetched samples. |

---

## 6. Relationships to Other Objects

> Captures structural and associative links between this object and others.
> Dynamic behaviors triggered by these relationships belong in Section 7.
>
> Relationship Types:
> - **Parent** — this object is a child of the related object
> - **Child** — the related object is a child of this object
> - **Association** — peer-level relationship, no lifecycle hierarchy
> - **Dependency** — this object depends on the related object but is not a child of it

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Product Template | Child | 1:Many | A Product owns a collection of Templates. | Yes — cascade-deleted if the parent Product is deleted while still in Draft state (T7, BR-002). Products cannot be deleted once they leave Draft, so this dependency only ever applies pre-publication. |
| Catalog: Product Parameter | Child | 1:Many | A Product owns a collection of Parameters. | Same as Product Template above. |
| Catalog: Product Parameter Group | Child | 1:Many | A Product owns a collection of Parameter Groups. | Same as Product Template above. |
| Catalog: Product Item | Child | 1:Many | A Product owns a collection of Items (orderable SKUs). | Same as Product Template above. |
| Catalog: Product Item Group | Child | 1:Many | A Product owns a collection of Item Groups. | Same as Product Template above. |
| Catalog: Product Terms | Child | 1:Many | A Product owns a collection of Terms objects. | Same as Product Template above — including Terms Variants beneath each Terms object. |
| Catalog: Product Media | Child | 1:Many | A Product owns a collection of Media objects. | Cascade-deleted alongside Documents/Icon when the parent Product is deleted in Draft state — same practical effect as the child types above. |
| Catalog: Product Document | Child | 1:Many | A Product owns a collection of Documents. | Cascade-deleted (record and stored file) when the parent Product is deleted in Draft state — same practical effect as the child types above. |
| Catalog: Price List | Child | 1:Many | A Product owns a collection of Price Lists. | Same as Product Template above (bulk-deleted, includes Price List Items). |
| Catalog: Authorization | Association | 1:Many | Authorizations reference a Product for sale eligibility. | Cascade-deleted alongside the Product if deleted in Draft state (BR-002). |
| Catalog: Listing | Association | 1:Many | Listings make a Product available for purchase. | Same as Authorization above. |
| Commerce: Order | Association | 1:Many | Orders are placed against a Product. | No — Product state changes do not cancel existing Orders. Order creation requires the Product to be Published. |
| Commerce: Agreement | Association | 1:Many | Agreements result from completed Orders against a Product. | No — Unpublishing a Product does not terminate existing Agreements. |
| Commerce: Asset | Association | 1:Many | Assets are provisioned under Agreements for a Product. | No — as above. |
| Commerce: Subscription | Association | 1:Many | Subscriptions are provisioned under Agreements for a Product. | No — as above. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Product created | Vendor creates Product | Vendor | Product enters Draft state. Revision counter initialised. Platform automatically creates the following default child objects: (1) one Item Group (Name: "Items", Label: "Items", Display order: 100, Description: "Default item group", Optional: false, Allow multiple: true, Default: true); (2) one Parameter Group (Name: "Parameters", Label: "Parameters", Display order: 100, Description: "Default parameter group", Default: true); (3) one Default Template for each of exactly three [[Order]] types: OrderProcessing, OrderQuerying, OrderCompleted. RequestProcessing is not a valid template type — it has been fully removed from the platform, not merely deprecated. This ensures the one-and-only-one Default invariant is satisfied from the moment of creation. |
| Product submitted | T2 — Draft to Pending | Vendor | Product enters Operations review queue. |
| Product published | T3 — Pending to Published | Operations | Product becomes visible and purchasable by Clients. |
| Product unpublished | T4 — Published to Unpublished | Vendor, Operations | Product removed from Client discovery. Existing Agreements unaffected. |
| Product republished | T5 — Unpublished to Published | Operations | Product restored to Client discovery. Vendor cannot perform this — see T5. |
| Product returned for review | T6 — Unpublished to Pending | Vendor | Product re-enters the Operations review queue from Unpublished state. |
| Product deleted | T7 — Draft to Deleted | Vendor | Cascade-deletes [[Item]]s, [[Item Group]]s, [[Parameter]]s, [[Parameter Group]]s, [[Template]]s, [[Terms]] (and [[Terms Variant]]s), [[Price List]]s (and [[Price List Item]]s), [[Authorization]]s, and [[Listing]]s; removes [[Document]]s/Media/Icon. Permanently removed — no longer retrievable via the API. |
| Product updated | Any attribute change | Vendor | Revision incremented. No state change. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Product unpublished | Order, Agreement, Asset, Subscription | No direct state effect. Existing transactional objects continue normally. | Yes | Always | Unpublishing does not interrupt in-flight or active downstream objects. State transitions only append to the audit trail — no domain event is raised for them. |
| Product deleted (Draft only) | Product Item, Product Item Group, Product Parameter, Product Parameter Group, Product Template, Product Terms (and Variants), Price List (and Price List Item), Authorization, Listing, Media, Documents, Icon | Removed alongside the Product. | Yes | Product must be in Draft state (BR-002) | Since only Draft Products qualify, none of these should have live [[Order]]s/[[Agreement]]s/[[Subscription]]s attached yet. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
- Published → Unpublished is reversible (T4/T5). No limit on cycles.
- Unpublished → Pending (T6) is available as an alternative to direct republication, returning the Product to the review queue.
- Draft → Pending (T2) cannot be undone by the Vendor (BR-004) — the only reversal path is Operations publishing it (T3), or Operations never acting (see Failure Modes).

**Deletion:**
A Product may be deleted by its Vendor only while in Draft state (T7). This is a soft delete — the object is excluded from all normal API responses going forward (permanently removed — no longer retrievable via the API) — and it cascades to remove: [[Item]]s, [[Item Group]]s, [[Parameter]]s, [[Parameter Group]]s, [[Template]]s, [[Terms]] (and [[Terms Variant]]s), [[Price List]]s (and [[Price List Item]]s), [[Authorization]]s, and [[Listing]]s, plus [[Document]]s, Media, and Icon. This is a documented exception to Platform Invariant 6 (see preamble). Once a Product leaves Draft state (Pending, Published, or Unpublished), it can never be deleted by any Actor.

**Audit & history requirements:**
The Product audit object records timestamps and Actor attribution for five events: created, updated, pending, published, and unpublished. The revision counter provides a change sequence. Full attribute history is retained via the platform Audit Trail — see Audit: Audit Record canon. State transitions (Review/Publish/Unpublish) do not raise a distinct domain/integration event — they only append an audit-trail entry — so no downstream event handler observes them.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Vendor edits behavioral settings on a Published Product with active downstream objects | Settings update is applied immediately. No warning or guard. | Client, Vendor | High | BR-005 permits this. Vendor takes full responsibility. Settings such as preValidation and subscriptionCessation could affect in-flight [[Order]]s or active [[Subscription]]s. |
| Product remains in Pending indefinitely (Operations never acts) | Product stays in Pending. Vendor has no exit mechanism. | Vendor | Medium | Operational process dependency. No system-level resolution path. |
| Operations publishes (or republishes) a Product with incomplete or low-quality content | Platform allows it — no validator or completeness check exists beyond the current-state guard (BR-010). | Client | Medium | No code path enforces "publishability" beyond state. Any manual review Operations performs is organizational practice, not a system-enforced gate. |
| Vendor deletes a Draft Product that has child objects (Items, Templates, etc.) already configured | All child objects, Authorizations, and Listings referencing it are cascade-deleted with no confirmation step beyond the delete call itself. | Vendor | Medium | Since deletion is Draft-only, no live [[Order]]s/[[Agreement]]s/[[Subscription]]s can be affected — but configuration work on the child objects is lost irrecoverably. |

---

## 10. Open Questions

No open questions at this time. A candidate question about whether Operations performs any manual/out-of-band publishability review (raised during this refresh) was resolved by removing the unconfirmed "publishability criteria" claim from canon entirely — see BR-010. A separate candidate question about downstream Notifications/PublicCatalog module sync on Product changes was explicitly skipped as out of scope for this object's canon.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.11 | 2026-07-16 | Stu / canon-generate | Now that `Catalog: Product Document` is canonised, added a Section 6 Child relationship row for it and bracket-linked the previously plain "Documents" mentions to `[[Document]]`s in BR-002, Section 7.1, and Section 8. No behavioural change — Documents were already documented in the Draft-deletion cascade. |
| 0.10 | 2026-07-16 | Stu / canon-generate | Reverts v0.9's Items change. Source research during the `Catalog: Product Terms` refresh found that deleting a Product removes its Items after all — the domain `Product.Delete()` method leaves Items untouched (v0.9's basis), but the delete-Product API path additionally runs a cleanup that removes the Product's Items. Items restored to the cascade in BR-002, Section 6, Section 7.1/7.2, Section 8, Section 9 (and preamble Invariant 6). A full re-verification of the delete-Product cascade for every listed child was then completed and confirmed the entire list — all listed children are removed on Draft-Product deletion. |
| 0.9 | 2026-07-16 | Stu / canon-generate | Product [[Item]]s removed from the Draft-deletion cascade (BR-002, Section 6 Item row, Section 7.1/7.2, Section 8, Section 9) — source research during the `Catalog: Product Item` refresh confirmed Items are independent aggregate records that Product deletion does not remove, and no guard blocks deleting a Draft Product that still has Items. Also removed from preamble Invariant 6's known-exception list. Only the Items claim was re-verified this run; the other listed children's cascade was not re-examined (see follow-up). |
| 0.8 | 2026-07-16 | Stu / canon-generate | BR-002 and Section 7.2 wording simplified — removed the implementation-level "removed via bulk delete" / "removed separately" mechanism distinction for how child objects, Documents, Media, and Icon are removed on Draft-Product deletion; the documented business outcome (all are removed) is unchanged. Surfaced during the `Catalog: Product Media` canon-generate refresh, which confirmed the two removal mechanisms are the same in practice. `[[Media]]` bracket-linked in BR-002. |
| 0.7 | 2026-07-15 | Stu / canon-generate | Major refresh via live OpenAPI schema (STAGING+PROD), live-fetched real objects (both environments, multi-Actor), and source-code research. ID Prefix corrected (was "None", is PRD). **Significant corrections**: deletion is possible in Draft state only, with real cascade behavior (BR-002; also added as a known exception to preamble Invariant 6) — corrects the prior "cannot be deleted in any state" claim throughout Sections 2/4/6/8/9; T5 Republish is Operations-only, not Vendor+Operations; new T6 transition discovered (Unpublished→Pending via the same Review action as T2); T2/T6's literal endpoint is `review`, not `submit` as previously assumed in `config/canon_path_segment_exclusions.json` (corrected there too); RequestProcessing default template is fully removed from the platform, not "deprecated, pending removal"; "Product meets publishability criteria" (T3 precondition) removed — not implemented anywhere in code (BR-010); write-side actor restrictions added for splitBilling/sendCostToErp (BR-012, corrects read-only documentation); two new settings fields documented (`suspendResume.vendor/operations` — BR-011, `customConfigurationOrders`). Section 6 now notes that Order creation requires the Product to be Published — full documentation of that precondition still belongs in `Commerce: Order`'s own future refresh. Confirmed the `vendor` reference's real runtime shape is always the lean AccountRef summary. |
| 0.6 | 2026-03-14 | Stu | Section 7.1: auto-creation of default child objects documented — one Default Item Group, one Default Parameter Group, and one Default Template per Order type are created automatically on Product creation. |
| 0.5 | 2026-03-14 | Stu | PRD-001 resolved. T1 preconditions updated — name, icon, website required on creation. T2 precondition confirmed as none. Section 5 required fields noted. PRD-001 and PRD-002 resolved and removed from open questions. |
| 0.4 | 2026-03-14 | Stu | Schema review against OpenAPI extract. Section 5: Vendor, Statistics attributes added; External IDs keys documented (operations, defaultErpItem); Settings expanded into Section 5.1 with full sub-field detail including splitBilling and sendCostToErp actor restrictions. Section 6: lifecycle dependency notes corrected — Products cannot be deleted so cascade language removed. Section 8: audit note reworded to remove JSON reference. Open questions formalised as PRD-NNN IDs; PRD-003 resolved. |
| 0.3 | 2026-03-09 | Stu | Description and Also Known As filled in. Section 6 expanded to all confirmed child objects with namespace qualification. Section 7 cascade on delete updated to cover all child types. Price List cascade on Product deletion flagged as open. |
| 0.2 | 2026-03-07 | Stu | State machine, business rules, attributes, relationships, and lifecycle events populated from conversation and Product JSON |
| 0.1 | 2026-03-07 | Stu | Stub created from known cross-references in Template canon |
