import { state } from './state.js';
import { dom } from './dom.js';
import { hexToRgba, DEFAULT_NOTE_COLOR } from './utils.js';

const noteEls = new Map(); // id -> { card, textEl, handle }

export function renderNotes() {
    dom.noteLayer.innerHTML = '';
    noteEls.clear();

    dom.noteLayer.classList.toggle('test-mode', state.mode === 'test');

    for (const note of state.notes) {
        createNoteEls(note);
    }
}

function createNoteEls(note) {
    const selected = state.selectedNoteId === note.id;
    const color = note.color || DEFAULT_NOTE_COLOR;

    const card = document.createElement('div');
    card.className = 'note-card' + (selected ? ' selected' : '');
    card.dataset.noteId = note.id;
    card.style.left = note.x + 'px';
    card.style.top = note.y + 'px';
    card.style.width = note.size + 'px';
    card.style.height = note.size + 'px';
    card.style.background = hexToRgba(color, 0.5);
    card.style.borderColor = color;
    card.style.fontSize = note.fontSize + 'px';

    const textEl = document.createElement('div');
    textEl.className = 'note-text';
    textEl.textContent = note.text || '';
    card.appendChild(textEl);

    const handle = document.createElement('div');
    handle.className = 'note-resize';
    handle.dataset.noteId = note.id;
    card.appendChild(handle);

    dom.noteLayer.appendChild(card);
    noteEls.set(note.id, { card, textEl, handle });
}

export function patchNote(id) {
    const note = state.notes.find(n => n.id === id);
    if (!note) return;

    const refs = noteEls.get(id);
    if (!refs) {
        renderNotes();
        return;
    }

    const { card, textEl } = refs;
    const selected = state.selectedNoteId === note.id;
    const color = note.color || DEFAULT_NOTE_COLOR;

    card.style.left = note.x + 'px';
    card.style.top = note.y + 'px';
    card.style.width = note.size + 'px';
    card.style.height = note.size + 'px';
    card.style.background = hexToRgba(color, 0.5);
    card.style.borderColor = color;
    card.style.fontSize = note.fontSize + 'px';
    card.classList.toggle('selected', selected);

    const nextText = note.text || '';
    if (textEl.textContent !== nextText) textEl.textContent = nextText;
}