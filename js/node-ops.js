import { state, uid, getNode, childrenOf } from './state.js';
import { hasLink, neighborsOf } from './utils.js';

export function addChild(parent) {
  const c = state.config;
  const children = childrenOf(parent.id);

  let baseAngle;
  if (parent.parentId) {
    const gp = getNode(parent.parentId);
    baseAngle = Math.atan2(parent.y - gp.y, parent.x - gp.x);
  } else {
    baseAngle = -Math.PI / 2;
  }

  const idx = children.length;
  const angleStep = c.childAngleStepDeg * Math.PI / 180;
  let offset = 0;
  if (idx > 0) {
    const sign = idx % 2 === 1 ? 1 : -1;
    const step = Math.ceil(idx / 2);
    offset = sign * step * angleStep;
  }

  const angle = baseAngle + offset;
  const parentVisual = (parent.radius || 45) * (parent.scale ?? 1);
  const dist = Math.max(c.childDistance, parentVisual + 100);

  const child = {
    id: uid(),
    x: parent.x + Math.cos(angle) * dist,
    y: parent.y + Math.sin(angle) * dist,
    title: '',
    description: '',
    color: c.newNodeColor,
    strokeWidth: c.newNodeStrokeWidth,
    radius: c.newNodeRadius,
    scale: c.newNodeScale,
    parentId: parent.id,
    stats: [],
    effects: [],
    tags: [],
  };
  state.nodes.push(child);
  state.selectedIds = new Set([child.id]);
  return child;
}

export function duplicateNodes(ids) {
  const c = state.config;
  const created = [];

  for (const id of ids) {
    const n = getNode(id);
    if (!n) continue;

    const children = childrenOf(n.id);

    let baseAngle;
    if (n.parentId) {
      const gp = getNode(n.parentId);
      if (gp) baseAngle = Math.atan2(n.y - gp.y, n.x - gp.x);
      else baseAngle = -Math.PI / 2;
    } else {
      baseAngle = -Math.PI / 2;
    }

    const idx = children.length;
    const angleStep = c.childAngleStepDeg * Math.PI / 180;
    let offset = 0;
    if (idx > 0) {
      const sign = idx % 2 === 1 ? 1 : -1;
      const step = Math.ceil(idx / 2);
      offset = sign * step * angleStep;
    }

    const angle = baseAngle + offset;
    const parentVisual = (n.radius || 45) * (n.scale ?? 1);
    const dist = Math.max(c.childDistance, parentVisual + 100);

    const copy = {
      id: uid(),
      x: n.x + Math.cos(angle) * dist,
      y: n.y + Math.sin(angle) * dist,
      title: n.title || '',
      description: n.description || '',
      color: n.color || c.newNodeColor,
      strokeWidth: n.strokeWidth ?? c.newNodeStrokeWidth,
      radius: n.radius || c.newNodeRadius,
      scale: n.scale ?? c.newNodeScale,
      parentId: n.id,
      tags: Array.isArray(n.tags) ? [...n.tags] : [],
      stats: Array.isArray(n.stats)
        ? n.stats.map(s => ({ statId: s.statId, type: s.type || 'flat', value: s.value }))
        : [],
      effects: Array.isArray(n.effects)
        ? n.effects.map(e => ({ ...e, id: uid() }))
        : [],
    };
    state.nodes.push(copy);
    created.push(copy);
  }

  if (created.length) {
    state.selectedIds = new Set(created.map(n => n.id));
    state.selectedNoteId = null;
  }
  return created;
}

export function deleteNodes(ids) {
  const doomed = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of state.nodes) {
      if (n.parentId && doomed.has(n.parentId) && !doomed.has(n.id)) {
        doomed.add(n.id);
        changed = true;
      }
    }
  }

  state.nodes = state.nodes.filter(n => !doomed.has(n.id));
  state.links = state.links.filter(l => !doomed.has(l.a) && !doomed.has(l.b));
  doomed.forEach(id => {
    state.acquired.delete(id);
    state.selectedIds.delete(id);
  });
  if (state.linking && doomed.has(state.linking)) state.linking = null;

  reconcileAcquired();
}

export function deleteNode(id) {
  deleteNodes([id]);
}

export function addLink(aId, bId) {
  if (!aId || !bId || aId === bId) return null;
  const a = getNode(aId);
  const b = getNode(bId);
  if (!a || !b) return null;
  if (hasLink(aId, bId)) return null;
  if (a.parentId === bId || b.parentId === aId) return null;

  const link = { id: uid(), a: aId, b: bId };
  state.links.push(link);
  return link;
}

export function deleteLink(linkId) {
  const before = state.links.length;
  state.links = state.links.filter(l => l.id !== linkId);
  if (state.links.length !== before) reconcileAcquired();
}

export function unacquireCascade(nodeId) {
  state.acquired.delete(nodeId);
  reconcileAcquired();
}

export function reconcileAcquired() {
  const valid = new Set();

  for (const n of state.nodes) {
    if (!n.parentId && state.acquired.has(n.id)) valid.add(n.id);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const n of state.nodes) {
      if (valid.has(n.id)) continue;
      if (!state.acquired.has(n.id)) continue;
      const nbrs = neighborsOf(n.id);
      if (nbrs.some(x => valid.has(x))) {
        valid.add(n.id);
        changed = true;
      }
    }
  }

  for (const id of [...state.acquired]) {
    if (!valid.has(id)) state.acquired.delete(id);
  }
}

// Считает количество acquired-нод с заданным тегом.
export function countTagged(tag) {
  if (!tag) return 0;
  let n = 0;
  for (const id of state.acquired) {
    const node = getNode(id);
    if (node && Array.isArray(node.tags) && node.tags.includes(tag)) n++;
  }
  return n;
}