import { state } from './state.js';
import { dom } from './dom.js';
import { clampNoteSize, clampFontSize } from './utils.js';
import { getNote, deleteNote } from './note-ops.js';
import { patchNote } from './render-notes.js';
import { commit, commitDebounced } from './history.js';
import { updateHistoryButtons } from './panel-history.js';
import { renderPalette } from './panel-palette.js';
import { refreshAll } from './panel.js';

export function renderNotePanel() {
  const el = dom.nodeSection;
  el.innerHTML = '';

  const note = getNote(state.selectedNoteId);
  if (!note) return;

  const info = document.createElement('div');
  info.className = 'hint section-box';
  info.textContent = 'Редактирование карточки.';
  el.appendChild(info);

  const textLabel = document.createElement('label');
  textLabel.textContent = 'Текст';
  el.appendChild(textLabel);

  const textArea = document.createElement('textarea');
  textArea.value = note.text || '';
  textArea.rows = 6;
  textArea.style.minHeight = '110px';
  textArea.addEventListener('input', (e) => {
    note.text = e.target.value;
    patchNote(note.id);
    commitDebounced();
    updateHistoryButtons();
  });
  el.appendChild(textArea);

  const colorLabel = document.createElement('label');
  colorLabel.style.marginTop = '10px';
  colorLabel.textContent = 'Цвет';
  el.appendChild(colorLabel);

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = note.color;
  colorInput.addEventListener('input', (e) => {
    note.color = e.target.value;
    patchNote(note.id);
    commitDebounced();
    updateHistoryButtons();
  });
  el.appendChild(colorInput);

  const paletteLabel = document.createElement('label');
  paletteLabel.style.marginTop = '10px';
  paletteLabel.innerHTML = 'Палитра <span class="palette-hint">(ЛКМ — применить · ПКМ — удалить)</span>';
  el.appendChild(paletteLabel);

  const paletteEl = document.createElement('div');
  paletteEl.className = 'palette';
  el.appendChild(paletteEl);

  renderPalette(paletteEl, {
    getAddColor: () => note.color,
    onApply: (col) => {
      note.color = col;
      colorInput.value = col;
      patchNote(note.id);
    },
  });

  const sizeLabel = document.createElement('label');
  sizeLabel.style.marginTop = '10px';
  sizeLabel.textContent = 'Размер';
  el.appendChild(sizeLabel);

  const sizeRow = document.createElement('div');
  sizeRow.className = 'scale-row';
  const sizeInput = document.createElement('input');
  sizeInput.type = 'range';
  sizeInput.min = '80';
  sizeInput.max = '800';
  sizeInput.step = '10';
  sizeInput.value = note.size;
  const sizeValEl = document.createElement('span');
  sizeValEl.className = 'scale-val';
  sizeValEl.textContent = note.size + 'px';
  sizeInput.addEventListener('input', (e) => {
    note.size = clampNoteSize(e.target.value);
    sizeValEl.textContent = note.size + 'px';
    patchNote(note.id);
    commitDebounced();
    updateHistoryButtons();
  });
  sizeRow.appendChild(sizeInput);
  sizeRow.appendChild(sizeValEl);
  el.appendChild(sizeRow);

  const fontSizeLabel = document.createElement('label');
  fontSizeLabel.style.marginTop = '10px';
  fontSizeLabel.textContent = 'Размер текста';
  el.appendChild(fontSizeLabel);

  const fontSizeRow = document.createElement('div');
  fontSizeRow.className = 'scale-row';
  const fontSizeInput = document.createElement('input');
  fontSizeInput.type = 'range';
  fontSizeInput.min = '8';
  fontSizeInput.max = '48';
  fontSizeInput.step = '1';
  fontSizeInput.value = note.fontSize;
  const fontSizeValEl = document.createElement('span');
  fontSizeValEl.className = 'scale-val';
  fontSizeValEl.textContent = note.fontSize + 'px';
  fontSizeInput.addEventListener('input', (e) => {
    note.fontSize = clampFontSize(e.target.value);
    fontSizeValEl.textContent = note.fontSize + 'px';
    patchNote(note.id);
    commitDebounced();
    updateHistoryButtons();
  });
  fontSizeRow.appendChild(fontSizeInput);
  fontSizeRow.appendChild(fontSizeValEl);
  el.appendChild(fontSizeRow);

  const delRow = document.createElement('div');
  delRow.className = 'row';
  delRow.style.marginTop = '12px';
  const delBtn = document.createElement('button');
  delBtn.className = 'danger';
  delBtn.textContent = 'Удалить карточку';
  delBtn.addEventListener('click', () => {
    deleteNote(note.id);
    commit();
    refreshAll();
  });
  delRow.appendChild(delBtn);
  el.appendChild(delRow);
}