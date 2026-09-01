# Concept Canon: Integration

> **Version:** 0.4
> **Owner:** Unassigned
> **Last Updated:** 2026-08-28
> **Status:** Draft

---

## 1. Identity

**Concept Name:** Integration

**Parent Concept:** None — top-level concept.

**Description:**
An Integration is a system outside the SoftwareOne Marketplace that acts on the platform, or is acted on by it,
across a contract. The platform core is Vendor-agnostic and Client-agnostic (preamble §2.3): it provides universal
primitives, and every Vendor-specific or Client-specific behaviour is implemented in an Integration rather than in
the core — so an Integration is the platform's intended mechanism for specific business logic, not a peripheral
case. The word "extension" is used across the platform's sources both for this relationship and for the registered
platform object that is one way of holding it. **Extension** names that object; **Integration** names the
relationship.

**Also Known As:**
Connector, Plugin, ISV integration.

---

## 4. Business Rules

| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |
| --- | --- | --- | --- | --- |
| BR-001 | An Integration acts as exactly one permission-bearing Actor, determined by the [[Account]] whose credential it holds. | N/A | All | An Integration that must act in two Actor roles holds two credentials, not one. |
| BR-002 | An Integration has no identity of its own at the API boundary. Every call it makes is attributed to the Actor whose credential authenticated it, and that is what the [[Audit Record]] records. | N/A | All | "Integration" is not an Actor type. |
| BR-003 | Registration with the platform is optional. An Integration that does not register presents the same contact surface minus everything declared, and leaves no record that it exists. | N/A | All | The absence of a registration is therefore not evidence that no Integration is present. |
| BR-004 | A registered Integration declares its contract as data, and receives from the platform only what that declaration names. | N/A | All | Covers served API paths, event subscriptions, scheduled triggers, user interface plugs and webhook handlers. |
| BR-005 | An Integration is multi-tenant. It serves each consuming [[Account]] under configuration held separately for that Account, and acts for one Account at a time. | N/A | All | The consenting unit is the Account's installation of the Integration, not the Integration itself. |
| BR-007 | An Integration correlates platform objects with its own records through an identifier it stores on the object and alone assigns meaning to. Identifiers are partitioned per Actor, and an Integration reads and writes only its own. | N/A | All | Two Integrations may therefore hold different identifiers for the same object without conflict. |

---

## 5. Key Concepts

| Concept | Description | Notes |
| --- | --- | --- |
| Instance | A running copy of an Integration's code. It is what actually connects to the platform, and one Integration may run several at a time. | Version and health are reported by the instance, never inferred by the platform. |
| Served API | The one contract document by which a registered Integration states which paths it exposes for the platform to call. | Declared as a single address, not a list — an Integration has one such document or none. |
| Event subscription | A platform event the Integration asks to be sent, narrowed by a condition, naming the path it is delivered to and the time the platform will wait. | The platform delivers only what the condition matches. An Integration is not told about the events it did not ask for. |
| Webhook handler | A callout the Integration answers, bound to a declared callout type and to criteria that decide which objects trigger it. | The criteria are what settle whether this Integration is consulted at all — not the Integration itself. |
| Scheduled trigger | A path the platform calls on a schedule the Integration declares. | Periodic work an Integration runs on its own infrastructure is not this, and the platform has no knowledge of it. |
| Interface plug | A place in the user interface where the Integration mounts, naming the socket it fills, the address its interface is loaded from, and an optional condition on when it appears. | The only declared channel through which an Integration reaches a person rather than an object. |
| Deferrable | A path the Integration exposes, with its own method and waiting time, for work the platform hands over rather than performing itself. | What the platform defers this way, and under what circumstances, is not established — see INT-007. |
| Actor credential | The token that authenticates an Integration and binds it to one [[Account]] and one permission set. | Without one there is no Integration. Revoking it stops every call at once. |
| Tenant configuration | The per-[[Account]] parameters, some of them secret, that an Integration reads in order to act for one consuming Account. | Readable only with the Integration's own credential or with that of the Account that owns it. |
| Correlation identifier | An Integration's own identifier for a platform object, stored on that object and meaningful only to the Integration that wrote it. | Partitioned per Actor. The platform assigns it no meaning and validates nothing about it. |

---

## 7. Lifecycle Events & Side Effects

### 7.1 Internal Events

| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |
| --- | --- | --- | --- |
| Instance connects | The Integration deploys, restarts, or recovers from a dropped connection | — | The instance opens a channel outward to the platform and holds it open. The platform never dials in, so an Integration it cannot reach is one whose instance has not connected. |
| Upstream read | Work the Integration performs for a consuming [[Account]] | — | Values a vendor Integration writes into the platform originate in that vendor's own system. Their correctness, availability and rules belong to that system, not to the platform. |
| Scheduled run | A schedule the Integration declares, expressed as a cron expression | — | Work begins with no Actor acting and no platform event preceding it. |
| Reconfiguration | A change to the Integration's declared contract or to its running version | — | What the platform routes to the Integration changes. The platform learns the new contract from the instance, not the reverse. |
| Health report | The Integration's own reporting interval | — | The platform's only evidence that an Integration is alive. Silence is indistinguishable from a lost channel. |

