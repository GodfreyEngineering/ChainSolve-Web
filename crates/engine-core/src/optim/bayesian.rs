//! Bayesian Optimisation with Gaussian Process surrogate.
//!
//! Uses a Matérn 5/2 kernel GP surrogate with acquisition functions:
//!   - Expected Improvement (EI)
//!   - Upper Confidence Bound (UCB)
//!   - Probability of Improvement (PI)
//!
//! The algorithm:
//!   1. Evaluate objective at initial random points (Sobol sequence).
//!   2. Fit GP to observed (x, y) pairs.
//!   3. Maximise acquisition function (grid + random restarts) → next candidate.
//!   4. Evaluate objective at candidate; update data; repeat.
//!
//! Reference: Snoek, Larochelle, Adams (2012) "Practical Bayesian Optimization
//! of Machine Learning Algorithms".

use crate::optim::{DesignVar, OptimResult};

/// Bayesian optimisation configuration.
pub struct BayesOptConfig {
    /// Design variables (defines the search space).
    pub vars: Vec<DesignVar>,
    /// Objective function to minimise.
    pub objective: Box<dyn Fn(&[f64]) -> f64>,
    /// Number of initial random evaluations (warm-up).
    pub n_initial: usize,
    /// Number of Bayesian optimisation iterations.
    pub n_iterations: usize,
    /// Acquisition function: "ei", "ucb", "pi".
    pub acquisition: String,
    /// UCB kappa parameter (exploration-exploitation trade-off).
    pub kappa: f64,
    /// EI xi parameter (exploration-exploitation).
    pub xi: f64,
    /// Random seed.
    pub seed: u64,
}

/// Simple LCG random number generator (no external deps).
struct Rng(u64);
impl Rng {
    fn next_f64(&mut self) -> f64 {
        self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        ((self.0 >> 33) as f64) / (u64::MAX >> 33) as f64
    }
    fn uniform(&mut self, lo: f64, hi: f64) -> f64 {
        lo + self.next_f64() * (hi - lo)
    }
}

/// Matérn 5/2 kernel: k(r) = (1 + √5·r/ℓ + 5r²/(3ℓ²)) · exp(-√5·r/ℓ)
fn matern52(x1: &[f64], x2: &[f64], length_scale: f64, sigma_f: f64) -> f64 {
    let r2: f64 = x1.iter().zip(x2).map(|(a, b)| (a - b).powi(2)).sum();
    let r = r2.sqrt();
    let sqrt5_r_l = 5.0_f64.sqrt() * r / length_scale;
    sigma_f * sigma_f * (1.0 + sqrt5_r_l + 5.0 * r2 / (3.0 * length_scale * length_scale))
        * (-sqrt5_r_l).exp()
}

/// Gaussian Process surrogate fitted to (X, y) observations.
#[allow(dead_code)]
struct GpSurrogate {
    x_train: Vec<Vec<f64>>,
    y_train: Vec<f64>,
    /// Cholesky factor L (lower triangular) of K + σ²I.
    l: Vec<f64>,
    /// α = L⁻ᵀ (L⁻¹ y), used for predictions.
    alpha: Vec<f64>,
    n: usize,
    length_scale: f64,
    sigma_f: f64,
    sigma_n: f64,
}

impl GpSurrogate {
    /// Fit GP to training data.
    fn fit(x_train: Vec<Vec<f64>>, y_train: Vec<f64>, length_scale: f64, sigma_f: f64, sigma_n: f64) -> Self {
        let n = x_train.len();
        // Build K + σ²I
        let mut k = vec![0.0f64; n * n];
        for i in 0..n {
            for j in 0..n {
                let mut kij = matern52(&x_train[i], &x_train[j], length_scale, sigma_f);
                if i == j { kij += sigma_n * sigma_n; }
                k[i * n + j] = kij;
            }
        }
        // Cholesky: L L^T = K
        let mut l = k;
        cholesky(&mut l, n);

        // α = L^{-T} L^{-1} y
        let alpha = chol_solve(&l, &y_train, n);

        GpSurrogate { x_train, y_train, l, alpha, n, length_scale, sigma_f, sigma_n }
    }

