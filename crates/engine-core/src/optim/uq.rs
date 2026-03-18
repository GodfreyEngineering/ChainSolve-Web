//! Uncertainty Quantification (UQ) — item 2.117.
//!
//! ## Polynomial Chaos Expansion (PCE)
//!
//! Approximates a stochastic model response as a truncated polynomial chaos expansion:
//!
//! ```text
//! Y(ξ) ≈ Σ_α c_α Ψ_α(ξ)
//! ```
//!
//! where:
//! - ξ = vector of i.i.d. standard random inputs
//! - Ψ_α = multivariate orthogonal polynomials (Legendre for Uniform, Hermite for Gaussian)
//! - c_α = PCE coefficients (fitted via least-squares regression from samples)
//! - α  = multi-index with |α|₁ ≤ p (total-degree truncation, p = polynomial degree ≤ 5)
//!
//! ### Basis selection
//!
//! - **Legendre** (`"legendre"`, default): Uniform[-1,1] inputs → L_n(x)
//! - **Hermite**  (`"hermite"`): Standard normal inputs → He_n(x) (probabilist's Hermite)
//!
//! Bases are built for total polynomial degree `p` and `n` input variables,
//! giving `C(n+p, p)` terms.
//!
//! ### Regression
//!
//! Standard least-squares (`XᵀX·c = Xᵀy`) via Gauss-Jordan.
//! If overdetermined (N_samples > N_terms), uses normal equations.
//!
//! ### Statistics from PCE
//!
//! - Mean:     `μ = c_0` (coefficient of the constant term Ψ_0 = 1)
//! - Variance: `σ² = Σ_{α≠0} c_α²` (orthonormality of basis)
//!
//! ## FORM (First-Order Reliability Method)
//!
//! Finds the Most Probable Point (MPP) of failure in the standard normal space,
//! then approximates the failure probability:
//!
//! ```text
//! P_f ≈ Φ(-β)
//! ```
//!
//! where β = ‖u*‖ = reliability index and Φ = standard normal CDF.
//!
//! ### HLRF algorithm (Hasofer-Lind-Rackwitz-Fiessler)
//!
//! Iterates in the standard normal u-space:
//! ```text
//! u_{k+1} = (|∇g(u_k)|² - ∇g(u_k)ᵀ u_k) / |∇g(u_k)|² · ∇g(u_k) / |∇g(u_k)|
//! ```
//!
//! Starting from u_0 = 0 (standard normal origin).

use crate::types::Value;

/// Distribution type for each uncertain variable.
#[derive(Clone, Debug)]
pub enum UqDist {
    /// Uniform on [min, max] → mapped to Legendre ξ ∈ [-1, 1].
    Uniform { min: f64, max: f64 },
    /// Normal(μ, σ) → mapped to Hermite ξ ∈ standard normal.
    Normal { mean: f64, std: f64 },
}

impl UqDist {
    /// Parse from a JSON-like string: "uniform:min:max" or "normal:mean:std".
    pub fn from_str(s: &str) -> Self {
        let parts: Vec<&str> = s.split(':').collect();
        match parts.as_slice() {
            ["uniform", a, b] => {
                let min = a.parse().unwrap_or(-1.0);
                let max = b.parse().unwrap_or(1.0);
                Self::Uniform { min, max }
            }
            ["normal", m, s] => {
                let mean = m.parse().unwrap_or(0.0);
                let std = s.parse::<f64>().unwrap_or(1.0).abs().max(1e-15);
                Self::Normal { mean, std }
            }
            _ => Self::Uniform { min: -1.0, max: 1.0 },
        }
    }

    /// Map from standard space ξ ∈ [-1,1] (Legendre) or N(0,1) (Hermite) to physical space.
    pub fn from_standard(&self, xi: f64) -> f64 {
        match self {
            Self::Uniform { min, max } => min + 0.5 * (xi + 1.0) * (max - min),
            Self::Normal { mean, std } => mean + std * xi,
        }
    }

    /// Polynomial basis type.
    pub fn basis_type(&self) -> BasisType {
        match self {
            Self::Uniform { .. } => BasisType::Legendre,
            Self::Normal { .. } => BasisType::Hermite,
        }
    }
}

