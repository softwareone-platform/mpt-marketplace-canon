# SoftwareOne Marketplace — Platform Canon Preamble

> **Version:** 2.10
> **Owner:** Stu
> **Last Updated:** 2026-07-17
> **Status:** Living Document — updated continuously as canon is developed

---

## Purpose

This document captures the foundational design principles, invariants, and philosophy of the SoftwareOne Marketplace platform. It is the authoritative preamble for all Object canon documents and should be read before reasoning about any individual object.

When a principle here appears to conflict with an object canon, the conflict must be flagged and resolved explicitly. Principles here are not overridden silently.

---

## 1. Platform Invariants

These invariants apply universally across all objects, actors, and namespaces. They are restated in every object canon document for local reference, but this document is their authoritative source.

1. **Every action is Actor-attributed.** All API calls require a token. All tokens are created within the context of an Actor. There are no anonymous or system-native transitions.
2. **Automated execution is Actor-contextual.** When the system executes a transition autonomously, it does so under an Actor's token. "System" is a human-absent executor, not a separate Actor class.
3. **Audit is always Actor-attributable.** Every state transition on every object can be traced to an Actor.
4. **There is one API surface.** The platform API is public and unified. The UI exposes a subset. A human user can execute any action the system can, subject to their Actor permissions.
5. **Multi-actor workflows are modelled as sequential transitions.** Each transition is executed by one Actor at a time. A transition may be permitted to more than one Actor type, but each execution instance has exactly one Actor.
6. **The platform never cascades deletions.** Deleting an object never automatically deletes any other object as a side effect. Each object must be deleted independently. Deletion guards exist to prevent removal of objects that have dependents — see Section 3.5.

   **Known exceptions:** Deleting a `Catalog: Product` while it is in Draft state cascades to its child objects — Items, Item Groups, Parameters, Parameter Groups, Templates, Terms (and Terms Variants), Media, Price Lists (and Price List Items) — and to its Authorizations and Listings, plus removes Documents/Media/Icon. Products cannot be deleted once they leave Draft state, so this cascade only ever applies pre-publication. See `Catalog: Product` canon Section 6 and Section 8 for the full confirmed list and citations. Deleting a `Billing: Journal` (permitted only in its pre-review states) removes its child `Billing: Charge` entries and `Billing: Journal Attachment` files. See `Billing: Journal` canon Section 8.
7. **Deletion means permanently removed from API visibility.** When an object is deleted, it is no longer retrievable through the API. Canon makes no claims about physical database retention. The accurate statement is always: "no longer retrievable via the API."

   **Known exceptions:** Catalog: Pricing Policy, Commerce: Order, and Accounts: Seller use a soft-delete model — deleted records remain fully retrievable via the API including in standard list responses. Where an object deviates from this invariant, the deviation is documented explicitly in that object's canon.

---

## 2. Actor Model

The platform recognises five Actor types, though only three carry platform-level permissions. All object canon is expressed in terms of the three permission-bearing Actors.

### 2.1 Permission-Bearing Actors

| Actor | Description |
|-------|-------------|
| Vendor | The software manufacturer (e.g. Adobe, Microsoft, Miro). Vendors author and manage Product Definitions and transact through the SoftwareOne Marketplace. Direct platform interaction is expected and is the basis for scale. |
| Operations | Employees of SoftwareOne. Act as platform stewards — reviewing, publishing, and supporting Vendors and Clients. |
| Client | Customers of SoftwareOne, either direct or through a Tier 2 reselling partner model. A single permission profile regardless of relationship type. |

### 2.1a User Account Context Model

A User is not inherently typed as a Vendor, Operations, or Client Actor. A User may be a member of zero or more Accounts, and those Accounts may be of any type in any combination. A User with no Account memberships has no Actor permissions.

The Actor permissions that apply to any given API call are determined by two factors in combination:

1. **Account type** — the type of the Account the User is currently operating in (Vendor, Operations, or Client) defines the broad Actor permission profile.
2. **Group membership** — within each Account, Users are members of one or more Groups. Groups define granular permission sets (for example, access to Marketplace features vs. Access Management vs. Account Management). Group permission sets are defined by the platform and are consistent across all Account types.

