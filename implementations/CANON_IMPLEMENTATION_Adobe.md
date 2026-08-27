# Implementation Canon: Adobe

> **Version:** 0.1
> **Owner:** Unassigned
> **Last Updated:** 2026-08-27
> **Status:** Draft

---

## Platform Invariants

**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. Invariants 1–3 — Actor attribution, Actor-contextual automation, and Actor-attributable audit — apply to this implementation without exception. Everything this document does not bind is unbound: Integration still declares it, and canon does not distinguish "not implemented here" from "not recorded here".

---

## 1. Identity

**Implementation Name:** Adobe

**Implements:** Integration

**Description:**
Adobe is the [[Integration]] through which the SoftwareOne Marketplace sells and fulfils Adobe VIP Marketplace subscriptions. SoftwareOne builds and operates it; Adobe supplies the upstream API it consults and the commercial programme it enforces. It occupies two of the platform's contact channels — it answers a pre-purchase validation callout and it listens for [[Order]] events — and does everything else through the public API as the Vendor Actor, on its own schedule and its own infrastructure. Every row below was established by reading the implementation's own source; nothing here was confirmed against a running instance, and nothing was confirmed with Adobe.

**Also Known As:**
Adobe VIP Marketplace extension, VIPM extension, `swo-adobe-vipm-extension`.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Implements | Notes |
| --- | --- | --- | --- | --- | --- |
| BR-001 | Adobe acts as the Vendor for the [[Product]]s it fulfils, and holds one platform credential per environment rather than one per consuming [[Account]]. | N/A | Vendor | integration:br-001 | Every write it makes is attributed to that Vendor Actor, including those it makes while answering a callout. |
| BR-002 | It participates in exactly four kinds of [[Order]] — Purchase, Change, Termination and Configuration. Suspend, Resume and the platform's Renewal type are outside it. | N/A | Vendor | — | Those four are precisely the types for which the platform will consult a Vendor before the Order is placed. |
| BR-003 | It expresses an at-anniversary renewal and a mid-term upgrade as Change [[Order]]s carrying a Vendor-defined [[Parameter]] whose value it alone interprets, not as the platform's own Renewal Order type. | N/A | Vendor | — | The platform's Renewal type receives no pre-purchase callout, so a renewal expressed that way could not be checked with Adobe before it was placed. |
| BR-004 | Asked to validate a draft [[Order]], it answers synchronously with that Order revised — values corrected, [[Parameter]] visibility adjusted, or an error attached — and the platform applies the answer. | N/A | Vendor | integration:br-006 | It clears any error it previously wrote before evaluating, so each callout is a question about the current draft and never about what it said last time. |
| BR-005 | It rejects an [[Order]] inside a successful response, by attaching an error to the Order or to the individual [[Parameter]] at fault. A failed response means the extension itself did not complete, not that the Order was refused. | N/A | Vendor | — | The two are different outcomes carried by different mechanisms, and only the first is a statement about the Order. |
| BR-006 | It records its own identifier for an [[Order]], a [[Subscription]] and an [[Item]] in that object's Vendor-partitioned external identifier, and reads its own back on every subsequent step. | N/A | Vendor | integration:br-007 | The [[Item]] identifier is the mapping between the platform's catalogue and Adobe's own, and is set by the Vendor when the [[Product]] is defined rather than during fulfilment. |
| BR-007 | Which Adobe credentials it uses for a given [[Order]] is decided by the [[Authorization]] on that Order's [[Agreement]]. One [[Authorization]] maps to one Adobe account, currency and distributor. | N/A | Vendor | — | An [[Authorization]] the extension's own configuration does not know is an error it raises, not a case it falls back from. |
| BR-008 | It sets its own deadline for completing an [[Order]] and stores it on the Order as a fulfilment-phase [[Parameter]]. When the deadline passes with the Order still incomplete, it fails the Order itself. | N/A | Vendor | — | The platform imposes no time limit on fulfilment; this one is Adobe's, and it is visible to anyone reading the Order because it is written to a Parameter. |
| BR-011 | Its contract with the platform is registered in the platform rather than declared by its own code, so the platform routes to it what that registration names and the extension itself carries no declaration to compare against. | N/A | Vendor | integration:br-004 | Consequence of how it is built: the runtime it uses in this line generates no declaration. Changing what Adobe is asked is a platform-side change. |
| BR-009 | Its recurring work — commitment processing, migration, and synchronisation of [[Agreement]]s, [[Subscription]]s and prices from Adobe — runs on its own infrastructure and is not declared to the platform. | N/A | Vendor | — | The platform cannot enumerate it, cannot trigger it, and does not know when it last ran. |
| BR-010 | It reads its configuration from its own deployment rather than from per-[[Account]] configuration held by the platform. | N/A | Vendor | integration:br-005 | Narrows multi-tenancy to the single-tenant case: one deployment serves every consuming [[Account]] under one credential. Consequence of BR-001: it does not act under a consuming Account's installation, so there is no per-Account configuration for it to read. |

