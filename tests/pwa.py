import json
from playwright.sync_api import sync_playwright
URL='http://127.0.0.1:8765/index.html'
with sync_playwright() as p:
    b=p.chromium.launch(channel='chrome',args=['--no-sandbox'])
    c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    pg=c.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.wait_for_function("window.__sudoku&&document.querySelector('#loading').hidden")
    pg.wait_for_function("navigator.serviceWorker.ready.then(()=>true)", timeout=10000)
    ready=pg.evaluate("navigator.serviceWorker.ready.then(r=>!!r.active)")
    print('Service worker aktiv:', ready)
    pg.wait_for_timeout(1500)
    keys=pg.evaluate("caches.keys().then(async k=>{const c=await caches.open(k[0]);return [k,(await c.keys()).map(r=>new URL(r.url).pathname)]})")
    print('Cache:', keys[0], len(keys[1]),'filer')
    # manifest
    mf=pg.evaluate("fetch('manifest.webmanifest').then(r=>r.json())")
    print('Manifest:', mf['name'], mf['display'], [i['sizes']+':'+i['purpose'] for i in mf['icons']])
    for i in mf['icons']:
        r=pg.evaluate("u=>fetch(u).then(r=>[r.status,r.headers.get('content-type')])",i['src']); print('  ikon',i['src'],r)
    # lav et træk, gå offline, genindlæs
    pg.evaluate("__sudoku.G.sel=__sudoku.G.vals.findIndex(v=>!v); __sudoku.render()")
    sv=pg.evaluate("__sudoku.G.solution[__sudoku.G.sel]"); pg.tap(f'#pad button[data-d="{sv}"]')
    vals=pg.evaluate("JSON.stringify(__sudoku.G.vals)")
    c.set_offline(True)
    pg.reload(); pg.wait_for_function("window.__sudoku&&document.querySelector('#loading').hidden", timeout=15000)
    print('Offline genindlæsning OK, spil bevaret:', pg.evaluate("JSON.stringify(__sudoku.G.vals)")==vals)
    # nyt spil offline (worker fra cache)
    pg.tap('#btnNew'); pg.tap('.lv[data-level="hard"]'); pg.wait_for_function("document.querySelector('#loading').hidden && __sudoku.G.level==='hard'", timeout=20000)
    print('Nyt spil offline OK:', pg.evaluate("__sudoku.G.puzzle.filter(Boolean).length"),'givne')
    print('Fejl:', errs)
    b.close()
