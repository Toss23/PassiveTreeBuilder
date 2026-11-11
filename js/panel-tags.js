import { state } from './state.js';
import { dom } from './dom.js';
import { commit, commitDebounced } from './history.js';
import { updateHistoryButtons } from './panel-history.js';
import { renderNodeSection } from './panel-node.js';

export function renderTagsSection() {
  const el = dom.tagsSection;
  if (!el) return;
  el.innerHTML = '';

  if (!Array.isArray(state.tags)) state.tags = [];

  const list = document.createElement('div');
  list.className = 'tags-list';
  el.appendChild(list);

  state.tags.forEach((tag, idx) => {
    const row = document.createElement('div');
    row.className = 'tag-row';

    const name = document.createElement('input');
    name.type = 'text';
    name.value = tag;
    name.placeholder = 'название тега';
    name.addEventListener('input', e => {
      const oldTag = state.tags[idx];
      const newTag = e.target.value;
      state.tags[idx] = newTag;
      for (const n of state.nodes) {
        if (!Array.isArray(n.tags)) continue;
        n.tags = n.tags.map(t => t === oldTag ? newTag : t);
      }
      for (const n of state.nodes) {
        if (!Array.isArray(n.effects)) continue;
        for (const ef of n.effects) {
          if (ef.type === 'perTag' && ef.tag === oldTag) {
            ef.tag = newTag;
          }
        }
      }
      commitDebounced();
      updateHistoryButtons();
    });
    name.addEventListener('blur', () => {
      const cleaned = [];
      for (const t of state.tags) {
        const s = (t || '').trim();
        if (s && !cleaned.includes(s)) cleaned.push(s);
      }
      if (JSON.stringify(cleaned) !== JSON.stringify(state.tags)) {
        state.tags = cleaned;
        commit();
        renderTagsSection();
        renderNodeSection();
        updateHistoryButtons();
      }
    });
    row.appendChild(name);

    const del = document.createElement('button');
    del.className = 'danger mini';
    del.textContent = '×';
    del.title = 'Удалить тег';
    del.addEventListener('click', () => {
      const t = state.tags[idx];
      if (!confirm(`Удалить тег "${t}"? Он будет убран со всех нод.`)) return;
      state.tags.splice(idx, 1);
      for (const n of state.nodes) {
        if (Array.isArray(n.tags)) n.tags = n.tags.filter(x => x !== t);
      }
      for (const n of state.nodes) {
        if (!Array.isArray(n.effects)) continue;
        for (const ef of n.effects) {
          if (ef.type === 'perTag' && ef.tag === t) ef.tag = '';
        }
      }
      commit();
      renderTagsSection();
      renderNodeSection();
      updateHistoryButtons();
    });
    row.appendChild(del);

    list.appendChild(row);
  });

  const add = document.createElement('button');
  add.className = 'mini';
  add.textContent = '+ Добавить тег';
  add.style.marginTop = '6px';
  add.addEventListener('click', () => {
    let i = 1;
    let name = 'тег';
    while (state.tags.includes(name)) { i++; name = 'тег' + i; }
    state.tags.push(name);
    commit();
    renderTagsSection();
    renderNodeSection();
    updateHistoryButtons();
  });
  el.appendChild(add);
}