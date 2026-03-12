/**
 * text-blocks.ts — Text / String block pack (BLK-08).
 *
 * 4 blocks: num_to_text, text_concat, text_length, text_to_num.
 * Evaluation handled by Rust/WASM engine ops (text.* namespace).
 */

import type { BlockDef } from './types'

export function registerTextBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'num_to_text',
    label: 'Number to Text',
    category: 'text',
    nodeKind: 'csOperation',
    inputs: [{ id: 'value', label: 'Value' }],
    defaultData: { blockType: 'num_to_text', label: 'Number to Text', format: '%.6g' },
    description: 'Format a number as text using printf-style format string (%.2f, %e, %g)',
    synonyms: ['format', 'printf', 'number format', 'to string'],
    tags: ['text', 'string', 'format'],
  })

  register({
    type: 'text_concat',
    label: 'Concatenate',
    category: 'text',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    defaultData: { blockType: 'text_concat', label: 'Concatenate' },
    description: 'Concatenate two text values',
    synonyms: ['join', 'append', 'string concat'],
    tags: ['text', 'string'],
  })

  register({
    type: 'text_length',
    label: 'Text Length',
    category: 'text',
    nodeKind: 'csOperation',
    inputs: [{ id: 'value', label: 'Text' }],
    defaultData: { blockType: 'text_length', label: 'Text Length' },
    description: 'Length (character count) of a text value',
    synonyms: ['string length', 'char count', 'strlen'],
    tags: ['text', 'string'],
  })

  register({
    type: 'text_to_num',
    label: 'Text to Number',
    category: 'text',
    nodeKind: 'csOperation',
    inputs: [{ id: 'text', label: 'Text' }],
    defaultData: { blockType: 'text_to_num', label: 'Text to Number' },
    description: 'Parse a text value as a number',
    synonyms: ['parse number', 'string to number', 'atof'],
    tags: ['text', 'string', 'parse'],
  })
}
