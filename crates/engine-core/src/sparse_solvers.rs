//! Sparse iterative solvers for large linear systems Ax = b.
//!
//! - **CG** (Conjugate Gradient) — for symmetric positive definite systems
//! - **GMRES** (Generalized Minimal Residual) — for general non-symmetric systems
//! - **BiCGStab** (Biconjugate Gradient Stabilized) — for general non-symmetric systems
//! - **ILU(0)** preconditioner — incomplete LU factorization for acceleration

use crate::sparse::CsrMatrix;

/// Result of an iterative solve.
#[derive(Debug, Clone)]
pub struct IterativeSolveResult {
    /// Solution vector.
    pub x: Vec<f64>,
    /// Number of iterations performed.
    pub iterations: usize,
    /// Final residual norm.
    pub residual_norm: f64,
    /// Whether the solver converged.
    pub converged: bool,
}

/// Configuration for iterative solvers.
#[derive(Debug, Clone)]
pub struct SolverConfig {
    /// Maximum number of iterations.
    pub max_iter: usize,
    /// Convergence tolerance on relative residual norm.
    pub tol: f64,
}

impl Default for SolverConfig {
    fn default() -> Self {
        Self {
            max_iter: 1000,
            tol: 1e-10,
        }
    }
}

// ── Vector operations ────────────────────────────────────────────────────

fn dot(a: &[f64], b: &[f64]) -> f64 {
    a.iter().zip(b.iter()).map(|(x, y)| x * y).sum()
}

fn norm2(v: &[f64]) -> f64 {
    dot(v, v).sqrt()
}

fn axpy(alpha: f64, x: &[f64], y: &mut [f64]) {
    for (yi, xi) in y.iter_mut().zip(x.iter()) {
        *yi += alpha * xi;
    }
}

fn scale(alpha: f64, x: &mut [f64]) {
    for xi in x.iter_mut() {
        *xi *= alpha;
    }
}

// ── ILU(0) Preconditioner ────────────────────────────────────────────────

/// Incomplete LU(0) factorization — preserves sparsity pattern of A.
/// Stores L and U in CSR format.
#[derive(Debug, Clone)]
pub struct Ilu0 {
    /// Combined LU factors stored in the original sparsity pattern.
    /// L (lower triangle, unit diagonal implied) and U (upper triangle, including diagonal).
    rows: usize,
    row_ptrs: Vec<usize>,
    col_indices: Vec<usize>,
    values: Vec<f64>,
    /// Diagonal indices for fast access.
    diag_indices: Vec<usize>,
}

impl Ilu0 {
    /// Compute ILU(0) factorization of a CSR matrix.
    pub fn new(a: &CsrMatrix) -> Self {
        assert_eq!(a.rows, a.cols, "ILU(0): matrix must be square");
        let n = a.rows;
        let mut values = a.values.clone();
        let row_ptrs = a.row_ptrs.clone();
        let col_indices = a.col_indices.clone();

        // Find diagonal indices
        let mut diag_indices = vec![0usize; n];
        for i in 0..n {
            let mut found = false;
            for k in row_ptrs[i]..row_ptrs[i + 1] {
                if col_indices[k] == i {
                    diag_indices[i] = k;
                    found = true;
                    break;
                }
            }
            if !found {
                // No diagonal entry — ILU will be approximate
                diag_indices[i] = row_ptrs[i];
            }
        }

        // ILU(0) factorization: for each row i
        for i in 1..n {
            for kp in row_ptrs[i]..row_ptrs[i + 1] {
                let k = col_indices[kp];
                if k >= i {
                    break; // Only process lower triangle
                }
                let diag_k = diag_indices[k];
                if values[diag_k].abs() < 1e-300 {
                    continue;
                }
                let factor = values[kp] / values[diag_k];
                values[kp] = factor;

                // Update row i: a_ij -= factor * a_kj for j > k where both exist
                for jp in row_ptrs[i]..row_ptrs[i + 1] {
                    let j = col_indices[jp];
                    if j <= k {
                        continue;
                    }
                    // Find a_kj in row k
                    for kj in row_ptrs[k]..row_ptrs[k + 1] {
                        if col_indices[kj] == j {
                            values[jp] -= factor * values[kj];
                            break;
                        }
                    }
                }
            }
        }

        Self {
            rows: n,
            row_ptrs,
            col_indices,
            values,
            diag_indices,
        }
    }

