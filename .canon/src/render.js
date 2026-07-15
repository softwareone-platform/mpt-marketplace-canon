// inverse of parse.js — graph slice → canonical MD. Round-trip is the
// contract: re-parsing the output yields the same graph slice (modulo
// header metadata we synthesise).

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(here, '..', 'templates');

const TEMPLATE_NAMES = {
  header: 'header.md',
  identity: 'identity.md',
  ownership: 'ownership.md',
  states: 'states.md',
  transitions: 'transitions.md',
  business_rules: 'business-rules.md',
  attributes: 'attributes.md',
  relationships: 'relationships.md',
  internal_events: 'internal-events.md',
  cross_effects: 'cross-effects.md',
  reversibility: 'reversibility.md',
  failure_modes: 'failure-modes.md',
  open_questions: 'open-questions.md',
};

const TPL = Object.fromEntries(
  Object.entries(TEMPLATE_NAMES).map(([k, f]) =>
    [k, readFileSync(join(TEMPLATES_DIR, f), 'utf8')]
  )
);

// ── tiny renderer ──────────────────────────────────────────────────

const lookup = (obj, path) => {
  let v = obj;
  for (const seg of path) {
    if (v === undefined || v === null) return undefined;
    v = v[seg];
  }
  return v;
};

/** Strip `as <name>` legacy anchor from a placeholder expression. */
const cleanExpr = (e) => e.replace(/\s+as\s+[a-zA-Z_]\w*\s*$/, '').trim();

