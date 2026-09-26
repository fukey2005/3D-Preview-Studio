from pathlib import Path
p=Path('.')
f=p/'src/ts/GL/Scenes/TopPageMainScene.ts';s=f.read_text()
s=s.replace('const p=this.progress(stage,y);word=1;rotY=mix(-.13,.34,smooth(.06,.88,p));rotZ=mix(-.025,.025,p);scale=1.10;modelY=-.12;this.world.uniforms.uAccent.value=.20;', '''const p=this.progress(stage,y);word=1;
   // Bust framing: projection, facial pose and body motion share one scroll position.
   scale=mix(2.65,3.0,smooth(.1,.64,p));modelY=mix(-4.08,-4.82,smooth(.1,.64,p));modelX=mobile?-.02:-.1;
   rotY=p<.52?mix(-.12,.52,smooth(.02,.52,p)):mix(.52,-.32,smooth(.52,.94,p));
   rotZ=mix(.012,-.023,smooth(0,1,p));this.world.uniforms.uAccent.value=.20;''')
s=s.replace('const p=this.progress(stage,y);word=1-smooth(.0,.6,p);galleryOpacity=smooth(.03,.42,p);workPosition=-1.1*(1-smooth(0,.85,p));rotY=mix(.1,-.4,p);scale=mix(1.10,.86,p);', '''const p=this.progress(stage,y),u=smooth(0,.86,p);word=1-smooth(.0,.6,p);galleryOpacity=smooth(.24,.68,p);workPosition=-1.1*(1-smooth(0,.85,p));rotY=mix(-.32,-.4,u);rotZ=mix(-.023,-.025,u);modelX=mix(mobile?-.02:-.1,0,u);scale=mix(3.0,.86,u);modelY=mix(-4.82,.05,u);''')
s=s.replace('this.miku.group.position.set(modelX,modelY+Math.sin(t*.65)*.025,0);this.miku.group.scale.setScalar(scale*(mobile?.86:1));', '''if(mobile){
   if(stage==='kv'){scale*=.90;modelY=modelY*.90+.05;}
   else if(stage==='works_intro'){const u=smooth(0,.86,this.progress(stage,y));scale=mix(3.0*.90,.86*.86,u);modelY=mix(-4.82*.90+.05,.05,u);}
   else scale*=.86;
  }
  this.miku.group.position.set(modelX,modelY+Math.sin(t*.65)*.015,0);this.miku.group.scale.setScalar(scale);''')
s=s.replace('rotation:this.miku.group.rotation.toArray(),poseProgress', "rotation:this.miku.group.rotation.toArray(),modelScale:this.miku.group.scale.x,modelPosition:this.miku.group.position.toArray(),framing:['kv','works_intro'].includes(globalState.stage)?'portrait':'scene',poseProgress")
f.write_text(s)
f=p/'src/ts/GL/Entities/Miku.ts';s=f.read_text()
s=s.replace('this.face={smile:.30+hello*.48,blink,wink,mouth:stage===\'works\'?.10:.04+hello*.12};',"this.face={smile:.78+hello*.17,blink,wink,mouth:stage==='works'?.10:.17+hello*.11};")
s=s.replace("this.morph('brow',hello*.18);", "this.morph('brow',.16+hello*.10);this.morph('happy',.12+hello*.16);")
s=s.replace("this.rotate('首',-.018,-.06+hello*.07,-.035-hello*.045);this.rotate('頭',-.012+hello*.025,hello*.055,.018);", """this.rotate('首',-.018+Math.sin(t*.62)*.009,-.025+hello*.07,-.025-hello*.05);this.rotate('頭',-.012+hello*.025,hello*.055+Math.sin(t*.48)*.014,.018);
  this.rotate('両目',-.008+Math.sin(t*.7)*.006,-hello*.06,0);""")
f.write_text(s)
f=p/'src/styles/global.scss';s=f.read_text();s+='\n/* Keep fixed News readable when the portrait hair crosses its original position. */\nbody[data-stage=kv] .hero-news{color:#d7e4e7;text-shadow:0 1px 3px #020610,0 0 10px #020610;background:linear-gradient(90deg,transparent,rgba(3,6,12,.60) 38%);}\n@media(max-width:768px){body[data-stage=kv] .hero-news{background:linear-gradient(0deg,rgba(3,6,12,.82),rgba(3,6,12,.45),transparent);}}\n';f.write_text(s)
f=p/'tests/v3-preview.mjs';s=f.read_text().replace("const out='evidence-v3-preview'", "const out='evidence-v4'")
s=s.replace("const result={screens:[],errors:[],poses:[]};", "const result={screens:[],errors:[],poses:[],checks:[],sequence:[]};")
needle="}await ctx.close();}"
addition="""}
for(const [a,b,label] of [[['kv',.99999],['works_intro',0],'portrait exit'],[['works_intro',.99999],['works',0],'gallery entry']]){
 const before=await p.evaluate(([s,v])=>window.__MIKU.seek(s,v),a);const after=await p.evaluate(([s,v])=>window.__MIKU.seek(s,v),b);
 result.checks.push({device,label,passed:Math.abs(before.modelScale-after.modelScale)<.01&&Math.hypot(...before.modelPosition.map((v,i)=>v-after.modelPosition[i]))<.015});
}
const a=await p.evaluate(()=>window.__MIKU.seek('kv',0));const b=await p.evaluate(()=>window.__MIKU.seek('kv',.8));
result.checks.push({device,label:'smile from first frame',passed:a.face.smile>=.7&&a.avatar.morphs.smile>=.7});
result.checks.push({device,label:'opaque portrait with active wink',passed:a.modelScale>2&&b.avatar.morphs.wink>.9&&a.avatar.materials.every(m=>!m.visible||(!m.transparent&&m.opacity===1))});
result.checks.push({device,label:'scroll rotation',passed:Math.abs(a.rotation[1]-(await p.evaluate(()=>window.__MIKU.seek('kv',.5))).rotation[1])>.4});
if(device==='desktop'){
 await p.setViewportSize({width:1200,height:750});await p.waitForTimeout(400);
 for(let frame=0;frame<60;frame++){
  const progress=frame<34?.84*Math.min(frame/27,1):.84*Math.max(0,1-(frame-34)/25);
  const state=await p.evaluate(([v,t])=>{window.__MIKU.freeze(t);return window.__MIKU.seek('kv',v)},[progress,2+frame/12]);
  result.sequence.push({frame,progress,scale:state.modelScale,rotation:state.rotation,morphs:state.avatar.morphs});
  await p.screenshot({path:`${out}/frame-${String(frame).padStart(3,'0')}.jpg`,type:'jpeg',quality:90,timeout:60000});
 }
}
await ctx.close();}"""
assert needle in s;s=s.replace(needle,addition);s=s.replace('if(result.errors.length)process.exitCode=1;', 'if(result.errors.length||result.checks.some(c=>!c.passed))process.exitCode=1;');f.write_text(s)
