# Object Canon: Price List Item

> **Version:** 0.3
> **Owner:** Stu
> **Last Updated:** 2026-07-16
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.

---

## 1. Identity

**Object Name:** Price List Item

**Namespace:** Catalog

**Parent Object:** Catalog: Price List

**ID Prefix:** PRI

**Description:**
A Price List Item is the pricing record for one Catalog: [[Item]] within one Catalog: [[Price List]]. Price List Items are created automatically — one per reviewed [[Item]] — when a [[Price List]] is created, and again in every [[Price List]] under the [[Product]] when an [[Item]] is submitted for review for the first time. They are never created manually. A Price List Item carries the purchase price (what SoftwareOne pays the Vendor), the list price (the Vendor's RRP), and the markup (from which the sales price to the Client is derived). It also carries optional display information for the Client. Price List Items progress from Draft to either ForSale or Private, controlling whether the [[Item]] is available for new purchases, change orders, or neither.

**Also Known As:**
None known.

---

## 2. Ownership & Visibility

| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor | No | Yes* | Yes** | No | *Owning Vendor. Cannot see `unitSP`, the SP-normalised variants, `markup`, `margin`, or `reasonForChange`. **Can set `unitLP`/`unitPP`, `info`, `description`, and the status. |
| Operations | No | Yes | Yes | No | Full read and write access to all fields, including `markup`, `margin`, and `reasonForChange`. |
| Client | No | Yes*** | No | No | ***Scoped read only — a Client sees a Price List Item only when it is ForSale and both the mirrored [[Item]] and its [[Product]] are Published (a Client receives 404 for Draft or Private items). Sees the list and sales prices, never the cost, `markup`, or `margin` (see BR-013). |

---

## 3. State Machine

### 3.1 States

| State | Description | Initial State? | Terminal State? |
| --- | --- | --- | --- |
| Draft | Price List Item created. Pricing may or may not be set. Not available for purchase or change orders. | Yes | No |
| ForSale | Item is available for new purchases and change orders by Clients via an active Listing. | No | No |
| Private | Item is available for change orders only. Not available for new purchases. Used to onboard existing customer subscriptions onto the platform without opening the Item for new sales. | No | No |

### 3.2 Transitions

| ID | From State | To State | Action | Endpoint / Verb | Actor | Precondition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | — | Draft | Auto-created with the Price List, or on an Item's first review | No endpoint — created by the platform | System | None | Never created manually. |
| T2 | Draft | ForSale | Set ForSale | `status` field write on `PUT .../items/{id}` (no dedicated endpoint) | Vendor, Operations | None | Pricing not required. Records `audit.published`. |
| T3 | Draft | Private | Set Private | `status` field write on `PUT .../items/{id}` (no dedicated endpoint) | Vendor, Operations | None | For migrating existing business onto the platform. Records `audit.unpublished`. |
| T4 | ForSale | Private | Set Private | `status` field write on `PUT .../items/{id}` (no dedicated endpoint) | Vendor, Operations | None | Withdraws Item from new purchases. Records `audit.unpublished`. |
| T5 | Private | ForSale | Set ForSale | `status` field write on `PUT .../items/{id}` (no dedicated endpoint) | Vendor, Operations | None | Restores full availability. Records `audit.published`. |

> **Note:** Transitions out of Draft are irreversible. A Price List Item cannot return to Draft once it has moved to ForSale or Private.

### 3.3 State Diagram

```
                    T2 (Vendor/Ops)
          ┌─────────────────────────────► [ForSale]
          │                                   ▲  │
[Draft] ──┤                              T5   │  │ T4
          │                                   │  ▼
          └─────────────────────────────► [Private]
                    T3 (Vendor/Ops)
```

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | A Price List Item is created automatically for every [[Item]] past Draft in the parent [[Product]] when a [[Price List]] is created. Price List Items are never created manually. | N/A | All | Draft Items are not included at [[Price List]] creation; they are added on first review (BR-002). |
| BR-002 | When an [[Item]] is submitted for review for the first time (its first Draft→Pending transition), a Price List Item in Draft status is created in every [[Price List]] under that [[Product]]. | N/A | All | Not triggered by [[Item]] creation, and not repeated on later re-reviews. |
| BR-003 | Price List Items cannot be deleted directly. They are permanently removed only as part of deleting the parent [[Product]] (a Draft-Product deletion); deleting a [[Price List]] does not remove its Price List Items. | N/A | All | Consistent with the platform no-cascade deletion invariant. See Section 8 and open question PRI-002. |
| BR-004 | The transition from Draft to ForSale or Private is irreversible. A Price List Item cannot return to Draft. | All | All | ForSale and Private remain mutually reversible. |
| BR-005 | A ForSale Price List Item is available for new purchases and change orders, subject to the mirrored [[Item]] being Published and the parent [[Price List]] being referenced by an active [[Listing]]. | ForSale | All | — |
| BR-006 | A Private Price List Item is available for change orders only. It is not available for new purchases. | Private | All | Used to migrate existing customer subscriptions onto the platform without opening the [[Item]] for new sales. |
| BR-007 | A Draft Price List Item is not available for purchase or change orders regardless of the mirrored [[Item]]'s state. | Draft | All | — |
| BR-008 | If the mirrored [[Item]] is Unpublished, it is unavailable for both new purchases and change orders regardless of Price List Item status. [[Item]] Unpublished overrides Price List Item ForSale or Private. | All | All | Effective availability is the intersection of [[Item]] state and Price List Item status. See Catalog: Product Item canon. |
| BR-009 | `unitLP` and `unitPP` are independently optional; a price is "set" when present and "unset" when absent (write null to clear a value). Either may be set without the other. | All | All | Absence in a response means the value is not set. |
| BR-010 | When both `unitLP` and `unitPP` are set, `unitLP` must be greater than or equal to `unitPP`; a lower `unitLP` is rejected. | All | All | The list price (RRP) cannot be below the purchase price (cost). |
| BR-011 | The platform maintains `unitSP` = `unitPP` × (1 + `markup`). Supplying `markup` derives `unitSP`; supplying `unitSP` derives `markup`. `margin` is derived from `markup`. | All | All | `unitSP`, `margin`, and the period-normalised prices are values the platform maintains, not fields an actor authors independently. |
| BR-012 | On a Vendor's first entry of `unitLP` (when no `unitSP` or `markup` is yet set), the platform defaults `unitSP` to `unitLP` — pass-through at the Vendor's RRP — deriving `markup` accordingly. Operations may subsequently set or adjust `markup`, which recomputes `unitSP` from `unitPP`. | All | Vendor, Operations | The default is pass-through pricing at RRP on the Vendor's initial entry; Operations adjusts markup per commercial strategy from that baseline. |
| BR-013 | `markup` and `margin` are visible to Operations only. Cost fields (`unitPP` and the PP-normalised variants) are hidden from Client; sales fields (`unitSP` and the SP-normalised variants) are hidden from Vendor; list fields (`unitLP` and the LP-normalised variants) are visible to all. | All | All | markup and margin reflect SoftwareOne's commercial position and are not disclosed to Vendors or Clients. |
| BR-014 | The period-normalised prices are derived from the unit prices and the billing period of the mirrored [[Item]]. The applicable set is `x1` for one-time items, and `xM`/`xY`/`x3Y` (per-month, per-year, per-three-years) for subscription items. | All | All | e.g. for a yearly item, PPxM = `unitPP` / 12. Applies to the PP, SP, and LP families, subject to the visibility in BR-013. |
| BR-015 | All unit prices (`unitLP`, `unitPP`, `unitSP`) represent the price for one billing-period duration of the mirrored [[Item]] — not an assumed annual price. | All | All | e.g. for a 3-year Item, `unitPP` is the 3-year price. PPxY = `unitPP` / 3. PPxM = `unitPP` / 36. |
| BR-016 | `info.visible` controls whether `info.description` is rendered to the Client. When `info.visible` = false, the description is not shown regardless of whether it is populated. `info.visible` scopes `info.description` only — it has no effect on availability, pricing visibility, or status. | All | All | — |
| BR-017 | `info.description` has a maximum length of 400 characters including all markdown/HTML tags. | All | Vendor, Operations | — |
| BR-018 | When `info.visible` = true and `info.description` is populated, a Client sees a circle-i icon next to the [[Item]] in the [[Price List]]; hovering reveals the description. Applies to ForSale items (new-purchase context) and Private items (change-order selection context), not Draft items. | ForSale, Private | Client | — |
| BR-019 | `description` is an optional free-text field, separate from `info.description` and not gated by `info.visible`. `reasonForChange` is an optional free-text note recording why a change was made, settable and visible only by Operations. | All | All | Both have a maximum length of 500 characters. |

---

## 5. Key Attributes

| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |
| --- | --- | --- | --- | --- | --- |
| status | Enum | One of: Draft, ForSale, Private | Vendor, Operations | Yes — via state transitions only | Visible To: All. Draft → ForSale or Private is irreversible. |
| name | String | System-generated identifier. Always identical to id. | System | No | Visible To: All. Carries no independent semantic value. |
| description | String | Optional free-text description of the Price List Item | Vendor, Operations | Yes | Visible To: All. Max 500 characters. Separate from info.description; not gated by info.visible. Absent from response when null. |
| reasonForChange | String | Optional note recording why a change was made | Operations | Yes | Visible To: Operations only. Set by Operations only — a value supplied by another Actor is ignored. Max 500 characters. |
| unitLP | Decimal | Vendor's List Price (RRP) for one billing-period unit | Vendor, Operations | Yes | Visible To: All. Optional — absent when not set. Write null to clear. Must be ≥ unitPP when both set (see BR-010). |
| unitPP | Decimal | Purchase Price — what SoftwareOne pays the Vendor for one billing-period unit | Vendor, Operations | Yes | Visible To: Vendor, Operations. Optional — absent when not set. Write null to clear. |
| markup | Decimal | SoftwareOne's markup % applied to unitPP to derive unitSP | Operations | Yes | Visible To: Operations only. Supplying markup derives unitSP (see BR-011). |
| unitSP | Decimal | Sales Price — what the Client pays SoftwareOne for one billing-period unit | Vendor (indirect), Operations | Yes | Visible To: Client, Operations. Maintained by the platform as unitPP × (1 + markup); supplying it derives markup. |
| margin | Decimal | Gross margin % derived from markup | System | N/A | Visible To: Operations only. Derived from markup. |
| PPxM / PPxY / PPx3Y | Decimal | unitPP normalised to per-month / per-year / per-three-years | System | N/A | Visible To: Vendor, Operations. Derived. Present for subscription items. |
| SPxM / SPxY / SPx3Y | Decimal | unitSP normalised to per-month / per-year / per-three-years | System | N/A | Visible To: Client, Operations. Derived. Present for subscription items. |
| LPxM / LPxY / LPx3Y | Decimal | unitLP normalised to per-month / per-year / per-three-years | System | N/A | Visible To: All. Derived. Present for subscription items. |
| PPx1 | Decimal | unitPP for one-time items | System | N/A | Visible To: Vendor, Operations. Derived. Present for one-time items only. |
| SPx1 | Decimal | unitSP for one-time items | System | N/A | Visible To: Client, Operations. Derived. Present for one-time items only. |
| LPx1 | Decimal | unitLP for one-time items | System | N/A | Visible To: All. Derived. Present for one-time items only. |
| info.visible | Boolean | Controls whether info.description is shown to the Client | Vendor, Operations | Yes | Visible To: All. Default: false. Scoped to info.description only. |
| info.description | String | Optional markdown/HTML content giving the Client additional pricing or billing context | Vendor, Operations | Yes | Visible To: All (when info.visible = true). Max 400 characters including tags. Rendered as a tooltip (circle-i icon). |
| priceList | Object (PriceListRef) | Reference to the parent [[Price List]] | System | No | Visible To: All. Summary reference (id, revision, currency). |
| item | Object (ProductItemRef) | Reference to the mirrored [[Item]] | System | No | Visible To: All. Summary reference (id, name, revision, externalIds). |
| revision | Integer | Increments on each update | System | N/A | Visible To: All. |
| audit | Object | Records created, updated, published, and unpublished events, each with timestamp and Actor reference | System | N/A | Visible To: All. Returned by default. published is stamped on each ForSale transition, unpublished on each Private transition. |

---

## 6. Relationships to Other Objects

| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |
| --- | --- | --- | --- | --- |
| Catalog: Price List | Parent | Many:1 | A Price List Item belongs to exactly one Price List. | Yes — Price List Item cannot exist without a parent Price List. |
| Catalog: Product Item | Mirror | One:1 | Each Price List Item permanently mirrors exactly one Product Item within the same Product. | Yes — Price List Item is created in permanent correspondence with its Product Item. |
| Catalog: Listing | Association | Many:Many | A ForSale Price List Item is available to Clients only through an active Listing that references its parent Price List. | No |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Price List Item created | A [[Price List]] is created, or an [[Item]] is submitted for review for the first time | System | Price List Item enters Draft status. No pricing fields are set. |
| unitLP / unitPP set by Vendor | Vendor sets list and/or purchase price | Vendor | On the Vendor's first `unitLP` entry the platform defaults `unitSP` to `unitLP`; `unitSP`, `margin`, and the normalised prices are recomputed. |
| markup set or adjusted by Operations | Operations sets or changes `markup` | Operations | `unitSP`, `margin`, and the normalised SP prices are recomputed. |
| Status set to ForSale | T2 or T5 | Vendor, Operations | Item available for new purchases and change orders via active Listings. `audit.published` recorded. |
| Status set to Private | T3 or T4 | Vendor, Operations | Item restricted to change orders only. `audit.unpublished` recorded. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Item Unpublished | Price List Item | Item becomes effectively unavailable for new purchases and change orders regardless of Price List Item status. Price List Item status is unchanged. | Yes | Always when the mirrored [[Item]] is Unpublished | [[Item]] state overrides Price List Item status. Re-publishing the [[Item]] restores effective availability without a Price List Item status change. |
| Parent Product deleted | Price List Item | Price List Item is permanently removed — no longer retrievable via the API | Yes | Only when the parent [[Product]] is deleted (Draft only) | Deleting a [[Price List]] alone does not remove its Price List Items (BR-003). |

---

## 8. Reversibility & Data Retention

**Reversible transitions:**
- ForSale ↔ Private (bidirectional)

**Irreversible transitions:**
- Draft → ForSale (cannot return to Draft)
- Draft → Private (cannot return to Draft)

**Deletion:**
- Price List Items cannot be deleted directly. They are permanently removed — no longer retrievable via the API — only as part of deleting the parent [[Product]] (Draft only).
- Deleting a [[Price List]] does not remove its Price List Items; the platform does not cascade the deletion (see open question PRI-002 for the retrievability of the Items afterward).

**Audit & history requirements:**
The audit block records `created`, `updated`, `published`, and `unpublished` events, returned by default. `published` is stamped on each transition to ForSale and `unpublished` on each transition to Private (each is a single timestamp, overwritten on re-transition).

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Price List Item set to ForSale with no pricing set | Transition succeeds. Item is available but has no prices. | Client | High | The platform does not require pricing before the ForSale transition. The Vendor is responsible for completing pricing before making Items available. |
| `unitLP` set below `unitPP` | Rejected. The list price cannot be below the purchase price. | Vendor | Low | See BR-010. |
| `info.description` populated but `info.visible` = false | Description is stored but not shown to the Client. No error. | None | Low | Intentional — allows a Vendor to stage content before surfacing it. |
| Mirrored [[Item]] Unpublished while Price List Item is ForSale | Price List Item status remains ForSale but the Item is effectively unavailable. Re-publishing the [[Item]] restores availability without a status change. | Client | Medium | Effective availability is the intersection of [[Item]] state and Price List Item status. |

---

## 10. Open Questions

| # | Question |
| --- | --- |
| PRI-002 | After a [[Price List]] is deleted directly (not via a parent [[Product]] deletion), are its Price List Items still retrievable via the API? The Items are not cascade-deleted and their records persist; the mirrored-owner [[Price List]] no longer resolves. A Vendor is expected to no longer retrieve them, but the behaviour for Operations and Client is unconfirmed and requires a live create-then-delete test. |

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.3 | 2026-07-16 | Stu / canon-generate | Major refresh via live OpenAPI schema (STAGING), live-fetched real objects in all three states (Draft/ForSale/Private, multi-Actor), and source-code research. ID Prefix corrected (was "None", is PRI) and the redundant "PRI" Also Known As removed; stale version header (0.1) aligned with the changelog. **Significant corrections:** field visibility corrected — `unitLP` and the LP-normalised variants are visible to all Actors (including Client), `unitSP` and the SP variants are Client+Operations (not Vendor), `unitPP` and the PP variants are Vendor+Operations, `markup`/`margin`/`reasonForChange` are Operations-only (BR-013, Section 2/5) — corrects the prior "unitLP Vendor/Ops-only, unitSP Ops-only". Client read is state-gated to ForSale (404 for Draft/Private). `unitSP` is maintained by the platform (BR-011), not "never stored/computed on read". Removed the per-item `defaultMarkup` fallback claim (old BR-012 second clause and the Section 9 row) — a Price List Item never consumes the parent `defaultMarkup`; this reconciles with the `Catalog: Price List` v0.5 refresh. BR-012 pass-through clause tightened to a Vendor's first `unitLP` entry. Section 3.2 Endpoint/Verb columns filled — transitions are `status` writes on the update endpoint, no dedicated endpoints. Deletion corrected (BR-003, Section 8): Price List Items are removed only via parent-Product deletion, not by deleting the Price List; added open question PRI-002 on retrievability after a direct Price List deletion. Added `description` and `reasonForChange` attributes (BR-019); added the `x3Y` period-normalised set and reframed variants as derived per the mirrored Item's billing period (BR-014); added the `unitLP ≥ unitPP` rule (BR-010); audit now records the `unpublished` event; added `priceList` and `item` reference attributes and a Catalog: Listing association. BR-001/BR-002 auto-creation triggers corrected to first review (Draft→Pending), matching the Price List canon. |
| 0.2 | 2026-03-09 | Stu | BR-012 updated with defaultMarkup fallback when unitLP unsupported. BR-018 updated to include Private items. name attribute added. |
| 0.1 | 2026-03-09 | Stu | Initial canon. |
