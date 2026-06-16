import { h, $, toast } from './dom.js';
import { state, activeValues, refs, requestRecompute, MAX_CONFIGS } from './state.js';
import {
  buildField, syncField, fieldsFor, labelledSelect, revealBox, specBlock,
  warningSlot, derivedSlot, renderSpecBlock, customNumber, buildSection, openSection,
} from './fields.js';
import {
  FRONT_CALIPERS, REAR_CALIPERS, MASTER_CYLINDERS, PADS, FRONT_ROTORS, REAR_ROTORS,
  DRIVER_WEIGHTS, EVENT_SPEEDS, AERO_PRESETS, DOWNFORCE_EQUATIONS, CONFIG_COLORS,
  PISTON_COUNTS, CALIPER_TYPES, padById, padCaliperWarning,
} from './components.js';
import {
  SECTIONS, coerceField, activeEventSpeeds, primaryEventSpeed,
  applyFrontCaliper, applyRearCaliper, applyMasterCylinder, applyPad, applyRotor,
  applyAeroPreset, applyDriverWeight,
} from './config.js';
import { UNITS, toDisplay, toCanonical, fmt } from './units.js';

const IN_PER_MM = 1 / 25.4;

function updateActive(fn) {
  const i = state.activeIndex;
  state.configs[i].values = fn(state.configs[i].values);
}

function caliperSection(side) {
  const isFront = side === 'front';
  const catalogue = isFront ? FRONT_CALIPERS : REAR_CALIPERS;
  const applyCaliper = isFront ? applyFrontCaliper : applyRearCaliper;
  const boreKey = isFront ? 'frontCaliper' : 'rearCaliper';
  const countKey = isFront ? 'frontCaliperNum' : 'rearCaliperNum';
  const typeKey = isFront ? 'frontCaliperType' : 'rearCaliperType';
  const muKey = isFront ? 'frontRotorMu' : 'rearRotorMu';

  const pistonSel = h('select', { class: 'select', 'aria-label': 'Total piston count' },
    ...PISTON_COUNTS.map((n) => h('option', { value: n }, `${n} pistons`)));
  pistonSel.addEventListener('change', () => {
    activeValues()[countKey] = parseInt(pistonSel.value, 10);
    requestRecompute();
  });
  refs.selects.set(`${side}CaliperPistons`, pistonSel);

  const typeSel = h('select', { class: 'select', 'aria-label': 'Caliper design' },
    ...CALIPER_TYPES.map((t) => h('option', { value: t.id }, t.name)));
  typeSel.addEventListener('change', () => {
    activeValues()[typeKey] = typeSel.value;
    requestRecompute();
  });
  refs.selects.set(`${side}CaliperType`, typeSel);

  const boreInput = h('input', { type: 'number', class: 'num', step: '0.01', 'aria-label': 'Caliper bore' });
  const boreUnit = h('select', { class: 'select select-unit', 'aria-label': 'Caliper bore unit' },
    ...UNITS.length_mm.options.map((o) => h('option', { value: o.id }, o.label)));
  boreInput.addEventListener('input', () => {
    const v = activeValues();
    const canonical = toCanonical('length_mm', v.units.length_mm, parseFloat(boreInput.value));
    v[boreKey] = coerceField(boreKey, canonical, v[boreKey]);
    requestRecompute();
  });
  boreUnit.addEventListener('change', () => {
    activeValues().units.length_mm = boreUnit.value;
    requestRecompute();
  });
  refs.custom.set(`${side}CaliperBore`, {
    input: boreInput, key: boreKey, unitSel: boreUnit, family: 'length_mm',
  });

  const padSel = h('select', { class: 'select select-wide', 'aria-label': 'Brake pad' },
    ...PADS.map((p) => h('option', { value: p.id }, p.name)));
  padSel.addEventListener('change', () => {
    updateActive((v) => applyPad(v, side, padSel.value));
    requestRecompute();
  });
  refs.selects.set(`${side}Pad`, padSel);

  const padMu = h('input', {
    type: 'number', class: 'num', step: '0.005', 'aria-label': 'Pad friction coefficient',
  });
  padMu.addEventListener('input', () => {
    const v = activeValues();
    v[muKey] = coerceField(muKey, parseFloat(padMu.value), v[muKey]);
    requestRecompute();
  });
  refs.custom.set(`${side}PadMu`, { input: padMu, key: muKey });

  const inlineField = (label, ...controls) => h('div', { class: 'field' },
    h('div', { class: 'field-head' },
      h('span', { class: 'field-label' }, label),
      h('span', { class: 'field-inputs' }, ...controls)));

  return buildSection(`${side}-caliper`, `${isFront ? 'Front' : 'Rear'} caliper`, [
    labelledSelect('Caliper', `${side}Caliper`, catalogue, (id) => {
      updateActive((v) => applyCaliper(v, id));
    }),
    specBlock(`${side}Caliper`),
    revealBox(`${side}CaliperCustom`,
      inlineField('Bore', boreInput, boreUnit),
      inlineField('Total piston count', pistonSel),
      inlineField('Design', typeSel)),
    h('div', { class: 'field' },
      h('div', { class: 'field-head' }, h('span', { class: 'field-label' }, 'Brake pad')),
      padSel),
    inlineField('Pad friction coefficient (mu)', padMu),
    warningSlot(`${side}Pad`),
    derivedSlot(`${side}CaliperArea`),
  ]);
}

