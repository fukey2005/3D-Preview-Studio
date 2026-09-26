from pathlib import Path
p=Path('.')
f=p/'src/ts/GL/Scenes/TopPageMainScene.ts';s=f.read_text()
s=s.replace('let modelVisible=true,outlineOpacity','let portrait=false;\n  let modelVisible=true,outlineOpacity')
s=s.replace('const p=this.progress(stage,y);word=1;rotY=mix(-.13,.34,smooth(.06,.88,p));rotZ=mix(-.025,.025,p);scale=1.10;modelY=-.12;this.world.uniforms.uAccent.value=.20;', '''const p=this.progress(stage,y);word=1;portrait=true;
   // Bust framing: projection, facial pose and body motion share one scroll position.
   scale=mix(2.65,3.0,smooth(.1,.64,p));modelY=mix(-4.08,-4.82,smooth(.1,.64,p));modelX=mobile?-.02:-.1;
   rotY=p<.52?mix(-.12,.52,smooth(.02,.52,p)):mix(.52,-.32,smooth(.52,.94,p));
   rotZ=mix(.012,-.023,smooth(0,1,p));this.world.uniforms.uAccent.value=.16;''')
s=s.replace('const p=this.progress(stage,y);word=1-smooth(.0,.6,p);galleryOpacity=smooth(.03,.42,p);workPosition=-1.1*(1-smooth(0,.85,p));rotY=mix(.1,-.4,p);scale=mix(1.10,.86,p);', '''const p=this.progress(stage,y),u=smooth(0,.86,p);word=1-smooth(.0,.6,p);galleryOpacity=smooth(.24,.68,p);workPosition=-1.1*(1-smooth(0,.85,p));rotY=mix(-.32,-.4,u);scale=mix(3.0,.86,u);modelY=mix(-4.82,.05,u);portrait=p<.8;''')
s=s.replace('this.miku.group.position.set(modelX,modelY+Math.sin(t*.65)*.025,0);this.miku.group.scale.setScalar(scale*(mobile?.86:1));', '''if(mobile&&portrait){const u=stage==='works_intro'?smooth(0,.86,this.progress(stage,y)):0;scale=mix(scale*.74,scale,u);modelY=mix(modelY*.74-.12,modelY,u);}
  this.miku.group.position.set(modelX,modelY+Math.sin(t*.65)*.015,0);this.miku.group.scale.setScalar(scale*(mobile&&!portrait?.86:1));''')
s=s.replace('rotation:this.miku.group.rotation.toArray(),poseProgress', "rotation:this.miku.group.rotation.toArray(),modelScale:this.miku.group.scale.x,modelPosition:this.miku.group.position.toArray(),framing:['kv','works_intro'].includes(globalState.stage)?'portrait':'scene',poseProgress")
f.write_text(s)
f=p/'src/ts/GL/Entities/Miku.ts';s=f.read_text()
s=s.replace('this.face={smile:.30+hello*.48,blink,wink,mouth:stage===\'works\'?.10:.04+hello*.12};',"this.face={smile:.78+hello*.17,blink,wink,mouth:stage==='works'?.10:.17+hello*.11};")
s=s.replace("this.morph('brow',hello*.18);", "this.morph('brow',.16+hello*.10);this.morph('happy',.12+hello*.16);")
s=s.replace("this.rotate('首',-.018,-.06+hello*.07,-.035-hello*.045);this.rotate('頭',-.012+hello*.025,hello*.055,.018);", """this.rotate('首',-.018+Math.sin(t*.62)*.009,-.025+hello*.07,-.025-hello*.05);this.rotate('頭',-.012+hello*.025,hello*.055+Math.sin(t*.48)*.014,.018);
  this.rotate('両目',-.008+Math.sin(t*.7)*.006,-hello*.06,0);""")
f.write_text(s)
f=p/'tests/v3-preview.mjs';s=f.read_text().replace("const out='evidence-v3-preview'", "const out='evidence-v4'")
f.write_text(s)
