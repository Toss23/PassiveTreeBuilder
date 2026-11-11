import { state, uid, view } from './state.js';
import { dom } from './dom.js';
import { DEFAULT_NOTE_COLOR } from './utils.js';

export function getNote(id) {
    return state.notes.find(n => n.id === id);
}

// ��������� �������� � ����� �������� ����.
export function addNote() {
    const r = dom.svg.getBoundingClientRect();
    const cx = ((r.width / 2) - view.x) / view.k;
    const cy = ((r.height / 2) - view.y) / view.k;
    
    const size = state.config.newNoteSize;
    const note = {
    id: uid(),
    x: cx - size / 2,
    y: cy - size / 2,
    size,
    text: '',
    color: state.config.newNoteColor,
    fontSize: state.config.newNoteFontSize,
    };
    state.notes.push(note);
    state.selectedNoteId = note.id;
    state.selectedIds.clear();
    return note;
}

export function deleteNote(id) {
    const before = state.notes.length;
    state.notes = state.notes.filter(n => n.id !== id);
    if (state.selectedNoteId === id) state.selectedNoteId = null;
    return state.notes.length !== before;
}