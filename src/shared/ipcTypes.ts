export type PickedFile = {
  name: string
  path: string
  extension: string
  size: number
  data: ArrayBuffer
}

export type SaveDialogFilter = {
  name: string
  extensions: string[]
}

export type SaveDataUrlPayload = {
  defaultPath: string
  dataUrl: string
  filters?: SaveDialogFilter[]
}

export type SaveBinaryPayload = {
  defaultPath: string
  data: ArrayBuffer
  filters?: SaveDialogFilter[]
}

export type SaveMp4FromWebmPayload = {
  defaultPath: string
  webmData: ArrayBuffer
  filters?: SaveDialogFilter[]
}

export type PreviewStudioBridge = {
  openFiles: () => Promise<PickedFile[]>
  openFolder: () => Promise<PickedFile[]>
  saveDataUrl: (payload: SaveDataUrlPayload) => Promise<{ canceled: boolean; filePath?: string }>
  saveBinary: (payload: SaveBinaryPayload) => Promise<{ canceled: boolean; filePath?: string }>
  saveMp4FromWebm: (payload: SaveMp4FromWebmPayload) => Promise<{ canceled: boolean; filePath?: string }>
  getVersion: () => Promise<string>
}
