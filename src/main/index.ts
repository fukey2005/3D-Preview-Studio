import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron"
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { importableAssetExtensions } from "../shared/supportedFormats.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)
const bundledFfmpegPath = require("ffmpeg-static") as string | null
const importableAssetExtensionSet = new Set<string>(importableAssetExtensions)

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

async function collectSupportedFiles(directoryPath: string): Promise<Awaited<ReturnType<typeof readPickedFile>>[]> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directoryPath, entry.name)
      if (entry.isDirectory()) return collectSupportedFiles(entryPath)
      if (!entry.isFile()) return []

      const extension = path.extname(entryPath).replace(".", "").toLowerCase()
      if (!importableAssetExtensionSet.has(extension)) return []
      return [await readPickedFile(entryPath)]
    }),
  )

  return files.flat()
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

function arrayBufferFromBuffer(data: Buffer) {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
}

function runProcess(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
    })
    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk)
    })

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })

    child.on("error", (error) => {
      reject(error)
    })

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }
      reject(new Error(stderr.trim() || stdout.trim() || `${command} exited with code ${code}`))
    })
  })
}

function runFfmpeg(args: string[]) {
  return runProcess(getFfmpegPath(), args).then(() => undefined)
}

async function existingFile(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function collectMacBlenderCandidates() {
  const roots = ["/Applications", path.join(os.homedir(), "Applications")]
  const candidates: string[] = []

  for (const root of roots) {
    let entries: import("node:fs").Dirent[]
    try {
      entries = await fs.readdir(root, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || !/^Blender.*\.app$/i.test(entry.name)) continue
      candidates.push(path.join(root, entry.name, "Contents/MacOS/Blender"))
    }
  }

  return candidates
}

async function collectWindowsBlenderCandidates() {
  const roots = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA].filter(Boolean) as string[]
  const candidates: string[] = []

  for (const root of roots) {
    const blenderRoot = path.join(root, "Blender Foundation")
    let entries: import("node:fs").Dirent[]
    try {
      entries = await fs.readdir(blenderRoot, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || !/^Blender/i.test(entry.name)) continue
      candidates.push(path.join(blenderRoot, entry.name, "blender.exe"))
    }
  }

  return candidates
}

async function blenderCandidates() {
  const configured = process.env.BLENDER_PATH ? [process.env.BLENDER_PATH] : []
  const platformCandidates =
    process.platform === "darwin"
      ? await collectMacBlenderCandidates()
      : process.platform === "win32"
        ? await collectWindowsBlenderCandidates()
        : ["/usr/local/bin/blender", "/usr/bin/blender", "/snap/bin/blender", "blender"]

  return [...configured, ...platformCandidates, "blender"].filter((candidate, index, all) => candidate && all.indexOf(candidate) === index)
}

function safeTempBlendName(name?: string) {
  const base = name ? path.basename(name) : "input.blend"
  const withoutControlChars = base.replace(/[\x00-\x1f\x7f]/g, "")
  return withoutControlChars.toLowerCase().endsWith(".blend") ? withoutControlChars : `${withoutControlChars || "input"}.blend`
}

async function resolveBlendInputPath(payload: { filePath?: string; name?: string; data?: ArrayBuffer }, tempDir: string) {
  if (payload.filePath && path.isAbsolute(payload.filePath) && (await existingFile(payload.filePath))) {
    return payload.filePath
  }

  if (payload.data) {
    const inputPath = path.join(tempDir, safeTempBlendName(payload.name ?? payload.filePath))
    await fs.writeFile(inputPath, Buffer.from(payload.data))
    return inputPath
  }

  if (payload.filePath) {
    throw new Error(`BLENDファイルが見つかりません: ${payload.filePath}`)
  }

  throw new Error("BLEND変換に必要なファイル情報を取得できませんでした。")
}

async function convertBlendToGlb(payload: { filePath?: string; name?: string; data?: ArrayBuffer }) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "3d-preview-studio-blend-"))
  const outputPath = path.join(tempDir, "converted.glb")
  const python = [
    "import bpy",
    `output_path = ${JSON.stringify(outputPath)}`,
    "bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB')",
  ].join("; ")

  try {
    const inputPath = await resolveBlendInputPath(payload, tempDir)
    let notFound = true
    let lastError: unknown

    for (const candidate of await blenderCandidates()) {
      if (path.isAbsolute(candidate) && !(await existingFile(candidate))) continue

      try {
        await runProcess(candidate, ["--background", inputPath, "--python-expr", python])
        notFound = false
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code === "ENOENT") continue
        notFound = false
        lastError = error
        break
      }

      try {
        const data = await fs.readFile(outputPath)
        return arrayBufferFromBuffer(data)
      } catch (error) {
        lastError = error
        break
      }
    }

    if (notFound) {
      throw new Error("Blenderの実行ファイルが見つかりません。Blenderをインストールするか、BLENDER_PATHに実行ファイルのパスを設定してください。")
    }

    const detail = lastError instanceof Error ? lastError.message : "BlenderによるGLB変換に失敗しました。"
    throw new Error(detail)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

function setupIpc() {
  ipcMain.handle("dialog:openFiles", async () => {
    const result = await dialog.showOpenDialog({
      title: "Open 3D assets",
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "3D assets",
          extensions: [...importableAssetExtensions],
        },
        { name: "All files", extensions: ["*"] },
      ],
    })

    if (result.canceled) return []
    return Promise.all(result.filePaths.map(readPickedFile))
  })

  ipcMain.handle("dialog:openFolder", async () => {
    const result = await dialog.showOpenDialog({
      title: "Open 3D asset folder",
      properties: ["openDirectory", "multiSelections"],
    })

    if (result.canceled) return []
    const files = await Promise.all(result.filePaths.map(collectSupportedFiles))
    return files.flat()
  })

  ipcMain.handle("blend:convertToGlb", async (_event, payload: { filePath?: string; name?: string; data?: ArrayBuffer }) => {
    const data = await convertBlendToGlb(payload)
    return { data }
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
