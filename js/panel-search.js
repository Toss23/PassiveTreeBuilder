import { state } from './state.js';
import { dom } from './dom.js';
import { renderSVG } from './render-svg.js';

function ensureSearchStructure() {
  if (dom.searchSection.querySelector('#search-query-input')) return;
  dom.searchSection.innerHTML = `
    <div class="search-section">
      <input type="text" id="search-query-input"
             placeholder="Поиск: имя, описание, стат, эффект, тег…" />
      <button type="button" id="search-clear" title="Очистить">×</button>
    </div>
  `;

  const input = document.getElementById('search-query-input');
  const clear = document.getElementById('search-clear');

  input.addEventListener('input', (e) => {
    state.search.query = e.target.value;
    renderSVG();
  });

  clear.addEventListener('click', () => {
    state.search.query = '';
    input.value = '';
    renderSVG();
  });
}

export function renderSearchSection() {
  ensureSearchStructure();
  const input = document.getElementById('search-query-input');
  if (input.value !== state.search.query) input.value = state.search.query;
}