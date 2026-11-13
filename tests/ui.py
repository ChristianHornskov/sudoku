import sys, json, time, os
from playwright.sync_api import sync_playwright
OUT='/workspace/sudoku/screenshots/'
URL='http://127.0.0.1:8765/index.html'
results=[]
def check(name, cond, info=''):
    results.append((name, bool(cond), info)); print(('OK   ' if cond else 'FEJL ')+name+(' — '+str(info) if info else ''))
def launch(p): return p.chromium.launch(channel='chrome',args=['--no-sandbox'])
def mk(b, w, h, scheme='light', mobile=True):
    return b.new_context(viewport={'width':w,'height':h}, device_scale_factor=2, is_mobile=mobile, has_touch=mobile, color_scheme=scheme, locale='da-DK')
def ready(pg): pg.wait_for_function("window.__sudoku && window.__sudoku.G && document.querySelector('#loading').hidden")
def shot(pg,name):
    pg.wait_for_timeout(500); pg.screenshot(path=OUT+name+'.png')
def G(pg,expr): return pg.evaluate("(()=>{const G=__sudoku.G; return "+expr+"})()")

SETUP = """([level, seed, tech, fillNotes]) => {
  const S=__sudoku, E=S.E, g=S.G;
  let r=E.generate(level, seed);
  if (tech) { let k=0; while(!(r.grade.counts[tech]>0) && k++<600) r=E.generate(level, seed+1+k*7); if(!(r.grade.counts[tech]>0)) return 'ingen puzzle med '+tech; }
  g.puzzle=r.puzzle; g.solution=r.solution; g.vals=r.puzzle.slice(); g.notes=new Array(81).fill(0); g.elim=new Array(81).fill(0);
  g.undo=[]; g.sel=-1; g.pencil=false; g.hints=0; g.mistakes=0; g.done=false; g.level=level;
  if (tech) { let guard=0; while(guard++<500){ const st=E.nextStep(g.vals,g.elim); if(!st||st.error) return 'ingen:'+JSON.stringify(st); if(st.tech===tech) break;
      if(st.place) g.vals[st.place.cell]=st.place.digit; st.elims.forEach(e=>g.elim[e.cell]|=e.mask); } }
  if (fillNotes) { const b=E.candidatesBasic(g.vals); for(let i=0;i<81;i++) if(!g.vals[i]) g.notes[i]=b[i]&~g.elim[i]; }
  S.render(); return 'ok';
}"""

