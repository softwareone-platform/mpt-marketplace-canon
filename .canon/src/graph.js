// Parsed sections → { nodes, refs }. ID conventions:
//   marketplace                       domain
//   marketplace:webhook               entity
//   webhook:enabled                   state (entity-suffix : kebab-name)
//   webhook:enabled-to-disabled       transition
//   webhook:disable-webhook           action
//   webhook:url                       term
// Unresolved cross-refs become marketplace:future:<kebab> stubs so the
// graph stays referentially intact.

const DOMAIN_ID = 'marketplace';

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

const emitBusinessRules = (entityId, parsed) => {
  const rows = parsed.business_rules?.rules || [];
  const refs = [];
  for (const row of rows) {
    if (!row.statement) continue;
    refs.push({
      type: 'constraint',
      owner: entityId,
      description: row.statement,
      pointers: { subject: entityId },
      meta: {
        canonId: row.id,
        states: row.states || '',
        actorScope: row.actor_scope || '',
        notes: row.notes || '',
      },
    });
  }
  return { refs };
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
    if (n.type !== 'entity') continue;
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

// scan descriptions, emit one mention ref per owner-entity with the
// deduped target list; broken `[[key]]` → caller-facing parse error
const extractMentions = (nodes, refs) => {
  const mentionIndex = buildMentionIndex(nodes);
  const entityIdsByPrefix = new Map();
  for (const n of nodes) {
    if (n.type !== 'entity') continue;
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

  const mentions = new Map();   // entity id → Set of target ids (excluding self)
  const errors = [];

  const scan = (text, ownerEntity, ctx) => {
    if (!text || !ownerEntity) return;
    const { found, errors: broken } = findMentionsInText(text, mentionIndex);
    for (const target of found) {
      if (target === ownerEntity) continue;   // self-mention is a no-op
      if (!mentions.has(ownerEntity)) mentions.set(ownerEntity, new Set());
      mentions.get(ownerEntity).add(target);
    }
    for (const key of broken) {
      errors.push({ owner: ownerEntity, key, ...ctx });
    }
  };

  for (const n of nodes) {
    const owner = owningEntity(n.id);
    scan(n.description, owner, { kind: 'node', id: n.id, field: 'description' });
    scan(n.name, owner, { kind: 'node', id: n.id, field: 'name' });
  }
  for (const r of refs) {
    const owner = owningEntity(r.owner);
    scan(r.description, owner, { kind: 'ref', refType: r.type, ownerNode: r.owner, field: 'description' });
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

export { toGraph, kebab, entityIdFromFile, childId, DOMAIN_ID };
