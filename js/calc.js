import { state, getNode, getStat } from './state.js';
import { countTagged } from './node-ops.js';
import { flatDisplayType } from './utils.js';

export function countTaggedAll(tag) {
  if (!tag) return 0;
  let n = 0;
  for (const node of state.nodes) {
    if (Array.isArray(node.tags) && node.tags.includes(tag)) n++;
  }
  return n;
}

export function computeTotals() {
  // ---- Сбор базовых бакетов ----
  const buckets = {};
  for (const st of state.stats) {
    buckets[st.id] = { flat: 0, flatCount: 0, percent: 0, percentCount: 0, more: [] };
  }

  for (const id of state.acquired) {
    const n = getNode(id);
    if (!n || !n.stats) continue;
    for (const s of n.stats) {
      const b = buckets[s.statId];
      if (!b) continue;
      const v = Number(s.value) || 0;
      const t = s.type || 'flat';
      if (t === 'more') b.more.push(v);
      else if (t === 'percent') { b.percent += v; b.percentCount++; }
      else { b.flat += v; b.flatCount++; }
    }
  }

  const allEffects = [];
  for (const id of state.acquired) {
    const n = getNode(id);
    if (!n || !n.effects) continue;
    for (const e of n.effects) {
      allEffects.push({
        type: e.type || 'convert',
        from: e.from || '',
        to: e.to || '',
        percent: Math.max(0, Number(e.percent) || 0),
        rate: Number(e.rate) || 0,
        value: Number(e.value) || 0,
        step: Number(e.step) || 0,
        bonus: Number(e.bonus) || 0,
        left: e.left || '',
        op: e.op || '>',
        rightKind: e.rightKind === 'stat' ? 'stat' : 'number',
        rightNumber: Number(e.rightNumber) || 0,
        rightStat: e.rightStat || '',
        rewards: Array.isArray(e.rewards)
          ? e.rewards.map(r => ({
              to: r.to || '',
              kind: r.kind || 'flat',
              value: Number(r.value) || 0,
            }))
          : [],
        threshold: Number(e.threshold) || 0,
        a: e.a || '',
        b: e.b || '',
        tag: e.tag || '',
        kind: ['flat', 'percent', 'more'].includes(e.kind) ? e.kind : 'flat',
      });
    }
  }

  const statIndex = {};
  state.stats.forEach((s, i) => statIndex[s.id] = i);

  const perTagIn = { flat: {}, percent: {}, more: {} };
  const condIn = { flat: {}, more: {} };
  for (const st of state.stats) {
    perTagIn.flat[st.id] = 0;
    perTagIn.percent[st.id] = 0;
    perTagIn.more[st.id] = 0;
    condIn.flat[st.id] = 0;
    condIn.more[st.id] = 0;
  }

  // ---- ФАЗА 1: perTag — в бакеты ДО базы ----
  const perTagList = allEffects
    .filter(e => e.type === 'perTag' && e.to && e.step > 0 && e.tag)
    .sort((a, b) => statIndex[a.to] - statIndex[b.to]);

  for (const e of perTagList) {
    if (!(e.to in buckets)) continue;
    const cnt = countTagged(e.tag);
    if (cnt <= 0) continue;
    const mult = Math.floor(cnt / e.step);
    if (mult <= 0) continue;
    const b = buckets[e.to];
    if (!b) continue;
    const val = mult * e.bonus;
    if (e.kind === 'flat') {
      b.flat += val;
      b.flatCount++;
      perTagIn.flat[e.to] += val;
    } else if (e.kind === 'percent') {
      b.percent += val;
      b.percentCount++;
      perTagIn.percent[e.to] += val;
    } else if (e.kind === 'more') {
      b.more.push(val);
      perTagIn.more[e.to] += val;
    }
  }

  // ---- ФАЗА 2: База ----
  function computePxM() {
    const pxm = {}, baseVal = {}, moreProduct = {};
    for (const st of state.stats) {
      const b = buckets[st.id];
      let mp = 1;
      for (const m of b.more) mp *= (1 + m / 100);
      moreProduct[st.id] = mp;
      pxm[st.id] = (1 + b.percent / 100) * mp;
      baseVal[st.id] = b.flat * pxm[st.id];
    }
    return { pxm, baseVal, moreProduct };
  }

  let { pxm, baseVal, moreProduct } = computePxM();
  const current = { ...baseVal };

  const setFlag = {};
  for (const st of state.stats) setFlag[st.id] = false;

  function displayValue(stId) {
    const st = getStat(stId);
    if (!st) return 0;
    const b = buckets[stId];
    if (setFlag[stId]) return current[stId];
    if (st.types.flat && b.flatCount > 0) return current[stId];
    if (st.types.percent || st.types.more) {
      let mp = 1;
      for (const m of b.more) mp *= (1 + m / 100);
      return b.percent * mp;
    }
    return current[stId];
  }

  function applySet() {
    const minByStat = {};
    for (const e of allEffects) {
      if (e.type !== 'set') continue;
      if (!(e.to in current)) continue;
      const v = Number(e.value) || 0;
      if (!(e.to in minByStat) || v < minByStat[e.to]) {
        minByStat[e.to] = v;
      }
    }
    for (const statId in minByStat) {
      current[statId] = minByStat[statId];
      setFlag[statId] = true;
    }
  }

  const convIn = {}, convOut = {}, extraIn = {}, perEachIn = {}, perAboveIn = {};
  for (const st of state.stats) {
    convIn[st.id] = 0;
    convOut[st.id] = 0;
    extraIn[st.id] = 0;
    perEachIn[st.id] = 0;
    perAboveIn[st.id] = 0;
  }

  function applyOutgoing(srcId, targets, avail, kind) {
    if (avail <= 0) return;
    let remaining = avail;
    targets.sort((a, b) => statIndex[a.to] - statIndex[b.to]);

    for (const c of targets) {
      const want = avail * (c.percent / 100);
      if (want <= 0) continue;
      if (kind === 'extra') {
        const added = want * (c.rate / 100) * pxm[c.to];
        current[c.to] += added;
        extraIn[c.to] += added;
      } else {
        const take = Math.min(want, remaining);
        if (take <= 0) continue;
        remaining -= take;
        current[srcId] -= take;
        convOut[srcId] += take;
        const added = take * (c.rate / 100) * pxm[c.to];
        current[c.to] += added;
        convIn[c.to] += added;
      }
    }
  }

  function applyPass(effects, kind) {
    for (let i = 0; i < state.stats.length; i++) {
      const srcId = state.stats[i].id;
      const outgoing = effects.filter(c => c.from === srcId && statIndex[c.to] > i);
      if (outgoing.length === 0) continue;
      applyOutgoing(srcId, outgoing, current[srcId], kind);
    }
    for (let i = state.stats.length - 1; i >= 0; i--) {
      const srcId = state.stats[i].id;
      const outgoing = effects.filter(c => c.from === srcId && statIndex[c.to] < i);
      if (outgoing.length === 0) continue;
      applyOutgoing(srcId, outgoing, current[srcId], kind);
    }
  }

  // ============================================================
  // Динамический порядок фаз.
  // set и perTag фиксированы (perTag — до базы, set — после каждой фазы).
  // Остальные — в порядке state.config.effectOrder.
  // ============================================================

  applySet();

  const order = state.config.effectOrder || ['convert', 'perEach', 'perAbove', 'extra', 'swap', 'condition'];

  const convEffects = allEffects.filter(e =>
    e.type === 'convert'
    && e.from && e.to && e.from !== e.to
    && (e.from in baseVal)
  );
  const extraEffects = allEffects.filter(e =>
    e.type === 'extra'
    && e.from && e.to && e.from !== e.to
    && (e.from in baseVal)
  );

  const perEachList = allEffects
    .filter(e => e.type === 'perEach' && e.from && e.to && e.from !== e.to && e.step > 0)
    .sort((a, b) => statIndex[a.to] - statIndex[b.to]);

  const perAboveList = allEffects
    .filter(e => e.type === 'perAbove' && e.from && e.to && e.from !== e.to)
    .sort((a, b) => statIndex[a.to] - statIndex[b.to]);

  const swapList = allEffects
    .filter(e => e.type === 'swap' && e.a && e.b && e.a !== e.b && (e.a in current) && (e.b in current))
    .slice()
    .sort((x, y) => statIndex[x.a] - statIndex[y.a]);

  const conditionEffects = allEffects.filter(e =>
    e.type === 'condition' && e.left && Array.isArray(e.rewards) && e.rewards.length > 0
  );

  function runConvert() {
    applyPass(convEffects, 'convert');
  }
  function runPerEach() {
    for (const e of perEachList) {
      if (!(e.from in current)) continue;
      const src = displayValue(e.from);
      if (src <= 0) continue;
      const count = Math.floor(src / e.step);
      if (count <= 0) continue;
      const added = count * e.bonus * pxm[e.to];
      current[e.to] += added;
      perEachIn[e.to] += added;
    }
  }
  function runPerAbove() {
    for (const e of perAboveList) {
      if (!(e.from in current)) continue;
      const src = displayValue(e.from);
      const above = Math.max(0, src - e.threshold);
      if (above <= 0) continue;
      const added = above * e.bonus * pxm[e.to];
      current[e.to] += added;
      perAboveIn[e.to] += added;
    }
  }
  function runExtra() {
    applyPass(extraEffects, 'extra');
  }
  function runSwap() {
    for (const e of swapList) {
      const tmp = current[e.a];
      current[e.a] = current[e.b];
      current[e.b] = tmp;
    }
  }
  function runCondition() {
    for (const e of conditionEffects) {
      const left = displayValue(e.left);
      let right;
      if (e.rightKind === 'stat') {
        right = displayValue(e.rightStat);
      } else {
        right = e.rightNumber;
      }

      let ok = false;
      switch (e.op) {
        case '>':  ok = left >  right; break;
        case '<':  ok = left <  right; break;
        case '>=': ok = left >= right; break;
        case '<=': ok = left <= right; break;
        case '=':  ok = Math.abs(left - right) < 1e-9; break;
      }
      if (!ok) continue;

      for (const r of e.rewards) {
        if (!r.to) continue;
        if (!(r.to in current)) continue;
        const st = getStat(r.to);
        if (!st || !st.types[r.kind]) continue;
        if (r.kind === 'percent') continue;
        const val = Number(r.value) || 0;

        if (r.kind === 'flat') {
          const added = val * pxm[r.to];
          current[r.to] += added;
          condIn.flat[r.to] += added;
        } else if (r.kind === 'more') {
          current[r.to] *= (1 + val / 100);
          condIn.more[r.to] += val;
        }
      }
    }
  }

  const runners = {
    convert:   runConvert,
    perEach:   runPerEach,
    perAbove:  runPerAbove,
    extra:     runExtra,
    swap:      runSwap,
    condition: runCondition,
  };

  for (const id of order) {
    const fn = runners[id];
    if (typeof fn === 'function') {
      fn();
      applySet();
    }
  }

  // ---- Итоги ----
  const totals = {};
  for (const st of state.stats) {
    const b = buckets[st.id];
    const value = displayValue(st.id);

    let displayType;
    if (setFlag[st.id]) {
      displayType = (st.types.flat && b.flatCount > 0)
        ? flatDisplayType(st)
        : ((st.types.percent || st.types.more) ? 'percent' : 'flat');
    } else if (st.types.flat && b.flatCount > 0) {
      displayType = flatDisplayType(st);
    } else if (st.types.percent || st.types.more) {
      displayType = 'percent';
    } else {
      displayType = 'flat';
    }

    let moreProductVal = 1;
    for (const m of b.more) moreProductVal *= (1 + m / 100);

    totals[st.id] = {
      value,
      displayType,
      flatFormat: st.flatFormat === 'percent' ? 'percent' : 'flat',
      flat: b.flat,
      flatCount: b.flatCount,
      percent: b.percent,
      percentCount: b.percentCount,
      moreProduct: moreProductVal,
      moreCount: b.more.length,
      hasFlat: b.flatCount > 0,
      hasPercent: b.percentCount > 0,
      hasMore: b.more.length > 0,
      convertedIn: convIn[st.id],
      convertedOut: convOut[st.id],
      extraIn: extraIn[st.id],
      perEachIn: perEachIn[st.id],
      perAboveIn: perAboveIn[st.id],
      perTagFlat: perTagIn.flat[st.id],
      perTagPercent: perTagIn.percent[st.id],
      perTagMore: perTagIn.more[st.id],
      isSet: setFlag[st.id],
      condFlat: condIn.flat[st.id],
      condMore: condIn.more[st.id],
    };
  }
  return totals;
}