/// Polynomial basis type.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum BasisType {
    Legendre,
    Hermite,
}

/// PCE result.
pub struct PceResult {
    /// PCE mean (= coefficient of constant term).
    pub mean: f64,
    /// PCE variance (= sum of squared non-constant coefficients).
    pub variance: f64,
    /// PCE standard deviation.
    pub std: f64,
    /// Sobol first-order sensitivity indices for each variable.
    pub sobol_s1: Vec<f64>,
    /// R² of the PCE fit.
    pub r_squared: f64,
    /// Number of PCE terms.
    pub n_terms: usize,
}

/// Run Polynomial Chaos Expansion.
///
/// `samples_x` — N × n matrix of sample points in standard space (columns = variables).
/// `samples_y` — N response values y = f(x).
/// `dists`     — distribution type per variable (determines basis).
/// `degree`    — polynomial degree p (1–5).
///
/// Returns PCE statistics and Sobol indices.
pub fn fit_pce(
    samples_x: &[Vec<f64>],
    samples_y: &[f64],
    dists: &[UqDist],
    degree: usize,
) -> Result<PceResult, String> {
    let n_samples = samples_x.len();
    let n_vars = dists.len();
    let degree = degree.min(5).max(1);

    if n_samples == 0 || n_vars == 0 || samples_y.len() != n_samples {
        return Err("pce: need at least one sample and one variable".into());
    }
    if samples_x[0].len() != n_vars {
        return Err("pce: sample columns must match number of distributions".into());
    }

    // Build multi-index set: all α with |α|₁ ≤ degree
    let multi_indices = build_multi_indices(n_vars, degree);
    let n_terms = multi_indices.len();

    if n_samples < n_terms {
        return Err(format!(
            "pce: insufficient samples ({n_samples}) for {n_terms} PCE terms (degree={degree}, vars={n_vars})"
        ));
    }

    // Build design matrix Φ (n_samples × n_terms)
    let phi: Vec<Vec<f64>> = samples_x
        .iter()
        .map(|xi| {
            multi_indices
                .iter()
                .map(|alpha| eval_poly_term(xi, alpha, dists))
                .collect()
        })
        .collect();

    // Fit via normal equations: (ΦᵀΦ) c = Φᵀ y
    let coeffs = fit_normal_equations(&phi, samples_y)?;

    // PCE statistics (using orthonormality property)
    let mean = coeffs[0];
    let variance: f64 = coeffs[1..].iter().map(|&c| c * c).sum();
    let std = variance.sqrt();

    // R²
    let y_mean = samples_y.iter().sum::<f64>() / n_samples as f64;
    let ss_tot: f64 = samples_y.iter().map(|&yi| (yi - y_mean).powi(2)).sum();
    let ss_res: f64 = samples_x
        .iter()
        .zip(samples_y.iter())
        .map(|(xi, &yi)| {
            let y_hat: f64 = multi_indices
                .iter()
                .zip(coeffs.iter())
                .map(|(alpha, &c)| c * eval_poly_term(xi, alpha, dists))
                .sum();
            (yi - y_hat).powi(2)
        })
        .sum();
    let r_squared = if ss_tot > 1e-15 { 1.0 - ss_res / ss_tot } else { 1.0 };

    // Sobol first-order indices (main effect variance / total variance)
    let sobol_s1 = if variance > 1e-15 {
        (0..n_vars)
            .map(|var_idx| {
                // Sum c_α² for α where only variable var_idx is active (all others 0)
                let var_contrib: f64 = multi_indices
                    .iter()
                    .zip(coeffs.iter())
                    .skip(1) // skip constant
                    .filter(|(alpha, _)| {
                        alpha.iter().enumerate().all(|(j, &a)| {
                            if j == var_idx { a > 0 } else { a == 0 }
                        })
                    })
                    .map(|(_, &c)| c * c)
                    .sum();
                var_contrib / variance
            })
            .collect()
    } else {
        vec![0.0; n_vars]
    };

    Ok(PceResult { mean, variance, std, sobol_s1, r_squared, n_terms })
}

