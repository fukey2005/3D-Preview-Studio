from pathlib import Path

def edit(file,old,new):
 p=Path(file);s=p.read_text();assert old in s,(file,old[:120]);p.write_text(s.replace(old,new))
f='src/ts/GL/Scenes/PortraitDirector.ts'
edit(f,"eyeY:mobile?.265:.31,yaw:mix(-.38,-.18,smooth(p))","eyeY:mobile?.70:.31,yaw:mix(-.38,-.18,smooth(p))")
edit(f,"eyeY:mobile?.265:.31,yaw:-.18+Math.sin(p*Math.PI)*.06", "eyeY:mobile?(stage==='mission_in'?.70:mix(.70,.40,smooth(p))):.31,yaw:-.18+Math.sin(p*Math.PI)*.06")
edit(f,"if(stage==='vision')return {scale:mobile?1.65:2.38,eyeX:mobile?.38:.31,eyeY:mobile?.275:.40,", "if(stage==='vision')return {scale:mix(mobile?1.62:2.30,mobile?1.65:2.38,smooth(p/.20)),eyeX:mobile?.68:mix(.77,.31,smooth(p/.20)),eyeY:mobile?.40:mix(.31,.40,smooth(p/.20)),")
edit(f,"eyeX:mix(mobile?.38:.31,-.8,smooth(p)),eyeY:mix(mobile?.275:.40,-.5,smooth(p))", "eyeX:mix(mobile?.68:.31,-.8,smooth(p)),eyeY:mix(.40,-.5,smooth(p))")
f='src/ts/GL/Scenes/TopPageMainScene.ts'
edit(f,"this.bounds[e.dataset.stage!]={start,end:start+r.height,height:r.height};});", "this.bounds[e.dataset.stage!]={start,end:start+r.height,height:r.height};});if(this.bounds.kv&&this.bounds.works_intro){this.bounds.kv.end=this.bounds.works_intro.start;this.bounds.kv.height=this.bounds.kv.end-this.bounds.kv.start;}")
edit(f,"const outro=document.querySelector<HTMLElement>", "if(this.width<769){for(const element of [mission,vision])if(element){element.style.opacity='1';element.inert=false;}}\n  const outro=document.querySelector<HTMLElement>")
f='src/ts/GL/Entities/Miku.ts'
edit(f,"stage==='vision'?.35+.65*(1-Math.cos(p*Math.PI*2))*.5", "stage==='vision'?THREE.MathUtils.lerp(.82,.35+.65*(1-Math.cos(p*Math.PI*2))*.5,smooth(0,.20,p))")
f='src/pages/index.astro'
edit(f,'Create voices<br/>that connect hearts and open worlds.', 'Create voices<br class="vision-mobile-break"/>that connect hearts<br/>and open worlds.')
f='src/data/works.ts';p=Path(f);s=p.read_text();s=s.replace('初音ミクの3Dモデルに屈折と反射のマテリアルを与え、周囲の色やタイポグラフィを取り込むガラスの彫刻として構成したビジュアルスタディです。','初音ミクの輪郭は不透明なトゥーン表示で保ち、背景側に屈折と反射の光を配置したビジュアルスタディです。');s=s.replace('A transparent character takes on the colours of an environment without losing her unmistakable silhouette.','An opaque character sits within refracted light while preserving her unmistakable silhouette.');p.write_text(s)
p=Path('src/styles/global.scss');p.write_text(p.read_text()+'''
/* Reference uses a viewport KV followed by a separate 100px spacer. */
.stage-kv{height:100svh;margin-bottom:100px}
.statement-ja{font-synthesis:weight;font-weight:700;-webkit-text-stroke:.22px currentColor}
.hero-news{color:#c4d0d3;text-shadow:0 1px 3px #000,0 0 9px #000}
.vision-mobile-break{display:none}
@media(max-width:768px){
 .stage-vision{height:auto;min-height:0}
 .statement{position:relative;inset:auto;height:auto;min-height:0;opacity:1!important}
 .statement-inner{width:90%;height:auto;padding:0}
 .statement h2{height:auto;line-height:1}
 .statement[data-mission] .statement-inner{padding-top:40px}
 .statement[data-mission] h2{font-size:16.3101vw}
 .statement[data-vision] h2{font-size:14.455128vw}
 .statement .statement-ja{font-size:6vw;line-height:1.7;letter-spacing:.045em}
 .statement[data-mission] .statement-ja{margin-top:90px}
 .statement[data-vision] .statement-ja{margin-top:95px}
 .statement-en{position:relative;inset:auto;bottom:auto;max-width:none;line-height:1.3;font-size:12px;letter-spacing:.25px;margin-top:40px}
 .statement[data-vision] .statement-en{width:50vw;min-height:46.8px}
 .vision-mobile-break{display:block}
 /* Natural mobile footer: measured logo ratio + navigation space, not a full-screen pin. */
 .stage-footer{height:calc(31.45vw + 387.4375px)}
 .footer-scene{position:relative;inset:auto;height:100%;padding:40px 5vw 24px;opacity:1;pointer-events:auto;justify-content:center}
 .footer-scene .footer-word{font-size:37vw;margin:0 0 70px;flex:none}
 .footer-scene .footer-word span+span{clip-path:none}
 .footer-scene .footer-bottom{position:relative;inset:auto;grid-template-columns:1fr 105px;gap:25px 15px;width:100%}
 .footer-scene .footer-bottom nav{grid-template-columns:repeat(2,max-content);grid-template-rows:repeat(3,auto);grid-auto-flow:column;gap:11px 28px;font-size:13px}
 .footer-scene .footer-links{display:flex;align-items:flex-start;flex-direction:column;gap:7px;font-size:9px}
 .footer-scene .footer-links>span{text-align:left;font-size:12px;color:#bbb}
 .footer-scene .footer-cta{display:none}
 .footer-scene .footer-legal{grid-column:1/-1;justify-content:flex-start;gap:13px;font-size:10px}
 .footer-scene .footer-legal small{font-size:8px;margin-top:16px}
}
''')
f='src/glsl/grid.frag.glsl'
edit(f,'vec2 paper=screen*uViewport;float spacing=uViewport.x<769.?90.:180.;','float spacing=uViewport.x<769.?uViewport.x*.2705:uViewport.y*.2024;vec2 origin=uViewport.x<769.?vec2(uViewport.x*.5,54.):vec2(uViewport.x*.1202,111.);vec2 paper=vec2(screen.x,1.-screen.y)*uViewport-origin;')
edit(f,'vec3 pale=vec3(.76,.823,.84)-paperGrid*.025-paperCross*.22;','vec3 pale=vec3(.735,.855,.905)-paperGrid*.055-paperCross*.25;')
f='src/ts/GL/Entities/World.ts'
edit(f,'Math.sin(x/12)*12,y, -6+(1-Math.cos(x/12))*12 + y*y*.008','Math.sin(x/10.5)*10.5,y, -6+(1-Math.cos(x/10.5))*10.5 + y*y*.017')
# Deliberate acceptance changes: smiling at rest; keep face visible instead of turning the back.
f='tests/verify.mjs'
edit(f,'wink.avatar.morphs.smile>info.avatar.morphs.smile+.3','wink.avatar.morphs.smile>info.avatar.morphs.smile+.12')
edit(f,"window.__MIKU.seek('vision',.65)","window.__MIKU.seek('kv',.58)")
edit(f,'Math.abs(turned.rotation[1]-info.rotation[1])>2.0','Math.abs(turned.rotation[1]-info.rotation[1])>.30')
p=Path('src/styles/global.scss');p.write_text(p.read_text()+'''\n@media(max-width:768px){.stage-stellla .platform-overlay{position:sticky;inset:auto;top:0;height:100svh;}.statement-en{font-weight:300}.stage-vision .statement-en{min-height:46.78125px}}\n''')
print('Applied measured mobile-flow correction, continuous portrait direction, and two documented acceptance changes.')
