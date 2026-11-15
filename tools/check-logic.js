// Independent checker for the Logic engine.
// It reads only the English text of each puzzle (intro, statements, options) and works out the
// answer again by brute force, with its own parser and its own way of listing every possible world.
// It shares no code with engine.js.   node check.js [puzzles per level]
const E = require('../logic.js');
const PER_LEVEL = Number(process.argv[2] || 4000);

const NUMS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const ORDS = { first: 0, second: 1, third: 2, fourth: 3, fifth: 4, sixth: 5 };
const fail = (p, msg) => { throw new Error(p.code + ': ' + msg); };

// ---------------- categories ----------------
function setsParse(text) {
  let m;
  if ((m = /^All the (\w+) are (\w+)\.$/.exec(text))) return { q: 'all', s: m[1], p: m[2] };
  if ((m = /^None of the (\w+) are (\w+)\.$/.exec(text))) return { q: 'no', s: m[1], p: m[2] };
  if ((m = /^Some of the (\w+) are not (\w+)\.$/.exec(text))) return { q: 'somenot', s: m[1], p: m[2] };
  if ((m = /^Some of the (\w+) are (\w+)\.$/.exec(text))) return { q: 'some', s: m[1], p: m[2] };
  if ((m = /^All (\w+) are (\w+)\.$/.exec(text))) return { q: 'all', s: m[1], p: m[2] };
  if ((m = /^No (\w+) are (\w+)\.$/.exec(text))) return { q: 'no', s: m[1], p: m[2] };
  if ((m = /^Some (\w+) are not (\w+)\.$/.exec(text))) return { q: 'somenot', s: m[1], p: m[2] };
  if ((m = /^Some (\w+) are (\w+)\.$/.exec(text))) return { q: 'some', s: m[1], p: m[2] };
  if ((m = /^(\w+) is not a (\w+)\.$/.exec(text))) return { q: 'isnot', who: m[1], p: m[2] + 's' };
  if ((m = /^(\w+) is a (\w+)\.$/.exec(text))) return { q: 'isa', who: m[1], p: m[2] + 's' };
  return null;
}
// A world: which membership combinations are inhabited (occ, a set of region numbers as bits)
// and, if there is a named individual, the combination that individual has (e).
function setsTruth(st, cat, occ, e, strict) {
  if (st.q === 'isa') return (e >> cat[st.p] & 1) === 1;
  if (st.q === 'isnot') return (e >> cat[st.p] & 1) === 0;
  if (st.bothMask === undefined) {          // regions inside both groups, and inside the first only
    const s = cat[st.s], p = cat[st.p];
    st.bothMask = 0; st.onlyMask = 0;
    for (let reg = 0; reg < 32; reg++) if (reg >> s & 1) { if (reg >> p & 1) st.bothMask |= 1 << reg; else st.onlyMask |= 1 << reg; }
  }
  const both = (occ & st.bothMask) !== 0, onlyS = (occ & st.onlyMask) !== 0;
  if (st.q === 'all') return !onlyS;
  if (st.q === 'no') return !both;
  if (st.q === 'some') return both && (!strict || onlyS);
  return onlyS && (!strict || both);
}
function setsWorlds(k, hasInd, visit) {
  const R = 1 << k, top = Math.pow(2, R - 1);       // regions 1..R-1 may be inhabited or not
  for (let half = 0; half < top; half++) {
    const occ = (half * 2) >>> 0;
    if (!hasInd) { visit(occ, -1); continue; }
    for (let e = 0; e < R; e++) visit((occ | (1 << e)) >>> 0, e);   // the individual is a thing too
  }
}
function setsCheck(p) {
  const prem = p.premises.map(setsParse), opts = p.options.map(setsParse);
  if (prem.concat(opts).some(x => !x)) fail(p, 'cannot parse a categories statement');
  const cat = {}; let who = null, k = 0;
  prem.concat(opts).forEach(st => {
    [st.s, st.p].forEach(c => { if (c !== undefined && cat[c] === undefined) cat[c] = k++; });
    if (st.who) { if (who && who !== st.who) fail(p, 'two individuals'); who = st.who; }
  });
  if (k > 4) fail(p, 'too many categories for the checker');
  const n = opts.length, alwaysTrue = opts.map(() => true), alwaysFalse = opts.map(() => true);
  const strictFalse = opts.map(() => false), strictTrue = opts.map(() => false);
  let strictWorlds = 0;
  const catMask = [];
  for (let i = 0; i < k; i++) { let mk = 0; for (let reg = 0; reg < (1 << k); reg++) if (reg >> i & 1) mk |= 1 << reg; catMask.push(mk >>> 0); }
  setsWorlds(k, !!who, (occ, e) => {
    let loose = true, strict = true;
    for (let i = 0; i < prem.length && (loose || strict); i++) {
      if (loose && !setsTruth(prem[i], cat, occ, e, false)) loose = false;
      if (strict && !setsTruth(prem[i], cat, occ, e, true)) strict = false;
    }
    if (strict) for (let i = 0; i < k; i++) if ((occ & catMask[i]) === 0) strict = false;
    if (loose) for (let i = 0; i < n; i++) { if (setsTruth(opts[i], cat, occ, e, false)) alwaysFalse[i] = false; else alwaysTrue[i] = false; }
    if (strict) {
      strictWorlds++;
      for (let i = 0; i < n; i++) {
        if (!setsTruth(opts[i], cat, occ, e, false)) strictFalse[i] = true;
        if (setsTruth(opts[i], cat, occ, e, true)) strictTrue[i] = true;
      }
    }
  });
  if (!strictWorlds) fail(p, 'statements contradict each other under the strict reading');
  const styles = p.premises.concat(p.options).map(t => /\bthe \w+ are\b|^None of/.test(t) ? 'club' : /^(All|No|Some)/.test(t) ? 'invented' : 'person');
  if (styles.indexOf('club') >= 0 && styles.indexOf('invented') >= 0) fail(p, 'two wordings mixed in one puzzle');
  for (let i = 0; i < n; i++) {
    if (p.mode === 'must') {
      if (i === p.answer && !alwaysTrue[i]) fail(p, 'answer is not forced');
      if (i !== p.answer && !strictFalse[i]) fail(p, 'option ' + i + ' is also forced under some reading');
    } else {
      if (i === p.answer && !alwaysFalse[i]) fail(p, 'answer is not impossible');
      if (i !== p.answer && !strictTrue[i]) fail(p, 'option ' + i + ' is not clearly possible');
    }
  }
  // explanation: every step must follow from the two statements it names
  const known = p.premises.slice();
  p.check.proof.forEach(step => {
    step.from.forEach(t => { if (known.indexOf(t) < 0) fail(p, 'proof uses an unknown statement: ' + t); });
    const from = step.from.map(setsParse), to = setsParse(step.to);
    let follows = true;
    setsWorlds(k, !!who, (occ, e) => { if (follows && from.every(st => setsTruth(st, cat, occ, e, false)) && !setsTruth(to, cat, occ, e, false)) follows = false; });
    if (!follows) fail(p, 'proof step does not follow: ' + step.to);
    known.push(step.to);
  });
  const last = p.check.proof[p.check.proof.length - 1];
  if (!last) fail(p, 'empty proof');
  if (p.mode === 'must') { if (last.to !== p.options[p.answer]) fail(p, 'proof does not end at the answer'); }
  else {
    const to = setsParse(last.to); let clash = true;
    setsWorlds(k, !!who, (occ, e) => { if (clash && setsTruth(to, cat, occ, e, false) && setsTruth(opts[p.answer], cat, occ, e, false)) clash = false; });
    if (!clash) fail(p, 'proof does not rule the answer out');
  }
  // explanation: every example world must really be a world where all statements hold
  p.check.worlds.forEach((things, i) => {
    if (i === p.answer) { if (things) fail(p, 'world given for the answer'); return; }
    let occ = 0, e = -1;
    things.forEach(t => { let reg = 0; t.cats.forEach(c => { reg |= 1 << cat[c]; }); occ |= 1 << reg; if (t.name) { if (t.name !== who) fail(p, 'wrong name in world'); e = reg; } });
    occ >>>= 0;
    if (!!who !== (e >= 0)) fail(p, 'individual missing from example world');
    if (!prem.every(st => setsTruth(st, cat, occ, e, true))) fail(p, 'example world breaks a statement');
    for (let c = 0; c < k; c++) if ((occ & catMask[c]) === 0) fail(p, 'example world has an empty group');
    if (p.mode === 'must' ? setsTruth(opts[i], cat, occ, e, false) : !setsTruth(opts[i], cat, occ, e, true)) fail(p, 'example world does not show what it claims');
  });
  // shortcut: options that link two terms no statement links directly
  const linked = {}; prem.forEach(st => { linked[[st.s || st.who, st.p].sort().join('|')] = 1; });
  const fresh = opts.map(st => !linked[[st.s || st.who, st.p].sort().join('|')]);
  const nFresh = fresh.filter(Boolean).length;
  return { pairs: complementPairs(opts.map((st, i) => i), (a, b) => setsOpposite(opts[a], opts[b])), newPair: nFresh ? (fresh[p.answer] ? 1 / nFresh : 0) : 0.2, nFresh: nFresh };
}
function setsOpposite(a, b) {
  if (a.who || b.who) return !!a.who && !!b.who && a.p === b.p && a.q !== b.q;
  const same = a.s === b.s && a.p === b.p, swap = a.s === b.p && a.p === b.s;
  const pr = [a.q, b.q].sort().join('+');
  return (pr === 'all+somenot' && same) || (pr === 'no+some' && (same || swap));
}