function hydraulicsSection(side) {
  const isFront = side === 'front';
  return buildSection(`${side}-hydraulics`, `${isFront ? 'Front' : 'Rear'} hydraulics and rotor`, [
    labelledSelect('Master cylinder', `${side}MC`, MASTER_CYLINDERS, (id) => {
      updateActive((v) => applyMasterCylinder(v, side, id));
    }),
    revealBox(`${side}MCCustom`,
      customNumber(`${side}MCBore`, isFront ? 'frontMC' : 'rearMC',
        { label: 'MC bore', unit: 'in', step: 0.001 })),
    derivedSlot(`${side}MC`),
    labelledSelect('Rotor', `${side}Rotor`, isFront ? FRONT_ROTORS : REAR_ROTORS, (id) => {
      updateActive((v) => applyRotor(v, side, id));
    }),
    ...fieldsFor(`${side}-hydraulics`).map(buildField),
    derivedSlot(`${side}Rotor`),
  ]);
}

function vehicleSection() {
  const dwSel = h('select', { class: 'select select-wide', 'aria-label': 'Driver weight preset' },
    ...DRIVER_WEIGHTS.map((d) => h('option', { value: d.id }, d.name)));
  dwSel.addEventListener('change', () => {
    updateActive((v) => applyDriverWeight(v, dwSel.value));
    requestRecompute();
  });
  refs.selects.set('driverWeight', dwSel);

  const all = fieldsFor('vehicle');
  const driverField = all.find((f) => f.key === 'driverWeight');
  const rest = all.filter((f) => f.key !== 'driverWeight');

  return buildSection('vehicle', 'Vehicle and driver', [
    h('div', { class: 'field' },
      h('div', { class: 'field-head' }, h('span', { class: 'field-label' }, 'Driver weight preset')),
      dwSel),
    buildField(driverField),
    h('p', { class: 'hint' },
      'Rear weight bias and CG height are separate inputs. Changing driver weight moves total weight only.'),
    ...rest.map(buildField),
    derivedSlot('weight'),
  ]);
}

function aeroSection() {
  const eqSel = h('select', { class: 'select select-wide', 'aria-label': 'Downforce equation' },
    ...DOWNFORCE_EQUATIONS.map((e) => h('option', { value: e.id }, e.name)));
  eqSel.addEventListener('change', () => {
    activeValues().downforceMode = eqSel.value;
    requestRecompute();
  });
  refs.selects.set('downforceMode', eqSel);

  const eqDetail = h('div', { class: 'derived' });
  refs.derived.set('downforceDetail', eqDetail);

  const presetSel = h('select', { class: 'select select-wide', 'aria-label': 'Aero preset' },
    ...AERO_PRESETS.map((p) => h('option', { value: p.id }, p.name)));
  presetSel.addEventListener('change', () => {
    updateActive((v) => applyAeroPreset(v, presetSel.value));
    requestRecompute();
  });
  refs.selects.set('aeroPreset', presetSel);

  const varCp = h('input', { type: 'checkbox' });
  varCp.addEventListener('change', () => {
    activeValues().variableCP = varCp.checked;
    requestRecompute();
  });
  refs.custom.set('variableCP', { input: varCp, key: 'variableCP' });

  const aeroFields = fieldsFor('aero');

  return buildSection('aero', 'Aerodynamics', [
    h('div', { class: 'field' },
      h('div', { class: 'field-head' }, h('span', { class: 'field-label' }, 'Downforce equation')),
      eqSel),
    eqDetail,
    revealBox('aeroInputs',
      h('div', { class: 'field' },
        h('div', { class: 'field-head' }, h('span', { class: 'field-label' }, 'Preset')),
        presetSel),
      h('p', { class: 'hint' },
        'The reference area is stated in every preset because a lift coefficient is only valid against the area it was measured on.'),
      ...aeroFields.filter((f) => f.aeroOnly).map(buildField)),
    h('div', { class: 'field' },
      h('label', { class: 'check' }, varCp, ' Variable cp (centre of pressure moves with deceleration)')),
    ...aeroFields.filter((f) => !f.aeroOnly).map(buildField),
    derivedSlot('downforce'),
  ]);
}

