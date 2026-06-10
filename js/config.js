import {
  FRONT_CALIPERS,
  REAR_CALIPERS,
  MASTER_CYLINDERS,
  FRONT_ROTORS,
  REAR_ROTORS,
  EVENT_SPEEDS,
  AERO_PRESETS,
  padById,
  padCaliperWarning,
} from './components.js';

export const SECTIONS = [
  { id: 'front-caliper', label: 'Front caliper' },
  { id: 'rear-caliper', label: 'Rear caliper' },
  { id: 'front-hydraulics', label: 'Front hydraulics and rotor' },
  { id: 'rear-hydraulics', label: 'Rear hydraulics and rotor' },
  { id: 'pedal-box', label: 'Pedal box and bias' },
  { id: 'vehicle', label: 'Vehicle and driver' },
  { id: 'aero', label: 'Aerodynamics' },
  { id: 'tire', label: 'Tire model' },
  { id: 'goal', label: 'Goal band' },
];

export const FIELDS = [
  // Pedal box and bias
  { key: 'pedalRatio', label: 'Pedal ratio', section: 'pedal-box', min: 3.0, max: 7.0, step: 0.05, decimals: 2 },
  { key: 'biasBarFrontBias', label: 'Bias bar front bias', section: 'pedal-box', min: 0.30, max: 0.70, step: 0.005, decimals: 3 },

  // Vehicle and driver
  { key: 'carWeight', label: 'Car weight', section: 'vehicle', min: 250, max: 500, step: 1, unitFamily: 'weight_lb', decimals: 1 },
  { key: 'driverWeight', label: 'Driver weight', section: 'vehicle', min: 100, max: 250, step: 1, unitFamily: 'weight_lb', decimals: 1 },
  { key: 'rearBias', label: 'Rear weight bias', section: 'vehicle', min: 0.45, max: 0.65, step: 0.005, decimals: 3 },
  { key: 'wheelBase', label: 'Wheelbase', section: 'vehicle', min: 50, max: 75, step: 0.25, unitFamily: 'length_in', decimals: 2 },
  { key: 'centerGravityZ', label: 'CG height', section: 'vehicle', min: 8, max: 16, step: 0.05, unitFamily: 'length_in', decimals: 2 },
  { key: 'tireRad', label: 'Tire radius', section: 'vehicle', min: 6, max: 12, step: 0.05, unitFamily: 'length_in', decimals: 2 },
  { key: 'topSpeed', label: 'Top speed', section: 'vehicle', min: 30, max: 100, step: 1, unitFamily: 'speed_mph', decimals: 0, integer: true },

  // Front hydraulics and rotor
  { key: 'frontRotorOD', label: 'Front rotor OD', section: 'front-hydraulics', min: 5.5, max: 9.5, step: 0.05, unitFamily: 'length_in', decimals: 2 },
  { key: 'frontRotorID', label: 'Front rotor ID', section: 'front-hydraulics', min: 4.0, max: 8.0, step: 0.05, unitFamily: 'length_in', decimals: 2 },
  { key: 'numFrontBrakes', label: 'Number of front brakes', section: 'front-hydraulics', min: 1, max: 2, step: 1, decimals: 0, integer: true },

  // Rear hydraulics and rotor
  { key: 'rearRotorOD', label: 'Rear rotor OD', section: 'rear-hydraulics', min: 5.5, max: 9.5, step: 0.05, unitFamily: 'length_in', decimals: 2 },
  { key: 'rearRotorID', label: 'Rear rotor ID', section: 'rear-hydraulics', min: 4.0, max: 8.0, step: 0.05, unitFamily: 'length_in', decimals: 2 },
  { key: 'numRearBrakes', label: 'Number of rear brakes', section: 'rear-hydraulics', min: 1, max: 2, step: 1, decimals: 0, integer: true },

  // Goal band
  { key: 'goalLowerLimit', label: 'Goal lower limit', section: 'goal', min: 40, max: 200, step: 1, unitFamily: 'force_lbf', decimals: 1 },
  { key: 'goalUpperLimit', label: 'Goal upper limit', section: 'goal', min: 40, max: 200, step: 1, unitFamily: 'force_lbf', decimals: 1 },
  { key: 'maxPedalForce', label: 'Max pedal force checked', section: 'goal', min: 80, max: 250, step: 1, unitFamily: 'force_lbf', decimals: 1 },

  // Solver / cp
  { key: 'maxBrakingGuess', label: 'Max braking guess (g)', section: 'vehicle', min: 1.5, max: 5.0, step: 0.05, decimals: 2 },
  { key: 'maxDecelGs', label: 'Max decel for cp (g)', section: 'aero', min: 1.5, max: 3.5, step: 0.05, decimals: 2 },
  { key: 'cpStatic', label: 'cp static', section: 'aero', min: 0.3, max: 0.8, step: 0.002, decimals: 4 },
  { key: 'cpAtMaxDecel', label: 'cp at max decel', section: 'aero', min: 0.3, max: 0.8, step: 0.002, decimals: 4 },

  // Aero
  { key: 'Cl', label: 'Cl', section: 'aero', min: 0, max: 4, step: 0.01, decimals: 3, aeroOnly: true },
  { key: 'wingArea', label: 'Reference area (m²)', section: 'aero', min: 0.5, max: 4, step: 0.001, decimals: 5, aeroOnly: true },
  { key: 'airDensity', label: 'Air density (kg/m³)', section: 'aero', min: 1.0, max: 1.3, step: 0.001, decimals: 3, aeroOnly: true },

  // Tire model
  { key: 'tireA', label: 'Tire coeff a', section: 'tire', min: 1.0, max: 2.5, step: 0.001, decimals: 4 },
  { key: 'tireB', label: 'Tire coeff b', section: 'tire', min: 0, max: 0.0005, step: 0.000001, decimals: 8 },
  { key: 'tireScale1', label: 'Tire scale 1', section: 'tire', min: 0.5, max: 1.2, step: 0.005, decimals: 3 },
  { key: 'tireScale2', label: 'Tire scale 2', section: 'tire', min: 0.5, max: 1.2, step: 0.005, decimals: 3 },
];

