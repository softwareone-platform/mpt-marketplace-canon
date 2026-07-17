# Object Canon: Agreement Split Billing

> **Version:** 0.2
> **Owner:** Stu
> **Last Updated:** 2026-07-17
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Agreement Split Billing

**Namespace:** Commerce

**Parent Object:** Commerce: Agreement

**ID Prefix:** SBA

**Description:**
Agreement Split Billing is the configuration that distributes a Commerce: [[Agreement]]'s billing across more than one [[Buyer]], so that a single commercial relationship can be invoiced to several paying entities. It holds a set of per-Buyer allocations — each a share of the Agreement's price — and is created by activating split billing on the Agreement once. It exists only for Agreements whose Catalog: [[Product]] permits split billing, and its allocations are a roll-up of the split allocations held on the Agreement's [[Subscription]]s' own split configurations (Commerce: [[Subscription Split Billing]]) — this object is the Agreement-level view.

**Also Known As:**
Split Billing.

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | No | No | No | No | No API access at all — the `/split` endpoints return HTTP 403 for the Vendor. |
| Operations | Yes | Yes | Yes | No | "Create" means activating split billing. Eligible allocation Buyers are those under the Agreement's Seller and Client Account. No deactivation or delete exists. |
| Client | Yes* | Yes* | Yes* | No | *Scoped to the Client's own Account; eligible allocation Buyers are the Client's own Account's Buyers. No deactivation or delete exists. |

There is no Actor-based suppression of whole allocations, but the per-allocation `price` sub-fields differ by Actor — see Section 5. The Vendor cannot reach this object at all.

---

## 3. State Machine

> Agreement Split Billing has no status field of its own. Its lifecycle is minimal: it does not exist until split billing is activated on the Agreement, and once activated it persists permanently — there is no deactivation or deletion. Updates re-distribute allocations without changing state.

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Activated | Split billing exists on the Agreement and its allocations are in effect. The object's existence is its state — there is no status field. Permanent: it cannot be deactivated or deleted. | Yes | Yes |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Activated | Activate split billing | `POST /v1/commerce/agreements/{id}/split` | Client (own Account) or Operations | Catalog: Product has split billing enabled; split not already activated; the supplied allocations include the default Buyer; all requested Buyers are eligible | Cannot be repeated once activated. No deactivation or delete transition exists. Updating allocations (`PUT`) does not change state. |

### 3.3 State Diagram

