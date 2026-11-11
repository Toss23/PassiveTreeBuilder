import { state, uid } from './state.js';
import { dom } from './dom.js';
import { commit, commitDebounced } from './history.js';
import { updateHistoryButtons } from './panel-history.js';
import { saveNow } from './autosave.js';
import { renderStatsSection } from './panel-stats.js';
import { renderTagsSection } from './panel-tags.js';
import { validateComputedValue } from './calc.js';

export function renderConfigSection() {
  renderSettingsForm();
  renderStatsSection();
  renderTagsSection();
}

function renderSettingsForm() {
  const el = dom.configSection;
  if (!el) return;
  el.innerHTML = '';
  const c = state.config;

  function group(title) {
    const g = document.createElement('div');
    g.className = 'config-group';
    const t = document.createElement('h3');
    t.textContent = title;
    g.appendChild(t);
    el.appendChild(g);
    return g;
  }

  function numRow(parent, label, key, min, max, step) {
    const row = document.createElement('div');
    row.className = 'config-row';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.min = min; inp.max = max; inp.step = step || 'any';
    inp.value = c[key];
    inp.addEventListener('input', e => {
      const v = Number(e.target.value);
      if (!isFinite(v)) return;
      c[key] = Math.max(min, Math.min(max, v));
      commitDebounced();
      updateHistoryButtons();
    });
    inp.addEventListener('change', () => { saveNow(); });
    row.appendChild(lbl);
    row.appendChild(inp);
    parent.appendChild(row);
  }

  function colorRow(parent, label, key) {
    const row = document.createElement('div');
    row.className = 'config-row';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    const inp = document.createElement('input');
    inp.type = 'color';
    inp.value = c[key];
    inp.addEventListener('input', e => {
      c[key] = e.target.value;
      commitDebounced();
      updateHistoryButtons();
    });
    inp.addEventListener('change', () => { saveNow(); });
    row.appendChild(lbl);
    row.appendChild(inp);
    parent.appendChild(row);
  }

  function boolRow(parent, label, key) {
    const row = document.createElement('div');
    row.className = 'config-row';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    const wrap = document.createElement('div');
    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.checked = !!c[key];
    inp.addEventListener('change', e => {
      c[key] = e.target.checked;
      commit();
      saveNow();
      updateHistoryButtons();
    });
    wrap.appendChild(inp);
    row.appendChild(lbl);
    row.appendChild(wrap);
    parent.appendChild(row);
  }

  function textRow(parent, label, value, onChange) {
    const row = document.createElement('div');
    row.className = 'config-row';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = value;
    inp.addEventListener('input', e => {
      onChange(e.target.value);
      commitDebounced();
      updateHistoryButtons();
    });
    inp.addEventListener('change', () => { saveNow(); });
    row.appendChild(lbl);
    row.appendChild(inp);
    parent.appendChild(row);
  }

  // ---- Новая нода ----
  const gNode = group('Новая нода');
  numRow(gNode, 'Радиус', 'newNodeRadius', 10, 200, 1);
  numRow(gNode, 'Толщина окантовки', 'newNodeStrokeWidth', 0, 20, 1);
  numRow(gNode, 'Масштаб', 'newNodeScale', 0.3, 3, 0.05);
  colorRow(gNode, 'Цвет', 'newNodeColor');

  // ---- Корневая нода ----
  const gRoot = group('Корневая нода');
  numRow(gRoot, 'Радиус', 'newRootRadius', 10, 200, 1);
  numRow(gRoot, 'Толщина окантовки', 'newRootStrokeWidth', 0, 20, 1);

  // ---- Карточка ----
  const gNote = group('Новая карточка');
  numRow(gNote, 'Размер', 'newNoteSize', 80, 800, 10);
  numRow(gNote, 'Размер шрифта', 'newNoteFontSize', 8, 48, 1);
  colorRow(gNote, 'Цвет', 'newNoteColor');

  // ---- Раскладка ----
  const gLayout = group('Раскладка дочерних');
  numRow(gLayout, 'Расстояние', 'childDistance', 50, 500, 10);
  numRow(gLayout, 'Угол между детьми (°)', 'childAngleStepDeg', 5, 180, 1);

  // ---- Вычисляемые значения ----
  const gComputed = group('Вычисляемые значения');
  const compNote = document.createElement('div');
  compNote.className = 'effect-note';
  compNote.style.marginBottom = '8px';
  compNote.style.lineHeight = '1.5';
  compNote.textContent =
    'Формулы: в скобках — имя стата. Операторы: + - * /. ' +
    'Можно ссылаться на значения из этого списка (по порядку сверху вниз). ' +
    'Невалидные записи подсвечиваются красным и не выводятся в тесте.';
  gComputed.appendChild(compNote);

  const compList = document.createElement('div');
  compList.className = 'config-values-list';
  gComputed.appendChild(compList);

  function renderComputedList() {
    compList.innerHTML = '';
    if (!Array.isArray(c.computedValues)) c.computedValues = [];

    const refs = []; // { nameInp, formulaInp, errEl, cv }

    function validateAll() {
      const statNames = new Set();
      for (const st of state.stats) statNames.add(st.name);
      const priorNames = new Set();

      for (const ref of refs) {
        const v = validateComputedValue(ref.cv, statNames, priorNames);

        ref.nameInp.classList.toggle('invalid', !!v.nameError);
        ref.formulaInp.classList.toggle('invalid', !!v.formulaError);
        ref.nameInp.title = v.nameError || '';
        ref.formulaInp.title = v.formulaError || '';

        const firstErr = v.nameError || v.formulaError;
        if (firstErr) {
          ref.errEl.textContent = firstErr;
          ref.errEl.style.display = '';
        } else {
          ref.errEl.textContent = '';
          ref.errEl.style.display = 'none';
          priorNames.add(ref.cv.name.trim());
        }
      }
    }

    if (c.computedValues.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'hint';
      empty.textContent = 'Нет вычисляемых значений.';
      compList.appendChild(empty);
    } else {
      c.computedValues.forEach((cv, idx) => {
        const card = document.createElement('div');
        card.className = 'config-value-card';

        // Верхняя строка: имя + управление
        const header = document.createElement('div');
        header.className = 'config-value-header';

        const nameInp = document.createElement('input');
        nameInp.type = 'text';
        nameInp.placeholder = 'Имя (например, DPS)';
        nameInp.value = cv.name || '';
        nameInp.addEventListener('input', e => {
          cv.name = e.target.value;
          validateAll();
          commitDebounced();
          updateHistoryButtons();
        });
        nameInp.addEventListener('change', () => { saveNow(); });
        header.appendChild(nameInp);

        const up = document.createElement('button');
        up.className = 'mini';
        up.textContent = '↑';
        up.disabled = idx === 0;
        up.addEventListener('click', () => {
          if (idx === 0) return;
          const tmp = c.computedValues[idx - 1];
          c.computedValues[idx - 1] = c.computedValues[idx];
          c.computedValues[idx] = tmp;
          commit();
          saveNow();
          renderComputedList();
          updateHistoryButtons();
        });
        header.appendChild(up);

        const down = document.createElement('button');
        down.className = 'mini';
        down.textContent = '↓';
        down.disabled = idx === c.computedValues.length - 1;
        down.addEventListener('click', () => {
          if (idx === c.computedValues.length - 1) return;
          const tmp = c.computedValues[idx + 1];
          c.computedValues[idx + 1] = c.computedValues[idx];
          c.computedValues[idx] = tmp;
          commit();
          saveNow();
          renderComputedList();
          updateHistoryButtons();
        });
        header.appendChild(down);

        const del = document.createElement('button');
        del.className = 'danger mini';
        del.textContent = '×';
        del.addEventListener('click', () => {
          c.computedValues.splice(idx, 1);
          commit();
          saveNow();
          renderComputedList();
          updateHistoryButtons();
        });
        header.appendChild(del);

        card.appendChild(header);

        // Формула
        const formula = document.createElement('textarea');
        formula.rows = 3;
        formula.placeholder = '(Урон) * (1 + (Крит шанс / 100) * (Крит урон / 100)) * (Скорость атаки)';
        formula.value = cv.formula || '';
        formula.style.minHeight = '60px';
        formula.style.fontFamily = 'ui-monospace, Consolas, monospace';
        formula.style.fontSize = '12px';
        formula.addEventListener('input', e => {
          cv.formula = e.target.value;
          validateAll();
          commitDebounced();
          updateHistoryButtons();
        });
        formula.addEventListener('change', () => { saveNow(); });
        card.appendChild(formula);

        // Строка ошибки
        const errEl = document.createElement('div');
        errEl.className = 'config-value-error';
        errEl.style.display = 'none';
        card.appendChild(errEl);

        refs.push({ nameInp, formulaInp: formula, errEl, cv });
        compList.appendChild(card);
      });
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'mini';
    addBtn.textContent = '+ Добавить значение';
    addBtn.style.marginTop = '8px';
    addBtn.addEventListener('click', () => {
      if (!Array.isArray(c.computedValues)) c.computedValues = [];
      c.computedValues.push({
        id: uid(),
        name: 'Новое значение',
        formula: '',
      });
      commit();
      saveNow();
      renderComputedList();
      updateHistoryButtons();
    });
    compList.appendChild(addBtn);

    validateAll();
  }
  renderComputedList();

  // ---- Автосохранение ----
  const gAutosave = group('Автосохранение');
  boolRow(gAutosave, 'Включено', 'autosaveEnabled');
  numRow(gAutosave, 'Задержка (мс)', 'autosaveDebounceMs', 100, 5000, 50);

  // ---- Undo ----
  const gHistory = group('Undo');
  numRow(gHistory, 'Размер истории', 'historySize', 10, 500, 10);

  // ---- Названия эффектов ----
  const gLabels = group('Названия эффектов');
  const labelsNote = document.createElement('div');
  labelsNote.className = 'effect-note';
  labelsNote.style.marginBottom = '8px';
  labelsNote.textContent = 'Меняет только подписи в редакторе. На расчёт не влияет.';
  gLabels.appendChild(labelsNote);

  const LABEL_ORDER = ['set', 'perTag', 'convert', 'perEach', 'perAbove', 'extra', 'swap', 'condition'];
  for (const id of LABEL_ORDER) {
    textRow(gLabels, id, c.effectLabels[id] || id, v => {
      c.effectLabels[id] = v;
    });
  }

  // ---- Порядок применения ----
  const gOrder = group('Порядок применения');
  const orderNote = document.createElement('div');
  orderNote.className = 'effect-note';
  orderNote.style.marginBottom = '8px';
  orderNote.textContent = 'Фикс. и За теги всегда срабатывают в фиксированном порядке.';
  gOrder.appendChild(orderNote);

  const orderEl = document.createElement('div');
  orderEl.className = 'config-order';
  gOrder.appendChild(orderEl);

  function renderOrderList() {
    orderEl.innerHTML = '';
    c.effectOrder.forEach((id, idx) => {
      const row = document.createElement('div');
      row.className = 'config-order-row';

      const name = document.createElement('span');
      name.textContent = c.effectLabels[id] || id;
      name.style.flex = '1';
      row.appendChild(name);

      const up = document.createElement('button');
      up.className = 'mini';
      up.textContent = '↑';
      up.disabled = idx === 0;
      up.addEventListener('click', () => {
        if (idx === 0) return;
        const tmp = c.effectOrder[idx - 1];
        c.effectOrder[idx - 1] = c.effectOrder[idx];
        c.effectOrder[idx] = tmp;
        commit();
        saveNow();
        renderOrderList();
        updateHistoryButtons();
      });
      row.appendChild(up);

      const down = document.createElement('button');
      down.className = 'mini';
      down.textContent = '↓';
      down.disabled = idx === c.effectOrder.length - 1;
      down.addEventListener('click', () => {
        if (idx === c.effectOrder.length - 1) return;
        const tmp = c.effectOrder[idx + 1];
        c.effectOrder[idx + 1] = c.effectOrder[idx];
        c.effectOrder[idx] = tmp;
        commit();
        saveNow();
        renderOrderList();
        updateHistoryButtons();
      });
      row.appendChild(down);

      orderEl.appendChild(row);
    });
  }
  renderOrderList();
}