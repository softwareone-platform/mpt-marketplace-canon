# Object Canon: ErpLink

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-15
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** ErpLink

**Namespace:** Accounts

**Parent Object:** None — top-level Accounts object (a join record between a Buyer and a Seller).

**ID Prefix:** ERP

**Description:**
An ErpLink is the join record that relates one [[Buyer]] to one [[Seller]] — the per-Seller projection of a Buyer's ERP customer data. It represents how a given customer entity is integrated within the scope of a specific SoftwareOne selling entity, carrying that instance's ERP identifiers, address, and ship-to / bill-to detail. ErpLinks are created and removed by the automated ERP-sync integration as it reconciles a Buyer's set of Sellers; the platform exposes them for reading and for a narrow set of Operations actions (blocking, unblocking, and editing an internal note), but not for direct creation or deletion.

**Also Known As:**
None known.

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | No | Yes* | No | No | *Read is row-scoped: a Vendor sees only ErpLinks whose [[Buyer]] is reachable through a Commerce: [[Agreement]] where it is the Vendor, excluding ErpLinks of Deleted Buyers. |
| Operations | No | Yes | Yes* | No | Requires the platform Account Management module permission. *Can Block and Unblock a link and edit its internal `note` (and icon); cannot create or delete. Full field visibility. |
| Client | No | Yes* | No | No | *Read is row-scoped to ErpLinks whose [[Buyer]] belongs to the Client's own [[Account]], excluding Deleted Buyers. |

Five fields are visible to Operations only — `note`, `externalIds`, `address`, `shipTo`, and `billTo` — and suppressed for Vendor and Client. The always-visible fields are `buyer`, `seller`, `companyName`, and `status` (plus `id`, `name`, `icon`, `revision`, `audit`). Beyond that, visibility is governed by row-scoping (non-visible ErpLinks return 404), not field-level suppression.

---

## 3. State Machine

> ErpLink status reflects both an Operations-driven block state and a system-driven disabled state tied to the linked Seller.

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Active | The link is operational. | Yes | No |
| Blocked | The link has been blocked — in practice because the customer is blocked in the ERP. Set via the Block action; reversible via Unblock. | No | No |
| Disabled | System-controlled: set automatically when the linked [[Seller]] is Disabled, and reversed when the Seller is no longer Disabled. Cannot be changed by user actions while in this state. | No | No |

> An ErpLink is always created in `Active` — it cannot be created in `Blocked`. It has no `Deleted` status; removal is a permanent deletion of the join record during ERP-sync reconciliation (see Section 8), not a status.

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Active | Create (ERP-sync reconciliation) | (no endpoint — created during [[Buyer]] synchronisation) | Platform | — | ErpLinks are minted by the platform when a Buyer's Seller set is reconciled. Cannot be created Blocked. |
| T2 | Active | Blocked | Block link | `POST /v1/accounts/erp-links/{id}/block` | Operations | Link not Disabled; [[Buyer]] is ERP-activated; no active Accounts: Licensee on the (Buyer, Seller) pair; linked [[Seller]] not Disabled or Deleted | See BR-005. In practice driven by the ERP-sync integration reflecting an ERP-side customer block. |
| T3 | Blocked | Active | Unblock link | `POST /v1/accounts/erp-links/{id}/unblock` | Operations | Link not Disabled; [[Buyer]] is ERP-activated | — |
| T4a | Active | Disabled | Disable link (Seller Disabled) | (no endpoint — system, at [[Buyer]] synchronisation) | Platform | Linked [[Seller]] became Disabled | Records the prior status for later restore. |
| T4b | Blocked | Disabled | Disable link (Seller Disabled) | (no endpoint — system, at [[Buyer]] synchronisation) | Platform | Linked [[Seller]] became Disabled | Records the prior status for later restore. |
| T5a | Disabled | Active | Enable link (Seller no longer Disabled) | (no endpoint — system, at [[Buyer]] synchronisation) | Platform | Linked [[Seller]] no longer Disabled; prior status was Active | Restores the status held before Disable. |
| T5b | Disabled | Blocked | Enable link (Seller no longer Disabled) | (no endpoint — system, at [[Buyer]] synchronisation) | Platform | Linked [[Seller]] no longer Disabled; prior status was Blocked | Restores the status held before Disable. |

