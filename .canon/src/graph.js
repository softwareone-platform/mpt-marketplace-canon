// Parsed sections → { nodes, refs }. ID conventions:
//   marketplace                       domain
//   marketplace:webhook               entity
//   webhook:enabled                   state (entity-suffix : kebab-name)
//   webhook:enabled-to-disabled       transition
//   webhook:disable-webhook           action
//   webhook:url                       term
//   marketplace:integration           concept — a sibling of an entity
//   integration:correlation-identifier term (a §5 key concept)
//   marketplace:microsoft             implementation — also a sibling
//   microsoft:tenant-id               term, bound to a concept's term
// Unresolved cross-refs become marketplace:future:<kebab> stubs so the
// graph stays referentially intact.

const DOMAIN_ID = 'marketplace';

// The three kinds that own a document, an id prefix, and therefore a
// subtree of child nodes. Everything else hangs off one of them.
const ROOT_TYPES = ['entity', 'concept', 'implementation'];
const isRoot = (n) => ROOT_TYPES.includes(n.type);

// ── ids ────────────────────────────────────────────────────────────

const kebab = (s) => String(s)
  .trim()
  .replace(/[_/]+/g, '-')
  .replace(/([a-z])([A-Z])/g, '$1-$2')
  .replace(/[^a-zA-Z0-9-]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '')
  .toLowerCase();

const entityIdFromFile = (relPath) => {
  const m = relPath.match(/^CANON_OBJECT_[A-Za-z]+_(.+)\.md$/);
  return m ? `${DOMAIN_ID}:${kebab(m[1])}` : null;
};

// No namespace segment: a concept sits outside the namespace model,
// and every concept — including one that narrows another — is a
// top-level document with a top-level id. Narrowing is expressed by
// the parent ref, not by nesting the id.
const conceptIdFromFile = (relPath) => {
  const m = relPath.match(/^CANON_CONCEPT_(.+)\.md$/);
  return m ? `${DOMAIN_ID}:${kebab(m[1])}` : null;
};

// Same reasoning as a concept's: an implementation is a top-level
// document with a top-level id. What it realises is the `implements`
// ref, never the id.
const implementationIdFromFile = (relPath) => {
  const m = relPath.match(/^CANON_IMPLEMENTATION_(.+)\.md$/);
  return m ? `${DOMAIN_ID}:${kebab(m[1])}` : null;
};

const childPrefix = (entityId) => entityId.split(':').slice(-1)[0];
const childId = (entityId, name) => `${childPrefix(entityId)}:${kebab(name)}`;

const resolveParentRef = (rawValue, nameIndex) => {
  const v = String(rawValue || '').trim();
  if (!v || /^none\b/i.test(v)) return DOMAIN_ID;

  const m = v.match(/^(?:[A-Za-z]+\s*:\s*)?([^()—]+?)(?:\s*[—(].*)?$/);
  const name = (m ? m[1] : v).trim().toLowerCase();
  return nameIndex.get(name) || `${DOMAIN_ID}:future:${kebab(name)}`;
};

// ── cells ──────────────────────────────────────────────────────────

// `—` is the align-format sentinel for an originally-empty cell
const cell = (s) => {
  const v = String(s || '').trim();
  return v === '—' || v === '-' ? '' : v;
};

// An `Implements` cell names one element of the abstraction by full id
// (`integration:actor-credential`) — never by bare name, for the same
// reason `[[mentions]]` refuse bare child names: they collide across
// subjects. An empty cell is not an error; it means the row is this
// implementation's own. The id is pushed verbatim so a typo surfaces as
// pointer-target-not-found rather than becoming a `future:` stub.
const pushImplements = (refs, ownerId, row) => {
  const target = cell(row.implements);
  if (!target) return;
  refs.push({ type: 'implements', owner: ownerId, pointers: { target } });
};

const splitList = (s) =>
  cell(s).split(/,|;|\band\b/i).map(x => x.trim()).filter(Boolean);

const splitAliases = (s) => splitList(s)
  .map(a => a.replace(/\s*\([^)]*\)\s*$/, '').trim())
  .filter(a => a && !/^none/i.test(a));

const yesNo = (s) => /^yes$/i.test(cell(s));

// ── emitters ───────────────────────────────────────────────────────