export const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

// Defaults. Every number traceable to a line in brakescript_w_aero_B27.m

export function defaultConfig() {
  return {
    // Desired brake system goals (MATLAB 19-30)
    maxPedalForce: 140,
    goalUpperLimit: 120,
    goalLowerLimit: 100,
    variableCP: true,

    // Pedal box (MATLAB 32-42)
    pedalRatio: 4.4,
    frontMC: 0.625, // in
    rearMC: 0.8125, // in
    biasBarFrontBias: 0.425,

    // Wheel shell (MATLAB 44-69)
    frontCaliper: 25, // mm
    frontCaliperNum: 4,
    rearCaliper: 31.75, // mm
    rearCaliperNum: 2,
    frontRotorOD: 7.2,
    frontRotorID: 5.3,
    rearRotorOD: 6.85,
    rearRotorID: 5.3,
    numFrontBrakes: 2,
    numRearBrakes: 2,
    frontRotorMu: 0.7, // EBC GPFAX
    rearRotorMu: 0.55, // BP-45

    // Vehicle (MATLAB 71-86)
    tireRad: 8,
    topSpeed: 70,
    wheelBase: 62,
    centerGravityZ: 11.06,
    rearBias: 0.57,
    carWeight: 365,
    driverWeight: 170,

    // Tire model (MATLAB 89)
    tireA: 1.8073,
    tireB: 0.00018293,
    tireScale1: 0.875,
    tireScale2: 0.95,

    // cp (MATLAB 91-102)
    maxDecelGs: 2.3,
    cpStatic: 0.604,
    cpAtMaxDecel: 0.4676,
    cpFixed: 0.56, // the `else` branch, MATLAB 100

    downforceMode: 'plotted',
    Cl: 2.03,
    wingArea: 2.71785,
    airDensity: 1.184,

    // Iteration (MATLAB 177-181)
    maxBrakingGuess: 2.7,

    // Component selections (drive the numbers above)
    frontCaliperId: 'isr-22-048',
    rearCaliperId: 'wilwood-gp200',
    frontCaliperType: 'opposed',
    rearCaliperType: 'opposed',
    frontMCId: 'tilton-78-625',
    rearMCId: 'tilton-78-812',
    frontPadId: 'ebc-gpfax',
    rearPadId: 'bp-45',
    frontRotorId: 'front-current',
    rearRotorId: 'rear-current',
    driverWeightId: 'dw-170',
    aeroPresetId: 'cl203-wing-1184',

    eventSpeeds: EVENT_SPEEDS.map((e) => ({ id: e.id, value: e.value, on: e.defaultOn })),

    // Display units (presentation only, never affects the solve)
    units: {
      length_in: 'in',
      length_mm: 'mm',
      weight_lb: 'lb',
      force_lbf: 'lbf',
      speed_mph: 'mph',
    },
  };
}

