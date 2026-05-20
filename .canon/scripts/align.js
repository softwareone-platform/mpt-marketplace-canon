// align-format patch generator. objects/*.md → .patches/align-format/
// objects/*.md via two phases: pure-text format normalisers, then
// content adaptations (some optionally backed by an external reference
// graph at $CANON_REFERENCE_GRAPH).
//
// Idempotent. The patch is committed already adapted, so re-running
// is only needed when evolving the format on new authored content.
//
// See .patches/align-format/CHANGELOG.md for per-transform rationale.

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

const SOURCE_DIR = join(repoRoot, 'objects');
const DEST_DIR = join(repoRoot, '.patches', 'align-format', 'objects');
// Phase-2 reference graph (action names, missing states, attribute
// rows). Absent → Phase 2 lookups skip; Phase 1 still runs.
const REFERENCE_GRAPH_DIR = process.env.CANON_REFERENCE_GRAPH || null;

// ── ids (must mirror graph.js exactly) ─────────────────────────────

const kebabize = (s) => String(s)
  .trim()
  .replace(/[_/]+/g, '-')
  .replace(/([a-z])([A-Z])/g, '$1-$2')
  .replace(/[^a-zA-Z0-9-]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '')
  .toLowerCase();

const NAMESPACE_FROM_FILENAME = (filename) => {
  const m = filename.match(/^CANON_OBJECT_([A-Za-z]+)_/);
  return m ? m[1] : null;
};

const entityIdFromFile = (relPath) => {
  const m = relPath.match(/^CANON_OBJECT_[A-Za-z]+_(.+)\.md$/);
  if (!m) return null;
  return `marketplace:${kebabize(m[1])}`;
};

// ── reference id normalisation ─────────────────────────────────────
// reference graph carries shorter ids for some entities — these
// tables remap onto the filename-derived canonical ids

const ID_REWRITE = {
  'marketplace:item': 'marketplace:product-item',
  'marketplace:parameter': 'marketplace:product-parameter',
  'marketplace:item-group': 'marketplace:product-item-group',
  'marketplace:parameter-group': 'marketplace:product-parameter-group',
  'marketplace:template': 'marketplace:product-template',
  'marketplace:terms': 'marketplace:product-terms',
  'marketplace:terms-variant': 'marketplace:product-terms-variant',
  'marketplace:media': 'marketplace:product-media',
};
const PREFIX_REWRITE = {
  'item:': 'product-item:',
  'parameter:': 'product-parameter:',
  'item-group:': 'product-item-group:',
  'parameter-group:': 'product-parameter-group:',
  'template:': 'product-template:',
  'terms:': 'product-terms:',
  'terms-variant:': 'product-terms-variant:',
  'media:': 'product-media:',
};
const rewriteId = (id) => {
  if (typeof id !== 'string') return id;
  if (ID_REWRITE[id]) return ID_REWRITE[id];
  for (const [from, to] of Object.entries(PREFIX_REWRITE)) {
    if (id.startsWith(from)) return to + id.slice(from.length);
  }
  return id;
};

const loadReferenceGraph = () => {
  const nodesById = new Map();
  const refsByOwner = new Map();
  // Phase-2 adaptations that need canonical lookups read from an
  // external reference graph. The path is optional — when absent,
  // those adaptations skip silently and Phase 1 still runs. The patch
  // under `.patches/align-format/objects/` is committed already
  // adapted, so consumers don't need the reference to ship a working
  // canon.
  if (!REFERENCE_GRAPH_DIR) return { nodesById, refsByOwner };
  let files = [];
  try {
    files = readdirSync(REFERENCE_GRAPH_DIR).filter(f => f.endsWith('.yaml'));
  } catch {
    process.stderr.write(`align: CANON_REFERENCE_GRAPH=${REFERENCE_GRAPH_DIR} not readable — skipping reference-driven adaptations.\n`);
    return { nodesById, refsByOwner };
  }
  for (const file of files) {
    const arr = parseYaml(readFileSync(join(REFERENCE_GRAPH_DIR, file), 'utf8'));
    if (!Array.isArray(arr)) continue;
    for (const node of arr) {
      if (!node || typeof node !== 'object' || !node.id) continue;
      const id = rewriteId(node.id);
      const { refs, ...rest } = node;
      nodesById.set(id, { ...rest, id });
      const ownerRefs = [];
      for (const r of refs || []) {
        const ptrs = {};
        for (const p of r.pointers || []) {
          const t = rewriteId(p.target);
          if (Array.isArray(ptrs[p.role])) ptrs[p.role].push(t);
          else if (ptrs[p.role] !== undefined) ptrs[p.role] = [ptrs[p.role], t];
          else ptrs[p.role] = t;
        }
        ownerRefs.push({ type: r.type, owner: id, pointers: ptrs, description: r.description, meta: r.meta });
      }
      refsByOwner.set(id, ownerRefs);
    }
  }
  return { nodesById, refsByOwner };
};

// ── tables ─────────────────────────────────────────────────────────

const splitRow = (line) => line.trim().slice(1, -1).split('|').map(c => c.trim());
const joinRow = (cells) => '| ' + cells.join(' | ') + ' |';
const isDividerRow = (line) =>
  /^\|\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|\s*$/.test(line);

// ── phase 1: format ────────────────────────────────────────────────

