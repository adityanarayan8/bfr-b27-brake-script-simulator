/**
 * optimize.js - Constrained single-parameter search.
 *
 * GOAL: Find the value of a single parameter that minimises the difference
 * between the front and rear pedal-force curves at the primary event speed,
 * while keeping both forces within the target band.
 *
 * The band constraint is essential. Without it, the gap can be minimised by
 * setups that achieve near-perfect balance at an impractical absolute pedal
 * force. For example, a 30 lbf balanced pedal is clearly worse than a
 * 105/112 lbf setup. Therefore, a result outside the target band is never
 * reported as a successful optimisation; see `status` on the return value.
 *
 * No DOM access here. `plots.js` consumes the sweep data, and `ui.js` renders
 * the optimisation verdict.
 */

import { solve, sampleAt } from './solver.js';
import { MC_BORES, masterCylinderByBore, PADS } from './components.js';
import { primaryEventSpeed } from './config.js';

export const OPTIMIZABLE = [
  { key: 'biasBarFrontBias', label: 'Bias bar front bias', kind: 'continuous', min: 0.30, max: 0.70, decimals: 4 },
  { key: 'pedalRatio', label: 'Pedal ratio', kind: 'continuous', min: 3.0, max: 7.0, decimals: 3 },
  { key: 'frontMC', label: 'Front MC bore', kind: 'discrete', values: MC_BORES, unit: 'in', decimals: 4 },
  { key: 'rearMC', label: 'Rear MC bore', kind: 'discrete', values: MC_BORES, unit: 'in', decimals: 4 },
  { key: 'frontRotorOD', label: 'Front rotor OD', kind: 'continuous', min: 5.5, max: 9.5, unit: 'in', decimals: 3 },
  { key: 'rearRotorOD', label: 'Rear rotor OD', kind: 'continuous', min: 5.5, max: 9.5, unit: 'in', decimals: 3 },
  { key: 'frontRotorMu', label: 'Front pad mu', kind: 'continuous', min: 0.30, max: 0.80, decimals: 4 },
  { key: 'rearRotorMu', label: 'Rear pad mu', kind: 'continuous', min: 0.30, max: 0.80, decimals: 4 },
];

export function optimizableByKey(key) {
  return OPTIMIZABLE.find((o) => o.key === key) || null;
}

export function applyCandidate(values, key, x) {
  const next = { ...values, [key]: x };

  if (key === 'frontMC' || key === 'rearMC') {
    const part = masterCylinderByBore(x);
    const idKey = key === 'frontMC' ? 'frontMCId' : 'rearMCId';
    next[idKey] = part ? part.id : 'custom-mc';
  }

  if (key === 'frontRotorOD') next.frontRotorId = 'front-custom';
  if (key === 'rearRotorOD') next.rearRotorId = 'rear-custom';

  if (key === 'frontRotorMu' || key === 'rearRotorMu') {
    const pad = PADS.find((p) => !p.custom && Math.abs(p.mu - x) < 1e-9);
    const idKey = key === 'frontRotorMu' ? 'frontPadId' : 'rearPadId';
    next[idKey] = pad ? pad.id : 'custom-pad';
  }

  return next;
}

export function describeValue(key, x, decimals = 4) {
  const spec = optimizableByKey(key);
  const unit = spec && spec.unit ? ` ${spec.unit}` : '';
  const num = `${x.toFixed(decimals)}${unit}`;

  if (key === 'frontMC' || key === 'rearMC') {
    const part = masterCylinderByBore(x);
    if (part) return `${part.name}, ${part.bore} in (${part.boreMm} mm)`;
    return `${num} (not a catalogue size)`;
  }
  if (key === 'frontRotorMu' || key === 'rearRotorMu') {
    const pad = PADS.find((p) => !p.custom && Math.abs(p.mu - x) < 5e-4);
    if (pad) return `${pad.name}, mu ${pad.mu}`;
    return `mu ${num}`;
  }
  return num;
}

export function evaluateCandidate(values, key, x, eventSpeed) {
  const cfg = applyCandidate(values, key, x);
  cfg.topSpeed = Math.max(1, Math.ceil(eventSpeed));

  const r = solve(cfg);
  const front = sampleAt(r, r.frontPedalForce, eventSpeed);
  const rear = sampleAt(r, r.rearPedalForce, eventSpeed);
  const decel = sampleAt(r, r.deceleration, eventSpeed);

  if (front === null || rear === null) {
    return { x, converged: false, front: null, rear: null, gap: null, decel: null, inBand: false, violation: Infinity };
  }

  const lo = values.goalLowerLimit;
  const hi = values.goalUpperLimit;
  const violation =
    Math.max(0, lo - front) + Math.max(0, front - hi) +
    Math.max(0, lo - rear) + Math.max(0, rear - hi);

  return {
    x,
    converged: true,
    front,
    rear,
    gap: Math.abs(front - rear),
    decel,
    inBand: violation === 0,
    violation,
  };
}

