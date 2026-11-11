import { initDefaultTree } from './utils.js';
import { applyView, fitView } from './view.js';
import { refreshAll } from './panel.js';
import { setupInteractions } from './interactions.js';
import { setupIO, applyAutosave } from './io.js';
import { initHistory } from './history.js';
import { saveNow, loadAutosave, enableAutosave } from './autosave.js';
import { state } from './state.js';

initDefaultTree();
initHistory();
setupInteractions();
setupIO();

// Если есть автосохранение — грузим сразу, без вопросов.
if (loadAutosave()) {
    applyAutosave();
}

// Только теперь автосейв можно писать.
enableAutosave();

refreshAll();
applyView();
requestAnimationFrame(fitView);

// Кнопка "на весь экран" — на телефоне скрывает адресную строку.
(function setupFullscreenButton() {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isMobile) return;

  const btn = document.createElement('button');
  btn.id = 'btnFullscreen';
  btn.textContent = '⛶';
  btn.title = 'На весь экран';
  btn.style.cssText = 'position:fixed;top:8px;right:8px;z-index:1000;width:44px;height:44px;font-size:18px;';
  document.body.appendChild(btn);

  btn.addEventListener('click', () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen).call(el)
        .catch(err => console.warn('fullscreen failed:', err));
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    }
  });
})();

// Кнопка сворачивания нижней панели — только на мобильных.
(function setupPanelToggle() {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || window.innerWidth <= 800;
  if (!isMobile) return;

  const panel = document.getElementById('panel');
  if (!panel) return;

  const btn = document.createElement('button');
  btn.id = 'btnPanelToggle';
  btn.textContent = '▼ Панель';
  btn.title = 'Свернуть панель';
  document.body.appendChild(btn);

  btn.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('collapsed');
    btn.textContent = collapsed ? '▲ Панель' : '▼ Панель';
    btn.title = collapsed ? 'Развернуть панель' : 'Свернуть панель';
  });
})();

// Снимаем фокус с поля ввода при тапе вне поля.
// Иначе на мобильных клавиатура «залипает» и открывается заново.
(function setupKeyboardBlur() {
  const FIELD_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];
  const isField = (el) => el && FIELD_TAGS.includes(el.tagName);

  document.addEventListener('pointerdown', (e) => {
    if (isField(e.target)) return; // тап по другому полю — не мешаем
    const active = document.activeElement;
    if (isField(active)) {
      active.blur();
    }
  }, true); // capture — сработает раньше preventDefault в наших обработчиках
})();

// Изменение ширины правой панели перетаскиванием за левый край.
(function setupPanelResize() {
  const resizer = document.getElementById('panelResizer');
  const panel = document.getElementById('panel');
  if (!resizer || !panel) return;

  function isDesktop() {
    return window.innerWidth > 800;
  }

  function applyWidth(w) {
    panel.style.width = w + 'px';
    panel.style.flexBasis = w + 'px';
  }

  function clearWidth() {
    panel.style.width = '';
    panel.style.flexBasis = '';
  }

  function syncWidth() {
    if (isDesktop()) {
      applyWidth(state.config.panelWidth || 400);
    } else {
      clearWidth();
    }
  }

  let dragging = false;
  let startX = 0;
  let startWidth = 0;

  resizer.addEventListener('pointerdown', (e) => {
    if (!isDesktop()) return;
    if (e.pointerType === 'touch') return;
    dragging = true;
    startX = e.clientX;
    startWidth = panel.getBoundingClientRect().width;
    resizer.classList.add('dragging');
    if (resizer.setPointerCapture) {
      try { resizer.setPointerCapture(e.pointerId); } catch {}
    }
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  });

  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const newW = Math.max(280, Math.min(800, startWidth - dx));
    applyWidth(newW);
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging');
    document.body.style.cursor = '';
    const w = Math.round(panel.getBoundingClientRect().width);
    if (w !== state.config.panelWidth) {
      state.config.panelWidth = w;
      saveNow();
    }
  }

  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', syncWidth);

  // Применить сохранённую ширину при старте
  syncWidth();
})();