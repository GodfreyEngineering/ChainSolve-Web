//! AD through linear solvers via implicit differentiation (1.34).
//!
//! Given a linear system **A(p)x = b(p)** where A and b depend on parameters p,
//! the implicit function theorem gives:
//!
//!   dx/dp_k = A⁻¹ · (db/dp_k − (dA/dp_k) · x)
//!
//! This avoids differentiating through the solver internals — we only need:
//! 1. The solution x (one forward solve).
//! 2. Finite-difference Jacobians of A and b w.r.t. each parameter.
//! 3. One additional linear solve per parameter (using the already-factored A).
//!
//! The block accepts:
//! - `A`: n×n matrix as a flat row-major Vec<f64>  (or generated from expressions)
//! - `b`: n-vector
//! - `param_names`: comma-separated parameter names
//! - `param_values`: comma-separated current parameter values
//! - `A_expr` / `b_expr`: optional expression strings for A_ij / b_i that reference params
//!
//! Output: Table [param_idx, dx0/dp, dx1/dp, …, dxN/dp]

use std::collections::HashMap;

/// Result of implicit differentiation through Ax = b.
#[derive(Debug, Clone)]
pub struct LinSolveSensResult {
    /// Solution x of the linear system A·x = b.
    pub x: Vec<f64>,
    /// Sensitivity dx/dp_k for each parameter k. Outer index = param, inner = state.
    pub sensitivities: Vec<Vec<f64>>,
    /// Parameter names.
    pub param_names: Vec<String>,
    /// Dimension of the system.
    pub n: usize,
}

/// Evaluate an expression with the given variable map.
fn eval(expr: &str, vars: &HashMap<String, f64>) -> f64 {
    crate::expr::eval_expr(expr, vars).unwrap_or(f64::NAN)
}

/// Build the n×n matrix A from expression strings (row-major) evaluated at params.
/// `a_exprs[i * n + j]` is the expression for A[i,j].
/// Variables available in expressions: param names.
fn build_matrix(a_exprs: &[String], _n: usize, params: &HashMap<String, f64>) -> Vec<f64> {
    a_exprs.iter().map(|e| eval(e, params)).collect::<Vec<_>>()
}

/// Build the b vector from expression strings evaluated at params.
fn build_vector(b_exprs: &[String], params: &HashMap<String, f64>) -> Vec<f64> {
    b_exprs.iter().map(|e| eval(e, params)).collect::<Vec<_>>()
}

/// Gaussian elimination with partial pivoting. Returns x such that A·x = b.
/// Returns None if A is singular.
pub fn gauss_solve(a: &[f64], b: &[f64]) -> Option<Vec<f64>> {
    let n = b.len();
    let mut aug: Vec<f64> = vec![0.0; n * (n + 1)];
    // Copy A | b into augmented matrix
    for i in 0..n {
        for j in 0..n {
            aug[i * (n + 1) + j] = a[i * n + j];
        }
        aug[i * (n + 1) + n] = b[i];
    }

    for col in 0..n {
        // Partial pivoting
        let pivot_row = (col..n).max_by(|&r1, &r2| {
            aug[r1 * (n + 1) + col].abs().partial_cmp(&aug[r2 * (n + 1) + col].abs()).unwrap()
        })?;
        for j in 0..=n {
            let tmp = aug[col * (n + 1) + j];
            aug[col * (n + 1) + j] = aug[pivot_row * (n + 1) + j];
            aug[pivot_row * (n + 1) + j] = tmp;
        }

        let pivot = aug[col * (n + 1) + col];
        if pivot.abs() < 1e-14 { return None; }

        for row in (col + 1)..n {
            let factor = aug[row * (n + 1) + col] / pivot;
            for j in col..=n {
                let delta = factor * aug[col * (n + 1) + j];
                aug[row * (n + 1) + j] -= delta;
            }
        }
    }

    // Back substitution
    let mut x = vec![0.0f64; n];
    for i in (0..n).rev() {
        let mut sum = aug[i * (n + 1) + n];
        for j in (i + 1)..n {
            sum -= aug[i * (n + 1) + j] * x[j];
        }
        x[i] = sum / aug[i * (n + 1) + i];
    }
    Some(x)
}

