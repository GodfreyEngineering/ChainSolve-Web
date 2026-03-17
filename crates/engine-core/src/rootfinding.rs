//! Rootfinding algorithms for scalar nonlinear equations.
//!
//! - [`newton_raphson`] — Newton's method with backtracking line search
//! - [`brent`] — Brent's method (guaranteed convergence for bracketed roots)
//! - [`polynomial_roots`] — All roots of a polynomial via companion matrix eigenvalues

/// Configuration for iterative rootfinding methods.
pub struct RootConfig {
    pub max_iter: usize,
    pub tol: f64,
}

impl Default for RootConfig {
    fn default() -> Self {
        Self {
            max_iter: 100,
            tol: 1e-12,
        }
    }
}

/// Result from a rootfinding algorithm.
#[derive(Debug)]
pub struct RootResult {
    pub root: f64,
    pub iterations: usize,
    pub converged: bool,
    pub function_value: f64,
}

// ── Newton-Raphson with backtracking line search ─────────────────────────────

/// Find a root of `f(x) = 0` using Newton-Raphson with numerical derivatives
/// and Armijo backtracking line search.
///
/// `f` is the function to find the root of.
/// `x0` is the initial guess.
/// `cfg` controls convergence criteria.
pub fn newton_raphson<F: Fn(f64) -> f64>(f: &F, x0: f64, cfg: &RootConfig) -> RootResult {
    let h = 1e-8; // step for numerical derivative
    let alpha = 1e-4; // Armijo constant
    let rho = 0.5; // backtracking factor

    let mut x = x0;
    for iter in 0..cfg.max_iter {
        let fx = f(x);
        if fx.abs() < cfg.tol {
            return RootResult {
                root: x,
                iterations: iter,
                converged: true,
                function_value: fx,
            };
        }

        // Numerical derivative (central difference)
        let dfx = (f(x + h) - f(x - h)) / (2.0 * h);
        if dfx.abs() < 1e-15 {
            // Derivative too small — can't continue
            return RootResult {
                root: x,
                iterations: iter,
                converged: false,
                function_value: fx,
            };
        }

        let step = -fx / dfx;

        // Armijo backtracking line search
        let mut t = 1.0;
        let descent = -fx * fx; // directional derivative of 0.5*f²
        for _ in 0..20 {
            let x_new = x + t * step;
            let fx_new = f(x_new);
            if fx_new.abs() * fx_new.abs() <= fx.abs() * fx.abs() + alpha * t * descent {
                break;
            }
            t *= rho;
        }

        x += t * step;

        if (t * step).abs() < cfg.tol {
            let fx_final = f(x);
            return RootResult {
                root: x,
                iterations: iter + 1,
                converged: fx_final.abs() < cfg.tol * 1000.0,
                function_value: fx_final,
            };
        }
    }

    let fx = f(x);
    RootResult {
        root: x,
        iterations: cfg.max_iter,
        converged: fx.abs() < cfg.tol,
        function_value: fx,
    }
}

// ── Brent's method ──────────────────────────────────────────────────────────

