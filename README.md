# SoftwareOne Marketplace Canon

Authoritative product canon for the SoftwareOne Marketplace platform. Covers platform invariants, object lifecycles, state machines, business rules, and system behaviour. Built and maintained by the Marketplace product team as a structured reference for engineering, support, and onboarding.

---

## What is Canon?

> **canon** _(n.)_ — a collection of rules, principles, or works officially recognised as authoritative within a given domain.

Canon is the versioned knowledge base for the SoftwareOne Marketplace platform. It is a structured record of every platform object's identity, behaviour, business rules, and lifecycle — so that product decisions are made from a shared, reliable understanding of how the platform actually works, rather than from tribal knowledge or assumption.

---

## Repository Structure

```
marketplace-canon/
  preamble/
    PLATFORM_CANON_PREAMBLE.md        # Platform invariants, actor model, API conventions, namespace structure
  objects/
    CANON_OBJECT_Catalog_Product.md
    CANON_OBJECT_Catalog_PriceList.md
    ...                               # One file per platform object
  platform/
    CANON_PLATFORM_MarkdownRenderer.md
    ...                               # System behaviour not tied to a specific object
  questions/
    CANON_OPEN_QUESTIONS.md           # Known unknowns awaiting resolution
    CANON_RESOLVED_QUESTIONS.md       # Closed questions with confirmed answers
  templates/
    CANON_OBJECT_TEMPLATE.md          # Standard template for object canon documents
    CANON_AUTHORING_SESSION.md        # LLM session prompt for canon authoring
```

---

## How to Generate Canon

Canon is generated using an LLM authoring session guided by a structured prompt and two reference files.

1. Paste the **Canon Authoring Session Prompt** (`templates/CANON_AUTHORING_SESSION.md`) into your LLM session.
2. Upload the **Platform Canon Preamble** (`preamble/PLATFORM_CANON_PREAMBLE.md`) and the **Canon Object Template** (`templates/CANON_OBJECT_TEMPLATE.md`) alongside it.
3. Tell the LLM which object you are canonising and begin working through the template section by section.

Uploading sample API responses for the object you are documenting significantly improves output quality. Multiple examples are better than one.

---

## Authoring Principles

**If it isn't observed, confirmed, and documented — it isn't canon.**

- **The product manager is the authority, not the LLM.** Challenge, correct, and validate the output at every step. Canon that has not been reviewed by a domain expert is not canon.
- **Base canon on evidence.** Every rule, behaviour, and attribute must be derived from observed platform behaviour, API responses, or confirmed engineering input. Do not assume or infer.
- **When in doubt, park it.** Unconfirmed behaviour belongs in the open questions tracker, not in the canon document.
- **State facts, not opinions.** Canon describes how the platform works, not how it should work.
- **Be precise with language.** Avoid "usually", "typically", or "in most cases". If a rule has exceptions, document them explicitly.
- **Respect the invariants.** Platform invariants apply to every object without exception. Do not contradict or restate them per object.
- **One source of truth.** Reference rules documented elsewhere rather than restating them. Duplication leads to drift.
- **Version everything.** Every change must be reflected in the document's changelog. Canon is only trustworthy if its history is traceable.
- **Canon describes the platform, not a vendor's use of it.** Vendor-specific behaviour belongs in vendor canon.

---

## Contributing

Contributions follow the standard GitHub workflow: branch, edit, pull request. All changes require a changelog entry in the affected document. Open questions should be tracked in `questions/CANON_OPEN_QUESTIONS.md` and closed in `questions/CANON_RESOLVED_QUESTIONS.md` once resolved.

---

## Further Reading

Internal documentation and background on the canon initiative is maintained on Confluence: [SoftwareOne Marketplace Canon](https://softwareone.atlassian.net/wiki/spaces/mpt/pages/7224131913/SoftwareOne+Marketplace+Canon).
