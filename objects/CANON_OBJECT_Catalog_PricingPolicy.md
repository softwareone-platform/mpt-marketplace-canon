# Object Canon: Pricing Policy

> **Version:** 0.3
> **Owner:** Stu
> **Last Updated:** 2026-03-16
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception, unless explicitly noted below.

**Exception to Invariant 7:** This object uses soft-delete. Deleted Pricing Policies remain fully retrievable via the API, including in standard list responses. See Section 8.

---

## 1. Identity

**Object Name:** Pricing Policy

**Namespace:** Catalog

**Parent Object:** None — top-level Catalog object.

**ID Prefix:** PRP

**Description:**
A Pricing Policy defines the maximum yield cap (markup or margin) that Operations permits to be applied to a specific Client when pricing their Orders. It is scoped to a specific Client and an eligibility type (client and/or partner), and may apply to all Products or be restricted to a specific set of Products. When a Pricing Policy is Active, the yield cap is observed during Order creation — the platform will not allow a markup or margin above the cap for matching Orders. Pricing Policies are invisible to Clients and Vendors; their effect is felt during ordering but the policy itself is internal to Operations.

---

**Also Known As:**
Yield cap

---

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | No | No | No | No | Pricing Policies are not visible to Vendors. |
| Operations | Yes | Yes | Yes | Yes | Full lifecycle ownership. |
| Client | No | No | No | No | Pricing Policies are not visible to Clients. Their effect is felt during ordering but the policy itself is internal. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| None | Status immediately after creation, before activation. Not observed in real API responses — may be purely transitional immediately after creation. See PRP-001 and PRP-002. | Yes (unconfirmed) | No |
| Active | Policy is active and its yield cap is observed during Order creation. | No | No |
| Inactive | Policy has been disabled. Yield cap is no longer observed on new Orders. | No | No |
| Deleted | Policy has been soft-deleted. Remains fully retrievable via the API including in standard list responses. | No | Yes |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | None | Create Pricing Policy | Unconfirmed — pending refresh | Operations | None | Policy created. Yield cap not yet enforced. |
| T2a | None | Active | Activate Pricing Policy | Unconfirmed — pending refresh | Operations | None | Yield cap begins being observed on matching Orders during Order creation. |
| T2b | Inactive | Active | Activate Pricing Policy | Unconfirmed — pending refresh | Operations | None | Yield cap begins being observed on matching Orders during Order creation. |
| T3 | Active | Inactive | Disable Pricing Policy | Unconfirmed — pending refresh | Operations | None | Yield cap no longer observed on new Orders. Existing Orders unaffected. |
| T4a | None | Deleted | Delete Pricing Policy | Unconfirmed — pending refresh | Operations | None | Soft delete. Policy remains retrievable via the API. |
| T4b | Active | Deleted | Delete Pricing Policy | Unconfirmed — pending refresh | Operations | None | Soft delete. Policy remains retrievable via the API. |
| T4c | Inactive | Deleted | Delete Pricing Policy | Unconfirmed — pending refresh | Operations | None | Soft delete. Policy remains retrievable via the API. |

### 3.3 State Diagram

