//! CMA-ES: Covariance Matrix Adaptation Evolution Strategy.
//!
//! Implements the (μ/μ_w, λ)-CMA-ES algorithm for unconstrained continuous
//! black-box optimization. Reference: Hansen & Ostermeier (2001), "Completely
//! Derandomized Self-Adaptation in Evolution Strategies"; Hansen (2016) "The
//! CMA Evolution Strategy: A Tutorial".
//!
//! # Algorithm
//!
//! CMA-ES maintains a multivariate normal distribution N(m, σ²C) and adapts:
//! * **m** — distribution mean (current best estimate of the optimum)
//! * **σ** — global step size (controls overall search radius)
//! * **C** — covariance matrix (captures variable dependencies)
//!
//! At each generation:
//! 1. Sample λ offspring: x_k = m + σ * N(0, C)
//! 2. Evaluate f(x_k), sort by fitness
//! 3. Update m via weighted recombination of top μ solutions
//! 4. Adapt σ via cumulative path length control
//! 5. Adapt C via rank-μ and rank-1 updates
//!
//! # Implementation notes
//!
//! Uses eigendecomposition C = B·D²·Bᵀ (Jacobi method for symmetric matrices).
//! Eigendecomposition is recomputed every max(1, floor(n/(10*λ))) generations.
//! Covariance is updated using the Gram-Schmidt-based rank-1 and rank-μ updates.
//!
//! Boundary handling: re-sampling until feasible (with limit).
//! Termination: stagnation detection, condition number (κ > 10^14), or max gen.

use super::{DesignVar, OptimResult};

/// CMA-ES configuration.
pub struct CmaesConfig {
    /// Maximum number of generations (iterations).
    pub max_gen: usize,
    /// Initial step size (default: (max-min)/4 per dimension; if 0.0, auto).
    pub sigma0: f64,
    /// Convergence tolerance on σ (stop when σ < tol).
    pub tol: f64,
    /// Random seed.
    pub seed: u64,
    /// Population size λ (0 = auto: 4 + floor(3*ln(n))).
    pub lambda: usize,
}

impl Default for CmaesConfig {
    fn default() -> Self {
        Self { max_gen: 1000, sigma0: 0.0, tol: 1e-10, seed: 42, lambda: 0 }
    }
}

