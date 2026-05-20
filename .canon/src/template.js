// Tiny template matcher. DSL:
//   { foo }                  capture into object.foo
//   { foo.bar }              nested capture
//   { foo as name }          named capture (collected separately)
//   { #each x in xs } … { /each }   array iteration
//   { #annotate name }       slot marker (consumes whitespace)
// compile(tpl) → ast,  match(ast, input) → { ok, data, keys, captures, slots, error?, line? }

// ── compile ────────────────────────────────────────────────────────

const PLACEHOLDER_RE = /\{\s*([^{}]+?)\s*\}/g;

const parsePath = (expr) => {
  const parts = expr.split('.').map(s => s.trim());
  if (parts.some(p => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(p)))
    throw new Error(`Invalid path: "${expr}"`);
  return parts;
};

const AS_RE = /^(.+?)\s+as\s+([a-zA-Z_][a-zA-Z0-9_]*)$/;

const tokenize = (template) => {
  const tokens = [];
  let lastIndex = 0;
  PLACEHOLDER_RE.lastIndex = 0;
  let m;
  while ((m = PLACEHOLDER_RE.exec(template)) !== null) {
    const literal = template.slice(lastIndex, m.index);
    if (literal.length > 0) tokens.push({ type: 'literal', text: literal });

    const inner = m[1].trim();

    const eachStart = inner.match(/^#each\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+(.+)$/);
    if (eachStart) {
      tokens.push({
        type: 'each-start',
        itemName: eachStart[1],
        listPath: parsePath(eachStart[2]),
      });
      lastIndex = m.index + m[0].length;
      continue;
    }

    if (inner === '/each') {
      tokens.push({ type: 'each-end' });
      lastIndex = m.index + m[0].length;
      continue;
    }

    const annotateMatch = inner.match(/^#annotate\s+(\S+)$/);
    if (annotateMatch) {
      tokens.push({ type: 'annotate', keyName: annotateMatch[1].trim() });
      lastIndex = m.index + m[0].length;
      continue;
    }

    let pathExpr = inner;
    let keyName = null;
    const asMatch = inner.match(AS_RE);
    if (asMatch) {
      pathExpr = asMatch[1].trim();
      const token = asMatch[2];
      const path = parsePath(pathExpr);
      keyName = token === 'key' ? path.join('.') : token;
      tokens.push({ type: 'capture', path, keyName });
      lastIndex = m.index + m[0].length;
      continue;
    }
    tokens.push({ type: 'capture', path: parsePath(pathExpr), keyName: null });
    lastIndex = m.index + m[0].length;
  }
  const tail = template.slice(lastIndex);
  if (tail.length > 0) tokens.push({ type: 'literal', text: tail });
  return tokens;
};

const buildAst = (tokens) => {
  const root = [];
  const stack = [{ children: root, kind: 'root' }];

  for (const t of tokens) {
    const top = stack[stack.length - 1];
    if (t.type === 'each-start') {
      const block = {
        type: 'block',
        itemName: t.itemName,
        listPath: t.listPath,
        body: [],
      };
      top.children.push(block);
      stack.push({ children: block.body, kind: 'each', itemName: t.itemName });
      continue;
    }
    if (t.type === 'each-end') {
      if (top.kind !== 'each')
        throw new Error('Unexpected { /each } with no matching { #each }');
      stack.pop();
      continue;
    }
    top.children.push(t);
  }

  if (stack.length !== 1)
    throw new Error(`Unclosed { #each ${stack[stack.length - 1].itemName} in ... }`);

  return root;
};

const validate = (nodes) => {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.type === 'block') {
      const body = n.body;
      if (body.length === 0)
        throw new Error(`Empty { #each ${n.itemName} in ${n.listPath.join('.')} } body`);
      const last = body[body.length - 1];
      if (last.type !== 'literal' && last.type !== 'annotate')
        throw new Error(
          `Block { #each ${n.itemName} in ${n.listPath.join('.')} } body must end with `
          + 'literal text or { #annotate ... } (iteration boundary)'
        );
      if (body[0].type !== 'literal')
        throw new Error(
          `Block { #each ${n.itemName} in ${n.listPath.join('.')} } body must start with `
          + 'literal text (so the matcher can detect each new iteration)'
        );
      validate(body);
      continue;
    }
    if (n.type !== 'capture') continue;

    let nextIdx = i + 1;
    while (nextIdx < nodes.length && nodes[nextIdx].type === 'annotate') nextIdx++;
    const next = nodes[nextIdx];
    if (next && next.type === 'capture') {
      throw new Error(
        `Adjacent captures { ${n.path.join('.')} }{ ${next.path.join('.')} } `
        + 'have no literal boundary between them — ambiguous'
      );
    }
    if (next && next.type === 'block') {
      const first = next.body[0];
      if (first && first.type === 'capture') {
        throw new Error(
          `Capture { ${n.path.join('.')} } followed by block whose body starts `
          + `with capture { ${first.path.join('.')} } — no terminator`
        );
      }
    }
  }
};

