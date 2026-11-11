import { state } from './state.js';
import { commit } from './history.js';
import { updateHistoryButtons } from './panel-history.js';

export function renderPalette(el, { getAddColor, onApply }) {
  el.innerHTML = '';

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'palette-add';
  add.textContent = '+';
  add.title = 'Добавить цвет в палитру';
  add.addEventListener('click', () => {
    const col = getAddColor();
    if (!col) return;
    const norm = col.toLowerCase();
    if (!state.palette.includes(norm)) {
      state.palette.push(norm);
      commit();
      renderPalette(el, { getAddColor, onApply });
      updateHistoryButtons();
    }
  });
  el.appendChild(add);

  if (state.palette.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'palette-empty';
    empty.textContent = 'Палитра пуста — нажми «+»';
    el.appendChild(empty);
    return;
  }

  state.palette.forEach((col, idx) => {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'palette-swatch';
    sw.style.background = col;
    sw.title = `${col}\nЛКМ — применить\nПКМ — удалить`;
    sw.addEventListener('click', () => {
      onApply(col);
      commit();
      updateHistoryButtons();
    });
    sw.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      state.palette.splice(idx, 1);
      commit();
      renderPalette(el, { getAddColor, onApply });
      updateHistoryButtons();
    });
    el.appendChild(sw);
  });
}