/** A full configuration entry as held by the comparison list. */
export function makeConfigEntry(name, color, overrides = {}) {
  return {
    name,
    color,
    enabled: true,
    values: { ...defaultConfig(), ...overrides },
  };
}

/** The initial state: one configuration holding the source file's values. */
export function initialConfigs(colors) {
  return [makeConfigEntry('Car as built', colors[0])];
}

// Derived helpers

/** Active event speeds, in list order. The first is the primary. */
export function activeEventSpeeds(values) {
  return values.eventSpeeds.filter((e) => e.on);
}

export function primaryEventSpeed(values) {
  const active = activeEventSpeeds(values);
  return active.length ? active[0].value : 42;
}

export function coerceField(key, raw, previous) {
  const spec = FIELD_BY_KEY[key];
  let v = typeof raw === 'number' ? raw : parseFloat(raw);
  if (!Number.isFinite(v)) return previous;

  if (key === 'Cl') v = Math.abs(v);

  if (spec && spec.integer) v = Math.round(v);

  // Hard guards against division by zero or a degenerate solve.
  const mustBePositive = [
    'pedalRatio', 'frontMC', 'rearMC', 'frontCaliper', 'rearCaliper',
    'frontRotorOD', 'frontRotorID', 'rearRotorOD', 'rearRotorID',
    'wheelBase', 'tireRad', 'carWeight', 'driverWeight', 'topSpeed',
    'frontRotorMu', 'rearRotorMu', 'numFrontBrakes', 'numRearBrakes',
    'wingArea', 'airDensity', 'maxDecelGs',
  ];
  if (mustBePositive.includes(key) && v <= 0) return previous;

  if (key === 'biasBarFrontBias' || key === 'rearBias') {
    if (v <= 0 || v >= 1) return previous;
  }
  if (key === 'maxBrakingGuess' && v <= 1) return previous;
  if (key === 'topSpeed') v = Math.max(1, Math.min(300, v));

  return v;
}

const IN_TO_MM = 25.4;

