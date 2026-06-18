import { h, $ } from './dom.js';
import { state, activeValues, requestRecompute } from './state.js';
import { solve } from './solver.js';
import { primaryEventSpeed } from './config.js';
import { sweepParameter } from './optimize.js';
import {
  Chart, specBoxFor, pedalForceSpec, decelerationSpec, torqueSpec, linePressureSpec, sweepSpec,
} from './plots.js';

const charts = new Map();

const FIXED_PLOTS = ['pedal', 'decel'];

export const PLOT_TITLES = {
  pedal: 'Pedal force to lock up',
  decel: 'Deceleration vs speed',
  torque: 'Brake torque vs speed',
  pressure: 'Line pressure at lockup vs speed',
  biasSweep: 'Bias sweep at the primary event speed',
  driverSweep: 'Driver weight sensitivity',
};

function plotCard(id, title) {
  const canvas = h('canvas', {
    id: `canvas-${id}`,
    role: 'img',
    'aria-label': `${title}. The same values are listed in the results table below.`,
  });

  const png = h('button', { type: 'button', class: 'btn', 'aria-label': `Download ${title} as PNG` }, 'PNG');
  png.addEventListener('click', () => {
    const chart = charts.get(id);
    if (chart) chart.toPNG(`b27-${id}.png`);
  });

  const actions = h('div', { class: 'plot-actions' }, png);

  if (!FIXED_PLOTS.includes(id)) {
    const close = h('button', {
      type: 'button', class: 'btn-icon danger', title: 'Remove plot', 'aria-label': `Remove ${title}`,
    }, '✕');
    close.addEventListener('click', () => {
      state.view.extraPlots = state.view.extraPlots.filter((p) => p !== id);
      requestRecompute();
    });
    actions.append(close);
  }

  const card = h('div', { class: 'plot-card', id: `plot-${id}` },
    h('div', { class: 'plot-head' }, h('span', { class: 'plot-title' }, title), actions),
    h('div', { class: 'plot-canvas-wrap' }, canvas));

  return { card, canvas };
}

function ensureChart(id, container) {
  let chart = charts.get(id);
  if (!chart) {
    const { card, canvas } = plotCard(id, PLOT_TITLES[id]);
    container.append(card);
    chart = new Chart(canvas);
    charts.set(id, chart);
  } else {
    container.append(chart.canvas.closest('.plot-card'));
  }
  chart.showSpecBox = state.view.specBox;
  return chart;
}

function biasSweepSpec(v) {
  const ev = primaryEventSpeed(v);
  const sweep = sweepParameter(v, 'biasBarFrontBias', ev, 81);
  const inBand = sweep.filter((p) => p.converged && p.inBand);
  const best = inBand.length ? inBand.reduce((a, b) => (b.gap < a.gap ? b : a)) : null;

  return sweepSpec(sweep, v, {
    title: `Bias sweep at ${ev} mph`,
    xLabel: 'Bias bar front bias',
    xTipLabel: 'bias',
    xTipDecimals: 3,
    currentX: v.biasBarFrontBias,
    currentLabel: v.biasBarFrontBias.toFixed(3),
    optimumX: best ? best.x : null,
  });
}

function driverSweepSpec(v) {
  const ev = primaryEventSpeed(v);
  const idx = Math.round(ev);
  const sweep = [];

  for (let w = 100; w <= 250; w += 2.5) {
    const r = solve({ ...v, driverWeight: w, topSpeed: Math.max(1, Math.ceil(ev)) });
    if (!r.converged[idx]) {
      sweep.push({ x: w, converged: false });
      continue;
    }
    sweep.push({
      x: w,
      converged: true,
      front: r.frontPedalForce[idx],
      rear: r.rearPedalForce[idx],
      gap: Math.abs(r.frontPedalForce[idx] - r.rearPedalForce[idx]),
      inBand: false,
    });
  }

  return sweepSpec(sweep, v, {
    title: `Driver weight sensitivity at ${ev} mph`,
    xLabel: 'Driver weight (lb)',
    xTipLabel: 'weight',
    xTipDecimals: 0,
    currentX: v.driverWeight,
    currentLabel: `${v.driverWeight} lb`,
    optimumX: null,
  });
}

export function renderPlots(solved) {
  const container = $('plots');
  const v = activeValues();
  const yOverride = state.view.manualAxis
    ? { min: state.view.axisMin, max: state.view.axisMax }
    : null;
  const specBox = state.view.specBox
    ? specBoxFor(v, solved.length ? solved[0].result : null)
    : null;

  for (const chart of charts.values()) {
    const card = chart.canvas.closest('.plot-card');
    if (card && card.parentNode) card.parentNode.removeChild(card);
  }

  const wanted = [...FIXED_PLOTS, ...state.view.extraPlots];
  for (const [id, chart] of [...charts.entries()]) {
    if (!wanted.includes(id)) {
      chart.destroy();
      charts.delete(id);
    }
  }

  if (!solved.length) {
    container.replaceChildren(
      h('p', { class: 'hint' }, 'No configurations are enabled. Tick one in the panel to plot it.'));
    return;
  }

  ensureChart('pedal', container).setSpec(pedalForceSpec(solved, v, { specBox, yOverride }));
  ensureChart('decel', container).setSpec(decelerationSpec(solved, v, { specBox }));

  for (const id of state.view.extraPlots) {
    const chart = ensureChart(id, container);
    if (id === 'torque') chart.setSpec(torqueSpec(solved, v, { specBox }));
    else if (id === 'pressure') chart.setSpec(linePressureSpec(solved, v, { specBox }));
    else if (id === 'biasSweep') chart.setSpec(biasSweepSpec(v));
    else if (id === 'driverSweep') chart.setSpec(driverSweepSpec(v));
  }
}

export function setSpecBoxVisible(on) {
  for (const chart of charts.values()) chart.showSpecBox = on;
}

export function redrawCharts() {
  for (const chart of charts.values()) chart.draw();
}
