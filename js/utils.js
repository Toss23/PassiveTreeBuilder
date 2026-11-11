import { state, uid, getNode, getStat } from './state.js';

export function formatValue(v, type) {
  const n = Number(v) || 0;
  const rounded = Math.round(n * 100) / 100;
  const sign = rounded > 0 ? '+' : '';
  return type === 'percent' ? `${sign}${rounded}%` : `${sign}${rounded}`;
}

export function hasLink(a, b) {
  return state.links.some(l => (l.a === a && l.b === b) || (l.a === b && l.b === a));
}

export function neighborsOf(nodeId) {
  const n = getNode(nodeId);
  if (!n) return [];
  const s = new Set();
  if (n.parentId) s.add(n.parentId);
  for (const c of state.nodes) {
    if (c.parentId === nodeId) s.add(c.id);
  }
  for (const l of state.links) {
    if (l.a === nodeId) s.add(l.b);
    if (l.b === nodeId) s.add(l.a);
  }
  return [...s];
}

export function linkLabel(link, fromId) {
  const otherId = link.a === fromId ? link.b : link.a;
  const other = getNode(otherId);
  return other ? other.title || '(без имени)' : '(удалена)';
}

export function isAcquirable(n) {
  if (state.acquired.has(n.id)) return false;
  if (!n.parentId) return true;
  return neighborsOf(n.id).some(id => state.acquired.has(id));
}

export function clampScale(v) {
  const n = Number(v);
  if (!isFinite(n)) return 1;
  return Math.max(0.3, Math.min(3, n));
}

export function visualRadius(n) {
  return (n.radius || 45) * (n.scale ?? 1);
}

export function hasActiveSearch() {
  return !!state.search.query.trim();
}

export function matchesSearch(n) {
  const q = state.search.query.trim().toLowerCase();
  if (!q) return true;

  // Имя ноды
  if ((n.title || '').toLowerCase().includes(q)) return true;

  // Описание
  if ((n.description || '').toLowerCase().includes(q)) return true;

  // Теги ноды
  if (Array.isArray(n.tags)) {
    for (const t of n.tags) {
      if (String(t).toLowerCase().includes(q)) return true;
    }
  }

  // Статы ноды — по имени стата
  if (Array.isArray(n.stats)) {
    for (const s of n.stats) {
      const st = getStat(s.statId);
      if (st && st.name.toLowerCase().includes(q)) return true;
    }
  }

  // Эффекты ноды
  if (Array.isArray(n.effects)) {
    for (const e of n.effects) {
      // По типу/метке эффекта
      const labels = state.config.effectLabels || {};
      const label = labels[e.type] || e.type;
      if (String(label).toLowerCase().includes(q)) return true;
      if (String(e.type || '').toLowerCase().includes(q)) return true;

      // По статам, участвующим в эффекте
      const statRefs = [e.from, e.to, e.left, e.rightStat, e.a, e.b];
      for (const id of statRefs) {
        if (!id) continue;
        const st = getStat(id);
        if (st && st.name.toLowerCase().includes(q)) return true;
      }

      // В наградах condition
      if (Array.isArray(e.rewards)) {
        for (const r of e.rewards) {
          if (!r.to) continue;
          const st = getStat(r.to);
          if (st && st.name.toLowerCase().includes(q)) return true;
        }
      }

      // Тег в perTag
      if (e.type === 'perTag' && e.tag) {
        if (String(e.tag).toLowerCase().includes(q)) return true;
      }
    }
  }

  return false;
}

export function firstEnabledType(stat) {
  if (!stat || !stat.types) return null;
  if (stat.types.flat) return 'flat';
  if (stat.types.percent) return 'percent';
  if (stat.types.more) return 'more';
  return null;
}

export function enabledTypes(stat) {
  if (!stat || !stat.types) return [];
  return ['flat', 'percent', 'more'].filter(t => stat.types[t]);
}

export function flatDisplayType(stat) {
  return stat && stat.flatFormat === 'percent' ? 'percent' : 'flat';
}

export function getNodeDisplayLabel(n) {
  const title = (n.title || '').trim();
  if (title) return title;
  if (!Array.isArray(n.stats) || n.stats.length === 0) return '';
  const lines = [];
  for (const s of n.stats) {
    const st = getStat(s.statId);
    if (!st) continue;
    const type = s.type || 'flat';
    const v = Number(s.value) || 0;
    const rounded = Math.round(v * 100) / 100;

    if (type === 'percent') {
      const sign = rounded > 0 ? '+' : '';
      lines.push(`${sign}${rounded}% ${st.name}`);
    } else if (type === 'more') {
      lines.push(`x${rounded}% ${st.name}`);
    } else {
      const sign = rounded > 0 ? '+' : '';
      const suffix = st.flatFormat === 'percent' ? '%' : '';
      lines.push(`${sign}${rounded}${suffix} ${st.name}`);
    }
  }
  return lines.join('\n');
}

export const FILL_ALPHA = 0.35;
export const DEFAULT_NODE_COLOR = '#4a7dff';
export const DEFAULT_NOTE_COLOR = '#4a7dff';
const DEFAULT_PALETTE = [DEFAULT_NODE_COLOR];

export function clampNoteSize(v) {
  const n = Number(v);
  if (!isFinite(n)) return 200;
  return Math.max(80, Math.min(800, n));
}

export function clampFontSize(v) {
  const n = Number(v);
  if (!isFinite(n)) return 14;
  return Math.max(8, Math.min(48, n));
}

