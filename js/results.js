import { h, $, toast } from './dom.js';
import { state, activeValues, requestRecompute } from './state.js';
import { openSection } from './fields.js';
import { syncPanel } from './panel.js';
import { activeEventSpeeds } from './config.js';
import { OPTIMIZABLE, describeValue, applyCandidate } from './optimize.js';
import { Chart, objectiveSpec, sweepSpec } from './plots.js';
import { fmt } from './units.js';

const NO_VALUE = 'n/a';

export function renderValidation(issues) {
  const box = $('validation');

  if (!issues.length) {
    box.replaceChildren(h('div', { class: 'issue issue-ok' },
      h('span', { class: 'issue-tag' }, 'OK'),
      h('span', {}, 'No issues. Every speed converged and both axles sit inside the goal band at each active event speed.')));
    return;
  }

  const rank = { error: 0, warn: 1 };
  const sorted = [...issues].sort((a, b) => (rank[a.level] ?? 2) - (rank[b.level] ?? 2));

  box.replaceChildren(...sorted.map((issue) => {
    let jump = null;
    if (issue.section) {
      jump = h('button', { type: 'button', class: 'issue-jump' }, 'go to input');
      jump.addEventListener('click', () => openSection(issue.section));
    }
    return h('div', { class: `issue issue-${issue.level}` },
      h('span', { class: 'issue-tag' }, issue.level === 'error' ? 'Error' : 'Check'),
      h('span', {}, issue.message),
      jump);
  }));
}

