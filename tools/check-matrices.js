// Independent checker for the Matrices engine. It shares no code with the engine.
// For every puzzle it (1) works the answer out again from the eight shown cells alone, trying every
// rule it knows and failing if two rules disagree; (2) checks no option depends on colour, by
// redrawing every cell in one ink and making sure different cells still look different;
// (3) measures how often simple guessing shortcuts find the answer (chance is 1 in 8).
//   node check.js <engine file> [puzzles per level]
const path = require('path');
const E = require(path.resolve(process.argv[2] || __dirname + '/../matrices.js'));
const PER = Number(process.argv[3] || 4000);
const K = (x) => JSON.stringify(x);
const mod = (a, n) => ((a % n) + n) % n;
const uniq = (a) => [...new Set(a)];
const fail = (p, msg) => { const e = new Error('L' + p.tier + '-' + p.seed + ' [' + p.title + ']: ' + msg); e.puzzle = p; throw e; };

// ---------- 1. solving from the shown cells ----------
// vals: the eight known values of one attribute, in reading order. Returns every value a rule predicts.
function predictAttr(vals, kind) {
  const g = (r, c) => vals[r * 3 + c];
  const preds = [];
  if (vals.every((v) => K(v) === K(vals[0]))) return [vals[0]];
  // each row and each column holds the same three values once
  (function latin() {
    const set = uniq([g(0, 0), g(0, 1), g(0, 2)].map(K));
    if (set.length !== 3) return;
    const row1 = uniq([g(1, 0), g(1, 1), g(1, 2)].map(K));
    if (row1.length !== 3 || row1.some((v) => !set.includes(v))) return;
    const row2 = [g(2, 0), g(2, 1)].map(K);
    if (row2[0] === row2[1] || row2.some((v) => !set.includes(v))) return;
    for (const c of [0, 1]) if (uniq([g(0, c), g(1, c), g(2, c)].map(K)).length !== 3) return;
    if (K(g(0, 2)) === K(g(1, 2))) return;
    const left = set.filter((v) => !row2.includes(v));
    const leftCol = set.filter((v) => v !== K(g(0, 2)) && v !== K(g(1, 2)));
    if (left.length === 1 && leftCol.length === 1 && left[0] === leftCol[0]) preds.push(JSON.parse(left[0]));
  })();
  // a steady step to the right and a steady step down
  if (kind === 'num' || kind === 'angle') (function linear() {
    const m = kind === 'angle' ? 360 : 0, d = (x) => (m ? mod(x, m) : x);
    const sc = d(g(0, 1) - g(0, 0)), sr = d(g(1, 0) - g(0, 0));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      if (r === 2 && c === 2) continue;
      if (d(g(0, 0) + sc * c + sr * r) !== d(g(r, c))) return;
    }
    preds.push(d(g(0, 0) + 2 * sc + 2 * sr));
  })();
  // the same in every row (depends on the column only), or the same in every column
  if ([0, 1, 2].every((c) => K(g(0, c)) === K(g(1, c))) && [0, 1].every((c) => K(g(0, c)) === K(g(2, c)))) preds.push(g(0, 2));
  if ([0, 1].every((r) => K(g(r, 0)) === K(g(r, 1)) && K(g(r, 1)) === K(g(r, 2))) && K(g(2, 0)) === K(g(2, 1))) preds.push(g(2, 0));
  return uniq(preds.map(K)).map((s) => JSON.parse(s));
}
const one = (p, preds, what) => { if (preds.length !== 1) fail(p, (preds.length ? 'two readings of ' : 'no rule found for ') + what + ': ' + K(preds)); return preds[0]; };