The effective permission set for any given action is the intersection of the Account type permissions and the User's Group permissions within that Account.

For example, a SoftwareOne employee may be a member of the Operations Account and also a member of one or more Client Accounts. When operating in the Operations Account, they act as the Operations Actor — but only within the scope of the Groups they belong to in that Account. When operating in a Client Account, they act as the Client Actor with the permissions of their Groups in that Account.

This has practical implications for canon authorship:

- The term "Operations user" or "Client user" is imprecise. The correct framing is "a User operating in an Operations Account" or "a User operating in a Client Account" — or more concisely, "the Operations Actor" or "the Client Actor."
- Permissions described in canon as belonging to a specific Actor type represent the maximum available permissions for that Actor type. A User's actual permissions may be narrower depending on their Group memberships within their current Account.
- Some platform actions are only available to a specific Actor type. A User who needs to perform an action available only to the Client Actor must switch to a Client Account to do so.

API Tokens follow the same model. A Token is scoped to exactly one Account, inherits the Actor permission profile of that Account, and is a member of one or more Groups within that Account. The effective permission set for a Token is the intersection of the Account type permissions and its Group memberships.

---

### 2.2 Recognised Non-Permission Actors

| Actor | Description | Maps To |
|-------|-------------|---------|
| Partner | A Client who resells to their own downstream customers (Tier 2 model). Operates under the Client permission profile. | Client |
| ISV / Developer | A builder who creates Extensions that integrate with the platform API. An Extension acts as a single permission-bearing Actor (Vendor, Operations, or Client) depending on the integration's purpose. The ISV/Developer themselves has no distinct platform permission profile. | Vendor / Operations / Client (depends on Extension) |

### 2.3 Extension Architecture

The core platform is 100% Vendor-agnostic and Client-agnostic. It provides universal primitives — objects, state machines, transitions, and permissions — that any Actor can operate against via the platform API.

Vendor-specific and Client-specific business logic is not implemented in the core platform. It lives in **Extensions** — integrations that sit outside the core platform and interface with it via API. Key properties of Extensions:

- A single Extension acts as exactly one permission-bearing Actor.
- Extensions implement the business logic specific to their Actor's domain (e.g. an Order fulfilment extension acts as a Vendor; an SAP purchasing plugin acts as a Client).
- The canon documents in this repository describe core platform primitives only — not any Extension's implementation of them.

*This architecture is why the platform API is public and unified — Extensions are first-class consumers of the same API surface available to human users.*

---

## 3. Design Philosophy

### 3.1 Permissive by Default

The platform prefers permissiveness over constraint. Validation and restrictions are introduced only where imperative — either to protect data integrity, enforce a critical business invariant, or prevent irreversible harm.

This means:
- Many misconfiguration scenarios are possible and are the responsibility of the authoring Actor (typically the Vendor).
- Failure modes resulting from misconfiguration are documented in object canon but are not necessarily prevented by the system.
- When evaluating whether to add a constraint, the burden of proof is on the constraint — not on the permissive default.

*First observed: Media canon, Video URL validation.*

### 3.2 State Controls Discoverability, Not Necessarily Accessibility

For some objects, state transitions affect whether the platform *advertises* an asset or record, not whether it is *accessible*. Assets served by URL may remain accessible regardless of the object's state; state determines only whether the platform surfaces that URL in listings or UI.

This distinction is significant for Vendors who embed asset URLs directly in HTML content (e.g. Product long descriptions, Templates). Those references will continue to resolve regardless of the referenced object's state.

*First observed: Media canon, BR-011.*

### 3.3 Collaboration Over Gatekeeping

Where Operations is involved in a workflow, the model is collaborative rather than adversarial. Operations does not reject or block — it works with the Vendor to reach a publishable state.

*First observed: Product canon, BR-003 — Operations cannot reject a Pending Product.*

### 3.4 Default Protection Pattern

