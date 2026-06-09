export const GS2FTS2 = 32.174;

export const MPH2MPS = (5280 * 0.3048) / 3600;

export const DECEL_TOLERANCE = 0.005;

export const DECEL_GRID_DIVISIONS = 1000000;

export function computeAreas(c) {
  const frontMCArea = Math.pow(c.frontMC / 2, 2) * Math.PI;
  const rearMCArea = Math.pow(c.rearMC / 2, 2) * Math.PI;

  const frontCaliperArea =
    c.frontCaliperNum * Math.pow(c.frontCaliper / 25.4 / 2, 2) * Math.PI;
  const rearCaliperArea =
    c.rearCaliperNum * Math.pow(c.rearCaliper / 25.4 / 2, 2) * Math.PI;

  return { frontMCArea, rearMCArea, frontCaliperArea, rearCaliperArea };
}

export function effectiveRotorRadius(od, id) {
  return (od + id) / 4;
}

export function computeBias(c) {
  const { frontMCArea, rearMCArea, frontCaliperArea, rearCaliperArea } =
    computeAreas(c);

  const frontTotal =
    (c.pedalRatio / frontMCArea) *
    frontCaliperArea *
    effectiveRotorRadius(c.frontRotorOD, c.frontRotorID) *
    c.biasBarFrontBias;

  const rearTotal =
    (c.pedalRatio / rearMCArea) *
    rearCaliperArea *
    effectiveRotorRadius(c.rearRotorOD, c.rearRotorID) *
    (1 - c.biasBarFrontBias);

  const effectiveBrakeBias = rearTotal / (frontTotal + rearTotal);

  return { frontTotal, rearTotal, effectiveBrakeBias };
}

export function makeTireMu(c) {
  return (Fz) => (c.tireA - c.tireB * Fz) * c.tireScale1 * c.tireScale2;
}

export const DOWNFORCE_MODES = {
  PLOTTED: 'plotted',
  PLOTTED_445: 'plotted445',
  CL_AREA: 'clArea',
};

export function makeDownforce(c) {
  const mode = c.downforceMode;
  return (vMph) => {
    const v = vMph * MPH2MPS;
    switch (mode) {
      case DOWNFORCE_MODES.PLOTTED:
        return 0.5 * 3 * 1.225 * v * v;
      case DOWNFORCE_MODES.PLOTTED_445:
        return 0.5 * (1 / 4.45) * 3 * 1.225 * v * v;
      case DOWNFORCE_MODES.CL_AREA:
      default:
        return c.Cl * c.airDensity * v * v * c.wingArea * 0.5;
    }
  };
}

export function makeCp(c) {
  const travel = c.cpStatic - c.cpAtMaxDecel;
  return (decelGsAboveOneG) =>
    c.cpStatic - decelGsAboveOneG * (travel / c.maxDecelGs);
}

