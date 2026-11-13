/* Hint-tekster på dansk: omsætter et løsertrin til et vink (nudge) og en forklaring. */
(function (root) {
  'use strict';
  var E = (typeof require !== 'undefined' && typeof module !== 'undefined') ? require('./engine.js') : root.SudokuEngine;
  var UNITS = E.UNITS, ROW = E.ROW, COL = E.COL, BOX = E.BOX, digitsOf = E.digitsOf;

  // Overskrifter: lette danske navne, og det gængse fagudtryk i parentes ved de svære teknikker.
  var TAGS = {
    nakedSingle: 'Kun én mulighed', hiddenSingle: 'Eneste plads',
    nakedPair: 'Låst par (nøgent par)', nakedTriple: 'Låst trio (nøgen tripel)', nakedQuad: 'Låst firer (nøgen firer)',
    hiddenPair: 'Skjult par', hiddenTriple: 'Skjult trio (skjult tripel)', hiddenQuad: 'Skjult firer',
    pointing: 'Boksen peger ud (pointing pair)', boxLine: 'Linjen peger ind (box/line)',
    xwing: 'Rektangel (X-Wing)', swordfish: 'Tre linjer (Swordfish)',
    xyWing: 'Kæde med tre felter (XY-Wing)', xyzWing: 'Kæde med tre tal (XYZ-Wing)',
    wrong: 'Der er en fejl', guess: 'Prøv dig frem'
  };
  var BOXNAMES = ['øverste venstre', 'øverste midterste', 'øverste højre', 'midterste venstre', 'midterste', 'midterste højre', 'nederste venstre', 'nederste midterste', 'nederste højre'];
  var NUM = { 2: 'to', 3: 'tre', 4: 'fire' };

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function list(a, word) {
    word = word || 'og';
    return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' ' + word + ' ' + a[a.length - 1];
  }
  function digs(mask, word) { return list(digitsOf(mask).map(String), word); }

  // Felter: "række 3, kolonne 9" / "kolonne 2 og 5 i række 1"
  function cellText(c) { return 'række ' + (ROW(c) + 1) + ', kolonne ' + (COL(c) + 1); }
  function cellsText(a) {
    if (a.length === 1) return cellText(a[0]);
    var sameRow = a.every(function (c) { return ROW(c) === ROW(a[0]); });
    var sameCol = a.every(function (c) { return COL(c) === COL(a[0]); });
    if (sameRow) return 'kolonne ' + list(a.map(function (c) { return String(COL(c) + 1); })) + ' i række ' + (ROW(a[0]) + 1);
    if (sameCol) return 'række ' + list(a.map(function (c) { return String(ROW(c) + 1); })) + ' i kolonne ' + (COL(a[0]) + 1);
    var groups = [], idx = {};
    a.forEach(function (c) { var r = ROW(c); if (idx[r] === undefined) { idx[r] = groups.length; groups.push({ r: r, cols: [] }); } groups[idx[r]].cols.push(COL(c) + 1); });
    var pieces = groups.map(function (g) { return 'række ' + (g.r + 1) + ', kolonne ' + list(g.cols.map(String)); });
    return groups.length <= 3 && groups.every(function (g) { return g.cols.length === 1; }) ? list(pieces) : pieces.join('; ');
  }
  // Felter inde i en bestemt enhed: "kolonne 2 og 5" (i en række), "række 3 og 6" (i en kolonne)
  function inUnit(a, u) {
    if (u < 9) return 'kolonne ' + list(a.map(function (c) { return String(COL(c) + 1); }));
    if (u < 18) return 'række ' + list(a.map(function (c) { return String(ROW(c) + 1); }));
    return cellsText(a);
  }
  function fields(a) { return (a.length === 1 ? 'feltet i ' : 'felterne i ') + cellsText(a); }

  function unitLabel(u) {
    if (u < 9) return 'række ' + (u + 1);
    if (u < 18) return 'kolonne ' + (u - 9 + 1);
    return 'den ' + BOXNAMES[u - 18] + ' boks';
  }
  function lineName(u) { return u < 9 ? 'række ' + (u + 1) : 'kolonne ' + (u - 9 + 1); }

  // "Fjern 6 fra felterne i … samt 5 fra feltet i …"
  function removeText(elims) {
    var groups = {}, order = [];
    elims.forEach(function (e) { if (!groups[e.mask]) { groups[e.mask] = []; order.push(e.mask); } groups[e.mask].push(e.cell); });
    var parts = order.map(function (m) { return digs(m) + ' fra ' + fields(groups[m]); });
    return 'Fjern ' + parts.join(' samt ') + '.';
  }
  function elimMap(elims) { var m = {}; elims.forEach(function (e) { m[e.cell] = (m[e.cell] || 0) | e.mask; }); return m; }

  function pickNudgeUnit(vals, c) {
    var best = -1, bu = 0;
    [ROW(c), 9 + COL(c), 18 + BOX(c)].forEach(function (u) {
      var n = UNITS[u].filter(function (x) { return vals[x]; }).length;
      if (n > best) { best = n; bu = u; }
    });
    return bu;
  }
  function regionFromUnits(us) { var s = {}; us.forEach(function (x) { UNITS[x].forEach(function (cc) { s[cc] = 1; }); }); return Object.keys(s).map(Number); }

  function describe(step, vals) {
    var t = step.tech, out = {
      tech: t, tag: TAGS[t], regionCells: [], causeCells: step.cells.slice(), targetCells: [],
      elimMap: elimMap(step.elims || []), causeMask: step.digits, place: step.place || null,
      applyLabel: step.place ? 'Sæt tallet ind' : 'Fjern fra notaterne', nudge: '', text: ''
    };
    var d, u, c, i;

    if (t === 'nakedSingle') {
      c = step.cells[0]; d = step.place.digit; u = pickNudgeUnit(vals, c);
      out.regionCells = UNITS[u].slice(); out.targetCells = [c]; out.causeCells = [];
      out.nudge = 'Kig i ' + unitLabel(u) + '. Et af de tomme felter dér kan kun være ét bestemt tal, fordi alle de andre er spærret af tal i feltets række, kolonne eller boks.';
      var seen = {}, rowD = [], colD = [], boxD = [], other = [];
      UNITS[ROW(c)].forEach(function (x) { if (vals[x]) seen[vals[x]] = 'r'; });
      UNITS[9 + COL(c)].forEach(function (x) { if (vals[x] && !seen[vals[x]]) seen[vals[x]] = 'k'; });
      UNITS[18 + BOX(c)].forEach(function (x) { if (vals[x] && !seen[vals[x]]) seen[vals[x]] = 'b'; });
      for (i = 1; i <= 9; i++) {
        if (i === d) continue;
        if (seen[i] === 'r') rowD.push(i); else if (seen[i] === 'k') colD.push(i); else if (seen[i] === 'b') boxD.push(i); else other.push(i);
      }
      var parts = [], first = true;
      function part(arr, who) {
        if (!arr.length) return;
        parts.push(who + ' har ' + (first ? 'allerede ' : 'desuden ') + list(arr.map(String)));
        first = false;
      }
      part(rowD, 'rækken'); part(colD, 'kolonnen'); part(boxD, 'boksen');
      if (other.length) parts.push(list(other.map(String)) + ' har du allerede udelukket med et hint');
      var why = parts.length > 1 ? parts.slice(0, -1).join(', ') + ', og ' + parts[parts.length - 1] : parts[0];
      out.text = 'I ' + fields([c]) + ' kan der kun stå ' + d + '. ' + cap(why) + ' – så alle andre tal er udelukket.';
    } else if (t === 'hiddenSingle') {
      u = step.units[0]; c = step.cells[0]; d = step.place.digit;
      out.regionCells = UNITS[u].slice(); out.targetCells = [c]; out.causeCells = [];
      out.nudge = 'Kig i ' + unitLabel(u) + '. Tallet ' + d + ' skal stå et sted dér, og der er kun ét felt tilbage, hvor det kan være. Kan du finde det?';
      var where = u < 9 ? 'kolonne eller boks' : (u < 18 ? 'række eller boks' : 'række eller kolonne');
      out.text = 'Tallet ' + d + ' skal stå et sted i ' + unitLabel(u) + '. I alle de andre tomme felter dér er ' + d + ' spærret, fordi det allerede står i feltets ' + where + '. Kun ' + fields([c]) + ' er ledigt – så ' + d + ' må stå dér.';
    } else if (/^naked(Pair|Triple|Quad)$/.test(t)) {
      var n = step.cells.length; u = step.units[0];
      out.regionCells = UNITS[u].slice();
      out.nudge = 'Kig i ' + unitLabel(u) + '. ' + cap(NUM[n]) + ' af felterne dér kan tilsammen kun være ' + NUM[n] + ' bestemte tal. Hvilke felter er det?';
      out.text = cap(fields(step.cells)) + ' kan tilsammen kun være ' + digs(step.digits, 'eller') + '. De ' + NUM[n] + ' tal skal derfor bruges i netop disse ' + NUM[n] + ' felter, og så kan ingen andre felter i ' + unitLabel(u) + ' være ' + digs(step.digits, 'eller') + '. ' + removeText(step.elims);
    } else if (/^hidden(Pair|Triple|Quad)$/.test(t)) {
      var n2 = step.cells.length; u = step.units[0];
      out.regionCells = UNITS[u].slice();
      out.nudge = 'Kig i ' + unitLabel(u) + '. ' + cap(NUM[n2]) + ' af tallene kan kun stå i ' + NUM[n2] + ' bestemte felter. Hvilke tal og felter er det?';
      out.text = 'I ' + unitLabel(u) + ' kan ' + digs(step.digits) + ' kun stå i ' + (u < 18 ? inUnit(step.cells, u) : fields(step.cells)) + '. Det er ' + NUM[n2] + ' tal på ' + NUM[n2] + ' felter, så felterne må bruges til netop de tal. Alle andre mulige tal i de felter er derfor overflødige. ' + removeText(step.elims);
    } else if (t === 'pointing') {
      var bx = step.units[0], ln = step.units[1]; d = digitsOf(step.digits)[0];
      out.regionCells = UNITS[bx].slice();
      out.nudge = 'Kig i ' + unitLabel(bx) + ' og se, hvor ' + d + ' kan stå. Alle mulighederne ligger på den samme linje – og det betyder noget for resten af linjen.';
      var along = ln < 9 ? 'kolonne ' + list(step.cells.map(function (c) { return String(COL(c) + 1); })) : 'række ' + list(step.cells.map(function (c) { return String(ROW(c) + 1); }));
      out.text = 'I ' + unitLabel(bx) + ' kan ' + d + ' kun stå i ' + lineName(ln) + ' (felterne i ' + along + '). Boksen skal have et ' + d + ', så det står helt sikkert i ' + lineName(ln) + ' – og så kan ' + d + ' ikke stå andre steder i den ' + (ln < 9 ? 'række' : 'kolonne') + '. ' + removeText(step.elims);
    } else if (t === 'boxLine') {
      var ln2 = step.units[0], bx2 = step.units[1]; d = digitsOf(step.digits)[0];
      out.regionCells = UNITS[ln2].slice();
      out.nudge = 'Kig i ' + unitLabel(ln2) + ' og se, hvor ' + d + ' kan stå. Alle mulighederne ligger i den samme boks – og det betyder noget for resten af boksen.';
      out.text = 'I ' + unitLabel(ln2) + ' kan ' + d + ' kun stå i ' + inUnit(step.cells, ln2) + ', og ' + (step.cells.length > 2 ? 'de felter' : 'de to felter') + ' ligger ' + (step.cells.length > 2 ? 'alle' : 'begge') + ' i ' + unitLabel(bx2) + '. ' + cap(ln2 < 9 ? 'rækken' : 'kolonnen') + ' skal have et ' + d + ', så det står helt sikkert i den boks – og så kan boksens øvrige felter ikke være ' + d + '. ' + removeText(step.elims);
    } else if (t === 'xwing' || t === 'swordfish') {
      var ex = step.extra, nn = ex.bases.length; d = digitsOf(step.digits)[0];
      var isRow = ex.dir === 'row', baseW = isRow ? 'rækkerne' : 'kolonnerne', covW = isRow ? 'kolonnerne' : 'rækkerne';
      var baseNums = list(ex.bases.map(function (b) { return String(b + 1); })), covNums = list(ex.cover.map(function (b) { return String(b + 1); }));
      out.regionCells = regionFromUnits(ex.bases.map(function (b) { return isRow ? b : 9 + b; }));
      out.nudge = 'Se kun på tallet ' + d + '. I ' + baseW + ' ' + baseNums + ' kan det højst stå i ' + NUM[nn] + ' felter hver – og felterne ligger i de samme ' + NUM[nn] + ' ' + (isRow ? 'kolonner' : 'rækker') + '.';
      out.text = 'Se kun på tallet ' + d + '. I ' + baseW + ' ' + baseNums + ' kan det kun stå i ' + covW + ' ' + covNums + '. Hver af de ' + NUM[nn] + ' ' + (isRow ? 'rækker' : 'kolonner') + ' skal have et ' + d + ', og kun de ' + NUM[nn] + ' ' + (isRow ? 'kolonner' : 'rækker') + ' er mulige – så de får deres ' + d + ' fra netop disse ' + (isRow ? 'rækker' : 'kolonner') + '. ' +
        (t === 'xwing' ? 'De fire felter er hjørnerne i et rektangel. ' : '') +
        'Derfor kan ' + d + ' ikke stå andre steder i ' + covW + ' ' + covNums + '. ' + removeText(step.elims);
    } else if (t === 'xyWing' || t === 'xyzWing') {
      var x = step.extra, z = digitsOf(x.z)[0];
      out.regionCells = [x.pivot]; out.targetCells = []; out.causeCells = [x.pivot, x.a, x.b];
      var aDigit = digitsOf(step.candA & ~x.z)[0], bDigit = digitsOf(step.candB & ~x.z)[0];
      var common = ' Felter, der ligger i samme række, kolonne eller boks som begge sidefelter, kan derfor ikke være ' + z + '. ';
      if (t === 'xyWing') {
        out.nudge = 'Kig på ' + fields([x.pivot]) + '. Det kan kun være ' + aDigit + ' eller ' + bDigit + '. Find to felter i samme række, kolonne eller boks, der kan være henholdsvis ' + aDigit + ' eller ' + z + ' og ' + bDigit + ' eller ' + z + '.';
        out.text = 'Midterfeltet (' + cellText(x.pivot) + ') kan kun være ' + aDigit + ' eller ' + bDigit + '. Sidefelt 1 (' + cellText(x.a) + ') kan være ' + aDigit + ' eller ' + z + ', og sidefelt 2 (' + cellText(x.b) + ') kan være ' + bDigit + ' eller ' + z + '. ' +
          'Er midterfeltet ' + aDigit + ', må sidefelt 1 være ' + z + '. Er det ' + bDigit + ', må sidefelt 2 være ' + z + '. Uanset hvad bliver ét af dem til ' + z + '.' + common + removeText(step.elims);
      } else {
        out.nudge = 'Kig på ' + fields([x.pivot]) + '. Det kan være ' + digs(step.candP, 'eller') + '. Find to felter i samme række, kolonne eller boks, der kan være henholdsvis ' + aDigit + ' eller ' + z + ' og ' + bDigit + ' eller ' + z + '.';
        out.text = 'Midterfeltet (' + cellText(x.pivot) + ') kan være ' + digs(step.candP, 'eller') + '. Sidefelt 1 (' + cellText(x.a) + ') kan være ' + aDigit + ' eller ' + z + ', og sidefelt 2 (' + cellText(x.b) + ') kan være ' + bDigit + ' eller ' + z + '. ' +
          'Er midterfeltet ' + z + ', står ' + z + ' dér. Er det ' + aDigit + ', må sidefelt 1 være ' + z + '. Er det ' + bDigit + ', må sidefelt 2 være ' + z + '. Så står ' + z + ' i ét af de tre felter, uanset hvad. Felter, der ligger i samme række, kolonne eller boks som alle tre, kan derfor ikke være ' + z + '. ' + removeText(step.elims);
      }
    }
    return out;
  }

  function describeWrong(vals, solution, c) {
    var d = vals[c], conflicts = [];
    E.PEERS[c].forEach(function (p) { if (vals[p] === d) conflicts.push(p); });
    var txt = 'Tallet ' + d + ' i ' + fields([c]) + ' er forkert. ';
    if (conflicts.length) txt += 'Det samme tal står også i ' + fields(conflicts) + ', som ligger i samme række, kolonne eller boks. ';
    else txt += 'Det strider ikke direkte mod et andet tal, men det passer ikke med gådens eneste løsning og ville give problemer senere. ';
    txt += 'Fjern det, så kan du komme videre.';
    return {
      tech: 'wrong', tag: TAGS.wrong, regionCells: [c], causeCells: [], targetCells: [c], elimMap: {}, causeMask: 0,
      place: null, remove: c, applyLabel: 'Fjern tallet',
      nudge: 'Et af de tal, du har sat, er forkert. Kig i ' + unitLabel(18 + BOX(c)) + '.',
      text: txt
    };
  }

  function describeGuess(c, d) {
    return {
      tech: 'guess', tag: TAGS.guess, regionCells: UNITS[18 + BOX(c)].slice(), causeCells: [], targetCells: [c], elimMap: {}, causeMask: 0,
      place: { cell: c, digit: d }, applyLabel: 'Sæt tallet ind',
      nudge: 'Jeg kan ikke finde en enkel regel at bruge lige nu. Tryk på Auto-notat for at se alle mulige tal, og kig så i ' + unitLabel(18 + BOX(c)) + '.',
      text: 'Her hjælper de almindelige regler ikke. Prøver man de andre tal i ' + fields([c]) + ', ender man senere i en modstrid – kun ' + d + ' passer.'
    };
  }

  var api = { describe: describe, describeWrong: describeWrong, describeGuess: describeGuess, TAGS: TAGS, unitLabel: unitLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SudokuHints = api;
})(typeof self !== 'undefined' ? self : this);