// `| --- | --- | ... |`
const normalizeDividers = (content) => {
  return content.split('\n').map(line => {
    if (!isDividerRow(line)) return line;
    const cells = line.trim().slice(1, -1).split('|').length;
    return '| ' + Array(cells).fill('---').join(' | ') + ' |';
  }).join('\n');
};

// drop blockquotes after a heading — author guidance, not data
const stripPostHeadingBlockquotes = (content) => {
  const lines = content.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    out.push(lines[i]);
    if (/^#{2,3} /.test(lines[i])) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j < lines.length && (lines[j].startsWith('> ') || lines[j] === '>')) {
        while (j < lines.length && (lines[j].startsWith('> ') || lines[j] === '>')) j++;
        while (j < lines.length && lines[j].trim() === '') j++;
        out.push('');
        i = j;
        continue;
      }
    }
    i++;
  }
  return out.join('\n');
};

// section 4 — strip thematic `### N.M` rule subsections; rule rows
// merge into one table. Safe: every sub-section uses the same Rule
// schema. Different schemas would surface as parser errors.
const removeRulesSubsections = (content) => {
  const lines = content.split('\n');
  const startIdx = lines.findIndex(l => /^## 4\. /.test(l));
  if (startIdx < 0) return content;
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) { endIdx = i; break; }
  }
  return lines.filter((line, i) => {
    if (i <= startIdx || i >= endIdx) return true;
    return !/^#{2,3}\s+\d+\.\d+\s+/.test(line);
  }).join('\n');
};

// section 5 — fold `### N.M <Name> Sub-fields` into the main attrs
// table with `<parentCamel>.<sub-name>` rows. Extra columns fold
// into Notes (same convention as table-headers).
const expandAttributeSubFields = (content) => {
  const lines = content.split('\n');
  const sec5StartIdx = lines.findIndex(l => /^## 5\. /.test(l));
  if (sec5StartIdx < 0) return content;
  let sec5EndIdx = lines.length;
  for (let i = sec5StartIdx + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) { sec5EndIdx = i; break; }
  }

  // Find sub-section heading "### N.M <Name> Sub-fields".
  let subIdx = -1;
  let subParent = null;
  for (let i = sec5StartIdx + 1; i < sec5EndIdx; i++) {
    const m = lines[i].match(/^#{2,3}\s+\d+\.\d+\s+(.+?)\s+Sub-fields\s*$/i);
    if (m) { subIdx = i; subParent = m[1]; break; }
  }
  if (subIdx < 0) return content;

  // Bound the main table.
  let mainHeaderIdx = -1;
  for (let i = sec5StartIdx + 1; i < subIdx; i++) {
    if (lines[i].trim().startsWith('|') && !isDividerRow(lines[i])) { mainHeaderIdx = i; break; }
  }
  if (mainHeaderIdx < 0) return content;
  let mainEndIdx = mainHeaderIdx + 1;
  while (mainEndIdx < subIdx && lines[mainEndIdx].trim().startsWith('|')) mainEndIdx++;
  const mainHeaders = splitRow(lines[mainHeaderIdx]);

  // Bound the sub-table.
  let subHeaderIdx = -1;
  for (let i = subIdx + 1; i < sec5EndIdx; i++) {
    if (lines[i].trim().startsWith('|') && !isDividerRow(lines[i])) { subHeaderIdx = i; break; }
    if (lines[i].trim().startsWith('### ')) break;
  }
  if (subHeaderIdx < 0) return content;
  let subEndIdx = subHeaderIdx + 1;
  while (subEndIdx < sec5EndIdx && lines[subEndIdx].trim().startsWith('|')) subEndIdx++;
  const subHeaders = splitRow(lines[subHeaderIdx]);

  // Sub-rows: skip header + divider.
  const subDataRows = lines.slice(subHeaderIdx + 2, subEndIdx);
  const parentCamel = subParent.charAt(0).toLowerCase() + subParent.slice(1).replace(/\s+/g, '');

  const notesIdx = mainHeaders.findIndex(h => h.trim() === 'Notes');
  const newRows = subDataRows.map(line => {
    const cells = splitRow(line);
    const subName = cells[0];
    // Map sub columns onto main columns by header name; fold the rest
    // into Notes.
    const newCells = mainHeaders.map((h) => {
      const subCol = subHeaders.findIndex(s => s.trim() === h.trim());
      return subCol >= 0 ? (cells[subCol] || '') : '';
    });
    newCells[0] = `${parentCamel}.${subName}`;
    const extras = subHeaders
      .map((h, i) => ({ name: h.trim(), value: (cells[i] || '').trim() }))
      .filter(e => e.name !== subHeaders[0].trim()
        && !mainHeaders.some(m => m.trim() === e.name)
        && e.value && e.value !== '—');
    if (extras.length > 0 && notesIdx >= 0) {
      const fold = extras.map(e => `${e.name}: ${e.value}`).join('. ');
      newCells[notesIdx] = newCells[notesIdx]
        ? `${fold}. ${newCells[notesIdx]}`
        : fold;
    }
    return joinRow(newCells);
  });

  // Splice: keep main table + new rows; drop sub-section heading + sub-table.
  const out = [
    ...lines.slice(0, mainEndIdx),
    ...newRows,
    ...lines.slice(mainEndIdx, subIdx).filter(l => l.trim() !== ''),
    '',
    ...lines.slice(subEndIdx),
  ];
  return out.join('\n');
};

// Identity needs Namespace + ID Prefix lines — fill from filename
// (Namespace) and `None.` sentinel (ID Prefix) when absent
const fillIdentityFields = (content, filename) => {
  const namespace = NAMESPACE_FROM_FILENAME(filename);
  const lines = content.split('\n');
  const out = [];
  let identStart = -1, identEnd = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (/^## 1\. Identity\s*$/.test(lines[i])) identStart = i;
    else if (identStart >= 0 && /^## /.test(lines[i])) { identEnd = i; break; }
  }
  if (identStart < 0) return content;

  let hasNamespace = false, hasIdPrefix = false;
  for (let i = identStart; i < identEnd; i++) {
    if (/^\*\*Namespace:\*\*/.test(lines[i])) hasNamespace = true;
    if (/^\*\*ID Prefix:\*\*/.test(lines[i])) hasIdPrefix = true;
  }

  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    if (i >= identStart && i < identEnd) {
      if (/^\*\*Object Name:\*\*/.test(lines[i]) && !hasNamespace && namespace) {
        out.push('');
        out.push(`**Namespace:** ${namespace}`);
      }
      if (/^\*\*Parent Object:\*\*/.test(lines[i]) && !hasIdPrefix) {
        out.push('');
        out.push('**ID Prefix:** None.');
      }
    }
  }
  return out.join('\n');
};

// Identity → canonical field order:
//   Object Name → Namespace → Parent Object → ID Prefix → Description → Also Known As
// Description + Also Known As always block-style (template needs it)
const reorderIdentityFields = (content) => {
  const lines = content.split('\n');
  const startIdx = lines.findIndex(l => /^## 1\. Identity\s*$/.test(l));
  if (startIdx < 0) return content;
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) { endIdx = i; break; }
  }

  const fields = {};
  let currentField = null;
  let currentLines = [];
  const flush = () => {
    if (currentField) fields[currentField] = currentLines.join('\n').trim();
    currentField = null;
    currentLines = [];
  };
  for (let i = startIdx + 1; i < endIdx; i++) {
    const m = lines[i].match(/^\*\*([^*]+):\*\*\s*(.*)$/);
    if (m) {
      flush();
      currentField = m[1];
      const inline = m[2].trim();
      currentLines = inline ? [inline] : [];
      continue;
    }
    if (currentField) currentLines.push(lines[i]);
  }
  flush();

  const order = ['Object Name', 'Namespace', 'Parent Object', 'ID Prefix', 'Description', 'Also Known As'];
  const blockFields = new Set(['Description', 'Also Known As']);
  const out = [...lines.slice(0, startIdx + 1), ''];
  for (const name of order) {
    const value = fields[name];
    if (value === undefined) continue;
    if (blockFields.has(name) || value.includes('\n')) {
      out.push(`**${name}:**`);
      out.push(value);
    } else {
      out.push(`**${name}:** ${value}`);
    }
    out.push('');
  }
  out.push('---', '');
  return [...out, ...lines.slice(endIdx)].join('\n');
};