### 3.3 State Diagram

```
[—] --(created during Buyer sync : Platform)--> [Active]
[Active] --(Block : Operations)--> [Blocked]
[Blocked] --(Unblock : Operations)--> [Active]
[Active] --(Seller Disabled : Platform)--> [Disabled]
[Blocked] --(Seller Disabled : Platform)--> [Disabled]
[Disabled] --(Seller no longer Disabled : Platform)--> [Active]   (or [Blocked] — restores prior status)

(no status transition: removal — the join record is permanently removed during
 Buyer sync when the Seller drops off the Buyer's ERP-side set — see Section 8)
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An ErpLink joins exactly one [[Buyer]] to exactly one [[Seller]]. The (Buyer, Seller) pair is unique. | All | All | A Buyer has one ErpLink per Seller it relates to; a Seller has one per Buyer — the many-to-many join between the two. |
| BR-002 | ErpLinks are created and removed only by the platform's ERP-sync reconciliation of a [[Buyer]]'s Seller set — there is no create or delete endpoint. | All | Platform | Reconciliation runs when a Buyer is created, updated, or synchronised: links are added for new Sellers and permanently removed for Sellers no longer in the Buyer's ERP-side set. |
| BR-003 | The public API exposes reading, a `note`/icon update, and the Block / Unblock actions. Of the writable business fields, only `note` is persisted via update — `externalIds`, `address`, `shipTo`, and `billTo` are maintained by the ERP-sync integration and are effectively read-only over the API. | All | Operations | A submitted value for the ERP-owned fields is ignored. |
| BR-004 | An ErpLink is created in `Active` and can never be created in `Blocked`. | — (creation) | Platform | — |
| BR-005 | Blocking a link is permitted only when the link is not Disabled, its [[Buyer]] is ERP-activated, no active Accounts: Licensee exists on the (Buyer, Seller) pair, and the linked [[Seller]] is neither Disabled nor Deleted. Unblocking requires the link not to be Disabled and the Buyer to be ERP-activated. | Active, Blocked | Operations | A Disabled link cannot be blocked or unblocked by any user action (BR-006). |
| BR-006 | The `Disabled` status is system-controlled: the platform sets it when the linked [[Seller]] is Disabled and restores the prior status when the Seller is no longer Disabled. A user cannot change the status of a Disabled link. | All | Platform | Disabled links are retained (not removed) so historical data stays addressable. |
| BR-007 | An ErpLink carries the ERP identifiers for its (Buyer, Seller) instance in `externalIds`: `erpCompanyContact`, `erpCustomer`, and `accountExternalId` (the CDG). | All | Operations | These mirror the [[Buyer]]'s ERP identifiers as scoped to this Seller instance. Operations-only. |
| BR-008 | `note` is an internal free-text field. The ERP-sync integration stamps it with the reason when it blocks a link; it is otherwise Operations-editable. | All | Operations | Operations-only. Maximum length platform-enforced. |
| BR-009 | Removal of an ErpLink during reconciliation is blocked while a non-deleted Accounts: Licensee references the (Buyer, Seller) pair; the platform records a reconciliation error on the [[Buyer]] instead. | All | Platform | Accounts: Licensee is not yet canonised. |
| BR-010 | `shipTo` and `billTo` hold the customer's delivery and invoice addresses respectively, as they exist in this Seller's ERP instance, synchronised from the ERP. Each address carries its ERP-side code as `externalId`. | All | Operations | These addresses are held on the ErpLink rather than the [[Buyer]] because a Buyer spans multiple ERP instances while these addresses are specific to one. Operations-only — not surfaced in the platform UI, available only via the API. Empty when the ERP record has none. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | String | Unique platform identifier for the ErpLink. | Platform | No | Format: ERP-XXXX-XXXX-XXXX. Immutable. |
| `name` | String | Human-readable label for the link. | Platform (derived) | N/A | Derived as "[Buyer name] - [Seller name]"; not independently stored or editable. |
| `buyer` | Object | Reference to the joined Accounts: Buyer. | Platform | No | Set at creation. Part of the unique (Buyer, Seller) pair — see BR-001. |
| `seller` | Object | Reference to the joined Accounts: Seller. | Platform | No | Set at creation. Part of the unique (Buyer, Seller) pair. |
| `companyName` | String | The customer/company name for this ERP instance. | ERP sync | Yes — ERP-controlled | Stored data-masked. |
| `status` | Enum | Link status. One of: `Active`, `Blocked`, `Disabled`. | Operations (Block/Unblock) / Platform (Disabled) | Yes | See Section 3. `Disabled` is system-only. |
| `note` | String | Internal note; carries the ERP block reason when the link is blocked. | Operations / ERP sync | Yes | Operations-only. See BR-008. |
| `externalIds.erpCompanyContact` | String | ERP company-contact identifier for this instance. | ERP sync | Yes — ERP-controlled | Operations-only. |
| `externalIds.erpCustomer` | String | ERP customer identifier for this instance. | ERP sync | Yes — ERP-controlled | Operations-only. |
| `externalIds.accountExternalId` | String | The CDG (Customer Discount Group) for this instance. | ERP sync | Yes — ERP-controlled | Operations-only. |
| `address` | Object | The Buyer's address within this Seller's ERP instance. Sub-fields: `addressLine1`, `addressLine2`, `postCode`, `city`, `state`, `country`. | ERP sync | Yes — ERP-controlled | Operations-only. |
| `shipTo` | Array | Delivery (ship-to) addresses for this customer within this Seller's ERP instance. Each entry carries an `externalId` (the ERP ship-to code), `name`, and address. | ERP sync | Yes — ERP-controlled | Operations-only. Empty when the ERP record has none. See BR-010. |
| `billTo` | Array | Invoice (bill-to) addresses for this customer within this Seller's ERP instance. Each entry carries an `externalId` (the ERP bill-to code), `name`, and address. | ERP sync | Yes — ERP-controlled | Operations-only. Empty when the ERP record has none. See BR-010. |
| `icon` | String | URL path to the link's icon. Defaults to a server-generated jdenticon; a custom icon may be uploaded to replace it. | Operations | Yes | Nullable. See Preamble Section 9. |
| `revision` | Integer | Increments on each update. | Platform | N/A | Read-only. |
| `audit` | Object | Audit block. Sub-keys: `created`, `updated`, `blocked`, `unblocked`, `disabled`. | Platform | N/A | Omitted by default — request via `select=+audit`. State-specific sub-keys are written only when the corresponding transition occurs. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Accounts: Buyer | Parent | Many ErpLinks to one Buyer | The Buyer whose ERP integration this link represents in scope of one Seller. | Yes — an ErpLink exists only as part of a Buyer's reconciled Seller set; it is created and removed by that reconciliation. Blocking/unblocking a link re-synchronises the Buyer. |
| Accounts: Seller | Parent | Many ErpLinks to one Seller | The Seller in whose scope this link exists. | Yes — the Seller becoming Disabled forces the link to Disabled (and reversal on re-enable), evaluated at the next Buyer synchronisation. |
| Accounts: Licensee | Association | — | A Licensee on the (Buyer, Seller) pair blocks both blocking the link and removing it. | Yes — a non-deleted Licensee guards Block (BR-005) and removal (BR-009). Accounts: Licensee is not yet canonised. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| ErpLink created | A [[Buyer]]'s Seller set is reconciled and a new (Buyer, Seller) pairing appears | Platform | Link created in Active. Emits a buyer-erp-link-added event scoped to the Buyer. |
| ErpLink removed | Reconciliation finds a Seller no longer in the Buyer's ERP-side set | Platform | Link permanently removed — unless guarded by a Licensee (BR-009). Emits a buyer-erp-link-removed event. |
| Link blocked | Block action | Operations | Status → Blocked; `note` stamped with the block reason. Re-synchronises the parent [[Buyer]]. |
| Link unblocked | Unblock action | Operations | Status → Active. Re-synchronises the parent [[Buyer]]. |
| Link disabled / enabled | Linked [[Seller]] Disabled / no longer Disabled, at Buyer sync | Platform | Status → Disabled (prior status recorded), or restored on re-enable. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Link blocked or unblocked | Accounts: Buyer | The parent Buyer is re-synchronised, which recomputes its reconciliation state. | Yes | On every Block/Unblock | — |
| Seller status change | Accounts: ErpLink | A Buyer re-sync is enqueued; at that sync each affected link is forced to Disabled or restored. | Yes | [[Seller]] Disabled/Deleted or reactivated | Mediated by an asynchronous Buyer re-sync, not applied the instant the Seller changes. See Accounts: [[Seller]]. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
The Active ↔ Blocked cycle (Block / Unblock) is reversible with no confirmed limit on cycles. The system-driven Active/Blocked ↔ Disabled cycle is reversible — the prior status is restored when the linked [[Seller]] is no longer Disabled.

**Deletion:**
ErpLink has no delete endpoint and no `Deleted` status. A link is permanently removed — no longer retrievable via the API — only as a side effect of ERP-sync reconciliation, when its [[Seller]] drops off the parent [[Buyer]]'s ERP-side set. Removal is blocked while a non-deleted Accounts: Licensee references the (Buyer, Seller) pair (BR-009). A link whose Seller is Disabled is retained (moved to Disabled), not removed, so historical data stays addressable.

**Audit & history requirements:**
The audit block records `created` and `updated`, plus the state-specific timestamps `blocked`, `unblocked`, and `disabled`, each written only when its transition occurs. Audit is omitted from responses by default (request via `select=+audit`). Prior values are not retained beyond the audit trail.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Block attempted while the linked Seller is Disabled or Deleted | Rejected — a link cannot be blocked when its [[Seller]] is Disabled or Deleted. | Operations | Low | See BR-005. |
| Block or unblock attempted on a Disabled link | Rejected — a Disabled link's status cannot be changed by user actions. | Operations | Low | The Disabled state is system-controlled by Seller status (BR-006). |
| Block or unblock attempted while the Buyer is not ERP-activated | Rejected — the parent [[Buyer]] must be ERP-activated. | Operations | Low | — |
| Block attempted while a Licensee exists on the pair | Rejected. | Operations | Low | A non-deleted Accounts: Licensee guards the block (BR-005). |
| Seller removed in the ERP while a Licensee references the pair | The link is not removed; the platform records a reconciliation error on the parent [[Buyer]] instead. | Operations | Medium | See BR-009 and Accounts: [[Buyer]]. |
| Client attempts to update the ERP-owned fields via API | Ignored — `externalIds`, `address`, `shipTo`, and `billTo` are maintained by ERP sync; only `note`/icon are persisted, and only for Operations. | Operations | Low | See BR-003. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-15 | Stu / canon-generate | Initial canon. Generated via live OpenAPI schema, live-fetched real objects (STAGING, all Actors, including Active and Blocked samples), source-code research across the core platform and the ERP-sync extension, and the Cloud-iQ integration design documentation for the ship-to/bill-to model. Documents the Buyer–Seller join model with its unique pairing, the create/remove-only-via-Buyer-sync mechanism, the three-status model (Operations-driven Block/Unblock plus system-driven Disabled tied to Seller status) and its guards, the five Operations-only ERP-detail fields (including the newly added, per-ERP-instance ship-to/bill-to address collections), the note/icon-only update surface, and the removal-with-Licensee-guard behavior. |
