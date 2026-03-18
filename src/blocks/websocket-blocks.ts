/**
 * websocket-blocks.ts — 4.19: WebSocket live data input block.
 *
 * UI-only block (no Rust catalog entry). Opens a WebSocket connection
 * to a user-supplied URL, parses incoming messages as numbers, and
 * updates node.data.value so the engine sees it as a Number source.
 *
 * Bridge remaps blockType='wsInput' → 'number' so the engine evaluates
 * downstream blocks whenever the value updates.
 *
 * Message parsing strategy (first match wins):
 *   1. Plain numeric string → parseFloat
 *   2. JSON object with a configurable field (default: "value")
 *   3. JSON array → first element
 *   4. Any other JSON → ignored, connection stays open
 */

import type { BlockDef } from './registry'

export function registerWebSocketBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'wsInput',
    label: 'WS Input',
    category: 'input',
    nodeKind: 'csWebSocket',
    inputs: [],
    proOnly: false,
    defaultData: {
      blockType: 'wsInput',
      label: 'WS Input',
      /** The WebSocket endpoint URL. */
      wsUrl: 'ws://localhost:8080',
      /** JSON field name to read when message is an object. */
      wsField: 'value',
      /** Throttle rate in Hz (max updates per second sent to engine). */
      wsThrottleHz: 30,
      /** Last received numeric value — output to engine. */
      value: 0,
    },
  })
}