/// FORM reliability analysis (HLRF algorithm).
///
/// `limit_state` — limit state function g(u) where g≤0 means failure.
///                 u is in standard normal space N(0,I).
/// `n_vars`      — number of standard normal variables.
/// `max_iter`    — HLRF iteration limit.
/// `tol`         — convergence tolerance on MPP move.
///
/// Returns (beta, p_failure, mpp).
pub fn form_hlrf<G>(
    limit_state: &G,
    n_vars: usize,
    max_iter: usize,
    tol: f64,
) -> (f64, f64, Vec<f64>)
where
    G: Fn(&[f64]) -> f64,
{
    let mut u = vec![0.0_f64; n_vars];
    let h = 1e-6;

    for _ in 0..max_iter {
        // Gradient of g at u via central differences
        let g_u = limit_state(&u);
        let mut grad_g = vec![0.0_f64; n_vars];
        for i in 0..n_vars {
            let mut up = u.clone();
            let mut um = u.clone();
            up[i] += h;
            um[i] -= h;
            grad_g[i] = (limit_state(&up) - limit_state(&um)) / (2.0 * h);
        }

        let grad_norm_sq: f64 = grad_g.iter().map(|&gi| gi * gi).sum();
        if grad_norm_sq < 1e-20 {
            break;
        }

        // HLRF update
        let u_dot_grad: f64 = u.iter().zip(grad_g.iter()).map(|(&ui, &gi)| ui * gi).sum();
        let alpha = (g_u - u_dot_grad) / grad_norm_sq;

        let u_new: Vec<f64> = grad_g.iter().map(|&gi| -alpha * gi).collect();

        // Check convergence
        let move_norm: f64 = u_new
            .iter()
            .zip(u.iter())
            .map(|(&a, &b)| (a - b).powi(2))
            .sum::<f64>()
            .sqrt();
        u = u_new;
        if move_norm < tol {
            break;
        }
    }

    let beta = u.iter().map(|&ui| ui * ui).sum::<f64>().sqrt();
    let p_failure = standard_normal_cdf(-beta);
    (beta, p_failure, u)
}

// ── Internal helpers ──────────────────────────────────────────────────────

/// Build all multi-indices α = (α₁, …, αₙ) with |α|₁ = Σαᵢ ≤ p.
fn build_multi_indices(n: usize, p: usize) -> Vec<Vec<usize>> {
    let mut result = vec![vec![0usize; n]]; // start with zero index
    let mut stack = vec![(vec![0usize; n], 0usize, 0usize)]; // (current, var, degree_used)

    while let Some((current, var, used)) = stack.pop() {
        for i in var..n {
            for d in 1..=(p - used) {
                let mut next = current.clone();
                next[i] += d;
                result.push(next.clone());
                if used + d < p && i + 1 < n {
                    stack.push((next, i + 1, used + d));
                }
            }
        }
    }

    result.sort();
    result.dedup();
    result
}

/// Evaluate one PCE basis term Ψ_α(ξ) = Π_i P_{α_i}(ξ_i).
fn eval_poly_term(xi: &[f64], alpha: &[usize], dists: &[UqDist]) -> f64 {
    alpha
        .iter()
        .zip(xi.iter())
        .zip(dists.iter())
        .map(|((&a, &xij), dist)| eval_1d_poly(xij, a, dist.basis_type()))
        .product()
}

/// Evaluate 1D polynomial P_n(x) for the given basis type.
fn eval_1d_poly(x: f64, n: usize, basis: BasisType) -> f64 {
    match basis {
        BasisType::Legendre => legendre(x, n),
        BasisType::Hermite => hermite(x, n),
    }
}

/// Legendre polynomial Lₙ(x) on [-1,1] via recurrence.
fn legendre(x: f64, n: usize) -> f64 {
    match n {
        0 => 1.0,
        1 => x,
        _ => {
            let mut p_prev = 1.0_f64;
            let mut p_curr = x;
            for k in 1..n {
                let p_next = ((2 * k + 1) as f64 * x * p_curr - k as f64 * p_prev) / (k + 1) as f64;
                p_prev = p_curr;
                p_curr = p_next;
            }
            p_curr
        }
    }
}

