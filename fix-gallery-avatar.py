from pathlib import Path
p=Path('src/ts/GL/Scenes/TopPageMainScene.ts');s=p.read_text();needle='  this.miku.group.visible=modelVisible;'
assert needle in s
s=s.replace(needle,"  // The opaque avatar must not intersect the foreground video panels.\n  // Their own rendered character is the subject while the gallery is visible.\n  if(stage.startsWith('works')&&galleryOpacity>.025)modelVisible=false;\n"+needle)
p.write_text(s)
p=Path('tests/verify.mjs');s=p.read_text();needle=" // Real user scrolling, rather than only debug seeking."
assert needle in s
s=s.replace(needle," await p.evaluate(()=>window.__MIKU.seek('works',.08));check('Opaque avatar never overlaps the works video',await p.evaluate(()=>!window.__MIKU.inspect().modelVisible));\n"+needle)
p.write_text(s)
print('Gallery avatar overlap corrected.')