const SETOPS = {
  or: (A, B) => uniq(A.concat(B)).sort((x, y) => x - y),
  and: (A, B) => A.filter((x) => B.includes(x)),
  xor: (A, B) => A.filter((x) => !B.includes(x)).concat(B.filter((x) => !A.includes(x))).sort((x, y) => x - y),
  first: (A) => A.slice(), second: (A, B) => B.slice(),
  aNotB: (A, B) => A.filter((x) => !B.includes(x)), bNotA: (A, B) => B.filter((x) => !A.includes(x))
};
function predictSet(p, sets, what) {
  const preds = [];
  for (const op of Object.keys(SETOPS)) {
    if ([0, 1].every((r) => K(SETOPS[op](sets[r * 3], sets[r * 3 + 1])) === K(sets[r * 3 + 2]))) preds.push(SETOPS[op](sets[6], sets[7]));
  }
  return one(p, uniq(preds.map(K)).map((s) => JSON.parse(s)), what);
}
const ARITH = { add: (a, b) => a + b, sub: (a, b) => a - b, rsub: (a, b) => b - a, twiceA: (a) => 2 * a, twiceB: (a, b) => 2 * b,
  times: (a, b) => a * b, max: (a, b) => Math.max(a, b), min: (a, b) => Math.min(a, b), first: (a) => a, second: (a, b) => b, gap: (a, b) => Math.abs(a - b) };

function solve(p) {
  const cells = p.cells, t = cells[0].t;
  if (cells.length !== 8 || cells.some((c) => c.t !== t)) fail(p, 'bad stem');
  if (t === 'fig') {
    const out = { t: 'fig' };
    for (const [a, kind] of [['shape', 'cat'], ['fill', 'cat'], ['color', 'cat'], ['count', 'num'], ['rot', 'angle'], ['size', 'num']])
      out[a] = one(p, predictAttr(cells.map((c) => c[a]), kind), a);
    return (o) => ['shape', 'fill', 'color', 'count', 'rot', 'size'].every((a) => o[a] === out[a]);
  }
  if (t === 'set') {
    if (uniq(cells.map((c) => c.u + '/' + c.c)).length !== 1) fail(p, 'set cells differ in kind or colour');
    const ans = predictSet(p, cells.map((c) => c.a), 'the sets');
    return (o) => o.u === cells[0].u && o.c === cells[0].c && K(o.a) === K(ans);
  }
  if (t === 'layers') {
    const a = predictSet(p, cells.map((c) => c.a), 'the lines'), b = predictSet(p, cells.map((c) => c.b), 'the dots');
    return (o) => K(o.a) === K(a) && K(o.b) === K(b);
  }
  if (t === 'grid' && cells[0].n === 3) {
    const ids = cells[0].m.map((m) => m.c + '/' + (m.s || ''));
    const want = {};
    for (const id of ids) {
      const pos = cells.map((c) => { const m = c.m.filter((x) => x.c + '/' + (x.s || '') === id); if (m.length !== 1 || c.g.length) fail(p, 'marker missing'); return m[0].p; });
      const x = one(p, predictAttr(pos.map((q) => q % 3), 'angle3'), 'marker column'), y = 0;
      // positions wrap round a 3-wide grid, so the steady-step rule is checked by hand here
      const lin = (v) => { const sc = mod(v[1] - v[0], 3), sr = mod(v[3] - v[0], 3);
        for (let i = 0; i < 8; i++) if (mod(v[0] + sc * (i % 3) + sr * Math.floor(i / 3), 3) !== v[i]) fail(p, 'marker does not move steadily');
        return mod(v[0] + 2 * sc + 2 * sr, 3); };
      want[id] = lin(pos.map((q) => Math.floor(q / 3))) * 3 + lin(pos.map((q) => q % 3));
    }
    if (uniq(Object.values(want)).length !== ids.length) fail(p, 'two markers land on one square');
    return (o) => o.n === 3 && !o.g.length && o.m.length === ids.length && o.m.every((m) => want[m.c + '/' + (m.s || '')] === m.p);
  }
  if (t === 'grid') {
    const pathNow = cells.map((c) => { if (c.m.length !== 1) fail(p, 'series cell without one marked square'); return c.m[0].p; });
    const step = mod(pathNow[1] - pathNow[0], 16);
    cells.forEach((c, i) => {
      if (i && mod(pathNow[i] - pathNow[i - 1], 16) !== step) fail(p, 'series step is not steady');
      if (K(c.g) !== K(pathNow.slice(0, i).sort((x, y) => x - y))) fail(p, 'series trail is wrong');
    });
    const next = mod(pathNow[7] + step, 16), trail = pathNow.slice().sort((x, y) => x - y);
    if (trail.includes(next)) fail(p, 'series runs into its own trail');
    return (o) => o.n === 4 && K(o.g) === K(trail) && o.m.length === 1 && o.m[0].p === next && (o.m[0].s || '') === (cells[0].m[0].s || '') && o.m[0].c === cells[0].m[0].c;
  }
  if (t === 'sym') {
    const v = [];
    for (let q = 0; q < 9; q++) v.push(one(p, predictAttr(cells.map((c) => c.v[q]), 'cat'), 'inner position ' + q));
    return (o) => o.mode === cells[0].mode && K(o.v) === K(v);
  }
  if (t === 'dots') {
    const val = cells.map((c) => { if (c.f && c.h) fail(p, 'stem cell mixes filled and hollow'); return c.f - c.h; });
    const preds = [];
    for (const k of Object.keys(ARITH)) if ([0, 1].every((r) => ARITH[k](val[r * 3], val[r * 3 + 1]) === val[r * 3 + 2])) preds.push(ARITH[k](val[6], val[7]));
    const v = one(p, uniq(preds), 'the dots');
    if (v === 0) fail(p, 'answer would be an empty cell');
    return (o) => o.f === Math.max(v, 0) && o.h === Math.max(-v, 0);
  }
  fail(p, 'unknown cell type ' + t);
}