Where a "Default" designation exists on a child object collection, the following invariants apply consistently across all object types:
- Exactly one Default must exist at all times.
- The Default cannot be deleted directly. It must first be demoted by designating another instance as Default.
- Marking a new instance as Default automatically demotes the existing Default.

*First observed: Template canon BR-004/BR-005. Confirmed in Item Group canon BR-008, Parameter Group canon BR-006.*

### 3.5 Deletion Guards

Objects are protected from deletion when doing so would leave dependent objects in an inconsistent or orphaned state. Common deletion guards observed:
- **Default protection** — Default objects cannot be deleted (see 3.4).
- **Non-empty container protection** — Container objects (e.g. Item Groups, Parameter Groups) cannot be deleted while they contain child objects.
- **State-based protection** — Objects that have progressed beyond an initial state (e.g. beyond Draft) typically cannot be deleted.

*First observed: Item Group canon BR-008/BR-009, Parameter Group canon BR-006/BR-007, Product canon BR-002, Media canon BR-005.*

---

## 4. Namespace Model

The platform is organised into namespaces. Each namespace contains a set of primary objects and their child objects.

| Namespace | API Path Prefix | Primary Objects |
|-----------|----------------|----------------|
| Catalog | `catalog` | Products, Programs, Enrollments, Certificates |
| Commerce | `commerce` | Orders, Agreements, Subscriptions, Assets, Split Billing |
| Billing | `billing` | Journals, Ledgers, Statements |
| Accounts | `accounts` | Accounts, Buyers, Sellers, Licensees, API Tokens, Users, Groups |
| Notifications | `notifications` | Webhooks |
| Audit | `audit` | Audit Records |

> **Naming note:** The Accounts namespace is known by two names depending on context:
> - **"Administration"** — the label used in the platform UI and in internal SoftwareOne communications.
> - **"Accounts"** — the API path prefix (`v1/accounts/...`) used across all platform endpoints in this namespace.
>
> Canon standardises on **Accounts** to match the API surface. When encountering the term "Administration" in UI documentation, support tickets, or internal communications, it refers to this namespace.

Cross-namespace object references in canon documents use the fully qualified format: `Namespace: Object` (e.g. `Commerce: Order`, `Catalog: Product`).

> The Audit namespace is platform-wide. Audit Records are generated for significant events on objects across all namespaces. See `CANON_OBJECT_Audit_AuditRecord.md` — pending canonisation.

---

## 5. Object Canon Conventions

### 5.1 File Naming

Canon files follow this naming convention:
- Primary objects: `CANON_OBJECT_{Namespace}_{Object}.md`
- Child objects: `CANON_OBJECT_{Namespace}_{ParentObject}_{ChildObject}.md`

Examples:
- `CANON_OBJECT_Catalog_Product.md`
- `CANON_OBJECT_Catalog_Product_Template.md`
- `CANON_OBJECT_Commerce_Order.md`

### 5.2 Cross-References

When referencing another object within a canon document, always use the fully namespace-qualified name: `Namespace: Object` (e.g. `Commerce: Order`).

### 5.3 Object ID Prefixes

Every platform object has an ID prefix used in all API identifiers for that object type. Known prefixes:

