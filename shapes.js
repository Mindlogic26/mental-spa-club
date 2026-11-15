/* MentalSpa.club — Shapes engine.
   Seeded and deterministic: the same code (for example S3-48213) always gives the same puzzle.
   Three forms: analogy (A is to B as C is to ?), series (what comes next), odd one out.
   No colour is used as a rule: figures are one ink colour with empty / striped / solid fills. */
(function (root) {
  'use strict';

  // ---------- seeded random ----------
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const ri = (r, n) => Math.floor(r() * n);
  const pick = (r, arr) => arr[ri(r, arr.length)];
  function shuffle(r, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = ri(r, i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const mod = (a, n) => ((a % n) + n) % n;

  // ---------- figure model ----------
  // sh: shape name; fill: 0 empty, 1 striped, 2 solid; size: 0..2;
  // rot: 0..7 (steps of 45 degrees clockwise) and mir: 0/1, used only by the one-sided shapes;
  // dot: null or 0..7 (position on a ring around the figure); inner: null or a small shape inside.
  const PLAIN = ['circle', 'square', 'triangle', 'pentagon', 'hexagon', 'cross', 'star'];
  const HOLDS_INNER = ['circle', 'square', 'triangle', 'pentagon', 'hexagon'];
  const INNER = ['circle', 'square', 'triangle', 'cross', 'star'];
  const SWAPPABLE = ['circle', 'square', 'triangle'];
  // One-sided ("chiral") shapes: a turned copy never equals a mirrored copy, so turns and flips cannot be confused.
  const CHIRAL = ['flag', 'ell', 'wedge'];
  const FILL = ['empty', 'striped', 'solid'];
  const SIZE = ['small', 'medium', 'large'];
  const NAME = { ell: 'L shape' };
  const nm = s => NAME[s] || s;
  const an = s => (/^(L |[aeiou])/.test(s) ? 'an ' : 'a ') + s;

  const fig = o => Object.assign({ sh: 'circle', fill: 0, size: 1, rot: 0, mir: 0, dot: null, inner: null }, o);
  const clone = f => Object.assign({}, f);
  const key = f => [f.sh, f.fill, f.size, f.rot, f.mir, f.dot, f.inner].join('|');
  const valid = f => f.inner === null || (f.inner !== f.sh && f.size >= 1);

  function randFig(r, o) {
    const f = fig({ fill: ri(r, 3), size: ri(r, 3) });
    if (o.chiral) { f.sh = pick(r, CHIRAL); f.rot = ri(r, 8); f.mir = ri(r, 2); }
    else if (o.swap) { f.sh = pick(r, SWAPPABLE); f.inner = pick(r, SWAPPABLE.filter(s => s !== f.sh)); f.size = 1 + ri(r, 2); }
    else if (o.inner) { f.sh = pick(r, HOLDS_INNER); f.inner = pick(r, INNER.filter(s => s !== f.sh)); f.size = 1 + ri(r, 2); }
    else f.sh = pick(r, PLAIN);
    if (o.dot) f.dot = ri(r, 8);
    return f;
  }

  const turnText = d => {
    d = mod(d, 8);
    if (d === 4) return 'a half turn (180°)';
    return d < 4 ? (d * 45) + '° clockwise' : ((8 - d) * 45) + '° anticlockwise';
  };

  // ---------- answer options ----------
  // dims: one entry per attribute that may be wrong; each entry is a list of "slips" applied to the right answer.
  // Four wrong options are chosen so that, for every attribute, the right value appears in 2 or 3 of the 5 options.
  // That removes the "pick the option most like the others" shortcut.
  function chooseOptions(r, ans, dims, banned) {
    let combos = [[]];
    for (const d of dims) {
      const nx = [];
      for (const c of combos) for (let v = 0; v <= d.length; v++) nx.push(c.concat(v));
      combos = nx;
    }
    combos = combos.filter(c => c.some(v => v));
    if (combos.length < 4) return null;
    for (let t = 0; t < 200; t++) {
      const sel = shuffle(r, combos).slice(0, 4);
      let ok = true;
      for (let i = 0; i < dims.length && ok; i++) {
        const z = sel.filter(c => c[i] === 0).length;
        if (z < 1 || z > 2) ok = false;
      }
      if (!ok) continue;
      const figs = sel.map(c => { const x = clone(ans); c.forEach((v, i) => { if (v) dims[i][v - 1](x); }); return x; });
      const keys = new Set(figs.map(key)); keys.add(key(ans));
      if (keys.size !== 5) continue;
      if (figs.some(f => !valid(f) || banned.has(key(f)))) continue;
      return figs;
    }
    return null;
  }
  function extraDims(dims, ans, used, sizes) {
    const total = () => dims.reduce((p, d) => p * (d.length + 1), 1);
    if (total() < 6 && !used.fill) {
      dims.push([x => { x.fill = (ans.fill + 1) % 3; }, x => { x.fill = (ans.fill + 2) % 3; }]);
      used.fill = 1;
    }
    if (total() < 6 && !used.size) {
      dims.push(sizes.filter(s => s !== ans.size).map(s => x => { x.size = s; }));
      used.size = 1;
    }
  }
  function finish(r, form, stem, ans, wrong, explain) {
    const options = shuffle(r, [ans].concat(wrong));
    const k = key(ans);
    return { form, stem, options, answer: options.findIndex(f => key(f) === k), explain };
  }

  // ---------- analogy ----------
  function genAnalogy(r, L) {
    for (let t = 0; t < 400; t++) {
      const chiral = r() < 0.5;
      let pool = chiral ? ['rot', 'mir', 'fill', 'size', 'dot', 'shape'] : ['fill', 'size', 'dot', 'shape', 'inner', 'swap'];
      if (L === 1) pool = pool.filter(o => ['fill', 'size', 'shape', 'rot'].includes(o));
      if (L === 2) pool = pool.filter(o => o !== 'mir' && o !== 'swap');
      const k = L <= 1 ? 1 : L <= 3 ? 2 : 3;
      const ops = shuffle(r, pool).slice(0, k);
      const has = o => ops.includes(o);
      if (has('rot') && has('mir')) continue;
      if (has('swap') && (has('shape') || has('inner'))) continue;
      if ((L === 3 || L === 5) && !has('mir') && !has('swap')) continue;
      const withInner = has('inner') || has('swap');
      const sizes = withInner ? [1, 2] : [0, 1, 2];
      const o = { chiral, swap: has('swap'), inner: withInner, dot: has('dot') };
      const steps = L <= 2 ? [2, 4, 6] : [1, 2, 3, 4, 5, 6, 7];

      const A = randFig(r, o), B = clone(A), P = {};
      if (has('fill')) B.fill = pick(r, [0, 1, 2].filter(v => v !== A.fill));
      if (has('size')) B.size = pick(r, sizes.filter(v => v !== A.size));
      if (has('shape')) B.sh = pick(r, (chiral ? CHIRAL : withInner ? HOLDS_INNER : PLAIN).filter(s => s !== A.sh && s !== A.inner));
      if (has('inner')) B.inner = pick(r, INNER.filter(s => s !== A.inner && s !== A.sh && s !== B.sh));
      if (has('rot')) { P.rot = pick(r, steps); B.rot = (A.rot + P.rot) % 8; }
      if (has('dot')) { P.dot = pick(r, steps); B.dot = (A.dot + P.dot) % 8; }
      if (has('mir')) { B.mir = 1 - A.mir; B.rot = mod(-A.rot, 8); }
      if (has('swap')) { B.sh = A.inner; B.inner = A.sh; }
      if (!valid(B)) continue;

      // C keeps A's value on every attribute that changes by name (fill, size, shape, inner shape),
      // so "becomes X" and "moves one step" readings give the same answer.
      const C = randFig(r, o);
      if (has('fill')) C.fill = A.fill;
      if (has('size')) C.size = A.size;
      if (has('shape')) C.sh = A.sh;
      if (has('inner')) C.inner = A.inner;
      if (has('mir')) C.rot = (A.rot + 4 * ri(r, 2)) % 8; // screen flip and object flip then agree
      if (has('rot') && (C.rot === A.rot || C.rot === B.rot)) continue;
      const refl = has('dot') ? mod(A.dot + B.dot - C.dot, 8) : null; // "mirrored" reading of a moving dot
      if (has('dot') && (C.dot === A.dot || C.dot === B.dot || refl === C.dot)) continue;
      if (!valid(C) || key(C) === key(A) || key(C) === key(B)) continue;

      const ans = clone(C);
      if (has('fill')) ans.fill = B.fill;
      if (has('size')) ans.size = B.size;
      if (has('shape')) ans.sh = B.sh;
      if (has('inner')) ans.inner = B.inner;
      if (has('rot')) ans.rot = (C.rot + P.rot) % 8;
      if (has('dot')) ans.dot = (C.dot + P.dot) % 8;
      if (has('mir')) { ans.mir = 1 - C.mir; ans.rot = mod(-C.rot, 8); }
      if (has('swap')) { ans.sh = C.inner; ans.inner = C.sh; }
      if (!valid(ans)) continue;

      const dims = [], used = {}, say = [];
      for (const op of ops) {
        if (op === 'fill') {
          used.fill = 1;
          dims.push([x => { x.fill = C.fill; }, x => { x.fill = 3 - C.fill - ans.fill; }]);
          say.push('the fill changes from ' + FILL[A.fill] + ' to ' + FILL[B.fill]);
        } else if (op === 'size') {
          used.size = 1;
          const d = [x => { x.size = C.size; }];
          const third = sizes.find(s => s !== C.size && s !== ans.size);
          if (third !== undefined) d.push(x => { x.size = third; });
          dims.push(d);
          say.push('the size changes from ' + SIZE[A.size] + ' to ' + SIZE[B.size]);
        } else if (op === 'shape') {
          dims.push([x => { x.sh = C.sh; }]);
          say.push('the ' + nm(A.sh) + ' becomes ' + an(nm(B.sh)));
        } else if (op === 'inner') {
          dims.push([x => { x.inner = C.inner; }]);
          say.push('the inner ' + nm(A.inner) + ' becomes ' + an(nm(B.inner)));
        } else if (op === 'rot' || op === 'dot') {
          const a = op, d = P[a];
          const no = [ans[a], C[a], B[a]]; if (a === 'dot') no.push(refl);
          const alt = [C[a] - d, C[a] + 2 * d, ans[a] + 4, ans[a] + 2].map(v => mod(v, 8)).find(v => !no.includes(v));
          const dd = [x => { x[a] = C[a]; }];
          if (alt !== undefined) dd.push(x => { x[a] = alt; });
          dims.push(dd);
          say.push(a === 'rot' ? 'the figure turns ' + turnText(d) : 'the dot moves ' + turnText(d) + ' around the figure');
        } else if (op === 'mir') {
          dims.push([x => { x.mir = C.mir; x.rot = C.rot; }, x => { x.rot = (ans.rot + 4) % 8; }]);
          say.push('the figure is flipped left to right, as in a mirror');
        } else if (op === 'swap') {
          dims.push([x => { x.sh = C.sh; x.inner = C.inner; }]);
          say.push('the outer and inner shapes swap places');
        }
      }
      extraDims(dims, ans, used, sizes);
      // Other defensible readings must never appear among the options.
      const banned = new Set();
      if (has('rot')) { const x = clone(ans); x.rot = B.rot; banned.add(key(x)); }
      if (has('dot')) { for (const v of [B.dot, refl]) { const x = clone(ans); x.dot = v; banned.add(key(x)); } }
      banned.delete(key(ans));
      const wrong = chooseOptions(r, ans, dims, banned);
      if (!wrong) continue;
      const explain = 'From the first figure to the second, ' + say.join('; ') +
        '. Nothing else changes. Apply the same ' + (say.length > 1 ? 'changes' : 'change') + ' to the third figure.';
      return finish(r, 'analogy', [A, B, C], ans, wrong, explain);
    }
    throw new Error('analogy: no puzzle');
  }

  // ---------- series ----------
  function genSeries(r, L) {
    for (let t = 0; t < 400; t++) {
      const chiral = r() < 0.5;
      const pool = chiral ? ['rot', 'dot', 'fill', 'size', 'shape'] : ['dot', 'fill', 'size', 'shape', 'inner'];
      const k = L <= 1 ? 1 : L <= 3 ? 2 : 3;
      const ops = shuffle(r, pool).slice(0, k);
      const has = o => ops.includes(o);
      if (L === 5 && !has('rot') && !has('dot')) continue;
      const withInner = has('inner');
      const sizes = withInner ? [1, 2] : [0, 1, 2];
      const base = randFig(r, { chiral, inner: withInner, dot: has('dot') });
      const steps = L <= 1 ? [2, 6] : L === 2 ? [2, 4, 6] : [1, 2, 3, 5, 6, 7];
      const rules = []; let grown = false, long = false;
      for (const op of ops) {
        if (op === 'rot' || op === 'dot') {
          if (L === 5 && !grown) { grown = long = true; rules.push({ a: op, kind: 'grow', s: pick(r, [1, -1]) }); }
          else rules.push({ a: op, kind: 'step', d: pick(r, steps) });
        } else if (op === 'fill' || op === 'size') {
          const all = op === 'fill' ? [0, 1, 2] : sizes;
          const cyc = L >= 3 && all.length === 3 && r() < 0.7;
          if (cyc) { long = true; rules.push({ a: op, kind: 'cyc', s: pick(r, [1, 2]) }); }
          else rules.push({ a: op, kind: 'alt', b: pick(r, all.filter(v => v !== base[op])) });
        } else if (op === 'shape') {
          rules.push({ a: 'sh', kind: 'alt', b: pick(r, (chiral ? CHIRAL : withInner ? HOLDS_INNER : PLAIN).filter(s => s !== base.sh)) });
        } else {
          rules.push({ a: 'inner', kind: 'alt', b: pick(r, INNER.filter(s => s !== base.inner)) });
        }
      }
      const n = long ? 5 : 4; // figures shown; the answer is figure n+1
      const val = (q, i) => {
        const v0 = base[q.a];
        if (q.kind === 'step') return (v0 + i * q.d) % 8;
        if (q.kind === 'grow') return mod(v0 + q.s * i * (i + 1) / 2, 8);
        if (q.kind === 'cyc') return (v0 + q.s * i) % 3;
        return i % 2 ? q.b : v0;
      };
      const seq = [];
      for (let i = 0; i <= n; i++) { const f = clone(base); for (const q of rules) f[q.a] = val(q, i); seq.push(f); }
      if (seq.some(f => !valid(f))) continue;
      const ans = seq[n], last = seq[n - 1];

      const dims = [], used = {}, say = [];
      for (const q of rules) {
        const a = q.a; used[a] = 1;
        const what = a === 'rot' ? 'the figure turns ' : 'the dot moves ';
        if (q.kind === 'step') {
          const over = (ans[a] + (q.d === 4 ? 2 : q.d)) % 8;
          dims.push([x => { x[a] = last[a]; }, x => { x[a] = over; }]);
          say.push(what + turnText(q.d) + (a === 'dot' ? ' around the figure' : ''));
        } else if (q.kind === 'grow') {
          const same = mod(last[a] + q.s * (n - 1), 8), more = mod(last[a] + q.s * (n + 1), 8);
          dims.push([x => { x[a] = same; }, x => { x[a] = more; }]);
          const dir = q.s > 0 ? 'clockwise' : 'anticlockwise';
          const list = []; for (let i = 1; i < n; i++) list.push(i * 45 + '°');
          say.push(what + dir + (a === 'dot' ? ' around the figure' : '') + ' by a growing amount (' + list.join(', ') +
            '), so the next move is ' + n * 45 + '°');
        } else if (q.kind === 'cyc') {
          dims.push([x => { x[a] = (ans[a] + 1) % 3; }, x => { x[a] = (ans[a] + 2) % 3; }]);
          const names = a === 'fill' ? FILL : SIZE;
          say.push('the ' + a + ' cycles ' + [0, 1, 2].map(i => names[val(q, i)]).join(' → ') + ' and starts again');
        } else {
          const other = ans[a] === q.b ? base[a] : q.b;
          dims.push([x => { x[a] = other; }]);
          const names = a === 'fill' ? FILL : a === 'size' ? SIZE : null;
          const label = a === 'sh' ? 'shape' : a === 'inner' ? 'inner shape' : a;
          say.push('the ' + label + ' alternates between ' + (names ? names[base[a]] : nm(base[a])) + ' and ' + (names ? names[q.b] : nm(q.b)));
        }
      }
      extraDims(dims, ans, used, sizes);
      const wrong = chooseOptions(r, ans, dims, new Set());
      if (!wrong) continue;
      const explain = 'At each step, ' + say.join('; ') + '. Nothing else changes.';
      return finish(r, 'series', seq.slice(0, n), ans, wrong, explain);
    }
    throw new Error('series: no puzzle');
  }

  // ---------- odd one out ----------
  // Gate: on every attribute the five figures must be all equal, split 3/2, all different,
  // or 4/1 with the single one being the intended answer. Two 3/2 splits may disagree on exactly
  // one figure only if that figure is the intended answer. So nothing else can be argued to be "the odd one".
  const ODD_ATTRS = {
    sh: f => f.sh, fill: f => f.fill, size: f => f.size, rot: f => f.rot, mir: f => f.mir, dot: f => f.dot,
    inner: f => f.inner, match: f => (f.inner === null ? '-' : f.inner === f.sh)
  };
  function oddGate(figs, o) {
    const splits = []; let named = false;
    for (const a in ODD_ATTRS) {
      const vals = figs.map(ODD_ATTRS[a]), cnt = new Map();
      vals.forEach(v => cnt.set(v, (cnt.get(v) || 0) + 1));
      const pat = [...cnt.values()].sort((x, y) => y - x).join('');
      if (pat === '5' || pat === '11111') continue;
      if (pat === '32') { splits.push(vals.map(v => cnt.get(v) === 3)); continue; }
      if (pat === '41' && cnt.get(vals[o]) === 1) { named = true; continue; }
      return false;
    }
    for (let i = 0; i < splits.length; i++) for (let j = i + 1; j < splits.length; j++) {
      const both = []; for (let f = 0; f < 5; f++) if (splits[i][f] && splits[j][f]) both.push(f);
      if (both.length === 1) { if (both[0] !== o) return false; named = true; }
    }
    return named;
  }
  function genOdd(r, L) {
    const LABEL = { sh: 'shape', fill: 'fill', size: 'size', rot: 'direction', inner: 'inner shape' };
    const word = (a, v) => a === 'fill' ? FILL[v] : a === 'size' ? SIZE[v] : nm(v);
    const other = (f, a, chiral) => a === 'fill' ? pick(r, [0, 1, 2].filter(v => v !== f.fill))
      : a === 'size' ? pick(r, [0, 1, 2].filter(v => v !== f.size))
      : pick(r, (chiral ? CHIRAL : PLAIN).filter(s => s !== f.sh));
    const split = keep => { // true = minority (2 figures); "keep" is forced into the majority
      for (;;) { const s = shuffle(r, [false, false, false, true, true]); if (keep === undefined || !s[keep]) return s; }
    };
    for (let t = 0; t < 600; t++) {
      const o = ri(r, 5);
      const kind = L <= 2 ? 'attr' : L === 3 ? pick(r, ['mirror', 'inner']) : L === 4 ? pick(r, ['match', 'mirror']) : pick(r, ['pair', 'mirror']);
      let figs, explain;
      if (kind === 'attr') {
        const chiral = r() < 0.5, base = randFig(r, { chiral });
        const a = pick(r, chiral ? ['sh', 'fill', 'size', 'rot'] : ['sh', 'fill', 'size']);
        figs = [0, 1, 2, 3, 4].map(() => clone(base));
        figs[o][a] = a === 'rot' ? (base.rot + pick(r, L === 1 ? [2, 4, 6] : [1, 2, 3, 4, 5, 6, 7])) % 8 : other(base, a, chiral);
        const noise = L === 2 ? shuffle(r, ['sh', 'fill', 'size'].filter(x => x !== a)).slice(0, 1 + ri(r, 2)) : [];
        for (const q of noise) { const v = other(base, q, chiral), s = split(); figs.forEach((f, i) => { if (s[i]) f[q] = v; }); }
        explain = a === 'rot'
          ? 'Four figures point the same way. The odd one is turned ' + turnText(figs[o].rot - base.rot) + '.'
          : 'Four figures share the same ' + LABEL[a] + ' (' + word(a, base[a]) + '). The odd one is ' + (a === 'sh' ? an(nm(figs[o][a])) : word(a, figs[o][a])) + '.';
        if (noise.length) explain += ' The ' + noise.map(q => LABEL[q]).join(' and the ') + (noise.length > 1 ? ' also vary' : ' also varies') + ', but always three against two, so nothing else is singled out.';
      } else if (kind === 'mirror') {
        const base = randFig(r, { chiral: true }), rots = shuffle(r, [0, 1, 2, 3, 4, 5, 6, 7]);
        figs = rots.slice(0, 5).map(q => { const f = clone(base); f.rot = q; return f; });
        figs[o].mir = 1 - base.mir;
        const noise = L === 3 ? [] : L === 4 ? ['fill'] : ['fill', 'size'];
        for (const q of noise) { const v = other(base, q, true), s = split(); figs.forEach((f, i) => { if (s[i]) f[q] = v; }); }
        explain = 'Four figures are the same ' + nm(base.sh) + ' turned to different angles. The odd one is its mirror image: no amount of turning makes it match the others.';
        if (noise.length) explain += ' The ' + noise.map(q => LABEL[q]).join(' and the ') + (noise.length > 1 ? ' vary' : ' varies') + ' three against two, so nothing else is singled out.';
      } else if (kind === 'inner') {
        const outs = shuffle(r, HOLDS_INNER).slice(0, 2), ins = shuffle(r, INNER.filter(s => !outs.includes(s))).slice(0, 2);
        const s1 = split(), s2 = split(), f0 = ri(r, 3), f1 = (f0 + 1 + ri(r, 2)) % 3, size = 1 + ri(r, 2);
        figs = [0, 1, 2, 3, 4].map(i => fig({ sh: outs[+s1[i]], inner: ins[i === o ? 1 : 0], fill: s2[i] ? f1 : f0, size }));
        explain = 'Four figures have ' + an(nm(ins[0])) + ' inside. The odd one has ' + an(nm(ins[1])) + '. The outer shape and the fill vary three against two, so they single nothing out.';
      } else if (kind === 'match') {
        const sh = shuffle(r, SWAPPABLE).slice(0, 2), s1 = split(o), s2 = split();
        const f0 = ri(r, 3), f1 = (f0 + 1 + ri(r, 2)) % 3, size = 1 + ri(r, 2);
        figs = [0, 1, 2, 3, 4].map(i => fig({ sh: sh[+s1[i]], inner: i === o ? sh[1] : sh[+s1[i]], fill: s2[i] ? f1 : f0, size }));
        explain = 'In four figures the inner shape is the same as the outer shape. In the odd one it is different: ' + an(nm(sh[1])) + ' inside ' + an(nm(sh[0])) + '.';
      } else {
        const chiral = r() < 0.5, base = randFig(r, { chiral });
        const [p, q] = pick(r, [['sh', 'fill'], ['sh', 'size'], ['fill', 'size']]);
        const p1 = other(base, p, chiral), q1 = other(base, q, chiral), s = split(o);
        const rots = shuffle(r, [0, 1, 2, 3, 4, 5, 6, 7]);
        figs = [0, 1, 2, 3, 4].map(i => {
          const f = clone(base);
          if (s[i]) { f[p] = p1; f[q] = q1; }
          if (i === o) f[q] = q1;
          if (chiral) f.rot = rots[i];
          return f;
        });
        const ph = (a, v) => a === 'sh' ? 'the ' + nm(v) + ' shape' : 'the ' + word(a, v) + ' ' + a;
        explain = 'Two features go together here. Every figure with ' + ph(p, base[p]) + ' has ' + ph(q, base[q]) +
          ', and every figure with ' + ph(p, p1) + ' has ' + ph(q, q1) + '. The odd one has ' + ph(p, base[p]) + ' but ' + ph(q, q1) + '.' +
          (chiral ? ' The direction is different in all five, so it singles nothing out.' : '');
      }
      if (new Set(figs.map(key)).size < 2 || !oddGate(figs, o)) continue;
      return { form: 'odd', stem: [], options: figs, answer: o, explain };
    }
    throw new Error('odd: no puzzle');
  }

  // ---------- public ----------
  const FORMS = ['analogy', 'series', 'odd'];
  const PROMPT = {
    analogy: 'The first figure is to the second as the third is to which?',
    series: 'Which figure comes next?',
    odd: 'Which figure does not belong?'
  };
  function generate(level, seed) {
    level = Math.min(5, Math.max(1, level | 0)); seed = seed >>> 0;
    const form = FORMS[seed % 3];
    const r = rng((seed ^ Math.imul(level, 0x9E3779B1)) >>> 0);
    const p = form === 'analogy' ? genAnalogy(r, level) : form === 'series' ? genSeries(r, level) : genOdd(r, level);
    p.level = level; p.seed = seed; p.code = 'S' + level + '-' + seed; p.prompt = PROMPT[form];
    return p;
  }
  function parse(code) {
    const m = /^\s*S([1-5])-(\d{1,10})\s*$/i.exec(code || '');
    return m && +m[2] <= 4294967295 ? { level: +m[1], seed: +m[2] } : null;
  }

  // ---------- drawing ----------
  const INK = '#14302D', PAPER = '#FFFFFF';
  const poly = (n, turn) => Array.from({ length: n }, (_, i) => {
    const a = (-90 + (turn || 0) + i * 360 / n) * Math.PI / 180; return [Math.cos(a), Math.sin(a)];
  });
  const scale = (pts, k) => pts.map(p => [p[0] * k, p[1] * k]);
  const UNIT = {
    square: [[-.74, -.74], [.74, -.74], [.74, .74], [-.74, .74]],
    triangle: poly(3), pentagon: poly(5), hexagon: poly(6),
    cross: [[-.32, -1], [.32, -1], [.32, -.32], [1, -.32], [1, .32], [.32, .32], [.32, 1], [-.32, 1], [-.32, .32], [-1, .32], [-1, -.32], [-.32, -.32]],
    star: Array.from({ length: 10 }, (_, i) => { const a = (-90 + i * 36) * Math.PI / 180, k = i % 2 ? .45 : 1; return [k * Math.cos(a), k * Math.sin(a)]; }),
    flag: scale([[-.6, -1], [.75, -1], [.75, -.1], [-.6, -.1]], .84),
    ell: scale([[-.6, -.95], [-.1, -.95], [-.1, .45], [.7, .45], [.7, .95], [-.6, .95]], .92),
    wedge: scale([[-.4, -1], [-.4, .8], [.6, .8]], .97)
  };
  const POLE = scale([[-.6, -1], [-.6, 1]], .84);
  function svg(f) {
    const R = [18, 26, 34][f.size], a = f.rot * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
    const at = (p, k) => { const x = (f.mir ? -p[0] : p[0]) * k, y = p[1] * k; return (50 + x * c - y * s).toFixed(1) + ',' + (50 + x * s + y * c).toFixed(1); };
    const paint = [PAPER, 'url(#ms-stripes)', INK][f.fill];
    const st = ' stroke="' + INK + '" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"';
    const shape = (sh, k, fill) => sh === 'circle'
      ? '<circle cx="50" cy="50" r="' + (k * .94).toFixed(1) + '" fill="' + fill + '"' + st + '/>'
      : '<polygon points="' + UNIT[sh].map(p => at(p, k)).join(' ') + '" fill="' + fill + '"' + st + '/>';
    let out = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>' +
      '<pattern id="ms-stripes" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<rect width="6" height="6" fill="' + PAPER + '"/><rect width="2.6" height="6" fill="' + INK + '"/></pattern></defs>';
    out += shape(f.sh, R, paint);
    if (f.sh === 'flag') out += '<polyline points="' + POLE.map(p => at(p, R)).join(' ') + '" fill="none"' + st + '/>';
    if (f.inner !== null) out += shape(f.inner, R * .4, f.fill === 2 ? PAPER : INK);
    if (f.dot !== null) {
      const d = f.dot * Math.PI / 4;
      out += '<circle cx="' + (50 + 44 * Math.sin(d)).toFixed(1) + '" cy="' + (50 - 44 * Math.cos(d)).toFixed(1) + '" r="4.2" fill="' + INK + '"/>';
    }
    return out + '</svg>';
  }
  // Plain-words description, used as the accessible label of each figure.
  function describe(f) {
    let s = SIZE[f.size] + ' ' + FILL[f.fill] + ' ' + nm(f.sh);
    if (CHIRAL.includes(f.sh)) s += ', turned ' + f.rot * 45 + '°' + (f.mir ? ', mirrored' : '');
    if (f.inner !== null) s += ' with ' + an(nm(f.inner)) + ' inside';
    if (f.dot !== null) s += ', dot at ' + f.dot * 45 + '°';
    return s;
  }

  const API = { generate, parse, svg, describe, key, FORMS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.ShapesEngine = API;
})(typeof self !== 'undefined' ? self : this);
