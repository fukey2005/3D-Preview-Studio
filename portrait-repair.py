from pathlib import Path

def edit(file,old,new):
 p=Path(file);s=p.read_text();assert old in s,(file,old[:100]);p.write_text(s.replace(old,new))
# Test found mouth motion but a fixed head-roll bone. Animate the actual bone, not the assertion.
edit('src/ts/GL/Entities/Miku.ts',"this.rotate('頭',-.025+hello*.018,hello*.035,.012);","this.rotate('頭',-.025+hello*.018,hello*.035,.012+hello*.024);")
# Reference live capture: inset mobile panel and near-central desktop stage.
edit('src/ts/GL/Entities/WorksGallery.ts','mobile?.65:.38','mobile?.37:.06')
edit('src/ts/GL/Entities/WorksGallery.ts','setScalar(mobile?.46:1)','setScalar(mobile?.38:.94)')
# Keep real frame-by-frame capture within software-rendering budgets. 6-second portrait demo.
p=Path('tests/capture-portrait-demo.mjs');s=p.read_text();s=s.replace('width:1280,height:800','width:1024,height:640').replace('i<144','i<72').replace('time=2+i/16','time=2+i/12');s=s.replace("if(i<12)progress=0;else if(i<72)progress=.77*(i-12)/59;else if(i<87)progress=.77;else if(i<122)progress=.77*(1-(i-87)/34);else{stage='vision';progress=.2+(i-122)/21*.26;}","if(i<6)progress=0;else if(i<36)progress=.77*(i-6)/29;else if(i<44)progress=.77;else if(i<63)progress=.77*(1-(i-44)/18);else{stage='vision';progress=.2+(i-63)/8*.26;}")
s=s.replace("'-framerate','16'","'-framerate','12'").replace("'fps=32'","'fps=24'")
s=s.replace("trace.push(state);","trace.push(state);if(i%12===0){console.log('Demo frame',i);await fs.writeFile(out+'/capture-progress.json',JSON.stringify({frame:i,trace,errors}));}")
p.write_text(s)
# High-resolution vector source keeps the same intended eye-centered alignment.
print('Actual head-roll fixed; work-panel insets matched; deterministic 72-frame demo configured.')
