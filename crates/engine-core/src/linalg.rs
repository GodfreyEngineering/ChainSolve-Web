//! Dense linear algebra module.
//!
//! When the `faer` feature is enabled, large matrices (>64×64) dispatch to
//! the `faer` crate for high-performance decompositions and solves.
//! Small matrices use hand-rolled routines to avoid allocation overhead.

use crate::types::Value;

/// Threshold above which we dispatch to faer (when enabled).
#[cfg(feature = "faer")]
const FAER_THRESHOLD: usize = 64;

/// Whether a matrix dimension warrants dispatching to faer.
#[cfg(feature = "faer")]
#[inline]
fn use_faer(n: usize, m: usize) -> bool {
    n > FAER_THRESHOLD || m > FAER_THRESHOLD
}

// ── Helper: row-major data ↔ faer Mat ────────────────────────────────────

#[cfg(feature = "faer")]
mod faer_impl {
    use faer::linalg::solvers::{DenseSolveCore, Solve, SolveLstsq};
    use faer::Mat;

    /// Convert row-major flat data into a faer `Mat<f64>`.
    pub fn mat_from_row_major(rows: usize, cols: usize, data: &[f64]) -> Mat<f64> {
        Mat::from_fn(rows, cols, |i, j| data[i * cols + j])
    }

    /// Convert a faer `MatRef<'_, f64>` back into row-major flat data.
    pub fn matref_to_row_major(m: faer::MatRef<'_, f64>) -> Vec<f64> {
        let (rows, cols) = (m.nrows(), m.ncols());
        let mut out = Vec::with_capacity(rows * cols);
        for i in 0..rows {
            for j in 0..cols {
                out.push(m[(i, j)]);
            }
        }
        out
    }

    /// Convert a faer `Mat<f64>` back into row-major flat data.
    pub fn mat_to_row_major(m: &Mat<f64>) -> Vec<f64> {
        matref_to_row_major(m.as_ref())
    }

    /// Matrix multiply using faer.
    pub fn multiply(
        ar: usize,
        ac: usize,
        ad: &[f64],
        br: usize,
        bc: usize,
        bd: &[f64],
    ) -> Vec<f64> {
        let a = mat_from_row_major(ar, ac, ad);
        let b = mat_from_row_major(br, bc, bd);
        let c = &a * &b;
        mat_to_row_major(&c)
    }

    /// Determinant via LU decomposition.
    /// det(A) = det(P) * product(diag(U))
    pub fn determinant(n: usize, data: &[f64]) -> f64 {
        let m = mat_from_row_major(n, n, data);
        let lu = m.partial_piv_lu();
        // Compute determinant from L, U, P
        let u = lu.U();
        let mut det = 1.0f64;
        for i in 0..n {
            det *= u[(i, i)];
        }
        // Account for permutation sign
        let p = lu.P();
        let perm_fwd = p.arrays().0;
        let mut sign = 1.0f64;
        let mut visited = vec![false; n];
        for i in 0..n {
            if visited[i] {
                continue;
            }
            let mut j = i;
            let mut cycle_len = 0usize;
            while !visited[j] {
                visited[j] = true;
                j = perm_fwd[j];
                cycle_len += 1;
            }
            if cycle_len % 2 == 0 {
                sign *= -1.0;
            }
        }
        det * sign
    }

    /// Matrix inverse via partial-pivoted LU.
    pub fn inverse(n: usize, data: &[f64]) -> Option<Vec<f64>> {
        let m = mat_from_row_major(n, n, data);
        let lu = m.partial_piv_lu();
        // Check singularity
        let u = lu.U();
        for i in 0..n {
            if u[(i, i)].abs() < 1e-300 {
                return None;
            }
        }
        let inv = lu.inverse();
        Some(mat_to_row_major(&inv))
    }