export function hexToRgba(hex, alpha) {
  if (typeof hex !== 'string') return hex;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length === 8) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = parseInt(h.slice(6, 8), 16) / 255;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function initDefaultTree() {
  const c = state.config;
  state.nodes = [{
    id: uid(),
    x: 0, y: 0,
    title: '',
    description: '',
    color: c.newNodeColor,
    strokeWidth: c.newRootStrokeWidth,
    radius: c.newRootRadius,
    scale: c.newNodeScale,
    parentId: null,
    stats: [],
    effects: [],
    tags: [],
  }];
  state.links = [];
  state.notes = [];
  state.palette = [...DEFAULT_PALETTE];
  state.tags = [];
  state.selectedIds = new Set();
  state.selectedNoteId = null;
  state.acquired.clear();
  state.linking = null;
  state.search = { query: '', statId: '' };
}

export function normalizeNode(n) {
  return {
    id: n.id || uid(),
    x: Number(n.x) || 0,
    y: Number(n.y) || 0,
    title: n.title || '',
    description: n.description || '',
    color: n.color || n.stroke || DEFAULT_NODE_COLOR,
    strokeWidth: (n.strokeWidth ?? 4),
    radius: Number(n.radius) || 45,
    scale: clampScale(n.scale ?? 1),
    parentId: n.parentId || null,
    tags: Array.isArray(n.tags) ? n.tags.filter(t => typeof t === 'string') : [],
    stats: Array.isArray(n.stats)
      ? n.stats.map(s => {
          let type = s.type;
          if (!type) {
            if (s.modifier === 'more') type = 'more';
            else type = 'flat';
          }
          return {
            statId: s.statId,
            type,
            value: Number(s.value) || 0,
          };
        })
      : [],
    effects: Array.isArray(n.effects)
      ? n.effects.map(e => {
          let percent = e.percent, rate = e.rate;
          if (e.percent === undefined && e.rate !== undefined) {
            percent = Number(e.rate) || 0;
            rate = 100;
          } else if (e.percent === undefined) {
            percent = 100;
            rate = 100;
          }
          return {
            id: e.id || uid(),
            type: e.type || 'convert',
            from: e.from || '',
            to: e.to || '',
            percent: Number(percent) || 0,
            rate: Number(rate) || 0,
            value: Number(e.value) || 0,
            step: Number(e.step) || 1,
            bonus: Number(e.bonus) || 0,
            left: e.left || '',
            op: e.op || '>',
            rightKind: e.rightKind === 'stat' ? 'stat' : 'number',
            rightNumber: Number(e.rightNumber) || 0,
            rightStat: e.rightStat || '',
            rewards: Array.isArray(e.rewards)
              ? e.rewards.map(r => ({
                  to: r.to || '',
                  kind: ['flat', 'percent', 'more'].includes(r.kind) ? r.kind : 'flat',
                  value: Number(r.value) || 0,
                }))
              : (e.rewardTo
                  ? [{
                      to: e.rewardTo,
                      kind: ['flat', 'percent', 'more'].includes(e.rewardKind) ? e.rewardKind : 'flat',
                      value: Number(e.rewardValue) || 0,
                    }]
                  : []),
            threshold: Number(e.threshold) || 0,
            a: e.a || '',
            b: e.b || '',
            tag: e.tag || '',
            kind: ['flat', 'percent', 'more'].includes(e.kind) ? e.kind : 'flat',
          };
        })
      : [],
  };
}

export function normalizeLink(l, validIds) {
  if (!l || typeof l !== 'object') return null;
  const a = l.a, b = l.b;
  if (!a || !b || a === b) return null;
  if (validIds && (!validIds.has(a) || !validIds.has(b))) return null;
  return { id: l.id || uid(), a, b };
}

export function normalizeNote(n) {
  return {
    id: n.id || uid(),
    x: Number(n.x) || 0,
    y: Number(n.y) || 0,
    size: clampNoteSize(n.size ?? 200),
    text: typeof n.text === 'string' ? n.text : '',
    color: n.color || DEFAULT_NOTE_COLOR,
    fontSize: clampFontSize(n.fontSize ?? 14),
  };
}

export function normalizePalette(p) {
  if (!Array.isArray(p)) return null;
  const out = [];
  for (const c of p) {
    if (typeof c !== 'string') continue;
    const s = c.trim().toLowerCase();
    if (/^#[0-9a-f]{3,8}$/.test(s) && !out.includes(s)) out.push(s);
  }
  return out;
}

export function normalizeTags(t) {
  if (!Array.isArray(t)) return null;
  const out = [];
  for (const c of t) {
    if (typeof c !== 'string') continue;
    const s = c.trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

export function normalizeStat(s) {
  const percent = !!(s.types ? s.types.percent : (s.type === 'percent'));
  const more    = !!(s.types ? s.types.more    : s.allowMore);

  return {
    id: s.id || uid(),
    name: s.name || 'Стат',
    types: {
      flat: true,
      percent,
      more,
    },
    flatFormat: s.flatFormat === 'percent' ? 'percent' : 'number',
  };
}

export function reconcileNodeStatTypes() {
  for (const n of state.nodes) {
    if (!Array.isArray(n.stats)) continue;
    for (const s of n.stats) {
      const st = getStat(s.statId);
      if (!st) continue;
      if (!st.types[s.type]) {
        const fallback = firstEnabledType(st);
        if (fallback) s.type = fallback;
      }
    }
  }
}