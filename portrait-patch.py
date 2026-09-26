from pathlib import Path

def replace(file,old,new):
 p=Path(file);s=p.read_text();assert old in s,(file,old[:100]);p.write_text(s.replace(old,new))
Path('src/ts/GL/Scenes/PortraitDirector.ts').write_text('''import * as THREE from 'three';
export interface PortraitShot {scale:number; eyeX:number; eyeY:number; yaw:number; roll:number; visible:boolean;}
const smooth=(x:number)=>{const t=THREE.MathUtils.clamp(x,0,1);return t*t*(3-2*t);};
const mix=THREE.MathUtils.lerp;
function track(p:number,keys:number[][]){for(let i=1;i<keys.length;i++){if(p<=keys[i][0])return mix(keys[i-1][1],keys[i][1],smooth((p-keys[i-1][0])/(keys[i][0]-keys[i-1][0])));}return keys[keys.length-1][1];}
/** Deliberate requested variation: readable, opaque waist-up Miku rather than the glass logo. */
export function portraitShot(stage:string,p:number,mobile:boolean):PortraitShot|null {
 const start=mobile?2.12:2.62;
 const heroY=mobile?.335:.36;
 if(stage==='kv')return {scale:start+track(p,[[0,0],[.45,.04],[.78,.16],[1,.09]]),eyeX:.5+Math.sin(p*Math.PI*2)*.012,eyeY:heroY,yaw:track(p,[[0,-.08],[.28,.31],[.59,-.48],[.78,-.10],[1,.26]]),roll:track(p,[[0,-.024],[.40,.025],[.70,-.046],[1,-.012]]),visible:true};
 if(stage==='works_intro')return {scale:mix(start+.09,start*.64,smooth(p)),eyeX:mix(.5,-.8,smooth(p/.52)),eyeY:mix(heroY,.4,smooth(p)),yaw:mix(.26,-.52,smooth(p)),roll:-.012,visible:p<.55};
 if(stage==='works')return {scale:1,eyeX:.5,eyeY:.35,yaw:0,roll:0,visible:false};
 if(stage==='works_outro')return {scale:mobile?1.62:2.30,eyeX:mix(1.6,mobile?.68:.77,smooth((p-.5)/.5)),eyeY:mobile?.265:.31,yaw:mix(-.38,-.18,smooth(p)),roll:-.02,visible:p>.5};
 if(stage==='mission_in'||stage==='mission')return {scale:mobile?1.62:2.30,eyeX:mobile?.68:.77,eyeY:mobile?.265:.31,yaw:-.18+Math.sin(p*Math.PI)*.06,roll:-.02,visible:true};
 if(stage==='vision')return {scale:mobile?1.65:2.38,eyeX:mobile?.38:.31,eyeY:mobile?.275:.40,yaw:track(p,[[0,-.18],[.42,.50],[.7,-.42],[1,.18]]),roll:track(p,[[0,-.02],[.35,.03],[1,-.03]]),visible:true};
 if(stage==='vision_out')return {scale:mix(mobile?1.65:2.38,mobile?2.1:3.3,smooth(p)),eyeX:mix(mobile?.38:.31,-.8,smooth(p)),eyeY:mix(mobile?.275:.40,-.5,smooth(p)),yaw:mix(.18,.65,smooth(p)),roll:-.03,visible:p<.72};
 return null;
}
''')
scene='src/ts/GL/Scenes/TopPageMainScene.ts'
replace(scene,"import {RoomEnvironment}","import {portraitShot} from './PortraitDirector';\nimport {RoomEnvironment}")
replace(scene,"galleryOpacity=smooth(.03,.42,p)","galleryOpacity=smooth(.28,.66,p)")
replace(scene,"this.miku.update(t,this.height*this.dpr,split);",'''const shot=portraitShot(stage,this.progress(stage,y),mobile);
  if(shot&&!this.artMode){
   this.miku.group.visible=shot.visible;this.miku.group.scale.setScalar(shot.scale);
   this.miku.group.position.set(0,0,0);
   this.miku.group.rotation.set(this.drag.y+this.rotation.y*.018,shot.yaw+this.drag.x+this.rotation.x*.028,shot.roll);
   this.miku.eyeContact(shot.yaw+this.drag.x);
   this.miku.group.updateMatrixWorld(true);
   const eye=this.miku.eyePosition();
   const half=(this.camera.position.z-eye.z)*Math.tan(THREE.MathUtils.degToRad(this.camera.fov*.5));
   const targetX=(shot.eyeX*2-1)*half*aspect;
   const targetY=(1-shot.eyeY*2)*half;
   this.miku.group.position.x=targetX-eye.x;this.miku.group.position.y=targetY-eye.y;
   this.miku.group.updateMatrixWorld(true);
  }
  this.miku.update(t,this.height*this.dpr,split);''')
