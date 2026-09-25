from pathlib import Path
p=Path('.')
f=p/'src/ts/GL/Entities/Miku.ts';s=f.read_text();s=s.replace('-1.00+hello*.22','-.30+hello*.09').replace('.94-hello*.14','.32-hello*.08').replace('vec3(.93,.97,.98),.13','vec3(.93,.97,.98),.025');f.write_text(s)
f=p/'src/ts/GL/Scenes/TopPageMainScene.ts';s=f.read_text();s=s.replace("}else if(stage==='service_in'){","}else if(stage==='service_in'){\n   modelVisible=false;this.world.uniforms.uAccent.value=.015;").replace("}else if(stage==='service'){","}else if(stage==='service'){\n   this.world.uniforms.uAccent.value=.015;").replace("['kv','works_intro','works','works_outro','service']","['kv','works_intro','works','works_outro']");f.write_text(s)
f=p/'src/data/works.ts';s=f.read_text();replacements={
'透明な存在に、無限の表情を。':'透明な空間に、鮮やかな存在を。',
'かたちを変えずに、存在の見え方を変える。初音ミクの3Dモデルに屈折と反射のマテリアルを与え、周囲の色やタイポグラフィを取り込むガラスの彫刻として構成したビジュアルスタディです。':'クリアな光のアーチと、表情が読める不透明な初音ミク。背景の透明感とキャラクターの存在感を分けて構成したビジュアルスタディです。顔のモーフと骨格により、同じ空間でも向きと表情が変化します。',
'An exploration of identity through refraction. A transparent character takes on the colours of an environment without losing her unmistakable silhouette.':'An opaque, expressive character in a luminous architectural setting. Clear lighting, facial morphs and skeletal poses preserve a readable identity within a fluid environment.',
'立体、線、そして光。ひとつのモデルを異なる描画で見つめ直すインタラクティブな実験です。輪郭だけになっても残るキャラクターの個性を、リアルタイムのレンダリングで表現しました。':'立体、表情、そして光。初音ミクの顔と衣装を明瞭に保ちながら、光の線が奥行きをつくる空間を制作しました。モーフと骨格の動きで、静止したポスターにはない表情の変化を表現します。',
'A real-time study in lines, light and identity. A recognisable character persists as the image is reduced to a luminous signal.':'A real-time study in expression, light and identity. Luminous geometry frames a clearly visible character animated by facial morphs and a live skeleton.',
'3Dと2Dをつなぐ、ガラスのマテリアルスタディ':'空間の透明感と、読み取りやすいキャラクター',
'透明・カラー・ワイヤーフレームを切り替えながら、ひとつの形の見え方を比較できます。トップページ左下のコントローラーから体験してください。':'ミク本体は不透明に保ち、背景の光と拡散を調整します。表情と向きはスクロールに連動します。左下のパネルは背景側の演出を操作します。',
'あにまさ氏の初音ミクモデルを使用しています。PMDの頂点・材質・骨格情報を読み取り、ポーズを適用してThree.jsで描画します。':'Tda式初音ミクV4Xを使用しています。ブラウザ向けに編集したGLBで骨格と表情モーフを保持し、不透明なトゥーン材質で描画します。',
'環境光と指向性のある光を組み合わせ、透明な輪郭にも立体の厚みが見えるよう調整しました。':'光のにじみと屈折感は背景側で表現し、顔・髪・衣装には透過を適用しません。背景と主役を分離して読み取りやすくしています。',
'大きなMIKUの文字も3Dシーン内のテクスチャです。ガラスのモデルを通して、文字の一部が歪んで見えます。':'大きなMIKUの文字も3Dシーン内のテクスチャです。曲面に沿った文字とカメラの動きが、画面全体の奥行きをつくります。',
'ワイヤーフレームで見る、造形の構造':'顔のモーフで作る、笑顔とウィンク',
'輪郭と面のつながりから、3Dモデルの形状を見つめるモードを実装しています。':'目・口・眉のモーフを組み合わせ、スクロールによって自然な笑顔からウィンクへ移ります。戻すと元の表情へ戻る可逆な演出です。',
'光と背景を取り込む透明なモデルを、明るい空間の中に置いた実験です。':'光のアーチと明るい空間に、不透明で表情が見えるミクを配置した実験です。',
'メッシュの構造そのものを、発光する線として表現した作品です。':'奥行きを強調する光の線と、不透明なキャラクターの表情を組み合わせた作品です。',
'端末の画素密度に上限を設定し、ガラス内部の描画解像度を分けています。':'端末の画素密度に上限を設定し、映像は現在表示中の1本のみを再生します。ミクの表情を保ちながら描画負荷を抑えます。'
}
for a,b in replacements.items():s=s.replace(a,b)
f.write_text(s)
f=p/'tests/verify.mjs';s=f.read_text().replace('===12354','===25554').replace('===22961','===34967').replace('Actual Animasa PMD loaded','Actual edited Tda GLB loaded');needle=' const stages=await p.locator'
addition=""" check('Every character material is opaque',info.avatar.materials.every(m=>m.opacity===1&&!m.transparent),info.avatar.materials);
 check('Live skeletal model and facial targets',info.avatar.skins===18&&info.model.activeTargets.includes('wink'));
 await p.evaluate(()=>window.__MIKU.seek('kv',.8));const wink=await p.evaluate(()=>window.__MIKU.inspect());await screenshot(p,'12-desktop-wink');
 check('Scroll drives real wink morph',wink.avatar.morphs.wink>.99,wink.avatar.morphs);
 check('Scroll changes smiling mouth',wink.avatar.morphs.smile>info.avatar.morphs.smile+.3&&wink.avatar.morphs.mouth>info.avatar.morphs.mouth);
 await p.evaluate(()=>window.__MIKU.seek('vision',.65));const turned=await p.evaluate(()=>window.__MIKU.inspect());
 check('Scroll changes character orientation',Math.abs(turned.rotation[1]-info.rotation[1])>2.0);
 await p.evaluate(()=>window.__MIKU.seek('kv',0));const reversed=await p.evaluate(()=>window.__MIKU.inspect());
 check('Facial morphs reverse exactly',JSON.stringify(reversed.avatar.morphs)===JSON.stringify(info.avatar.morphs));
 check('Reference service has exactly two content panels',await p.locator('[data-service-label]').count()===2);
 check('Reference featured works has six panels',await p.locator('[data-work-label]').count()===6);
 check('Reference hero news has three entries',await p.locator('.hero-news a').count()===3);
 const stages=await p.locator"""
