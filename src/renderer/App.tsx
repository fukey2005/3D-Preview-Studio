import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import {
  Aperture,
  Box,
  Brush,
  CheckCircle2,
  Clapperboard,
  Download,
  Eye,
  FileImage,
  FolderOpen,
  Grid3X3,
  Image,
  Layers,
  Palette,
  Plus,
  RotateCcw,
  Trash2,
  TriangleAlert,
  Upload,
  Video,
  X,
} from "lucide-react"
import type {
  AssetFile,
  ImageExportSettings,
  LoadedModel,
  ProjectionView,
  RenderMode,
  TurntableCameraAngle,
  VideoExportFormat,
  ViewerSettings,
  VideoExportSettings,
} from "../core/types"
import { appearancePresets, defaultImageExportSettings, defaultVideoExportSettings, defaultViewerSettings } from "../core/defaults"
import { assetFromBrowserFile, assetFromPickedFile, formatBytes, revokeAssetUrls } from "../core/fileAssets"
import { loadModelFromAssets } from "../core/modelLoader"
import type { PreviewStudioBridge } from "../shared/ipcTypes"
import { importAccept, importableAssetExtensions } from "../shared/supportedFormats"
import ViewerCanvas, { type ViewerCanvasHandle } from "./components/ViewerCanvas"

const browserFallbackBridge: PreviewStudioBridge = {
  openFiles: async () => [],
  openFolder: async () => [],
  async saveDataUrl(payload) {
    const link = document.createElement("a")
    link.href = payload.dataUrl
    link.download = payload.defaultPath
    link.click()
    return { canceled: false, filePath: payload.defaultPath }
  },
  async saveBinary(payload) {
    const link = document.createElement("a")
    const url = URL.createObjectURL(new Blob([payload.data]))
    link.href = url
    link.download = payload.defaultPath
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return { canceled: false, filePath: payload.defaultPath }
  },
  async saveMp4FromWebm() {
    throw new Error("MP4書き出しはElectron版で利用できます")
  },
  getVersion: async () => "browser",
}

const hasNativePreviewBridge = Boolean(window.previewStudio)
const previewStudio = window.previewStudio ?? browserFallbackBridge
const colorStorageKey = "3d-preview-studio.color-presets"
const grayColorPresets = [
  "#ffffff",
  "#e3e3e3",
  "#c6c6c6",
  "#aaaaaa",
  "#8e8e8e",
  "#717171",
  "#555555",
  "#393939",
  "#1c1c1c",
  "#000000",
]
const vividColorPresets = [
  "#ff0000",
  "#00ff00",
  "#0000ff",
  "#ffff00",
  "#00ffff",
  "#ff00ff",
  "#ff7a00",
  "#7c3aed",
  "#00a86b",
  "#ff4d8d",
]
const baseColorPresets = [...grayColorPresets, ...vividColorPresets]
const baseColorPresetSet = new Set(baseColorPresets.map((color) => normalizeColor(color)))

type ExportMode = "png" | "transparent-png" | "webm" | "mp4"

type DroppedEntryBase = {
  fullPath?: string
  isDirectory: boolean
  isFile: boolean
  name: string
}

type DroppedFileEntry = DroppedEntryBase & {
  isFile: true
  file: (successCallback: (file: File) => void, errorCallback?: (error: DOMException) => void) => void
}

type DroppedDirectoryReader = {
  readEntries: (successCallback: (entries: DroppedEntry[]) => void, errorCallback?: (error: DOMException) => void) => void
}

type DroppedDirectoryEntry = DroppedEntryBase & {
  isDirectory: true
  createReader: () => DroppedDirectoryReader
}

type DroppedEntry = DroppedFileEntry | DroppedDirectoryEntry | DroppedEntryBase

type BrowserImportFile = File & {
  previewStudioRelativePath?: string
}

const imageAspectPresets = [
  { label: "16:9", width: 1920, height: 1080 },
  { label: "4:3", width: 1600, height: 1200 },
  { label: "1:1", width: 1600, height: 1600 },
  { label: "4:5", width: 1600, height: 2000 },
  { label: "9:16", width: 1080, height: 1920 },
]

const videoAspectPresets = [
  { label: "16:9", width: 1920, height: 1080 },
  { label: "1:1", width: 1080, height: 1080 },
  { label: "4:5", width: 1080, height: 1350 },
  { label: "9:16", width: 1080, height: 1920 },
]

const frameRatePresets = [24, 30, 60]
const rotationPresets = [1, 2, 3, 4]
const importableExtensionSet = new Set<string>(importableAssetExtensions)

function normalizeColor(color: string) {
  return color.trim().toLowerCase()
}

function uniqueColors(colors: string[]) {
  return Array.from(new Set(colors.map(normalizeColor).filter(Boolean)))
}

function withBaseColorPresets(colors: string[]) {
  return uniqueColors([...baseColorPresets, ...colors])
}

