import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js"
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js"
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js"
import type { AssetFile, LoadedModel, MissingAsset, ModelStats } from "./types"
import { baseName, matchAssetByPath, normalizeAssetPath } from "./pathMatcher"

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
    if (/^(blob:|data:|https?:)/i.test(url)) return url
    const cleanUrl = normalizeAssetPath(url)
    const asset = matchAssetByPath(assets, cleanUrl)
    return asset?.objectUrl ?? url
  })

  return manager
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
  const geometry = loader.parse(asset.buffer.slice(0))
  geometry.computeVertexNormals()

  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: "#d7dde7",
      roughness: 0.66,
      metalness: 0.04,
    }),
  )
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
