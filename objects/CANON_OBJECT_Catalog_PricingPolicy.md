# Object Canon: Pricing Policy

> **Version:** 0.4
> **Owner:** Stu
> **Last Updated:** 2026-07-16
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
A Pricing Policy defines the maximum yield cap (markup or margin) that Operations permits to be applied to a specific Client when pricing their Orders. It is scoped to a specific Client and an eligibility type (client and/or partner), and may apply to all Products or be restricted to a specific set of Products. When a Pricing Policy is Active, the yield cap is observed during [[Order]] pricing — the platform caps the markup applied to matching lines at the policy's value. Pricing Policies are invisible to Clients and Vendors; their effect is felt during ordering but the policy itself is internal to Operations.

**Also Known As:**
Yield cap

---

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | No | No | No | No | Pricing Policies are not visible to Vendors; a Vendor request is refused. |
| Operations | Yes | Yes | Yes | Yes | Full lifecycle ownership. |
| Client | No | No | No | No | Pricing Policies are not visible to Clients. Their effect is felt during ordering but the policy itself is internal. |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Active | Policy is active and its yield cap is observed during Order pricing. A Pricing Policy is created directly in this state. | Yes | No |
| Inactive | Policy has been disabled. Yield cap is no longer observed on newly-priced Order lines. | No | No |
| Deleted | Policy has been soft-deleted. Remains fully retrievable via the API including in standard list responses. | No | Yes |

> The status enum also defines a `None` value, but the platform never assigns it — a Pricing Policy is created directly in Active state.

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Active | Create Pricing Policy | `POST` (base collection endpoint) | Operations | Client Account must exist and be of type Client; no existing Active policy occupies the same Client + eligibility (+ Product) slot (BR-010). | Policy is enforced immediately on creation. |
| T2 | Inactive | Active | Activate Pricing Policy | `activate` (`POST .../activate`) | Operations | Policy is Inactive; the same uniqueness check as creation is re-applied. | Yield cap resumes on newly-priced matching lines. |
| T3 | Active | Inactive | Disable Pricing Policy | `disable` (`POST .../disable`) | Operations | Policy is Active. | Yield cap no longer observed on newly-priced lines. Not blocked by any Orders governed by the policy. |
| T4a | Active | Deleted | Delete Pricing Policy | `DELETE` | Operations | Policy is not already Deleted. | Soft delete. Policy remains retrievable via the API. Not blocked by any Orders governed by the policy. |
| T4b | Inactive | Deleted | Delete Pricing Policy | `DELETE` | Operations | Policy is not already Deleted. | Soft delete. Policy remains retrievable via the API. Not blocked by any Orders governed by the policy. |

### 3.3 State Diagram