    /// Predict mean and variance at a test point.
    fn predict(&self, x: &[f64]) -> (f64, f64) {
        let n = self.n;
        // k_star = [k(x, x_i)] for all i
        let k_star: Vec<f64> = (0..n)
            .map(|i| matern52(x, &self.x_train[i], self.length_scale, self.sigma_f))
            .collect();

        // mean = k_star^T α
        let mean: f64 = k_star.iter().zip(&self.alpha).map(|(k, a)| k * a).sum();

        // variance = k(x,x) - k_star^T (L L^T)^{-1} k_star
        let k_xx = matern52(x, x, self.length_scale, self.sigma_f) + self.sigma_n * self.sigma_n;
        // v = L^{-1} k_star
        let v = forward_solve(&self.l, &k_star, n);
        let var = (k_xx - v.iter().map(|vi| vi * vi).sum::<f64>()).max(1e-10);

        (mean, var)
    }
}

/// Cholesky decomposition in-place (lower triangular, stored row-major).
fn cholesky(a: &mut Vec<f64>, n: usize) {
    for i in 0..n {
        for j in 0..=i {
            let mut sum = a[i * n + j];
            for k in 0..j {
                sum -= a[i * n + k] * a[j * n + k];
            }
            if i == j {
                a[i * n + j] = sum.max(1e-10).sqrt();
            } else {
                a[i * n + j] = sum / a[j * n + j];
            }
        }
        for j in i + 1..n {
            a[i * n + j] = 0.0; // zero upper triangle
        }
    }
}

/// Forward substitution L·v = b.
fn forward_solve(l: &[f64], b: &[f64], n: usize) -> Vec<f64> {
    let mut v = vec![0.0f64; n];
    for i in 0..n {
        let mut s = b[i];
        for j in 0..i {
            s -= l[i * n + j] * v[j];
        }
        v[i] = s / l[i * n + i].max(1e-15);
    }
    v
}

/// Back substitution L^T·x = b.
fn back_solve(l: &[f64], b: &[f64], n: usize) -> Vec<f64> {
    let mut x = vec![0.0f64; n];
    for i in (0..n).rev() {
        let mut s = b[i];
        for j in i + 1..n {
            s -= l[j * n + i] * x[j]; // L^T[i,j] = L[j,i]
        }
        x[i] = s / l[i * n + i].max(1e-15);
    }
    x
}

/// Solve (L L^T) x = b using forward + back substitution.
fn chol_solve(l: &[f64], b: &[f64], n: usize) -> Vec<f64> {
    let v = forward_solve(l, b, n);
    back_solve(l, &v, n)
}

/// Standard normal CDF (approximation, Abramowitz & Stegun 26.2.17).
fn standard_normal_cdf(z: f64) -> f64 {
    if z < -6.0 { return 0.0; }
    if z > 6.0 { return 1.0; }
    let t = 1.0 / (1.0 + 0.2316419 * z.abs());
    let poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    let pdf = (-0.5 * z * z).exp() / (2.0 * std::f64::consts::PI).sqrt();
    if z >= 0.0 { 1.0 - pdf * poly } else { pdf * poly }
}

/// Standard normal PDF.
fn standard_normal_pdf(z: f64) -> f64 {
    (-0.5 * z * z).exp() / (2.0 * std::f64::consts::PI).sqrt()
}

/// Compute acquisition value at x given the GP and current best.
fn acquisition(x: &[f64], gp: &GpSurrogate, y_best: f64, acq_type: &str, kappa: f64, xi: f64) -> f64 {
    let (mu, var) = gp.predict(x);
    let sigma = var.sqrt();
    match acq_type {
        "ucb" => mu - kappa * sigma, // minimisation: negate UCB
        "pi" => {
            if sigma < 1e-10 { return 0.0; }
            let z = (y_best - mu - xi) / sigma;
            standard_normal_cdf(z)
        }
        _ => { // "ei" (default)
            if sigma < 1e-10 { return 0.0; }
            let z = (y_best - mu - xi) / sigma;
            sigma * (z * standard_normal_cdf(z) + standard_normal_pdf(z))
        }
    }
}

/// Generate initial points using a low-discrepancy (scrambled van der Corput) sequence.
fn initial_points(vars: &[DesignVar], n: usize, seed: u64) -> Vec<Vec<f64>> {
    let d = vars.len();
    let mut rng = Rng(seed);
    let mut points = Vec::with_capacity(n);
    for _ in 0..n {
        let x: Vec<f64> = vars.iter().map(|v| rng.uniform(v.min, v.max)).collect();
        points.push(x);
    }
    // Interleave with latin hypercube-ish points
    for k in 0..n.min(d * 3) {
        let mut x = vec![0.0f64; d];
        for (i, v) in vars.iter().enumerate() {
            x[i] = v.min + (k as f64 + rng.next_f64()) / n as f64 * (v.max - v.min);
        }
        points.push(x);
    }
    points.truncate(n);
    points
}

