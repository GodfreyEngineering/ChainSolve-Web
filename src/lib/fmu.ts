/**
 * fmu.ts — FMU (Functional Mock-up Unit) parser (2.125).
 *
 * Parses FMI 2.0 / 3.0 .fmu files (ZIP archives) in the browser.
 * Extracts modelDescription.xml to discover variable names, causalities,
 * and initial values without executing FMU binaries.
 *
 * Usage:
 *   const info = await parseFmu(arrayBuffer)
 *   // info.inputs, info.outputs, info.parameters
 */

// ── Minimal ZIP reader ────────────────────────────────────────────────────────

function u16(buf: Uint8Array, off: number): number {
  return buf[off] | (buf[off + 1] << 8)
}
function u32(buf: Uint8Array, off: number): number {
  return (buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0
}

/**
 * Extract a named file from a ZIP archive buffer.
 * Supports stored (method 0) and deflate (method 8) compression.
 */
export async function extractFromZip(
  data: ArrayBuffer,
  filename: string,
): Promise<ArrayBuffer | null> {
  const buf = new Uint8Array(data)
  const EOCD_SIG = 0x06054b50
  const CD_SIG = 0x02014b50

  // Find EOCD by scanning backward from the end (handles ZIP comment up to 65535 bytes)
  let eocdOff = -1
  const minSearch = Math.max(0, buf.length - 65557)
  for (let i = buf.length - 22; i >= minSearch; i--) {
    if (u32(buf, i) === EOCD_SIG) {
      eocdOff = i
      break
    }
  }
  if (eocdOff < 0) return null

  const numEntries = u16(buf, eocdOff + 10)
  let cdOff = u32(buf, eocdOff + 16)

  const dec = new TextDecoder()

  for (let i = 0; i < numEntries; i++) {
    if (u32(buf, cdOff) !== CD_SIG) break

    const compression = u16(buf, cdOff + 10)
    const compressedSize = u32(buf, cdOff + 20)
    const localHeaderOffset = u32(buf, cdOff + 42)
    const fnLen = u16(buf, cdOff + 28)
    const extraLen = u16(buf, cdOff + 30)
    const commentLen = u16(buf, cdOff + 32)
    const name = dec.decode(buf.slice(cdOff + 46, cdOff + 46 + fnLen))

    if (name === filename || name === `/${filename}`) {
      // Read local file header
      const lfhFnLen = u16(buf, localHeaderOffset + 26)
      const lfhExtraLen = u16(buf, localHeaderOffset + 28)
      const dataStart = localHeaderOffset + 30 + lfhFnLen + lfhExtraLen
      const compressed = buf.slice(dataStart, dataStart + compressedSize)

      if (compression === 0) {
        // Stored — no compression
        return compressed.buffer.slice(
          compressed.byteOffset,
          compressed.byteOffset + compressed.byteLength,
        )
      } else if (compression === 8) {
        // DEFLATE via DecompressionStream (supported in all modern browsers)
        const ds = new DecompressionStream('deflate-raw')
        const writer = ds.writable.getWriter()
        const reader = ds.readable.getReader()
        await writer.write(compressed)
        await writer.close()

        const chunks: Uint8Array[] = []
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          if (value) chunks.push(value)
        }
        const total = chunks.reduce((s, c) => s + c.length, 0)
        const out = new Uint8Array(total)
        let off = 0
        for (const c of chunks) {
          out.set(c, off)
          off += c.length
        }
        return out.buffer
      }
      return null
    }

    cdOff += 46 + fnLen + extraLen + commentLen
  }
  return null
}

// ── FMU types ─────────────────────────────────────────────────────────────────

export type FmuCausality =
  | 'input'
  | 'output'
  | 'parameter'
  | 'local'
  | 'independent'
  | 'calculatedParameter'
export type FmuVariability = 'fixed' | 'tunable' | 'discrete' | 'continuous' | 'constant'

export interface FmuVariable {
  /** FMI valueReference — unique integer identifier used in C API. */
  valueReference: number
  name: string
  causality: FmuCausality
  variability: FmuVariability
  description?: string
  /** Start value from modelDescription.xml (or 0). */
  start: number
  /** Physical unit string (e.g. "m/s", "K"). */
  unit?: string
}

export interface FmuInfo {
  /** FMI version string, e.g. "2.0" or "3.0". */
  fmiVersion: string
  modelName: string
  guid: string
  description?: string
  generationTool?: string
  /** All model variables. */
  variables: FmuVariable[]
  /** Subset: causality === 'input'. */
  inputs: FmuVariable[]
  /** Subset: causality === 'output'. */
  outputs: FmuVariable[]
  /** Subset: causality === 'parameter'. */
  parameters: FmuVariable[]
}

// ── modelDescription.xml parser ───────────────────────────────────────────────

function attr(el: Element, name: string, fallback = ''): string {
  return el.getAttribute(name) ?? fallback
}

function parseVariable(el: Element): FmuVariable {
  // FMI 2.0 uses <ScalarVariable>, FMI 3.0 uses typed children directly
  const causality = attr(el, 'causality', 'local') as FmuCausality
  const variability = attr(el, 'variability', 'continuous') as FmuVariability
  const vr = parseInt(attr(el, 'valueReference', '0'), 10)

  // Extract start value from first child element (Float64, Real, Integer, Boolean…)
  let start = 0
  let unit: string | undefined
  const child = el.children[0]
  if (child) {
    const startStr = child.getAttribute('start')
    if (startStr !== null) start = parseFloat(startStr) || 0
    unit = child.getAttribute('unit') ?? undefined
  }

  return {
    valueReference: isNaN(vr) ? 0 : vr,
    name: attr(el, 'name', 'var'),
    causality,
    variability,
    description: attr(el, 'description') || undefined,
    start,
    unit,
  }
}

/** Parse modelDescription.xml text into FmuInfo. */
export function parseModelDescription(xml: string): FmuInfo {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  const root = doc.documentElement

  const fmiVersion = attr(root, 'fmiVersion', '2.0')
  const modelName = attr(root, 'modelName', 'Unknown')
  const guid = attr(root, 'guid', '')
  const description = attr(root, 'description') || undefined
  const generationTool = attr(root, 'generationTool') || undefined

  // Variable list: FMI 2.0 → ModelVariables/ScalarVariable,
  //                FMI 3.0 → ModelVariables/* (typed elements)
  const mvEl = root.querySelector('ModelVariables')
  const rawVars: FmuVariable[] = []
  if (mvEl) {
    for (const child of Array.from(mvEl.children)) {
      rawVars.push(parseVariable(child))
    }
  }

  const inputs = rawVars.filter((v) => v.causality === 'input')
  const outputs = rawVars.filter((v) => v.causality === 'output')
  const parameters = rawVars.filter(
    (v) => v.causality === 'parameter' || v.causality === 'calculatedParameter',
  )

  return {
    fmiVersion,
    modelName,
    guid,
    description,
    generationTool,
    variables: rawVars,
    inputs,
    outputs,
    parameters,
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Parse an FMU file (ZIP archive) and return its model description.
 * Throws if the ZIP cannot be read or modelDescription.xml is missing.
 */
export async function parseFmu(buffer: ArrayBuffer): Promise<FmuInfo> {
  const xmlBuf = await extractFromZip(buffer, 'modelDescription.xml')
  if (!xmlBuf) {
    throw new Error('modelDescription.xml not found in FMU archive')
  }
  const xmlText = new TextDecoder().decode(xmlBuf)
  return parseModelDescription(xmlText)
}
