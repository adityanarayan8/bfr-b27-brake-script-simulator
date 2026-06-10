const out =
  typeof console !== 'undefined' && console.log
    ? (s) => console.log(s)
    : (s) => print(s);

const RED = '[31m';
const GREEN = '[32m';
const DIM = '[2m';
const BOLD = '[1m';
const RESET = '[0m';

const state = { passed: 0, failed: 0, failures: [], suite: '' };

export function suite(name) {
  state.suite = name;
  out(`\n${BOLD}${name}${RESET}`);
}

export function test(name, fn) {
  try {
    fn();
    state.passed++;
    out(`  ${GREEN}PASS${RESET}  ${name}`);
  } catch (err) {
    state.failed++;
    const msg = err && err.message ? err.message : String(err);
    state.failures.push(`${state.suite} > ${name}: ${msg}`);
    out(`  ${RED}FAIL${RESET}  ${name}`);
    out(`        ${RED}${msg}${RESET}`);
  }
}

export function note(msg) {
  out(`  ${DIM}${msg}${RESET}`);
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

export function assertClose(actual, expected, tol, msg) {
  const d = Math.abs(actual - expected);
  if (!(d <= tol)) {
    throw new Error(
      `${msg || 'value'}: expected ${expected} +/- ${tol}, got ${actual} (off by ${d.toExponential(3)})`
    );
  }
}

export function assertBetween(actual, lo, hi, msg) {
  if (!(actual >= lo && actual <= hi)) {
    throw new Error(`${msg || 'value'}: expected within [${lo}, ${hi}], got ${actual}`);
  }
}

export function report() {
  out('');
  out('─'.repeat(64));
  if (state.failed === 0) {
    out(`${GREEN}${BOLD}All ${state.passed} tests passed.${RESET}`);
  } else {
    out(`${RED}${BOLD}${state.failed} failed${RESET}, ${state.passed} passed.`);
    for (const f of state.failures) out(`  ${RED}- ${f}${RESET}`);
  }
  out('─'.repeat(64));
  if (state.failed > 0 && typeof process !== 'undefined' && process.exit) {
    process.exit(1);
  }
  return state.failed === 0;
}
