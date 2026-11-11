import { dom } from './dom.js';
import { getNode, getStat } from './state.js';
import { formatValue } from './utils.js';

let tooltipEl = null;

function ensureElement() {
  if (tooltipEl) return tooltipEl;
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'tooltip';
  tooltipEl.style.display = 'none';
  dom.tooltipLayer.appendChild(tooltipEl);
  return tooltipEl;
}

export function hideTooltip() {
  if (tooltipEl) tooltipEl.style.display = 'none';
}

export function showNodeTooltip(nodeId, clientX, clientY) {
  const n = getNode(nodeId);
  if (!n) { hideTooltip(); return; }

  const el = ensureElement();
  el.innerHTML = buildNodeTooltipHTML(n);

  const wrapRect = dom.tooltipLayer.getBoundingClientRect();
  const x = clientX - wrapRect.left;
  const y = clientY - wrapRect.top;

  el.style.display = 'block';
  el.style.left = '0px';
  el.style.top = '0px';

  const rect = el.getBoundingClientRect();
  let left = x + 18;
  let top  = y + 18;

  const maxX = wrapRect.width  - rect.width  - 10;
  const maxY = wrapRect.height - rect.height - 10;

  if (left > maxX) left = Math.max(10, x - rect.width - 18);
  if (top  > maxY) top  = Math.max(10, y - rect.height - 18);

  el.style.left = left + 'px';
  el.style.top  = top  + 'px';
}

function buildNodeTooltipHTML(n) {
  let html = '';

  const title = (n.title || '').trim();
  const hasStats = n.stats && n.stats.length > 0;
  const hasEffects = n.effects && n.effects.length > 0;
  const hasTags = n.tags && n.tags.length > 0;

  if (title) {
    html += '<div class="tooltip-title">' + esc(title) + '</div>';
  }
  if (n.description) {
    html += '<div class="tooltip-desc">' + esc(n.description) + '</div>';
  }

  if (hasStats) {
    html += '<div class="tooltip-section">Статы</div>';
    for (const s of n.stats) {
      const st = getStat(s.statId);
      if (!st) continue;
      const type = s.type || 'flat';
      let line;
      if (type === 'percent') {
        line = st.name + ': ' + formatValue(s.value, 'percent');
      } else if (type === 'more') {
        line = st.name + ': ' + formatValue(s.value, 'percent') + ' множ.';
      } else {
        const fmt = st.flatFormat === 'percent' ? 'percent' : 'flat';
        line = st.name + ': ' + formatValue(s.value, fmt);
      }
      html += '<div class="tooltip-line">' + esc(line) + '</div>';
    }
  }

  if (hasEffects) {
    html += '<div class="tooltip-section">Эффекты</div>';
    for (const e of n.effects) {
      if (e.type === 'convert' || e.type === 'extra') {
        const from = getStat(e.from);
        const to = getStat(e.to);
        if (!from || !to) continue;
        const pct = Number(e.percent) || 0;
        const r   = Number(e.rate) || 0;
        const prefix = e.type === 'extra' ? 'Доп.: ' : 'Конв.: ';
        html += '<div class="tooltip-line">' + prefix
          + esc(from.name) + ' → ' + esc(to.name)
          + ' (' + pct + '% × ' + r + '%)</div>';
      } else if (e.type === 'set') {
        const to = getStat(e.to);
        if (!to) continue;
        html += '<div class="tooltip-line">Фикс.: '
          + esc(to.name) + ' = ' + (Number(e.value) || 0) + '</div>';
      } else if (e.type === 'perEach') {
        const from = getStat(e.from);
        const to = getStat(e.to);
        if (!from || !to) continue;
        const suffix = to.flatFormat === 'percent' ? '%' : '';
        html += '<div class="tooltip-line">За-каждые: '
          + esc(from.name) + ' / ' + (Number(e.step) || 0) + ' → +'
          + (Number(e.bonus) || 0) + suffix + ' ' + esc(to.name) + '</div>';
      } else if (e.type === 'perAbove') {
        const from = getStat(e.from);
        const to = getStat(e.to);
        if (!from || !to) continue;
        const suffix = to.flatFormat === 'percent' ? '%' : '';
        html += '<div class="tooltip-line">За-каждое свыше: '
          + esc(from.name) + ' − ' + (Number(e.threshold) || 0) + ' → +'
          + (Number(e.bonus) || 0) + suffix + ' ' + esc(to.name) + '</div>';
      } else if (e.type === 'perTag') {
        const to = getStat(e.to);
        if (!to) continue;
        const suffix = (e.kind === 'flat')
          ? (to.flatFormat === 'percent' ? '%' : '')
          : '%';
        html += '<div class="tooltip-line">За теги: '
          + (Number(e.step) || 1) + '× ' + esc(e.tag || '?')
          + ' → +' + (Number(e.bonus) || 0) + suffix + ' ' + esc(to.name) + '</div>';
      } else if (e.type === 'condition') {
        const left = getStat(e.left);
        if (!left) continue;
        const rightStr = e.rightKind === 'stat'
          ? (getStat(e.rightStat) ? esc(getStat(e.rightStat).name) : '?')
          : String(Number(e.rightNumber) || 0);
        const rewards = Array.isArray(e.rewards) ? e.rewards : [];
        const rewardLines = rewards
          .filter(r => r.kind !== 'percent')
          .map(r => {
            const to = getStat(r.to);
            if (!to) return null;
            const prefix = r.kind === 'more' ? '×' : '+';
            let suffix = '';
            if (r.kind === 'more') suffix = '%';
            else if (r.kind === 'flat' && to.flatFormat === 'percent') suffix = '%';
            return prefix + (Number(r.value) || 0) + suffix + ' ' + esc(to.name);
          })
          .filter(Boolean);
        if (rewardLines.length === 0) continue;
        html += '<div class="tooltip-line">Если '
          + esc(left.name) + ' ' + esc(e.op) + ' ' + rightStr + ':</div>';
        for (const line of rewardLines) {
          html += '<div class="tooltip-subline">' + line + '</div>';
        }
      } else if (e.type === 'swap') {
        const a = getStat(e.a);
        const b = getStat(e.b);
        if (!a || !b) continue;
        html += '<div class="tooltip-line">Обмен: '
          + esc(a.name) + ' ↔ ' + esc(b.name) + '</div>';
      }
    }
  }

  if (hasTags) {
    html += '<div class="tooltip-section">Теги</div>';
    html += '<div class="tooltip-line">' + n.tags.map(esc).join(', ') + '</div>';
  }

  if (!title && !n.description && !hasStats && !hasEffects && !hasTags) {
    html = '<div class="tooltip-desc">(пустая нода)</div>';
  }

  return html;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}