    /// Solve M * z = r where M ≈ LU (forward then backward substitution).
    pub fn solve(&self, r: &[f64]) -> Vec<f64> {
        let n = self.rows;
        let mut y = r.to_vec();

        // Forward substitution: L y = r (unit diagonal)
        for i in 0..n {
            for k in self.row_ptrs[i]..self.diag_indices[i] {
                let j = self.col_indices[k];
                y[i] -= self.values[k] * y[j];
            }
        }

        // Backward substitution: U z = y
        for i in (0..n).rev() {
            for k in (self.diag_indices[i] + 1)..self.row_ptrs[i + 1] {
                let j = self.col_indices[k];
                y[i] -= self.values[k] * y[j];
            }
            let diag = self.values[self.diag_indices[i]];
            if diag.abs() > 1e-300 {
                y[i] /= diag;
            }
        }

        y
    }
}

// ── Conjugate Gradient (CG) ─────────────────────────────────────────────

/// Conjugate Gradient method for symmetric positive definite systems.
/// Optionally preconditioned with ILU(0).
pub fn cg(
    a: &CsrMatrix,
    b: &[f64],
    config: &SolverConfig,
    preconditioner: Option<&Ilu0>,
) -> IterativeSolveResult {
    let n = a.rows;
    assert_eq!(n, b.len());

    let mut x = vec![0.0; n];
    let mut r: Vec<f64> = b.to_vec(); // r = b - A*x, but x=0 so r=b

    let b_norm = norm2(b);
    if b_norm < 1e-300 {
        return IterativeSolveResult {
            x,
            iterations: 0,
            residual_norm: 0.0,
            converged: true,
        };
    }

    let mut z = match preconditioner {
        Some(pc) => pc.solve(&r),
        None => r.clone(),
    };
    let mut p = z.clone();
    let mut rz = dot(&r, &z);

    for iter in 0..config.max_iter {
        let ap = a.mul_vec(&p);
        let pap = dot(&p, &ap);
        if pap.abs() < 1e-300 {
            return IterativeSolveResult {
                x,
                iterations: iter,
                residual_norm: norm2(&r) / b_norm,
                converged: false,
            };
        }
        let alpha = rz / pap;

        axpy(alpha, &p, &mut x);
        axpy(-alpha, &ap, &mut r);

        let r_norm = norm2(&r);
        if r_norm / b_norm < config.tol {
            return IterativeSolveResult {
                x,
                iterations: iter + 1,
                residual_norm: r_norm / b_norm,
                converged: true,
            };
        }

        z = match preconditioner {
            Some(pc) => pc.solve(&r),
            None => r.clone(),
        };

        let rz_new = dot(&r, &z);
        let beta = rz_new / rz;
        rz = rz_new;

        // p = z + beta * p
        for i in 0..n {
            p[i] = z[i] + beta * p[i];
        }
    }

    IterativeSolveResult {
        x,
        iterations: config.max_iter,
        residual_norm: norm2(&r) / b_norm,
        converged: false,
    }
}

// ── BiCGStab ─────────────────────────────────────────────────────────────

