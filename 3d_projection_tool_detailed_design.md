# 3D Preview Studio 詳細設計書

## 1. ドキュメント概要

本書は、Windows / macOS 両対応の3Dデータ変換・プレビュー・投影図生成ソフト **3D Preview Studio** の詳細設計書です。

現状の実装は、OBJ / MTL / テクスチャ、GLB / GLTF、STL、PLY、DAE、FBX、3MF、USDZ、STEP / STP、BLENDを読み込み、テクスチャ付き表示、ワイヤーフレーム表示、設計図風表示、グリッドフロア付きプレビュー、PNG画像書き出し、WebM / MP4回転動画書き出しを行うデスクトップアプリケーションです。

単なる3Dビューアではなく、3Dモデルを「資料用画像」「技術記事用画像」「README用画像」「SNS用動画」「3Dモデル配布用サムネイル」に変換することを主目的とします。

---

## 2. プロダクト概要

### 2.1 仮称

候補名は以下です。

- MeshBlueprint
- ModelPrint
- WireShot
- Blueprint3D
- ModelSheet Studio
- 3D Projection Studio

本設計書では仮称として **MeshBlueprint** を使用します。

### 2.2 コンセプト

```text
3Dファイルを投げるだけで、
ワイヤーフレーム・テクスチャ表示・設計図風画像・回転動画を自動生成する
Windows / macOS対応デスクトップツール
```

### 2.3 想定ユーザー

- 3Dモデルを扱う個人開発者
- 技術記事やnoteを書く人
- GitHub READMEに3Dモデルの図を載せたい人
- 3Dプリント用データを確認したい人
- ゲーム素材・CG素材を整理したい人
- SNS用に3Dモデルの回転動画を作りたい人
- Blenderを開くほどではないが、3Dデータを確認・書き出ししたい人

### 2.4 主要価値

既存の3Dビューアとの違いは、**見ること**ではなく、**見栄えのよい素材として書き出すこと**にあります。

主な価値は以下です。

- 3Dモデルを素早く確認できる
- テクスチャの有無を切り替えられる
- ワイヤーフレーム・設計図風画像を生成できる
- 背景色、グリッド色、ワイヤーフレーム色を調整できる
- OBJとMTL、テクスチャファイルを後から追加しても自動解決できる
- 上面・正面・側面・斜めビューの投影図を生成できる
- 回転動画をWebM / MP4で書き出せる

---

## 3. 対応プラットフォーム

### 3.1 対象OS

| OS | 対応方針 |
|---|---|
| Windows 10 / 11 | 対応 |
| macOS 13以降 | 対応 |
| Linux | 将来的に検討 |

### 3.2 推奨技術構成

MVPでは以下の構成を採用します。

```text
Electron
React
TypeScript
Three.js
Vite
Node.js
ffmpeg optional
```

### 3.3 Electronを採用する理由

- Windows / macOS の両方に配布しやすい
- Three.jsとの相性が良い
- File API / Canvas / WebGL / WebGPU 周辺を扱いやすい
- ドラッグ&ドロップによる複数ファイル読み込みが作りやすい
- デスクトップアプリとしてファイル保存やffmpeg連携がしやすい

### 3.4 Tauriを後回しにする理由

Tauriは軽量ですが、WebView差分や3D描画まわりで環境差が出る可能性があります。最初はChromium環境を固定できるElectronの方が開発速度と安定性を優先できます。

---

## 4. スコープ

### 4.1 現状で実装済みの機能

- 3Dファイル読み込み
- 複数ファイル追加
- OBJ + MTL + 画像テクスチャの自動解決
- GLB / GLTF / STL読み込み
- GLTF外部 `.bin` / 画像参照の解決
- テクスチャON/OFF
- ワイヤーフレームON/OFF
- グリッドフロアON/OFF
- 背景色変更
- グリッドフロア色変更
- ワイヤーフレーム色変更
- 上面 / 正面 / 側面 / 斜めビュー
- PNG書き出し
- 透明PNG書き出し
- WebM回転動画書き出し
- MP4回転動画書き出し
- Export画面での画像・動画プレビュー
- 画像 / 動画の縦横比プリセット
- FPS / 回転数 / ビットレート設定
- カラープリセットの追加・削除

### 4.2 v1.5以降で実装する機能

- 4面投影図レイアウト
- SVG書き出し
- PDF書き出し
- PNG連番書き出し
- GIF書き出し
- 透過WebM
- シルエット抽出
- 隠線処理
- プロジェクトプリセット管理
- Blender fallback
- Assimp fallback

### 4.3 明示的に後回しにする機能

- 完全なCAD図面生成
- アニメーション再生
- ボーン / リグ / スキニング編集
- 物理ベースレンダリングの完全再現
- 3Dモデル編集機能
- UV編集機能
- テクスチャ編集機能

---

## 5. 対応3D形式

### 5.1 現状で対応している3D形式