/// Maximise acquisition function over the design space.
fn maximise_acquisition(
    vars: &[DesignVar],
    gp: &GpSurrogate,
    y_best: f64,
    acq_type: &str,
    kappa: f64,
    xi: f64,
    seed: u64,
) -> Vec<f64> {
    let d = vars.len();
    let mut rng = Rng(seed.wrapping_add(999));
    let n_random = 1000;
    let n_restarts = 10;

    let mut best_x = vars.iter().map(|v| (v.min + v.max) / 2.0).collect::<Vec<_>>();
    let mut best_acq = f64::NEG_INFINITY;

    // Random search
    for _ in 0..n_random {
        let x: Vec<f64> = vars.iter().map(|v| rng.uniform(v.min, v.max)).collect();
        let a = acquisition(&x, gp, y_best, acq_type, kappa, xi);
        if a > best_acq {
            best_acq = a;
            best_x = x;
        }
    }

    // Local refinement from top candidates
    let step_size = 0.05;
    for _ in 0..n_restarts {
        let mut x: Vec<f64> = vars.iter().map(|v| rng.uniform(v.min, v.max)).collect();
        // Gradient-free local search (coordinate descent)
        for _ in 0..50 {
            let a_curr = acquisition(&x, gp, y_best, acq_type, kappa, xi);
            let mut improved = false;
            for i in 0..d {
                let range = vars[i].max - vars[i].min;
                let step = range * step_size;
                let x_plus = {
                    let mut xp = x.clone();
                    xp[i] = (xp[i] + step).min(vars[i].max);
                    xp
                };
                let x_minus = {
                    let mut xm = x.clone();
                    xm[i] = (xm[i] - step).max(vars[i].min);
                    xm
                };
                let a_plus = acquisition(&x_plus, gp, y_best, acq_type, kappa, xi);
                let a_minus = acquisition(&x_minus, gp, y_best, acq_type, kappa, xi);
                if a_plus > a_curr && a_plus >= a_minus {
                    x = x_plus;
                    improved = true;
                } else if a_minus > a_curr {
                    x = x_minus;
                    improved = true;
                }
            }
            if !improved { break; }
        }
        let a = acquisition(&x, gp, y_best, acq_type, kappa, xi);
        if a > best_acq {
            best_acq = a;
            best_x = x;
        }
    }

    best_x
}

/// Fit a GP surrogate on (x_train, y_train) and predict at x_test points.
///
/// Returns `Vec<(mean, std)>` — one entry per test point.
pub fn gp_fit_predict(
    x_train: Vec<Vec<f64>>,
    y_train: Vec<f64>,
    x_test: &[Vec<f64>],
    length_scale: f64,
    sigma_f: f64,
    sigma_n: f64,
) -> Vec<(f64, f64)> {
    if x_train.is_empty() || y_train.is_empty() {
        return x_test.iter().map(|_| (f64::NAN, f64::NAN)).collect();
    }
    let gp = GpSurrogate::fit(x_train, y_train, length_scale, sigma_f, sigma_n);
    x_test.iter().map(|x| {
        let (mean, var) = gp.predict(x);
        (mean, var.sqrt())
    }).collect()
}

