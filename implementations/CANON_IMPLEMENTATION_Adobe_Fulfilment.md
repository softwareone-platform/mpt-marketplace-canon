# Implementation Canon: Adobe Fulfilment

> **Version:** 0.1
> **Owner:** Unassigned
> **Last Updated:** 2026-08-28
> **Status:** Draft

---

## 1. Identity

**Implementation Name:** Adobe Fulfilment

**Implements:** Fulfilment Integration

**Parent Implementation:** Adobe

**Description:**
Adobe Fulfilment is what Adobe does with an [[Order]] once the Client has placed it: it receives the event, places the corresponding order in Adobe's own system, records what came back, and drives the platform's Order to a terminal state. It carries the weight of the relationship: every provisioning outcome the platform holds for an Adobe [[Subscription]] arrived through it. Unlike validation, nothing here is synchronous and nobody is waiting on a response: Adobe decides when the Order is finished, and until it does the Order sits where Adobe left it. 

**Also Known As:**
Adobe provisioning, VIPM order processing.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Implements | Notes |
| --- | --- | --- | --- | --- | --- |
| BR-001 | It expresses an at-anniversary renewal and a mid-term upgrade as Change [[Order]]s carrying a Vendor-defined [[Parameter]] whose value it alone interprets, not as the platform's own Renewal Order type. | N/A | Vendor | — | The platform's Renewal type receives no pre-placement callout, so a renewal expressed that way could not be checked with Adobe before it was placed. |
| BR-002 | It sets its own deadline for completing an [[Order]] and stores it on the Order as a fulfilment-phase [[Parameter]]. When the deadline passes with the Order still incomplete, it fails the Order itself. | N/A | Vendor | integration-fulfilment:br-003 | The platform imposes no time limit; this one is Adobe's, and it is visible to anyone reading the Order because it is written to a Parameter. |
| BR-003 | It retries an [[Order]] it did not complete, on its own schedule, until either the Order completes or its deadline passes. | N/A | Vendor | integration-fulfilment:br-006 | The platform re-drives nothing, so every attempt after the first is Adobe's own. |
| BR-004 | It reverses a previous upstream order by submitting a return in Adobe's own system before proceeding, rather than by anything on the platform. | N/A | Vendor | — | The platform has no notion of undoing a provisioned outcome; the reversal exists only upstream and reaches the platform as ordinary writes. |
| BR-005 | It keeps the state of an Adobe three-year commitment against the [[Agreement]] as [[Parameter]] values it writes and reads back. | N/A | Vendor | — | Adobe's own: the abstraction has no rule about what an integration chooses to record. The platform stores the values and assigns them no meaning. See AFUL-002. |

---

## 5. Key Concepts

| Concept | Description | Implements | Notes |
| --- | --- | --- | --- |
| Order event subscription | Adobe's subscription to [[Order]] events. Receiving one is what starts fulfilment; the platform decides when to send it. | integration:event-subscription | The single event that drives all provisioning. |
| Upstream order | The order Adobe places in its own system for a platform [[Order]], and the identifier it gets back and records. | integration-fulfilment:provisioning-outcome | The platform holds the identifier and nothing about the upstream order's own state. |
| Renewal instruction | A Vendor-defined [[Parameter]] on a Change [[Order]] whose value is a document Adobe alone reads, distinguishing a renewal at anniversary from an early one. | — | The platform stores and returns the value and validates nothing about its content. See BR-001. |
| Processing deadline | A fulfilment-phase [[Parameter]] Adobe writes to an [[Order]] on first processing it, holding the date after which it will fail the Order rather than keep trying. | integration-fulfilment:recorded-working-state | See BR-002. |
| Three-year commitment | An Adobe commercial arrangement, and the state Adobe keeps about it against an [[Agreement]] — requested, enrolled, or expiring. | — | Adobe's own concept. The platform holds only what Adobe writes to Parameters about it. |
| Querying reason | The explanation Adobe attaches when it moves an [[Order]] to Querying rather than failing it. | integration-fulfilment:query-reason | How Adobe asks for a correction after the Order has been placed. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Upstream order submitted | A platform Order has passed Adobe's own checks during fulfilment | — | Adobe places the corresponding order in its own system and records the identifier it gets back. |
| Return order submitted | Fulfilment determines that a previous upstream order must be reversed | — | Adobe submits a return upstream before proceeding. Reversal is an upstream act, not a platform one. |
| Retry | An Order Adobe did not complete comes round again on Adobe's own schedule | — | Adobe resumes from what it recorded on the Order, not from anything the platform re-sent. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Upstream order accepted | Commerce: Order | Adobe's identifier is recorded against the [[Order]] and processing continues. | Yes | Adobe's own system accepted the order. | — |
| Fulfilment completed | Commerce: Order | The [[Order]] is completed with the template Adobe selects. | Yes | Every step of Adobe's pipeline succeeded. | — |
| Fulfilment needs the Client | Commerce: Order | The [[Order]] is moved to Querying with the reason Adobe gives. | Yes | Adobe determined the Order cannot proceed as composed. | — |
| Fulfilment failed | Commerce: Order | The [[Order]] is failed with the reason Adobe gives. | Yes | An unrecoverable error, or Adobe's own processing deadline passed. | See BR-002. |
| Provisioning succeeded | Commerce: Order Subscription | A subscription is created against the [[Order]] carrying Adobe's identifier and its commitment dates. | Yes | Adobe provisioned the corresponding subscription upstream. | — |

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Adobe's own system is unreachable during fulfilment | Processing does not complete. It is retried until Adobe's own deadline passes, after which the [[Order]] is failed. | Client, Vendor | Medium | The Client sees a long-running Order, then a failure. See BR-002 and BR-003. |
| An [[Item]] on the [[Order]] carries no Adobe identifier | Adobe cannot map the line to anything upstream and the Order cannot be fulfilled. | Vendor, Client | Medium | A catalogue error rather than an ordering one: the mapping is set when the [[Product]] is defined. |
| An upstream order was accepted but the platform write that records it did not happen | Adobe's next attempt has no record that the upstream order exists. What it does then is not established — see AFUL-003. | Client, Vendor | High | The identifier on the [[Order]] is the only link between the two systems. |

---

## 10. Open Questions

- [ ] [AFUL-001]: What does Adobe do with the platform's Renewal [[Order]] type now that it exists? BR-001 records that it does not use it; whether that is a decision, a gap, or work in progress is not established.
- [ ] [AFUL-002]: What are the full states of an Adobe three-year commitment, what moves it between them, and which of them the platform is ever shown? Requested, enrolled and expiring were observed; the set may not be complete.
- [ ] [AFUL-003]: Is fulfilment idempotent against a redelivered or re-attempted [[Order]] — in particular, can Adobe place the same upstream order twice if its record of the first did not reach the platform?
- [ ] [AFUL-004]: Which [[Order]] types does Adobe actually fulfil, as opposed to validate? The four it answers callouts for are established; whether fulfilment covers the same four is not.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-08-28 | Anton | Initial draft. Split out of the Adobe umbrella document, which held this contract as two rules, three Key Concepts and five effect rows. BR-003, BR-004 and BR-005 and the third failure mode are new: they were in the source and had no room in a single-document account. Derived from the implementation's own source; not confirmed against a running instance and not confirmed with Adobe. |