// Section-table headers → canonical column layout. Near-variants
// in source MDs (older dialects, different col counts) get rewritten
// row-by-row.
const TABLE_NORMALIZERS = {
  '## 5. Key Attributes': {
    canonicalHeader: '| Attribute | Type | Description | Set By | Mutable After Creation? | Notes |',
    rewriteRow: (cells, headerCells) => {
      const idx = (name) => headerCells.findIndex(h => h.trim() === name);
      const get = (i) => i >= 0 ? (cells[i] || '').trim() : '';
      const notesIdx = idx('Notes');
      const notes = notesIdx >= 0 ? get(notesIdx) : '';
      const extras = headerCells
        .map((h, i) => ({ name: h.trim(), value: get(i) }))
        .filter(c => ![
          'Attribute', 'Type', 'Description', 'Set By',
          'Mutable After Creation?', 'Notes',
        ].includes(c.name) && c.value !== '' && c.value !== 'N/A');
      const foldedNotes = [
        ...extras.map(e => `${e.name}: ${e.value}`),
        notes,
      ].filter(Boolean).join('. ');
      return [
        get(idx('Attribute')),
        get(idx('Type')),
        get(idx('Description')),
        get(idx('Set By')),
        get(idx('Mutable After Creation?')),
        foldedNotes,
      ];
    },
  },
  '### 7.2 Cross-Object State Effects': {
    canonicalHeader: '| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |',
    rewriteRow: (cells, headerCells) => {
      const idx = (name) => headerCells.findIndex(h => h.trim() === name);
      const get = (i) => i >= 0 ? (cells[i] || '').trim() : '';
      const effectIdx = idx('Effect on Affected Object') >= 0
        ? idx('Effect on Affected Object')
        : idx('Effect');
      return [
        get(idx('Triggering Event')),
        get(idx('Affected Object')),
        get(effectIdx),
        get(idx('Automated?')),
        get(idx('Condition')),
        get(idx('Notes')),
      ];
    },
  },
  '## 6. Relationships to Other Objects': {
    canonicalHeader: '| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |',
    rewriteRow: (cells, headerCells) => {
      const idx = (name) => headerCells.findIndex(h => h.trim() === name);
      const get = (i) => i >= 0 ? (cells[i] || '').trim() : '';
      const lifecycleIdx = idx('Lifecycle Dependency?') >= 0
        ? idx('Lifecycle Dependency?')
        : idx('Lifecycle Dependency');
      return [
        get(idx('Related Object')),
        get(idx('Relationship Type')),
        get(idx('Cardinality')),
        get(idx('Description')),
        get(lifecycleIdx),
      ];
    },
  },
  '### 3.2 Transitions': {
    canonicalHeader: '| # | From State | To State | Action / Trigger | Permitted Actor(s) | Preconditions | Outcome / Side Effects |',
    rewriteRow: (cells, headerCells) => {
      // Source MDs use two header dialects:
      //   newer: # / From State / To State / Action / Trigger /
      //          Permitted Actor(s) / Preconditions / Outcome / Side Effects
      //   older: ID / From State / To State / Action / Actor /
      //          Precondition / Notes
      const aliases = {
        '#':                       ['#', 'ID'],
        'From State':              ['From State', 'From'],
        'To State':                ['To State', 'To'],
        'Action / Trigger':        ['Action / Trigger', 'Action'],
        'Permitted Actor(s)':      ['Permitted Actor(s)', 'Actor'],
        'Preconditions':           ['Preconditions', 'Precondition'],
        'Outcome / Side Effects':  ['Outcome / Side Effects', 'Notes'],
      };
      const findIdx = (canonical) => {
        for (const name of aliases[canonical]) {
          const i = headerCells.findIndex(h => h.trim() === name);
          if (i >= 0) return i;
        }
        return -1;
      };
      const get = (i) => i >= 0 ? (cells[i] || '').trim() : '';
      return [
        get(findIdx('#')),
        get(findIdx('From State')),
        get(findIdx('To State')),
        get(findIdx('Action / Trigger')),
        get(findIdx('Permitted Actor(s)')),
        get(findIdx('Preconditions')),
        get(findIdx('Outcome / Side Effects')),
      ];
    },
  },
  '### 3.1 States': {
    canonicalHeader: '| State | Description | Initial State? | Terminal State? |',
    rewriteRow: (cells, headerCells) => {
      const idx = (name) => headerCells.findIndex(h => h.trim() === name);
      const get = (i) => i >= 0 ? (cells[i] || '').trim() : '';
      return [
        get(idx('State')),
        get(idx('Description')),
        get(idx('Initial State?')) || '',
        get(idx('Terminal State?')) || '',
      ];
    },
  },
};

