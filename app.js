(function () {
  'use strict';
  var E = window.SudokuEngine, H = window.SudokuHints;
  var BIT = E.BIT, UNITS = E.UNITS, PEERS = E.PEERS;
  var $ = function (s) { return document.querySelector(s); };

  var LEVELS = [
    { id: 'easy', name: 'Let', dots: 1, desc: 'Kun de enkleste regler: Kun én mulighed og Eneste plads.' },
    { id: 'medium', name: 'Mellem', dots: 2, desc: 'Kræver også låste par og mønstre, hvor en boks peger på en linje.' },
    { id: 'hard', name: 'Svær', dots: 3, desc: 'Skjulte par, trioer og rektangler (X-Wing).' },
    { id: 'expert', name: 'Ekspert', dots: 4, desc: 'Kæder (XY-Wing), Swordfish og firere.' }
  ];
  var LEVEL_NAME = {}; LEVELS.forEach(function (l) { LEVEL_NAME[l.id] = l.name; });

  var KEY_G = 'sudoku.v1.game', KEY_S = 'sudoku.v1.settings', KEY_L = 'sudoku.v1.level';
  var DEFAULTS = { showErrors: true, autoRemove: true, hlSame: true, hlPeers: true, showTimer: true, theme: 'auto' };

  var settings = load(KEY_S, {}); Object.keys(DEFAULTS).forEach(function (k) { if (settings[k] === undefined) settings[k] = DEFAULTS[k]; });
  var G = null;            // aktivt spil
  var HS = null;           // hint-tilstand {desc, stage}
  var paused = false, busy = false, cells = [], deferredInstall = null;

  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* privat tilstand */ } }
  function saveGame() { if (G) save(KEY_G, G); }

  // ---------- Opbygning ----------
  var boardEl = $('#board');
  function buildBoard() {
    boardEl.innerHTML = '';
    cells = new Array(81);
    for (var b = 0; b < 9; b++) {
      var box = document.createElement('div'); box.className = 'box';
      for (var k = 0; k < 9; k++) {
        var idx = (((b / 3) | 0) * 3 + ((k / 3) | 0)) * 9 + (b % 3) * 3 + (k % 3);
        var el = document.createElement('div');
        el.className = 'cell'; el.dataset.i = idx; el.setAttribute('role', 'gridcell');
        el.innerHTML = '<span class="val"></span><div class="notes">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (d) { return '<i>' + d + '</i>'; }).join('') + '</div>';
        box.appendChild(el); cells[idx] = el;
      }
      boardEl.appendChild(box);
    }
  }
  var padEl = $('#pad');
  function buildPad() {
    var h = '';
    for (var d = 1; d <= 9; d++) h += '<button type="button" data-d="' + d + '" aria-label="Tallet ' + d + '">' + d + '</button>';
    h += '<button type="button" class="erase" data-erase aria-label="Slet felt"><svg class="ic"><use href="#i-erase"/></svg></button>';
    padEl.innerHTML = h;
  }

  // ---------- Spiltilstand ----------
  function newState(res) {
    return {
      v: 1, level: res.level, puzzle: res.puzzle, solution: res.solution, vals: res.puzzle.slice(),
      notes: new Array(81).fill(0), elim: new Array(81).fill(0), undo: [], sel: -1, pencil: false,
      seconds: 0, hints: 0, mistakes: 0, done: false
    };
  }
  function snapshot() { return { vals: G.vals.slice(), notes: G.notes.slice(), elim: G.elim.slice(), m: G.mistakes }; }
  function pushUndo() { G.undo.push(snapshot()); if (G.undo.length > 400) G.undo.shift(); }
  function isGiven(i) { return G.puzzle[i] !== 0; }

  function setValue(i, d, opts) {
    opts = opts || {};
    if (isGiven(i) || G.done) return false;
    if (G.vals[i] === d) return false;
    G.vals[i] = d; G.notes[i] = 0;
    if (settings.autoRemove) PEERS[i].forEach(function (p) { G.notes[p] &= ~BIT[d]; });
    if (d !== G.solution[i]) { G.mistakes++; if (!opts.silent) flash(i, 'shake'); }
    G.popCell = i;
    return true;
  }
  function checkWin() {
    for (var i = 0; i < 81; i++) if (G.vals[i] !== G.solution[i]) return false;
    return true;
  }

  // ---------- Visning ----------
  function noteMaskFor(i, basic, hintCells) {
    if (G.vals[i]) return 0;
    var m = G.notes[i];
    if (HS && HS.stage === 2 && hintCells[i] && !m) m = basic[i] & ~G.elim[i];
    return m;
  }
  function render() {
    var sel = G.sel, selVal = sel >= 0 ? G.vals[sel] : 0;
    var desc = HS ? HS.desc : null, stage2 = HS && HS.stage === 2;
    boardEl.classList.toggle('hinting', !!HS);
    var region = {}, cause = {}, target = {}, hintCells = {};
    if (desc) {
      desc.regionCells.forEach(function (c) { region[c] = 1; });
      if (stage2) {
        desc.causeCells.forEach(function (c) { cause[c] = 1; hintCells[c] = 1; });
        desc.targetCells.forEach(function (c) { target[c] = 1; });
        Object.keys(desc.elimMap).forEach(function (c) { hintCells[c] = 1; });
      }
    }
    var basic = stage2 ? E.candidatesBasic(G.vals) : null;
    for (var i = 0; i < 81; i++) {
      var el = cells[i], v = G.vals[i], cls = 'cell';
      if (isGiven(i)) cls += ' given';
      if (!HS) {
        if (i === sel) cls += ' sel';
        else if (selVal && settings.hlSame && v === selVal) cls += ' same';
        else if (sel >= 0 && settings.hlPeers && (E.sees(sel, i))) cls += ' peer';
      } else {
        if (target[i]) cls += ' h-target';
        else if (desc.elimMap[i] && stage2) cls += ' h-elim';
        else if (cause[i]) cls += ' h-cause';
        else if (region[i]) cls += ' h-region';
      }
      if (settings.showErrors && v && v !== G.solution[i] && !isGiven(i)) cls += ' err';
      el.className = cls;
      var valEl = el.firstChild, shown = v ? String(v) : '';
      var ghost = false;
      if (!v && stage2 && target[i] && desc.place) { shown = String(desc.place.digit); ghost = true; }
      if (valEl.textContent !== shown) valEl.textContent = shown;
      valEl.className = 'val' + (ghost ? ' ghost' : '');
      el.setAttribute('aria-label', 'Række ' + (E.ROW(i) + 1) + ', kolonne ' + (E.COL(i) + 1) + (v ? ', tallet ' + v : ', tomt felt'));
      var nm = noteMaskFor(i, basic, hintCells);
      var ns = el.lastChild.children;
      for (var d = 1; d <= 9; d++) {
        var on = !ghost && (nm & BIT[d]) !== 0, c2 = on ? 'on' : '';
        if (on) {
          if (stage2 && desc.elimMap[i] && (desc.elimMap[i] & BIT[d])) c2 += ' strike';
          else if (stage2 && cause[i] && (desc.causeMask & BIT[d])) c2 += ' hl';
          else if (!HS && selVal === d && settings.hlSame) c2 += ' same';
        }
        if (ns[d - 1].className !== c2) ns[d - 1].className = c2;
      }
    }
    if (G.popCell >= 0) { var pv = cells[G.popCell].firstChild; pv.classList.add('pop'); G.popCell = -1; }
    // knapper
    $('#levelLabel').textContent = LEVEL_NAME[G.level];
    $('#btnPencil').setAttribute('aria-pressed', G.pencil ? 'true' : 'false');
    $('#pencilBadge').textContent = G.pencil ? 'TIL' : 'FRA';
    padEl.classList.toggle('pencil', G.pencil);
    var counts = new Array(10).fill(0);
    G.vals.forEach(function (x) { if (x) counts[x]++; });
    Array.prototype.forEach.call(padEl.querySelectorAll('button[data-d]'), function (b) {
      var d = +b.dataset.d;
      b.classList.toggle('done', counts[d] >= 9);
    });
    $('#btnUndo').disabled = !G.undo.length || G.done;
    renderTimer();
  }
  function fmt(s) { var m = Math.floor(s / 60), r = s % 60; return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r; }
  function renderTimer() {
    if (!G) return;
    $('#timerText').textContent = fmt(G.seconds);
    $('#btnTimer').classList.toggle('hidden-time', !settings.showTimer);
    $('#btnTimer').querySelector('use').setAttribute('href', paused ? '#i-play' : '#i-pause');
    $('#btnTimer').setAttribute('aria-label', paused ? 'Fortsæt' : 'Pause');
  }
  function flash(i, cls) { var el = cells[i]; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(function () { el.classList.remove(cls); }, 400); }

  var toastT;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('show'); }, 1600);
  }

  // ---------- Handlinger ----------
  function afterChange() {
    HS = null; hideHintCard();
    saveGame(); render();
    if (!G.done && checkWin()) win();
  }
  function select(i) {
    if (G.done) return;
    G.sel = i;
    if (HS) { HS = null; hideHintCard(); }
    render();
  }
  function enterDigit(d) {
    if (G.done || paused) return;
    var i = G.sel;
    if (i < 0) { toast('Vælg først et felt'); return; }
    if (isGiven(i)) { toast('Det tal kan ikke ændres'); flash(i, 'shake'); return; }
    if (G.pencil) {
      if (G.vals[i]) { toast('Der står allerede et tal her. Slet det først.'); return; }
      pushUndo(); G.notes[i] ^= BIT[d]; afterChange(); return;
    }
    if (G.vals[i] === d) { pushUndo(); G.vals[i] = 0; afterChange(); return; }
    pushUndo(); setValue(i, d); afterChange();
  }
  function erase() {
    if (G.done || paused) return;
    var i = G.sel;
    if (i < 0) { toast('Vælg først et felt'); return; }
    if (isGiven(i)) { toast('Det tal kan ikke ændres'); return; }
    if (!G.vals[i] && !G.notes[i]) return;
    pushUndo(); G.vals[i] = 0; G.notes[i] = 0; afterChange();
  }
  function undo() {
    if (G.done || paused || !G.undo.length) return;
    var s = G.undo.pop(); G.vals = s.vals; G.notes = s.notes; G.elim = s.elim; G.mistakes = s.m;
    afterChange();
  }
  function togglePencil() { G.pencil = !G.pencil; saveGame(); render(); }
  function autoNotes() {
    if (G.done || paused) return;
    var basic = E.candidatesBasic(G.vals), changed = false;
    pushUndo();
    for (var i = 0; i < 81; i++) {
      if (!G.vals[i] && !G.notes[i]) { G.notes[i] = basic[i] & ~G.elim[i]; changed = true; }
    }
    if (!changed) { G.undo.pop(); toast('Alle tomme felter har allerede notater'); return; }
    afterChange(); toast('Notater udfyldt');
  }

  // ---------- Hint ----------
  function hintCard() { return $('#hintCard'); }
  function hideHintCard() { hintCard().hidden = true; $('#controls').hidden = false; }
  function onHint() {
    if (G.done || paused) return;
    var vals = G.vals, wrong = -1, i;
    if (G.sel >= 0 && vals[G.sel] && vals[G.sel] !== G.solution[G.sel] && !isGiven(G.sel)) wrong = G.sel;
    for (i = 0; i < 81 && wrong < 0; i++) if (vals[i] && vals[i] !== G.solution[i]) wrong = i;
    var desc;
    if (wrong >= 0) desc = H.describeWrong(vals, G.solution, wrong);
    else {
      var step = E.nextStep(vals, G.elim);
      if (step && !step.error) desc = H.describe(step, vals);
      else {
        var c = G.sel >= 0 && !vals[G.sel] ? G.sel : -1;
        if (c < 0) { var best = 10, basic = E.candidatesBasic(vals); for (i = 0; i < 81; i++) if (!vals[i] && E.POP[basic[i]] < best) { best = E.POP[basic[i]]; c = i; } }
        desc = H.describeGuess(c, G.solution[c]);
      }
    }
    HS = { desc: desc, stage: 1 };
    G.sel = -1;
    showHint();
  }
  function showHint() {
    var d = HS.desc;
    $('#controls').hidden = true; hintCard().hidden = false;
    $('#hintTag').textContent = d.tag;
    $('#hintStep').textContent = 'Vink ' + HS.stage + ' af 2';
    $('#hintText').textContent = HS.stage === 1 ? d.nudge : d.text;
    $('#hintMore').textContent = HS.stage === 1 ? 'Forklar hvorfor' : d.applyLabel;
    hintCard().scrollTop = 0;
    render();
  }
  function hintMore() {
    if (!HS) return;
    if (HS.stage === 1) { HS.stage = 2; showHint(); return; }
    applyHint();
  }
  function applyHint() {
    var d = HS.desc, basic = E.candidatesBasic(G.vals);
    pushUndo();
    G.hints++;
    if (d.remove !== undefined) { G.vals[d.remove] = 0; G.notes[d.remove] = 0; G.sel = d.remove; }
    else if (d.place) { setValue(d.place.cell, d.place.digit, { silent: true }); G.sel = d.place.cell; }
    else {
      Object.keys(d.elimMap).forEach(function (k) {
        var c = +k, m = d.elimMap[k];
        G.elim[c] |= m;
        if (!G.notes[c]) G.notes[c] = basic[c] & ~G.elim[c]; else G.notes[c] &= ~m;
      });
      // sørg for, at årsagsfelterne også har synlige notater
      d.causeCells.forEach(function (c) { if (!G.vals[c] && !G.notes[c]) G.notes[c] = basic[c] & ~G.elim[c]; });
    }
    afterChange();
  }
  function closeHint() { HS = null; hideHintCard(); render(); }

  // ---------- Gevinst ----------
  function win() {
    G.done = true; saveGame(); render();
    boardEl.parentNode.classList.add('win-anim');
    cells.forEach(function (el, i) { el.style.setProperty('--d', (E.ROW(i) + E.COL(i))); });
    setTimeout(function () {
      openSheet('<div class="win"><div class="win-emoji">🎉</div><h2>Flot klaret!</h2><p class="lead">Du har løst gåden.</p>' +
        '<div class="stats"><div><b>' + fmt(G.seconds) + '</b><span>Tid</span></div><div><b>' + LEVEL_NAME[G.level] + '</b><span>Sværhedsgrad</span></div>' +
        '<div><b>' + G.hints + '</b><span>Hint brugt</span></div><div><b>' + G.mistakes + '</b><span>Fejl</span></div></div>' +
        '<div class="btns"><button class="btn ghost" data-close type="button">Se pladen</button><button class="btn primary" data-newlevel type="button">Nyt spil</button></div></div>', 'win');
    }, 1100);
  }

  // ---------- Nyt spil ----------
  var worker = null;
  function generate(level) {
    return new Promise(function (resolve) {
      var done = false;
      function finish(r) { if (done) return; done = true; resolve(r); }
      function sync() { setTimeout(function () { var r = E.generate(level); finish({ puzzle: r.puzzle, solution: r.solution, level: r.level }); }, 30); }
      try {
        worker = new Worker('worker.js');
        worker.onmessage = function (e) { worker.terminate(); worker = null; finish(e.data); };
        worker.onerror = function () { if (worker) worker.terminate(); worker = null; sync(); };
        worker.postMessage({ level: level });
        setTimeout(function () { if (!done) { if (worker) worker.terminate(); worker = null; sync(); } }, 15000);
      } catch (e) { sync(); }
    });
  }
  function startGame(level) {
    if (busy) return; busy = true; closeSheet();
    $('#loading').hidden = false;
    var t0 = Date.now();
    generate(level).then(function (res) {
      var wait = Math.max(0, 450 - (Date.now() - t0));   // undgå blink, hvis det går hurtigt
      setTimeout(function () {
        G = newState(res); G.popCell = -1; HS = null; paused = false; hideHintCard();
        boardEl.parentNode.classList.remove('win-anim');
        $('#pauseCover').hidden = true; boardEl.style.visibility = '';
        save(KEY_L, level); saveGame(); render();
        $('#loading').hidden = true; busy = false;
      }, wait);
    });
  }

  // ---------- Dialoger ----------
  function openSheet(html, cls) {
    var sh = $('#sheet'); sh.className = 'sheet' + (cls ? ' ' + cls : ''); sh.innerHTML = html; $('#modal').hidden = false;
    var f = sh.querySelector('button, [tabindex]'); if (f) f.blur();
  }
  function closeSheet() { $('#modal').hidden = true; }
  function openNew() {
    var last = load(KEY_L, 'easy');
    var h = '<h2>Nyt spil</h2><p class="lead">' + (G && !G.done ? 'Dit nuværende spil afsluttes.' : 'Vælg en sværhedsgrad. Hver gåde har kun én løsning.') + '</p>';
    LEVELS.forEach(function (l) {
      h += '<button class="lv' + (l.id === last ? ' cur' : '') + '" data-level="' + l.id + '" type="button"><div class="dots">' +
        [1, 2, 3, 4].map(function (n) { return '<i class="' + (n <= l.dots ? 'on' : '') + '"></i>'; }).join('') + '</div><div><b>' + l.name + '</b><span>' + l.desc + '</span></div></button>';
    });
    h += '<div class="btns"><button class="btn ghost block" data-close type="button">Annullér</button></div>';
    openSheet(h);
  }
  function openSettings() {
    function row(key, title, sub) {
      return '<div class="row"><div>' + title + (sub ? '<small>' + sub + '</small>' : '') + '</div><button class="switch" role="switch" data-set="' + key + '" aria-checked="' + settings[key] + '" aria-label="' + title + '"></button></div>';
    }
    var h = '<h2>Indstillinger</h2>' +
      row('showErrors', 'Vis fejl med det samme', 'Forkerte tal bliver røde.') +
      row('autoRemove', 'Fjern notater automatisk', 'Når du sætter et tal, fjernes det fra notaterne i samme række, kolonne og boks.') +
      row('hlSame', 'Fremhæv ens tal') + row('hlPeers', 'Fremhæv række, kolonne og boks') + row('showTimer', 'Vis tid') +
      '<div class="row"><div>Udseende</div><div class="seg">' +
      [['auto', 'Auto'], ['light', 'Lys'], ['dark', 'Mørk']].map(function (t) { return '<button type="button" data-theme="' + t[0] + '" aria-pressed="' + (settings.theme === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div></div>' +
      '<details><summary>Sådan spiller du</summary><p><b>Tal:</b> Tryk på et felt og derefter på et tal. Tryk på <b>Blyant</b> for at skrive små notater – så kan du have flere mulige tal i samme felt, fx både 1 og 2. Tryk på det samme tal igen for at fjerne det.</p><p><b>Hint:</b> Første tryk giver et vink om, hvor du skal kigge. Næste tryk forklarer hvorfor, og så kan appen sætte tallet ind for dig.</p></details>' +
      '<details><summary>Læg appen på hjemmeskærmen</summary><p><b>iPhone (Safari):</b></p><ol><li>Åbn linket i Safari.</li><li>Tryk på Del-knappen (firkant med pil op).</li><li>Vælg “Føj til hjemmeskærm”, og tryk på “Tilføj”.</li></ol>' +
      '<p><b>Android (Chrome):</b></p><ol><li>Åbn linket i Chrome.</li><li>Tryk på menuen (de tre prikker).</li><li>Vælg “Installer app” eller “Føj til startskærm”.</li></ol><p>Bagefter virker appen også uden internet.</p>' +
      (deferredInstall ? '<button class="btn primary block" data-install type="button">Installer nu</button>' : '') + '</details>' +
      '<div class="btns"><button class="btn primary block" data-close type="button">Færdig</button></div>';
    openSheet(h);
  }

  // ---------- Timer og pause ----------
  function setPaused(p) {
    if (G.done) return;
    paused = p; $('#pauseCover').hidden = !p; renderTimer();
  }
  setInterval(function () {
    if (!G || G.done || paused || document.hidden) return;
    G.seconds++; renderTimer();
    if (G.seconds % 5 === 0) saveGame();
  }, 1000);
  document.addEventListener('visibilitychange', function () { if (document.hidden) saveGame(); });
  window.addEventListener('pagehide', saveGame);

  // ---------- Hændelser ----------
  boardEl.addEventListener('pointerdown', function (e) {
    var el = e.target.closest('.cell'); if (!el || paused) return;
    e.preventDefault(); select(+el.dataset.i);
  });
  padEl.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-erase')) erase(); else enterDigit(+b.dataset.d);
  });
  $('#btnUndo').addEventListener('click', undo);
  $('#btnPencil').addEventListener('click', togglePencil);
  $('#btnHint').addEventListener('click', onHint);
  $('#btnAuto').addEventListener('click', autoNotes);
  $('#hintMore').addEventListener('click', hintMore);
  $('#hintClose').addEventListener('click', closeHint);
  $('#btnNew').addEventListener('click', openNew);
  $('#btnSettings').addEventListener('click', openSettings);
  $('#btnTimer').addEventListener('click', function () { setPaused(!paused); });
  $('#pauseCover').addEventListener('click', function () { setPaused(false); });
  $('#modal').addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('[data-close]')) { closeSheet(); return; }
    var lv = t.closest('[data-level]'); if (lv) { startGame(lv.dataset.level); return; }
    if (t.closest('[data-newlevel]')) { openNew(); return; }
    var sw = t.closest('[data-set]');
    if (sw) { var k = sw.dataset.set; settings[k] = !settings[k]; sw.setAttribute('aria-checked', settings[k]); save(KEY_S, settings); applySettings(); render(); return; }
    var th = t.closest('[data-theme]');
    if (th) { settings.theme = th.dataset.theme; save(KEY_S, settings); applySettings(); Array.prototype.forEach.call(document.querySelectorAll('[data-theme]'), function (b) { b.setAttribute('aria-pressed', b === th); }); return; }
    if (t.closest('[data-install]') && deferredInstall) { deferredInstall.prompt(); deferredInstall = null; closeSheet(); }
  });
  document.addEventListener('keydown', function (e) {
    if (!G || !$('#modal').hidden) { if (e.key === 'Escape') closeSheet(); return; }
    if (e.metaKey || e.ctrlKey) { if (e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); } return; }
    if (/^[1-9]$/.test(e.key)) { enterDigit(+e.key); return; }
    var k = e.key;
    if (k === 'Backspace' || k === 'Delete' || k === '0') { erase(); return; }
    if (k === 'n' || k === 'N' || k === 'p' || k === 'P') { togglePencil(); return; }
    if (k === 'h' || k === 'H') { HS ? hintMore() : onHint(); return; }
    if (k === 'Escape') { if (HS) closeHint(); return; }
    var mv = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[k];
    if (mv) {
      e.preventDefault();
      var cur = G.sel < 0 ? 40 : G.sel, r = Math.max(0, Math.min(8, E.ROW(cur) + mv[0])), c = Math.max(0, Math.min(8, E.COL(cur) + mv[1]));
      select(r * 9 + c);
    }
  });
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; });

  function applySettings() {
    var root = document.documentElement;
    if (settings.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', settings.theme);
    var dark = settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    Array.prototype.forEach.call(metas, function (m) { m.setAttribute('content', dark ? '#11141F' : '#F4F2EE'); m.removeAttribute('media'); });
  }

  // ---------- Start ----------
  function init() {
    applySettings(); buildBoard(); buildPad();
    var saved = load(KEY_G, null);
    if (saved && saved.v === 1 && saved.vals && saved.vals.length === 81) {
      G = saved; G.popCell = -1; HS = null;
      if (G.done) boardEl.parentNode.classList.add('win-anim');
      render();
    } else startGame(load(KEY_L, 'easy'));
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('sw.js').catch(function () { });
    }
  }
  window.__sudoku = { get G() { return G; }, get HS() { return HS; }, startGame: startGame, render: render, E: E };   // til test
  init();
})();
