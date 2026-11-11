import { state, view, getNode, isSelected, setSelection, toggleSelection, clearSelection } from './state.js';
import { dom } from './dom.js';
import { applyView, toWorld } from './view.js';
import {
  addChild, deleteNode, addLink, deleteLink, unacquireCascade, duplicateNodes,
} from './node-ops.js';
import { getNote, addNote, deleteNote } from './note-ops.js';
import { renderSVG, renderNodes } from './render-svg.js';
import { renderNotes, patchNote } from './render-notes.js';
import { refreshAll, updateHistoryButtons } from './panel.js';
import { isAcquirable, clampScale, clampNoteSize, DEFAULT_NODE_COLOR } from './utils.js';
import { commit, undo, redo } from './history.js';
import { touch } from './autosave.js';
import { showNodeTooltip, hideTooltip } from './tooltip.js';

export function setupInteractions() {
  let drag = null;
  let rectScreen = null;
  const pointers = new Map(); // pointerId -> { x, y }
  let pinch = null;           // { startDist, startK, worldX, worldY }

  // ---- Multi-touch helpers ----
  function addPointer(e) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
  function movePointer(e) {
    const p = pointers.get(e.pointerId);
    if (p) { p.x = e.clientX; p.y = e.clientY; }
  }
  function removePointer(e) {
    pointers.delete(e.pointerId);
  }

  function startPinch() {
    if (pointers.size < 2) return;
    const pts = [...pointers.values()];
    const [p1, p2] = pts;
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const cx = (p1.x + p2.x) / 2;
    const cy = (p1.y + p2.y) / 2;
    const r = dom.svg.getBoundingClientRect();
    const mx = cx - r.left;
    const my = cy - r.top;
    const wx = (mx - view.x) / view.k;
    const wy = (my - view.y) / view.k;
    pinch = { startDist: dist, startK: view.k, worldX: wx, worldY: wy };
    drag = null;
    rectScreen = null;
    dom.selectionRect.style.display = 'none';
    dom.svg.classList.remove('panning');
    hideTooltip();
  }

  function updatePinch() {
    if (!pinch || pointers.size < 2) return;
    const pts = [...pointers.values()];
    const [p1, p2] = pts;
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (pinch.startDist < 5) return;
    const scale = dist / pinch.startDist;
    view.k = Math.max(0.15, Math.min(3.5, pinch.startK * scale));
    const r = dom.svg.getBoundingClientRect();
    const cx = (p1.x + p2.x) / 2;
    const cy = (p1.y + p2.y) / 2;
    const mx = cx - r.left;
    const my = cy - r.top;
    view.x = mx - pinch.worldX * view.k;
    view.y = my - pinch.worldY * view.k;
    applyView();
  }

  function endPinch() {
    pinch = null;
  }

  // ---- Кнопка «Добавить карточку» ----
  dom.btnAddNote.addEventListener('click', () => {
    addNote();
    commit();
    refreshAll();
  });

  // ---- Карточки ----
  dom.noteLayer.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    addPointer(e);
    movePointer(e);

    if (pointers.size === 2) {
      startPinch();
      e.preventDefault();
      return;
    }
    if (pinch) return;

    if (state.mode !== 'edit') return;

    const handleEl = e.target.closest ? e.target.closest('.note-resize') : null;
    const cardEl   = e.target.closest ? e.target.closest('.note-card')   : null;

    if (handleEl) {
      const noteId = handleEl.dataset.noteId;
      const note = getNote(noteId);
      if (!note) return;
      const p = toWorld(e.clientX, e.clientY);
      drag = { type: 'noteResize', id: noteId, startSize: note.size, startWorld: p };
      e.preventDefault();
      return;
    }

    if (cardEl) {
      const noteId = cardEl.dataset.noteId;
      const note = getNote(noteId);
      if (!note) return;
      state.selectedNoteId = noteId;
      state.selectedIds.clear();
      const p = toWorld(e.clientX, e.clientY);
      drag = { type: 'note', id: noteId, offX: p.x - note.x, offY: p.y - note.y };
      refreshAll();
      e.preventDefault();
      return;
    }
  });

  // ---- SVG: ноды, связи, фон ----
  dom.svg.addEventListener('pointerdown', (e) => {
    if (e.button === 2) return;
    addPointer(e);
    movePointer(e);

    if (pointers.size === 2) {
      startPinch();
      e.preventDefault();
      return;
    }
    if (pinch) return;

    hideTooltip();

    const nodeEl    = e.target.closest ? e.target.closest('.node-g')   : null;
    const linkHitEl = e.target.closest ? e.target.closest('.link-hit') : null;

    // Режим связи
    if (state.mode === 'edit' && state.linking) {
      if (nodeEl) {
        const targetId = nodeEl.dataset.id;
        if (targetId !== state.linking) {
          addLink(state.linking, targetId);
          commit();
        }
        state.linking = null;
        refreshAll();
      } else {
        state.linking = null;
        refreshAll();
      }
      e.preventDefault();
      return;
    }

    // TEST
    if (state.mode === 'test') {
      if (nodeEl) {
        const id = nodeEl.dataset.id;
        // Не берём нод сразу — ждём pointerup.
        // Если палец сдвинется, превратим в панораму и отменим тап.
        drag = {
          type: 'pendingTestTap',
          nodeId: id,
          startScreen: { x: e.clientX, y: e.clientY },
        };
      } else {
        dom.svg.classList.add('panning');
        drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      }
      e.preventDefault();
      return;
    }

    // SETTINGS — только панорама
    if (state.mode === 'settings') {
      dom.svg.classList.add('panning');
      drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      e.preventDefault();
      return;
    }

    // EDIT
    if (linkHitEl) { e.preventDefault(); return; }

    if (nodeEl) {
      const id = nodeEl.dataset.id;
      const shift = e.shiftKey;
      const wasSelected = isSelected(id);
      const isTouch = e.pointerType === 'touch';

      if (shift) {
        toggleSelection(id);
        state.selectedNoteId = null;
        refreshAll();
        e.preventDefault();
        return;
      }

      // Тач + невыделенный нод: не выделяем сразу, ждём pointerup
      if (isTouch && !wasSelected) {
        drag = {
          type: 'pendingNodeTap',
          nodeId: id,
          startScreen: { x: e.clientX, y: e.clientY },
        };
        e.preventDefault();
        return;
      }

      // Мышь или уже выделенный нод
      if (!wasSelected) setSelection([id]);
      state.selectedNoteId = null;
      refreshAll();

      const ids = [...state.selectedIds];
      const startWorld = toWorld(e.clientX, e.clientY);
      const items = ids.map(sid => {
        const nn = getNode(sid);
        return { id: sid, x0: nn.x, y0: nn.y };
      });
      drag = { type: 'nodes', items, startWorld };
    } else {
      if (e.shiftKey) {
        const r = dom.svg.getBoundingClientRect();
        rectScreen = { x0: e.clientX - r.left, y0: e.clientY - r.top };
        dom.selectionRect.style.display = '';
        drag = { type: 'rect' };
        updateSelectionRect(e.clientX - r.left, e.clientY - r.top);
      } else {
        const hadAny = state.selectedIds.size || state.selectedNoteId;
        clearSelection();
        state.selectedNoteId = null;
        if (hadAny) refreshAll();
        dom.svg.classList.add('panning');
        drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      }
    }
    e.preventDefault();
  });

  function updateSelectionRect(xs, ys) {
    if (!rectScreen) return;
    const x = Math.min(rectScreen.x0, xs);
    const y = Math.min(rectScreen.y0, ys);
    const w = Math.abs(xs - rectScreen.x0);
    const h = Math.abs(ys - rectScreen.y0);
    const rect = dom.selectionRect;
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
  }

  function screenToWorld(xs, ys) {
    return { x: (xs - view.x) / view.k, y: (ys - view.y) / view.k };
  }

  function applyRectSelection(xs, ys) {
    if (!rectScreen) return;
    const p1 = screenToWorld(rectScreen.x0, rectScreen.y0);
    const p2 = screenToWorld(xs, ys);
    const minX = Math.min(p1.x, p2.x), maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y), maxY = Math.max(p1.y, p2.y);

    const ids = [];
    for (const n of state.nodes) {
      if (n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY) {
        ids.push(n.id);
      }
    }
    setSelection(ids);
    state.selectedNoteId = null;
    renderSVG();
    renderNotes();
  }

  // ---- Движение ----
  window.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) movePointer(e);

    if (pinch && pointers.size >= 2) {
      updatePinch();
      return;
    }

    if (!drag) return;

    if (drag.type === 'pendingNodeTap' || drag.type === 'pendingTestTap') {
      const dx = e.clientX - drag.startScreen.x;
      const dy = e.clientY - drag.startScreen.y;
      if (Math.hypot(dx, dy) > 8) {
        drag = {
          type: 'pan',
          sx: drag.startScreen.x,
          sy: drag.startScreen.y,
          vx: view.x,
          vy: view.y,
        };
        dom.svg.classList.add('panning');
      }
      return;
    }

    if (drag.type === 'nodes') {
      const cur = toWorld(e.clientX, e.clientY);
      const dx = cur.x - drag.startWorld.x;
      const dy = cur.y - drag.startWorld.y;
      for (const it of drag.items) {
        const n = getNode(it.id);
        if (!n) continue;
        n.x = it.x0 + dx;
        n.y = it.y0 + dy;
      }
      renderSVG();
    } else if (drag.type === 'note') {
      const p = toWorld(e.clientX, e.clientY);
      const note = getNote(drag.id);
      if (!note) return;
      note.x = p.x - drag.offX;
      note.y = p.y - drag.offY;
      patchNote(drag.id);
    } else if (drag.type === 'noteResize') {
      const p = toWorld(e.clientX, e.clientY);
      const note = getNote(drag.id);
      if (!note) return;
      const dx = p.x - drag.startWorld.x;
      note.size = clampNoteSize(drag.startSize + dx);
      patchNote(drag.id);
    } else if (drag.type === 'pan') {
      view.x = drag.vx + (e.clientX - drag.sx);
      view.y = drag.vy + (e.clientY - drag.sy);
      applyView();
    } else if (drag.type === 'rect') {
      const r = dom.svg.getBoundingClientRect();
      updateSelectionRect(e.clientX - r.left, e.clientY - r.top);
      applyRectSelection(e.clientX - r.left, e.clientY - r.top);
    }
  });

  // ---- Отпускание ----
  window.addEventListener('pointerup', (e) => {
    removePointer(e);

    if (pinch) {
      if (pointers.size < 2) endPinch();
      return;
    }

    if (!drag) return;

    if (drag.type === 'pendingNodeTap') {
      setSelection([drag.nodeId]);
      state.selectedNoteId = null;
      refreshAll();
      drag = null;
      return;
    }

    if (drag.type === 'pendingTestTap') {
      const id = drag.nodeId;
      const n = getNode(id);
      if (n) {
        if (state.acquired.has(id)) {
          unacquireCascade(id);
        } else if (isAcquirable(n)) {
          state.acquired.add(id);
        }
        touch();
        refreshAll();
      }
      drag = null;
      return;
    }

    if (drag.type === 'nodes' || drag.type === 'note' || drag.type === 'noteResize') {
      commit();
      updateHistoryButtons();
    }
    if (drag.type === 'rect') {
      dom.selectionRect.style.display = 'none';
      rectScreen = null;
      refreshAll();
    }
    drag = null;
    dom.svg.classList.remove('panning');
  });

  window.addEventListener('pointercancel', (e) => {
    removePointer(e);
    if (pinch && pointers.size < 2) endPinch();
    if (!pinch) {
      drag = null;
      rectScreen = null;
      dom.selectionRect.style.display = 'none';
      dom.svg.classList.remove('panning');
    }
  });

  // ---- ПКМ / долгий тап ----
  dom.svg.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (state.mode !== 'edit') return;

    const nodeEl    = e.target.closest ? e.target.closest('.node-g')   : null;
    const linkHitEl = e.target.closest ? e.target.closest('.link-hit') : null;

    if (linkHitEl) {
      const linkId = linkHitEl.dataset.linkId;
      const link = state.links.find(l => l.id === linkId);
      if (link) {
        const a = getNode(link.a);
        const b = getNode(link.b);
        const label = `${a ? a.title : '?'} ↔ ${b ? b.title : '?'}`;
        if (confirm(`Удалить связь "${label}"?`)) {
          deleteLink(linkId);
          commit();
          refreshAll();
        }
      }
      return;
    }

    if (nodeEl) {
      const id = nodeEl.dataset.id;
      const n = getNode(id);
      setSelection([id]);
      state.selectedNoteId = null;
      addChild(n);
      commit();
      refreshAll();
    }
  });

  // ---- Колесо мыши ----
  dom.svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = dom.svg.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const wx = (mx - view.x) / view.k;
    const wy = (my - view.y) / view.k;
    const factor = Math.exp(-e.deltaY * 0.0015);
    view.k = Math.max(0.15, Math.min(3.5, view.k * factor));
    view.x = mx - wx * view.k;
    view.y = my - wy * view.k;
    applyView();
  }, { passive: false });

  // ---- Клавиатура ----
  window.addEventListener('keydown', (e) => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    const ctrl = e.ctrlKey || e.metaKey;
    const code = e.code;

    if (ctrl && !e.altKey && !e.shiftKey) {
      if (code === 'KeyC') {
        if (inField) return;
        const ids = [...state.selectedIds];
        if (!ids.length) return;
        const n = getNode(ids[0]);
        if (!n) return;
        state.clipboard = {
          title:       n.title || '',
          description: n.description || '',
          color:       n.color || DEFAULT_NODE_COLOR,
          radius:      n.radius,
          scale:       n.scale ?? 1,
          strokeWidth: n.strokeWidth ?? 4,
          tags: Array.isArray(n.tags) ? [...n.tags] : [],
          stats: (n.stats || []).map(s => ({ statId: s.statId, type: s.type || 'flat', value: s.value })),
          effects: (n.effects || []).map(ef => {
            const { id, ...rest } = ef;
            return { ...rest };
          }),
        };
        e.preventDefault();
        return;
      }

      if (code === 'KeyV') {
        if (inField) return;
        if (!state.clipboard) return;
        const ids = [...state.selectedIds];
        if (!ids.length) return;
        const clip = state.clipboard;
        for (const id of ids) {
          const n = getNode(id);
          if (!n) continue;
          n.title       = clip.title;
          n.description = clip.description;
          n.color       = clip.color;
          if (typeof clip.radius === 'number')      n.radius = clip.radius;
          if (typeof clip.scale === 'number')       n.scale = clampScale(clip.scale);
          if (typeof clip.strokeWidth === 'number') n.strokeWidth = clip.strokeWidth;
          if (Array.isArray(clip.tags)) n.tags = [...clip.tags];
          n.stats = (clip.stats || []).map(s => ({ statId: s.statId, type: s.type || 'flat', value: s.value }));
          n.effects = (clip.effects || []).map(ef => ({
            ...ef,
            id: Math.random().toString(36).slice(2, 10),
          }));
        }
        commit();
        refreshAll();
        e.preventDefault();
        return;
      }

      if (code === 'KeyD') {
        if (inField) return;
        if (state.mode !== 'edit') return;
        if (!state.selectedIds.size) return;
        e.preventDefault();
        duplicateNodes([...state.selectedIds]);
        commit();
        refreshAll();
        return;
      }
    }

    if (ctrl && !e.altKey) {
      if (code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        if (undo()) refreshAll();
        return;
      }
      if (code === 'KeyY' || (code === 'KeyZ' && e.shiftKey)) {
        e.preventDefault();
        if (redo()) refreshAll();
        return;
      }
    }

    if (e.key === 'Escape' && state.linking) {
      state.linking = null;
      refreshAll();
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (inField) return;
      if (state.mode !== 'edit') return;

      if (state.selectedNoteId) {
        e.preventDefault();
        deleteNote(state.selectedNoteId);
        commit();
        refreshAll();
        return;
      }

      if (state.selectedIds.size) {
        e.preventDefault();
        const ids = [...state.selectedIds];
        if (ids.length === 1) deleteNode(ids[0]);
        else {
          if (!confirm(`Удалить ${ids.length} нод (включая потомков)?`)) return;
          for (const id of ids) deleteNode(id);
        }
        commit();
        refreshAll();
      }
    }
  });

  // ---- Переключение режима ----
  document.querySelectorAll('.mode-tabs button').forEach(b => {
    b.addEventListener('click', () => {
      state.mode = b.dataset.mode;
      if (state.mode === 'test' || state.mode === 'settings') {
        clearSelection();
        state.selectedNoteId = null;
        state.linking = null;
      }
      hideTooltip();
      refreshAll();
    });
  });

  // ---- Тултип — только для мыши ----
  dom.svg.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (drag || pinch) { hideTooltip(); return; }
    if (state.mode !== 'edit' && state.mode !== 'test') { hideTooltip(); return; }
    const nodeEl = e.target.closest ? e.target.closest('.node-g') : null;
    if (nodeEl) {
      showNodeTooltip(nodeEl.dataset.id, e.clientX, e.clientY);
    } else {
      hideTooltip();
    }
  });
  dom.svg.addEventListener('pointerleave', hideTooltip);
}