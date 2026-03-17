//! Sparse matrix module.
//!
//! Provides CSR (Compressed Sparse Row), CSC (Compressed Sparse Column),
//! COO (Coordinate), and BSR (Block Sparse Row) storage formats with
//! conversion between formats and sparse-dense operations.

use crate::types::Value;

/// Coordinate (COO) format — simplest sparse representation.
/// Stores (row, col, value) triplets. Supports duplicate entries (summed on conversion).
#[derive(Debug, Clone)]
pub struct CooMatrix {
    pub rows: usize,
    pub cols: usize,
    pub row_indices: Vec<usize>,
    pub col_indices: Vec<usize>,
    pub values: Vec<f64>,
}

/// Compressed Sparse Row (CSR) format — efficient for row slicing and SpMV.
/// `row_ptrs[i]..row_ptrs[i+1]` gives the range of entries in row `i`.
#[derive(Debug, Clone)]
pub struct CsrMatrix {
    pub rows: usize,
    pub cols: usize,
    pub row_ptrs: Vec<usize>,
    pub col_indices: Vec<usize>,
    pub values: Vec<f64>,
}

/// Compressed Sparse Column (CSC) format — efficient for column slicing.
/// `col_ptrs[j]..col_ptrs[j+1]` gives the range of entries in column `j`.
#[derive(Debug, Clone)]
pub struct CscMatrix {
    pub rows: usize,
    pub cols: usize,
    pub col_ptrs: Vec<usize>,
    pub row_indices: Vec<usize>,
    pub values: Vec<f64>,
}

/// Block Sparse Row (BSR) format — stores dense blocks of size `block_size × block_size`.
/// Efficient for FEM stiffness matrices with structured sparsity.
#[derive(Debug, Clone)]
pub struct BsrMatrix {
    pub block_rows: usize,
    pub block_cols: usize,
    pub block_size: usize,
    pub row_ptrs: Vec<usize>,
    pub col_indices: Vec<usize>,
    /// Flattened block data: each block is `block_size * block_size` values, row-major.
    pub values: Vec<f64>,
}

// ── COO construction and conversion ──────────────────────────────────────

impl CooMatrix {
    /// Create an empty COO matrix.
    pub fn new(rows: usize, cols: usize) -> Self {
        Self {
            rows,
            cols,
            row_indices: Vec::new(),
            col_indices: Vec::new(),
            values: Vec::new(),
        }
    }

    /// Create a COO matrix with pre-allocated capacity.
    pub fn with_capacity(rows: usize, cols: usize, nnz: usize) -> Self {
        Self {
            rows,
            cols,
            row_indices: Vec::with_capacity(nnz),
            col_indices: Vec::with_capacity(nnz),
            values: Vec::with_capacity(nnz),
        }
    }

    /// Add a triplet (row, col, value).
    pub fn push(&mut self, row: usize, col: usize, value: f64) {
        debug_assert!(row < self.rows && col < self.cols);
        self.row_indices.push(row);
        self.col_indices.push(col);
        self.values.push(value);
    }

    /// Number of stored entries (may include duplicates).
    pub fn nnz(&self) -> usize {
        self.values.len()
    }

    /// Convert to CSR format. Duplicate entries at same (row, col) are summed.
    pub fn to_csr(&self) -> CsrMatrix {
        let n = self.rows;
        let m = self.cols;
        let nnz = self.nnz();

        // Count entries per row
        let mut row_counts = vec![0usize; n];
        for &r in &self.row_indices {
            row_counts[r] += 1;
        }

        // Build row_ptrs
        let mut row_ptrs = vec![0usize; n + 1];
        for i in 0..n {
            row_ptrs[i + 1] = row_ptrs[i] + row_counts[i];
        }

        // Fill col_indices and values
        let mut col_indices = vec![0usize; nnz];
        let mut values = vec![0.0f64; nnz];
        let mut write_pos = row_ptrs.clone();

        for k in 0..nnz {
            let r = self.row_indices[k];
            let pos = write_pos[r];
            col_indices[pos] = self.col_indices[k];
            values[pos] = self.values[k];
            write_pos[r] += 1;
        }

        // Sort each row by column index and sum duplicates
        let mut csr = CsrMatrix {
            rows: n,
            cols: m,
            row_ptrs,
            col_indices,
            values,
        };
        csr.sort_and_sum_duplicates();
        csr
    }