// ============================================================
// Пользовательские вычисляемые значения
// ============================================================

// Извлекает содержимое всех (...), которые «похожи на имя» —
// то есть после подстановки известных имён остались нетронутыми.
function findUnknownReference(expr) {
  const re = /\(([^()]+)\)/g;
  let m;
  while ((m = re.exec(expr)) !== null) {
    const inner = m[1].trim();
    if (!inner) continue;
    if (/^-?\d+(\.\d+)?$/.test(inner)) continue;
    if (/[+\-*/]/.test(inner)) continue;
    return inner;
  }
  return null;
}

function substituteFormula(formula, known) {
  let expr = String(formula || '').trim();
  if (!expr) return '';
  const names = Object.keys(known).sort((a, b) => b.length - a.length);
  for (const name of names) {
    const escName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('\\(' + escName + '\\)', 'g');
    expr = expr.replace(re, '(' + String(known[name]) + ')');
  }
  return expr;
}

function evalFormulaStrict(formula, known) {
  const expr = substituteFormula(formula, known);
  if (!expr) return 0;
  const unknown = findUnknownReference(expr);
  if (unknown) throw new Error('Неизвестное имя: ' + unknown);
  return evaluateArithmetic(expr);
}

function evalFormula(formula, known) {
  try {
    const v = evalFormulaStrict(formula, known);
    if (!isFinite(v)) return 0;
    return v;
  } catch (e) {
    return 0;
  }
}

