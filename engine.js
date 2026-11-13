/* Sudoku-motor: generator, løser og hint-motor (ingen afhængigheder).
   Felter er indekseret 0..80 (række*9+kolonne). Tal 1..9 gemmes som bitmasker (1<<(d-1)). */
(function (root) {
  'use strict';

  var ALL = 511;
  var BIT = [0, 1, 2, 4, 8, 16, 32, 64, 128, 256];
  var POP = new Uint8Array(512);
  for (var i = 1; i < 512; i++) POP[i] = POP[i >> 1] + (i & 1);

  var ROW = function (c) { return (c / 9) | 0; };
  var COL = function (c) { return c % 9; };
  var BOX = function (c) { return ((ROW(c) / 3) | 0) * 3 + ((COL(c) / 3) | 0); };

  // Enheder: 0-8 rækker, 9-17 kolonner, 18-26 bokse
  var UNITS = [];
  var r, c, k;
  for (r = 0; r < 9; r++) { var a = []; for (c = 0; c < 9; c++) a.push(r * 9 + c); UNITS.push(a); }
  for (c = 0; c < 9; c++) { var b = []; for (r = 0; r < 9; r++) b.push(r * 9 + c); UNITS.push(b); }
  for (var bx = 0; bx < 9; bx++) {
    var d = [];
    for (k = 0; k < 9; k++) d.push(((((bx / 3) | 0) * 3) + ((k / 3) | 0)) * 9 + (bx % 3) * 3 + (k % 3));
    UNITS.push(d);
  }
  var PEERS = [], PEERSET = [];
  for (var cc = 0; cc < 81; cc++) {
    var set = {};
    [ROW(cc), 9 + COL(cc), 18 + BOX(cc)].forEach(function (u) {
      UNITS[u].forEach(function (x) { if (x !== cc) set[x] = true; });
    });
    PEERS.push(Object.keys(set).map(Number));
    PEERSET.push(set);
  }
  function sees(a, b) { return a !== b && PEERSET[a][b] === true; }

  function digitsOf(mask) {
    var out = [];
    for (var d = 1; d <= 9; d++) if (mask & BIT[d]) out.push(d);
    return out;
  }

  // ---------- Tilfældighed ----------
  function makeRng(seed) {
    if (seed === undefined) return Math.random;
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = (rnd() * (i + 1)) | 0, t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // ---------- Backtracking-løser (til entydighed og facit) ----------
  function candidatesBasic(vals) {
    var cand = new Array(81), cell;
    var rowM = new Array(9).fill(0), colM = new Array(9).fill(0), boxM = new Array(9).fill(0);
    for (cell = 0; cell < 81; cell++) {
      if (vals[cell]) { var bt = BIT[vals[cell]]; rowM[ROW(cell)] |= bt; colM[COL(cell)] |= bt; boxM[BOX(cell)] |= bt; }
    }
    for (cell = 0; cell < 81; cell++) {
      cand[cell] = vals[cell] ? 0 : (ALL & ~(rowM[ROW(cell)] | colM[COL(cell)] | boxM[BOX(cell)]));
    }
    return cand;
  }

  // Tæller løsninger (op til limit). Returnerer {count, solution}
  function countSolutions(vals, limit, rnd) {
    var v = vals.slice();
    var rowM = new Array(9).fill(0), colM = new Array(9).fill(0), boxM = new Array(9).fill(0);
    var cell;
    for (cell = 0; cell < 81; cell++) {
      if (v[cell]) {
        var bt = BIT[v[cell]];
        if ((rowM[ROW(cell)] | colM[COL(cell)] | boxM[BOX(cell)]) & bt) return { count: 0, solution: null };
        rowM[ROW(cell)] |= bt; colM[COL(cell)] |= bt; boxM[BOX(cell)] |= bt;
      }
    }
    var count = 0, solution = null;
    function rec() {
      var best = -1, bestMask = 0, bestN = 10;
      for (var c2 = 0; c2 < 81; c2++) {
        if (v[c2]) continue;
        var m = ALL & ~(rowM[ROW(c2)] | colM[COL(c2)] | boxM[BOX(c2)]);
        var n = POP[m];
        if (n === 0) return;
        if (n < bestN) { bestN = n; best = c2; bestMask = m; if (n === 1) break; }
      }
      if (best < 0) { count++; if (!solution) solution = v.slice(); return; }
      var ds = digitsOf(bestMask);
      if (rnd) shuffle(ds, rnd);
      var rr = ROW(best), cl = COL(best), bb = BOX(best);
      for (var i2 = 0; i2 < ds.length; i2++) {
        var dd = ds[i2], bit = BIT[dd];
        v[best] = dd; rowM[rr] |= bit; colM[cl] |= bit; boxM[bb] |= bit;
        rec();
        v[best] = 0; rowM[rr] &= ~bit; colM[cl] &= ~bit; boxM[bb] &= ~bit;
        if (count >= limit) return;
      }
    }
    rec();
    return { count: count, solution: solution };
  }

  function randomSolution(rnd) {
    return countSolutions(new Array(81).fill(0), 1, rnd).solution;
  }

  // ---------- Teknikker ----------
  // Hver finder får S = {vals, cand} og returnerer et trin eller null.
  // Trin: {tech, units:[enhed...], cells:[årsagsfelter], digits:maske, place:{cell,digit}|null,
  //        elims:[{cell,mask}], extra:{...}}
  function unitName(u) {
    if (u < 9) return { type: 'row', n: u + 1 };
    if (u < 18) return { type: 'col', n: u - 9 + 1 };
    return { type: 'box', n: u - 18 };
  }

  function posMask(S, unit, d) {      // hvilke pladser i enheden kan d stå på (bitmaske over 0..8)
    var m = 0, cells = UNITS[unit], bit = BIT[d];
    for (var i = 0; i < 9; i++) if (S.cand[cells[i]] & bit) m |= (1 << i);
    return m;
  }

  function findNakedSingle(S) {
    for (var c = 0; c < 81; c++) {
      if (!S.vals[c] && POP[S.cand[c]] === 1) {
        var d = digitsOf(S.cand[c])[0];
        return { tech: 'nakedSingle', units: [], cells: [c], digits: BIT[d], place: { cell: c, digit: d }, elims: [] };
      }
    }
    return null;
  }

  function findHiddenSingle(S) {
    var order = [];
    var u;
    for (u = 18; u < 27; u++) order.push(u);
    for (u = 0; u < 18; u++) order.push(u);
    for (var oi = 0; oi < order.length; oi++) {
      u = order[oi];
      for (var d = 1; d <= 9; d++) {
        var pm = posMask(S, u, d);
        if (pm && POP[pm] === 1) {
          var idx = 0; while (!(pm & (1 << idx))) idx++;
          var cell = UNITS[u][idx];
          if (S.vals[cell]) continue;
          return { tech: 'hiddenSingle', units: [u], cells: [cell], digits: BIT[d], place: { cell: cell, digit: d }, elims: [] };
        }
      }
    }
    return null;
  }

  function combos(arr, n, fn) {
    var idx = [];
    function rec(start) {
      if (idx.length === n) { return fn(idx.map(function (i) { return arr[i]; })); }
      for (var i = start; i < arr.length; i++) {
        idx.push(i);
        var r2 = rec(i + 1);
        idx.pop();
        if (r2) return r2;
      }
      return null;
    }
    return rec(0);
  }

  function findNakedSubset(n) {
    var name = ['', '', 'nakedPair', 'nakedTriple', 'nakedQuad'][n];
    return function (S) {
      for (var u = 0; u < 27; u++) {
        var cells = UNITS[u].filter(function (c) { return !S.vals[c] && POP[S.cand[c]] >= 2 && POP[S.cand[c]] <= n; });
        if (cells.length <= n) continue;
        var res = combos(cells, n, function (combo) {
          var un = 0; combo.forEach(function (c) { un |= S.cand[c]; });
          if (POP[un] !== n) return null;
          var elims = [];
          UNITS[u].forEach(function (c) {
            if (combo.indexOf(c) >= 0 || S.vals[c]) return;
            var m = S.cand[c] & un;
            if (m) elims.push({ cell: c, mask: m });
          });
          if (!elims.length) return null;
          return { tech: name, units: [u], cells: combo.slice(), digits: un, place: null, elims: elims };
        });
        if (res) return res;
      }
      return null;
    };
  }

  function findHiddenSubset(n) {
    var name = ['', '', 'hiddenPair', 'hiddenTriple', 'hiddenQuad'][n];
    return function (S) {
      for (var u = 0; u < 27; u++) {
        var ds = [], pms = {};
        for (var d = 1; d <= 9; d++) {
          var pm = posMask(S, u, d);
          if (pm && POP[pm] <= n) { ds.push(d); pms[d] = pm; }
        }
        if (ds.length < n) continue;
        var res = combos(ds, n, function (combo) {
          var un = 0; combo.forEach(function (dd) { un |= pms[dd]; });
          if (POP[un] !== n) return null;
          var cells = [], dm = 0;
          combo.forEach(function (dd) { dm |= BIT[dd]; });
          for (var i = 0; i < 9; i++) if (un & (1 << i)) cells.push(UNITS[u][i]);
          var elims = [];
          cells.forEach(function (c) {
            var m = S.cand[c] & ~dm;
            if (m) elims.push({ cell: c, mask: m });
          });
          if (!elims.length) return null;
          return { tech: name, units: [u], cells: cells, digits: dm, place: null, elims: elims };
        });
        if (res) return res;
      }
      return null;
    };
  }

  function findPointing(S) {
    for (var b = 18; b < 27; b++) {
      for (var d = 1; d <= 9; d++) {
        var pm = posMask(S, b, d);
        if (POP[pm] < 2) continue;
        var cells = [];
        for (var i = 0; i < 9; i++) if (pm & (1 << i)) cells.push(UNITS[b][i]);
        var sameRow = cells.every(function (c) { return ROW(c) === ROW(cells[0]); });
        var sameCol = cells.every(function (c) { return COL(c) === COL(cells[0]); });
        var line = sameRow ? ROW(cells[0]) : (sameCol ? 9 + COL(cells[0]) : -1);
        if (line < 0) continue;
        var elims = [];
        UNITS[line].forEach(function (c) {
          if (BOX(c) + 18 === b) return;
          if (!S.vals[c] && (S.cand[c] & BIT[d])) elims.push({ cell: c, mask: BIT[d] });
        });
        if (elims.length) return { tech: 'pointing', units: [b, line], cells: cells, digits: BIT[d], place: null, elims: elims };
      }
    }
    return null;
  }

  function findBoxLine(S) {
    for (var u = 0; u < 18; u++) {
      for (var d = 1; d <= 9; d++) {
        var pm = posMask(S, u, d);
        if (POP[pm] < 2) continue;
        var cells = [];
        for (var i = 0; i < 9; i++) if (pm & (1 << i)) cells.push(UNITS[u][i]);
        var bx = BOX(cells[0]);
        if (!cells.every(function (c) { return BOX(c) === bx; })) continue;
        var elims = [];
        UNITS[18 + bx].forEach(function (c) {
          if (UNITS[u].indexOf(c) >= 0) return;
          if (!S.vals[c] && (S.cand[c] & BIT[d])) elims.push({ cell: c, mask: BIT[d] });
        });
        if (elims.length) return { tech: 'boxLine', units: [u, 18 + bx], cells: cells, digits: BIT[d], place: null, elims: elims };
      }
    }
    return null;
  }

  function findFish(n) {
    var name = n === 2 ? 'xwing' : 'swordfish';
    return function (S) {
      for (var d = 1; d <= 9; d++) {
        for (var dir = 0; dir < 2; dir++) {           // 0: baser = rækker, 1: baser = kolonner
          var bases = [];
          for (var i = 0; i < 9; i++) {
            var pm = posMask(S, dir === 0 ? i : 9 + i, d);
            if (pm && POP[pm] >= 2 && POP[pm] <= n) bases.push({ i: i, pm: pm });
          }
          if (bases.length < n) continue;
          var res = combos(bases, n, function (combo) {
            var un = 0; combo.forEach(function (x) { un |= x.pm; });
            if (POP[un] !== n) return null;
            var baseIdx = combo.map(function (x) { return x.i; });
            var elims = [], cover = [];
            for (var j = 0; j < 9; j++) if (un & (1 << j)) cover.push(j);
            cover.forEach(function (j) {
              var cu = dir === 0 ? 9 + j : j;
              UNITS[cu].forEach(function (c) {
                var bi = dir === 0 ? ROW(c) : COL(c);
                if (baseIdx.indexOf(bi) >= 0) return;
                if (!S.vals[c] && (S.cand[c] & BIT[d])) elims.push({ cell: c, mask: BIT[d] });
              });
            });
            if (!elims.length) return null;
            var cells = [];
            combo.forEach(function (x) {
              for (var j2 = 0; j2 < 9; j2++) if (x.pm & (1 << j2)) cells.push(dir === 0 ? x.i * 9 + j2 : j2 * 9 + x.i);
            });
            return {
              tech: name, units: baseIdx.map(function (bi) { return dir === 0 ? bi : 9 + bi; }).concat(cover.map(function (j) { return dir === 0 ? 9 + j : j; })),
              cells: cells, digits: BIT[d], place: null, elims: elims,
              extra: { dir: dir === 0 ? 'row' : 'col', bases: baseIdx, cover: cover }
            };
          });
          if (res) return res;
        }
      }
      return null;
    };
  }

  function findXYWing(S) {
    for (var p = 0; p < 81; p++) {
      if (S.vals[p] || POP[S.cand[p]] !== 2) continue;
      var pc = S.cand[p];
      var pin = PEERS[p].filter(function (c) { return !S.vals[c] && POP[S.cand[c]] === 2 && POP[S.cand[c] & pc] === 1; });
      for (var i = 0; i < pin.length; i++) for (var j = i + 1; j < pin.length; j++) {
        var A = pin[i], B = pin[j];
        var ca = S.cand[A], cb = S.cand[B];
        if (ca === cb) continue;
        if (((ca | cb) & ~pc) === 0) continue;
        var z = ca & cb & ~pc;                     // fælles tal, som ikke er i pivot
        if (POP[z] !== 1) continue;
        if ((ca | cb | pc) !== (pc | z)) continue;
        var elims = [];
        PEERS[A].forEach(function (c) {
          if (c === p || c === B || S.vals[c]) return;
          if (PEERSET[B][c] && (S.cand[c] & z)) elims.push({ cell: c, mask: z });
        });
        if (elims.length) return { tech: 'xyWing', units: [], cells: [p, A, B], digits: z, place: null, elims: elims, extra: { pivot: p, a: A, b: B, z: z }, candP: pc, candA: ca, candB: cb };
      }
    }
    return null;
  }

  function findXYZWing(S) {
    for (var p = 0; p < 81; p++) {
      if (S.vals[p] || POP[S.cand[p]] !== 3) continue;
      var pc = S.cand[p];
      var pin = PEERS[p].filter(function (c) { return !S.vals[c] && POP[S.cand[c]] === 2 && (S.cand[c] & ~pc) === 0; });
      for (var i = 0; i < pin.length; i++) for (var j = i + 1; j < pin.length; j++) {
        var A = pin[i], B = pin[j];
        var ca = S.cand[A], cb = S.cand[B];
        if (ca === cb || (ca | cb) !== pc) continue;
        var z = ca & cb;
        if (POP[z] !== 1) continue;
        var elims = [];
        PEERS[p].forEach(function (c) {
          if (c === A || c === B || S.vals[c]) return;
          if (PEERSET[A][c] && PEERSET[B][c] && (S.cand[c] & z)) elims.push({ cell: c, mask: z });
        });
        if (elims.length) return { tech: 'xyzWing', units: [], cells: [p, A, B], digits: z, place: null, elims: elims, extra: { pivot: p, a: A, b: B, z: z }, candP: pc, candA: ca, candB: cb };
      }
    }
    return null;
  }

  // Rækkefølge = den rækkefølge en menneskelig løser prøver teknikkerne. rank = sværhedsgrad.
  var TECHNIQUES = [
    { id: 'nakedSingle',  rank: 1, find: findNakedSingle },
    { id: 'hiddenSingle', rank: 1, find: findHiddenSingle },
    { id: 'nakedPair',    rank: 2, find: findNakedSubset(2) },
    { id: 'pointing',     rank: 2, find: findPointing },
    { id: 'boxLine',      rank: 2, find: findBoxLine },
    { id: 'hiddenPair',   rank: 3, find: findHiddenSubset(2) },
    { id: 'nakedTriple',  rank: 3, find: findNakedSubset(3) },
    { id: 'xwing',        rank: 3, find: findFish(2) },
    { id: 'hiddenTriple', rank: 3, find: findHiddenSubset(3) },
    { id: 'xyWing',       rank: 4, find: findXYWing },
    { id: 'xyzWing',      rank: 4, find: findXYZWing },
    { id: 'swordfish',    rank: 4, find: findFish(3) },
    { id: 'nakedQuad',    rank: 4, find: findNakedSubset(4) },
    { id: 'hiddenQuad',   rank: 4, find: findHiddenSubset(4) }
  ];
  var RANK = {}; TECHNIQUES.forEach(function (t) { RANK[t.id] = t.rank; });

  // Næste trin ud fra nuværende tilstand. vals: 81 tal (0 = tom), elim: 81 bitmasker af udelukkede kandidater.
  function nextStep(vals, elim, maxRank) {
    var cand = candidatesBasic(vals);
    if (elim) for (var i = 0; i < 81; i++) cand[i] &= ~elim[i];
    var S = { vals: vals, cand: cand };
    for (var i2 = 0; i2 < 81; i2++) if (!vals[i2] && cand[i2] === 0) return { error: 'contradiction', cell: i2 };
    for (var t = 0; t < TECHNIQUES.length; t++) {
      if (maxRank && TECHNIQUES[t].rank > maxRank) break;
      var s = TECHNIQUES[t].find(S);
      if (s) { s.rank = TECHNIQUES[t].rank; return s; }
    }
    return null;
  }

  // Løs med menneskelige teknikker. Returnerer {solved, maxRank, counts, steps}
  function gradePuzzle(puzzle, maxRank) {
    var vals = puzzle.slice();
    var cand = candidatesBasic(vals);
    var S = { vals: vals, cand: cand };
    var counts = {}, hardest = 0, steps = 0;
    for (var guard = 0; guard < 2000; guard++) {
      var empty = 0;
      for (var i = 0; i < 81; i++) if (!vals[i]) empty++;
      if (!empty) return { solved: true, maxRank: hardest, counts: counts, steps: steps };
      var found = null;
      for (var t = 0; t < TECHNIQUES.length; t++) {
        if (maxRank && TECHNIQUES[t].rank > maxRank) break;
        found = TECHNIQUES[t].find(S);
        if (found) { found.rank = TECHNIQUES[t].rank; break; }
      }
      if (!found) return { solved: false, maxRank: hardest, counts: counts, steps: steps };
      counts[found.tech] = (counts[found.tech] || 0) + 1;
      if (found.rank > hardest) hardest = found.rank;
      steps++;
      applyStep(S, found);
    }
    return { solved: false, maxRank: hardest, counts: counts, steps: steps };
  }

  function applyStep(S, step) {
    if (step.place) {
      var c = step.place.cell, bit = BIT[step.place.digit];
      S.vals[c] = step.place.digit; S.cand[c] = 0;
      PEERS[c].forEach(function (p) { S.cand[p] &= ~bit; });
    }
    step.elims.forEach(function (e) { S.cand[e.cell] &= ~e.mask; });
  }

  // ---------- Generator ----------
  var LEVELS = {
    easy:   { rank: 1, minClues: 36 },
    medium: { rank: 2, minClues: 30 },
    hard:   { rank: 3, minClues: 26 },
    expert: { rank: 4, minClues: 17 }
  };

  function carve(solution, level, rnd) {
    var cfg = LEVELS[level];
    var puz = solution.slice();
    var order = shuffle(Array.apply(null, Array(81)).map(function (_, i) { return i; }), rnd);
    var clues = 81;
    for (var oi = 0; oi < order.length; oi++) {
      if (clues <= cfg.minClues) break;
      var c = order[oi], old = puz[c];
      puz[c] = 0;
      var g = gradePuzzle(puz, cfg.rank);
      if (g.solved) clues--; else puz[c] = old;
    }
    return puz;
  }

  // level: 'easy'|'medium'|'hard'|'expert'. Returnerer {puzzle, solution, level, clues, grade}
  function generate(level, seed, opts) {
    opts = opts || {};
    var rnd = makeRng(seed);
    var cfg = LEVELS[level];
    var best = null, tries = opts.maxTries || 300;
    for (var t = 0; t < tries; t++) {
      var sol = randomSolution(rnd);
      var puz = carve(sol, level, rnd);
      var g = gradePuzzle(puz, 0);
      var clues = puz.filter(Boolean).length;
      var res = { puzzle: puz, solution: sol, level: level, clues: clues, grade: g, tries: t + 1 };
      if (g.solved && g.maxRank === cfg.rank) return res;
      if (g.solved && (!best || Math.abs(g.maxRank - cfg.rank) < Math.abs(best.grade.maxRank - cfg.rank))) best = res;
    }
    return best;
  }

  var api = {
    ALL: ALL, BIT: BIT, POP: POP, UNITS: UNITS, PEERS: PEERS, ROW: ROW, COL: COL, BOX: BOX,
    sees: sees, digitsOf: digitsOf, unitName: unitName, makeRng: makeRng,
    candidatesBasic: candidatesBasic, countSolutions: countSolutions, randomSolution: randomSolution,
    TECHNIQUES: TECHNIQUES, RANK: RANK, LEVELS: LEVELS,
    nextStep: nextStep, gradePuzzle: gradePuzzle, applyStep: applyStep, generate: generate
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SudokuEngine = api;
})(typeof self !== 'undefined' ? self : this);