```
[None] ---(Activate : Operations)---> [Active]
[Active] ---(Disable : Operations)---> [Inactive]
[Inactive] ---(Activate : Operations)---> [Active]
[Any] ---(Delete : Operations)---> [Deleted]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Pricing Policy is scoped to exactly one Client. It cannot apply to multiple Clients or to all Clients. | All | Operations | — |
| BR-002 | A Pricing Policy defines a yield cap — the maximum markup or margin that may be applied to matching Orders. The cap is always stored as a markup value. If a margin is specified in the UI, it is converted to a markup before storage. Both markup and margin are returned on the API response, computed from each other to 10 decimal places. | All | Operations | At least one of markup or margin must be provided on creation. |
| BR-003 | A Pricing Policy has an eligibility object with client and partner boolean flags. These control which eligibility types the cap applies to. | All | Operations | — |
| BR-004 | A Pricing Policy may be scoped to specific Products, or may apply to all Products for the scoped Client. When no Products are specified (products array is null or absent), the policy applies to all Products. | All | Operations | [[Product]] scoping is at the [[Product]] level only — not at the [[Item]] level. |
| BR-005 | A Pricing Policy may have one or more Attachments — supporting documents that provide evidence or approval for the policy (e.g. a signed contract or approval record). Attachments are child objects of the Pricing Policy. | All | Operations | — |
| BR-006 | The yield cap is observed during [[Order]] creation in the Commerce namespace. The platform will not permit a markup or margin above the cap for Orders that match the policy's Client, eligibility, and [[Product]] scope. | Active | All | Enforcement occurs in Commerce at [[Order]] creation — this is a cross-namespace behavioural effect. |
| BR-007 | A Pricing Policy only enforces its yield cap when in Active state. Policies in None or Inactive state have no effect on [[Order]] pricing. | None, Inactive | All | — |
| BR-008 | notes is an optional internal plain-text documentation field readable and writable by Operations only. | All | Operations | — |
| BR-009 | externalIds.operations is an optional Operations-set external identifier for the Pricing Policy, used to correlate with external systems. | All | Operations | — |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| Name | String | Human-readable label for the Pricing Policy | Operations | Yes | Optional on creation. |
| Client | Object (AccountRef) | The Client Account this policy applies to | Operations | No | Required on creation. Immutable after creation. Always scoped to a specific Client. |
| Eligibility | Object | Controls which eligibility types the cap applies to. Sub-fields: `client` (boolean), `partner` (boolean) | Operations | Yes | Required on creation. |
| Markup | Number (double) | The yield cap expressed as a markup percentage. Always stored as markup — computed from margin if margin is supplied. | Operations | Yes | At least one of markup or margin required on creation. Both are returned on the response, computed from each other to 10 decimal places. |
| Margin | Number (double) | The yield cap expressed as a margin percentage. Computed from markup on read. | Operations | Yes | At least one of markup or margin required on creation. Stored as markup internally. |
| Products | Array (ProductRef) | The Products this policy applies to. Null or absent means all Products for the scoped Client. | Operations | Yes | Optional. Product-level scoping only. |
| Notes | String | Internal plain-text documentation field | Operations | Yes | Optional. Nullable. |
| External IDs | Object | Operations-set external identifier. Key: `operations` (nullable string) | Operations | Yes | Optional. |
| Status | Enum | One of: None, Active, Inactive, Deleted | System | Via state transitions only | See PRP-001/PRP-002 for unconfirmed semantics of None state. |
| Revision | Integer | Increments on each update | System | N/A | Read-only. |
| statistics.orders | Integer | Number of Orders governed by this Pricing Policy | System | N/A | Computed by platform. Read-only. |
| statistics.attachments | Integer | Number of Attachments on this Pricing Policy | System | N/A | Computed by platform. Read-only. |
| Statistics | object | Computed platform metrics. Sub-fields: orders (number of Orders governed by this policy), attachments (number of Attachments on this policy). Both computed, read-only. | system | — | — |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Accounts: Account (Client) | Association | Many:1 | A Pricing Policy applies to exactly one Client Account. | No — deletion behaviour not yet confirmed. |
| Catalog: Product | Association | Many:Many | A Pricing Policy may be scoped to specific Products, or apply to all Products for the scoped Client. | No — deletion of a Product does not cascade to Pricing Policies. |
| Catalog: Pricing Policy Attachment | Child | One:Many | A Pricing Policy may have zero or more Attachments as supporting documents. | Yes — Attachments cannot exist without a parent Pricing Policy. |
| Commerce: Order | Association | One:Many | When Active, a Pricing Policy governs the maximum yield applied to matching Orders during Order creation. | No — Pricing Policy state changes do not affect existing Orders. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Pricing Policy created | Operations creates Pricing Policy | Operations | Policy created in None state. Yield cap not yet enforced. |
| Pricing Policy activated | T2 — None/Inactive to Active | Operations | Yield cap begins being observed on matching Orders during Order creation. |
| Pricing Policy disabled | T3 — Active to Inactive | Operations | Yield cap no longer observed on new Orders. Existing Orders unaffected. |
| Pricing Policy deleted | T4 | Operations | Soft delete. Policy remains retrievable via the API. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Pricing Policy activated | Commerce: Order (future) | Yield cap enforced on new Orders matching the policy's Client, eligibility, and Product scope | Yes | Active state only | Enforcement is in the Commerce namespace during Order creation. |
| Pricing Policy disabled | Commerce: Order (future) | Yield cap no longer enforced on new Orders | Yes | Transition to Inactive | Existing Orders are unaffected. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
- Active → Inactive → Active is reversible. No limit on cycles.

**Deletion:**
- Pricing Policies use soft-delete. Once deleted, they remain fully retrievable via the API including in standard list responses. The `Deleted` status serves as the deletion marker.
- **This is a known exception to Platform Invariant 7.** See PLATFORM_CANON_PREAMBLE.md for the invariant and its known exceptions.

**Audit & history requirements:**
Audit block captures `created` and `updated` timestamps and Actors. The spec also defines `activated` and `deactivated` audit events, but these are not observed in real API responses — state transitions may update the `updated` timestamp rather than generating distinct audit events. This is unconfirmed — see PRP-001 and PRP-002.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Pricing Policy activated with no Products specified | Policy applies to all Products for the scoped Client. Any Order for that Client will be subject to the yield cap regardless of Product. | Operations | Medium | Broad scope may be unintentional. Operations is responsible for correct scoping. |
| Multiple active Pricing Policies for the same Client and eligibility | Behaviour not yet confirmed — it is unclear whether the most restrictive cap, the most recent, or some other resolution applies. | Operations | High | See PRP-004. To be documented in Commerce canon when Order pricing rules are canonised. |
| Pricing Policy disabled while an Order is in progress | Existing in-flight Orders are unaffected. The cap is only enforced at Order creation time. | None | Low | — |

---

## 10. Open Questions

- PRP-001: What is the full behaviour of the `None` status? Not observed in real API responses — may be purely transitional immediately after creation. Needs testing to confirm.
- PRP-002: What is the difference between `None` and `Inactive`? Can a policy go from `None` directly to `Inactive` without ever being activated?
- PRP-004: When multiple active Pricing Policies exist for the same Client and eligibility, how does the platform resolve which cap to apply?

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-03-16 | Stu | Initial canon. Derived from OpenAPI spec and conversation. Four open questions raised (PRP-001 through PRP-004). |
| 0.2 | 2026-03-16 | Stu | JSON examples reviewed. PRP prefix confirmed. PRP-003 resolved — Deleted is a soft delete, confirmed from real API responses. None status not observed in any real records — PRP-001/PRP-002 updated with observation. Section 3.1 Deleted state updated. Section 8 deletion and audit notes updated. Platform Invariant 7 exception noted. |
| 0.3 | 2026-03-16 | Stu | Accounts namespace used consistently throughout (replacing Administration). |
