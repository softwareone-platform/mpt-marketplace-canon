# Object Canon: Subscription Split Billing

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-17
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Subscription Split Billing

**Namespace:** Commerce

**Parent Object:** Commerce: Subscription

**ID Prefix:** SBS

**Description:**
Subscription Split Billing is the configuration that distributes a single Commerce: [[Subscription]]'s billing across more than one [[Buyer]], so that the Subscription can be invoiced to several paying entities. It holds a set of per-Buyer allocations, each an explicit percentage share of the Subscription's price. It is the Subscription-level counterpart of Commerce: [[Agreement Split Billing]]: the allocations here are where the percentage split is actually set, and the Agreement-level allocations are a platform-computed roll-up of the Subscription-level ones across all the [[Agreement]]'s [[Subscription]]s. A Subscription Split Billing is not created on its own — it comes into existence when split billing is activated on the parent [[Agreement]], which seeds every [[Subscription]] with one.

**Also Known As:**
Split Billing.

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | No | No | No | No | No API access at all — both the `GET` and `PUT` `/split` endpoints return HTTP 403 for the Vendor. |
| Operations | No* | Yes | Yes | No | *No direct create — the split is seeded by Agreement Split Billing activation (BR-002). Operations can update allocations, including while the Subscription is Suspended. |
| Client | No* | Yes* | Yes* | No | *Scoped to the Client's own Account. No direct create; cannot update while the Subscription is Suspended (BR-010). |

There is no Actor-based suppression of whole allocations, but the per-allocation `price` sub-fields differ by Actor — see Section 5. The Vendor cannot reach this object at all.

---

## 3. State Machine

