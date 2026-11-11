export const DEFAULT_CONFIG = {
  // Новая нода
  newNodeRadius: 45,
  newNodeStrokeWidth: 3,
  newNodeScale: 1,
  newNodeColor: '#4a7dff',

  // Корневая нода (при «Новое дерево»)
  newRootRadius: 60,
  newRootStrokeWidth: 4,

  // Новая карточка
  newNoteSize: 200,
  newNoteFontSize: 14,
  newNoteColor: '#4a7dff',

  // Раскладка дочерних
  childDistance: 140,
  childAngleStepDeg: 36,

  // Автосохранение
  autosaveEnabled: true,
  autosaveDebounceMs: 500,

  // Undo
  historySize: 100,

  // Ширина правой панели (десктоп)
  panelWidth: 400,

  // Названия эффектов (для UI)
  effectLabels: {
    set:       'Фикс.',
    perTag:    'За теги',
    convert:   'Конвертация',
    perEach:   'За-каждые',
    perAbove:  'За-каждое свыше',
    extra:     'Дополнительно',
    swap:      'Обмен',
    condition: 'Условие',
  },

  // Порядок применения (только настраиваемые эффекты)
  effectOrder: ['convert', 'perEach', 'perAbove', 'extra', 'swap', 'condition'],

  // Пользовательские вычисляемые значения
  // [{ id, name, formula }]
  computedValues: [],
};

export function normalizeConfig(c) {
  const out = { ...DEFAULT_CONFIG };
  if (!c || typeof c !== 'object') {
    out.effectLabels = { ...DEFAULT_CONFIG.effectLabels };
    out.effectOrder = [...DEFAULT_CONFIG.effectOrder];
    out.computedValues = [];
    return out;
  }

  for (const k of Object.keys(DEFAULT_CONFIG)) {
    if (k === 'effectLabels' || k === 'effectOrder' || k === 'computedValues') continue;
    if (!(k in c)) continue;
    const def = DEFAULT_CONFIG[k];
    if (typeof def === 'number') {
      const v = Number(c[k]);
      if (isFinite(v)) out[k] = v;
    } else if (typeof def === 'boolean') {
      out[k] = !!c[k];
    } else if (typeof def === 'string') {
      out[k] = String(c[k]);
    }
  }

  // effectLabels
  out.effectLabels = { ...DEFAULT_CONFIG.effectLabels };
  if (c.effectLabels && typeof c.effectLabels === 'object') {
    for (const k of Object.keys(DEFAULT_CONFIG.effectLabels)) {
      if (typeof c.effectLabels[k] === 'string' && c.effectLabels[k].trim() !== '') {
        out.effectLabels[k] = c.effectLabels[k];
      }
    }
  }

  // effectOrder
  const allowedOrder = ['convert', 'perEach', 'perAbove', 'extra', 'swap', 'condition'];
  out.effectOrder = [...DEFAULT_CONFIG.effectOrder];
  if (Array.isArray(c.effectOrder)) {
    const seen = new Set();
    const order = [];
    for (const id of c.effectOrder) {
      if (allowedOrder.includes(id) && !seen.has(id)) {
        order.push(id);
        seen.add(id);
      }
    }
    for (const id of allowedOrder) {
      if (!seen.has(id)) order.push(id);
    }
    out.effectOrder = order;
  }

  // computedValues
  out.computedValues = [];
  if (Array.isArray(c.computedValues)) {
    for (const cv of c.computedValues) {
      if (!cv || typeof cv !== 'object') continue;
      const name = typeof cv.name === 'string' ? cv.name.trim() : '';
      const formula = typeof cv.formula === 'string' ? cv.formula : '';
      if (!name) continue;
      out.computedValues.push({
        id: typeof cv.id === 'string' && cv.id ? cv.id : Math.random().toString(36).slice(2, 10),
        name: name.slice(0, 60),
        formula: formula.slice(0, 1000),
      });
    }
  }

  // Валидация диапазонов
  out.newNodeRadius      = Math.max(10,  Math.min(200, out.newNodeRadius));
  out.newNodeStrokeWidth = Math.max(0,   Math.min(20,  out.newNodeStrokeWidth));
  out.newNodeScale       = Math.max(0.3, Math.min(3,   out.newNodeScale));
  out.newRootRadius      = Math.max(10,  Math.min(200, out.newRootRadius));
  out.newRootStrokeWidth = Math.max(0,   Math.min(20,  out.newRootStrokeWidth));
  out.newNoteSize        = Math.max(80,  Math.min(800, out.newNoteSize));
  out.newNoteFontSize    = Math.max(8,   Math.min(48,  out.newNoteFontSize));
  out.childDistance      = Math.max(50,  Math.min(500, out.childDistance));
  out.childAngleStepDeg  = Math.max(5,   Math.min(180, out.childAngleStepDeg));
  out.autosaveDebounceMs = Math.max(100, Math.min(5000, out.autosaveDebounceMs));
  out.historySize        = Math.max(10,  Math.min(500, out.historySize));
  out.panelWidth         = Math.max(280, Math.min(800, out.panelWidth || 400));

  // Цвета
  const hexRe = /^#[0-9a-f]{3,8}$/i;
  if (!hexRe.test(out.newNodeColor)) out.newNodeColor = DEFAULT_CONFIG.newNodeColor;
  if (!hexRe.test(out.newNoteColor)) out.newNoteColor = DEFAULT_CONFIG.newNoteColor;

  return out;
}