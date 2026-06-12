const BERKELEY_BLUE = '#003262';
const CALIFORNIA_GOLD = '#FDB515';
const INK = '#1a1a1a';
const RULE = '#c8ccd0';
const GRID = '#e6e9ec';
const PAPER = '#ffffff';
const MONO = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const MONO_SMALL = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SANS_BOLD = '600 13px ui-sans-serif, -apple-system, "Helvetica Neue", sans-serif';

function niceStep(range, targetTicks) {
  if (range <= 0 || !Number.isFinite(range)) return 1;
  const raw = range / Math.max(1, targetTicks);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let step;
  if (norm <= 1) step = 1;
  else if (norm <= 2) step = 2;
  else if (norm <= 2.5) step = 2.5;
  else if (norm <= 5) step = 5;
  else step = 10;
  return step * mag;
}

function ticksFor(min, max, targetTicks = 6) {
  const step = niceStep(max - min, targetTicks);
  const first = Math.ceil(min / step) * step;
  const out = [];
  for (let t = first; t <= max + step * 1e-9; t += step) {
    out.push(Math.abs(t) < step * 1e-9 ? 0 : Number(t.toFixed(10)));
  }
  return out;
}

function tickLabel(v, step) {
  const decimals = step >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(step)));
  return v.toFixed(decimals);
}

export class Chart {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.spec = null;
    this.layout = null;
    this.hover = null;
    this.showSpecBox = false;

