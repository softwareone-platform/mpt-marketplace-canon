// Hard-coded canon schema. Touch this file when introducing a new
// node or ref type — there's no extension layer.
// TODO: split into nodes.js / refs.js if it keeps growing.

const NODES = Object.freeze({
  domain: {
    fields: { name: 'string!', description: 'string' },
    refs: {},
  },
  entity: {
    fields: { name: 'string!', description: 'string', aliases: 'string[]' },
    refs: { parent: { min: 1, max: 1 } },
  },
  // A Concept is something the platform does not own but must still
  // reason about: an integration, an ERP system, a vendor's own
  // platform. Canon does not describe how it works — it describes the
  // SURFACE the domain contacts, and nothing else. Structurally it is
  // an entity minus everything that presumes ownership: no namespace,
  // no id prefix, no states, no transitions, no ownership matrix.
  // `parent` points at the domain, or — for the rarer case of one
  // concept narrowing another — at that broader concept, which the
  // narrower one then further attributes rather than replacing.
  concept: {
    fields: { name: 'string!', description: 'string', aliases: 'string[]' },
    refs: { parent: { min: 1, max: 1 } },
  },
  // An Implementation is one concrete realisation of an abstraction —
  // a named vendor's integration, a particular ERP product. It does not
  // restate the abstraction; it BINDS to it. Its own §5 concepts and §4
  // rules each carry an optional `implements` ref at the element that
  // the abstraction declared, and an element the abstraction declares
  // but nothing here binds is, deliberately, indistinguishable between
  // "not implemented" and "canon does not know" — the two are the same
  // state of knowledge and canon does not pretend otherwise.
  // `parent` is the domain, or — when this document is one part of a
  // larger realisation — the umbrella implementation it belongs to,
  // whose abstraction it must then strictly narrow. `implements` is
  // the realisation edge, kept separate from `parent` so "what
  // realises X" and "what is contained in X" stay different
  // questions; a part document needs both answers at once.
  implementation: {
    fields: { name: 'string!', description: 'string', aliases: 'string[]' },
    refs: { parent: { min: 1, max: 1 }, implements: { min: 1, max: 1 } },
  },
  state: {
    fields: { name: 'string!', description: 'string' },
    refs: { parent: { min: 1, max: 1 } },
  },
  transition: {
    fields: { name: 'string!', description: 'string' },
    refs: { parent: { min: 1, max: 1 }, transition: { min: 1, max: 1 } },
  },
  action: {
    fields: { name: 'string!', description: 'string' },
    refs: { parent: { min: 1, max: 1 }, 'action-binding': { min: 1 } },
  },
  term: {
    fields: { name: 'string!', description: 'string!', aliases: 'string[]' },
    refs: { parent: { min: 1, max: 1 } },
  },
  // Business rules — one rule per row in Section 4. Promoted from
  // anonymous constraint refs so `[[mentions]]` in the statement
  // attach to the rule (not the owning entity) and paths/impact can
  // reach individual rules.
  rule: {
    fields: { name: 'string!', description: 'string!' },
    refs: { parent: { min: 1, max: 1 } },
  },
});

const REFS = Object.freeze({
  parent: {
    owner: '*',
    pointers: { parent: { target: ['domain', 'entity', 'concept', 'implementation'], min: 1, max: 1 } },
  },
  // Realisation. At document level the owner is the implementation and
  // the target its abstraction; at element level the owner is one of
  // the implementation's own terms or rules and the target the element
  // of the abstraction it binds. Type-matched and confined to the
  // abstraction's own subtree — see validate.js.
  implements: {
    owner: ['implementation', 'term', 'rule'],
    pointers: { target: { target: ['concept', 'entity', 'term', 'rule'], min: 1, max: 1 } },
  },
  transition: {
    owner: ['transition'],
    pointers: {
      // creation rows have no from-state — min:0
      from: { target: ['state'], min: 0, max: 1 },
      to: { target: ['state'], min: 1, max: 1 },
    },
  },
  'action-binding': {
    owner: ['action'],
    pointers: { step: { target: ['transition'], min: 1 } },
  },
  constraint: {
    owner: '*',
    pointers: {
      subject: { target: '*' },
      target: { target: '*' },
      condition: { target: '*' },
      context: { target: '*' },
      about: { target: '*' },
      'depends-on': { target: '*' },
      trigger: { target: '*' },
    },
  },
  risk: {
    owner: '*',
    pointers: {
      subject: { target: '*' },
      target: { target: '*' },
      condition: { target: '*' },
      context: { target: '*' },
      about: { target: '*' },
      trigger: { target: '*' },
    },
  },
  note: {
    owner: '*',
    pointers: {
      subject: { target: '*' },
      about: { target: '*' },
      condition: { target: '*' },
      context: { target: '*' },
    },
  },
  dependency: {
    owner: '*',
    pointers: {
      subject: { target: '*' },
      'depends-on': { target: '*' },
      context: { target: '*' },
    },
  },
  // [[key]] mentions in descriptions. One ref per owner-entity, N
  // targets. Unresolved key = parse error.
  mention: {
    owner: '*',
    pointers: { target: { target: '*', min: 1 } },
  },
});

const ACTORS = Object.freeze(['Vendor', 'Operations', 'Client', 'System']);
const NAMESPACES = Object.freeze(['Catalog', 'Commerce', 'Billing', 'Administration', 'Notifications', 'Audit']);
const RISK_LEVELS = Object.freeze(['high', 'medium', 'low']);
const NOTE_KINDS = Object.freeze(['event', 'cross-effect', 'open-question', 'association']);

const NODE_TYPES = Object.freeze(Object.keys(NODES));
const REF_TYPES = Object.freeze(Object.keys(REFS));

const isNodeType = (t) => NODE_TYPES.includes(t);
const isRefType = (t) => REF_TYPES.includes(t);

export {
  NODES,
  REFS,
  ACTORS,
  NAMESPACES,
  RISK_LEVELS,
  NOTE_KINDS,
  NODE_TYPES,
  REF_TYPES,
  isNodeType,
  isRefType,
};