---

## 5. Key Concepts

| Concept | Description | Implements | Notes |
| --- | --- | --- | --- |
| Validation endpoint | The one path Adobe serves for the platform to call. It accepts a draft [[Order]] and returns it revised, and it authenticates the caller by a secret it resolves from the [[Webhook]] that made the call. | integration:served-api | It serves nothing else. Everything else Adobe does is outbound. |
| Order event subscription | Adobe's subscription to [[Order]] events. Receiving one is what starts fulfilment; the platform decides when to send it. | integration:event-subscription | The single event that drives all provisioning. |
| Callout registration | The platform [[Webhook]] that points at the validation endpoint, carrying the criteria that decide which [[Order]]s trigger it and the secret that proves the call came from the platform. | integration:webhook-handler | Adobe does not declare this. It is registered in the platform, and Adobe reads it back by identifier when a call arrives. |
| Platform credential | The [[API Token]] Adobe presents on every call it makes to the platform's public API, bound to its Vendor [[Account]]. | integration:actor-credential | One per environment. Revoking it stops fulfilment and synchronisation alike; validation would continue to be called and would fail. |
| Vendor external identifier | Adobe's own identifier for a platform object, written to the Vendor-partitioned external identifier of an [[Order]], a [[Subscription]] or an [[Item]]. | integration:correlation-identifier | On an [[Item]] it is the Adobe SKU, which makes it a catalogue mapping rather than a record of something Adobe created. |
| Deployment configuration | Adobe's credentials, its Adobe-side account mapping and its per-[[Product]] secrets, mounted into its own deployment. | integration:tenant-configuration | Bound to record that the platform's mechanism **does not apply here**: Adobe holds no per-[[Account]] configuration in the platform, because it does not act under a consuming Account's installation. |
| Operational job | Recurring work Adobe runs on a clock — commitment processing, migration, synchronisation of [[Agreement]]s and prices. | integration:scheduled-trigger | Bound to record that the platform's mechanism **is not the one used**: these run as jobs in Adobe's own deployment, not as triggers the platform declares and calls. |
| Running instance | Adobe's deployed code, in two shapes: one that answers the validation endpoint and receives [[Order]] events, and one that runs its recurring work. | integration:instance | Version and health are Adobe's own; the platform is told neither. See ADOBE-004. |
| Adobe authorization | The mapping from one platform [[Authorization]] to one set of Adobe credentials, with its currency and distributor. | — | The join between the two systems' commercial structures. It is configuration in Adobe's deployment, not a platform object. |
| Renewal instruction | A Vendor-defined [[Parameter]] on a Change [[Order]] whose value is a document Adobe alone reads, distinguishing a renewal at anniversary from an early one. | — | The platform stores and returns the value and validates nothing about its content. See BR-003. |
| Processing deadline | A fulfilment-phase [[Parameter]] Adobe writes to an [[Order]] on first processing it, holding the date after which it will fail the Order rather than keep trying. | — | See BR-008. |
| Three-year commitment | An Adobe commercial arrangement, and the state Adobe keeps about it against an [[Agreement]] — requested, enrolled, or expiring. | — | Adobe's own concept. The platform holds only what Adobe writes to Parameters about it. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Adobe authentication | Any call Adobe makes upstream, when its cached upstream token has expired | — | A fresh token is obtained per authorization and cached until shortly before it expires. |
| Upstream order submitted | A platform Order has passed Adobe's own checks during fulfilment | — | Adobe places the corresponding order in its own system and records the identifier it gets back. |
| Return order submitted | Fulfilment determines that a previous upstream order must be reversed | — | Adobe submits a return upstream before proceeding. Reversal is an upstream act, not a platform one. |
| Commitment cycle | Adobe's own schedule reaches a commitment that is due | — | Adobe advances the commitment upstream and reflects the outcome on the Agreement. Not visible to the platform as an event. |
| Failure reported to operators | An unhandled error during validation or fulfilment | — | Adobe posts to its operators' own channel. The platform is not told, and nothing about it reaches the Order. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Validation answered | Commerce: Order | Parameter values, parameter visibility and the order-level error are set to what Adobe returned. | Yes | The callout was enabled for the [[Product]] and Adobe answered in time. | No status change. The write is the platform's, made under the credential that registered the callout. |
| Upstream order accepted | Commerce: Order | Adobe's identifier is recorded against the Order and processing continues. | Yes | Adobe's own system accepted the order. | — |
| Fulfilment completed | Commerce: Order | The Order is completed with the template Adobe selects. | Yes | Every step of Adobe's pipeline succeeded. | — |
| Fulfilment needs the Client | Commerce: Order | The Order is moved to Querying with the reason Adobe gives. | Yes | Adobe determined the Order cannot proceed as composed. | This is how Adobe asks for a correction after the Order has been placed. |
| Fulfilment failed | Commerce: Order | The Order is failed with the reason Adobe gives. | Yes | An unrecoverable error, or Adobe's own processing deadline passed. | See BR-008. |
| Provisioning succeeded | Commerce: Order Subscription | A subscription is created against the Order carrying Adobe's identifier and its commitment dates. | Yes | Adobe provisioned the corresponding subscription upstream. | — |
| Synchronisation run | Commerce: Agreement | Agreement parameters and the commitment state Adobe keeps are brought into line with Adobe's own record. | Yes | Adobe's own schedule reached the Agreement. | Not triggered by the platform and not visible to it as an event. See BR-009. |
| Synchronisation run | Commerce: Subscription | Subscription attributes and prices are brought into line with Adobe's own record. | Yes | As above. | — |

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Adobe's own system is unreachable during validation | The extension does not answer. The [[Order]] proceeds unvalidated and the Client is told nothing. | Client, Vendor | High | Indistinguishable from the extension being down. Adobe is expected to catch the problem during fulfilment instead. |
| Adobe's own system is unreachable during fulfilment | Processing does not complete. It is retried until Adobe's own deadline passes, after which the [[Order]] is failed. | Client, Vendor | Medium | The Client sees a long-running Order, then a failure. See BR-008. |
| The [[Authorization]] has no Adobe counterpart in the deployment configuration | The extension raises rather than proceeding. What the Client sees depends on which phase it happened in. | Client | Medium | A configuration gap presents as a runtime failure, not as a validation message. See ADOBE-002. |
| The extension itself fails while validating | The response is unsuccessful. The platform discards it and the [[Order]] proceeds unvalidated. | Client, Vendor | High | Distinct from a rejection — see BR-005 — but indistinguishable from silence from the Client's side. |
| An [[Item]] carries no Adobe identifier | Adobe cannot map the line to anything upstream. | Vendor | Medium | A catalogue error rather than an ordering one: the mapping is set when the [[Product]] is defined. |