with sync_playwright() as p:
    b=launch(p)
    c=mk(b,390,844); pg=c.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto(URL); ready(pg)
    shot(pg,'01-start-let-390')

    # --- Grundfunktioner ---
    pg.evaluate(SETUP,['medium',4242,None,False])
    empties=pg.evaluate("__sudoku.G.vals.map((v,i)=>v?-1:i).filter(i=>i>=0)")
    e0=empties[0]
    sol=G(pg,"G.solution[%d]"%e0)
    pg.tap(f'.cell[data-i="{e0}"]'); 
    check('Valg af felt giver .sel', 'sel' in pg.get_attribute(f'.cell[data-i="{e0}"]','class'))
    check('Række/kolonne/boks fremhæves (.peer)', pg.locator('.cell.peer').count()==20, pg.locator('.cell.peer').count())
    pg.tap(f'#pad button[data-d="{sol}"]')
    check('Rigtigt tal sættes', pg.inner_text(f'.cell[data-i="{e0}"] .val')==str(sol))
    check('Undo-knap aktiv efter træk', pg.is_enabled('#btnUndo'))
    pg.tap('#btnUndo')
    check('Fortryd fjerner tallet', pg.inner_text(f'.cell[data-i="{e0}"] .val')=='')
    # forkert tal + fejlmarkering
    wrong = 1 if sol!=1 else 2
    pg.tap(f'#pad button[data-d="{wrong}"]')
    check('Forkert tal markeres rødt (.err)', 'err' in pg.get_attribute(f'.cell[data-i="{e0}"]','class'))
    shot(pg,'02-fejlmarkering')
    pg.evaluate("document.querySelector('#btnSettings').click()"); pg.tap('[data-set="showErrors"]'); pg.tap('.sheet [data-close]')
    check('Fejlmarkering kan slås fra', 'err' not in pg.get_attribute(f'.cell[data-i="{e0}"]','class'))
    pg.evaluate("document.querySelector('#btnSettings').click()"); pg.tap('[data-set="showErrors"]'); pg.tap('.sheet [data-close]')
    pg.tap('#pad .erase')
    check('Viskelæder fjerner tal', pg.inner_text(f'.cell[data-i="{e0}"] .val')=='')
    # blyant
    pg.tap('#btnPencil')
    check('Blyant-knap viser TIL', pg.inner_text('#pencilBadge')=='TIL' and pg.get_attribute('#btnPencil','aria-pressed')=='true')
    pg.tap('#pad button[data-d="1"]'); pg.tap('#pad button[data-d="2"]')
    on=pg.evaluate(f"[...document.querySelectorAll('.cell[data-i=\"{e0}\"] .notes i.on')].map(x=>x.textContent)")
    check('Flere notater i samme felt (1 og 2)', on==['1','2'], on)
    shot(pg,'03-blyant-notater-1-og-2')
    pg.tap('#pad button[data-d="1"]')
    on=pg.evaluate(f"[...document.querySelectorAll('.cell[data-i=\"{e0}\"] .notes i.on')].map(x=>x.textContent)")
    check('Notat kan slås fra igen', on==['2'], on)
    pg.tap('#btnPencil')
    # auto-fjern notater (ægte tal i et felt fjerner notater i peers)
    pg.tap('#btnAuto'); 
    peer=pg.evaluate(f"__sudoku.E.PEERS[{e0}].filter(p=>!__sudoku.G.vals[p])[0]")
    before=G(pg,f"(G.notes[{peer}]>>({sol}-1))&1")
    pg.tap('#pad .erase'); 
    pg.evaluate(f"__sudoku.G.notes[{e0}]=0")
    pg.tap(f'.cell[data-i="{e0}"]'); pg.tap(f'#pad button[data-d="{sol}"]')
    after=G(pg,f"(G.notes[{peer}]>>({sol}-1))&1")
    check('Auto-notat udfylder, og rigtigt tal fjerner notat i peers', before==1 and after==0, (before,after))
    # samme tal fremhæves
    check('Samme tal fremhæves', pg.locator('.cell.same').count()>=1, pg.locator('.cell.same').count())
    shot(pg,'04-valgt-felt-fremhaevning')

    # --- Hints ---
    def hint_case(tag, level, seed, tech, fn):
        if pg.is_visible('#hintCard'): pg.tap('#hintClose')
        r=pg.evaluate(SETUP,[level,seed,tech,True])
        if r!='ok': check('hint-setup '+tag, False, r); return
        pg.tap('#btnHint')
        check(f'{tag}: hint-kort vises (nudge)', pg.is_visible('#hintCard') and pg.inner_text('#hintStep')=='Trin 1 af 2')
        t1=pg.inner_text('#hintText'); tg=pg.inner_text('#hintTag')
        shot(pg,f'hint-{fn}-1-nudge')
        pg.tap('#hintMore')
        check(f'{tag}: trin 2 forklarer', pg.inner_text('#hintStep')=='Trin 2 af 2' and len(pg.inner_text('#hintText'))>len(t1)*0.6, tg)
        shot(pg,f'hint-{fn}-2-forklaring')
        print('   ', tg, '|', pg.inner_text('#hintText')[:230])
        return pg.inner_text('#hintMore')
    hint_case('Nøgen enkelt','easy',11,'nakedSingle','nogen-enkelt')
    st=G(pg,"JSON.stringify({v:G.vals.filter(Boolean).length})")
    pg.tap('#hintMore')
    check('Hint "Sæt tallet ind" sætter tal', json.loads(G(pg,"JSON.stringify({v:G.vals.filter(Boolean).length})"))['v']==json.loads(st)['v']+1 and G(pg,"G.hints")==1)
    check('Hint-sat tal er rigtigt', G(pg,"G.vals.every((v,i)=>!v||v===G.solution[i])"))
    hint_case('Skjult enkelt','medium',21,'hiddenSingle','skjult-enkelt')
    hint_case('Nøgent par','medium',31,'nakedPair','nogent-par')
    pg.tap('#hintMore')
    check('Nøgent par: kandidater fjernet i notater', G(pg,"G.elim.some(Boolean)"))
    hint_case('Pegende par','medium',32,'pointing','pegende-par')
    hint_case('Boks/linje','medium',33,'boxLine','boks-linje')
    hint_case('Skjult par','hard',41,'hiddenPair','skjult-par')
    hint_case('X-Wing','expert',55,'xwing','x-wing')
    hint_case('XY-Wing','expert',61,'xyWing','xy-wing')
    hint_case('XYZ-Wing','expert',62,'xyzWing','xyz-wing')
    pg.tap('#hintClose')
    check('Luk skjuler hint-kortet', not pg.is_visible('#hintCard') and pg.is_visible('#pad'))
    # fejl-hint
    pg.evaluate(SETUP,['easy',11,None,False])
    ei=pg.evaluate("__sudoku.G.vals.findIndex(v=>!v)"); sv=G(pg,f"G.solution[{ei}]")
    pg.tap(f'.cell[data-i="{ei}"]'); pg.tap(f'#pad button[data-d="{1 if sv!=1 else 2}"]')
    pg.tap('#btnHint'); t=pg.inner_text('#hintTag'); check('Hint melder fejl på pladen', t=='Fejl på pladen', t)
    pg.tap('#hintMore'); shot(pg,'hint-fejl-2'); print('   ',pg.inner_text('#hintText'))
    pg.tap('#hintMore'); check('Fejl-hint fjerner det forkerte tal', G(pg,f"G.vals[{ei}]")==0)

    # --- Persistens ---
    pg.evaluate(SETUP,['medium',4242,None,False]); pg.tap('.cell[data-i="%d"]'%e0); 
    pg.tap(f'#pad button[data-d="{G(pg,"G.solution[%d]"%e0)}"]')
    vals=G(pg,"JSON.stringify(G.vals)"); pg.wait_for_timeout(300)
    pg.reload(); ready(pg)
    check('Spillet gemmes og genoptages efter genindlæsning', G(pg,"JSON.stringify(G.vals)")==vals)

    # --- Timer/pause ---
    s0=G(pg,"G.seconds"); pg.wait_for_timeout(2300); s1=G(pg,"G.seconds")
    check('Timer tæller', s1>=s0+2, (s0,s1))
    pg.tap('#btnTimer'); check('Pause skjuler pladen', pg.is_visible('#pauseCover')); shot(pg,'05-pause')
    pg.tap('#pauseCover'); check('Tryk genoptager', not pg.is_visible('#pauseCover'))

    # --- Nyt spil ---
    pg.tap('#btnNew'); shot(pg,'06-nyt-spil-svaerhedsgrad')
    for lvl in ['easy','medium','hard','expert']:
        if not pg.is_visible('.lv'): pg.tap('#btnNew')
        pg.tap(f'.lv[data-level="{lvl}"]'); ready(pg); pg.wait_for_function("document.querySelector('#loading').hidden")
        n=G(pg,"G.puzzle.filter(Boolean).length"); lv=G(pg,"G.level")
        cnt=pg.evaluate("__sudoku.E.countSolutions(__sudoku.G.puzzle,2).count")
        check(f'Nyt spil via UI: {lvl}', lv==lvl and cnt==1, f'givne={n}, løsninger={cnt}')
        if lvl=='expert': shot(pg,'07-ekspert-spil')

    # --- Indstillinger ---
    pg.tap('#btnSettings'); shot(pg,'08-indstillinger')
    pg.evaluate("document.querySelector('details').open=true; document.querySelectorAll('details')[1].open=true"); 
    pg.evaluate("document.querySelector('.sheet').scrollTop=9999"); shot(pg,'09-indstillinger-hjemmeskaerm')
    pg.tap('.sheet [data-close]')

    # --- Gevinst ---
    pg.evaluate(SETUP,['easy',99,None,False])
    pg.evaluate("(()=>{const g=__sudoku.G; let last=-1; for(let i=0;i<81;i++){ if(!g.vals[i]){ if(last<0) last=i; else g.vals[i]=g.solution[i]; } } g.sel=last; __sudoku.render();})()")
    li=G(pg,"G.sel"); pg.tap(f'#pad button[data-d="{G(pg,"G.solution[%d]"%li)}"]')
    pg.wait_for_selector('.sheet.win',timeout=4000); check('Gevinstskærm vises ved løst gåde', True)
    pg.wait_for_timeout(200); shot(pg,'10-gevinst')
    pg.tap('.sheet [data-close]'); pg.wait_for_timeout(300); shot(pg,'10b-loest-plade')
    check('Ingen JS-fejl', not errs, errs)
    b.close()

    # --- Mørk tilstand ---
    b=launch(p); c=mk(b,390,844,'dark'); pg=c.new_page(); pg.goto(URL); ready(pg)
    pg.evaluate(SETUP,['medium',4242,None,True]); pg.tap('.cell[data-i="%d"]'%e0); shot(pg,'11-moerk-noter-390')
    pg.evaluate(SETUP,['expert',55,'xwing',True]); pg.tap('#btnHint'); pg.tap('#hintMore'); shot(pg,'12-moerk-hint-xwing')
    pg.tap('#hintClose'); pg.tap('#btnSettings'); shot(pg,'13-moerk-indstillinger')
    b.close()
    json.dump(results, open('/workspace/sudoku/tests/ui-results.json','w'), ensure_ascii=False, indent=1)
    print('FEJL i alt:', sum(1 for r in results if not r[1]), 'af', len(results))
