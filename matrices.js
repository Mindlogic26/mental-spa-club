/* MentalSpa puzzle engine: seeded, procedural 3x3 matrix puzzles. No DOM access. */
(function (root) {
  'use strict';

  // ---------- seeded random ----------
  function makeRng(seed) {
    let a = seed >>> 0;
    const f = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const r = {
      f,
      int: (n) => Math.floor(f() * n),
      pick: (arr) => arr[Math.floor(f() * arr.length)],
      shuffle: (arr) => {
        const x = arr.slice();
        for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); const t = x[i]; x[i] = x[j]; x[j] = t; }
        return x;
      },
      sample: (arr, n) => r.shuffle(arr).slice(0, n)
    };
    return r;
  }
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const sorted = (a) => a.slice().sort((x, y) => x - y);
  const key = (c) => JSON.stringify(c);
  const mod = (a, n) => ((a % n) + n) % n;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const listAnd = (a) => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

  const COLORS = { slate: '#334155', blue: '#2563eb', red: '#dc2626', green: '#16a34a', amber: '#d97706', violet: '#7c3aed' };
  const COLOR_NAMES = Object.keys(COLORS);
  const SYM = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'cross'];
  const ASYM = ['arrow', 'semicircle', 'drop', 'flag'];
  const FILLS = ['empty', 'striped', 'solid'];

  function uniqueOptions(answer, candidates, need) {
    const seen = new Set([key(answer)]);
    const out = [];
    for (const c of candidates) {
      const k = key(c);
      if (seen.has(k)) continue;
      seen.add(k); out.push(c);
      if (out.length === need) break;
    }
    return out;
  }

  // ---------- how the eight options are built ----------
  // The options are always a complete, regular set: every combination of three yes/no changes, or of
  // a four-way and a two-way choice. Each option then stands in exactly the same relation to the
  // other seven, so "pick the one most like the rest" (or least like, or the commonest value of each
  // feature) is no better than chance. Colour is never a rule and never the only difference between
  // two cells: where colour is used to tell things apart, a pattern or a mark says the same thing.
  function cubeOptions(ans, flips) {
    const out = [];
    for (let mask = 1; mask < 8; mask++) { let c = ans; flips.forEach((f, i) => { if (mask >> i & 1) c = f(c); }); out.push(c); }
    return out;
  }
  function productOptions(ans, factors, keep) {
    let combos = [{}];
    for (const f of factors) { const next = []; for (const c of combos) for (const v of f.vals) next.push(Object.assign({}, c, { [f.a]: v })); combos = next; }
    return combos.map((c) => Object.assign({}, ans, c)).filter((c) => key(c) !== key(ans) && (!keep || keep(c)));
  }

  // =====================================================================
  // Family 1: figures with attributes (shape, fill, count, rotation, size)
  // =====================================================================
  const ATTRS = ['shape', 'fill', 'count', 'rot', 'size'];
  function genAttr(r, nRules) {
    let ruled;
    for (;;) {
      ruled = r.sample(ATTRS, nRules);
      if (ruled.includes('count') && ruled.includes('size')) continue;
      break;
    }
    const has = (a) => ruled.includes(a);
    const pool = has('rot') ? ASYM : SYM;
    const rules = {};
    const latin = (vals) => { const k = r.pick([1, 2]); return { kind: 'dist', vals, fn: (row, col) => vals[(col + row * k) % 3] }; };
    if (has('shape')) rules.shape = latin(r.sample(pool, 3));
    if (has('fill')) rules.fill = latin(r.shuffle(FILLS));
    if (has('count')) {
      if (r.f() < 0.6) {
        const up = r.f() < 0.5;
        rules.count = { kind: 'prog', up, fn: (row, col) => up ? 1 + col + row : 5 - col - row };
      } else rules.count = latin(r.sample([1, 2, 3, 4], 3));
    }
    if (has('rot')) {
      const base = 45 * r.int(8), sc = r.pick([45, 90, 135, -45, -90]), sr = r.pick([0, 45, 90]);
      rules.rot = { kind: 'rot', sc, sr, fn: (row, col) => mod(base + sc * col + sr * row, 360) };
    }
    if (has('size')) {
      const vals = r.f() < 0.5 ? [0.5, 0.74, 1] : [1, 0.74, 0.5];
      rules.size = { kind: 'size', grow: vals[0] < vals[2], vals, fn: (row, col) => vals[col] };
    }
    // The colour is picked once per puzzle and is the same in every cell and every option.
    const konst = {
      shape: r.pick(pool), fill: r.pick(FILLS), color: r.pick(COLOR_NAMES),
      count: has('size') ? 1 : (has('rot') ? r.pick([1, 2]) : r.pick([1, 2, 2, 3])),
      rot: 0, size: 1
    };
    const cell = (row, col) => {
      const c = { t: 'fig' };
      for (const a of ['shape', 'fill', 'color', 'count', 'rot', 'size']) c[a] = rules[a] ? rules[a].fn(row, col) : konst[a];
      return c;
    };
    const cells = []; for (let i = 0; i < 9; i++) cells.push(cell(Math.floor(i / 3), i % 3));
    const ans = cells[8];

    // values a wrong option may show in place of the answer's, the most tempting first
    const others = (a) => {
      const v = ans[a];
      if (a === 'shape') return rules.shape ? r.shuffle(rules.shape.vals.filter((x) => x !== v)).concat(r.shuffle(pool.filter((x) => !rules.shape.vals.includes(x)))) : r.shuffle(pool.filter((x) => x !== v));
      if (a === 'fill') return r.shuffle(FILLS.filter((x) => x !== v));
      if (a === 'count' && !rules.count) return v === 2 && !has('rot') ? r.shuffle([1, 3]) : [v === 1 ? 2 : v - 1];
      if (a === 'count') {
        const inRule = rules.count && rules.count.kind === 'dist' ? r.shuffle(rules.count.vals.filter((x) => x !== v)) : [];
        const near = r.shuffle([v - 1, v + 1]).concat(r.shuffle([v - 2, v + 2]), r.shuffle([v - 3, v + 3]), [v - 4, v + 4]);
        return [...new Set(inRule.concat(near))].filter((x) => x >= 1 && x <= 5);
      }
      if (a === 'rot') return [...new Set(r.shuffle([v + rules.rot.sc, v - rules.rot.sc]).concat([v + 180]).map((x) => mod(x, 360)))].filter((x) => x !== v);
      return r.shuffle(rules.size.vals.filter((x) => x !== v));
    };
    const two = (a) => ({ a, vals: [ans[a], others(a)[0]] });
    const four = (a) => ({ a, vals: [ans[a]].concat(others(a).slice(0, 3)) });
    // attributes no rule is about, which a wrong option may still get wrong
    const free = ['shape', 'fill', 'count'].filter((a) => !has(a) && !(a === 'count' && has('size')));
    const wide = r.shuffle(ruled.filter((a) => a === 'shape' || a === 'count' || a === 'rot'));   // have four values to show
    let factors, keep = null;
    if (nRules === 4) {
      // Four rules give 16 combinations; half are kept, chosen so that every rule still matters.
      factors = ruled.map(two);
      let group; do { group = ruled.filter(() => r.f() < 0.5); } while (group.length < 2);
      keep = (c) => group.filter((a) => c[a] !== ans[a]).length % 2 === 0;
    } else if (nRules === 3) factors = ruled.map(two);
    else if (wide.length && r.f() < 0.5) factors = [four(wide[0]), two(nRules === 2 ? ruled.find((a) => a !== wide[0]) : r.pick(free))];
    else factors = ruled.map(two).concat(r.sample(free, 3 - nRules).map(two));
    const distractors = productOptions(ans, factors, keep);

    // explanation
    const ex = [];
    const row3 = (a) => [cells[6][a], cells[7][a]];
    const nm = { shape: 'Shape', fill: 'Fill' };
    for (const a of ['shape', 'fill']) if (rules[a]) {
      const [p, q] = row3(a);
      ex.push(`${nm[a]}: every row and every column contains ${listAnd(rules[a].vals)} exactly once. Row 3 already shows ${p} and ${q}, so the missing one is ${ans[a]}.`);
    }
    if (rules.count) {
      const [p, q] = row3('count');
      if (rules.count.kind === 'prog') ex.push(`Number of figures: it ${rules.count.up ? 'increases' : 'decreases'} by one at each step to the right, and also at each step down. Row 3 goes ${p}, ${q}, so the answer has ${ans.count}.`);
      else ex.push(`Number of figures: every row and every column contains ${listAnd(rules.count.vals.map(String))} exactly once. Row 3 already shows ${p} and ${q}, so the answer has ${ans.count}.`);
    }
    if (rules.rot) {
      const s = rules.rot.sc, d = s > 0 ? 'clockwise' : 'anticlockwise';
      ex.push(`Rotation: the figure turns ${Math.abs(s)}° ${d} at each step to the right` + (rules.rot.sr ? `, and ${rules.rot.sr}° clockwise at each step down.` : '.') + ` Apply one more ${Math.abs(s)}° turn to the middle cell of row 3.`);
    }
    if (rules.size) ex.push(`Size: the figure ${rules.size.grow ? 'grows' : 'shrinks'} from left to right in every row, so the answer is the ${rules.size.grow ? 'largest' : 'smallest'} size.`);
    const fixed = ['shape', 'fill'].filter((a) => !rules[a]).map((a) => nm[a].toLowerCase());
    if (fixed.length) ex.push(`Everything else (${fixed.join(', ')}) stays the same in every cell.`);
    return { cells, ans, distractors, explain: ex, title: nRules === 1 ? 'One changing attribute' : nRules + ' independent attributes' };
  }

  // =====================================================================
  // Family 2: set operations (third cell = first OP second)
  // =====================================================================
  const OPS = {
    or: (A, B) => sorted([...new Set(A.concat(B))]),
    and: (A, B) => sorted(A.filter((x) => B.includes(x))),
    xor: (A, B) => sorted(A.filter((x) => !B.includes(x)).concat(B.filter((x) => !A.includes(x))))
  };
  const OP_TEXT = {
    or: 'the third cell is the first two laid on top of each other: everything from either cell is kept',
    and: 'the third cell keeps only what the first two cells have in common',
    xor: 'the third cell is the first two laid on top of each other, but anything that appears in both cancels out and disappears'
  };
  function setRows(r, op, N, lo, hi) {
    const rows = [];
    for (let i = 0; i < 3; i++) {
      let ok = false;
      for (let t = 0; t < 400 && !ok; t++) {
        const A = sorted(r.sample(range(N), lo + r.int(hi - lo + 1)));
        const B = sorted(r.sample(range(N), lo + r.int(hi - lo + 1)));
        const inter = A.filter((x) => B.includes(x));
        if (!inter.length) continue;
        if (A.every((x) => B.includes(x)) || B.every((x) => A.includes(x))) continue;
        const res = OPS[op](A, B);
        if (!res.length) continue;
        if (rows.some((p) => key(p[0]) === key(A) && key(p[1]) === key(B))) continue;
        rows.push([A, B, res]); ok = true;
      }
      if (!ok) return null;
    }
    return rows;
  }
  // The same, but the answer has at least minAns elements and leaves at least two unused.
  function rowsFor(r, op, N, lo, hi, minAns) {
    for (let t = 0; t < 300; t++) {
      const rows = setRows(r, op, N, lo, hi);
      if (rows && rows[2][2].length >= minAns && N - rows[2][2].length >= 2) return rows;
    }
    return null;
  }
  const flipGroup = (set, g) => sorted(set.filter((x) => !g.includes(x)).concat(g.filter((x) => !set.includes(x))));
  // Groups of elements to switch in a wrong option. plan[i] true: group i is taken out of the answer;
  // false: it is added to it. Where it fits, one group is the slip a solver would really make (using
  // the wrong operation, or copying one of the two cells); the rest are single elements.
  function switchGroups(r, op, A, B, N, plan) {
    const ans = OPS[op](A, B), inter = A.filter((x) => B.includes(x));
    const X = A.filter((x) => !B.includes(x)), Y = B.filter((x) => !A.includes(x));
    const spare = { in: r.shuffle(ans), out: r.shuffle(range(N).filter((e) => !ans.includes(e))) };
    const nIn = plan.filter(Boolean).length, nOut = plan.length - nIn;
    const room = { in: ans.length - 1 - nIn, out: spare.out.length - nOut };
    if (room.in < 0 || room.out < 0) return null;
    const slips = { in: op === 'or' ? [inter, X, Y] : op === 'xor' ? [X, Y] : [], out: op === 'and' ? [X, Y, sorted(X.concat(Y))] : op === 'xor' ? [inter] : [] };
    const groups = plan.map(() => null);
    const big = r.f() < 0.75 ? r.int(plan.length) : -1;
    if (big >= 0) {
      const side = plan[big] ? 'in' : 'out';
      let g = r.shuffle(slips[side]).find((s) => s.length && s.length - 1 <= room[side]);
      if (!g && room[side] >= 1) g = spare[side].slice(0, 2);     // no real slip on this side: a pair of elements instead
      if (g) { groups[big] = sorted(g); spare[side] = spare[side].filter((e) => !g.includes(e)); room[side] -= g.length - 1; }
    }
    plan.forEach((takeOut, i) => { if (!groups[i]) groups[i] = [spare[takeOut ? 'in' : 'out'].shift()]; });
    return groups;
  }
  function genSet(r, op, u) {
    const N = u === 'spokes' ? 8 : u === 'lattice' ? 12 : 9;
    const size = op === 'or' ? [2, 3] : op === 'xor' ? [3, 4] : [3, 5];
    const rows = rowsFor(r, op, N, size[0], size[1], 3);
    if (!rows) return null;
    const color = u === 'cells' ? r.pick(['blue', 'red', 'green', 'violet', 'slate']) : 'slate';
    const mk = (a) => ({ t: 'set', u, c: color, a });
    const cells = []; rows.forEach((p) => p.forEach((s) => cells.push(mk(s))));
    const ans = cells[8];
    const [A, B] = rows[2];
    let groups = null;
    for (let t = 0; t < 60 && !groups; t++) groups = switchGroups(r, op, A, B, N, [r.f() < 0.5, r.f() < 0.5, r.f() < 0.5]);
    if (!groups) return null;
    const distractors = cubeOptions(ans, groups.map((g) => (c) => mk(flipGroup(c.a, g))));
    const what = u === 'cells' ? 'coloured squares' : 'lines';
    const explain = [
      `Read each row from left to right: ${OP_TEXT[op]}.`,
      `Check it on rows 1 and 2 by following the ${what} one at a time rather than looking at the whole figure.`,
      op === 'xor' ? `In row 3, cross out every ${u === 'cells' ? 'square' : 'line'} that the first two cells share; what remains is the answer.`
        : op === 'and' ? `In row 3, keep only the ${what} that appear in both of the first two cells.`
          : `In row 3, combine all the ${what} of the first two cells.`
    ];
    return { cells, ans, distractors, explain, title: { or: 'Overlay', and: 'Common part', xor: 'Overlay with cancelling' }[op] };
  }
  function genLayers(r) {
    const ops = r.sample(['or', 'xor', 'and'], 2);
    const L = rowsFor(r, ops[0], 12, ops[0] === 'and' ? 3 : 2, ops[0] === 'and' ? 5 : 4, 3);
    const D = rowsFor(r, ops[1], 9, 2, ops[1] === 'and' ? 4 : 3, 2);
    if (!L || !D) return null;
    const mk = (a, b) => ({ t: 'layers', a, b });
    const cells = [];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cells.push(mk(L[i][j], D[i][j]));
    const ans = cells[8];
    // three switches: two on one layer and one on the other, so neither layer can be ignored
    const dotsTwo = ans.b.length >= 3 && r.f() < 0.5;
    let gl = null, gd = null;
    for (let t = 0; t < 60 && !(gl && gd); t++) {
      const plan = [r.f() < 0.5, r.f() < 0.5, r.f() < 0.5];
      gl = switchGroups(r, ops[0], L[2][0], L[2][1], 12, dotsTwo ? plan.slice(0, 1) : plan.slice(0, 2));
      gd = switchGroups(r, ops[1], D[2][0], D[2][1], 9, dotsTwo ? plan.slice(1) : plan.slice(2));
    }
    if (!gl || !gd) return null;
    const distractors = cubeOptions(ans, gl.map((g) => (c) => mk(flipGroup(c.a, g), c.b)).concat(gd.map((g) => (c) => mk(c.a, flipGroup(c.b, g)))));
    const explain = [
      'There are two independent layers in every cell: the lines and the dots. Solve them separately.',
      `Lines: ${OP_TEXT[ops[0]]}.`,
      `Dots: ${OP_TEXT[ops[1]]}.`,
      'Work out the lines of the answer first, then the dots, and pick the option that matches both.'
    ];
    return { cells, ans, distractors, explain, title: 'Two layers, two rules' };
  }

  // =====================================================================
  // Family 3: mini-grids (moving markers, growing series)
  // =====================================================================
  function vecText(dx, dy) {
    const p = [];
    if (dx) p.push('one square ' + (dx === 1 ? 'right' : 'left'));
    if (dy) p.push('one square ' + (dy === 1 ? 'down' : 'up'));
    return p.join(' and ');
  }
  function genMarker(r, k) {
    const vecs = []; for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) if (x || y) vecs.push([x, y]);
    for (let t = 0; t < 200; t++) {
      const cols = r.sample(['blue', 'red', 'green', 'amber', 'violet'], k);
      const ms = cols.map((c) => ({ c, x: r.int(3), y: r.int(3), d: k === 1 && r.f() < 0.5 ? [1, 0] : r.pick(vecs), e: k === 1 && r.f() < 0.5 ? [0, 1] : r.pick(vecs) }));
      if (k === 2 && key([ms[0].d, ms[0].e]) === key([ms[1].d, ms[1].e])) continue;
      const pos = (m, row, col) => mod(m.y + col * m.d[1] + row * m.e[1], 3) * 3 + mod(m.x + col * m.d[0] + row * m.e[0], 3);
      // the second square carries a white dot, so the two can be told apart without their colours
      const mk = (ps) => ({ t: 'grid', n: 3, g: [], m: ps.map((p, i) => (i ? { p, c: cols[i], s: 'dot' } : { p, c: cols[i] })) });
      const cells = []; let clash = false;
      for (let i = 0; i < 9; i++) {
        const ps = ms.map((m) => pos(m, Math.floor(i / 3), i % 3));
        if (k === 2 && ps[0] === ps[1]) clash = true;
        cells.push(mk(ps));
      }
      if (clash) continue;
      const ans = cells[8]; const ap = ans.m.map((m) => m.p);
      let distractors;
      if (k === 1) distractors = uniqueOptions(ans, r.shuffle(range(9)).map((p) => mk([p])), 7);
      else {
        // one square is offered in four places and the other in two: all eight pairings are shown
        const spots = r.shuffle(range(9).filter((p) => p !== ap[0] && p !== ap[1])), four = r.int(2);
        const places = [[ap[0]], [ap[1]]];
        places[four] = places[four].concat(spots.slice(0, 3)); places[1 - four] = places[1 - four].concat(spots.slice(3, 4));
        distractors = [];
        for (const a of places[0]) for (const b of places[1]) if (a !== ap[0] || b !== ap[1]) distractors.push(mk([a, b]));
      }
      const name = (m, i) => (k === 1 ? `The ${m.c} square` : i ? `The ${m.c} square with the white dot` : `The plain ${m.c} square`);
      const explain = ms.map((m, i) => `${name(m, i)} moves ${vecText(m.d[0], m.d[1])} at each step to the right, and ${vecText(m.e[0], m.e[1])} at each step down. When it leaves the grid it comes back in on the opposite side.`);
      if (k === 2) explain.unshift('Two squares move independently. Track one at a time: they differ in colour, and one of them carries a white dot.');
      explain.push('Start from the middle cell of row 3 and apply one more step to the right.');
      return { cells, ans, distractors, explain, title: k === 1 ? 'Moving square' : 'Two moving squares' };
    }
    return null;
  }
  function genSeries(r) {
    const step = r.pick([1, 3, 5, 7, 9, 11, 13, 15]), s = r.int(16);
    const path = range(10).map((i) => mod(s + i * step, 16));
    // the newest square is blue and carries a white dot; older ones are plain grey
    const mk = (gray, blue) => ({ t: 'grid', n: 4, g: sorted(gray), m: [{ p: blue, c: 'blue', s: 'dot' }] });
    const cells = range(9).map((i) => mk(path.slice(0, i), path[i]));
    const ans = cells[8];
    const old = path.slice(0, 8);
    const free = r.shuffle(range(16).filter((p) => !path.includes(p)));
    // four places for the new square (the right one, one step too far, two others) and two versions
    // of the trail (the right one, and one with a square lost or a square too many)
    const blues = [path[8], path[9], free[0], free[1]];
    const lost = r.pick(old);
    const trail = r.f() < 0.5 ? old.filter((p) => p !== lost) : old.concat([free[2]]);
    const distractors = [];
    for (const g of [old, trail]) for (const b of blues) if (g !== old || b !== path[8]) distractors.push(mk(g, b));
    const fwd = step <= 8 ? step : 16 - step, dir = step <= 8 ? 'forwards' : 'backwards';
    const explain = [
      'This one is not solved row by row. Read all nine cells as one sequence: left to right, top to bottom.',
      'At each step the blue square (the one with the white dot) turns grey and stays, and a new blue square appears.',
      `The new blue square is always ${fwd} position${fwd > 1 ? 's' : ''} ${dir} in reading order from the previous one, wrapping around the edges of the grid.`,
      'The answer keeps all eight grey squares and adds the next blue one.'
    ];
    return { cells, ans, distractors, explain, title: 'Nine-step series' };
  }

  // =====================================================================
  // Family 4: grids of symbols, one rule per inner position
  // =====================================================================
  // In the coloured version every colour has its own pattern: solid, striped or a dot.
  const TILE_STYLE = { blue: 'solid', slate: 'solid', red: 'striped', violet: 'striped', green: 'dotted', amber: 'dotted' };
  function genPos(r) {
    const mode = r.pick(['shape', 'color']);
    const vals = mode === 'shape' ? ['circle', 'square', 'triangle'] : r.shuffle([r.pick(['blue', 'slate']), r.pick(['red', 'violet']), r.pick(['green', 'amber'])]);
    const per = range(9).map(() => ({ perm: r.shuffle([0, 1, 2]), k: r.pick([1, 2]) }));
    const mk = (v) => ({ t: 'sym', mode, v });
    const cells = range(9).map((i) => mk(per.map((p) => vals[p.perm[(i % 3 + Math.floor(i / 3) * p.k) % 3]])));
    const ans = cells[8];
    // three inner positions, each either right or wrong: all eight combinations
    const spots = r.sample(range(9), 3), wrong = spots.map((q) => r.pick(vals.filter((x) => x !== ans.v[q])));
    const distractors = cubeOptions(ans, spots.map((q, i) => (c) => { const v = c.v.slice(); v[q] = v[q] === ans.v[q] ? wrong[i] : ans.v[q]; return mk(v); }));
    const thing = mode === 'shape' ? 'symbol' : 'square';
    const say = (v) => (mode === 'shape' ? v : TILE_STYLE[v] + ' ' + v);
    const at = (i, p) => say(cells[i].v[p]);
    const rowTxt = (row, p) => [0, 1].map((c) => at(row * 3 + c, p)).join(', ');
    const explain = [
      `Each of the nine big cells contains its own small 3×3 grid. Do not compare whole cells, and ignore the rows inside a small grid. Follow one inner position at a time across the three big cells of a row.`,
      `Example: take just one ${thing} from each big cell, the one in its top-left corner (outlined in green on the board). In the top row of big cells those three ${thing}s are ${at(0, 0)}, ${at(1, 0)}, ${at(2, 0)}; in the middle row they are ${at(3, 0)}, ${at(4, 0)}, ${at(5, 0)}. Each of ${listAnd(vals.map(say))} appears exactly once.`,
      `In the bottom row the two outlined ${thing}s are ${rowTxt(2, 0)}, so the answer must have ${say(ans.v[0])} in its top-left corner.`,
      `The same rule holds for every other inner position, each with its own order. For example, the centre ${thing} in the bottom row is ${rowTxt(2, 4)}, so the answer has ${say(ans.v[4])} in the centre.`,
      'Repeat for all nine positions. The wrong options differ from the answer in only one to three positions, so check each one.'
    ];
    return { cells, ans, distractors, explain, title: 'Nine positions at once', hint: 'pos0' };
  }

  // =====================================================================
  // Family 5: counting (addition, and filled/hollow cancelling)
  // =====================================================================
  // Other simple readings of a row of three numbers. A puzzle is thrown away if one of them fits the
  // first two rows as well and would put a different number in the gap.
  const READINGS = [(a, b) => a + b, (a, b) => a - b, (a, b) => b - a, (a) => 2 * a, (a, b) => 2 * b, (a, b) => a * b,
    (a, b) => Math.max(a, b), (a, b) => Math.min(a, b), (a) => a, (a, b) => b, (a, b) => Math.abs(a - b)];
  const twoReadings = (rows) => READINGS.some((f) => f(rows[0][0], rows[0][1]) === rows[0][2] && f(rows[1][0], rows[1][1]) === rows[1][2] && f(rows[2][0], rows[2][1]) !== rows[2][2]);
  // The options are always the same eight numbers and the answer is equally likely to be any of
  // them, so nothing about the options, or about which numbers tend to come up, helps a guess.
  function genCount(r, signed) {
    const mk = (v) => ({ t: 'dots', f: Math.max(v, 0), h: Math.max(-v, 0) });
    const sub = !signed && r.f() < 0.4;
    const target = signed ? (1 + r.int(4)) * (r.f() < 0.5 ? 1 : -1) : (sub ? 1 : 2) + r.int(8);
    for (let t = 0; t < 300; t++) {
      const rows = [];
      if (!signed) {
        for (let i = 0; i < 2; i++) {
          let a = 1 + r.int(4), b = 1 + r.int(4);
          if (sub) { a = 3 + r.int(5); b = 1 + r.int(a - 1); }
          rows.push([a, b, sub ? a - b : a + b]);
        }
        if (sub) { const b = 1 + r.int(9 - target); rows.push([b + target, b, target]); }
        else { const lo = Math.max(1, target - 6), a = lo + r.int(Math.min(6, target - 1) - lo + 1); rows.push([a, target - a, target]); }
        if (new Set(rows.map(key)).size < 3 || twoReadings(rows)) continue;
        const cells = []; rows.forEach((p) => p.forEach((v) => cells.push(mk(v))));
        const ans = cells[8]; const [a, b, c] = rows[2];
        const distractors = range(8).map((i) => i + (sub ? 1 : 2)).filter((v) => v !== c).map(mk);
        const explain = [
          sub ? 'Count the dots. In every row, the third cell is the first cell minus the second.' : 'Count the dots. In every row, the third cell is the first two added together.',
          `Row 3: ${a} ${sub ? '−' : '+'} ${b} = ${c}. The arrangement of the dots does not matter, only how many there are.`
        ];
        return { cells, ans, distractors, explain, title: sub ? 'Subtraction' : 'Addition' };
      }
      for (let i = 0; i < 2; i++) {
        const a = (1 + r.int(4)) * (r.f() < 0.5 ? 1 : -1), b = (1 + r.int(4)) * (r.f() < 0.5 ? 1 : -1);
        rows.push([a, b, a + b]);
      }
      if (rows.some((p) => p[2] === 0 || Math.abs(p[2]) > 6)) continue;
      if (rows[0][0] * rows[0][1] > 0 && rows[1][0] * rows[1][1] > 0) continue;
      if (!rows.some((p) => p[2] < 0) || !rows.some((p) => p[2] > 0)) continue;
      // row 3 always mixes filled and hollow; its result is equally likely to be any of -4..-1, 1..4
      const size = Math.abs(target), sign = target > 0 ? 1 : -1, extra = 1 + r.int(6 - size);
      const pair = [sign * (size + extra), -sign * extra];
      if (r.f() < 0.5) pair.reverse();
      rows.push([pair[0], pair[1], sign * size]);
      if (twoReadings(rows)) continue;
      const cells = []; rows.forEach((p) => p.forEach((v) => cells.push(mk(v))));
      const ans = cells[8]; const [a, b, c] = rows[2];
      const distractors = [-4, -3, -2, -1, 1, 2, 3, 4].filter((v) => v !== c).map(mk);
      const say = (v) => Math.abs(v) + (v > 0 ? ' filled' : ' hollow');
      const explain = [
        'Filled dots and hollow dots are opposites: one filled dot cancels one hollow dot.',
        'In every row, put the dots of the first two cells together, remove filled/hollow pairs, and what is left is the third cell.',
        `Row 3: ${say(a)} and ${say(b)} leave ${say(c)}.`
      ];
      return { cells, ans, distractors, explain, title: 'Filled cancels hollow' };
    }
    return null;
  }

  // ---------- tiers ----------
  const KINDS = {
    1: [[3, (r) => genAttr(r, 1)], [2, (r) => genMarker(r, 1)], [1, (r) => genCount(r, false)]],
    2: [[3, (r) => genAttr(r, 2)], [2, (r) => genSet(r, 'or', r.pick(['spokes', 'lattice', 'cells']))], [2, (r) => genSeries(r)]],
    3: [[3, (r) => genAttr(r, 3)], [2, (r) => genMarker(r, 2)], [2, (r) => genSet(r, 'and', r.pick(['spokes', 'lattice', 'cells']))]],
    4: [[2, (r) => genAttr(r, 4)], [3, (r) => genSet(r, 'xor', r.pick(['spokes', 'lattice', 'cells']))], [2, (r) => genCount(r, true)]],
    5: [[1, (r) => genLayers(r)], [1, (r) => genPos(r)]]
  };
  function generate(seed, tier) {
    const r = makeRng(seed);
    const list = KINDS[tier];
    const total = list.reduce((s, x) => s + x[0], 0);
    for (let attempt = 0; attempt < 60; attempt++) {
      let w = r.f() * total, gen = list[0][1];
      for (const [wt, g] of list) { if (w < wt) { gen = g; break; } w -= wt; }
      const p = gen(r);
      if (!p || p.distractors.length !== 7) continue;
      const opts = r.shuffle([p.ans].concat(p.distractors));
      const ak = key(p.ans);
      return { seed, tier, title: p.title, cells: p.cells.slice(0, 8), options: opts, answer: opts.findIndex((o) => key(o) === ak), explain: p.explain, hint: p.hint || null };
    }
    throw new Error('Could not generate puzzle for seed ' + seed);
  }

  // =====================================================================
  // Rendering: every cell is drawn in a 100x100 box, returns SVG markup
  // =====================================================================
  const n2 = (x) => Math.round(x * 100) / 100;
  function poly(pts, s) { return 'M' + pts.map((p) => n2(p[0] * s) + ' ' + n2(p[1] * s)).join('L') + 'Z'; }
  function shapePath(name, s) {
    switch (name) {
      case 'circle': return `M${-s} 0A${s} ${s} 0 1 0 ${s} 0A${s} ${s} 0 1 0 ${-s} 0Z`;
      case 'square': return poly([[-0.86, -0.86], [0.86, -0.86], [0.86, 0.86], [-0.86, 0.86]], s);
      case 'triangle': return poly([[0, -1], [0.95, 0.78], [-0.95, 0.78]], s);
      case 'diamond': return poly([[0, -1.05], [0.78, 0], [0, 1.05], [-0.78, 0]], s);
      case 'pentagon': return poly(range(5).map((i) => [Math.sin(i * 2 * Math.PI / 5), -Math.cos(i * 2 * Math.PI / 5)]), s * 1.02);
      case 'cross': { const a = 0.34; return poly([[-a, -1], [a, -1], [a, -a], [1, -a], [1, a], [a, a], [a, 1], [-a, 1], [-a, a], [-1, a], [-1, -a], [-a, -a]], s); }
      case 'arrow': return poly([[0, -1], [0.85, 0.05], [0.32, 0.05], [0.32, 1], [-0.32, 1], [-0.32, 0.05], [-0.85, 0.05]], s);
      case 'semicircle': return `M${-s} ${n2(0.4 * s)}A${s} ${s} 0 0 1 ${s} ${n2(0.4 * s)}Z`;
      case 'drop': return `M0 ${-s}C${n2(0.95 * s)} ${n2(0.1 * s)} ${n2(0.8 * s)} ${s} 0 ${s}C${n2(-0.8 * s)} ${s} ${n2(-0.95 * s)} ${n2(0.1 * s)} 0 ${-s}Z`;
      case 'flag': return poly([[-0.62, -1], [0.85, -0.45], [-0.3, 0.05], [-0.3, 1], [-0.62, 1]], s);
    }
    return '';
  }
  const LAYOUT = {
    1: [30, [[50, 50]]], 2: [17, [[29, 50], [71, 50]]], 3: [16, [[50, 28], [27, 70], [73, 70]]],
    4: [15, [[29, 29], [71, 29], [29, 71], [71, 71]]], 5: [12.5, [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]]]
  };
  function renderFig(c) {
    const [s0, pts] = LAYOUT[c.count]; const s = s0 * c.size; const col = COLORS[c.color];
    const fill = c.fill === 'solid' ? col : c.fill === 'striped' ? `url(#ms-hatch-${c.color})` : '#fff';
    const d = shapePath(c.shape, s);
    return pts.map((p) => `<path d="${d}" transform="translate(${p[0]} ${p[1]}) rotate(${c.rot})" fill="${fill}" stroke="${col}" stroke-width="2.6" stroke-linejoin="round"/>`).join('');
  }
  const NODE = [22, 50, 78];
  function latticeSeg(i) {
    if (i < 6) { const rr = Math.floor(i / 2), cc = i % 2; return [NODE[cc], NODE[rr], NODE[cc + 1], NODE[rr]]; }
    const j = i - 6, rr = Math.floor(j / 3), cc = j % 3; return [NODE[cc], NODE[rr], NODE[cc], NODE[rr + 1]];
  }
  const line = (x1, y1, x2, y2, col, w) => `<line x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  function nodeDots() { let s = ''; for (const y of NODE) for (const x of NODE) s += `<circle cx="${x}" cy="${y}" r="1.6" fill="#cbd5e1"/>`; return s; }
  // fills: [position, colour, style]. Style 'dot' adds a white dot to a filled square, 'striped'
  // hatches it, and 'dotted' leaves the square white with a coloured disc in it.
  function miniGrid(n, fills) {
    const a = 14, w = 72 / n; let s = '';
    for (const [p, col, style, name] of fills) {
      const x = a + (p % n) * w, y = a + Math.floor(p / n) * w;
      if (style === 'dotted') { s += `<circle cx="${n2(x + w / 2)}" cy="${n2(y + w / 2)}" r="${n2(w * 0.3)}" fill="${col}"/>`; continue; }
      s += `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(w)}" fill="${style === 'striped' ? `url(#ms-hatch-${name})` : col}"/>`;
      if (style === 'dot') s += `<circle cx="${n2(x + w / 2)}" cy="${n2(y + w / 2)}" r="${n2(w * 0.2)}" fill="#fff"/>`;
    }
    for (let i = 0; i <= n; i++) { const q = n2(a + i * w); s += `<path d="M${a} ${q}H${a + 72}M${q} ${a}V${a + 72}" stroke="#475569" stroke-width="1.4" fill="none"/>`; }
    return s;
  }
  function renderSet(c) {
    if (c.u === 'cells') return miniGrid(3, c.a.map((p) => [p, COLORS[c.c]]));
    if (c.u === 'spokes') {
      return c.a.map((i) => { const t = i * Math.PI / 4; return line(50, 50, 50 + 34 * Math.sin(t), 50 - 34 * Math.cos(t), COLORS.slate, 3.4); }).join('') + '<circle cx="50" cy="50" r="3.2" fill="#334155"/>';
    }
    return nodeDots() + c.a.map((i) => { const q = latticeSeg(i); return line(q[0], q[1], q[2], q[3], COLORS.slate, 3.6); }).join('');
  }
  function renderLayers(c) {
    return nodeDots() + c.a.map((i) => { const q = latticeSeg(i); return line(q[0], q[1], q[2], q[3], COLORS.slate, 3.4); }).join('')
      + c.b.map((p) => `<circle cx="${NODE[p % 3]}" cy="${NODE[Math.floor(p / 3)]}" r="6.2" fill="${COLORS.red}" stroke="#fff" stroke-width="1.5"/>`).join('');
  }
  function renderSym(c) {
    let s = miniGrid(3, c.mode === 'color' ? c.v.map((v, p) => [p, COLORS[v], TILE_STYLE[v], v]) : []);
    if (c.mode === 'shape') c.v.forEach((v, p) => {
      const x = 14 + 12 + (p % 3) * 24, y = 14 + 12 + Math.floor(p / 3) * 24;
      s += `<path d="${shapePath(v, 7.4)}" transform="translate(${x} ${y + (v === 'triangle' ? 0.8 : 0)})" fill="${v === 'circle' ? '#fff' : v === 'square' ? COLORS.slate : COLORS.amber}" stroke="#334155" stroke-width="1.8" stroke-linejoin="round"/>`;
    });
    return s;
  }
  function renderDots(c) {
    const n = c.f + c.h; let s = '';
    const perRow = n <= 4 ? 2 : 3, rowsN = Math.ceil(n / perRow), gap = 24;
    for (let i = 0; i < n; i++) {
      const rr = Math.floor(i / perRow), inRow = Math.min(perRow, n - rr * perRow), cc = i - rr * perRow;
      const x = 50 + (cc - (inRow - 1) / 2) * gap, y = 50 + (rr - (rowsN - 1) / 2) * gap;
      s += `<circle cx="${n2(x)}" cy="${n2(y)}" r="8.4" fill="${i < c.f ? COLORS.slate : '#fff'}" stroke="${COLORS.slate}" stroke-width="2.6"/>`;
    }
    return s;
  }
  function renderCell(c) {
    switch (c.t) {
      case 'fig': return renderFig(c);
      case 'set': return renderSet(c);
      case 'layers': return renderLayers(c);
      case 'grid': return miniGrid(c.n, c.g.map((p) => [p, '#94a3b8']).concat(c.m.map((m) => [m.p, COLORS[m.c], m.s])));
      case 'sym': return renderSym(c);
      case 'dots': return renderDots(c);
    }
    return '';
  }
  function hatchDefs() {
    return COLOR_NAMES.map((n) => `<pattern id="ms-hatch-${n}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#fff"/><rect width="2.2" height="5" fill="${COLORS[n]}"/></pattern>`).join('');
  }

  // VERSION changes whenever the same code would give a different puzzle, so saved answers from an
  // older engine are not read against new puzzles.
  const api = { generate, renderCell, hatchDefs, key, TIERS: [1, 2, 3, 4, 5], VERSION: 2 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MentalSpaEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