function loadStoredColors() {
  try {
    const raw = localStorage.getItem(colorStorageKey)
    if (!raw) return baseColorPresets
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? withBaseColorPresets(parsed.filter((value) => typeof value === "string")) : baseColorPresets
  } catch {
    return baseColorPresets
  }
}

function mergeSettings(base: ViewerSettings, patch: (typeof appearancePresets)[number]["settings"]): ViewerSettings {
  return {
    ...base,
    ...patch,
    background: { ...base.background, ...patch.background },
    grid: { ...base.grid, ...patch.grid },
    wireframe: { ...base.wireframe, ...patch.wireframe },
  }
}

function groupedAssets(assets: AssetFile[], kind: AssetFile["kind"]) {
  return assets.filter((asset) => asset.kind === kind)
}

function nameWithoutExtension(name: string) {
  const dotIndex = name.lastIndexOf(".")
  return dotIndex > 0 ? name.slice(0, dotIndex) : name
}

function extensionFromFileName(name: string) {
  const dotIndex = name.lastIndexOf(".")
  return dotIndex > 0 ? name.slice(dotIndex + 1).toLowerCase() : ""
}

function isImportableBrowserFile(file: File) {
  return importableExtensionSet.has(extensionFromFileName(file.name))
}

function cleanDroppedPath(path: string) {
  return path.replace(/^\/+/, "")
}

function withDroppedRelativePath(file: File, relativePath?: string): BrowserImportFile {
  if (!relativePath) return file
  Object.defineProperty(file, "previewStudioRelativePath", {
    configurable: true,
    value: cleanDroppedPath(relativePath),
  })
  return file
}

function isDroppedFileEntry(entry: DroppedEntry): entry is DroppedFileEntry {
  return entry.isFile && "file" in entry
}

function isDroppedDirectoryEntry(entry: DroppedEntry): entry is DroppedDirectoryEntry {
  return entry.isDirectory && "createReader" in entry
}

function readDroppedFile(entry: DroppedFileEntry) {
  return new Promise<File>((resolve, reject) => {
    entry.file(resolve, reject)
  })
}

async function readDroppedDirectory(reader: DroppedDirectoryReader) {
  const entries: DroppedEntry[] = []

  while (true) {
    const batch = await new Promise<DroppedEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
    if (batch.length === 0) break
    entries.push(...batch)
  }

  return entries
}

async function filesFromDroppedEntry(entry: DroppedEntry): Promise<BrowserImportFile[]> {
  if (isDroppedFileEntry(entry)) {
    const file = await readDroppedFile(entry)
    return [withDroppedRelativePath(file, entry.fullPath ?? entry.name)]
  }

  if (!isDroppedDirectoryEntry(entry)) return []

  const childEntries = await readDroppedDirectory(entry.createReader())
  const nestedFiles = await Promise.all(childEntries.map(filesFromDroppedEntry))
  return nestedFiles.flat()
}

async function filesFromDataTransfer(dataTransfer: DataTransfer): Promise<BrowserImportFile[]> {
  const droppedItems = Array.from(dataTransfer.items ?? [])
  const entries = droppedItems
    .map((item) => {
      const entryProvider = item as unknown as { webkitGetAsEntry?: () => DroppedEntry | null }
      return entryProvider.webkitGetAsEntry?.() ?? null
    })
    .filter((entry): entry is DroppedEntry => Boolean(entry))

  if (entries.length === 0) return Array.from(dataTransfer.files)

  const nestedFiles = await Promise.all(entries.map(filesFromDroppedEntry))
  return nestedFiles.flat()
}

