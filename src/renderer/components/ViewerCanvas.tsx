import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import type { ImageExportSettings, ProjectionView, VideoExportSettings, ViewerSettings } from "../../core/types"
import {
  applyBackground,
  applyModelOffset,
  applyProjectionCamera,
  applyViewerSettings,
  createGrid,
  disposeObject,
  prepareObjectForDisplay,
  updateTurntableCamera,
} from "../../core/threeScene"

export type ViewerCanvasHandle = {
  exportPng: (settings: ImageExportSettings) => Promise<string>
  renderExportPreview: (settings: ImageExportSettings) => Promise<string>
  renderVideoPreview: (settings: VideoExportSettings) => Promise<string>
  exportWebm: (settings: VideoExportSettings) => Promise<ArrayBuffer>
  resetView: () => void
}

type ViewerCanvasProps = {
  modelObject: THREE.Object3D | null
  settings: ViewerSettings
  isDragActive: boolean
  onUserCameraMove?: (view: ProjectionView) => void
}

function createRenderer(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  return renderer
}

function blobToArrayBuffer(blob: Blob) {
  return blob.arrayBuffer()
}

function waitForAnimationFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

function waitForMilliseconds(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

const ViewerCanvas = forwardRef<ViewerCanvasHandle, ViewerCanvasProps>(({ modelObject, settings, isDragActive, onUserCameraMove }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const objectRef = useRef<THREE.Object3D | null>(null)
  const gridRef = useRef<THREE.GridHelper | null>(null)
  const settingsRef = useRef(settings)
  const renderLockRef = useRef(false)
  const pointerInteractionRef = useRef(false)
  const skipNextFitRef = useRef(false)

  settingsRef.current = settings

  const renderNow = () => {
    const renderer = rendererRef.current
    const scene = sceneRef.current
    const camera = cameraRef.current
    if (!renderer || !scene || !camera) return
    renderer.render(scene, camera)
  }

  const beginExclusiveRender = () => {
    const controls = controlsRef.current
    const previousControlsEnabled = controls?.enabled ?? true
    renderLockRef.current = true
    if (controls) controls.enabled = false
    return () => {
      if (controls) controls.enabled = previousControlsEnabled
      renderLockRef.current = false
    }
  }

  const disposeGrid = (grid: THREE.GridHelper | null) => {
    if (!grid) return
    grid.geometry.dispose()
    if (Array.isArray(grid.material)) {
      grid.material.forEach((material) => material.dispose())
    } else {
      grid.material.dispose()
    }
  }

  const replaceGrid = (nextGrid: THREE.GridHelper | null, options: { disposeCurrent?: boolean } = {}) => {
    const scene = sceneRef.current
    if (!scene) return
    const disposeCurrent = options.disposeCurrent ?? true
    if (gridRef.current) {
      scene.remove(gridRef.current)
      if (disposeCurrent) disposeGrid(gridRef.current)
    }
    gridRef.current = nextGrid
    if (nextGrid) scene.add(nextGrid)
  }

  const fitCamera = () => {
    const renderer = rendererRef.current
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!renderer || !camera || !controls) return

    const size = new THREE.Vector2()
    renderer.getSize(size)
    const aspect = size.x / Math.max(size.y, 1)
    applyProjectionCamera(camera, settingsRef.current.camera.view, objectRef.current, aspect, settingsRef.current.camera.zoom)
    controls.target.set(0, 0, 0)
    controls.update()
    renderNow()
  }

  const captureCameraPose = () => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return null
    return {
      position: camera.position.clone(),
      target: controls.target.clone(),
      up: camera.up.clone(),
    }
  }

  const applyPoseCamera = (
    camera: THREE.OrthographicCamera,
    pose: ReturnType<typeof captureCameraPose>,
    aspect: number,
    zoom: number,
    fitScale = 1.58,
  ) => {
    if (!pose) {
      applyProjectionCamera(camera, settingsRef.current.camera.view, objectRef.current, aspect, zoom)
      return
    }

    const box = new THREE.Box3().setFromObject(objectRef.current ?? new THREE.Object3D())
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxSize = Math.max(size.x, size.y, size.z, 1)
    const direction = pose.position.clone().sub(pose.target).normalize()
    const distance = maxSize * 3
    const fitSize = maxSize * fitScale

    camera.left = (-fitSize * aspect) / 2
    camera.right = (fitSize * aspect) / 2
    camera.top = fitSize / 2
    camera.bottom = -fitSize / 2
    camera.near = -distance * 4
    camera.far = distance * 4
    camera.zoom = zoom
    camera.position.copy(center).add(direction.multiplyScalar(distance))
    camera.up.copy(pose.up)
    camera.lookAt(center)
    camera.updateProjectionMatrix()
  }

  const applyExportCamera = (camera: THREE.OrthographicCamera, aspect: number, zoom: number, pose: ReturnType<typeof captureCameraPose>) => {
    if (settingsRef.current.camera.view === "isometric" || settingsRef.current.camera.view === "custom") {
      applyPoseCamera(camera, pose, aspect, zoom)
      return
    }
    applyProjectionCamera(camera, settingsRef.current.camera.view, objectRef.current, aspect, zoom)
  }

  const restoreCameraPose = (pose: ReturnType<typeof captureCameraPose>) => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls || !pose) {
      fitCamera()
      return
    }

    camera.position.copy(pose.position)
    camera.up.copy(pose.up)
    controls.target.copy(pose.target)
    camera.updateProjectionMatrix()
    controls.update()
    renderNow()
  }

  const renderStillDataUrl = async (exportSettings: ImageExportSettings, previewMode = false) => {
    const renderer = rendererRef.current
    const scene = sceneRef.current
    const camera = cameraRef.current
    if (!renderer || !scene || !camera) throw new Error("Viewer is not ready.")

    const pose = captureCameraPose()
    const originalSize = new THREE.Vector2()
    renderer.getSize(originalSize)
    const originalPixelRatio = renderer.getPixelRatio()
    const originalBackground = settingsRef.current.background
    const originalGrid = gridRef.current

    try {
      renderer.setPixelRatio(previewMode ? 1 : Math.min(window.devicePixelRatio, 2))
      renderer.setSize(exportSettings.width, exportSettings.height, false)
      applyExportCamera(camera, exportSettings.width / exportSettings.height, settingsRef.current.camera.zoom, pose)
      replaceGrid(createGrid(settingsRef.current.grid, { modelObject: objectRef.current, forceVisible: exportSettings.includeGrid }), { disposeCurrent: false })
      applyBackground(renderer, scene, { ...originalBackground, transparent: exportSettings.transparent })
      renderer.render(scene, camera)
      return renderer.domElement.toDataURL("image/png")
    } finally {
      replaceGrid(originalGrid)
      renderer.setPixelRatio(originalPixelRatio)
      renderer.setSize(originalSize.x, originalSize.y, false)
      applyBackground(renderer, scene, originalBackground)
      restoreCameraPose(pose)
    }
  }

  useImperativeHandle(ref, () => ({
    async exportPng(exportSettings) {
      return renderStillDataUrl(exportSettings)
    },

    async renderExportPreview(exportSettings) {
      const previewSettings = {
        ...exportSettings,
        width: Math.min(exportSettings.width, 900),
        height: Math.max(240, Math.round((Math.min(exportSettings.width, 900) / exportSettings.width) * exportSettings.height)),
      }
      return renderStillDataUrl(previewSettings, true)
    },

    async renderVideoPreview(videoPreviewSettings) {
      const renderer = rendererRef.current
      const scene = sceneRef.current
      const camera = cameraRef.current
      if (!renderer || !scene || !camera) throw new Error("Viewer is not ready.")

      const pose = captureCameraPose()
      const originalSize = new THREE.Vector2()
      renderer.getSize(originalSize)
      const originalPixelRatio = renderer.getPixelRatio()
      const originalBackground = settingsRef.current.background
      const originalGrid = gridRef.current
      const previewWidth = Math.min(videoPreviewSettings.width, 900)
      const previewHeight = Math.max(240, Math.round((previewWidth / videoPreviewSettings.width) * videoPreviewSettings.height))

      try {
        renderer.setPixelRatio(1)
        renderer.setSize(previewWidth, previewHeight, false)
        replaceGrid(
          createGrid(settingsRef.current.grid, {
            modelObject: objectRef.current,
            forceVisible: videoPreviewSettings.includeGrid,
            forceInfinite: videoPreviewSettings.cameraAngle === "high-oblique",
          }),
          { disposeCurrent: false },
        )
        applyBackground(renderer, scene, originalBackground)
        updateTurntableCamera(camera, objectRef.current, 0, previewWidth / previewHeight, settingsRef.current.camera.zoom, {
          rotations: videoPreviewSettings.rotations,
          cameraAngle: videoPreviewSettings.cameraAngle,
          currentPose: pose,
        })
        renderer.render(scene, camera)
        return renderer.domElement.toDataURL("image/png")
      } finally {
        replaceGrid(originalGrid)
        renderer.setPixelRatio(originalPixelRatio)
        renderer.setSize(originalSize.x, originalSize.y, false)
        applyBackground(renderer, scene, originalBackground)
        restoreCameraPose(pose)
      }
    },

    async exportWebm(exportSettings) {
      const renderer = rendererRef.current
      const scene = sceneRef.current
      const camera = cameraRef.current
      if (!renderer || !scene || !camera) throw new Error("Viewer is not ready.")
      if (!("MediaRecorder" in window)) throw new Error("MediaRecorder is not available in this runtime.")
      const releaseRender = beginExclusiveRender()

      const originalSize = new THREE.Vector2()
      renderer.getSize(originalSize)
      const originalPixelRatio = renderer.getPixelRatio()
      const pose = captureCameraPose()
      const originalGrid = gridRef.current
      const originalBackground = settingsRef.current.background
      const chunks: BlobPart[] = []
      let stream: MediaStream | null = null
      let restored = false

      try {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setSize(exportSettings.width, exportSettings.height, false)
        replaceGrid(
          createGrid(settingsRef.current.grid, {
            modelObject: objectRef.current,
            forceVisible: exportSettings.includeGrid,
            forceInfinite: exportSettings.cameraAngle === "high-oblique",
          }),
          { disposeCurrent: false },
        )

        stream = renderer.domElement.captureStream(exportSettings.fps)
        const mimeType = MediaRecorder.isTypeSupported("video/webm; codecs=vp9")
          ? "video/webm; codecs=vp9"
          : MediaRecorder.isTypeSupported("video/webm; codecs=vp8")
            ? "video/webm; codecs=vp8"
            : "video/webm"
        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: Math.round(exportSettings.bitrateMbps * 1_000_000),
        })
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data)
        }

        const stopped = new Promise<Blob>((resolve, reject) => {
          recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }))
          recorder.onerror = () => reject(new Error("Video recording failed."))
        })

        recorder.start()
        const totalDuration = exportSettings.duration * Math.max(exportSettings.rotations, 0.25)
        const totalFrames = Math.max(2, Math.round(exportSettings.fps * totalDuration))
        const startedAt = performance.now()

        for (let frame = 0; frame < totalFrames; frame += 1) {
          const progress = frame / (totalFrames - 1)
          updateTurntableCamera(camera, objectRef.current, progress, exportSettings.width / exportSettings.height, settingsRef.current.camera.zoom, {
            rotations: exportSettings.rotations,
            cameraAngle: exportSettings.cameraAngle,
            currentPose: pose,
          })
          renderer.render(scene, camera)
          await waitForAnimationFrame()

          if (frame < totalFrames - 1) {
            const nextFrameAt = startedAt + ((frame + 1) * 1000) / exportSettings.fps
            await waitForMilliseconds(Math.max(0, nextFrameAt - performance.now()))
          }
        }

        await waitForMilliseconds(Math.max(0, startedAt + totalDuration * 1000 - performance.now()))
        recorder.stop()
        const blob = await stopped

        renderer.setPixelRatio(originalPixelRatio)
        renderer.setSize(originalSize.x, originalSize.y, false)
        replaceGrid(originalGrid)
        applyBackground(renderer, scene, originalBackground)
        restoreCameraPose(pose)
        restored = true

        return blobToArrayBuffer(blob)
      } finally {
        if (!restored) {
          renderer.setPixelRatio(originalPixelRatio)
          renderer.setSize(originalSize.x, originalSize.y, false)
          replaceGrid(originalGrid)
          applyBackground(renderer, scene, originalBackground)
          restoreCameraPose(pose)
        }
        stream?.getTracks().forEach((track) => track.stop())
        releaseRender()
      }
    },

    resetView() {
      fitCamera()
    },
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return undefined

    const renderer = createRenderer(canvas)
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 1000)
    const controls = new OrbitControls(camera, renderer.domElement)

    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.screenSpacePanning = true

    const handlePointerDown = () => {
      pointerInteractionRef.current = true
    }

    const handlePointerEnd = () => {
      pointerInteractionRef.current = false
    }

    const handleControlStart = () => {
      const currentView = settingsRef.current.camera.view
      if (!pointerInteractionRef.current || currentView === "isometric" || currentView === "custom") return
      skipNextFitRef.current = true
      onUserCameraMove?.("isometric")
    }

    renderer.domElement.addEventListener("pointerdown", handlePointerDown)
    window.addEventListener("pointerup", handlePointerEnd)
    window.addEventListener("pointercancel", handlePointerEnd)
    controls.addEventListener("start", handleControlStart)

    const hemiLight = new THREE.HemisphereLight("#f8fbff", "#5c6675", 1.5)
    const keyLight = new THREE.DirectionalLight("#ffffff", 2.2)
    keyLight.position.set(4, 8, 5)
    keyLight.castShadow = true
    scene.add(hemiLight, keyLight)

    rendererRef.current = renderer
    sceneRef.current = scene
    cameraRef.current = camera
    controlsRef.current = controls

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      const width = Math.max(1, Math.floor(entry.contentRect.width))
      const height = Math.max(1, Math.floor(entry.contentRect.height))
      renderer.setSize(width, height, false)
      fitCamera()
    })

    resizeObserver.observe(container)

    let rafId = 0
    const animate = () => {
      rafId = requestAnimationFrame(animate)
      if (!renderLockRef.current) {
        controls.update()
        renderer.render(scene, camera)
      }
    }
    animate()

    return () => {
      cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown)
      window.removeEventListener("pointerup", handlePointerEnd)
      window.removeEventListener("pointercancel", handlePointerEnd)
      controls.removeEventListener("start", handleControlStart)
      controls.dispose()
      disposeObject(objectRef.current)
      disposeGrid(gridRef.current)
      renderer.dispose()
    }
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    if (objectRef.current) {
      scene.remove(objectRef.current)
      disposeObject(objectRef.current)
      objectRef.current = null
    }

    if (modelObject) {
      prepareObjectForDisplay(modelObject)
      modelObject.userData.previewStudioBasePosition = modelObject.position.clone()
      objectRef.current = modelObject
      applyModelOffset(modelObject, settings.model)
      scene.add(modelObject)
      applyViewerSettings(modelObject, settings)
      fitCamera()
    }
  }, [modelObject])

  useEffect(() => {
    const renderer = rendererRef.current
    const scene = sceneRef.current
    if (!renderer || !scene) return

    applyBackground(renderer, scene, settings.background)
    applyViewerSettings(objectRef.current, settings)
    applyModelOffset(objectRef.current, settings.model)

    replaceGrid(createGrid(settings.grid, { modelObject: objectRef.current }))
    if (skipNextFitRef.current) {
      skipNextFitRef.current = false
      renderNow()
    } else {
      fitCamera()
    }
  }, [settings])

  return (
    <div ref={containerRef} className={`viewer-canvas ${isDragActive ? "is-drag-active" : ""}`}>
      <canvas ref={canvasRef} />
      {!modelObject && (
        <div className="empty-viewer">
          <div className="empty-viewer__title">3Dファイルをドロップ</div>
          <div className="empty-viewer__body">OBJ / MTL / 画像 / GLB / GLTF / STL を追加できます</div>
        </div>
      )}
      <div className="viewport-badge">{settings.camera.view.toUpperCase()}</div>
    </div>
  )
})

ViewerCanvas.displayName = "ViewerCanvas"

export default ViewerCanvas