function evaluateArithmetic(expr) {
  let pos = 0;
  const s = expr;

  function skipWs() {
    while (pos < s.length && /\s/.test(s[pos])) pos++;
  }

  function parseExpr() {
    let v = parseTerm();
    skipWs();
    while (pos < s.length && (s[pos] === '+' || s[pos] === '-')) {
      const op = s[pos];
      pos++;
      const r = parseTerm();
      v = op === '+' ? v + r : v - r;
      skipWs();
    }
    return v;
  }

  function parseTerm() {
    let v = parseFactor();
    skipWs();
    while (pos < s.length && (s[pos] === '*' || s[pos] === '/')) {
      const op = s[pos];
      pos++;
      const r = parseFactor();
      if (op === '*') v = v * r;
      else v = r === 0 ? 0 : v / r;
      skipWs();
    }
    return v;
  }

  function parseFactor() {
    skipWs();
    if (s[pos] === '+') { pos++; return parseFactor(); }
    if (s[pos] === '-') { pos++; return -parseFactor(); }
    if (s[pos] === '(') {
      pos++;
      const v = parseExpr();
      skipWs();
      if (s[pos] !== ')') throw new Error('Ожидалась ) на позиции ' + pos);
      pos++;
      return v;
    }
    const start = pos;
    while (pos < s.length && /[0-9.]/.test(s[pos])) pos++;
    if (start === pos) throw new Error('Ожидалось число на позиции ' + pos);
    const num = parseFloat(s.slice(start, pos));
    if (!isFinite(num)) throw new Error('Некорректное число');
    return num;
  }

  const result = parseExpr();
  skipWs();
  if (pos < s.length) throw new Error('Лишние символы: ' + s.slice(pos));
  return result;
}

