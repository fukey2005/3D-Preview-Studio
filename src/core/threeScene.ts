import * as THREE from "three"
import type { ProjectionView, TurntableCameraAngle, ViewerSettings } from "./types"

type OriginalMaterialRecord = {
  original: THREE.Material | THREE.Material[]
}

function materialArray(material: THREE.Material | THREE.Material[]) {
  return Array.isArray(material) ? material : [material]
}

function cloneWithoutTextures(material: THREE.Material) {
  const color = "color" in material && material.color instanceof THREE.Color ? material.color : new THREE.Color("#d8dee8")
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.74,
    metalness: 0.03,
  })
}

function solidMaterial() {
  return new THREE.MeshStandardMaterial({
    color: "#d9dee7",
    roughness: 0.82,
    metalness: 0.02,
  })
}

function blueprintMaterial() {
  return new THREE.MeshBasicMaterial({
    color: "#0b2844",
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  })
}

function invisibleMaterial() {
  return new THREE.MeshBasicMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
}

function ensureWireframe(mesh: THREE.Mesh, settings: ViewerSettings) {
  const existing = mesh.children.find((child) => child.userData.previewStudioRole === "wireframe") as THREE.LineSegments | undefined
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(settings.wireframe.color),
    transparent: true,
    opacity: settings.wireframe.opacity,
  })

  if (existing) {
    const oldMaterial = existing.material
    existing.material = material
    if (oldMaterial instanceof THREE.Material) oldMaterial.dispose()
    return existing
  }

  const edges = new THREE.EdgesGeometry(mesh.geometry)
  const line = new THREE.LineSegments(edges, material)
  line.userData.previewStudioRole = "wireframe"
  mesh.add(line)
  return line
}

export function prepareObjectForDisplay(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.castShadow = true
    child.receiveShadow = true
    child.userData.previewStudioOriginalMaterial = {
      original: child.material,
    } satisfies OriginalMaterialRecord
  })
}

export function applyViewerSettings(object: THREE.Object3D | null, settings: ViewerSettings) {
  if (!object) return

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const record = child.userData.previewStudioOriginalMaterial as OriginalMaterialRecord | undefined
    const original = record?.original ?? child.material
    const wireframe = ensureWireframe(child, settings)
    const showWireframe = settings.renderMode === "wireframe" || settings.renderMode === "blueprint" || settings.wireframeOverlayEnabled

    wireframe.visible = showWireframe

    if (settings.renderMode === "wireframe") {
      child.material = invisibleMaterial()
      child.visible = true
      return
    }

    if (settings.renderMode === "blueprint") {
      child.material = blueprintMaterial()
      child.visible = true
      return
    }

    if (settings.renderMode === "solid") {
      child.material = solidMaterial()
      child.visible = true
      return
    }

    child.material = settings.textureEnabled
      ? original
      : Array.isArray(original)
        ? materialArray(original).map(cloneWithoutTextures)
        : cloneWithoutTextures(original)
    child.visible = true
  })
}

export function createGrid(
  settings: ViewerSettings["grid"],
  options: {
    modelObject?: THREE.Object3D | null
    forceVisible?: boolean
    forceInfinite?: boolean
  } = {},
) {
  const { maxSize } = getObjectSize(options.modelObject ?? null)
  const infinite = settings.mode === "infinite" || options.forceInfinite
  const gridSize = infinite ? Math.max(settings.size * 48, maxSize * 18, 240) : settings.size
  const divisions = infinite ? Math.min(Math.max(settings.divisions * 24, Math.round(gridSize / 2)), 720) : settings.divisions
  const grid = new THREE.GridHelper(gridSize, divisions, new THREE.Color(settings.centerColor), new THREE.Color(settings.color))
  grid.material.transparent = true
  grid.material.opacity = settings.opacity
  grid.visible = options.forceVisible ?? settings.enabled
  grid.name = "PreviewGrid"
  grid.position.y = settings.height
  grid.userData.previewStudioGridMode = infinite ? "infinite" : "finite"
  return grid
}

export function applyBackground(renderer: THREE.WebGLRenderer, scene: THREE.Scene, settings: ViewerSettings["background"]) {
  if (settings.transparent) {
    scene.background = null
    renderer.setClearColor(0x000000, 0)
    return
  }

  const color = new THREE.Color(settings.color)
  scene.background = color
  renderer.setClearColor(color, 1)
}

