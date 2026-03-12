/**
 * lookup-blocks.ts — BLK-10: 1D and 2D lookup table interpolation blocks.
 *
 * Ops evaluated by Rust engine (lookup.1d / lookup.2d).
 */

import type { BlockDef } from './types'

export function registerLookupBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'lookup.1d',
    label: 'Lookup Table 1D',
    category: 'tableOps',
    nodeKind: 'csOperation',
    proOnly: true,
    inputs: [
      { id: 'x_vec', label: 'X (vector)' },
      { id: 'y_vec', label: 'Y (vector)' },
      { id: 'x', label: 'Query X' },
    ],
    defaultData: { blockType: 'lookup.1d', label: 'Lookup 1D', method: 'linear', proOnly: true },
    description:
      '1D interpolated lookup: given X and Y vectors, returns Y at query X. Method: nearest, linear, or cubic.',
    synonyms: ['interpolate', 'lookup', 'table lookup', '1d interpolation'],
    tags: ['table', 'interpolation', 'lookup'],
  })

  register({
    type: 'lookup.2d',
    label: 'Lookup Table 2D',
    category: 'tableOps',
    nodeKind: 'csOperation',
    proOnly: true,
    inputs: [
      { id: 'x_vec', label: 'X axis (vector)' },
      { id: 'y_vec', label: 'Y axis (vector)' },
      { id: 'z_mat', label: 'Z matrix (table)' },
      { id: 'x', label: 'Query X' },
      { id: 'y', label: 'Query Y' },
    ],
    defaultData: { blockType: 'lookup.2d', label: 'Lookup 2D', method: 'linear', proOnly: true },
    description:
      '2D bilinear interpolation lookup: X-axis, Y-axis, Z-matrix (Table), query (x,y). Returns interpolated Z.',
    synonyms: ['2d interpolation', 'bilinear', 'map lookup', 'surface lookup'],
    tags: ['table', 'interpolation', 'lookup', '2d'],
  })
}
