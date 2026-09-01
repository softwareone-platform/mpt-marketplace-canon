# Implementation Canon: Adobe Validation

> **Version:** 0.1
> **Owner:** Unassigned
> **Last Updated:** 2026-08-28
> **Status:** Draft

---

## 1. Identity

**Implementation Name:** Adobe Validation

**Implements:** Validation Integration

**Parent Implementation:** Adobe

**Description:**
Adobe Validation is Adobe's half of the platform's pre-placement check on a draft [[Order]]. It is one path, served by the same deployment that does everything else Adobe does, answering the platform synchronously with the draft revised or refused. It is the only thing Adobe does in which the platform calls Adobe rather than Adobe calling the platform, and the only one in which a Client is waiting on the answer. 

**Also Known As:**
Adobe draft validation, VIPM order validation.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Implements | Notes |
| --- | --- | --- | --- | --- | --- |
| BR-001 | It answers for all four [[Order]] types the platform offers a pre-placement callout for — Purchase, Change, Termination and Configuration. | N/A | Vendor | integration-validation:br-005 | It declines none of them. Whether the callout is switched on for a given [[Product]] is a separate question — see AVAL-001. |
| BR-002 | Asked to validate a draft [[Order]], it answers synchronously with that Order revised — values corrected, [[Parameter]] visibility adjusted, or an error attached. | N/A | Vendor | integration-validation:br-001 | It clears any error it previously wrote before evaluating, so each callout is a question about the current draft and never about what it said last time. |
| BR-003 | It refuses an [[Order]] by attaching an error to the Order or to the individual [[Parameter]] at fault, inside a successful response. | N/A | Vendor | integration-validation:br-003 | Where a single [[Parameter]] is at fault it names that Parameter rather than the Order, so the Client is shown the error against the field. |
| BR-004 | It authenticates the platform's call by a secret it resolves from the registration that made it, and refuses a call it cannot authenticate. | N/A | Vendor | — | The secret is held platform-side on the registration, so rotating it is a platform-side change. |
| BR-005 | It consults Adobe's own system while validating, and the answer it gives depends on what that system says. | N/A | Vendor | — | The Client is therefore waiting on Adobe's availability, not only on SoftwareOne's. See Section 9. |

---

## 5. Key Concepts

| Concept | Description | Implements | Notes |
| --- | --- | --- | --- |
| Validation endpoint | The one path Adobe serves for the platform to call. It accepts a draft [[Order]] and returns it revised. | integration:served-api | It serves nothing else. Everything else Adobe does is outbound. |
| Callout registration | The platform [[Webhook]] that points at the validation endpoint, carrying the criteria that decide which [[Order]]s trigger it and the secret that proves the call came from the platform. | integration:webhook-handler | Adobe does not declare this. It is registered in the platform, and Adobe reads it back by identifier when a call arrives. |
| Revised order | What Adobe answers with: the draft [[Order]] as it should be, with corrected values, adjusted [[Parameter]] visibility, and an error where it refuses. | integration-validation:validation-response | One response carries both the corrections and the refusal; they are not separate answers. |
| Cleared error | The error Adobe wrote on a previous callout for the same draft [[Order]], removed before it evaluates again. | integration-validation:rejection | Makes each answer a statement about the draft as it now stands. Without it a corrected Order would keep the error that prompted the correction. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Callout authenticated | A call arrives at the validation endpoint | — | Adobe resolves the registration the call names and checks the secret on it. A call it cannot authenticate is refused before anything is evaluated. |
| Upstream check | Adobe evaluates a draft that requires its own system's opinion | — | Adobe queries its own system under the credentials the Order's authorization maps to. What it asks and what it does with the answer is Adobe's own. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Validation answered | Commerce: Order | [[Parameter]] values, Parameter visibility and the order-level error are set to what Adobe returned. | Yes | The callout was enabled for the [[Product]] and Adobe answered in time. | No status change. The write is the platform's, made under the credential that registered the callout. |

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| Adobe's own system is unreachable while validating | Adobe does not answer. The [[Order]] proceeds unvalidated and the Client is told nothing. | Client, Vendor | High | Adobe is expected to catch the problem during fulfilment instead, which moves the failure past the point where the Client could have corrected it cheaply. |
| The extension itself fails while validating | The response is unsuccessful, the platform discards it, and the [[Order]] proceeds unvalidated. | Client, Vendor | High | Distinct from a refusal — see BR-003 — and indistinguishable from it from the Client's side. |
| The secret on the registration is rotated platform-side | Adobe refuses every call until it holds the new secret. Every draft [[Order]] proceeds unvalidated in the meantime. | Client, Operations | Medium | Adobe reads the secret from the registration, so the rotation is not something it can be made aware of in advance. |

---

## 10. Open Questions

- [ ] [AVAL-001]: Which of the four [[Order]] types is the callout actually enabled for, per [[Product]]? Enablement is the Product's own setting, and what is switched on differs per environment.
- [ ] [AVAL-002]: What does Adobe do when the draft [[Order]] names an [[Item]] carrying no Adobe identifier — refuse it with an error, or leave it for fulfilment to fail on?

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.1 | 2026-08-28 | Anton | Initial draft. Split out of the Adobe umbrella document, which held this contract as three rules and two Key Concepts. BR-004 and BR-005 and the Section 7.1 rows are new: they were in the source and had no room in a single-document account. Derived from the implementation's own source; not confirmed against a running instance and not confirmed with Adobe. |
