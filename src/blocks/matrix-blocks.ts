/**
 * matrix-blocks.ts — Matrix operations block pack (SCI-09).
 *
 * 15 blocks: matrix_from_table, matrix_to_table, matrix_multiply, matrix_transpose,
 * matrix_inverse, matrix_det, matrix_trace, matrix_solve,
 * matrix_lu, matrix_qr, matrix_svd, matrix_cholesky, matrix_eigen, matrix_schur, matrix_cond.
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

  register({
    type: 'matrix_lu',
    label: 'LU Decompose',
    category: 'matrix',
    nodeKind: 'csOperation',
    inputs: [{ id: 'matrix', label: 'Matrix' }],
    defaultData: { blockType: 'matrix_lu', label: 'LU Decompose' },
    description:
      'LU decomposition of a square matrix. Returns L (lower triangular factor).',
    synonyms: ['LU factorization', 'PLU', 'lower upper'],
    tags: ['matrix', 'linear algebra', 'decomposition'],
  })

  register({
    type: 'matrix_qr',
    label: 'QR Decompose',
    category: 'matrix',
    nodeKind: 'csOperation',
    inputs: [{ id: 'matrix', label: 'Matrix' }],
    defaultData: { blockType: 'matrix_qr', label: 'QR Decompose' },
    description:
      'QR decomposition via modified Gram-Schmidt. Returns Q (orthogonal factor).',
    synonyms: ['QR factorization', 'orthogonal decomposition'],
    tags: ['matrix', 'linear algebra', 'decomposition'],
  })

  register({
    type: 'matrix_svd',
    label: 'SVD',
    category: 'matrix',
    nodeKind: 'csOperation',
    inputs: [{ id: 'matrix', label: 'Matrix' }],
    defaultData: { blockType: 'matrix_svd', label: 'SVD' },
    description:
      'Singular Value Decomposition. Returns vector of singular values σ₁ ≥ σ₂ ≥ …',
    synonyms: [
      'singular value decomposition',
      'sigma values',
      'principal values',
    ],
    tags: ['matrix', 'linear algebra', 'decomposition'],
  })

  register({
    type: 'matrix_cholesky',
    label: 'Cholesky',
    category: 'matrix',
    nodeKind: 'csOperation',
    inputs: [{ id: 'matrix', label: 'Matrix' }],
    defaultData: { blockType: 'matrix_cholesky', label: 'Cholesky' },
    description:
      'Cholesky decomposition of a symmetric positive-definite matrix. Returns lower triangular L where A = LLᵀ.',
    synonyms: ['Cholesky factorization', 'LLT', 'positive definite'],
    tags: ['matrix', 'linear algebra', 'decomposition'],
  })

  register({
    type: 'matrix_eigen',
    label: 'Eigendecomposition',
    category: 'matrix',
    nodeKind: 'csOperation',
    inputs: [{ id: 'matrix', label: 'Matrix' }],
    defaultData: { blockType: 'matrix_eigen', label: 'Eigendecomposition' },
    description:
      'Eigenvalue decomposition of a symmetric matrix. Returns eigenvalues as a vector.',
    synonyms: [
      'eigenvalues',
      'eigenvectors',
      'spectral decomposition',
      'diagonalization',
    ],
    tags: ['matrix', 'linear algebra', 'decomposition'],
  })

  register({
    type: 'matrix_schur',
    label: 'Schur Decompose',
    category: 'matrix',
    nodeKind: 'csOperation',
    inputs: [{ id: 'matrix', label: 'Matrix' }],
    defaultData: { blockType: 'matrix_schur', label: 'Schur Decompose' },
    description:
      'Schur decomposition of a square matrix. Returns the quasi-upper-triangular Schur form T where A = QTQᵀ.',
    synonyms: ['Schur factorization', 'Schur form'],
    tags: ['matrix', 'linear algebra', 'decomposition'],
  })

  register({
    type: 'matrix_cond',
    label: 'Condition Number',
    category: 'matrix',
    nodeKind: 'csOperation',
    inputs: [{ id: 'matrix', label: 'Matrix' }],
    defaultData: { blockType: 'matrix_cond', label: 'Condition Number' },
    description:
      'Estimate the condition number κ(A) = σ_max / σ_min via SVD. Large values indicate ill-conditioning.',
    synonyms: ['kappa', 'condition number', 'ill-conditioned'],
    tags: ['matrix', 'linear algebra', 'decomposition'],
  })
}
