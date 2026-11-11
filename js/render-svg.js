import { state, getNode } from './state.js';
import { dom, SVGNS } from './dom.js';
import {
  isAcquirable, clampScale, visualRadius,
  hasActiveSearch, matchesSearch, getNodeDisplayLabel,
  FILL_ALPHA, DEFAULT_NODE_COLOR,
} from './utils.js';

function trimSegment(a, b) {
  const ra = visualRadius(a);
  const rb = visualRadius(b);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d <= 0) return null;
  if (d <= ra + rb) return null;
  const ux = dx / d;
  const uy = dy / d;
  return {
    x1: a.x + ux * ra,
    y1: a.y + uy * ra,
    x2: b.x - ux * rb,
    y2: b.y - uy * rb,
  };
}

function makeLine(x1, y1, x2, y2, cls) {
  const l = document.createElementNS(SVGNS, 'line');
  l.setAttribute('x1', x1); l.setAttribute('y1', y1);
  l.setAttribute('x2', x2); l.setAttribute('y2', y2);
  l.setAttribute('class', cls);
  return l;
}

export function renderEdges() {
  dom.edgesG.innerHTML = '';

  for (const link of state.links) {
    const a = getNode(link.a);
    const b = getNode(link.b);
    if (!a || !b) continue;
    const seg = trimSegment(a, b);
    if (!seg) continue;

    const hit = makeLine(seg.x1, seg.y1, seg.x2, seg.y2, 'link-hit');
    hit.dataset.linkId = link.id;
    dom.edgesG.appendChild(hit);

    const line = makeLine(seg.x1, seg.y1, seg.x2, seg.y2, 'link');
    if (state.mode === 'test' && state.acquired.has(link.a) && state.acquired.has(link.b)) {
      line.classList.add('link-active');
    }
    dom.edgesG.appendChild(line);
  }

  for (const n of state.nodes) {
    if (!n.parentId) continue;
    const p = getNode(n.parentId);
    if (!p) continue;
    const seg = trimSegment(p, n);
    if (!seg) continue;

    const line = makeLine(seg.x1, seg.y1, seg.x2, seg.y2, 'edge');
    if (state.mode === 'test' && state.acquired.has(n.id) && state.acquired.has(p.id)) {
      line.classList.add('edge-active');
    }
    dom.edgesG.appendChild(line);
  }
}

export function renderNodes() {
  dom.nodesG.innerHTML = '';
  const filterActive = hasActiveSearch();

  for (const n of state.nodes) {
    const s = clampScale(n.scale ?? 1);
    const color = n.color || DEFAULT_NODE_COLOR;

    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'node-g');
    g.dataset.id = n.id;
    g.setAttribute('transform', `translate(${n.x},${n.y}) scale(${s})`);

    const isTest   = state.mode === 'test';
    const isLinkingSource = state.mode === 'edit' && state.linking === n.id;
    const selected = state.selectedIds.has(n.id);
    const acquired = isTest && state.acquired.has(n.id);
    const available = isTest && !acquired && isAcquirable(n);
    const locked    = isTest && !acquired && !available;

    if (locked)    g.classList.add('node-locked');
    if (acquired)  g.classList.add('node-acquired');
    if (available) g.classList.add('node-available');

    if (filterActive && !matchesSearch(n)) {
      g.classList.add('node-dimmed');
    }

    if (state.mode === 'edit' && selected) {
      const halo = document.createElementNS(SVGNS, 'circle');
      halo.setAttribute('r', n.radius + 7);
      halo.setAttribute('fill', 'none');
      halo.setAttribute('stroke', '#4a7dff');
      halo.setAttribute('stroke-width', 2);
      halo.setAttribute('stroke-dasharray', '5 5');
      halo.setAttribute('opacity', 0.85);
      g.appendChild(halo);
    }

    if (isLinkingSource) {
      const halo = document.createElementNS(SVGNS, 'circle');
      halo.setAttribute('class', 'halo-linking');
      halo.setAttribute('r', n.radius + 10);
      halo.setAttribute('fill', 'none');
      halo.setAttribute('stroke', '#facc15');
      halo.setAttribute('stroke-width', 3);
      halo.setAttribute('stroke-dasharray', '6 5');
      g.appendChild(halo);
    }

    if (available) {
      const halo = document.createElementNS(SVGNS, 'circle');
      halo.setAttribute('class', 'halo-pulse');
      halo.setAttribute('r', n.radius + 6);
      halo.setAttribute('fill', 'none');
      halo.setAttribute('stroke', '#7effa0');
      halo.setAttribute('stroke-width', 2);
      halo.setAttribute('stroke-dasharray', '4 6');
      g.appendChild(halo);
    }

    if (acquired) {
      const glow = document.createElementNS(SVGNS, 'circle');
      glow.setAttribute('r', n.radius + 6);
      glow.setAttribute('fill', 'none');
      glow.setAttribute('stroke', '#7effa0');
      glow.setAttribute('stroke-width', 3);
      glow.setAttribute('opacity', 0.85);
      g.appendChild(glow);
    }

    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('r', n.radius);
    c.setAttribute('fill', color);
    c.setAttribute('fill-opacity', FILL_ALPHA);
    c.setAttribute('stroke', color);
    c.setAttribute('stroke-width', Math.max(0, n.strokeWidth ?? 4));
    g.appendChild(c);

    const labelText = getNodeDisplayLabel(n);
    if (labelText) {
      const fo = document.createElementNS(SVGNS, 'foreignObject');
      fo.setAttribute('x', -n.radius);
      fo.setAttribute('y', -n.radius);
      fo.setAttribute('width',  n.radius * 2);
      fo.setAttribute('height', n.radius * 2);
      fo.setAttribute('pointer-events', 'none');
      const div = document.createElement('div');
      div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      div.className = 'node-label';
      div.textContent = labelText;
      fo.appendChild(div);
      g.appendChild(fo);
    }

    dom.nodesG.appendChild(g);
  }
}

export function renderSVG() {
  dom.svg.classList.toggle('test-mode', state.mode === 'test');
  renderEdges();
  renderNodes();
}