/// Compute dx/dp for all parameters using the implicit function theorem.
///
/// For each parameter p_k:
///   dx/dp_k = A⁻¹ · (db/dp_k − (dA/dp_k) · x)
///
/// We approximate dA/dp_k and db/dp_k via forward finite differences.
pub fn implicit_diff(
    a_exprs: &[String],
    b_exprs: &[String],
    param_names: &[String],
    params: &HashMap<String, f64>,
    fd_eps: f64,
) -> LinSolveSensResult {
    let n = b_exprs.len();

    // Forward solve
    let a0 = build_matrix(a_exprs, n, params);
    let b0 = build_vector(b_exprs, params);
    let x = gauss_solve(&a0, &b0).unwrap_or_else(|| vec![f64::NAN; n]);

    let mut sensitivities = Vec::with_capacity(param_names.len());

    for pname in param_names {
        let p0 = params.get(pname).copied().unwrap_or(0.0);
        let mut params_pert = params.clone();
        params_pert.insert(pname.clone(), p0 + fd_eps);

        // Perturbed A and b
        let a1 = build_matrix(a_exprs, n, &params_pert);
        let b1 = build_vector(b_exprs, &params_pert);

        // dA/dp_k and db/dp_k
        let da: Vec<f64> = a1.iter().zip(&a0).map(|(&a1i, &a0i)| (a1i - a0i) / fd_eps).collect();
        let db: Vec<f64> = b1.iter().zip(&b0).map(|(&b1i, &b0i)| (b1i - b0i) / fd_eps).collect();

        // rhs = db/dp_k − (dA/dp_k) · x
        let mut rhs = db.clone();
        for i in 0..n {
            for j in 0..n {
                rhs[i] -= da[i * n + j] * x[j];
            }
        }

        // dx/dp_k = A⁻¹ · rhs  (re-use A0, already factored implicitly via gauss_solve)
        let dxdp = gauss_solve(&a0, &rhs).unwrap_or_else(|| vec![f64::NAN; n]);
        sensitivities.push(dxdp);
    }

    LinSolveSensResult {
        x,
        sensitivities,
        param_names: param_names.to_vec(),
        n,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simple_2x2_sensitivity() {
        // A = [[k, 0], [0, 1]], b = [1, 1], x = [1/k, 1]
        // dx[0]/dk = -1/k^2 = -1 at k=1
        let a_exprs = vec!["k".to_string(), "0".to_string(), "0".to_string(), "1".to_string()];
        let b_exprs = vec!["1".to_string(), "1".to_string()];
        let mut params = HashMap::new();
        params.insert("k".to_string(), 1.0);

        let result = implicit_diff(&a_exprs, &b_exprs, &["k".to_string()], &params, 1e-6);
        assert!((result.x[0] - 1.0).abs() < 1e-9, "x[0] = {}", result.x[0]);
        assert!((result.x[1] - 1.0).abs() < 1e-9, "x[1] = {}", result.x[1]);
        // dx[0]/dk ≈ -1
        let dxdk = &result.sensitivities[0];
        assert!((dxdk[0] - (-1.0)).abs() < 1e-4, "dx0/dk = {}", dxdk[0]);
        assert!(dxdk[1].abs() < 1e-9, "dx1/dk = {}", dxdk[1]);
    }

    #[test]
    fn gauss_solve_3x3() {
        // A = [[2,1,1],[4,3,3],[8,7,9]], b = [1,1,1]
        let a = vec![2.0, 1.0, 1.0, 4.0, 3.0, 3.0, 8.0, 7.0, 9.0];
        let b = vec![1.0, 1.0, 1.0];
        let x = gauss_solve(&a, &b).unwrap();
        // Verify Ax = b
        for i in 0..3 {
            let ax_i: f64 = (0..3).map(|j| a[i * 3 + j] * x[j]).sum();
            assert!((ax_i - b[i]).abs() < 1e-10, "row {i}: Ax = {ax_i} ≠ {}", b[i]);
        }
    }
}
