import cairosvg
def svg(rounded, scale=1.0):
    # scale<1: board mindre (til maskable safe-zone)
    bx=192; bs=640
    if scale!=1.0:
        bs=int(640*scale); bx=(1024-bs)//2
    c=bs/3; u=c
    by=bx
    out=[]
    out.append('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">')
    out.append('<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6C7CF0"/><stop offset="1" stop-color="#2E3C9C"/></linearGradient>'
               '<filter id="s" x="-20%%" y="-20%%" width="140%%" height="150%%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#141C5E" flood-opacity="0.35"/></filter>'
               '<clipPath id="cp"><rect x="%d" y="%d" width="%d" height="%d" rx="%d"/></clipPath></defs>' % (bx,by,bs,bs,int(bs*0.12)))
    out.append('<rect width="1024" height="1024" rx="%d" fill="url(#g)"/>' % (224 if rounded else 0))
    out.append('<rect x="%d" y="%d" width="%d" height="%d" rx="%d" fill="#F8F9FF" filter="url(#s)"/>' % (bx,by,bs,bs,int(bs*0.12)))
    out.append('<g clip-path="url(#cp)">')
    def cell(r,cn,fill):
        out.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>' % (bx+cn*c,by+r*c,c,c,fill))
    cell(1,1,'#FFD66B'); cell(0,1,'#E4E8FF'); cell(1,0,'#E4E8FF'); cell(1,2,'#E4E8FF'); cell(2,1,'#E4E8FF')
    out.append('</g>')
    tw=int(bs*0.03)
    for i in (1,2):
        out.append('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke="#2E3C9C" stroke-width="%d"/>' % (bx+i*c,by,bx+i*c,by+bs,tw))
        out.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="#2E3C9C" stroke-width="%d"/>' % (bx,by+i*c,bx+bs,by+i*c,tw))
    out.append('<rect x="%d" y="%d" width="%d" height="%d" rx="%d" fill="none" stroke="#2E3C9C" stroke-width="%d"/>' % (bx,by,bs,bs,int(bs*0.12),int(bs*0.04)))
    fs=int(c*0.72)
    def digit(r,cn,t,fill):
        out.append('<text x="%.1f" y="%.1f" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="%d" fill="%s" text-anchor="middle">%s</text>' % (bx+(cn+0.5)*c,by+(r+0.5)*c+fs*0.35,fs,fill,t))
    digit(1,1,'5','#2E3C9C'); digit(0,0,'7','#2E3C9C'); digit(0,2,'3','#2E3C9C'); digit(2,0,'1','#2E3C9C'); digit(2,2,'9','#2E3C9C'); digit(1,0,'2','#6C7CF0'); digit(1,2,'8','#6C7CF0'); digit(0,1,'4','#6C7CF0'); digit(2,1,'6','#6C7CF0')
    out.append('</svg>')
    return '\n'.join(out)
open('icons/icon.svg','w').write(svg(True))
cairosvg.svg2png(bytestring=svg(True).encode(),write_to='icons/icon-512.png',output_width=512,output_height=512)
cairosvg.svg2png(bytestring=svg(True).encode(),write_to='icons/icon-192.png',output_width=192,output_height=192)
cairosvg.svg2png(bytestring=svg(False,0.78).encode(),write_to='icons/icon-maskable-512.png',output_width=512,output_height=512)
cairosvg.svg2png(bytestring=svg(False).encode(),write_to='icons/apple-touch-icon.png',output_width=180,output_height=180)
cairosvg.svg2png(bytestring=svg(True).encode(),write_to='icons/favicon-32.png',output_width=32,output_height=32)