// Identity values carry trailing qualifiers ("None — top-level object",
// "None (primary object — Notifications namespace)") that we want to
// keep in meta. Split into (value, qualifier); value drives ref
// resolution, qualifier survives as note text.
const splitIdentityValue = (raw) => {
  const v = String(raw || '').trim();
  if (!v) return { value: '', qualifier: '' };

  // parens first — em-dash inside parens shouldn't trigger the dash split
  const paren = v.match(/^([^()]+?)\s*\((.+)\)\s*$/);
  if (paren) return { value: paren[1].trim(), qualifier: paren[2].trim() };

  const dash = v.match(/^([^—]+?)\s*—\s*(.+)$/);
  if (dash) return { value: dash[1].trim(), qualifier: dash[2].trim() };

  return { value: v, qualifier: '' };
};

const emitEntity = (id, parsed, nameIndex) => {
  const ident = parsed.identity || {};
  const parentSplit = splitIdentityValue(ident.parent_object);
  const node = {
    id,
    type: 'entity',
    name: ident.object_name,
    description: ident.description || '',
    aliases: splitAliases(ident.aliases),
    meta: {
      namespace: ident.namespace || null,
      prefix: ident.id_prefix && !/^none/i.test(ident.id_prefix) ? ident.id_prefix : null,
      hasStateMachine: Array.isArray(parsed.states?.states) && parsed.states.states.length > 0,
      parentObjectNote: parentSplit.qualifier || undefined,
    },
  };
  const parentRef = {
    type: 'parent',
    owner: id,
    pointers: { parent: resolveParentRef(parentSplit.value || ident.parent_object, nameIndex) },
  };
  return { node, parentRef };
};

const emitStates = (entityId, parsed) => {
  const rows = parsed.states?.states || [];
  const nodes = [];
  const refs = [];
  for (const row of rows) {
    const id = childId(entityId, row.name);
    nodes.push({
      id,
      type: 'state',
      name: row.name,
      description: row.description || '',
      meta: {
        initial: yesNo(row.initial) || undefined,
        terminal: yesNo(row.terminal) || undefined,
      },
    });
    refs.push({ type: 'parent', owner: id, pointers: { parent: entityId } });
  }
  return { nodes, refs };
};

const isUnknownPlaceholder = (s) => /^unknown$/i.test(String(s || '').trim());

const emitTransitions = (entityId, parsed) => {
  const rows = parsed.transitions?.transitions || [];
  const nodes = [];
  const refs = [];
  const actionGroups = new Map();
  for (const row of rows) {
    const fromState = cell(row.from);
    const toState = cell(row.to);

    // literal "Unknown" = unconfirmed transition placeholder; route
    // to an open-question note instead of a real transition
    if (isUnknownPlaceholder(fromState) || isUnknownPlaceholder(toState)) {
      refs.push({
        type: 'note',
        owner: entityId,
        description: cell(row.outcome) || `Unconfirmed transition${fromState ? ` from ${fromState}` : ''}${toState ? ` to ${toState}` : ''}.`,
        pointers: { subject: entityId },
        meta: {
          kind: 'open-question',
          open: true,
          canonRef: cell(row.id) || null,
          rawFrom: fromState || null,
          rawTo: toState || null,
        },
      });
      continue;
    }

    const isCreation = fromState === '';
    const canonId = cell(row.id);
    // creation rows collide on (from, to) when one entity has several
    // creation paths to the same state — disambiguate via canonId
    const baseName = isCreation
      ? `create-to-${kebab(toState)}`
      : `${kebab(fromState)}-to-${kebab(toState)}`;
    const transitionName = isCreation && canonId
      ? `${baseName}-${canonId.toLowerCase()}`
      : baseName;
    const id = childId(entityId, transitionName);
    nodes.push({
      id,
      type: 'transition',
      name: cell(row.action),
      meta: {
        canonId,
        endpoint: cell(row.endpoint),
        actors: splitList(row.actors),
        preconditions: cell(row.preconditions),
        outcome: cell(row.outcome),
      },
    });
    refs.push({ type: 'parent', owner: id, pointers: { parent: entityId } });
    if (!isCreation) {
      refs.push({
        type: 'transition',
        owner: id,
        pointers: {
          from: childId(entityId, fromState),
          to: childId(entityId, toState),
        },
      });
    } else {
      refs.push({
        type: 'transition',
        owner: id,
        pointers: { to: childId(entityId, toState) },
        meta: { creation: true },
      });
    }

    // empty action cell → no action node, transition stands alone
    const actionName = cell(row.action);
    if (!actionName) continue;
    const actionId = childId(entityId, actionName);
    if (!actionGroups.has(actionId)) {
      actionGroups.set(actionId, {
        node: {
          id: actionId,
          type: 'action',
          name: actionName,
          meta: { actors: splitList(row.actors) },
        },
        steps: [],
      });
    }
    actionGroups.get(actionId).steps.push(id);
  }

  for (const { node, steps } of actionGroups.values()) {
    nodes.push(node);
    refs.push({ type: 'parent', owner: node.id, pointers: { parent: entityId } });
    refs.push({
      type: 'action-binding',
      owner: node.id,
      pointers: { step: steps },
    });
  }
  return { nodes, refs };
};

