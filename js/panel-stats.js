import { state, uid } from './state.js';
import { dom } from './dom.js';
import { commit, commitDebounced } from './history.js';
import { updateHistoryButtons } from './panel-history.js';
import { renderNodeSection } from './panel-node.js';
import { renderNodes } from './render-svg.js';

export function renderStatsSection() {
  const el = dom.statsSection;
  el.innerHTML = '';

  const table = document.createElement('div');
  table.className = 'stats-table';

  const head = document.createElement('div');
  head.className = 'stats-head';
  head.innerHTML = `
    <div class="head name">Название</div>
    <div class="head">плоск.</div>
    <div class="head">проц.</div>
    <div class="head">множ.</div>
    <div class="head"></div>
    <div class="head"></div>
    <div class="head"></div>
  `;
  table.appendChild(head);

  const body = document.createElement('div');
  body.className = 'stats-body';
  table.appendChild(body);

  state.stats.forEach((st, idx) => {
    const row = document.createElement('div');
    row.className = 'stats-row';

    const name = document.createElement('input');
    name.type = 'text';
    name.value = st.name;
    name.addEventListener('input', e => {
      st.name = e.target.value;
      renderNodes();
      commitDebounced();
      updateHistoryButtons();
    });
    row.appendChild(name);

    const fmtSel = document.createElement('select');
    fmtSel.className = 'flat-fmt';
    fmtSel.title = 'Формат отображения плоского значения';
    for (const [v, l] of [['number', 'число'], ['percent', 'процент']]) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = l;
      if ((st.flatFormat || 'number') === v) opt.selected = true;
      fmtSel.appendChild(opt);
    }
    fmtSel.addEventListener('change', ev => {
      st.flatFormat = ev.target.value;
      renderNodeSection();
      renderNodes();
      commit();
      updateHistoryButtons();
    });
    row.appendChild(fmtSel);

    const pctCb = document.createElement('input');
    pctCb.type = 'checkbox';
    pctCb.checked = !!st.types.percent;
    pctCb.title = 'проц.';
    pctCb.addEventListener('change', () => {
      st.types.percent = pctCb.checked;
      renderNodeSection();
      renderNodes();
      commit();
      updateHistoryButtons();
    });
    row.appendChild(pctCb);

    const moreCb = document.createElement('input');
    moreCb.type = 'checkbox';
    moreCb.checked = !!st.types.more;
    moreCb.title = 'множ.';
    moreCb.addEventListener('change', () => {
      st.types.more = moreCb.checked;
      renderNodeSection();
      renderNodes();
      commit();
      updateHistoryButtons();
    });
    row.appendChild(moreCb);

    const upBtn = document.createElement('button');
    upBtn.className = 'mini reorder';
    upBtn.textContent = '↑';
    upBtn.title = 'Выше приоритет';
    upBtn.disabled = idx === 0;
    upBtn.addEventListener('click', () => {
      if (idx === 0) return;
      const tmp = state.stats[idx - 1];
      state.stats[idx - 1] = state.stats[idx];
      state.stats[idx] = tmp;
      commit();
      renderStatsSection();
      renderNodeSection();
      renderNodes();
      updateHistoryButtons();
    });
    row.appendChild(upBtn);

    const downBtn = document.createElement('button');
    downBtn.className = 'mini reorder';
    downBtn.textContent = '↓';
    downBtn.title = 'Ниже приоритет';
    downBtn.disabled = idx === state.stats.length - 1;
    downBtn.addEventListener('click', () => {
      if (idx === state.stats.length - 1) return;
      const tmp = state.stats[idx + 1];
      state.stats[idx + 1] = state.stats[idx];
      state.stats[idx] = tmp;
      commit();
      renderStatsSection();
      renderNodeSection();
      renderNodes();
      updateHistoryButtons();
    });
    row.appendChild(downBtn);

    const del = document.createElement('button');
    del.className = 'danger mini';
    del.textContent = '×';
    del.addEventListener('click', () => {
      if (!confirm(`Удалить стат "${st.name}"? Он будет убран со всех нод.`)) return;
      state.stats.splice(idx, 1);
      for (const n of state.nodes) {
        if (n.stats) n.stats = n.stats.filter(s => s.statId !== st.id);
        if (n.effects) n.effects = n.effects.filter(e => e.from !== st.id && e.to !== st.id);
      }
      commit();
      renderStatsSection();
      renderNodeSection();
      renderNodes();
      updateHistoryButtons();
    });
    row.appendChild(del);

    body.appendChild(row);
  });

  el.appendChild(table);

  const add = document.createElement('button');
  add.className = 'mini';
  add.textContent = '+ Добавить стат';
  add.style.marginTop = '8px';
  add.addEventListener('click', () => {
    state.stats.push({
      id: uid(),
      name: 'Новый стат',
      types: { flat: true, percent: false, more: false },
      flatFormat: 'number',
    });
    commit();
    renderStatsSection();
    renderNodeSection();
    renderNodes();
    updateHistoryButtons();
  });
  el.appendChild(add);
}