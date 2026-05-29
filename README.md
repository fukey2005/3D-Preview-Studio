# 3D Preview Studio

3D Preview Studio は、3Dモデルを読み込み、資料・README・SNS投稿向けの画像やターンテーブル動画を書き出すためのデスクトップアプリです。

OBJ / MTL / テクスチャ、GLB / GLTF、STL、PLY、DAE、FBX、3MF、USDZ、STEP / STP、BLENDに対応しています。

## ダウンロード

最新版は GitHub Releases からダウンロードできます。

- Windows: `.exe`
- macOS: `.dmg` または `.zip`

Windows では、インストーラー版またはポータブル版を利用できます。

- `3D Preview Studio Setup x.x.x.exe`: インストーラー版
- `3D Preview Studio x.x.x.exe`: ポータブル版

## 基本的な使い方

1. アプリを起動します。
2. 3Dファイルまたはフォルダを画面にドラッグ&ドロップします。
3. マテリアルやテクスチャが分かれている場合は、関連ファイルも一緒に追加します。
4. GLTFで外部ファイルが必要な場合は、`.bin` や画像ファイルも一緒に追加します。
5. 表示モード、背景、グリッド、ワイヤーフレーム色、カメラ角度を調整します。
6. `Export` からPNG画像やターンテーブル動画を書き出します。

## 主な機能

- OBJ / MTL / 画像テクスチャの読み込み
- GLB / GLTF / STL / PLY / DAE / FBX / 3MF / USDZ / STEP / STP / BLENDの読み込み
- フォルダ内アセットの再帰的な読み込み
- Maya / Arnold 系FBXの baseColor / opacity / height テクスチャ接続の補正
- GLTF外部 `.bin` / 画像参照の解決
- Textured / Solid / Wireframe / Blueprint 表示
- Top / Front / Side / Isometric ビュー
- 背景色、透明背景、グリッド、ワイヤーフレーム色の調整
- カラープリセットの選択、追加、削除
- 有限 / 無限風グリッドフロア、グリッド高さ調整
- オブジェクト位置調整
- PNG / 透明PNGの書き出し
- WebM / MP4ターンテーブル動画の書き出し
- 画像 / 動画の縦横比プリセット
- 動画サイズ、FPS、秒数、回転数、ビットレート、カメラ角度、グリッド表示設定

## 対応ファイル

### 3Dモデル

- `.obj`
- `.glb`
- `.gltf`
- `.stl`
- `.ply`
- `.dae`
- `.fbx`
- `.3mf`
- `.usdz`
- `.step`
- `.stp`
- `.blend`

### 補助アセット

- `.mtl`
- `.bin`
- `.png`
- `.jpg`
- `.jpeg`
- `.webp`
- `.bmp`
- `.gif`
- `.tga`
- `.tx`

## 書き出し形式

- PNG
- 透明PNG
- WebM
- MP4

## セキュリティ警告について

配布ファイルは現時点ではコード署名していません。

そのため、Windows SmartScreen や macOS Gatekeeper によって警告が表示される場合があります。GitHub Releases から取得したファイルであることを確認してから実行してください。

## 注意事項

- 高ポリゴンモデルでは、ワイヤーフレーム生成や動画書き出しに時間がかかる場合があります。
- OBJのテクスチャが表示されない場合は、参照先の `.mtl` と画像ファイルを同じプロジェクトに追加してください。
- GLTFの外部ファイルが不足している場合は、Missing欄に不足ファイル名が表示されます。
- STEP / STPはアプリ内でメッシュ化して表示します。元CADデータのNURBS編集情報は保持しません。
- BLENDはメッシュプレビュー中心の対応です。未対応のモディファイアや古いBlender形式では表示できない場合があります。
- FBXが `.tx` を参照している場合は、同じベース名の `.png` / `.jpg` / `.webp` などを優先して使用します。

## License

MIT License © Takahiro Fukiya