    /// Convert to CSC format.
    pub fn to_csc(&self) -> CscMatrix {
        let n = self.rows;
        let m = self.cols;
        let nnz = self.nnz();

        let mut col_counts = vec![0usize; m];
        for &c in &self.col_indices {
            col_counts[c] += 1;
        }

        let mut col_ptrs = vec![0usize; m + 1];
        for j in 0..m {
            col_ptrs[j + 1] = col_ptrs[j] + col_counts[j];
        }

        let mut row_indices = vec![0usize; nnz];
        let mut values = vec![0.0f64; nnz];
        let mut write_pos = col_ptrs.clone();

        for k in 0..nnz {
            let c = self.col_indices[k];
            let pos = write_pos[c];
            row_indices[pos] = self.row_indices[k];
            values[pos] = self.values[k];
            write_pos[c] += 1;
        }

        CscMatrix {
            rows: n,
            cols: m,
            col_ptrs,
            row_indices,
            values,
        }
    }

    /// Convert to dense row-major Value::Matrix.
    pub fn to_dense(&self) -> Value {
        let mut data = vec![0.0f64; self.rows * self.cols];
        for k in 0..self.nnz() {
            data[self.row_indices[k] * self.cols + self.col_indices[k]] += self.values[k];
        }
        Value::Matrix {
            rows: self.rows,
            cols: self.cols,
            data,
        }
    }
}

// ── CSR operations ───────────────────────────────────────────────────────

impl CsrMatrix {
    /// Sort column indices within each row and sum duplicate entries.
    fn sort_and_sum_duplicates(&mut self) {
        for i in 0..self.rows {
            let start = self.row_ptrs[i];
            let end = self.row_ptrs[i + 1];
            if start >= end {
                continue;
            }

            // Sort by column index using paired sort
            let mut pairs: Vec<(usize, f64)> = (start..end)
                .map(|k| (self.col_indices[k], self.values[k]))
                .collect();
            pairs.sort_by_key(|&(col, _)| col);

            // Write back and sum duplicates
            let mut write = start;
            pairs[0..1]
                .iter()
                .for_each(|&(c, v)| {
                    self.col_indices[write] = c;
                    self.values[write] = v;
                });

            for k in 1..pairs.len() {
                if pairs[k].0 == self.col_indices[write] {
                    self.values[write] += pairs[k].1;
                } else {
                    write += 1;
                    self.col_indices[write] = pairs[k].0;
                    self.values[write] = pairs[k].1;
                }
            }
            let new_end = write + 1;

            // Update row_ptrs if entries were merged
            if new_end < end {
                let removed = end - new_end;
                // Shift subsequent entries
                for k in new_end..self.col_indices.len() - removed {
                    self.col_indices[k] = self.col_indices[k + removed];
                    self.values[k] = self.values[k + removed];
                }
                self.col_indices.truncate(self.col_indices.len() - removed);
                self.values.truncate(self.values.len() - removed);
                for j in i + 1..=self.rows {
                    self.row_ptrs[j] -= removed;
                }
            }
        }
    }

    /// Number of stored non-zeros.
    pub fn nnz(&self) -> usize {
        self.values.len()
    }

    /// Sparse matrix-vector multiply: y = A * x.
    pub fn mul_vec(&self, x: &[f64]) -> Vec<f64> {
        assert_eq!(x.len(), self.cols, "SpMV: vector length must match cols");
        let mut y = vec![0.0f64; self.rows];
        for i in 0..self.rows {
            let mut sum = 0.0;
            for k in self.row_ptrs[i]..self.row_ptrs[i + 1] {
                sum += self.values[k] * x[self.col_indices[k]];
            }
            y[i] = sum;
        }
        y
    }