| 形式 | 読み込み | テクスチャ | 備考 |
|---|---:|---:|---|
| `.obj` | 対応 | MTL経由 | 最優先 |
| `.stl` | 対応 | 原則なし | 3Dプリント系 |
| `.glb` | 対応 | 内包可能 | 扱いやすい |
| `.gltf` | 対応 | 外部画像対応 | `.bin` と画像解決が必要 |
| `.ply` | 対応 | 原則なし | PLYLoader |
| `.dae` | 対応 | 外部画像対応 | ColladaLoader |
| `.fbx` | 対応 | 外部画像対応 | FBXLoader |
| `.3mf` | 対応 | 内包可能 | 3MFLoader |
| `.usdz` | 対応 | 内包可能 | USDLoader |
| `.step` / `.stp` | 対応 | 原則なし | occt-import-jsでメッシュ化 |
| `.blend` | 対応 | 原則なし | jsblenderでメッシュ抽出 |

### 5.2 現状で対応している補助アセット

| 形式 | 用途 | 備考 |
|---|---|---|
| `.mtl` | OBJマテリアル | `mtllib` 参照から自動解決 |
| `.bin` | GLTFバイナリ | `.gltf` の外部buffer参照として自動解決 |
| `.png` / `.jpg` / `.jpeg` / `.webp` / `.bmp` / `.gif` / `.tga` / `.tx` | テクスチャ | OBJ/MTL、GLTF、DAE、FBXなどの外部画像参照として解決。FBXの `.tx` 参照は同名PNG等へフォールバック |

### 5.3 後続対応形式

| 形式 | 方針 |
|---|---|
| `.abc` | Blender fallbackで対応検討 |
| `.usd` | Three.jsまたはBlender fallbackで対応検討 |

---

## 6. 全体アーキテクチャ

### 6.1 レイヤー構成

```text
┌────────────────────────────────────┐
│ UI Layer                            │
│ React Components                    │
├────────────────────────────────────┤
│ App State Layer                     │
│ Zustand / Redux / Jotai             │
├────────────────────────────────────┤
│ Project Layer                       │
│ ModelProject / AssetRegistry        │
├────────────────────────────────────┤
│ Import Layer                        │
│ Three.js Loaders / Custom Parsers   │
├────────────────────────────────────┤
│ Asset Resolve Layer                 │
│ MaterialResolver / TextureResolver  │
├────────────────────────────────────┤
│ Render Layer                        │
│ Three.js Scene / Camera / Renderer  │
├────────────────────────────────────┤
│ Export Layer                        │
│ PNG / SVG / PDF / Video             │
├────────────────────────────────────┤
│ Native Layer                        │
│ Electron Main / FileSystem / ffmpeg │
└────────────────────────────────────┘
```

### 6.2 処理フロー

```text
ファイル追加
↓
拡張子判定
↓
AssetRegistryへ登録
↓
Model / Material / Texture に分類
↓
AssetResolverで参照解決
↓
Three.js Sceneを構築または更新
↓
プレビュー更新
↓
現在の表示設定を反映
↓
静止画または動画として書き出し
```

---

## 7. ディレクトリ構成

```text
mesh-blueprint/
  package.json
  vite.config.ts
  electron-builder.yml
  tsconfig.json

  src/
    main/
      index.ts
      ipc.ts
      fileSystem.ts
      ffmpeg.ts
      appMenu.ts

    preload/
      index.ts
      bridge.ts

    renderer/
      main.tsx
      App.tsx
      styles/
        globals.css

      components/
        layout/
          AppShell.tsx
          Toolbar.tsx
          Sidebar.tsx
          Inspector.tsx
          StatusBar.tsx

        assets/
          AssetPanel.tsx
          AssetList.tsx
          MissingAssetsPanel.tsx
          MaterialBindingPanel.tsx

        viewer/
          ViewerCanvas.tsx
          ViewportOverlay.tsx
          CameraControls.tsx
          ProjectionPreview.tsx

        settings/
          AppearanceSettings.tsx
          RenderModeSettings.tsx
          TextureSettings.tsx
          GridSettings.tsx
          WireframeSettings.tsx
          ExportSettings.tsx
          VideoExportSettings.tsx

      store/
        projectStore.ts
        viewerStore.ts
        settingsStore.ts
        exportStore.ts

    core/
      types/
        AssetFile.ts
        ModelProject.ts
        MissingAsset.ts
        MaterialBinding.ts
        ViewerSettings.ts
        ExportSettings.ts
        SupportedFormat.ts

      importers/
        loadModel.ts
        loadOBJ.ts
        loadMTL.ts
        loadGLTF.ts
        loadSTL.ts

      assets/
        AssetRegistry.ts
        AssetClassifier.ts
        AssetResolver.ts
        MaterialResolver.ts
        TextureResolver.ts
        PathMatcher.ts

      scene/
        SceneBuilder.ts
        MaterialFactory.ts
        TextureFactory.ts
        BoundingBox.ts
        NormalizeModel.ts

      render/
        ViewerRenderer.ts
        ProjectionRenderer.ts
        WireframeRenderer.ts
        BlueprintRenderer.ts
        GridFloor.ts
        CameraFactory.ts
        EdgeExtractor.ts
        SilhouetteExtractor.ts

      export/
        exportPNG.ts
        exportSVG.ts
        exportPDF.ts
        exportWebM.ts
        exportMP4.ts
        exportGIF.ts
        exportPNGSequence.ts
        TurntableExporter.ts

      utils/
        color.ts
        file.ts
        math.ts
        disposeThreeObject.ts
```