function ControlButton({
  active,
  children,
  onClick,
  title,
}: {
  active?: boolean
  children: React.ReactNode
  onClick: () => void
  title?: string
}) {
  return (
    <button type="button" className={`control-button ${active ? "is-active" : ""}`} onClick={onClick} title={title}>
      {children}
    </button>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="field-row">
      <span>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}

function ColorField({
  label,
  value,
  presets,
  onChange,
  onAddPreset,
  onDeletePreset,
}: {
  label: string
  value: string
  presets: string[]
  onChange: (value: string) => void
  onAddPreset: (value: string) => void
  onDeletePreset: (value: string) => void
}) {
  const normalizedPresets = uniqueColors(presets)
  const grayPresets = grayColorPresets.filter((color) => normalizedPresets.includes(normalizeColor(color)))
  const vividPresets = vividColorPresets.filter((color) => normalizedPresets.includes(normalizeColor(color)))
  const addedPresets = normalizedPresets.filter((color) => !baseColorPresetSet.has(normalizeColor(color)))

  function renderColorSwatch(color: string) {
    const isBasePreset = baseColorPresetSet.has(normalizeColor(color))

    return (
      <div className="color-swatch-item" key={`${label}-${color}`}>
        <button
          type="button"
          className={`color-swatch ${normalizeColor(value) === normalizeColor(color) ? "is-active" : ""}`}
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
          title={color}
          aria-label={`${label} ${color}`}
        />
        {!isBasePreset && (
          <button type="button" className="delete-color-button" onClick={() => onDeletePreset(color)} title={`${color} を削除`} aria-label={`${color} を削除`}>
            <X size={11} strokeWidth={3} aria-hidden="true" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="color-control">
      <div className="color-control__top">
        <span>{label}</span>
        <div className="color-control__inputs">
          <input type="color" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} />
          <button type="button" className="add-color-button" onClick={() => onAddPreset(value)} title="現在の色をプリセットへ追加">
            <Plus size={14} />
          </button>
        </div>
      </div>
      <div className="color-swatch-grid">
        <div className="color-preset-row">{grayPresets.map(renderColorSwatch)}</div>
        <div className="color-preset-row">{vividPresets.map(renderColorSwatch)}</div>
        {addedPresets.length > 0 && <div className="color-preset-row color-preset-row--added">{addedPresets.map(renderColorSwatch)}</div>}
      </div>
    </div>
  )
}

export default function App() {
  const viewerRef = useRef<ViewerCanvasHandle | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const assetsRef = useRef<AssetFile[]>([])
  const [assets, setAssets] = useState<AssetFile[]>([])
  const [activeModelId, setActiveModelId] = useState<string | undefined>()
  const [loadedModel, setLoadedModel] = useState<LoadedModel | null>(null)
  const [settings, setSettings] = useState<ViewerSettings>(defaultViewerSettings)
  const [imageSettings, setImageSettings] = useState<ImageExportSettings>(defaultImageExportSettings)
  const [videoSettings, setVideoSettings] = useState<VideoExportSettings>(defaultVideoExportSettings)
  const [colorPresets, setColorPresets] = useState<string[]>(loadStoredColors)
  const [exportMode, setExportMode] = useState<ExportMode>("png")
  const [isExportPanelOpen, setIsExportPanelOpen] = useState(false)
  const [exportPreview, setExportPreview] = useState<string | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [status, setStatus] = useState("ファイルを追加してください")
  const [appVersion, setAppVersion] = useState("")
  const [error, setError] = useState<string | null>(null)

  const activeModel = useMemo(() => assets.find((asset) => asset.id === activeModelId), [assets, activeModelId])
  const modelAssets = groupedAssets(assets, "model")
  const materialAssets = groupedAssets(assets, "material")
  const textureAssets = groupedAssets(assets, "texture")
  const binaryAssets = groupedAssets(assets, "binary")

  useEffect(() => {
    previewStudio.getVersion().then(setAppVersion).catch(() => setAppVersion(""))
  }, [])

  useEffect(() => {
    localStorage.setItem(colorStorageKey, JSON.stringify(colorPresets))
  }, [colorPresets])

  useEffect(() => {
    let canceled = false

    async function updatePreview() {
      if (!isExportPanelOpen || !viewerRef.current || !loadedModel || isExporting) {
        setExportPreview(null)
        return
      }

      try {
        const preview =
          exportMode === "webm" || exportMode === "mp4"
            ? await viewerRef.current.renderVideoPreview(videoSettings)
            : await viewerRef.current.renderExportPreview({
                ...imageSettings,
                transparent: exportMode === "transparent-png",
              })
        if (!canceled) setExportPreview(preview)
      } catch {
        if (!canceled) setExportPreview(null)
      }
    }

    const timer = window.setTimeout(updatePreview, 180)
    return () => {
      canceled = true
      window.clearTimeout(timer)
    }
  }, [isExportPanelOpen, loadedModel, imageSettings, videoSettings, exportMode, settings, isExporting])

  useEffect(() => {
    assetsRef.current = assets
  }, [assets])

  useEffect(() => {
    return () => {
      revokeAssetUrls(assetsRef.current)
    }
  }, [])

  useEffect(() => {
    let canceled = false

    async function load() {
      if (!activeModelId) {
        setLoadedModel(null)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const model = await loadModelFromAssets(assets, activeModelId)
        if (canceled) return
        setLoadedModel(model)
        setStatus(model ? `${model.sourceName} を読み込みました` : "モデルが見つかりません")
      } catch (loadError) {
        if (canceled) return
        const message = loadError instanceof Error ? loadError.message : "ファイルを読み込めませんでした"
        setLoadedModel(null)
        setError(message)
        setStatus("読み込みに失敗しました")
      } finally {
        if (!canceled) setIsLoading(false)
      }
    }

    load()
    return () => {
      canceled = true
    }
  }, [assets, activeModelId])

  async function addBrowserFiles(files: File[]) {
    if (files.length === 0) return
    const importableFiles = files.filter(isImportableBrowserFile)
    const skippedCount = files.length - importableFiles.length

    if (importableFiles.length === 0) {
      setStatus("対応しているファイルが見つかりません")
      return
    }

    setError(null)
    const newAssets = await Promise.all(importableFiles.map(assetFromBrowserFile))
    addAssets(newAssets, skippedCount > 0 ? `${newAssets.length}件のファイルを追加しました（未対応 ${skippedCount}件を除外）` : undefined)
  }

  function addAssets(newAssets: AssetFile[], statusMessage?: string) {
    setError(null)
    setAssets((current) => [...current, ...newAssets])
    const newestModel = [...newAssets].reverse().find((asset) => asset.kind === "model")
    if (newestModel) {
      setActiveModelId(newestModel.id)
    }
    setStatus(statusMessage ?? `${newAssets.length}件のファイルを追加しました`)
  }

  async function openFiles() {
    if (!hasNativePreviewBridge) {
      fileInputRef.current?.click()
      return
    }

    const picked = await previewStudio.openFiles()
    if (picked.length === 0) return
    addAssets(picked.map(assetFromPickedFile))
  }

  async function openFolder() {
    if (!hasNativePreviewBridge) {
      fileInputRef.current?.click()
      return
    }

    const picked = await previewStudio.openFolder()
    if (picked.length === 0) return
    addAssets(picked.map(assetFromPickedFile))
  }

  function clearProject() {
    const confirmed = window.confirm("すべてのアセットを削除しますか。")
    if (!confirmed) return

    revokeAssetUrls(assets)
    setAssets([])
    setActiveModelId(undefined)
    setLoadedModel(null)
    setError(null)
    setStatus("プロジェクトをクリアしました")
  }

  function deleteAsset(assetId: string) {
    const targetAsset = assets.find((asset) => asset.id === assetId)
    if (!targetAsset) return

    const confirmed = window.confirm(`${targetAsset.name} を削除しますか。`)
    if (!confirmed) return

    const nextAssets = assets.filter((asset) => asset.id !== assetId)
    URL.revokeObjectURL(targetAsset.objectUrl)
    setAssets(nextAssets)

    if (targetAsset.id === activeModelId) {
      const nextModel = nextAssets.find((asset) => asset.kind === "model")
      setActiveModelId(nextModel?.id)
      if (!nextModel) setLoadedModel(null)
    }

    setError(null)
    setStatus(`${targetAsset.name} を削除しました`)
  }

  async function exportPng(transparent = false) {
    if (!viewerRef.current || !loadedModel) return
    setIsExporting(true)
    setStatus("PNGを書き出しています")

    try {
      const exportSettings = { ...imageSettings, transparent }
      const dataUrl = await viewerRef.current.exportPng(exportSettings)
      const suffix = transparent ? "transparent" : "preview"
      const result = await previewStudio.saveDataUrl({
        defaultPath: `${nameWithoutExtension(loadedModel.sourceName)}-${suffix}.png`,
        dataUrl,
        filters: [{ name: "PNG Image", extensions: ["png"] }],
      })
      setStatus(result.canceled ? "PNG書き出しをキャンセルしました" : `PNGを書き出しました: ${result.filePath}`)
    } catch (exportError) {
      setStatus("PNG書き出しに失敗しました")
      setError(exportError instanceof Error ? exportError.message : "PNG書き出しに失敗しました")
    } finally {
      setIsExporting(false)
    }
  }

  async function runExport() {
    if (exportMode === "webm" || exportMode === "mp4") {
      await exportVideo(exportMode)
      return
    }
    await exportPng(exportMode === "transparent-png")
  }

  async function exportVideo(format: VideoExportFormat) {
    if (!viewerRef.current || !loadedModel) return
    setIsExporting(true)
    setStatus(format === "mp4" ? "MP4用の動画を生成しています" : "WebMを書き出しています")

    try {
      const data = await viewerRef.current.exportWebm({ ...videoSettings, format })
      const result =
        format === "mp4"
          ? await previewStudio.saveMp4FromWebm({
              defaultPath: `${nameWithoutExtension(loadedModel.sourceName)}-turntable.mp4`,
              webmData: data,
              filters: [{ name: "MP4 Video", extensions: ["mp4"] }],
            })
          : await previewStudio.saveBinary({
              defaultPath: `${nameWithoutExtension(loadedModel.sourceName)}-turntable.webm`,
              data,
              filters: [{ name: "WebM Video", extensions: ["webm"] }],
            })
      const label = format.toUpperCase()
      setStatus(result.canceled ? `${label}書き出しをキャンセルしました` : `${label}を書き出しました: ${result.filePath}`)
    } catch (exportError) {
      const label = format.toUpperCase()
      setStatus(`${label}書き出しに失敗しました`)
      setError(exportError instanceof Error ? exportError.message : `${label}書き出しに失敗しました`)
    } finally {
      setIsExporting(false)
    }
  }

  function addColorPreset(color: string) {
    const normalized = normalizeColor(color)
    if (colorPresets.includes(normalized)) {
      setStatus("この色はすでにプリセットにあります")
      return
    }
    setColorPresets((current) => withBaseColorPresets([...current, normalized]))
    setStatus(`${normalized} をカラープリセットに追加しました`)
  }

  function deleteColorPreset(color: string) {
    const normalized = normalizeColor(color)
    if (baseColorPresetSet.has(normalized)) {
      setStatus("初期プリセットは削除できません")
      return
    }

    const confirmed = window.confirm(`${normalized} をカラープリセットから削除しますか。`)
    if (!confirmed) return

    setColorPresets((current) => withBaseColorPresets(current.filter((preset) => normalizeColor(preset) !== normalized)))
    setStatus(`${normalized} をカラープリセットから削除しました`)
  }

  function applyAppearancePreset(preset: (typeof appearancePresets)[number]) {
    const confirmed = window.confirm("現在のAppearance設定がプリセットの内容で上書きされます。変更しますか。")
    if (!confirmed) return
    setSettings((current) => mergeSettings(current, preset.settings))
    setStatus(`${preset.name} を適用しました`)
  }

  function updateSettings(patch: Partial<ViewerSettings>) {
    setSettings((current) => ({ ...current, ...patch }))
  }

  function updateCameraView(view: ProjectionView) {
    setSettings((current) => ({ ...current, camera: { ...current.camera, view } }))
  }

  function updateGrid(patch: Partial<ViewerSettings["grid"]>) {
    setSettings((current) => ({ ...current, grid: { ...current.grid, ...patch } }))
  }

  function updateWireframe(patch: Partial<ViewerSettings["wireframe"]>) {
    setSettings((current) => ({ ...current, wireframe: { ...current.wireframe, ...patch } }))
  }

  function updateBackground(patch: Partial<ViewerSettings["background"]>) {
    setSettings((current) => ({ ...current, background: { ...current.background, ...patch } }))
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const dataTransfer = event.dataTransfer
    setIsDragActive(false)
    filesFromDataTransfer(dataTransfer)
      .then(addBrowserFiles)
      .catch((dropError) => {
        setError(dropError instanceof Error ? dropError.message : "ファイル追加に失敗しました")
      })
  }

  return (
    <div
      className="app-shell"
      onDragOver={(event) => {
        event.preventDefault()
        setIsDragActive(true)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setIsDragActive(false)
      }}
      onDrop={onDrop}
    >
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        multiple
        accept={importAccept}
        onChange={(event) => {
          addBrowserFiles(Array.from(event.target.files ?? [])).catch((fileError) => {
            setError(fileError instanceof Error ? fileError.message : "ファイル追加に失敗しました")
          })
          event.currentTarget.value = ""
        }}
      />
      <header className="toolbar">
        <div className="brand">
          <Box size={22} />
          <div>
            <strong>3D Preview Studio</strong>
            <span>{appVersion ? `v${appVersion}` : "Desktop Preview Tool"}</span>
          </div>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="primary-button" onClick={openFiles}>
            <FolderOpen size={17} />
            Import
          </button>
          <button type="button" onClick={openFolder}>
            <FolderOpen size={17} />
            Folder
          </button>
          <button type="button" onClick={() => viewerRef.current?.resetView()} disabled={!loadedModel}>
            <RotateCcw size={17} />
            Reset View
          </button>
          <button type="button" onClick={() => setIsExportPanelOpen(true)} disabled={!loadedModel}>
            <Download size={17} />
            Export
          </button>
        </div>
      </header>

      <main className="workspace">
        <aside className="asset-panel">
          <div className="panel-header">
            <h2>Assets</h2>
            <button type="button" className="icon-button" onClick={clearProject} disabled={assets.length === 0} title="クリア">
              <Trash2 size={16} />
            </button>
          </div>

          <div className="asset-drop-hint">
            <Upload size={18} />
            <span>ファイルまたはフォルダをドロップして追加</span>
          </div>

          <AssetSection title="Models" icon={<Box size={15} />} assets={modelAssets} activeId={activeModelId} onSelect={setActiveModelId} onDelete={deleteAsset} />
          <AssetSection title="Materials" icon={<Layers size={15} />} assets={materialAssets} onDelete={deleteAsset} />
          <AssetSection title="Textures" icon={<Image size={15} />} assets={textureAssets} onDelete={deleteAsset} />
          {binaryAssets.length > 0 && <AssetSection title="Binary" icon={<Aperture size={15} />} assets={binaryAssets} onDelete={deleteAsset} />}

          <section className="asset-section">
            <div className="section-title">
              <TriangleAlert size={15} />
              <span>Missing</span>
            </div>
            {loadedModel?.missingAssets.length ? (
              <div className="missing-list">
                {loadedModel.missingAssets.map((missing) => (
                  <div className="missing-item" key={missing.id}>
                    <span>{missing.expectedFileName}</span>
                    <small>{missing.type}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-line">不足アセットはありません</p>
            )}
          </section>
        </aside>

        <section className="viewer-panel">
          <ViewerCanvas
            ref={viewerRef}
            modelObject={loadedModel?.object ?? null}
            settings={settings}
            isDragActive={isDragActive}
            onUserCameraMove={(view) => updateCameraView(view)}
          />
          <div className="model-info-bar">
            {isLoading ? (
              <span>読み込み中</span>
            ) : loadedModel ? (
              <>
                <span>{loadedModel.sourceName}</span>
                <span>{loadedModel.stats.meshCount} meshes</span>
                <span>{loadedModel.stats.triangles.toLocaleString()} tris</span>
              </>
            ) : (
              <span>モデル未読み込み</span>
            )}
          </div>
        </section>

        <aside className="inspector">
          <div className="panel-header">
            <h2>Inspector</h2>
            {loadedModel && <CheckCircle2 size={18} className="ok-icon" />}
          </div>

          <InspectorSection title="View" icon={<Eye size={16} />}>
            <div className="segmented-grid">
              {(["top", "front", "side", "isometric"] as ProjectionView[]).map((view) => (
                <ControlButton key={view} active={settings.camera.view === view} onClick={() => updateCameraView(view)}>
                  {view}
                </ControlButton>
              ))}
            </div>
            <NumberField
              label="Zoom"
              value={settings.camera.zoom}
              min={0.25}
              max={4}
              step={0.05}
              onChange={(zoom) => setSettings((current) => ({ ...current, camera: { ...current.camera, zoom } }))}
            />
          </InspectorSection>

          <InspectorSection title="Render Mode" icon={<Brush size={16} />}>
            <div className="segmented-grid">
              {(["textured", "solid", "wireframe", "blueprint"] as RenderMode[]).map((mode) => (
                <ControlButton key={mode} active={settings.renderMode === mode} onClick={() => updateSettings({ renderMode: mode })}>
                  {mode}
                </ControlButton>
              ))}
            </div>
            <ToggleRow label="Texture" checked={settings.textureEnabled} onChange={(textureEnabled) => updateSettings({ textureEnabled })} />
            <ToggleRow
              label="Wire Overlay"
              checked={settings.wireframeOverlayEnabled}
              onChange={(wireframeOverlayEnabled) => updateSettings({ wireframeOverlayEnabled })}
            />
          </InspectorSection>

          <InspectorSection title="Appearance" icon={<Palette size={16} />}>
            <div className="preset-list">
              {appearancePresets.map((preset) => (
                <button type="button" key={preset.id} onClick={() => applyAppearancePreset(preset)}>
                  {preset.name}
                </button>
              ))}
            </div>
            <ColorField
              label="Background"
              value={settings.background.color}
              presets={colorPresets}
              onChange={(color) => updateBackground({ color })}
              onAddPreset={addColorPreset}
              onDeletePreset={deleteColorPreset}
            />
            <ToggleRow label="Transparent" checked={settings.background.transparent} onChange={(transparent) => updateBackground({ transparent })} />
          </InspectorSection>

          <InspectorSection title="Grid Floor" icon={<Grid3X3 size={16} />}>
            <ToggleRow label="Show Grid" checked={settings.grid.enabled} onChange={(enabled) => updateGrid({ enabled })} />
            <div className="segmented-grid">
              {(["finite", "infinite"] as const).map((mode) => (
                <ControlButton key={mode} active={settings.grid.mode === mode} onClick={() => updateGrid({ mode })}>
                  {mode}
                </ControlButton>
              ))}
            </div>
            <ColorField
              label="Grid Color"
              value={settings.grid.color}
              presets={colorPresets}
              onChange={(color) => updateGrid({ color })}
              onAddPreset={addColorPreset}
              onDeletePreset={deleteColorPreset}
            />
            <ColorField
              label="Center Line"
              value={settings.grid.centerColor}
              presets={colorPresets}
              onChange={(centerColor) => updateGrid({ centerColor })}
              onAddPreset={addColorPreset}
              onDeletePreset={deleteColorPreset}
            />
            <NumberField label="Opacity" value={settings.grid.opacity} min={0} max={1} step={0.05} onChange={(opacity) => updateGrid({ opacity })} />
            <NumberField label="Size" value={settings.grid.size} min={1} max={100} onChange={(size) => updateGrid({ size })} />
            <NumberField label="Divisions" value={settings.grid.divisions} min={2} max={100} onChange={(divisions) => updateGrid({ divisions })} />
            <NumberField label="Grid Height" value={settings.grid.height} min={-100} max={100} step={0.1} onChange={(height) => updateGrid({ height })} />
          </InspectorSection>

          <InspectorSection title="Wireframe" icon={<Aperture size={16} />}>
            <ColorField
              label="Color"
              value={settings.wireframe.color}
              presets={colorPresets}
              onChange={(color) => updateWireframe({ color })}
              onAddPreset={addColorPreset}
              onDeletePreset={deleteColorPreset}
            />
            <NumberField label="Opacity" value={settings.wireframe.opacity} min={0} max={1} step={0.05} onChange={(opacity) => updateWireframe({ opacity })} />
          </InspectorSection>

          <InspectorSection title="Object Position" icon={<Box size={16} />}>
            <NumberField
              label="Offset X"
              value={settings.model.offsetX}
              min={-100}
              max={100}
              step={0.1}
              onChange={(offsetX) => setSettings((current) => ({ ...current, model: { ...current.model, offsetX } }))}
            />
            <NumberField
              label="Offset Y"
              value={settings.model.offsetY}
              min={-100}
              max={100}
              step={0.1}
              onChange={(offsetY) => setSettings((current) => ({ ...current, model: { ...current.model, offsetY } }))}
            />
            <NumberField
              label="Offset Z"
              value={settings.model.offsetZ}
              min={-100}
              max={100}
              step={0.1}
              onChange={(offsetZ) => setSettings((current) => ({ ...current, model: { ...current.model, offsetZ } }))}
            />
          </InspectorSection>
        </aside>
      </main>

      {isExportPanelOpen && (
        <ExportPanel
          mode={exportMode}
          imageSettings={imageSettings}
          videoSettings={videoSettings}
          preview={exportPreview}
          isExporting={isExporting}
          onClose={() => setIsExportPanelOpen(false)}
          onModeChange={setExportMode}
          onImageSettingsChange={(patch) => setImageSettings((current) => ({ ...current, ...patch }))}
          onVideoSettingsChange={(patch) => setVideoSettings((current) => ({ ...current, ...patch }))}
          onExport={runExport}
        />
      )}

      {isExporting && (
        <div className="busy-overlay" role="status" aria-live="polite">
          <div className="busy-card">
            <div className="spinner" />
            <strong>書き出し中です</strong>
            <span>レンダリングと動画変換が完了するまでお待ちください。</span>
          </div>
        </div>
      )}

      <footer className="status-bar">
        <span>{status}</span>
        {activeModel && <span>{activeModel.name} / {formatBytes(activeModel.size)}</span>}
        {error && <span className="status-error">{error}</span>}
      </footer>
    </div>
  )
}

function ExportPanel({
  mode,
  imageSettings,
  videoSettings,
  preview,
  isExporting,
  onClose,
  onModeChange,
  onImageSettingsChange,
  onVideoSettingsChange,
  onExport,
}: {
  mode: ExportMode
  imageSettings: ImageExportSettings
  videoSettings: VideoExportSettings
  preview: string | null
  isExporting: boolean
  onClose: () => void
  onModeChange: (mode: ExportMode) => void
  onImageSettingsChange: (patch: Partial<ImageExportSettings>) => void
  onVideoSettingsChange: (patch: Partial<VideoExportSettings>) => void
  onExport: () => void
}) {
  const isVideo = mode === "webm" || mode === "mp4"
  const previewStageRef = useRef<HTMLDivElement | null>(null)
  const [previewStageSize, setPreviewStageSize] = useState({ width: 0, height: 0 })
  const totalVideoDuration = videoSettings.duration * Math.max(videoSettings.rotations, 0.25)
  const previewWidth = Math.max(1, (isVideo ? videoSettings.width : imageSettings.width) || 1)
  const previewHeight = Math.max(1, (isVideo ? videoSettings.height : imageSettings.height) || 1)
  const previewRatio = previewWidth / Math.max(previewHeight, 1)
  const previewFrameStyle: CSSProperties = { aspectRatio: `${previewWidth} / ${previewHeight}` }

  if (previewStageSize.width > 0 && previewStageSize.height > 0) {
    const stageRatio = previewStageSize.width / previewStageSize.height
    if (previewRatio >= stageRatio) {
      previewFrameStyle.width = `${previewStageSize.width}px`
      previewFrameStyle.height = `${previewStageSize.width / previewRatio}px`
    } else {
      previewFrameStyle.width = `${previewStageSize.height * previewRatio}px`
      previewFrameStyle.height = `${previewStageSize.height}px`
    }
  }

  useEffect(() => {
    const stage = previewStageRef.current
    if (!stage) return

    function updatePreviewStageSize(width: number, height: number) {
      const next = {
        width: Math.max(0, Math.floor(width)),
        height: Math.max(0, Math.floor(height)),
      }
      setPreviewStageSize((current) => (current.width === next.width && current.height === next.height ? current : next))
    }

    const stageRect = stage.getBoundingClientRect()
    updatePreviewStageSize(stageRect.width, stageRect.height)

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) updatePreviewStageSize(rect.width, rect.height)
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="export-overlay" role="dialog" aria-modal="true" aria-label="Export">
      <div className="export-panel">
        <div className="export-panel__header">
          <div>
            <h2>Export</h2>
            <p>形式、サイズ、グリッド、動画設定をここで選択します。</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="閉じる">
            <X size={16} />
          </button>
        </div>

        <div className="export-panel__body">
          <section className="export-preview">
            <div className="export-preview__stage" ref={previewStageRef}>
              <div className="export-preview__frame" style={previewFrameStyle}>
                {preview ? <img src={preview} alt="書き出しプレビュー" /> : <div className="export-preview__empty">Preview</div>}
              </div>
            </div>
            <div className="export-preview__meta">
              <span>{`${previewWidth} x ${previewHeight}`}</span>
              {isVideo && <span>{totalVideoDuration.toFixed(1)}s total</span>}
            </div>
          </section>

          <section className="export-controls">
            <div className="export-format-grid">
              {([
                ["png", "PNG", FileImage],
                ["transparent-png", "Transparent", Image],
                ["webm", "WebM", Video],
                ["mp4", "MP4", Clapperboard],
              ] as const).map(([value, label, Icon]) => (
                <button type="button" key={value} className={mode === value ? "is-active" : ""} onClick={() => onModeChange(value)}>
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>

            {!isVideo && (
              <div className="export-control-group">
                <h3>Image</h3>
                <div className="preset-chip-grid">
                  {imageAspectPresets.map((preset) => (
                    <button type="button" key={preset.label} onClick={() => onImageSettingsChange({ width: preset.width, height: preset.height })}>
                      {preset.label}
                    </button>
                  ))}
                </div>
                <NumberField label="Width" value={imageSettings.width} min={256} max={8192} onChange={(width) => onImageSettingsChange({ width })} />
                <NumberField label="Height" value={imageSettings.height} min={256} max={8192} onChange={(height) => onImageSettingsChange({ height })} />
                <ToggleRow label="Include Grid" checked={imageSettings.includeGrid} onChange={(includeGrid) => onImageSettingsChange({ includeGrid })} />
              </div>
            )}

            {isVideo && (
              <div className="export-control-group">
                <h3>Video</h3>
                <div className="preset-chip-grid">
                  {videoAspectPresets.map((preset) => (
                    <button type="button" key={preset.label} onClick={() => onVideoSettingsChange({ width: preset.width, height: preset.height })}>
                      {preset.label}
                    </button>
                  ))}
                </div>
                <NumberField label="Width" value={videoSettings.width} min={256} max={4096} onChange={(width) => onVideoSettingsChange({ width })} />
                <NumberField label="Height" value={videoSettings.height} min={256} max={4096} onChange={(height) => onVideoSettingsChange({ height })} />
                <div className="preset-chip-grid">
                  {frameRatePresets.map((fps) => (
                    <button type="button" key={fps} className={videoSettings.fps === fps ? "is-active" : ""} onClick={() => onVideoSettingsChange({ fps })}>
                      {fps} fps
                    </button>
                  ))}
                </div>
                <NumberField label="FPS" value={videoSettings.fps} min={12} max={60} onChange={(fps) => onVideoSettingsChange({ fps })} />
                <NumberField label="Seconds / Rotation" value={videoSettings.duration} min={1} max={20} step={0.5} onChange={(duration) => onVideoSettingsChange({ duration })} />
                <div className="preset-chip-grid">
                  {rotationPresets.map((rotations) => (
                    <button
                      type="button"
                      key={rotations}
                      className={videoSettings.rotations === rotations ? "is-active" : ""}
                      onClick={() => onVideoSettingsChange({ rotations })}
                    >
                      {rotations}x
                    </button>
                  ))}
                </div>
                <NumberField label="Rotations" value={videoSettings.rotations} min={0.25} max={12} step={0.25} onChange={(rotations) => onVideoSettingsChange({ rotations })} />
                <NumberField label="Bitrate Mbps" value={videoSettings.bitrateMbps} min={4} max={120} onChange={(bitrateMbps) => onVideoSettingsChange({ bitrateMbps })} />
                <ToggleRow label="Include Grid" checked={videoSettings.includeGrid} onChange={(includeGrid) => onVideoSettingsChange({ includeGrid })} />
                <div className="segmented-grid">
                  {(["current", "high-oblique"] as TurntableCameraAngle[]).map((cameraAngle) => (
                    <ControlButton key={cameraAngle} active={videoSettings.cameraAngle === cameraAngle} onClick={() => onVideoSettingsChange({ cameraAngle })}>
                      {cameraAngle === "current" ? "current angle" : "high angle"}
                    </ControlButton>
                  ))}
                </div>
              </div>
            )}

            <div className="export-actions">
              <button type="button" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={onExport} disabled={isExporting}>
                <Download size={16} />
                {isExporting ? "Exporting" : "Export"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function AssetSection({
  title,
  icon,
  assets,
  activeId,
  onSelect,
  onDelete,
}: {
  title: string
  icon: React.ReactNode
  assets: AssetFile[]
  activeId?: string
  onSelect?: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <section className="asset-section">
      <div className="section-title">
        {icon}
        <span>{title}</span>
        <small>{assets.length}</small>
      </div>
      {assets.length === 0 ? (
        <p className="muted-line">未追加</p>
      ) : (
        <div className="asset-list">
          {assets.map((asset) => (
            <div key={asset.id} className={`asset-item ${activeId === asset.id ? "is-active" : ""}`}>
              {onSelect ? (
                <button type="button" className="asset-item__main" onClick={() => onSelect(asset.id)}>
                  <span>{asset.name}</span>
                  <small>{formatBytes(asset.size)}</small>
                </button>
              ) : (
                <div className="asset-item__main">
                  <span>{asset.name}</span>
                  <small>{formatBytes(asset.size)}</small>
                </div>
              )}
              <button type="button" className="asset-delete-button" onClick={() => onDelete(asset.id)} title={`${asset.name} を削除`} aria-label={`${asset.name} を削除`}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function InspectorSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="inspector-section">
      <div className="section-title">
        {icon}
        <span>{title}</span>
      </div>
      <div className="section-body">{children}</div>
    </section>
  )
}