// ---------------- ordering ----------------
function allOrders(n) {
  let out = [[]];
  for (let i = 0; i < n; i++) { const next = []; out.forEach(o => { for (let at = 0; at <= o.length; at++) next.push(o.slice(0, at).concat([i], o.slice(at))); }); out = next; }
  return out;     // each entry lists people from top to bottom
}
const WORDS = {
  friends: { more: 'taller', less: 'shorter', most: 'tallest', least: 'shortest', thing: 'height' },
  cousins: { more: 'older', less: 'younger', most: 'oldest', least: 'youngest', thing: 'age' }
};
// Returns a test: given rank (rank[person] = place from the top, 0 first) is the sentence true?
function orderParse(text, kind, id, n) {
  const N = '([A-Z][a-z][a-z])';
  const rx = (pat) => new RegExp('^' + pat + '\\.$').exec(text);
  let m;
  if (kind === 'runners') {
    if ((m = rx(N + ' finished before ' + N))) return r => r[id[m[1]]] < r[id[m[2]]];
    if ((m = rx(N + ' finished after ' + N))) return r => r[id[m[1]]] > r[id[m[2]]];
    if ((m = rx(N + ' finished first'))) return r => r[id[m[1]]] === 0;
    if ((m = rx(N + ' finished last'))) return r => r[id[m[1]]] === n - 1;
    if ((m = rx(N + ' did not finish first'))) return r => r[id[m[1]]] !== 0;
    if ((m = rx(N + ' did not finish last'))) return r => r[id[m[1]]] !== n - 1;
    if ((m = rx(N + ' finished (second|third|fourth|fifth|sixth)'))) return r => r[id[m[1]]] === ORDS[m[2]];
    if ((m = rx(N + ' finished after ' + N + ' but before ' + N))) return r => r[id[m[1]]] > r[id[m[2]]] && r[id[m[1]]] < r[id[m[3]]];
    if ((m = rx('No one finished between ' + N + ' and ' + N))) return r => Math.abs(r[id[m[1]]] - r[id[m[2]]]) === 1;
    if ((m = rx(N + ' finished right after ' + N))) return r => r[id[m[1]]] - r[id[m[2]]] === 1;
    if ((m = rx(N + ' finished right before ' + N))) return r => r[id[m[2]]] - r[id[m[1]]] === 1;
    if ((m = rx(N + ' finished somewhere between ' + N + ' and ' + N))) return r => (r[id[m[1]]] - r[id[m[2]]]) * (r[id[m[1]]] - r[id[m[3]]]) < 0;
    return null;
  }
  const w = WORDS[kind];
  if ((m = rx(N + ' is ' + w.more + ' than ' + N))) return r => r[id[m[1]]] < r[id[m[2]]];
  if ((m = rx(N + ' is ' + w.less + ' than ' + N))) return r => r[id[m[1]]] > r[id[m[2]]];
  if ((m = rx(N + ' is the ' + w.most))) return r => r[id[m[1]]] === 0;
  if ((m = rx(N + ' is the ' + w.least))) return r => r[id[m[1]]] === n - 1;
  if ((m = rx(N + ' is not the ' + w.most))) return r => r[id[m[1]]] !== 0;
  if ((m = rx(N + ' is not the ' + w.least))) return r => r[id[m[1]]] !== n - 1;
  if ((m = rx(N + ' is the (second|third|fourth|fifth|sixth) ' + w.most))) return r => r[id[m[1]]] === ORDS[m[2]];
  if ((m = rx(N + ' is the (second|third|fourth|fifth|sixth) ' + w.least))) return r => r[id[m[1]]] === n - 1 - ORDS[m[2]];
  if ((m = rx(N + ' is ' + w.less + ' than ' + N + ' but ' + w.more + ' than ' + N))) return r => r[id[m[1]]] > r[id[m[2]]] && r[id[m[1]]] < r[id[m[3]]];
  if ((m = rx('Nobody’s ' + w.thing + ' is between ' + N + '’s and ' + N + '’s'))) return r => Math.abs(r[id[m[1]]] - r[id[m[2]]]) === 1;
  if ((m = rx(N + '’s ' + w.thing + ' is somewhere between ' + N + '’s and ' + N + '’s'))) return r => (r[id[m[1]]] - r[id[m[2]]]) * (r[id[m[1]]] - r[id[m[3]]]) < 0;
  return null;
}
function orderCheck(p) {
  const im = /^(\w+) (friends|cousins|runners) /.exec(p.intro);
  if (!im) fail(p, 'cannot read the ordering intro');
  const n = NUMS[im[1].toLowerCase()], kind = im[2];
  if (!/No two are the same|There are no ties/.test(p.intro)) fail(p, 'intro does not exclude ties');
  const id = {}, names = [];
  p.premises.join(' ').replace(/\b[A-Z][a-z][a-z]\b/g, nm => { if (id[nm] === undefined) { id[nm] = names.length; names.push(nm); } return nm; });
  if (names.length !== n) fail(p, 'expected ' + n + ' people, statements name ' + names.length);
  p.options.join(' ').replace(/\b[A-Z][a-z][a-z]\b/g, nm => { if (id[nm] === undefined) fail(p, 'option names a stranger'); return nm; });
  const prem = p.premises.map(t => orderParse(t, kind, id, n)), opts = p.options.map(t => orderParse(t, kind, id, n));
  if (prem.concat(opts).some(x => !x)) fail(p, 'cannot parse an ordering statement');
  const fits = [], every = [];
  allOrders(n).forEach(order => {
    const rank = []; order.forEach((person, place) => { rank[person] = place; });
    every.push(rank);
    if (prem.every(t => t(rank))) fits.push({ rank: rank, row: order.map(i => names[i]).join(',') });
  });
  if (!fits.length) fail(p, 'no order fits');
  opts.forEach((t, i) => {
    const trues = fits.filter(f => t(f.rank)).length;
    if (p.mode === 'must') {
      if (i === p.answer && trues !== fits.length) fail(p, 'answer is not forced');
      if (i !== p.answer && trues === fits.length) fail(p, 'option ' + i + ' is also forced');
    } else {
      if (i === p.answer && trues !== 0) fail(p, 'answer is not impossible');
      if (i !== p.answer && trues === 0) fail(p, 'option ' + i + ' is also impossible');
    }
  });
  // explanation: the listed orders must be exactly the orders that fit, and each note must be right
  const listed = p.check.orders.map(row => row.join(','));
  if (listed.length !== fits.length || fits.some(f => listed.indexOf(f.row) < 0)) fail(p, 'explanation lists the wrong orders');
  const block = p.explain.find(b => b.t === 'orders');
  if (block.rows.map(row => row.join(',')).join(';') !== listed.join(';')) fail(p, 'shown orders differ from checked orders');
  const rankOfRow = row => fits.find(f => f.row === row).rank;
  p.explain.find(b => b.t === 'options').notes.forEach((note, i) => {
    const m = /^(True|False) in order (\d+)\.$/.exec(note);
    if (m) { if (opts[i](rankOfRow(listed[Number(m[2]) - 1])) !== (m[1] === 'True')) fail(p, 'note for option ' + i + ' is wrong'); return; }
    const m2 = /^(True|False) in (that order|every one of these orders)\.$/.exec(note);
    if (!m2) fail(p, 'unknown note: ' + note);
    if (fits.some(f => opts[i](f.rank) !== (m2[1] === 'True'))) fail(p, 'note for option ' + i + ' is wrong');
  });
  return { worlds: fits.length, pairs: complementPairs(opts.map((t, i) => i), (a, b) => every.every(rank => opts[a](rank) !== opts[b](rank))) };
}