assert needle in s;s=s.replace(needle,addition,1)
needle=" await p.evaluate(()=>window.__MIKU.navigate('/works/'));await p.waitForFunction(()=>location.pathname==='/works/'&&!location.search);"
addition=""" for(const tag of ['WebGL','Art Direction','Virtual Live']){
  const route='/works/'+encodeURIComponent(tag)+'/';await p.evaluate(url=>window.__MIKU.navigate(url),route);await p.waitForTimeout(300);
  check('Canonical category route '+tag,await p.locator('[data-selected-category]').getAttribute('data-selected-category')===tag&&await p.locator('[data-work-card]:visible').count()>0);
 }
 await p.evaluate(()=>window.__MIKU.navigate('/news/?openNews=material'));await p.waitForTimeout(350);check('News query deep link opens target',await p.locator('#material').getAttribute('open')!==null);
 await p.evaluate(()=>window.__MIKU.navigate('/privacypolicy/'));check('Original privacy route alias',Boolean(await p.locator('h1').first().textContent()));
 await p.evaluate(()=>window.__MIKU.navigate('/works/'));await p.waitForFunction(()=>location.pathname==='/works/'&&!location.search);"""
assert needle in s;s=s.replace(needle,addition,1);f.write_text(s)
f=p/'tests/v3-preview.mjs';s=f.read_text();s+='\nif(result.errors.length)process.exitCode=1;\n';f.write_text(s)
print('Corrected arms, clear subject materials, service atmosphere, content, and acceptance tests.')