---

## 8. データモデル設計

### 8.1 ModelProject

プロジェクトは、読み込まれた3Dモデルと関連アセットをまとめる単位です。

```ts
type ModelProject = {
  id: string
  name: string
  createdAt: number
  updatedAt: number

  assets: AssetFile[]
  modelAssets: AssetFile[]
  materialAssets: AssetFile[]
  textureAssets: AssetFile[]

  scene: THREE.Scene | null
  rootObject: THREE.Object3D | null

  missingAssets: MissingAsset[]
  materialBindings: MaterialBinding[]

  viewerSettings: ViewerSettings
  exportSettings: ExportSettings
}
```

### 8.2 AssetFile

```ts
type AssetKind =
  | "model"
  | "material"
  | "texture"
  | "archive"
  | "unknown"

type AssetFile = {
  id: string
  name: string
  extension: string
  kind: AssetKind

  absolutePath?: string
  relativePath?: string
  originalFile?: File
  buffer?: ArrayBuffer
  objectUrl?: string

  size: number
  addedAt: number
}
```

### 8.3 MissingAsset

```ts
type MissingAsset = {
  id: string
  type: "material" | "texture" | "binary" | "unknown"

  requestedByAssetId: string
  expectedPath: string
  expectedFileName: string

  materialName?: string
  mapType?: "map_Kd" | "map_Ks" | "map_Bump" | "normalMap" | "roughnessMap"

  status: "missing" | "resolved" | "ignored"
  resolvedAssetId?: string
}
```

### 8.4 MaterialBinding

```ts
type MaterialBinding = {
  id: string
  materialName: string
  meshUuid: string

  materialColor?: string
  textureAssetId?: string
  textureFileName?: string

  status: "resolved" | "missing_texture" | "material_only" | "fallback"
}
```

### 8.5 ViewerSettings

```ts
type RenderMode =
  | "textured"
  | "solid"
  | "wireframe"
  | "blueprint"
  | "silhouette"

type ViewerSettings = {
  renderMode: RenderMode

  textureEnabled: boolean
  wireframeOverlayEnabled: boolean
  materialColorEnabled: boolean

  background: {
    color: string
    transparent: boolean
  }

  grid: {
    enabled: boolean
    size: number
    divisions: number
    color: string
    centerColor: string
    opacity: number
  }

  wireframe: {
    color: string
    opacity: number
    thickness: number
  }

  camera: {
    view: "top" | "front" | "side" | "isometric" | "custom"
    autoFit: boolean
    zoom: number
  }
}
```

### 8.6 ExportSettings

```ts
type ExportSettings = {
  image: {
    format: "png" | "svg" | "pdf"
    width: number
    height: number
    scale: number
    transparent: boolean
    includeGrid: boolean
    includeBackground: boolean
  }

  video: {
    format: "webm" | "mp4"
    width: number
    height: number
    fps: number
    duration: number
    motion: "turntable_360" | "turntable_180" | "pingpong" | "top_orbit"
    transparent: boolean
    loop: boolean
  }
}
```

---

## 9. ファイル読み込み設計

### 9.1 対応ローダー

```ts
const loaderMap = {
  obj: OBJLoader,
  mtl: MTLLoader,
  stl: STLLoader,
  glb: GLTFLoader,
  gltf: GLTFLoader,
  ply: PLYLoader,
  dae: ColladaLoader,
  fbx: FBXLoader,
  '3mf': ThreeMFLoader,
  usdz: USDLoader,
  step: occtImportJs,
  stp: occtImportJs,
  blend: jsblender,
}
```

### 9.2 ファイル追加時の処理

```text
1. ファイルを受け取る
2. 拡張子を取得
3. AssetKindに分類
4. AssetRegistryへ登録
5. 既存のMissingAssetと照合
6. モデル再構築が必要ならSceneを更新
7. プレビュー再描画
```

### 9.3 ドラッグ&ドロップ仕様

ユーザーは以下のような追加ができます。

```text
パターンA：OBJだけ追加
→ ワイヤーフレーム表示
→ MTL不足を表示

パターンB：OBJ + MTLを同時追加
→ マテリアル色まで反映
→ テクスチャ不足を表示

パターンC：OBJ + MTL + PNG/JPGを同時追加
→ テクスチャ付き表示

パターンD：OBJ追加後、あとからMTL追加
→ 自動で再解決

パターンE：OBJ + MTL追加後、あとから画像追加
→ 自動でテクスチャ適用

パターンF：モデルフォルダをドラッグ&ドロップ
→ フォルダ内の対応アセットを再帰的に追加
```

---

## 10. Asset Resolver設計

### 10.1 目的

Asset Resolverは、モデルファイルが参照しているマテリアルファイルやテクスチャファイルを、後から追加されたファイルを含めて自動的に紐付けるモジュールです。

### 10.2 解決対象