const GOLDEN = (Math.sqrt(5) - 1) / 2;

function goldenSection(values, key, a, b, eventSpeed, iterations = 40) {
  let lo = a;
  let hi = b;
  let c = hi - GOLDEN * (hi - lo);
  let d = lo + GOLDEN * (hi - lo);
  let fc = evaluateCandidate(values, key, c, eventSpeed);
  let fd = evaluateCandidate(values, key, d, eventSpeed);

  const score = (p) => (p.converged ? p.gap : Infinity);

  for (let i = 0; i < iterations && hi - lo > 1e-9; i++) {
    if (score(fc) < score(fd)) {
      hi = d;
      d = c;
      fd = fc;
      c = hi - GOLDEN * (hi - lo);
      fc = evaluateCandidate(values, key, c, eventSpeed);
    } else {
      lo = c;
      c = d;
      fc = fd;
      d = lo + GOLDEN * (hi - lo);
      fd = evaluateCandidate(values, key, d, eventSpeed);
    }
  }
  return score(fc) < score(fd) ? fc : fd;
}

export function sweepParameter(values, key, eventSpeed, samples = 161) {
  const spec = optimizableByKey(key);
  if (!spec) return [];

  if (spec.kind === 'discrete') {
    return spec.values.map((x) => evaluateCandidate(values, key, x, eventSpeed));
  }

  const out = [];
  for (let i = 0; i < samples; i++) {
    const x = spec.min + ((spec.max - spec.min) * i) / (samples - 1);
    out.push(evaluateCandidate(values, key, x, eventSpeed));
  }
  return out;
}

export function optimize(values, key, opts = {}) {
  const spec = optimizableByKey(key);
  if (!spec) throw new Error(`not an optimizable parameter: ${key}`);

  const eventSpeed = opts.eventSpeed !== undefined ? opts.eventSpeed : primaryEventSpeed(values);
  const samples = opts.samples || 161;

  const sweep = sweepParameter(values, key, eventSpeed, samples);
  const current = evaluateCandidate(values, key, values[key], eventSpeed);

  const usable = sweep.filter((p) => p.converged);
  if (!usable.length) {
    return {
      key, label: spec.label, kind: spec.kind, eventSpeed,
      currentValue: values[key], current, sweep,
      status: 'no-solution', best: null, closest: null, tightest: null,
      message: `No value of ${spec.label} in its range produced a converged solve at ${eventSpeed} mph. Check "Max braking guess" and the goal band before optimizing.`,
    };
  }

  const inBand = usable.filter((p) => p.inBand);
  const tightest = usable.reduce((a, b) => (b.gap < a.gap ? b : a));

  if (!inBand.length) {
    const closest = usable.reduce((a, b) => (b.violation < a.violation ? b : a));
    const other = OPTIMIZABLE.filter((o) => o.key !== key)
      .slice(0, 3)
      .map((o) => o.label)
      .join(', ');

    return {
      key, label: spec.label, kind: spec.kind, eventSpeed,
      currentValue: values[key], current, sweep,
      status: 'none-in-band',
      best: null,
      closest,
      tightest,
      message:
        `No value of ${spec.label} keeps both pedal forces inside the ` +
        `${values.goalLowerLimit}–${values.goalUpperLimit} lbf band at ${eventSpeed} mph. ` +
        `The closest is ${describeValue(key, closest.x, spec.decimals)}, which misses the band by ` +
        `${closest.violation.toFixed(1)} lbf. Changing ${spec.label} alone cannot fix this, ` +
        `try ${other} first, or widen the band if the goal itself is wrong.`,
    };
  }

  let best = inBand.reduce((a, b) => (b.gap < a.gap ? b : a));

  if (spec.kind === 'continuous') {
    const idx = sweep.indexOf(best);
    const a = sweep[Math.max(0, idx - 1)].x;
    const b = sweep[Math.min(sweep.length - 1, idx + 1)].x;
    const refined = goldenSection(values, key, a, b, eventSpeed);
    if (refined.converged && refined.inBand && refined.gap < best.gap) best = refined;
  }

  const noteTightest =
    tightest.gap < best.gap - 1e-9
      ? ` A tighter balance exists at ${describeValue(key, tightest.x, spec.decimals)} ` +
        `(gap ${tightest.gap.toFixed(2)} lbf) but it falls outside the goal band, so it is not recommended.`
      : '';

  return {
    key, label: spec.label, kind: spec.kind, eventSpeed,
    currentValue: values[key], current, sweep,
    status: 'ok',
    best,
    closest: null,
    tightest,
    message:
      `${spec.label} = ${describeValue(key, best.x, spec.decimals)} balances the axles to within ` +
      `${best.gap.toFixed(2)} lbf at ${eventSpeed} mph, with both forces inside the goal band.` +
      noteTightest,
  };
}
