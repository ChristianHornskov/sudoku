import sys, json
from playwright.sync_api import sync_playwright
OUT='/workspace/sudoku/screenshots/'
URL='http://127.0.0.1:8765/index.html'
def launch(p): return p.chromium.launch(channel='chrome',args=['--no-sandbox'])
def ctx(b, w, h, scheme='light', mobile=True, **kw):
    return b.new_context(viewport={'width':w,'height':h}, device_scale_factor=2, is_mobile=mobile, has_touch=mobile, color_scheme=scheme, locale='da-DK', **kw)
def wait_ready(pg):
    pg.wait_for_function("window.__sudoku && window.__sudoku.G && document.querySelector('#loading').hidden")
with sync_playwright() as p:
    b=launch(p)
    c=ctx(b,390,844); pg=c.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto(URL); wait_ready(pg)
    pg.screenshot(path=OUT+'01-start-let-390.png')
    print('errors', errs)
    b.close()