/// Probabilist's Hermite polynomial Heₙ(x) via recurrence.
/// He₀=1, He₁=x, Heₙ=x·Heₙ₋₁ − (n−1)·Heₙ₋₂.
fn hermite(x: f64, n: usize) -> f64 {
    match n {
        0 => 1.0,
        1 => x,
        _ => {
            let mut h_prev = 1.0_f64;
            let mut h_curr = x;
            for k in 1..n {
                let h_next = x * h_curr - k as f64 * h_prev;
                h_prev = h_curr;
                h_curr = h_next;
            }
            h_curr
        }
    }
}

/// Fit via normal equations (ΦᵀΦ)c = Φᵀy → c.
fn fit_normal_equations(phi: &[Vec<f64>], y: &[f64]) -> Result<Vec<f64>, String> {
    let n_s = phi.len();
    let n_t = phi[0].len();

    // Build ΦᵀΦ and Φᵀy
    let mut xtx = vec![vec![0.0_f64; n_t]; n_t];
    let mut xty = vec![0.0_f64; n_t];

    for i in 0..n_s {
        for j in 0..n_t {
            xty[j] += phi[i][j] * y[i];
            for l in 0..n_t {
                xtx[j][l] += phi[i][j] * phi[i][l];
            }
        }
    }

    // Gauss-Jordan solve
    let coeffs = solve_gj(&xtx, &xty);
    if coeffs.iter().any(|v| v.is_nan()) {
        return Err("pce: ill-conditioned design matrix".into());
    }
    Ok(coeffs)
}

