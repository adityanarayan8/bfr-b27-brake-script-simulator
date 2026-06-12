import { suite, test, note, assert, assertClose } from './harness.js';
import { defaultConfig } from '../js/config.js';
import { solve, GS2FTS2, DECEL_GRID_DIVISIONS } from '../js/solver.js';

const base = defaultConfig();

suite('Fast root find vs the original increment loop');

function compareSearches(cfg, label) {
  const fast = solve(cfg, { search: 'fast' });
  const brute = solve(cfg, { search: 'brute' });

  assert(
    fast.speeds.length === brute.speeds.length,
    'speed vectors differ in length'
  );

  let maxDecelDiff = 0;
  let maxFrontDiff = 0;
  let maxRearDiff = 0;

  for (let i = 0; i < fast.speeds.length; i++) {
    assert(
      fast.converged[i] === brute.converged[i],
      `convergence flag differs at ${fast.speeds[i]} mph`
    );
    if (!fast.converged[i]) continue;

    assert(
      fast.lockFront[i] === brute.lockFront[i],
      `lockup mode differs at ${fast.speeds[i]} mph`
    );

    maxDecelDiff = Math.max(maxDecelDiff, Math.abs(fast.deceleration[i] - brute.deceleration[i]));
    maxFrontDiff = Math.max(maxFrontDiff, Math.abs(fast.frontPedalForce[i] - brute.frontPedalForce[i]));
    maxRearDiff = Math.max(maxRearDiff, Math.abs(fast.rearPedalForce[i] - brute.rearPedalForce[i]));

    assertClose(fast.deceleration[i], brute.deceleration[i], 1e-6, `deceleration at ${fast.speeds[i]} mph`);
    assertClose(fast.frontNormForce[i], brute.frontNormForce[i], 1e-6, `front normal force at ${fast.speeds[i]} mph`);
    assertClose(fast.rearNormForce[i], brute.rearNormForce[i], 1e-6, `rear normal force at ${fast.speeds[i]} mph`);
    assertClose(fast.frontPedalForce[i], brute.frontPedalForce[i], 1e-6, `front pedal force at ${fast.speeds[i]} mph`);
    assertClose(fast.rearPedalForce[i], brute.rearPedalForce[i], 1e-6, `rear pedal force at ${fast.speeds[i]} mph`);
  }

  note(
    `${label}: max |diff| decel ${maxDecelDiff.toExponential(2)} g, ` +
      `front ${maxFrontDiff.toExponential(2)} lbf, rear ${maxRearDiff.toExponential(2)} lbf`
  );
}

test('agrees at every speed, default downforce equation', () => {
  compareSearches({ ...base, downforceMode: 'plotted' }, 'plotted');
});

test('agrees at every speed, Cl/area equation (higher decel, longer search)', () => {
  compareSearches(
    { ...base, downforceMode: 'clArea', Cl: 2.03, wingArea: 2.71785, airDensity: 1.184, maxBrakingGuess: 4.0 },
    'clArea'
  );
});

test('agrees at every speed, variableCP off', () => {
  compareSearches({ ...base, downforceMode: 'plotted', variableCP: false }, 'fixed cp');
});

suite('Bisection preconditions');

test('the accepted grid point is the FIRST one inside the tolerance window', () => {
  const cfg = { ...base, downforceMode: 'plotted' };
  const r = solve(cfg, { search: 'fast' });

  const step = GS2FTS2 / DECEL_GRID_DIVISIONS;
  const acceptedFtS2 = r.deceleration[0] * GS2FTS2;

  const weight = cfg.carWeight + cfg.driverWeight;
  const totalMass = weight / GS2FTS2;
  const weightFront = weight * (1 - cfg.rearBias);
  const weightRear = weight * cfg.rearBias;
  const tireMu = (Fz) => (cfg.tireA - cfg.tireB * Fz) * cfg.tireScale1 * cfg.tireScale2;
  const ebb = r.effectiveBrakeBias;

  const residual = (g) => {
    const dwt = (totalMass * g * cfg.centerGravityZ) / cfg.wheelBase;
    const fN = weightFront + dwt;
    const rN = weightRear - dwt;
    let fG = tireMu(fN / 2) * (fN / 2);
    let rG = tireMu(rN / 2) * (rN / 2);
    const first = rG / (fG + rG) >= ebb ? 1 : 0;
    const fG2 = fG * first + rG * (1 - first) * (1 / ebb - 1);
    const rG2 = rG * (1 - first) + fG2 * first * (1 / (1 - ebb) - 1);
    return (2 * fG2 + 2 * rG2) / totalMass - g;
  };

  const atAccepted = residual(acceptedFtS2);
  const atPrevious = residual(acceptedFtS2 - step);

  note(`residual at accepted point = ${atAccepted.toExponential(3)}`);
  note(`residual one step earlier   = ${atPrevious.toExponential(3)}`);

  assert(Math.abs(atAccepted) <= 0.005, 'accepted point must be inside the window');
  assert(atPrevious > 0.005, 'the previous grid point must still be outside the window');
});

test('residual is strictly decreasing across the search bracket', () => {
  const cfg = { ...base, downforceMode: 'plotted' };
  const weight = cfg.carWeight + cfg.driverWeight;
  const totalMass = weight / GS2FTS2;
  const weightFront = weight * (1 - cfg.rearBias);
  const weightRear = weight * cfg.rearBias;
  const tireMu = (Fz) => (cfg.tireA - cfg.tireB * Fz) * cfg.tireScale1 * cfg.tireScale2;
  const { effectiveBrakeBias: ebb } = solve(cfg, { search: 'fast' });

  const residual = (g) => {
    const dwt = (totalMass * g * cfg.centerGravityZ) / cfg.wheelBase;
    const fN = weightFront + dwt;
    const rN = weightRear - dwt;
    const fG = tireMu(fN / 2) * (fN / 2);
    const rG = tireMu(rN / 2) * (rN / 2);
    const first = rG / (fG + rG) >= ebb ? 1 : 0;
    const fG2 = fG * first + rG * (1 - first) * (1 / ebb - 1);
    const rG2 = rG * (1 - first) + fG2 * first * (1 / (1 - ebb) - 1);
    return (2 * fG2 + 2 * rG2) / totalMass - g;
  };

  const lo = GS2FTS2;
  const hi = lo + (cfg.maxBrakingGuess - 1) * GS2FTS2;
  let prev = residual(lo);
  for (let i = 1; i <= 2000; i++) {
    const g = lo + ((hi - lo) * i) / 2000;
    const cur = residual(g);
    assert(cur < prev, `residual increased at g = ${(g / GS2FTS2).toFixed(4)} g`);
    prev = cur;
  }
});
