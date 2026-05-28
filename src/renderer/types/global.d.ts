import type { PreviewStudioBridge } from "../../shared/ipcTypes"

declare global {
  interface Window {
    previewStudio?: PreviewStudioBridge
  }
}

export {}