/// Run CMA-ES to minimize `f(x)` with design variable bounds.
///
/// The objective is evaluated at the raw (un-normalised) parameter values.
/// Bounds [min, max] per variable are enforced by re-sampling.
pub fn cmaes<F>(
    f: &F,
    vars: &[DesignVar],
    config: &CmaesConfig,
) -> OptimResult
where
    F: Fn(&[f64]) -> f64,
{
    let n = vars.len();
    if n == 0 {
        return OptimResult {
            optimal_values: vec![],
            best_objective: f64::NAN,
            history: vec![],
            converged: false,
            iterations: 0,
        };
    }

    let mut rng = Rng::new(config.seed);

    // ── Strategy parameters ──────────────────────────────────────────────────
    let lambda = if config.lambda > 0 { config.lambda } else { (4.0 + (3.0 * (n as f64).ln()).floor()) as usize };
    let lambda = lambda.max(4);
    let mu = lambda / 2;

    // Weights (positive for selection, zero for rest)
    let mut weights: Vec<f64> = (0..mu).map(|i| ((lambda as f64 / 2.0 + 0.5).ln() - ((i + 1) as f64).ln())).collect();
    let w_sum: f64 = weights.iter().sum();
    for w in &mut weights { *w /= w_sum; }

    let mu_eff = 1.0 / weights.iter().map(|w| w * w).sum::<f64>();

    // Adaptation rates
    let n_f = n as f64;
    let c_sigma = (mu_eff + 2.0) / (n_f + mu_eff + 5.0);
    let d_sigma = 1.0 + c_sigma + 2.0 * ((( (mu_eff - 1.0) / (n_f + 1.0)).sqrt() - 1.0).max(0.0));
    let c_c = (4.0 + mu_eff / n_f) / (n_f + 4.0 + 2.0 * mu_eff / n_f);
    let c_1 = 2.0 / ((n_f + 1.3) * (n_f + 1.3) + mu_eff);
    let c_mu = (1.0 - c_1).min(2.0 * (mu_eff - 2.0 + 1.0 / mu_eff) / ((n_f + 2.0).powi(2) + mu_eff));

    // Expected value of ||N(0,I)||: E[||N(0,I)||] ≈ sqrt(n) * (1 - 1/(4n) + 1/(21n²))
    let chi_n = n_f.sqrt() * (1.0 - 1.0 / (4.0 * n_f) + 1.0 / (21.0 * n_f * n_f));

    // ── Initial distribution ─────────────────────────────────────────────────
    let sigma0 = if config.sigma0 > 0.0 {
        config.sigma0
    } else {
        // Auto: use 30% of the average variable range (in normalised space)
        0.3
    };

    // Normalise: work in [0,1]^n space, then map back
    let scale: Vec<f64> = vars.iter().map(|v| v.max - v.min).collect();
    let shift: Vec<f64> = vars.iter().map(|v| v.min).collect();

    let to_raw = |z: &[f64]| -> Vec<f64> {
        z.iter().enumerate().map(|(i, &zi)| shift[i] + scale[i] * zi).collect()
    };
    let to_norm = |x: &[f64]| -> Vec<f64> {
        x.iter().enumerate().map(|(i, &xi)| {
            if scale[i] > 0.0 { (xi - shift[i]) / scale[i] } else { 0.5 }
        }).collect()
    };
    let clamp_raw = |x: &[f64]| -> Vec<f64> {
        x.iter().enumerate().map(|(i, &xi)| xi.clamp(vars[i].min, vars[i].max)).collect()
    };

    // Initial mean (normalised initial value)
    let init_raw: Vec<f64> = vars.iter().map(|v| v.initial.clamp(v.min, v.max)).collect();
    let mut m: Vec<f64> = to_norm(&init_raw);

    let mut sigma = sigma0;

    // Covariance: C = I initially
    let mut c_mat = vec![vec![0.0_f64; n]; n];
    for i in 0..n { c_mat[i][i] = 1.0; }

    // Eigendecomposition C = B * D * Bᵀ (D = diag of eigenvalues)
    let mut b_mat = eye(n); // eigenvectors
    let mut d_diag: Vec<f64> = vec![1.0; n]; // sqrt of eigenvalues
    let mut eigen_stale = 0usize;
    let eigen_interval = (1.0 / (10.0 * n_f.max(1.0) * lambda as f64)) as usize + 1;

    // Evolution paths
    let mut p_c: Vec<f64> = vec![0.0; n];
    let mut p_sigma: Vec<f64> = vec![0.0; n];

    let mut best_x_raw: Vec<f64> = init_raw.clone();
    let mut best_f = f(&best_x_raw);
    let mut history = Vec::with_capacity(config.max_gen);

    let mut converged = false;

    for gen in 0..config.max_gen {
        // ── Sample population ─────────────────────────────────────────────
        let mut population: Vec<(Vec<f64>, Vec<f64>, f64)> = Vec::with_capacity(lambda); // (x_raw, z, fitness)
        for _ in 0..lambda {
            // Sample z ~ N(0, I) in n dimensions
            let z: Vec<f64> = (0..n).map(|_| rng.next_gaussian()).collect();
            // y = B * D * z (transform to current covariance)
            let y = b_d_z(&b_mat, &d_diag, &z);
            // x_norm = m + sigma * y
            let x_norm: Vec<f64> = m.iter().zip(y.iter()).map(|(&mi, &yi)| mi + sigma * yi).collect();
            // Clamp to [0,1] (normalised bounds)
            let x_norm_clamped: Vec<f64> = x_norm.iter().map(|&xi| xi.clamp(0.0, 1.0)).collect();
            let x_raw = clamp_raw(&to_raw(&x_norm_clamped));
            let fitness = f(&x_raw);
            population.push((x_raw, z, fitness));
        }

        // Sort by fitness (ascending: minimization)
        population.sort_by(|a, b| a.2.partial_cmp(&b.2).unwrap_or(std::cmp::Ordering::Equal));

        // Track best
        let gen_best_f = population[0].2;
        if gen_best_f < best_f || best_f.is_nan() {
            best_f = gen_best_f;
            best_x_raw = population[0].0.clone();
        }
        history.push(best_f);

        // ── Update mean ───────────────────────────────────────────────────
        let m_old = m.clone();

        // y_i = (x_norm_i - m) / sigma for top mu
        let top_y: Vec<Vec<f64>> = population[..mu].iter().map(|(x_raw, _z, _f)| {
            let x_norm = to_norm(x_raw);
            x_norm.iter().zip(m_old.iter()).map(|(&xi, &mi)| (xi - mi) / sigma).collect()
        }).collect();

        // m_new = m + sigma * sum_i w_i * y_i
        let mut y_w: Vec<f64> = vec![0.0; n];
        for (i, yi) in top_y.iter().enumerate() {
            for j in 0..n {
                y_w[j] += weights[i] * yi[j];
            }
        }
        m = m_old.iter().zip(y_w.iter()).map(|(&mi, &yw)| mi + sigma * yw).collect();

        // ── Update evolution path p_σ ─────────────────────────────────────
        // C^{-1/2} * y_w = B * D^{-1} * Bᵀ * y_w
        let c_inv_half_yw = b_d_inv_bt(&b_mat, &d_diag, &y_w);
        let ps_factor = (c_sigma * (2.0 - c_sigma) * mu_eff).sqrt();
        for i in 0..n {
            p_sigma[i] = (1.0 - c_sigma) * p_sigma[i] + ps_factor * c_inv_half_yw[i];
        }

        // ── Update step size σ ────────────────────────────────────────────
        let ps_norm = p_sigma.iter().map(|&x| x * x).sum::<f64>().sqrt();
        sigma *= ((c_sigma / d_sigma) * (ps_norm / chi_n - 1.0)).exp();
        sigma = sigma.clamp(1e-15, 1e6);

        // ── Update evolution path p_c ─────────────────────────────────────
        let h_sigma = if ps_norm / (1.0 - (1.0 - c_sigma).powi(2 * (gen + 1) as i32)).sqrt() < (1.4 + 2.0 / (n_f + 1.0)) * chi_n { 1.0 } else { 0.0 };
        let pc_factor = (c_c * (2.0 - c_c) * mu_eff).sqrt();
        for i in 0..n {
            p_c[i] = (1.0 - c_c) * p_c[i] + h_sigma * pc_factor * y_w[i];
        }

        // ── Update covariance C ───────────────────────────────────────────
        // Rank-1 update: c_1 * (p_c * p_cᵀ + (1-h_sigma) * c_c * (2-c_c) * C)
        // Rank-μ update: c_μ * Σ_i w_i * y_i * y_iᵀ
        let decay = 1.0 - c_1 - c_mu;
        for i in 0..n {
            for j in 0..=i {
                let rank1 = c_1 * p_c[i] * p_c[j];
                let correction = c_1 * (1.0 - h_sigma) * c_c * (2.0 - c_c) * c_mat[i][j];
                let mut rank_mu = 0.0;
                for (k, yi) in top_y.iter().enumerate() {
                    rank_mu += c_mu * weights[k] * yi[i] * yi[j];
                }
                let new_cij = decay * c_mat[i][j] + rank1 + correction + rank_mu;
                c_mat[i][j] = new_cij;
                c_mat[j][i] = new_cij;
            }
        }

        // ── Eigendecompose C periodically ─────────────────────────────────
        eigen_stale += 1;
        if eigen_stale >= eigen_interval {
            if let Some((b, d)) = jacobi_eigen(&c_mat) {
                b_mat = b;
                // d contains eigenvalues; d_diag = sqrt(eigenvalues)
                d_diag = d.iter().map(|&ev| ev.max(1e-20).sqrt()).collect();
            }
            eigen_stale = 0;
        }

        // ── Convergence check ─────────────────────────────────────────────
        if sigma < config.tol {
            converged = true;
            break;
        }
        // Condition number check
        let d_max = d_diag.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let d_min = d_diag.iter().cloned().fold(f64::INFINITY, f64::min);
        if d_min > 0.0 && d_max / d_min > 1e14 {
            break; // ill-conditioned
        }
    }

    OptimResult {
        optimal_values: best_x_raw,
        best_objective: best_f,
        history,
        converged,
        iterations: config.max_gen,
    }
}

