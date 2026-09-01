# Implementation Canon: Adobe

> **Version:** 0.2
> **Owner:** Unassigned
> **Last Updated:** 2026-08-28
> **Status:** Draft

---

## 1. Identity

**Implementation Name:** Adobe

**Implements:** Integration

**Parent Implementation:** None — top-level implementation.

**Description:**
Adobe is the [[Integration]] through which the SoftwareOne Marketplace sells and fulfils Adobe VIP Marketplace
subscriptions. SoftwareOne builds and operates it; Adobe supplies the upstream API it consults and the commercial
programme it enforces. It holds several contracts with the platform at once — a synchronous check on draft
[[Order]]s, event-driven fulfilment of placed ones, and recurring work on its own clock — and holds them all under
one Vendor Actor, one credential per environment and one deployment.

**Also Known As:**
Adobe VIP Marketplace extension, VIPM extension, `swo-adobe-vipm-extension`.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Implements | Notes |
| --- | --- | --- | --- | --- | --- |
| BR-001 | Adobe acts as the Vendor for the [[Product]]s it fulfils, and holds one platform credential per environment rather than one per consuming [[Account]]. | N/A | Vendor | integration:br-001 | Every write it makes is attributed to that Vendor Actor, including those it makes while answering a callout. |
| BR-002 | It records its own identifier for an [[Order]], a [[Subscription]] and an [[Item]] in that object's Vendor-partitioned external identifier, and reads its own back on every subsequent step. | N/A | Vendor | integration:br-007 | The [[Item]] identifier is the mapping between the platform's catalogue and Adobe's own, and is set by the Vendor when the [[Product]] is defined rather than during fulfilment. |
| BR-003 | Which Adobe credentials it uses for a given [[Order]] is decided by the [[Authorization]] on that Order's [[Agreement]]. One [[Authorization]] maps to one Adobe account, currency and distributor. | N/A | Vendor | — | An [[Authorization]] the extension's own configuration does not know is an error it raises, not a case it falls back from. |
| BR-004 | Its recurring work — commitment processing, migration, and synchronisation of [[Agreement]]s, [[Subscription]]s and prices from Adobe — runs on its own infrastructure and is not declared to the platform. | N/A | Vendor | — | The platform cannot enumerate it, cannot trigger it, and does not know when it last ran. |
| BR-005 | It reads its configuration from its own deployment rather than from per-[[Account]] configuration held by the platform. | N/A | Vendor | integration:br-005 | Narrows multi-tenancy to the single-tenant case: one deployment serves every consuming [[Account]] under one credential. Consequence of BR-001: it does not act under a consuming Account's installation, so there is no per-Account configuration for it to read. |
| BR-006 | Its contract with the platform is registered in the platform rather than declared by its own code, so the platform routes to it what that registration names and the extension itself carries no declaration to compare against. | N/A | Vendor | integration:br-004 | Consequence of how it is built: the runtime it uses in this line generates no declaration. Changing what Adobe is asked is a platform-side change. |

---

## 5. Key Concepts