    this._onMove = (e) => {
      if (!this.layout || !this.spec) return;
      const rect = this.canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const L = this.layout;
      if (px < L.left || px > L.right || py < L.top || py > L.bottom) {
        if (this.hover !== null) {
          this.hover = null;
          this.draw();
        }
        return;
      }
      this.hover = { px, py, x: L.xInv(px) };
      this.draw();
    };
    this._onLeave = () => {
      if (this.hover !== null) {
        this.hover = null;
        this.draw();
      }
    };
    canvas.addEventListener('mousemove', this._onMove);
    canvas.addEventListener('mouseleave', this._onLeave);
  }

  destroy() {
    this.canvas.removeEventListener('mousemove', this._onMove);
    this.canvas.removeEventListener('mouseleave', this._onLeave);
  }

  setSpec(spec) {
    this.spec = spec;
    this.draw();
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = this.canvas.clientWidth || 700;
    const cssH = this.canvas.clientHeight || 420;
    if (this.canvas.width !== Math.round(cssW * dpr) || this.canvas.height !== Math.round(cssH * dpr)) {
      this.canvas.width = Math.round(cssW * dpr);
      this.canvas.height = Math.round(cssH * dpr);
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: cssW, h: cssH };
  }

  _extent() {
    const s = this.spec;
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;

    for (const ser of s.series) {
      for (const [x, y] of ser.points) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (x < xMin) xMin = x;
        if (x > xMax) xMax = x;
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
    }
    for (const b of s.bands || []) {
      yMin = Math.min(yMin, b.y0);
      yMax = Math.max(yMax, b.y1);
    }
    for (const v of s.vlines || []) {
      if (Number.isFinite(v.x)) {
        xMin = Math.min(xMin, v.x);
        xMax = Math.max(xMax, v.x);
      }
    }

    if (!Number.isFinite(xMin)) { xMin = 0; xMax = 1; }
    if (!Number.isFinite(yMin)) { yMin = 0; yMax = 1; }
    if (xMax === xMin) { xMax = xMin + 1; }
    if (yMax === yMin) { yMax = yMin + 1; }

    const yPad = (yMax - yMin) * 0.08;
    yMin -= yPad;
    yMax += yPad;

    if (s.xOverride) { xMin = s.xOverride.min; xMax = s.xOverride.max; }
    if (s.yOverride) { yMin = s.yOverride.min; yMax = s.yOverride.max; }

    return { xMin, xMax, yMin, yMax };
  }

  _legendEntries() {
    const out = [];
    for (const s of this.spec.series) {
      if (s.hideFromLegend || !s.points.length) continue;
      out.push({ name: s.name, color: s.color, dash: s.dash, kind: s.type === 'scatter' ? 'scatter' : 'line' });
    }
    for (const b of this.spec.bands || []) {
      if (!b.label) continue;
      out.push({ name: b.label, color: b.color || 'rgba(253, 181, 21, 0.45)', kind: 'band' });
    }
    for (const v of this.spec.vlines || []) {
      if (!v.legendLabel) continue;
      out.push({ name: v.legendLabel, color: v.color || INK, dash: v.dash, kind: 'vline' });
    }
    return out;
  }

  draw() {
    if (!this.spec) return;
    const { w, h } = this._resize();
    const ctx = this.ctx;
    const s = this.spec;

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);

    const legend = this._legendEntries();
    const legendRows = Math.ceil(legend.length / 3);
    const legendH = legend.length ? legendRows * 16 + 8 : 0;

    const L = {
      left: 62,
      right: w - 16,
      top: s.title ? 34 : 14,
      bottom: h - 40 - legendH,
    };
    if (L.bottom <= L.top + 20) L.bottom = L.top + 20;

    const { xMin, xMax, yMin, yMax } = this._extent();
    L.xMin = xMin; L.xMax = xMax; L.yMin = yMin; L.yMax = yMax;
    L.x = (v) => L.left + ((v - xMin) / (xMax - xMin)) * (L.right - L.left);
    L.y = (v) => L.bottom - ((v - yMin) / (yMax - yMin)) * (L.bottom - L.top);
    L.xInv = (px) => xMin + ((px - L.left) / (L.right - L.left)) * (xMax - xMin);
    this.layout = L;

    if (s.title) {
      ctx.fillStyle = BERKELEY_BLUE;
      ctx.font = SANS_BOLD;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(s.title, L.left, 20);
    }

    for (const b of s.bands || []) {
      const y1 = L.y(Math.max(b.y0, b.y1));
      const y2 = L.y(Math.min(b.y0, b.y1));
      ctx.fillStyle = b.color || 'rgba(253, 181, 21, 0.16)';
      ctx.fillRect(L.left, y1, L.right - L.left, y2 - y1);
      ctx.strokeStyle = 'rgba(196, 130, 14, 0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(L.left, y1); ctx.lineTo(L.right, y1);
      ctx.moveTo(L.left, y2); ctx.lineTo(L.right, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const xStep = niceStep(xMax - xMin, 8);
    const yStep = niceStep(yMax - yMin, 6);
    const xTicks = ticksFor(xMin, xMax, 8);
    const yTicks = ticksFor(yMin, yMax, 6);

    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const t of xTicks) {
      const px = Math.round(L.x(t)) + 0.5;
      ctx.moveTo(px, L.top); ctx.lineTo(px, L.bottom);
    }
    for (const t of yTicks) {
      const py = Math.round(L.y(t)) + 0.5;
      ctx.moveTo(L.left, py); ctx.lineTo(L.right, py);
    }
    ctx.stroke();

    ctx.fillStyle = '#55606a';
    ctx.font = MONO_SMALL;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const t of xTicks) ctx.fillText(tickLabel(t, xStep), L.x(t), L.bottom + 6);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const t of yTicks) ctx.fillText(tickLabel(t, yStep), L.left - 8, L.y(t));

    for (const v of s.vlines || []) {
      const px = Math.round(L.x(v.x)) + 0.5;
      ctx.strokeStyle = v.color || INK;
      ctx.lineWidth = 1.25;
      ctx.setLineDash(v.dash ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(px, L.top); ctx.lineTo(px, L.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      if (v.label) {
        ctx.save();
        ctx.translate(px + 4, L.top + 4);
        ctx.fillStyle = v.color || INK;
        ctx.font = MONO_SMALL;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(v.label, 0, 0);
        ctx.restore();
      }
    }

    for (const ser of s.series) {
      if (!ser.points.length) continue;
      ctx.strokeStyle = ser.color;
      ctx.fillStyle = ser.color;
      ctx.lineWidth = ser.width || 2;

      if (ser.type === 'scatter') {
        const r = ser.radius || 3.4;
        for (const [x, y] of ser.points) {
          ctx.beginPath();
          ctx.arc(L.x(x), L.y(y), r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.setLineDash(ser.dash ? [7, 5] : []);
        ctx.beginPath();
        let started = false;
        for (const [x, y] of ser.points) {
          if (!Number.isFinite(x) || !Number.isFinite(y)) { started = false; continue; }
          const px = L.x(x), py = L.y(y);
          if (!started) { ctx.moveTo(px, py); started = true; }
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.strokeStyle = RULE;
    ctx.lineWidth = 1;
    ctx.strokeRect(L.left + 0.5, L.top + 0.5, L.right - L.left - 1, L.bottom - L.top - 1);

    ctx.fillStyle = INK;
    ctx.font = MONO;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (s.xLabel) ctx.fillText(s.xLabel, (L.left + L.right) / 2, L.bottom + 20);
    if (s.yLabel) {
      ctx.save();
      ctx.translate(14, (L.top + L.bottom) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(s.yLabel, 0, 0);
      ctx.restore();
    }

    if (legend.length) {
      const colW = (L.right - L.left) / Math.min(3, legend.length);
      ctx.font = MONO_SMALL;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      legend.forEach((ser, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const lx = L.left + col * colW;
        const ly = L.bottom + 38 + row * 16;
        ctx.strokeStyle = ser.color;
        ctx.fillStyle = ser.color;
        ctx.lineWidth = 2;
        if (ser.kind === 'scatter') {
          ctx.beginPath();
          ctx.arc(lx + 9, ly, 3.4, 0, Math.PI * 2);
          ctx.fill();
        } else if (ser.kind === 'band') {
          ctx.fillStyle = 'rgba(253, 181, 21, 0.28)';
          ctx.fillRect(lx, ly - 4, 18, 8);
          ctx.strokeStyle = 'rgba(196, 130, 14, 0.75)';
          ctx.lineWidth = 1;
          ctx.strokeRect(lx + 0.5, ly - 3.5, 17, 7);
        } else if (ser.kind === 'vline') {
          ctx.setLineDash(ser.dash ? [3, 2] : []);
          ctx.beginPath();
          ctx.moveTo(lx + 9, ly - 5); ctx.lineTo(lx + 9, ly + 5);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.setLineDash(ser.dash ? [5, 4] : []);
          ctx.beginPath();
          ctx.moveTo(lx, ly); ctx.lineTo(lx + 18, ly);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = INK;
        ctx.fillText(ser.name, lx + 24, ly);
      });
    }

    if (this.showSpecBox && s.specBox && s.specBox.length) this._drawSpecBox(ctx, L, s.specBox);

    if (this.hover) this._drawHover(ctx, L, s);
  }

  _drawSpecBox(ctx, L, boxes) {
    const pad = 7;
    const lineH = 12;
    ctx.font = MONO_SMALL;

    let bx = L.left + 10;
    const by = L.top + 10;

    for (const box of boxes) {
      const lines = [];
      if (box.heading) lines.push([box.heading, null]);
      for (const [k, v] of box.rows) lines.push([k, v]);

      let wLabel = 0;
      let wValue = 0;
      for (const [k, v] of lines) {
        wLabel = Math.max(wLabel, ctx.measureText(k).width);
        if (v !== null) wValue = Math.max(wValue, ctx.measureText(v).width);
      }
      const boxW = wLabel + (wValue ? wValue + 12 : 0) + pad * 2;
      const boxH = lines.length * lineH + pad * 2;

      ctx.fillStyle = 'rgba(255,255,255,0.94)';
      ctx.fillRect(bx, by, boxW, boxH);
      ctx.strokeStyle = RULE;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, by + 0.5, boxW - 1, boxH - 1);

      ctx.textBaseline = 'top';
      lines.forEach(([k, v], i) => {
        const ly = by + pad + i * lineH;
        ctx.textAlign = 'left';
        ctx.fillStyle = v === null ? BERKELEY_BLUE : '#55606a';
        ctx.fillText(k, bx + pad, ly);
        if (v !== null) {
          ctx.textAlign = 'right';
          ctx.fillStyle = INK;
          ctx.fillText(v, bx + boxW - pad, ly);
        }
      });

      bx += boxW + 8;
    }
  }

  _drawHover(ctx, L, s) {
    const hx = this.hover.x;

    let snapX = hx;
    const ref = s.series.find((ser) => ser.points.length > 1);
    if (ref) {
      let best = Infinity;
      for (const [x] of ref.points) {
        const d = Math.abs(x - hx);
        if (d < best) { best = d; snapX = x; }
      }
    }

    const px = Math.round(L.x(snapX)) + 0.5;
    ctx.strokeStyle = 'rgba(0,50,98,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(px, L.top); ctx.lineTo(px, L.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    const dec = s.valueDecimals === undefined ? 1 : s.valueDecimals;
    const rows = [];
    for (const ser of s.series) {
      if (!ser.points.length || ser.hideFromLegend) continue;
      let hit = null;
      let best = Infinity;
      for (const [x, y] of ser.points) {
        const d = Math.abs(x - snapX);
        if (d < best) { best = d; hit = y; }
      }
      if (hit !== null && best <= Math.max(0.75, (L.xMax - L.xMin) / 200)) {
        rows.push([ser.name, hit.toFixed(dec), ser.color]);
        ctx.fillStyle = ser.color;
        ctx.beginPath();
        ctx.arc(px, L.y(hit), 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (!rows.length) return;

    ctx.font = MONO_SMALL;
    const header = `${s.xTipLabel || 'x'} = ${snapX.toFixed(s.xTipDecimals === undefined ? 0 : s.xTipDecimals)}`;
    let wName = ctx.measureText(header).width;
    let wVal = 0;
    for (const [n, v] of rows) {
      wName = Math.max(wName, ctx.measureText(n).width);
      wVal = Math.max(wVal, ctx.measureText(v).width);
    }
    const pad = 7;
    const lineH = 13;
    const boxW = wName + wVal + 22 + pad * 2;
    const boxH = (rows.length + 1) * lineH + pad * 2;

    let bx = px + 12;
    if (bx + boxW > L.right) bx = px - boxW - 12;
    let by = L.top + 10;
    if (this.hover.py > L.bottom - boxH - 20) by = L.top + 10;
    else by = Math.min(this.hover.py + 12, L.bottom - boxH - 4);

    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = BERKELEY_BLUE;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, boxW - 1, boxH - 1);

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = BERKELEY_BLUE;
    ctx.fillText(header, bx + pad, by + pad);

    rows.forEach(([n, v, c], i) => {
      const ly = by + pad + (i + 1) * lineH;
      ctx.fillStyle = c;
      ctx.fillRect(bx + pad, ly + 4, 8, 3);
      ctx.fillStyle = '#55606a';
      ctx.textAlign = 'left';
      ctx.fillText(n, bx + pad + 14, ly);
      ctx.fillStyle = INK;
      ctx.textAlign = 'right';
      ctx.fillText(v, bx + boxW - pad, ly);
    });
  }

  toPNG(filename) {
    const dpr = 2;
    const cssW = this.canvas.clientWidth || 700;
    const cssH = this.canvas.clientHeight || 420;
    const off = document.createElement('canvas');
    off.width = cssW * dpr;
    off.height = cssH * dpr;

    const realCanvas = this.canvas;
    const realCtx = this.ctx;
    const hover = this.hover;
    this.hover = null;
    this.canvas = { getContext: () => off.getContext('2d'), clientWidth: cssW, clientHeight: cssH, width: off.width, height: off.height, addEventListener() {}, removeEventListener() {} };
    this.ctx = off.getContext('2d');
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const savedResize = this._resize;
    this._resize = () => { this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { w: cssW, h: cssH }; };
    this.draw();
    this._resize = savedResize;
    this.canvas = realCanvas;
    this.ctx = realCtx;
    this.hover = hover;
    this.draw();

    const link = document.createElement('a');
    link.download = filename || 'plot.png';
    link.href = off.toDataURL('image/png');
    link.click();
  }
}

export function specBoxFor(values, result) {
  return [
    {
      heading: 'Car Characteristics:',
      rows: [
        ['Weight', `${(values.carWeight + values.driverWeight).toFixed(0)} lbs`],
        ['Rear Weight Bias', values.rearBias.toFixed(3)],
        ['Wheel Base', `${values.wheelBase} in`],
        ['CG Height', `${values.centerGravityZ} in`],
        ['# of Rear Brakes', String(values.numRearBrakes)],
        ['Tire Radius', `${values.tireRad} in`],
        ['Front Rotor Mu', values.frontRotorMu.toFixed(3)],
        ['Rear Rotor Mu', values.rearRotorMu.toFixed(3)],
      ],
    },
    {
      heading: 'Components:',
      rows: [
        ['Average Pedal Ratio', values.pedalRatio.toFixed(2)],
        ['Front Pedal Bias', values.biasBarFrontBias.toFixed(3)],
        ['Front MC Bore', `${values.frontMC} in`],
        ['Front Rotor OD', `${values.frontRotorOD} in`],
        ['Front Rotor ID', `${values.frontRotorID} in`],
        ['Front Caliper Bore', `${values.frontCaliper} mm`],
        ['Rear MC Bore', `${values.rearMC} in`],
        ['Rear Rotor OD', `${values.rearRotorOD} in`],
        ['Rear Rotor ID', `${values.rearRotorID} in`],
        ['Rear Caliper Bore', `${values.rearCaliper} mm`],
        ['Effective Brake Bias', result ? result.effectiveBrakeBias.toFixed(5) : '-'],
      ],
    },
  ];
}

function seriesPoints(result, series) {
  const out = [];
  for (let i = 0; i < result.speeds.length; i++) {
    if (!result.converged[i]) continue;
    out.push([result.speeds[i], series[i]]);
  }
  return out;
}

function eventLines(values) {
  return values.eventSpeeds
    .filter((e) => e.on)
    .map((e, i) => ({
      x: e.value,
      label: `${e.value} mph`,
      legendLabel: i === 0 ? `event speed ${e.value} mph (primary)` : `event speed ${e.value} mph`,
      color: i === 0 ? INK : '#7a838c',
      dash: i !== 0,
    }));
}

const multi = (solved) => solved.length > 1;

export function pedalForceSpec(solved, values, opts = {}) {
  const series = [];
  for (const { entry, result } of solved) {
    const tag = multi(solved) ? `${entry.name} ` : '';
    series.push({
      name: `${tag}front`,
      color: entry.color,
      dash: false,
      points: seriesPoints(result, result.frontPedalForce),
    });
    series.push({
      name: `${tag}rear`,
      color: entry.color,
      dash: true,
      points: seriesPoints(result, result.rearPedalForce),
    });
  }
  return {
    title: 'Pedal Force to Lock Up',
    xLabel: 'Speed (mph)',
    yLabel: 'Pedal Force (lbf)',
    xTipLabel: 'speed',
    valueDecimals: 1,
    series,
    bands: [{
      y0: values.goalLowerLimit,
      y1: values.goalUpperLimit,
      label: `goal range ${values.goalLowerLimit}–${values.goalUpperLimit} lbf`,
    }],
    vlines: eventLines(values),
    specBox: opts.specBox,
    yOverride: opts.yOverride || null,
  };
}

export function decelerationSpec(solved, values, opts = {}) {
  const series = [];
  for (const { entry, result } of solved) {
    const tag = multi(solved) ? `${entry.name}: ` : '';
    const frontPts = [];
    const rearPts = [];
    for (let i = 0; i < result.speeds.length; i++) {
      if (!result.converged[i]) continue;
      const pt = [result.speeds[i], result.deceleration[i]];
      if (result.lockFront[i]) frontPts.push(pt);
      else rearPts.push(pt);
    }
    if (frontPts.length) {
      series.push({ name: `${tag}fronts lock first`, color: '#C4362B', type: 'scatter', points: frontPts });
    }
    if (rearPts.length) {
      series.push({ name: `${tag}rears lock first`, color: entry.color, type: 'scatter', points: rearPts });
    }
  }
  const bias = solved.length ? solved[0].result.effectiveBrakeBias : 0;
  return {
    title: `Vehicle Speed vs Deceleration, Accounting for Tire Lockup (rear bias = ${bias.toFixed(5)})`,
    xLabel: 'Vehicle Speed (mph)',
    yLabel: 'Deceleration (g)',
    xTipLabel: 'speed',
    valueDecimals: 3,
    series,
    bands: [],
    vlines: eventLines(values),
    specBox: opts.specBox,
    yOverride: opts.yOverride || null,
  };
}

export function torqueSpec(solved, values, opts = {}) {
  const series = [];
  for (const { entry, result } of solved) {
    const tag = multi(solved) ? `${entry.name} ` : '';
    series.push({ name: `${tag}front rotor`, color: entry.color, dash: false, points: seriesPoints(result, result.frontTorque) });
    series.push({ name: `${tag}rear rotor`, color: entry.color, dash: true, points: seriesPoints(result, result.rearTorque) });
  }
  return {
    title: 'Brake Torque per Rotor',
    xLabel: 'Speed (mph)',
    yLabel: 'Torque (lbf·ft)',
    xTipLabel: 'speed',
    valueDecimals: 1,
    series,
    bands: [],
    vlines: eventLines(values),
    specBox: opts.specBox,
    yOverride: opts.yOverride || null,
  };
}

export function linePressureSpec(solved, values, opts = {}) {
  const series = [];
  for (const { entry, result } of solved) {
    const tag = multi(solved) ? `${entry.name} ` : '';
    series.push({ name: `${tag}front`, color: entry.color, dash: false, points: seriesPoints(result, result.frontLinePressure) });
    series.push({ name: `${tag}rear`, color: entry.color, dash: true, points: seriesPoints(result, result.rearLinePressure) });
  }
  return {
    title: 'Line Pressure at Lockup',
    xLabel: 'Speed (mph)',
    yLabel: 'Line Pressure (psi)',
    xTipLabel: 'speed',
    valueDecimals: 0,
    series,
    bands: [],
    vlines: eventLines(values),
    specBox: opts.specBox,
    yOverride: opts.yOverride || null,
  };
}

export function sweepSpec(sweep, values, cfg) {
  const front = [];
  const rear = [];
  for (const p of sweep) {
    if (!p.converged) continue;
    front.push([p.x, p.front]);
    rear.push([p.x, p.rear]);
  }
  const vlines = [];
  if (cfg.currentX !== undefined && cfg.currentX !== null) {
    vlines.push({
      x: cfg.currentX,
      label: `current ${cfg.currentLabel || ''}`.trim(),
      legendLabel: 'current setting',
      color: INK,
    });
  }
  if (cfg.optimumX !== undefined && cfg.optimumX !== null) {
    vlines.push({ x: cfg.optimumX, label: 'optimum', legendLabel: 'optimum', color: '#1F7A3D', dash: true });
  }
  return {
    title: cfg.title,
    xLabel: cfg.xLabel,
    yLabel: 'Pedal Force (lbf)',
    xTipLabel: cfg.xTipLabel || 'x',
    xTipDecimals: cfg.xTipDecimals === undefined ? 3 : cfg.xTipDecimals,
    valueDecimals: 1,
    series: [
      { name: 'front', color: BERKELEY_BLUE, dash: false, points: front },
      { name: 'rear', color: CALIFORNIA_GOLD, dash: true, points: rear },
    ],
    bands: [{
      y0: values.goalLowerLimit,
      y1: values.goalUpperLimit,
      label: `goal range ${values.goalLowerLimit}–${values.goalUpperLimit} lbf`,
    }],
    vlines,
    specBox: null,
  };
}

export function objectiveSpec(sweep, values, cfg) {
  const pts = sweep.filter((p) => p.converged).map((p) => [p.x, p.gap]);
  const inBand = sweep.filter((p) => p.converged && p.inBand).map((p) => [p.x, p.gap]);
  const vlines = [];
  if (cfg.currentX !== undefined && cfg.currentX !== null) {
    vlines.push({ x: cfg.currentX, label: 'current', legendLabel: 'current setting', color: INK });
  }
  if (cfg.optimumX !== undefined && cfg.optimumX !== null) {
    vlines.push({ x: cfg.optimumX, label: 'optimum', legendLabel: 'optimum', color: '#1F7A3D', dash: true });
  }
  return {
    title: cfg.title || 'Objective, front/rear pedal force gap',
    xLabel: cfg.xLabel,
    yLabel: 'Gap |front − rear| (lbf)',
    xTipLabel: cfg.xTipLabel || 'x',
    xTipDecimals: cfg.xTipDecimals === undefined ? 3 : cfg.xTipDecimals,
    valueDecimals: 2,
    series: [
      { name: 'gap', color: BERKELEY_BLUE, dash: false, points: pts },
      { name: 'gap, inside goal band', color: '#1F7A3D', type: 'scatter', radius: 2.6, points: inBand },
    ],
    bands: [],
    vlines,
    specBox: null,
  };
}