    /// Sparse matrix-dense matrix multiply: C = A * B (B is row-major dense).
    pub fn mul_dense(&self, b_rows: usize, b_cols: usize, b: &[f64]) -> Vec<f64> {
        assert_eq!(
            b_rows, self.cols,
            "SpMM: inner dimension mismatch"
        );
        let mut c = vec![0.0f64; self.rows * b_cols];
        for i in 0..self.rows {
            for k in self.row_ptrs[i]..self.row_ptrs[i + 1] {
                let col = self.col_indices[k];
                let val = self.values[k];
                for j in 0..b_cols {
                    c[i * b_cols + j] += val * b[col * b_cols + j];
                }
            }
        }
        c
    }

    /// Convert to dense row-major Value::Matrix.
    pub fn to_dense(&self) -> Value {
        let mut data = vec![0.0f64; self.rows * self.cols];
        for i in 0..self.rows {
            for k in self.row_ptrs[i]..self.row_ptrs[i + 1] {
                data[i * self.cols + self.col_indices[k]] = self.values[k];
            }
        }
        Value::Matrix {
            rows: self.rows,
            cols: self.cols,
            data,
        }
    }

    /// Convert to COO format.
    pub fn to_coo(&self) -> CooMatrix {
        let nnz = self.nnz();
        let mut coo = CooMatrix::with_capacity(self.rows, self.cols, nnz);
        for i in 0..self.rows {
            for k in self.row_ptrs[i]..self.row_ptrs[i + 1] {
                coo.push(i, self.col_indices[k], self.values[k]);
            }
        }
        coo
    }

    /// Transpose: return CSR of Aᵀ.
    pub fn transpose(&self) -> CsrMatrix {
        self.to_coo().to_csc().to_csr_transposed()
    }

    /// Get the diagonal as a vector.
    pub fn diagonal(&self) -> Vec<f64> {
        let min_dim = self.rows.min(self.cols);
        let mut diag = vec![0.0; min_dim];
        for i in 0..min_dim {
            for k in self.row_ptrs[i]..self.row_ptrs[i + 1] {
                if self.col_indices[k] == i {
                    diag[i] = self.values[k];
                    break;
                }
            }
        }
        diag
    }
}

// ── CSC operations ───────────────────────────────────────────────────────

impl CscMatrix {
    /// Number of stored non-zeros.
    pub fn nnz(&self) -> usize {
        self.values.len()
    }

    /// Convert CSC to CSR (effectively transpose-transpose).
    fn to_csr_transposed(&self) -> CsrMatrix {
        // CSC of A is CSR of Aᵀ — just rename fields
        CsrMatrix {
            rows: self.cols,
            cols: self.rows,
            row_ptrs: self.col_ptrs.clone(),
            col_indices: self.row_indices.clone(),
            values: self.values.clone(),
        }
    }

    /// Convert to dense row-major Value::Matrix.
    pub fn to_dense(&self) -> Value {
        let mut data = vec![0.0f64; self.rows * self.cols];
        for j in 0..self.cols {
            for k in self.col_ptrs[j]..self.col_ptrs[j + 1] {
                data[self.row_indices[k] * self.cols + j] = self.values[k];
            }
        }
        Value::Matrix {
            rows: self.rows,
            cols: self.cols,
            data,
        }
    }

    /// Sparse matrix-vector multiply: y = A * x.
    pub fn mul_vec(&self, x: &[f64]) -> Vec<f64> {
        assert_eq!(x.len(), self.cols, "CSC SpMV: vector length must match cols");
        let mut y = vec![0.0f64; self.rows];
        for j in 0..self.cols {
            let xj = x[j];
            for k in self.col_ptrs[j]..self.col_ptrs[j + 1] {
                y[self.row_indices[k]] += self.values[k] * xj;
            }
        }
        y
    }
}

// ── BSR operations ───────────────────────────────────────────────────────

impl BsrMatrix {
    /// Total matrix rows.
    pub fn total_rows(&self) -> usize {
        self.block_rows * self.block_size
    }

    /// Total matrix cols.
    pub fn total_cols(&self) -> usize {
        self.block_cols * self.block_size
    }