```
— ---(Activate split billing : Client/Operations)---> [Activated]   (permanent; no deactivation)
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An Agreement Split Billing belongs to exactly one Commerce: [[Agreement]] and distributes that Agreement's billing across [[Buyer]]s through a set of allocations. | All | All | At most one split billing configuration exists per Agreement. |
| BR-002 | Split billing can be activated only when the Agreement's Catalog: [[Product]] has split billing enabled. | Activated | Client, Operations | Governed by the Product's `settings.splitBilling`. Activation is otherwise rejected. |
| BR-003 | Only the Client (for its own [[Account]]) or Operations can read or manage split billing; the Vendor has no access. | All | Vendor (blocked) | The `/split` endpoints return HTTP 403 for the Vendor. |
| BR-004 | The default Buyer — the Agreement's [[Licensee]]'s Buyer — must be present in the allocations and is seeded at 100% on activation. It cannot be removed. | All | Client, Operations | Non-default Buyers are seeded at 0%. Its allocation `externalIds.client` cannot be set null. |
| BR-005 | Once activated, split billing cannot be deactivated or deleted, and activation cannot be repeated. | Activated | All | Permanent for the life of the Agreement. Allocations can only be re-distributed via update. |
| BR-006 | On update, the caller supplies only the set of [[Buyer]]s to allocate across; the platform computes each allocation's percentage, price, and statistics. A caller-supplied percentage is ignored. | Activated | Client, Operations | The only caller-writable allocation field is `externalIds.client`, and only on the default Buyer's allocation. |
| BR-007 | Allocation percentages are computed by the platform as each Buyer's share of Subscription selling price and are a roll-up of the Agreement's Subscription-level split allocations. | Activated | Platform | Rounded to two decimals. The platform does not enforce that Agreement-level percentages sum to 100 — that constraint is applied at the Subscription level. |
| BR-008 | A [[Buyer]] can be removed from the allocations only if it holds no active Subscription-level split allocation. | Activated | Client, Operations | Removal is otherwise rejected. Removing an eligible Buyer also strips it from the Agreement's Subscription-level split allocations. |
| BR-009 | Eligible allocation Buyers are Actor-scoped: Operations may allocate to Buyers under the Agreement's [[Seller]] and Client [[Account]]; the Client may allocate only to Buyers in its own Account. | All | Client, Operations | A Buyer outside the eligible set is rejected. |
| BR-010 | Activating split billing seeds every [[Subscription]] on the Agreement with a split allocation (100% to the default Buyer) and sets each Subscription's split status to Active. Subscriptions added afterward are auto-enrolled. | Activated | Platform | Automated. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | String | Unique platform identifier. | Platform | No | Format `SBA-XXXX-XXXX`. |
| `revision` | Integer | Increments on each update. | Platform | Yes — platform-managed | — |
| `audit` | Object | Object-level audit. Sub-keys: `created`, `updated`. | Platform | No | — |
| `allocations` | Array | Per-Buyer allocations of the Agreement's billing. | Client / Operations (Buyer set), Platform (computed values) | Yes | See the per-allocation attributes below. |
| `allocations[].buyer` | Object (reference) | The Buyer this allocation bills. | Client / Operations | Yes — via the allocation set | Must be eligible (see BR-009); the default Buyer is mandatory (BR-004). |
| `allocations[].percentage` | Number | This Buyer's share of the Agreement's billing. | Platform | Yes | Platform-computed, two decimals — see BR-006/BR-007. |
| `allocations[].price` | Object | This Buyer's share of the Agreement price: `currency`, `SPxY`, `SPxM`, `PPxY`, `PPxM`. | Platform | Yes | `currency` visible to all; `SPxY`/`SPxM` visible to Client and Operations; `PPxY`/`PPxM` visible to Operations only. The Vendor cannot see this object at all. |
| `allocations[].statistics.subscriptions` | Integer | Number of the Agreement's Subscriptions allocated to this Buyer. | Platform | Yes | Counts Subscriptions with a non-zero allocation to this Buyer. |
| `allocations[].externalIds.client` | String | Client's own reference for this allocation. | Client / Operations | Yes | Caller-writable only for the default Buyer's allocation; set from the Agreement's client external id on activation and kept in sync. Cannot be null for the default Buyer. |
| `allocations[].audit` | Object | Per-allocation audit. Sub-keys: `created`, `updated`. | Platform | No | — |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Commerce: Agreement | Parent | One Agreement to one split configuration | The Agreement whose billing this object splits. | Cannot exist without the Agreement. Created by activating split billing on the Agreement; permanent once activated. |
| Commerce: Subscription | Association | One Agreement split to many Subscription splits | The Agreement-level allocations are a roll-up of the split allocations held on the Agreement's Subscriptions. Activation seeds and enrols every Subscription. | Activation cascades to all Subscriptions; removing a Buyer strips it from Subscription allocations. |
| Accounts: Buyer | Association | One split to many Buyers | The Buyers across which billing is allocated. The default Buyer is mandatory. | A Buyer participating in split billing cannot be unassigned from, or transferred out of, its Account. |
| Accounts: Licensee | Association | Many splits to one Licensee | Determines the default (owner) Buyer — the Licensee's Buyer. | No direct lifecycle dependency. |
| Catalog: Product | Association | Many splits to one Product | The Product's `settings.splitBilling` gates whether split billing can be activated for the Agreement. | Activation is blocked if the Product does not permit split billing. |
| Accounts: Seller | Association | Many splits to one Seller | Scopes the Buyers Operations may allocate to. | No direct lifecycle dependency. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Split billing activated | `POST /split` | Client, Operations | The split configuration is created; every [[Subscription]] on the Agreement is seeded with a 100%-default-[[Buyer]] allocation and set to split-active. No Agreement-level bus event is published. |
| Allocations updated | `PUT /split` | Client, Operations | The Buyer set is changed; the platform recomputes percentages and prices. Removed Buyers are stripped from Subscription-level allocations (which emit their own Subscription split events). |
| Default Buyer external id synced | The Agreement's client external id changes | Platform | The default Buyer's allocation `externalIds.client` is updated to match. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Split billing activated | Commerce: Subscription | Each Subscription is seeded with a split allocation (100% to the default [[Buyer]]) and its split status is set to Active | Yes — platform | `POST /split` succeeds | See BR-010. |
| Buyer removed from allocations | Commerce: Subscription | The removed [[Buyer]] is stripped from the Agreement's Subscription-level split allocations | Yes — platform | `PUT /split` removes a Buyer | Blocked if that Buyer still holds an active Subscription-level allocation (BR-008). |
| Split billing active with a participating Buyer | Accounts: Buyer | The [[Buyer]] cannot be unassigned from, or transferred out of, its Account | Yes — platform | Buyer participates in a split billing Agreement | See Accounts: [[Buyer]]. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
None. Activation is one-way — there is no deactivation and no deletion. Allocations can be re-distributed through update, but the split billing configuration itself is permanent for the life of the Agreement.

**Deletion:**
There is no delete endpoint and no deactivation mechanism. Once activated, an Agreement Split Billing configuration exists permanently. Individual [[Buyer]] allocations can be removed via update (subject to BR-008), but the configuration as a whole cannot be removed.

**Audit & history requirements:**
The object carries a `created`/`updated` audit block, and each allocation carries its own `created`/`updated` audit. Prior allocation values (percentages, prices) are not retained beyond the audit trail.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Activation attempted when the Catalog: [[Product]] does not permit split billing | Rejected. | Client, Operations | Low | Governed by the Product's `settings.splitBilling` (BR-002). |
| Activation attempted when split billing is already active | Rejected — activation cannot be repeated. | Client, Operations | Low | Split billing is permanent once activated (BR-005). |
| Allocation set omits the default [[Buyer]] | Rejected — the default Buyer is mandatory. | Client, Operations | Low | See BR-004. |
| A [[Buyer]] with an active Subscription-level allocation is removed on update | Rejected — the Buyer must first have no active Subscription-level allocation. | Client, Operations | Medium | See BR-008. |
| Allocation to a [[Buyer]] outside the eligible set | Rejected. | Client, Operations | Low | Eligibility is Actor-scoped (BR-009). |
| The Vendor attempts to read or manage split billing | HTTP 403 — the Vendor has no access. | Vendor | Low | Client and Operations only (BR-003). |
| A caller supplies percentages on update expecting them to take effect | Ignored — allocation percentages are platform-computed from the Subscription-level allocations. | Client, Operations | Medium | Only the Buyer set (and the default Buyer's `externalIds.client`) is caller-writable (BR-006). |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.2 | 2026-07-17 | Stu / canon-generate | Section 1 updated while canonising Commerce: Subscription Split Billing: the Subscription-scoped split configuration is now a distinct object, so the "not yet mirrored by a distinct canon" note is dropped and `[[Subscription Split Billing]]` is cross-linked. |
| 0.1 | 2026-07-16 | Stu / canon-generate | Initial canon. Generated via live OpenAPI schema (STAGING), a multi-Actor live fetch of a split-active Agreement, and source-code research. Documents the Agreement-scoped split billing object (`SBA`): no status field (present-vs-absent, permanent once activated, no deactivation/delete); activation preconditions (Product-enabled, default-Buyer inclusion, not-already-active, Buyer eligibility) with no Agreement-status gate; the caller-supplies-Buyers / platform-computes-percentages update model; the default-Buyer 100% seed and Subscription cascade; per-allocation price visibility (Client sees SP, Operations adds PP, Vendor 403); Actor-scoped Buyer eligibility; and the Buyer unassign/transfer guard. 0 open questions. |
