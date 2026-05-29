export const modelExtensions = ["obj", "glb", "gltf", "stl", "ply", "dae", "fbx", "3mf", "usdz", "step", "stp", "blend"] as const
export const materialExtensions = ["mtl"] as const
export const textureExtensions = ["png", "jpg", "jpeg", "webp", "bmp", "gif", "tga", "tx"] as const
export const binaryExtensions = ["bin"] as const

export const importableAssetExtensions = [...modelExtensions, ...materialExtensions, ...textureExtensions, ...binaryExtensions] as const
export const importAccept = importableAssetExtensions.map((extension) => `.${extension}`).join(",")

export const modelFormatLabel = "OBJ / GLTF / STL / PLY / DAE / FBX / 3MF / USDZ / STEP / BLEND"