export function validate(values, result) {
  const issues = [];
  const frontCaliper = FRONT_CALIPERS.find((c) => c.id === values.frontCaliperId);
  const rearCaliper = REAR_CALIPERS.find((c) => c.id === values.rearCaliperId);
  const frontPad = padById(values.frontPadId);
  const rearPad = padById(values.rearPadId);

  // Rotor geometry sanity
  if (values.frontRotorID >= values.frontRotorOD) {
    issues.push({
      level: 'error',
      section: 'front-hydraulics',
      message: `Front rotor ID (${values.frontRotorID.toFixed(2)} in) is not smaller than its OD (${values.frontRotorOD.toFixed(2)} in). The effective radius is meaningless.`,
    });
  }
  if (values.rearRotorID >= values.rearRotorOD) {
    issues.push({
      level: 'error',
      section: 'rear-hydraulics',
      message: `Rear rotor ID (${values.rearRotorID.toFixed(2)} in) is not smaller than its OD (${values.rearRotorOD.toFixed(2)} in). The effective radius is meaningless.`,
    });
  }

  // Rotor OD against the caliper's published disc range
  const checkDiscRange = (caliper, od, section, label) => {
    if (!caliper || !caliper.discRange) return;
    const odMm = od * IN_TO_MM;
    const [lo, hi] = caliper.discRange;
    if (odMm < lo || odMm > hi) {
      issues.push({
        level: 'warn',
        section,
        message: `${label} rotor OD ${odMm.toFixed(1)} mm is outside the ${caliper.name} published disc range of ${lo} to ${hi} mm.`,
      });
    }
  };
  checkDiscRange(frontCaliper, values.frontRotorOD, 'front-hydraulics', 'Front');
  checkDiscRange(rearCaliper, values.rearRotorOD, 'rear-hydraulics', 'Rear');

  const checkSweptHeight = (caliper, od, id, section, label) => {
    if (!caliper || !caliper.sweptHeight) return;
    const annulusMm = ((od - id) / 2) * IN_TO_MM;
    if (caliper.sweptHeight > annulusMm) {
      issues.push({
        level: 'warn',
        section,
        message: `${caliper.name} pad swept height ${caliper.sweptHeight} mm exceeds the ${label.toLowerCase()} rotor annulus of ${annulusMm.toFixed(1)} mm. The pad overhangs by ${(caliper.sweptHeight - annulusMm).toFixed(1)} mm.`,
      });
    }
  };
  checkSweptHeight(frontCaliper, values.frontRotorOD, values.frontRotorID, 'front-hydraulics', 'Front');
  checkSweptHeight(rearCaliper, values.rearRotorOD, values.rearRotorID, 'rear-hydraulics', 'Rear');

  if (values.biasBarFrontBias < 0.45 || values.biasBarFrontBias > 0.63) {
    issues.push({
      level: 'warn',
      section: 'pedal-box',
      message: `Bias bar at ${values.biasBarFrontBias.toFixed(3)} is outside the 0.45 to 0.63 mechanical range of the bias bar. The source file ships at 0.425, which is also outside. The model runs, but the hardware cannot reach it.`,
    });
  }

  // Pad / caliper compatibility
  const fw = padCaliperWarning(frontPad, frontCaliper);
  if (fw) issues.push({ level: 'warn', section: 'front-caliper', message: `Front: ${fw}` });
  const rw = padCaliperWarning(rearPad, rearCaliper);
  if (rw) issues.push({ level: 'warn', section: 'rear-caliper', message: `Rear: ${rw}` });

  // Goal band ordering
  if (values.goalLowerLimit >= values.goalUpperLimit) {
    issues.push({
      level: 'error',
      section: 'goal',
      message: `Goal lower limit (${values.goalLowerLimit}) is not below the upper limit (${values.goalUpperLimit}). The band is empty.`,
    });
  }

  if (!result) return issues;

  // Convergence
  if (result.failedSpeeds.length) {
    const list = result.failedSpeeds;
    const shown = list.length > 12 ? `${list.slice(0, 12).join(', ')} ... (${list.length} total)` : list.join(', ');
    issues.push({
      level: 'error',
      section: null,
      message: `Deceleration did not converge at ${list.length} speed${list.length === 1 ? '' : 's'} (mph: ${shown}). These points are omitted from the plots rather than drawn as zero. Raising "Max braking guess" usually fixes it.`,
    });
  }

  // Rear normal force gone negative
  const negRear = [];
  for (let i = 0; i < result.speeds.length; i++) {
    if (result.converged[i] && result.rearNormForce[i] < 0) negRear.push(result.speeds[i]);
  }
  if (negRear.length) {
    issues.push({
      level: 'error',
      section: 'vehicle',
      message: `Rear normal force is negative at ${negRear.length} speed${negRear.length === 1 ? '' : 's'} (from ${negRear[0]} mph). Weight transfer has lifted the rear axle, so the model is outside its valid range.`,
    });
  }

  // Pedal force outside the goal band at an active event speed
  for (const ev of activeEventSpeeds(values)) {
    const idx = Math.round(ev.value);
    if (idx < 0 || idx >= result.speeds.length || !result.converged[idx]) continue;
    const f = result.frontPedalForce[idx];
    const r = result.rearPedalForce[idx];
    const check = (val, label) => {
      if (val < values.goalLowerLimit) {
        issues.push({
          level: 'warn',
          section: 'goal',
          message: `${label} pedal force at ${ev.value} mph is ${val.toFixed(1)} lbf, below the ${values.goalLowerLimit} lbf goal. The axle locks too easily.`,
        });
      } else if (val > values.goalUpperLimit) {
        issues.push({
          level: 'warn',
          section: 'goal',
          message: `${label} pedal force at ${ev.value} mph is ${val.toFixed(1)} lbf, above the ${values.goalUpperLimit} lbf goal. The driver has to push too hard.`,
        });
      }
    };
    check(f, 'Front');
    check(r, 'Rear');
  }

  return issues;
}