function goalSection() {
  const eventList = h('div', { class: 'event-list' });

  refs.eventRows = EVENT_SPEEDS.map((spec, i) => {
    const chk = h('input', { type: 'checkbox' });
    const numInput = spec.custom
      ? h('input', { type: 'number', class: 'num num-tiny', step: '1', 'aria-label': 'Custom event speed in mph' })
      : null;
    const tag = h('span', { class: 'primary-tag' });

    chk.addEventListener('change', () => {
      activeValues().eventSpeeds[i].on = chk.checked;
      requestRecompute();
    });

    if (numInput) {
      numInput.addEventListener('input', () => {
        const value = parseFloat(numInput.value);
        if (Number.isFinite(value) && value > 0) {
          activeValues().eventSpeeds[i].value = value;
          requestRecompute();
        }
      });
    }

    eventList.append(h('label', { class: 'event-row' }, chk, spec.name, numInput, tag));
    return { chk, numInput, tag };
  });

  return buildSection('goal', 'Goal band and event speeds', [
    ...fieldsFor('goal').map(buildField),
    h('div', { class: 'field' },
      h('div', { class: 'field-head' }, h('span', { class: 'field-label' }, 'Event speeds')),
      h('p', { class: 'hint' },
        'More than one can be active. Each draws its own line on the plots and its own row in the results table. The first active one is the primary, and is what the optimizer targets.'),
      eventList),
  ]);
}

export function buildPanel() {
  $('sections').replaceChildren(
    caliperSection('front'),
    caliperSection('rear'),
    hydraulicsSection('front'),
    hydraulicsSection('rear'),
    buildSection('pedal-box', 'Pedal box and bias', [
      ...fieldsFor('pedal-box').map(buildField),
      derivedSlot('bias'),
    ]),
    vehicleSection(),
    aeroSection(),
    buildSection('tire', 'Tire model', [
      h('p', { class: 'hint' }, 'mu(Fz) = (a − b·Fz) · scale1 · scale2, with Fz the load on a single tire.'),
      ...fieldsFor('tire').map(buildField),
      derivedSlot('tire'),
    ]),
    goalSection());

  const jump = $('jump-select');
  jump.replaceChildren(
    h('option', { value: '' }, 'Jump to a section'),
    ...SECTIONS.map((s) => h('option', { value: s.id }, s.label)));
  jump.addEventListener('change', () => {
    if (jump.value) openSection(jump.value);
    jump.value = '';
  });
}

let configRows = [];

function paintActiveRow() {
  configRows.forEach(({ row, tag }, i) => {
    const isActive = i === state.activeIndex;
    row.classList.toggle('active', isActive);
    tag.hidden = !isActive;
  });
}

function selectConfig(i) {
  if (state.activeIndex === i) return;
  state.activeIndex = i;
  paintActiveRow();
  syncPanel();
}