export function renderResultsTable(solved) {
  const wrap = $('results-table');
  const rows = [];

  for (const { entry, result } of solved) {
    for (const ev of activeEventSpeeds(entry.values)) {
      const idx = Math.round(ev.value);
      const solvedHere = idx >= 0 && idx < result.speeds.length && result.converged[idx];
      const front = solvedHere ? result.frontPedalForce[idx] : null;
      const rear = solvedHere ? result.rearPedalForce[idx] : null;
      const { goalLowerLimit: lo, goalUpperLimit: hi } = entry.values;
      const inBand = solvedHere && front >= lo && front <= hi && rear >= lo && rear <= hi;
      const bandClass = solvedHere ? (inBand ? 'in-band' : 'out-band') : '';

      rows.push(h('tr', {},
        h('td', {},
          h('span', { class: 'cell-swatch', style: `background:${entry.color}`, 'aria-hidden': 'true' }),
          entry.name),
        h('td', {}, String(ev.value)),
        h('td', {}, solvedHere ? fmt(front, 1) : NO_VALUE),
        h('td', {}, solvedHere ? fmt(rear, 1) : NO_VALUE),
        h('td', { class: bandClass }, solvedHere ? fmt(Math.abs(front - rear), 1) : NO_VALUE),
        h('td', {}, solvedHere ? fmt(result.deceleration[idx], 3) : NO_VALUE),
        h('td', {}, solvedHere ? (result.lockFront[idx] ? 'front' : 'rear') : NO_VALUE),
        h('td', { class: bandClass },
          solvedHere ? (inBand ? 'in band' : 'outside') : 'no solve')));
    }
  }

  if (!rows.length) {
    wrap.replaceChildren(
      h('p', { class: 'hint' }, 'No enabled configuration has an active event speed.'));
    return;
  }

  const headings = ['Configuration', 'Speed (mph)', 'Front (lbf)', 'Rear (lbf)',
    'Gap (lbf)', 'Decel (g)', 'Locks first', 'Goal band'];

  wrap.replaceChildren(h('table', { class: 'data' },
    h('caption', { class: 'sr-only' }, 'Pedal force, deceleration and lockup axle at each active event speed'),
    h('thead', {}, h('tr', {}, ...headings.map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', {}, ...rows)));
}

const stat = (label, value) => h('div', { class: 'opt-stat' },
  h('span', { class: 'k' }, label), h('span', { class: 'v' }, value));

function appendSweepChart(container, title, filename, spec) {
  const canvas = h('canvas', {
    class: 'short', role: 'img',
    'aria-label': `${title}. Key values are stated in the summary above.`,
  });
  const png = h('button', { type: 'button', class: 'btn', 'aria-label': `Download ${title} as PNG` }, 'PNG');

  container.append(h('div', { class: 'plot-card sweep-card' },
    h('div', { class: 'plot-head' },
      h('span', { class: 'plot-title' }, title),
      h('div', { class: 'plot-actions' }, png)),
    h('div', { class: 'plot-canvas-wrap' }, canvas)));

  const chart = new Chart(canvas);
  chart.setSpec(spec);
  png.addEventListener('click', () => chart.toPNG(filename));
}

export function renderOptimizer() {
  const box = $('optimizer-result');
  const res = state.lastOptimization;

  if (!res) { box.replaceChildren(); return; }

  const decimals = (OPTIMIZABLE.find((o) => o.key === res.key) || {}).decimals ?? 4;
  const parts = [];

  if (res.status === 'ok') {
    const best = res.best;
    parts.push(
      h('div', { class: 'opt-verdict ok' },
        h('h3', {}, `${res.label} = ${describeValue(res.key, best.x, decimals)}`),
        h('p', {}, res.message)),
      h('div', { class: 'opt-numbers' },
        stat('Front', `${fmt(best.front, 1)} lbf`),
        stat('Rear', `${fmt(best.rear, 1)} lbf`),
        stat('Gap', `${fmt(best.gap, 2)} lbf`),
        stat('Deceleration', `${fmt(best.decel, 3)} g`),
        stat('Goal band', 'inside')));

    const apply = h('button', { type: 'button', class: 'btn btn-primary' }, 'Apply to this configuration');
    apply.addEventListener('click', () => {
      const i = state.activeIndex;
      state.configs[i].values = applyCandidate(state.configs[i].values, res.key, best.x);
      syncPanel();
      requestRecompute();
      toast(`Applied ${res.label} = ${describeValue(res.key, best.x, decimals)}`);
    });
    parts.push(h('div', { class: 'opt-actions' }, apply));
  } else if (res.status === 'none-in-band') {
    const closest = res.closest;
    parts.push(
      h('div', { class: 'opt-verdict fail' },
        h('h3', {}, 'No value lands inside the goal band'),
        h('p', {}, res.message)),
      h('div', { class: 'opt-numbers' },
        stat('Closest value', describeValue(res.key, closest.x, decimals)),
        stat('Front', `${fmt(closest.front, 1)} lbf`),
        stat('Rear', `${fmt(closest.rear, 1)} lbf`),
        stat('Misses band by', `${fmt(closest.violation, 1)} lbf`),
        stat('Deceleration', `${fmt(closest.decel, 3)} g`)));

    if (res.tightest) {
      const t = res.tightest;
      parts.push(h('div', { class: 'opt-fallback' },
        'Tightest balance available, for reference only: ',
        h('strong', {}, describeValue(res.key, t.x, decimals)),
        ` gives a gap of ${fmt(t.gap, 2)} lbf at ${fmt(t.front, 1)}/${fmt(t.rear, 1)} lbf, which is `,
        h('strong', {}, 'outside the goal band'),
        '. It is not a valid answer. Change a different parameter first.'));
    }
  } else {
    parts.push(h('div', { class: 'opt-verdict fail' },
      h('h3', {}, 'No solution'), h('p', {}, res.message)));
  }

  box.replaceChildren(h('div', { class: 'opt-result' }, ...parts));

  const optimumX = res.status === 'ok' ? res.best.x : (res.closest ? res.closest.x : null);
  const shared = {
    xLabel: res.label,
    xTipLabel: res.label,
    xTipDecimals: decimals,
    currentX: res.currentValue,
    optimumX,
  };

  appendSweepChart(box, `Objective across ${res.label}`, `b27-optimize-${res.key}.png`,
    objectiveSpec(res.sweep, activeValues(), {
      ...shared, title: `Front/rear gap at ${res.eventSpeed} mph`,
    }));

  appendSweepChart(box, 'Front and rear pedal force across the search range',
    `b27-optimize-forces-${res.key}.png`,
    sweepSpec(res.sweep, activeValues(), {
      ...shared, title: `Pedal force vs ${res.label} at ${res.eventSpeed} mph`,
    }));
}
