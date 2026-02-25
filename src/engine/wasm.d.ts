/** Type declarations for the wasm-pack generated WASM module. */

declare module '@engine-wasm/engine_wasm.js' {
  /**
   * Evaluate a graph snapshot.
   * @param snapshot_json - JSON-encoded EngineSnapshotV1
   * @returns JSON-encoded EvalResult or error object
   */
  export function evaluate(snapshot_json: string): string

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
