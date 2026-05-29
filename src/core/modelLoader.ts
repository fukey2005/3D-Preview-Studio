import * as THREE from "three"
import occtImportJs, { type OcctImportModule, type OcctMesh } from "occt-import-js"
import {
  evaluateAllMeshes,
  extractMaterials,
  extractMeshes,
  extractObjects,
  OB_TYPE,
  parseBlend,
  type Material as BlendMaterial,
  type Mesh as BlendMesh,
  type SceneObject as BlendSceneObject,
} from "jsblender"
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader.js"
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js"
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js"
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js"
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js"
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js"
import { USDLoader } from "three/examples/jsm/loaders/USDLoader.js"
import occtWasmUrl from "occt-import-js/dist/occt-import-js.wasm?url"
import { binaryExtensions, materialExtensions, textureExtensions } from "../shared/supportedFormats"
import { extractFbxTextureLinks, type FbxTextureLink } from "./fbxTextureLinks"
import type { AssetFile, LoadedModel, MissingAsset, ModelStats } from "./types"
import { baseName, baseNameWithoutExtension, extensionFromPath, matchAssetByPath, normalizeAssetPath } from "./pathMatcher"

let occtModulePromise: Promise<OcctImportModule> | null = null
const textureExtensionSet = new Set<string>(textureExtensions)
const browserTextureExtensions = new Set(["png", "jpg", "jpeg", "webp", "bmp", "gif"])
const binaryExtensionSet = new Set<string>(binaryExtensions)
const materialExtensionSet = new Set<string>(materialExtensions)

function collectObjMaterialRefs(text: string) {
  return Array.from(text.matchAll(/^\s*mtllib\s+(.+)$/gim)).map((match) => match[1]?.trim()).filter(Boolean) as string[]
}

function collectMtlTextureRefs(text: string) {
  const refs: string[] = []
  for (const match of text.matchAll(/^\s*map_(?:Kd|Ks|Ka|Bump|d|Ns)\s+(.+)$/gim)) {
    const raw = match[1]?.trim()
    if (!raw) continue
    const tokens = raw.split(/\s+/)
    refs.push(tokens[tokens.length - 1])
  }
  return refs
}

function collectGltfExternalRefs(text: string) {
  try {
    const json = JSON.parse(text) as {
      buffers?: { uri?: string }[]
      images?: { uri?: string }[]
    }
    return [...(json.buffers ?? []), ...(json.images ?? [])]
      .map((entry) => entry.uri)
      .filter((uri): uri is string => Boolean(uri && !uri.startsWith("data:")))
  } catch {
    return []
  }
}

function createMissing(asset: AssetFile, expectedPath: string, type: MissingAsset["type"]): MissingAsset {
  return {
    id: `${asset.id}:${type}:${expectedPath}`,
    type,
    requestedByAssetId: asset.id,
    expectedPath,
    expectedFileName: baseName(expectedPath),
    status: "missing",
  }
}

export function collectMissingAssets(assets: AssetFile[], modelAsset: AssetFile): MissingAsset[] {
  const missing: MissingAsset[] = []

  if (modelAsset.extension === "obj" && modelAsset.text) {
    for (const materialRef of collectObjMaterialRefs(modelAsset.text)) {
      const material = matchAssetByPath(assets, materialRef, ["material"])
      if (!material) {
        missing.push(createMissing(modelAsset, materialRef, "material"))
        continue
      }

      if (material.text) {
        for (const textureRef of collectMtlTextureRefs(material.text)) {
          if (!matchAssetByPath(assets, textureRef, ["texture"])) {
            missing.push(createMissing(material, textureRef, "texture"))
          }
        }
      }
    }
  }

  if (modelAsset.extension === "gltf" && modelAsset.text) {
    for (const ref of collectGltfExternalRefs(modelAsset.text)) {
      const type = ref.toLowerCase().endsWith(".bin") ? "binary" : "texture"
      if (!matchAssetByPath(assets, ref, type === "binary" ? ["binary"] : ["texture"])) {
        missing.push(createMissing(modelAsset, ref, type))
      }
    }
  }

  return missing
}

function createLoadingManager(assets: AssetFile[]) {
  const manager = new THREE.LoadingManager()

  manager.setURLModifier((url) => {
    const cleanUrl = normalizeAssetPath(url)
    if (/^(blob:|data:|https?:)/i.test(cleanUrl)) return url

    const extension = extensionFromPath(cleanUrl)
    const asset = matchAssetByRequestedUrl(assets, cleanUrl, extension)
    return asset?.objectUrl ?? url
  })

  return manager
}

