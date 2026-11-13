import json
from playwright.sync_api import sync_playwright
OUT='/workspace/sudoku/screenshots/'
URL='http://127.0.0.1:8765/index.html'
VPS=[('iphone-15-390x844',390,844,'light'),('iphone-se-375x667',375,667,'light'),('android-360x740',360,740,'dark'),('android-412x915',412,915,'light'),
     ('iphone-mini-landscape-844x390',844,390,'light'),('ipad-768x1024',768,1024,'light'),('desktop-1280x800',1280,800,'dark')]
bad=0
with sync_playwright() as p:
    b=p.chromium.launch(channel='chrome',args=['--no-sandbox'])
    for name,w,h,sch in VPS:
        mobile = w<800
        c=b.new_context(viewport={'width':w,'height':h},device_scale_factor=2,is_mobile=mobile,has_touch=mobile,color_scheme=sch,locale='da-DK')
        pg=c.new_page(); pg.goto(URL); pg.wait_for_function("window.__sudoku&&window.__sudoku.G&&document.querySelector('#loading').hidden")
        pg.evaluate("(()=>{const S=__sudoku,g=S.G;const b=S.E.candidatesBasic(g.vals);for(let i=0;i<81;i++)if(!g.vals[i]&&i%3)g.notes[i]=b[i];g.sel=40;S.render();})()")
        pg.wait_for_timeout(300)
        m=pg.evaluate("""()=>{const r=s=>{const e=document.querySelector(s).getBoundingClientRect();return {x:e.x,y:e.y,w:e.width,h:e.height,b:e.bottom,r:e.right}};
          const pads=[...document.querySelectorAll('#pad button')].map(e=>e.getBoundingClientRect());
          return {sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,iw:innerWidth,ih:innerHeight,board:r('#board'),pad:{minw:Math.min(...pads.map(p=>p.width)),minh:Math.min(...pads.map(p=>p.height)),bottom:Math.max(...pads.map(p=>p.bottom)),right:Math.max(...pads.map(p=>p.right))},act:r('.actions'),top:r('.top')}}""")
        issues=[]
        if m['sw']>m['iw']: issues.append('vandret scroll')
        if m['sh']>m['ih']+1: issues.append('lodret scroll %d>%d'%(m['sh'],m['ih']))
        if abs(m['board']['w']-m['board']['h'])>1: issues.append('plade ikke kvadratisk')
        if m['board']['r']>m['iw']+0.5 or m['board']['x']<0: issues.append('plade uden for skærm')
        if m['pad']['bottom']>m['ih']: issues.append('knapper uden for skærm')
        if m['pad']['minw']<40 or m['pad']['minh']<40: issues.append('små tryk-mål %.0fx%.0f'%(m['pad']['minw'],m['pad']['minh']))
        print(('OK   ' if not issues else 'FEJL ')+name, 'plade=%dpx'%m['board']['w'], 'tal-knap=%dx%d'%(m['pad']['minw'],m['pad']['minh']), issues)
        bad+=bool(issues)
        pg.screenshot(path=OUT+'layout-'+name+'.png')
        c.close()
    b.close()
print('layoutfejl:',bad)
