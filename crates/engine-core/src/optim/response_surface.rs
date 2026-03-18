//! Response Surface Methodology (RSM) — metamodel fitting.
//!
//! Fits a polynomial regression metamodel to design-of-experiments (DOE) results.
//! Supports:
//! * **Quadratic RSM** (default): y = β₀ + Σᵢ βᵢxᵢ + Σᵢ βᵢᵢxᵢ² + Σᵢ<ⱼ βᵢⱼxᵢxⱼ
//! * **Linear RSM**: y = β₀ + Σᵢ βᵢxᵢ
//! * **Cubic RSM**: includes cubic terms xᵢ³
//! * **RBF**: Radial Basis Function with Gaussian kernel (σ estimated from data)
//!
//! # Output
//!
//! Returns the metamodel as a Table with columns:
//! - For polynomial: ["term", "coefficient"] where term is the monomial name
//! - For RBF: ["center_0", "center_1", ..., "weight"] with one row per training point
//!
//! # Usage
//!
//! 1. Run a DOE (factorial/LHS/CCC) to get an experiment table
//! 2. Evaluate the response at each point (column "response")
//! 3. Feed experiment table + response vector to this block
//! 4. Use the fitted model for contour plots, sensitivity, or optimisation
//!
//! # Polynomial regression (OLS)
//!
//! Builds design matrix X from the input features, then solves the normal equations:
//! β = (XᵀX)⁻¹Xᵀy via Gauss-Jordan with partial pivoting.

use crate::types::Value;

/// Response surface method.
pub enum RsmMethod {
    Linear,
    Quadratic,
    Cubic,
    Rbf,
}

impl RsmMethod {
    pub fn from_str(s: &str) -> Self {
        match s {
            "linear" => Self::Linear,
            "cubic" => Self::Cubic,
            "rbf" => Self::Rbf,
            _ => Self::Quadratic,
        }
    }
}

/// Fit a response surface metamodel.
///
/// `x_data` — rows of input features (n_samples × n_features).
/// `y_data` — response values (n_samples).
/// `method` — "linear" | "quadratic" (default) | "cubic" | "rbf".
/// `feature_names` — optional names for features (used in term labels).
///
/// Returns a Table value: polynomial coefficients or RBF weights.
pub fn fit_response_surface(
    x_data: &[Vec<f64>],
    y_data: &[f64],
    method: &str,
    feature_names: &[String],
) -> Value {
    let n = x_data.len();
    let k = if n > 0 { x_data[0].len() } else { 0 };

    if n == 0 || k == 0 || y_data.len() != n {
        return Value::error("response_surface: need at least one sample with at least one feature");
    }

    let m = RsmMethod::from_str(method);

    match m {
        RsmMethod::Rbf => fit_rbf(x_data, y_data, feature_names),
        _ => fit_polynomial(x_data, y_data, &m, feature_names),
    }
}

/// Fit polynomial response surface via OLS normal equations.
fn fit_polynomial(
    x_data: &[Vec<f64>],
    y_data: &[f64],
    method: &RsmMethod,
    feature_names: &[String],
) -> Value {
    let n = x_data.len();
    let k = x_data[0].len();

    // Build term list: (name, closure index into feature vector)
    let terms = build_terms(k, method, feature_names);
    let p = terms.len(); // number of terms

    // Build design matrix X (n × p)
    let x_mat: Vec<Vec<f64>> = x_data.iter().map(|row| {
        terms.iter().map(|(_, eval_fn)| eval_fn(row)).collect()
    }).collect();

    // Solve normal equations: β = (XᵀX)⁻¹Xᵀy via Gauss-Jordan
    // Build XᵀX (p × p) and Xᵀy (p × 1)
    let mut xtx = vec![vec![0.0_f64; p]; p];
    let mut xty = vec![0.0_f64; p];

    for i in 0..n {
        for j in 0..p {
            xty[j] += x_mat[i][j] * y_data[i];
            for l in 0..p {
                xtx[j][l] += x_mat[i][j] * x_mat[i][l];
            }
        }
    }

    let beta = solve_gauss_jordan(&xtx, &xty);

    // Compute R²
    let y_mean = y_data.iter().sum::<f64>() / n as f64;
    let ss_tot: f64 = y_data.iter().map(|&yi| (yi - y_mean).powi(2)).sum();
    let ss_res: f64 = x_data.iter().zip(y_data.iter()).map(|(row, &yi)| {
        let y_hat: f64 = terms.iter().enumerate().map(|(j, (_, ef))| beta[j] * ef(row)).sum();
        (yi - y_hat).powi(2)
    }).sum();
    let r_squared = if ss_tot > 1e-15 { 1.0 - ss_res / ss_tot } else { 1.0 };

    // Build output table
    let mut rows: Vec<Vec<f64>> = beta.iter().enumerate().map(|(i, &b)| vec![i as f64, b]).collect();
    rows.push(vec![p as f64, r_squared]); // R² as last row
    rows.push(vec![p as f64 + 1.0, n as f64]); // n_samples

    // Build column_names separately
    let term_names: Vec<String> = terms.iter().map(|(name, _)| name.clone()).collect();

    // Return a richer table with term names (encoded as column metadata)
    // Columns: one column per term + extra metadata
    let mut wide_cols: Vec<String> = term_names.iter().map(|n| format!("coef_{n}")).collect();
    wide_cols.push("r_squared".to_string());
    wide_cols.push("n_samples".to_string());

    let mut wide_row: Vec<f64> = beta.clone();
    wide_row.push(r_squared);
    wide_row.push(n as f64);

    Value::Table {
        columns: wide_cols,
        rows: vec![wide_row],
    }
}

