/// <reference types="vite/client" />

declare module "occt-import-js" {
  export type OcctImportParams = {
    linearUnit?: "millimeter" | "centimeter" | "meter" | "inch" | "foot"
    linearDeflectionType?: "bounding_box_ratio" | "absolute_value"
    linearDeflection?: number
    angularDeflection?: number
  }

  export type OcctMesh = {
    name?: string
    color?: [number, number, number]
    brep_faces?: { first: number; last: number; color?: [number, number, number] | null }[]
    attributes?: {
      position?: { array: ArrayLike<number> }
      normal?: { array: ArrayLike<number> }
    }
    index?: { array: ArrayLike<number> }
  }

  export type OcctImportResult = {
    success: boolean
    meshes?: OcctMesh[]
  }

  export type OcctImportModule = {
    ReadStepFile(content: Uint8Array, params: OcctImportParams | null): OcctImportResult
  }

  export default function occtImportJs(options?: { locateFile?: (path: string, prefix: string) => string }): Promise<OcctImportModule>
}