const isHeaderRow = (line) => /^\|\s*[^|]/.test(line) && !isDividerRow(line);

const normalizeTableHeaders = (content) => {
  const lines = content.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    out.push(line);
    const norm = TABLE_NORMALIZERS[line.trim()];
    if (!norm) { i++; continue; }
    i++;
    while (i < lines.length && !isHeaderRow(lines[i]) && !lines[i].startsWith('## ') && !lines[i].startsWith('### ')) {
      out.push(lines[i]);
      i++;
    }
    if (i >= lines.length || !isHeaderRow(lines[i])) continue;
    const headerCells = splitRow(lines[i]);
    out.push(norm.canonicalHeader);
    i++;
    if (i < lines.length && isDividerRow(lines[i])) i++;
    const canonicalDivider = '| ' + Array(splitRow(norm.canonicalHeader).length).fill('---').join(' | ') + ' |';
    out.push(canonicalDivider);
    while (i < lines.length && isHeaderRow(lines[i]) && lines[i].startsWith('|')) {
      const cells = splitRow(lines[i]);
      out.push(joinRow(norm.rewriteRow(cells, headerCells)));
      i++;
    }
  }
  return out.join('\n');
};

// emit empty canonical table when a should-have-table section is
// only prose ("No cross-object state effects."). Phase 2 captures
// the prose separately as a note.
const SECTIONS_REQUIRING_TABLE = {
  '### 7.2 Cross-Object State Effects': [
    '| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |',
    '| --- | --- | --- | --- | --- | --- |',
  ],
  '### 7.1 Internal Events': [
    '| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |',
    '| --- | --- | --- | --- |',
  ],
  '## 9. Failure Modes & Edge Cases': [
    '| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |',
    '| --- | --- | --- | --- | --- |',
  ],
};

const ensureTablePresent = (content) => {
  const lines = content.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    out.push(line);
    const fallback = SECTIONS_REQUIRING_TABLE[line.trim()];
    if (!fallback) { i++; continue; }
    let j = i + 1;
    while (j < lines.length && !lines[j].startsWith('## ') && !lines[j].startsWith('### ')) {
      if (lines[j].startsWith('|')) break;
      j++;
    }
    if (j < lines.length && lines[j].startsWith('|')) { i++; continue; }
    out.push('');
    out.push(...fallback);
    out.push('');
    i = j;
  }
  return out.join('\n');
};

// empty cells → `—` sentinel. Matcher's ` |` terminator search
// jumps past EOL on an empty capture and eats following rows; a
// non-whitespace token in the cell pins the per-row boundary.
// graph.js treats `—` as empty at consumption time.
const fillEmptyTableCells = (content) => {
  return content.split('\n').map(line => {
    if (!/^\|.+\|$/.test(line) || isDividerRow(line)) return line;
    const cells = line.slice(1, -1).split('|').map(c => c.trim());
    const filled = cells.map(c => c === '' ? '—' : c);
    return '| ' + filled.join(' | ') + ' |';
  }).join('\n');
};

/** Collapse runs of >=2 blank lines into a single blank. */
const stripDoubleBlanks = (content) => {
  return content.split('\n').reduce((acc, line) => {
    if (line.trim() === '' && acc.length > 0 && acc[acc.length - 1].trim() === '') return acc;
    acc.push(line);
    return acc;
  }, []).join('\n');
};