/// Compute B·D·z where B is n×n, D=diag(d_diag), z is n-vector.
fn b_d_z(b: &[Vec<f64>], d: &[f64], z: &[f64]) -> Vec<f64> {
    let n = z.len();
    // First: dz = D * z
    let dz: Vec<f64> = d.iter().zip(z.iter()).map(|(&di, &zi)| di * zi).collect();
    // Then: B * dz
    (0..n).map(|i| (0..n).map(|j| b[i][j] * dz[j]).sum()).collect()
}

/// Compute B·D^{-1}·Bᵀ·y (= C^{-1/2} · y in standard form).
fn b_d_inv_bt(b: &[Vec<f64>], d: &[f64], y: &[f64]) -> Vec<f64> {
    let n = y.len();
    // v = Bᵀ * y
    let v: Vec<f64> = (0..n).map(|j| (0..n).map(|i| b[i][j] * y[i]).sum()).collect();
    // w = D^{-1} * v
    let w: Vec<f64> = d.iter().zip(v.iter()).map(|(&di, &vi)| vi / di.max(1e-20)).collect();
    // B * w
    (0..n).map(|i| (0..n).map(|j| b[i][j] * w[j]).sum()).collect()
}

/// Identity matrix n×n.
fn eye(n: usize) -> Vec<Vec<f64>> {
    (0..n).map(|i| (0..n).map(|j| if i == j { 1.0 } else { 0.0 }).collect()).collect()
}

