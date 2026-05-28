import type { ImageExportSettings, VideoExportSettings, ViewerSettings } from "./types"

export const defaultViewerSettings: ViewerSettings = {
  renderMode: "textured",
  textureEnabled: true,
  wireframeOverlayEnabled: false,
  materialColorEnabled: true,
  background: {
    color: "#f7f8f9",
    transparent: false,
  },
  grid: {
    enabled: true,
    mode: "finite",
    size: 10,
    divisions: 20,
    height: 0,
    color: "#8d96a5",
    centerColor: "#3f4754",
    opacity: 0.34,
  },
  wireframe: {
    color: "#0f172a",
    opacity: 0.92,
    thickness: 1,
  },
  camera: {
    view: "isometric",
    autoFit: true,
    zoom: 1,
  },
  model: {
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
  },
}

export const defaultImageExportSettings: ImageExportSettings = {
  width: 1600,
  height: 1200,
  transparent: false,
  includeGrid: true,
}

export const defaultVideoExportSettings: VideoExportSettings = {
  format: "webm",
  width: 1280,
  height: 720,
  fps: 30,
  duration: 4,
  rotations: 1,
  cameraAngle: "current",
  includeGrid: true,
  bitrateMbps: 32,
}

export const appearancePresets = [
  {
    id: "studio-white",
    name: "Studio White",
    settings: {
      renderMode: "textured",
      background: { color: "#f7f8f9", transparent: false },
      grid: { enabled: false, mode: "finite", color: "#b8c0cc", centerColor: "#677083", opacity: 0.26 },
      wireframe: { color: "#111827", opacity: 0.9 },
    },
  },
  {
    id: "technical-blueprint",
    name: "Technical Blueprint",
    settings: {
      renderMode: "blueprint",
      background: { color: "#071a2f", transparent: false },
      grid: { enabled: true, mode: "infinite", color: "#2f7da8", centerColor: "#75d7ff", opacity: 0.42 },
      wireframe: { color: "#8ce8ff", opacity: 0.96 },
    },
  },
  {
    id: "dark-viewer",
    name: "Dark Viewer",
    settings: {
      renderMode: "textured",
      background: { color: "#111418", transparent: false },
      grid: { enabled: true, mode: "infinite", color: "#3e4651", centerColor: "#99a4b3", opacity: 0.38 },
      wireframe: { color: "#f8fafc", opacity: 0.86 },
    },
  },
  {
    id: "transparent-asset",
    name: "Transparent Asset",
    settings: {
      renderMode: "solid",
      background: { color: "#ffffff", transparent: true },
      grid: { enabled: false, mode: "finite", color: "#b8c0cc", centerColor: "#677083", opacity: 0.2 },
      wireframe: { color: "#111827", opacity: 0.9 },
    },
  },
] as const
