// Tester: entydighed, graderingens korrekthed og hint-motorens sundhed.
const E = require('../engine.js'), H = require('../hints.js');
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FEJL:', m); } };
const N = +process.env.N || 25;
const stats = {};
for (const lv of ['easy', 'medium', 'hard', 'expert']) {
  let hit = 0, tot = 0, tms = 0, maxms = 0; const techs = {};
  for (let i = 0; i < N; i++) {
    const t = Date.now(); const g = E.generate(lv, 777 + i * 13); const ms = Date.now() - t; tms += ms; maxms = Math.max(maxms, ms); tot++;
    // 1) entydig løsning (uafhængig backtracking-tæller)
    const cnt = E.countSolutions(g.puzzle, 2);
    ok(cnt.count === 1, `${lv}#${i}: ${cnt.count} løsninger`);
    ok(cnt.solution.every((v, k) => v === g.solution[k]), `${lv}#${i}: facit afviger`);
    // 2) givne tal er konsistente med facit
    ok(g.puzzle.every((v, k) => !v || v === g.solution[k]), `${lv}#${i}: givne afviger fra facit`);
    // 3) grad
    if (g.grade.maxRank === E.LEVELS[lv].rank) hit++;
    ok(g.grade.solved, `${lv}#${i}: ikke løst med teknikker`);
    Object.keys(g.grade.counts).forEach(k => techs[k] = (techs[k] || 0) + g.grade.counts[k]);
    // 4) hint-motor: kør hele gåden hint for hint; hvert trin skal være sandt ift. facit
    const vals = g.puzzle.slice(), elim = new Array(81).fill(0); let steps = 0;
    while (vals.some(v => !v) && steps < 500) {
      const s = E.nextStep(vals, elim); steps++;
      if (!s || s.error) { ok(false, `${lv}#${i}: hint-motor gav ${JSON.stringify(s)}`); break; }
      const d = H.describe(s, vals);
      ok(d.text.length > 20 && d.nudge.length > 10, `${lv}#${i}: tom tekst for ${s.tech}`);
      if (s.place) {
        ok(g.solution[s.place.cell] === s.place.digit, `${lv}#${i}: ${s.tech} satte forkert tal`);
        vals[s.place.cell] = s.place.digit;
      }
      s.elims.forEach(e => {
        ok(!(E.BIT[g.solution[e.cell]] & e.mask), `${lv}#${i}: ${s.tech} fjernede det RIGTIGE tal i ${e.cell}`);
        elim[e.cell] |= e.mask;
      });
      ok(s.place || s.elims.length, `${lv}#${i}: tomt trin`);
    }
    ok(vals.every((v, k) => v === g.solution[k]), `${lv}#${i}: hint-kørsel nåede ikke facit`);
  }
  stats[lv] = { ramteNiveau: hit + '/' + tot, gnsMs: Math.round(tms / tot), maxMs: maxms, teknikker: techs };
}
console.log(JSON.stringify(stats, null, 1));

// 5) Teknik-enhedstest: kendte stillinger
const parse = s => s.replace(/[^0-9.]/g, '').split('').map(ch => ch === '.' ? 0 : +ch);
function need(name, str, tech) {
  const p = parse(str); const cnt = E.countSolutions(p, 2);
  const v = p.slice(), el = new Array(81).fill(0); let seen = false, guard = 0;
  while (v.some(x => !x) && guard++ < 400) {
    const s = E.nextStep(v, el); if (!s || s.error) break;
    if (s.tech === tech) seen = true;
    if (s.place) v[s.place.cell] = s.place.digit; s.elims.forEach(e => el[e.cell] |= e.mask);
  }
  console.log(name, 'løsninger:', cnt.count, 'brugte', tech + ':', seen, 'færdig:', v.every(x => x));
  ok(cnt.count === 1, name + ' ikke entydig');
}
// Kendte eksempler (fra sudokuwiki) – hvis en teknik ikke findes i netop disse, er det kun en info-linje
need('X-Wing-eks', '100000569492056108056109240009640801064010000218035604040500016905061402621000005', 'xwing');

// 6) Fuzz: Hver teknik køres enkeltvis på "fastlåste" stillinger (kun enkelte brugt) og skal være korrekt ift. facit.
const found = {}; let states = 0;
for (let i = 0; i < (+process.env.FUZZ || 120); i++) {
  const rnd = E.makeRng(9000 + i);
  const sol = E.randomSolution(rnd);
  // fjern tal tilfældigt så længe løsningen er entydig (hård gåde, mange teknikker kræves)
  const puz = sol.slice(); const order = Array.from({length: 81}, (_, k) => k).sort(() => rnd() - 0.5);
  for (const c of order) { const o = puz[c]; puz[c] = 0; if (E.countSolutions(puz, 2).count !== 1) puz[c] = o; }
  // løs med enkelte, standsning
  const vals = puz.slice(); let guard = 0;
  while (guard++ < 200) { const s = E.nextStep(vals, null, 1); if (!s) break; if (s.place) vals[s.place.cell] = s.place.digit; }
  states++;
  const cand = E.candidatesBasic(vals); const S = { vals, cand };
  E.TECHNIQUES.forEach(t => {
    const st = t.find(S); if (!st) return;
    found[t.id] = (found[t.id] || 0) + 1;
    st.elims.forEach(e => ok(!(E.BIT[sol[e.cell]] & e.mask), `fuzz ${t.id}: fjernede rigtigt tal i ${e.cell}`));
    if (st.place) ok(sol[st.place.cell] === st.place.digit, `fuzz ${t.id}: forkert placering`);
    ok(st.place || st.elims.length, `fuzz ${t.id}: tomt`);
    ok(H.describe(st, vals).text.length > 20, `fuzz ${t.id}: ingen tekst`);
  });
}
console.log('Fuzz-stillinger:', states, 'fundne teknikker (første fund pr. stilling):', JSON.stringify(found));
if (fail) { console.log(fail, 'fejl'); process.exit(1); } else console.log('ALT OK');