| Object | Namespace | Prefix |
|--------|-----------|--------|
| Product | Catalog | PRD |
| Template | Catalog | TPL |
| Item | Catalog | ITM |
| Item Group | Catalog | IGR |
| Parameter | Catalog | PAR |
| Parameter Group | Catalog | PGR |
| Media | Catalog | MED |
| Document | Catalog | PDC |
| Terms | Catalog | TCS |
| Terms Variant | Catalog | TCV |
| Price List | Catalog | PRC |
| Price List Item | Catalog | PRI |
| Authorization | Catalog | AUT |
| Listing | Catalog | LST |
| Pricing Policy | Catalog | PRP |
| Pricing Policy Attachment | Catalog | PPA |
| Unit of Measure | Catalog | UNT |
| Webhook | Notifications | WBH |
| Audit Record | Audit | AUD |
| Event Type | Audit | AET |
| API Token | Accounts | TKN |
| Account | Accounts | ACC |
| Seller | Accounts | SEL |
| Buyer | Accounts | BUY |
| ErpLink | Accounts | ERP |
| Licensee | Accounts | LCE |
| User | Accounts | USR |
| Module | Accounts | MOD |
| User Group | Accounts | UGR |
| Account User | Accounts | AUSR |
| Service | Accounts | SVC |
| Cloud Tenant | Accounts | CLT |
| Order | Commerce | ORD |
| Entitlement | Commerce | ALI |
| Agreement | Commerce | AGR |
| Subscription | Commerce | SUB |
| Asset | Commerce | AST |
| Agreement Split Billing | Commerce | SBA |
| Subscription Split Billing | Commerce | SBS |
| Agreement Attachment | Commerce | ATT |
| Journal | Billing | BJO |
| Charge | Billing | CHG |
| Journal Attachment | Billing | JOA |
| Ledger | Billing | BLE |
| Ledger Attachment | Billing | LEA |

The `ALI` prefix is shared: `Commerce: Order Line` reuses the same identifier as the `Commerce: Entitlement` it becomes, because a line's identity is preserved when an Order completes and its lines are promoted into the Agreement.

The `AST` and `SUB` prefixes are shared in the same identity-preserving way: a `Commerce: Order Asset` keeps its `AST` identifier when promoted into the live `Commerce: Asset` on Order completion, and a `Commerce: Order Subscription` keeps its `SUB` identifier when promoted into the live `Commerce: Subscription`. In each case the in-flight, Order-scoped object and the live object it becomes are distinct objects sharing one identifier.

Prefixes for remaining Commerce, Billing, and Accounts objects are not yet confirmed — to be documented as those namespaces are canonised.

### 5.4 Open Questions

Open questions in canon documents represent known unknowns — design spaces, not failures. They should be resolved and closed as canon matures. A canon document with no open questions is considered complete for its current version.

### 5.5 Canon JSON Examples

All JSON examples used during canon development are retrieved using an Operations token. This is the authoritative approach — Operations tokens return all fields without Actor-based field suppression, providing the most complete representation of each object.

---

## 6. API Conventions

These conventions apply uniformly across all platform API endpoints.

### 6.1 Null Suppression

The platform omits null and empty fields from API responses by default. A field that is absent from a response is null or unpopulated — it is not an unknown field. This is consistent across all object types and all Actors.

### 6.2 The `select=` Mechanism

The `select=` query parameter is a unified field control mechanism with two distinct uses: **field inclusion/exclusion** on the primary object, and **reference expansion** of referenced objects.

#### Field Inclusion and Exclusion

By default, certain fields are omitted from API responses even when populated — typically for performance reasons (e.g. `audit`). The `select=` parameter controls which fields are included or excluded.

- `?select=+fieldName` — explicitly include a field omitted by default. The `+` operator is optional; omitting it is functionally equivalent to using `+`.
- `?select=-fieldName` — explicitly exclude a field that is included by default. The `-` operator is the only meaningful operator — without it, the field is included.

Fields omitted by default appear in the `$meta.omitted` array in the response. Fields absent due to null values do not appear in `$meta.omitted` — they are simply absent, consistent with null suppression (see 6.1).

The most commonly omitted field is `audit`. Example: `GET v1/catalog/products?select=+audit`

#### Reference Expansion

When the platform returns a referenced object (e.g. a Listing response includes a `seller` reference), it returns only a summary representation of that referenced object by default. The summary shape is object-specific — there is no universal default summary shape.

Using `select=` with the name of a referenced object expands it to its full representation:

- `?select=seller` — expand the `seller` reference to its full object
- `?select=seller,authorization` — expand multiple references in a single call
- `?select=+authorization.seller.id` — expand a reference but return only specific fields from it (dot notation for nested field selection)

Field inclusion/exclusion and reference expansion can be combined in a single `?select=` call.

### 6.3 Actor-Based Field Suppression

