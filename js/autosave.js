import { state } from './state.js';

const KEY = 'project-buildsmite:autosave:v1';
const DEBOUNCE_MS = 500;

let timer = null;
let enabled = false;

function buildSnapshot() {
  return {
    version: 1,
    project: 'Project Buildsmite',
    savedAt: new Date().toISOString(),
    mode: state.mode,
    nodes: state.nodes,
    links: state.links,
    notes: state.notes,
    palette: state.palette,
    tags: state.tags,
    stats: state.stats,
    acquired: [...state.acquired],
    selectedIds: [...state.selectedIds],
    selectedNoteId: state.selectedNoteId,
    config: state.config,
  };
}

export function enableAutosave() { enabled = true; }

export function saveNow() {
    if (!enabled) return false;
    try {
        localStorage.setItem(KEY, JSON.stringify(buildSnapshot()));
        return true;
    } catch (e) {
        console.warn('[autosave] save failed:', e);
        return false;
    }
}

export function scheduleAutosave() {
  if (!enabled) return;
  if (!state.config.autosaveEnabled) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    saveNow();
  }, state.config.autosaveDebounceMs);
}

export function cancelScheduledAutosave() {
    if (timer) { clearTimeout(timer); timer = null; }
}

export function loadAutosave() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object') return null;
        if (!Array.isArray(data.nodes)) return null;
        return data;
    } catch (e) {
        console.warn('[autosave] load failed:', e);
        return null;
    }
}

export function clearAutosave() {
    cancelScheduledAutosave();
    try { localStorage.removeItem(KEY); } catch { }
}

export function touch() { scheduleAutosave(); }
export function updateTitle() { }

if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        if (timer) { clearTimeout(timer); timer = null; saveNow(); }
    });
}