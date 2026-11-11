import { state } from './state.js';
import { touch } from './autosave.js';

const h = {
    past: [],
    future: [],
    last: null,
    debounceTimer: null,
};

function snapshot() {
    return JSON.stringify({
        nodes: state.nodes,
        links: state.links,
        notes: state.notes,
        palette: state.palette,
        stats: state.stats,
        tags: state.tags,
        config: state.config,
    });
}

function restore(snap) {
    const data = JSON.parse(snap);
    state.nodes = data.nodes;
    state.links = data.links;
    state.notes = data.notes || [];
    state.palette = data.palette;
    state.stats = data.stats;
    state.tags = data.tags || [];
    if (data.config) state.config = data.config;

    const validIds = new Set(state.nodes.map(n => n.id));
    state.selectedIds = new Set([...state.selectedIds].filter(id => validIds.has(id)));
    if (state.linking && !validIds.has(state.linking)) state.linking = null;

    if (state.selectedNoteId && !state.notes.find(n => n.id === state.selectedNoteId)) {
        state.selectedNoteId = null;
    }
}

export function initHistory() {
    h.past = [];
    h.future = [];
    h.last = snapshot();
    if (h.debounceTimer) { clearTimeout(h.debounceTimer); h.debounceTimer = null; }
}

export function commit() {
    if (h.debounceTimer) {
        clearTimeout(h.debounceTimer);
        h.debounceTimer = null;
    }
    const cur = snapshot();
    if (cur === h.last) return;
    h.past.push(h.last);
    const max = (state.config && state.config.historySize) || 100;
    while (h.past.length > max) h.past.shift();
    h.last = cur;
    h.future = [];
    touch();
}

export function commitDebounced() {
    if (h.debounceTimer) clearTimeout(h.debounceTimer);
    h.debounceTimer = setTimeout(() => {
        h.debounceTimer = null;
        commit();
    }, 400);
}

export function canUndo() {
    return h.past.length > 0 || snapshot() !== h.last;
}

export function canRedo() {
    return h.future.length > 0;
}

export function undo() {
    commit();
    if (!h.past.length) return false;
    h.future.push(h.last);
    h.last = h.past.pop();
    restore(h.last);
    touch();
    return true;
}

export function redo() {
    commit();
    if (!h.future.length) return false;
    h.past.push(h.last);
    h.last = h.future.pop();
    restore(h.last);
    touch();
    return true;
}