---

## 10. Open Questions

- [ ] [ADOBE-001]: How many platform credentials does Adobe hold, and at what granularity? The implementation takes a single token per running instance, while its Adobe-side credentials are per [[Authorization]] — whether more than one platform credential is in use is not established.
- [ ] [ADOBE-002]: What does the Client see when an [[Order]]'s [[Authorization]] has no Adobe counterpart configured? The extension raises; whether that surfaces as a failed Order, a Querying Order, or nothing at all was not traced.
- [ ] [ADOBE-003]: Which of the four order types is pre-validation actually enabled for, per [[Product]]? Enablement is the Product's own setting, and what is switched on in each environment is platform data this document has not read.
- [ ] [ADOBE-004]: Does Adobe run more than one instance, and if so how do its scheduled jobs avoid processing the same [[Agreement]] twice?
- [ ] [ADOBE-005]: What does Adobe do with the platform's Renewal Order type now that it exists? BR-003 records that it does not use it; whether that is a decision, a gap, or work in progress is not established.
- [ ] [ADOBE-006]: Does Adobe occupy the platform's user-interface or deferred-work channels at all? Its own code declares neither, but its validation callout is registered platform-side rather than declared by that code, so absence from the code is not evidence of absence from the registration.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-08-27 | Marcerito | Initial draft. First Implementation canon document. Derived from the implementation's own source; not confirmed against a running instance and not confirmed with Adobe. |