export function renderConfigList() {
  const list = $('config-list');
  configRows = [];

  list.replaceChildren(...state.configs.map((entry, i) => {
    const select = () => selectConfig(i);

    const nameInput = h('input', {
      class: 'config-name', value: entry.name, 'aria-label': `Name of configuration ${i + 1}`,
    });
    nameInput.addEventListener('input', () => {
      entry.name = nameInput.value;
      requestRecompute();
    });
    nameInput.addEventListener('focus', select);

    const enable = h('input', {
      type: 'checkbox', 'aria-label': `Show ${entry.name} on the plots`,
    });
    enable.checked = entry.enabled;
    enable.addEventListener('click', (e) => e.stopPropagation());
    enable.addEventListener('change', () => {
      entry.enabled = enable.checked;
      requestRecompute();
    });

    const dup = h('button', {
      type: 'button', class: 'btn-icon', title: 'Duplicate', 'aria-label': `Duplicate ${entry.name}`,
    }, '⧉');
    dup.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.configs.length >= MAX_CONFIGS) {
        toast(`Maximum of ${MAX_CONFIGS} configurations.`);
        return;
      }
      state.configs.splice(i + 1, 0, {
        name: `${entry.name} copy`,
        color: CONFIG_COLORS[state.configs.length % CONFIG_COLORS.length],
        enabled: true,
        values: structuredClone(entry.values),
      });
      state.activeIndex = i + 1;
      renderConfigList();
      syncPanel();
      requestRecompute();
    });

    const del = h('button', {
      type: 'button', class: 'btn-icon danger', title: 'Delete', 'aria-label': `Delete ${entry.name}`,
    }, '✕');
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.configs.length === 1) {
        toast('At least one configuration is required.');
        return;
      }
      state.configs.splice(i, 1);
      state.activeIndex = Math.min(state.activeIndex, state.configs.length - 1);
      renderConfigList();
      syncPanel();
      requestRecompute();
    });

    const tag = h('span', { class: 'config-editing-tag' }, 'editing');

    const row = h('div', { class: 'config-row' },
      enable,
      h('span', { class: 'config-swatch', style: `background:${entry.color}`, 'aria-hidden': 'true' }),
      nameInput,
      tag,
      dup, del);

    row.addEventListener('click', select);
    configRows.push({ row, tag });
    return row;
  }));

  paintActiveRow();

  $('btn-add-config').disabled = state.configs.length >= MAX_CONFIGS;
}

export function syncPanel() {
  const v = activeValues();

  for (const key of refs.fields.keys()) syncField(key, null);

  const setSelect = (name, value) => {
    const sel = refs.selects.get(name);
    if (sel) sel.value = value;
  };
  const reveal = (name, on) => {
    const box = refs.reveals.get(name);
    if (box) box.hidden = !on;
  };

  setSelect('frontCaliper', v.frontCaliperId);
  setSelect('rearCaliper', v.rearCaliperId);
  setSelect('frontMC', v.frontMCId);
  setSelect('rearMC', v.rearMCId);
  setSelect('frontPad', v.frontPadId);
  setSelect('rearPad', v.rearPadId);
  setSelect('frontRotor', v.frontRotorId);
  setSelect('rearRotor', v.rearRotorId);
  setSelect('driverWeight', v.driverWeightId);
  setSelect('downforceMode', v.downforceMode);
  setSelect('aeroPreset', v.aeroPresetId);
  setSelect('frontCaliperPistons', String(v.frontCaliperNum));
  setSelect('rearCaliperPistons', String(v.rearCaliperNum));
  setSelect('frontCaliperType', v.frontCaliperType);
  setSelect('rearCaliperType', v.rearCaliperType);

  const frontCal = FRONT_CALIPERS.find((c) => c.id === v.frontCaliperId);
  const rearCal = REAR_CALIPERS.find((c) => c.id === v.rearCaliperId);

  reveal('frontCaliperCustom', Boolean(frontCal && frontCal.custom));
  reveal('rearCaliperCustom', Boolean(rearCal && rearCal.custom));
  reveal('frontMCCustom', v.frontMCId === 'custom-mc');
  reveal('rearMCCustom', v.rearMCId === 'custom-mc');
  reveal('aeroInputs', v.downforceMode === 'clArea');

  renderSpecBlock('frontCaliper', frontCal && !frontCal.custom ? frontCal.spec : null);
  renderSpecBlock('rearCaliper', rearCal && !rearCal.custom ? rearCal.spec : null);

  const setCustom = (name, value, family) => {
    const c = refs.custom.get(name);
    if (!c) return;
    if (c.input.type === 'checkbox') { c.input.checked = Boolean(value); return; }
    if (document.activeElement === c.input) return;
    const unitId = family ? v.units[family] : null;
    c.input.value = family ? Number(toDisplay(family, unitId, value).toFixed(4)) : value;
    if (c.unitSel && unitId) c.unitSel.value = unitId;
  };
  setCustom('frontCaliperBore', v.frontCaliper, 'length_mm');
  setCustom('rearCaliperBore', v.rearCaliper, 'length_mm');
  setCustom('frontMCBore', v.frontMC);
  setCustom('rearMCBore', v.rearMC);
  setCustom('frontPadMu', v.frontRotorMu);
  setCustom('rearPadMu', v.rearRotorMu);
  setCustom('variableCP', v.variableCP);

  const primary = activeEventSpeeds(v)[0];
  refs.eventRows.forEach((row, i) => {
    const e = v.eventSpeeds[i];
    row.chk.checked = e.on;
    if (row.numInput && document.activeElement !== row.numInput) row.numInput.value = e.value;
    row.tag.textContent = e === primary ? 'primary' : '';
  });

  const setWarning = (name, message) => {
    const el = refs.warnings.get(name);
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
  };
  setWarning('frontPad', padCaliperWarning(padById(v.frontPadId), frontCal));
  setWarning('rearPad', padCaliperWarning(padById(v.rearPadId), rearCal));

  const eq = DOWNFORCE_EQUATIONS.find((e) => e.id === v.downforceMode);
  const detail = refs.derived.get('downforceDetail');
  if (detail && eq) detail.textContent = eq.detail;
}