    /// Solve Ax=b via partial-pivoted LU (or QR for non-square).
    pub fn solve(n: usize, nc: usize, adata: &[f64], bv: &[f64]) -> Option<Vec<f64>> {
        let a = mat_from_row_major(n, nc, adata);
        let b = Mat::from_fn(bv.len(), 1, |i, _| bv[i]);
        if n != nc {
            // Non-square: use QR for least-squares
            let qr = a.col_piv_qr();
            let sol = qr.solve_lstsq(b.as_ref());
            return Some((0..sol.nrows()).map(|i| sol[(i, 0)]).collect());
        }
        let lu = a.partial_piv_lu();
        // Check singularity
        let u = lu.U();
        for i in 0..n {
            if u[(i, i)].abs() < 1e-300 {
                return None;
            }
        }
        let sol = lu.solve(b.as_ref());
        Some((0..sol.nrows()).map(|i| sol[(i, 0)]).collect())
    }

    /// LU decomposition: returns (L, U, P) as row-major data.
    pub fn lu_decompose(n: usize, data: &[f64]) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
        let m = mat_from_row_major(n, n, data);
        let lu = m.partial_piv_lu();
        let l = matref_to_row_major(lu.L());
        let u = matref_to_row_major(lu.U());
        // Build permutation matrix
        let p = lu.P();
        let perm_fwd = p.arrays().0;
        let mut p_mat = vec![0.0; n * n];
        for i in 0..n {
            p_mat[i * n + perm_fwd[i]] = 1.0;
        }
        (l, u, p_mat)
    }

    /// QR decomposition: returns (Q, R) as row-major matrices.
    pub fn qr_decompose(rows: usize, cols: usize, data: &[f64]) -> (Vec<f64>, Vec<f64>) {
        let m = mat_from_row_major(rows, cols, data);
        let qr = m.qr();
        let q = qr.compute_Q();
        let r = matref_to_row_major(qr.R());
        // thin_R gives min(rows,cols)×cols; compute_Q gives rows×min(rows,cols)
        (mat_to_row_major(&q), r)
    }

    /// SVD: returns (U, S_vec, V) where S_vec is the singular values vector.
    pub fn svd(
        rows: usize,
        cols: usize,
        data: &[f64],
    ) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
        let m = mat_from_row_major(rows, cols, data);
        match m.svd() {
            Ok(svd_result) => {
                let u = matref_to_row_major(svd_result.U());
                let v = matref_to_row_major(svd_result.V());
                let s_diag = svd_result.S();
                let min_dim = rows.min(cols);
                let s_vec: Vec<f64> = (0..min_dim).map(|i| s_diag[i]).collect();
                (u, s_vec, v)
            }
            Err(_) => {
                // SVD failed — return zeros
                (
                    vec![0.0; rows * rows],
                    vec![0.0; rows.min(cols)],
                    vec![0.0; cols * cols],
                )
            }
        }
    }

    /// Cholesky decomposition: returns L such that A = L×Lᵀ.
    /// Returns None if matrix is not positive definite.
    pub fn cholesky(n: usize, data: &[f64]) -> Option<Vec<f64>> {
        let m = mat_from_row_major(n, n, data);
        match m.llt(faer::Side::Lower) {
            Ok(llt) => {
                let l = matref_to_row_major(llt.L());
                Some(l)
            }
            Err(_) => None,
        }
    }

    /// Eigendecomposition: returns (eigenvalues_re, eigenvalues_im, eigenvectors_re).
    pub fn eigendecompose(n: usize, data: &[f64]) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
        let m = mat_from_row_major(n, n, data);
        // Check if symmetric
        let is_symmetric = (0..n).all(|i| {
            (i + 1..n).all(|j| (data[i * n + j] - data[j * n + i]).abs() < 1e-12)
        });

        if is_symmetric {
            match m.self_adjoint_eigen(faer::Side::Lower) {
                Ok(eig) => {
                    let s = eig.S();
                    let u = eig.U();
                    let vals_re: Vec<f64> = (0..n).map(|i| s[i]).collect();
                    let vals_im = vec![0.0; n];
                    (vals_re, vals_im, matref_to_row_major(u))
                }
                Err(_) => (vec![0.0; n], vec![0.0; n], vec![0.0; n * n]),
            }
        } else {
            match m.eigen() {
                Ok(eig) => {
                    let s = eig.S();
                    let u = eig.U();
                    let vals_re: Vec<f64> = (0..n).map(|i| s[i].re).collect();
                    let vals_im: Vec<f64> = (0..n).map(|i| s[i].im).collect();
                    // Take real part of eigenvectors
                    let mut evec_data = Vec::with_capacity(n * n);
                    for i in 0..n {
                        for j in 0..n {
                            evec_data.push(u[(i, j)].re);
                        }
                    }
                    (vals_re, vals_im, evec_data)
                }
                Err(_) => (vec![0.0; n], vec![0.0; n], vec![0.0; n * n]),
            }
        }
    }

    /// Condition number (2-norm) via SVD: max(σ) / min(σ).
    pub fn condition_number(rows: usize, cols: usize, data: &[f64]) -> f64 {
        let m = mat_from_row_major(rows, cols, data);
        match m.svd() {
            Ok(svd_result) => {
                let s = svd_result.S();
                let min_dim = rows.min(cols);
                if min_dim == 0 {
                    return f64::INFINITY;
                }
                let mut smax = 0.0f64;
                let mut smin = f64::INFINITY;
                for i in 0..min_dim {
                    let sv = s[i].abs();
                    if sv > smax {
                        smax = sv;
                    }
                    if sv < smin {
                        smin = sv;
                    }
                }
                if smin < 1e-300 {
                    f64::INFINITY
                } else {
                    smax / smin
                }
            }
            Err(_) => f64::INFINITY,
        }
    }
}

