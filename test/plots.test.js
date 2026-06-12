import { suite, test, note, assert, assertClose } from './harness.js';
import { defaultConfig } from '../js/config.js';
import { solve } from '../js/solver.js';
import {
  Chart, pedalForceSpec, decelerationSpec, torqueSpec, linePressureSpec, specBoxFor,
} from '../js/plots.js';

const base = defaultConfig();

function solvedFor(values, name = 'Car as built', color = '#003262') {
  return [{ entry: { name, color, enabled: true, values }, result: solve(values) }];
}

function stubCanvas() {
  const noop = () => {};
  const ctx = new Proxy({}, {
    get: (t, k) => {
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'getImageData') return () => ({ data: [] });
      return noop;
    },
    set: () => true,
  });
  return {
    getContext: () => ctx,
    addEventListener: noop,
    removeEventListener: noop,
    clientWidth: 700,
    clientHeight: 420,
    width: 700,
    height: 420,
  };
}

function legendOf(spec) {
  const c = new Chart(stubCanvas());
  c.spec = spec;
  return c._legendEntries();
}

suite('Plot defect 1, no phantom legend entries');

test('every legend entry corresponds to something actually drawn', () => {
  const solved = solvedFor(base);
  for (const [name, spec] of [
    ['pedal force', pedalForceSpec(solved, base, {})],
    ['deceleration', decelerationSpec(solved, base, {})],
    ['torque', torqueSpec(solved, base, {})],
    ['line pressure', linePressureSpec(solved, base, {})],
  ]) {
    const legend = legendOf(spec);
    for (const e of legend) {
      assert(typeof e.name === 'string' && e.name.length > 0, `${name}: unnamed legend entry`);
      assert(!/^data\d+$/i.test(e.name), `${name}: phantom MATLAB-style entry "${e.name}"`);
    }
    const names = legend.map((e) => e.name);
    assert(new Set(names).size === names.length, `${name}: duplicate legend entries: ${names.join(', ')}`);
    note(`${name}: [${names.join(' | ')}]`);
  }
});

test('the goal band and event-speed lines are labelled, not silent', () => {
  const legend = legendOf(pedalForceSpec(solvedFor(base), base, {}));
  const names = legend.map((e) => e.name).join(' ');
  assert(/goal range/i.test(names), 'goal band has no legend entry');
  assert(/event speed/i.test(names), 'event-speed line has no legend entry');
});

suite('Plot defect 2, autoscale keeps the goal band in view');

test('y-extent covers both the data and the whole goal band', () => {
  const solved = solvedFor(base);
  const spec = pedalForceSpec(solved, base, {});
  const c = new Chart(stubCanvas());
  c.spec = spec;
  const { yMin, yMax } = c._extent();

  const ys = spec.series.flatMap((s) => s.points.map(([, y]) => y));
  const dataMax = Math.max(...ys);
  const dataMin = Math.min(...ys);

  assert(yMax >= dataMax, `top of frame ${yMax} clips data max ${dataMax}`);
  assert(yMin <= dataMin, `bottom of frame ${yMin} clips data min ${dataMin}`);
  assert(yMin <= base.goalLowerLimit, 'goal band lower edge is out of view');
  assert(yMax >= base.goalUpperLimit, 'goal band upper edge is out of view');

  note(`data spans ${dataMin.toFixed(1)}–${dataMax.toFixed(1)} lbf; MATLAB's fixed frame stopped at 140`);
  assert(dataMax > 140, 'expected the source config to exceed the MATLAB frame');
});

test('a manual override is honoured exactly', () => {
  const spec = pedalForceSpec(solvedFor(base), base, { yOverride: { min: 0, max: 200 } });
  const c = new Chart(stubCanvas());
  c.spec = spec;
  const { yMin, yMax } = c._extent();
  assertClose(yMin, 0, 0, 'override min');
  assertClose(yMax, 200, 0, 'override max');
});

suite('Plot defect 3, empty lockup series never reach the legend');

test('a series with no points is dropped', () => {
  const solved = solvedFor(base);
  const modes = new Set(solved[0].result.lockFront);
  assert(modes.size === 1, `expected a single lockup mode on the source config, saw ${[...modes]}`);

  const spec = decelerationSpec(solved, base, {});
  assert(spec.series.length === 1, `expected 1 lockup series, got ${spec.series.length}`);
  assert(spec.series[0].points.length > 0, 'the surviving series should carry points');

  const legend = legendOf(spec);
  assert(legend.length === spec.series.length + spec.vlines.filter((v) => v.legendLabel).length,
    'legend should list exactly the drawn elements');
  note(`single mode: ${spec.series[0].name}`);
});

test('no spec ever emits a zero-point series', () => {
  const solved = solvedFor(base);
  for (const spec of [
    pedalForceSpec(solved, base, {}),
    decelerationSpec(solved, base, {}),
    torqueSpec(solved, base, {}),
    linePressureSpec(solved, base, {}),
  ]) {
    for (const s of spec.series) {
      assert(s.points.length > 0, `series "${s.name}" has no points but was emitted`);
    }
  }
});

test('both lockup series appear when both modes actually occur', () => {
  const flipped = { ...base, biasBarFrontBias: 0.62 };
  const solved = solvedFor(flipped);
  const modes = new Set(solved[0].result.lockFront);
  const spec = decelerationSpec(solved, flipped, {});
  assert(spec.series.length === modes.size,
    `saw ${modes.size} lockup mode(s) but ${spec.series.length} series`);
  note(`bias 0.62 → modes present: ${[...modes].map((m) => (m ? 'front' : 'rear')).join(', ')}`);
});

suite('Plot defect 4, non-converged points are dropped, not drawn as zero');

test('failed speeds leave gaps rather than zeros in the plotted series', () => {
  const cfg = { ...base, maxBrakingGuess: 1.01 };
  const solved = solvedFor(cfg);
  const result = solved[0].result;
  assert(result.failedSpeeds.length > 0, 'expected convergence failures for this test');

  const spec = pedalForceSpec(solved, cfg, {});
  for (const s of spec.series) {
    for (const [x, y] of s.points) {
      assert(y !== 0, `series "${s.name}" plotted a zero at ${x} mph instead of omitting it`);
    }
    assert(s.points.length === result.converged.filter(Boolean).length,
      `series "${s.name}" should only contain converged speeds`);
  }
  note(`${result.failedSpeeds.length} speeds omitted from the plot`);
});

suite('Spec box');

test('reproduces the MATLAB annotation contents', () => {
  const solved = solvedFor(base);
  const boxes = specBoxFor(base, solved[0].result);
  const flat = boxes.flatMap((b) => b.rows.map(([k]) => k)).join('|');
  for (const key of [
    'Weight', 'Rear Weight Bias', 'Wheel Base', 'CG Height', '# of Rear Brakes',
    'Tire Radius', 'Front Rotor Mu', 'Rear Rotor Mu',
    'Average Pedal Ratio', 'Front Pedal Bias', 'Front MC Bore', 'Front Rotor OD',
    'Front Rotor ID', 'Front Caliper Bore', 'Rear MC Bore', 'Rear Rotor OD',
    'Rear Rotor ID', 'Rear Caliper Bore',
  ]) {
    assert(flat.includes(key), `spec box is missing "${key}" from the MATLAB annotation`);
  }
});