function matchAssetByRequestedUrl(assets: AssetFile[], requestedPath: string, extension: string) {
  if (extension === "tx") {
    const pngFallback = matchTextureFallbackByBaseName(assets, requestedPath)
    if (pngFallback) return pngFallback
  }

  if (textureExtensionSet.has(extension)) return matchAssetByPath(assets, requestedPath, ["texture"])
  if (binaryExtensionSet.has(extension)) return matchAssetByPath(assets, requestedPath, ["binary"])
  if (materialExtensionSet.has(extension)) return matchAssetByPath(assets, requestedPath, ["material"])
  return matchAssetByPath(assets, requestedPath)
}

function matchTextureFallbackByBaseName(assets: AssetFile[], requestedPath: string) {
  const candidateBases = textureFallbackBaseCandidates(requestedPath)

  return assets.find((asset) => {
    if (asset.kind !== "texture") return false
    if (!browserTextureExtensions.has(asset.extension)) return false
    return candidateBases.has(baseNameWithoutExtension(asset.path ?? asset.name).toLowerCase())
  })
}

function textureFallbackBaseCandidates(requestedPath: string) {
  const candidates = new Set<string>()
  const requestedName = baseName(requestedPath)
  const withoutTx = requestedName.toLowerCase().endsWith(".tx") ? requestedName.slice(0, -3) : requestedName
  const innerExtension = extensionFromPath(withoutTx)
  const innerBase = baseNameWithoutExtension(withoutTx)

  candidates.add(innerBase.toLowerCase())

  if (browserTextureExtensions.has(innerExtension)) {
    candidates.add(stripTextureColorSpaceSuffix(innerBase).toLowerCase())
  }

  return candidates
}

function stripTextureColorSpaceSuffix(base: string) {
  return base
    .replace(/_(?:sRGB Encoded Rec\.709 \(sRGB\)|sRGB|Raw)_ACEScg$/i, "")
    .replace(/_ACEScg$/i, "")
}

type TextureAssignableMaterial = THREE.Material & {
  alphaMap?: THREE.Texture | null
  bumpMap?: THREE.Texture | null
  map?: THREE.Texture | null
  metalnessMap?: THREE.Texture | null
  normalMap?: THREE.Texture | null
}

type TextureSlot = "alphaMap" | "bumpMap" | "map" | "metalnessMap" | "normalMap"

function materialArray(material: THREE.Material | THREE.Material[]) {
  return Array.isArray(material) ? material : [material]
}

function normalizedMaterialName(name: string) {
  return name.trim().toLowerCase()
}

function textureSlotForFbxLink(link: FbxTextureLink): TextureSlot | null {
  const relationship = link.relationship.toLowerCase()
  const textureName = baseNameWithoutExtension(link.texturePath).toLowerCase()

  if (relationship === "diffusecolor" || relationship === "maya|tex_color_map" || relationship === "maya|basecolor") return "map"
  if (relationship.includes("opacity") || relationship.includes("transparency") || relationship.includes("transparent")) return "alphaMap"
  if (relationship.includes("normal")) return textureName.includes("height") || textureName.includes("bump") ? "bumpMap" : "normalMap"
  if (relationship.includes("bump")) return "bumpMap"
  if (relationship.includes("metal")) return "metalnessMap"
  return null
}

function loadTextureForMaterial(asset: AssetFile, manager: THREE.LoadingManager, colorSpace: THREE.ColorSpace) {
  const texture = new THREE.TextureLoader(manager).load(asset.objectUrl)
  texture.name = asset.name
  texture.colorSpace = colorSpace
  return texture
}

function assignTextureToMaterial(material: THREE.Material, slot: TextureSlot, texture: THREE.Texture) {
  const target = material as TextureAssignableMaterial

  if (slot === "metalnessMap" && !("metalness" in target)) return
  if (target[slot]) return

  target[slot] = texture
  if (slot === "alphaMap") target.transparent = true
  target.needsUpdate = true
}

