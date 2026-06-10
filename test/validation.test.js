import { suite, test, note, assertClose, assertBetween, assert } from './harness.js';
import { defaultConfig } from '../js/config.js';
import { solve, makeDownforce, computeBias, MPH2MPS } from '../js/solver.js';

const base = defaultConfig();

suite('Brake bias (aero-independent)');

test('effectiveBrakeBias === 0.38556', () => {
  const { effectiveBrakeBias } = computeBias(base);
  note(`effectiveBrakeBias = ${effectiveBrakeBias.toFixed(6)}`);
  assertClose(effectiveBrakeBias, 0.38556, 5e-5, 'effectiveBrakeBias');
});

suite('Zero-speed pedal forces (hold under every downforce option)');

for (const mode of ['plotted', 'plotted445', 'clArea']) {
  test(`front pedal force at 0 mph === 51.5 lbf  [${mode}]`, () => {
    const r = solve({ ...base, downforceMode: mode });
    note(`front @ 0 mph = ${r.frontPedalForce[0].toFixed(2)} lbf`);
    assertClose(r.frontPedalForce[0], 51.5, 0.1, 'front pedal force at 0 mph');
  });

  test(`rear pedal force at 0 mph === 53.7 lbf  [${mode}]`, () => {
    const r = solve({ ...base, downforceMode: mode });
    note(`rear  @ 0 mph = ${r.rearPedalForce[0].toFixed(2)} lbf`);
    assertClose(r.rearPedalForce[0], 53.7, 0.1, 'rear pedal force at 0 mph');
  });
}

suite('Default downforce equation, 0.5 * 3 * 1.225 * v^2');

test('downforce at 42 mph === 648', () => {
  const df = makeDownforce({ ...base, downforceMode: 'plotted' });
  note(`downforce(42) = ${df(42).toFixed(1)}`);
  assertClose(df(42), 648, 1, 'downforce at 42 mph');
});

test('deceleration at 42 mph ~= 2.69 g', () => {
  const r = solve({ ...base, downforceMode: 'plotted' });
  note(`decel(42) = ${r.deceleration[42].toFixed(4)} g`);
  assertClose(r.deceleration[42], 2.69, 0.02, 'deceleration at 42 mph');
});

test('front pedal force at 42 mph within 110-115 lbf', () => {
  const r = solve({ ...base, downforceMode: 'plotted' });
  note(`front @ 42 mph = ${r.frontPedalForce[42].toFixed(2)} lbf`);
  assertBetween(r.frontPedalForce[42], 110, 115, 'front pedal force at 42 mph');
});

suite('Updated Cl/area equation, Cl 2.03, 2.71785 m2, rho 1.184');

const clCfg = {
  ...base,
  downforceMode: 'clArea',
  Cl: 2.03,
  wingArea: 2.71785,
  airDensity: 1.184,
};

test('downforce at 42 mph === 1151', () => {
  const df = makeDownforce(clCfg);
  note(`downforce(42) = ${df(42).toFixed(1)}`);
  assertClose(df(42), 1151, 1, 'downforce at 42 mph');
});

test('deceleration at 42 mph ~= 3.5 g', () => {
  const r = solve(clCfg);
  note(`decel(42) = ${r.deceleration[42].toFixed(4)} g`);
  assertClose(r.deceleration[42], 3.5, 0.05, 'deceleration at 42 mph');
});

test('front pedal force at 42 mph ~= 166 lbf', () => {
  const r = solve(clCfg);
  note(`front @ 42 mph = ${r.frontPedalForce[42].toFixed(2)} lbf`);
  assertClose(r.frontPedalForce[42], 166, 2, 'front pedal force at 42 mph');
});

suite('Downforce equation options');

test('the 1/4.45 variant is exactly 1/4.45 of the plotted variant', () => {
  const a = makeDownforce({ ...base, downforceMode: 'plotted' });
  const b = makeDownforce({ ...base, downforceMode: 'plotted445' });
  for (const v of [10, 25, 42, 70]) {
    assertClose(b(v), a(v) / 4.45, 1e-9, `downforce at ${v} mph`);
  }
});