// ── Phase 2 — knowledge recovery ────────────────────────────────────

// expand combined state cells in 3.2:
//   "Active / Enabled" → one row per side
//   "Any"              → one row per non-terminal state
// renumber the # column on expansion: T3 → T3a, T3b, ...
const expandCombinedTransitionRows = (md) => {
  const lines = md.split('\n');
  const startIdx = lines.findIndex(l => /^### 3\.2 Transitions\s*$/.test(l));
  if (startIdx < 0) return md;

  const statesIdx = lines.findIndex(l => /^### 3\.1 States\s*$/.test(l));
  const declaredStates = [];
  if (statesIdx >= 0) {
    let h = -1;
    for (let i = statesIdx + 1; i < lines.length; i++) {
      if (/^### |^## /.test(lines[i])) break;
      if (lines[i].trim().startsWith('|') && !lines[i].trim().startsWith('| ---')) { h = i; break; }
    }
    if (h >= 0) {
      const headers = splitRow(lines[h]);
      const tIdx = headers.findIndex(c => c === 'Terminal State?');
      for (let i = h + 2; i < lines.length; i++) {
        if (!lines[i].trim().startsWith('|')) break;
        const cells = splitRow(lines[i]);
        declaredStates.push({ name: cells[0], terminal: tIdx >= 0 && cells[tIdx] === 'Yes' });
      }
    }
  }

  let headerIdx = -1;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^### |^## /.test(lines[i])) break;
    if (lines[i].trim().startsWith('|') && !lines[i].trim().startsWith('| ---')) { headerIdx = i; break; }
  }
  if (headerIdx < 0) return md;
  const headers = splitRow(lines[headerIdx]);
  const idIdx = headers.findIndex(h => h === '#');
  const fromIdx = headers.findIndex(h => h === 'From State');
  const toIdx = headers.findIndex(h => h === 'To State');
  if (fromIdx < 0 || toIdx < 0) return md;

  const expand = (cell) => {
    const v = cell.trim();
    if (/^Any$/i.test(v)) return declaredStates.filter(s => !s.terminal).map(s => s.name);
    if (v.includes('/')) return v.split('/').map(s => s.trim()).filter(Boolean);
    return [v];
  };

  const out = [...lines.slice(0, headerIdx + 2)];
  for (let i = headerIdx + 2; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('|')) {
      out.push(...lines.slice(i));
      break;
    }
    const cells = splitRow(lines[i]);
    const froms = expand(cells[fromIdx]);
    const tos = expand(cells[toIdx]);
    if (froms.length === 1 && tos.length === 1) {
      out.push(lines[i]);
      continue;
    }
    let suffix = 0;
    const baseId = idIdx >= 0 ? cells[idIdx] : '';
    for (const f of froms) {
      for (const t of tos) {
        const c = [...cells];
        c[fromIdx] = f;
        c[toIdx] = t;
        if (idIdx >= 0 && baseId && baseId !== '—') {
          c[idIdx] = `${baseId}${String.fromCharCode(97 + suffix)}`;
        }
        out.push(joinRow(c));
        suffix++;
      }
    }
  }
  return out.join('\n');
};

// fill Action / Trigger from the reference graph, matched by
// (from, to). Source MDs vary wildly here — proper names, prose,
// shortened verbs — so always defer to the curated name.
const enrichTransitionsActions = (md, entityId, old) => {
  const lines = md.split('\n');
  const startIdx = lines.findIndex(l => /^### 3\.2 Transitions\s*$/.test(l));
  if (startIdx < 0) return md;

  const ownRefs = (id) => old.refsByOwner.get(id) || [];
  const entityPrefix = entityId.split(':').slice(-1)[0];
  const transitionToAction = new Map();
  for (const [id, node] of old.nodesById) {
    if (node.type !== 'action') continue;
    if (!id.startsWith(entityPrefix + ':')) continue;
    for (const ref of ownRefs(id)) {
      if (ref.type !== 'action-binding') continue;
      const steps = Array.isArray(ref.pointers.step) ? ref.pointers.step : [ref.pointers.step];
      for (const step of steps) {
        const trefs = ownRefs(step);
        const tref = trefs.find(r => r.type === 'transition');
        if (!tref) continue;
        const from = (tref.pointers.from || '').split(':').slice(-1)[0];
        const to = (tref.pointers.to || '').split(':').slice(-1)[0];
        const key = `${from}|${to}`;
        if (!transitionToAction.has(key)) transitionToAction.set(key, node.name);
      }
    }
  }

  let headerIdx = -1;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) break;
    if (lines[i].trim().startsWith('|') && !lines[i].trim().startsWith('| ---')) { headerIdx = i; break; }
  }
  if (headerIdx < 0) return md;
  const headers = splitRow(lines[headerIdx]);
  const fromIdx = headers.findIndex(h => h === 'From State');
  const toIdx = headers.findIndex(h => h === 'To State');
  const actionIdx = headers.findIndex(h => h === 'Action / Trigger');
  if (fromIdx < 0 || toIdx < 0 || actionIdx < 0) return md;

  const out = [...lines];
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith('|')) break;
    if (line.trim().startsWith('| ---')) continue;
    const cells = splitRow(line);
    const fromKey = (cells[fromIdx] === '—' || !cells[fromIdx]) ? '' : kebabize(cells[fromIdx]);
    const toKey = kebabize(cells[toIdx]);
    if (!fromKey) continue;
    const recoveredName = transitionToAction.get(`${fromKey}|${toKey}`);
    if (!recoveredName || cells[actionIdx] === recoveredName) continue;
    cells[actionIdx] = recoveredName;
    out[i] = joinRow(cells);
  }
  return out.join('\n');
};