export function syncDerived(result) {
  const v = activeValues();
  const write = (name, html) => {
    const el = refs.derived.get(name);
    if (el) el.innerHTML = html;
  };

  const pistonArea = (bore, count) => count * Math.PI * Math.pow((bore * IN_PER_MM) / 2, 2);
  const boreArea = (bore) => Math.PI * Math.pow(bore / 2, 2);
  const annulusMm = (od, id) => ((od - id) / 2) / IN_PER_MM;

  write('frontCaliperArea',
    `Total piston area <strong>${fmt(pistonArea(v.frontCaliper, v.frontCaliperNum), 4)} in²</strong> · pad mu <strong>${fmt(v.frontRotorMu, 3)}</strong>`);
  write('rearCaliperArea',
    `Total piston area <strong>${fmt(pistonArea(v.rearCaliper, v.rearCaliperNum), 4)} in²</strong> · pad mu <strong>${fmt(v.rearRotorMu, 3)}</strong>`);

  write('frontMC', `Bore area <strong>${fmt(boreArea(v.frontMC), 4)} in²</strong>`);
  write('rearMC', `Bore area <strong>${fmt(boreArea(v.rearMC), 4)} in²</strong>`);

  write('frontRotor',
    `Effective radius (OD+ID)/4 = <strong>${fmt((v.frontRotorOD + v.frontRotorID) / 4, 4)} in</strong> · annulus <strong>${fmt(annulusMm(v.frontRotorOD, v.frontRotorID), 1)} mm</strong>`);
  write('rearRotor',
    `Effective radius (OD+ID)/4 = <strong>${fmt((v.rearRotorOD + v.rearRotorID) / 4, 4)} in</strong> · annulus <strong>${fmt(annulusMm(v.rearRotorOD, v.rearRotorID), 1)} mm</strong>`);

  write('bias',
    `Effective brake bias (rear share) = <strong>${fmt(result.effectiveBrakeBias, 5)}</strong><br>frontTotal <strong>${fmt(result.frontTotal, 3)}</strong> · rearTotal <strong>${fmt(result.rearTotal, 3)}</strong>`);

  write('weight',
    `Total <strong>${fmt(result.weight, 1)} lbf</strong> · front <strong>${fmt(result.weightFront, 1)}</strong> · rear <strong>${fmt(result.weightRear, 1)}</strong>`);

  const ev = primaryEventSpeed(v);
  const idx = Math.round(ev);
  const downforce = idx < result.downforce.length ? result.downforce[idx] : 0;
  write('downforce',
    `Downforce at ${ev} mph = <strong>${fmt(downforce, 1)}</strong> · cp at that speed = <strong>${result.converged[idx] ? fmt(result.cpValues[idx], 4) : 'n/a'}</strong>`);

  const muAt = (Fz) => (v.tireA - v.tireB * Fz) * v.tireScale1 * v.tireScale2;
  write('tire',
    `mu at 100 lbf <strong>${fmt(muAt(100), 4)}</strong> · at 200 lbf <strong>${fmt(muAt(200), 4)}</strong> · at 400 lbf <strong>${fmt(muAt(400), 4)}</strong>`);
}