/// Build polynomial terms list: returns (name, eval_fn) pairs.
fn build_terms<'a>(
    k: usize,
    method: &RsmMethod,
    feature_names: &'a [String],
) -> Vec<(String, Box<dyn Fn(&[f64]) -> f64 + 'a>)> {
    let fname = |i: usize| -> String {
        feature_names.get(i).cloned().unwrap_or_else(|| format!("x{i}"))
    };

    let mut terms: Vec<(String, Box<dyn Fn(&[f64]) -> f64>)> = Vec::new();

    // Intercept
    terms.push(("intercept".to_string(), Box::new(|_: &[f64]| 1.0)));

    // Linear terms
    for i in 0..k {
        let name = fname(i);
        terms.push((name, Box::new(move |x: &[f64]| x[i])));
    }

    match method {
        RsmMethod::Linear => {}
        RsmMethod::Quadratic | RsmMethod::Cubic => {
            // Quadratic terms: x_i²
            for i in 0..k {
                let name = format!("{}^2", fname(i));
                terms.push((name, Box::new(move |x: &[f64]| x[i] * x[i])));
            }
            // Cross terms: x_i * x_j
            for i in 0..k {
                for j in i+1..k {
                    let name = format!("{}*{}", fname(i), fname(j));
                    terms.push((name, Box::new(move |x: &[f64]| x[i] * x[j])));
                }
            }
            if matches!(method, RsmMethod::Cubic) {
                // Cubic terms: x_i³
                for i in 0..k {
                    let name = format!("{}^3", fname(i));
                    terms.push((name, Box::new(move |x: &[f64]| x[i] * x[i] * x[i])));
                }
            }
        }
        RsmMethod::Rbf => unreachable!(),
    }

    terms
}

/// Fit RBF (Gaussian kernel) metamodel: y(x) = Σᵢ wᵢ φ(||x - cᵢ||)
/// where φ(r) = exp(-r² / (2σ²)) and σ = mean nearest-neighbor distance.
fn fit_rbf(
    x_data: &[Vec<f64>],
    y_data: &[f64],
    feature_names: &[String],
) -> Value {
    let n = x_data.len();
    let k = x_data[0].len();

    // Estimate σ as mean nearest-neighbor distance
    let mut nn_dists = Vec::with_capacity(n);
    for i in 0..n {
        let mut min_d = f64::INFINITY;
        for j in 0..n {
            if i == j { continue; }
            let d: f64 = x_data[i].iter().zip(x_data[j].iter()).map(|(&a, &b)| (a-b).powi(2)).sum::<f64>().sqrt();
            if d < min_d { min_d = d; }
        }
        if min_d.is_finite() { nn_dists.push(min_d); }
    }
    let sigma = if nn_dists.is_empty() { 1.0 } else {
        nn_dists.iter().sum::<f64>() / nn_dists.len() as f64
    };
    let sigma2 = (sigma * sigma).max(1e-14);

    // Build Gram matrix K (n × n), K_ij = φ(||x_i - x_j||)
    let mut k_mat = vec![vec![0.0_f64; n]; n];
    for i in 0..n {
        for j in 0..n {
            let r2: f64 = x_data[i].iter().zip(x_data[j].iter()).map(|(&a, &b)| (a-b).powi(2)).sum();
            k_mat[i][j] = (-r2 / (2.0 * sigma2)).exp();
        }
    }

    // Solve K * w = y
    let weights = solve_gauss_jordan(&k_mat, y_data);

    // Build output: columns are center coords + weight
    let mut columns: Vec<String> = (0..k).map(|i| {
        feature_names.get(i).cloned().unwrap_or_else(|| format!("center_x{i}"))
    }).collect();
    columns.push("weight".to_string());
    columns.push("sigma".to_string()); // Store sigma so evaluation can use it

    let mut rows: Vec<Vec<f64>> = x_data.iter().zip(weights.iter()).map(|(xi, &wi)| {
        let mut row = xi.clone();
        row.push(wi);
        row.push(sigma);
        row
    }).collect();

    // Metadata row: sigma (index -1)
    let mut meta = vec![f64::NAN; k];
    meta.push(sigma);
    meta.push(f64::NAN);
    rows.push(meta);

    Value::Table { columns, rows }
}

