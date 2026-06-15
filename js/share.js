import { defaultConfig } from './config.js';
import { CONFIG_COLORS } from './components.js';

const STATE_VERSION = 1;

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s) {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function deltaOf(values) {
  const base = defaultConfig();
  const delta = {};
  for (const key of Object.keys(values)) {
    const a = values[key];
    const b = base[key];
    if (typeof a === 'object' && a !== null) {
      if (JSON.stringify(a) !== JSON.stringify(b)) delta[key] = a;
    } else if (a !== b) {
      delta[key] = a;
    }
  }
  return delta;
}

export function encodeState(configs, viewState = {}) {
  const payload = {
    v: STATE_VERSION,
    c: configs.map((e) => ({
      n: e.name,
      k: e.color,
      e: e.enabled ? 1 : 0,
      d: deltaOf(e.values),
    })),
    view: viewState,
  };
  return b64urlEncode(JSON.stringify(payload));
}

export function decodeState(fragment) {
  if (!fragment) return null;
  try {
    const raw = JSON.parse(b64urlDecode(fragment));
    if (!raw || !Array.isArray(raw.c)) return null;

    const configs = raw.c.slice(0, 4).map((c, i) => ({
      name: typeof c.n === 'string' ? c.n : `Config ${i + 1}`,
      color: typeof c.k === 'string' ? c.k : CONFIG_COLORS[i % CONFIG_COLORS.length],
      enabled: c.e !== 0,
      values: { ...defaultConfig(), ...(c.d || {}) },
    }));
    if (!configs.length) return null;
    return { configs, view: raw.view || {} };
  } catch (err) {
    return null;
  }
}

export function writeFragment(configs, viewState) {
  const encoded = encodeState(configs, viewState);
  try {
    window.history.replaceState(null, '', `${window.location.pathname}#${encoded}`);
  } catch {
    window.location.hash = encoded;
  }
  const origin = window.location.origin;
  return origin && origin !== 'null'
    ? `${origin}${window.location.pathname}#${encoded}`
    : `${window.location.href.split('#')[0]}#${encoded}`;
}

export function readFragment() {
  const frag = window.location.hash.replace(/^#/, '');
  return decodeState(frag);
}

const CSV_COLUMNS = [
  'config',
  'speed_mph',
  'converged',
  'deceleration_g',
  'locks_first',
  'front_pedal_force_lbf',
  'rear_pedal_force_lbf',
  'pedal_force_gap_lbf',
  'front_normal_force_lbf',
  'rear_normal_force_lbf',
  'downforce',
  'cp',
  'weight_transfer_lbf',
  'front_torque_lbf_ft',
  'rear_torque_lbf_ft',
  'front_line_pressure_psi',
  'rear_line_pressure_psi',
];

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(solved) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const { entry, result } of solved) {
    for (let i = 0; i < result.speeds.length; i++) {
      const conv = result.converged[i];
      lines.push(
        [
          csvCell(entry.name),
          result.speeds[i],
          conv ? 'yes' : 'no',
          conv ? result.deceleration[i].toFixed(6) : '',
          conv ? (result.lockFront[i] ? 'front' : 'rear') : '',
          conv ? result.frontPedalForce[i].toFixed(4) : '',
          conv ? result.rearPedalForce[i].toFixed(4) : '',
          conv ? Math.abs(result.frontPedalForce[i] - result.rearPedalForce[i]).toFixed(4) : '',
          conv ? result.frontNormForce[i].toFixed(4) : '',
          conv ? result.rearNormForce[i].toFixed(4) : '',
          result.downforce[i].toFixed(4),
          conv ? result.cpValues[i].toFixed(6) : '',
          conv ? result.dynWeight[i].toFixed(4) : '',
          conv ? result.frontTorque[i].toFixed(4) : '',
          conv ? result.rearTorque[i].toFixed(4) : '',
          conv ? result.frontLinePressure[i].toFixed(2) : '',
          conv ? result.rearLinePressure[i].toFixed(2) : '',
        ].join(',')
      );
    }
  }
  return lines.join('\n');
}

export function downloadText(filename, text, mime = 'text/csv') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
}
