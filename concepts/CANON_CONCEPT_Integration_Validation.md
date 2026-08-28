# Concept Canon: Validation Integration

> **Version:** 0.1
> **Owner:** Unassigned
> **Last Updated:** 2026-08-28
> **Status:** Draft

---

## 1. Identity

**Concept Name:** Validation Integration

**Parent Concept:** Integration

**Description:**
A Validation Integration is an [[Integration]] the platform consults before an object is placed, and waits for. Contact is synchronous: the platform blocks on the answer and then applies it as a mutation to the object that triggered the callout, rather than the integration writing that object itself. It is the outside system's half of the platform's own pre-placement check on a draft [[Order]] — the platform settles which drafts are put to it and what to make of silence, and the integration settles only what to answer.

**Also Known As:**
Pre-purchase validation, draft validation, validation callout.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | The platform consults a Validation Integration synchronously before the object is placed, waits for its answer, and applies that answer as a mutation to the object that triggered the callout. | N/A | All | The integration does not write the object itself. Its answer is data the platform then applies under its own authority. |
| BR-002 | The platform consults the first registration whose criteria match, not every one of them. | N/A | All | A second matching registration is not a second opinion — it is not called at all. |
| BR-003 | A refusal is carried inside a successful response, as an error attached to the object or to the individual field at fault. An unsuccessful response means the integration did not complete, not that the object was refused. | N/A | All | The two outcomes travel by different mechanisms and only the first is a statement about the object. |
| BR-004 | Which objects reach a Validation Integration is settled by the criteria on its registration, not by the integration itself. | N/A | All | An integration cannot decline to be consulted; it can only answer. |
| BR-005 | The platform makes a pre-placement callout for Purchase, Change, Termination and Configuration [[Order]]s. The Renewal, Suspend and Resume types receive none, and a Validation Integration is therefore never consulted about them. | N/A | All | An intent that must be checked before it is placed has to be expressed as one of the four. |

---

## 5. Key Concepts

| Concept | Description | Notes |
| --- | --- | --- |
| Draft object | The object as the Client has composed it but has not yet placed — in practice an [[Order]] — handed to the integration in the callout and returned by it. | It is not a copy the integration owns. What comes back is applied to the real object. |
| Validation response | The revised draft the integration answers with: corrected values, adjusted [[Parameter]] visibility, or an attached error. | The whole of what the integration can affect at this moment. It cannot reach any other object. |
| Rejection | An error the integration attaches to the draft object or to one of its [[Parameter]]s, refusing placement from inside a successful response. | The Client sees it against the field at fault where one is named. See BR-003. |
| Wait window | The period the platform blocks on the callout before proceeding without an answer. | Its length, and whether it is declared per registration, is not established — see VAL-001. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Evaluation | A callout arrives carrying a draft object | — | The integration decides on the object it was handed and composes its answer inside the wait window. Whatever it consults to decide — its own records, an upstream system, a commercial programme — is its own, and the platform observes none of it. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Validation callout answered | Commerce: Order | The integration's response is applied as a mutation to the [[Order]] that triggered the event | Yes | A [[Webhook]] of an Order-family type is Enabled and its criteria match | No status change. The write is the platform's, made under the credential that registered the callout. |

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| No answer arrives before the platform stops waiting | The platform proceeds as though no Validation Integration were registered. The draft is placed unvalidated. | Client, Vendor | High | Indistinguishable from the integration being absent — the Client is given no signal that a check was skipped. |
| The integration answers unsuccessfully rather than with a rejection | The response is discarded and the draft is placed unvalidated. | Client, Vendor | High | Distinct from a refusal — see BR-003 — but identical from the Client's side. |
| Two registrations match the same draft object | Only the first is consulted. The second is not called, and nothing records that it was passed over. | Vendor, Operations | Medium | See BR-002. |

---

## 10. Open Questions

- [ ] [VAL-001]: How long does the platform wait for an answer, and is the wait declared per registration or fixed for the platform?
- [ ] [VAL-002]: Which object families other than [[Order]] can be validated this way? Which callout types a registration may declare is not established.
- [ ] [VAL-003]: What settles which of two matching registrations is "first"? Registration order, criteria specificity and identifier order are all candidates and none is confirmed.
- [ ] [VAL-004]: Is a Client told anything when a callout was skipped, failed or timed out, or is an unvalidated placement silent?

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-08-28 | Anton | Initial draft. Narrows Integration by aspect: the synchronous pre-placement contract, previously carried as one rule and one effect row inside Integration itself. BR-003 and BR-005 were established as platform facts while reading the Adobe implementation and are stated here, at the level they hold at, rather than in that implementation. |