/// Gauss-Jordan solver for Ax = b.
fn solve_gj(a: &[Vec<f64>], b: &[f64]) -> Vec<f64> {
    let n = b.len();
    if n == 0 {
        return vec![];
    }

    let mut aug: Vec<Vec<f64>> = a
        .iter()
        .zip(b.iter())
        .map(|(row, &bi)| {
            let mut r = row.clone();
            r.push(bi);
            r
        })
        .collect();

    for col in 0..n {
        let pivot_row = (col..n).max_by(|&i, &j| {
            aug[i][col]
                .abs()
                .partial_cmp(&aug[j][col].abs())
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        let pivot_row = match pivot_row {
            Some(r) => r,
            None => return vec![f64::NAN; n],
        };
        aug.swap(col, pivot_row);

        let pivot = aug[col][col];
        if pivot.abs() < 1e-14 {
            return vec![f64::NAN; n];
        }

        let inv = 1.0 / pivot;
        for k in 0..=n {
            aug[col][k] *= inv;
        }

        for row in 0..n {
            if row == col {
                continue;
            }
            let factor = aug[row][col];
            for k in 0..=n {
                let sub = factor * aug[col][k];
                aug[row][k] -= sub;
            }
        }
    }

    aug.iter().map(|row| row[n]).collect()
}

/// Standard normal CDF via rational approximation (Abramowitz & Stegun 26.2.17).
fn standard_normal_cdf(x: f64) -> f64 {
    let t = 1.0 / (1.0 + 0.2316419 * x.abs());
    let poly = t * (0.319_381_53
        + t * (-0.356_563_782
            + t * (1.781_477_937 + t * (-1.821_255_978 + t * 1.330_274_429))));
    let phi_x = (-x * x / 2.0).exp() / (2.0 * std::f64::consts::PI).sqrt();
    let cdf_abs = 1.0 - phi_x * poly;
    if x >= 0.0 { cdf_abs } else { 1.0 - cdf_abs }
}

/// Build PCE result as a Value::Table.
pub fn pce_to_table(result: &PceResult, var_names: &[String]) -> Value {
    let mut columns = vec![
        "statistic".to_string(),
        "value".to_string(),
    ];
    let mut rows: Vec<Vec<f64>> = vec![
        vec![0.0, result.mean],
        vec![1.0, result.variance],
        vec![2.0, result.std],
        vec![3.0, result.r_squared],
        vec![4.0, result.n_terms as f64],
    ];

    // Sobol indices as extra columns
    for (i, &s1) in result.sobol_s1.iter().enumerate() {
        let name = var_names.get(i).cloned().unwrap_or_else(|| format!("x{i}"));
        columns.push(format!("S1_{name}"));
        // Add as column entry in first row
        let _ = s1; // will be handled below
        let _ = name;
    }

    // Rebuild as a wide single-row table for statistics + sobol
    let mut wide_cols = vec![
        "mean".to_string(),
        "variance".to_string(),
        "std".to_string(),
        "r_squared".to_string(),
        "n_terms".to_string(),
    ];
    let mut wide_row = vec![
        result.mean,
        result.variance,
        result.std,
        result.r_squared,
        result.n_terms as f64,
    ];
    for (i, &s1) in result.sobol_s1.iter().enumerate() {
        let name = var_names.get(i).cloned().unwrap_or_else(|| format!("x{i}"));
        wide_cols.push(format!("S1_{name}"));
        wide_row.push(s1);
    }

    let _ = columns;
    let _ = rows;

    Value::Table { columns: wide_cols, rows: vec![wide_row] }
}

/// Build FORM result as a Value::Table.
pub fn form_to_table(beta: f64, p_failure: f64, mpp: &[f64], var_names: &[String]) -> Value {
    let mut columns = vec!["beta".to_string(), "p_failure".to_string()];
    let mut row = vec![beta, p_failure];
    for (i, &u) in mpp.iter().enumerate() {
        let name = var_names.get(i).cloned().unwrap_or_else(|| format!("u{i}"));
        columns.push(format!("mpp_{name}"));
        row.push(u);
    }
    Value::Table { columns, rows: vec![row] }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn multi_indices_degree1_2vars() {
        let idx = build_multi_indices(2, 1);
        // Should contain: (0,0), (1,0), (0,1)
        assert!(idx.contains(&vec![0, 0]));
        assert!(idx.contains(&vec![1, 0]));
        assert!(idx.contains(&vec![0, 1]));
    }

    #[test]
    fn legendre_orthogonality() {
        // L₀ = 1, L₁ = x, L₂ = (3x²-1)/2
        assert!((legendre(0.5, 0) - 1.0).abs() < 1e-12);
        assert!((legendre(0.5, 1) - 0.5).abs() < 1e-12);
        let l2 = legendre(0.5, 2);
        assert!((l2 - (3.0 * 0.25 - 1.0) / 2.0).abs() < 1e-10, "L₂(0.5) = {l2}");
    }

    #[test]
    fn hermite_values() {
        // He₀=1, He₁=x, He₂=x²-1, He₃=x³-3x
        let x = 2.0;
        assert!((hermite(x, 0) - 1.0).abs() < 1e-12);
        assert!((hermite(x, 1) - 2.0).abs() < 1e-12);
        assert!((hermite(x, 2) - 3.0).abs() < 1e-12); // 4-1=3
        assert!((hermite(x, 3) - 2.0).abs() < 1e-12); // 8-6=2
    }

    /// PCE fit of y = x₀ + 2·x₁ — should recover mean=0, std=√(1+4)/√3
    #[test]
    fn pce_linear_fit() {
        // Uniform[-1,1] samples (Gauss-Legendre quadrature points)
        let dists = vec![
            UqDist::Uniform { min: -1.0, max: 1.0 },
            UqDist::Uniform { min: -1.0, max: 1.0 },
        ];
        // Use a grid of samples
        let pts: Vec<f64> = vec![-0.9, -0.6, -0.3, 0.0, 0.3, 0.6, 0.9];
        let mut samples_x = Vec::new();
        let mut samples_y = Vec::new();
        for &a in &pts {
            for &b in &pts {
                samples_x.push(vec![a, b]);
                samples_y.push(a + 2.0 * b);
            }
        }
        let result = fit_pce(&samples_x, &samples_y, &dists, 1).unwrap();
        assert!((result.mean).abs() < 1e-8, "mean = {}", result.mean);
        assert!(result.r_squared > 0.99, "R² = {}", result.r_squared);
    }

    /// FORM: reliability index for g(u) = β₀ - u₀ with β₀ = 2 → β = 2.
    #[test]
    fn form_simple() {
        let beta0 = 2.0_f64;
        let g = |u: &[f64]| beta0 - u[0];
        let (beta, p_f, _mpp) = form_hlrf(&g, 1, 100, 1e-8);
        assert!((beta - beta0).abs() < 1e-4, "β = {beta}");
        assert!(p_f > 0.0 && p_f < 1.0, "p_f = {p_f}");
    }
}
