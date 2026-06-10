/**
 * components.js - Parts catalogue. DATA ONLY; no logic or DOM manipulation.
 *
 * ADDING A PART
 * Append an entry to the appropriate array below and open a pull request.
 * Part numbers are not hardcoded elsewhere in the codebase, so adding a new
 * caliper, master cylinder, pad, or rotor requires changes to this file only.
 * Keep `id` stable once merged, as shareable links encode it (see js/share.js).
 *
 * Every default value in this file comes from `brakescript_w_aero_B27.m`, which
 * corresponds to the "Car as built" configuration in the UI.
 */

// Calipers
export const FRONT_CALIPERS = [
  {
    id: 'isr-22-048',
    name: 'ISR 22-048',
    bore: 25,
    pistons: 4,
    type: 'opposed',
    padFamily: 'isr',
    discRange: [150, 250],
    sweptHeight: 27,
    spec: [
      ['Pistons', '4 x 25 mm, opposed'],
      ['Pad area', '14 cm²'],
      ['Swept height', '27 mm'],
      ['Disc diameter', '150 to 250 mm'],
      ['Disc thickness', '4.6 to 5.0 mm'],
      ['Mass with pads', '0.46 kg'],
    ],
  },
  {
    id: 'custom-front',
    name: 'Custom front caliper',
    custom: true,
    bore: 25,
    pistons: 4,
    type: 'opposed',
    padFamily: null,
    discRange: null,
    sweptHeight: null,
    spec: [],
  },
];

export const REAR_CALIPERS = [
  {
    id: 'wilwood-gp200',
    name: 'Wilwood GP200',
    bore: 31.75,
    pistons: 2,
    type: 'opposed',
    padFamily: 'wilwood',
    discRange: null,
    sweptHeight: null,
    spec: [
      ['Pistons', '2 x 1.25 in, opposed'],
      ['Piston area (one side)', '1.23 in²'],
      ['Pad area', '1.83 in²'],
      ['Rotor width', '0.25 in'],
      ['Mass', '0.90 lb'],
    ],
  },
  {
    id: 'isr-22-049',
    name: 'ISR 22-049',
    bore: 25,
    pistons: 2,
    type: 'opposed',
    padFamily: 'isr',
    discRange: [150, 250],
    sweptHeight: 27,
    spec: [
      ['Pistons', '2 x 25 mm, opposed'],
      ['Pad area', '7 cm²'],
      ['Swept height', '27 mm'],
      ['Disc diameter', '150 to 250 mm'],
      ['Mass', '0.29 kg'],
    ],
  },
  {
    id: 'custom-rear',
    name: 'Custom rear caliper',
    custom: true,
    bore: 31.75,
    pistons: 2,
    type: 'opposed',
    padFamily: null,
    discRange: null,
    sweptHeight: null,
    spec: [],
  },
];

export const PISTON_COUNTS = [2, 4, 6];
export const CALIPER_TYPES = [
  { id: 'opposed', name: 'Opposed' },
  { id: 'floating', name: 'Floating' },
];

// Master cylinders
export const MASTER_CYLINDERS = [
  { id: 'tilton-78-625', name: 'Tilton 78-625', bore: 0.625, boreMm: 15.875, stroke: 1.1 },
  { id: 'tilton-78-700', name: 'Tilton 78-700', bore: 0.7, boreMm: 17.78, stroke: 1.1 },
  { id: 'tilton-78-750', name: 'Tilton 78-750', bore: 0.75, boreMm: 19.05, stroke: 1.1 },
  { id: 'tilton-78-812', name: 'Tilton 78-812', bore: 0.8125, boreMm: 20.65, stroke: 1.1 },
  { id: 'tilton-78-875', name: 'Tilton 78-875', bore: 0.875, boreMm: 22.225, stroke: 1.1 },
  { id: 'tilton-78-937', name: 'Tilton 78-937', bore: 0.937, boreMm: 23.8, stroke: 1.1 },
  { id: 'tilton-78-1000', name: 'Tilton 78-1000', bore: 1.0, boreMm: 25.4, stroke: 1.1 },
  { id: 'custom-mc', name: 'Custom', custom: true, bore: 0.625, boreMm: 15.875, stroke: 1.1 },
];

export const MC_BORES = MASTER_CYLINDERS.filter((m) => !m.custom).map((m) => m.bore);

export function masterCylinderByBore(bore, tol = 1e-6) {
  return MASTER_CYLINDERS.find((m) => !m.custom && Math.abs(m.bore - bore) <= tol) || null;
}