| Concept | Description | Implements | Notes |
| --- | --- | --- | --- |
| Platform credential | The [[API Token]] Adobe presents on every call it makes to the platform's public API, bound to its Vendor [[Account]]. | integration:actor-credential | One per environment. Revoking it stops fulfilment and synchronisation alike; validation would continue to be called and would fail. |
| Vendor external identifier | Adobe's own identifier for a platform object, written to the Vendor-partitioned external identifier of an [[Order]], a [[Subscription]] or an [[Item]]. | integration:correlation-identifier | On an [[Item]] it is the Adobe SKU, which makes it a catalogue mapping rather than a record of something Adobe created. |
| Deployment configuration | Adobe's credentials, its Adobe-side account mapping and its per-[[Product]] secrets, mounted into its own deployment. | integration:tenant-configuration | Adobe holds no per-[[Account]] configuration in the platform at all, because it does not act under a consuming Account's installation. |
| Operational job | Recurring work Adobe runs on a clock — commitment processing, migration, synchronisation of [[Agreement]]s and prices. | integration:scheduled-trigger | These run as jobs in Adobe's own deployment, not as triggers the platform declares and calls on a schedule. |
| Running instance | Adobe's deployed code, in two shapes: one that answers the platform's callouts and receives [[Order]] events, and one that runs its recurring work. | integration:instance | Version and health are Adobe's own; the platform is told neither. See ADOBE-003. |
| Adobe authorization | The mapping from one platform [[Authorization]] to one set of Adobe credentials, with its currency and distributor. | — | The join between the two systems' commercial structures. It is configuration in Adobe's deployment, not a platform object. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Adobe authentication | Any call Adobe makes upstream, when its cached upstream token has expired | — | A fresh token is obtained per authorization and cached until shortly before it expires. |
| Commitment cycle | Adobe's own schedule reaches a commitment that is due | — | Adobe advances the commitment upstream and reflects the outcome on the Agreement. Not visible to the platform as an event. |
| Failure reported to operators | An unhandled error anywhere in Adobe's own code | — | Adobe posts to its operators' own channel. The platform is not told, and nothing about it reaches the object being worked on. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Synchronisation run | Commerce: Agreement | Agreement parameters and the commitment state Adobe keeps are brought into line with Adobe's own record. | Yes | Adobe's own schedule reached the [[Agreement]] | Not triggered by the platform and not visible to it as an event. See BR-004. |
| Synchronisation run | Commerce: Subscription | [[Subscription]] attributes and prices are brought into line with Adobe's own record. | Yes | As above | — |
| Any authenticated call | Audit: Audit Record | A record is written against Adobe's Vendor Actor. | Yes | Always | Nothing distinguishes Adobe's writes from a person's beyond the Actor they are attributed to. |

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| The [[Authorization]] has no Adobe counterpart in the deployment configuration | The extension raises rather than proceeding. What the Client sees depends on which contract it happened under. | Client | Medium | A configuration gap presents as a runtime failure, not as a validation message. See ADOBE-002. |
| Adobe's platform credential is deleted or disabled | Every outbound call fails at once: fulfilment stops and synchronisation stops. Callouts continue to be made and continue to fail. | Client, Vendor, Operations | High | One credential per environment means there is no partial degradation. |
| A synchronisation run overwrites a value a person changed on the platform | Adobe's record wins. The platform holds no notion of a locally-authoritative value for the fields Adobe synchronises. | Client, Operations | Medium | See BR-004. |

---

## 10. Open Questions

- [ ] [ADOBE-001]: How many platform credentials does Adobe hold, and at what granularity? The implementation takes a single token per running instance, while its Adobe-side credentials are per [[Authorization]] — whether more than one platform credential is in use is not established.
- [ ] [ADOBE-002]: What does the Client see when an [[Order]]'s [[Authorization]] has no Adobe counterpart configured? The extension raises; whether that surfaces as a failed Order, a Querying Order, or nothing at all was not traced.
- [ ] [ADOBE-003]: Does Adobe run more than one instance, and if so how do its scheduled jobs avoid processing the same [[Agreement]] twice?
- [ ] [ADOBE-004]: Does Adobe occupy the platform's user-interface or deferred-work channels at all? Its own code declares neither, but its contract is registered platform-side rather than declared by that code, so absence from the code is not evidence of absence from the registration.
- [ ] [ADOBE-005]: Which further contracts does Adobe hold with the platform beyond the ones recorded here? What is recorded of its recurring work is what the evidence supports and less than that work appears to be. Catalogue and price maintenance, billing, and the user-interface functions Adobe is said to serve have not been derived from evidence at all.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.2 | 2026-08-28 | Anton | Reduced to the umbrella of a family. Provenance moved out of Section 1 into this changelog. The pre-placement and post-placement contracts moved to Adobe Validation and Adobe Fulfilment, which name this document as parent; what remains is what holds of Adobe whatever contract it is acting under. Rules and open questions were renumbered rather than left with gaps, since nothing addressed the old identifiers. ADOBE-005 opened on the contracts that have no document yet. |
| 0.1 | 2026-08-27 | Marcerito | Initial draft. First Implementation canon document. Derived from the implementation's own source; not confirmed against a running instance and not confirmed with Adobe. |