- OBJ内の `mtllib`
- OBJ内の `usemtl`
- MTL内の `map_Kd`
- MTL内の `map_Bump`
- MTL内の `map_Ks`
- GLTF内の `.bin` 参照
- GLTF内の画像参照
- FBX内の外部画像参照

### 10.3 解決ロジック

優先順位は以下です。

```text
1. 完全な相対パス一致
2. ファイル名完全一致
3. 大文字小文字を無視した一致
4. 拡張子違いを許容したベース名一致
5. 類似ファイル名候補
6. 手動バインド
```

### 10.4 擬似コード

```ts
async function resolveAssets(project: ModelProject): Promise<ModelProject> {
  const materialRefs = extractMaterialReferences(project)
  const textureRefs = extractTextureReferences(project)

  for (const ref of materialRefs) {
    const matched = findMatchingAsset(project.assets, ref.expectedPath)

    if (matched) {
      bindMaterial(project, ref, matched)
    } else {
      addMissingAsset(project, ref)
    }
  }

  for (const ref of textureRefs) {
    const matched = findMatchingAsset(project.assets, ref.expectedPath)

    if (matched) {
      bindTexture(project, ref, matched)
    } else {
      addMissingAsset(project, ref)
    }
  }

  return project
}
```

---

## 11. テクスチャON/OFF設計

### 11.1 要件

ユーザーはテクスチャ表示をON/OFFできます。

- ONの場合、読み込まれたテクスチャ画像を反映する
- OFFの場合、テクスチャ画像を使わずに表示する
- OFFにしても紐付けは削除しない
- 再度ONにした場合、即座にテクスチャ表示へ戻る
- PNG / 動画書き出しにも現在の状態を反映する

### 11.2 表示パターン

| 状態 | 表示 |
|---|---|
| Texture ON | 画像テクスチャを反映 |
| Texture OFF + Material Color | マテリアル色のみ表示 |
| Texture OFF + Flat Color | 全体を単色表示 |
| Wireframe | 辺のみ表示 |
| Wireframe Overlay | 通常表示の上に線を重ねる |

### 11.3 マテリアル管理

```ts
type MeshMaterialState = {
  meshUuid: string
  originalMaterial: THREE.Material | THREE.Material[]
  texturedMaterial: THREE.Material | THREE.Material[]
  materialColorMaterial: THREE.Material | THREE.Material[]
  flatMaterial: THREE.Material | THREE.Material[]
  wireframeMaterial: THREE.Material
}
```

### 11.4 切り替え処理

```ts
function applyTextureState(scene: THREE.Scene, textureEnabled: boolean) {
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return

    const state = materialStore.get(object.uuid)
    if (!state) return

    object.material = textureEnabled
      ? state.texturedMaterial
      : state.materialColorMaterial ?? state.flatMaterial
  })
}
```

---

## 12. 表示モード設計

### 12.1 Render Mode一覧

| モード | 内容 |
|---|---|
| Textured | テクスチャ付き通常表示 |
| Solid | 単色またはマテリアル色で表示 |
| Wireframe | ワイヤーフレームのみ表示 |
| Blueprint | 設計図風表示 |
| Silhouette | 外形線を強調表示 |

### 12.2 Textured Mode

- テクスチャONなら画像テクスチャを使用
- テクスチャOFFならマテリアル色または単色表示
- ライトあり
- グリッド表示可能

### 12.3 Wireframe Mode

- メッシュの辺だけ表示
- 背景色変更可能
- グリッド表示可能
- ワイヤー色変更可能
- 透明背景書き出し可能

### 12.4 Blueprint Mode

- 外形線を太くする
- 内部線は細くする
- 背景は白または濃紺プリセット
- グリッドは任意
- SVG / PDF 書き出しに向く

### 12.5 Solid Mode

- テクスチャを無効化
- モデル全体を単色またはマテリアルカラーで表示
- 形状確認向け

---

## 13. グリッドフロア設計

### 13.1 要件

- グリッドフロアの表示/非表示を切り替えられる
- グリッド色を変更できる
- 中心線の色を変更できる
- グリッド透明度を変更できる
- グリッドサイズを変更できる
- グリッド分割数を変更できる
- 書き出し時にも反映される

### 13.2 Three.js実装

```ts
function createGridFloor(settings: ViewerSettings["grid"]): THREE.GridHelper {
  const grid = new THREE.GridHelper(
    settings.size,
    settings.divisions,
    new THREE.Color(settings.centerColor),
    new THREE.Color(settings.color)
  )

  grid.material.transparent = true
  grid.material.opacity = settings.opacity
  grid.visible = settings.enabled

  return grid
}
```

### 13.3 更新方針

`GridHelper` は色や分割数の動的変更がやや扱いづらいため、設定変更時に作り直します。

```text
Grid Settings変更
↓
既存GridHelperをsceneから削除
↓
dispose
↓
新しいGridHelperを生成
↓
sceneへ追加
```

---

## 14. 背景色設計

### 14.1 要件

- 背景色を変更できる
- 背景を透明にできる
- 透明背景はPNG / WebM / PNG連番で反映する

### 14.2 実装

