/**
 * rest-blocks.ts — 4.21: REST / GraphQL API client block.
 *
 * UI-only block. Makes HTTP requests using the browser fetch() API and
 * extracts a numeric value from the response. Supports:
 *   - GET / POST / PUT / DELETE methods
 *   - Custom headers (JSON object string)
 *   - Request body (for POST/PUT)
 *   - Response path extraction (dot-notation, e.g. "data.value")
 *   - Manual trigger or auto-poll at a configurable interval
 *   - GraphQL: POST with Content-Type application/json and {"query": "..."} body
 *
 * Bridge remaps blockType='restInput' → 'number' so the engine treats
 * the extracted value as a Number source.
 */

import type { BlockDef } from './registry'

export function registerRestBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'restInput',
    label: 'REST Input',
    category: 'input',
    nodeKind: 'csRestApi',
    inputs: [],
    proOnly: false,
    defaultData: {
      blockType: 'restInput',
      label: 'REST Input',
      /** HTTP endpoint URL. */
      restUrl: 'https://api.example.com/value',
      /** HTTP method. */
      restMethod: 'GET',
      /** Headers as JSON object string (e.g., '{"Authorization":"Bearer token"}'). */
      restHeaders: '{}',
      /** Request body string (for POST/PUT/PATCH). */
      restBody: '',
      /** Dot-notation path into JSON response to extract value (e.g., "data.temperature"). */
      restPath: '',
      /** Auto-poll interval in seconds (0 = manual only). */
      restPollSec: 0,
      /** Extracted numeric value — output to engine. */
      value: 0,
    },
  })
}