/// BiCGStab method for general non-symmetric systems.
/// Optionally preconditioned with ILU(0).
pub fn bicgstab(
    a: &CsrMatrix,
    b: &[f64],
    config: &SolverConfig,
    preconditioner: Option<&Ilu0>,
) -> IterativeSolveResult {
    let n = a.rows;
    assert_eq!(n, b.len());

    let mut x = vec![0.0; n];
    let mut r: Vec<f64> = b.to_vec();

    let b_norm = norm2(b);
    if b_norm < 1e-300 {
        return IterativeSolveResult {
            x,
            iterations: 0,
            residual_norm: 0.0,
            converged: true,
        };
    }

    let r0 = r.clone(); // Shadow residual (fixed)
    let mut rho = 1.0f64;
    let mut alpha = 1.0f64;
    let mut omega = 1.0f64;
    let mut v = vec![0.0; n];
    let mut p = vec![0.0; n];

    for iter in 0..config.max_iter {
        let rho_new = dot(&r0, &r);
        if rho_new.abs() < 1e-300 {
            return IterativeSolveResult {
                x,
                iterations: iter,
                residual_norm: norm2(&r) / b_norm,
                converged: false,
            };
        }

        let beta = (rho_new / rho) * (alpha / omega);
        rho = rho_new;

        // p = r + beta * (p - omega * v)
        for i in 0..n {
            p[i] = r[i] + beta * (p[i] - omega * v[i]);
        }

        // Precondition: solve M * p_hat = p
        let p_hat = match preconditioner {
            Some(pc) => pc.solve(&p),
            None => p.clone(),
        };

        v = a.mul_vec(&p_hat);
        let r0v = dot(&r0, &v);
        if r0v.abs() < 1e-300 {
            return IterativeSolveResult {
                x,
                iterations: iter,
                residual_norm: norm2(&r) / b_norm,
                converged: false,
            };
        }
        alpha = rho / r0v;

        // s = r - alpha * v
        let mut s: Vec<f64> = r.iter().zip(v.iter()).map(|(ri, vi)| ri - alpha * vi).collect();

        let s_norm = norm2(&s);
        if s_norm / b_norm < config.tol {
            axpy(alpha, &p_hat, &mut x);
            return IterativeSolveResult {
                x,
                iterations: iter + 1,
                residual_norm: s_norm / b_norm,
                converged: true,
            };
        }

        // Precondition: solve M * s_hat = s
        let s_hat = match preconditioner {
            Some(pc) => pc.solve(&s),
            None => s.clone(),
        };

        let t = a.mul_vec(&s_hat);
        let tt = dot(&t, &t);
        omega = if tt.abs() > 1e-300 { dot(&t, &s) / tt } else { 0.0 };

        // x = x + alpha * p_hat + omega * s_hat
        axpy(alpha, &p_hat, &mut x);
        axpy(omega, &s_hat, &mut x);

        // r = s - omega * t
        for i in 0..n {
            s[i] -= omega * t[i];
        }
        r = s;

        let r_norm = norm2(&r);
        if r_norm / b_norm < config.tol {
            return IterativeSolveResult {
                x,
                iterations: iter + 1,
                residual_norm: r_norm / b_norm,
                converged: true,
            };
        }

        if omega.abs() < 1e-300 {
            return IterativeSolveResult {
                x,
                iterations: iter + 1,
                residual_norm: r_norm / b_norm,
                converged: false,
            };
        }
    }

    IterativeSolveResult {
        x,
        iterations: config.max_iter,
        residual_norm: norm2(&r) / b_norm,
        converged: false,
    }
}

// ── GMRES(m) ─────────────────────────────────────────────────────────────