const emitAttributes = (entityId, parsed) => {
  const rows = parsed.attributes?.attributes || [];
  const nodes = [];
  const refs = [];
  for (const row of rows) {
    if (!row.name) continue;
    const id = childId(entityId, row.name);
    nodes.push({
      id,
      type: 'term',
      name: row.name,
      description: row.description || '',
      meta: {
        type: row.type || null,
        setBy: splitList(row.set_by),
        mutable: row.mutable || null,
        notes: row.notes || '',
      },
    });
    refs.push({ type: 'parent', owner: id, pointers: { parent: entityId } });
  }
  return { nodes, refs };
};

const emitOwnership = (entityId, parsed) => {
  const rows = parsed.ownership?.permissions || [];
  const refs = [];
  rows.forEach((row, i) => {
    refs.push({
      type: 'constraint',
      owner: entityId,
      description: `${row.actor}: create=${row.create}, read=${row.read}, update=${row.update}, delete=${row.delete}.${row.notes ? ' ' + row.notes : ''}`,
      pointers: { subject: entityId },
      meta: {
        canonSection: '2.ownership',
        actor: row.actor,
        permissions: {
          create: yesNo(row.create),
          read: yesNo(row.read),
          update: yesNo(row.update),
          delete: yesNo(row.delete),
        },
        notes: row.notes || '',
      },
    });
  });
  return { refs };
};

// Business rules → rule nodes (one per row). The rule's `description`
// is the statement; the row id (e.g. "BR-001") is the rule `name`.
// Parent ref attaches the rule to its owning entity. `[[mentions]]`
// inside the statement / notes resolve against the rule node — not
// the entity — so impact/paths can target a single rule.
const emitBusinessRules = (entityId, parsed, sectionKey = 'business_rules') => {
  const rows = parsed[sectionKey]?.rules || [];
  const nodes = [];
  const refs = [];
  for (const row of rows) {
    if (!row.statement) continue;
    const canonId = String(row.id || '').trim();
    if (!canonId) continue;
    // Defensive against multi-table authoring inside one Business
    // Rules section: repeated header / separator rows leak through as
    // `{ id: 'Rule ID', statement: 'Rule Statement' }` etc.
    if (!/^[A-Z]+-\d+[a-z]?$/.test(canonId)) continue;
    const id = childId(entityId, canonId);
    nodes.push({
      id,
      type: 'rule',
      name: canonId,
      description: row.statement,
      meta: {
        canonId,
        statement: row.statement,
        states: row.states || '',
        actorScope: row.actor_scope || '',
        notes: String(row.notes || '').trim(),
      },
    });
    refs.push({ type: 'parent', owner: id, pointers: { parent: entityId } });
    pushImplements(refs, id, row);
  }
  return { nodes, refs };
};

// section 6: Parent/Child/Dependency/Reference/Composition → dependency
// ref; everything else → note ref. Original type lives in meta.kind so
// the token survives.
const emitRelationships = (entityId, parsed, nameIndex) => {
  const rows = parsed.relationships?.relationships || [];
  const refs = [];
  for (const row of rows) {
    if (!row.related) continue;
    const targetId = resolveParentRef(row.related, nameIndex);
    const type = String(row.type || '').trim();
    const lower = type.toLowerCase();
    if (lower === 'parent' || lower === 'child' || lower === 'dependency'
        || lower === 'reference' || lower === 'composition') {
      refs.push({
        type: 'dependency',
        owner: entityId,
        description: row.description || '',
        pointers: {
          subject: lower === 'child' ? targetId : entityId,
          'depends-on': lower === 'child' ? entityId : targetId,
        },
        meta: {
          canonSection: '6.relationships',
          relationshipType: type,
          kind: lower,
          cardinality: row.cardinality || '',
          lifecycleDependency: row.lifecycle || '',
        },
      });
    } else {
      refs.push({
        type: 'note',
        owner: entityId,
        description: row.description || '',
        pointers: { subject: entityId, about: targetId },
        meta: {
          kind: lower || 'association',
          relationshipType: type,
          cardinality: row.cardinality || '',
          lifecycleDependency: row.lifecycle || '',
        },
      });
    }
  }
  return { refs };
};