// add missing state rows to 3.1 when a transition's from/to refs an
// undeclared state. Pulls description + initial/terminal flags from
// the reference graph when available.
const enrichStatesRows = (md, entityId, old) => {
  const lines = md.split('\n');
  const startIdx = lines.findIndex(l => /^### 3\.1 States\s*$/.test(l));
  if (startIdx < 0) return md;
  let headerIdx = -1;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^### |^## /.test(lines[i])) break;
    if (lines[i].trim().startsWith('|') && !lines[i].trim().startsWith('| ---')) { headerIdx = i; break; }
  }
  if (headerIdx < 0) return md;

  const existing = new Set();
  let lastDataIdx = headerIdx + 1;
  for (let i = headerIdx + 2; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('|')) break;
    const cells = splitRow(lines[i]);
    existing.add(cells[0]);
    lastDataIdx = i;
  }

  const trStartIdx = lines.findIndex(l => /^### 3\.2 Transitions\s*$/.test(l));
  if (trStartIdx < 0) return md;
  let trHeaderIdx = -1;
  for (let i = trStartIdx + 1; i < lines.length; i++) {
    if (/^### |^## /.test(lines[i])) break;
    if (lines[i].trim().startsWith('|') && !lines[i].trim().startsWith('| ---')) { trHeaderIdx = i; break; }
  }
  if (trHeaderIdx < 0) return md;
  const trHeaders = splitRow(lines[trHeaderIdx]);
  const fromIdx = trHeaders.findIndex(h => h === 'From State');
  const toIdx = trHeaders.findIndex(h => h === 'To State');

  const referenced = new Set();
  for (let i = trHeaderIdx + 2; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('|')) break;
    const cells = splitRow(lines[i]);
    if (cells[fromIdx] && cells[fromIdx] !== '—') referenced.add(cells[fromIdx]);
    if (cells[toIdx] && cells[toIdx] !== '—') referenced.add(cells[toIdx]);
  }

  const entityPrefix = entityId.split(':').slice(-1)[0];
  const out = [...lines];
  let inserted = 0;
  for (const stateName of referenced) {
    if (existing.has(stateName)) continue;
    const oldId = `${entityPrefix}:${kebabize(stateName)}`;
    const oldNode = old.nodesById.get(oldId);
    out.splice(lastDataIdx + 1 + inserted, 0, joinRow([
      stateName,
      oldNode?.description || '—',
      oldNode?.meta?.initial ? 'Yes' : 'No',
      oldNode?.meta?.terminal ? 'Yes' : 'No',
    ]));
    inserted++;
  }
  return out.join('\n');
};

