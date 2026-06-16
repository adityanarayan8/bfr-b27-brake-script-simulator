import { h } from './dom.js';
import { activeValues, refs, requestRecompute } from './state.js';
import { FIELDS, coerceField } from './config.js';
import { UNITS, toDisplay, toCanonical } from './units.js';

export function buildField(spec) {
  const family = spec.unitFamily;
  const unitSel = family
    ? h('select', { class: 'select select-unit', 'aria-label': `${spec.label} unit` },
        ...UNITS[family].options.map((o) => h('option', { value: o.id }, o.label)))
    : null;

  const num = h('input', { type: 'number', class: 'num', step: spec.step, 'aria-label': spec.label });
  const slider = h('input', {
    type: 'range', min: spec.min, max: spec.max, step: spec.step,
    'aria-label': `${spec.label} slider`,
  });

  const commit = (raw, source) => {
    const v = activeValues();
    const unitId = family ? v.units[family] : null;
    const canonical = family ? toCanonical(family, unitId, parseFloat(raw)) : parseFloat(raw);
    v[spec.key] = coerceField(spec.key, canonical, v[spec.key]);
    syncField(spec.key, source);
    requestRecompute();
  };

  num.addEventListener('input', () => commit(num.value, num));
  slider.addEventListener('input', () => commit(slider.value, slider));

  if (unitSel) {
    unitSel.addEventListener('change', () => {
      activeValues().units[family] = unitSel.value;
      syncField(spec.key, null);
      requestRecompute();
    });
  }

  const rangeLabels = h('div', { class: 'field-range-labels' }, h('span'), h('span'));

  const wrap = h('div', { class: 'field' },
    h('div', { class: 'field-head' },
      h('span', { class: 'field-label' }, spec.label),
      h('span', { class: 'field-inputs' }, num, unitSel)),
    h('div', { class: 'field-row' }, slider),
    rangeLabels);

  refs.fields.set(spec.key, { slider, num, unitSel, family, spec, rangeLabels });
  return wrap;
}

export function syncField(key, exclude) {
  const r = refs.fields.get(key);
  if (!r) return;

  const v = activeValues();
  const unitId = r.family ? v.units[r.family] : null;
  const display = r.family ? toDisplay(r.family, unitId, v[key]) : v[key];
  const opt = r.family ? UNITS[r.family].options.find((o) => o.id === unitId) : null;
  const decimals = opt ? opt.decimals : r.spec.decimals;

  const lo = r.family ? toDisplay(r.family, unitId, r.spec.min) : r.spec.min;
  const hi = r.family ? toDisplay(r.family, unitId, r.spec.max) : r.spec.max;
  const step = r.family
    ? Math.abs(toDisplay(r.family, unitId, r.spec.step) - toDisplay(r.family, unitId, 0))
    : r.spec.step;

  r.slider.min = lo;
  r.slider.max = hi;
  r.slider.step = step || r.spec.step;
  r.num.step = step || r.spec.step;

  if (r.slider !== exclude) r.slider.value = Math.min(hi, Math.max(lo, display));
  if (r.num !== exclude) r.num.value = r.spec.integer ? Math.round(display) : Number(display.toFixed(decimals));
  if (r.unitSel && r.unitSel !== exclude && unitId) r.unitSel.value = unitId;

  const [loEl, hiEl] = r.rangeLabels.children;
  loEl.textContent = r.spec.integer ? Math.round(lo) : lo.toFixed(Math.min(3, decimals));
  hiEl.textContent = r.spec.integer ? Math.round(hi) : hi.toFixed(Math.min(3, decimals));
}

export const fieldsFor = (sectionId) => FIELDS.filter((f) => f.section === sectionId);

export function labelledSelect(labelText, name, list, onChange) {
  const sel = h('select', { class: 'select select-wide', 'aria-label': labelText },
    ...list.map((o) => h('option', { value: o.id }, o.name)));
  sel.addEventListener('change', () => { onChange(sel.value); requestRecompute(); });
  refs.selects.set(name, sel);
  return h('div', { class: 'field' },
    h('div', { class: 'field-head' }, h('span', { class: 'field-label' }, labelText)),
    sel);
}

export function revealBox(name, ...children) {
  const box = h('div', { hidden: true }, ...children);
  refs.reveals.set(name, box);
  return box;
}

export function specBlock(name) {
  const el = h('div', { class: 'spec-block', hidden: true });
  refs.specBlocks.set(name, el);
  return el;
}

export function warningSlot(name) {
  const el = h('div', { class: 'compat-warn', hidden: true, role: 'status' });
  refs.warnings.set(name, el);
  return el;
}

export function derivedSlot(name) {
  const el = h('div', { class: 'derived' });
  refs.derived.set(name, el);
  return el;
}

export function renderSpecBlock(name, rows) {
  const el = refs.specBlocks.get(name);
  if (!el) return;
  if (!rows || !rows.length) { el.hidden = true; return; }
  el.hidden = false;
  el.replaceChildren(h('table', {},
    h('tbody', {}, ...rows.map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', {}, v))))));
}

export function customNumber(name, key, opts = {}) {
  const label = opts.label || key;
  const input = h('input', {
    type: 'number', class: 'num', step: opts.step || 'any', 'aria-label': label,
  });
  input.addEventListener('input', () => {
    const v = activeValues();
    v[key] = coerceField(key, parseFloat(input.value), v[key]);
    requestRecompute();
  });
  refs.custom.set(name, { input, key });
  return h('div', { class: 'field' },
    h('div', { class: 'field-head' },
      h('span', { class: 'field-label' }, label),
      h('span', { class: 'field-inputs' }, input,
        opts.unit ? h('span', { class: 'field-label' }, opts.unit) : null)));
}

let sectionSeq = 0;

export function buildSection(id, label, bodyChildren) {
  const bodyId = `section-body-${id}-${++sectionSeq}`;
  const body = h('div', { class: 'section-body', id: bodyId }, ...bodyChildren);
  const head = h('button', {
    type: 'button', class: 'section-head', 'aria-expanded': 'false', 'aria-controls': bodyId,
  }, h('span', { class: 'section-caret', 'aria-hidden': 'true' }, '▼'), label);

  const section = h('section', { class: 'section collapsed', id: `section-${id}` },
    h('h2', { class: 'section-heading' }, head), body);

  head.addEventListener('click', () => {
    const collapsed = section.classList.toggle('collapsed');
    head.setAttribute('aria-expanded', String(!collapsed));
  });

  return section;
}

export function openSection(id) {
  const el = document.getElementById(`section-${id}`);
  if (!el) return;
  el.classList.remove('collapsed');
  const head = el.querySelector('.section-head');
  if (head) head.setAttribute('aria-expanded', 'true');
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}
