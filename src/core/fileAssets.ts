import type { PickedFile } from "../shared/ipcTypes"
import { binaryExtensions, materialExtensions, modelExtensions, textureExtensions } from "../shared/supportedFormats"
import type { AssetFile, AssetKind } from "./types"

const textExtensions = new Set(["obj", "mtl", "gltf", "dae"])
const modelExtensionSet = new Set<string>(modelExtensions)
const materialExtensionSet = new Set<string>(materialExtensions)
const textureExtensionSet = new Set<string>(textureExtensions)
const binaryExtensionSet = new Set<string>(binaryExtensions)

export function classifyAsset(extension: string): AssetKind {
  const normalized = extension.toLowerCase()
  if (modelExtensionSet.has(normalized)) return "model"
  if (materialExtensionSet.has(normalized)) return "material"
  if (textureExtensionSet.has(normalized)) return "texture"
  if (binaryExtensionSet.has(normalized)) return "binary"
  return "unknown"
}

export function extensionFromName(name: string) {
  const parts = name.split(".")
  return parts.length > 1 ? parts.pop()?.toLowerCase() ?? "" : ""
}

export function mimeFromExtension(extension: string) {
  switch (extension.toLowerCase()) {
    case "png":
      return "image/png"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "webp":
      return "image/webp"
    case "gif":
      return "image/gif"
    case "tx":
      return "application/octet-stream"
    case "glb":
      return "model/gltf-binary"
    case "gltf":
      return "model/gltf+json"
    case "stl":
      return "model/stl"
    case "ply":
      return "model/ply"
    case "dae":
      return "model/vnd.collada+xml"
    case "fbx":
      return "model/fbx"
    case "3mf":
      return "model/3mf"
    case "usdz":
      return "model/vnd.usdz+zip"
    case "step":
    case "stp":
      return "model/step"
    case "blend":
      return "application/x-blender"
    case "obj":
    case "mtl":
      return "text/plain"
    default:
      return "application/octet-stream"
  }
}

type BrowserFileWithPath = File & {
  path?: string
  previewStudioRelativePath?: string
  webkitRelativePath?: string
}

export async function assetFromBrowserFile(file: File): Promise<AssetFile> {
  const browserFile = file as BrowserFileWithPath
  const extension = extensionFromName(file.name)
  const buffer = await file.arrayBuffer()
  const text = textExtensions.has(extension) ? await file.text() : undefined
  const path = browserFile.previewStudioRelativePath || browserFile.webkitRelativePath || browserFile.path

  return {
    id: crypto.randomUUID(),
    name: file.name,
    extension,
    kind: classifyAsset(extension),
    path: path || undefined,
    size: file.size,
    addedAt: Date.now(),
    buffer,
    text,
    objectUrl: URL.createObjectURL(file),
  }
}

export function assetFromPickedFile(file: PickedFile): AssetFile {
  const extension = file.extension || extensionFromName(file.name)
  const blob = new Blob([file.data], { type: mimeFromExtension(extension) })
  const text = textExtensions.has(extension) ? new TextDecoder().decode(file.data) : undefined

  return {
    id: crypto.randomUUID(),
    name: file.name,
    extension,
    kind: classifyAsset(extension),
    path: file.path,
    size: file.size,
    addedAt: Date.now(),
    buffer: file.data,
    text,
    objectUrl: URL.createObjectURL(blob),
  }
}

export function revokeAssetUrls(assets: AssetFile[]) {
  for (const asset of assets) {
    URL.revokeObjectURL(asset.objectUrl)
  }
}

export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  const units = ["KB", "MB", "GB"]
  let value = size / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`
}
