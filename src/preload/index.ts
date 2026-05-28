import { contextBridge, ipcRenderer } from "electron"
import type { PreviewStudioBridge, SaveBinaryPayload, SaveDataUrlPayload, SaveMp4FromWebmPayload } from "../shared/ipcTypes.js"

const bridge: PreviewStudioBridge = {
  openFiles: () => ipcRenderer.invoke("dialog:openFiles"),
  saveDataUrl: (payload: SaveDataUrlPayload) => ipcRenderer.invoke("file:saveDataUrl", payload),
  saveBinary: (payload: SaveBinaryPayload) => ipcRenderer.invoke("file:saveBinary", payload),
  saveMp4FromWebm: (payload: SaveMp4FromWebmPayload) => ipcRenderer.invoke("video:saveMp4FromWebm", payload),
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
}

contextBridge.exposeInMainWorld("previewStudio", bridge)