```ts
function applyBackground(renderer: THREE.WebGLRenderer, scene: THREE.Scene, settings: ViewerSettings["background"]) {
  if (settings.transparent) {
    scene.background = null
    renderer.setClearColor(0x000000, 0)
  } else {
    scene.background = new THREE.Color(settings.color)
    renderer.setClearColor(new THREE.Color(settings.color), 1)
  }
}
```

---

## 15. ワイヤーフレーム設計

### 15.1 要件

- ワイヤーフレームの表示/非表示を切り替えられる
- ワイヤーフレーム色を変更できる
- ワイヤーフレーム透明度を変更できる
- ワイヤーフレーム太さを変更できる
- テクスチャ表示とワイヤーフレーム表示を同時に使える

### 15.2 実装方針

`material.wireframe = true` ではなく、`EdgesGeometry` + `LineSegments` を使います。

理由は以下です。

- 線の色を独立管理できる
- テクスチャ表示の上に重ねられる
- 表示/非表示が制御しやすい
- Blueprintモードへの拡張がしやすい

### 15.3 擬似コード

```ts
function createWireframeOverlay(mesh: THREE.Mesh, settings: ViewerSettings["wireframe"]): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(mesh.geometry)

  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(settings.color),
    transparent: true,
    opacity: settings.opacity,
  })

  const line = new THREE.LineSegments(edges, material)
  line.userData.type = "wireframeOverlay"

  return line
}
```

### 15.4 線の太さについて

WebGLの `LineBasicMaterial.linewidth` は環境によって効かない場合があります。太い線を確実に出したい場合は、後続バージョンで以下を検討します。

- `Line2` / `LineMaterial` / `LineGeometry` を使用
- Canvas 2D書き出し時に線を再描画
- SVG書き出し時にstroke-widthを制御

---

## 16. 投影図生成設計

### 16.1 対応ビュー

| ビュー | 使用軸 | 用途 |
|---|---|---|
| Top | X-Z | 上面図 |
| Front | X-Y | 正面図 |
| Side | Z-Y | 側面図 |
| Isometric | 3Dカメラ | 斜め図 |
| 4-View | Top / Front / Side / Iso | まとめ図 |

### 16.2 投影方式

2種類の方式を持ちます。

#### A. Three.jsレンダリング方式

- 画面上の見た目をそのままPNG化
- テクスチャ表示に強い
- グリッドや背景もそのまま反映しやすい

#### B. ジオメトリ投影方式

- 頂点・辺を2D座標に変換して描画
- SVG出力に向く
- 設計図風・ワイヤーフレームに向く

### 16.3 MVP方針

MVPではThree.jsレンダリング方式を中心に実装します。SVG対応時にジオメトリ投影方式を強化します。

### 16.4 カメラプリセット

```ts
type ProjectionView = "top" | "front" | "side" | "isometric"

function applyProjectionCamera(camera: THREE.OrthographicCamera, view: ProjectionView, model: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(model)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const maxSize = Math.max(size.x, size.y, size.z)

  switch (view) {
    case "top":
      camera.position.set(center.x, center.y + maxSize * 2, center.z)
      break
    case "front":
      camera.position.set(center.x, center.y, center.z + maxSize * 2)
      break
    case "side":
      camera.position.set(center.x + maxSize * 2, center.y, center.z)
      break
    case "isometric":
      camera.position.set(
        center.x + maxSize * 1.6,
        center.y + maxSize * 1.2,
        center.z + maxSize * 1.6
      )
      break
  }

  camera.lookAt(center)
  camera.updateProjectionMatrix()
}
```

---

## 17. 静止画書き出し設計

### 17.1 対応形式

| 形式 | 対応時期 | 用途 |
|---|---|---|
| PNG | MVP | 汎用画像 |
| Transparent PNG | MVP | 素材化 |
| SVG | v1.5 | ワイヤーフレーム・設計図 |
| PDF | v1.5 | 資料出力 |

### 17.2 PNG書き出し

```ts
async function exportPNG(renderer: THREE.WebGLRenderer, options: ImageExportOptions) {
  renderer.setSize(options.width, options.height)
  renderer.render(scene, camera)

  const dataUrl = renderer.domElement.toDataURL("image/png")
  await saveDataUrlToFile(dataUrl, options.outputPath)
}
```

### 17.3 透明PNG

透明PNGでは以下を満たす必要があります。

- `WebGLRenderer({ alpha: true })`
- `scene.background = null`
- `renderer.setClearColor(0x000000, 0)`
- グリッドOFF推奨

---

## 18. 回転動画書き出し設計

### 18.1 機能名

```text
Turntable Export
```

### 18.2 対応形式

| 形式 | 対応時期 | 備考 |
|---|---|---|
| WebM | MVP | Electronと相性が良い |
| MP4 | 実装済み | WebM生成後に同梱ffmpegで変換 |
| PNG Sequence | v1.5以降 | 高品質な中間出力 |
| GIF | v1.5 | SNS向けだが重い |
| Transparent WebM | v2 | VP9 alpha |

### 18.3 動画設定

```ts
type VideoExportSettings = {
  format: "webm" | "mp4"
  width: number
  height: number
  fps: number
  duration: number
  rotations: number
  cameraAngle: "current" | "high-oblique"
  includeGrid: boolean
  bitrateMbps: number
}
```

