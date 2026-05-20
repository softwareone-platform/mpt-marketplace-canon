import { buildFlatGraph } from './cards';
import { renderStats } from './legend';
import { renderGraph } from './render';
import type { IGraphData } from './types';

const container = document.querySelector<HTMLDivElement>('#app');
if (!container) throw new Error('missing #app container');

const res = await fetch('/graph.json');
if (!res.ok) throw new Error(`failed to load /graph.json: ${res.status}`);

const data = (await res.json()) as IGraphData;
const { nodes, edges } = buildFlatGraph(data);

renderGraph(container, { nodes, edges });
renderStats({ cards: nodes.length, links: edges.length });