function evaluateDecel(decelerationGuess, k, downForceAtSpeed) {
  const dynamicWeightTransfer =
    (k.total_mass * decelerationGuess * k.centerGravityZ) / k.wheelBase;

  let frontNormalForce;
  let rearNormalForce;
  let cpVal;

  if (k.variableCP) {
    cpVal = k.cp(decelerationGuess / GS2FTS2 - 1);
    const weightFrontAero = k.weightFront + downForceAtSpeed * (1 - cpVal);
    const weightRearAero = k.weightRear + downForceAtSpeed * cpVal;
    frontNormalForce = weightFrontAero + dynamicWeightTransfer;
    rearNormalForce = weightRearAero - dynamicWeightTransfer;
  } else {
    cpVal = k.cpFixed;
    frontNormalForce =
      k.weightFront + downForceAtSpeed * (1 - k.cpFixed) + dynamicWeightTransfer;
    rearNormalForce =
      k.weightRear + downForceAtSpeed * k.cpFixed - dynamicWeightTransfer;
  }

  let frontTireGrip = k.tireMu(frontNormalForce / 2) * (frontNormalForce / 2);
  let rearTireGrip = k.tireMu(rearNormalForce / 2) * (rearNormalForce / 2);

  const gripRatio = rearTireGrip / (frontTireGrip + rearTireGrip);
  const newFirstLock = gripRatio >= k.effectiveBrakeBias ? 1 : 0;

  const frontTireGripLimited =
    frontTireGrip * newFirstLock +
    rearTireGrip * (1 - newFirstLock) * (1 / k.effectiveBrakeBias - 1);
  const rearTireGripLimited =
    rearTireGrip * (1 - newFirstLock) +
    frontTireGripLimited *
      newFirstLock *
      (1 / (1 - k.effectiveBrakeBias) - 1);

  frontTireGrip = frontTireGripLimited;
  rearTireGrip = rearTireGripLimited;

  const decelerationFromTire =
    (2 * frontTireGrip + 2 * rearTireGrip) / k.total_mass;

  return {
    decelerationFromTire,
    dynamicWeightTransfer,
    frontNormalForce,
    rearNormalForce,
    cpVal,
    newFirstLock,
    frontTireGrip,
    rearTireGrip,
  };
}

function makeKernel(c) {
  const { frontTotal, rearTotal, effectiveBrakeBias } = computeBias(c);
  const weight = c.carWeight + c.driverWeight;

  return {
    total_mass: weight / GS2FTS2,
    weight,
    weightFront: weight * (1 - c.rearBias),
    weightRear: weight * c.rearBias,
    centerGravityZ: c.centerGravityZ,
    wheelBase: c.wheelBase,
    variableCP: c.variableCP,
    cpFixed: c.cpFixed,
    cp: makeCp(c),
    tireMu: makeTireMu(c),
    effectiveBrakeBias,
    frontTotal,
    rearTotal,
  };
}

export function findDecelBruteForce(k, downForceAtSpeed, lastDecel, maxBrakingGuess) {
  const maxD = (maxBrakingGuess - 1) * DECEL_GRID_DIVISIONS;
  for (let D = 1; D <= maxD; D++) {
    const decelerationGuess =
      (D / DECEL_GRID_DIVISIONS) * GS2FTS2 + lastDecel;
    const r = evaluateDecel(decelerationGuess, k, downForceAtSpeed);
    if (Math.abs(decelerationGuess - r.decelerationFromTire) <= DECEL_TOLERANCE) {
      return { converged: true, decelerationGuess, ...r };
    }
  }
  return { converged: false };
}

export function findDecelFast(k, downForceAtSpeed, lastDecel, maxBrakingGuess) {
  const maxD = Math.floor((maxBrakingGuess - 1) * DECEL_GRID_DIVISIONS);
  if (maxD < 1) return { converged: false };

  const gridAt = (D) => (D / DECEL_GRID_DIVISIONS) * GS2FTS2 + lastDecel;
  const residualAt = (D) => {
    const g = gridAt(D);
    const r = evaluateDecel(g, k, downForceAtSpeed);
    return { residual: r.decelerationFromTire - g, g, r };
  };

  const last = residualAt(maxD);
  if (last.residual > DECEL_TOLERANCE) return { converged: false };

  let lo = 1;
  let hi = maxD;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (residualAt(mid).residual <= DECEL_TOLERANCE) hi = mid;
    else lo = mid + 1;
  }

  const hit = residualAt(lo);
  if (Math.abs(hit.residual) > DECEL_TOLERANCE) return { converged: false };

  return { converged: true, decelerationGuess: hit.g, ...hit.r };
}