// ── Fallback: hand-rolled for small matrices or when faer not enabled ────

mod small_impl {
    /// Naive matrix multiply (row-major) with ikj loop order for better cache.
    pub fn multiply(
        ar: usize,
        ac: usize,
        ad: &[f64],
        _br: usize,
        bc: usize,
        bd: &[f64],
    ) -> Vec<f64> {
        let mut out = vec![0.0f64; ar * bc];
        for i in 0..ar {
            for k in 0..ac {
                let a_ik = ad[i * ac + k];
                for j in 0..bc {
                    out[i * bc + j] += a_ik * bd[k * bc + j];
                }
            }
        }
        out
    }

    /// Determinant via Gaussian elimination with partial pivoting.
    pub fn determinant(n: usize, data: &[f64]) -> f64 {
        let mut a = data.to_vec();
        let mut det = 1.0f64;
        for col in 0..n {
            let pivot_row = (col..n)
                .max_by(|&i, &j| {
                    a[i * n + col]
                        .abs()
                        .partial_cmp(&a[j * n + col].abs())
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
                .unwrap_or(col);
            if a[pivot_row * n + col].abs() < 1e-300 {
                return 0.0;
            }
            if pivot_row != col {
                for j in 0..n {
                    a.swap(col * n + j, pivot_row * n + j);
                }
                det *= -1.0;
            }
            det *= a[col * n + col];
            let piv = a[col * n + col];
            for row in col + 1..n {
                let factor = a[row * n + col] / piv;
                for j in col..n {
                    let v = a[col * n + j];
                    a[row * n + j] -= factor * v;
                }
            }
        }
        det
    }

    /// Matrix inverse via Gauss-Jordan elimination.
    pub fn inverse(n: usize, data: &[f64]) -> Option<Vec<f64>> {
        let mut a = data.to_vec();
        let mut inv: Vec<f64> = (0..n * n)
            .map(|i| if i / n == i % n { 1.0 } else { 0.0 })
            .collect();
        for col in 0..n {
            let pivot = (col..n)
                .max_by(|&i, &j| {
                    a[i * n + col]
                        .abs()
                        .partial_cmp(&a[j * n + col].abs())
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
                .unwrap_or(col);
            if a[pivot * n + col].abs() < 1e-300 {
                return None;
            }
            if pivot != col {
                for j in 0..n {
                    a.swap(col * n + j, pivot * n + j);
                    inv.swap(col * n + j, pivot * n + j);
                }
            }
            let piv = a[col * n + col];
            for j in 0..n {
                a[col * n + j] /= piv;
                inv[col * n + j] /= piv;
            }
            for row in 0..n {
                if row == col {
                    continue;
                }
                let f = a[row * n + col];
                for j in 0..n {
                    let av = a[col * n + j];
                    let iv = inv[col * n + j];
                    a[row * n + j] -= f * av;
                    inv[row * n + j] -= f * iv;
                }
            }
        }
        Some(inv)
    }

    /// Solve Ax=b via Gauss-Jordan elimination.
    pub fn solve(n: usize, nc: usize, adata: &[f64], bv: &[f64]) -> Option<Vec<f64>> {
        let m = nc;
        let mut aug: Vec<f64> = Vec::with_capacity(n * (m + 1));
        for i in 0..n {
            aug.extend_from_slice(&adata[i * m..(i + 1) * m]);
            aug.push(bv[i]);
        }
        let cols1 = m + 1;
        for col in 0..m.min(n) {
            let pivot = (col..n)
                .max_by(|&i, &j| {
                    aug[i * cols1 + col]
                        .abs()
                        .partial_cmp(&aug[j * cols1 + col].abs())
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
                .unwrap_or(col);
            if aug[pivot * cols1 + col].abs() < 1e-300 {
                return None;
            }
            if pivot != col {
                for j in 0..cols1 {
                    aug.swap(col * cols1 + j, pivot * cols1 + j);
                }
            }
            let piv = aug[col * cols1 + col];
            for j in col..cols1 {
                aug[col * cols1 + j] /= piv;
            }
            for row in 0..n {
                if row == col {
                    continue;
                }
                let f = aug[row * cols1 + col];
                for j in col..cols1 {
                    let v = aug[col * cols1 + j];
                    aug[row * cols1 + j] -= f * v;
                }
            }
        }
        Some(
            (0..m)
                .map(|i| if i < n { aug[i * cols1 + m] } else { 0.0 })
                .collect(),
        )
    }

    /// LU decomposition (Doolittle's method with partial pivoting).
    pub fn lu_decompose(n: usize, data: &[f64]) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
        let mut u = data.to_vec();
        let mut l: Vec<f64> = vec![0.0; n * n];
        let mut perm: Vec<usize> = (0..n).collect();

        for col in 0..n {
            let pivot = (col..n)
                .max_by(|&i, &j| {
                    u[i * n + col]
                        .abs()
                        .partial_cmp(&u[j * n + col].abs())
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
                .unwrap_or(col);
            if pivot != col {
                perm.swap(col, pivot);
                for j in 0..n {
                    u.swap(col * n + j, pivot * n + j);
                }
                for j in 0..col {
                    l.swap(col * n + j, pivot * n + j);
                }
            }
            l[col * n + col] = 1.0;
            let piv = u[col * n + col];
            if piv.abs() < 1e-300 {
                continue;
            }
            for row in col + 1..n {
                let factor = u[row * n + col] / piv;
                l[row * n + col] = factor;
                for j in col..n {
                    let v = u[col * n + j];
                    u[row * n + j] -= factor * v;
                }
            }
        }

        let mut p = vec![0.0; n * n];
        for i in 0..n {
            p[i * n + perm[i]] = 1.0;
        }

        (l, u, p)
    }

    /// QR decomposition via modified Gram-Schmidt.
    pub fn qr_decompose(rows: usize, cols: usize, data: &[f64]) -> (Vec<f64>, Vec<f64>) {
        let min_dim = rows.min(cols);
        let mut q = vec![0.0; rows * min_dim];
        let mut r = vec![0.0; min_dim * cols];

        let mut v_cols: Vec<Vec<f64>> =
            (0..cols).map(|j| (0..rows).map(|i| data[i * cols + j]).collect()).collect();

        for j in 0..min_dim {
            let norm: f64 = v_cols[j].iter().map(|x| x * x).sum::<f64>().sqrt();
            if norm < 1e-300 {
                continue;
            }
            for i in 0..rows {
                q[i * min_dim + j] = v_cols[j][i] / norm;
            }
            r[j * cols + j] = norm;

            for k in j + 1..cols {
                let dot: f64 = (0..rows).map(|i| q[i * min_dim + j] * v_cols[k][i]).sum();
                r[j * cols + k] = dot;
                for i in 0..rows {
                    v_cols[k][i] -= dot * q[i * min_dim + j];
                }
            }
        }

        (q, r)
    }

    /// SVD via A^T A eigendecomposition (suitable for small matrices).
    pub fn svd(rows: usize, cols: usize, data: &[f64]) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
        let n = cols;
        let m = rows;
        let mut ata = vec![0.0; n * n];
        for i in 0..n {
            for j in 0..n {
                let mut s = 0.0;
                for k in 0..m {
                    s += data[k * n + i] * data[k * n + j];
                }
                ata[i * n + j] = s;
            }
        }

        let (eigenvals, v_mat) = symmetric_eigen(n, &ata);

        let mut indices: Vec<usize> = (0..n).collect();
        indices.sort_by(|&a, &b| {
            eigenvals[b]
                .partial_cmp(&eigenvals[a])
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let min_dim = m.min(n);
        let sigma: Vec<f64> = indices
            .iter()
            .take(min_dim)
            .map(|&i| {
                if eigenvals[i] > 0.0 {
                    eigenvals[i].sqrt()
                } else {
                    0.0
                }
            })
            .collect();

        let mut v = vec![0.0; n * n];
        for (new_j, &old_j) in indices.iter().enumerate() {
            for i in 0..n {
                v[i * n + new_j] = v_mat[i * n + old_j];
            }
        }

        let mut u = vec![0.0; m * m];
        for j in 0..min_dim {
            if sigma[j] < 1e-300 {
                continue;
            }
            for i in 0..m {
                let mut s = 0.0;
                for k in 0..n {
                    s += data[i * n + k] * v[k * n + j];
                }
                u[i * m + j] = s / sigma[j];
            }
        }
        for j in min_dim..m {
            u[j * m + j] = 1.0;
        }

        (u, sigma, v)
    }

    /// Symmetric eigendecomposition via Jacobi iteration.
    pub fn symmetric_eigen(n: usize, data: &[f64]) -> (Vec<f64>, Vec<f64>) {
        let mut a = data.to_vec();
        let mut v: Vec<f64> = (0..n * n)
            .map(|i| if i / n == i % n { 1.0 } else { 0.0 })
            .collect();

        let max_iter = 100 * n * n;
        for _ in 0..max_iter {
            let mut max_val = 0.0f64;
            let mut p = 0;
            let mut q = 1;
            for i in 0..n {
                for j in i + 1..n {
                    let val = a[i * n + j].abs();
                    if val > max_val {
                        max_val = val;
                        p = i;
                        q = j;
                    }
                }
            }
            if max_val < 1e-12 {
                break;
            }

            let app = a[p * n + p];
            let aqq = a[q * n + q];
            let apq = a[p * n + q];
            let theta = if (app - aqq).abs() < 1e-300 {
                std::f64::consts::FRAC_PI_4
            } else {
                0.5 * (2.0 * apq / (app - aqq)).atan()
            };
            let c = theta.cos();
            let s = theta.sin();

            let mut new_a = a.clone();
            for i in 0..n {
                new_a[i * n + p] = c * a[i * n + p] + s * a[i * n + q];
                new_a[i * n + q] = -s * a[i * n + p] + c * a[i * n + q];
            }
            a = new_a.clone();
            for j in 0..n {
                a[p * n + j] = c * new_a[p * n + j] + s * new_a[q * n + j];
                a[q * n + j] = -s * new_a[p * n + j] + c * new_a[q * n + j];
            }

            let mut new_v = v.clone();
            for i in 0..n {
                new_v[i * n + p] = c * v[i * n + p] + s * v[i * n + q];
                new_v[i * n + q] = -s * v[i * n + p] + c * v[i * n + q];
            }
            v = new_v;
        }

        let eigenvalues: Vec<f64> = (0..n).map(|i| a[i * n + i]).collect();
        (eigenvalues, v)
    }

    /// Cholesky decomposition: A = L L^T.
    pub fn cholesky(n: usize, data: &[f64]) -> Option<Vec<f64>> {
        let mut l = vec![0.0; n * n];
        for j in 0..n {
            let mut sum = 0.0;
            for k in 0..j {
                sum += l[j * n + k] * l[j * n + k];
            }
            let diag = data[j * n + j] - sum;
            if diag <= 0.0 {
                return None;
            }
            l[j * n + j] = diag.sqrt();
            for i in j + 1..n {
                let mut sum = 0.0;
                for k in 0..j {
                    sum += l[i * n + k] * l[j * n + k];
                }
                l[i * n + j] = (data[i * n + j] - sum) / l[j * n + j];
            }
        }
        Some(l)
    }

    /// Condition number (2-norm) via SVD.
    pub fn condition_number(rows: usize, cols: usize, data: &[f64]) -> f64 {
        let (_u, sigma, _v) = svd(rows, cols, data);
        if sigma.is_empty() {
            return f64::INFINITY;
        }
        let smax = sigma.iter().cloned().fold(0.0f64, f64::max);
        let smin = sigma
            .iter()
            .cloned()
            .filter(|&s| s > 1e-300)
            .fold(f64::INFINITY, f64::min);
        if smin == f64::INFINITY || smin < 1e-300 {
            f64::INFINITY
        } else {
            smax / smin
        }
    }
}

// ── Public API: dispatch to faer or small_impl ──────────────────────────

/// Matrix multiply C = A×B. Returns Value::Matrix.
pub fn matrix_multiply(
    ar: usize,
    ac: usize,
    ad: &[f64],
    br: usize,
    bc: usize,
    bd: &[f64],
) -> Value {
    if ac != br {
        return Value::error(format!(
            "matrix_multiply: inner dims mismatch {}x{} * {}x{}",
            ar, ac, br, bc
        ));
    }
    #[cfg(feature = "faer")]
    let data = if use_faer(ar.max(ac), br.max(bc)) {
        faer_impl::multiply(ar, ac, ad, br, bc, bd)
    } else {
        small_impl::multiply(ar, ac, ad, br, bc, bd)
    };
    #[cfg(not(feature = "faer"))]
    let data = small_impl::multiply(ar, ac, ad, br, bc, bd);

    Value::Matrix {
        rows: ar,
        cols: bc,
        data,
    }
}

/// Determinant of square matrix.
pub fn matrix_det(n: usize, data: &[f64]) -> f64 {
    #[cfg(feature = "faer")]
    if use_faer(n, n) {
        return faer_impl::determinant(n, data);
    }
    small_impl::determinant(n, data)
}

/// Matrix inverse. Returns None if singular.
pub fn matrix_inverse(n: usize, data: &[f64]) -> Option<Vec<f64>> {
    #[cfg(feature = "faer")]
    if use_faer(n, n) {
        return faer_impl::inverse(n, data);
    }
    small_impl::inverse(n, data)
}

/// Solve Ax=b. Returns None if singular.
pub fn matrix_solve(n: usize, nc: usize, adata: &[f64], bv: &[f64]) -> Option<Vec<f64>> {
    #[cfg(feature = "faer")]
    if use_faer(n, nc) {
        return faer_impl::solve(n, nc, adata, bv);
    }
    small_impl::solve(n, nc, adata, bv)
}

/// LU decomposition: returns (L, U, P) as row-major n×n matrices.
pub fn lu_decompose(n: usize, data: &[f64]) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
    #[cfg(feature = "faer")]
    if use_faer(n, n) {
        return faer_impl::lu_decompose(n, data);
    }
    small_impl::lu_decompose(n, data)
}

/// QR decomposition: returns (Q, R) as row-major matrices.
pub fn qr_decompose(rows: usize, cols: usize, data: &[f64]) -> (Vec<f64>, Vec<f64>) {
    #[cfg(feature = "faer")]
    if use_faer(rows, cols) {
        return faer_impl::qr_decompose(rows, cols, data);
    }
    small_impl::qr_decompose(rows, cols, data)
}

/// SVD: returns (U, singular_values, V).
pub fn svd(rows: usize, cols: usize, data: &[f64]) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
    #[cfg(feature = "faer")]
    if use_faer(rows, cols) {
        return faer_impl::svd(rows, cols, data);
    }
    small_impl::svd(rows, cols, data)
}

/// Cholesky decomposition: A = L Lᵀ. Returns None if not positive definite.
pub fn cholesky(n: usize, data: &[f64]) -> Option<Vec<f64>> {
    #[cfg(feature = "faer")]
    if use_faer(n, n) {
        return faer_impl::cholesky(n, data);
    }
    small_impl::cholesky(n, data)
}

/// Eigendecomposition: returns (eigenvalues_re, eigenvalues_im, eigenvectors_row_major).
#[cfg(feature = "faer")]
pub fn eigendecompose(n: usize, data: &[f64]) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
    faer_impl::eigendecompose(n, data)
}

/// Eigendecomposition fallback for symmetric matrices only (without faer).
#[cfg(not(feature = "faer"))]
pub fn eigendecompose(n: usize, data: &[f64]) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
    let (vals, vecs) = small_impl::symmetric_eigen(n, data);
    (vals, vec![0.0; n], vecs)
}

/// Condition number (2-norm) = σ_max / σ_min.
pub fn condition_number(rows: usize, cols: usize, data: &[f64]) -> f64 {
    #[cfg(feature = "faer")]
    if use_faer(rows, cols) {
        return faer_impl::condition_number(rows, cols, data);
    }
    small_impl::condition_number(rows, cols, data)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn approx_eq(a: f64, b: f64, tol: f64) -> bool {
        (a - b).abs() < tol
    }

    #[test]
    fn test_multiply_small() {
        let a = vec![1.0, 2.0, 3.0, 4.0];
        let b = vec![5.0, 6.0, 7.0, 8.0];
        match matrix_multiply(2, 2, &a, 2, 2, &b) {
            Value::Matrix { rows, cols, data } => {
                assert_eq!(rows, 2);
                assert_eq!(cols, 2);
                assert!(approx_eq(data[0], 19.0, 1e-10));
                assert!(approx_eq(data[1], 22.0, 1e-10));
                assert!(approx_eq(data[2], 43.0, 1e-10));
                assert!(approx_eq(data[3], 50.0, 1e-10));
            }
            _ => panic!("Expected Matrix"),
        }
    }

    #[test]
    fn test_det_3x3() {
        let data = vec![6.0, 1.0, 1.0, 4.0, -2.0, 5.0, 2.0, 8.0, 7.0];
        let d = matrix_det(3, &data);
        assert!(approx_eq(d, -306.0, 1e-8));
    }

    #[test]
    fn test_inverse_2x2() {
        let data = vec![4.0, 7.0, 2.0, 6.0];
        let inv = matrix_inverse(2, &data).expect("should be invertible");
        assert!(approx_eq(inv[0], 0.6, 1e-10));
        assert!(approx_eq(inv[1], -0.7, 1e-10));
        assert!(approx_eq(inv[2], -0.2, 1e-10));
        assert!(approx_eq(inv[3], 0.4, 1e-10));
    }

    #[test]
    fn test_inverse_singular() {
        let data = vec![1.0, 2.0, 2.0, 4.0];
        assert!(matrix_inverse(2, &data).is_none());
    }

    #[test]
    fn test_solve_identity() {
        let data = vec![1.0, 0.0, 0.0, 1.0];
        let b = vec![3.0, 4.0];
        let x = matrix_solve(2, 2, &data, &b).expect("should solve");
        assert!(approx_eq(x[0], 3.0, 1e-10));
        assert!(approx_eq(x[1], 4.0, 1e-10));
    }

    #[test]
    fn test_lu_identity() {
        let data = vec![1.0, 0.0, 0.0, 1.0];
        let (l, u, p) = lu_decompose(2, &data);
        assert!(approx_eq(l[0], 1.0, 1e-10));
        assert!(approx_eq(u[0], 1.0, 1e-10));
        assert!(approx_eq(p[0], 1.0, 1e-10));
    }

    #[test]
    fn test_qr_upper_triangular_r() {
        let data = vec![1.0, 1.0, 0.0, 1.0];
        let (q, r) = qr_decompose(2, 2, &data);
        // R should be upper triangular
        assert!(approx_eq(r[1 * 2 + 0], 0.0, 1e-10));
        // Q columns should be orthonormal
        let q00 = q[0] * q[0] + q[2] * q[2];
        assert!(approx_eq(q00, 1.0, 1e-10));
    }

    #[test]
    fn test_cholesky_pd() {
        let data = vec![4.0, 2.0, 2.0, 3.0];
        let l = cholesky(2, &data).expect("should be positive definite");
        assert!(approx_eq(l[0], 2.0, 1e-10));
        assert!(approx_eq(l[1], 0.0, 1e-10));
        assert!(approx_eq(l[2], 1.0, 1e-10));
        assert!(approx_eq(l[3], 2.0f64.sqrt(), 1e-10));
    }

    #[test]
    fn test_cholesky_not_pd() {
        let data = vec![1.0, 2.0, 2.0, 1.0];
        assert!(cholesky(2, &data).is_none());
    }

    #[test]
    fn test_eigendecompose_diagonal() {
        let data = vec![3.0, 0.0, 0.0, 5.0];
        let (vals_re, vals_im, _vecs) = eigendecompose(2, &data);
        let mut sorted = vals_re.clone();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
        assert!(approx_eq(sorted[0], 3.0, 1e-8));
        assert!(approx_eq(sorted[1], 5.0, 1e-8));
        for v in &vals_im {
            assert!(approx_eq(*v, 0.0, 1e-10));
        }
    }

    #[test]
    fn test_condition_number_identity() {
        let data = vec![1.0, 0.0, 0.0, 1.0];
        let cond = condition_number(2, 2, &data);
        assert!(approx_eq(cond, 1.0, 1e-8));
    }

    #[test]
    fn test_condition_number_ill_conditioned() {
        let data = vec![1.0, 0.0, 0.0, 1e-15];
        let cond = condition_number(2, 2, &data);
        assert!(cond > 1e14);
    }

    #[test]
    fn test_svd_identity() {
        let data = vec![1.0, 0.0, 0.0, 1.0];
        let (_u, sigma, _v) = svd(2, 2, &data);
        let mut s = sigma.clone();
        s.sort_by(|a, b| b.partial_cmp(a).unwrap());
        assert!(approx_eq(s[0], 1.0, 1e-8));
        assert!(approx_eq(s[1], 1.0, 1e-8));
    }
}
