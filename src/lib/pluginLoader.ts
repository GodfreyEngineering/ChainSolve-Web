/**
 * pluginLoader.ts — Dynamic WASM plugin loading (10.2).
 *
 * Loads third-party ChainSolve block plugins compiled to WebAssembly.
 * Each plugin WASM module exports the C-ABI defined in
 * `crates/chainsolve-block-sdk/src/wasm_abi.rs`:
 *
 *   cs_block_count() → i32
 *   cs_block_metadata_json(idx, out_len_ptr) → *u8
 *   cs_evaluate_json(block_idx, inputs_ptr, inputs_len, out_len_ptr) → *u8
 *   cs_alloc(len) → *u8
 *   cs_free(ptr, len)
 *
 * Each WASM module runs with its own isolated linear memory — natural WASM
 * sandboxing prevents plugins from touching host memory.
 *
 * Public API:
 *   loadPlugin(url)               → Promise<PluginModule>
 *   unloadPlugin(id)              → void
 *   getLoadedPlugins()            → PluginModule[]
 *   evaluatePluginBlock(id, blockIdx, inputs) → EngineValue | null
 */

import type { EngineValue } from '../engine/wasm-types.ts'

// ── Types ──────────────────────────────────────────────────────────────────────

/** Metadata for a single block exported by a plugin. */
export interface PluginBlockMetadata {
  id: string
  label: string
  category: string
  inputs: Array<{ id: string; label: string }>
  description: string
}

/** A loaded and initialised plugin WASM module. */
export interface PluginModule {
  /** Stable ID derived from the WASM module URL. */
  id: string
  /** URL from which the module was loaded. */
  url: string
  /** Metadata for all blocks exported by this plugin. */
  blocks: PluginBlockMetadata[]
  /** Evaluate a block. `blockIdx` corresponds to position in `blocks`. */
  evaluate(blockIdx: number, inputs: Record<string, EngineValue>): EngineValue
  /** Destroy the plugin and release WASM memory. */
  dispose(): void
}

// ── WASM ABI interface ─────────────────────────────────────────────────────────

interface PluginExports {
  memory: WebAssembly.Memory
  cs_block_count(): number
  cs_block_metadata_json(idx: number, outLenPtr: number): number
  cs_evaluate_json(
    blockIdx: number,
    inputsPtr: number,
    inputsLen: number,
    outLenPtr: number,
  ): number
  cs_alloc(len: number): number
  cs_free(ptr: number, len: number): void
}

// ── Plugin registry ───────────────────────────────────────────────────────────

const _plugins = new Map<string, PluginModule>()

// ── Helpers ────────────────────────────────────────────────────────────────────

function readUtf8(memory: WebAssembly.Memory, ptr: number, len: number): string {
  const bytes = new Uint8Array(memory.buffer, ptr, len)
  return new TextDecoder().decode(bytes)
}

function writeUtf8(exports: PluginExports, text: string): { ptr: number; len: number } {
  const bytes = new TextEncoder().encode(text)
  const ptr = exports.cs_alloc(bytes.length)
  new Uint8Array(exports.memory.buffer, ptr, bytes.length).set(bytes)
  return { ptr, len: bytes.length }
}

function readI32(memory: WebAssembly.Memory, ptr: number): number {
  return new DataView(memory.buffer).getInt32(ptr, true)
}

function allocI32(exports: PluginExports): number {
  return exports.cs_alloc(4)
}

function freeI32(exports: PluginExports, ptr: number): void {
  exports.cs_free(ptr, 4)
}

// ── Core loader ───────────────────────────────────────────────────────────────

/**
 * Fetch, instantiate, and register a WASM plugin from `url`.
 *
 * The module must export the five `cs_*` functions defined in the SDK's
 * `wasm_abi` module. Throws if the URL is unreachable or the module is
 * missing required exports.
 */
