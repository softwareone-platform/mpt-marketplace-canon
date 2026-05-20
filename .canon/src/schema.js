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
});

const REFS = Object.freeze({
  parent: {
    owner: '*',
    pointers: { parent: { target: ['domain', 'entity'], min: 1, max: 1 } },
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