    /// Number of stored blocks.
    pub fn num_blocks(&self) -> usize {
        self.col_indices.len()
    }

    /// Convert to dense row-major Value::Matrix.
    pub fn to_dense(&self) -> Value {
        let tr = self.total_rows();
        let tc = self.total_cols();
        let bs = self.block_size;
        let mut data = vec![0.0f64; tr * tc];

        for br in 0..self.block_rows {
            for idx in self.row_ptrs[br]..self.row_ptrs[br + 1] {
                let bc = self.col_indices[idx];
                let block_start = idx * bs * bs;
                for bi in 0..bs {
                    for bj in 0..bs {
                        let global_row = br * bs + bi;
                        let global_col = bc * bs + bj;
                        data[global_row * tc + global_col] =
                            self.values[block_start + bi * bs + bj];
                    }
                }
            }
        }

        Value::Matrix {
            rows: tr,
            cols: tc,
            data,
        }
    }

    /// Sparse block matrix-vector multiply: y = A * x.
    pub fn mul_vec(&self, x: &[f64]) -> Vec<f64> {
        let tr = self.total_rows();
        let tc = self.total_cols();
        let bs = self.block_size;
        assert_eq!(x.len(), tc, "BSR SpMV: vector length must match total cols");
        let mut y = vec![0.0f64; tr];

        for br in 0..self.block_rows {
            for idx in self.row_ptrs[br]..self.row_ptrs[br + 1] {
                let bc = self.col_indices[idx];
                let block_start = idx * bs * bs;
                for bi in 0..bs {
                    let global_row = br * bs + bi;
                    let mut sum = 0.0;
                    for bj in 0..bs {
                        let global_col = bc * bs + bj;
                        sum += self.values[block_start + bi * bs + bj] * x[global_col];
                    }
                    y[global_row] += sum;
                }
            }
        }
        y
    }
}

// ── Dense to sparse conversion ──────────────────────────────────────────

/// Convert a dense row-major matrix to COO format, dropping entries below threshold.
pub fn dense_to_coo(rows: usize, cols: usize, data: &[f64], drop_threshold: f64) -> CooMatrix {
    let mut coo = CooMatrix::new(rows, cols);
    for i in 0..rows {
        for j in 0..cols {
            let v = data[i * cols + j];
            if v.abs() > drop_threshold {
                coo.push(i, j, v);
            }
        }
    }
    coo
}

/// Convert a dense row-major matrix to CSR format.
pub fn dense_to_csr(rows: usize, cols: usize, data: &[f64], drop_threshold: f64) -> CsrMatrix {
    dense_to_coo(rows, cols, data, drop_threshold).to_csr()
}

/// Create a sparse identity matrix in CSR format.
pub fn sparse_identity(n: usize) -> CsrMatrix {
    CsrMatrix {
        rows: n,
        cols: n,
        row_ptrs: (0..=n).collect(),
        col_indices: (0..n).collect(),
        values: vec![1.0; n],
    }
}

/// Create a sparse diagonal matrix in CSR format.
pub fn sparse_diagonal(diag: &[f64]) -> CsrMatrix {
    let n = diag.len();
    CsrMatrix {
        rows: n,
        cols: n,
        row_ptrs: (0..=n).collect(),
        col_indices: (0..n).collect(),
        values: diag.to_vec(),
    }
}