> Subscription Split Billing has no status field of its own. Its lifecycle is present-vs-absent: it does not exist until split billing is activated on the parent Agreement (which seeds it), and once seeded it persists for the life of the Subscription — there is no deactivation or deletion. Updates re-distribute allocations without changing state. (The parent Subscription's own `splitStatus` field reflects whether a split exists — see BR-013.)

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Active | Split billing exists on the Subscription and its allocations are in effect. The object's existence is its state — there is no status field. Permanent: it cannot be deactivated or deleted. | Yes | Yes |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Active | Split seeded on the Subscription | No dedicated endpoint — cascade from Agreement Split Billing activation (`POST /v1/commerce/agreements/{id}/split`), or auto-enrolment when a Subscription is added to a split-active Agreement | Platform | Split billing activated on the parent Agreement | Seeded with a single allocation of 100% to the default Buyer. There is no `POST` on the Subscription `/split` endpoint — the split cannot be created independently. Updating allocations (`PUT`) does not change state. |

### 3.3 State Diagram

```
— ---(Seeded by Agreement split activation : Platform)---> [Active]   (permanent; no deactivation)
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Subscription Split Billing belongs to exactly one Commerce: [[Subscription]] and distributes that Subscription's billing across [[Buyer]]s through a set of allocations. | All | All | At most one split billing configuration exists per Subscription. |
| BR-002 | A Subscription Split Billing is never created directly. It is seeded when split billing is activated on the parent Commerce: [[Agreement]], and a [[Subscription]] added to an already-split-active Agreement is auto-enrolled. | All | Platform | There is no `POST`/activation endpoint on the Subscription `/split` — only `GET` and `PUT`. |
| BR-003 | Only the Client (for its own [[Account]]) or Operations can read or manage Subscription Split Billing; the Vendor has no access. | All | Vendor (blocked) | Both the `GET` and `PUT` `/split` endpoints return HTTP 403 for the Vendor. |
| BR-004 | On update, the caller supplies the full set of per-Buyer allocations with an explicit percentage for each, and those percentages must sum to exactly 100. | Active | Client, Operations | This is the level at which the split percentages are set. Contrast Commerce: [[Agreement Split Billing]], whose percentages are platform-computed and not caller-supplied (see that canon's BR-006/BR-007). |
| BR-005 | Each allocation's price is the Subscription's price apportioned by that allocation's percentage. | Active | Platform | Computed by the platform from the percentage; not caller-supplied. |
| BR-006 | The default Buyer — the [[Subscription]]'s [[Licensee]]'s [[Buyer]] — must be present in the allocations. | Active | Client, Operations | An update omitting the default Buyer is rejected. |
| BR-007 | Every [[Buyer]] in the allocations must already be a member of the parent Commerce: [[Agreement]]'s split allocations. | Active | Client, Operations | A Buyer not in the Agreement-level split's Buyer set is rejected. Agreement-level Buyer eligibility (Actor-scoped) is enforced when the Agreement split's Buyer set is established (see Commerce: [[Agreement Split Billing]] BR-009). |
| BR-008 | Each allocation percentage must be between 0 and 100; a 0% allocation is permitted. Duplicate [[Buyer]]s in the allocation set are rejected. | Active | Client, Operations | Percentages are stored as supplied at this level (rounding to two decimals happens only on the Agreement-level roll-up). |
| BR-009 | Updating a Subscription's split requires split billing to be active on the parent Commerce: [[Agreement]]. | Active | Client, Operations | Enforced directly; the parent [[Product]]'s split-billing setting is enforced transitively (the Agreement split could not have been activated without it). |
| BR-010 | While the parent [[Subscription]] is Suspended, only Operations may update the split; a Client update is refused. | Active | Client, Operations | No other Subscription-status precondition applies to updating the split. |
| BR-011 | Every update re-computes the parent Commerce: [[Agreement]]'s split allocations as a roll-up across all of the Agreement's Subscription splits. | Active | Platform | The Agreement-level percentage is a monetary roll-up (each Buyer's share of the Agreement's selling price), rounded to two decimals — not a plain sum of Subscription percentages. |
| BR-012 | Once seeded, a Subscription Split Billing cannot be deactivated or deleted. | Active | All | Permanent for the life of the [[Subscription]]. Allocations can only be re-distributed via update. |
| BR-013 | The parent [[Subscription]]'s `splitStatus` is `Active` while a split exists and `Disabled` before it is seeded. | Active | Platform | Set to `Active` when the split is seeded; a split-allocation update does not change it. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | String | Unique platform identifier. | Platform | No | Format `SBS-XXXX-XXXX`. |
| `revision` | Integer | Increments on each update. | Platform | Yes — platform-managed | — |
| `subscription` | Object (reference) | The Subscription this split configuration belongs to. | Platform | No | — |
| `audit` | Object | Object-level audit. Sub-keys: `created`, `updated`. | Platform | No | — |
| `allocations` | Array | Per-Buyer allocations of the Subscription's billing. | Client / Operations | Yes | Supplied in full on each update; must sum to 100% (see BR-004). |
| `allocations[].buyer` | Object (reference) | The Buyer this allocation bills. | Client / Operations | Yes — via the allocation set | Must be in the Agreement split's Buyer set (BR-007); the default Buyer is mandatory (BR-006). |
| `allocations[].percentage` | Number | This Buyer's percentage share of the Subscription's billing. | Client / Operations | Yes | 0–100; a 0% allocation is allowed. The set must sum to 100 (see BR-004, BR-008). |
| `allocations[].price` | Object | This Buyer's share of the Subscription price: `currency`, `SPxY`, `SPxM`, `PPxY`, `PPxM`. | Platform | Yes | Apportioned from the percentage (see BR-005). `currency`/`SPxY`/`SPxM` visible to Client and Operations; `PPxY`/`PPxM` visible to Operations only. The Vendor cannot see this object at all. |
| `allocations[].audit` | Object | Per-allocation audit. Sub-keys: `created`, `updated`. | Platform | No | — |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Commerce: Subscription | Parent | One Subscription to one split configuration | The Subscription whose billing this object splits. | Cannot exist without the Subscription. Seeded by Agreement split activation; permanent once seeded. |
| Commerce: Agreement Split Billing | Association | Many Subscription splits to one Agreement split | The Agreement-level split is a platform-computed roll-up of the Subscription-level allocations. Updating a Subscription split recomputes the Agreement split. | Seeded by Agreement split activation; every Subscription-split update re-computes the Agreement split. |
| Commerce: Agreement | Association | Many Subscription splits to one Agreement | The parent Subscription's Agreement. Split billing must be active on it before a Subscription split can be updated. | Updating is blocked unless the Agreement's split billing is active. |
| Accounts: Buyer | Association | One split to many Buyers | The Buyers across which the Subscription's billing is allocated. The default Buyer is mandatory. | A Buyer participating in an Agreement's split billing cannot be unassigned from, or transferred out of, its Account (guard enforced at the Agreement level). |
| Accounts: Licensee | Association | Many splits to one Licensee | Determines the default (owner) Buyer — the Licensee's Buyer. | No direct lifecycle dependency. |
| Catalog: Product | Association | Many splits to one Product | The Product's split-billing setting gates whether split billing could be activated on the Agreement in the first place. | Enforced transitively via the Agreement split (BR-009). |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Split seeded | Split billing activated on the parent [[Agreement]] (or a new [[Subscription]] added to a split-active Agreement) | Platform | The Subscription split is created with one allocation of 100% to the default [[Buyer]]; the parent [[Subscription]]'s `splitStatus` is set to Active. No bus event is published for the seed. |
| Allocations updated | `PUT /split` | Client, Operations | The supplied allocations are applied and each allocation's price is apportioned; the parent Commerce: [[Agreement Split Billing]] is recomputed; a platform bus event (`updated`) is published. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Allocations updated | Commerce: Agreement Split Billing | The Agreement-level allocations are recomputed as a roll-up across all of the Agreement's Subscription splits | Yes — platform | `PUT /split` succeeds | Monetary roll-up rounded to two decimals (BR-011). |
| Split seeded | Commerce: Subscription | The Subscription's `splitStatus` is set to Active | Yes — platform | Split billing activated on the Agreement | See BR-013. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
None. Seeding is one-way — there is no deactivation and no deletion. Allocations can be re-distributed through update, but the split billing configuration itself is permanent for the life of the [[Subscription]].

**Deletion:**
There is no delete endpoint and no deactivation mechanism. Once seeded, a Subscription Split Billing configuration exists permanently. Individual [[Buyer]] allocations can be re-distributed via update, but the configuration as a whole cannot be removed.

**Audit & history requirements:**
The object carries a `created`/`updated` audit block, and each allocation carries its own `created`/`updated` audit. Prior allocation values (percentages, prices) are not retained beyond the audit trail.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Update whose allocation percentages do not sum to 100 | Rejected. | Client, Operations | Medium | The Subscription level is where the sum-to-100 constraint is enforced (BR-004). |
| Update omitting the default [[Buyer]] | Rejected — the default Buyer is mandatory. | Client, Operations | Low | See BR-006. |
| Allocation to a [[Buyer]] not in the parent [[Agreement]]'s split allocations | Rejected. | Client, Operations | Low | Only Buyers already in the Agreement split may be allocated (BR-007). |
| Duplicate [[Buyer]] in the allocation set | Rejected. | Client, Operations | Low | See BR-008. |
| Update attempted when split billing is not active on the parent [[Agreement]] | Rejected. | Client, Operations | Low | Split must be active on the Agreement first (BR-009). |
| Client attempts to update the split while the [[Subscription]] is Suspended | Rejected — only Operations may update a suspended Subscription's split. | Client | Low | See BR-010. |
| The Vendor attempts to read or manage the split | HTTP 403 — the Vendor has no access. | Vendor | Low | Client and Operations only (BR-003). |
| A [[Buyer]] is set to 0% expecting it to be removed | The Buyer remains in the allocation set at 0% and is still counted as a participant in the [[Agreement]]'s split; it is not removed. | Client, Operations | Medium | Remove the Buyer from the allocation set to drop it; a 0% allocation still blocks that Buyer's unassignment/transfer at the Agreement level. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-17 | Stu / canon-generate | Initial canon. Generated via live STAGING OpenAPI schema, a multi-Actor live fetch of a split-active Subscription, and source-code research. Documents the Subscription-scoped split billing object (`SBS`): no status field (present-vs-absent, permanent once seeded, no deactivation/delete); seeded only by Agreement Split Billing activation or new-Subscription auto-enrolment (no `POST`/activation endpoint — `GET`/`PUT` only); the caller-supplies-explicit-percentages update model with the sum-to-100 constraint (the level at which the split is actually set, contrasting the platform-computed Agreement level); price apportioned by percentage; default-Buyer requirement; Buyer eligibility scoped to the Agreement split's Buyer set; 0–100 percentage range with 0% allowed and duplicate Buyers rejected; the Suspended-Subscription Operations-only rule; the recompute of the Agreement-level split on every update; per-allocation price visibility (Client sees SP + currency, Operations adds PP, Vendor 403 on both GET and PUT); and the parent Subscription `splitStatus` (Disabled before, Active once seeded; unchanged by an allocation update). 0 open questions. |