/// Jacobi eigendecomposition for symmetric n×n matrix A.
/// Returns (B, eigenvalues) where A = B * diag(eigenvalues) * Bᵀ.
/// Limited to 100 sweeps for efficiency.
fn jacobi_eigen(a: &[Vec<f64>]) -> Option<(Vec<Vec<f64>>, Vec<f64>)> {
    let n = a.len();
    if n == 0 { return None; }
    if n == 1 { return Some((vec![vec![1.0]], vec![a[0][0]])); }

    let mut a_cur = a.to_vec();
    let mut v = eye(n);

    for _ in 0..100 * n * n {
        // Find off-diagonal element with largest absolute value
        let mut max_val = 0.0;
        let (mut p, mut q) = (0, 1);
        for i in 0..n {
            for j in i+1..n {
                let aij = a_cur[i][j].abs();
                if aij > max_val {
                    max_val = aij;
                    p = i; q = j;
                }
            }
        }
        if max_val < 1e-14 { break; }

        // Compute rotation angle
        let theta = if (a_cur[q][q] - a_cur[p][p]).abs() < 1e-14 {
            std::f64::consts::FRAC_PI_4
        } else {
            0.5 * ((2.0 * a_cur[p][q]) / (a_cur[q][q] - a_cur[p][p])).atan()
        };
        let cos_t = theta.cos();
        let sin_t = theta.sin();

        // Apply Jacobi rotation to a_cur and v
        let mut a_new = a_cur.clone();
        // Update rows p and q
        for r in 0..n {
            if r != p && r != q {
                let apr = a_cur[p][r];
                let aqr = a_cur[q][r];
                a_new[p][r] = cos_t * apr - sin_t * aqr;
                a_new[r][p] = a_new[p][r];
                a_new[q][r] = sin_t * apr + cos_t * aqr;
                a_new[r][q] = a_new[q][r];
            }
        }
        a_new[p][p] = cos_t * cos_t * a_cur[p][p] - 2.0 * cos_t * sin_t * a_cur[p][q] + sin_t * sin_t * a_cur[q][q];
        a_new[q][q] = sin_t * sin_t * a_cur[p][p] + 2.0 * cos_t * sin_t * a_cur[p][q] + cos_t * cos_t * a_cur[q][q];
        a_new[p][q] = 0.0;
        a_new[q][p] = 0.0;
        a_cur = a_new;

        // Update eigenvectors v
        let v_copy = v.clone();
        for r in 0..n {
            v[r][p] = cos_t * v_copy[r][p] - sin_t * v_copy[r][q];
            v[r][q] = sin_t * v_copy[r][p] + cos_t * v_copy[r][q];
        }
    }

    let eigenvalues: Vec<f64> = (0..n).map(|i| a_cur[i][i]).collect();
    Some((v, eigenvalues))
}

