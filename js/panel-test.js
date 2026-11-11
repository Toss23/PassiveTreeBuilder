import { state } from './state.js';
import { dom } from './dom.js';
import { formatValue } from './utils.js';
import { computeTotals, computeCustomValues } from './calc.js';
import { refreshAll } from './panel.js';

function formatMoreProduct(p) {
  const rounded = Math.round(p * 1000) / 1000;
  return '×' + rounded;
}

function formatNumber(v) {
  if (!isFinite(v)) return '0';
  const rounded = Math.round(v * 100) / 100;
  return String(rounded);
}

export function renderTestSection() {
  const el = dom.panelTest;
  el.innerHTML = '';

  const summary = document.createElement('div');
  summary.className = 'summary';
  summary.innerHTML = `Выбрано нод: <b>${state.acquired.size}</b> из ${state.nodes.length}`;
  el.appendChild(summary);

  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.style.marginBottom = '10px';
  hint.innerHTML = 'Формула: (сумма плоск.) × (1 + сумма проц. / 100) × каждый множ. Затем — эффекты по фазам.';
  el.appendChild(hint);

  const btns = document.createElement('div');
  btns.className = 'row';
  btns.style.marginBottom = '12px';

  const resetBtn = document.createElement('button');
  resetBtn.className = 'danger';
  resetBtn.textContent = 'Сбросить';
  resetBtn.addEventListener('click', () => {
    state.acquired.clear();
    refreshAll();
  });

  const allBtn = document.createElement('button');
  allBtn.textContent = 'Взять всё';
  allBtn.addEventListener('click', () => {
    state.acquired.clear();
    for (const n of state.nodes) state.acquired.add(n.id);
    refreshAll();
  });

  btns.appendChild(resetBtn);
  btns.appendChild(allBtn);
  el.appendChild(btns);

  const h2 = document.createElement('h2');
  h2.textContent = 'Итоговые статы';
  el.appendChild(h2);

  const totals = computeTotals();
  const totalsList = document.createElement('div');

  if (state.stats.length === 0) {
    totalsList.innerHTML = '<div class="hint">Список статов пуст. Добавь статы в разделе «Настройки».</div>';
  } else {
    for (const st of state.stats) {
      const t = totals[st.id];
      if (!t) continue;

      const subLines = [];
      if (t.isSet) subLines.push('фикс.: заменяет базовое значение');
      else if (t.hasFlat) {
        const fmt = st.flatFormat === 'percent' ? 'percent' : 'flat';
        subLines.push('плоск.: ' + formatValue(t.flat, fmt));
      }

      if (t.perTagFlat > 0) subLines.push('за теги плоск.: ' + formatValue(t.perTagFlat, 'flat'));
      if (t.perTagPercent > 0) subLines.push('за теги проц.: ' + formatValue(t.perTagPercent, 'percent'));
      if (t.perTagMore > 0) subLines.push('за теги множ.: ' + formatValue(t.perTagMore, 'percent'));
      if (t.condFlat > 0) subLines.push('усл. плоск.: ' + formatValue(t.condFlat, 'flat'));
      if (t.condMore > 0) subLines.push('усл. множ.: ' + formatValue(t.condMore, 'percent'));

      if (!t.isSet && t.hasPercent) subLines.push('проц.: ' + formatValue(t.percent, 'percent'));
      if (!t.isSet && t.hasMore) subLines.push('множ.: ' + formatMoreProduct(t.moreProduct) + (t.moreCount > 1 ? ` (${t.moreCount})` : ''));

      if (t.perEachIn > 0) subLines.push('за-каждые +: ' + formatValue(t.perEachIn, 'flat'));
      if (t.perAboveIn > 0) subLines.push('свыше порога +: ' + formatValue(t.perAboveIn, 'flat'));
      if (t.convertedIn > 0) subLines.push('конв. +: ' + formatValue(t.convertedIn, 'flat'));
      if (t.convertedOut > 0) subLines.push('конв. −: ' + formatValue(t.convertedOut, 'flat'));
      if (t.extraIn > 0) subLines.push('доп. +: ' + formatValue(t.extraIn, 'flat'));

      const showBreakdown = subLines.length >= 2;

      const row = document.createElement('div');
      row.className = 'total-row' + (t.value === 0 ? ' zero' : '');

      const nameWrap = document.createElement('div');
      nameWrap.className = 'total-name';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = st.name;
      nameWrap.appendChild(nameSpan);

      if (showBreakdown) {
        for (const line of subLines) {
          const sub = document.createElement('div');
          sub.className = 'sub';
          sub.textContent = line;
          nameWrap.appendChild(sub);
        }
      }

      const valSpan = document.createElement('b');
      valSpan.textContent = formatValue(t.value, t.displayType);

      row.appendChild(nameWrap);
      row.appendChild(valSpan);
      totalsList.appendChild(row);
    }
  }

  // ---- Пользовательские вычисляемые значения ----
  const custom = computeCustomValues(totals);
  if (custom.length > 0) {
    const customTitle = document.createElement('h2');
    customTitle.style.marginTop = '16px';
    customTitle.textContent = 'Вычисляемые значения';
    el.appendChild(customTitle);

    const customList = document.createElement('div');
    for (const cv of custom) {
      const row = document.createElement('div');
      row.className = 'total-row custom-row' + (cv.value === 0 ? ' zero' : '');

      const nameWrap = document.createElement('div');
      nameWrap.className = 'total-name';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = cv.name;
      nameWrap.appendChild(nameSpan);

      const valSpan = document.createElement('b');
      valSpan.textContent = formatNumber(cv.value);

      row.appendChild(nameWrap);
      row.appendChild(valSpan);
      customList.appendChild(row);
    }
    el.appendChild(customList);
  }

  el.appendChild(totalsList);
}