test('all three equations give zero downforce at 0 mph', () => {
  for (const mode of ['plotted', 'plotted445', 'clArea']) {
    const df = makeDownforce({ ...base, downforceMode: mode });
    assertClose(df(0), 0, 0, `downforce at 0 mph [${mode}]`);
  }
});

test('mph2mps constant matches the source', () => {
  assertClose(MPH2MPS, (5280 * 0.3048) / 3600, 0, 'mph2mps');
});

suite('Solve structure');

test('deceleration is monotonically non-decreasing across speed', () => {
  const r = solve({ ...base, downforceMode: 'plotted' });
  for (let i = 1; i < r.speeds.length; i++) {
    if (!r.converged[i] || !r.converged[i - 1]) continue;
    assert(
      r.deceleration[i] >= r.deceleration[i - 1] - 1e-9,
      `deceleration dropped between ${r.speeds[i - 1]} and ${r.speeds[i]} mph: ` +
        `${r.deceleration[i - 1].toFixed(6)} -> ${r.deceleration[i].toFixed(6)}`
    );
  }
});

test('every speed converges on the default configuration', () => {
  const r = solve({ ...base, downforceMode: 'plotted' });
  assert(
    r.failedSpeeds.length === 0,
    `expected no convergence failures, got ${r.failedSpeeds.length} at ${r.failedSpeeds.join(', ')} mph`
  );
});

test('a non-converging speed leaves zeros, not garbage', () => {
  const r = solve({ ...base, downforceMode: 'plotted', maxBrakingGuess: 1.01 });
  assert(r.failedSpeeds.length > 0, 'expected some speeds to fail to converge');
  for (let i = 0; i < r.speeds.length; i++) {
    if (r.converged[i]) continue;
    assert(r.deceleration[i] === 0, `decel at ${r.speeds[i]} mph should be 0`);
    assert(r.frontPedalForce[i] === 0, `front pedal force at ${r.speeds[i]} mph should be 0`);
    assert(r.rearPedalForce[i] === 0, `rear pedal force at ${r.speeds[i]} mph should be 0`);
  }
});

suite('Driver weight');

test('changing driver weight moves total weight but not rearBias or cgZ', () => {
  const before = { ...base };
  const after = { ...base, driverWeight: 200 };

  const rb = solve({ ...before, downforceMode: 'plotted' });
  const ra = solve({ ...after, downforceMode: 'plotted' });

  assertClose(rb.weight, 365 + 170, 1e-9, 'weight before');
  assertClose(ra.weight, 365 + 200, 1e-9, 'weight after');
  assert(ra.weight !== rb.weight, 'total weight should have changed');

  assert(after.rearBias === before.rearBias, 'rearBias must be untouched');
  assert(
    after.centerGravityZ === before.centerGravityZ,
    'centerGravityZ must be untouched'
  );

  assertClose(ra.weightRear / ra.weight, after.rearBias, 1e-12, 'rear weight share');
  assertClose(ra.weightFront / ra.weight, 1 - after.rearBias, 1e-12, 'front weight share');
});

suite('variableCP off (fixed cp = 0.56)');

test('fixed-cp path solves and differs from the variable-cp path above 0 mph', () => {
  const varCp = solve({ ...base, downforceMode: 'plotted', variableCP: true });
  const fixCp = solve({ ...base, downforceMode: 'plotted', variableCP: false });

  assert(fixCp.failedSpeeds.length === 0, 'fixed-cp path should converge everywhere');

  assertClose(fixCp.deceleration[0], varCp.deceleration[0], 1e-9, 'decel at 0 mph');

  assert(
    Math.abs(fixCp.deceleration[42] - varCp.deceleration[42]) > 1e-6,
    'fixed and variable cp should differ at 42 mph'
  );
});
