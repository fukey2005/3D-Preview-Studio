import {chromium} from 'playwright';import fs from 'node:fs/promises';import {spawn} from 'node:child_process';
const out='portrait-evidence';await fs.mkdir(out,{recursive:true});const server=spawn('python3',['-m','http.server','4173','--bind','127.0.0.1','--directory','dist'],{stdio:'ignore'});await new Promise(r=>setTimeout(r,800));const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const report={date:new Date().toISOString(),environment:'Playwright Chromium / SwiftShader software WebGL2; actual Astro build',checks:[],errors:[],viewports:[]};const check=(name,passed,details)=>{report.checks.push({name,passed:!!passed,details});console.log((passed?'PASS ':'FAIL ')+name,details??'');};let current;
try{
 for(const [device,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}],['compact-desktop',{width:1280,height:720}]]){
 const c=await browser.newContext({viewport,deviceScaleFactor:1});const p=await c.newPage();current=p;p.on('pageerror',e=>report.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});const external=[];p.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1')&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url())});
 await p.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__MIKU_CAPTURE_READY||window.__MIKU_ERROR,null,{timeout:120000});const error=await p.evaluate(()=>window.__MIKU_ERROR);if(error)throw Error(error);await p.evaluate(()=>{window.__MIKU.freeze(2);document.querySelector('[data-dismiss-sound]')?.click()});await p.waitForTimeout(1000);
 const inspect=()=>p.evaluate(()=>window.__MIKU.inspect());const seek=async(s,t)=>{await p.evaluate(([s,t])=>window.__MIKU.seek(s,t),[s,t]);return inspect();};const initial=await inspect();report.viewports.push({device,viewport,initial});
 check(device+': Tda V4X skinned GLB',initial.model.vertices===25554&&initial.model.triangles===34967&&initial.avatar.skins===18);
 check(device+': all model materials opaque',initial.avatar.materials.every(m=>m.opacity===1&&m.transparent===false));
 check(device+': face fills portrait framing',initial.framing.face.height>=(device==='mobile'?145:185),initial.framing);
 check(device+': face stays within viewport',initial.framing.face.y>90&&initial.framing.face.y+initial.framing.face.height<viewport.height*.7&&initial.framing.face.x>0&&initial.framing.face.x+initial.framing.face.width<viewport.width);
 check(device+': smiling from the first frame',initial.avatar.morphs.smile>=.70&&initial.avatar.morphs.mouth>=.10,initial.avatar.morphs);
 await p.screenshot({path:out+'/'+device+'-hero.png',animations:'disabled'});
 const right=await seek('kv',.28),left=await seek('kv',.58),wink=await seek('kv',.74);
 check(device+': scroll turns face both ways',Math.abs(right.rotation[1]-left.rotation[1])>.65,{right:right.rotation,left:left.rotation});
 check(device+': rotation keeps eye line stable',Math.abs(right.framing.eyes.y-left.framing.eyes.y)<12,{right:right.framing.eyes,left:left.framing.eyes});
 check(device+': genuine wink morph',wink.avatar.morphs.wink>.99,wink.avatar.morphs);
 check(device+': mouth and head animate with scroll',wink.avatar.morphs.mouth>initial.avatar.morphs.mouth+.03&&Math.abs(wink.avatar.head[2]-initial.avatar.head[2])>.005);
 await p.screenshot({path:out+'/'+device+'-wink.png',animations:'disabled'});
 const restored=await seek('kv',0);check(device+': reverse scroll restores exact face',JSON.stringify(restored.avatar.morphs)===JSON.stringify(initial.avatar.morphs)&&Math.abs(restored.framing.face.height-initial.framing.face.height)<.01);
 await p.evaluate(()=>window.__MIKU.freeze(3.7));const blink=await inspect();check(device+': natural blink uses eyelid target',blink.avatar.morphs.blink>.95);await p.evaluate(()=>window.__MIKU.freeze(2));
 const works=await seek('works',.2);check(device+': avatar does not intersect work panels',works.modelVisible===false);
 const mission=await seek('mission',.999),visionStart=await seek('vision',0);check(device+': no portrait teleport at mission/vision boundary',Math.abs(mission.framing.eyes.x-visionStart.framing.eyes.x)<viewport.width*.015&&Math.abs(mission.framing.eyes.y-visionStart.framing.eyes.y)<viewport.height*.015,{mission:mission.framing.eyes,vision:visionStart.framing.eyes});
 if(device==='mobile'){const g=await p.evaluate(()=>({height:document.documentElement.scrollHeight,position:getComputedStyle(document.querySelector('[data-vision]')).position}));check('Mobile original 18061px flow restored',g.height===18061&&g.position==='relative',g);}
 check(device+': no horizontal overflow',await p.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
 check(device+': no external asset requests',external.length===0,external);
 if(device==='desktop'){
  await seek('kv',0);await p.evaluate(()=>window.__MIKU.resume());await p.mouse.wheel(0,650);await p.waitForFunction(()=>window.__MIKU.inspect().scroll>550,null,{timeout:15000});await p.evaluate(()=>window.__MIKU.freeze(2));const wheel=await inspect();check('Real wheel input drives facial performance',wheel.avatar.morphs.smile>initial.avatar.morphs.smile+.08&&Math.abs(wheel.rotation[1]-initial.rotation[1])>.1,{scroll:wheel.scroll,face:wheel.face,rotation:wheel.rotation});
  await p.evaluate(()=>window.__MIKU.resume());await p.mouse.wheel(0,-850);await p.waitForFunction(()=>window.__MIKU.inspect().scroll<1,null,{timeout:15000});await p.evaluate(()=>window.__MIKU.freeze(2));check('Reverse wheel restores first smile',Math.abs((await inspect()).avatar.morphs.smile-initial.avatar.morphs.smile)<.001);
  await p.evaluate(()=>window.__MIKU.setSettings({roughness:.8,hue:310,transmission:.01}));check('Atmosphere controls never make Miku transparent',(await inspect()).avatar.materials.every(m=>!m.transparent&&m.opacity===1));
 }
 await c.close();}
 check('No uncaught rendering or JavaScript errors',report.errors.length===0,report.errors);
}catch(e){report.fatal=String(e);console.error(e);if(current)await current.screenshot({path:out+'/failure.png',timeout:20000}).catch(()=>{});}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();server.kill();}
if(report.fatal||report.checks.some(c=>!c.passed))process.exitCode=1;
