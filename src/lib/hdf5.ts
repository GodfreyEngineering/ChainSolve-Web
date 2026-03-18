/**
 * hdf5.ts — HDF5 import/export using h5wasm (4.7).
 *
 * Provides browser-side HDF5 file reading and writing via h5wasm
 * (libhdf5 compiled to WASM by USNC/h5wasm).
 *
 * Loaded lazily from CDN on first use (~2MB).
 *
 * Usage:
 *   const datasets = await readHdf5(arrayBuffer)
 *   // datasets: { name, path, shape, data }[]
 *
 *   const hdfBuffer = await writeHdf5([{ name: 'data', data: Float64Array, shape: [n] }])
 *
 * CSP note: script-src must include https://cdn.jsdelivr.net
 *
 * Ref: https://github.com/usnistgov/h5wasm
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Hdf5Dataset {
  /** Full path in the HDF5 file, e.g. "/group/dataset". */
  path: string
  /** Dataset name (last path component). */
  name: string
  /** Shape array, e.g. [100, 3] for a 100×3 array. */
  shape: number[]
  /** Data as Float64Array (all numeric types converted). */
  data: Float64Array
}

export interface Hdf5WriteEntry {
  name: string
  data: Float64Array | number[]
  shape?: number[]
}

// ── h5wasm type stub ──────────────────────────────────────────────────────────

interface H5WasmModule {
  File: new (path: string, mode: string) => H5File
  FS: {
    writeFile(path: string, data: Uint8Array): void
    readFile(path: string): Uint8Array
    unlink(path: string): void
  }
}

interface H5File {
  get(path: string): H5Dataset | H5Group | null
  keys(): string[]
  close(): void
}

interface H5Dataset {
  type: 'Dataset'
  shape: number[]
  value: Float64Array | Int32Array | Float32Array | number[]
}

interface H5Group {
  type: 'Group'
  keys(): string[]
}

// ── Loader ────────────────────────────────────────────────────────────────────

let h5wasmModule: H5WasmModule | null = null
let loadPromise: Promise<H5WasmModule> | null = null

const H5WASM_CDN = 'https://cdn.jsdelivr.net/npm/h5wasm@0.7.8/dist/esm/h5wasm.js'

async function getH5wasm(): Promise<H5WasmModule> {
  if (h5wasmModule) return h5wasmModule
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    // Dynamic import from CDN — requires script-src to include cdn.jsdelivr.net
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await (import(/* @vite-ignore */ H5WASM_CDN) as Promise<any>)
    const { default: h5wasm } = mod as { default: () => Promise<H5WasmModule> }
    h5wasmModule = await h5wasm()
    return h5wasmModule!
  })()

  return loadPromise
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toFloat64(arr: Float64Array | Int32Array | Float32Array | number[]): Float64Array {
  if (arr instanceof Float64Array) return arr
  return new Float64Array(arr)
}

function collectDatasets(
  file: H5File,
  path: string,
  results: Hdf5Dataset[],
  maxDepth = 8,
  depth = 0,
): void {
  if (depth > maxDepth) return

  const item = file.get(path)
  if (!item) return

  if (item.type === 'Dataset') {
    const ds = item as H5Dataset
    const name = path.split('/').filter(Boolean).pop() ?? path
    results.push({
      path,
      name,
      shape: ds.shape,
      data: toFloat64(ds.value),
    })
  } else if (item.type === 'Group') {
    const group = item as H5Group
    for (const key of group.keys()) {
      const childPath = path === '/' ? `/${key}` : `${path}/${key}`
      collectDatasets(file, childPath, results, maxDepth, depth + 1)
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Read all numeric datasets from an HDF5 file.
 * Returns an array of datasets, each with name, path, shape, and Float64 data.
 */
export async function readHdf5(buffer: ArrayBuffer): Promise<Hdf5Dataset[]> {
  const h5 = await getH5wasm()

  const tmpPath = `/tmp_read_${Date.now()}.h5`
  h5.FS.writeFile(tmpPath, new Uint8Array(buffer))

  let file: H5File | null = null
  const results: Hdf5Dataset[] = []

  try {
    file = new h5.File(tmpPath, 'r')
    collectDatasets(file, '/', results)
  } finally {
    file?.close()
    try {
      h5.FS.unlink(tmpPath)
    } catch {
      /* ignore */
    }
  }

  return results
}

/**
 * Write datasets to a new HDF5 file and return the file as an ArrayBuffer.
 */
export async function writeHdf5(entries: Hdf5WriteEntry[]): Promise<ArrayBuffer> {
  const h5 = await getH5wasm()

  const tmpPath = `/tmp_write_${Date.now()}.h5`
  let file: H5File | null = null

  try {
    file = new h5.File(tmpPath, 'w')

    for (const entry of entries) {
      const data = entry.data instanceof Float64Array ? entry.data : new Float64Array(entry.data)
      const shape = entry.shape ?? [data.length]
      // h5wasm File.create_dataset is the write API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(file as any).create_dataset({ name: entry.name, data, shape })
    }
  } finally {
    file?.close()
  }

  const buf = h5.FS.readFile(tmpPath)
  try {
    h5.FS.unlink(tmpPath)
  } catch {
    /* ignore */
  }

  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

/**
 * Convert Hdf5Datasets to a Table-compatible structure.
 * Each 1D dataset becomes a column; 2D datasets expand into named columns.
 */
export function datasetsToTable(
  datasets: Hdf5Dataset[],
): { columns: string[]; rows: number[][] } | null {
  if (datasets.length === 0) return null

  // Find 1D datasets to use as columns
  const cols1d = datasets.filter((d) => d.shape.length === 1)
  if (cols1d.length === 0) {
    // Try first 2D dataset
    const ds2d = datasets.find((d) => d.shape.length === 2)
    if (!ds2d) return null
    const [nRows, nCols] = ds2d.shape
    const rows: number[][] = []
    for (let r = 0; r < nRows; r++) {
      rows.push(Array.from(ds2d.data.slice(r * nCols, (r + 1) * nCols)))
    }
    const columns = Array.from({ length: nCols }, (_, i) => `${ds2d.name}_${i}`)
    return { columns, rows }
  }

  const nRows = Math.min(...cols1d.map((d) => d.shape[0]))
  const rows: number[][] = []
  for (let r = 0; r < nRows; r++) {
    rows.push(cols1d.map((d) => d.data[r]))
  }
  return { columns: cols1d.map((d) => d.name), rows }
}