Some fields are suppressed from API responses based on the Actor token used. Suppressed fields are not present in the response and do not appear in `$meta.omitted` — they are invisible to the requesting Actor entirely. This is distinct from default omission (which affects all Actors equally and is opt-in via `select=+`).

Known examples:
- `markup`, `margin`, and derived sales pricing fields on Price List Items are suppressed for Vendor and Client tokens.
- Authorization `notes` is suppressed for Client tokens.

Actor-based suppression is documented per-object in each canon file's Ownership & Visibility table and Key Attributes table.

---

## 7. Environments

The SoftwareOne Marketplace is deployed across four environments. All four expose the same API surface. They are fully isolated — no shared state, no shared accounts, no shared Actor tokens. Each environment runs in a separate Azure subscription.

| Environment | Stability | Deployment Frequency | Primary Purpose |
|-------------|-----------|---------------------|-----------------|
| DEV | Low — untested code, frequently unstable | High | Enables engineers to run platform code on local machines against a hosted backend |
| TEST | Low — untested code, frequently unstable | High | Fully hosted environment for engineers to validate code in an end-to-end hosted context |
| STAGING | Medium — code has passed TEST, more stable | Moderate | PROD-like environment for Vendor Extension testing; also used as early access for SoftwareOne employees to validate major releases before PROD promotion |
| PROD | High — most stable | Low (hotfixes and backports only) | Production environment for all Actors |

### 7.1 Promotion Path

The standard promotion path is: **DEV → TEST → STAGING → PROD**. Skipping stages is strongly discouraged and operationally difficult.

### 7.2 Actors and Environments

Clients interact exclusively with PROD. Non-PROD environments are used by:
- **Engineers** — DEV and TEST for development and testing.
- **Vendor Extension developers** — STAGING as the primary pre-PROD validation environment.
- **SoftwareOne employees** — STAGING for early access testing of major releases.

### 7.3 Business Logic Differences in Non-PROD Environments

While the API surface is identical across all environments, certain business logic constraints are relaxed in non-PROD environments. These relaxations exist to enable testing without dependency on external production systems (e.g. ERP, vendor provisioning systems).

**Known example:**
- In PROD, an `Accounts: Licensee` must have `Active` status to place an Order. This status reflects that the Licensee's linked `Accounts: Buyer` is correctly linked to a customer record in SoftwareOne's ERP. In STAGING, this constraint is not enforced, allowing Order placement without a valid ERP link.

> ⚠️ The full set of constraint relaxations across non-PROD environments is not comprehensively documented. Some relaxations are known only through tribal knowledge. See ENV-001, ENV-002, and ENV-005 in the Open Questions tracker. Do not assume that behaviour observed in STAGING is fully representative of PROD behaviour — verify constraints that involve external system dependencies against PROD documentation or engineering input.

---

## 8. Notification Subsystem

The platform includes a Notification subsystem built on a message bus architecture. Objects across all namespaces publish messages to this bus when significant events occur. The Webhook mechanism subscribes to this bus and uses each Webhook's criteria RQL expression to determine whether an incoming message should trigger a call to the configured endpoint.

**What is known with confidence:**
- The Notification subsystem is platform-wide — it receives messages from objects in all namespaces.
- Webhooks do not fire indiscriminately — the criteria expression is used to match messages selectively.
- The subsystem is the decoupling layer between core platform objects and Extensions. Objects publish messages without knowledge of which Webhooks, if any, are listening.

**What is not yet canonised — requires engineering input:**
- The exact structure of messages published to the bus.
- How criteria RQL expressions are evaluated against message payloads.
- What controls firing frequency or conditions beyond criteria matching.
- Any internal mechanics of the message bus (queuing, ordering, delivery guarantees beyond what is already documented in Webhook canon).

> ⚠️ The mechanics of the Notification subsystem are not fully documented at the PM level. Do not treat any undocumented behavior as implied. Engineering input is required before this section can be considered canonical.

---

## 9. Icon Pattern

Many platform objects expose an `icon` string property representing a URL to a visual identity image. The `icon` property is not a standalone platform object — it has no ID prefix, no state machine, and no independent lifecycle. It is a read-only property exposed via a dedicated `/icon` endpoint on the parent object; writes are performed on the parent object itself.