const emitInternalEvents = (entityId, parsed) => {
  const rows = parsed.internal_events?.events || [];
  return {
    refs: rows.filter(r => r.event).map(row => ({
      type: 'note',
      owner: entityId,
      description: row.event + (row.side_effect ? ` — ${row.side_effect}` : ''),
      pointers: { subject: entityId },
      meta: {
        kind: 'event',
        trigger: row.trigger || '',
        actors: splitList(row.actors),
      },
    })),
  };
};

const emitCrossEffects = (entityId, parsed, nameIndex) => {
  const rows = parsed.cross_effects?.effects || [];
  return {
    refs: rows.filter(r => r.trigger).map(row => ({
      type: 'note',
      owner: entityId,
      description: `${row.trigger} → ${row.affected}: ${row.effect}`,
      pointers: {
        subject: entityId,
        about: row.affected ? resolveParentRef(row.affected, nameIndex) : entityId,
      },
      meta: {
        kind: 'cross-effect',
        automated: yesNo(row.automated),
        condition: row.condition || '',
        notes: row.notes || '',
      },
    })),
  };
};

const emitFailureModes = (entityId, parsed) => {
  const rows = parsed.failure_modes?.failures || [];
  return {
    refs: rows.filter(r => r.scenario).map(row => ({
      type: 'risk',
      owner: entityId,
      description: row.scenario + (row.behavior ? ` — ${row.behavior}` : ''),
      pointers: { subject: entityId },
      meta: {
        level: String(row.risk || '').toLowerCase(),
        actorImpacted: row.actor || '',
        notes: row.notes || '',
      },
    })),
  };
};

const emitOpenQuestions = (entityId, parsed) => {
  const text = String(parsed.open_questions?.open_questions || '').trim();
  if (!text) return { refs: [] };
  const refs = [];
  let foundQuestions = false;
  for (const line of text.split('\n')) {
    const m = line.match(/^- \[ \] \[([^\]]+)\]:\s*(.+)$/);
    if (!m) continue;
    foundQuestions = true;
    refs.push({
      type: 'note',
      owner: entityId,
      description: m[2],
      pointers: { subject: entityId },
      meta: { kind: 'open-question', canonId: m[1], open: true },
    });
  }
  // section 10 may carry "No open questions at this time." prose
  // instead of `- [ ]` rows — keep it as a status note
  if (!foundQuestions) {
    refs.push({
      type: 'note',
      owner: entityId,
      description: text,
      pointers: { subject: entityId },
      meta: { kind: 'open-questions-status' },
    });
  }
  return { refs };
};

const emitReversibility = (entityId, parsed) => {
  const rev = parsed.reversibility;
  if (!rev) return { refs: [] };
  return {
    refs: [{
      type: 'note',
      owner: entityId,
      description: [
        rev.reversible && `Reversible: ${rev.reversible}`,
        rev.deletion && `Deletion: ${rev.deletion}`,
        rev.audit && `Audit: ${rev.audit}`,
      ].filter(Boolean).join(' '),
      pointers: { subject: entityId },
      meta: { kind: 'reversibility' },
    }],
  };
};

// each prose paragraph from parse.js → note ref so it's reachable
// through the graph (vs being silently dropped)
const emitProse = (entityId, prose) => {
  if (!prose) return { refs: [] };
  const refs = [];
  for (const [section, paragraphs] of Object.entries(prose)) {
    for (const p of paragraphs) {
      refs.push({
        type: 'note',
        owner: entityId,
        description: p.text,
        pointers: { subject: entityId },
        meta: { kind: 'section-prose', section, line: p.line },
      });
    }
  }
  return { refs };
};

// ── concept emitters ───────────────────────────────────────────────

// Only two: a concept document is a partial of an object one, so §4,
// §7 and §9–10 go through the very same emitters an object's do. What
// is genuinely its own is §1 (no namespace, no id prefix) and §5.

