// MD → per-section data + prose. Errors are non-fatal — a section that
// fails to match is recorded and the rest still parses.
//
// Three document kinds: `object`, `concept` and `implementation`. A
// concept document is a
// PARTIAL of the object one — it uses only section numbers the object
// template already defines, and means by them what the object means.
// Sections 2, 3, 6 and 8 are absent because they presume the platform
// owns the subject. That is why the numbering has gaps: they are the
// shape of what a concept is not.
//
// Only §1 and §5 need their own template. §5 keeps its slot — what the
// subject exposes — but a concept exposes introduced entities rather
// than fields, so the columns that presume ownership ("Set By",
// "Mutable After Creation?") are gone. §4, §7 and §9–11 are the object
// templates verbatim, parsed by the object emitters.
//
// An implementation document is the concept shape again, with one
// column added to §4 and §5: `Implements`, naming the element of the
// abstraction that the row binds. Nothing else differs, because an
// implementation is not a different sort of thing from a concept — it
// is a concept that has stopped being general.
//
// The kind comes from the document's own first line — `# Object
// Canon:`, `# Concept Canon:` or `# Implementation Canon:` — not from
// the directory it was loaded from. A file that is moved does not
// change meaning, and a file with no banner fails loudly instead of
// being guessed at.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compile, match } from './template.js';
import { loadMdSet } from './load.js';

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(here, '..', 'templates');

// ── templates compiled at load ─────────────────────────────────────