```
[—] ---(Create : Operations)---> [Active]
[Active] ---(Disable : Operations)---> [Inactive]
[Inactive] ---(Activate : Operations)---> [Active]
[Active | Inactive] ---(Delete : Operations)---> [Deleted]
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Pricing Policy is scoped to exactly one Client and cannot apply to multiple Clients or to all Clients. The scoped [[Account]] must be of type Client. | All | Operations | — |
| BR-002 | A Pricing Policy defines a yield cap — the maximum markup or margin that may be applied to matching Order lines. At least one of markup or margin must be provided on creation; the other is derived from it, and both are returned on the API response, computed from each other to 10 decimal places. | All | Operations | If both are supplied they must be mutually consistent or the request is rejected. Supplying only markup derives margin; supplying only margin derives markup. |
| BR-003 | A Pricing Policy has an eligibility object with `client` and `partner` boolean flags controlling which eligibility types the cap applies to. At least one must be set, and both may be set. | All | Operations | — |
| BR-004 | A Pricing Policy may be scoped to specific Products, or apply to all Products for the scoped Client. When no Products are specified, the policy applies to all Products. | All | Operations | [[Product]] scoping is at the Product level only — not at the [[Item]] level. A Product in Draft cannot be added to the scope. |
| BR-005 | A Pricing Policy may have one or more [[Pricing Policy Attachment]]s — supporting documents providing evidence or approval for the policy (e.g. a signed contract or approval record). Attachments are child objects and may be added or removed regardless of the policy's own status. | All | Operations | See Catalog: [[Pricing Policy Attachment]] canon. |
| BR-006 | When a matching Pricing Policy is Active, the platform caps the markup applied to matching Order lines at the policy's value — a computed markup above the cap is reduced to the cap; a computed markup at or below the cap is left unchanged. The cap is never a rejection. | Active | All | Enforcement is a cross-namespace behavioural effect during [[Order]] pricing (see Section 7.2). Applies to newly-priced lines; matching is on Client, eligibility, and Product scope. |
| BR-007 | A Pricing Policy only enforces its yield cap while Active. Inactive and Deleted policies have no effect on Order pricing. | Inactive, Deleted | All | — |
| BR-008 | Among the Pricing Policies matching a given Client, eligibility, and Product, the platform applies exactly one cap: a Product-scoped policy takes precedence over an all-Products (Client-level) policy, and where several apply at the same level the lowest markup (most restrictive cap) is used. | Active | All | The platform prevents two Active policies from occupying the same Client + eligibility slot at the same level (BR-010), but a Client-level and a Product-level policy for the same Client may coexist. |
| BR-009 | `notes` is an optional internal plain-text documentation field, and `externalIds.operations` an optional external identifier to correlate with external systems; both are readable and writable by Operations only. | All | Operations | — |
| BR-010 | Two Active Pricing Policies cannot occupy the same scope slot — the same Client and eligibility target at the same level (Client-level, or a given Product). This uniqueness is enforced at creation and re-checked on activation. | Active | Operations | A Client-level policy and a Product-level policy for the same Client are distinct slots and may both be Active. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| name | String | Human-readable label for the Pricing Policy | Operations | Yes | Optional on creation. |
| client | Object (AccountRef) | The Client Account this policy applies to | Operations | No | Required on creation. Immutable. Summary reference (id, name, revision, type, status). See BR-001. |
| eligibility | Object | Controls which eligibility types the cap applies to. Sub-fields: `client` (boolean), `partner` (boolean) | Operations | Yes | Required on creation. See BR-003. |
| markup | Number (double) | The yield cap expressed as a markup percentage | Operations | Yes | At least one of markup/margin required on creation (see BR-002). |
| margin | Number (double) | The yield cap expressed as a margin percentage | Operations | Yes | Derived from markup (and vice versa) to 10 decimal places. See BR-002. |
| products | Array (ProductRef) | The Products this policy applies to. Null or absent means all Products for the scoped Client. | Operations | Yes | Optional. Product-level scoping only. |
| notes | String | Internal plain-text documentation field | Operations | Yes | Optional. Operations-only. Absent from response when null. |
| externalIds.operations | String | Operations-set external identifier | Operations | Yes | Optional. Operations-only. |
| status | Enum | One of: Active, Inactive, Deleted | System | Via state transitions only | Created directly in Active. The enum also defines an unused `None` value. |
| revision | Integer | Increments on each update | System | N/A | Read-only. |
| statistics.orders | Integer | Number of Orders governed by this Pricing Policy | System | N/A | Computed. Read-only. |
| statistics.attachments | Integer | Number of Attachments on this Pricing Policy | System | N/A | Computed. Read-only. |
| audit | Object | Records `created` and `updated` events, each with timestamp and Actor | System | N/A | The schema also defines `activated`/`deactivated` events, but the platform does not populate them. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Accounts: Account (Client) | Association | Many:1 | A Pricing Policy applies to exactly one Client Account. | No. |
| Catalog: Product | Association | Many:Many | A Pricing Policy may be scoped to specific Products, or apply to all Products for the scoped Client. | No — deletion of a Product does not cascade to Pricing Policies. |
| Catalog: Pricing Policy Attachment | Child | One:Many | A Pricing Policy may have zero or more Attachments as supporting documents. | Yes — an Attachment cannot exist without a parent Pricing Policy. |
| Commerce: Order | Association | One:Many | When Active, a Pricing Policy caps the markup applied to matching Order lines during Order pricing. | No — Pricing Policy state changes do not retroactively alter already-priced Order lines. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Pricing Policy created | Operations creates Pricing Policy | Operations | Policy created directly in Active state; its yield cap is enforced immediately. |
| Pricing Policy activated | T2 — Inactive to Active | Operations | Yield cap resumes on newly-priced matching [[Order]] lines. |
| Pricing Policy disabled | T3 — Active to Inactive | Operations | Yield cap no longer observed on newly-priced lines. |
| Pricing Policy deleted | T4 | Operations | Soft delete. Policy remains retrievable via the API. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Matching Active Pricing Policy present during Order pricing | Commerce: Order | The markup on a newly-priced Order line is capped at the policy's value; the applied policy is recorded on the [[Order]] | Yes | While the [[Order]] is in a pre-commitment state (e.g. Draft/Quoted) and the line is not manually priced | Full Order-pricing rules belong to Commerce: [[Order]] canon. Already-priced lines and committed Orders are not re-capped. |
| Matching Active Pricing Policy present when a new subscription or agreement line is created | Commerce: Subscription / Commerce: Agreement | The markup on the new line is capped at the policy's value | Yes | New line creation only | Same clamp behaviour as Order pricing. |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
- Active → Inactive → Active is reversible. No limit on cycles.

**Deletion:**
- Pricing Policies use soft-delete. Once deleted, they remain fully retrievable via the API including in standard list responses; the `Deleted` status is the deletion marker. Deletion is not blocked by any Orders the policy has governed.
- **This is a known exception to Platform Invariant 7.** See PLATFORM_CANON_PREAMBLE.md for the invariant and its known exceptions.

**Audit & history requirements:**
The audit block records `created` and `updated` timestamps and Actors. The schema also defines `activated` and `deactivated` events, but the platform does not populate them — a state change updates the `updated` event rather than emitting a distinct activation event.

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Pricing Policy created with no Products specified | Policy applies to all Products for the scoped Client. Any [[Order]] for that Client is subject to the yield cap regardless of Product. | Operations | Medium | Broad scope may be unintentional. Operations is responsible for correct scoping. |
| Both a Client-level and a Product-scoped policy match the same Order line | The Product-scoped policy's cap applies; the Client-level cap is not used for that Product (BR-008). | Operations | Low | Precedence is deterministic — Product-level over Client-level, then lowest markup. |
| Pricing Policy disabled or deleted while an Order is in progress | Already-priced lines and committed Orders are unaffected; the cap simply stops applying to lines priced afterwards. | None | Low | The cap is applied at pricing time, not held against the Order thereafter. |

---

## 10. Open Questions

No open questions at this time.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.4 | 2026-07-16 | Stu / canon-generate | Refresh via live OpenAPI schema (STAGING), a live multi-Actor fetch of two real policies, and source-code research. Resolved PRP-001/PRP-002: the `None` status is a defined-but-unused enum value the platform never assigns — a Pricing Policy is created directly in Active state; Section 3 reworked to remove None as a live state (T1 now creates directly to Active). Resolved PRP-004: when multiple policies match, resolution is deterministic — a Product-scoped policy takes precedence over a Client-level one, and the lowest (most restrictive) markup wins (new BR-008); added the uniqueness rule preventing two Active policies in the same scope slot (BR-010). Corrected yield-cap enforcement (BR-006, Section 7.2, Section 9): it is a clamp — the applied markup is reduced to the cap — not a rejection, and it applies to newly-priced Order lines (and new subscription/agreement lines) while the Order is pre-commitment, against whichever policy is Active at pricing time; already-priced/committed lines are unaffected. Section 3.2 Endpoint/Verb columns filled (create POST, `activate`, `disable`, delete DELETE) with actor and precondition guards; disable/delete confirmed not blocked by governed Orders. Confirmed the soft-delete Invariant-7 exception (deleted policies remain retrievable, including in list responses). Section 5: client documented as a summary AccountRef; markup/margin derivation clarified (either may be the source; consistency enforced); audit `activated`/`deactivated` documented as defined-but-unpopulated. Vendor read refusal noted (Section 2). |
| 0.3 | 2026-03-16 | Stu | Accounts namespace used consistently throughout (replacing Administration). |
| 0.2 | 2026-03-16 | Stu | JSON examples reviewed. PRP prefix confirmed. PRP-003 resolved — Deleted is a soft delete, confirmed from real API responses. None status not observed in any real records — PRP-001/PRP-002 updated with observation. Section 3.1 Deleted state updated. Section 8 deletion and audit notes updated. Platform Invariant 7 exception noted. |
| 0.1 | 2026-03-16 | Stu | Initial canon. Derived from OpenAPI spec and conversation. Four open questions raised (PRP-001 through PRP-004). |
