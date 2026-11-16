/* MentalSpa.club — Logic engine.
   Seeded and deterministic: the same code (for example D3-48213) always gives the same puzzle.
   Four forms: categories (All / No / Some statements), ordering (who is taller, older, faster),
   truth and lies (truth-tellers and liars) and matching (who has what). Every puzzle has five options and exactly one answer.
   Words are invented or neutral on purpose, so nothing can be answered from general knowledge. */
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
    for (let i = a.length - 1; i > 0; i--) { const j = ri(r, i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function wpick(r, weights) {
    let tot = 0;
    for (let i = 0; i < weights.length; i++) tot += weights[i];
    let x = r() * tot;
    for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x < 0) return i; }
    return weights.length - 1;
  }
  const range = n => Array.from({ length: n }, (_, i) => i);
  const cap = s => s[0].toUpperCase() + s.slice(1);
  const lowerFirst = s => s[0].toLowerCase() + s.slice(1);
  function listAnd(items) {
    if (items.length === 1) return items[0];
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }
  function popcount(x) { let c = 0; while (x) { x &= x - 1; c++; } return c; }

  const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
  const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
  const LETTERS = 'ABCDE';
  const NAMES = ['Ana', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Hal', 'Ivy', 'Jon', 'Kit', 'Lou', 'Max', 'Nia', 'Oto', 'Pam', 'Rex', 'Sam', 'Tia', 'Uma', 'Vic', 'Zoe'];
  // Invented nouns, all with a plain "s" plural and different first letters.
  const NOUNS = ['blip', 'nork', 'wug', 'kiv', 'greb', 'zorn', 'vop', 'jund', 'relk', 'mib', 'plim', 'yed', 'sork', 'tharn', 'flon', 'drell'];
  // Real words, but membership of one group says nothing about membership of another, so no belief
  // about the world can help or mislead. Deliberately no jobs, nationalities or anything stereotyped.
  const HOBBIES = ['cyclist', 'swimmer', 'runner', 'climber', 'dancer', 'singer', 'painter', 'potter',
    'gardener', 'knitter', 'surfer', 'skater', 'drummer', 'poet', 'juggler', 'sailor'];

  // Two ways of wording the same categories puzzle. SETS_THEME picks which the room uses.
  const SETS_THEMES = {
    invented: {
      intro: 'Take every statement as given. “Some” means at least one, possibly all.',
      words: NOUNS, unit: 'thing that', plural: w => w + 's',
      all: (S, P) => 'All ' + S + ' are ' + P + '.',
      no: (S, P) => 'No ' + S + ' are ' + P + '.',
      some: (S, P) => 'Some ' + S + ' are ' + P + '.',
      somenot: (S, P) => 'Some ' + S + ' are not ' + P + '.'
    },
    club: {
      intro: 'Everyone below belongs to one small club. Take every statement as given. “Some” means at least one, possibly all.',
      words: HOBBIES, unit: 'member who', plural: w => w + 's',
      all: (S, P) => 'All the ' + S + ' are ' + P + '.',
      no: (S, P) => 'None of the ' + S + ' are ' + P + '.',
      some: (S, P) => 'Some of the ' + S + ' are ' + P + '.',
      somenot: (S, P) => 'Some of the ' + S + ' are not ' + P + '.'
    }
  };
  let SETS_THEME = 'club';   // decided 15 Nov 2026; 'invented' is the earlier wording, kept as a fallback

  const FORMS = ['sets', 'order', 'truth', 'match'];
  const FORM_NAMES = { sets: 'Categories', order: 'Ordering', truth: 'Truth and lies', match: 'Matching' };
  const QUESTION = { must: 'Which statement must be true?', cannot: 'Which statement cannot be true?' };

  // ---------- choosing the five options ----------
  // Each candidate has feats (strings). The answer's "likeness rank" among the five options is drawn
  // from the seed, so picking the option most (or least) like the others is no better than chance.
  function shared(a, b) { let c = 0; for (let i = 0; i < a.feats.length; i++) if (b.feats.indexOf(a.feats[i]) >= 0) c++; return c; }
  function drawFour(r, pool, answer, prior) {
    const left = pool.slice(), out = [], groups = {};
    groups[answer.group] = 1;
    while (out.length < 4) {
      const avail = left.filter(c => !groups[c.group]);
      if (!avail.length) return null;
      const tot = {};
      avail.forEach(c => { tot[c.type] = (tot[c.type] || 0) + (c.w || 1); });
      const c = avail[wpick(r, avail.map(c => (prior[c.type] || 1) * (c.w || 1) / tot[c.type]))];
      out.push(c); groups[c.group] = 1; left.splice(left.indexOf(c), 1);
    }
    return out;
  }
  function chooseOptions(r, answer, pool, prior, accept) {
    const target = ri(r, 5);
    let best = null, bestGap = 99;
    for (let attempt = 0; attempt < 900; attempt++) {
      const four = drawFour(r, pool, answer, prior || {});
      if (!four) return null;
      if (accept && !accept(four)) continue;
      const all = [answer].concat(four);
      const sims = all.map((o, i) => all.reduce((s, q, j) => s + (i === j ? 0 : shared(o, q)), 0));
      let hi = 0, eq = 0;
      for (let i = 1; i < 5; i++) { if (sims[i] > sims[0]) hi++; else if (sims[i] === sims[0]) eq++; }
      const gap = target < hi ? hi - target : target > hi + eq ? target - hi - eq : 0;
      if (gap < bestGap) { best = four; bestGap = gap; if (!gap) break; }
    }
    return best;
  }
  // Smallest group of statements that settles something. test(mask) says whether that subset is enough.
  function minSubset(m, test) {
    for (let size = 1; size <= m; size++)
      for (let mask = 1; mask < (1 << m); mask++)
        if (popcount(mask) === size && test(mask)) return { size: size, mask: mask };
    return null;
  }
  const maskNums = mask => { const out = []; for (let i = 0; mask >> i; i++) if (mask >> i & 1) out.push(String(i + 1)); return out; };
  function enoughText(sub, m, verb) {
    if (sub.size === m) return 'It takes ' + (m === 2 ? 'both' : 'all ' + NUM[m]) + ' statements together to ' + verb + '.';
    return (sub.size === 1 ? 'Statement ' : 'Statements ') + listAnd(maskNums(sub.mask)) + (sub.size === 1 ? ' is' : ' are') + ' enough to ' + verb + '.';
  }

  // =====================================================================
  // 1. CATEGORIES: All / No / Some / Some … not, plus one named individual
  // =====================================================================
  // A term is a category (0..k-1) or the individual (index k). A "region" is one combination of
  // memberships; a world is the set of regions that have at least one thing in them.
  function setsCtx(k, hasInd) {
    const n = k + (hasInd ? 1 : 0), R = 1 << n, T = [];
    for (let i = 0; i < n; i++) {
      let mask = 0;
      for (let reg = 0; reg < R; reg++) if (reg >> i & 1) mask |= (1 << reg);
      T.push(mask >>> 0);
    }
    return { k: k, n: n, R: R, T: T, ind: hasInd ? k : -1 };
  }
  // Can all the statements hold at once? reading 0: groups may be empty, "some" = at least one.
  // reading 1: every group has a member. reading 2: also "some" = some but not all (for flagged statements).
  function setsSat(ctx, stmts, reading, pragFlags) {
    let F = 0;
    const E = [];
    for (let i = 0; i < stmts.length; i++) {
      const st = stmts[i], A = ctx.T[st.s], B = ctx.T[st.p], prag = reading === 2 && pragFlags && pragFlags[i];
      if (st.q === 'all') F |= A & ~B;
      else if (st.q === 'no') F |= A & B;
      else if (st.q === 'some') { E.push(A & B); if (prag) E.push(A & ~B); }
      else { E.push(A & ~B); if (prag) E.push(A & B); }
    }
    for (let i = 0; i < ctx.n; i++) if (reading >= 1 || i === ctx.ind) E.push(ctx.T[i]);
    for (let i = 0; i < E.length; i++) if (((E[i] & ~F) >>> 0) === 0) return false;
    return true;
  }
  const NEG = { all: 'somenot', somenot: 'all', no: 'some', some: 'no' };
  const flags = (n, last) => { const f = []; for (let i = 0; i < n; i++) f.push(true); f.push(last); return f; };
  function setsForced(ctx, prem, st, reading) {
    return !setsSat(ctx, prem.concat([{ q: NEG[st.q], s: st.s, p: st.p }]), reading, flags(prem.length, false));
  }
  function setsPossible(ctx, prem, st, reading) {
    return setsSat(ctx, prem.concat([st]), reading, flags(prem.length, true));
  }
  const setsKey = st => st.q + ':' + st.s + '>' + st.p;

  // Forward chaining with the classic syllogism rules, used to write the explanation.
  function setsChain(ctx, prem) {
    const facts = {};
    let list = [], fresh = [];
    // cost = number of steps needed to reach a fact; a cheaper route replaces a dearer one
    function add(q, s, p, from, rule) {
      if (s === p || p === ctx.ind) return;
      if (s === ctx.ind && (q === 'some' || q === 'somenot')) return;
      const st = { q: q, s: s, p: p }, k = setsKey(st);
      const cost = 1 + from.reduce((sum, key) => sum + facts[key].cost, 0);
      if (facts[k]) {
        if (cost < facts[k].cost) { facts[k].from = from; facts[k].rule = rule; facts[k].cost = cost; changed = true; }
        return;
      }
      facts[k] = { st: st, k: k, from: from, rule: rule, cost: cost };
      fresh.push(facts[k]);
    }
    prem.forEach((st, i) => { const k = setsKey(st); if (!facts[k]) { facts[k] = { st: st, k: k, from: null, num: i + 1, cost: 0 }; list.push(facts[k]); } });
    let changed = false;
    for (let round = 0; round < 30; round++) {
      changed = false;
      fresh = [];
      for (let i = 0; i < list.length; i++) {
        const f = list[i], a = f.st;
        if (a.q === 'no' && a.s !== ctx.ind) add('no', a.p, a.s, [f.k], 'conv');
        if (a.q === 'some') add('some', a.p, a.s, [f.k], 'conv');
        for (let j = 0; j < list.length; j++) {
          if (i === j) continue;
          const g = list[j], b = g.st, fr = [f.k, g.k];
          if (a.q === 'all') {
            if (b.q === 'all' && b.s === a.p) add('all', a.s, b.p, fr, 'chain');
            if (b.q === 'no' && b.s === a.p) add('no', a.s, b.p, fr, 'chain');
            if (b.q === 'no' && b.p === a.p) add('no', b.s, a.s, fr, 'chain');
            if (a.s === ctx.ind && b.s === ctx.ind && b.q === 'all') add('some', a.p, b.p, fr, 'chain');
            if (a.s === ctx.ind && b.s === ctx.ind && b.q === 'no') add('somenot', a.p, b.p, fr, 'chain');
          }
          if (a.q === 'some') {
            if (b.q === 'all' && b.s === a.p) add('some', a.s, b.p, fr, 'chain');
            if (b.q === 'no' && b.s === a.p) add('somenot', a.s, b.p, fr, 'chain');
          }
          if (a.q === 'somenot') {
            if (b.q === 'all' && b.p === a.p) add('somenot', a.s, b.s, fr, 'chain');
            if (b.q === 'all' && b.s === a.s) add('somenot', b.p, a.p, fr, 'chain');
          }
        }
      }
      if (!fresh.length && !changed) break;
      list = list.concat(fresh);
    }
    return facts;
  }
  function setsProof(facts, k) {
    const order = [], seen = {};
    (function walk(key) {
      if (seen[key]) return;
      seen[key] = 1;
      const f = facts[key];
      if (f.from) f.from.forEach(walk);
      order.push(f);
    })(k);
    return order.filter(f => f.from);
  }
  function setsText(w, st) {
    if (st.s === w.ind) return w.name + (st.q === 'all' ? ' is a ' : ' is not a ') + w.sing[st.p] + '.';
    return w.theme[st.q](w.plur[st.s], w.plur[st.p]);
  }
  const inline = (w, st) => { const t = setsText(w, st).slice(0, -1); return st.s === w.ind ? t : lowerFirst(t); };
  function setsEval(ctx, st, W, prag) {
    const A = ctx.T[st.s], B = ctx.T[st.p];
    if (st.q === 'all') return ((W & A & ~B) >>> 0) === 0;
    if (st.q === 'no') return ((W & A & B) >>> 0) === 0;
    if (st.q === 'some') return (W & A & B) !== 0 && (!prag || (W & A & ~B) !== 0);
    return (W & A & ~B) !== 0 && (!prag || (W & A & B) !== 0);
  }
  // Smallest world where every statement holds (under the strictest reading) and st is true / false as wanted.
  function setsWorld(ctx, prem, st, want) {
    let F = 0;
    prem.forEach(p => { const A = ctx.T[p.s], B = ctx.T[p.p]; if (p.q === 'all') F |= A & ~B; else if (p.q === 'no') F |= A & B; });
    const plain = [], indR = [];
    for (let reg = 1; reg < ctx.R; reg++) {
      if (F >>> reg & 1) continue;
      if (ctx.ind >= 0 && (reg >> ctx.ind & 1)) indR.push(reg); else plain.push(reg);
    }
    const ok = W => {
      for (let i = 0; i < prem.length; i++) if (!setsEval(ctx, prem[i], W, true)) return false;
      for (let i = 0; i < ctx.k; i++) if ((W & ctx.T[i]) === 0) return false;
      return setsEval(ctx, st, W, want) === want;
    };
    const bases = ctx.ind >= 0 ? indR : [-1];
    let found = null;
    function combos(start, left, W, regs) {
      if (!left) { if (ok(W)) { found = regs.slice(); return true; } return false; }
      for (let i = start; i <= plain.length - left; i++) {
        regs.push(plain[i]);
        if (combos(i + 1, left - 1, (W | (1 << plain[i])) >>> 0, regs)) return true;
        regs.pop();
      }
      return false;
    }
    for (let size = 0; size <= 5; size++) {
      for (let b = 0; b < bases.length; b++) {
        if (bases[b] < 0 && size === 0) continue;
        const regs = bases[b] < 0 ? [] : [bases[b]];
        if (combos(0, size, bases[b] < 0 ? 0 : (1 << bases[b]) >>> 0, regs)) return found;
      }
    }
    return null;
  }
  function setsThings(ctx, w, regs) {
    return regs.map(reg => {
      const cats = [];
      for (let i = 0; i < ctx.k; i++) if (reg >> i & 1) cats.push(i);
      return { name: ctx.ind >= 0 && (reg >> ctx.ind & 1) ? w.name : null, cats: cats.map(i => w.plur[i]),
        sing: cats.map(i => 'a ' + w.sing[i]), unit: w.theme.unit };
    });
  }
  function thingsText(things) {
    return things.map(t => {
      if (t.name) return t.name + ', who is ' + (t.sing.length ? (t.sing.length === 1 ? 'only ' : '') + listAnd(t.sing) : 'none of these');
      return 'one ' + t.unit + ' is ' + (t.sing.length === 1 ? 'only ' : '') + listAnd(t.sing);
    }).join('; ');
  }

  const SETS = {
    1: { shapes: [[2, 1, 2], [3, 0, 2], [3, 0, 2]], q: { all: 45, no: 25, some: 30 }, dmin: 2 },
    2: { shapes: [[3, 0, 2], [3, 1, 2], [3, 1, 3]], q: { all: 40, no: 30, some: 30 }, dmin: 2, mixed: true },
    3: { shapes: [[4, 0, 3], [3, 1, 3]], q: { all: 45, no: 25, some: 20, somenot: 10 }, dmin: 3 },
    4: { shapes: [[4, 0, 4], [3, 1, 4]], q: { all: 40, no: 25, some: 20, somenot: 15 }, dmin: 3 },
    5: { shapes: [[4, 1, 5], [4, 1, 5], [4, 0, 5]], q: { all: 40, no: 25, some: 20, somenot: 15 }, dmin: 4 }
  };
  // How often each kind of statement is drawn as a wrong option, per form, level and question.
  // Tuned by tune.js so that no kind of option is the answer much more often than one time in five.
  /*PRIORS*/let PRIORS = {"order1must":{"wrong":{"ext":2.577,"lt":0.516,"pos":0.447,"nxt":0.03},"right":{"ext":0.387,"lt":1.939,"pos":2.241,"nxt":39.062}},"truth1must":{"wrong":{"rel":0.238,"both":0.426,"is":2.328},"right":{"rel":4.191,"both":2.347,"is":0.43}},"match1must":{"wrong":{"not":1.177,"is":0.875},"right":{"not":0.849,"is":1.143}},"sets1must":{"wrong":{"some":1.684,"no":0.572,"somenot":0.67,"all":0.351,"isnot":7.168,"isa":2.116},"right":{"some":0.594,"no":1.747,"somenot":1.495,"all":2.847,"isnot":0.14,"isa":0.474}},"order2must":{"wrong":{"ext":1.902,"lt":0.994,"pos":0.911,"nxt":0.03},"right":{"ext":0.526,"lt":1.007,"pos":1.098,"nxt":39.062}},"truth2must":{"wrong":{"rel":1.085,"count":0.888,"both":1.044,"is":0.952},"right":{"rel":0.92,"count":1.127,"both":0.959,"is":1.049}},"match2must":{"wrong":{"not":1.01,"is":0.99},"right":{"not":0.99,"is":1.011}},"sets2must":{"wrong":{"somenot":0.853,"some":0.768,"all":0.03,"no":0.532,"isnot":8.917,"isa":0.297},"right":{"somenot":1.172,"some":1.301,"all":39.062,"no":1.884,"isnot":0.112,"isa":3.37}},"order3must":{"wrong":{"lt":1.336,"ext":1.84,"pos":0.392,"nxt":0.078},"right":{"lt":0.749,"ext":0.543,"pos":2.548,"nxt":12.711}},"truth3must":{"wrong":{"count":0.685,"rel":1.459,"is":1.041,"both":0.737},"right":{"count":1.46,"rel":0.686,"is":0.961,"both":1.357}},"match3must":{"wrong":{"is":1.026,"not":0.965},"right":{"is":0.971,"not":1.039}},"sets3must":{"wrong":{"isa":0.528,"isnot":3.62,"all":0.2,"no":0.556,"somenot":1.627,"some":0.893},"right":{"isa":1.891,"isnot":0.277,"all":5.005,"no":1.799,"somenot":0.614,"some":1.121}},"order4cannot":{"wrong":{"pos":1.265,"lt":1.065,"nxt":1.464,"ext":0.035},"right":{"pos":0.791,"lt":0.938,"nxt":0.683,"ext":27.792}},"truth4cannot":{"wrong":{"is":1.208,"rel":1.577,"count":0.302,"both":0.121},"right":{"is":0.829,"rel":0.635,"count":3.308,"both":8.289}},"match4cannot":{"wrong":{"is":1.461,"not":0.977,"nlink":0.374,"link":0.345},"right":{"is":0.685,"not":1.025,"nlink":2.673,"link":2.904}},"sets4must":{"wrong":{"no":0.03,"somenot":2.305,"isa":0.116,"isnot":0.049,"some":3.269,"all":0.043},"right":{"no":33.77,"somenot":0.435,"isa":8.558,"isnot":20.675,"some":0.306,"all":23.213}},"order4must":{"wrong":{"lt":1.285,"ext":2.277,"pos":0.301,"nxt":0.031},"right":{"lt":0.779,"ext":0.439,"pos":3.336,"nxt":32.162}},"match4must":{"wrong":{"is":0.872,"not":1.596,"link":0.399,"nlink":0.342},"right":{"is":1.145,"not":0.627,"link":2.502,"nlink":2.922}},"truth4must":{"wrong":{"rel":1.309,"is":1.135,"both":1.021,"count":0.319},"right":{"rel":0.764,"is":0.88,"both":0.98,"count":3.138}},"sets4cannot":{"wrong":{"all":3.167,"no":2.585,"somenot":0.032,"isnot":0.052,"some":0.031,"isa":0.035},"right":{"all":0.315,"no":0.387,"somenot":31.152,"isnot":19.306,"some":32.484,"isa":29.267}},"order5cannot":{"wrong":{"lt":1.025,"adj":1.038,"pos":1.302,"next":1.152,"nxt":0.869,"ext":0.44},"right":{"lt":0.974,"adj":0.965,"pos":0.766,"next":0.867,"nxt":1.148,"ext":2.271}},"truth5cannot":{"wrong":{"is":1.031,"count":0.807,"rel":1.198,"both":0.804},"right":{"is":0.97,"count":1.239,"rel":0.833,"both":1.242}},"match5cannot":{"wrong":{"link":0.47,"nlink":0.513,"is":1.5,"not":0.979},"right":{"link":2.127,"nlink":1.946,"is":0.665,"not":1.022}},"sets5must":{"wrong":{"somenot":2.827,"isnot":0.154,"all":0.03,"some":0.724,"isa":0.103,"no":0.03},"right":{"somenot":0.353,"isnot":6.529,"all":39.062,"some":1.38,"isa":9.656,"no":39.062}},"order5must":{"wrong":{"adj":0.835,"ext":1.205,"pos":0.903,"lt":1.368,"next":0.772,"nxt":0.559},"right":{"adj":1.196,"ext":0.83,"pos":1.106,"lt":0.733,"next":1.295,"nxt":1.791}},"truth5must":{"wrong":{"is":1.029,"both":0.925,"rel":1.28,"count":0.695},"right":{"is":0.972,"both":1.08,"rel":0.781,"count":1.44}},"match5must":{"wrong":{"not":1.533,"is":1.034,"link":0.518,"nlink":0.412},"right":{"not":0.653,"is":0.97,"link":1.934,"nlink":2.424}},"sets5cannot":{"wrong":{"all":2.951,"no":0.843,"isa":0.152,"isnot":0.115,"somenot":0.03,"some":0.03},"right":{"all":0.34,"no":1.186,"isa":6.555,"isnot":8.715,"somenot":39.062,"some":39.062}}};/*END*/
  const priorFor = (form, level, mode) => (PRIORS[form + level + mode] || {}).wrong || {};
  // The kind of statement used as the answer is drawn with weights from the same table.
  function answerType(r, types, form, level, mode) {
    const w = (PRIORS[form + level + mode] || {}).right || {};
    return types[wpick(r, types.map(t => w[t] || 1))];
  }

  function genSets(r, level, relax, plan) {
    const sp = SETS[level], shape = pick(r, sp.shapes), k = shape[0], hasInd = !!shape[1], m = shape[2];
    const ctx = setsCtx(k, hasInd), n = ctx.n;
    const theme = SETS_THEMES[SETS_THEME];
    const nouns = shuffle(r, theme.words).slice(0, k);
    const w = { sing: nouns, plur: nouns.map(theme.plural), ind: ctx.ind, name: hasInd ? pick(r, NAMES) : null, theme: theme };
    const qKeys = Object.keys(sp.q), qW = qKeys.map(x => sp.q[x]);
    const terms = hasInd ? [ctx.ind].concat(shuffle(r, range(k))) : shuffle(r, range(k));
    let prem = [];
    const used = {};
    function link(a, b) {
      used[Math.min(a, b) + '|' + Math.max(a, b)] = 1;
      if (a === ctx.ind || b === ctx.ind) {
        const neg = r() < (level > 1 ? 0.3 : 0.45);
        prem.push({ q: neg ? 'no' : 'all', s: ctx.ind, p: a === ctx.ind ? b : a });
        return;
      }
      const q = qKeys[wpick(r, qW)];
      if (r() < 0.5) { const t = a; a = b; b = t; }
      prem.push({ q: q, s: a, p: b });
    }
    for (let i = 0; i + 1 < n; i++) link(terms[i], terms[i + 1]);
    for (let guard = 0; prem.length < m && guard < 40; guard++) {
      const a = ri(r, n), b = ri(r, n);
      if (a !== b && !used[Math.min(a, b) + '|' + Math.max(a, b)]) link(a, b);
    }
    if (prem.length < m) return null;
    if (sp.mixed && prem.every(p => p.q === 'all')) return null;
    prem = shuffle(r, prem);
    if (!setsSat(ctx, prem, 2, flags(m, true))) return null;
    for (let i = 0; i < m; i++) if (setsForced(ctx, prem.filter((_, j) => j !== i), prem[i], 1)) return null;

    const mode = level >= 4 && plan.cannot && relax < 2 ? 'cannot' : 'must';
    const dmin = Math.max(2, sp.dmin - relax);
    const facts = setsChain(ctx, prem);
    const cands = [];
    for (let s = 0; s < n; s++) for (let p = 0; p < k; p++) {
      if (s === p) continue;
      (s === ctx.ind ? ['all', 'no'] : ['all', 'no', 'some', 'somenot']).forEach(q => {
        const st = { q: q, s: s, p: p };
        if (prem.some(x => x.q === q && ((x.s === s && x.p === p) || ((q === 'no' || q === 'some') && x.s === p && x.p === s)))) return;
        const sym = (q === 'no' || q === 'some') && s !== ctx.ind;
        cands.push({
          st: st, text: setsText(w, st),
          f1: setsForced(ctx, prem, st, 0), f3: setsForced(ctx, prem, st, 2),
          p1: setsPossible(ctx, prem, st, 0), p3: setsPossible(ctx, prem, st, 2),
          single: prem.some(x => setsForced(ctx, [x], st, 2) || !setsPossible(ctx, [x], st, 1)),
          type: s === ctx.ind ? (q === 'all' ? 'isa' : 'isnot') : q,
          group: sym ? q + Math.min(s, p) + '|' + Math.max(s, p) : q + s + '>' + p,
          feats: ['q:' + q, 's:' + s, 'p:' + p, 'u:' + Math.min(s, p) + '|' + Math.max(s, p)]
        });
      });
    }
    const proofKey = c => setsKey(mode === 'must' ? c.st : { q: c.st.s === ctx.ind ? (c.st.q === 'all' ? 'no' : 'all') : NEG[c.st.q], s: c.st.s, p: c.st.p });
    const answers = cands.filter(c => (mode === 'must' ? c.f1 : !c.p1) && facts[proofKey(c)]);
    answers.forEach(c => {
      c.sub = minSubset(m, mask => {
        const sub = prem.filter((_, i) => mask >> i & 1);
        return mode === 'must' ? setsForced(ctx, sub, c.st, 0) : !setsPossible(ctx, sub, c.st, 0);
      });
    });
    const good = answers.filter(c => c.sub && c.sub.size >= dmin && (!hasInd || level > 2 || c.st.s === ctx.ind));
    if (!good.length) return null;
    const types = good.map(c => c.type).filter((t, i, a) => a.indexOf(t) === i);
    const type = answerType(r, types, 'sets', level, mode);
    const ofType = good.filter(c => c.type === type);
    const ans = ofType[wpick(r, ofType.map(c => c.sub.size * c.sub.size))];

    const groupCount = list => list.map(c => c.group).filter((g, i, a) => g !== ans.group && a.indexOf(g) === i).length;
    const usable = cands.filter(c => c !== ans && (mode === 'must' ? !c.f3 : c.p3));
    // Options that a single statement already settles are easy to discard. They are kept out at the
    // higher levels, unless they are the same kind of statement as the answer or are needed to fill up.
    const easy = c => c.single && c.type !== ans.type && level > 2;
    const pool = usable.filter(c => !easy(c));
    const weak = shuffle(r, usable.filter(easy));
    while (groupCount(pool) < 4 && weak.length) pool.push(weak.pop());
    if (groupCount(pool) < 4) return null;
    const au = ans.feats[3];
    pool.forEach(c => { c.w = c.single ? 1 : prem.some(x => x.q === 'all' && c.st.q === 'all' && x.s === c.st.p && x.p === c.st.s) ? 6 : 3; });
    // At the lower levels several wrong options talk about the same two terms as the answer, when that is possible.
    const samePair = Math.min(level <= 2 ? 2 : level === 3 ? 1 : 0, groupCount(pool.filter(c => c.feats[3] === au)));
    // An option about the named person is much shorter than one about whole groups. When the answer is
    // one of those, at least two wrong options must be too, so length gives nothing away.
    const aboutName = c => c.type === 'isa' || c.type === 'isnot';
    const needName = aboutName(ans) ? Math.min(2, groupCount(pool.filter(aboutName))) : 0;
    if (aboutName(ans) && needName < 2) return null;
    const four = chooseOptions(r, ans, pool, priorFor('sets', level, mode),
      f => f.filter(c => c.feats[3] === au).length >= samePair && f.filter(aboutName).length >= needName);
    if (!four) return null;
    const opts = shuffle(r, [ans].concat(four)), ai = opts.indexOf(ans), L = LETTERS[ai];

    // explanation
    const steps = setsProof(facts, proofKey(ans));
    const ref = key => { const f = facts[key]; return inline(w, f.st) + (f.from ? '' : ' (' + f.num + ')'); };
    const stepText = steps.map(f => f.rule === 'conv'
      ? cap(ref(f.from[0])) + ' says the same as: ' + inline(w, f.st) + '.'
      : cap(ref(f.from[0])) + ', and ' + ref(f.from[1]) + ', so ' + inline(w, f.st) + '.');
    const worlds = [], notes = [];
    for (let i = 0; i < 5; i++) {
      if (i === ai) { worlds.push(null); notes.push(mode === 'must' ? 'Forced by the statements, as shown above.' : 'Ruled out by the statements, as shown above.'); continue; }
      const regs = setsWorld(ctx, prem, opts[i].st, mode !== 'must');
      if (!regs) return null;
      const things = setsThings(ctx, w, regs);
      worlds.push(things.map(t => ({ name: t.name, cats: t.cats })));
      notes.push((mode === 'must' ? 'Not forced. ' : 'Can be true. ') + 'Picture a world with only: ' + thingsText(things) + '. Every statement holds there, ' +
        (mode === 'must' ? 'but this option is false.' : 'and this option is true.'));
    }
    const blocks = mode === 'must'
      ? [{ t: 'p', text: 'Chain the statements (the numbers show which ones are used):' }, { t: 'steps', items: stepText }, { t: 'p', text: 'That is option ' + L + '.' }]
      : [{ t: 'p', text: 'Option ' + L + ' says “' + ans.text + '” The statements rule it out:' }, { t: 'steps', items: stepText }, { t: 'p', text: 'So option ' + L + ' cannot be true.' }];
    blocks.push({ t: 'options', notes: notes });
    return {
      form: 'sets', mode: mode,
      intro: w.theme.intro,
      premises: prem.map(st => setsText(w, st)),
      options: opts.map(c => c.text), answer: ai, explain: blocks,
      meta: { types: opts.map(c => c.type), feats: opts.map(c => c.feats), depth: ans.sub.size },
      check: { proof: steps.map(f => ({ from: f.from.map(key => setsText(w, facts[key].st)), to: setsText(w, f.st) })), worlds: worlds }
    };
  }

  // =====================================================================
  // 2. ORDERING: heights, ages, a race
  // =====================================================================
  const PERMS = {};
  function perms(n) {
    if (PERMS[n]) return PERMS[n];
    const out = [], a = range(n);
    (function rec(i) {
      if (i === n) { const pos = new Array(n); for (let j = 0; j < n; j++) pos[a[j]] = j; out.push({ order: a.slice(), pos: pos }); return; }
      for (let j = i; j < n; j++) { let t = a[i]; a[i] = a[j]; a[j] = t; rec(i + 1); t = a[i]; a[i] = a[j]; a[j] = t; }
    })(0);
    return (PERMS[n] = out);
  }
  function orderEval(st, pos, n) {
    switch (st.t) {
      case 'lt': return pos[st.a] < pos[st.b];
      case 'top': return pos[st.a] === 0;
      case 'bot': return pos[st.a] === n - 1;
      case 'ntop': return pos[st.a] !== 0;
      case 'nbot': return pos[st.a] !== n - 1;
      case 'pos': return pos[st.a] === st.k;
      case 'chain': return pos[st.b] < pos[st.a] && pos[st.a] < pos[st.c];
      case 'adj': return Math.abs(pos[st.a] - pos[st.b]) === 1;
      case 'next': return pos[st.b] === pos[st.a] + 1;
      case 'btw': return (pos[st.b] < pos[st.a] && pos[st.a] < pos[st.c]) || (pos[st.c] < pos[st.a] && pos[st.a] < pos[st.b]);
    }
    return false;
  }
  function compare(more, less, most, least, thing, who) {
    return {
      intro: n => cap(NUM[n]) + ' ' + who + ' compare ' + thing + 's. No two are the same ' + thing + '.',
      label: most + ' first',
      say: function (st, N, n) {
        const a = N[st.a], b = N[st.b], c = N[st.c];
        switch (st.t) {
          case 'lt': return st.v ? b + ' is ' + less + ' than ' + a + '.' : a + ' is ' + more + ' than ' + b + '.';
          case 'top': return a + ' is the ' + most + '.';
          case 'bot': return a + ' is the ' + least + '.';
          case 'ntop': return a + ' is not the ' + most + '.';
          case 'nbot': return a + ' is not the ' + least + '.';
          case 'pos': return st.v ? a + ' is the ' + ORD[n - 1 - st.k] + ' ' + least + '.' : a + ' is the ' + ORD[st.k] + ' ' + most + '.';
          case 'chain': return a + ' is ' + less + ' than ' + b + ' but ' + more + ' than ' + c + '.';
          case 'adj': return 'Nobody’s ' + thing + ' is between ' + a + '’s and ' + b + '’s.';
          case 'btw': return a + '’s ' + thing + ' is somewhere between ' + b + '’s and ' + c + '’s.';
        }
      }
    };
  }
  const THEMES = {
    height: compare('taller', 'shorter', 'tallest', 'shortest', 'height', 'friends'),
    age: compare('older', 'younger', 'oldest', 'youngest', 'age', 'cousins'),
    race: {
      intro: n => cap(NUM[n]) + ' runners finish a race. There are no ties.',
      label: 'first place first',
      say: function (st, N) {
        const a = N[st.a], b = N[st.b], c = N[st.c];
        switch (st.t) {
          case 'lt': return st.v ? b + ' finished after ' + a + '.' : a + ' finished before ' + b + '.';
          case 'top': return a + ' finished first.';
          case 'bot': return a + ' finished last.';
          case 'ntop': return a + ' did not finish first.';
          case 'nbot': return a + ' did not finish last.';
          case 'pos': return a + ' finished ' + ORD[st.k] + '.';
          case 'chain': return a + ' finished after ' + b + ' but before ' + c + '.';
          case 'adj': return 'No one finished between ' + a + ' and ' + b + '.';
          case 'next': return st.v ? a + ' finished right before ' + b + '.' : b + ' finished right after ' + a + '.';
          case 'btw': return a + ' finished somewhere between ' + b + ' and ' + c + '.';
        }
      }
    }
  };
  // A place is counted from the nearer end: "second tallest" or "second shortest", never "fourth tallest" of five.
  const posEnd = (r, k, n) => 2 * k < n - 1 ? 0 : 2 * k > n - 1 ? 1 : ri(r, 2);
  function makeClue(r, type, order, pos, n, race) {
    const at = i => order[i];
    switch (type) {
      case 'lt': { let a = ri(r, n), b = ri(r, n); if (a === b) return null; if (pos[a] > pos[b]) { const t = a; a = b; b = t; } return { t: 'lt', a: a, b: b, v: ri(r, 2) }; }
      case 'top': return { t: 'top', a: at(0) };
      case 'bot': return { t: 'bot', a: at(n - 1) };
      case 'ntop': return { t: 'ntop', a: at(1 + ri(r, n - 1)) };
      case 'nbot': return { t: 'nbot', a: at(ri(r, n - 1)) };
      case 'pos': { const k = 1 + ri(r, n - 2); return { t: 'pos', a: at(k), k: k, v: race ? 0 : posEnd(r, k, n) }; }
      case 'chain': { const i = 1 + ri(r, n - 2); return { t: 'chain', a: at(i), b: at(ri(r, i)), c: at(i + 1 + ri(r, n - 1 - i)) }; }
      case 'next': if (race) { const i = ri(r, n - 1); return { t: 'next', a: at(i), b: at(i + 1), v: ri(r, 2) }; } // falls through for heights and ages
      case 'adj': { const i = ri(r, n - 1), sw = ri(r, 2); return { t: 'adj', a: at(i + sw), b: at(i + 1 - sw) }; }
      case 'btw': { const i = 1 + ri(r, n - 2), b = at(ri(r, i)), c = at(i + 1 + ri(r, n - 1 - i)); return ri(r, 2) ? { t: 'btw', a: at(i), b: b, c: c } : { t: 'btw', a: at(i), b: c, c: b }; }
    }
    return null;
  }
  const clueKey = c => c.t === 'adj' ? 'adj' + Math.min(c.a, c.b) + '|' + Math.max(c.a, c.b) : c.t + c.a + '.' + (c.b === undefined ? '' : c.b) + '.' + (c.c === undefined ? '' : c.c) + '.' + (c.k === undefined ? '' : c.k);
  // bit sets over the list of all orders
  function bitsOf(P, n, st) { const b = new Uint32Array(Math.ceil(P.length / 32)); for (let i = 0; i < P.length; i++) if (orderEval(st, P[i].pos, n)) b[i >> 5] |= (1 << (i & 31)); return b; }
  function bAnd(a, b) { const o = new Uint32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] & b[i]; return o; }
  function bCount(a) { let c = 0; for (let i = 0; i < a.length; i++) c += popcount(a[i]); return c; }
  function bSubset(a, b) { for (let i = 0; i < a.length; i++) if (a[i] & ~b[i]) return false; return true; }  // a inside b
  function bDisjoint(a, b) { for (let i = 0; i < a.length; i++) if (a[i] & b[i]) return false; return true; }
  function bFull(P) { const b = new Uint32Array(Math.ceil(P.length / 32)); for (let i = 0; i < P.length; i++) b[i >> 5] |= (1 << (i & 31)); return b; }
  function bList(a) { const out = []; for (let i = 0; i < a.length * 32; i++) if (a[i >> 5] >>> (i & 31) & 1) out.push(i); return out; }

  const ORDER = {
    1: { n: [3], m: [2], w: { lt: 1 }, worlds: [1, 2], dmin: 2, direct: 0 },
    2: { n: [4], m: [3], w: { lt: 70, top: 15, bot: 15 }, worlds: [1, 3], dmin: 2, direct: 1 },
    3: { n: [4, 5], m: [3, 4], w: { lt: 45, chain: 15, top: 5, bot: 5, ntop: 10, nbot: 10, pos: 10 }, worlds: [2, 5], dmin: 2, direct: 1 },
    4: { n: [5], m: [4, 5], w: { lt: 35, chain: 20, ntop: 10, nbot: 10, pos: 15, top: 5, bot: 5 }, worlds: [2, 6], dmin: 3, direct: 2 },
    5: { n: [5, 6], m: [5], w: { lt: 25, chain: 15, adj: 15, next: 10, btw: 15, ntop: 5, nbot: 5, pos: 10 }, worlds: [2, 6], dmin: 3, direct: 2 }
  };

  function genOrder(r, level, relax, plan) {
    const sp = ORDER[level], n = pick(r, sp.n), m = pick(r, sp.m);
    const themeName = pick(r, ['height', 'age', 'race']), theme = THEMES[themeName], race = themeName === 'race';
    const N = shuffle(r, NAMES).slice(0, n);
    const hidden = shuffle(r, range(n)), hpos = new Array(n);
    hidden.forEach((p, i) => { hpos[p] = i; });
    const tKeys = Object.keys(sp.w), tW = tKeys.map(x => sp.w[x]);
    const clues = [], keys = {};
    let direct = 0, near = 0;
    for (let guard = 0; clues.length < m && guard < 60; guard++) {
      const c = makeClue(r, tKeys[wpick(r, tW)], hidden, hpos, n, race);
      if (!c || keys[clueKey(c)]) continue;
      if (c.t === 'top' || c.t === 'bot' || c.t === 'pos') { if (direct >= sp.direct) continue; direct++; }
      if (c.t === 'adj' || c.t === 'next') { if (near >= 2) continue; near++; }
      keys[clueKey(c)] = 1; clues.push(c);
    }
    if (clues.length < m) return null;
    const mentioned = {};
    clues.forEach(c => { mentioned[c.a] = 1; if (c.b !== undefined) mentioned[c.b] = 1; if (c.c !== undefined) mentioned[c.c] = 1; });
    if (Object.keys(mentioned).length < n) return null;

    const P = perms(n), cb = clues.map(c => bitsOf(P, n, c));
    const subBits = [bFull(P)];
    for (let mask = 1; mask < (1 << m); mask++) { const low = mask & -mask, i = 31 - Math.clz32(low); subBits.push(bAnd(subBits[mask ^ low], cb[i])); }
    const all = subBits[(1 << m) - 1], count = bCount(all);
    if (count < sp.worlds[0] || count > sp.worlds[1]) return null;
    for (let i = 0; i < m; i++) if (bCount(subBits[((1 << m) - 1) ^ (1 << i)]) === count) return null;

    const mode = level >= 4 && plan.cannot && relax < 2 ? 'cannot' : 'must';
    const dmin = Math.max(2, sp.dmin - relax);
    const cands = [];
    function cand(st, type, feats) {
      if (keys[clueKey(st)]) return;
      const bits = bitsOf(P, n, st);
      const c = { st: st, type: type, feats: [type].concat(feats), bits: bits, group: Array.prototype.join.call(bits, ','), text: theme.say(st, N, n) };
      c.forced = bSubset(all, bits); c.impossible = bDisjoint(all, bits);
      c.single = cb.some(x => bSubset(x, bits) || bDisjoint(x, bits));
      cands.push(c);
    }
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) if (a !== b) cand({ t: 'lt', a: a, b: b, v: ri(r, 2) }, 'lt', ['x:' + a, 'x:' + b]);
      cand({ t: 'top', a: a }, 'ext', ['x:' + a, 'e:top']);
      cand({ t: 'bot', a: a }, 'ext', ['x:' + a, 'e:bot']);
      cand({ t: 'ntop', a: a }, 'nxt', ['x:' + a, 'e:top']);
      cand({ t: 'nbot', a: a }, 'nxt', ['x:' + a, 'e:bot']);
      for (let k = 1; k < n - 1; k++) cand({ t: 'pos', a: a, k: k, v: race ? 0 : posEnd(r, k, n) }, 'pos', ['x:' + a, 'k:' + k]);
      if (level === 5) for (let b = 0; b < n; b++) {
        if (a < b) cand({ t: 'adj', a: a, b: b }, 'adj', ['x:' + a, 'x:' + b]);
        if (race && a !== b) cand({ t: 'next', a: a, b: b, v: ri(r, 2) }, 'next', ['x:' + a, 'x:' + b]);
      }
    }
    const answers = cands.filter(c => mode === 'must' ? c.forced : c.impossible);
    answers.forEach(c => { c.sub = minSubset(m, mask => mode === 'must' ? bSubset(subBits[mask], c.bits) : bDisjoint(subBits[mask], c.bits)); });
    const good = answers.filter(c => c.sub.size >= dmin);
    if (!good.length) return null;
    const types = good.map(c => c.type).filter((t, i, a) => a.indexOf(t) === i);
    const type = answerType(r, types, 'order', level, mode);
    const ofType = good.filter(c => c.type === type);
    const ans = ofType[wpick(r, ofType.map(c => c.sub.size * c.sub.size))];

    const groupCount = list => list.map(c => c.group).filter((g, i, a) => g !== ans.group && a.indexOf(g) === i).length;
    let pool = cands.filter(c => c !== ans && (mode === 'must' ? !c.forced : !c.impossible));
    // Options that one statement settles on its own are dropped, except those of the same kind as the answer.
    const strong = pool.filter(c => !c.single || c.type === ans.type);
    if (groupCount(strong) >= 6) pool = strong;
    if (groupCount(pool) < 4) return null;
    // "Open" options are true in some possible orders and false in others. Where the order is not
    // fully fixed, at least two wrong options are open ones.
    const isOpen = c => !c.forced && !c.impossible;
    const open = groupCount(pool.filter(isOpen));
    if (level >= 3 && open < 2) return null;
    const needOpen = Math.min(level >= 3 ? 2 : 1, open);
    const four = chooseOptions(r, ans, pool, priorFor('order', level, mode), f => f.filter(isOpen).length >= needOpen);
    if (!four) return null;
    const opts = shuffle(r, [ans].concat(four)), ai = opts.indexOf(ans), L = LETTERS[ai];

    const worldIdx = bList(all), rows = worldIdx.map(i => P[i].order.map(p => N[p]));
    const one = count === 1;
    const notes = opts.map((c, i) => {
      if (i === ai) return mode === 'must' ? (one ? 'True in that order.' : 'True in every one of these orders.') : (one ? 'False in that order.' : 'False in every one of these orders.');
      if (mode === 'must') {
        if (c.impossible) return one ? 'False in that order.' : 'False in every one of these orders.';
        return 'False in order ' + (1 + worldIdx.findIndex(x => !(c.bits[x >> 5] >>> (x & 31) & 1))) + '.';
      }
      return one ? 'True in that order.' : 'True in order ' + (1 + worldIdx.findIndex(x => c.bits[x >> 5] >>> (x & 31) & 1)) + '.';
    });
    const blocks = [
      { t: 'p', text: one ? 'Only one order fits every statement:' : 'Only these ' + NUM[count] + ' orders fit every statement:' },
      { t: 'orders', label: theme.label, rows: rows },
      { t: 'p', text: 'Option ' + L + (mode === 'must' ? ' is true in ' : ' is false in ') + (one ? 'that order' : count === 2 ? 'both' : 'all of them') + '. ' +
          enoughText(ans.sub, m, mode === 'must' ? 'force it' : 'rule it out') },
      { t: 'options', notes: notes }
    ];
    return {
      form: 'order', mode: mode, intro: theme.intro(n),
      premises: clues.map(c => theme.say(c, N, n)),
      options: opts.map(c => c.text), answer: ai, explain: blocks,
      meta: { types: opts.map(c => c.type), feats: opts.map(c => c.feats), depth: ans.sub.size, worlds: count },
      check: { orders: rows }
    };
  }

  // =====================================================================
  // 3. TRUTH AND LIES
  // =====================================================================
  // A world is a bit mask: bit i set means person i is a truth-teller.
  function truthEval(st, world, n) {
    const t = i => (world >> i & 1) === 1;
    switch (st.k) {
      case 'is': return t(st.x) === st.v;
      case 'same': return t(st.x) === t(st.y);
      case 'diff': return t(st.x) !== t(st.y);
      case 'both': return t(st.x) === st.v && t(st.y) === st.v;
      case 'exact': return n - popcount(world) === st.c;
      case 'atleast': return n - popcount(world) >= st.c;
    }
    return false;
  }
  // Text of a statement. me = index of the speaker, or -1 for an option written about "them".
  function truthText(st, N, n, me) {
    const who = i => i === me ? 'I' : N[i];
    const pair = () => st.y === me ? N[st.x] + ' and I' : st.x === me ? N[st.y] + ' and I' : N[st.x] + ' and ' + N[st.y];
    const us = me >= 0 ? 'us' : 'them', group = 'the ' + NUM[n] + ' of ' + us;
    switch (st.k) {
      case 'is': return who(st.x) + (st.v ? ' tells the truth.' : ' is a liar.');
      case 'same': return pair() + ' are the same kind.';
      case 'diff': return pair() + ' are different kinds.';
      case 'both': return pair() + (st.v ? ' both tell the truth.' : ' are both liars.');
      case 'exact':
        if (st.c === 0) return 'All ' + NUM[n] + ' of ' + us + ' tell the truth.';
        if (st.c === n) return 'All ' + NUM[n] + ' of ' + us + ' are liars.';
        return 'Exactly ' + NUM[st.c] + ' of ' + group + (st.c === 1 ? ' is a liar.' : ' are liars.');
      case 'atleast': return 'At least ' + NUM[st.c] + ' of ' + group + (st.c === 1 ? ' is a liar.' : ' are liars.');
    }
  }
  function makeSaying(r, type, i, n) {
    const others = range(n).filter(j => j !== i), x = pick(r, others);
    switch (type) {
      case 'is': return { k: 'is', x: x, v: r() < 0.4 };
      case 'relMe': return { k: r() < 0.5 ? 'same' : 'diff', x: x, y: i };
      case 'rel': { if (n < 3) return null; const two = shuffle(r, others); return { k: r() < 0.5 ? 'same' : 'diff', x: Math.min(two[0], two[1]), y: Math.max(two[0], two[1]) }; }
      case 'bothMe': return { k: 'both', x: x, y: i, v: r() < 0.25 };
      case 'both': { if (n < 3) return null; const two = shuffle(r, others); return { k: 'both', x: Math.min(two[0], two[1]), y: Math.max(two[0], two[1]), v: r() < 0.35 }; }
      case 'count': { if (n < 3) return null; return r() < 0.6 ? { k: 'exact', c: ri(r, n + 1) } : { k: 'atleast', c: 1 + ri(r, n - 1) }; }
    }
    return null;
  }
  const TRUTH = {
    1: { n: 2, w: { is: 55, relMe: 20, bothMe: 25 }, worlds: [1, 2], dmin: 2 },
    2: { n: 3, w: { is: 65, both: 25, rel: 10 }, worlds: [1, 1], dmin: 2 },
    3: { n: 3, w: { is: 35, relMe: 20, rel: 15, both: 15, bothMe: 15 }, worlds: [1, 2], dmin: 2, need: ['relMe', 'bothMe', 'rel'] },
    4: { n: 3, w: { is: 25, count: 35, both: 10, bothMe: 10, rel: 10, relMe: 10 }, worlds: [1, 2], dmin: 3, need: ['count'] },
    5: { n: 4, w: { is: 25, count: 25, both: 15, bothMe: 10, rel: 15, relMe: 10 }, worlds: [1, 3], dmin: 3, need: ['count', 'relMe', 'bothMe'] }
  };

  function genTruth(r, level, relax, plan) {
    const sp = TRUTH[level], n = sp.n, W = 1 << n;
    const wantSeveral = sp.worlds[1] > 1 && level >= 3 && plan.several;   // some puzzles leave two or three combinations open
    const N = shuffle(r, NAMES).slice(0, n);
    const tKeys = Object.keys(sp.w), tW = tKeys.map(x => sp.w[x]);
    const says = [], kinds = [];
    for (let i = 0; i < n; i++) {
      let s = null, type = '';
      for (let guard = 0; !s && guard < 20; guard++) { type = tKeys[wpick(r, tW)]; s = makeSaying(r, type, i, n); }
      if (!s) return null;
      says.push(s); kinds.push(type);
    }
    if (sp.need && !kinds.some(x => sp.need.indexOf(x) >= 0)) return null;
    const texts = says.map((s, i) => truthText(s, N, n, i));
    if (texts.some((t, i) => texts.indexOf(t) !== i)) return null;
    // ok[i] = worlds where person i's statement fits person i's kind
    const ok = says.map((s, i) => { let b = 0; for (let wd = 0; wd < W; wd++) if (((wd >> i & 1) === 1) === truthEval(s, wd, n)) b |= (1 << wd); return b; });
    const subBits = [(W === 16 ? 0xFFFF : (1 << W) - 1)];
    for (let mask = 1; mask < (1 << n); mask++) { const low = mask & -mask, i = 31 - Math.clz32(low); subBits.push(subBits[mask ^ low] & ok[i]); }
    const all = subBits[(1 << n) - 1], count = popcount(all);
    if (count < sp.worlds[0] || count > sp.worlds[1]) return null;
    if (wantSeveral ? relax < 2 && count < 2 : count > 1 && level >= 3 && relax < 1) return null;
    for (let i = 0; i < n; i++) if (subBits[((1 << n) - 1) ^ (1 << i)] === all) return null;

    const mode = level >= 4 && plan.cannot && relax < 2 ? 'cannot' : 'must';
    const dmin = Math.max(1, sp.dmin - relax);
    const cands = [];
    function cand(st, type, feats) {
      let bits = 0;
      for (let wd = 0; wd < W; wd++) if (truthEval(st, wd, n)) bits |= (1 << wd);
      cands.push({ st: st, type: type, feats: [type].concat(feats), bits: bits, group: 'g' + bits, text: truthText(st, N, n, -1),
        forced: (all & ~bits) === 0, impossible: (all & bits) === 0 });
    }
    for (let x = 0; x < n; x++) {
      cand({ k: 'is', x: x, v: true }, 'is', ['x:' + x, 'v:t']);
      cand({ k: 'is', x: x, v: false }, 'is', ['x:' + x, 'v:l']);
      for (let y = x + 1; y < n; y++) {
        cand({ k: 'same', x: x, y: y }, 'rel', ['x:' + x, 'x:' + y, 'r:same']);
        cand({ k: 'diff', x: x, y: y }, 'rel', ['x:' + x, 'x:' + y, 'r:diff']);
        cand({ k: 'both', x: x, y: y, v: true }, 'both', ['x:' + x, 'x:' + y, 'v:t']);
        cand({ k: 'both', x: x, y: y, v: false }, 'both', ['x:' + x, 'x:' + y, 'v:l']);
      }
    }
    if (n >= 3) for (let c = 0; c <= n; c++) cand({ k: 'exact', c: c }, 'count', ['c:' + c]);
    const answers = cands.filter(c => mode === 'must' ? c.forced : c.impossible);
    answers.forEach(c => { c.sub = minSubset(n, mask => mode === 'must' ? (subBits[mask] & ~c.bits) === 0 : (subBits[mask] & c.bits) === 0); });
    const good = answers.filter(c => c.sub && c.sub.size >= dmin);
    if (!good.length) return null;
    const types = good.map(c => c.type).filter((t, i, a) => a.indexOf(t) === i);
    const type = answerType(r, types, 'truth', level, mode);
    const ofType = good.filter(c => c.type === type);
    const ans = ofType[wpick(r, ofType.map(c => c.sub.size * c.sub.size))];
    const pool = cands.filter(c => c !== ans && (mode === 'must' ? !c.forced : !c.impossible));
    const groupCount = list => list.map(c => c.group).filter((g, i, a) => g !== ans.group && a.indexOf(g) === i).length;
    if (groupCount(pool) < 4) return null;
    const isOpen = c => !c.forced && !c.impossible;
    const needOpen = Math.min(2, groupCount(pool.filter(isOpen)));
    const four = chooseOptions(r, ans, pool, priorFor('truth', level, mode), f => f.filter(isOpen).length >= needOpen);
    if (!four) return null;
    const opts = shuffle(r, [ans].concat(four)), ai = opts.indexOf(ans), L = LETTERS[ai];

    // explanation: every combination, and why it fails
    const rows = [], working = [];
    for (let wd = W - 1; wd >= 0; wd--) {
      const row = { kinds: range(n).map(i => (wd >> i & 1) ? 'T' : 'L'), ok: (all >> wd & 1) === 1, who: -1, why: '' };
      if (row.ok) { working.push(wd); row.why = 'Works: every statement fits.'; }
      else {
        const i = range(n).find(j => !(ok[j] >> wd & 1));
        row.who = i;
        row.why = N[i] + ((wd >> i & 1) ? ' would be lying.' : ' would be honest.');
      }
      rows.push(row);
    }
    const one = count === 1, where = one ? 'the combination that works' : 'every combination that works';
    const rowNo = wd => 1 + (W - 1 - wd);
    const notes = opts.map((c, i) => {
      if (i === ai) return (mode === 'must' ? 'True in ' : 'False in ') + where + '.';
      if (mode === 'must') {
        if (c.impossible) return 'False in ' + where + '.';
        return 'False in row ' + rowNo(working.find(wd => !(c.bits >> wd & 1))) + ', which works.';
      }
      return 'True in row ' + rowNo(working.find(wd => c.bits >> wd & 1)) + ', which works.';
    });
    const blocks = [
      { t: 'p', text: 'Try every combination. A combination works only if each truth-teller’s statement is true and each liar’s statement is false. The first person who breaks that rule is marked.' },
      { t: 'table', people: N, rows: rows },
      { t: 'p', text: (one ? 'Only one combination works' : cap(NUM[count]) + ' combinations work') + ', and option ' + L + (mode === 'must' ? ' is true in ' : ' is false in ') +
          (one ? 'it' : count === 2 ? 'both' : 'all of them') + '.' },
      { t: 'options', notes: notes }
    ];
    return {
      form: 'truth', mode: mode,
      intro: cap(NUM[n]) + ' people each say one thing. Each of them is either a truth-teller, who always tells the truth, or a liar, who always lies.',
      premises: says.map((s, i) => N[i] + ' says: “' + texts[i] + '”'),
      options: opts.map(c => c.text), answer: ai, explain: blocks,
      meta: { types: opts.map(c => c.type), feats: opts.map(c => c.feats), depth: ans.sub.size, worlds: count },
      check: { rows: rows.map(x => ({ kinds: x.kinds.join(''), ok: x.ok })) }
    };
  }

  // =====================================================================
  // 4. MATCHING: who has what (each person has exactly one of each kind, nobody shares)
  // =====================================================================
  const MATCH_CATS = {
    pet: { noun: 'pet', each: 'own', also: 'owns', pos: 'owns the ', neg: 'does not own the ', art: 'a ', orArt: 'the ', holder: 'owner', items: ['cat', 'dog', 'fish', 'bird', 'rabbit'] },
    drink: { noun: 'drink', each: 'have', also: 'has', pos: 'drinks ', neg: 'does not drink ', art: '', orArt: '', holder: 'drinker', items: ['tea', 'coffee', 'juice', 'milk', 'water'] },
    instrument: { noun: 'instrument', each: 'play', also: 'plays', pos: 'plays the ', neg: 'does not play the ', art: 'the ', orArt: 'the ', holder: 'player', items: ['piano', 'cello', 'flute', 'guitar', 'violin'] }
  };
  // Every possible world for n people and k kinds of thing: w[c][person] = index of the item they have.
  const MATCH_SPACE = {};
  function matchSpace(n, k) {
    const id = n + '/' + k;
    if (MATCH_SPACE[id]) return MATCH_SPACE[id];
    const P = perms(n).map(x => x.order), W = [];
    if (k === 1) P.forEach(a => W.push([a])); else P.forEach(a => P.forEach(b => W.push([a, b])));
    return (MATCH_SPACE[id] = { W: W, memo: {} });
  }
  function matchEval(st, w) {
    switch (st.t) {
      case 'is': return w[st.c][st.p] === st.i;
      case 'not': return w[st.c][st.p] !== st.i;
      case 'either': return w[st.c][st.p] === st.i || w[st.c][st.q] === st.i;
      case 'oneOf': return w[st.c][st.p] === st.i || w[st.c][st.p] === st.j;
      case 'link': return w[1][w[0].indexOf(st.i)] === st.j;      // the owner of item i (first kind) has item j (second kind)
      case 'nlink': return w[1][w[0].indexOf(st.i)] !== st.j;
    }
    return false;
  }
  const matchKey = st => st.t === 'link' || st.t === 'nlink' ? st.t + st.i + '.' + st.j
    : st.t + st.c + ':' + (st.t === 'either' ? Math.min(st.p, st.q) + '|' + Math.max(st.p, st.q) : st.p) + ':' + (st.t === 'oneOf' ? Math.min(st.i, st.j) + '|' + Math.max(st.i, st.j) : st.i);
  function matchBits(space, st) {
    const id = matchKey(st);
    if (space.memo[id]) return space.memo[id];
    const W = space.W, b = new Uint32Array(Math.ceil(W.length / 32));
    for (let x = 0; x < W.length; x++) if (matchEval(st, W[x])) b[x >> 5] |= (1 << (x & 31));
    return (space.memo[id] = b);
  }
  function matchText(st, N, C, items) {
    if (st.t === 'link' || st.t === 'nlink') {
      const a = st.v ? 1 : 0, b = 1 - a, ia = a ? st.j : st.i, ib = a ? st.i : st.j;
      return 'The ' + items[a][ia] + ' ' + C[a].holder + ' ' + (st.t === 'link' ? C[b].pos : C[b].neg) + items[b][ib] + '.';
    }
    const c = C[st.c], it = items[st.c];
    if (st.t === 'is') return N[st.p] + ' ' + c.pos + it[st.i] + '.';
    if (st.t === 'not') return N[st.p] + ' ' + c.neg + it[st.i] + '.';
    if (st.t === 'either') return 'Either ' + N[st.p] + ' or ' + N[st.q] + ' ' + c.pos + it[st.i] + '.';
    return N[st.p] + ' ' + c.pos + it[st.i] + ' or ' + c.orArt + it[st.j] + '.';
  }
  function matchClue(r, type, h, n, k) {
    const p = ri(r, n), c = ri(r, k), other = x => { let y; do { y = ri(r, n); } while (y === x); return y; };
    switch (type) {
      case 'is': return { t: 'is', c: c, p: p, i: h[c][p] };
      case 'not': return { t: 'not', c: c, p: p, i: other(h[c][p]) };
      case 'either': return ri(r, 2) ? { t: 'either', c: c, p: p, q: other(p), i: h[c][p] } : { t: 'either', c: c, p: other(p), q: p, i: h[c][p] };
      case 'oneOf': return ri(r, 2) ? { t: 'oneOf', c: c, p: p, i: h[c][p], j: other(h[c][p]) } : { t: 'oneOf', c: c, p: p, i: other(h[c][p]), j: h[c][p] };
      case 'link': return k < 2 ? null : { t: 'link', i: h[0][p], j: h[1][p], v: ri(r, 2) };
      case 'nlink': return k < 2 ? null : { t: 'nlink', i: h[0][p], j: other(h[1][p]), v: ri(r, 2) };
    }
    return null;
  }
  const MATCH = {
    1: { n: 3, k: 1, m: [2], w: { not: 60, is: 40 }, worlds: [1, 2], dmin: 2, direct: 1 },
    2: { n: 4, k: 1, m: [3], w: { not: 50, is: 25, either: 25 }, worlds: [1, 4], dmin: 2, direct: 1 },
    3: { n: 4, k: 1, m: [4], w: { not: 45, either: 25, oneOf: 20, is: 10 }, worlds: [1, 3], dmin: 3, direct: 1 },
    4: { n: 3, k: 2, m: [4, 5], w: { link: 30, nlink: 20, not: 25, is: 15, either: 10 }, worlds: [1, 4], dmin: 3, direct: 1 },
    5: { n: 4, k: 2, m: [5, 6], w: { link: 25, nlink: 25, not: 20, either: 10, oneOf: 10, is: 10 }, worlds: [1, 6], dmin: 4, direct: 2 }
  };

  function genMatch(r, level, relax, plan) {
    const sp = MATCH[level], n = sp.n, k = sp.k, m = pick(r, sp.m);
    const N = shuffle(r, NAMES).slice(0, n);
    const C = shuffle(r, Object.keys(MATCH_CATS)).slice(0, k).map(x => MATCH_CATS[x]);
    const items = C.map(c => shuffle(r, c.items).slice(0, n));
    const space = matchSpace(n, k), W = space.W, h = W[ri(r, W.length)];
    const tKeys = Object.keys(sp.w), tW = tKeys.map(x => sp.w[x]);
    const clues = [], keys = {};
    let direct = 0;
    for (let guard = 0; clues.length < m && guard < 80; guard++) {
      const c = matchClue(r, tKeys[wpick(r, tW)], h, n, k);
      if (!c || keys[matchKey(c)]) continue;
      if (c.t === 'is') { if (direct >= sp.direct) continue; direct++; }
      keys[matchKey(c)] = 1; clues.push(c);
    }
    if (clues.length < m) return null;
    if (k === 2 && !clues.some(c => c.t === 'link' || c.t === 'nlink')) return null;
    // "Nia drinks coffee or water" next to "Nia does not drink coffee" is just a clumsy "Nia drinks water"
    if (clues.some(a => a.t === 'oneOf' && clues.some(b => b.t === 'not' && b.c === a.c && b.p === a.p && (b.i === a.i || b.i === a.j)))) return null;
    const cb = clues.map(c => matchBits(space, c));
    const subBits = [bFull(W)];
    for (let mask = 1; mask < (1 << m); mask++) { const low = mask & -mask, i = 31 - Math.clz32(low); subBits.push(bAnd(subBits[mask ^ low], cb[i])); }
    const all = subBits[(1 << m) - 1], count = bCount(all);
    if (count < sp.worlds[0] || count > sp.worlds[1]) return null;
    for (let i = 0; i < m; i++) if (bCount(subBits[((1 << m) - 1) ^ (1 << i)]) === count) return null;

    const mode = level >= 4 && plan.cannot && relax < 2 ? 'cannot' : 'must';
    const dmin = Math.max(2, sp.dmin - relax);
    const cands = [];
    function cand(st, type, feats) {
      if (keys[matchKey(st)]) return;
      const bits = matchBits(space, st);
      const c = { st: st, type: type, feats: [type].concat(feats), bits: bits, group: Array.prototype.join.call(bits, ','), text: matchText(st, N, C, items) };
      c.forced = bSubset(all, bits); c.impossible = bDisjoint(all, bits);
      c.single = cb.some(x => bSubset(x, bits) || bDisjoint(x, bits));
      cands.push(c);
    }
    for (let c = 0; c < k; c++) for (let p = 0; p < n; p++) for (let i = 0; i < n; i++) {
      cand({ t: 'is', c: c, p: p, i: i }, 'is', ['x:' + p, 'i:' + c + '.' + i]);
      cand({ t: 'not', c: c, p: p, i: i }, 'not', ['x:' + p, 'i:' + c + '.' + i]);
    }
    if (k === 2) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      cand({ t: 'link', i: i, j: j, v: ri(r, 2) }, 'link', ['i:0.' + i, 'i:1.' + j]);
      cand({ t: 'nlink', i: i, j: j, v: ri(r, 2) }, 'nlink', ['i:0.' + i, 'i:1.' + j]);
    }
    const answers = cands.filter(c => mode === 'must' ? c.forced : c.impossible);
    answers.forEach(c => { c.sub = minSubset(m, mask => mode === 'must' ? bSubset(subBits[mask], c.bits) : bDisjoint(subBits[mask], c.bits)); });
    const good = answers.filter(c => c.sub.size >= dmin);
    if (!good.length) return null;
    const types = good.map(c => c.type).filter((t, i, a) => a.indexOf(t) === i);
    const type = answerType(r, types, 'match', level, mode);
    const ofType = good.filter(c => c.type === type);
    const ans = ofType[wpick(r, ofType.map(c => c.sub.size * c.sub.size))];

    const groupCount = list => list.map(c => c.group).filter((g, i, a) => g !== ans.group && a.indexOf(g) === i).length;
    let pool = cands.filter(c => c !== ans && (mode === 'must' ? !c.forced : !c.impossible));
    const strong = pool.filter(c => !c.single || c.type === ans.type);
    if (groupCount(strong) >= 6) pool = strong;
    if (groupCount(pool) < 4) return null;
    const isOpen = c => !c.forced && !c.impossible;
    const open = groupCount(pool.filter(isOpen));
    if (level >= 3 && count > 1 && open < 2) return null;
    const needOpen = Math.min(2, open);
    const four = chooseOptions(r, ans, pool, priorFor('match', level, mode), f => f.filter(isOpen).length >= needOpen);
    if (!four) return null;
    const opts = shuffle(r, [ans].concat(four)), ai = opts.indexOf(ans), L = LETTERS[ai];

    const worldIdx = bList(all), one = count === 1;
    const rows = worldIdx.map(x => range(n).map(p => range(k).map(c => items[c][W[x][c][p]])));
    const has = (c, x) => (c.bits[x >> 5] >>> (x & 31) & 1) === 1;
    const everyTxt = t => t + (one ? ' in that table.' : ' in every one of these tables.');
    const notes = opts.map((c, i) => {
      if (i === ai) return everyTxt(mode === 'must' ? 'True' : 'False');
      if (mode === 'must') return c.impossible ? everyTxt('False') : 'False in table ' + (1 + worldIdx.findIndex(x => !has(c, x))) + '.';
      return c.forced ? everyTxt('True') : 'True in table ' + (1 + worldIdx.findIndex(x => has(c, x))) + '.';
    });
    const list = (c, it) => listAnd(it.map(x => c.art + x));
    const intro = listAnd(N) + ' each ' + C[0].each + ' a different ' + C[0].noun + ': ' + list(C[0], items[0]) + '.'
      + (k === 2 ? ' Each also ' + C[1].also + ' a different ' + C[1].noun + ': ' + list(C[1], items[1]) + '.' : '');
    const blocks = [
      { t: 'p', text: one ? 'Only one way of sharing them out fits every statement:' : 'Only these ' + NUM[count] + ' ways of sharing them out fit every statement:' },
      { t: 'match', people: N, rows: rows.map(row => row.map(cell => cell.join(' + '))) },
      { t: 'p', text: 'Option ' + L + (mode === 'must' ? ' is true in ' : ' is false in ') + (one ? 'it' : count === 2 ? 'both' : 'all of them') + '. ' +
          enoughText(ans.sub, m, mode === 'must' ? 'force it' : 'rule it out') },
      { t: 'options', notes: notes }
    ];
    return {
      form: 'match', mode: mode, intro: intro,
      premises: clues.map(c => matchText(c, N, C, items)),
      options: opts.map(c => c.text), answer: ai, explain: blocks,
      meta: { types: opts.map(c => c.type), feats: opts.map(c => c.feats), depth: ans.sub.size, worlds: count },
      check: { tables: rows }
    };
  }

  // ---------- public ----------
  const GEN = { sets: genSets, order: genOrder, truth: genTruth, match: genMatch };
  function generate(level, seed) {
    level = Math.max(1, Math.min(5, Math.floor(level) || 1));
    seed = seed >>> 0;
    const form = FORMS[seed % FORMS.length];
    const r = rng((seed ^ Math.imul(level, 0x9E3779B1)) >>> 0);
    // Decided once per puzzle, so that these shares do not depend on how easy each kind is to build.
    const plan = { cannot: r() < 0.35, several: r() < 0.4 };
    for (let attempt = 0; attempt < 20000; attempt++) {
      const p = GEN[form](r, level, attempt < 300 ? 0 : attempt < 1500 ? 1 : 2, plan);
      if (!p) continue;
      p.level = level; p.seed = seed; p.code = 'D' + level + '-' + seed;
      p.question = QUESTION[p.mode];
      p.attempts = attempt + 1;
      return p;
    }
    throw new Error('Could not build puzzle D' + level + '-' + seed);
  }
  function parse(code) {
    const mt = /^\s*D([1-5])-(\d{1,10})\s*$/i.exec(String(code || ''));
    if (!mt) return null;
    const seed = Number(mt[2]);
    if (seed > 4294967295) return null;
    return { level: Number(mt[1]), seed: seed };
  }

  function theme(name) { if (name && SETS_THEMES[name]) SETS_THEME = name; return SETS_THEME; }
  const api = { generate: generate, parse: parse, FORMS: FORMS, FORM_NAMES: FORM_NAMES, theme: theme,
    _priors: function (p) { if (p) PRIORS = p; return PRIORS; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LogicEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