// ---------- 2. colour must never be the only difference ----------
const oneInk = (svg) => svg.replace(/url\(#ms-hatch-[a-z]+\)/g, 'url(#H)').replace(/#fff(fff)?\b/gi, 'W').replace(/#[0-9a-f]{3,8}\b/gi, 'K');
function colourTest(p) {
  const seen = {};
  for (const c of p.cells.concat(p.options)) {
    const look = oneInk(E.renderCell(c)), k = K(c);
    if (seen[look] !== undefined && seen[look] !== k) return false;
    seen[look] = k;
  }
  return true;
}

// ---------- 3. guessing shortcuts ----------
const symdiff = (A, B) => A.filter((x) => !B.includes(x)).length + B.filter((x) => !A.includes(x)).length;
function dist(a, b) {
  switch (a.t) {
    case 'fig': return ['shape', 'fill', 'color', 'count', 'rot', 'size'].filter((k) => a[k] !== b[k]).length;
    case 'set': return symdiff(a.a, b.a);
    case 'layers': return symdiff(a.a, b.a) + symdiff(a.b, b.b);
    case 'grid': return symdiff(a.g, b.g) + symdiff(a.m.map((m) => m.c + ':' + m.p), b.m.map((m) => m.c + ':' + m.p)) / 2;
    case 'sym': return a.v.filter((x, i) => x !== b.v[i]).length;
    case 'dots': return Math.abs(a.f - b.f) + Math.abs(a.h - b.h);
  }
}
const sizeOf = (c) => c.t === 'set' ? c.a.length : c.t === 'layers' ? c.a.length + c.b.length : c.t === 'grid' ? c.g.length + c.m.length : c.t === 'dots' ? c.f + c.h : c.t === 'fig' ? c.count : null;
function share(vals, ans, pick) { const best = pick(...vals), ties = vals.filter((v) => v === best).length; return vals[ans] === best ? 1 / ties : 0; }

const stats = {}, bump = (o, k, by) => { o[k] = (o[k] || 0) + (by === undefined ? 1 : by); };
let total = 0, colourBad = 0; const failures = [], colourFamilies = {}, dotVals = {};
for (let tier = 1; tier <= 5; tier++) {
  for (let i = 0; i < PER; i++) {
    const seed = i % 2 ? (Math.imul(i + tier * 7919, 2654435761) >>> 0) % 2147483646 + 1 : i / 2 + 1 + tier * 100000;
    let p;
    try {
      p = E.generate(seed, tier); total++;
      if (p.options.length !== 8 || uniq(p.options.map(K)).length !== 8) fail(p, 'options are not eight different cells');
      if (K(E.generate(seed, tier)) !== K(p)) fail(p, 'not deterministic');
      const ok = solve(p), hits = p.options.map((o, j) => (ok(o) ? j : -1)).filter((j) => j >= 0);
      if (hits.length !== 1) fail(p, hits.length + ' options fit the rule');
      if (hits[0] !== p.answer) fail(p, 'engine answer ' + p.answer + ' but the rule gives ' + hits[0]);
    } catch (e) { failures.push(e.message); if (!p) continue; }
    const fam = p.title, s = stats[fam] || (stats[fam] = { n: 0, tiers: {}, pos: {}, like: 0, unlike: 0, hub: 0, big: 0, small: 0, sized: 0 });
    if (!colourTest(p)) { colourBad++; bump(colourFamilies, fam); }
    s.n++; bump(s.tiers, tier); bump(s.pos, p.answer);
    const T = p.options.map((o, a) => p.options.reduce((sum, q, b) => sum + (a === b ? 0 : dist(o, q)), 0));
    s.like += share(T, p.answer, Math.min); s.unlike += share(T, p.answer, Math.max);
    const dmin = Math.min(...p.options.flatMap((o, a) => p.options.filter((q, b) => a !== b).map((q) => dist(o, q))));
    const deg = p.options.map((o, a) => p.options.filter((q, b) => a !== b && dist(o, q) === dmin).length);
    s.hub += share(deg, p.answer, Math.max);
    const sz = p.options.map(sizeOf);
    if (sz[0] !== null && uniq(sz).length > 1) { s.sized++; s.big += share(sz, p.answer, Math.max); s.small += share(sz, p.answer, Math.min); }
    if (p.options[0].t === 'dots') { const a = p.options[p.answer]; bump(dotVals[fam] = dotVals[fam] || {}, a.f - a.h); }
  }
}
const pct = (x) => (100 * x).toFixed(1) + '%';
console.log('Checked ' + total + ' puzzles. Wrong or ambiguous: ' + failures.length + '. Depend on colour: ' + colourBad + ' (' + pct(colourBad / total) + ').');
failures.slice(0, 8).forEach((f) => console.log('   FAIL ' + f));
if (failures.length > 8) { const by = {}; failures.forEach((f) => bump(by, f.replace(/^L\d-\d+ /, '').replace(/:.*?(two readings of|no rule found for|options fit|engine answer)/, ': $1').slice(0, 70))); console.log('   failure kinds: ' + K(by)); }
if (colourBad) console.log('   colour-dependent by family: ' + K(colourFamilies));
console.log('\nGuessing shortcuts, chance 12.5%   (most like others / least like / most close neighbours / largest / smallest)');
let all = { n: 0, like: 0, unlike: 0, hub: 0 };
for (const fam of Object.keys(stats).sort((a, b) => Object.keys(stats[a].tiers)[0] - Object.keys(stats[b].tiers)[0])) {
  const s = stats[fam];
  all.n += s.n; all.like += s.like; all.unlike += s.unlike; all.hub += s.hub;
  console.log(('L' + Object.keys(s.tiers).join(',') + ' ' + fam).padEnd(34) + String(s.n).padStart(6) + '  ' + [s.like / s.n, s.unlike / s.n, s.hub / s.n].map(pct).map((x) => x.padStart(6)).join(' ')
    + '  ' + (s.sized ? [s.big / s.sized, s.small / s.sized].map(pct).map((x) => x.padStart(6)).join(' ') : '     –      –')
    + '   pos ' + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => Math.round(100 * (s.pos[i] || 0) / s.n)).join(' '));
}
console.log('ALL'.padEnd(34) + String(all.n).padStart(6) + '  ' + [all.like / all.n, all.unlike / all.n, all.hub / all.n].map(pct).map((x) => x.padStart(6)).join(' '));
for (const fam of Object.keys(dotVals)) { const d = dotVals[fam], n = Object.values(d).reduce((a, b) => a + b, 0), top = Object.keys(d).sort((a, b) => d[b] - d[a])[0];
  console.log('answer values in "' + fam + '": always guessing ' + top + ' wins ' + pct(d[top] / n) + '   ' + Object.keys(d).sort((a, b) => a - b).map((k) => k + ':' + Math.round(100 * d[k] / n)).join(' ')); }
