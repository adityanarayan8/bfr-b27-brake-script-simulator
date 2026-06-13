import { suite, test, note, assert, assertClose } from './harness.js';
import { defaultConfig } from '../js/config.js';
import { optimize, evaluateCandidate, applyCandidate, describeValue, OPTIMIZABLE } from '../js/optimize.js';
import { masterCylinderByBore } from '../js/components.js';

const base = defaultConfig();

suite('Optimizer, band constraint');

test('a successful result always has both forces inside the band', () => {
  for (const spec of OPTIMIZABLE) {
    const r = optimize(base, spec.key, { samples: 61 });
    if (r.status !== 'ok') continue;
    assert(r.best !== null, `${spec.key}: status ok but best is null`);
    assert(r.best.inBand, `${spec.key}: best result is not in band`);
    assert(
      r.best.front >= base.goalLowerLimit - 1e-9 && r.best.front <= base.goalUpperLimit + 1e-9,
      `${spec.key}: front ${r.best.front} outside band`
    );
    assert(
      r.best.rear >= base.goalLowerLimit - 1e-9 && r.best.rear <= base.goalUpperLimit + 1e-9,
      `${spec.key}: rear ${r.best.rear} outside band`
    );
    note(`${spec.label}: ${describeValue(spec.key, r.best.x, spec.decimals)} → gap ${r.best.gap.toFixed(2)} lbf`);
  }
});

test('status is never "ok" when best is null', () => {
  for (const spec of OPTIMIZABLE) {
    const r = optimize(base, spec.key, { samples: 41 });
    if (r.best === null) assert(r.status !== 'ok', `${spec.key}: null best reported as ok`);
    if (r.status === 'ok') assert(r.best !== null, `${spec.key}: ok status with null best`);
  }
});

test('an impossible band reports none-in-band, not a fake success', () => {
  const impossible = { ...base, goalLowerLimit: 10, goalUpperLimit: 11 };
  const r = optimize(impossible, 'biasBarFrontBias', { samples: 61 });

  assert(r.status === 'none-in-band', `expected none-in-band, got ${r.status}`);
  assert(r.best === null, 'best must be null when nothing is in band');
  assert(r.closest !== null, 'closest must be reported');
  assert(r.closest.violation > 0, 'closest should genuinely miss the band');
  assert(r.tightest !== null, 'tightest balance should still be reported');
  assert(/closest/i.test(r.message), 'message should name the closest value');
  note(`message: ${r.message.slice(0, 120)}…`);
});

test('the tightest balance is reported separately from the recommendation', () => {
  const r = optimize(base, 'biasBarFrontBias', { samples: 121 });
  assert(r.tightest !== null, 'tightest should always be present');
  const globalMin = r.sweep.filter((p) => p.converged).reduce((a, b) => (b.gap < a.gap ? b : a));
  assertClose(r.tightest.gap, globalMin.gap, 1e-12, 'tightest gap');
});

suite('Optimizer, search behaviour');

test('discrete MC bore search only returns catalogue sizes', () => {
  for (const key of ['frontMC', 'rearMC']) {
    const r = optimize(base, key, {});
    const candidates = r.status === 'ok' ? [r.best] : [r.closest];
    for (const c of candidates) {
      if (!c) continue;
      assert(masterCylinderByBore(c.x) !== null, `${key}: ${c.x} is not a catalogue bore`);
    }
  }
});

test('an optimized MC bore is relabelled as the catalogue part', () => {
  const label = describeValue('frontMC', 0.75, 4);
  assert(/Tilton 78-750/.test(label), `expected a part name, got "${label}"`);
  const bare = describeValue('frontMC', 0.6789, 4);
  assert(/not a catalogue size/.test(bare), `expected a non-catalogue note, got "${bare}"`);
});

test('continuous refinement never returns a worse gap than the coarse scan', () => {
  const r = optimize(base, 'pedalRatio', { samples: 61 });
  if (r.status !== 'ok') return;
  const coarseBest = r.sweep
    .filter((p) => p.converged && p.inBand)
    .reduce((a, b) => (b.gap < a.gap ? b : a));
  assert(
    r.best.gap <= coarseBest.gap + 1e-9,
    `refined gap ${r.best.gap} is worse than coarse ${coarseBest.gap}`
  );
});

test('the sweep covers the declared range', () => {
  const spec = OPTIMIZABLE.find((o) => o.key === 'biasBarFrontBias');
  const r = optimize(base, 'biasBarFrontBias', { samples: 41 });
  assertClose(r.sweep[0].x, spec.min, 1e-12, 'sweep start');
  assertClose(r.sweep[r.sweep.length - 1].x, spec.max, 1e-12, 'sweep end');
});

suite('Optimizer, candidate application');

test('applying a candidate leaves every other input untouched', () => {
  const next = applyCandidate(base, 'pedalRatio', 5.0);
  for (const k of Object.keys(base)) {
    if (k === 'pedalRatio' || k === 'units' || k === 'eventSpeeds') continue;
    assert(next[k] === base[k], `${k} changed while optimizing pedalRatio`);
  }
  assertClose(next.pedalRatio, 5.0, 0, 'pedalRatio');
});

test('applying an MC bore re-points the part dropdown', () => {
  const onCatalogue = applyCandidate(base, 'frontMC', 0.875);
  assert(onCatalogue.frontMCId === 'tilton-78-875', `got ${onCatalogue.frontMCId}`);
  const offCatalogue = applyCandidate(base, 'frontMC', 0.66);
  assert(offCatalogue.frontMCId === 'custom-mc', `got ${offCatalogue.frontMCId}`);
});

test('applying a pad mu re-points the pad dropdown', () => {
  const onCatalogue = applyCandidate(base, 'rearRotorMu', 0.5);
  assert(onCatalogue.rearPadId === 'bp-40', `got ${onCatalogue.rearPadId}`);
  const offCatalogue = applyCandidate(base, 'rearRotorMu', 0.62);
  assert(offCatalogue.rearPadId === 'custom-pad', `got ${offCatalogue.rearPadId}`);
});

test('evaluateCandidate agrees with a full-length solve at the event speed', () => {
  const truncated = evaluateCandidate(base, 'pedalRatio', base.pedalRatio, 42);
  const { solve, sampleAt } = _solverRef;
  const full = solve({ ...base });
  assertClose(truncated.front, sampleAt(full, full.frontPedalForce, 42), 1e-9, 'front at 42 mph');
  assertClose(truncated.rear, sampleAt(full, full.rearPedalForce, 42), 1e-9, 'rear at 42 mph');
  assertClose(truncated.decel, sampleAt(full, full.deceleration, 42), 1e-9, 'decel at 42 mph');
});

import * as _solverRef from '../js/solver.js';