/// Find a root of `f(x) = 0` in the interval `[a, b]` using Brent's method.
///
/// Requires `f(a) * f(b) < 0` (the root must be bracketed).
/// Combines bisection, secant, and inverse quadratic interpolation for
/// guaranteed convergence with superlinear speed.
pub fn brent<F: Fn(f64) -> f64>(f: &F, mut a: f64, mut b: f64, cfg: &RootConfig) -> RootResult {
    let mut fa = f(a);
    let mut fb = f(b);

    if fa * fb > 0.0 {
        return RootResult {
            root: f64::NAN,
            iterations: 0,
            converged: false,
            function_value: f64::NAN,
        };
    }

    if fa.abs() < fb.abs() {
        std::mem::swap(&mut a, &mut b);
        std::mem::swap(&mut fa, &mut fb);
    }

    let mut c = a;
    let mut fc = fa;
    let mut mflag = true;
    let mut d = b - a; // previous step size
    let mut _e = d;

    for iter in 0..cfg.max_iter {
        if fb.abs() < cfg.tol || (b - a).abs() < cfg.tol {
            return RootResult {
                root: b,
                iterations: iter,
                converged: true,
                function_value: fb,
            };
        }

        let mut s;
        if (fa - fc).abs() > 1e-15 && (fb - fc).abs() > 1e-15 {
            // Inverse quadratic interpolation
            s = a * fb * fc / ((fa - fb) * (fa - fc))
                + b * fa * fc / ((fb - fa) * (fb - fc))
                + c * fa * fb / ((fc - fa) * (fc - fb));
        } else {
            // Secant method
            s = b - fb * (b - a) / (fb - fa);
        }

        // Conditions for rejecting s and using bisection instead
        let cond1 = if a < b {
            s < (3.0 * a + b) / 4.0 || s > b
        } else {
            s > (3.0 * a + b) / 4.0 || s < b
        };
        let cond2 = mflag && (s - b).abs() >= (b - c).abs() / 2.0;
        let cond3 = !mflag && (s - b).abs() >= (c - d).abs() / 2.0;
        let cond4 = mflag && (b - c).abs() < cfg.tol;
        let cond5 = !mflag && (c - d).abs() < cfg.tol;

        if cond1 || cond2 || cond3 || cond4 || cond5 {
            // Bisection
            s = (a + b) / 2.0;
            mflag = true;
        } else {
            mflag = false;
        }

        let fs = f(s);
        d = c;
        c = b;
        fc = fb;

        if fa * fs < 0.0 {
            b = s;
            fb = fs;
        } else {
            a = s;
            fa = fs;
        }

        if fa.abs() < fb.abs() {
            std::mem::swap(&mut a, &mut b);
            std::mem::swap(&mut fa, &mut fb);
        }
    }

    RootResult {
        root: b,
        iterations: cfg.max_iter,
        converged: fb.abs() < cfg.tol,
        function_value: fb,
    }
}

// ── Polynomial roots via companion matrix ────────────────────────────────────

/// Find all real roots of a polynomial given by its coefficients.
///
/// `coeffs[i]` is the coefficient of x^i, so `coeffs = [c0, c1, ..., cn]`
/// represents `c0 + c1*x + c2*x² + ... + cn*x^n`.
///
/// Uses the companion matrix eigenvalue approach:
/// 1. Build the companion matrix for the monic polynomial
/// 2. Find eigenvalues via the symmetric eigendecomposition of the linalg module
///    (for real roots; complex roots are omitted)
///
/// Returns all real roots sorted in ascending order.
pub fn polynomial_roots(coeffs: &[f64]) -> Vec<f64> {
    if coeffs.is_empty() {
        return vec![];
    }

    // Remove trailing zeros (leading coefficients that are zero)
    let mut n = coeffs.len();
    while n > 1 && coeffs[n - 1].abs() < 1e-15 {
        n -= 1;
    }
    let coeffs = &coeffs[..n];

    if n <= 1 {
        return vec![]; // constant — no roots (or all zeros)
    }

    if n == 2 {
        // Linear: c0 + c1*x = 0 → x = -c0/c1
        return vec![-coeffs[0] / coeffs[1]];
    }

    if n == 3 {
        // Quadratic: c0 + c1*x + c2*x² = 0
        let (a, b, c) = (coeffs[2], coeffs[1], coeffs[0]);
        let disc = b * b - 4.0 * a * c;
        if disc < 0.0 {
            return vec![];
        }
        let sqrt_disc = disc.sqrt();
        let mut roots = vec![(-b - sqrt_disc) / (2.0 * a), (-b + sqrt_disc) / (2.0 * a)];
        roots.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        return roots;
    }

    // General case: companion matrix
    let degree = n - 1;
    let lead = coeffs[degree];

    // Build companion matrix (degree × degree) in row-major order
    // Companion matrix has 1s on the sub-diagonal and -c_i/c_n in the last column
    let mut companion = vec![0.0; degree * degree];
    for i in 1..degree {
        companion[i * degree + (i - 1)] = 1.0; // sub-diagonal
    }
    for i in 0..degree {
        companion[i * degree + (degree - 1)] = -coeffs[i] / lead;
    }

    // Find eigenvalues using QR iteration (simple shifted QR)
    // For a non-symmetric companion matrix, we use a basic iterative approach
    let eigenvalues = companion_eigenvalues(degree, &companion);

    // Filter to real roots (eigenvalues with negligible imaginary part)
    // and verify by evaluating the polynomial
    let mut roots: Vec<f64> = eigenvalues
        .into_iter()
        .filter(|&x| {
            let val = eval_polynomial(coeffs, x);
            val.abs() < 1e-6 * (1.0 + x.abs().powi(degree as i32))
        })
        .collect();

    roots.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    // Deduplicate roots that are very close
    roots.dedup_by(|a, b| (*a - *b).abs() < 1e-10);

    roots
}