// ---------------- truth and lies ----------------
function truthParse(text, me, id, n) {
  const P = '([A-Z][a-z][a-z]|I)', who = s => s === 'I' ? me : id[s];
  const rx = (pat) => new RegExp('^' + pat + '\\.$').exec(text);
  const liars = honest => honest.filter(h => !h).length;
  let m;
  if ((m = rx(P + ' is a liar'))) return h => !h[who(m[1])];
  if ((m = rx(P + ' tells the truth'))) return h => h[who(m[1])];
  if ((m = rx(P + ' and ' + P + ' are the same kind'))) return h => h[who(m[1])] === h[who(m[2])];
  if ((m = rx(P + ' and ' + P + ' are different kinds'))) return h => h[who(m[1])] !== h[who(m[2])];
  if ((m = rx(P + ' and ' + P + ' are both liars'))) return h => !h[who(m[1])] && !h[who(m[2])];
  if ((m = rx(P + ' and ' + P + ' both tell the truth'))) return h => h[who(m[1])] && h[who(m[2])];
  if ((m = rx('All (\\w+) of (us|them) tell the truth'))) { if (NUMS[m[1]] !== n) return null; return h => liars(h) === 0; }
  if ((m = rx('All (\\w+) of (us|them) are liars'))) { if (NUMS[m[1]] !== n) return null; return h => liars(h) === n; }
  if ((m = rx('Exactly (\\w+) of the (\\w+) of (us|them) (is a liar|are liars)'))) { if (NUMS[m[2]] !== n) return null; return h => liars(h) === NUMS[m[1]]; }
  if ((m = rx('At least (\\w+) of the (\\w+) of (us|them) (is a liar|are liars)'))) { if (NUMS[m[2]] !== n) return null; return h => liars(h) >= NUMS[m[1]]; }
  return null;
}
function truthCheck(p) {
  const im = /^(\w+) people each say one thing\./.exec(p.intro);
  if (!im || !/always tells the truth/.test(p.intro) || !/always lies/.test(p.intro)) fail(p, 'cannot read the truth intro');
  const n = NUMS[im[1].toLowerCase()];
  if (p.premises.length !== n) fail(p, 'not one statement per person');
  const id = {}, names = [], said = [];
  p.premises.forEach((t, i) => { const m = /^([A-Z][a-z][a-z]) says: “(.+)”$/.exec(t); if (!m) fail(p, 'cannot read who speaks'); id[m[1]] = i; names.push(m[1]); said.push(m[2]); });
  if (Object.keys(id).length !== n) fail(p, 'a person speaks twice');
  const says = said.map((t, i) => truthParse(t, i, id, n));
  const opts = p.options.map(t => /\bI\b|\bus\b/.test(t) ? null : truthParse(t, -1, id, n));
  if (says.concat(opts).some(x => !x)) fail(p, 'cannot parse a truth statement');
  const every = [], fits = [];
  for (let code = 0; code < Math.pow(2, n); code++) {
    const honest = []; for (let i = 0; i < n; i++) honest.push(Math.floor(code / Math.pow(2, i)) % 2 === 1);
    every.push(honest);
    if (says.every((t, i) => t(honest) === honest[i])) fits.push(honest);
  }
  if (!fits.length) fail(p, 'paradox: no combination works');
  opts.forEach((t, i) => {
    const trues = fits.filter(h => t(h)).length;
    if (p.mode === 'must') {
      if (i === p.answer && trues !== fits.length) fail(p, 'answer is not forced');
      if (i !== p.answer && trues === fits.length) fail(p, 'option ' + i + ' is also forced');
    } else {
      if (i === p.answer && trues !== 0) fail(p, 'answer is not impossible');
      if (i !== p.answer && trues === 0) fail(p, 'option ' + i + ' is also impossible');
    }
  });
  // explanation table: all combinations present, and marked correctly
  const table = p.explain.find(b => b.t === 'table');
  if (table.people.join() !== names.join()) fail(p, 'table columns are in the wrong order');
  if (table.rows.length !== every.length) fail(p, 'table is missing combinations');
  const seen = {};
  table.rows.forEach((row, ri) => {
    const honest = row.kinds.map(x => x === 'T'), key = row.kinds.join('');
    if (seen[key]) fail(p, 'table repeats a combination'); seen[key] = 1;
    const works = says.every((t, i) => t(honest) === honest[i]);
    if (works !== row.ok) fail(p, 'table row ' + (ri + 1) + ' is marked wrongly');
    if (!works) {
      const m = /^([A-Z][a-z][a-z]) would be (lying|honest)\.$/.exec(row.why);
      if (!m) fail(p, 'unknown reason: ' + row.why);
      const i = id[m[1]], lie = m[2] === 'lying';
      // "lying": marked as a truth-teller but the statement is false. "honest": marked as a liar but the statement is true.
      if (row.who !== i || honest[i] !== lie || says[i](honest) !== !lie) fail(p, 'reason in row ' + (ri + 1) + ' is wrong');
    }
  });
  p.explain.find(b => b.t === 'options').notes.forEach((note, i) => {
    const m = /^(True|False) in row (\d+), which works\.$/.exec(note);
    if (m) {
      const row = table.rows[Number(m[2]) - 1], honest = row.kinds.map(x => x === 'T');
      if (!row.ok || opts[i](honest) !== (m[1] === 'True')) fail(p, 'note for option ' + i + ' is wrong');
      return;
    }
    const m2 = /^(True|False) in (the|every) combination that works\.$/.exec(note);
    if (!m2) fail(p, 'unknown note: ' + note);
    if (fits.some(h => opts[i](h) !== (m2[1] === 'True'))) fail(p, 'note for option ' + i + ' is wrong');
  });
  return { worlds: fits.length, pairs: complementPairs(opts.map((t, i) => i), (a, b) => every.every(h => opts[a](h) !== opts[b](h))) };
}
function complementPairs(idx, opposite) {
  const out = [];
  for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) if (opposite(a, b)) out.push([a, b]);
  return out;
}