const TEMPLATE_FILES = {
  concept_header: 'concept-header.md',
  concept_identity: 'concept-identity.md',
  concept_key_concepts: 'concept-key-concepts.md',
  implementation_header: 'implementation-header.md',
  implementation_identity: 'implementation-identity.md',
  implementation_key_concepts: 'implementation-key-concepts.md',
  implementation_business_rules: 'implementation-business-rules.md',
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

const TEMPLATES = Object.fromEntries(
  Object.entries(TEMPLATE_FILES).map(([key, file]) => [
    key,
    compile(readFileSync(join(TEMPLATES_DIR, file), 'utf8')),
  ])
);

// ── slicing ────────────────────────────────────────────────────────

const SECTION_DISPATCH = [
  [/^## 1\. Identity\s*$/, 'identity'],
  [/^## 2\. Ownership & Visibility\s*$/, 'ownership'],
  [/^### 3\.1 States\s*$/, 'states'],
  [/^### 3\.2 Transitions\s*$/, 'transitions'],
  [/^### 3\.3 State Diagram\s*$/, '_skip'],
  [/^## 4\. Business Rules\s*$/, 'business_rules'],
  [/^## 5\. Key Attributes\s*$/, 'attributes'],
  [/^## 6\. Relationships to Other Objects\s*$/, 'relationships'],
  [/^### 7\.1 Internal Events\s*$/, 'internal_events'],
  [/^### 7\.2 Cross-Object State Effects\s*$/, 'cross_effects'],
  [/^## 8\. Reversibility & Data Retention\s*$/, 'reversibility'],
  [/^## 9\. Failure Modes & Edge Cases\s*$/, 'failure_modes'],
  [/^## 10\. Open Questions\s*$/, 'open_questions'],
  [/^## 11\. Changelog\s*$/, '_skip'],
  [/^## 3\. State Machine\s*$/, '_container'],
  [/^## 7\. Lifecycle Events & Side Effects\s*$/, '_container'],
  [/^## Platform Invariants\s*$/, '_skip'],
];

// A concept keeps the object's section numbers and, wherever the shape
// is genuinely the same, the object's templates and emitters too.
// Business Rules needs no variant: the object template already tells a
// stateless subject to write `N/A` in "Applies In State(s)". §7 needs
// none either — a concept has an inside, it is simply one canon does
// not claim to know in full, so 7.1 records the significant part it
// does know and 7.2 what that causes in the domain, exactly as for an
// object.
const CONCEPT_SECTION_DISPATCH = [
  [/^## 1\. Identity\s*$/, 'concept_identity'],
  [/^## 4\. Business Rules\s*$/, 'business_rules'],
  [/^## 5\. Key Concepts\s*$/, 'concept_key_concepts'],
  [/^### 7\.1 Internal Events\s*$/, 'internal_events'],
  [/^### 7\.2 Cross-Object State Effects\s*$/, 'cross_effects'],
  [/^## 7\. Lifecycle Events & Side Effects\s*$/, '_container'],
  [/^## 9\. Failure Modes & Edge Cases\s*$/, 'failure_modes'],
  [/^## 10\. Open Questions\s*$/, 'open_questions'],
  [/^## 11\. Changelog\s*$/, '_skip'],
  [/^## Platform Invariants\s*$/, '_skip'],
];

// An implementation is a concept with bindings, so it borrows the
// concept's dispatch wholesale and overrides only the two sections
// that gained an `Implements` column.
const IMPLEMENTATION_SECTION_DISPATCH = [
  [/^## 1\. Identity\s*$/, 'implementation_identity'],
  [/^## 4\. Business Rules\s*$/, 'implementation_business_rules'],
  [/^## 5\. Key Concepts\s*$/, 'implementation_key_concepts'],
  ...CONCEPT_SECTION_DISPATCH.filter(([re]) =>
    !['## 1. Identity', '## 4. Business Rules', '## 5. Key Concepts'].some(h => re.test(h))),
];

const KINDS = {
  object:         { banner: /^#\s+Object Canon:/,         header: 'header',                sections: SECTION_DISPATCH },
  concept:        { banner: /^#\s+Concept Canon:/,        header: 'concept_header',        sections: CONCEPT_SECTION_DISPATCH },
  implementation: { banner: /^#\s+Implementation Canon:/, header: 'implementation_header', sections: IMPLEMENTATION_SECTION_DISPATCH },
};

// The banner is the authority on what a document is.
const detectKind = (content) => {
  const first = String(content || '').split('\n').find(l => l.trim() !== '') || '';
  for (const [kind, spec] of Object.entries(KINDS)) {
    if (spec.banner.test(first)) return kind;
  }
  return null;
};

const dispatchSection = (heading, table = SECTION_DISPATCH) => {
  for (const [re, key] of table) if (re.test(heading)) return key;
  return null;
};

const SECTION_HEADER_RE = /^(## |### )/;

// A section runs from its heading to the next one, which sweeps up the
// `---` rule that separates them. That rule is document formatting, not
// anyone's content, and leaving it in the body is what made a capture
// at the end of a template swallow it. Dropped here, once, so every
// section sees a body that ends where its content ends.
// Strips the whole trailing run, not one rule: three files in the
// corpus carry a doubled `---`, and a parser that removed only the last
// one would hand the other to whichever field ends the section.
//
// The single trailing newline is kept: a table row is anchored by the
// line break after it, and a body that ends flush against its last row
// loses that row.
const dropTrailingSeparator = (body) => {
  const lines = body.split('\n');
  let end = lines.length;
  const dropBlanks = () => { while (end > 0 && lines[end - 1].trim() === '') end--; };
  dropBlanks();
  while (end > 0 && lines[end - 1].trim() === '---') {
    end--;
    dropBlanks();
  }
  return lines.slice(0, end).join('\n') + '\n';
};

const sliceSections = (content, table = SECTION_DISPATCH) => {
  const lines = content.split('\n');
  const sections = [];
  const unknown = [];
  let headEnd = lines.length;
  let current = null;

  const flush = (endLine) => {
    if (!current) return;
    current.body = dropTrailingSeparator(
      lines.slice(current.startLine - 1, endLine).join('\n'));
    sections.push(current);
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!SECTION_HEADER_RE.test(line)) continue;

    const isLevel2 = line.startsWith('## ');
    const key = dispatchSection(line, table);

    if (isLevel2) {
      if (headEnd === lines.length) headEnd = i;
      flush(i);
      if (key === '_skip') {
        current = null;
        continue;
      }
      if (key === '_container') {
        // body between container heading and first sub-heading is
        // prose worth keeping (e.g. "no state machine" objects)
        const slug = line.replace(/^## \d+\.\s*/, '').toLowerCase()
          .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        current = { key: `_container:${slug}`, heading: line, body: '', startLine: i + 1 };
        continue;
      }
      if (!key) {
        unknown.push({ heading: line, line: i + 1 });
        continue;
      }
      current = { key, heading: line, body: '', startLine: i + 1 };
      continue;
    }

    if (key === '_skip') {
      flush(i);
      current = null;
      continue;
    }
    if (!key) {
      if (/^### \d+\.\d+\s/.test(line)) {
        unknown.push({ heading: line, line: i + 1 });
      }
      continue;
    }
    flush(i);
    current = { key, heading: line, body: '', startLine: i + 1 };
  }
  flush(lines.length);

  const head = dropTrailingSeparator(lines.slice(0, headEnd).join('\n'));
  return { head, sections, unknown };
};

// ── prose ──────────────────────────────────────────────────────────

// these keys treat their entire body as data (template captures the
// prose), so we don't fold the body into notes — only blockquotes.
const PROSE_AS_DATA_KEYS = new Set([
  'identity', 'concept_identity', 'implementation_identity',
  'reversibility', 'open_questions',
]);

const extractProse = (body, sectionKey) => {
  const lines = body.split('\n');
  const prose = [];
  const kept = [];
  let i = 0;
  while (i < lines.length) {
    if (/^>(\s|$)/.test(lines[i])) {
      const startLine = i;
      const collected = [];
      while (i < lines.length && /^>(\s|$)/.test(lines[i])) {
        collected.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      const text = collected.join('\n').trim();
      if (text) prose.push({ text, line: startLine + 1 });
    } else {
      kept.push(lines[i]);
      i++;
    }
  }
  // matcher needs blank-line counts intact, so collapse runs left
  // behind by stripped blockquotes
  const collapsed = kept.reduce((acc, l) => {
    if (l.trim() === '' && acc.length > 0 && acc[acc.length - 1].trim() === '') return acc;
    acc.push(l);
    return acc;
  }, []);
  let strippedBody = collapsed.join('\n');

  const hasTable = strippedBody.split('\n').some(l => l.trim().startsWith('|'));
  if (!hasTable && !PROSE_AS_DATA_KEYS.has(sectionKey)) {
    const rest = strippedBody.split('\n').filter((l, idx) => {
      if (idx === 0) return false;
      if (l.trim() === '---') return false;
      return true;
    }).join('\n').trim();

    if (rest) {
      prose.push({ text: rest, line: 2 });
      strippedBody = strippedBody.split('\n')[0];
    }
  }

  return { strippedBody, prose };
};

// ── per-file ───────────────────────────────────────────────────────

const parseSections = (content, fileLabel = '<input>', kind = null) => {
  const resolved = kind || detectKind(content);
  if (!resolved) {
    return {
      data: {}, prose: {},
      errors: [{
        file: fileLabel, section: 'banner', line: 1,
        error: 'document opens with none of '
             + Object.keys(KINDS).map(k => `"# ${k[0].toUpperCase()}${k.slice(1)} Canon:"`).join(', ')
             + ' — the first line is what declares which kind it is',
      }],
    };
  }
  const spec = KINDS[resolved];
  if (!spec) throw new TypeError(`parseSections: unknown document kind "${resolved}"`);

  const { head, sections, unknown } = sliceSections(content, spec.sections);
  const data = { _kind: resolved };
  const prose = {};        // { sectionKey: [{ text, line }, ...] }
  const errors = [];

  const headResult = match(TEMPLATES[spec.header], head);
  if (headResult.ok) {
    data[spec.header] = headResult.data;
  } else {
    errors.push({
      file: fileLabel,
      section: spec.header,
      line: headResult.line,
      error: headResult.error,
    });
  }

  for (const sec of sections) {
    // containers carry only prose
    if (sec.key.startsWith('_container:')) {
      const containerKey = sec.key.slice('_container:'.length);
      const { prose: containerProse } = extractProse(sec.body, containerKey);
      const bodyLines = sec.body.split('\n').slice(1).map(l => l.trim()).filter(Boolean);
      const bodyText = bodyLines
        .filter(l => l !== '---' && !/^>(\s|$)/.test(l) && !/^#{2,3}\s/.test(l))
        .join('\n').trim();

      if (bodyText && !containerProse.some(p => p.text === bodyText)) {
        containerProse.push({ text: bodyText, line: 2 });
      }
      if (containerProse.length > 0) {
        prose[containerKey] = containerProse.map(p => ({
          text: p.text,
          line: sec.startLine + p.line - 1,
        }));
      }
      continue;
    }

    const tpl = TEMPLATES[sec.key];
    if (!tpl) {
      errors.push({
        file: fileLabel,
        section: sec.key,
        line: sec.startLine,
        error: `no template registered for section key "${sec.key}"`,
      });
      continue;
    }
    const { strippedBody, prose: sectionProse } = extractProse(sec.body, sec.key);
    if (sectionProse.length > 0) {
      prose[sec.key] = sectionProse.map(p => ({
        text: p.text,
        line: sec.startLine + p.line - 1,
      }));
    }
    const r = match(tpl, strippedBody);
    if (r.ok) {
      data[sec.key] = r.data;
      continue;
    }

    // body got reduced to prose-only — empty template won't match
    // and that's fine, prose is already captured
    const hasTable = strippedBody.split('\n').some(l => l.trim().startsWith('|'));
    if (hasTable) {
      errors.push({
        file: fileLabel,
        section: sec.key,
        line: sec.startLine + (r.line - 1),
        error: r.error,
      });
    }
  }

  for (const u of unknown) {
    errors.push({
      file: fileLabel,
      section: 'unknown',
      line: u.line,
      error: `unrecognised section heading: ${JSON.stringify(u.heading)}`,
    });
  }

  return { data, prose, errors };
};

// ── repo ───────────────────────────────────────────────────────────

// Where canon markdown is loaded from. The directory decides nothing
// about a file's kind — it only says where to look, and it is recorded
// on each parsed file so a caller can find the source again.
const CORPUS_DIRS = ['objects', 'concepts', 'implementations'];

// A filename says CANON_OBJECT_, CANON_CONCEPT_ or
// CANON_IMPLEMENTATION_; the banner says the same thing in prose. They
// are two independent statements of one fact, so a disagreement is a
// real defect: id derivation goes by filename, parsing by banner, and
// the file would otherwise be parsed correctly and then silently
// dropped for want of an id.
const FILENAME_KIND = [
  [/^CANON_OBJECT_/, 'object'],
  [/^CANON_CONCEPT_/, 'concept'],
  [/^CANON_IMPLEMENTATION_/, 'implementation'],
];

const kindFromFilename = (relPath) => {
  for (const [re, kind] of FILENAME_KIND) if (re.test(relPath)) return kind;
  return null;
};

const parseFile = (dir, { relPath, source, content }) => {
  const banner = detectKind(content);
  const named = kindFromFilename(relPath);
  const parsed = parseSections(content, relPath, banner || undefined);

  if (banner && named && banner !== named) {
    parsed.errors.push({
      file: relPath, section: 'banner', line: 1,
      error: `filename declares a ${named} document but the banner declares a ${banner} one`,
    });
  }
  return { relPath, dir, source, kind: banner, ...parsed };
};

const parseRepo = (repoRoot, options = {}) => ({
  files: CORPUS_DIRS.flatMap(dir =>
    loadMdSet(repoRoot, dir, options).map(entry => parseFile(dir, entry))),
});

export {
  parseSections, sliceSections, parseRepo, parseFile, extractProse,
  detectKind, TEMPLATES, CORPUS_DIRS,
};
