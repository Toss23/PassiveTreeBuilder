import { state } from './state.js';
import { dom } from './dom.js';
import { renderSVG } from './render-svg.js';
import { renderNotes } from './render-notes.js';
import { updateHistoryButtons } from './panel-history.js';
import { renderSearchSection } from './panel-search.js';
import { renderNodeSection } from './panel-node.js';
import { renderNotePanel } from './panel-note.js';
import { renderTestSection } from './panel-test.js';
import { renderConfigSection } from './panel-config.js';

export { updateHistoryButtons };

export function refreshAll() {
  renderSVG();
  renderNotes();
  renderPanel();
}

export function renderPanel() {
  document.querySelectorAll('.mode-tabs button').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === state.mode);
  });
  dom.panelEdit.style.display = state.mode === 'edit' ? '' : 'none';
  dom.panelTest.style.display = state.mode === 'test' ? '' : 'none';
  if (dom.panelConfig) {
    dom.panelConfig.style.display = state.mode === 'settings' ? '' : 'none';
  }
  dom.svg.classList.toggle('linking', state.mode === 'edit' && !!state.linking);

  updateHistoryButtons();

  if (state.mode === 'edit') {
    renderSearchSection();
    if (state.selectedNoteId) {
      renderNotePanel();
    } else {
      renderNodeSection();
    }
  } else if (state.mode === 'test') {
    renderTestSection();
  } else if (state.mode === 'settings') {
    renderConfigSection();
  }
}