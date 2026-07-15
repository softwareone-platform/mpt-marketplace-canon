# Object Canon: Buyer

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-15
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Buyer

**Namespace:** Accounts

**Parent Object:** None — top-level Accounts object.

**ID Prefix:** BUY

**Description:**
A Buyer is the platform's record of a customer entity as it exists in SoftwareOne's ERP — the reconciled, master-data view of a purchasing organisation, synchronised from the ERP rather than authored on the platform. A Buyer is linked to at most one Client [[Account]] (the platform-side identity a customer transacts under) and, through ErpLink join records, to one or more [[Seller]]s (the SoftwareOne selling entities it does business with). Its status reflects the health of that reconciliation — whether it is assigned to an Account, whether its ERP identifiers are present, and whether the ERP data is internally consistent. Buyers are created and maintained primarily by an automated ERP-sync integration; Operations can also manage them directly, and a Client has limited rights over its own Account's Buyers.

**Also Known As:**
None known.

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | No | Yes* | No | No | *Read is row-scoped: a Vendor sees only Buyers reachable through a Commerce: [[Agreement]] where it is the Vendor (via the Agreement's Licensee), excluding Deleted Buyers. |
| Operations | Yes | Yes | Yes | Yes | Requires the platform Account Management module permission for every operation. Full field visibility, including the `errors` array. Soft-delete only — see BR-013. |
| Client | No | Yes* | Yes** | No | *Read is row-scoped to Buyers belonging to the Client's own [[Account]], excluding Deleted. **A Client with the Account Management module may update `name`, `address`, `externalIds`, `status`, and `errors` on its own Account's Buyers, and may Enable/Disable them — but only once the Buyer is ERP-activated, and cannot set `externalIds.erpCompanyContact`. In practice these fields are sourced from the ERP-sync integration. |

The `errors` array is visible to Operations only — suppressed for Vendor and Client. All other fields are visible to any Actor that can see the Buyer at all; visibility is otherwise governed by row-scoping (non-visible Buyers return 404), not field-level suppression.

---

## 3. State Machine

> Each transition specifies which Actor(s) are permitted to execute it.
> Buyer status is largely derived by the platform from two facts — whether an Account is assigned, and whether ERP identifiers are present — and is further overlaid by a reconciliation-error state. It is not a freely settable field.

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Unassigned | The Buyer is not linked to any [[Account]]. | Yes (when created without an Account) | No |
| Enabled | The Buyer is linked to an [[Account]] but has no ERP identifiers of its own yet — it is not ERP-activated and cannot be synchronised with the ERP. | Yes (when created with an Account but no ERP IDs) | No |
| Active | The Buyer is linked to an [[Account]] and carries its ERP identifiers — fully reconciled and operational. | Yes (when created with an Account and ERP IDs) | No |
| Disabled | The Buyer has been manually disabled from Active or Enabled. | No | No |
| Deleted | The Buyer has been soft-deleted. Remains retrievable to Operations; excluded from Vendor/Client row-scoped queries. | No | Yes |
| Conflict | Overlay state: an Unassigned Buyer that also has reconciliation errors. Returns to Unassigned when the errors clear. | No | No |
| Mismatch | Overlay state: an Active or Disabled Buyer that also has reconciliation errors. Returns to its pre-error status when the errors clear. | No | No |

> **On the overlay states (Conflict / Mismatch):** these are not entered by any endpoint. They are applied automatically when the platform's ERP-reconciliation computation attaches entries to the Buyer's `errors` array, and exited automatically when the errors clear — `Conflict` restores to `Unassigned`, `Mismatch` restores to the status held before the error (`Active` or `Disabled`). A Buyer in `Enabled` or `Deleted` status is never given errors.

### 3.2 Transitions

> Each row's From/To is a single status. Where an action's resulting status is derived from the Buyer's data (Account presence, ERP identifiers), the row shows the primary outcome and the Notes give the derivation. The Conflict/Mismatch overlays are not action-driven and are described in the 3.1 note and Section 7.2 rather than as rows here.

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1a | — | Unassigned | Create Buyer | `POST /v1/accounts/buyers` | Operations | `name` and `address` valid; no Account supplied | Initial status is derived — see BR-004. |
| T1b | — | Enabled | Create Buyer | `POST /v1/accounts/buyers` | Operations | Account supplied, no ERP identifiers | — |
| T1c | — | Active | Create Buyer | `POST /v1/accounts/buyers` | Operations | Account and ERP identifiers supplied | — |
| T2a | Active | Disabled | Disable Buyer | `POST /v1/accounts/buyers/{id}/disable` | Operations, Client (own Account) | — | — |
| T2b | Enabled | Disabled | Disable Buyer | `POST /v1/accounts/buyers/{id}/disable` | Operations, Client (own Account) | — | — |
| T3 | Disabled | Active | Enable Buyer | `POST /v1/accounts/buyers/{id}/enable` | Operations, Client (own Account) | — | Target status is re-derived — Active, or Enabled if the Buyer has no ERP identifiers, or Unassigned if it has no Account (BR-004). |
| T4 | Enabled | Active | Activate Buyer | `POST /v1/accounts/buyers/{id}/activate` | Operations | ERP company-contact and customer identifiers supplied and validated; Buyer has no pre-existing ERP identifiers | Sets the Buyer's ERP identifiers. |
| T5 | Unassigned | Active | Assign Account | `PUT /v1/accounts/buyers/{id}` (Account added) | Operations | Target is a Client [[Account]]; Buyer's `accountExternalId` (CDG) matches the Account's ERP identifier | Resulting status re-derived — Enabled instead if the Buyer has no ERP identifiers (BR-004, BR-008). |
| T6 | Active | Unassigned | Unassign Account | `PUT /v1/accounts/buyers/{id}` (Account removed) | Operations | No attached Licensee, no split-billing [[Agreement]], no certificates — see BR-011 | Also permitted from Disabled and Mismatch. |
| T7 | Active | Deleted | Delete Buyer | `DELETE /v1/accounts/buyers/{id}` | Operations | No non-deleted Licensee attached — see BR-013 | Soft-delete; permitted from any non-Deleted status. |

### 3.3 State Diagram

```
Creation (status derived from Account + ERP identifiers):
[—] --(Create, no Account)--------------> [Unassigned]
[—] --(Create, Account, no ERP IDs)-----> [Enabled]
[—] --(Create, Account + ERP IDs)-------> [Active]

Action-driven transitions:
[Unassigned] --(Assign Account)--> [Active]      (→ Enabled if no ERP IDs)
[Active]     --(Unassign Account)--> [Unassigned]   (also from Disabled / Mismatch)
[Enabled]    --(Activate)--> [Active]
[Active]     --(Disable)--> [Disabled]
[Enabled]    --(Disable)--> [Disabled]
[Disabled]   --(Enable)--> [Active]              (re-derived: Active / Enabled / Unassigned)
[any except Deleted] --(Delete, soft)--> [Deleted]   (terminal)

Error overlays (automatic, not action-driven — see 3.1 note and Section 7.2):
[Unassigned]        + errors <==> [Conflict]
[Active / Disabled] + errors <==> [Mismatch]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Buyer represents an ERP-side customer entity and is created and maintained primarily by the automated ERP-sync integration. Operations may also create and manage Buyers directly. | All | Operations | The ERP-sync integration acts under an ERP-sync API token. For an ERP-activated Buyer, `name`, `address`, `externalIds`, and the Seller relationships are sourced from the ERP even when another Actor submits them. |
| BR-002 | A Buyer is linked to at most one [[Account]], which must be of type Client. Many Buyers may share one Account. | All | All | The link is a direct reference on the Buyer, not mediated by ErpLink — contrast the Buyer–Seller relationship (BR-003). |
| BR-003 | A Buyer is related to [[Seller]]s through ErpLink join records — one ErpLink per (Buyer, Seller) pair. A Buyer may have many, one per Seller it does business with. | All | All | The `sellers` list on the Buyer is derived from its ErpLinks. See Accounts: [[ErpLink]]. The Seller set is ERP-controlled — for an ERP-activated Buyer, submitted seller relationships are ignored in favour of the ERP's own set. |
| BR-004 | A Buyer's status is derived, not freely set: no Account → Unassigned; Account but no ERP identifiers → Enabled; Account and ERP identifiers → Active. Submitting `Active` or `Enabled` is re-evaluated against this rule. | All | All | See Section 3. `Disabled` and `Deleted` are set by explicit actions, not derivation. |
| BR-005 | The `Conflict` and `Mismatch` statuses are reconciliation-error overlays applied automatically when the `errors` array becomes non-empty, and removed when it clears. `Conflict` overlays Unassigned; `Mismatch` overlays Active or Disabled. | All | Platform | An `Enabled` or `Deleted` Buyer is never assigned errors. See BR-006. |
| BR-006 | `errors` is an Operations-only array describing ERP-reconciliation problems for the Buyer. It is populated by the platform, not user-authored. | All | Operations | Confirmed causes include: the Buyer's CDG differing from its Account's ERP identifier; a missing ERP customer or CDG identifier; a still-referenced [[Seller]] having been removed in the ERP; and the Buyer not being found in the ERP. Suppressed for Vendor and Client. |
| BR-007 | A Buyer carries three ERP identifiers in `externalIds`: `erpCompanyContact`, `erpCustomer`, and `accountExternalId` (the CDG). `erpCompanyContact` is unique across all Buyers. | All | All | `erpCompanyContact` and `erpCustomer` are set at ERP-activation and are not independently re-settable afterward; `accountExternalId` is the CDG that keys the Buyer to its Client [[Account]]. Each is at most 250 characters; empty is normalised to null. |
| BR-008 | Assigning a Buyer to an [[Account]] requires the Buyer's `accountExternalId` (CDG) to equal the target Account's ERP identifier, and the target to be a Client Account. | Unassigned | Operations | A Buyer whose CDG resolves to no Account remains Unassigned. |
| BR-009 | ERP-activating a Buyer (Enabled → Active) requires both `erpCompanyContact` and `erpCustomer`, validated against the ERP, and is permitted only when the Buyer has no pre-existing ERP identifiers. | Enabled | Operations | `erpCompanyContact` and `erpCustomer` cannot be changed in the same operation. |
| BR-010 | `name` and `address` are required on creation and update. `taxId` is optional (maximum 18 characters). | All | Operations | Address requires all lines — line 1, post code, city, state, country. `name` maximum 500 characters. |
| BR-011 | Unassigning a Buyer's Account is blocked if the Buyer has an attached Accounts: Licensee, a split-billing Commerce: [[Agreement]], or held certificates, or if the Buyer is not ERP-activated. | Active, Disabled, Mismatch | Operations | Accounts: Licensee and Programs/Certificates are not yet canonised. |
| BR-012 | Transferring a Buyer to a different [[Account]] (ChangeAccount) is permitted from Active, Disabled, or Mismatch; the Buyer's status is otherwise unchanged by the transfer. | Active, Disabled, Mismatch | Operations | Via the `transfer` endpoint. A transfer to the same Account is a no-op. |
| BR-013 | Deleting a Buyer is a soft-delete: the record is retained with status `Deleted` and remains retrievable to Operations. It is blocked if any non-deleted Accounts: Licensee is attached. | Any except Deleted | Operations | There is no hard-delete endpoint. A Deleted Buyer cannot be updated. The only guard is the attached-Licensee check — an assigned Account or existing ErpLinks do not block deletion. |
| BR-014 | A Buyer is created only when both an ERP customer identifier and a CDG (`accountExternalId`) are known. | — (creation) | Operations | Enforced by the ERP-sync integration; a customer record lacking these is not synced into a Buyer. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | String | Unique platform identifier for the Buyer. | Platform | No | Format: BUY-XXXX-XXXX. Immutable. |
| `name` | String | Human-readable name of the Buyer (the ERP customer name). | Operations / ERP sync | Yes | Required. Maximum 500 characters. For an ERP-activated Buyer, sourced from the ERP. |
| `status` | Enum | Reconciliation status. One of: `Active`, `Enabled`, `Disabled`, `Deleted`, `Unassigned`, `Conflict`, `Mismatch`. | Platform (derived) / Operations (via actions) | Yes — platform-managed | Derived per BR-004; overlaid per BR-005. Not directly writable to an arbitrary value. |
| `address` | Object | The Buyer's registered address. Sub-fields: `addressLine1`, `addressLine2`, `postCode`, `city`, `state`, `country`. | Operations / ERP sync | Yes | Required — all sub-fields except `addressLine2` must be present. |
| `taxId` | String | Tax identifier for the Buyer. | Operations / ERP sync | Yes | Optional. Maximum 18 characters. Stored data-masked. |
| `externalIds.erpCompanyContact` | String | ERP company-contact identifier. | Operations (at activation) / ERP sync | No — set once at activation | Unique across all Buyers. Maximum 250 characters. |
| `externalIds.erpCustomer` | String | ERP customer identifier. | Operations (at activation) / ERP sync | No — set once at activation | Maximum 250 characters. |
| `externalIds.accountExternalId` | String | The CDG (Customer Discount Group) that keys the Buyer to its Client [[Account]] — equal to that Account's ERP identifier. | Operations / ERP sync | Yes | Maximum 250 characters. See BR-008. |
| `account` | Object | Reference to the Client Accounts: Account this Buyer is linked to. | Platform (resolved from CDG) | Yes — via Assign / Unassign / Transfer | Absent when Unassigned. The reference is resolved by the platform from `accountExternalId`; it is not set directly on the Buyer payload. |
| `sellers` | Array | The [[Seller]]s this Buyer is related to, derived from its ErpLink records. | Platform (from ErpLinks) | Yes — ERP-controlled | Each entry is a Seller reference. See BR-003 and Accounts: [[ErpLink]]. |
| `errors` | Array | ERP-reconciliation problems for the Buyer. | Platform | N/A | Operations-only — suppressed for Vendor and Client. Drives the Conflict/Mismatch overlay (BR-005, BR-006). Empty array when there are none. |
| `icon` | String | URL path to the Buyer's icon. Defaults to a server-generated jdenticon; a custom icon may be uploaded to replace it. | Operations | Yes | Nullable. See Preamble Section 9. |
| `revision` | Integer | Increments on each update. | Platform | N/A | Read-only. |
| `audit` | Object | Audit block. Sub-keys: `created`, `updated`, `activated`, `unassigned`, `disabled`. | Platform | N/A | Omitted by default — request via `select=+audit`. State-specific sub-keys are written only when the corresponding transition occurs (see Section 8). |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Accounts: Account | Association | Many Buyers to one Account | A Buyer is linked to at most one Client Account via a direct reference, resolved from the CDG. | No hard dependency — a Buyer may be Unassigned. Unassigning is guarded (BR-011). Account cannot be deleted. |
| Accounts: ErpLink | Parent of | One Buyer to many ErpLinks | Each ErpLink joins this Buyer to one Seller. The Buyer's `sellers` list is derived from these. | ErpLinks are created and removed by the ERP-sync reconciliation of the Buyer's seller set; removal is blocked while a Licensee references the (Buyer, Seller) pair. |
| Accounts: Seller | Association | Many Buyers to many Sellers | Mediated by ErpLink — a Buyer relates to each Seller through one ErpLink. | A Seller becoming Disabled forces its ErpLinks to Disabled at the next Buyer synchronisation; Seller status changes enqueue a Buyer re-sync. |
| Accounts: Licensee | Association | One Buyer to many Licensees | A Licensee is created from a Buyer. Attached Licensees guard Buyer unassign and delete. | Yes — a non-deleted Licensee blocks unassign (BR-011) and delete (BR-013). Accounts: Licensee is not yet canonised. |
| Commerce: Agreement | Association | — | A Buyer reaches a Vendor's visibility through an Agreement whose Licensee derives from the Buyer; split-billing Agreements guard unassign. | No direct lifecycle dependency. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Buyer created | Operations or ERP sync creates a Buyer | Operations | Status derived from Account + ERP IDs (BR-004). ErpLinks reconciled from the seller set. |
| Buyer activated | ERP identifiers set on an Enabled Buyer via the activate action | Operations | Status → Active. ERP identifiers become immutable. |
| Buyer assigned to Account | Account added via update to an Unassigned Buyer | Operations | Status re-derived; the Buyer's certificates are re-pointed to the new Account. Emits a buyer-assigned event. |
| Buyer unassigned | Account removed via update | Operations | Status → Unassigned. Guarded per BR-011. Emits a buyer-unassigned event. |
| Buyer transferred | Account changed via the transfer action | Operations | New Account set; status otherwise unchanged. Emits a buyer-transferred event. |
| Buyer disabled / enabled | Disable / Enable action | Operations, Client (own Account) | Status → Disabled, or re-derived on Enable. |
| Buyer deleted | Delete action | Operations | Soft-delete; status → Deleted. Guarded per BR-013. |
| ErpLink added / removed | Seller set reconciled during Buyer create/update/synchronize | Operations / ERP sync | An ErpLink is created or removed per (Buyer, Seller); emits buyer-erp-link-added / -removed events. See Accounts: [[ErpLink]]. |
| Reconciliation errors recomputed | Platform recomputes the Buyer's `errors` | Platform | Conflict/Mismatch overlay applied or cleared (BR-005). |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Buyer Account changed | Program / Certificate | The Buyer's certificates are re-pointed to the new Account. | Yes | On assign or transfer | Programs and Certificates are not yet canonised. |
| Buyer status or Account changed | Accounts: User | User-to-Buyer visibility assignments are recalculated. | Yes | On status or account change | — |
| Seller Disabled/Deleted (or reactivated) | Accounts: ErpLink | The Buyer is re-synchronised, forcing its ErpLinks for that [[Seller]] to Disabled (or re-enabling them). | Yes | Seller status change enqueues a Buyer re-sync | Evaluated at synchronisation time, not the instant the Seller changes. See Accounts: [[Seller]] and Accounts: [[ErpLink]]. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
The Active/Enabled ↔ Disabled cycle is reversible via the Disable and Enable actions. The Assign ↔ Unassign cycle (Account linkage) is reversible subject to the unassign guards (BR-011). The Conflict/Mismatch overlays are automatically reversible as errors clear. `Deleted` is terminal.

**Deletion:**
Buyer deletion is soft-delete only — the record is retained with status `Deleted` and remains retrievable to Operations. There is no hard-delete endpoint. Deletion is blocked while a non-deleted Accounts: Licensee is attached (BR-013). A `deactivate` action exists to strip ERP identifiers from an already-Deleted Buyer that still carries them; it does not change the `Deleted` status.

**Audit & history requirements:**
The audit block records `created` and `updated`, plus the state-specific timestamps `activated`, `unassigned`, and `disabled`. These state-specific sub-keys are written only when their transition occurs — `activated` when an Account is assigned, `unassigned` on unassign, `disabled` on disable — so they are absent on a Buyer that has not reached the corresponding state. Audit is omitted from responses by default (request via `select=+audit`). Prior values are not retained beyond the audit trail.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| ERP data disagrees across sources for the same Buyer | Reconciliation attaches entries to `errors`; the Buyer moves to Conflict (if Unassigned) or Mismatch (if Active/Disabled) until the disagreement is resolved. | Operations | Medium | The conflicting values and their sources are recorded in `errors` (Operations-only). |
| Buyer's CDG does not match its assigned Account's ERP identifier | A reconciliation error is recorded and the Buyer moves to Mismatch. | Operations | Medium | See BR-006, BR-008. |
| Buyer's CDG resolves to no Account | The Buyer remains Unassigned; it cannot transact until linked. | Operations, Client | Medium | Assignment requires a matching Client [[Account]] (BR-008). |
| A referenced Seller is removed in the ERP | The corresponding ErpLink is removed on the next Buyer sync — unless a Licensee still references the (Buyer, Seller) pair, in which case removal is blocked and a reconciliation error is recorded instead. | Operations | Medium | See Accounts: [[ErpLink]]. |
| Delete attempted while a Licensee is attached | Deletion is blocked. | Operations | Low | Operations must remove the Licensee relationship first (BR-013). |
| Unassign attempted while split-billing, Licensee, or certificate ties exist | Unassign is blocked. | Operations | Low | See BR-011. |
| Update attempted on a Deleted Buyer | Rejected — a Deleted Buyer cannot be modified. | Operations | Low | — |
| Synchronise attempted on a not-yet-activated (Enabled) Buyer | Rejected — a Buyer without ERP identifiers cannot be retrieved from the ERP. | Operations | Low | ERP-activate the Buyer first (BR-009). |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-15 | Stu / canon-generate | Initial canon. Generated via live OpenAPI schema, live-fetched real object (STAGING, all Actors), and source-code research across the core platform (swo-platform) and the ERP-sync extension (swo-extension-nav). Documents the seven-status ERP-reconciliation model (including the Conflict/Mismatch error overlays and their derivation), the derived-status rule, the Account linkage (direct reference, Client-type, CDG-keyed) and Seller linkage (via ErpLink), the Operations-only `errors` array, the full action-endpoint set, soft-delete with the attached-Licensee guard, and the ERP-sync ownership model. |
