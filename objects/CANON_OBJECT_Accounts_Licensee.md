# Object Canon: Licensee

> **Version:** 0.1
> **Owner:** Stu
> **Last Updated:** 2026-07-16
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception. If a rule in this document appears to conflict with an invariant, flag the conflict explicitly — do not resolve it silently.

---

## 1. Identity

**Object Name:** Licensee

**Namespace:** Accounts

**Parent Object:** None — top-level Accounts object.

**ID Prefix:** LCE

**Description:**
A Licensee represents a specific pairing of a customer legal entity and a SoftwareOne selling entity — the [[Buyer]] as it transacts through one [[Seller]]. It is the party on whose behalf a Commerce: [[Agreement]] (and the resulting [[Subscription]]s and [[Asset]]s) is established, and so it is the customer-facing procurement identity used throughout ordering. A Licensee is created — by a Client for its own [[Account]], or by Operations — only once an [[ErpLink]] joins the chosen Buyer and Seller. In a Tier 2 reselling arrangement, the Licensee is the reseller's downstream customer.

**Also Known As:**
None known.

---

## 2. Ownership & Visibility

> High-level Actor authority over this object. State-specific nuances belong in Section 4 (Business Rules).
> For field-level visibility differences by Actor, use the Notes column in Section 5.

| Actor      | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor     | No | Yes* | No | No | *Read is row-scoped: a Vendor sees only Licensees reachable through a Commerce: [[Agreement]] where it is the Vendor. Deleted Licensees are not visible. |
| Operations | Yes | Yes | Yes | Yes* | Requires the platform Account Management module permission. Can create, read, and update for any Account, and is the only Actor that sees Deleted Licensees. *Delete is a soft-delete — see BR-013. |
| Client     | Yes* | Yes* | Yes* | Yes* | *Scoped to the Client's own [[Account]] and requires the account management permission. Deleted Licensees are not visible. Delete is a soft-delete — see BR-013. |

There is no Actor-based field suppression on the Licensee — every field is visible to any Actor that can read the record. Which Licensees an Actor can see is governed by the row-scoping above, not by field-level suppression.

---

## 3. State Machine

> A Licensee's status mirrors that of its related Buyer unless it is explicitly actioned. It has four states.

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Active | The Licensee is linked to an Active Buyer — one correctly linked to an ERP customer record. Only an Active Licensee may be used to place new Orders. | Yes* | No |
| Enabled | The Licensee is linked to an Enabled Buyer — one enabled without ERP activation. It cannot be used to place new Orders. | Yes* | No |
| Disabled | Set explicitly by a Client or Operations action, or automatically when the related Buyer or Seller is disabled. Cannot be used for new Orders, but remains usable for change and termination Orders against existing Agreements. Retained for historical reference. | No | No |
| Deleted | Soft-deleted. The record is retained but no longer usable, and is visible only to Operations. | No | Yes |