function applyFbxTextureLinks(object: THREE.Object3D, asset: AssetFile, assets: AssetFile[], manager: THREE.LoadingManager) {
  const links = extractFbxTextureLinks(arrayBuffer(asset))
  if (links.length === 0) return

  const linksByMaterial = new Map<string, FbxTextureLink[]>()
  const textureCache = new Map<string, THREE.Texture>()

  for (const link of links) {
    const key = normalizedMaterialName(link.materialName)
    const current = linksByMaterial.get(key)
    if (current) current.push(link)
    else linksByMaterial.set(key, [link])
  }

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return

    for (const material of materialArray(child.material)) {
      const materialLinks = linksByMaterial.get(normalizedMaterialName(material.name))
      if (!materialLinks) continue

      for (const link of materialLinks) {
        const slot = textureSlotForFbxLink(link)
        if (!slot) continue

        const extension = extensionFromPath(link.texturePath)
        const textureAsset = matchAssetByRequestedUrl(assets, link.texturePath, extension)
        if (!textureAsset || !browserTextureExtensions.has(textureAsset.extension)) continue

        const colorSpace = slot === "map" ? THREE.SRGBColorSpace : THREE.NoColorSpace
        const cacheKey = `${textureAsset.id}:${colorSpace}`
        const texture = textureCache.get(cacheKey) ?? loadTextureForMaterial(textureAsset, manager, colorSpace)
        textureCache.set(cacheKey, texture)
        assignTextureToMaterial(material, slot, texture)
      }
    }
  })
}

function assignFallbackMaterials(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    if (Array.isArray(child.material) ? child.material.length === 0 : !child.material) {
      child.material = new THREE.MeshStandardMaterial({
        color: "#d6dde7",
        roughness: 0.72,
        metalness: 0.05,
      })
    }
  })
}

function defaultMaterial(options: { color?: THREE.ColorRepresentation; vertexColors?: boolean } = {}) {
  return new THREE.MeshStandardMaterial({
    color: options.color ?? "#d7dde7",
    roughness: 0.66,
    metalness: 0.04,
    vertexColors: options.vertexColors,
  })
}

function arrayBuffer(asset: AssetFile) {
  return asset.buffer.slice(0)
}

function ensureGeometryNormals(geometry: THREE.BufferGeometry) {
  if (!geometry.getAttribute("normal")) {
    geometry.computeVertexNormals()
  }
}

function geometryMesh(geometry: THREE.BufferGeometry, material?: THREE.Material | THREE.Material[]) {
  ensureGeometryNormals(geometry)
  return new THREE.Mesh(geometry, material ?? defaultMaterial({ vertexColors: Boolean(geometry.getAttribute("color")) }))
}

function calculateStats(object: THREE.Object3D): ModelStats {
  const stats: ModelStats = { meshCount: 0, vertices: 0, triangles: 0 }

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const geometry = child.geometry
    const positions = geometry.getAttribute("position")
    stats.meshCount += 1
    stats.vertices += positions?.count ?? 0
    stats.triangles += geometry.index ? Math.floor(geometry.index.count / 3) : Math.floor((positions?.count ?? 0) / 3)
  })

  return stats
}

function centerObject(object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object)
  const center = box.getCenter(new THREE.Vector3())
  object.position.sub(center)
}

async function loadObj(assets: AssetFile[], asset: AssetFile, manager: THREE.LoadingManager) {
  if (!asset.text) throw new Error("OBJ text could not be read.")
  const objLoader = new OBJLoader(manager)
  const materialRefs = collectObjMaterialRefs(asset.text)
  const materialAsset = materialRefs.map((ref) => matchAssetByPath(assets, ref, ["material"])).find(Boolean)

  if (materialAsset?.text) {
    const mtlLoader = new MTLLoader(manager)
    const materials = mtlLoader.parse(materialAsset.text, "")
    materials.preload()
    objLoader.setMaterials(materials)
  }

  return objLoader.parse(asset.text)
}

async function loadGltf(asset: AssetFile, manager: THREE.LoadingManager) {
  const loader = new GLTFLoader(manager)

  if (asset.extension === "glb") {
    return new Promise<THREE.Object3D>((resolve, reject) => {
      loader.parse(asset.buffer.slice(0), "", (gltf) => resolve(gltf.scene), reject)
    })
  }

  return new Promise<THREE.Object3D>((resolve, reject) => {
    loader.load(asset.objectUrl, (gltf) => resolve(gltf.scene), undefined, reject)
  })
}

async function loadStl(asset: AssetFile) {
  const loader = new STLLoader()
  const geometry = loader.parse(arrayBuffer(asset))

  return geometryMesh(geometry)
}