/// Restarted GMRES(m) method for general non-symmetric systems.
/// Optionally preconditioned with ILU(0).
pub fn gmres(
    a: &CsrMatrix,
    b: &[f64],
    config: &SolverConfig,
    restart: usize,
    preconditioner: Option<&Ilu0>,
) -> IterativeSolveResult {
    let n = a.rows;
    assert_eq!(n, b.len());

    let b_norm = norm2(b);
    if b_norm < 1e-300 {
        return IterativeSolveResult {
            x: vec![0.0; n],
            iterations: 0,
            residual_norm: 0.0,
            converged: true,
        };
    }

    let m = restart.min(n).max(1);
    let mut x = vec![0.0; n];
    let mut total_iter = 0;

    for _restart_cycle in 0..config.max_iter {
        // r = b - A*x
        let ax = a.mul_vec(&x);
        let mut r: Vec<f64> = b.iter().zip(ax.iter()).map(|(bi, ai)| bi - ai).collect();

        // Precondition
        if let Some(pc) = preconditioner {
            r = pc.solve(&r);
        }

        let r_norm = norm2(&r);
        if r_norm / b_norm < config.tol {
            return IterativeSolveResult {
                x,
                iterations: total_iter,
                residual_norm: r_norm / b_norm,
                converged: true,
            };
        }

        // Arnoldi process with Givens rotations
        let mut v: Vec<Vec<f64>> = Vec::with_capacity(m + 1);
        let mut h = vec![vec![0.0f64; m]; m + 1]; // Hessenberg matrix
        let mut cs = vec![0.0f64; m]; // Givens cosines
        let mut sn = vec![0.0f64; m]; // Givens sines
        let mut e1 = vec![0.0f64; m + 1];
        e1[0] = r_norm;

        // v[0] = r / ||r||
        let mut v0 = r;
        scale(1.0 / r_norm, &mut v0);
        v.push(v0);

        let mut j = 0;
        while j < m && total_iter < config.max_iter {
            total_iter += 1;

            // w = A * v[j]
            let mut w = a.mul_vec(&v[j]);
            if let Some(pc) = preconditioner {
                w = pc.solve(&w);
            }

            // Modified Gram-Schmidt orthogonalization
            for i in 0..=j {
                h[i][j] = dot(&w, &v[i]);
                axpy(-h[i][j], &v[i], &mut w);
            }
            h[j + 1][j] = norm2(&w);

            if h[j + 1][j].abs() > 1e-300 {
                scale(1.0 / h[j + 1][j], &mut w);
                v.push(w);
            } else {
                v.push(vec![0.0; n]);
            }

            // Apply previous Givens rotations to column j of H
            for i in 0..j {
                let temp = cs[i] * h[i][j] + sn[i] * h[i + 1][j];
                h[i + 1][j] = -sn[i] * h[i][j] + cs[i] * h[i + 1][j];
                h[i][j] = temp;
            }

            // Compute Givens rotation for (h[j][j], h[j+1][j])
            let a_val = h[j][j];
            let b_val = h[j + 1][j];
            let r_val = (a_val * a_val + b_val * b_val).sqrt();
            if r_val.abs() > 1e-300 {
                cs[j] = a_val / r_val;
                sn[j] = b_val / r_val;
            } else {
                cs[j] = 1.0;
                sn[j] = 0.0;
            }

            h[j][j] = cs[j] * a_val + sn[j] * b_val;
            h[j + 1][j] = 0.0;

            // Apply to RHS
            let temp = cs[j] * e1[j] + sn[j] * e1[j + 1];
            e1[j + 1] = -sn[j] * e1[j] + cs[j] * e1[j + 1];
            e1[j] = temp;

            let residual = e1[j + 1].abs() / b_norm;
            if residual < config.tol {
                j += 1;
                break;
            }

            j += 1;
        }

        // Solve upper triangular system H * y = e1
        let mut y = vec![0.0f64; j];
        for i in (0..j).rev() {
            y[i] = e1[i];
            for k in i + 1..j {
                y[i] -= h[i][k] * y[k];
            }
            if h[i][i].abs() > 1e-300 {
                y[i] /= h[i][i];
            }
        }

        // Update solution: x = x + V * y
        for i in 0..j {
            axpy(y[i], &v[i], &mut x);
        }

        // Check convergence
        let ax = a.mul_vec(&x);
        let r_final: Vec<f64> = b.iter().zip(ax.iter()).map(|(bi, ai)| bi - ai).collect();
        let r_final_norm = norm2(&r_final);
        if r_final_norm / b_norm < config.tol || total_iter >= config.max_iter {
            return IterativeSolveResult {
                x,
                iterations: total_iter,
                residual_norm: r_final_norm / b_norm,
                converged: r_final_norm / b_norm < config.tol,
            };
        }
    }

    let ax = a.mul_vec(&x);
    let r_final: Vec<f64> = b.iter().zip(ax.iter()).map(|(bi, ai)| bi - ai).collect();
    IterativeSolveResult {
        x,
        iterations: total_iter,
        residual_norm: norm2(&r_final) / b_norm,
        converged: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sparse::CooMatrix;

    fn approx_eq(a: f64, b: f64, tol: f64) -> bool {
        (a - b).abs() < tol
    }

    /// Build a 3×3 SPD matrix: [[4,-1,0],[-1,4,-1],[0,-1,4]]
    fn build_spd_3x3() -> CsrMatrix {
        let mut coo = CooMatrix::new(3, 3);
        coo.push(0, 0, 4.0);
        coo.push(0, 1, -1.0);
        coo.push(1, 0, -1.0);
        coo.push(1, 1, 4.0);
        coo.push(1, 2, -1.0);
        coo.push(2, 1, -1.0);
        coo.push(2, 2, 4.0);
        coo.to_csr()
    }

    /// Build a 3×3 non-symmetric matrix: [[3,1,0],[0,3,1],[0,0,3]]
    fn build_nonsym_3x3() -> CsrMatrix {
        let mut coo = CooMatrix::new(3, 3);
        coo.push(0, 0, 3.0);
        coo.push(0, 1, 1.0);
        coo.push(1, 1, 3.0);
        coo.push(1, 2, 1.0);
        coo.push(2, 2, 3.0);
        coo.to_csr()
    }

    #[test]
    fn test_cg_spd_3x3() {
        let a = build_spd_3x3();
        let b = vec![1.0, 2.0, 3.0];
        let config = SolverConfig::default();
        let result = cg(&a, &b, &config, None);
        assert!(result.converged);

        // Verify A*x ≈ b
        let ax = a.mul_vec(&result.x);
        for i in 0..3 {
            assert!(approx_eq(ax[i], b[i], 1e-8));
        }
    }

    #[test]
    fn test_cg_preconditioned() {
        let a = build_spd_3x3();
        let b = vec![1.0, 2.0, 3.0];
        let pc = Ilu0::new(&a);
        let config = SolverConfig::default();
        let result = cg(&a, &b, &config, Some(&pc));
        assert!(result.converged);

        let ax = a.mul_vec(&result.x);
        for i in 0..3 {
            assert!(approx_eq(ax[i], b[i], 1e-8));
        }
    }

    #[test]
    fn test_bicgstab_nonsym() {
        let a = build_nonsym_3x3();
        let b = vec![1.0, 2.0, 3.0];
        let config = SolverConfig::default();
        let result = bicgstab(&a, &b, &config, None);
        assert!(result.converged);

        let ax = a.mul_vec(&result.x);
        for i in 0..3 {
            assert!(approx_eq(ax[i], b[i], 1e-8));
        }
    }

    #[test]
    fn test_bicgstab_preconditioned() {
        let a = build_nonsym_3x3();
        let b = vec![1.0, 2.0, 3.0];
        let pc = Ilu0::new(&a);
        let config = SolverConfig::default();
        let result = bicgstab(&a, &b, &config, Some(&pc));
        assert!(result.converged);

        let ax = a.mul_vec(&result.x);
        for i in 0..3 {
            assert!(approx_eq(ax[i], b[i], 1e-8));
        }
    }

    #[test]
    fn test_gmres_nonsym() {
        let a = build_nonsym_3x3();
        let b = vec![1.0, 2.0, 3.0];
        let config = SolverConfig::default();
        let result = gmres(&a, &b, &config, 10, None);
        assert!(result.converged);

        let ax = a.mul_vec(&result.x);
        for i in 0..3 {
            assert!(approx_eq(ax[i], b[i], 1e-8));
        }
    }

    #[test]
    fn test_gmres_preconditioned() {
        let a = build_nonsym_3x3();
        let b = vec![1.0, 2.0, 3.0];
        let pc = Ilu0::new(&a);
        let config = SolverConfig::default();
        let result = gmres(&a, &b, &config, 10, Some(&pc));
        assert!(result.converged);

        let ax = a.mul_vec(&result.x);
        for i in 0..3 {
            assert!(approx_eq(ax[i], b[i], 1e-8));
        }
    }

    #[test]
    fn test_cg_identity_system() {
        let id = crate::sparse::sparse_identity(4);
        let b = vec![1.0, 2.0, 3.0, 4.0];
        let config = SolverConfig::default();
        let result = cg(&id, &b, &config, None);
        assert!(result.converged);
        for i in 0..4 {
            assert!(approx_eq(result.x[i], b[i], 1e-10));
        }
    }

    #[test]
    fn test_gmres_spd() {
        // GMRES should also work on SPD systems
        let a = build_spd_3x3();
        let b = vec![1.0, 2.0, 3.0];
        let config = SolverConfig::default();
        let result = gmres(&a, &b, &config, 10, None);
        assert!(result.converged);

        let ax = a.mul_vec(&result.x);
        for i in 0..3 {
            assert!(approx_eq(ax[i], b[i], 1e-8));
        }
    }

    #[test]
    fn test_zero_rhs() {
        let a = build_spd_3x3();
        let b = vec![0.0, 0.0, 0.0];
        let config = SolverConfig::default();

        let cg_result = cg(&a, &b, &config, None);
        assert!(cg_result.converged);
        assert_eq!(cg_result.iterations, 0);

        let bicg_result = bicgstab(&a, &b, &config, None);
        assert!(bicg_result.converged);

        let gmres_result = gmres(&a, &b, &config, 10, None);
        assert!(gmres_result.converged);
    }

    #[test]
    fn test_larger_spd_system() {
        // 10×10 tridiagonal SPD: 4 on diagonal, -1 on off-diagonals
        let n = 10;
        let mut coo = CooMatrix::new(n, n);
        for i in 0..n {
            coo.push(i, i, 4.0);
            if i > 0 {
                coo.push(i, i - 1, -1.0);
            }
            if i < n - 1 {
                coo.push(i, i + 1, -1.0);
            }
        }
        let a = coo.to_csr();
        let b: Vec<f64> = (1..=n).map(|i| i as f64).collect();
        let config = SolverConfig::default();

        let result = cg(&a, &b, &config, None);
        assert!(result.converged);

        // Verify
        let ax = a.mul_vec(&result.x);
        for i in 0..n {
            assert!(approx_eq(ax[i], b[i], 1e-8));
        }
    }

    #[test]
    fn test_ilu0_is_exact_for_tridiag() {
        // For a tridiagonal matrix, ILU(0) equals exact LU
        let a = build_spd_3x3();
        let pc = Ilu0::new(&a);
        let b = vec![1.0, 2.0, 3.0];
        let z = pc.solve(&b);

        // z should be close to exact solution (since ILU(0) = exact LU for tridiagonal)
        let az = a.mul_vec(&z);
        for i in 0..3 {
            assert!(approx_eq(az[i], b[i], 1e-8));
        }
    }
}
