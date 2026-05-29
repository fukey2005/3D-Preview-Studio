export type FbxTextureLink = {
  materialName: string
  relationship: string
  texturePath: string
}

type FbxNode = {
  name: string
  properties: unknown[]
  children: FbxNode[]
}

const binaryHeader = "Kaydara FBX Binary  \0"

class BinaryReader {
  private readonly view: DataView
  private readonly decoder = new TextDecoder()
  offset = 0

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer)
  }

  get size() {
    return this.view.byteLength
  }

  skip(length: number) {
    this.offset += length
  }

  uint8() {
    const value = this.view.getUint8(this.offset)
    this.offset += 1
    return value
  }

  int16() {
    const value = this.view.getInt16(this.offset, true)
    this.offset += 2
    return value
  }

  int32() {
    const value = this.view.getInt32(this.offset, true)
    this.offset += 4
    return value
  }

  uint32() {
    const value = this.view.getUint32(this.offset, true)
    this.offset += 4
    return value
  }

  uint64() {
    const low = this.uint32()
    const high = this.uint32()
    return high * 0x100000000 + low
  }

  int64() {
    const low = this.uint32()
    let high = this.uint32()

    if (high & 0x80000000) {
      high = ~high & 0xffffffff
      const invertedLow = (~low + 1) & 0xffffffff
      if (invertedLow === 0) high = (high + 1) & 0xffffffff
      return -(high * 0x100000000 + invertedLow)
    }

    return high * 0x100000000 + low
  }

  float32() {
    const value = this.view.getFloat32(this.offset, true)
    this.offset += 4
    return value
  }

  float64() {
    const value = this.view.getFloat64(this.offset, true)
    this.offset += 8
    return value
  }

  string(length: number) {
    const bytes = new Uint8Array(this.view.buffer, this.offset, length)
    this.offset += length
    const nullIndex = bytes.indexOf(0)
    return this.decoder.decode(nullIndex >= 0 ? bytes.slice(0, nullIndex) : bytes)
  }
}

function isBinaryFbx(buffer: ArrayBuffer) {
  if (buffer.byteLength < binaryHeader.length) return false
  return new TextDecoder().decode(new Uint8Array(buffer, 0, binaryHeader.length)) === binaryHeader
}

function readProperty(reader: BinaryReader) {
  const type = reader.string(1)

  switch (type) {
    case "C":
      return (reader.uint8() & 1) === 1
    case "D":
      return reader.float64()
    case "F":
      return reader.float32()
    case "I":
      return reader.int32()
    case "L":
      return reader.int64()
    case "Y":
      return reader.int16()
    case "S": {
      const length = reader.uint32()
      return reader.string(length)
    }
    case "R": {
      const length = reader.uint32()
      reader.skip(length)
      return undefined
    }
    case "b":
    case "c":
    case "d":
    case "f":
    case "i":
    case "l": {
      const arrayLength = reader.uint32()
      reader.uint32()
      const byteLength = reader.uint32()
      const bytesPerValue = type === "d" || type === "l" ? 8 : type === "f" || type === "i" ? 4 : 1
      reader.skip(byteLength || arrayLength * bytesPerValue)
      return undefined
    }
    default:
      throw new Error(`Unsupported FBX property type: ${type}`)
  }
}

function readNode(reader: BinaryReader, version: number): FbxNode | null {
  const endOffset = version >= 7500 ? reader.uint64() : reader.uint32()
  const propertyCount = version >= 7500 ? reader.uint64() : reader.uint32()
  version >= 7500 ? reader.uint64() : reader.uint32()
  const nameLength = reader.uint8()
  const name = reader.string(nameLength)

  if (endOffset === 0) return null

  const properties: unknown[] = []
  for (let index = 0; index < propertyCount; index += 1) {
    properties.push(readProperty(reader))
  }

  const children: FbxNode[] = []
  while (reader.offset < endOffset) {
    const child = readNode(reader, version)
    if (child) children.push(child)
  }

  return { name, properties, children }
}

function findNodes(node: FbxNode, name: string, result: FbxNode[] = []) {
  if (node.name === name) result.push(node)
  for (const child of node.children) findNodes(child, name, result)
  return result
}

function childString(node: FbxNode, name: string) {
  const child = node.children.find((entry) => entry.name === name)
  const value = child?.properties[0]
  return typeof value === "string" ? value : undefined
}

function numericId(value: unknown) {
  return typeof value === "number" ? value : undefined
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined
}

function extractBinaryFbxTextureLinks(buffer: ArrayBuffer): FbxTextureLink[] {
  const reader = new BinaryReader(buffer)
  reader.skip(23)
  const version = reader.uint32()
  const root: FbxNode = { name: "root", properties: [], children: [] }

  while (reader.offset + 200 < reader.size) {
    const node = readNode(reader, version)
    if (!node) break
    root.children.push(node)
  }

  const materials = new Map<number, string>()
  const textures = new Map<number, string>()
  const videos = new Map<number, string>()
  const textureToVideo = new Map<number, number>()
  const links: FbxTextureLink[] = []

  for (const material of findNodes(root, "Material")) {
    const id = numericId(material.properties[0])
    const name = stringValue(material.properties[1])
    if (id !== undefined && name) materials.set(id, name)
  }

  for (const texture of findNodes(root, "Texture")) {
    const id = numericId(texture.properties[0])
    const fileName = childString(texture, "FileName") || childString(texture, "RelativeFilename")
    if (id !== undefined && fileName) textures.set(id, fileName)
  }

  for (const video of findNodes(root, "Video")) {
    const id = numericId(video.properties[0])
    const fileName = childString(video, "RelativeFilename") || childString(video, "Filename")
    if (id !== undefined && fileName) videos.set(id, fileName)
  }

  for (const connection of findNodes(root, "C")) {
    const type = stringValue(connection.properties[0])
    const fromId = numericId(connection.properties[1])
    const toId = numericId(connection.properties[2])
    if (type === "OO" && fromId !== undefined && toId !== undefined && textures.has(fromId) && videos.has(toId)) {
      textureToVideo.set(fromId, toId)
    }
  }

  for (const connection of findNodes(root, "C")) {
    const type = stringValue(connection.properties[0])
    const fromId = numericId(connection.properties[1])
    const toId = numericId(connection.properties[2])
    const relationship = stringValue(connection.properties[3])
    if (type !== "OP" || fromId === undefined || toId === undefined || !relationship) continue

    const materialName = materials.get(toId)
    const texturePath = videos.get(textureToVideo.get(fromId) ?? -1) || textures.get(fromId)
    if (materialName && texturePath) {
      links.push({ materialName, relationship, texturePath })
    }
  }

  return links
}

export function extractFbxTextureLinks(buffer: ArrayBuffer): FbxTextureLink[] {
  if (!isBinaryFbx(buffer)) return []

  try {
    return extractBinaryFbxTextureLinks(buffer)
  } catch {
    return []
  }
}
