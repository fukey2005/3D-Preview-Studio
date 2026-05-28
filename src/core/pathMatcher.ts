import type { AssetFile } from "./types"

export function normalizeAssetPath(value: string) {
  return decodeURIComponent(value)
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\.?\//, "")
    .trim()
}

export function baseName(value: string) {
  const normalized = normalizeAssetPath(value)
  return normalized.split("/").filter(Boolean).pop() ?? normalized
}

export function baseNameWithoutExtension(value: string) {
  const name = baseName(value)
  const dotIndex = name.lastIndexOf(".")
  return dotIndex > 0 ? name.slice(0, dotIndex) : name
}

export function matchAssetByPath(assets: AssetFile[], requestedPath: string, kinds?: AssetFile["kind"][]) {
  const requested = normalizeAssetPath(requestedPath).toLowerCase()
  const requestedName = baseName(requested).toLowerCase()
  const requestedBase = baseNameWithoutExtension(requested).toLowerCase()
  const candidates = kinds ? assets.filter((asset) => kinds.includes(asset.kind)) : assets

  return (
    candidates.find((asset) => normalizeAssetPath(asset.path ?? asset.name).toLowerCase().endsWith(requested)) ??
    candidates.find((asset) => asset.name.toLowerCase() === requestedName) ??
    candidates.find((asset) => baseNameWithoutExtension(asset.name).toLowerCase() === requestedBase)
  )
}