### 18.4 カメラ回転方式

商品品質では、モデル自体を回すよりカメラを回す方式を優先します。

```ts
function updateTurntableCamera(camera: THREE.Camera, model: THREE.Object3D, progress: number) {
  const box = new THREE.Box3().setFromObject(model)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const maxSize = Math.max(size.x, size.y, size.z)
  const radius = maxSize * 2.2

  const angle = progress * Math.PI * 2

  camera.position.x = center.x + Math.sin(angle) * radius
  camera.position.z = center.z + Math.cos(angle) * radius
  camera.position.y = center.y + maxSize * 0.35

  camera.lookAt(center)
}
```

### 18.5 WebM書き出し

```ts
const stream = renderer.domElement.captureStream(settings.fps)

const recorder = new MediaRecorder(stream, {
  mimeType: "video/webm; codecs=vp9"
})
```

### 18.6 PNG連番書き出し

PNG連番は現状未実装です。高品質な中間出力やGIF/MP4変換の拡張時に追加します。

```ts
for (let i = 0; i < totalFrames; i++) {
  const progress = i / totalFrames
  updateTurntableCamera(camera, model, progress)
  renderer.render(scene, camera)

  const dataUrl = renderer.domElement.toDataURL("image/png")
  await saveFrame(i, dataUrl)
}
```

### 18.7 MP4変換

MP4は現状、MediaRecorderで生成したWebMをffmpeg連携で変換します。

```bash
ffmpeg -i capture.webm \
  -c:v libx264 -pix_fmt yuv420p \
  output.mp4
```

---

## 19. UI設計

### 19.1 全体レイアウト

```text
┌────────────────────────────────────────────────────┐
│ Toolbar                                            │
│ Import / Add Assets / Export Image / Export Video  │
├──────────────┬───────────────────────┬─────────────┤
│ Asset Panel  │ Preview Canvas         │ Inspector   │
│              │                       │             │
│ Models       │ 3D Preview             │ View        │
│ Materials    │ Projection Preview     │ Appearance  │
│ Textures     │                       │ Export      │
│ Missing      │                       │             │
├──────────────┴───────────────────────┴─────────────┤
│ Status Bar                                          │
└────────────────────────────────────────────────────┘
```

### 19.2 Toolbar

- Import Model
- Add Assets
- Reset View
- Export Image
- Export Video
- Presets
- Settings

### 19.3 Asset Panel

表示項目は以下です。

```text
Project Assets

Models
- su-pura-model.obj

Materials
- su-pura-model.mtl

Textures
- body.png
- wheel.jpg

Missing
- glass.png
- interior_diffuse.jpg
```

### 19.4 Inspector

```text
View
- Top
- Front
- Side
- Isometric
- 4 View

Render Mode
- Textured
- Solid
- Wireframe
- Blueprint
- Silhouette

Texture
- Texture ON/OFF
- Use Material Color

Wireframe
- Show Wireframe
- Color
- Opacity
- Thickness

Grid Floor
- Show Grid
- Grid Color
- Center Line Color
- Opacity
- Size
- Divisions

Background
- Color
- Transparent

Export
- Format
- Resolution
- Include Grid
- Transparent
```

---

## 20. プリセット設計

### 20.1 プリセット一覧

| プリセット名 | 背景 | グリッド | ワイヤー | 用途 |
|---|---|---|---|---|
| Studio White | 白 | OFF | 黒 | 汎用サムネイル |
| Technical Blueprint | 濃紺 | ON | 水色 | 設計図風 |
| Dark Viewer | 黒 | ON | 白 | ビューア風 |
| Transparent Asset | 透明 | OFF | 黒 | 素材化 |
| Clay Preview | 薄グレー | ON | 濃グレー | 形状確認 |
| Neon Wire | 黒 | ON | ネオン系 | SNS向け |

### 20.2 Preset型

```ts
type AppearancePreset = {
  id: string
  name: string
  viewerSettings: Partial<ViewerSettings>
}
```

---

## 21. 状態管理設計

### 21.1 Store分割

```text
projectStore
- 現在のプロジェクト
- アセット一覧
- MissingAsset

viewerStore
- scene
- camera
- renderer
- controls

settingsStore
- 表示設定
- 背景
- グリッド
- ワイヤー

exportStore
- 書き出し設定
- 書き出し進捗
```

### 21.2 projectStore例

```ts
type ProjectStore = {
  project: ModelProject | null
  addFiles: (files: File[]) => Promise<void>
  removeAsset: (assetId: string) => void
  resolveAssets: () => Promise<void>
  rebuildScene: () => Promise<void>
}
```

### 21.3 settingsStore例

```ts
type SettingsStore = {
  viewerSettings: ViewerSettings
  updateBackground: (color: string, transparent: boolean) => void
  updateGrid: (grid: Partial<ViewerSettings["grid"]>) => void
  updateWireframe: (wireframe: Partial<ViewerSettings["wireframe"]>) => void
  setTextureEnabled: (enabled: boolean) => void
  setRenderMode: (mode: RenderMode) => void
}
```

---

