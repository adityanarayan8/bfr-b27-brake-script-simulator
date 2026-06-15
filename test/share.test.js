import { suite, test, note, assert } from './harness.js';

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = class {
    encode(str) {
      const out = [];
      for (let i = 0; i < str.length; i++) {
        let c = str.codePointAt(i);
        if (c > 0xffff) i++;
        if (c < 0x80) out.push(c);
        else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
        else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
      return new Uint8Array(out);
    }
  };
  globalThis.TextDecoder = class {
    decode(bytes) {
      let s = '';
      for (let i = 0; i < bytes.length; ) {
        const b = bytes[i];
        let c;
        if (b < 0x80) { c = b; i += 1; }
        else if (b < 0xe0) { c = ((b & 31) << 6) | (bytes[i + 1] & 63); i += 2; }
        else if (b < 0xf0) { c = ((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63); i += 3; }
        else {
          c = ((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63);
          i += 4;
        }
        s += String.fromCodePoint(c);
      }
      return s;
    }
  };
}

const { encodeState, decodeState, toCSV } = await import('../js/share.js');
const { makeConfigEntry, defaultConfig } = await import('../js/config.js');
const { CONFIG_COLORS } = await import('../js/components.js');
const { solve } = await import('../js/solver.js');

suite('Shareable links');

function roundTripDiffs(configs, view) {
  const back = decodeState(encodeState(configs, view));
  assert(back !== null, 'decode returned null');
  assert(back.configs.length === configs.length, 'config count changed');

  const diffs = [];
  configs.forEach((orig, i) => {
    const got = back.configs[i];
    if (orig.name !== got.name) diffs.push(`name[${i}]`);
    if (orig.enabled !== got.enabled) diffs.push(`enabled[${i}]`);
    if (orig.color !== got.color) diffs.push(`color[${i}]`);
    for (const k of Object.keys(orig.values)) {
      if (JSON.stringify(orig.values[k]) !== JSON.stringify(got.values[k])) diffs.push(`${k}[${i}]`);
    }
  });
  return { diffs, back };
}

test('a default single config round-trips with no loss', () => {
  const cfgs = [makeConfigEntry('Car as built', CONFIG_COLORS[0])];
  const { diffs } = roundTripDiffs(cfgs, {});
  assert(diffs.length === 0, `lost/changed: ${diffs.join(', ')}`);
  note(`default link is ${encodeState(cfgs, {}).length} chars`);
});

test('four heavily edited configs round-trip with no loss', () => {
  const cfgs = [
    makeConfigEntry('Car as built', CONFIG_COLORS[0]),
    makeConfigEntry('Bigger rear MC', CONFIG_COLORS[1], {
      rearMC: 0.875, rearMCId: 'tilton-78-875', biasBarFrontBias: 0.51,
    }),
    makeConfigEntry('Heavy driver', CONFIG_COLORS[2], {
      driverWeight: 200, driverWeightId: 'dw-200', downforceMode: 'clArea', variableCP: false,
    }),
    makeConfigEntry('ISR rear', CONFIG_COLORS[3], {
      rearCaliperId: 'isr-22-049', rearCaliper: 25, rearPadId: 'ebc-gpfax', rearRotorMu: 0.7,
      topSpeed: 85, tireA: 1.9, tireB: 0.0002,
    }),
  ];
  cfgs[1].enabled = false;
  const view = { specBox: true, manualAxis: true, axisMin: 20, axisMax: 260, extraPlots: ['torque', 'biasSweep'] };

  const { diffs, back } = roundTripDiffs(cfgs, view);
  assert(diffs.length === 0, `lost/changed: ${diffs.join(', ')}`);
  assert(JSON.stringify(back.view) === JSON.stringify(view), 'view state changed');
  note(`four-config link is ${encodeState(cfgs, view).length} chars`);
});

test('event speed selections survive the round trip', () => {
  const e = makeConfigEntry('Multi event', CONFIG_COLORS[0]);
  e.values.eventSpeeds = e.values.eventSpeeds.map((x) => ({ ...x, on: true }));
  e.values.eventSpeeds[4].value = 37.5;
  const { back } = roundTripDiffs([e], {});
  assert(back.configs[0].values.eventSpeeds.every((x) => x.on), 'event speed flags lost');
  assert(back.configs[0].values.eventSpeeds[4].value === 37.5, 'custom event speed lost');
});

test('unicode config names survive', () => {
  const e = makeConfigEntry('Aero, Cl 2.03 · 2.71785 m²', CONFIG_COLORS[0]);
  const { diffs } = roundTripDiffs([e], {});
  assert(diffs.length === 0, `lost/changed: ${diffs.join(', ')}`);
});

test('only deltas are stored, so an unedited link stays short', () => {
  const one = encodeState([makeConfigEntry('A', CONFIG_COLORS[0])], {});
  const edited = encodeState(
    [makeConfigEntry('A', CONFIG_COLORS[0], { pedalRatio: 5.5, topSpeed: 90 })], {}
  );
  assert(edited.length > one.length, 'an edited config should encode more than a default one');
  assert(one.length < 400, `default link unexpectedly long: ${one.length} chars`);
});

test('malformed and empty fragments fail closed rather than throwing', () => {
  for (const bad of ['', 'not!valid!base64', 'YWJj', b64ish(), null, undefined]) {
    const r = decodeState(bad);
    assert(r === null, `expected null for ${JSON.stringify(bad)}, got ${JSON.stringify(r)}`);
  }
  function b64ish() {
    return encodeState([], {});
  }
});

test('more than four configs are clamped to four', () => {
  const many = Array.from({ length: 7 }, (_, i) => makeConfigEntry(`C${i}`, CONFIG_COLORS[i % 4]));
  const back = decodeState(encodeState(many, {}));
  assert(back.configs.length === 4, `expected 4, got ${back.configs.length}`);
});

suite('CSV export');

test('one row per speed per config, with every documented column', () => {
  const base = defaultConfig();
  const solved = [
    { entry: { name: 'Car as built', values: base }, result: solve(base) },
    { entry: { name: 'Copy', values: base }, result: solve(base) },
  ];
  const csv = toCSV(solved);
  const lines = csv.trim().split('\n');
  const header = lines[0].split(',');

  for (const col of [
    'config', 'speed_mph', 'deceleration_g', 'front_pedal_force_lbf', 'rear_pedal_force_lbf',
    'front_normal_force_lbf', 'rear_normal_force_lbf', 'downforce', 'cp', 'weight_transfer_lbf',
    'front_torque_lbf_ft', 'rear_torque_lbf_ft', 'front_line_pressure_psi', 'rear_line_pressure_psi',
  ]) {
    assert(header.includes(col), `CSV is missing the "${col}" column`);
  }

  assert(lines.length === 1 + 2 * (base.topSpeed + 1),
    `expected ${1 + 2 * (base.topSpeed + 1)} lines, got ${lines.length}`);
  for (const l of lines) {
    assert(l.split(',').length === header.length, `ragged row: ${l.slice(0, 60)}`);
  }
  note(`${lines.length - 1} data rows across 2 configs`);
});

test('a config name containing a comma is quoted', () => {
  const base = defaultConfig();
  const solved = [{ entry: { name: 'Car, as built', values: base }, result: solve(base) }];
  const csv = toCSV(solved);
  assert(csv.includes('"Car, as built"'), 'comma in a config name was not quoted');
  const cols = csv.trim().split('\n')[1].split(',').length;
  const header = csv.trim().split('\n')[0].split(',').length;
  assert(cols === header + 1, 'quoting check needs the naive split to see the extra comma');
});

test('non-converged speeds export as blanks, not zeros', () => {
  const cfg = { ...defaultConfig(), maxBrakingGuess: 1.01 };
  const solved = [{ entry: { name: 'Fails', values: cfg }, result: solve(cfg) }];
  const rows = toCSV(solved).trim().split('\n').slice(1);
  const bad = rows.filter((r) => {
    const c = r.split(',');
    return c[2] === 'no' && (c[3] !== '' || c[5] !== '');
  });
  assert(bad.length === 0, `${bad.length} non-converged rows exported numbers instead of blanks`);
  note(`${rows.filter((r) => r.split(',')[2] === 'no').length} rows correctly blank`);
});