### 7.2 Cross-Object State Effects

| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |
| --- | --- | --- | --- | --- | --- |
| Reconciliation run | Accounts: ErpLink | [[ErpLink]] records are created and removed as the back-office system reconciles a [[Buyer]]'s set of [[Seller]]s | Yes | Always, for the ERP sync | No Actor creates or deletes one through the API. |
| Correlation write | Commerce: Agreement | The Integration's own identifier for the contract is stored under its Actor's key on the [[Agreement]] | No | The writing Actor owns that key | The platform validates neither the value nor its continued correctness. |
| Any authenticated call | Audit: Audit Record | A record is written against the Actor whose credential authenticated the call | Yes | Always | There is no anonymous Integration and no Integration Actor. |

---

## 9. Failure Modes & Edge Cases

| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |
| --- | --- | --- | --- | --- |
| The Integration's endpoint fails, times out, or returns a non-success status | The platform records a failed attempt and does not retry. It never disables the [[Webhook]] on a failure threshold — the failure count is informational only. | Client, Vendor | Medium | Recovery is the Integration's own responsibility; the platform will not re-drive the event. |
| The Integration's [[Webhook]] is Disabled while matching events continue to occur | Events that would have reached the Integration are not queued. They are lost. | Vendor | Medium | Re-enabling does not replay them. |
| The credential the Integration holds is deleted or disabled | Authentication stops immediately and the Integration fails until it is re-keyed. | Vendor, Operations, Client | Medium | Disabling an [[API Token]] is reversible; deleting it is not. |
| The Integration writes a correlation identifier that no longer matches anything on its own side | The platform accepts it, validating neither the value nor its continued correctness. | Vendor, Client | Low | Permissive by default, per preamble §3.1. |
| The Integration is decommissioned without being uninstalled or having its credential revoked | Its credential and its records outlive it. An unregistered Integration leaves the platform no signal at all that the system behind it is gone. | Operations | Medium | A registered Integration at least stops reporting health. |
| A vendor programme is presented to users as an "extension" but holds no registration | The platform behaves consistently. The mismatch is one of vocabulary, and it misleads anyone reasoning from the public documentation back to the object model. | Operations, Client | Low | See Section 1. |

---

## 10. Open Questions

- [ ] [INT-001]: Can one Integration be installed into the same [[Account]] more than once, and if so what distinguishes the installations?
- [ ] [INT-002]: What becomes of a declared event, schedule or served API path when no instance of the Integration is connected — is it queued, dropped, or failed back to the caller?
- [ ] [INT-003]: When an Integration acts for a consuming [[Account]] rather than the [[Account]] that owns it, whose authority applies — its own credential's, or the consuming Account's?
- [ ] [INT-004]: Which of the vendor programmes published under "Extensions" in the platform's public documentation hold a platform registration, and which are Integrations by other means?
- [ ] [INT-005]: Does a back-office ERP Integration hold a contract materially different from this one? What is specific to that counterparty has not been established.
- [ ] [INT-006]: Is there any element of the contact surface through which an Integration can act without an Actor-attributed credential? BR-002 asserts there is not, on the strength of the platform invariants rather than an exhaustive audit of the API.
- [ ] [INT-007]: What does the platform defer to an Integration through a declared deferrable, and when? The registration carries a path, a method and a waiting time, and nothing establishes what kind of work travels that way. The extension SDK implements no support for it.

---

## 11. Changelog

| Version | Date | Author | Notes |
| --- | --- | --- | --- |
| 0.4 | 2026-08-28 | Anton | Narrowed to what holds of any Integration. BR-008, which stated how much of an Integration canon claims to record rather than anything about an Integration, is removed along with its counterpart sentence in Section 1; its number is retired. BR-006 and the two Section 7.2 rows it governed moved to the Validation Integration and Fulfilment Integration concepts, which narrow this one by aspect; BR-006's number is retired rather than reused, since a rule id is an address. INT-005 reduced to the counterparty question that remains open. |
| 0.3 | 2026-08-27 | Marcerito | Section 5 terms grounded on the platform entities they are defined against, now that the section is wikilinked. |
| 0.2 | 2026-08-26 | Marcerito | Section 5's single Declared contract term split into the six channels the platform's own registration declares, so that each is addressable and an implementation can bind the ones it uses. INT-007 opened on deferrables. |
| 0.1 | 2026-08-19 | Anton | Initial draft. First Concept canon document: the relationship between the platform and any system outside it, of which a registered Extension is one way of holding it rather than the whole of it. |