async function loadPly(asset: AssetFile) {
  const loader = new PLYLoader()
  const geometry = loader.parse(arrayBuffer(asset))
  return geometryMesh(geometry)
}

async function loadDae(asset: AssetFile, manager: THREE.LoadingManager) {
  if (!asset.text) throw new Error("DAE text could not be read.")

  const loader = new ColladaLoader(manager)
  const result = loader.parse(asset.text, "")
  if (!result?.scene) throw new Error("DAE file could not be parsed.")

  return result.scene
}

async function loadFbx(asset: AssetFile, manager: THREE.LoadingManager) {
  const loader = new FBXLoader(manager)
  return loader.parse(arrayBuffer(asset), "")
}

async function load3mf(asset: AssetFile, manager: THREE.LoadingManager) {
  const loader = new ThreeMFLoader(manager)
  return loader.parse(arrayBuffer(asset))
}

async function loadUsd(asset: AssetFile, manager: THREE.LoadingManager) {
  const loader = new USDLoader(manager)
  return loader.parse(arrayBuffer(asset))
}

async function getOcctModule() {
  occtModulePromise ??= occtImportJs({
    locateFile(fileName) {
      return fileName.endsWith(".wasm") ? occtWasmUrl : fileName
    },
  })
  return occtModulePromise
}

function materialFromRgb(color?: [number, number, number] | null) {
  return defaultMaterial({
    color: color ? new THREE.Color(color[0], color[1], color[2]) : "#cfd5df",
  })
}

function buildOcctMesh(source: OcctMesh) {
  const positions = source.attributes?.position?.array
  const indices = source.index?.array
  if (!positions || !indices) return null

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(Float32Array.from(positions), 3))

  const normals = source.attributes?.normal?.array
  if (normals && normals.length === positions.length) {
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(Float32Array.from(normals), 3))
  }

  const index = Uint32Array.from(indices)
  geometry.setIndex(new THREE.BufferAttribute(index, 1))

  const defaultMeshMaterial = materialFromRgb(source.color)
  const brepFaces = source.brep_faces ?? []
  const materials: THREE.Material[] = [defaultMeshMaterial]

  if (brepFaces.length > 0) {
    for (const face of brepFaces) {
      materials.push(materialFromRgb(face.color ?? source.color))
    }

    const triangleCount = Math.floor(index.length / 3)
    let triangleIndex = 0
    let faceIndex = 0

    while (triangleIndex < triangleCount) {
      const firstIndex = triangleIndex
      let lastIndex = triangleCount
      let materialIndex = 0

      if (faceIndex < brepFaces.length) {
        const face = brepFaces[faceIndex]
        if (triangleIndex < face.first) {
          lastIndex = face.first
        } else {
          lastIndex = face.last + 1
          materialIndex = faceIndex + 1
          faceIndex += 1
        }
      }

      geometry.addGroup(firstIndex * 3, (lastIndex - firstIndex) * 3, materialIndex)
      triangleIndex = lastIndex
    }
  }

  const mesh = geometryMesh(geometry, materials.length > 1 ? materials : defaultMeshMaterial)
  mesh.name = source.name ?? "STEP mesh"
  return mesh
}

async function loadStep(asset: AssetFile) {
  const occt = await getOcctModule()
  const result = occt.ReadStepFile(new Uint8Array(arrayBuffer(asset)), {
    linearUnit: "millimeter",
    linearDeflectionType: "bounding_box_ratio",
    linearDeflection: 0.001,
    angularDeflection: 0.5,
  })

  if (!result.success) {
    throw new Error("STEP file could not be parsed.")
  }

  const group = new THREE.Group()
  for (const sourceMesh of result.meshes ?? []) {
    const mesh = buildOcctMesh(sourceMesh)
    if (mesh) group.add(mesh)
  }

  if (group.children.length === 0) {
    throw new Error("STEP file does not contain renderable mesh data.")
  }

  return group
}

function blendMaterial(source?: BlendMaterial) {
  const diffuse = source?.diffuse ?? [0.82, 0.85, 0.89, 1]
  const alpha = diffuse[3] ?? 1

  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(diffuse[0], diffuse[1], diffuse[2]),
    roughness: source?.roughness ?? 0.68,
    metalness: source?.metallic ?? 0.03,
    transparent: alpha < 1,
    opacity: alpha,
  })
}

