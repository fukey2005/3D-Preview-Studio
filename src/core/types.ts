import type * as THREE from "three"

export type AssetKind = "model" | "material" | "texture" | "binary" | "unknown"

export type AssetFile = {
  id: string
  name: string
  extension: string
  kind: AssetKind
  path?: string
  size: number
  addedAt: number
  buffer: ArrayBuffer
  text?: string
  objectUrl: string
}

export type MissingAsset = {
  id: string
  type: "material" | "texture" | "binary" | "unknown"
  requestedByAssetId: string
  expectedPath: string
  expectedFileName: string
  status: "missing" | "resolved" | "ignored"
}

export type RenderMode = "textured" | "solid" | "wireframe" | "blueprint"

export type ProjectionView = "top" | "front" | "side" | "isometric" | "custom"

export type GridMode = "finite" | "infinite"

export type VideoExportFormat = "webm" | "mp4"

export type TurntableCameraAngle = "current" | "high-oblique"

export type ViewerSettings = {
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
    mode: GridMode
    size: number
    divisions: number
    height: number
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
    view: ProjectionView
    autoFit: boolean
    zoom: number
  }
  model: {
    offsetX: number
    offsetY: number
    offsetZ: number
  }
}

export type ImageExportSettings = {
  width: number
  height: number
  transparent: boolean
  includeGrid: boolean
}

export type VideoExportSettings = {
  format: VideoExportFormat
  width: number
  height: number
  fps: number
  duration: number
  rotations: number
  cameraAngle: TurntableCameraAngle
  includeGrid: boolean
  bitrateMbps: number
}

export type ModelStats = {
  meshCount: number
  vertices: number
  triangles: number
}

export type LoadedModel = {
  object: THREE.Object3D
  sourceAssetId: string
  sourceName: string
  missingAssets: MissingAsset[]
  stats: ModelStats
}
