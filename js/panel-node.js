import { state, uid, getNode, getStat, getSelectedNodes, clearSelection } from './state.js';
import { dom } from './dom.js';
import {
  linkLabel, clampScale, enabledTypes,
  DEFAULT_NODE_COLOR,
} from './utils.js';
import { addChild, deleteNode, deleteNodes, deleteLink, countTagged, duplicateNodes } from './node-ops.js';
import { renderNodes } from './render-svg.js';
import { commit, commitDebounced } from './history.js';
import { updateHistoryButtons } from './panel-history.js';
import { renderPalette } from './panel-palette.js';
import { countTaggedAll } from './calc.js';
import { refreshAll } from './panel.js';

export function renderNodeSection() {
  const el = dom.nodeSection;
  el.innerHTML = '';

  if (state.linking) {
    const src = getNode(state.linking);
    const banner = document.createElement('div');
    banner.className = 'linking-banner';
    banner.innerHTML = `🔗 Режим связи. Источник: <b>${src ? (src.title || '(без имени)') : '?'}</b>.<br>
      Кликни по другой ноде, чтобы создать связь. ESC — отмена.`;
    el.appendChild(banner);
  }

  const selected = getSelectedNodes();

  if (selected.length === 0) {
    const box = document.createElement('div');
    box.className = 'hint section-box';
    box.textContent = 'Нода не выбрана. Кликни по ноде, чтобы редактировать.';
    el.appendChild(box);
    return;
  }

  if (selected.length > 1) {
    renderMultiSelectionPanel(el, selected);
    return;
  }

  const n = selected[0];

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <label>Название</label>
    <input type="text" id="f-title" maxlength="60" placeholder="(пусто — показываются статы)" />
    <label style="margin-top:8px">Описание</label>
    <textarea id="f-desc" maxlength="400"></textarea>
    <label style="margin-top:8px">Цвет</label>
    <input type="color" id="f-color" />
    <label style="margin-top:10px">
      Палитра
      <span class="palette-hint">(ЛКМ — применить · ПКМ — удалить)</span>
    </label>
    <div class="palette" id="paletteEl"></div>
    <div class="row" style="margin-top:8px">
      <div><label>Толщина окантовки</label><input type="number" id="f-sw" min="0" max="20" step="1" /></div>
      <div><label>Радиус</label><input type="number" id="f-r" min="20" max="200" step="1" /></div>
    </div>
    <label style="margin-top:8px">Размер ноды</label>
    <div class="scale-row">
      <input type="range" id="f-scale" min="0.3" max="3" step="0.05" />
      <span class="scale-val" id="f-scale-val">100%</span>
    </div>
    <div class="scale-presets">
      <button type="button" data-scale="1">100%</button>
      <button type="button" data-scale="1.25">125%</button>
      <button type="button" data-scale="1.5">150%</button>
      <button type="button" data-scale="2">200%</button>
    </div>
  `;
  el.appendChild(wrap);

  document.getElementById('f-title').value  = n.title || '';
  document.getElementById('f-desc').value   = n.description || '';
  document.getElementById('f-color').value  = n.color || DEFAULT_NODE_COLOR;
  document.getElementById('f-sw').value     = n.strokeWidth ?? 4;
  document.getElementById('f-r').value      = n.radius;

  const scaleEl    = document.getElementById('f-scale');
  const scaleValEl = document.getElementById('f-scale-val');
  const initialScale = clampScale(n.scale ?? 1);
  scaleEl.value = initialScale;
  scaleValEl.textContent = Math.round(initialScale * 100) + '%';

  const onChangeText = () => { commitDebounced(); updateHistoryButtons(); };

  document.getElementById('f-title').addEventListener('input', e => { n.title = e.target.value; renderNodes(); onChangeText(); });
  document.getElementById('f-desc').addEventListener('input',  e => { n.description = e.target.value; onChangeText(); });
  document.getElementById('f-color').addEventListener('input', e => { n.color = e.target.value; renderNodes(); onChangeText(); });
  document.getElementById('f-sw').addEventListener('input',    e => { n.strokeWidth = Math.max(0, Math.min(20, Number(e.target.value) || 0)); renderNodes(); onChangeText(); });
  document.getElementById('f-r').addEventListener('input',     e => { n.radius = Math.max(20, Math.min(200, Number(e.target.value) || 45)); renderNodes(); onChangeText(); });

  scaleEl.addEventListener('input', e => {
    n.scale = clampScale(e.target.value);
    scaleValEl.textContent = Math.round(n.scale * 100) + '%';
    renderNodes();
    onChangeText();
  });

  document.querySelectorAll('.scale-presets button').forEach(b => {
    b.addEventListener('click', () => {
      n.scale = clampScale(Number(b.dataset.scale));
      scaleEl.value = n.scale;
      scaleValEl.textContent = Math.round(n.scale * 100) + '%';
      renderNodes();
      commit();
      updateHistoryButtons();
    });
  });

  const paletteEl = document.getElementById('paletteEl');
  renderPalette(paletteEl, {
    getAddColor: () => n.color || DEFAULT_NODE_COLOR,
    onApply: (col) => {
      n.color = col;
      document.getElementById('f-color').value = col;
      renderNodes();
    },
  });

  renderNodeTagsBlock(el, n);

  const statsBlock = document.createElement('div');
  statsBlock.style.marginTop = '12px';
  statsBlock.innerHTML = '<h2 style="margin-top:6px">Статы ноды</h2><div id="nodeStatsList"></div>';
  el.appendChild(statsBlock);

  const addStatRow = document.createElement('button');
  addStatRow.className = 'mini';
  addStatRow.textContent = '+ Стат на ноду';
  addStatRow.style.marginTop = '6px';
  statsBlock.appendChild(addStatRow);

  renderNodeEffectsBlock(el, n);

  const linksBlock = document.createElement('div');
  linksBlock.style.marginTop = '12px';
  linksBlock.innerHTML = '<h2>Связи ноды</h2><div id="nodeLinksList"></div>';
  el.appendChild(linksBlock);

  const actionsRow1 = document.createElement('div');
  actionsRow1.className = 'row';
  actionsRow1.style.marginTop = '12px';

  const addChildBtn = document.createElement('button');
  addChildBtn.className = 'primary';
  addChildBtn.textContent = '+ Дочерняя нода';
  addChildBtn.title = 'Создать дочернюю ноду';

  const addChildCopyBtn = document.createElement('button');
  addChildCopyBtn.className = 'primary';
  addChildCopyBtn.textContent = '📋 Копия';
  addChildCopyBtn.title = 'Дочерняя нода с параметрами текущей';

  const isMobile = window.innerWidth <= 800;
  if (!isMobile) addChildCopyBtn.style.display = 'none';

  const linkBtn = document.createElement('button');
  linkBtn.className = 'link-mode';
  if (state.linking === n.id) {
    linkBtn.classList.add('active');
    linkBtn.textContent = '✕ Отменить связь';
  } else if (state.linking) {
    linkBtn.textContent = '🔗 Связать…';
    linkBtn.disabled = true;
  } else {
    linkBtn.textContent = '🔗 Связать…';
  }

  actionsRow1.appendChild(addChildBtn);
  actionsRow1.appendChild(addChildCopyBtn);
  actionsRow1.appendChild(linkBtn);

  const actionsRow2 = document.createElement('div');
  actionsRow2.className = 'row';
  actionsRow2.style.marginTop = '8px';

  const delBtn = document.createElement('button');
  delBtn.className = 'danger';
  delBtn.textContent = 'Удалить ноду';
  actionsRow2.appendChild(delBtn);

  el.appendChild(actionsRow1);
  el.appendChild(actionsRow2);

  const listEl = document.getElementById('nodeStatsList');

  function renderNodeStatsList() {
    listEl.innerHTML = '';
    if (!n.stats) n.stats = [];
    if (n.stats.length === 0) {
      listEl.innerHTML = '<div class="hint">Нода не даёт статов.</div>';
      return;
    }
    n.stats.forEach((s, idx) => {
      const row = document.createElement('div');
      row.className = 'stat-row';

      const sel = document.createElement('select');
      let matched = false;
      const currentType = s.type || 'flat';

      for (const st of state.stats) {
        const enabled = enabledTypes(st);
        if (enabled.length === 0) continue;

        if (enabled.length === 1) {
          const opt = document.createElement('option');
          opt.value = `${st.id}|${enabled[0]}`;
          opt.textContent = st.name;
          if (st.id === s.statId && currentType === enabled[0]) { opt.selected = true; matched = true; }
          sel.appendChild(opt);
        } else {
          const TYPE_LABELS = { flat: 'плоск.', percent: 'проц.', more: 'множ.' };
          for (const t of enabled) {
            const opt = document.createElement('option');
            opt.value = `${st.id}|${t}`;
            opt.textContent = `${st.name} (${TYPE_LABELS[t]})`;
            if (st.id === s.statId && currentType === t) { opt.selected = true; matched = true; }
            sel.appendChild(opt);
          }
        }
      }

      if (!matched) {
        const opt = document.createElement('option');
        opt.value = `${s.statId}|${currentType}`;
        opt.textContent = '(удалён)';
        opt.selected = true;
        sel.insertBefore(opt, sel.firstChild);
      }

      sel.addEventListener('change', e => {
        const [statId, type] = e.target.value.split('|');
        s.statId = statId;
        s.type = type;
        renderNodes();
        commit();
        updateHistoryButtons();
      });

      const val = document.createElement('input');
      val.type = 'number';
      val.step = 'any';
      val.value = s.value;
      val.addEventListener('input', e => {
        s.value = Number(e.target.value) || 0;
        renderNodes();
        commitDebounced();
        updateHistoryButtons();
      });

      const del = document.createElement('button');
      del.className = 'danger mini';
      del.textContent = '×';
      del.addEventListener('click', () => {
        n.stats.splice(idx, 1);
        renderNodeStatsList();
        renderNodes();
        commit();
        updateHistoryButtons();
      });

      row.appendChild(sel);
      row.appendChild(val);
      row.appendChild(del);
      listEl.appendChild(row);
    });
  }

  addStatRow.addEventListener('click', () => {
    const used = new Set((n.stats || []).map(s => `${s.statId}|${s.type}`));
    let pick = null;
    for (const st of state.stats) {
      const enabled = enabledTypes(st);
      for (const t of enabled) {
        if (!used.has(`${st.id}|${t}`)) { pick = { statId: st.id, type: t }; break; }
      }
      if (pick) break;
    }
    if (!pick) {
      alert('Все доступные статы уже добавлены на ноду.');
      return;
    }
    if (!n.stats) n.stats = [];
    n.stats.push({
      statId: pick.statId,
      type: pick.type,
      value: (pick.type === 'flat') ? 1 : 10,
    });
    renderNodeStatsList();
    renderNodes();
    commit();
    updateHistoryButtons();
  });

  const linksListEl = document.getElementById('nodeLinksList');

  function renderNodeLinksList() {
    linksListEl.innerHTML = '';
    const own = state.links.filter(l => l.a === n.id || l.b === n.id);
    if (own.length === 0) {
      linksListEl.innerHTML = '<div class="hint">Дополнительных связей нет.</div>';
      return;
    }
    own.forEach(link => {
      const row = document.createElement('div');
      row.className = 'link-row';
      const sp = document.createElement('span');
      sp.textContent = '🔗 ' + linkLabel(link, n.id);
      const del = document.createElement('button');
      del.className = 'danger mini';
      del.textContent = '×';
      del.title = 'Удалить связь';
      del.addEventListener('click', () => {
        deleteLink(link.id);
        commit();
        refreshAll();
      });
      row.appendChild(sp);
      row.appendChild(del);
      linksListEl.appendChild(row);
    });
  }

  addChildBtn.addEventListener('click', () => { addChild(n); commit(); refreshAll(); });
  addChildCopyBtn.addEventListener('click', () => {
    duplicateNodes([n.id]);
    commit();
    refreshAll();
  });
  delBtn.addEventListener('click', () => { deleteNode(n.id); commit(); refreshAll(); });
  linkBtn.addEventListener('click', () => {
    if (state.linking === n.id) state.linking = null;
    else if (!state.linking) state.linking = n.id;
    refreshAll();
  });

  renderNodeStatsList();
  renderNodeLinksList();
}

// ---------- Теги ноды ----------
function renderNodeTagsBlock(el, n) {
  const block = document.createElement('div');
  block.style.marginTop = '12px';
  block.innerHTML = '<h2 style="margin-top:6px">Теги ноды</h2><div id="nodeTagsList"></div>';
  el.appendChild(block);

  const listEl = block.querySelector('#nodeTagsList');

  function renderList() {
    listEl.innerHTML = '';
    if (!Array.isArray(n.tags)) n.tags = [];

    if (state.tags.length === 0) {
      const h = document.createElement('div');
      h.className = 'hint';
      h.textContent = 'Список тегов пуст. Добавь теги в разделе «Настройки».';
      listEl.appendChild(h);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'tag-checkboxes';

    for (const tag of state.tags) {
      const label = document.createElement('label');
      label.className = 'tag-checkbox';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = n.tags.includes(tag);
      cb.addEventListener('change', () => {
        if (cb.checked) {
          if (!n.tags.includes(tag)) n.tags.push(tag);
        } else {
          n.tags = n.tags.filter(t => t !== tag);
        }
        renderNodes();
        commit();
        updateHistoryButtons();
      });
      label.appendChild(cb);

      const span = document.createElement('span');
      span.textContent = tag;
      label.appendChild(span);

      grid.appendChild(label);
    }
    listEl.appendChild(grid);
  }

  renderList();
}

// ---------- Эффекты ноды ----------
function renderNodeEffectsBlock(el, n) {
  const block = document.createElement('div');
  block.style.marginTop = '12px';
  block.innerHTML = '<h2>Эффекты ноды</h2>';

  const list = document.createElement('div');
  list.id = 'nodeEffectsList';
  block.appendChild(list);

  el.appendChild(block);

  const listEl = list;

  function getEffectTypes() {
    const L = state.config.effectLabels || {};
    // Фиксированные — не участвуют в пользовательском порядке
    const fixed = [
      { id: 'set',    label: L.set    || 'Фикс.' },
      { id: 'perTag', label: L.perTag || 'За теги' },
    ];
    // Настраиваемый порядок
    const order = state.config.effectOrder || ['convert', 'perEach', 'perAbove', 'extra', 'swap', 'condition'];
    const ordered = order.map(id => ({ id, label: L[id] || id }));
    return [...fixed, ...ordered];
  }

  function makeStatSelect(value, onChange, title, opts = {}) {
    const sel = document.createElement('select');
    sel.title = title || '';
    for (const st of state.stats) {
      if (opts.exclude && st.id === opts.exclude) continue;
      const opt = document.createElement('option');
      opt.value = st.id;
      opt.textContent = st.name;
      if (st.id === value) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', ev => {
      onChange(ev.target.value);
      renderNodes();
      commit();
      updateHistoryButtons();
    });
    return sel;
  }

  function makeNumInput(value, onChange, title) {
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = 'any';
    inp.value = value;
    inp.title = title || '';
    inp.className = 'effect-rate-input';
    inp.addEventListener('input', ev => {
      onChange(Number(ev.target.value) || 0);
      renderNodes();
      commitDebounced();
      updateHistoryButtons();
    });
    return inp;
  }

  function makeLine(labelText, ...children) {
    const row = document.createElement('div');
    row.className = 'effect-rate-line';
    if (labelText !== null) {
      const label = document.createElement('span');
      label.className = 'effect-rate-label';
      label.textContent = labelText;
      row.appendChild(label);
    }
    for (const c of children) row.appendChild(c);
    return row;
  }

  function makeSuffix(text) {
    const s = document.createElement('span');
    s.className = 'effect-rate-suffix';
    s.textContent = text;
    return s;
  }

  function renderList() {
    listEl.innerHTML = '';
    if (!n.effects) n.effects = [];

    if (n.effects.length === 0) {
      const h = document.createElement('div');
      h.className = 'hint';
      h.textContent = 'Эффектов нет.';
      listEl.appendChild(h);
    } else {
      n.effects.forEach((e, idx) => {
        const card = document.createElement('div');
        card.className = 'effect-card';

        const header = document.createElement('div');
        header.className = 'effect-header';

        const typeSel = document.createElement('select');
        typeSel.className = 'effect-type';
        typeSel.title = 'Тип эффекта';
        const effectTypes = getEffectTypes();
        for (const t of effectTypes) {
          const opt = document.createElement('option');
          opt.value = t.id;
          opt.textContent = t.label;
          if (t.id === e.type) opt.selected = true;
          typeSel.appendChild(opt);
        }
        typeSel.addEventListener('change', ev => {
          e.type = ev.target.value;
          renderList();
          renderNodes();
          commit();
          updateHistoryButtons();
        });

        const del = document.createElement('button');
        del.className = 'danger mini';
        del.textContent = '×';
        del.title = 'Удалить эффект';
        del.addEventListener('click', () => {
          n.effects.splice(idx, 1);
          renderList();
          renderNodes();
          commit();
          updateHistoryButtons();
        });

        header.appendChild(typeSel);
        header.appendChild(del);
        card.appendChild(header);

        card.appendChild(renderBody(e));
        listEl.appendChild(card);
      });
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'mini';
    addBtn.textContent = '+ Эффект';
    addBtn.title = 'Добавить эффект на ноду';
    addBtn.style.marginTop = '6px';
    addBtn.addEventListener('click', () => {
      if (state.stats.length < 1) {
        alert('Сначала добавь хотя бы один стат.');
        return;
      }
      if (!n.effects) n.effects = [];
      const s0 = state.stats[0].id;
      const s1 = state.stats[1] ? state.stats[1].id : s0;
      n.effects.push({
        id: uid(),
        type: 'convert',
        from: s0,
        to: s1,
        percent: 50,
        rate: 100,
        value: 0,
        step: 10,
        bonus: 1,
        left: s0,
        op: '>',
        rightKind: 'number',
        rightNumber: 0,
        rightStat: s1,
        rewards: [{ to: s0, kind: 'flat', value: 10 }],
        threshold: 0,
        a: s0,
        b: s1,
        tag: state.tags[0] || '',
        kind: 'flat',
      });
      renderList();
      renderNodes();
      commit();
      updateHistoryButtons();
    });
    listEl.appendChild(addBtn);
  }

  function renderBody(e) {
    const body = document.createElement('div');
    body.className = 'effect-body';

    if (e.type === 'convert' || e.type === 'extra') {
      const isExtra = e.type === 'extra';

      const row1 = document.createElement('div');
      row1.className = 'effect-line';

      const fromSel = document.createElement('select');
      fromSel.title = 'Источник';
      const toSel = document.createElement('select');
      toSel.title = 'Цель';
      const arrow = document.createElement('span');
      arrow.className = 'effect-arrow';
      arrow.textContent = '→';

      function fillFrom() {
        fromSel.innerHTML = '';
        for (const st of state.stats) {
          const opt = document.createElement('option');
          opt.value = st.id;
          opt.textContent = st.name;
          if (st.id === e.from) opt.selected = true;
          fromSel.appendChild(opt);
        }
      }
      function fillTo() {
        toSel.innerHTML = '';
        for (const st of state.stats) {
          if (st.id === e.from) continue;
          const opt = document.createElement('option');
          opt.value = st.id;
          opt.textContent = st.name;
          if (st.id === e.to) opt.selected = true;
          toSel.appendChild(opt);
        }
      }

      fromSel.addEventListener('change', ev => {
        e.from = ev.target.value;
        if (e.from === e.to) {
          const alt = state.stats.find(s => s.id !== e.from);
          if (alt) e.to = alt.id;
        }
        fillTo();
        renderNodes();
        commit();
        updateHistoryButtons();
      });
      toSel.addEventListener('change', ev => {
        e.to = ev.target.value;
        renderNodes();
        commit();
        updateHistoryButtons();
      });

      fillFrom();
      fillTo();

      row1.appendChild(fromSel);
      row1.appendChild(arrow);
      row1.appendChild(toSel);
      body.appendChild(row1);

      body.appendChild(makeLine(
        isExtra ? 'Берётся' : 'Конвертируется',
        makeNumInput(e.percent, v => { e.percent = v; }, 'Отношение: сколько % источника берём'),
        makeSuffix('% источника')
      ));
      body.appendChild(makeLine(
        'Рейт',
        makeNumInput(e.rate, v => { e.rate = v; }, 'Множитель к значению эффекта'),
        makeSuffix('%')
      ));
      return body;
    }

    if (e.type === 'set') {
      body.appendChild(makeLine('Стат', makeStatSelect(e.to, v => { e.to = v; }, 'Целевой стат')));
      body.appendChild(makeLine('Значение', makeNumInput(e.value, v => { e.value = v; }, 'Значение, которое устанавливается')));
      const note = document.createElement('div');
      note.className = 'effect-note';
      note.textContent = 'Заменяет значение цели (без PxM). При нескольких set побеждает минимальное.';
      body.appendChild(note);
      return body;
    }

    if (e.type === 'perEach') {
      const row1 = document.createElement('div');
      row1.className = 'effect-line';

      const fromSel = document.createElement('select');
      fromSel.title = 'Источник';
      const toSel = document.createElement('select');
      toSel.title = 'Цель';

      function fillFrom() {
        fromSel.innerHTML = '';
        for (const st of state.stats) {
          const opt = document.createElement('option');
          opt.value = st.id;
          opt.textContent = st.name;
          if (st.id === e.from) opt.selected = true;
          fromSel.appendChild(opt);
        }
      }
      function fillTo() {
        toSel.innerHTML = '';
        for (const st of state.stats) {
          if (st.id === e.from) continue;
          const opt = document.createElement('option');
          opt.value = st.id;
          opt.textContent = st.name;
          if (st.id === e.to) opt.selected = true;
          toSel.appendChild(opt);
        }
      }

      fromSel.addEventListener('change', ev => {
        e.from = ev.target.value;
        if (e.from === e.to) {
          const alt = state.stats.find(s => s.id !== e.from);
          if (alt) e.to = alt.id;
        }
        fillTo();
        renderNodes();
        commit();
        updateHistoryButtons();
      });
      toSel.addEventListener('change', ev => {
        e.to = ev.target.value;
        renderNodes();
        commit();
        updateHistoryButtons();
      });

      fillFrom();
      fillTo();

      const lbl = document.createElement('span');
      lbl.className = 'effect-arrow';
      lbl.textContent = 'за каждые';
      const stepInput = makeNumInput(e.step, v => { e.step = v; }, 'Шаг: за каждые N единиц источника');
      row1.appendChild(fromSel);
      row1.appendChild(lbl);
      row1.appendChild(stepInput);
      body.appendChild(row1);

      const row2 = document.createElement('div');
      row2.className = 'effect-line';
      const arrow = document.createElement('span');
      arrow.className = 'effect-arrow';
      arrow.textContent = '→';
      const bonusInput = makeNumInput(e.bonus, v => { e.bonus = v; }, 'Бонус за каждые N единиц');
      row2.appendChild(arrow);
      row2.appendChild(bonusInput);
      row2.appendChild(toSel);
      body.appendChild(row2);
      return body;
    }

    if (e.type === 'perAbove') {
      const row1 = document.createElement('div');
      row1.className = 'effect-line';

      const fromSel = document.createElement('select');
      fromSel.title = 'Источник';
      const toSel = document.createElement('select');
      toSel.title = 'Цель';

      function fillFrom() {
        fromSel.innerHTML = '';
        for (const st of state.stats) {
          const opt = document.createElement('option');
          opt.value = st.id;
          opt.textContent = st.name;
          if (st.id === e.from) opt.selected = true;
          fromSel.appendChild(opt);
        }
      }
      function fillTo() {
        toSel.innerHTML = '';
        for (const st of state.stats) {
          if (st.id === e.from) continue;
          const opt = document.createElement('option');
          opt.value = st.id;
          opt.textContent = st.name;
          if (st.id === e.to) opt.selected = true;
          toSel.appendChild(opt);
        }
      }

      fromSel.addEventListener('change', ev => {
        e.from = ev.target.value;
        if (e.from === e.to) {
          const alt = state.stats.find(s => s.id !== e.from);
          if (alt) e.to = alt.id;
        }
        fillTo();
        renderNodes();
        commit();
        updateHistoryButtons();
      });
      toSel.addEventListener('change', ev => {
        e.to = ev.target.value;
        renderNodes();
        commit();
        updateHistoryButtons();
      });

      fillFrom();
      fillTo();

      const lbl = document.createElement('span');
      lbl.className = 'effect-arrow';
      lbl.textContent = 'свыше';
      const thrInput = makeNumInput(e.threshold, v => { e.threshold = v; }, 'Порог');
      row1.appendChild(fromSel);
      row1.appendChild(lbl);
      row1.appendChild(thrInput);
      body.appendChild(row1);

      const row2 = document.createElement('div');
      row2.className = 'effect-line';
      const lbl2 = document.createElement('span');
      lbl2.className = 'effect-arrow';
      lbl2.textContent = 'за каждую ед. →';
      const bonusInput = makeNumInput(e.bonus, v => { e.bonus = v; }, 'Бонус за каждую единицу свыше порога');
      row2.appendChild(lbl2);
      row2.appendChild(bonusInput);
      row2.appendChild(toSel);
      body.appendChild(row2);
      return body;
    }

    if (e.type === 'perTag') {
      const row1 = document.createElement('div');
      row1.className = 'effect-line';
      const lbl = document.createElement('span');
      lbl.className = 'effect-arrow';
      lbl.textContent = 'За каждые';
      const stepInput = makeNumInput(e.step, v => { e.step = v; }, 'За каждые N нод с тегом');

      const tagSel = document.createElement('select');
      tagSel.title = 'Тег';
      if (state.tags.length === 0) {
        const opt = document.createElement('option');
        opt.value = ''; opt.textContent = '(нет тегов)';
        tagSel.appendChild(opt);
        e.tag = '';
      } else {
        if (!state.tags.includes(e.tag)) {
          e.tag = state.tags[0];
        }
        for (const t of state.tags) {
          const opt = document.createElement('option');
          opt.value = t; opt.textContent = t;
          if (t === e.tag) opt.selected = true;
          tagSel.appendChild(opt);
        }
      }
      tagSel.addEventListener('change', ev => {
        e.tag = ev.target.value;
        renderNodes();
        commit();
        updateHistoryButtons();
      });

      const cntSpan = document.createElement('span');
      cntSpan.className = 'effect-note';
      cntSpan.style.marginLeft = '4px';
      cntSpan.textContent = '(всего: ' + countTaggedAll(e.tag) + ')';

      row1.appendChild(lbl);
      row1.appendChild(stepInput);
      row1.appendChild(tagSel);
      row1.appendChild(cntSpan);
      body.appendChild(row1);

      const row2 = document.createElement('div');
      row2.className = 'effect-line';
      const arrow = document.createElement('span');
      arrow.className = 'effect-arrow';
      arrow.textContent = '→';
      const bonusInput = makeNumInput(e.bonus, v => { e.bonus = v; }, 'Бонус за каждые N нод');

      const kindSel = document.createElement('select');
      kindSel.style.flex = '0 0 90px';
      kindSel.title = 'Тип бонуса';
      const targetStatForKind = getStat(e.to);
      const avail = targetStatForKind ? enabledTypes(targetStatForKind) : ['flat'];
      if (!avail.includes(e.kind)) e.kind = avail[0];
      for (const k of avail) {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = { flat: 'плоск.', percent: 'проц.', more: 'множ.' }[k];
        if (e.kind === k) opt.selected = true;
        kindSel.appendChild(opt);
      }
      kindSel.addEventListener('change', ev => {
        e.kind = ev.target.value;
        renderNodes();
        commit();
        updateHistoryButtons();
      });

      const toSel = document.createElement('select');
      toSel.title = 'Стат';
      for (const st of state.stats) {
        const opt = document.createElement('option');
        opt.value = st.id; opt.textContent = st.name;
        if (st.id === e.to) opt.selected = true;
        toSel.appendChild(opt);
      }
      toSel.addEventListener('change', ev => {
        e.to = ev.target.value;
        renderList();
        renderNodes();
        commit();
        updateHistoryButtons();
      });

      row2.appendChild(arrow);
      row2.appendChild(bonusInput);
      row2.appendChild(kindSel);
      row2.appendChild(toSel);
      body.appendChild(row2);
      return body;
    }

    if (e.type === 'condition') {
      const row1 = document.createElement('div');
      row1.className = 'effect-line';
      const ifLbl = document.createElement('span');
      ifLbl.className = 'effect-arrow';
      ifLbl.textContent = 'Если';
      const leftSel = makeStatSelect(e.left, v => { e.left = v; }, 'Левый стат');

      const opSel = document.createElement('select');
      opSel.style.flex = '0 0 64px';
      opSel.title = 'Сравнение';
      for (const op of ['>', '<', '>=', '<=', '=']) {
        const opt = document.createElement('option');
        opt.value = op; opt.textContent = op;
        if (e.op === op) opt.selected = true;
        opSel.appendChild(opt);
      }
      opSel.addEventListener('change', ev => {
        e.op = ev.target.value;
        renderNodes();
        commit();
        updateHistoryButtons();
      });

      const rkSel = document.createElement('select');
      rkSel.style.flex = '0 0 90px';
      rkSel.title = 'С чем сравнивать';
      for (const [v, l] of [['number', 'число'], ['stat', 'стат']]) {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = l;
        if (e.rightKind === v) opt.selected = true;
        rkSel.appendChild(opt);
      }
      rkSel.addEventListener('change', ev => {
        e.rightKind = ev.target.value;
        renderList();
        renderNodes();
        commit();
        updateHistoryButtons();
      });

      row1.appendChild(ifLbl);
      row1.appendChild(leftSel);
      row1.appendChild(opSel);
      row1.appendChild(rkSel);
      body.appendChild(row1);

      if (e.rightKind === 'stat') {
        body.appendChild(makeLine('сравнить с',
          makeStatSelect(e.rightStat, v => { e.rightStat = v; }, 'Правый стат')
        ));
      } else {
        body.appendChild(makeLine('значение',
          makeNumInput(e.rightNumber, v => { e.rightNumber = v; }, 'Число для сравнения')
        ));
      }

      const rewardsTitle = document.createElement('div');
      rewardsTitle.className = 'effect-note';
      rewardsTitle.textContent = 'Тогда нода даёт:';
      body.appendChild(rewardsTitle);

      if (!Array.isArray(e.rewards)) e.rewards = [];

      const rewardsList = document.createElement('div');
      rewardsList.className = 'rewards-list';
      body.appendChild(rewardsList);

      const TYPE_LABELS = { flat: 'плоск.', more: 'множ.' };

      function renderRewards() {
        rewardsList.innerHTML = '';
        e.rewards.forEach((r, rIdx) => {
          const row = document.createElement('div');
          row.className = 'effect-line';

          const targetStat = getStat(r.to);
          let available = targetStat
            ? ['flat', 'more'].filter(k => targetStat.types[k])
            : ['flat'];
          if (available.length === 0) available = ['flat'];
          if (!available.includes(r.kind)) {
            r.kind = available[0];
          }

          const toSel = document.createElement('select');
          toSel.title = 'Стат награды';
          for (const st of state.stats) {
            const opt = document.createElement('option');
            opt.value = st.id;
            opt.textContent = st.name;
            if (st.id === r.to) opt.selected = true;
            toSel.appendChild(opt);
          }
          toSel.addEventListener('change', ev => {
            r.to = ev.target.value;
            renderRewards();
            renderNodes();
            commit();
            updateHistoryButtons();
          });

          const valInput = makeNumInput(r.value, v => { r.value = v; }, 'Значение награды');

          const kindSel = document.createElement('select');
          kindSel.style.flex = '0 0 90px';
          kindSel.title = 'Тип награды';
          for (const k of available) {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = TYPE_LABELS[k] || k;
            if (r.kind === k) opt.selected = true;
            kindSel.appendChild(opt);
          }
          kindSel.addEventListener('change', ev => {
            r.kind = ev.target.value;
            renderNodes();
            commit();
            updateHistoryButtons();
          });

          const del = document.createElement('button');
          del.className = 'danger mini';
          del.textContent = '×';
          del.title = 'Удалить награду';
          del.addEventListener('click', () => {
            e.rewards.splice(rIdx, 1);
            renderRewards();
            renderNodes();
            commit();
            updateHistoryButtons();
          });

          row.appendChild(toSel);
          row.appendChild(valInput);
          row.appendChild(kindSel);
          row.appendChild(del);
          rewardsList.appendChild(row);
        });

        const addR = document.createElement('button');
        addR.className = 'mini';
        addR.textContent = '+ Награда';
        addR.style.marginTop = '4px';
        addR.addEventListener('click', () => {
          const firstStat = state.stats[0];
          if (!firstStat) return;
          const kinds = ['flat', 'more'].filter(k => firstStat.types[k]);
          const kind = kinds.length > 0 ? kinds[0] : 'flat';
          e.rewards.push({ to: firstStat.id, kind, value: 10 });
          renderRewards();
          renderNodes();
          commit();
          updateHistoryButtons();
        });
        rewardsList.appendChild(addR);
      }

      renderRewards();
      return body;
    }

    if (e.type === 'swap') {
      const row1 = document.createElement('div');
      row1.className = 'effect-line';

      const aSel = document.createElement('select');
      aSel.title = 'Первый стат';
      const bSel = document.createElement('select');
      bSel.title = 'Второй стат';

      function fillA() {
        aSel.innerHTML = '';
        for (const st of state.stats) {
          const opt = document.createElement('option');
          opt.value = st.id;
          opt.textContent = st.name;
          if (st.id === e.a) opt.selected = true;
          aSel.appendChild(opt);
        }
      }
      function fillB() {
        bSel.innerHTML = '';
        for (const st of state.stats) {
          if (st.id === e.a) continue;
          const opt = document.createElement('option');
          opt.value = st.id;
          opt.textContent = st.name;
          if (st.id === e.b) opt.selected = true;
          bSel.appendChild(opt);
        }
      }

      aSel.addEventListener('change', ev => {
        e.a = ev.target.value;
        if (e.a === e.b) {
          const alt = state.stats.find(s => s.id !== e.a);
          if (alt) e.b = alt.id;
        }
        fillB();
        renderNodes();
        commit();
        updateHistoryButtons();
      });
      bSel.addEventListener('change', ev => {
        e.b = ev.target.value;
        renderNodes();
        commit();
        updateHistoryButtons();
      });

      fillA();
      fillB();

      const arrow = document.createElement('span');
      arrow.className = 'effect-arrow';
      arrow.textContent = '↔';

      row1.appendChild(aSel);
      row1.appendChild(arrow);
      row1.appendChild(bSel);
      body.appendChild(row1);

      const note = document.createElement('div');
      note.className = 'effect-note';
      note.textContent = 'Меняет итоговые значения местами. Применяется в конце.';
      body.appendChild(note);
      return body;
    }

    return body;
  }

  renderList();
}

// ---------- Мультивыделение ----------
function renderMultiSelectionPanel(el, nodes) {
  const info = document.createElement('div');
  info.className = 'hint section-box';
  info.innerHTML = `Выделено нод: <b>${nodes.length}</b>`;
  el.appendChild(info);

  const row1 = document.createElement('div');
  row1.className = 'row';

  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Снять выделение';
  clearBtn.addEventListener('click', () => {
    clearSelection();
    refreshAll();
  });

  const delAllBtn = document.createElement('button');
  delAllBtn.className = 'danger';
  delAllBtn.textContent = 'Удалить все';
  delAllBtn.addEventListener('click', () => {
    if (!confirm(`Удалить ${nodes.length} нод (включая потомков)?`)) return;
    deleteNodes(nodes.map(n => n.id));
    commit();
    refreshAll();
  });

  row1.appendChild(clearBtn);
  row1.appendChild(delAllBtn);
  el.appendChild(row1);

  const paletteLabel = document.createElement('label');
  paletteLabel.style.marginTop = '10px';
  paletteLabel.innerHTML = 'Палитра <span class="palette-hint">(ЛКМ — ко всем · ПКМ — удалить)</span>';
  el.appendChild(paletteLabel);

  const paletteEl = document.createElement('div');
  paletteEl.className = 'palette';
  el.appendChild(paletteEl);

  renderPalette(paletteEl, {
    getAddColor: () => nodes[0]?.color || DEFAULT_NODE_COLOR,
    onApply: (col) => {
      for (const n of nodes) n.color = col;
      renderNodes();
    },
  });

  const colorLabel = document.createElement('label');
  colorLabel.style.marginTop = '10px';
  colorLabel.textContent = 'Цвет (ко всем)';
  el.appendChild(colorLabel);

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = nodes[0]?.color || DEFAULT_NODE_COLOR;
  colorInput.addEventListener('input', (e) => {
    for (const n of nodes) n.color = e.target.value;
    renderNodes();
    commitDebounced();
    updateHistoryButtons();
  });
  el.appendChild(colorInput);

  const scaleLabel = document.createElement('label');
  scaleLabel.style.marginTop = '10px';
  scaleLabel.textContent = 'Размер (ко всем)';
  el.appendChild(scaleLabel);

  const scaleRow = document.createElement('div');
  scaleRow.className = 'scale-row';

  const scaleInput = document.createElement('input');
  scaleInput.type = 'range';
  scaleInput.min = '0.3';
  scaleInput.max = '3';
  scaleInput.step = '0.05';

  const scaleValEl = document.createElement('span');
  scaleValEl.className = 'scale-val';

  const initialScale = clampScale(nodes[0]?.scale ?? 1);
  scaleInput.value = initialScale;
  scaleValEl.textContent = Math.round(initialScale * 100) + '%';

  scaleInput.addEventListener('input', (e) => {
    const v = clampScale(e.target.value);
    scaleValEl.textContent = Math.round(v * 100) + '%';
    for (const n of nodes) n.scale = v;
    renderNodes();
    commitDebounced();
    updateHistoryButtons();
  });

  scaleRow.appendChild(scaleInput);
  scaleRow.appendChild(scaleValEl);
  el.appendChild(scaleRow);

  const presets = document.createElement('div');
  presets.className = 'scale-presets';
  [1, 1.25, 1.5, 2].forEach(v => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = Math.round(v * 100) + '%';
    b.addEventListener('click', () => {
      for (const n of nodes) n.scale = v;
      scaleInput.value = v;
      scaleValEl.textContent = Math.round(v * 100) + '%';
      renderNodes();
      commit();
      updateHistoryButtons();
    });
    presets.appendChild(b);
  });
  el.appendChild(presets);
}