### 9.1 Two Icon Behaviours

The platform implements two distinct icon behaviours, hardcoded per object type:

| Behaviour | Description | Example Objects |
|-----------|-------------|-----------------|
| **Jdenticon** | Icon defaults to a server-generated jdenticon. A custom icon may be uploaded to replace it, and removed to revert to the jdenticon. | Accounts, Sellers, Buyers, Licensees, Users |
| **Required** | No jdenticon fallback. A custom icon must be supplied and cannot be removed. | Products |

Which behaviour applies to a given object type is hardcoded in the platform and documented in each object's canon.

### 9.2 Jdenticon Default

For objects that support the jdenticon behaviour, the default icon is generated server-side using the object's ID as the seed. This means:
- The jdenticon is deterministic — the same object always produces the same jdenticon.
- The jdenticon URL is returned as the value of the `icon` field in API responses — it is not null.
- The jdenticon is not stored as an uploaded asset; it is generated on demand.

### 9.3 Custom Icon Upload

A custom icon is uploaded as a binary via a `multipart/form-data` request to the parent object's own endpoint (not the `/icon` endpoint). The `/icon` endpoint is read-only — it exposes only a `GET` method for retrieving the current icon URL. Once uploaded, the custom icon URL is returned as the value of the `icon` field in place of the jdenticon URL.

### 9.4 Icon Removal

For objects with jdenticon behaviour, a custom icon can be removed to revert to the jdenticon. One confirmed mechanism, for `Accounts: Seller`: submitting the same multipart `PUT` used for upload, but omitting the `logo` file part, removes any existing custom icon and reverts to the jdenticon — this happens regardless of whether icon removal was the caller's intent, since the platform derives "remove icon" from the simple absence of a `logo` file on that request. Icon behaviour is implemented per object type, so whether this same mechanism holds for every jdenticon-capable object is not yet confirmed — see ENV-004 in the Open Questions tracker.

For objects with required icon behaviour, the icon cannot be removed. A replacement icon may be uploaded via the parent object endpoint, but removal is not permitted.

### 9.5 Icon in API Responses

The `icon` field is a nullable string. For jdenticon-capable objects, it is never null in practice — the platform always returns either the jdenticon URL or the custom icon URL. For required-icon objects, it is always populated. Absent from response when null, consistent with platform null suppression (see Section 6.1).

