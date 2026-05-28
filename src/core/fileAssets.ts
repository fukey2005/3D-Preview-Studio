import type { PickedFile } from "../shared/ipcTypes"
import type { AssetFile, AssetKind } from "./types"

const textExtensions = new Set(["obj", "mtl", "gltf"])
const modelExtensions = new Set(["obj", "glb", "gltf", "stl"])
const textureExtensions = new Set(["png", "jpg", "jpeg", "webp", "bmp", "gif", "tga"])

export function classifyAsset(extension: string): AssetKind {
  const normalized = extension.toLowerCase()
  if (modelExtensions.has(normalized)) return "model"
  if (normalized === "mtl") return "material"
  if (textureExtensions.has(normalized)) return "texture"
  if (normalized === "bin") return "binary"
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
    case "glb":
      return "model/gltf-binary"
    case "gltf":
      return "model/gltf+json"
    case "stl":
      return "model/stl"
    case "obj":
    case "mtl":
      return "text/plain"
    default:
      return "application/octet-stream"
  }
}

export async function assetFromBrowserFile(file: File): Promise<AssetFile> {
  const extension = extensionFromName(file.name)
  const buffer = await file.arrayBuffer()
  const text = textExtensions.has(extension) ? await file.text() : undefined

  return {
    id: crypto.randomUUID(),
    name: file.name,
    extension,
    kind: classifyAsset(extension),
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
