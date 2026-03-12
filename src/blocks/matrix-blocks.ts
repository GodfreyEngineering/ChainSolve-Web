/**
 * matrix-blocks.ts — Matrix operations block pack (SCI-09).
 *
 * 8 blocks: matrix_from_table, matrix_to_table, matrix_multiply, matrix_transpose,
 * matrix_inverse, matrix_det, matrix_trace, matrix_solve.
 * Pure Rust implementations — guaranteed WASM-compatible.
 * Evaluation handled by Rust/WASM engine ops (matrix.* namespace).
 */

import type { BlockDef } from './types'

export function registerMatrixBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'matrix_from_table',
    label: 'Table to Matrix',
    category: 'matrix',
    nodeKind: 'csOperation',
    inputs: [{ id: 'table', label: 'Table' }],
    defaultData: { blockType: 'matrix_from_table', label: 'Table to Matrix' },
    description: 'Convert a table to a matrix (row-major). Each table row becomes a matrix row.',
    synonyms: ['table to matrix', 'create matrix'],
    tags: ['matrix', 'linear algebra'],
  })

  register({
    type: 'matrix_to_table',
    label: 'Matrix to Table',
    category: 'matrix',
    nodeKind: 'csOperation',
    inputs: [{ id: 'matrix', label: 'Matrix' }],
    defaultData: { blockType: 'matrix_to_table', label: 'Matrix to Table' },
    description: 'Convert a matrix back to a table with columns named col0, col1, …',
    synonyms: ['matrix to table', 'extract matrix'],
    tags: ['matrix', 'linear algebra'],
  })

  register({
    type: 'matrix_multiply',
    label: 'Matrix Multiply',
    category: 'matrix',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    defaultData: { blockType: 'matrix_multiply', label: 'Matrix Multiply' },
    description: 'Matrix multiplication A × B. Inner dimensions must match.',
    synonyms: ['matmul', 'matrix product', 'dot product'],
    tags: ['matrix', 'linear algebra'],
  })

  register({
    type: 'matrix_transpose',
    label: 'Matrix Transpose',
    category: 'matrix',
    nodeKind: 'csOperation',
    inputs: [{ id: 'matrix', label: 'Matrix' }],
    defaultData: { blockType: 'matrix_transpose', label: 'Matrix Transpose' },
    description: 'Transpose a matrix: swap rows and columns (Aᵀ)',
    synonyms: ['transpose', 'Aᵀ'],
    tags: ['matrix', 'linear algebra'],
  })

  register({
    type: 'matrix_inverse',
    label: 'Matrix Inverse',
    category: 'matrix',
    nodeKind: 'csOperation',
    inputs: [{ id: 'matrix', label: 'Matrix' }],
    defaultData: { blockType: 'matrix_inverse', label: 'Matrix Inverse' },
    description: 'Compute the inverse of a square matrix (Gauss-Jordan). Errors if singular.',
    synonyms: ['invert matrix', 'A⁻¹'],
    tags: ['matrix', 'linear algebra'],
  })

  register({
    type: 'matrix_det',
    label: 'Determinant',
    category: 'matrix',
    nodeKind: 'csOperation',
    inputs: [{ id: 'matrix', label: 'Matrix' }],
    defaultData: { blockType: 'matrix_det', label: 'Determinant' },
    description: 'Compute the determinant of a square matrix (Gaussian elimination)',
    synonyms: ['det(A)', 'matrix determinant'],
    tags: ['matrix', 'linear algebra'],
  })

  register({
    type: 'matrix_trace',
    label: 'Trace',
    category: 'matrix',
    nodeKind: 'csOperation',
    inputs: [{ id: 'matrix', label: 'Matrix' }],
    defaultData: { blockType: 'matrix_trace', label: 'Trace' },
    description: 'Compute the trace of a matrix: sum of diagonal elements tr(A)',
    synonyms: ['tr(A)', 'matrix trace', 'diagonal sum'],
    tags: ['matrix', 'linear algebra'],
  })

  register({
    type: 'matrix_solve',
    label: 'Solve Ax = b',
    category: 'matrix',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'b' },
    ],
    defaultData: { blockType: 'matrix_solve', label: 'Solve Ax = b' },
    description: 'Solve the linear system Ax = b for x. A is a matrix, b is a vector.',
    synonyms: ['linear system', 'solve linear equations', 'least squares'],
    tags: ['matrix', 'linear algebra'],
  })
}
