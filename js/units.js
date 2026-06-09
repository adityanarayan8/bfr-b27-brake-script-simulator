export const MM_PER_IN = 25.4;
export const KG_PER_LB = 0.45359237;
export const N_PER_LBF = 4.4482216152605;
export const KPH_PER_MPH = 1.609344;

export const UNITS = {
  length_in: {
    canonical: 'in',
    options: [
      { id: 'in', label: 'in', toCanonical: (v) => v, fromCanonical: (v) => v, decimals: 3 },
      {
        id: 'mm',
        label: 'mm',
        toCanonical: (v) => v / MM_PER_IN,
        fromCanonical: (v) => v * MM_PER_IN,
        decimals: 2,
      },
    ],
  },
  length_mm: {
    canonical: 'mm',
    options: [
      { id: 'mm', label: 'mm', toCanonical: (v) => v, fromCanonical: (v) => v, decimals: 2 },
      {
        id: 'in',
        label: 'in',
        toCanonical: (v) => v * MM_PER_IN,
        fromCanonical: (v) => v / MM_PER_IN,
        decimals: 4,
      },
    ],
  },
  weight_lb: {
    canonical: 'lb',
    options: [
      { id: 'lb', label: 'lb', toCanonical: (v) => v, fromCanonical: (v) => v, decimals: 1 },
      {
        id: 'kg',
        label: 'kg',
        toCanonical: (v) => v / KG_PER_LB,
        fromCanonical: (v) => v * KG_PER_LB,
        decimals: 2,
      },
    ],
  },
  force_lbf: {
    canonical: 'lbf',
    options: [
      { id: 'lbf', label: 'lbf', toCanonical: (v) => v, fromCanonical: (v) => v, decimals: 1 },
      {
        id: 'N',
        label: 'N',
        toCanonical: (v) => v / N_PER_LBF,
        fromCanonical: (v) => v * N_PER_LBF,
        decimals: 1,
      },
    ],
  },
  speed_mph: {
    canonical: 'mph',
    options: [
      { id: 'mph', label: 'mph', toCanonical: (v) => v, fromCanonical: (v) => v, decimals: 1 },
      {
        id: 'kph',
        label: 'kph',
        toCanonical: (v) => v / KPH_PER_MPH,
        fromCanonical: (v) => v * KPH_PER_MPH,
        decimals: 1,
      },
    ],
  },
};

export function unitOption(family, unitId) {
  const fam = UNITS[family];
  if (!fam) return null;
  return fam.options.find((o) => o.id === unitId) || fam.options[0];
}

export function toDisplay(family, unitId, canonicalValue) {
  const opt = unitOption(family, unitId);
  return opt ? opt.fromCanonical(canonicalValue) : canonicalValue;
}

export function toCanonical(family, unitId, displayValue) {
  const opt = unitOption(family, unitId);
  return opt ? opt.toCanonical(displayValue) : displayValue;
}

export function fmt(value, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  if (!Number.isFinite(value)) return '∞';
  return value.toFixed(decimals);
}
