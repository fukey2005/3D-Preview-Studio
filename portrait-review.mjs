import {chromium} from 'playwright';import fs from 'node:fs/promises';import {spawn} from 'node:child_process';
const out='portrait-review';await fs.mkdir(out,{recursive:true});const server=spawn('python3',['-m','http.server','4173','--bind','127.0.0.1','--directory','dist'],{stdio:'ignore'});await new Promise(r=>setTimeout(r,800));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});const report={date:new Date().toISOString(),browser:browser.version(),errors:[],poses:[],reference:{},checks:[]};
const poses=[['kv',0,'hero'],['kv',.28,'three-quarter'],['kv',.58,'turn'],['kv',.74,'wink'],['kv',.97,'smile'],['works_intro',.35,'handoff'],['works',.08,'works'],['mission_in',.45,'transition'],['mission',.3,'about'],['vision',.3,'vision'],['service',.2,'service'],['stellla',.3,'platform'],['footer',.6,'footer']];
let current;
try {
 for(const [device,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
  const ctx=await browser.newContext({viewport,deviceScaleFactor:1});const p=await ctx.newPage();current=p;p.on('pageerror',e=>report.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
  await p.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__MIKU_CAPTURE_READY||window.__MIKU_ERROR,null,{timeout:150000});const error=await p.evaluate(()=>window.__MIKU_ERROR);if(error)throw Error(error);
  await p.evaluate(()=>{window.__MIKU.freeze(2);document.querySelector('[data-dismiss-sound]')?.click()});await p.waitForTimeout(1200);
  const bounds=await p.evaluate(()=>window.__MIKU.bounds());report[device]={bounds,height:await p.evaluate(()=>document.documentElement.scrollHeight)};
  for(const [stage,progress,label] of poses){await p.evaluate(([stage,progress])=>window.__MIKU.seek(stage,progress),[stage,progress]);await p.waitForTimeout(100);const info=await p.evaluate(()=>window.__MIKU.inspect());report.poses.push({device,stage,progress,face:info.face,framing:info.framing,rotation:info.rotation,modelVisible:info.modelVisible});await p.screenshot({path:out+'/'+device+'-'+label+'.png',timeout:60000});console.log('Captured',device,label,JSON.stringify(info.framing));}
  await ctx.close();
 }
 if(process.env.REFERENCE!=='0')for(const [device,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
  const ctx=await browser.newContext({viewport,deviceScaleFactor:1});const p=await ctx.newPage();current=p;const ref={errors:[],ready:false};report.reference[device]=ref;p.on('pageerror',e=>ref.errors.push(String(e)));
  try{
   await p.goto('https://alche.studio/',{waitUntil:'domcontentloaded',timeout:90000});await p.waitForFunction(()=>{const e=document.getElementById('loading-overlay');return !e||getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<.01},null,{timeout:120000});await p.waitForTimeout(5000);
   const decline=p.locator('[data-sound-intro-decline]');if(await decline.count())await decline.click({force:true}).catch(()=>{});await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(5000);await p.evaluate(()=>document.fonts.ready);
   ref.ready=true;ref.height=await p.evaluate(()=>document.documentElement.scrollHeight);ref.elements=await p.evaluate(()=>[...document.querySelectorAll('#swup div,header,[data-tp]')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {class:e.className,top:r.top+scrollY,x:r.x,w:r.width,h:r.height,position:s.position,font:s.font,display:s.display,attrs:[...e.attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value])}}).filter(e=>e.h>20));
   await fs.writeFile(out+'/reference-'+device+'.html',await p.content());
   for(const [stage,progress,label] of poses.filter(x=>['hero','works','transition','about','vision','service','platform','footer'].includes(x[2]))){const b=report[device].bounds[stage];const target=b.start+b.height*progress;await p.evaluate(y=>scrollTo(0,y),target);await p.waitForTimeout(2200);await p.screenshot({path:out+'/reference-'+device+'-'+label+'.png',timeout:60000});console.log('Reference',device,label,await p.evaluate(()=>scrollY));}
  }catch(e){ref.failure=String(e);console.error('REFERENCE',device,String(e));await p.screenshot({path:out+'/reference-'+device+'-error.png',timeout:20000}).catch(()=>{});}finally{await ctx.close();}
 }
}catch(e){report.fatal=String(e);console.error(e);if(current)await current.screenshot({path:out+'/failure.png',timeout:20000}).catch(()=>{});process.exitCode=1;}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();server.kill();}
if(report.errors.length)process.exitCode=1;