/// Sparsity ratio: nnz / (rows * cols).
pub fn sparsity_ratio(rows: usize, cols: usize, nnz: usize) -> f64 {
    let total = rows * cols;
    if total == 0 {
        return 0.0;
    }
    1.0 - (nnz as f64 / total as f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn approx_eq(a: f64, b: f64, tol: f64) -> bool {
        (a - b).abs() < tol
    }

    #[test]
    fn test_coo_to_csr_identity() {
        let mut coo = CooMatrix::new(3, 3);
        coo.push(0, 0, 1.0);
        coo.push(1, 1, 1.0);
        coo.push(2, 2, 1.0);
        let csr = coo.to_csr();
        assert_eq!(csr.nnz(), 3);
        assert_eq!(csr.row_ptrs, vec![0, 1, 2, 3]);
        assert_eq!(csr.col_indices, vec![0, 1, 2]);
    }

    #[test]
    fn test_coo_duplicate_summed() {
        let mut coo = CooMatrix::new(2, 2);
        coo.push(0, 0, 3.0);
        coo.push(0, 0, 4.0); // duplicate
        coo.push(1, 1, 5.0);
        let csr = coo.to_csr();
        assert_eq!(csr.nnz(), 2);
        assert!(approx_eq(csr.values[0], 7.0, 1e-10)); // 3 + 4
        assert!(approx_eq(csr.values[1], 5.0, 1e-10));
    }

    #[test]
    fn test_csr_spmv() {
        // [[2, 0, 1], [0, 3, 0]] * [1, 2, 3] = [5, 6]
        let mut coo = CooMatrix::new(2, 3);
        coo.push(0, 0, 2.0);
        coo.push(0, 2, 1.0);
        coo.push(1, 1, 3.0);
        let csr = coo.to_csr();
        let x = vec![1.0, 2.0, 3.0];
        let y = csr.mul_vec(&x);
        assert!(approx_eq(y[0], 5.0, 1e-10));
        assert!(approx_eq(y[1], 6.0, 1e-10));
    }

    #[test]
    fn test_csc_spmv() {
        let mut coo = CooMatrix::new(2, 3);
        coo.push(0, 0, 2.0);
        coo.push(0, 2, 1.0);
        coo.push(1, 1, 3.0);
        let csc = coo.to_csc();
        let x = vec![1.0, 2.0, 3.0];
        let y = csc.mul_vec(&x);
        assert!(approx_eq(y[0], 5.0, 1e-10));
        assert!(approx_eq(y[1], 6.0, 1e-10));
    }

    #[test]
    fn test_csr_to_dense() {
        let csr = sparse_identity(3);
        match csr.to_dense() {
            Value::Matrix { rows, cols, data } => {
                assert_eq!(rows, 3);
                assert_eq!(cols, 3);
                assert!(approx_eq(data[0], 1.0, 1e-10));
                assert!(approx_eq(data[4], 1.0, 1e-10));
                assert!(approx_eq(data[8], 1.0, 1e-10));
                assert!(approx_eq(data[1], 0.0, 1e-10));
            }
            _ => panic!("Expected Matrix"),
        }
    }

    #[test]
    fn test_dense_to_coo_threshold() {
        let data = vec![1.0, 0.001, 0.0, 2.0];
        let coo = dense_to_coo(2, 2, &data, 0.01);
        assert_eq!(coo.nnz(), 2); // 0.001 dropped
    }

    #[test]
    fn test_bsr_to_dense() {
        // 2x2 blocks, 2x2 block grid = 4x4 matrix
        // Block (0,0) = [[1,2],[3,4]], Block (1,1) = [[5,6],[7,8]]
        let bsr = BsrMatrix {
            block_rows: 2,
            block_cols: 2,
            block_size: 2,
            row_ptrs: vec![0, 1, 2],
            col_indices: vec![0, 1],
            values: vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0],
        };
        match bsr.to_dense() {
            Value::Matrix { rows, cols, data } => {
                assert_eq!(rows, 4);
                assert_eq!(cols, 4);
                assert!(approx_eq(data[0], 1.0, 1e-10)); // (0,0)
                assert!(approx_eq(data[1], 2.0, 1e-10)); // (0,1)
                assert!(approx_eq(data[4], 3.0, 1e-10)); // (1,0)
                assert!(approx_eq(data[5], 4.0, 1e-10)); // (1,1)
                assert!(approx_eq(data[10], 5.0, 1e-10)); // (2,2)
                assert!(approx_eq(data[15], 8.0, 1e-10)); // (3,3)
                assert!(approx_eq(data[2], 0.0, 1e-10)); // (0,2) = 0
            }
            _ => panic!("Expected Matrix"),
        }
    }

    #[test]
    fn test_bsr_spmv() {
        // Same BSR as above, x = [1,1,1,1]
        let bsr = BsrMatrix {
            block_rows: 2,
            block_cols: 2,
            block_size: 2,
            row_ptrs: vec![0, 1, 2],
            col_indices: vec![0, 1],
            values: vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0],
        };
        let x = vec![1.0, 1.0, 1.0, 1.0];
        let y = bsr.mul_vec(&x);
        // Row 0: 1+2 = 3, Row 1: 3+4 = 7, Row 2: 5+6 = 11, Row 3: 7+8 = 15
        assert!(approx_eq(y[0], 3.0, 1e-10));
        assert!(approx_eq(y[1], 7.0, 1e-10));
        assert!(approx_eq(y[2], 11.0, 1e-10));
        assert!(approx_eq(y[3], 15.0, 1e-10));
    }

    #[test]
    fn test_sparse_identity() {
        let id = sparse_identity(4);
        assert_eq!(id.nnz(), 4);
        let y = id.mul_vec(&[1.0, 2.0, 3.0, 4.0]);
        assert!(approx_eq(y[0], 1.0, 1e-10));
        assert!(approx_eq(y[3], 4.0, 1e-10));
    }

    #[test]
    fn test_sparse_diagonal() {
        let d = sparse_diagonal(&[2.0, 3.0, 4.0]);
        let y = d.mul_vec(&[1.0, 1.0, 1.0]);
        assert!(approx_eq(y[0], 2.0, 1e-10));
        assert!(approx_eq(y[1], 3.0, 1e-10));
        assert!(approx_eq(y[2], 4.0, 1e-10));
    }

    #[test]
    fn test_csr_diagonal() {
        let mut coo = CooMatrix::new(3, 3);
        coo.push(0, 0, 5.0);
        coo.push(0, 1, 2.0);
        coo.push(1, 1, 7.0);
        coo.push(2, 0, 1.0);
        coo.push(2, 2, 9.0);
        let csr = coo.to_csr();
        let diag = csr.diagonal();
        assert!(approx_eq(diag[0], 5.0, 1e-10));
        assert!(approx_eq(diag[1], 7.0, 1e-10));
        assert!(approx_eq(diag[2], 9.0, 1e-10));
    }

    #[test]
    fn test_sparsity_ratio() {
        assert!(approx_eq(sparsity_ratio(100, 100, 100), 0.99, 1e-10));
        assert!(approx_eq(sparsity_ratio(100, 100, 10000), 0.0, 1e-10));
    }

    #[test]
    fn test_csr_mul_dense() {
        // [[2, 0], [0, 3]] * [[1, 2], [3, 4]] = [[2, 4], [9, 12]]
        let mut coo = CooMatrix::new(2, 2);
        coo.push(0, 0, 2.0);
        coo.push(1, 1, 3.0);
        let csr = coo.to_csr();
        let b = vec![1.0, 2.0, 3.0, 4.0]; // row-major 2x2
        let c = csr.mul_dense(2, 2, &b);
        assert!(approx_eq(c[0], 2.0, 1e-10));
        assert!(approx_eq(c[1], 4.0, 1e-10));
        assert!(approx_eq(c[2], 9.0, 1e-10));
        assert!(approx_eq(c[3], 12.0, 1e-10));
    }

    #[test]
    fn test_roundtrip_coo_csr_coo() {
        let mut coo = CooMatrix::new(3, 3);
        coo.push(0, 0, 1.0);
        coo.push(0, 2, 3.0);
        coo.push(1, 1, 2.0);
        coo.push(2, 0, 4.0);
        coo.push(2, 2, 5.0);

        let csr = coo.to_csr();
        let coo2 = csr.to_coo();

        assert_eq!(coo2.nnz(), 5);
        // Verify same SpMV result
        let x = vec![1.0, 2.0, 3.0];
        let y1 = csr.mul_vec(&x);
        let csr2 = coo2.to_csr();
        let y2 = csr2.mul_vec(&x);
        for i in 0..3 {
            assert!(approx_eq(y1[i], y2[i], 1e-10));
        }
    }
}
