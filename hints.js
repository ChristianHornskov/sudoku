/* Hint-tekster på dansk: omsætter et løsertrin til forklaring (nudge + fuld forklaring). */
(function (root) {
  'use strict';
  var E = (typeof require !== 'undefined' && typeof module !== 'undefined') ? require('./engine.js') : root.SudokuEngine;
  var UNITS = E.UNITS, ROW = E.ROW, COL = E.COL, BOX = E.BOX, digitsOf = E.digitsOf, BIT = E.BIT;

  var TAGS = {
    nakedSingle: 'Nøgen enkelt', hiddenSingle: 'Skjult enkelt',
    nakedPair: 'Nøgent par', nakedTriple: 'Nøgen tripel', nakedQuad: 'Nøgen firer',
    hiddenPair: 'Skjult par', hiddenTriple: 'Skjult tripel', hiddenQuad: 'Skjult firer',
    pointing: 'Pegende par', boxLine: 'Boks/linje-reduktion',
    xwing: 'X-Wing', swordfish: 'Swordfish', xyWing: 'XY-Wing', xyzWing: 'XYZ-Wing',
    wrong: 'Fejl på pladen', guess: 'Prøv dig frem'
  };
  var BOXNAMES = ['øverste venstre', 'øverste midterste', 'øverste højre', 'midterste venstre', 'midterste', 'midterste højre', 'nederste venstre', 'nederste midterste', 'nederste højre'];
  var NUM = { 2: 'to', 3: 'tre', 4: 'fire' };

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function list(a) { return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' og ' + a[a.length - 1]; }
  function cell(c) { return 'R' + (ROW(c) + 1) + 'K' + (COL(c) + 1); }
  function cellLong(c) { return 'række ' + (ROW(c) + 1) + ', kolonne ' + (COL(c) + 1); }
  function cells(a) { return list(a.map(cell)); }
  function unitLabel(u) {
    if (u < 9) return 'række ' + (u + 1);
    if (u < 18) return 'kolonne ' + (u - 9 + 1);
    var b = u - 18;
    return 'den ' + BOXNAMES[b] + ' boks';
  }
  function digs(mask) { return list(digitsOf(mask).map(String)); }
  function lineName(u) { return u < 9 ? 'række ' + (u + 1) : 'kolonne ' + (u - 9 + 1); }

  function elimText(elims) {
    return list(elims.map(function (e) { return cell(e.cell) + ' (' + digs(e.mask) + ')'; }));
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

  // vals: nuværende tal. Returnerer beskrivelse af trinnet.
  function describe(step, vals) {
    var t = step.tech, out = {
      tech: t, tag: TAGS[t], regionCells: [], causeCells: step.cells.slice(), targetCells: [],
      elimMap: elimMap(step.elims || []), causeMask: step.digits, place: step.place || null,
      applyLabel: step.place ? 'Sæt tallet ind' : 'Fjern kandidaterne', nudge: '', text: ''
    };
    var d, u, c, i;
    function regionFromUnits(us) { var s = {}; us.forEach(function (x) { UNITS[x].forEach(function (cc) { s[cc] = 1; }); }); return Object.keys(s).map(Number); }

    if (t === 'nakedSingle') {
      c = step.cells[0]; d = step.place.digit;
      u = pickNudgeUnit(vals, c);
      out.regionCells = UNITS[u].slice();
      out.targetCells = [c]; out.causeCells = [];
      out.nudge = 'Teknik: ' + TAGS[t] + '. Kig i ' + unitLabel(u) + ': Der er et felt, hvor der kun er ét tal tilbage, som kan stå der. Se på hvilke tal feltets række, kolonne og boks allerede har.';
      var inRow = {}, inCol = {}, inBox = {}, shown = {};
      UNITS[ROW(c)].forEach(function (x) { if (vals[x]) inRow[vals[x]] = 1; });
      UNITS[9 + COL(c)].forEach(function (x) { if (vals[x]) inCol[vals[x]] = 1; });
      UNITS[18 + BOX(c)].forEach(function (x) { if (vals[x]) inBox[vals[x]] = 1; });
      var rowD = [], colD = [], boxD = [], other = [];
      for (i = 1; i <= 9; i++) {
        if (i === d) continue;
        if (inRow[i]) rowD.push(i); else if (inCol[i]) colD.push(i); else if (inBox[i]) boxD.push(i); else other.push(i);
      }
      var parts = [];
      if (rowD.length) parts.push(list(rowD.map(String)) + ' står i rækken');
      if (colD.length) parts.push(list(colD.map(String)) + ' i kolonnen');
      if (boxD.length) parts.push(list(boxD.map(String)) + ' i boksen');
      if (other.length) parts.push(list(other.map(String)) + ' er udelukket af kandidater, du allerede har fjernet');
      out.text = 'Feltet i ' + cellLong(c) + ' kan kun rumme tallet ' + d + '. Alle de andre tal er udelukket: ' + list(parts) + '. Derfor må der stå ' + d + ' i feltet.';
    } else if (t === 'hiddenSingle') {
      u = step.units[0]; c = step.cells[0]; d = step.place.digit;
      out.regionCells = UNITS[u].slice();
      out.targetCells = [c]; out.causeCells = [];
      out.nudge = 'Teknik: ' + TAGS[t] + '. Kig i ' + unitLabel(u) + ': Hvor kan tallet ' + d + ' stå? Se efter, hvor ' + d + ' allerede "spærrer" for felterne.';
      out.text = cap('i ' + unitLabel(u)) + ' skal tallet ' + d + ' stå et sted. I alle de andre tomme felter i ' + unitLabel(u) + ' er ' + d + ' udelukket, fordi ' + d + ' allerede står i deres række, kolonne eller boks. Kun feltet i ' + cellLong(c) + ' er tilbage, så ' + d + ' må stå der. (Feltet kan godt have flere kandidater – men ' + d + ' har kun dette ene sted.)';
    } else if (/^naked(Pair|Triple|Quad)$/.test(t)) {
      var n = step.cells.length; u = step.units[0];
      out.regionCells = UNITS[u].slice();
      out.nudge = 'Teknik: ' + TAGS[t] + '. Kig i ' + unitLabel(u) + ': Der er ' + NUM[n] + ' felter, som tilsammen kun har ' + NUM[n] + ' forskellige kandidater. Hvilke?';
      out.text = 'I ' + unitLabel(u) + ' har felterne ' + cells(step.cells) + ' tilsammen kun kandidaterne ' + digs(step.digits) + '. ' +
        cap(NUM[n]) + ' felter og ' + NUM[n] + ' tal: De ' + NUM[n] + ' tal skal stå i netop de felter (ét i hvert), så ingen andre felter i ' + unitLabel(u) + ' kan have dem. Derfor kan du fjerne kandidaterne: ' + elimText(step.elims) + '.';
    } else if (/^hidden(Pair|Triple|Quad)$/.test(t)) {
      var n2 = step.cells.length; u = step.units[0];
      out.regionCells = UNITS[u].slice();
      out.nudge = 'Teknik: ' + TAGS[t] + '. Kig i ' + unitLabel(u) + ': Der er ' + NUM[n2] + ' tal, som kun kan stå i ' + NUM[n2] + ' bestemte felter. Hvilke tal er det?';
      out.text = 'I ' + unitLabel(u) + ' kan tallene ' + digs(step.digits) + ' kun stå i felterne ' + cells(step.cells) + '. Det er ' + NUM[n2] + ' tal på ' + NUM[n2] + ' felter, så felterne skal bruges til netop de tal. Alle andre kandidater i de felter er derfor overflødige og kan fjernes: ' + elimText(step.elims) + '.';
    } else if (t === 'pointing') {
      var bx = step.units[0], ln = step.units[1]; d = digitsOf(step.digits)[0];
      out.regionCells = UNITS[bx].slice();
      out.nudge = 'Teknik: ' + TAGS[t] + '. Kig i ' + unitLabel(bx) + ': Hvor kan tallet ' + d + ' stå i boksen? Ligger mulighederne på en lige linje?';
      out.text = 'I ' + unitLabel(bx) + ' kan tallet ' + d + ' kun stå i ' + cells(step.cells) + ' – og de ligger alle i ' + lineName(ln) + '. ' + d + ' skal stå et sted i boksen, så det står helt sikkert i ' + lineName(ln) + '. Derfor kan ' + d + ' ikke stå i resten af ' + lineName(ln) + ' uden for boksen. Fjern ' + d + ' fra: ' + cells(step.elims.map(function (e) { return e.cell; })) + '.';
    } else if (t === 'boxLine') {
      var ln2 = step.units[0], bx2 = step.units[1]; d = digitsOf(step.digits)[0];
      out.regionCells = UNITS[ln2].slice();
      out.nudge = 'Teknik: ' + TAGS[t] + '. Kig i ' + unitLabel(ln2) + ': Hvor kan tallet ' + d + ' stå? Ligger alle mulighederne i den samme boks?';
      out.text = 'I ' + unitLabel(ln2) + ' kan tallet ' + d + ' kun stå i ' + cells(step.cells) + ' – og de ligger alle i ' + unitLabel(bx2) + '. Så ' + d + ' for ' + lineName(ln2) + ' står helt sikkert i den boks. Derfor kan boksens andre felter ikke indeholde ' + d + '. Fjern ' + d + ' fra: ' + cells(step.elims.map(function (e) { return e.cell; })) + '.';
    } else if (t === 'xwing' || t === 'swordfish') {
      var ex = step.extra, nn = ex.bases.length; d = digitsOf(step.digits)[0];
      var isRow = ex.dir === 'row';
      var baseNames = ex.bases.map(function (b) { return (isRow ? 'række ' : 'kolonne ') + (b + 1); });
      var coverNames = ex.cover.map(function (b) { return (isRow ? 'kolonne ' : 'række ') + (b + 1); });
      out.regionCells = regionFromUnits(ex.bases.map(function (b) { return isRow ? b : 9 + b; }));
      out.nudge = 'Teknik: ' + TAGS[t] + '. Se kun på tallet ' + d + '. Kig i ' + list(baseNames) + ': Hvor kan ' + d + ' stå i dem? Hvilke ' + (isRow ? 'kolonner' : 'rækker') + ' bruges?';
      out.text = 'Se på tallet ' + d + '. I ' + list(baseNames) + ' kan ' + d + ' kun stå i ' + list(coverNames) + ' (felterne ' + cells(step.cells) + '). Hver af de ' + NUM[nn] + ' ' + (isRow ? 'rækker' : 'kolonner') + ' skal have ét ' + d + ', og der er kun ' + NUM[nn] + ' ' + (isRow ? 'kolonner' : 'rækker') + ' at placere dem i – så de bliver "brugt op". ' +
        (t === 'xwing' ? 'Fire felter danner et rektangel, og ' + d + ' står enten i det ene diagonale par eller det andet. ' : '') +
        'Derfor kan ' + d + ' ikke stå andre steder i ' + list(coverNames) + '. Fjern ' + d + ' fra: ' + cells(step.elims.map(function (e) { return e.cell; })) + '.';
    } else if (t === 'xyWing' || t === 'xyzWing') {
      var x = step.extra, z = digitsOf(x.z)[0];
      out.regionCells = [x.pivot];
      out.targetCells = [];
      out.causeCells = [x.pivot, x.a, x.b];
      // find kandidaterne ud fra trinnets felter: pivot har {pa,pb(,z)}, A har {pa,z}, B har {pb,z}
      var cA = step.candA, cB = step.candB, cP = step.candP;
      var aDigit = digitsOf(cA & ~x.z)[0], bDigit = digitsOf(cB & ~x.z)[0];
      var tail = 'Fjern ' + z + ' fra: ' + cells(step.elims.map(function (e) { return e.cell; })) + '.';
      if (t === 'xyWing') {
        out.nudge = 'Teknik: ' + TAGS[t] + '. Kig efter et felt med kun to kandidater (' + aDigit + ' og ' + bDigit + ') i ' + cellLong(x.pivot) + ' og to nabofelter, der hver deler ét tal med det. Tallet ' + z + ' er nøglen.';
        out.text = 'Feltet ' + cell(x.pivot) + ' (pivot) har kun kandidaterne ' + aDigit + ' og ' + bDigit + '. ' + cell(x.a) + ' har ' + aDigit + ' og ' + z + ', og ' + cell(x.b) + ' har ' + bDigit + ' og ' + z + '. ' +
          'Er pivoten ' + aDigit + ', må ' + cell(x.a) + ' være ' + z + '. Er pivoten ' + bDigit + ', må ' + cell(x.b) + ' være ' + z + '. Så ' + z + ' står i ét af de to felter, uanset hvad. Felter, der ser både ' + cell(x.a) + ' og ' + cell(x.b) + ', kan derfor ikke være ' + z + '. ' + tail;
      } else {
        out.nudge = 'Teknik: ' + TAGS[t] + '. Kig på ' + cellLong(x.pivot) + ': et felt med tre kandidater (' + list(digitsOf(cP).map(String)) + ') og to nabofelter med to kandidater hver. Tallet ' + z + ' er nøglen.';
        out.text = 'Feltet ' + cell(x.pivot) + ' (pivot) har kandidaterne ' + list(digitsOf(cP).map(String)) + '. ' + cell(x.a) + ' har ' + aDigit + ' og ' + z + ', og ' + cell(x.b) + ' har ' + bDigit + ' og ' + z + '. ' +
          'Er pivoten ' + z + ', står ' + z + ' dér. Er den ' + aDigit + ', må ' + cell(x.a) + ' være ' + z + '. Er den ' + bDigit + ', må ' + cell(x.b) + ' være ' + z + '. Så ' + z + ' står i ét af de tre felter, uanset hvad. Felter, der ser alle tre, kan derfor ikke være ' + z + '. ' + tail;
      }
    }
    return out;
  }

  function describeWrong(vals, solution, c) {
    var d = vals[c], conflicts = [];
    E.PEERS[c].forEach(function (p) { if (vals[p] === d) conflicts.push(p); });
    var txt = 'Tallet ' + d + ' i feltet ' + cellLong(c) + ' er forkert.';
    if (conflicts.length) txt += ' Det står også i ' + cells(conflicts) + ', som er i samme række, kolonne eller boks.';
    else txt += ' Det bryder ikke umiddelbart en regel, men gåden har kun én løsning, og den passer ikke med ' + d + ' her – det ville føre til en modstrid senere.';
    txt += ' Fjern tallet, så kan du komme videre.';
    return {
      tech: 'wrong', tag: TAGS.wrong, regionCells: [c], causeCells: [], targetCells: [c], elimMap: {}, causeMask: 0,
      place: null, remove: c, applyLabel: 'Fjern det forkerte tal',
      nudge: 'Der er en fejl på pladen. Se efter i ' + unitLabel(18 + BOX(c)) + ': Et af tallene dér passer ikke.',
      text: txt
    };
  }

  function describeGuess(c, d) {
    return {
      tech: 'guess', tag: TAGS.guess, regionCells: UNITS[18 + BOX(c)].slice(), causeCells: [], targetCells: [c], elimMap: {}, causeMask: 0,
      place: { cell: c, digit: d }, applyLabel: 'Sæt tallet ind',
      nudge: 'Jeg kan ikke finde en af de almindelige teknikker lige nu. Tjek dine notater (knappen "Auto-notat" udfylder dem), og kig i ' + unitLabel(18 + BOX(c)) + '.',
      text: 'Ingen af de almindelige teknikker kan bruges lige nu. Prøver man ' + d + ' i ' + cellLong(c) + ' fører alle andre muligheder i feltet til en modstrid længere fremme – det er kun ' + d + ', der passer med den eneste løsning.'
    };
  }

  var api = { describe: describe, describeWrong: describeWrong, describeGuess: describeGuess, TAGS: TAGS, cell: cell, cellLong: cellLong, unitLabel: unitLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SudokuHints = api;
})(typeof self !== 'undefined' ? self : this);