// ---------------- run ----------------
const CHECK = { sets: setsCheck, order: orderCheck, truth: truthCheck };
const stats = {};
const bump = (o, k, by) => { o[k] = (o[k] || 0) + (by === undefined ? 1 : by); };
let total = 0, slowest = 0, maxAttempts = 0;
const t0 = Date.now();
let lcg = 12345;
const nextSeed = i => { if (i % 2 === 0) return i / 2 + 1; lcg = (Math.imul(lcg, 1664525) + 1013904223) >>> 0; return lcg; };

for (const theme of ['invented', 'club']) {
E.theme(theme);
for (let level = 1; level <= 5; level++) {
  for (let i = 0; i < PER_LEVEL; i++) {
    const seed = nextSeed(i + level * 7919 * 2);
    const t1 = Date.now();
    const p = E.generate(level, seed);
    slowest = Math.max(slowest, Date.now() - t1);
    maxAttempts = Math.max(maxAttempts, p.attempts);
    total++;
    // basics
    if (p.form !== E.FORMS[seed % 3]) fail(p, 'form does not follow the seed');
    if (p.options.length !== 5 || new Set(p.options).size !== 5) fail(p, 'options are not five different texts');
    if (new Set(p.premises).size !== p.premises.length) fail(p, 'a statement is repeated');
    if (p.options.some(o => p.premises.indexOf(o) >= 0)) fail(p, 'an option repeats a statement');
    if (!(p.answer >= 0 && p.answer < 5)) fail(p, 'bad answer index');
    const again = E.generate(level, seed);
    if (JSON.stringify(again) !== JSON.stringify(p)) fail(p, 'not deterministic');
    const c = E.parse(p.code);
    if (!c || c.level !== level || c.seed !== seed) fail(p, 'code does not round-trip');
    const res = CHECK[p.form](p);

    // statistics on guessing shortcuts
    const key = p.form, s = stats[key] || (stats[key] = { n: 0, pos: {}, mode: {}, depth: {}, worlds: {}, typeAns: {}, typeAll: {}, simMax: 0, simMin: 0, longest: 0, shortest: 0, pairSeen: 0, pairHit: 0, perLevel: {}, rows: [] });
    s.n++; bump(s.pos, p.answer); bump(s.mode, p.mode); bump(s.depth, 'L' + level + ' d' + p.meta.depth);
    if (res.worlds) bump(s.worlds, 'L' + level + ' w' + res.worlds);
    bump(s.perLevel, level);
    p.meta.types.forEach((t, i) => { bump(s.typeAll, p.mode + ':' + t); if (i === p.answer) bump(s.typeAns, p.mode + ':' + t); });
    const feats = p.meta.feats, sim = feats.map((f, i) => feats.reduce((acc, g, j) => acc + (i === j ? 0 : f.filter(x => g.indexOf(x) >= 0).length), 0));
    const share = (vals, best) => { const top = vals.filter(v => v === best).length; return vals[p.answer] === best ? 1 / top : 0; };
    s.simMax += share(sim, Math.max(...sim)); s.simMin += share(sim, Math.min(...sim));
    const len = p.options.map(o => o.length);
    s.longest += share(len, Math.max(...len)); s.shortest += share(len, Math.min(...len));
    if (res.pairs.length) { s.pairSeen++; const inPair = new Set([].concat(...res.pairs)); if (inPair.has(p.answer)) s.pairHit += 1 / inPair.size; }
    const lv = (s.byLevel = s.byLevel || {})[level] || (s.byLevel[level] = { n: 0, simMax: 0, simMin: 0, shortest: 0, longest: 0, newPair: 0 });
    lv.n++; lv.simMax += share(sim, Math.max(...sim)); lv.simMin += share(sim, Math.min(...sim)); lv.shortest += share(len, Math.min(...len)); lv.longest += share(len, Math.max(...len));
    if (res.newPair !== undefined) lv.newPair += res.newPair;
    if (res.newPair !== undefined) { s.newPair = (s.newPair || 0) + res.newPair; bump(s.fresh = s.fresh || {}, 'L' + level + ' n' + res.nFresh); }
    s.rows.push({ mode: p.mode, types: p.meta.types, answer: p.answer });
  }
}
}