export async function loadPlugin(url: string): Promise<PluginModule> {
  const pluginId = url

  // Return cached module if already loaded
  const existing = _plugins.get(pluginId)
  if (existing) return existing

  // Fetch and compile
  let wasmModule: WebAssembly.Module
  try {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const buffer = await resp.arrayBuffer()
    wasmModule = await WebAssembly.compile(buffer)
  } catch (err) {
    throw new Error(`[PLUGIN_LOAD] Failed to load plugin from ${url}: ${String(err)}`)
  }

  // Instantiate with no imports (all plugin functions are self-contained)
  const instance = await WebAssembly.instantiate(wasmModule)
  const exps = instance.exports as unknown as PluginExports

  // Validate required exports
  for (const name of [
    'memory',
    'cs_block_count',
    'cs_block_metadata_json',
    'cs_evaluate_json',
    'cs_alloc',
    'cs_free',
  ]) {
    if (!(name in exps)) {
      throw new Error(`[PLUGIN_ABI] WASM module from ${url} is missing export '${name}'`)
    }
  }

  // Read block metadata
  const blockCount = exps.cs_block_count()
  const blocks: PluginBlockMetadata[] = []

  for (let i = 0; i < blockCount; i++) {
    const outLenPtr = allocI32(exps)
    try {
      const ptr = exps.cs_block_metadata_json(i, outLenPtr)
      const len = readI32(exps.memory, outLenPtr)
      if (ptr === 0 || len <= 0) continue
      const json = readUtf8(exps.memory, ptr, len)
      const meta = JSON.parse(json) as PluginBlockMetadata
      blocks.push(meta)
    } catch {
      // Skip malformed metadata
    } finally {
      freeI32(exps, outLenPtr)
    }
  }

  // Evaluation function
  function evaluate(blockIdx: number, inputs: Record<string, EngineValue>): EngineValue {
    const inputsJson = JSON.stringify(inputs)
    const { ptr: inputsPtr, len: inputsLen } = writeUtf8(exps, inputsJson)
    const outLenPtr = allocI32(exps)

    try {
      const resultPtr = exps.cs_evaluate_json(blockIdx, inputsPtr, inputsLen, outLenPtr)
      const resultLen = readI32(exps.memory, outLenPtr)
      if (resultPtr === 0 || resultLen <= 0) {
        return { kind: 'error', message: '[PLUGIN_EVAL] null result from plugin' }
      }
      const json = readUtf8(exps.memory, resultPtr, resultLen)
      return JSON.parse(json) as EngineValue
    } catch (err) {
      return { kind: 'error', message: `[PLUGIN_EVAL] ${String(err)}` }
    } finally {
      exps.cs_free(inputsPtr, inputsLen)
      freeI32(exps, outLenPtr)
    }
  }

  const plugin: PluginModule = {
    id: pluginId,
    url,
    blocks,
    evaluate,
    dispose() {
      _plugins.delete(pluginId)
    },
  }

  _plugins.set(pluginId, plugin)
  return plugin
}

/** Unload a plugin by its URL/ID and remove it from the registry. */
export function unloadPlugin(id: string): void {
  _plugins.get(id)?.dispose()
}

/** Return all currently loaded plugins. */
export function getLoadedPlugins(): PluginModule[] {
  return [..._plugins.values()]
}

/**
 * Evaluate a specific block in a loaded plugin.
 *
 * @param pluginId  URL/ID of the plugin (as returned by `loadPlugin`).
 * @param blockIdx  Index into the plugin's `blocks` array.
 * @param inputs    Resolved input values keyed by port ID.
 * @returns         Computed `EngineValue`, or null if the plugin is not loaded.
 */
export function evaluatePluginBlock(
  pluginId: string,
  blockIdx: number,
  inputs: Record<string, EngineValue>,
): EngineValue | null {
  const plugin = _plugins.get(pluginId)
  if (!plugin) return null
  return plugin.evaluate(blockIdx, inputs)
}