---

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 2.15 | 2026-07-19 | Stu / canon-generate-batch | Section 5.3 ID Prefixes: BLE (Ledger) and LEA (Ledger Attachment) added, confirmed from live PROD object IDs. Added while canonising the Billing Ledger/Ledger Attachment batch. |
| 2.14 | 2026-07-19 | Stu / canon-generate-batch | Section 5.3 ID Prefixes: BJO (Journal), CHG (Charge), JOA (Journal Attachment) added — the first confirmed Billing prefixes, from live PROD object IDs. Invariant 6 known-exception list: added the `Billing: Journal` delete cascade (deleting a Journal in its pre-review states removes its child Journal Charges and Journal Attachments). Added while canonising the Billing Journal/Charge/Attachment batch. |
| 2.13 | 2026-07-19 | Stu / canon-generate-batch | Section 5.3 ID Prefixes: AET (Event Type) added, confirmed from a live object ID. Added while canonising the Audit Event Type/Audit Record batch (Audit Record's AUD prefix was already present). |
| 2.12 | 2026-07-19 | Stu / canon-generate-batch | Section 5.3 ID Prefixes: SVC (Service) and CLT (Cloud Tenant) added, each confirmed from a live object ID. Added while canonising the Accounts Service/Cloud Tenant/API Token batch (API Token's TKN prefix was already present). |
| 2.11 | 2026-07-18 | Stu / canon-generate-batch | Section 5.3 ID Prefixes: USR (User), MOD (Module), UGR (User Group), AUSR (Account User) added, each confirmed from a live object ID. Added while canonising the Accounts User/Module/User Group/Account User batch. |
| 2.10 | 2026-07-17 | Stu / canon-generate-batch | Section 5.3: added shared-prefix notes for `AST` (Commerce: Order Asset ↔ Commerce: Asset) and `SUB` (Commerce: Order Subscription ↔ Commerce: Subscription), mirroring the existing `ALI` note — each in-flight Order-scoped object keeps its identifier when promoted into the live object on Order completion. Added while canonising the Commerce Order batch (Order Line/Asset/Subscription). |
| 2.9 | 2026-07-17 | Stu / canon-generate | Section 5.3 ID Prefixes: SBS (Subscription Split Billing) added, confirmed from a live object ID. Added while canonising Commerce: Subscription Split Billing. |
| 2.8 | 2026-07-17 | Stu / canon-generate | Section 5.3 ID Prefixes: ATT (Agreement Attachment) added, confirmed from live object IDs. Added while canonising Commerce: Agreement Attachment. |
| 2.7 | 2026-07-16 | Stu / canon-generate | Section 5.3 ID Prefixes: the ALI row relabelled from "Order Line" to "Entitlement" — source research confirmed ALI is registered to the Agreement Line (Entitlement); Order Line has no prefix of its own and reuses the same ALI id via identity-preserving order→agreement promotion. Added a note recording the shared identifier. Corrected while canonising Commerce: Entitlement. |
| 2.6 | 2026-07-16 | Stu / canon-generate | Section 5.3 ID Prefixes: SBA (Agreement Split Billing) added, confirmed from a live object ID. Added while canonising Commerce: Agreement Split Billing. |
| 2.5 | 2026-07-16 | Stu / canon-generate | Section 5.3 ID Prefixes: LCE (Licensee) added, confirmed from a live object ID. Added while canonising Accounts: Licensee. |
| 2.4 | 2026-07-16 | Stu / canon-generate | Section 5.3 ID Prefixes: PPA (Pricing Policy Attachment) added, confirmed from a live object ID. Added while canonising Catalog: Pricing Policy Attachment (bundled with the Catalog: Pricing Policy refresh). |
| 2.3 | 2026-07-16 | Stu / canon-generate | Section 5.3 ID Prefixes: PDC (Catalog Document) added, confirmed from live object IDs. Added while creating the Catalog: Product Document canon. |
| 2.2 | 2026-07-16 | Stu / canon-generate | Section 5.3 ID Prefixes: TCV (Terms Variant) added, confirmed from live object IDs. Added while refreshing Catalog: Product Terms Variant. |
| 2.1 | 2026-07-16 | Stu / canon-generate | Invariant 6 known-exception list: Items restored to the Product Draft-deletion cascade, reverting v1.9. Source research during the Catalog: Product Terms refresh found that the delete-Product API path removes the Product's Items via a cleanup step (v1.9 had inspected only the domain Product.Delete() method, which leaves Items untouched). A full re-verification of the delete-Product cascade was then completed and confirmed every listed child is removed on Draft-Product deletion. |
| 2.0 | 2026-07-16 | Stu / canon-generate | Section 5.3 ID Prefixes: UNT (Unit of Measure) added, confirmed from live object IDs. Added while refreshing Catalog: Unit of Measure. |
| 1.9 | 2026-07-16 | Stu / canon-generate | Invariant 6 known-exception list corrected: Catalog: Product Items removed from the Draft-deletion cascade — source research during the Catalog: Product Item refresh confirmed Items are independent records that Product deletion does not remove. The other listed children are unchanged (not re-examined this run). |
| 1.8 | 2026-07-15 | Stu / canon-generate | Section 5.3 ID Prefixes: BUY (Buyer) and ERP (ErpLink) added, confirmed from live object IDs. Added while canonising Accounts: Buyer and Accounts: ErpLink together. |
| 1.7 | 2026-07-15 | Stu / canon-generate-batch | Section 7.3 updated: ENV-005 added and cross-referenced alongside ENV-001/ENV-002 — whether Accounts: Seller's related-Licensee status-change guard is enforced identically in PROD is unconfirmed (only STAGING was exercised). Invariant 7 known exceptions updated to add Accounts: Seller's soft-delete model, alongside Pricing Policy and Order. Section 9.4 updated with a confirmed Seller-specific icon-removal mechanism (narrows, doesn't resolve, ENV-004). Surfaced during a canon-generate-batch dry run refreshing Seller and Commerce: Asset concurrently. |
| 1.6 | 2026-07-15 | Stu / canon-generate | Invariant 6 known exception added: deleting a Catalog: Product in Draft state cascades to its child objects (Items, Item Groups, Parameters, Parameter Groups, Templates, Terms/Variants, Media, Price Lists/Items), Authorizations, and Listings, plus Documents/Media/Icon — confirmed via source-code research during the Product canon refresh. Previously undocumented; existing Product canon incorrectly stated deletion was impossible in any state. |
| 1.5 | 2026-04-12 | Stu | Section 2.1a added: User Account Context Model. Documents multi-account membership, Group-based granular permissions, and the correct framing of Actor context in canon. Section 5.3 updated: ORD and ALI prefixes added for Commerce namespace. Invariant 7 known exceptions updated to include Commerce: Order soft-delete model. |
| 1.4 | 2026-03-16 | Stu | PRP prefix added to Section 5.3. Invariant 7 updated with known exception: Catalog Pricing Policy uses soft-delete and remains retrievable after deletion. |
| 1.3 | 2026-03-15 | Stu | Section 4 naming note expanded — both names documented explicitly: "Administration" (UI and internal communications) and "Accounts" (API path prefix). Canon rationale clarified. |
| 1.2 | 2026-03-15 | Stu | Administration namespace renamed to Accounts throughout — standardised on API path prefix. Section 4 namespace table updated with API path prefix column and naming note. Section 5.3 ID Prefixes table updated: SEL prefix added for Seller; TKN and ACC namespace updated to Accounts. Section 5.4 duplicate heading corrected to 5.5. Section 7.3 Licensee/Buyer references updated to Accounts namespace. |
| 1.1 | 2026-03-14 | Stu | Section 9.4 corrected: DELETE on /icon endpoint is unconfirmed. Mechanism for icon removal parked as ENV-004. |
| 1.0 | 2026-03-14 | Stu | Section 9.3 corrected: /icon endpoint is GET only. Icon upload is via multipart/form-data on the parent object endpoint. Section 9.4 updated accordingly. ENV-003 resolved. |
| 0.9 | 2026-03-14 | Stu | Section 9 added: Icon Pattern. Documents the two icon behaviours (jdenticon and required), jdenticon generation, custom icon upload and removal, and icon field API behaviour. |
| 0.8 | 2026-03-09 | Stu | Section 5.3 added: Object ID Prefixes table. All Catalog and known non-Catalog prefixes documented. Section 5.4 renumbered from 5.3. |
| 0.7 | 2026-03-09 | Stu | Platform invariants 6 and 7 added: no-cascade deletion, deletion = permanently removed from API visibility. Audit namespace added to Section 4. Section 6.2 expanded to document full select= mechanism: field inclusion/exclusion operators, reference expansion, dot notation for nested field selection. |
| 0.6 | 2026-03-09 | Stu | Section 6 API Conventions added: null suppression, select=+ field omission, Actor-based field suppression. Canon JSON examples note added to Section 5. Sections renumbered. |
| 0.5 | 2026-03-09 | Stu | Environments section added. Constraint relaxation pattern documented. Open questions ENV-001/ENV-002 logged. |
| 0.4 | 2026-03-08 | Stu | Notification subsystem section added. Mechanics flagged as requiring engineering input. |
| 0.3 | 2026-03-08 | Stu | Notifications namespace added. |
| 0.2 | 2026-03-07 | Stu | Actor model expanded to five recognised Actors. Extension architecture documented. |
| 0.1 | 2026-03-07 | Stu | Initial stub. Principles captured from Product, Template, Media, Item Group, and Parameter Group canon sessions. |