export function getObjectSize(object: THREE.Object3D | null) {
  if (!object) return { center: new THREE.Vector3(0, 0, 0), size: new THREE.Vector3(2, 2, 2), maxSize: 2 }
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const basePosition = object.userData.previewStudioBasePosition as THREE.Vector3 | undefined
  if (basePosition) {
    const offset = object.position.clone().sub(basePosition)
    center.sub(offset)
    size.x += Math.abs(offset.x) * 2
    size.y += Math.abs(offset.y) * 2
    size.z += Math.abs(offset.z) * 2
  }
  const maxSize = Math.max(size.x, size.y, size.z, 1)
  return { center, size, maxSize }
}

export function applyProjectionCamera(camera: THREE.OrthographicCamera, view: ProjectionView, object: THREE.Object3D | null, aspect: number, zoom: number) {
  const { center, maxSize } = getObjectSize(object)
  const distance = maxSize * 3
  const fitSize = maxSize * 1.42
  camera.left = (-fitSize * aspect) / 2
  camera.right = (fitSize * aspect) / 2
  camera.top = fitSize / 2
  camera.bottom = -fitSize / 2
  camera.near = -distance * 4
  camera.far = distance * 4
  camera.zoom = zoom

  switch (view) {
    case "top":
      camera.position.set(center.x, center.y + distance, center.z)
      camera.up.set(0, 0, -1)
      break
    case "front":
      camera.position.set(center.x, center.y, center.z + distance)
      camera.up.set(0, 1, 0)
      break
    case "side":
      camera.position.set(center.x + distance, center.y, center.z)
      camera.up.set(0, 1, 0)
      break
    case "custom":
    case "isometric":
      camera.position.set(center.x + distance * 0.85, center.y + distance * 0.55, center.z + distance * 0.85)
      camera.up.set(0, 1, 0)
      break
  }

  camera.lookAt(center)
  camera.updateProjectionMatrix()
}

export function updateTurntableCamera(
  camera: THREE.OrthographicCamera,
  object: THREE.Object3D | null,
  progress: number,
  aspect: number,
  zoom: number,
  options: {
    rotations?: number
    cameraAngle?: TurntableCameraAngle
    currentPose?: {
      position: THREE.Vector3
      target: THREE.Vector3
      up: THREE.Vector3
    } | null
  } = {},
) {
  const { center, maxSize } = getObjectSize(object)
  const highOblique = options.cameraAngle === "high-oblique"
  const distance = maxSize * (highOblique ? 3.55 : 3)
  const fitSize = maxSize * (highOblique ? 1.95 : 1.5)
  const rotations = Math.max(options.rotations ?? 1, 0.1)
  const angle = progress * Math.PI * 2 * rotations
  const poseDirection = options.currentPose?.position.clone().sub(options.currentPose.target).normalize()
  const basePhase = poseDirection ? Math.atan2(poseDirection.x, poseDirection.z) : 0
  const orbitAngle = basePhase + angle
  const currentYRatio = poseDirection ? THREE.MathUtils.clamp(poseDirection.y, -0.2, 0.82) : 0.18
  const currentHorizontalRatio = Math.sqrt(Math.max(0.05, 1 - currentYRatio * currentYRatio))

  camera.left = (-fitSize * aspect) / 2
  camera.right = (fitSize * aspect) / 2
  camera.top = fitSize / 2
  camera.bottom = -fitSize / 2
  camera.near = -distance * 4
  camera.far = distance * 4
  camera.zoom = zoom
  camera.position.set(
    center.x + Math.sin(orbitAngle) * distance * (highOblique ? 1 : currentHorizontalRatio),
    center.y + (highOblique ? maxSize * 1.22 : currentYRatio * distance),
    center.z + Math.cos(orbitAngle) * distance * (highOblique ? 1 : currentHorizontalRatio),
  )
  camera.up.copy(options.currentPose?.up ?? new THREE.Vector3(0, 1, 0))
  camera.lookAt(center)
  camera.updateProjectionMatrix()
}

export function applyModelOffset(object: THREE.Object3D | null, settings: ViewerSettings["model"]) {
  if (!object) return
  const basePosition = object.userData.previewStudioBasePosition as THREE.Vector3 | undefined
  if (!basePosition) {
    object.userData.previewStudioBasePosition = object.position.clone()
  }
  const base = (object.userData.previewStudioBasePosition as THREE.Vector3 | undefined) ?? new THREE.Vector3()
  object.position.set(base.x + settings.offsetX, base.y + settings.offsetY, base.z + settings.offsetZ)
}

export function disposeObject(object: THREE.Object3D | null) {
  if (!object) return

  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose()
      for (const material of materialArray(child.material)) {
        material.dispose()
      }
    }

    if (child instanceof THREE.LineSegments) {
      child.geometry?.dispose()
      if (child.material instanceof THREE.Material) child.material.dispose()
    }
  })
}