const emitConcept = (id, parsed, nameIndex) => {
  const ident = parsed.concept_identity || {};
  const header = parsed.concept_header || {};
  const parentSplit = splitIdentityValue(ident.parent_concept);

  const node = {
    id,
    type: 'concept',
    name: ident.concept_name,
    description: ident.description || '',
    aliases: splitAliases(ident.aliases),
    meta: {
      version: header.version || null,
      owner: header.owner || null,
      lastUpdated: header.last_updated || null,
      status: header.status || null,
      parentConceptNote: parentSplit.qualifier || undefined,
    },
  };

  // "None — top-level concept." lands on the domain, exactly as a
  // top-level object's Parent Object does. Anything else names the
  // broader concept this one narrows.
  const parentRef = {
    type: 'parent',
    owner: id,
    pointers: { parent: resolveParentRef(parentSplit.value || ident.parent_concept, nameIndex) },
  };
  return { node, parentRef };
};

// §5 Key Concepts — the entities a concept introduces: the contact
// surface, not fields. Same slot and same node type as an object's Key
// Attributes, because §5 is what the subject exposes either way; a
// platform object then references one the way it references any other
// child node, by full id — `[[erp-system:identifier]]`.
const emitKeyConcepts = (conceptId, parsed, sectionKey = 'concept_key_concepts') => {
  const rows = parsed[sectionKey]?.concepts || [];
  const nodes = [];
  const refs = [];
  for (const row of rows) {
    if (!row.name) continue;
    const id = childId(conceptId, row.name);
    nodes.push({
      id,
      type: 'term',
      name: row.name,
      description: cell(row.description) || '',
      meta: {
        kind: 'key-concept',
        notes: cell(row.notes),
      },
    });
    refs.push({ type: 'parent', owner: id, pointers: { parent: conceptId } });
    pushImplements(refs, id, row);
  }
  return { nodes, refs };
};

// ── implementation emitters ────────────────────────────────────────

// One: everything else an implementation document holds goes through
// the concept's emitters, which are the object's. What is its own is
// §1 — where a concept names the broader concept it narrows, an
// implementation names the abstraction it realises, and that is a
// different edge.
const emitImplementation = (id, parsed, nameIndex) => {
  const ident = parsed.implementation_identity || {};
  const header = parsed.implementation_header || {};
  const implSplit = splitIdentityValue(ident.implements);

  const node = {
    id,
    type: 'implementation',
    name: ident.implementation_name,
    description: ident.description || '',
    aliases: splitAliases(ident.aliases),
    meta: {
      version: header.version || null,
      owner: header.owner || null,
      lastUpdated: header.last_updated || null,
      status: header.status || null,
      implementsNote: implSplit.qualifier || undefined,
    },
  };

  // Containment and realisation are separate edges: an implementation
  // is a top-level document (parent = domain) that realises something
  // else (implements = the abstraction).
  const parentRef = { type: 'parent', owner: id, pointers: { parent: DOMAIN_ID } };
  const implementsRef = {
    type: 'implements',
    owner: id,
    pointers: { target: resolveParentRef(implSplit.value || ident.implements, nameIndex) },
  };
  return { node, parentRef, implementsRef };
};

// ── name index ─────────────────────────────────────────────────────

// indexes Object Name + filename-path words + aliases against entity
// id, so cross-refs like "Catalog: Product Item" resolve regardless
// of which form the author used
const buildNameIndex = (parsedFiles) => {
  const idx = new Map();
  const add = (key, id) => {
    const k = String(key || '').trim().toLowerCase();
    if (k && !idx.has(k)) idx.set(k, id);
  };

  for (const f of parsedFiles) {
    const implId = implementationIdFromFile(f.relPath);
    if (implId) {
      const ii = f.data.implementation_identity || {};
      if (ii.implementation_name) add(ii.implementation_name, implId);
      for (const a of splitAliases(ii.aliases)) add(a, implId);
      continue;
    }

    const conceptId = conceptIdFromFile(f.relPath);
    if (conceptId) {
      const ci = f.data.concept_identity || {};
      if (ci.concept_name) add(ci.concept_name, conceptId);
      for (const a of splitAliases(ci.aliases)) add(a, conceptId);
      continue;
    }

    const id = entityIdFromFile(f.relPath);
    if (!id) continue;
    const ident = f.data.identity || {};
    if (ident.object_name) add(ident.object_name, id);

    const m = f.relPath.match(/^CANON_OBJECT_[A-Za-z]+_(.+)\.md$/);
    if (m) {
      const pathPhrase = m[1].replace(/_/g, ' ');
      add(pathPhrase, id);
      add(pathPhrase.replace(/([a-z])([A-Z])/g, '$1 $2'), id);
    }

    const aliases = String(ident.aliases || '').split(/[,\n]/).map(a => a.trim());
    for (const a of aliases) {
      if (!a || /^none/i.test(a)) continue;
      const stripped = a.replace(/\s*\(.*\)\s*$/, '').trim();
      if (stripped) add(stripped, id);
    }
  }
  return idx;
};