## 22. Electron IPC設計

### 22.1 主なIPC

| IPC | 内容 |
|---|---|
| `dialog:openFiles` | ファイル選択 |
| `file:saveDataUrl` | PNG保存 |
| `file:saveBinary` | WebM保存 |
| `video:saveMp4FromWebm` | WebMからMP4への変換保存 |
| `app:getVersion` | アプリ情報取得 |

### 22.2 preload bridge

```ts
contextBridge.exposeInMainWorld("meshBlueprint", {
  openFiles: () => ipcRenderer.invoke("dialog:openFiles"),
  saveDataUrl: (payload) => ipcRenderer.invoke("file:saveDataUrl", payload),
  saveText: (payload) => ipcRenderer.invoke("file:saveText", payload),
  convertVideo: (payload) => ipcRenderer.invoke("ffmpeg:convert", payload),
})
```

---

## 23. パフォーマンス設計

### 23.1 想定課題

- 高ポリゴンモデルの読み込みが重い
- テクスチャが巨大な場合にメモリを使う
- EdgesGeometry生成が重い
- 動画書き出し時に大量フレームが発生する
- PNG連番でディスク容量を消費する

### 23.2 対策

- 読み込み時にポリゴン数を表示
- テクスチャ最大解像度を制限可能にする
- ワイヤーフレーム生成を遅延実行する
- 重いモデルではプレビュー品質を下げる
- 書き出し品質とプレビュー品質を分ける
- 使い終わったGeometry / Material / Textureをdisposeする
- 動画書き出し前に推定容量を表示する

### 23.3 dispose処理

```ts
function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose()

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material]

      for (const material of materials) {
        disposeMaterial(material)
      }
    }
  })
}
```

---

## 24. エラーハンドリング設計

### 24.1 エラー種別

| エラー | 表示 |
|---|---|
| 未対応形式 | この形式はまだ対応していません |
| 読み込み失敗 | ファイルを読み込めませんでした |
| MTL不足 | マテリアルファイルが見つかりません |
| テクスチャ不足 | テクスチャファイルが見つかりません |
| GLTF bin不足 | バイナリファイルが見つかりません |
| メモリ不足 | モデルが大きすぎる可能性があります |
| 書き出し失敗 | 書き出しに失敗しました |
| ffmpeg未検出 | MP4/GIF書き出しにはffmpegが必要です |

### 24.2 MissingAssetのUI

MissingAssetは単なるエラーではなく、解決可能な状態として扱います。

```text
Missing Assets

su-pura-model.mtl
[Add File] [Ignore]

body_texture.png
[Add File] [Choose Existing] [Ignore]
```

---

## 25. セキュリティ設計

### 25.1 Electron基本方針

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true` を検討
- preload経由で必要なAPIのみ公開
- 任意パス実行は禁止
- ffmpeg実行時は引数を厳格に生成する

### 25.2 ファイルアクセス

- ユーザーが明示的に選択したファイルのみ読み込む
- 自動で任意ディレクトリ全体をスキャンしない
- 相対パス解決は、追加済みアセット内または選択ディレクトリ内に限定する

---

## 26. テスト設計

### 26.1 単体テスト

- 拡張子分類
- Asset Resolver
- PathMatcher
- MissingAsset生成
- ViewerSettings更新
- ExportSettings生成

### 26.2 結合テスト

- OBJのみ読み込み
- OBJ + MTL読み込み
- OBJ + MTL + PNG読み込み
- GLB読み込み
- GLTF + bin + texture読み込み
- テクスチャON/OFF
- グリッドON/OFF
- 背景色変更
- ワイヤーフレーム色変更
- PNG書き出し
- WebM書き出し

### 26.3 サンプルデータ

```text
test-assets/
  obj/
    simple_cube.obj
    car_without_mtl.obj
    car_with_mtl.obj
    car_textured.obj

  gltf/
    duck.glb
    external_texture.gltf

  stl/
    sample.stl

  ply/
    sample.ply

  fbx/
    sample.fbx
