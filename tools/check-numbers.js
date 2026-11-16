// Independent checker for the Numbers engine. Shares no code with it.
// (1) Tries every whole number near the options in the gap and keeps those that some rule explains:
//     exactly one must survive, and it must be the engine's answer.
// (2) Measures guessing shortcuts on the five options (chance 20%).
//   node check.js <engine file> [puzzles per level]
const path = require('path');
const E = require(path.resolve(process.argv[2] || __dirname + '/../numbers.js'));
const PER = Number(process.argv[3] || 4000);
const same = (a) => a.every((x) => x === a[0]);
const gaps = (t) => t.slice(1).map((x, i) => x - t[i]);
const isArith = (t) => same(gaps(t));
const isGeom = (t) => t.every((x) => x !== 0) && Number.isInteger(t[1] / t[0]) && Math.abs(t[1] / t[0]) >= 2 && t.every((x, i) => !i || x === t[i - 1] * (t[1] / t[0]));
// gapAt: where the unknown sits. A reading as two interleaved series only counts when each of the two
// shows at least three known terms; with two known terms any third number would 'fit'.
function seriesRules(t, gapAt) {
  const hit = [];
  if (isArith(t)) hit.push('steady step');
  if (isGeom(t)) hit.push('steady multiplier');
  const g2 = gaps(gaps(t)); if (g2.length >= 2 && same(g2) && g2[0] !== 0) hit.push('growing gap');
  if (t.length >= 4 && t.every((x, i) => i < 2 || x === t[i - 1] + t[i - 2])) hit.push('sum of two before');
  if (t[1] !== t[0]) { const r = (t[2] - t[1]) / (t[1] - t[0]), d = t[1] - r * t[0];
    if (Number.isInteger(r) && r !== 0 && r !== 1 && Math.abs(r) <= 6 && d !== 0 && t.every((x, i) => !i || x === r * t[i - 1] + d)) hit.push('multiply then add'); }
  const ev = t.filter((_, i) => i % 2 === 0), od = t.filter((_, i) => i % 2 === 1);
  const knownEv = ev.length - (gapAt % 2 === 0 ? 1 : 0), knownOd = od.length - (gapAt % 2 === 1 ? 1 : 0);
  if (knownEv >= 3 && knownOd >= 3 && (isArith(ev) || isGeom(ev)) && (isArith(od) || isGeom(od))) hit.push('two interleaved');
  // an alternating reading needs five known terms: with four, one of the two operations is seen only once
  if (t.length >= 6) for (const ph of [0, 1]) {
    const add = ph === 0 ? t[1] - t[0] : t[2] - t[1], mul = ph === 0 ? t[2] / t[1] : t[1] / t[0];
    if (add !== 0 && Number.isInteger(mul) && Math.abs(mul) >= 2 && t.every((x, i) => !i || x === ((i - 1 + ph) % 2 === 0 ? t[i - 1] + add : t[i - 1] * mul))) hit.push('alternating');
  }
  return hit;
}
const LINE = [
  (x) => x[2] === x[0] + x[1] ? 'sum' : null, (x) => x[2] === x[0] - x[1] ? 'difference' : null, (x) => x[2] === x[0] * x[1] ? 'product' : null,
  (x) => 2 * x[2] === x[0] + x[1] ? 'halfway' : null, (x) => x[1] - x[0] === x[2] - x[1] ? 'equal steps' : null,
  (x) => x[2] - x[0] - x[1] !== 0 ? 'sum plus ' + (x[2] - x[0] - x[1]) : null, (x) => x[2] - x[0] * x[1] !== 0 ? 'product plus ' + (x[2] - x[0] * x[1]) : null,
  (x) => 'total ' + (x[0] + x[1] + x[2])
];
function gridRules(g) {
  const hit = [];
  for (const [dir, lines] of [['rows', [[0, 1, 2], [3, 4, 5], [6, 7, 8]]], ['columns', [[0, 3, 6], [1, 4, 7], [2, 5, 8]]]])
    for (const f of LINE) { const tags = lines.map((l) => f(l.map((i) => g[i]))); if (tags[0] !== null && same(tags)) hit.push(dir + ': ' + tags[0]); }
  return hit;
}
const stats = {}, fails = [];
const bump = (o, k, by) => { o[k] = (o[k] || 0) + (by === undefined ? 1 : by); };
let total = 0;
for (let tier = 1; tier <= 5; tier++) for (let i = 0; i < PER; i++) {
  const seed = i % 2 ? (Math.imul(i + tier * 7919, 2654435761) >>> 0) % 2147483646 + 1 : i / 2 + 1 + tier * 100000;
  const p = E.generate(seed, tier); total++;
  const code = 'N' + tier + '-' + seed, vals = p.cells.map((c) => c.v), want = p.value;
  const withGap = (v) => vals.slice(0, p.gap).concat([v], vals.slice(p.gap));
  const rules = p.layout === 'grid' ? gridRules : seriesRules;
  const lo = Math.min(want, ...p.options.map((o) => o.v)) - 60, hi = Math.max(want, ...p.options.map((o) => o.v)) + 60;
  const fit = []; for (let v = lo; v <= hi; v++) if (rules(withGap(v), p.gap).length) fit.push(v);
  if (fit.length !== 1 || fit[0] !== want) fails.push(code + ' [' + p.title + ']: values that fit the gap: ' + fit.join(', ') + ' (answer ' + want + ')');
  if (JSON.stringify(E.generate(seed, tier)) !== JSON.stringify(p)) fails.push(code + ': not deterministic');
  if (p.typed) continue;
  const o = p.options.map((x) => x.v), a = p.answer;
  if (o.length !== 5 || new Set(o).size !== 5 || o[a] !== want) fails.push(code + ': bad options');
  const key = 'L' + tier + ' ' + p.title + (p.layout === 'strip' ? (p.gap === vals.length ? ' (end)' : ' (inside)') : '');
  const s = stats[key] || (stats[key] = { n: 0, pos: [0, 0, 0, 0, 0], near: 0, far: 0, pair: 0, digit: 0, parity: 0, lastUp: 0 });
  s.n++; s.pos[a]++;
  const share = (score, pick) => { const best = pick(...score), ties = score.filter((x) => x === best).length; return score[a] === best ? 1 / ties : 0; };
  const spread = o.map((x) => o.reduce((sum, y) => sum + Math.abs(x - y), 0));
  s.near += share(spread, Math.min); s.far += share(spread, Math.max);
  // how many other options sit within 3 of this one: fillers are built as answer +/- a little
  s.pair += share(o.map((x) => o.filter((y) => y !== x && Math.abs(x - y) <= 3).length), Math.max);
  s.digit += share(o.map((x) => o.filter((y) => Math.abs(y) % 10 === Math.abs(x) % 10).length), Math.max);
  s.parity += share(o.map((x) => o.filter((y) => (y - x) % 2 === 0).length), Math.max);
}
const pct = (x) => (100 * x).toFixed(0).padStart(3) + '%';
console.log('Checked ' + total + ' puzzles. Wrong or ambiguous: ' + fails.length);
fails.slice(0, Number(process.env.SHOW || 10)).forEach((f) => console.log('   FAIL ' + f));
console.log('\nShortcuts, chance 20%.  position of answer in the sorted options | middle of the pack / outlier / most close neighbours / commonest last digit / commonest parity');
const all = { n: 0, pos: [0, 0, 0, 0, 0], near: 0, far: 0, pair: 0, digit: 0, parity: 0 };
for (const k of Object.keys(stats).sort()) { const s = stats[k];
  for (const f of ['n', 'near', 'far', 'pair', 'digit', 'parity']) all[f] += s[f]; s.pos.forEach((v, i) => { all.pos[i] += v; });
  console.log(k.padEnd(30) + String(s.n).padStart(6) + '  ' + s.pos.map((v) => pct(v / s.n)).join('') + '  |' + [s.near, s.far, s.pair, s.digit, s.parity].map((v) => pct(v / s.n)).join(' ')); }
console.log('ALL'.padEnd(30) + String(all.n).padStart(6) + '  ' + all.pos.map((v) => pct(v / all.n)).join('') + '  |' + [all.near, all.far, all.pair, all.digit, all.parity].map((v) => pct(v / all.n)).join(' '));
