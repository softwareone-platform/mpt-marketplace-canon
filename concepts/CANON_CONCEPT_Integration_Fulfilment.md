# Concept Canon: Fulfilment Integration

> **Version:** 0.1
> **Owner:** Unassigned
> **Last Updated:** 2026-08-28
> **Status:** Draft

---

## 1. Identity

**Concept Name:** Fulfilment Integration

**Parent Concept:** Integration

**Description:**
A Fulfilment Integration is an [[Integration]] that takes over an [[Order]] once it has been placed and drives it to a terminal state, provisioning against it on the way. Contact is asynchronous and begins with an event the integration subscribed to; the platform sets no deadline, never re-drives the work, and takes everything the integration writes back as an ordinary API write under its own Actor. The platform has handed over the outcome of the Order and cannot reclaim it.

**Also Known As:**
Provisioning integration, order processing, fulfilment pipeline.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | Fulfilment begins when the platform delivers an [[Order]] event the integration subscribed to. Nothing else starts it, and the platform decides when the event is sent. | N/A | All | An integration that acts before the event has acted on its own initiative, not on the platform's. |
| BR-002 | The integration alone decides that fulfilment is finished and moves the [[Order]] to its terminal state. The platform never concludes fulfilment on its behalf. | N/A | All | This is the substance of the handover: the Order's outcome is the integration's to determine. |
| BR-003 | The platform imposes no time limit on fulfilment. An [[Order]] handed over remains in progress for as long as the integration leaves it there. | N/A | All | Any deadline is the integration's own, and is visible only if the integration records it. |
| BR-004 | What the integration provisioned reaches the platform as ordinary API writes under its own Actor. Nothing on the affected object distinguishes them from a human Actor's writes. | N/A | All | Attribution is by Actor, per the platform invariants — not by whether an integration or a person made the call. |
| BR-005 | An integration that cannot proceed with an [[Order]] as it is composed hands it back to the Client by moving it to Querying with a reason. Failing it is a terminal outcome, not a request for a correction. | N/A | All | The two are different claims: one asks for a change, the other ends the Order. |
| BR-006 | The platform does not re-drive a fulfilment event. An event the integration did not act on is neither queued nor retried, and re-enabling a subscription does not replay it. | N/A | All | Recovery is the integration's own responsibility, from its own records. |

---

## 5. Key Concepts

| Concept | Description | Notes |
| --- | --- | --- |
| Fulfilment run | One pass of the integration's own processing of a placed [[Order]], from the event that started it to the write it makes on that Order. | The platform sees the writes, never the run. It cannot tell one run from a second attempt at the same Order. |
| Provisioning outcome | What the integration obtained on its own side for the [[Order]], recorded against the platform's [[Subscription]] as an ordinary write. | The platform stores the outcome and validates nothing about its correctness against the upstream system. |
| Query reason | The explanation the integration attaches when it hands an [[Order]] back to the Client rather than completing it. | The only channel by which a fulfilling integration asks a person for something after placement. |
| Recorded working state | State of the integration's own that it writes to the [[Order]] as a fulfilment-phase [[Parameter]], where the Client and Operations can read it. | Voluntary. What an integration does not record this way is invisible, and the platform cannot ask for it. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Fulfilment attempt | An [[Order]] event delivered, or the integration's own retry of one it has not finished | — | Work runs on the integration's own infrastructure. The platform observes only the writes it produces, and cannot distinguish a first attempt from a later one. |
| Upstream provisioning | A fulfilment attempt reaches the point of committing the outcome | — | The provisioning happens in the integration's own system, on that system's terms. Reversing it is an act upstream; the platform has no notion of undoing a provisioned outcome. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Fulfilment concluded | Commerce: Order | The [[Order]] is moved to its terminal state by the integration | Yes | The integration determined the work is done or cannot be done | The platform does not conclude fulfilment on the integration's behalf. See BR-002. |
| Correction requested | Commerce: Order | The [[Order]] is moved to Querying with the reason the integration gives | Yes | The integration determined the Order cannot proceed as composed | See BR-005. |
| Provisioning outcome written | Commerce: Subscription | Provisioning outcomes arrive as ordinary API writes on the [[Subscription]] | No | The integration serves the [[Product]] the Subscription was bought under | Nothing in the object distinguishes them from a human Actor's writes. |

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| The integration never acts on a delivered event | The [[Order]] stays where it is, indefinitely. The platform neither re-drives the event nor times the Order out. | Client, Vendor | High | The Client sees an Order that never moves, with nothing to distinguish it from one still being worked on. |
| The integration's own upstream system is unreachable | Nothing on the platform changes. The [[Order]] remains in progress and no failure is recorded against it. | Client | Medium | The platform has no view of the upstream system and cannot report on it. |
| The same [[Order]] is processed twice | The platform accepts both sets of writes. It holds no notion of a fulfilment having already run. | Client, Vendor | Medium | Whether an event can be delivered twice is not established — see FUL-002. |

---

## 10. Open Questions

- [ ] [FUL-001]: Which [[Order]] transitions are open to a fulfilling integration's Actor, and which are refused?
- [ ] [FUL-002]: Can the platform deliver the same [[Order]] event more than once, and is an integration therefore expected to be idempotent?
- [ ] [FUL-003]: Is a Client given any signal that fulfilment has begun, other than the [[Order]]'s own status?
- [ ] [FUL-004]: What happens to an in-progress [[Order]] when the integration's subscription is removed or its credential revoked mid-fulfilment? Nothing establishes whether the Order is failed, left in place, or returned to the platform.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-08-28 | Anton | Initial draft. Narrows Integration by aspect: the asynchronous post-placement contract, previously carried as one effect row inside Integration itself. BR-003 and BR-005 were established as platform facts while reading the Adobe implementation and are stated here, at the level they hold at, rather than in that implementation. |