```

---

## 27. 実装フェーズ

### Phase 1: 最小ビューア

- Electron + React + Three.js環境構築
- OBJ読み込み
- OrbitControls
- 背景色変更
- PNG書き出し

### Phase 2: OBJアセット解決

- OBJ内 `mtllib` 解析
- MTL追加対応
- PNG/JPGテクスチャ追加対応
- MissingAsset UI
- テクスチャ自動適用

### Phase 3: 表示モード

- Texture ON/OFF
- Solid表示
- Wireframe Overlay
- Wireframe色変更
- ワイヤーフレーム透明度変更

### Phase 4: グリッド・外観設定

- Grid Floor ON/OFF
- Grid Color
- Center Line Color
- Background Color
- Transparent Background
- Appearance Preset

### Phase 5: 投影図生成

- Top / Front / Side / Isometric
- Orthographic Camera
- 4-View Layout
- PNG書き出し
- 透明PNG書き出し

### Phase 6: 多形式対応

- STL: 実装済み
- GLB: 実装済み
- GLTF: 実装済み
- PLY: 実装済み
- DAE: 実装済み
- FBX: 実装済み
- 3MF: 実装済み
- USDZ: 実装済み
- STEP / STP: 実装済み
- BLEND: 実装済み
- フォルダ再帰読み込み: 実装済み
- Maya / Arnold 系FBXテクスチャ接続補正: 実装済み

### Phase 7: 動画書き出し

- Turntable Export
- WebM書き出し: 実装済み
- MP4書き出し: 実装済み
- PNG Sequence書き出し: 後続対応
- 30fps / 60fps
- 1080p / 4K設定

### Phase 8: 高度な書き出し

- GIF書き出し
- ffmpeg連携: MP4で実装済み
- SVG書き出し
- PDF書き出し

### Phase 9: 商品品質向上

- シルエット抽出
- 隠線処理
- 太線対応
- プロジェクト保存
- 最近使ったファイル
- テーマ機能

### Phase 10: fallback対応

- Assimp fallback
- Blender fallback

---

## 28. 受け入れ基準

### 28.1 MVP受け入れ基準

以下を満たしたらMVP完成とします。

- WindowsとmacOSで起動できる
- OBJファイルをドラッグ&ドロップで読み込める
- OBJだけでもワイヤーフレーム表示できる
- MTLを後から追加するとマテリアルが解決される
- PNG/JPGを後から追加するとテクスチャが適用される
- テクスチャON/OFFができる
- ワイヤーフレームON/OFFができる
- ワイヤーフレーム色を変更できる
- グリッドフロアON/OFFができる
- グリッド色を変更できる
- 背景色を変更できる
- Top / Front / Side / Isometricを切り替えられる
- PNGとして書き出せる
- 透明PNGとして書き出せる
- WebMで360度回転動画を書き出せる

### 28.2 現状の受け入れ基準

- OBJ / MTL / テクスチャを読み込める
- GLB / GLTF / STLを読み込める
- GLTFの外部 `.bin` / 画像参照を追加ファイルから解決できる
- PNG / 透明PNGを書き出せる
- WebM / MP4で360度回転動画を書き出せる
- Appearance Presetを適用できる
- 不足アセットをUI上に表示できる

---

## 29. 主要な技術的リスク

### 29.1 FBXのマテリアル再現

FBXは仕様が複雑で、外部テクスチャ参照やマテリアル再現に差が出やすいため、「読み込めるが完全再現は保証しない」扱いにします。

### 29.2 USDZ対応

USDZはWeb環境での扱いに制約があるため、読み込み検証を継続し、必要に応じてGLB変換ルートも検討します。

### 29.3 ワイヤーフレーム太さ

WebGL環境では線幅制御が制限される場合があります。太線が必要な場合はLine2系またはSVG/Canvas描画で補います。

### 29.4 MP4書き出し

MP4はMediaRecorderで生成したWebMを同梱 `ffmpeg-static` で変換します。配布時は `app.asar.unpacked` にffmpegバイナリが含まれること、macOS署名・notarization後も実行できることを確認します。

### 29.5 重いモデル

高ポリゴンモデルではEdgesGeometry生成や動画書き出しが重くなります。プレビュー品質と書き出し品質を分けて対策します。

---

## 30. 将来的な拡張案

### 30.1 プロジェクト保存

```text
.meshblueprint
```

独自プロジェクトファイルを作り、読み込んだファイル、表示設定、バインド情報、プリセットを保存します。

### 30.2 バッチ書き出し

複数モデルをまとめて同じ設定でPNG / 動画化します。

### 30.3 CLI版

```bash
meshblueprint input.obj --mode blueprint --view four --output output.png
```

GUIだけでなくCLIも用意すると、README画像生成やCI連携に使えます。

### 30.4 テンプレート機能

- README用
- note記事用
- SNS投稿用
- 3Dプリント確認用
- 商品サムネイル用

### 30.5 Web版

GLB / OBJ / STL程度に絞れば、Web版も展開可能です。ただし、ローカルファイル処理や動画書き出しはデスクトップ版の方が強いです。

---

## 31. まとめ

本ソフトは、3Dモデルをただ閲覧するためのビューアではなく、**3Dモデルを見栄えのよい画像・資料・動画に変換するための制作ツール**です。

コアとなる価値は以下です。

```text
1. 主要3D形式の読み込み
2. モデル・マテリアル・テクスチャの後追加と自動解決
3. テクスチャON/OFF
4. ワイヤーフレームON/OFF
5. グリッド・背景・ワイヤー色の調整
6. 投影図画像の書き出し
7. 回転動画の書き出し
```

現状はElectron + React + TypeScript + Three.jsで、OBJ / MTL / Texture、GLB / GLTF、STL、PLY、DAE、FBX、3MF、USDZ、STEP / STP、BLENDの読み込みと、PNG / 透明PNG / WebM / MP4書き出しに対応しています。今後はPNG連番、GIF、Blender fallback / Assimp fallbackへ拡張します。

最重要の設計思想は以下です。

```text
ファイルを一度に全部揃えなくてもよい。
あとから足せば、自動で足りない素材が解決される。
```

このUXを中心に設計することで、通常の3Dビューアよりも実用的で、資料作成や技術発信に強いツールになります。