const validateKeys = (ast) => {
  const seen = new Set();
  const collectGlobal = (nodes) => {
    for (const n of nodes) {
      if (n.type === 'capture' && n.keyName) {
        if (seen.has(n.keyName))
          throw new Error(`Duplicate \`as\` key name "${n.keyName}"`);
        seen.add(n.keyName);
      }
      if (n.type === 'block') collectGlobal(n.body);
    }
  };
  collectGlobal(ast);

  const checkScope = (nodes, ancestorKeys) => {
    const scopeKeys = new Set(ancestorKeys);
    for (const n of nodes) {
      if (n.type === 'capture' && n.keyName) scopeKeys.add(n.keyName);
    }
    for (const n of nodes) {
      if (n.type === 'annotate') {
        if (!scopeKeys.has(n.keyName))
          throw new Error(
            `{ #annotate ${n.keyName} } references no \`as\` key "${n.keyName}" in scope`
          );
      }
      if (n.type === 'block') checkScope(n.body, scopeKeys);
    }
  };
  checkScope(ast, new Set());
};

const directiveLine = (kind) => new RegExp(
  `(^|\\n)[ \\t]*(?:<!--[ \\t]*)?(\\{\\s*${kind}[^{}]*\\})(?:[ \\t]*-->)?[ \\t]*\\n`,
  'g',
);

const uncommentTags = (template) => template
  .replace(directiveLine('\\/each\\s*'), '$1$2')
  .replace(directiveLine('#each\\s+'), '$1$2')
  .replace(directiveLine('#annotate\\s+'), '$1$2');

const compile = (templateString) => {
  const tokens = tokenize(uncommentTags(templateString));
  const ast = buildAst(tokens);
  validate(ast);
  validateKeys(ast);
  return { ast };
};

// ── match ──────────────────────────────────────────────────────────

const isHorizontalWs = (c) => c === ' ' || c === '\t';
const countNewlines = (s) => (s.match(/\n/g) || []).length;

const matchLiteral = (text, input, pos) => {
  let ti = 0, ii = pos;
  while (ti < text.length) {
    if (/\s/.test(text[ti])) {
      const tStart = ti;
      while (ti < text.length && /\s/.test(text[ti])) ti++;
      const requiredNL = countNewlines(text.slice(tStart, ti));

      if (requiredNL > 0) {
        let nl = 0;
        while (ii < input.length && /\s/.test(input[ii])) {
          if (input[ii] === '\n') {
            nl++;
            ii++;
            if (nl >= requiredNL) break;
          } else {
            ii++;
          }
        }
        if (nl < requiredNL) return null;
      } else {
        const iStart = ii;
        while (ii < input.length && isHorizontalWs(input[ii])) ii++;
        if (ii === iStart) return null;
      }
      continue;
    }
    if (ii >= input.length) return null;
    if (text[ti] !== input[ii]) return null;
    ti++; ii++;
  }
  return ii;
};

const findLiteralAt = (text, input, pos) => {
  for (let i = pos; i <= input.length; i++) {
    const end = matchLiteral(text, input, i);
    if (end !== null) return { start: i, end };
  }
  return null;
};

const writePath = (target, path, value) => {
  let obj = target;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (obj[key] == null || typeof obj[key] !== 'object') obj[key] = {};
    obj = obj[key];
  }
  obj[path[path.length - 1]] = value;
};

