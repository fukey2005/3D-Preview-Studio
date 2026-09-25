from pathlib import Path
p=Path('.')
f=p/'src/ts/main.ts';s=f.read_text()
s=s.replace("navigate:(url:string)=>manager.swup.navigate(url),",'''navigate:(url:string)=>new Promise<void>((resolve,reject)=>{
    const target=new URL(url,location.href);let off=()=>{};
    const timeout=setTimeout(()=>{off();reject(new Error('Navigation timed out: '+url));},30000);
    off=manager.swup.hooks.on('visit:end',(visit:any)=>{if(visit.to.url!==target.pathname+target.search)return;off();clearTimeout(timeout);requestAnimationFrame(()=>resolve());});
    manager.swup.navigate(url);
   }),''')
f.write_text(s)
f=p/'src/ts/GL/Entities/WorksGallery.ts';s=f.read_text()
s=s.replace('private mediaErrors:string[]=[];', 'private decodedFrames:number[]=[];private mediaErrors:string[]=[];')
s=s.replace('this.videos[i]=video;this.motion[i]=texture;', '''this.videos[i]=video;this.motion[i]=texture;this.decodedFrames[i]=0;
   if('requestVideoFrameCallback' in video){const countFrame=()=>{if(this.disposed)return;this.decodedFrames[i]++;video.requestVideoFrameCallback(countFrame);};video.requestVideoFrameCallback(countFrame);}''')
s=s.replace('mediaInfo(){return {requested:', 'mediaInfo(){return {frames:this.decodedFrames[this.lastIndex]??0,requested:')
f.write_text(s)
f=p/'tests/verify.mjs';s=f.read_text()
s=s.replace("window.__MIKU.inspect().media.decoded>0&&window.__MIKU.inspect().media.time>.1", "window.__MIKU.inspect().media.playing===1&&window.__MIKU.inspect().media.frames>0&&window.__MIKU.inspect().media.time>.1")
s=s.replace("const first=await p.evaluate(()=>window.__MIKU.inspect().media);await p.waitForTimeout(2200);const second=", "const first=await p.evaluate(()=>window.__MIKU.inspect().media);await p.waitForFunction(frames=>window.__MIKU.inspect().media.frames>frames+1,first.frames,{timeout:30000,polling:300});const second=")
s=s.replace("second.playing===1&&second.time!==first.time", "second.playing===1&&second.frames>first.frames&&second.time!==first.time")
s=s.replace("check('Complete category '+tag,await p.locator('[data-work-card]:visible').count()===count);", "const actual=await p.locator('[data-work-card]:visible').count();check('Complete category '+tag,actual===count,{expected:count,actual});")
needle=" for(const id of ids){const route="
addition=''' for(let index=0;index<6;index++){
  await p.evaluate(i=>{window.__MIKU.seek('works',(i+.2)/6);window.__MIKU.resume();},index);
  await p.waitForFunction(i=>{const m=window.__MIKU.inspect().media;return m.index===i&&m.playing===1&&m.frames>0&&m.time>.1;},index,{timeout:30000,polling:300});
  const video=await p.evaluate(()=>window.__MIKU.inspect().media);check('Gallery movie '+index+' decodes in active scene',video.errors.length===0&&video.frames>0,video);
  await p.evaluate(()=>window.__MIKU.freeze(2));
 }
 for(const id of ids){const route='''
assert needle in s;s=s.replace(needle,addition);f.write_text(s)
f=p/'tests/render-motion.mjs';s=f.read_text();needle="  console.log('DONE',id,(await fs.stat(`public/motion/${id}.mp4`)).size);"
s=s.replace(needle,"  const webm=spawnSync('ffmpeg',['-y','-loglevel','error','-i',`public/motion/${id}.mp4`,'-c:v','libvpx-vp9','-b:v','0','-crf','28','-deadline','good','-cpu-used','4','-an',`public/motion/${id}.webm`],{encoding:'utf8'});if(webm.status!==0)throw Error(webm.stderr);\n"+needle);f.write_text(s)
