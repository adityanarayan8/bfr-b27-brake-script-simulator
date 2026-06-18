import { $, fillSelect, toast } from './dom.js';
import { state, activeValues, setRecompute, recomputeNow, MAX_CONFIGS } from './state.js';
import { buildPanel, renderConfigList, syncPanel, syncDerived } from './panel.js';
import { renderPlots, setSpecBoxVisible, redrawCharts } from './charts.js';
import { renderValidation, renderResultsTable, renderOptimizer } from './results.js';
import { solve } from './solver.js';
import { initialConfigs, makeConfigEntry, validate } from './config.js';
import { CONFIG_COLORS } from './components.js';
import { optimize, OPTIMIZABLE } from './optimize.js';
import { writeFragment, readFragment, toCSV, downloadText, copyToClipboard } from './share.js';

const solveEnabled = () => state.configs
  .filter((entry) => entry.enabled)
  .map((entry) => ({ entry, result: solve(entry.values) }));

function recompute() {
  const solved = solveEnabled();
  const activeResult = solve(activeValues());

  syncDerived(activeResult);
  renderValidation(validate(activeValues(), activeResult));
  renderPlots(solved);
  renderResultsTable(solved);
  writeFragment(state.configs, state.view);
}

function bindOptimizer() {
  fillSelect($('opt-param'), OPTIMIZABLE.map((o) => ({ id: o.key, name: o.label })));

  $('btn-optimize').addEventListener('click', () => {
    const key = $('opt-param').value;
    const btn = $('btn-optimize');
    btn.disabled = true;
    btn.textContent = 'Solving';

    setTimeout(() => {
      try {
        state.lastOptimization = optimize(activeValues(), key);
        renderOptimizer();
      } catch (err) {
        toast(`Optimization failed: ${err.message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Solve';
      }
    }, 0);
  });
}

function bindPlotControls() {
  const specBox = $('chk-specbox');
  const manualAxis = $('chk-manual-axis');
  const axisMin = $('axis-min');
  const axisMax = $('axis-max');

  specBox.checked = state.view.specBox;
  manualAxis.checked = state.view.manualAxis;
  axisMin.value = state.view.axisMin;
  axisMax.value = state.view.axisMax;
  $('manual-axis-fields').hidden = !state.view.manualAxis;

  specBox.addEventListener('change', (e) => {
    state.view.specBox = e.target.checked;
    setSpecBoxVisible(e.target.checked);
    recomputeNow();
  });

  manualAxis.addEventListener('change', (e) => {
    state.view.manualAxis = e.target.checked;
    $('manual-axis-fields').hidden = !e.target.checked;
    recomputeNow();
  });

  for (const [input, key] of [[axisMin, 'axisMin'], [axisMax, 'axisMax']]) {
    input.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (Number.isFinite(value)) {
        state.view[key] = value;
        recomputeNow();
      }
    });
  }

  $('add-plot').addEventListener('change', (e) => {
    const id = e.target.value;
    if (id && !state.view.extraPlots.includes(id)) {
      state.view.extraPlots.push(id);
      recomputeNow();
    }
    e.target.value = '';
  });
}

function bindToolbar() {
  $('btn-add-config').addEventListener('click', () => {
    if (state.configs.length >= MAX_CONFIGS) {
      toast(`Maximum of ${MAX_CONFIGS} configurations.`);
      return;
    }
    const color = CONFIG_COLORS[state.configs.length % CONFIG_COLORS.length];
    state.configs.push(makeConfigEntry(`Config ${state.configs.length + 1}`, color));
    state.activeIndex = state.configs.length - 1;
    renderConfigList();
    syncPanel();
    recomputeNow();
  });

  $('btn-share').addEventListener('click', async () => {
    const url = writeFragment(state.configs, state.view);
    const copied = await copyToClipboard(url);
    toast(copied
      ? 'Shareable link copied to the clipboard.'
      : 'Could not copy. The link is in the address bar.');
  });

  $('btn-csv').addEventListener('click', () => {
    const solved = solveEnabled();
    if (!solved.length) {
      toast('Enable at least one configuration first.');
      return;
    }
    downloadText('b27-brake-results.csv', toCSV(solved));
    toast('CSV exported.');
  });

  $('btn-reset').addEventListener('click', () => {
    state.configs = initialConfigs(CONFIG_COLORS);
    state.activeIndex = 0;
    state.lastOptimization = null;
    renderConfigList();
    syncPanel();
    renderOptimizer();
    recomputeNow();
    toast('Reset to the values in brakescript_w_aero_B27.m');
  });
}

function init() {
  setRecompute(recompute);
  buildPanel();

  const restored = readFragment();
  if (restored) {
    state.configs = restored.configs;
    state.activeIndex = 0;
    state.view = { ...state.view, ...restored.view };
    toast('Loaded configuration from link.');
  }

  renderConfigList();
  syncPanel();
  bindOptimizer();
  bindPlotControls();
  bindToolbar();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(redrawCharts, 120);
  });

  recompute();
}

init();