/// Evaluate polynomial at x.
fn eval_polynomial(coeffs: &[f64], x: f64) -> f64 {
    let mut result = 0.0;
    let mut xp = 1.0;
    for &c in coeffs {
        result += c * xp;
        xp *= x;
    }
    result
}

/// Find eigenvalues of a general (non-symmetric) matrix using
/// Francis QR iteration with implicit shifts (simplified).
///
/// Returns approximate real eigenvalues. Complex eigenvalue pairs
/// are detected and omitted.
fn companion_eigenvalues(n: usize, matrix: &[f64]) -> Vec<f64> {
    if n == 0 {
        return vec![];
    }
    if n == 1 {
        return vec![matrix[0]];
    }

    // Copy matrix to work array (we'll modify it)
    let mut h = matrix.to_vec();

    // Hessenberg reduction (companion matrix is already upper Hessenberg, so skip)
    // QR iteration
    let max_iter = 200 * n;
    let mut eigenvalues = Vec::with_capacity(n);
    let mut m = n;

    for _ in 0..max_iter {
        if m <= 1 {
            if m == 1 {
                eigenvalues.push(h[0]);
            }
            break;
        }

        // Check for deflation: if h[m-1, m-2] ≈ 0, we can split
        let sub = h[(m - 1) * n + (m - 2)].abs();
        let diag_sum = h[(m - 1) * n + (m - 1)].abs() + h[(m - 2) * n + (m - 2)].abs();
        if sub < 1e-14 * diag_sum.max(1e-15) {
            eigenvalues.push(h[(m - 1) * n + (m - 1)]);
            m -= 1;
            continue;
        }

        // Check for 2×2 block at bottom
        if m == 2 {
            let a11 = h[0];
            let a12 = h[1];
            let a21 = h[n];
            let a22 = h[n + 1];
            let trace = a11 + a22;
            let det = a11 * a22 - a12 * a21;
            let disc = trace * trace - 4.0 * det;
            if disc >= 0.0 {
                let sqrt_disc = disc.sqrt();
                eigenvalues.push((trace + sqrt_disc) / 2.0);
                eigenvalues.push((trace - sqrt_disc) / 2.0);
            }
            // Complex pair — skip
            break;
        }

        // Wilkinson shift: eigenvalue of bottom 2×2 closer to h[m-1,m-1]
        let a = h[(m - 2) * n + (m - 2)];
        let b = h[(m - 2) * n + (m - 1)];
        let c = h[(m - 1) * n + (m - 2)];
        let d = h[(m - 1) * n + (m - 1)];
        let trace = a + d;
        let det = a * d - b * c;
        let disc = trace * trace - 4.0 * det;
        let shift = if disc >= 0.0 {
            let sqrt_disc = disc.sqrt();
            let e1 = (trace + sqrt_disc) / 2.0;
            let e2 = (trace - sqrt_disc) / 2.0;
            if (e1 - d).abs() < (e2 - d).abs() {
                e1
            } else {
                e2
            }
        } else {
            d // Use the diagonal as fallback
        };

        // QR step with shift
        // Apply shift: H ← H - σI
        for i in 0..m {
            h[i * n + i] -= shift;
        }

        // QR factorization via Givens rotations
        let mut cs = vec![0.0; m - 1];
        let mut sn = vec![0.0; m - 1];
        for i in 0..m - 1 {
            let a = h[i * n + i];
            let b = h[(i + 1) * n + i];
            let r = (a * a + b * b).sqrt();
            if r < 1e-30 {
                cs[i] = 1.0;
                sn[i] = 0.0;
                continue;
            }
            cs[i] = a / r;
            sn[i] = b / r;

            // Apply Givens rotation to rows i and i+1
            for j in 0..m {
                let hi = h[i * n + j];
                let hi1 = h[(i + 1) * n + j];
                h[i * n + j] = cs[i] * hi + sn[i] * hi1;
                h[(i + 1) * n + j] = -sn[i] * hi + cs[i] * hi1;
            }
        }

        // Apply Givens rotations from the right: H ← RQ
        for i in 0..m - 1 {
            for j in 0..m {
                let hji = h[j * n + i];
                let hji1 = h[j * n + (i + 1)];
                h[j * n + i] = cs[i] * hji + sn[i] * hji1;
                h[j * n + (i + 1)] = -sn[i] * hji + cs[i] * hji1;
            }
        }

        // Undo shift: H ← H + σI
        for i in 0..m {
            h[i * n + i] += shift;
        }
    }

    // If we ran out of iterations, grab remaining diagonal elements
    if eigenvalues.len() < n {
        for i in eigenvalues.len()..n.min(m + eigenvalues.len()) {
            if i < n {
                eigenvalues.push(h[i * n + i]);
            }
        }
    }

    eigenvalues
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_newton_sqrt2() {
        // Find sqrt(2) by solving x² - 2 = 0
        let result = newton_raphson(&|x| x * x - 2.0, 1.5, &RootConfig::default());
        assert!(result.converged);
        assert!((result.root - std::f64::consts::SQRT_2).abs() < 1e-10);
    }

    #[test]
    fn test_newton_sin() {
        // Find root of sin(x) near pi
        let result = newton_raphson(&|x| x.sin(), 3.0, &RootConfig::default());
        assert!(result.converged);
        assert!((result.root - std::f64::consts::PI).abs() < 1e-10);
    }

    #[test]
    fn test_newton_zero_derivative() {
        // x³ at x=0 has f'(0)=0 — should handle gracefully
        let result = newton_raphson(&|x| x * x * x, 0.001, &RootConfig::default());
        // Should converge (or get very close)
        assert!(result.root.abs() < 1e-3);
    }

    #[test]
    fn test_brent_sqrt2() {
        let result = brent(&|x| x * x - 2.0, 1.0, 2.0, &RootConfig::default());
        assert!(result.converged);
        assert!((result.root - std::f64::consts::SQRT_2).abs() < 1e-10);
    }

    #[test]
    fn test_brent_cos() {
        // cos(x) = 0 in [1, 2] → x = π/2
        let result = brent(&|x| x.cos(), 1.0, 2.0, &RootConfig::default());
        assert!(result.converged);
        assert!((result.root - std::f64::consts::FRAC_PI_2).abs() < 1e-10);
    }

    #[test]
    fn test_brent_unbracketted() {
        // f(1) > 0 and f(2) > 0 — not bracketed
        let result = brent(&|x| x * x + 1.0, 1.0, 2.0, &RootConfig::default());
        assert!(!result.converged);
        assert!(result.root.is_nan());
    }

    #[test]
    fn test_polynomial_linear() {
        // 2 + 3x = 0 → x = -2/3
        let roots = polynomial_roots(&[2.0, 3.0]);
        assert_eq!(roots.len(), 1);
        assert!((roots[0] - (-2.0 / 3.0)).abs() < 1e-10);
    }

    #[test]
    fn test_polynomial_quadratic() {
        // x² - 5x + 6 = 0 → x = 2, 3
        let roots = polynomial_roots(&[6.0, -5.0, 1.0]);
        assert_eq!(roots.len(), 2);
        assert!((roots[0] - 2.0).abs() < 1e-8);
        assert!((roots[1] - 3.0).abs() < 1e-8);
    }

    #[test]
    fn test_polynomial_quadratic_no_real_roots() {
        // x² + 1 = 0 → no real roots
        let roots = polynomial_roots(&[1.0, 0.0, 1.0]);
        assert!(roots.is_empty());
    }

    #[test]
    fn test_polynomial_cubic() {
        // (x-1)(x-2)(x-3) = x³ - 6x² + 11x - 6
        // coeffs: [-6, 11, -6, 1]
        let roots = polynomial_roots(&[-6.0, 11.0, -6.0, 1.0]);
        assert_eq!(roots.len(), 3);
        assert!((roots[0] - 1.0).abs() < 1e-6);
        assert!((roots[1] - 2.0).abs() < 1e-6);
        assert!((roots[2] - 3.0).abs() < 1e-6);
    }

    #[test]
    fn test_polynomial_constant() {
        let roots = polynomial_roots(&[5.0]);
        assert!(roots.is_empty());
    }

    #[test]
    fn test_polynomial_empty() {
        let roots = polynomial_roots(&[]);
        assert!(roots.is_empty());
    }
}