> *The initial status is Active or Enabled depending on the related Buyer's status at creation — see BR-004.

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1a | — | Active | Create (Buyer Active) | `POST /v1/accounts/licensees` | Client (own Account) or Operations | An ErpLink exists on the (Buyer, Seller) pair and is neither Blocked nor Disabled; the Buyer is Active | Accepts `application/json` or `multipart/form-data` (optional icon). Initial status mirrors the Buyer. |
| T1b | — | Enabled | Create (Buyer Enabled) | `POST /v1/accounts/licensees` | Client (own Account) or Operations | An ErpLink exists on the (Buyer, Seller) pair and is neither Blocked nor Disabled; the Buyer is Enabled | Initial status mirrors the Buyer. |
| T2 | Enabled | Active | Activate (Buyer becomes Active) | (no endpoint — propagated at Buyer synchronisation) | Platform | The related Buyer moves to Active (ERP customer identifier assigned) | Automated; not exposed in either portal. |
| T3 | Active | Enabled | Downgrade (Buyer becomes Enabled) | (no endpoint — propagated at Buyer synchronisation) | Platform | The ERP customer identifier is removed from the related Buyer | Automated; not exposed in either portal. |
| T4a | Active | Disabled | Disable | `POST /v1/accounts/licensees/{id}/disable` | Client (own Account) or Operations | Not already Disabled or Deleted | Also driven by the Platform when the related Buyer or Seller is disabled. Records the `disabled` audit timestamp. |
| T4b | Enabled | Disabled | Disable | `POST /v1/accounts/licensees/{id}/disable` | Client (own Account) or Operations | Not already Disabled or Deleted | As T4a. |
| T5a | Disabled | Active | Enable (Buyer Active) | `POST /v1/accounts/licensees/{id}/enable` | Client (own Account) or Operations | The related Seller is Active or Offline; the ErpLink on the (Buyer, Seller) pair exists and is Active; the related Buyer is Active | Enable re-derives the target status from the Buyer — see BR-007. |
| T5b | Disabled | Enabled | Enable (Buyer Enabled) | `POST /v1/accounts/licensees/{id}/enable` | Client (own Account) or Operations | The related Seller is Active or Offline; the ErpLink on the (Buyer, Seller) pair exists and is Active; the related Buyer is Enabled | As T5a. |
| T6a | Active | Deleted | Delete | `DELETE /v1/accounts/licensees/{id}` | Client (own Account) or Operations | No related Commerce: Agreement in a non-terminal state — see BR-013 | Soft-delete (returns 204); record retained, visible to Operations only. Also propagated when the related Buyer is deleted. Terminal. |
| T6b | Enabled | Deleted | Delete | `DELETE /v1/accounts/licensees/{id}` | Client (own Account) or Operations | No related Commerce: Agreement in a non-terminal state — see BR-013 | As T6a. |
| T6c | Disabled | Deleted | Delete | `DELETE /v1/accounts/licensees/{id}` | Client (own Account) or Operations | No related Commerce: Agreement in a non-terminal state — see BR-013 | As T6a. |

### 3.3 State Diagram