/// Run Bayesian optimisation.
pub fn bayesian_optimise(cfg: &BayesOptConfig) -> OptimResult {
    let d = cfg.vars.len();
    let mut history = Vec::new();

    // Initial evaluations
    let x_init = initial_points(&cfg.vars, cfg.n_initial, cfg.seed);
    let mut x_obs: Vec<Vec<f64>> = Vec::new();
    let mut y_obs: Vec<f64> = Vec::new();

    for x in &x_init {
        let y = (cfg.objective)(x);
        x_obs.push(x.clone());
        y_obs.push(y);
        history.push(y_obs.iter().cloned().fold(f64::INFINITY, f64::min));
    }

    let mut best_idx = y_obs.iter()
        .enumerate()
        .min_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(i, _)| i)
        .unwrap_or(0);

    let mut converged = false;

    // Bayesian optimisation loop
    for iter in 0..cfg.n_iterations {
        let y_best = y_obs[best_idx];

        // Fit GP with automatic length scale (geometric mean of variable ranges)
        let length_scale = cfg.vars.iter().map(|v| v.max - v.min).product::<f64>().powf(1.0 / d as f64) * 0.5;
        let sigma_f = (y_obs.iter().map(|&y| y.powi(2)).sum::<f64>() / y_obs.len() as f64).sqrt().max(0.1);
        let sigma_n = 1e-3;

        let gp = GpSurrogate::fit(x_obs.clone(), y_obs.clone(), length_scale, sigma_f, sigma_n);

        // Maximise acquisition function
        let x_next = maximise_acquisition(
            &cfg.vars, &gp, y_best,
            &cfg.acquisition, cfg.kappa, cfg.xi,
            cfg.seed.wrapping_add(iter as u64 * 997),
        );

        let y_next = (cfg.objective)(&x_next);
        x_obs.push(x_next);
        y_obs.push(y_next);

        let new_best_idx = y_obs.iter()
            .enumerate()
            .min_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(i, _)| i)
            .unwrap_or(0);

        let prev_best = y_obs[best_idx];
        best_idx = new_best_idx;
        let new_best = y_obs[best_idx];
        history.push(new_best);

        // Convergence: no improvement > tol for last 5 iterations
        if iter >= 4 {
            let tail = &history[history.len().saturating_sub(5)..];
            let range = tail.iter().cloned().fold(f64::INFINITY, f64::min)
                - tail.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
            if range.abs() < 1e-6 * (prev_best.abs() + 1e-10) {
                converged = true;
                break;
            }
        }
    }

    let best_x = x_obs[best_idx].clone();
    let best_y = y_obs[best_idx];

    OptimResult {
        optimal_values: best_x,
        best_objective: best_y,
        history,
        converged,
        iterations: x_obs.len() - cfg.n_initial,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::optim::DesignVar;

    fn var(name: &str, min: f64, max: f64) -> DesignVar {
        DesignVar { name: name.into(), min, max, initial: (min + max) / 2.0, step: 0.1 }
    }

    #[test]
    fn minimise_quadratic_1d() {
        // f(x) = (x - 2)^2, minimum at x=2
        let cfg = BayesOptConfig {
            vars: vec![var("x", -5.0, 5.0)],
            objective: Box::new(|x| (x[0] - 2.0).powi(2)),
            n_initial: 5,
            n_iterations: 15,
            acquisition: "ei".to_string(),
            kappa: 2.576,
            xi: 0.01,
            seed: 42,
        };
        let result = bayesian_optimise(&cfg);
        assert!((result.optimal_values[0] - 2.0).abs() < 0.5, "x = {}", result.optimal_values[0]);
        assert!(result.best_objective < 0.5, "f = {}", result.best_objective);
    }

    #[test]
    fn minimise_rosenbrock_2d() {
        let cfg = BayesOptConfig {
            vars: vec![var("x", -2.0, 2.0), var("y", -2.0, 2.0)],
            objective: Box::new(|x| (1.0 - x[0]).powi(2) + 100.0 * (x[1] - x[0].powi(2)).powi(2)),
            n_initial: 10,
            n_iterations: 30,
            acquisition: "ei".to_string(),
            kappa: 2.576,
            xi: 0.01,
            seed: 123,
        };
        let result = bayesian_optimise(&cfg);
        assert!(result.best_objective < 1.0, "f = {}", result.best_objective);
        assert!(!result.history.is_empty());
    }

    #[test]
    fn ucb_acquisition() {
        let cfg = BayesOptConfig {
            vars: vec![var("x", 0.0, 1.0)],
            objective: Box::new(|x| x[0] * (1.0 - x[0])),
            n_initial: 3,
            n_iterations: 10,
            acquisition: "ucb".to_string(),
            kappa: 2.0,
            xi: 0.0,
            seed: 7,
        };
        let result = bayesian_optimise(&cfg);
        // f(x) = x(1-x) has min at boundary, max at 0.5 — we minimise
        assert!(result.best_objective <= 0.0 + 0.01);
    }

    #[test]
    fn result_has_history() {
        let cfg = BayesOptConfig {
            vars: vec![var("x", -1.0, 1.0)],
            objective: Box::new(|x| x[0].powi(2)),
            n_initial: 3,
            n_iterations: 5,
            acquisition: "pi".to_string(),
            kappa: 2.0,
            xi: 0.01,
            seed: 0,
        };
        let result = bayesian_optimise(&cfg);
        assert!(!result.history.is_empty());
        assert!(result.history.windows(2).all(|w| w[0] >= w[1]));
    }
}