// ── mentions ───────────────────────────────────────────────────────

const MENTION_RE = /\[\[([^\]\n]+)\]\]/g;

// indexes node ids + entity Object Names + entity aliases. Child-node
// names are deliberately omitted (they collide across entities — use
// the full id `webhook:enabled` to mention one).
const buildMentionIndex = (nodes) => {
  const idx = new Map();
  for (const n of nodes) idx.set(n.id.toLowerCase(), n.id);
  for (const n of nodes) {
    if (!isRoot(n)) continue;
    if (n.name) {
      const k = n.name.toLowerCase();
      if (!idx.has(k)) idx.set(k, n.id);
    }
    for (const a of n.aliases || []) {
      const k = a.toLowerCase();
      if (!idx.has(k)) idx.set(k, n.id);
    }
  }
  return idx;
};

const findMentionsInText = (text, mentionIndex) => {
  const found = [];
  const errors = [];
  if (!text) return { found, errors };
  const re = new RegExp(MENTION_RE.source, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    const key = m[1].trim();
    const resolved = mentionIndex.get(key.toLowerCase());
    if (resolved) found.push(resolved);
    else errors.push(key);
  }
  return { found, errors };
};

// scan descriptions, emit one mention ref per owner with the deduped
// target list; broken `[[key]]` → caller-facing parse error.
//
// Owner granularity:
//   - node mentions   → owner = node id (e.g. order:br-001). Rules,
//                       states, transitions, terms each carry their
//                       own mention ref, so paths/impact can target
//                       them individually.
//   - ref mentions    → owner = owning entity. Refs are anonymous in
//                       the schema, so there is no finer-grained anchor.
// Self-target check uses the owning entity in both cases — a rule
// mentioning its own parent entity is not a useful edge.
const extractMentions = (nodes, refs) => {
  const mentionIndex = buildMentionIndex(nodes);
  // Roots that own child ids. Concepts and implementations are roots
  // too — each is its own document, including one that narrows or
  // realises another.
  const entityIdsByPrefix = new Map();
  for (const n of nodes) {
    if (!isRoot(n)) continue;
    const prefix = n.id.split(':').slice(-1)[0];
    entityIdsByPrefix.set(prefix, n.id);
  }
  const owningEntity = (id) => {
    if (!id) return null;
    if (entityIdsByPrefix.has(id.split(':').slice(-1)[0]) && id.startsWith(DOMAIN_ID + ':')) {
      return id;
    }
    const prefix = id.split(':')[0];
    return entityIdsByPrefix.get(prefix) || null;
  };

  const mentions = new Map();   // owner id → Set of target ids (excluding self-entity)
  const errors = [];

  const scan = (text, owner, ownerEntity, ctx) => {
    if (!text || !owner) return;
    const { found, errors: broken } = findMentionsInText(text, mentionIndex);
    for (const target of found) {
      if (target === ownerEntity) continue;   // skip pointing at own entity
      if (!mentions.has(owner)) mentions.set(owner, new Set());
      mentions.get(owner).add(target);
    }
    for (const key of broken) {
      errors.push({ owner, key, ...ctx });
    }
  };

  for (const n of nodes) {
    const ownerEntity = owningEntity(n.id);
    const owner = isRoot(n) ? ownerEntity : n.id;
    if (!owner) continue;
    scan(n.description, owner, ownerEntity, { kind: 'node', id: n.id, field: 'description' });
    scan(n.name, owner, ownerEntity, { kind: 'node', id: n.id, field: 'name' });
    // Rule notes live in meta but carry the same `[[mention]]` weight
    // as the statement; scan them too.
    if (n.type === 'rule' && n.meta?.notes) {
      scan(n.meta.notes, owner, ownerEntity, { kind: 'node', id: n.id, field: 'meta.notes' });
    }
  }
  for (const r of refs) {
    const ownerEntity = owningEntity(r.owner);
    scan(r.description, ownerEntity, ownerEntity, { kind: 'ref', refType: r.type, ownerNode: r.owner, field: 'description' });
  }

  const mentionRefs = [];
  for (const [owner, targets] of mentions) {
    mentionRefs.push({
      type: 'mention',
      owner,
      pointers: { target: [...targets].sort() },
    });
  }
  return { refs: mentionRefs, errors };
};

