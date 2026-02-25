/** Type declarations for the wasm-pack generated WASM module. */

declare module '@engine-wasm/engine_wasm.js' {
  /**
   * Evaluate a graph snapshot (stateless, backward-compatible).
   * @param snapshot_json - JSON-encoded EngineSnapshotV1
   * @returns JSON-encoded EvalResult or error object
   */
  export function evaluate(snapshot_json: string): string

  /**
   * Load a full snapshot into the persistent engine graph.
   * @param snapshot_json - JSON-encoded EngineSnapshotV1
   * @returns JSON-encoded EvalResult (full values for all nodes)
   */
  export function load_snapshot(snapshot_json: string): string

  /**
   * Apply a JSON patch to the persistent engine graph.
   * @param patch_json - JSON-encoded PatchOp[]
   * @returns JSON-encoded IncrementalEvalResult (only changed values)
   */
  export function apply_patch(patch_json: string): string

  /**
   * Set a manual input value on a node port.
   * @returns JSON-encoded IncrementalEvalResult
   */
  export function set_input(node_id: string, port_id: string, value: number): string

  /**
   * Register a dataset (large numeric array) by id.
   * The Float64Array is copied into WASM memory.
   */
  export function register_dataset(id: string, data: Float64Array): void

  /** Release (remove) a dataset from the engine graph. */
  export function release_dataset(id: string): void

  /** Return the ops catalog as a JSON array. */
  export function get_catalog(): string

  /** Return the engine version string. */
  export function get_engine_version(): string

  /**
   * Initialize the WASM module.
   * Must be called before any other exported function.
   * @param input - URL, Response, BufferSource, or WebAssembly.Module for the .wasm file
   */
  export default function init(
    input?: string | URL | Request | Response | BufferSource | WebAssembly.Module,
  ): Promise<void>
}

declare module '@engine-wasm/engine_wasm_bg.wasm?url' {
  const url: string
  export default url
}