function blendMaterials(source: BlendMesh, materialMap: Map<string, BlendMaterial>) {
  const materials = source.materialSlotNames.map((name) => blendMaterial(materialMap.get(name)))
  if (materials.length === 0) materials.push(blendMaterial())
  return materials
}

function applyBlendMaterialGroups(geometry: THREE.BufferGeometry, source: BlendMesh, materials: THREE.Material[]) {
  if (materials.length <= 1) return

  let indexOffset = 0
  for (let faceIndex = 0; faceIndex < source.faceCount; faceIndex += 1) {
    const cornerCount = (source.faceOffsets[faceIndex + 1] ?? 0) - (source.faceOffsets[faceIndex] ?? 0)
    const triangleCount = Math.max(cornerCount - 2, 0)
    if (triangleCount === 0) continue

    const materialIndex = Math.min(source.materialIndices[faceIndex] ?? 0, materials.length - 1)
    geometry.addGroup(indexOffset, triangleCount * 3, materialIndex)
    indexOffset += triangleCount * 3
  }
}

function buildBlendMesh(source: BlendMesh, materialMap: Map<string, BlendMaterial>) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(source.vertices, 3))

  if (source.vertexNormals.length === source.vertices.length) {
    geometry.setAttribute("normal", new THREE.BufferAttribute(source.vertexNormals, 3))
  }

  geometry.setIndex(new THREE.BufferAttribute(source.triangles, 1))

  const materials = blendMaterials(source, materialMap)
  applyBlendMaterialGroups(geometry, source, materials)

  const mesh = geometryMesh(geometry, materials.length > 1 ? materials : materials[0])
  mesh.name = source.name
  return mesh
}

function applyBlendTransform(mesh: THREE.Mesh, object: BlendSceneObject) {
  mesh.matrix.fromArray(Array.from(object.worldMatrix))
  mesh.matrixAutoUpdate = false
}

async function loadBlend(asset: AssetFile) {
  const data = parseBlend(new Uint8Array(arrayBuffer(asset)))
  const materialMap = new Map(extractMaterials(data).map((material) => [material.name, material]))
  const evaluatedMeshes = evaluateAllMeshes(data)
  const objects = extractObjects(data).filter((object) => object.type === OB_TYPE.MESH)
  const group = new THREE.Group()

  for (const object of objects) {
    const source = evaluatedMeshes.get(object.name)
    if (!source) continue

    const mesh = buildBlendMesh(source, materialMap)
    mesh.name = object.name
    applyBlendTransform(mesh, object)
    group.add(mesh)
  }

  if (group.children.length === 0) {
    for (const source of extractMeshes(data)) {
      group.add(buildBlendMesh(source, materialMap))
    }
  }

  if (group.children.length === 0) {
    throw new Error("BLEND file does not contain renderable mesh data.")
  }

  return group
}

export async function loadModelFromAssets(assets: AssetFile[], modelAssetId?: string): Promise<LoadedModel | null> {
  const modelAsset = modelAssetId ? assets.find((asset) => asset.id === modelAssetId) : assets.find((asset) => asset.kind === "model")
  if (!modelAsset) return null

  const manager = createLoadingManager(assets)
  const missingAssets = collectMissingAssets(assets, modelAsset)
  let object: THREE.Object3D

  switch (modelAsset.extension) {
    case "obj":
      object = await loadObj(assets, modelAsset, manager)
      break
    case "glb":
    case "gltf":
      object = await loadGltf(modelAsset, manager)
      break
    case "stl":
      object = await loadStl(modelAsset)
      break
    case "ply":
      object = await loadPly(modelAsset)
      break
    case "dae":
      object = await loadDae(modelAsset, manager)
      break
    case "fbx":
      object = await loadFbx(modelAsset, manager)
      applyFbxTextureLinks(object, modelAsset, assets, manager)
      break
    case "3mf":
      object = await load3mf(modelAsset, manager)
      break
    case "usdz":
      object = await loadUsd(modelAsset, manager)
      break
    case "step":
    case "stp":
      object = await loadStep(modelAsset)
      break
    case "blend":
      object = await loadBlend(modelAsset)
      break
    default:
      throw new Error(`.${modelAsset.extension} is not supported yet.`)
  }

  object.name = modelAsset.name
  assignFallbackMaterials(object)
  centerObject(object)

  return {
    object,
    sourceAssetId: modelAsset.id,
    sourceName: modelAsset.name,
    missingAssets,
    stats: calculateStats(object),
  }
}
