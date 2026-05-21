// MD → per-section data + prose. Errors are non-fatal — a section that
// fails to match is recorded and the rest still parses.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compile, match } from './template.js';
import { loadMdSet } from './load.js';

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(here, '..', 'templates');

// ── templates compiled at load ─────────────────────────────────────

const TEMPLATE_FILES = {
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

const dispatchSection = (heading) => {
  for (const [re, key] of SECTION_DISPATCH) if (re.test(heading)) return key;
  return null;
};

const SECTION_HEADER_RE = /^(## |### )/;

const sliceSections = (content) => {
  const lines = content.split('\n');
  const sections = [];
  const unknown = [];
  let headEnd = lines.length;
  let current = null;

  const flush = (endLine) => {
    if (!current) return;
    current.body = lines.slice(current.startLine - 1, endLine).join('\n');
    sections.push(current);
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!SECTION_HEADER_RE.test(line)) continue;

    const isLevel2 = line.startsWith('## ');
    const key = dispatchSection(line);

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

  const head = lines.slice(0, headEnd).join('\n');
  return { head, sections, unknown };
};

// ── prose ──────────────────────────────────────────────────────────

// these keys treat their entire body as data (template captures the
// prose), so we don't fold the body into notes — only blockquotes.
const PROSE_AS_DATA_KEYS = new Set(['identity', 'reversibility', 'open_questions']);

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

const parseSections = (content, fileLabel = '<input>') => {
  const { head, sections, unknown } = sliceSections(content);
  const data = {};
  const prose = {};        // { sectionKey: [{ text, line }, ...] }
  const errors = [];

  const headResult = match(TEMPLATES.header, head);
  if (headResult.ok) {
    data.header = headResult.data;
  } else {
    errors.push({
      file: fileLabel,
      section: 'header',
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

const parseRepo = (repoRoot, options = {}) => ({
  files: loadMdSet(repoRoot, 'objects', options).map(({ relPath, source, content }) => ({
    relPath, source, ...parseSections(content, relPath),
  })),
});

export { parseSections, sliceSections, parseRepo, extractProse, TEMPLATES };