```
[—] --(create, Buyer Active : Client/Operations)--> [Active]
[—] --(create, Buyer Enabled : Client/Operations)--> [Enabled]
[Enabled] --(Buyer becomes Active : Platform)--> [Active]
[Active] --(Buyer becomes Enabled : Platform)--> [Enabled]
[Active] --(disable : Client/Operations/Platform)--> [Disabled]
[Enabled] --(disable : Client/Operations/Platform)--> [Disabled]
[Disabled] --(enable, Buyer Active : Client/Operations)--> [Active]
[Disabled] --(enable, Buyer Enabled : Client/Operations)--> [Enabled]
[Active | Enabled | Disabled] --(delete : Client/Operations)--> [Deleted]   (soft; terminal)
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Licensee joins exactly one [[Buyer]] to exactly one [[Seller]], and belongs to the Client [[Account]] that owns the Buyer. | All | All | The Account is derived from the Buyer; a Buyer without an Account cannot have a Licensee. |
| BR-002 | A Licensee can be created only when an [[ErpLink]] already exists on the same (Buyer, Seller) pair and that link is neither Blocked nor Disabled. | — (creation) | Client, Operations | Creation is rejected if no eligible ErpLink joins the pair. |
| BR-003 | The platform does not enforce uniqueness of the (Buyer, Seller) pair across Licensees. | All | All | A Buyer holds one Licensee per Seller in normal use, but the platform permits more than one on the same pair. |
| BR-004 | A Licensee's status mirrors its related [[Buyer]]: created Active when the Buyer is Active and Enabled when the Buyer is Enabled, and moved to match whenever the Buyer's status later changes. | All | Platform | Buyer Active ↔ Licensee Active; Buyer Enabled ↔ Licensee Enabled; Buyer Disabled → Licensee Disabled. A status supplied on create or update is ignored. The Buyer must be Active or Enabled at creation. |
| BR-005 | Active reflects a Buyer correctly linked to an ERP customer record; Enabled reflects a Buyer enabled without ERP activation. Only an Active Licensee may be used to place new Commerce: [[Order]]s. | All | All | In PROD the ERP link is required, so only Active may transact; in non-PROD environments the constraint is relaxed so Active or Enabled may transact — see preamble Section 7.3. |
| BR-006 | A Disabled Licensee cannot be used to place new Commerce: [[Order]]s, but Agreements referencing it remain fully operable — change and termination Orders are still permitted. | Disabled | All | Disabling does not affect the referenced Commerce: [[Agreement]], [[Subscription]]s, or [[Asset]]s. |
| BR-007 | The enable action re-derives the target status from the related [[Buyer]] — a Disabled Licensee becomes Active if its Buyer is Active and Enabled if its Buyer is Enabled. | Disabled | Client, Operations | Permitted only when the related [[Seller]] is Active or Offline and the [[ErpLink]] on the (Buyer, Seller) pair is Active. A change to the Buyer's status alone does not lift a Disabled Licensee — an explicit enable is required. |
| BR-008 | The disable action moves a Licensee to Disabled and has no additional guard. | Active, Enabled | Client, Operations | Also driven automatically by the platform when the related [[Buyer]] or [[Seller]] is disabled. |
| BR-009 | `useBuyerAddress` governs the Licensee's address: when true, no address is stored on the Licensee and the related [[Buyer]]'s address is used and kept in step with it; when false, an address must be supplied. | All | Client, Operations | A supplied address is not validated. Setting an address switches `useBuyerAddress` off. Required address fields when supplied: address line 1, post code, city, state, country. |
| BR-010 | `eligibility` records whether the Licensee is for self-consumption or for resale, as exactly one of `client` or `partner`. | All | Client, Operations | Known as the "Resale Licensee" designation. Set at creation, must be a subset of the owning [[Account]]'s eligibility, and has no update endpoint. Gates which Programs and Certificates the Licensee qualifies for (Programs and Certificates are not yet canonised). |
| BR-011 | `externalId` is an optional customer-supplied reference. It is not unique and may be changed at any time. | All | Client, Operations | Maximum length 250 characters. |
| BR-012 | `name` is optional on creation; when omitted the platform generates it from the related [[Buyer]]'s name and city and the [[Seller]] ID. | All | Client, Operations | Maximum length 500. Generated form: "[Buyer name]-[city]-[Seller ID]", or "[Buyer name]-[Seller ID]" when the Buyer has no city. Editable afterward. |
| BR-013 | Deleting a Licensee is a soft-delete: status is set to Deleted and the record is retained (visible to Operations only). It is blocked while any related Commerce: [[Agreement]] is in a non-terminal state. | Active, Enabled, Disabled | Client, Operations | Non-terminal means any status other than Deleted, Failed, or Terminated. There is no hard-delete. A Deleted Licensee cannot be returned to service through the public API. Also occurs by propagation when the related [[Buyer]] is deleted. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| `id` | String | Unique platform identifier for the Licensee. | Platform | No | Format `LCE-XXXX-XXXX-XXXX`. |
| `name` | String | Human-readable name. | Client / Operations, or Platform (generated) | Yes | Optional on create; generated from the Buyer when omitted — see BR-012. Maximum length 500. |
| `status` | Enum | Lifecycle status: one of `Active`, `Enabled`, `Disabled`, `Deleted`. | Platform | Yes (via actions or Buyer propagation) | Not writable directly on create or update — see BR-004. Absent from response when null. |
| `externalId` | String | Customer-supplied external reference. | Client / Operations | Yes | Optional, not unique — see BR-011. Absent from response when null. |
| `eligibility` | Object | Self-consumption vs resale designation: `{client, partner}`, with exactly one true. | Client / Operations | No | See BR-010. Set at creation; no update endpoint. |
| `useBuyerAddress` | Boolean | Whether the related Buyer's address is used in place of a stored address. | Client / Operations | Yes | Required on create — see BR-009. |
| `address` | Object | Postal address: `addressLine1`, `addressLine2`, `postCode`, `city`, `state`, `country`. | Client / Operations | Yes | Empty when `useBuyerAddress` is true. Not validated when supplied. See BR-009. |
| `description` | String | Free-text description. | Client / Operations | Yes | Optional, maximum length 2000. Absent from response when null. |
| `account` | Object (reference) | The owning Client Account. | Platform (from the Buyer) | No* | *Derived from the Buyer; changes only if the Buyer is transferred to another Account. |
| `buyer` | Object (reference) | The joined Buyer. | Client / Operations (at creation) | No | Required at creation. |
| `seller` | Object (reference) | The joined Seller. | Client / Operations (at creation) | No | Required at creation. |
| `icon` | String | URL to the Licensee icon; defaults to a server-generated jdenticon, replaceable by a custom upload. | Client / Operations | Yes | Nullable. See preamble Section 9. |
| `revision` | Integer | Increments on each update. | Platform | N/A | Read-only. |
| `audit` | Object | Audit block. Sub-keys: `created`, `updated`, `disabled`. | Platform | N/A | Omitted by default — request via `select=+audit`. `disabled` is written only when the Licensee is disabled. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Accounts: Buyer | Parent | Many Licensees to one Buyer | The customer legal entity this Licensee represents; the Licensee's Account and status both derive from it. | Yes — a Licensee cannot be created without a Buyer, its status mirrors the Buyer's, and it guards the Buyer's account-unassign and delete. |
| Accounts: Seller | Association | Many Licensees to one Seller | The SoftwareOne selling entity the Buyer transacts through. | Yes — a Licensee in Active or Enabled status blocks the Seller's Activate/Disable/Deactivate/Delete; the Seller being disabled disables the Licensee. |
| Accounts: ErpLink | Association | Many Licensees to one ErpLink | The Buyer–Seller join that must exist before a Licensee can be created on the same pair. | Yes — creation requires a non-Blocked, non-Disabled ErpLink; a non-Deleted Licensee guards ErpLink removal and an Active or Enabled one guards ErpLink block. |
| Accounts: Account | Parent | Many Licensees to one Account | The Client Account that owns the Licensee, via its Buyer. | Yes — derived from the Buyer's Account and moves with a Buyer transfer. |
| Commerce: Agreement | Association | One Licensee to many Agreements | The Licensee on whose behalf each Agreement is established. | Yes — an Agreement's licensee reference is immutable, and a non-terminal Agreement blocks Licensee deletion. |
| Commerce: Subscription | Association | One Licensee to many Subscriptions | Subscriptions inherit the Licensee from their Agreement. | No direct dependency — the reference is set via the Agreement and is immutable. |
| Commerce: Asset | Association | One Licensee to many Assets | Assets inherit the Licensee from their Agreement. | No direct dependency — the reference is set via the Agreement and is immutable. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

> Events that are significant for this object but do not necessarily change its state.

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Licensee created | `POST` create | Client (own Account), Operations | Created Active or Enabled per the related [[Buyer]]'s status, and attached to that Buyer. Emits a creation event on the Accounts module bus. |
| Licensee enabled | enable action | Client (own Account), Operations | Status re-derived from the Buyer (Active or Enabled). |
| Licensee disabled | disable action, or the related [[Buyer]]/[[Seller]] disabled | Client (own Account), Operations, Platform | Status → Disabled; records the `disabled` audit timestamp. |
| Licensee updated | `PUT` update | Client (own Account), Operations | Changes `name`, `address`, `externalId`, `description`, or `icon`. |
| Licensee deleted | delete action, or the related [[Buyer]] deleted | Client (own Account), Operations, Platform | Soft-delete; status → Deleted. |
| Status propagated from Buyer | Related [[Buyer]] status change at synchronisation | Platform | The Licensee is moved to match the Buyer (Active, Enabled, or Disabled). |

### 7.2 Cross-Object State Effects

> Effects this object's events have on *other* objects.

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Licensee is Active or Enabled | Accounts: Seller | Blocks the Seller's Activate, Disable, Deactivate, and Delete actions. | Yes | Licensee status is Active or Enabled | See Accounts: [[Seller]] BR-007. |
| Licensee is Active or Enabled | Accounts: ErpLink | Blocks blocking the [[ErpLink]] on the (Buyer, Seller) pair. | Yes | Licensee status is Active or Enabled | A Disabled Licensee does not block the block. |
| Licensee is non-Deleted | Accounts: ErpLink | Blocks removal of the ErpLink on the (Buyer, Seller) pair. | Yes | Any Licensee not in Deleted status | The platform records a reconciliation error on the [[Buyer]] instead. |
| Licensee is attached | Accounts: Buyer | Blocks the Buyer's account-unassign (any Licensee, including Deleted) and its deactivate and delete (any non-Deleted Licensee). | Yes | — | See Accounts: [[Buyer]] BR-011 and BR-013. |
| Licensee referenced at Agreement creation | Commerce: Agreement | The Licensee is validated and must satisfy the transaction-eligibility rule before the [[Agreement]] is created. | Yes | New Agreement / Order | See BR-005. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
The Active ↔ Enabled distinction tracks the related [[Buyer]]'s status and reverses automatically as the Buyer changes. Active or Enabled → Disabled is reversible via the enable action, which returns the Licensee to Active or Enabled per the Buyer's current status (BR-007), with no limit on cycles. Deletion is terminal — see below.

**Deletion:**
A Licensee is soft-deleted only. It may be deleted by Operations, or by a Client for a Licensee in its own [[Account]], when no related Commerce: [[Agreement]] is in a non-terminal state (BR-013). A soft-deleted Licensee has status Deleted, is retained, and remains retrievable only by Operations — it is not returned to the Client or Vendor. There is no hard-delete. A Deleted Licensee cannot be returned to service through the public API.

**Audit & history requirements:**
The audit block records `created`, `updated`, and `disabled` timestamps — `disabled` only when the Licensee is disabled. Audit is omitted from responses by default (request via `select=+audit`). Prior field values (for example a replaced address) are not retained beyond the audit trail.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| A Licensee is disabled while it has active Commerce: [[Subscription]]s | Permitted — disabling is not guarded against active downstream commerce. New Orders are blocked, but existing [[Subscription]]s and [[Agreement]]s remain operable. | Client, Operations | Medium | Only deletion is guarded, by non-terminal Agreements (BR-013). |
| A second Licensee is created for the same (Buyer, Seller) pair | Permitted — the platform does not enforce (Buyer, Seller) uniqueness. | Client, Operations | Low | Duplicate Licensees on one pair — see BR-003. |
| An Enabled (non-ERP) Licensee is used to place a Commerce: [[Order]] in PROD | Rejected — only an Active Licensee may transact in PROD. In non-PROD environments the Order is permitted, as the constraint is relaxed. | Client | Medium | Environment-dependent — see BR-005 and preamble Section 7.3. |
| The ERP block flow leaves an Enabled Licensee on the pair | The platform's [[ErpLink]] block guard rejects the block while an Active or Enabled Licensee remains on the pair. | Operations | Medium | The ERP-sync flow disables only Active Licensees before blocking, so an Enabled one can cause the block to be rejected. |
| A user-supplied Licensee address is incorrect | Accepted without validation — the platform does not validate a supplied address. | Client, Operations | Low | Use `useBuyerAddress` to inherit the validated [[Buyer]] address (BR-009). |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-07-16 | Stu / canon-generate | Initial canon. Generated via live OpenAPI schema (STAGING), a live-fetched real object (STAGING, all Actors), source-code research across the core platform and the Navision ERP extension, and the Licensee (LCE) design documentation. Documents the Buyer–Seller pairing, the Buyer-mirrored four-status model (Active/Enabled/Disabled/Deleted) and the ERP-linked meaning of Active vs Enabled, the create-requires-ErpLink rule, the transaction-eligibility rule (Active required in PROD, relaxed in non-PROD), soft-delete with the non-terminal-Agreement guard, `useBuyerAddress` semantics, the `eligibility` (Resale Licensee) designation, and the cross-object guards on Seller, ErpLink, and Buyer. |