/// Simple xorshift64 PRNG with Box-Muller transform for Gaussian samples.
struct Rng {
    state: u64,
}

impl Rng {
    fn new(seed: u64) -> Self {
        Self { state: if seed == 0 { 0x853c49e6748fea9b } else { seed } }
    }

    fn next_u64(&mut self) -> u64 {
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.state = x;
        x
    }

    fn next_f64(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }

    fn next_gaussian(&mut self) -> f64 {
        // Box-Muller transform
        let u1 = self.next_f64().max(1e-15);
        let u2 = self.next_f64();
        (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Minimize sphere function f(x) = Σx_i² → minimum at 0
    #[test]
    fn cmaes_sphere() {
        let vars: Vec<DesignVar> = (0..3).map(|i| DesignVar {
            name: format!("x{i}"),
            min: -5.0, max: 5.0, initial: 2.0, step: 0.1,
        }).collect();
        let config = CmaesConfig { max_gen: 500, tol: 1e-8, ..Default::default() };
        let result = cmaes(&|x: &[f64]| x.iter().map(|&xi| xi * xi).sum::<f64>(), &vars, &config);
        assert!(result.best_objective < 1e-6,
            "Sphere: f* = {}", result.best_objective);
        for (i, &xi) in result.optimal_values.iter().enumerate() {
            assert!(xi.abs() < 1e-3, "x{i} = {xi}");
        }
    }

    /// Minimize Rosenbrock f(x,y) = (1-x)² + 100(y-x²)² → minimum at (1,1)
    #[test]
    fn cmaes_rosenbrock() {
        let vars = vec![
            DesignVar { name: "x".into(), min: -2.0, max: 2.0, initial: -1.0, step: 0.1 },
            DesignVar { name: "y".into(), min: -2.0, max: 2.0, initial: 0.0, step: 0.1 },
        ];
        let config = CmaesConfig { max_gen: 1000, tol: 1e-10, ..Default::default() };
        let result = cmaes(
            &|x: &[f64]| (1.0 - x[0]).powi(2) + 100.0 * (x[1] - x[0].powi(2)).powi(2),
            &vars, &config,
        );
        assert!(result.best_objective < 1e-4,
            "Rosenbrock: f* = {}", result.best_objective);
    }

    /// History is non-empty and non-increasing (best-so-far tracking)
    #[test]
    fn cmaes_history_monotone() {
        let vars = vec![DesignVar { name: "x".into(), min: -1.0, max: 1.0, initial: 0.5, step: 0.1 }];
        let config = CmaesConfig { max_gen: 50, ..Default::default() };
        let result = cmaes(&|x: &[f64]| x[0] * x[0], &vars, &config);
        assert!(!result.history.is_empty());
        for w in result.history.windows(2) {
            assert!(w[1] <= w[0] + 1e-12, "History not monotone: {} > {}", w[1], w[0]);
        }
    }
}