const renderTemplate = (tpl, data) => {
  // Block-level: recursive `#each ... /each`. Process innermost first
  // by repeated single-pass replacement.
  let prev;
  do {
    prev = tpl;
    tpl = tpl.replace(
      /\{\s*#each\s+([a-zA-Z_]\w*)\s+in\s+([^}]+?)\s*\}([\s\S]*?)\{\s*\/each\s*\}/,
      (_, item, listPath, body) => {
        const list = lookup(data, cleanExpr(listPath).split('.'));
        if (!Array.isArray(list)) return '';
        return list.map(it => renderTemplate(body, { ...data, [item]: it })).join('');
      }
    );
  } while (tpl !== prev);

  return tpl.replace(/\{\s*([^{}]+?)\s*\}/g, (m, expr) => {
    const e = cleanExpr(expr);
    if (e.startsWith('#') || e === '/each') return m;
    const v = lookup(data, e.split('.'));
    return v === undefined || v === null ? '' : String(v);
  });
};

// ── cell helpers ───────────────────────────────────────────────────

const orDash = (v) => {
  const s = String(v ?? '').trim();
  return s === '' ? '—' : s;
};

const yesNo = (v) => v ? 'Yes' : 'No';
const joinList = (a) => Array.isArray(a) ? a.join(', ') : (a || '');

// inverse of graph.splitIdentityValue — assemble the original
// "Namespace: Name (qualifier)" / "None — qualifier" form
const parentObjectDisplay = (kb, entity) => {
  const parentRefs = kb.from(entity.id, 'parent');
  const parentRef = parentRefs[0];
  const parentId = parentRef?.pointers?.parent;
  const qualifier = entity.meta?.parentObjectNote;
  if (!parentId || parentId === 'marketplace') {
    return qualifier ? `None — ${qualifier}` : 'None.';
  }
  const parent = kb.get(parentId);
  const ns = parent?.meta?.namespace || '';
  const name = parent?.name || parentId;
  const base = ns ? `${ns}: ${name}` : name;
  return qualifier ? `${base} (${qualifier})` : base;
};

// ── per-section data ───────────────────────────────────────────────

const buildHeaderData = (entity) => ({
  object_name: entity.name,
  version: entity.meta?.version || '0.1',
  owner: entity.meta?.owner || 'Unknown',
  last_updated: entity.meta?.lastUpdated || 'unknown',
  status: entity.meta?.status || 'Draft',
});

const buildIdentityData = (kb, entity) => ({
  object_name: entity.name,
  namespace: entity.meta?.namespace || '',
  parent_object: parentObjectDisplay(kb, entity),
  id_prefix: entity.meta?.prefix || 'None.',
  description: entity.description || '',
  aliases: (entity.aliases && entity.aliases.length > 0)
    ? entity.aliases.join(', ')
    : 'None known.',
});

const buildOwnershipData = (kb, entityId) => {
  const refs = kb.from(entityId, 'constraint')
    .filter(r => r.meta?.canonSection === '2.ownership');
  // Order rows in canonical actor order so output is deterministic.
  const ACTOR_ORDER = ['Vendor', 'Operations', 'Client'];
  const sorted = [...refs].sort((a, b) =>
    ACTOR_ORDER.indexOf(a.meta?.actor) - ACTOR_ORDER.indexOf(b.meta?.actor));
  return {
    permissions: sorted.map(r => ({
      actor: r.meta?.actor || '',
      create: yesNo(r.meta?.permissions?.create),
      read: yesNo(r.meta?.permissions?.read),
      update: yesNo(r.meta?.permissions?.update),
      delete: yesNo(r.meta?.permissions?.delete),
      notes: orDash(r.meta?.notes),
    })),
  };
};

const buildStatesData = (kb, entityId) => ({
  states: kb.descendants(entityId, { node: ['state'] }).map(s => ({
    name: s.name,
    description: orDash(s.description),
    initial: yesNo(s.meta?.initial),
    terminal: yesNo(s.meta?.terminal),
  })),
});

const buildTransitionsData = (kb, entityId) => {
  const transitions = kb.descendants(entityId, { node: ['transition'] });
  return {
    transitions: transitions.map(t => {
      const tref = kb.from(t.id, 'transition')[0];
      const fromId = tref?.pointers?.from;
      const toId = tref?.pointers?.to;
      const from = fromId ? (kb.get(fromId)?.name || '—') : '—';
      const to = toId ? (kb.get(toId)?.name || '') : '';
      return {
        id: t.meta?.canonId || '',
        from,
        to,
        action: orDash(t.name),
        endpoint: orDash(t.meta?.endpoint),
        actors: joinList(t.meta?.actors) || '—',
        preconditions: orDash(t.meta?.preconditions),
        outcome: orDash(t.meta?.outcome),
      };
    }),
  };
};

const buildBusinessRulesData = (kb, entityId) => {
  const rules = kb.descendants(entityId, { node: ['rule'] })
    .filter(n => /^[A-Z]+-\d+/.test(n.meta?.canonId || ''))
    .sort((a, b) => (a.meta?.canonId || '').localeCompare(b.meta?.canonId || ''));
  return {
    rules: rules.map(r => ({
      id: r.meta?.canonId || '',
      statement: r.meta?.statement || r.description || '',
      states: orDash(r.meta?.states),
      actor_scope: orDash(r.meta?.actorScope),
      notes: orDash(r.meta?.notes),
    })),
  };
};

const buildAttributesData = (kb, entityId) => ({
  attributes: kb.descendants(entityId, { node: ['term'] }).map(t => ({
    name: t.name,
    type: orDash(t.meta?.type),
    description: orDash(t.description),
    set_by: joinList(t.meta?.setBy) || '—',
    mutable: orDash(t.meta?.mutable),
    notes: orDash(t.meta?.notes),
  })),
});

const buildRelationshipsData = (kb, entityId) => {
  const deps = kb.from(entityId, 'dependency')
    .filter(r => r.meta?.canonSection === '6.relationships');
  const noteAssocs = kb.from(entityId, 'note')
    .filter(r => r.meta?.relationshipType);   // section 6 origin
  const all = [...deps, ...noteAssocs];

  const displayTarget = (r) => {
    // Prefer about (note assoc) then depends-on (dependency); subject
    // is the entity itself.
    const about = r.pointers?.about;
    const dep = r.pointers?.['depends-on'];
    const id = about || dep;
    if (!id) return '—';
    if (id.startsWith('marketplace:future:')) {
      return `Catalog: ${id.split(':').slice(-1)[0]} (pending canonisation)`;
    }
    const node = kb.get(id);
    if (!node) return id;
    const ns = node.meta?.namespace || '';
    return ns ? `${ns}: ${node.name || node.id}` : (node.name || node.id);
  };

  return {
    relationships: all.map(r => ({
      related: displayTarget(r),
      type: r.meta?.relationshipType || 'Association',
      cardinality: orDash(r.meta?.cardinality),
      description: orDash(r.description),
      lifecycle: orDash(r.meta?.lifecycleDependency),
    })),
  };
};

const buildInternalEventsData = (kb, entityId) => {
  const refs = kb.from(entityId, 'note').filter(r => r.meta?.kind === 'event');
  return {
    events: refs.map(r => {
      const desc = String(r.description || '');
      const m = desc.match(/^([^—]+?)\s*—\s*(.+)$/);
      return {
        event: m ? m[1].trim() : desc,
        trigger: orDash(r.meta?.trigger),
        actors: joinList(r.meta?.actors) || '—',
        side_effect: m ? m[2].trim() : '—',
      };
    }),
  };
};

const buildCrossEffectsData = (kb, entityId) => {
  const refs = kb.from(entityId, 'note').filter(r => r.meta?.kind === 'cross-effect');
  return {
    effects: refs.map(r => {
      // description format from emitCrossEffects: "<trigger> → <affected>: <effect>"
      const desc = String(r.description || '');
      const m = desc.match(/^(.+?)\s*→\s*([^:]+?):\s*(.+)$/);
      return {
        trigger: m ? m[1].trim() : desc,
        affected: m ? m[2].trim() : '—',
        effect: m ? m[3].trim() : '—',
        automated: yesNo(r.meta?.automated),
        condition: orDash(r.meta?.condition),
        notes: orDash(r.meta?.notes),
      };
    }),
  };
};

const buildFailureModesData = (kb, entityId) => {
  const refs = kb.from(entityId, 'risk');
  return {
    failures: refs.map(r => {
      const desc = String(r.description || '');
      const m = desc.match(/^([^—]+?)\s*—\s*(.+)$/);
      return {
        scenario: m ? m[1].trim() : desc,
        behavior: m ? m[2].trim() : '—',
        actor: orDash(r.meta?.actorImpacted),
        risk: r.meta?.level
          ? r.meta.level.charAt(0).toUpperCase() + r.meta.level.slice(1)
          : '—',
        notes: orDash(r.meta?.notes),
      };
    }),
  };
};

// emitReversibility joins (reversible, deletion, audit) into one
// note; we can't fully reconstruct the original three-part shape,
// so output a single-line form that re-parses cleanly.
// TODO: preserve sub-fields in note meta to round-trip exactly.
const buildReversibilityData = (kb, entityId) => {
  const ref = kb.from(entityId, 'note').find(r => r.meta?.kind === 'reversibility');
  if (!ref) return { reversible: 'Not specified.', deletion: 'Not specified.', audit: 'Not specified.' };

  return {
    reversible: String(ref.description || '') || 'Not specified.',
    deletion: '—',
    audit: '—',
  };
};

const buildOpenQuestionsData = (kb, entityId) => {
  const open = kb.from(entityId, 'note').filter(r => r.meta?.kind === 'open-question');
  if (open.length > 0) {
    return {
      open_questions: open.map(r =>
        `- [ ] [${r.meta?.canonId || ''}]: ${r.description || ''}`).join('\n'),
    };
  }
  const status = kb.from(entityId, 'note').find(r => r.meta?.kind === 'open-questions-status');
  return { open_questions: status?.description || 'No open questions at this time.' };
};

// ── stitch ─────────────────────────────────────────────────────────

const PLATFORM_INVARIANTS_BLOCK =
  '## Platform Invariants\n\n' +
  '**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. ' +
  'All invariants apply to this object without exception.';

// regenerate 3.3 from 3.2 data — text-arrow form
const stateDiagramFromTransitions = (rows) => {
  if (rows.length === 0) return '';

  const lines = rows.map(t => {
    const from = t.from === '—' ? '—' : `[${t.from}]`;
    return `${from} ---(${t.action} : ${t.actors})---> [${t.to}]`;
  });

  return '### 3.3 State Diagram\n\n```\n' + lines.join('\n') + '\n```';
};

const renderEntity = (kb, entityId) => {
  const entity = kb.get(entityId);
  if (!entity || entity.type !== 'entity') return null;

  const states = buildStatesData(kb, entityId);
  const transitions = buildTransitionsData(kb, entityId);
  const internalEvents = buildInternalEventsData(kb, entityId);
  const crossEffects = buildCrossEffectsData(kb, entityId);

  const parts = [];
  parts.push(renderTemplate(TPL.header, buildHeaderData(entity)).trim());
  parts.push(PLATFORM_INVARIANTS_BLOCK);
  parts.push(renderTemplate(TPL.identity, buildIdentityData(kb, entity)).trim());
  parts.push(renderTemplate(TPL.ownership, buildOwnershipData(kb, entityId)).trim());

  // Section 3 (State Machine) is a container — emit heading + 3.1/3.2/3.3.
  const hasStates = states.states.length > 0;
  if (hasStates) {
    parts.push('## 3. State Machine');
    parts.push(renderTemplate(TPL.states, states).trim());
    parts.push(renderTemplate(TPL.transitions, transitions).trim());
    const diag = stateDiagramFromTransitions(transitions.transitions);
    if (diag) parts.push(diag);
  } else {
    parts.push('## 3. State Machine\n\nThis object has no state machine.');
  }

  parts.push(renderTemplate(TPL.business_rules, buildBusinessRulesData(kb, entityId)).trim());
  parts.push(renderTemplate(TPL.attributes, buildAttributesData(kb, entityId)).trim());
  parts.push(renderTemplate(TPL.relationships, buildRelationshipsData(kb, entityId)).trim());

  // Section 7 (Lifecycle Events) — container.
  parts.push('## 7. Lifecycle Events & Side Effects');
  parts.push(renderTemplate(TPL.internal_events, internalEvents).trim());
  parts.push(renderTemplate(TPL.cross_effects, crossEffects).trim());

  parts.push(renderTemplate(TPL.reversibility, buildReversibilityData(kb, entityId)).trim());
  parts.push(renderTemplate(TPL.failure_modes, buildFailureModesData(kb, entityId)).trim());
  parts.push(renderTemplate(TPL.open_questions, buildOpenQuestionsData(kb, entityId)).trim());

  // Section 11 Changelog — synthesize a single placeholder row.
  parts.push('## 11. Changelog\n\n' +
    '| Version | Date | Author | Notes |\n' +
    '| --- | --- | --- | --- |\n' +
    `| ${entity.meta?.version || '0.1'} | auto | render.js | Auto-generated from graph. |`);

  return parts.join('\n\n---\n\n') + '\n';
};

export { renderEntity, renderTemplate };
