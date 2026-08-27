// Read-only MCP server. Tools wrap kb.js queries — no write surface.
// Graph loaded once at startup; restart picks up MD changes.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { discover as ragDiscover, buildIndex } from '../rag/bootstrap.js';

const tools = (kb, repoRoot) => ({
  overview: {
    description: 'List every Canon entity, Concept and Implementation with type, namespace, child counts by type, and ref counts. Start here to see the full domain at a glance. A Concept is something outside the platform that the domain nonetheless contacts (an integration, an external system): canon records the surface it presents and nothing behind it, so it has no namespace and no state machine and those come back null/false. An Implementation is one named realisation of a Concept or object — it binds that abstraction\'s elements to concrete values and may add its own; what it does not bind is unbound, and canon does not distinguish "not implemented" from "not recorded".',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => kb.overview(),
  },

  get: {
    description: 'Get a node by id with its parent (if any), direct children, and ref counts.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Node id, e.g. marketplace:webhook or webhook:enabled' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: ({ id }) => {
      const node = kb.get(id);
      if (!node) return { error: `node not found: ${id}` };
      const parent = kb.parent(id);
      const children = kb.children(id);
      return {
        ...node,
        parent: parent ? { id: parent.id, type: parent.type, name: parent.name } : null,
        children: children.map(c => ({ id: c.id, type: c.type, name: c.name })),
        refs: { outgoing: kb.from(id).length, incoming: kb.to(id).length },
      };
    },
  },

  find: {
    description: 'Substring search over node id, name, aliases, description, meta. Returns ranked hits with score. Use to locate entities/states/terms by partial token. For semantic concept lookup ("what relates to billing"), use describe on candidates instead.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'One or more space-separated tokens.' },
        limit: { type: 'number', description: 'Max hits to return (default 50).' },
        node: { type: 'array', items: { type: 'string' }, description: 'Filter to these node types (entity, state, transition, action, term, domain).' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    handler: ({ query, limit, node }) => kb.find(query, { limit, node }),
  },

  reveal: {
    description: 'Refs originating FROM this node (what this node asserts about others) plus immediate neighbors. Use to read out everything Canon says when scoped to one node. Optional `depth` walks transitively.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        depth: { type: 'number', description: 'Transitive expansion depth (default 0).' },
        ref: { type: 'array', items: { type: 'string' }, description: 'Filter to these ref types.' },
        role: { type: 'array', items: { type: 'string' }, description: 'Filter to refs that have a pointer with one of these roles.' },
        node: { type: 'array', items: { type: 'string' }, description: 'Filter refs whose owner or any pointer target matches one of these node types.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: ({ id, depth, ref, role, node }) => kb.reveal(id, { depth, ref, role, node }),
  },

  impact: {
    description: 'Refs pointing AT this node (what other nodes assert about this one). Inverse of reveal. Use to ask "what depends on / mentions / is affected by X".',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        depth: { type: 'number' },
        ref: { type: 'array', items: { type: 'string' } },
        role: { type: 'array', items: { type: 'string' } },
        node: { type: 'array', items: { type: 'string' } },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: ({ id, depth, ref, role, node }) => kb.impact(id, { depth, ref, role, node }),
  },

  paths: {
    description: 'Shortest undirected paths between two nodes through any refs. Useful for "how is A connected to B" questions. Returns up to `limit` paths within `depth` hops.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string' },
        target: { type: 'string' },
        depth: { type: 'number', description: 'Max path length (default 4).' },
        limit: { type: 'number', description: 'Max paths to return (default 8).' },
        ref: { type: 'array', items: { type: 'string' }, description: 'Restrict traversal to these ref types.' },
      },
      required: ['source', 'target'],
      additionalProperties: false,
    },
    handler: ({ source, target, depth, limit, ref }) => kb.paths(source, target, { depth, limit, ref }),
  },

  discover: {
    description: 'Concept-to-prose semantic search over the Canon source MDs. Use when the user asks about a concept that may not be a discrete entity name — "billing cadence", "soft delete behaviour", "permission inheritance". Returns ranked snippets with file + line range. For entity/term lookups by name token, prefer `find` (faster, no embedding).',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          oneOf: [
            { type: 'string' },
            { type: 'array', items: { type: 'string' } },
          ],
          description: 'Single concept string, or array of synonyms (centroid embedding for cleaner signal on ambiguous concepts).',
        },
        limit: { type: 'number', description: 'Max snippets (default 10).' },
        precision: { type: 'number', description: 'Cosine threshold in [-1, 1]. Default 0 (no filter, return ranked top-N). Use 0.4-0.5 to require strong signal.' },
        stats: { type: 'boolean', description: 'If true, return only score distribution (no snippets). Use to calibrate precision before a real call.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    handler: async ({ query, limit, precision, stats }) => {
      try {
        return await ragDiscover(repoRoot, query, { limit, precision, stats });
      } catch (e) {
        return { error: e.message, hint: 'If transformers is not installed, run: canon reindex (or install @huggingface/transformers + onnxruntime-web).' };
      }
    },
  },

  reindex: {
    description: 'Rebuild the RAG index from current source MDs. Slow first run (downloads ~22 MB model on cold cache, embeds ~100-300 chunks). Subsequent calls reuse cached model. Run after substantial MD edits.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => {
      try {
        const index = await buildIndex(repoRoot);
        return { reindexed: true, chunks: index.length };
      } catch (e) {
        return { error: e.message };
      }
    },
  },

  describe: {
    description: 'Full graph slice for one entity: the entity node + every descendant (states/transitions/actions/terms) + every ref owned by them. Use when the user wants comprehensive detail on a single domain object.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Entity id, e.g. marketplace:webhook.' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: ({ id }) => {
      const entity = kb.get(id);
      if (!entity) return { error: `not found: ${id}` };
      const prefix = id.split(':').slice(-1)[0];
      const all = kb.list().filter(n => n.id === id || n.id.startsWith(prefix + ':'));
      const ownedRefs = all.flatMap(n => kb.from(n.id));
      return {
        entity: id,
        nodes: all,
        refs: ownedRefs,
      };
    },
  },
});

const createReadServer = (kb, { name = 'canon-read', version = '0.1.0', repoRoot = '.' } = {}) => {
  const server = new Server({ name, version }, { capabilities: { tools: {} } });
  const tbl = tools(kb, repoRoot);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Object.entries(tbl).map(([name, t]) => ({
      name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    const t = tbl[name];
    if (!t) {
      return { content: [{ type: 'text', text: `unknown tool: ${name}` }], isError: true };
    }
    try {
      const result = await t.handler(args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `error: ${e.message}` }], isError: true };
    }
  });

  return server;
};

export { createReadServer, tools };