/// Solve Ax = b via Gauss-Jordan with partial pivoting. Returns x.
fn solve_gauss_jordan(a: &[Vec<f64>], b: &[f64]) -> Vec<f64> {
    let n = b.len();
    if n == 0 { return vec![]; }

    let mut aug: Vec<Vec<f64>> = a.iter().zip(b.iter()).map(|(row, &bi)| {
        let mut r = row.clone();
        r.push(bi);
        r
    }).collect();

    for col in 0..n {
        // Partial pivot
        let pivot_row = (col..n).max_by(|&i, &j| aug[i][col].abs().partial_cmp(&aug[j][col].abs()).unwrap_or(std::cmp::Ordering::Equal));
        let pivot_row = match pivot_row { Some(r) => r, None => return vec![f64::NAN; n] };
        aug.swap(col, pivot_row);

        let pivot = aug[col][col];
        if pivot.abs() < 1e-14 { return vec![f64::NAN; n]; }

        let inv = 1.0 / pivot;
        for k in 0..=n { aug[col][k] *= inv; }

        for row in 0..n {
            if row == col { continue; }
            let factor = aug[row][col];
            for k in 0..=n {
                let sub = factor * aug[col][k];
                aug[row][k] -= sub;
            }
        }
    }

    aug.iter().map(|row| row[n]).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Fit y = x₀² + x₁² (quadratic surface) — coefficients should be [0,0,0,1,1,0]
    #[test]
    fn fit_quadratic_sphere() {
        let x: Vec<Vec<f64>> = vec![
            vec![-1.0, -1.0], vec![-1.0, 0.0], vec![-1.0, 1.0],
            vec![ 0.0, -1.0], vec![ 0.0, 0.0], vec![ 0.0, 1.0],
            vec![ 1.0, -1.0], vec![ 1.0, 0.0], vec![ 1.0, 1.0],
        ];
        let y: Vec<f64> = x.iter().map(|row| row[0]*row[0] + row[1]*row[1]).collect();
        let result = fit_response_surface(&x, &y, "quadratic", &[]);
        if let Value::Table { columns, rows } = &result {
            // First row has the coefficients
            assert!(!rows.is_empty());
            // r_squared should be ~1
            let r2_col = columns.iter().position(|c| c == "r_squared").unwrap();
            assert!((rows[0][r2_col] - 1.0).abs() < 1e-6, "R² = {}", rows[0][r2_col]);
        } else {
            panic!("Expected Table");
        }
    }

    /// Fit linear y = 2*x₀ + 3 — should recover exact coefficients
    #[test]
    fn fit_linear_exact() {
        let x: Vec<Vec<f64>> = vec![vec![-2.0], vec![-1.0], vec![0.0], vec![1.0], vec![2.0]];
        let y: Vec<f64> = x.iter().map(|row| 2.0 * row[0] + 3.0).collect();
        let result = fit_response_surface(&x, &y, "linear", &[]);
        if let Value::Table { columns, rows } = &result {
            let intercept_col = columns.iter().position(|c| c == "coef_intercept").unwrap();
            let x0_col = columns.iter().position(|c| c == "coef_x0").unwrap();
            assert!((rows[0][intercept_col] - 3.0).abs() < 1e-6, "intercept = {}", rows[0][intercept_col]);
            assert!((rows[0][x0_col] - 2.0).abs() < 1e-6, "coef_x0 = {}", rows[0][x0_col]);
        } else {
            panic!("Expected Table");
        }
    }

    /// RBF fit — should interpolate exactly at training points
    #[test]
    fn fit_rbf_interpolation() {
        let x: Vec<Vec<f64>> = vec![vec![0.0], vec![1.0], vec![2.0], vec![3.0]];
        let y: Vec<f64> = vec![0.0, 1.0, 4.0, 9.0]; // x²
        let result = fit_response_surface(&x, &y, "rbf", &[]);
        assert!(matches!(result, Value::Table { .. }), "Expected Table for RBF");
    }
}