// Applying a catalogue selection onto the numeric values

export function applyFrontCaliper(values, id) {
  const c = FRONT_CALIPERS.find((x) => x.id === id);
  if (!c) return values;
  const next = { ...values, frontCaliperId: id };
  if (!c.custom) {
    next.frontCaliper = c.bore;
    next.frontCaliperNum = c.pistons;
    next.frontCaliperType = c.type;
  }
  return next;
}

export function applyRearCaliper(values, id) {
  const c = REAR_CALIPERS.find((x) => x.id === id);
  if (!c) return values;
  const next = { ...values, rearCaliperId: id };
  if (!c.custom) {
    next.rearCaliper = c.bore;
    next.rearCaliperNum = c.pistons;
    next.rearCaliperType = c.type;
  }
  return next;
}

export function applyMasterCylinder(values, side, id) {
  const m = MASTER_CYLINDERS.find((x) => x.id === id);
  if (!m) return values;
  const key = side === 'front' ? 'frontMC' : 'rearMC';
  const idKey = side === 'front' ? 'frontMCId' : 'rearMCId';
  const next = { ...values, [idKey]: id };
  if (!m.custom) next[key] = m.bore;
  return next;
}

export function applyPad(values, side, id) {
  const p = padById(id);
  if (!p) return values;
  const key = side === 'front' ? 'frontRotorMu' : 'rearRotorMu';
  const idKey = side === 'front' ? 'frontPadId' : 'rearPadId';
  const next = { ...values, [idKey]: id };
  if (!p.custom) next[key] = p.mu;
  return next;
}

export function applyRotor(values, side, id) {
  const list = side === 'front' ? FRONT_ROTORS : REAR_ROTORS;
  const r = list.find((x) => x.id === id);
  if (!r) return values;
  const idKey = side === 'front' ? 'frontRotorId' : 'rearRotorId';
  const next = { ...values, [idKey]: id };
  if (!r.custom) {
    next[side === 'front' ? 'frontRotorOD' : 'rearRotorOD'] = r.od;
    next[side === 'front' ? 'frontRotorID' : 'rearRotorID'] = r.id_;
  }
  return next;
}

export function applyAeroPreset(values, id) {
  const p = AERO_PRESETS.find((x) => x.id === id);
  if (!p) return values;
  const next = { ...values, aeroPresetId: id };
  if (!p.custom) {
    next.Cl = p.Cl;
    next.wingArea = p.wingArea;
    next.airDensity = p.airDensity;
  }
  return next;
}

export function applyDriverWeight(values, id, customValue) {
  const next = { ...values, driverWeightId: id };
  if (id === 'dw-custom') {
    if (customValue !== undefined) next.driverWeight = customValue;
  } else {
    const d = { 'dw-130': 130, 'dw-150': 150, 'dw-170': 170, 'dw-200': 200 }[id];
    if (d !== undefined) next.driverWeight = d;
  }
  return next;
}