const toGraph = (parsedFiles) => {
  const nodes = [];
  const refs = [];
  const mentionErrors = [];

  nodes.push({
    id: DOMAIN_ID,
    type: 'domain',
    name: 'SoftwareOne Marketplace',
    description: 'Authoritative product canon for the SoftwareOne Marketplace platform.',
  });

  const nameIndex = buildNameIndex(parsedFiles);

  for (const file of parsedFiles) {
    const implId = implementationIdFromFile(file.relPath);
    if (implId) {
      if (!file.data.implementation_identity?.implementation_name) continue;
      const { node: impl, parentRef, implementsRef } =
        emitImplementation(implId, file.data, nameIndex);
      nodes.push(impl);
      refs.push(parentRef, implementsRef);

      // §4 and §5 are the concept sections with one column added; the
      // rest is untouched.
      for (const sec of [
        emitKeyConcepts(impl.id, file.data, 'implementation_key_concepts'),
        emitBusinessRules(impl.id, file.data, 'implementation_business_rules'),
        emitInternalEvents(impl.id, file.data),
        emitCrossEffects(impl.id, file.data, nameIndex),
        emitFailureModes(impl.id, file.data),
        emitOpenQuestions(impl.id, file.data),
        emitProse(impl.id, file.prose),
      ]) {
        if (sec.nodes) nodes.push(...sec.nodes);
        if (sec.refs) refs.push(...sec.refs);
      }
      continue;
    }

    const conceptId = conceptIdFromFile(file.relPath);
    if (conceptId) {
      if (!file.data.concept_identity?.concept_name) continue;
      const { node: concept, parentRef } = emitConcept(conceptId, file.data, nameIndex);
      nodes.push(concept);
      refs.push(parentRef);

      // §4, §7 and §9–10 are the object emitters, unchanged
      for (const sec of [
        emitKeyConcepts(concept.id, file.data),
        emitBusinessRules(concept.id, file.data),
        emitInternalEvents(concept.id, file.data),
        emitCrossEffects(concept.id, file.data, nameIndex),
        emitFailureModes(concept.id, file.data),
        emitOpenQuestions(concept.id, file.data),
        emitProse(concept.id, file.prose),
      ]) {
        if (sec.nodes) nodes.push(...sec.nodes);
        if (sec.refs) refs.push(...sec.refs);
      }
      continue;
    }

    const entityId = entityIdFromFile(file.relPath);
    if (!entityId || !file.data.identity?.object_name) continue;
    const { node: entity, parentRef } = emitEntity(entityId, file.data, nameIndex);
    nodes.push(entity);
    refs.push(parentRef);

    const sections = [
      emitStates(entity.id, file.data),
      emitTransitions(entity.id, file.data),
      emitAttributes(entity.id, file.data),
      emitOwnership(entity.id, file.data),
      emitBusinessRules(entity.id, file.data),
      emitRelationships(entity.id, file.data, nameIndex),
      emitInternalEvents(entity.id, file.data),
      emitCrossEffects(entity.id, file.data, nameIndex),
      emitFailureModes(entity.id, file.data),
      emitOpenQuestions(entity.id, file.data),
      emitReversibility(entity.id, file.data),
      emitProse(entity.id, file.prose),
    ];
    for (const s of sections) {
      if (s.nodes) nodes.push(...s.nodes);
      if (s.refs) refs.push(...s.refs);
    }
  }

  // mentions resolve against the full node set, so this runs last
  const mentionResult = extractMentions(nodes, refs);
  refs.push(...mentionResult.refs);
  mentionErrors.push(...mentionResult.errors);

  return { nodes, refs, mentionErrors };
};

export {
  toGraph, kebab, entityIdFromFile, conceptIdFromFile, implementationIdFromFile,
  childId, DOMAIN_ID, ROOT_TYPES,
};