export function solve(c, opts = {}) {
  const search = opts.search === 'brute' ? findDecelBruteForce : findDecelFast;
  const k = makeKernel(c);
  const downforceFn = makeDownforce(c);
  const tireMu = k.tireMu;

  const n = c.topSpeed + 1;
  const speeds = new Array(n);
  const deceleration = new Array(n).fill(0);
  const lockFront = new Array(n).fill(0);
  const converged = new Array(n).fill(false);
  const frontNormForce = new Array(n).fill(0);
  const rearNormForce = new Array(n).fill(0);
  const dynWeight = new Array(n).fill(0);
  const downforce = new Array(n).fill(0);
  const cpValues = new Array(n).fill(0);

  let lastDecel = GS2FTS2;

  for (let i = 0; i < n; i++) {
    const v = i;
    speeds[i] = v;
    const df = downforceFn(v);
    downforce[i] = df;

    const res = search(k, df, lastDecel, c.maxBrakingGuess);

    if (res.converged) {
      lastDecel = res.decelerationGuess;
      frontNormForce[i] = res.frontNormalForce;
      rearNormForce[i] = res.rearNormalForce;
      deceleration[i] = res.decelerationGuess / GS2FTS2;
      lockFront[i] = res.newFirstLock;
      dynWeight[i] = res.dynamicWeightTransfer;
      cpValues[i] = res.cpVal;
      converged[i] = true;
    }
  }

  const frontPedalForce = new Array(n).fill(0);
  const rearPedalForce = new Array(n).fill(0);
  const frontTorque = new Array(n).fill(0);
  const rearTorque = new Array(n).fill(0);
  const frontLinePressure = new Array(n).fill(0);
  const rearLinePressure = new Array(n).fill(0);

  const { frontMCArea, rearMCArea } = computeAreas(c);

  for (let i = 0; i < n; i++) {
    if (!converged[i]) continue;
    const fN = frontNormForce[i];
    const rN = rearNormForce[i];

    frontPedalForce[i] =
      (fN * tireMu(fN / 2) * c.tireRad) /
      (c.numFrontBrakes * k.frontTotal * c.frontRotorMu);
    rearPedalForce[i] =
      (rN * tireMu(rN / 2) * c.tireRad) /
      (c.numRearBrakes * k.rearTotal * c.rearRotorMu);

    frontTorque[i] = tireMu(fN / 2) * (fN / 2) * (c.tireRad / 12);
    rearTorque[i] = tireMu(rN / 2) * (rN / 2) * (c.tireRad / 12);

    frontLinePressure[i] =
      (frontPedalForce[i] * c.pedalRatio * c.biasBarFrontBias) / frontMCArea;
    rearLinePressure[i] =
      (rearPedalForce[i] * c.pedalRatio * (1 - c.biasBarFrontBias)) / rearMCArea;
  }

  return {
    speeds,
    deceleration,
    lockFront,
    converged,
    frontNormForce,
    rearNormForce,
    dynWeight,
    downforce,
    cpValues,
    frontPedalForce,
    rearPedalForce,
    frontTorque,
    rearTorque,
    frontLinePressure,
    rearLinePressure,
    effectiveBrakeBias: k.effectiveBrakeBias,
    frontTotal: k.frontTotal,
    rearTotal: k.rearTotal,
    weight: k.weight,
    weightFront: k.weightFront,
    weightRear: k.weightRear,
    frontRotorRadius: effectiveRotorRadius(c.frontRotorOD, c.frontRotorID),
    rearRotorRadius: effectiveRotorRadius(c.rearRotorOD, c.rearRotorID),
    failedSpeeds: speeds.filter((_, i) => !converged[i]),
  };
}

export function sampleAt(result, series, speedMph) {
  const s = result.speeds;
  if (speedMph <= s[0]) return result.converged[0] ? series[0] : null;
  const lastIdx = s.length - 1;
  if (speedMph >= s[lastIdx])
    return result.converged[lastIdx] ? series[lastIdx] : null;

  const i = Math.floor(speedMph);
  const j = Math.min(i + 1, lastIdx);
  if (!result.converged[i] || !result.converged[j]) return null;
  const t = speedMph - i;
  return series[i] * (1 - t) + series[j] * t;
}
