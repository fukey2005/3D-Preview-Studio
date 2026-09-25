import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
const out='evidence-v3-preview';await fs.mkdir(out,{recursive:true});await fs.mkdir('.demo-frames',{recursive:true});
const server=spawn('python3',['-m','http.server','4173','--bind','127.0.0.1','--directory','dist'],{stdio:'ignore'});await new Promise(r=>setTimeout(r,700));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});const ctx=await browser.newContext({viewport:{width:1200,height:750},deviceScaleFactor:1});const p=await ctx.newPage();const trace=[];const errors=[];p.on('pageerror',e=>errors.push(String(e)));
try{
 await p.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__MIKU_CAPTURE_READY||window.__MIKU_ERROR,null,{timeout:150000});const error=await p.evaluate(()=>window.__MIKU_ERROR);if(error)throw Error(error);
 await p.evaluate(()=>{window.__MIKU.freeze(2);document.querySelector('[data-dismiss-sound]')?.click()});await p.waitForTimeout(1000);
 for(let frame=0;frame<108;frame++){
  let stage,progress;
  if(frame<64){stage='kv';progress=frame<38?.84*Math.min(frame/30,1):.84*Math.max(0,1-(frame-38)/25);}
  else{stage='vision';progress=.02+(frame-64)/43*.94;}
  const data=await p.evaluate(([stage,progress])=>{window.__MIKU.seek(stage,progress);const s=window.__MIKU.inspect();return {stage,progress,face:s.avatar.morphs,rotation:s.rotation};},[stage,progress]);trace.push(data);
  await p.screenshot({path:'.demo-frames/'+String(frame).padStart(3,'0')+'.jpg',type:'jpeg',quality:92,timeout:60000});
 }
 const ff=spawnSync('ffmpeg',['-y','-v','error','-framerate','12','-i','.demo-frames/%03d.jpg','-vf','fps=24','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',out+'/scroll-expression-demo.mp4'],{encoding:'utf8'});if(ff.status!==0)throw Error(ff.stderr);
 if(errors.length)throw Error(errors.join('\n'));
 await fs.writeFile(out+'/demo-trace.json',JSON.stringify({method:'Actual built-page screenshots, deterministic scroll positions, not a GPU frame-rate measurement',frames:trace,errors},null,2));
}finally{await browser.close();server.kill();}
