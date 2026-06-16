import { initialConfigs } from './config.js';
import { CONFIG_COLORS } from './components.js';

export const MAX_CONFIGS = 4;

export const state = {
  configs: initialConfigs(CONFIG_COLORS),
  activeIndex: 0,
  view: {
    specBox: false,
    manualAxis: false,
    axisMin: 40,
    axisMax: 140,
    extraPlots: [],
  },
  lastOptimization: null,
};

export const activeConfig = () => state.configs[state.activeIndex];
export const activeValues = () => activeConfig().values;

export const refs = {
  fields: new Map(),
  selects: new Map(),
  reveals: new Map(),
  custom: new Map(),
  specBlocks: new Map(),
  warnings: new Map(),
  derived: new Map(),
  eventRows: [],
};

let recomputeFn = () => {};
let queued = false;

export function setRecompute(fn) {
  recomputeFn = fn;
}

export function recomputeNow() {
  queued = false;
  recomputeFn();
}

export function requestRecompute() {
  if (queued) return;
  queued = true;
  const run = () => {
    if (!queued) return;
    queued = false;
    recomputeFn();
  };
  requestAnimationFrame(run);
  setTimeout(run, 100);
}
