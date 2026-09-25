from pathlib import Path
p=Path('.')
f=p/'src/components/ui/WorksList.astro';s=f.read_text();s=s.replace('const items=works.slice((pageNumber-1)*16,pageNumber*16);','const items=works;');s=s.replace('{items.map(work=><WorkCard work={work}/>)}','{items.map((work,i)=><WorkCard work={work} hidden={i<(pageNumber-1)*16||i>=pageNumber*16}/>)}');f.write_text(s)
f=p/'src/components/ui/WorkCard.astro';s=f.read_text().replace('const {work:w}=Astro.props;', 'const {work:w,hidden=false}=Astro.props;').replace('class="work-card" data-work-card','class="work-card" hidden={hidden} data-work-card');f.write_text(s)
f=p/'src/ts/PageManager/index.ts';s=f.read_text();s=s.replace("if(selectCategory){document.querySelectorAll<HTMLElement>('[data-work-card]')", "if(selectCategory){const pages=document.querySelector<HTMLElement>('.works-page .pagination');if(pages)pages.hidden=true;document.querySelectorAll<HTMLElement>('[data-work-card]')");f.write_text(s)
f=p/'src/ts/GL/Entities/World.ts';s=f.read_text().replace('Math.sin(x/18)*18,y, -6+(1-Math.cos(x/18))*18','Math.sin(x/12)*12,y, -6+(1-Math.cos(x/12))*12');f.write_text(s)
f=p/'tests/verify.mjs';s=f.read_text();needle="await ctx.close();\n ctx=await browser.newContext({viewport:{width:390,height:844}"
addition='''// Categories must include the seventeenth work, not just the first page's DOM.
 for(const [tag,count] of [['In-Game-Concert',3],['Virtual Live',6],['Metaverse',9],['3DCG',11],['WebGL',6],['Art Direction',5],['World Design',6],['Interactive',5]]){
  await p.evaluate(url=>window.__MIKU.navigate(url),'/works/?category='+encodeURIComponent(tag));await p.waitForFunction(()=>document.body.dataset.page==='works');await p.waitForTimeout(550);
  check('Complete category '+tag,await p.locator('[data-work-card]:visible').count()===count);
 }
 await p.evaluate(()=>window.__MIKU.navigate('/works/'));await p.waitForFunction(()=>location.pathname==='/works/'&&!location.search);await p.waitForTimeout(550);check('Works page one has sixteen entries',await p.locator('[data-work-card]:visible').count()===16);
 await p.evaluate(()=>window.__MIKU.navigate('/works/page/2/'));await p.waitForFunction(()=>location.pathname==='/works/page/2/');await p.waitForTimeout(550);check('Works page two has final entry',await p.locator('[data-work-card]:visible').count()===1);
 await ctx.close();
 ctx=await browser.newContext({viewport:{width:390,height:844}'''
assert needle in s;s=s.replace(needle,addition);f.write_text(s)

f=p/'src/ts/GL/Entities/WorksGallery.ts';s=f.read_text()
s=s.replace('private mediaStarted=false;',"private mediaErrors:string[]=[];private mediaStarted=false;")
s=s.replace("video.preload='none';", "video.preload='metadata';")
s=s.replace("video.setAttribute('playsinline','');video.setAttribute('muted','');video.src=`/motion/${w.id}.mp4`;",'''video.setAttribute('playsinline','');video.setAttribute('muted','');
   // Select an open codec when available; MP4 remains the Safari-compatible alternative.
   const format=video.canPlayType('video/webm; codecs="vp9"')?'webm':'mp4';
   video.src=`/motion/${w.id}.${format}`;
   video.addEventListener('error',()=>{this.mediaErrors[i]=`${video.error?.code}: ${video.error?.message}`;});''')
s=s.replace("v.play().then(()=>this.useVideo(i)).catch(()=>{});", "v.play().then(()=>this.useVideo(i)).catch(error=>{if(error.name!=='AbortError')this.mediaErrors[i]=String(error);});")
s=s.replace('mediaInfo(){return {sources:', 'mediaInfo(){return {requested:this.playing,index:this.lastIndex,hidden:document.hidden,errors:this.mediaErrors,states:this.videos.map(v=>({ready:v.readyState,network:v.networkState,paused:v.paused,time:v.currentTime,src:v.currentSrc,error:v.error?.message??null})),sources:')
f.write_text(s)
f=p/'tests/verify.mjs';s=f.read_text()
s=s.replace("for(const p of ctx.pages()){await p.screenshot", "for(const p of ctx.pages()){report.mediaAtFailure=await Promise.race([p.evaluate(()=>window.__MIKU?.inspect()),new Promise(r=>setTimeout(()=>r('Page unresponsive'),10000))]);await p.screenshot")
s=s.replace("await p.evaluate(()=>{window.__MIKU.seek('works',0.04);window.__MIKU.resume();});", "await p.evaluate(()=>{window.__MIKU.seek('works',0.04);window.__MIKU.resume();});console.log('MEDIA BEFORE',await p.evaluate(()=>window.__MIKU.inspect().media));")
s=s.replace("null,{timeout:30000});\n const first=", "null,{timeout:45000,polling:500});\n const first=")
f.write_text(s)
