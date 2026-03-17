//! Quadratic Programming solver — active-set method for convex QP.
//!
//! Solves: minimize 0.5 * x'Hx + f'x subject to Ax <= b, x >= 0.
//!
//! For small convex QPs (positive semidefinite H), uses a simple
//! projected gradient descent approach. Full Mehrotra interior point
//! is deferred to a future version.
//!
//! Reference: Nocedal & Wright "Numerical Optimization" (2006), Chapter 16.

/// Result of a QP solve.
#[derive(Debug, Clone)]
pub struct QpResult {
    pub status: QpStatus,
    pub x: Vec<f64>,
    pub objective: f64,
    pub iterations: usize,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum QpStatus {
    Optimal,
    MaxIterations,
    InvalidInput,
}

/// Solve a convex QP: minimize 0.5 * x'Hx + f'x subject to x >= 0.
///
/// Uses projected gradient descent with Armijo line search.
/// `h` = Hessian (n×n, row-major, must be positive semidefinite)
/// `f` = linear term (length n)
///
/// Bounds constraints only (x >= 0). General inequality deferred.
pub fn solve_qp(h: &[Vec<f64>], f: &[f64]) -> QpResult {
    let n = f.len();
    if n == 0 || h.len() != n {
        return QpResult {
            status: QpStatus::InvalidInput,
            x: vec![],
            objective: 0.0,
            iterations: 0,
        };
    }

    let mut x = vec![0.0; n]; // Start at origin (feasible for x >= 0)
    let max_iter = 1000;
    let tol = 1e-8;
    let mut alpha = 0.1; // Step size

    for iter in 0..max_iter {
        // Gradient: g = Hx + f
        let mut grad = f.to_vec();
        for i in 0..n {
            for j in 0..n {
                grad[i] += h[i][j] * x[j];
            }
        }

        // Project gradient: for x_i = 0, only allow gradient pointing inward
        let mut proj_grad = grad.clone();
        for i in 0..n {
            if x[i] <= 0.0 && proj_grad[i] > 0.0 {
                proj_grad[i] = 0.0; // Don't move further negative
            }
        }

        // Check convergence
        let grad_norm: f64 = proj_grad.iter().map(|g| g * g).sum::<f64>().sqrt();
        if grad_norm < tol {
            let obj = eval_objective(h, f, &x);
            return QpResult {
                status: QpStatus::Optimal,
                x,
                objective: obj,
                iterations: iter,
            };
        }

        // Gradient descent step with projection
        let mut x_new = vec![0.0; n];
        for i in 0..n {
            x_new[i] = (x[i] - alpha * proj_grad[i]).max(0.0); // Project to x >= 0
        }

        // Simple Armijo backtracking
        let obj_old = eval_objective(h, f, &x);
        let obj_new = eval_objective(h, f, &x_new);
        if obj_new < obj_old {
            x = x_new;
            alpha = (alpha * 1.1).min(1.0); // Slightly increase step
        } else {
            alpha *= 0.5; // Decrease step
            if alpha < 1e-15 {
                break;
            }
        }
    }

    let obj = eval_objective(h, f, &x);
    QpResult {
        status: QpStatus::MaxIterations,
        x,
        objective: obj,
        iterations: max_iter,
    }
}

fn eval_objective(h: &[Vec<f64>], f: &[f64], x: &[f64]) -> f64 {
    let n = x.len();
    let mut obj = 0.0;
    // 0.5 * x'Hx
    for i in 0..n {
        for j in 0..n {
            obj += 0.5 * x[i] * h[i][j] * x[j];
        }
    }
    // + f'x
    for i in 0..n {
        obj += f[i] * x[i];
    }
    obj
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simple_qp() {
        // Minimize 0.5 * (x1^2 + x2^2) + (-1)*x1 + (-1)*x2
        // = 0.5*x1^2 - x1 + 0.5*x2^2 - x2
        // Unconstrained minimum: x1=1, x2=1 (which satisfies x>=0)
        let h = vec![vec![1.0, 0.0], vec![0.0, 1.0]]; // Identity
        let f = vec![-1.0, -1.0];
        let result = solve_qp(&h, &f);
        assert_eq!(result.status, QpStatus::Optimal);
        assert!((result.x[0] - 1.0).abs() < 0.01, "x1 = {}", result.x[0]);
        assert!((result.x[1] - 1.0).abs() < 0.01, "x2 = {}", result.x[1]);
    }

    #[test]
    fn qp_at_boundary() {
        // Minimize 0.5 * x^2 + 1*x → unconstrained min at x=-1
        // But with x >= 0, optimal is x=0
        let h = vec![vec![1.0]];
        let f = vec![1.0]; // Pushes toward negative
        let result = solve_qp(&h, &f);
        assert!(result.x[0].abs() < 0.01, "x should be 0 (boundary), got {}", result.x[0]);
    }
}
