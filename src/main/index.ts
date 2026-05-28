import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron"
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)
const bundledFfmpegPath = require("ffmpeg-static") as string | null

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: "3D Preview Studio",
    backgroundColor: "#111418",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  })

  window.once("ready-to-show", () => {
    window.show()
  })

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL)
    window.webContents.openDevTools({ mode: "detach" })
  } else {
    window.loadFile(path.join(__dirname, "../renderer/index.html"))
  }

  return window
}

function setupMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }],
    },
    {
      label: "File",
      submenu: [
        { role: "close" },
      ],
    },
    {
      label: "View",
      submenu: [{ role: "reload" }, { role: "toggleDevTools" }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

async function readPickedFile(filePath: string) {
  const data = await fs.readFile(filePath)
  const stat = await fs.stat(filePath)
  const extension = path.extname(filePath).replace(".", "").toLowerCase()

  return {
    name: path.basename(filePath),
    path: filePath,
    extension,
    size: stat.size,
    data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
  }
}

function dataUrlToBuffer(dataUrl: string) {
  const base64 = dataUrl.split(",")[1]
  if (!base64) {
    throw new Error("Invalid data URL")
  }
  return Buffer.from(base64, "base64")
}

function getFfmpegPath() {
  const fallback = "ffmpeg"
  if (!bundledFfmpegPath) return fallback
  return bundledFfmpegPath.replace("app.asar", "app.asar.unpacked")
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(getFfmpegPath(), args, {
      windowsHide: true,
    })
    let stderr = ""

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })

    child.on("error", (error) => {
      reject(error)
    })

    child.on("close", (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`))
    })
  })
}

function setupIpc() {
  ipcMain.handle("dialog:openFiles", async () => {
    const result = await dialog.showOpenDialog({
      title: "Open 3D assets",
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "3D assets",
          extensions: ["obj", "mtl", "png", "jpg", "jpeg", "webp", "glb", "gltf", "bin", "stl"],
        },
        { name: "All files", extensions: ["*"] },
      ],
    })

    if (result.canceled) return []
    return Promise.all(result.filePaths.map(readPickedFile))
  })

  ipcMain.handle("file:saveDataUrl", async (_event, payload: { defaultPath: string; dataUrl: string; filters?: Electron.FileFilter[] }) => {
    const result = await dialog.showSaveDialog({
      title: "Save file",
      defaultPath: payload.defaultPath,
      filters: payload.filters,
    })

    if (result.canceled || !result.filePath) return { canceled: true }
    await fs.writeFile(result.filePath, dataUrlToBuffer(payload.dataUrl))
    return { canceled: false, filePath: result.filePath }
  })

  ipcMain.handle("file:saveBinary", async (_event, payload: { defaultPath: string; data: ArrayBuffer; filters?: Electron.FileFilter[] }) => {
    const result = await dialog.showSaveDialog({
      title: "Save file",
      defaultPath: payload.defaultPath,
      filters: payload.filters,
    })

    if (result.canceled || !result.filePath) return { canceled: true }
    await fs.writeFile(result.filePath, Buffer.from(payload.data))
    return { canceled: false, filePath: result.filePath }
  })

  ipcMain.handle("video:saveMp4FromWebm", async (_event, payload: { defaultPath: string; webmData: ArrayBuffer; filters?: Electron.FileFilter[] }) => {
    const result = await dialog.showSaveDialog({
      title: "Save MP4 video",
      defaultPath: payload.defaultPath,
      filters: payload.filters ?? [{ name: "MP4 Video", extensions: ["mp4"] }],
    })

    if (result.canceled || !result.filePath) return { canceled: true }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "3d-preview-studio-"))
    const inputPath = path.join(tempDir, "capture.webm")

    try {
      await fs.writeFile(inputPath, Buffer.from(payload.webmData))
      await runFfmpeg([
        "-y",
        "-i",
        inputPath,
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-crf",
        "16",
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        result.filePath,
      ])
      return { canceled: false, filePath: result.filePath }
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  ipcMain.handle("app:getVersion", () => app.getVersion())
}

app.whenReady().then(() => {
  app.name = "3D Preview Studio"
  setupIpc()
  setupMenu()
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
