/* MentalSpa numbers engine: seeded number sequences and number grids.
   Same public shape as the matrix engine: generate(seed, tier), renderCell(cell), TIERS. */
(function (root) {
  'use strict';

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
      range: (lo, hi) => lo + Math.floor(f() * (hi - lo + 1)),
      pick: (arr) => arr[Math.floor(f() * arr.length)],
      sign: () => (f() < 0.5 ? -1 : 1),
      shuffle: (arr) => {
        const x = arr.slice();
        for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); const t = x[i]; x[i] = x[j]; x[j] = t; }
        return x;
      }
    };
    return r;
  }
  const isInt = (x) => Number.isInteger(x);
  const allEqual = (a) => a.every((x) => x === a[0]);
  const diffs = (t) => t.slice(1).map((x, i) => x - t[i]);
  const uniq = (a) => [...new Set(a)];
  const ord = (n) => ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'][n];

  // =====================================================================
  // Sequences: a library of fitters. Each takes the visible terms and
  // returns the next term it would predict, or null if it does not fit.
  // A puzzle is only kept when every fitter that fits agrees on the answer.
  // =====================================================================
  function fitSub(t) {
    if (t.length < 3) return null;
    const d = diffs(t);
    if (allEqual(d)) return t[t.length - 1] + d[0];
    if (t.every((x) => x !== 0)) {
      const r = t[1] / t[0];
      if (isInt(r) && Math.abs(r) >= 2 && t.every((x, i) => i === 0 || x === t[i - 1] * r)) return t[t.length - 1] * r;
    }
    return null;
  }
  const SEQ_FIT = {
    arith: (t) => { const d = diffs(t); return allEqual(d) ? t[t.length - 1] + d[0] : null; },
    geom: (t) => {
      if (t.some((x) => x === 0)) return null;
      const r = t[1] / t[0];
      if (!isInt(r) || Math.abs(r) < 2) return null;
      for (let i = 1; i < t.length; i++) if (t[i] !== t[i - 1] * r) return null;
      return t[t.length - 1] * r;
    },
    quad: (t) => {
      const d = diffs(t); if (d.length < 3) return null;
      const dd = diffs(d); if (!allEqual(dd) || dd[0] === 0) return null;
      return t[t.length - 1] + d[d.length - 1] + dd[0];
    },
    fib: (t) => {
      if (t.length < 4) return null;
      for (let i = 2; i < t.length; i++) if (t[i] !== t[i - 1] + t[i - 2]) return null;
      return t[t.length - 1] + t[t.length - 2];
    },
    linrec: (t) => {
      if (t[1] - t[0] === 0) return null;
      const r = (t[2] - t[1]) / (t[1] - t[0]);
      if (!isInt(r) || r === 1 || r === 0 || Math.abs(r) > 6) return null;
      const d = t[1] - r * t[0];
      if (d === 0) return null;
      for (let i = 1; i < t.length; i++) if (t[i] !== r * t[i - 1] + d) return null;
      return r * t[t.length - 1] + d;
    },
    inter: (t) => {
      const a = t.filter((_, i) => i % 2 === 0), b = t.filter((_, i) => i % 2 === 1);
      if (a.length < 3 || b.length < 3) return null;
      const fa = fitSub(a), fb = fitSub(b);
      if (fa === null || fb === null) return null;
      return t.length % 2 === 0 ? fa : fb;
    },
    altop: (t) => {
      if (t.length < 5) return null;
      const out = [];
      for (const ph of [0, 1]) {
        let add, mul;
        if (ph === 0) { add = t[1] - t[0]; if (t[1] === 0) continue; mul = t[2] / t[1]; }
        else { if (t[0] === 0) continue; mul = t[1] / t[0]; add = t[2] - t[1]; }
        if (add === 0 || !isInt(mul) || Math.abs(mul) < 2) continue;
        let ok = true;
        for (let i = 0; i < t.length - 1; i++) {
          const want = (i + ph) % 2 === 0 ? t[i] + add : t[i] * mul;
          if (t[i + 1] !== want) { ok = false; break; }
        }
        if (!ok) continue;
        const i = t.length - 1;
        out.push((i + ph) % 2 === 0 ? t[i] + add : t[i] * mul);
      }
      return out.length ? out : null;
    }
  };
  function seqPredictions(t) {
    const out = [];
    for (const k in SEQ_FIT) {
      const v = SEQ_FIT[k](t);
      if (v === null) continue;
      for (const x of (Array.isArray(v) ? v : [v])) if (isInt(x)) out.push(x);
    }
    return out;
  }
  // The gate: exactly one distinct predicted value across every fitter that fits.
  function seqUnique(t, want) {
    const vals = uniq(seqPredictions(t));
    return vals.length === 1 && vals[0] === want;
  }

  // Which values could fill position k of the series, according to any rule?
  // A full series is "explained" when some rule, given all terms but the last, predicts the last.
  function explained(full) {
    const pre = full.slice(0, -1), last = full[full.length - 1];
    if (pre.length < 3) return false;
    return seqPredictions(pre).indexOf(last) >= 0;
  }
  function valuesAt(full, k, want) {
    if (k === full.length - 1) return uniq(seqPredictions(full.slice(0, -1)));
    const out = [];
    for (let v = want - 400; v <= want + 400; v++) { const c = full.slice(); c[k] = v; if (explained(c)) out.push(v); }
    return out;
  }
  const uniqueAt = (full, k) => { const v = valuesAt(full, k, full[k]); return v.length === 1 && v[0] === full[k]; };

  const SEQ_TEXT = {
    arith: (p) => `Each term is ${Math.abs(p.d)} ${p.d > 0 ? 'more' : 'less'} than the one before it.`,
    geom: (p) => `Each term is the one before it multiplied by ${p.r}.`,
    quad: (p) => `The gaps between the terms are not equal. Look at the gaps themselves: each gap is ${Math.abs(p.dd)} ${p.dd > 0 ? 'bigger' : 'smaller'} than the one before.`,
    fib: () => 'Each term is the sum of the two terms before it.',
    linrec: (p) => `Each term is the one before it multiplied by ${p.r}, then ${p.d > 0 ? 'plus ' + p.d : 'minus ' + Math.abs(p.d)}.`,
    inter: (p) => `Two series are interleaved. Read every other term: one series ${p.d1 > 0 ? 'goes up' : 'goes down'} by ${Math.abs(p.d1)}, the other ${p.d2 > 0 ? 'goes up' : 'goes down'} by ${Math.abs(p.d2)}.`,
    altop: (p) => { const a = p.add > 0 ? 'add ' + p.add : 'subtract ' + Math.abs(p.add), m = 'multiply by ' + p.mul; const f = p.ph === 0 ? a : m, g = p.ph === 0 ? m : a; return `The operation alternates: ${f}, then ${g}, then ${f} again, and so on.`; }
  };

  const MAXLEN = 9;
  function rawSeries(r, kind) {
    const N = MAXLEN + 1; let t = [], p = {};
    if (kind === 'arith') {
      p.d = r.pick([2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 15, -3, -4, -5, -6, -7]);
      let x = p.d > 0 ? r.range(1, 20) : r.range(70, 99);
      for (let i = 0; i < N; i++) { t.push(x); x += p.d; }
    } else if (kind === 'geom') {
      p.r = r.pick([2, 2, 3, 3, 4, 5]);
      let x = r.range(1, p.r === 2 ? 9 : 5);
      for (let i = 0; i < N; i++) { t.push(x); x *= p.r; }
    } else if (kind === 'quad') {
      p.dd = r.pick([1, 2, 2, 3, 4, 5, -2, -3]);
      let g = p.dd > 0 ? r.range(1, 8) : r.range(20, 30), x = r.range(1, 12);
      for (let i = 0; i < N; i++) { t.push(x); x += g; g += p.dd; }
    } else if (kind === 'fib') {
      const a = r.range(1, 6), b = r.range(a, a + 7);
      t = [a, b];
      for (let i = 2; i < N; i++) t.push(t[i - 1] + t[i - 2]);
    } else if (kind === 'linrec') {
      p.r = r.pick([2, 2, 3, -2]);
      p.d = r.pick([1, 2, 3, 4, 5, -1, -2, -3]);
      let x = r.range(1, 7);
      for (let i = 0; i < N; i++) { t.push(x); x = p.r * x + p.d; }
    } else if (kind === 'inter') {
      p.d1 = r.pick([2, 3, 4, 5, 6, 7, -3, -4]); p.d2 = r.pick([2, 3, 5, 6, 8, 9, 10, -5]);
      if (p.d1 === p.d2) return null;
      let a = r.range(1, 15), b = r.range(30, 60);
      for (let i = 0; i < N; i++) { if (i % 2 === 0) { t.push(a); a += p.d1; } else { t.push(b); b += p.d2; } }
    } else if (kind === 'altop') {
      p.add = r.pick([2, 3, 4, 5, -2, -3]);
      p.mul = r.pick([2, 2, 3]);
      p.ph = r.int(2);
      let x = r.range(2, 9);
      for (let i = 0; i < N; i++) { t.push(x); x = (i + p.ph) % 2 === 0 ? x + p.add : x * p.mul; }
    }
    return { t, p };
  }
  // wrong answers a real solver could reach: a half-applied rule, a repeated jump, the wrong operation
  function seqErrors(kind, p, full, k) {
    const L = full.length, want = full[k], e = [];
    const left = full[k - 1], left2 = full[k - 2];
    if (k === L - 1) {
      e.push(left + (left - left2));                       // repeated the last jump
      if (kind === 'arith') e.push(left + 2 * p.d, left + p.d + (p.d > 0 ? 1 : -1));
      if (kind === 'geom') e.push(left * p.r - left2, left * (p.r + 1), left + p.r);
      if (kind === 'quad') e.push(left + (left - left2) + 2 * p.dd, left + (left - left2) - p.dd);
      if (kind === 'fib') e.push(left * 2, left + left2 + full[k - 3], left + full[k - 3]);
      if (kind === 'linrec') e.push(p.r * left, left + p.d, p.r * left - p.d, p.r * (left + p.d));
      if (kind === 'inter') { const own = k % 2 === 0 ? p.d1 : p.d2, other = k % 2 === 0 ? p.d2 : p.d1; e.push(left + own, left + other, left2 + other, left2 + 2 * own); }
      if (kind === 'altop') { const isAdd = (k - 1 + p.ph) % 2 === 0; e.push(isAdd ? left * p.mul : left + p.add, isAdd ? left + 2 * p.add : left * p.mul * p.mul, left + (left - left2)); }
    } else {
      const right = full[k + 1];
      if ((left + right) % 2 === 0) e.push((left + right) / 2);   // split the difference
      e.push(left + (left - left2), right - (full[k + 2] !== undefined ? full[k + 2] - right : left - left2));
      if (kind === 'geom' || kind === 'linrec' || kind === 'altop') e.push(left + right, right - left);
      if (kind === 'fib') e.push(right - left2, left + left2 + 1, right - left + left2);
      if (kind === 'inter') { const other = k % 2 === 0 ? p.d2 : p.d1; e.push(left + other, right - other, left2 + other); }
      if (kind === 'quad') e.push(left + (left - left2) + 2 * p.dd, left + (left - left2) - p.dd);
    }
    return e.filter((v) => isInt(v) && v !== want);
  }
  // Options are shown in ascending order, so where the answer falls among them must give nothing away.
  // Its place (smallest, second, ... largest) is drawn first, each equally likely; then that many
  // wrong options are taken below it and the rest above. Real slips are used first, on whichever side
  // they fall. The remaining ones are spread out from the options already chosen, not packed round
  // the answer, so the answer is not the number with the most close neighbours either.
  function pickOptions(want, errors, r, allowNeg) {
    const band = Math.abs(want) + 20, floor = allowNeg || want < 0 ? want - band : 0;
    const rank = r.int(Math.min(4, want - floor) + 1);
    const need = { lo: rank, hi: 4 - rank }, got = { lo: [], hi: [] }, seen = new Set([want]);
    const ok = (v) => isInt(v) && !seen.has(v) && v >= floor && v >= want - band && v <= want + band;
    for (const v of errors) {
      const side = v < want ? 'lo' : 'hi';
      if (ok(v) && got[side].length < need[side]) { seen.add(v); got[side].push(v); }
    }
    const span = Math.max(6, Math.round(Math.abs(want) * 0.15));
    for (const side of ['lo', 'hi']) {
      const dir = side === 'lo' ? -1 : 1;
      for (let guard = 0; got[side].length < need[side] && guard < 200; guard++) {
        const edge = got[side].reduce((e, v) => (dir * v > dir * e ? v : e), want);
        let v = edge + dir * r.range(1, span);                                   // beyond the furthest so far
        if (guard % 2 || !ok(v)) v = want + dir * r.range(1, Math.max(2, Math.abs(edge - want) + 2));   // or somewhere in between
        if (ok(v)) { seen.add(v); got[side].push(v); }
      }
      if (got[side].length < need[side]) return null;
    }
    return got.lo.concat(got.hi);
  }

  function genSeq(r, kind, typed) {
    for (let attempt = 0; attempt < 160; attempt++) {
      const raw = rawSeries(r, kind); if (!raw) continue;
      const { t, p } = raw;
      if (t.slice(0, MAXLEN).some((x) => x < -300 || x > 9999)) { /* long tails get cut below */ }
      // shortest series whose next term is forced, then one more term as confirmation
      let L = 0;
      for (let n = 4; n <= MAXLEN; n++) { if (uniqueAt(t.slice(0, n), n - 1)) { L = n; break; } }
      if (!L) continue;
      L = Math.min(L + 1, MAXLEN);
      while (L <= MAXLEN && !uniqueAt(t.slice(0, L), L - 1)) L++;
      if (L > MAXLEN) continue;
      const full = t.slice(0, L);
      if (full.some((x) => x < -300 || x > 9999) || uniq(full).length < L - 1) continue;
      // the gap is at the end, or (about one time in three) somewhere inside
      let k = L - 1;
      if (L >= 6 && r.f() < 0.36) { const kk = r.range(2, L - 3); if (uniqueAt(full, kk)) k = kk; }
      const want = full[k];
      const opts = typed ? [] : pickOptions(want, seqErrors(kind, p, full, k), r, full.some((x) => x < 0));
      if (!typed && !opts) continue;
      const visible = full.filter((_, i) => i !== k);
      const where = k === L - 1
        ? `The last term shown is ${full[k - 1]}, so the next one is ${want}.`
        : `Only ${want} fits the gap: it follows from ${full[k - 1]} before it and leads on to ${full[k + 1]} after it.`;
      return {
        layout: 'strip', gap: k, cells: visible.map((v) => ({ t: 'num', v })), ans: { t: 'num', v: want },
        distractors: opts.map((v) => ({ t: 'num', v })), typed: !!typed, title: 'Number series',
        explain: ['Read the row from left to right and work out what turns each term into the next one.', SEQ_TEXT[kind](p), where]
      };
    }
    return null;
  }

  // =====================================================================
  // Number grids: 3x3, bottom-right missing. Rules act on triples, either
  // along rows or down columns. Same uniqueness gate.
  // =====================================================================
  const TRIPLE = [
    { k: 'sum', par: false, holds: (x) => x[2] === x[0] + x[1], pred: (a, b) => a + b, text: 'the third is the first two added together' },
    { k: 'diff', par: false, holds: (x) => x[2] === x[0] - x[1], pred: (a, b) => a - b, text: 'the third is the first minus the second' },
    { k: 'prod', par: false, holds: (x) => x[2] === x[0] * x[1], pred: (a, b) => a * b, text: 'the third is the first two multiplied' },
    { k: 'half', par: false, holds: (x) => x[2] * 2 === x[0] + x[1], pred: (a, b) => (a + b) / 2, text: 'the third is halfway between the first two' },
    { k: 'arith', par: false, holds: (x) => x[1] - x[0] === x[2] - x[1], pred: (a, b) => b + (b - a), text: 'the three numbers go up (or down) in equal steps' },
    { k: 'sumk', par: (x) => x[2] - (x[0] + x[1]), holds: (x, p) => x[2] === x[0] + x[1] + p, pred: (a, b, p) => a + b + p, text: (p) => `the third is the first two added together, ${p > 0 ? 'plus ' + p : 'minus ' + Math.abs(p)}` },
    { k: 'prodk', par: (x) => x[2] - x[0] * x[1], holds: (x, p) => x[2] === x[0] * x[1] + p, pred: (a, b, p) => a * b + p, text: (p) => `the third is the first two multiplied, ${p > 0 ? 'plus ' + p : 'minus ' + Math.abs(p)}` },
    { k: 'total', par: (x) => x[0] + x[1] + x[2], holds: (x, p) => x[0] + x[1] + x[2] === p, pred: (a, b, p) => p - a - b, text: (p) => `the three numbers always add up to ${p}` }
  ];
  function tripleFits(t1, t2) {
    const out = [];
    for (const R of TRIPLE) {
      if (R.par) {
        const p = R.par(t1);
        if (!isInt(p)) continue;
        if (R.k === 'sumk' && p === 0) continue;
        if (R.k === 'prodk' && p === 0) continue;
        if (R.holds(t1, p) && R.holds(t2, p)) out.push({ R, p });
      } else if (R.holds(t1) && R.holds(t2)) out.push({ R, p: null });
    }
    return out;
  }
  function gridPredictions(g) {
    // g: array of 9, index 8 unknown (null)
    const rows = [[g[0], g[1], g[2]], [g[3], g[4], g[5]]];
    const cols = [[g[0], g[3], g[6]], [g[1], g[4], g[7]]];
    const out = [];
    for (const f of tripleFits(rows[0], rows[1])) out.push({ how: 'row', fit: f, v: f.R.pred(g[6], g[7], f.p) });
    for (const f of tripleFits(cols[0], cols[1])) out.push({ how: 'column', fit: f, v: f.R.pred(g[2], g[5], f.p) });
    return out.filter((x) => isInt(x.v));
  }

  function genGrid(r, kind, orient, typed) {
    for (let attempt = 0; attempt < 150; attempt++) {
      const R = TRIPLE.find((x) => x.k === kind);
      const g = new Array(9).fill(0);
      const put = (i, j, v) => { g[orient === 'row' ? i * 3 + j : j * 3 + i] = v; };
      let par = null;
      if (kind === 'sumk') par = r.pick([1, 2, 3, 4, 5, -1, -2, -3]);
      if (kind === 'prodk') par = r.pick([1, 2, 3, 5, 10, -1, -2]);
      if (kind === 'total') par = r.range(20, 60);
      let bad = false;
      for (let i = 0; i < 3 && !bad; i++) {
        let a, b, c;
        for (let k = 0; ; k++) {
          if (k > 60) { bad = true; break; }
          if (kind === 'prod' || kind === 'prodk') { a = r.range(2, 9); b = r.range(2, 9); }
          else if (kind === 'diff') { a = r.range(10, 40); b = r.range(2, a - 2); }
          else if (kind === 'half') { a = r.range(2, 30); b = a + 2 * r.range(1, 12) * r.sign(); }
          else if (kind === 'arith') { a = r.range(1, 20); b = a + r.pick([2, 3, 4, 5, 6, 7, 8, -3, -4, -5]); }
          else if (kind === 'total') { a = r.range(2, par - 10); b = r.range(2, par - a - 2); }
          else { a = r.range(2, 25); b = r.range(2, 25); }
          c = R.pred(a, b, par);
          if (!isInt(c) || c < 0 || c > 999 || a < 0 || b < 0) continue;
          if (kind !== 'total' && (a === b || b === c || a === c)) continue;
          break;
        }
        if (bad) break;
        put(i, 0, a); put(i, 1, b); put(i, 2, c);
      }
      if (bad) continue;
      const want = g[8];
      const known = g.slice(0, 8);
      if (uniq(known).length < 6) continue;
      if (known.includes(want) && uniq(known.concat([want])).length < 7) continue;
      const probe = known.concat([null]);
      const preds = gridPredictions(probe);
      const vals = uniq(preds.map((x) => x.v));
      if (vals.length !== 1 || vals[0] !== want) continue;
      const mine = preds.find((x) => x.fit.R.k === kind && x.how === orient) || preds[0];

      const pa = orient === 'row' ? g[6] : g[2], pb = orient === 'row' ? g[7] : g[5];   // the pair the rule applies to
      const qa = orient === 'row' ? g[2] : g[6], qb = orient === 'row' ? g[5] : g[7];   // the pair of the other direction
      const errs = [pa + pb, pa * pb, pa - pb, pb - pa, R.pred(qa, qb, par), pb + (pb - pa), (pa + pb) / 2,
        par !== null && kind !== 'total' ? want - 2 * par : want + (pb - pa), pa + pb + 1].filter((v) => isInt(v) && v !== want);
      const picked = typed ? [] : pickOptions(want, errs, r, false);
      if (!typed && !picked) continue;

      const dir = orient === 'row' ? 'row, left to right' : 'column, top to bottom';
      const rule = typeof mine.fit.R.text === 'function' ? mine.fit.R.text(mine.fit.p) : mine.fit.R.text;
      const firstTriple = orient === 'row' ? [g[0], g[1], g[2]] : [g[0], g[3], g[6]];
      const lastPair = orient === 'row' ? [g[6], g[7]] : [g[2], g[5]];
      return {
        layout: 'grid', gap: 8, typed: !!typed,
        cells: known.map((v) => ({ t: 'num', v })),
        ans: { t: 'num', v: want },
        distractors: picked.map((v) => ({ t: 'num', v })),
        title: 'Number grid',
        explain: [
          `Rows and columns are not the same here: in this grid the rule runs along each ${dir}.`,
          `In every ${orient}, ${rule}. Check it on the first ${orient}: ${firstTriple.join(', ')}.`,
          `The last ${orient} starts ${lastPair.join(', ')}, so the missing number is ${want}.`
        ]
      };
    }
    return null;
  }

  // ---------- tiers ----------
  const RC = (r) => r.pick(['row', 'column']);
  const KINDS = {
    1: [[3, (r) => genSeq(r, 'arith')], [2, (r) => genGrid(r, 'sum', RC(r))], [1, (r) => genGrid(r, 'arith', RC(r))]],
    2: [[3, (r) => genSeq(r, 'geom')], [2, (r) => genGrid(r, 'diff', RC(r))], [2, (r) => genSeq(r, 'arith')], [1, (r) => genGrid(r, 'total', RC(r))]],
    3: [[3, (r) => genSeq(r, 'quad')], [2, (r) => genGrid(r, 'prod', RC(r))], [2, (r) => genGrid(r, 'half', RC(r))], [1, (r) => genSeq(r, 'geom')]],
    4: [[3, (r) => genSeq(r, 'fib')], [2, (r) => genSeq(r, 'inter')], [2, (r) => genGrid(r, 'sumk', RC(r))], [2, (r) => genGrid(r, 'prodk', RC(r))]],
    5: [[3, (r) => genSeq(r, 'linrec', true)], [3, (r) => genSeq(r, 'altop', true)], [1, (r) => genSeq(r, 'inter', true)], [1, (r) => genGrid(r, 'prodk', RC(r), true)]]
  };
  function keyOf(c) { return c.v; }
  function generate(seed, tier) {
    const r = makeRng(seed);
    const list = KINDS[tier] || KINDS[1];
    const total = list.reduce((s, x) => s + x[0], 0);
    for (let attempt = 0; attempt < 80; attempt++) {
      let w = r.f() * total, gen = list[0][1];
      for (const [wt, g] of list) { if (w < wt) { gen = g; break; } w -= wt; }
      const p = gen(r);
      if (!p || (!p.typed && p.distractors.length !== 4)) continue;
      // numeric options read best in ascending order; the answer can sit anywhere, ends included
      const opts = p.typed ? [] : [p.ans].concat(p.distractors).sort((x, y) => x.v - y.v);
      return {
        seed, tier, title: p.title, layout: p.layout, gap: p.gap, cells: p.cells, typed: p.typed, value: p.ans.v, solution: p.ans,
        options: opts, answer: p.typed ? -1 : opts.findIndex((o) => o.v === p.ans.v), explain: p.explain
      };
    }
    throw new Error('Could not generate number puzzle for seed ' + seed);
  }

  // ---------- rendering: a number inside the same 100x100 box ----------
  const FONT = 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace';
  function renderCell(c) {
    const s = String(c.v);
    const size = s.length <= 2 ? 42 : s.length === 3 ? 34 : s.length === 4 ? 27 : 22;
    return `<text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" font-size="${size}" font-weight="700" fill="#1e293b">${s}</text>`;
  }

  const api = { generate, renderCell, hatchDefs: () => '', key: keyOf, TIERS: [1, 2, 3, 4, 5] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MentalSpaNumbers = api;
})(typeof window !== 'undefined' ? window : globalThis);