const pct = x => (100 * x).toFixed(1) + '%';
console.log('Checked ' + total + ' puzzles in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s: 0 failures. Slowest single puzzle ' + slowest + ' ms, most attempts ' + maxAttempts + '.');
for (const form of Object.keys(stats)) {
  const s = stats[form];
  console.log('\n== ' + form + ' (' + s.n + ') ==');
  console.log('answer position: ' + [0, 1, 2, 3, 4].map(i => pct((s.pos[i] || 0) / s.n)).join(' '));
  console.log('modes: ' + JSON.stringify(s.mode));
  console.log('pick most-like-others: ' + pct(s.simMax / s.n) + ' · least-like-others: ' + pct(s.simMin / s.n) + ' · longest text: ' + pct(s.longest / s.n) + ' · shortest text: ' + pct(s.shortest / s.n) + '   (chance 20%)');
  console.log('opposite pair present in ' + pct(s.pairSeen / s.n) + ' of puzzles; guessing inside the pair wins ' + pct(s.pairHit / (s.pairSeen || 1)));
  if (s.newPair) console.log('pick an option about two terms that no statement links directly: ' + pct(s.newPair / s.n) + '  · how many such options: ' + Object.keys(s.fresh).sort().map(k => k + ':' + s.fresh[k]).join(' '));
  const rate = {};
  Object.keys(s.typeAll).sort().forEach(k => { rate[k] = (s.typeAns[k] || 0) / s.typeAll[k]; });
  console.log('share of options of each kind that are the answer: ' + Object.keys(rate).map(k => k + ' ' + pct(rate[k]) + ' (' + s.typeAll[k] + ')').join(' · '));
  // best "always pick the luckiest kind" strategy
  let win = 0;
  s.rows.forEach(row => { const r = row.types.map(t => rate[row.mode + ':' + t]), best = Math.max(...r), top = r.filter(v => v === best).length; if (r[row.answer] === best) win += 1 / top; });
  console.log('always pick the kind of option that is most often right: ' + pct(win / s.n));
  console.log('by level (most-like / least-like / shortest / longest' + (s.newPair ? ' / unlinked terms' : '') + '): ' + Object.keys(s.byLevel).map(l => { const v = s.byLevel[l]; return 'L' + l + ' ' + [v.simMax, v.simMin, v.shortest, v.longest].concat(s.newPair ? [v.newPair] : []).map(x => (100 * x / v.n).toFixed(0)).join('/'); }).join('  '));
  console.log('depth: ' + Object.keys(s.depth).sort().map(k => k + ':' + s.depth[k]).join(' '));
  if (Object.keys(s.worlds).length) console.log('worlds: ' + Object.keys(s.worlds).sort().map(k => k + ':' + s.worlds[k]).join(' '));
}