// Валидация записи.
// statNames — Set имён статов.
// priorNames — Set имён валидных записей, идущих ДО текущей.
// Возвращает { nameError, formulaError } — строки или null.
export function validateComputedValue(cv, statNames, priorNames) {
  const result = { nameError: null, formulaError: null };
  const name = (cv.name || '').trim();

  if (!name) {
    result.nameError = 'Имя пустое';
  } else if (statNames.has(name)) {
    result.nameError = 'Совпадает со статом';
  } else if (priorNames.has(name)) {
    result.nameError = 'Совпадает с другим значением';
  }

  const formula = (cv.formula || '').trim();
  if (formula) {
    const known = {};
    for (const n of statNames) known[n] = 1;
    for (const n of priorNames) known[n] = 1;
    try {
      evalFormulaStrict(formula, known);
    } catch (e) {
      result.formulaError = e.message || 'Синтаксическая ошибка';
    }
  }

  return result;
}

// totals — результат computeTotals().
// Возвращает массив [{ id, name, value }] только валидных записей.
export function computeCustomValues(totals) {
  const list = Array.isArray(state.config.computedValues)
    ? state.config.computedValues
    : [];

  const known = {};
  const statNames = new Set();
  for (const st of state.stats) {
    const t = totals[st.id];
    known[st.name] = t ? t.value : 0;
    statNames.add(st.name);
  }

  const priorNames = new Set();
  const out = [];
  for (const cv of list) {
    const v = validateComputedValue(cv, statNames, priorNames);
    if (v.nameError || v.formulaError) continue;
    const val = evalFormula(cv.formula, known);
    out.push({ id: cv.id, name: cv.name.trim(), value: val });
    known[cv.name.trim()] = val;
    priorNames.add(cv.name.trim());
  }
  return out;
}