// add missing attribute rows from reference-graph terms whose names
// aren't already in section 5
const enrichAttributesRows = (md, entityId, old) => {
  const lines = md.split('\n');
  const startIdx = lines.findIndex(l => /^## 5\. Key Attributes\s*$/.test(l));
  if (startIdx < 0) return md;
  let headerIdx = -1;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) break;
    if (lines[i].trim().startsWith('|') && !lines[i].trim().startsWith('| ---')) { headerIdx = i; break; }
  }
  if (headerIdx < 0) return md;

  // Normalize attribute names by kebab — matches the term-id naming
  // graph.js produces, so source MD's `autoRenew` and the reference graph's
  // `Auto Renew` collapse to the same key (`auto-renew`).
  const normalizeName = (s) => kebabize(String(s || '').replace(/[`*]/g, ''));

  const existingNames = new Set();
  let lastDataIdx = headerIdx + 1;
  for (let i = headerIdx + 2; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('|')) break;
    const cells = splitRow(lines[i]);
    existingNames.add(normalizeName(cells[0]));
    lastDataIdx = i;
  }

  // Match an old term to existing rows when (a) same kebab key,
  // (b) same id-suffix after stripping `-ref`/`-reference`, OR
  // (c) the existing row's tail matches the old term's full key —
  // handles dot-notation cases like `statistics.itemCount`
  // (`statistics-item-count`) collapsing onto old `Item Count`
  // (`item-count`).
  const matchesExisting = (oldKey, oldIdSuffix) => {
    if (existingNames.has(oldKey)) return true;
    if (existingNames.has(oldIdSuffix)) return true;
    for (const ex of existingNames) {
      if (ex === oldKey) return true;
      if (ex.endsWith('-' + oldKey)) return true;     // statistics-item-count vs item-count
      if (oldKey.endsWith('-' + ex)) return true;     // legacy long key vs short existing
    }
    return false;
  };

  const entityPrefix = entityId.split(':').slice(-1)[0];
  const out = [...lines];
  let inserted = 0;
  for (const [id, node] of old.nodesById) {
    if (node.type !== 'term') continue;
    if (!id.startsWith(entityPrefix + ':')) continue;
    const name = node.name || '';
    const key = normalizeName(name);
    const suffix = id.split(':').slice(-1)[0].replace(/-ref(erence)?$/, '');
    if (!key || matchesExisting(key, suffix)) continue;
    out.splice(lastDataIdx + 1 + inserted, 0, joinRow([
      name,
      node.meta?.type || '',
      node.description || '—',
      Array.isArray(node.meta?.setBy) ? node.meta.setBy.join(', ') : (node.meta?.setBy || ''),
      node.meta?.mutable || '',
      '—',
    ]));
    inserted++;
    existingNames.add(key);
  }
  return out.join('\n');
};

// ── Pipeline ────────────────────────────────────────────────────────

const FORMAT_NORMALIZERS = [
  ['dividers', normalizeDividers],
  ['rules-subsections', removeRulesSubsections],
  ['attribute-sub-fields', expandAttributeSubFields],
  ['identity-fields', fillIdentityFields],
  ['identity-reorder', reorderIdentityFields],
  ['table-headers', normalizeTableHeaders],
  ['empty-cells', fillEmptyTableCells],
  ['double-blanks', stripDoubleBlanks],
];
// Removed: stripPostHeadingBlockquotes — blockquotes are content (notes),
// not formatting; parse.js extracts them as `note` refs.
// Removed: ensureTablePresent — prose-instead-of-table is content;
// parse.js detects the case and captures the whole body as prose.

const align = (content, filename, old) => {
  for (const [, fn] of FORMAT_NORMALIZERS) content = fn(content, filename);
  const entityId = entityIdFromFile(filename);
  if (entityId) {
    content = expandCombinedTransitionRows(content);
    content = enrichTransitionsActions(content, entityId, old);
    content = enrichStatesRows(content, entityId, old);
    content = enrichAttributesRows(content, entityId, old);
    // Recovery emits new rows that may have empty cells; re-run the
    // sentinel + blank-line cleanup so the parser sees a clean form.
    content = fillEmptyTableCells(content);
    content = stripDoubleBlanks(content);
  }
  return content;
};

// ── Spin-out canon files for embedded sub-objects ───────────────────

// `## N.M <X> Attributes` describes a different object embedded in
// the parent's MD (e.g. PricingPolicy 5.1 Attachment Attributes).
// One file = one object — spin it out into a stub canon file.
// Returns { stripped: parent-without-section, spinOff: new-file-text,
// name: new-file-name }. Skeleton sections sit in the stub awaiting
// authoring.
const spinOffSubObjectFile = (md, parentFilename, parentEntityName, parentNamespace) => {
  const lines = md.split('\n');
  // Detect "## N.M <Name> Attributes" sub-section anywhere in the file.
  const subIdx = lines.findIndex(l => /^## \d+\.\d+\s+(.+?)\s+Attributes\s*$/.test(l));
  if (subIdx < 0) return { stripped: md, spinOff: null, name: null };
  const m = lines[subIdx].match(/^## \d+\.\d+\s+(.+?)\s+Attributes\s*$/);
  const subObjectName = m[1].trim();

  // Find end of sub-section: next `## ` heading that is not `## N.M`.
  let subEndIdx = lines.length;
  for (let i = subIdx + 1; i < lines.length; i++) {
    if (/^## (?!\d+\.\d)/.test(lines[i])) { subEndIdx = i; break; }
  }

  // Extract the attributes table from the sub-section.
  const subBlock = lines.slice(subIdx, subEndIdx);
  let tableHeaderIdx = -1;
  for (let i = 1; i < subBlock.length; i++) {
    if (subBlock[i].trim().startsWith('|') && !isDividerRow(subBlock[i])) { tableHeaderIdx = i; break; }
  }
  if (tableHeaderIdx < 0) return { stripped: md, spinOff: null, name: null };
  let tableEndIdx = tableHeaderIdx + 1;
  while (tableEndIdx < subBlock.length && subBlock[tableEndIdx].trim().startsWith('|')) tableEndIdx++;
  const headerRow = subBlock[tableHeaderIdx];
  const dataRows = subBlock.slice(tableHeaderIdx + 2, tableEndIdx);

  // Build the spin-off file. Filename derives from parent + sub-name:
  //   CANON_OBJECT_<Namespace>_<Parent>_<Sub>.md
  const baseFilename = parentFilename.replace(/\.md$/, '');
  const spinOffName = `${baseFilename}_${subObjectName.replace(/\s+/g, '')}.md`;

  // Pull header metadata from parent (version/owner/etc.) — best-effort.
  const headerSrc = lines.slice(0, lines.findIndex(l => /^## /.test(l)) + 1).join('\n');
  const versionLine = (headerSrc.match(/^> \*\*Version:\*\* .+$/m) || ['> **Version:** 0.1'])[0];
  const ownerLine   = (headerSrc.match(/^> \*\*Owner:\*\* .+$/m)   || ['> **Owner:** Auto'])[0];
  const dateLine    = (headerSrc.match(/^> \*\*Last Updated:\*\* .+$/m) || ['> **Last Updated:** unknown'])[0];

  const spinOff = [
    `# Object Canon: ${subObjectName}`,
    '',
    versionLine,
    ownerLine,
    dateLine,
    '> **Status:** Stub (spun off from ' + parentFilename + ')',
    '',
    '---',
    '',
    '## Platform Invariants',
    '',
    '**Platform Invariants:** See `PLATFORM_CANON_PREAMBLE.md`. All invariants apply to this object without exception.',
    '',
    '---',
    '',
    '## 1. Identity',
    '',
    `**Object Name:** ${subObjectName}`,
    '',
    `**Namespace:** ${parentNamespace}`,
    '',
    `**Parent Object:** ${parentNamespace}: ${parentEntityName}`,
    '',
    '**ID Prefix:** None.',
    '',
    '**Description:**',
    `Stub spun off from ${parentEntityName}'s embedded sub-object section. Full canonisation pending — see open questions.`,
    '',
    '**Also Known As:**',
    'None known.',
    '',
    '---',
    '',
    '## 2. Ownership & Visibility',
    '',
    '| Actor | Can Create | Can Read | Can Update | Can Delete | Notes |',
    '| --- | --- | --- | --- | --- | --- |',
    '| Vendor | — | — | — | — | Pending canonisation. |',
    '| Operations | — | — | — | — | Pending canonisation. |',
    '| Client | — | — | — | — | Pending canonisation. |',
    '',
    '---',
    '',
    '## 3. State Machine',
    '',
    '### 3.1 States',
    '',
    '| State | Description | Initial State? | Terminal State? |',
    '| --- | --- | --- | --- |',
    '',
    '### 3.2 Transitions',
    '',
    '| # | From State | To State | Action / Trigger | Permitted Actor(s) | Preconditions | Outcome / Side Effects |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '',
    '---',
    '',
    '## 4. Business Rules',
    '',
    '| Rule ID | Rule Statement | Applies In State(s) | Actor Scope | Notes |',
    '| --- | --- | --- | --- | --- |',
    '',
    '---',
    '',
    '## 5. Key Attributes',
    '',
    headerRow,
    '| ' + Array(splitRow(headerRow).length).fill('---').join(' | ') + ' |',
    ...dataRows,
    '',
    '---',
    '',
    '## 6. Relationships to Other Objects',
    '',
    '| Related Object | Relationship Type | Cardinality | Description | Lifecycle Dependency? |',
    '| --- | --- | --- | --- | --- |',
    `| ${parentNamespace}: ${parentEntityName} | Parent | Many:1 | A ${subObjectName} is owned by a ${parentEntityName}. | — |`,
    '',
    '---',
    '',
    '## 7. Lifecycle Events & Side Effects',
    '',
    '### 7.1 Internal Events',
    '',
    '| Event | Trigger | Permitted Actor(s) | Side Effect / Downstream Action |',
    '| --- | --- | --- | --- |',
    '',
    '### 7.2 Cross-Object State Effects',
    '',
    '| Triggering Event | Affected Object | Effect on Affected Object | Automated? | Condition | Notes |',
    '| --- | --- | --- | --- | --- | --- |',
    '',
    '---',
    '',
    '## 8. Reversibility & Data Retention',
    '',
    '**Reversible transitions:**',
    'Pending canonisation.',
    '',
    '**Deletion:**',
    'Pending canonisation.',
    '',
    '**Audit & history requirements:**',
    'Pending canonisation.',
    '',
    '---',
    '',
    '## 9. Failure Modes & Edge Cases',
    '',
    '| Scenario | Expected System Behavior | Actor Impacted | Risk Level | Notes |',
    '| --- | --- | --- | --- | --- |',
    '',
    '---',
    '',
    '## 10. Open Questions',
    '',
    `- [ ] [${subObjectName.toUpperCase().replace(/\s+/g, '')}-001]: Fill in remaining canonical sections (state machine, business rules, ownership, ...).`,
    '',
    '---',
    '',
    '## 11. Changelog',
    '',
    '| Version | Date | Author | Notes |',
    '| --- | --- | --- | --- |',
    '| 0.1 | auto | align.js | Stub spun off from ' + parentFilename + ' Section ' + lines[subIdx].match(/^## (\d+\.\d+)/)[1] + '. |',
    '',
  ].join('\n');

  // Strip the sub-section from the parent MD (keep everything before
  // and after).
  const stripped = [
    ...lines.slice(0, subIdx),
    ...lines.slice(subEndIdx),
  ].join('\n');

  return { stripped, spinOff, name: spinOffName };
};

// ── Run ─────────────────────────────────────────────────────────────

mkdirSync(DEST_DIR, { recursive: true });
const old = loadReferenceGraph();
const files = readdirSync(SOURCE_DIR).filter(name => name.endsWith('.md'));

const extractIdentityField = (content, fieldName) => {
  const re = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*([^\\n]+)`, 'i');
  const m = content.match(re);
  return m ? m[1].trim() : null;
};

let changed = 0;
let spunOff = 0;
for (const name of files) {
  const src = readFileSync(join(SOURCE_DIR, name), 'utf8');
  let aligned = align(src, name, old);

  // After alignment, look for any remaining `## N.M <X> Attributes`
  // sub-section and spin it off into its own canon file.
  const parentName = extractIdentityField(aligned, 'Object Name') || 'Unknown';
  const parentNs = extractIdentityField(aligned, 'Namespace')
    || NAMESPACE_FROM_FILENAME(name) || 'Catalog';
  const { stripped, spinOff, name: spinOffName } =
    spinOffSubObjectFile(aligned, name, parentName, parentNs);
  if (spinOff && spinOffName) {
    writeFileSync(join(DEST_DIR, spinOffName), align(spinOff, spinOffName, old));
    aligned = stripped;
    spunOff++;
  }

  writeFileSync(join(DEST_DIR, name), aligned);
  if (src !== aligned) changed++;
}
console.log(`Aligned ${files.length} files (${changed} changed, ${spunOff} sub-objects spun off).`);