const destinationFor = (path, data, bind) => {
  if (bind && path[0] === bind.name) {
    return { root: bind.root, rest: path.slice(1) };
  }
  return { root: data, rest: path };
};

const terminatorAfter = (nodes, i) => {
  for (let j = i + 1; j < nodes.length; j++) {
    const n = nodes[j];
    if (n.type === 'annotate') continue;
    if (n.type === 'literal') return n.text;
    if (n.type === 'block') {
      const first = n.body[0];
      if (first && first.type === 'literal') return first.text;
      return null;
    }
  }
  return null;
};

const lineAt = (input, pos) => {
  let line = 1;
  const stop = Math.min(pos, input.length);
  for (let i = 0; i < stop; i++) {
    if (input[i] === '\n') line++;
  }
  return line;
};

const matchNodes = (nodes, input, pos, data, bind, keys, captures, slots) => {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (node.type === 'literal') {
      const hit = findLiteralAt(node.text, input, pos);
      if (!hit) return { error: `literal not found: ${JSON.stringify(truncate(node.text))}`, pos };
      if (!isWhitespaceOnly(input.slice(pos, hit.start)))
        return { error: `unexpected text before literal ${JSON.stringify(truncate(node.text))}`, pos };
      pos = hit.end;
      continue;
    }

    if (node.type === 'annotate') {
      const slotStart = pos;
      while (pos < input.length && /\s/.test(input[pos])) pos++;
      slots.push({ name: node.keyName, line: lineAt(input, slotStart) });
      continue;
    }

    if (node.type === 'capture') {
      const captureStart = pos;
      const term = terminatorAfter(nodes, i);
      let captured;
      if (term === null) {
        captured = input.slice(pos).replace(/\s+$/, '').replace(/^\s+/, '');
        pos = input.length;
      } else {
        const hit = findLiteralAt(term, input, pos);
        if (!hit) return {
          error: `terminator not found after capture ${node.path.join('.')}`,
          pos: captureStart,
        };
        captured = input.slice(pos, hit.start).replace(/\s+$/, '').replace(/^\s+/, '');
        pos = hit.start;
      }
      const { root, rest } = destinationFor(node.path, data, bind);
      writePath(root, rest, captured);
      const lead = input.slice(captureStart, pos).match(/^\s*/)[0];
      const valueStart = captureStart + lead.length;
      const line = lineAt(input, valueStart);
      captures.push({ path: node.path, value: captured, line });
      if (node.keyName) {
        keys.push({ name: node.keyName, path: node.path, value: captured, line });
      }
      continue;
    }

    if (node.type === 'block') {
      const list = [];
      while (true) {
        const saved = pos;
        const savedKeysLen = keys.length;
        const savedCapturesLen = captures.length;
        const savedSlotsLen = slots.length;
        const item = {};
        const bindChild = { name: node.itemName, root: item };
        const result = matchNodes(node.body, input, pos, item, bindChild, keys, captures, slots);
        if (typeof result === 'object') {
          pos = saved;
          keys.length = savedKeysLen;
          captures.length = savedCapturesLen;
          slots.length = savedSlotsLen;
          break;
        }
        if (result === saved) {
          pos = saved;
          keys.length = savedKeysLen;
          captures.length = savedCapturesLen;
          slots.length = savedSlotsLen;
          break;
        }
        pos = result;
        list.push(item);
      }
      const { root, rest } = destinationFor(node.listPath, data, bind);
      writePath(root, rest, list);
      continue;
    }
  }
  return pos;
};

const isWhitespaceOnly = (s) => /^\s*$/.test(s);
const truncate = (s) => s.length > 30 ? s.slice(0, 27) + '...' : s;

const match = (compiled, input) => {
  const data = {};
  const keys = [];
  const captures = [];
  const slots = [];
  const text = String(input);
  const result = matchNodes(compiled.ast, text, 0, data, null, keys, captures, slots);
  if (typeof result === 'object') {
    return {
      ok: false,
      error: result.error,
      line: lineAt(text, result.pos),
      keys,
      captures,
      slots,
    };
  }

  return { ok: true, data, keys, captures, slots };
};

export { compile, match };