// Brake pads
export const PADS = [
  { id: 'ebc-gpfax', name: 'EBC GPFAX (ISR only)', mu: 0.7, family: 'isr' },
  { id: 'bp-45', name: 'BP-45 (Wilwood compatible)', mu: 0.55, family: 'wilwood' },
  { id: 'bp-40', name: 'BP-40 (Wilwood compatible)', mu: 0.5, family: 'wilwood' },
  { id: 'bp-28', name: 'BP-28 (Wilwood compatible)', mu: 0.475, family: 'wilwood' },
  { id: 'custom-pad', name: 'Custom pad', mu: 0.7, family: null, custom: true },
];

export function padById(id) {
  return PADS.find((p) => p.id === id) || null;
}

export function padCaliperWarning(pad, caliper) {
  if (!pad || !caliper) return null;
  if (!pad.family || !caliper.padFamily) return null;
  if (pad.family === caliper.padFamily) return null;
  return `${pad.name} is not a listed fit for the ${caliper.name}. Running anyway. Check pad backing plate and swept height before ordering.`;
}

// Rotors
export const FRONT_ROTORS = [
  { id: 'front-current', name: 'Current front rotor', od: 7.2, id_: 5.3 },
  { id: 'front-custom', name: 'Custom', custom: true, od: 7.2, id_: 5.3 },
];

export const REAR_ROTORS = [
  { id: 'rear-current', name: 'Current rear rotor', od: 6.85, id_: 5.3 },
  { id: 'rear-custom', name: 'Custom', custom: true, od: 6.85, id_: 5.3 },
];

// Driver weight
export const DRIVER_WEIGHTS = [
  { id: 'dw-170', name: '170 lb (current)', value: 170 },
  { id: 'dw-130', name: '130 lb', value: 130 },
  { id: 'dw-150', name: '150 lb', value: 150 },
  { id: 'dw-200', name: '200 lb', value: 200 },
  { id: 'dw-custom', name: 'Custom', custom: true, value: 170 },
];

// Event speeds
export const EVENT_SPEEDS = [
  { id: 'ev-42', name: '42 mph (current)', value: 42, defaultOn: true },
  { id: 'ev-30', name: '30 mph', value: 30, defaultOn: false },
  { id: 'ev-50', name: '50 mph', value: 50, defaultOn: false },
  { id: 'ev-60', name: '60 mph', value: 60, defaultOn: false },
  { id: 'ev-custom', name: 'Custom', value: 45, defaultOn: false, custom: true },
];

// Aero presets
export const AERO_PRESETS = [
  {
    id: 'cl203-wing-1184',
    name: 'Cl 2.03 on wing area 2.71785 m², rho 1.184',
    Cl: 2.03,
    wingArea: 2.71785,
    airDensity: 1.184,
  },
  {
    id: 'cl203-wing-1225',
    name: 'Cl 2.03 on wing area 2.71785 m², rho 1.225',
    Cl: 2.03,
    wingArea: 2.71785,
    airDensity: 1.225,
  },
  {
    id: 'cl302-wing-1225',
    name: 'Cl 3.02 on wing area 2.71785 m², rho 1.225',
    Cl: 3.02,
    wingArea: 2.71785,
    airDensity: 1.225,
  },
  {
    id: 'cl203-frontal-1225',
    name: 'Cl 2.03 on frontal area 1.12007 m², rho 1.225',
    Cl: 2.03,
    wingArea: 1.12007,
    airDensity: 1.225,
  },
  {
    id: 'cl302-frontal-1225',
    name: 'Cl 3.02 on frontal area 1.12007 m², rho 1.225',
    Cl: 3.02,
    wingArea: 1.12007,
    airDensity: 1.225,
  },
  { id: 'aero-custom', name: 'Custom', custom: true, Cl: 2.03, wingArea: 2.71785, airDensity: 1.184 },
];

// Downforce equations
export const DOWNFORCE_EQUATIONS = [
  {
    id: 'plotted',
    name: 'Previous, as plotted',
    detail: '0.5 · 3 · 1.225 · v². Reproduces the reference plot the team validates against.',
    usesAeroInputs: false,
  },
  {
    id: 'plotted445',
    name: 'Previous, with the 1/4.45 term',
    detail: '0.5 · (1/4.45) · 3 · 1.225 · v². The commented-out equation in the source.',
    usesAeroInputs: false,
  },
  {
    id: 'clArea',
    name: 'Updated, Cl and area',
    detail: 'Cl · rho · v² · A · 0.5. The active equation in the source.',
    usesAeroInputs: true,
  },
];

// Configuration colours
export const CONFIG_COLORS = ['#003262', '#FDB515', '#C4820E', '#3B7EA1'];
