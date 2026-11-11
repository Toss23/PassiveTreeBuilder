import { state } from './state.js';
import { dom } from './dom.js';
import {
  initDefaultTree, normalizeNode, normalizeLink, normalizeNote, normalizePalette, normalizeStat,
  reconcileNodeStatTypes, normalizeTags,
} from './utils.js';
import { normalizeConfig } from './config.js';
import { fitView } from './view.js';
import { refreshAll } from './panel.js';
import { initHistory } from './history.js';
import { clearAutosave, loadAutosave, saveNow } from './autosave.js';

export function setupIO() {
  dom.btnSave.addEventListener('click', () => {
    const payload = {
      version: 10,
      project: 'Project Buildsmite',
      savedAt: new Date().toISOString(),
      config: state.config,
      stats: state.stats,
      palette: state.palette,
      tags: state.tags,
      nodes: state.nodes.map(n => ({ ...n, stats: n.stats || [] })),
      links: state.links.map(l => ({ id: l.id, a: l.a, b: l.b })),
      notes: state.notes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'passive-tree.json';
    a.click();
    URL.revokeObjectURL(url);

    state.dirty = false;
    refreshAll();
  });

  dom.btnLoad.addEventListener('click', () => dom.fileInput.click());

  dom.fileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (Array.isArray(data)) {
          // очень старый формат — только массив нод
          state.stats = state.stats || [];
          state.nodes = data.map(normalizeNode);
          state.links = [];
          state.notes = [];
          state.tags = [];
        } else {
          state.config = normalizeConfig(data.config);
          state.stats = Array.isArray(data.stats) ? data.stats.map(normalizeStat) : [];
          state.nodes = Array.isArray(data.nodes) ? data.nodes.map(normalizeNode) : [];
          const validIds = new Set(state.nodes.map(n => n.id));
          state.links = Array.isArray(data.links)
            ? data.links.map(l => normalizeLink(l, validIds)).filter(Boolean)
            : [];
          state.notes = Array.isArray(data.notes) ? data.notes.map(normalizeNote) : [];

          const loadedPalette = normalizePalette(data.palette);
          if (loadedPalette) state.palette = loadedPalette;

          const loadedTags = normalizeTags(data.tags);
          if (loadedTags) state.tags = loadedTags;
        }

        reconcileNodeStatTypes();

        state.selectedIds = new Set();
        state.selectedNoteId = null;
        state.acquired.clear();
        state.linking = null;
        state.search = { query: '' };
        state.dirty = false;
        state.mode = 'edit';
        initHistory();
        clearAutosave();
        saveNow();
        refreshAll();
        fitView();
      } catch (err) {
        alert('Не удалось загрузить JSON: ' + err.message);
      }
    };
    reader.readAsText(f);
    dom.fileInput.value = '';
  });

  dom.btnNew.addEventListener('click', () => {
    if (!confirm('Удалить текущее дерево и создать новое?')) return;
    initDefaultTree();
    state.dirty = false;
    state.mode = 'edit';
    initHistory();
    clearAutosave();
    saveNow();
    refreshAll();
    fitView();
  });

  dom.btnFit.addEventListener('click', fitView);
}

export function applyAutosave() {
  const data = loadAutosave();
  if (!data) return false;

  try {
    state.config = normalizeConfig(data.config);
    state.stats = Array.isArray(data.stats) ? data.stats.map(normalizeStat) : [];
    state.nodes = Array.isArray(data.nodes) ? data.nodes.map(normalizeNode) : [];
    const validIds = new Set(state.nodes.map(n => n.id));

    state.links = Array.isArray(data.links)
      ? data.links.map(l => normalizeLink(l, validIds)).filter(Boolean)
      : [];

    state.notes = Array.isArray(data.notes) ? data.notes.map(normalizeNote) : [];

    const loadedPalette = normalizePalette(data.palette);
    if (loadedPalette) state.palette = loadedPalette;

    const loadedTags = normalizeTags(data.tags);
    if (loadedTags) state.tags = loadedTags;

    reconcileNodeStatTypes();

    const acquired = Array.isArray(data.acquired)
      ? data.acquired.filter(id => validIds.has(id))
      : [];
    state.acquired = new Set(acquired);

    const selected = Array.isArray(data.selectedIds)
      ? data.selectedIds.filter(id => validIds.has(id))
      : [];
    state.selectedIds = new Set(selected);

    state.selectedNoteId = (data.selectedNoteId && state.notes.find(n => n.id === data.selectedNoteId))
      ? data.selectedNoteId
      : null;

    state.mode = (data.mode === 'test' || data.mode === 'settings') ? data.mode : 'edit';
    state.linking = null;
    state.search = { query: '' };

    initHistory();
    refreshAll();
    fitView();
    return true;
  } catch (e) {
    console.warn('[autosave] apply failed:', e);
    return false;
  }
}