replace(scene,"face:this.miku.face,avatar:","face:this.miku.face,framing:this.miku.screenBounds(this.camera,this.width,this.height),avatar:")
replace(scene,"'#e6fffb','#8b97a8',1.5","'#f5fff9','#8faba8',1.05")
replace(scene,"'#fffaf5',1.1","'#fffaf5',.9")
replace(scene,"'#d5fff8',.42","'#e6fff6',.26")
replace(scene,"'#e5e8ff',.55","'#bffff0',.38")
model='src/ts/GL/Entities/Miku.ts'
replace(model,"gradientMap:gradient,emissive:new THREE.Color(.065,.065,.065)","gradientMap:gradient,emissive:new THREE.Color(.025,.025,.025)")
replace(model,"smile:['にっこり','口角上げ','にやり']","smile:['にっこり','口角上げ','にやり'],grin:['口角上げ']")
replace(model,"const hello=stage==='kv'?smooth(.15,.75,p):stage==='mission'?1:stage==='vision'?(1-Math.cos(p*Math.PI*2))*.5:.35;", "const hello=stage==='kv'?.35+.65*smooth(.03,.83,p):stage==='mission'?.82:stage==='vision'?.35+.65*(1-Math.cos(p*Math.PI*2))*.5:.65;")
replace(model,"const wink=stage==='kv'?smooth(.64,.77,p)*(1-smooth(.87,.98,p)):stage==='vision'?smooth(.13,.2,p)*(1-smooth(.25,.31,p)):0;", "const wink=stage==='kv'?smooth(.53,.65,p)*(1-smooth(.80,.94,p)):stage==='vision'?smooth(.58,.67,p)*(1-smooth(.77,.88,p)):0;")
replace(model,"const cyc=((t+1.2)%5.3),blink=globalState.reduced?0:Math.max(0,1-Math.abs(cyc-4.9)/.09);", "const cyc=((t+1.2)%5.3),blink=globalState.reduced||wink>.2?0:Math.max(0,1-Math.abs(cyc-4.9)/.125);")
replace(model,"this.face={smile:.30+hello*.48,blink,wink,mouth:stage==='works'?.10:.04+hello*.12};", "this.face={smile:.66+hello*.26,blink,wink,mouth:.10+hello*.08};")
replace(model,"this.morph('brow',hello*.18);", "this.morph('brow',hello*.12);this.morph('grin',.12);this.morph('happy',wink<.2?hello*.12:0);")
replace(model,"this.rotate('首',-.018,-.06+hello*.07,-.035-hello*.045);this.rotate('頭',-.012+hello*.025,hello*.055,.018);", "this.rotate('首',-.026,-.04+hello*.035,-.025-hello*.045);this.rotate('頭',-.025+hello*.018,hello*.035,.012);")
replace(model," inspect(){return",''' eyePosition(){
  const left=this.bones['左目'],right=this.bones['右目'];
  const a=new THREE.Vector3(),b=new THREE.Vector3();
  if(left&&right){left.getWorldPosition(a);right.getWorldPosition(b);return a.add(b).multiplyScalar(.5);}
  return this.group.localToWorld(new THREE.Vector3(0,1.98,.58));
 }
 eyeContact(yaw:number){const a=THREE.MathUtils.clamp(-yaw*.23,-.14,.14);this.rotate('左目',0,a,0);this.rotate('右目',0,a,0);}
 screenBounds(camera:THREE.Camera,width:number,height:number){
  camera.updateMatrixWorld(true);this.group.updateMatrixWorld(true);
  const skin=this.skins.find(s=>(s.material as THREE.Material).name==='face00');
  if(!skin)return null;skin.skeleton.update();
  const index=skin.geometry.index;const indices=index?Array.from(new Set(Array.from(index.array))):[];
  const v=new THREE.Vector3();let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(let n=0;n<indices.length;n+=2){skin.getVertexPosition(indices[n],v);skin.localToWorld(v);v.project(camera);const x=(v.x*.5+.5)*width,y=(.5-v.y*.5)*height;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  const eye=this.eyePosition().project(camera);
  return {face:{x:x0,y:y0,width:x1-x0,height:y1-y0},eyes:{x:(eye.x*.5+.5)*width,y:(.5-eye.y*.5)*height},scale:this.group.scale.x};
 }
 inspect(){return''')
replace('src/ts/PageManager/index.ts',"if(visit?.history?.popstate||visit?.trigger==='popstate')", "if(visit?.history?.popstate||visit?.trigger==='popstate'||visit?.trigger?.popstate)")
p=Path('src/styles/global.scss');p.write_text(p.read_text()+'''\n/* Portrait variation. Keep the reference grid and all section/route geometry. */
.hero-news{background:radial-gradient(ellipse at 75% 55%,#02100ec4,transparent 76%);text-shadow:0 1px 5px #000;}
.hero-news a:hover{color:#ecfff8;opacity:1;}
@media(max-width:768px){.hero-news{background:linear-gradient(0deg,#030b0ddd,#030b0d88 68%,transparent);border-radius:0;padding-top:20px;text-shadow:0 1px 4px #000}.statement[data-mission] .statement-ja{margin-top:135px}.statement[data-vision] .statement-ja{margin-top:150px}.statement-en{bottom:15vh;}}
''')
for file in ['src/pages/about.astro','src/pages/license.astro','src/data/works.ts']:
 p=Path(file);s=p.read_text();s=s.replace('ガラス状のミク','不透明なミク').replace('ガラスのミク','不透明なミク');p.write_text(s)
print('Portrait director: opaque Tda V4X, face framing, smile, scroll poses; section geometry unchanged.')
