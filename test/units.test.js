import { suite, test, assertClose, assert } from './harness.js';
import { UNITS, toDisplay, toCanonical, fmt, MM_PER_IN, KG_PER_LB, N_PER_LBF, KPH_PER_MPH } from '../js/units.js';

suite('Unit conversion');

test('every unit round-trips to within floating-point noise', () => {
  for (const [family, spec] of Object.entries(UNITS)) {
    for (const opt of spec.options) {
      for (const v of [0, 0.625, 1, 7.2, 42, 365, 1151.4]) {
        const there = toDisplay(family, opt.id, v);
        const back = toCanonical(family, opt.id, there);
        assertClose(back, v, 1e-9, `${family}/${opt.id} round trip of ${v}`);
      }
    }
  }
});

test('the canonical unit is an identity map', () => {
  for (const [family, spec] of Object.entries(UNITS)) {
    const canon = spec.options.find((o) => o.id === spec.canonical);
    assert(canon, `${family} has no option matching its canonical unit`);
    for (const v of [0, 1, 42.5]) {
      assertClose(toDisplay(family, canon.id, v), v, 0, `${family} display identity`);
      assertClose(toCanonical(family, canon.id, v), v, 0, `${family} canonical identity`);
    }
  }
});

test('known conversion factors are correct', () => {
  assertClose(toDisplay('length_in', 'mm', 1), MM_PER_IN, 1e-12, '1 in in mm');
  assertClose(toDisplay('length_in', 'mm', 0.625), 15.875, 1e-9, '0.625 in MC bore in mm');
  assertClose(toDisplay('length_in', 'mm', 0.8125), 20.6375, 1e-9, '0.8125 in MC bore in mm');
  assertClose(toDisplay('weight_lb', 'kg', 1), KG_PER_LB, 1e-12, '1 lb in kg');
  assertClose(toDisplay('force_lbf', 'N', 1), N_PER_LBF, 1e-12, '1 lbf in N');
  assertClose(toDisplay('speed_mph', 'kph', 1), KPH_PER_MPH, 1e-12, '1 mph in kph');
  assertClose(toDisplay('speed_mph', 'kph', 42), 67.592448, 1e-6, '42 mph in kph');
});

test('caliper bores convert the other direction', () => {
  assertClose(toDisplay('length_mm', 'in', 25.4), 1, 1e-12, '25.4 mm in inches');
  assertClose(toDisplay('length_mm', 'in', 31.75), 1.25, 1e-12, 'GP200 bore in inches');
});

test('fmt handles the non-numeric cases without throwing', () => {
  assert(fmt(null) === '-', 'null');
  assert(fmt(undefined) === '-', 'undefined');
  assert(fmt(NaN) === '-', 'NaN');
  assert(fmt(Infinity) === '∞', 'Infinity');
  assert(fmt(51.54, 1) === '51.5', 'rounding');
});
