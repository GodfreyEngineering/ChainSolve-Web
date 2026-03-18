//! Robust design optimisation (item 2.118).
//!
//! Minimises a weighted combination of mean performance and standard deviation
//! under uncertainty, producing a Pareto front of mean vs variance trade-offs.
//!
//! ## Objective
//!
//! The robust objective is:
//! ```text
//! f_robust(x) = μ(x) + k · σ(x)
//! ```
//!
//! where:
//! - μ(x) = mean of f(x + ε) over random perturbations ε ~ N(0, Σ)
//! - σ(x) = standard deviation of f(x + ε)
//! - k    = robustness weight (k=0: pure performance, k>0: penalise variance)
//!
//! ## Algorithm
//!
//! 1. For each design point x, estimate μ and σ via Monte Carlo sampling
//!    over the noise distribution (configurable N_mc samples).
//! 2. Wrap robust objective in the existing L-BFGS-B optimizer.
//! 3. Sweep k ∈ [k_min, k_max] to trace the Pareto front of (μ, σ) pairs.
//!
//! ## Output
//!
//! Returns a Table with columns: `k`, `mean`, `std`, `robust_obj`, `x0`, `x1`, …

use super::{DesignVar, OptimResult};
use crate::types::Value;

/// Robust design configuration.
pub struct RobustConfig {
    /// Noise standard deviation per variable (length = n_vars or 1 = same for all).
    pub noise_std: Vec<f64>,
    /// Number of Monte Carlo samples for estimating μ and σ.
    pub n_mc: usize,
    /// Random seed.
    pub seed: u64,
    /// Number of Pareto front points (k values to sweep).
    pub n_pareto: usize,
    /// Minimum k value (robustness weight).
    pub k_min: f64,
    /// Maximum k value.
    pub k_max: f64,
    /// Max inner optimization iterations per k.
    pub max_iter: usize,
    /// Inner optimization tolerance.
    pub tol: f64,
}

impl Default for RobustConfig {
    fn default() -> Self {
        Self {
            noise_std: vec![0.1],
            n_mc: 50,
            seed: 42,
            n_pareto: 10,
            k_min: 0.0,
            k_max: 5.0,
            max_iter: 200,
            tol: 1e-5,
        }
    }
}

/// Simple xorshift64 + Box-Muller Gaussian sampler.
struct Rng(u64);

impl Rng {
    fn next_f64(&mut self) -> f64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        (self.0 as f64) / (u64::MAX as f64)
    }

    /// Standard normal via Box-Muller.
    fn next_normal(&mut self) -> f64 {
        let u1 = self.next_f64().max(1e-15);
        let u2 = self.next_f64();
        (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos()
    }
}

/// Estimate mean and standard deviation of f at x under Gaussian noise.
fn estimate_moments<F>(
    f: &F,
    x: &[f64],
    noise_std: &[f64],
    n_mc: usize,
    rng: &mut Rng,
) -> (f64, f64)
where
    F: Fn(&[f64]) -> f64,
{
    let n = x.len();
    let mut vals = Vec::with_capacity(n_mc);

    for _ in 0..n_mc {
        let x_perturbed: Vec<f64> = x
            .iter()
            .enumerate()
            .map(|(i, &xi)| {
                let sigma = *noise_std.get(i).or_else(|| noise_std.last()).unwrap_or(&0.1);
                xi + sigma * rng.next_normal()
            })
            .collect();
        vals.push(f(&x_perturbed));
    }

    let mean = vals.iter().sum::<f64>() / n_mc as f64;
    let variance = vals.iter().map(|&v| (v - mean).powi(2)).sum::<f64>() / n_mc as f64;
    (mean, variance.sqrt())
}

/// Run robust design Pareto sweep.
///
/// Returns a Table with one row per k value, showing the Pareto-optimal design.
pub fn robust_pareto<F>(f: &F, vars: &[DesignVar], config: &RobustConfig) -> Value
where
    F: Fn(&[f64]) -> f64,
{
    let n = vars.len();
    if n == 0 {
        return Value::error("robust_design: no design variables");
    }

    let lo: Vec<f64> = vars.iter().map(|v| v.min).collect();
    let hi: Vec<f64> = vars.iter().map(|v| v.max).collect();
    let n_pareto = config.n_pareto.max(2);

    let mut columns = vec!["k".to_string(), "mean".to_string(), "std".to_string(), "robust_obj".to_string()];
    for i in 0..n {
        columns.push(format!("x{i}"));
    }

    let mut rows: Vec<Vec<f64>> = Vec::new();

    for ki in 0..n_pareto {
        let k = config.k_min + (config.k_max - config.k_min) * ki as f64 / (n_pareto - 1) as f64;

        // Optimize robust objective for this k
        let mut rng = Rng(config.seed.wrapping_add(ki as u64 * 1000));
        let noise_std = config.noise_std.clone();
        let n_mc = config.n_mc;

        // Build robust objective closure
        let mut rng_inner = Rng(config.seed.wrapping_add(ki as u64 * 1000 + 1));
        let robust_f = |x: &[f64]| {
            // Use fixed random draws for reproducibility during optimization
            let mut r = Rng(config.seed.wrapping_add(ki as u64 * 9999));
            let (mu, sigma) = estimate_moments(f, x, &noise_std, n_mc, &mut r);
            mu + k * sigma
        };

        // Projected gradient descent (simple but robust inner optimizer)
        let mut x: Vec<f64> = vars.iter().map(|v| v.initial.clamp(v.min, v.max)).collect();
        let mut fx = robust_f(&x);

        for _ in 0..config.max_iter {
            // Numerical gradient
            let h = 1e-5;
            let mut grad = vec![0.0_f64; n];
            for i in 0..n {
                let mut xp = x.clone();
                let mut xm = x.clone();
                xp[i] += h * x[i].abs().max(1.0);
                xm[i] -= h * x[i].abs().max(1.0);
                grad[i] = (robust_f(&xp) - robust_f(&xm)) / (2.0 * h * x[i].abs().max(1.0));
            }

            let g_norm: f64 = grad.iter().map(|&g| g * g).sum::<f64>().sqrt();
            if g_norm < config.tol {
                break;
            }

            // Armijo backtracking
            let mut alpha = 0.1;
            for _ in 0..20 {
                let x_new: Vec<f64> = x
                    .iter()
                    .zip(grad.iter())
                    .enumerate()
                    .map(|(i, (&xi, &gi))| (xi - alpha * gi).clamp(lo[i], hi[i]))
                    .collect();
                let fx_new = robust_f(&x_new);
                if fx_new < fx - 1e-4 * alpha * g_norm * g_norm {
                    x = x_new;
                    fx = fx_new;
                    break;
                }
                alpha *= 0.5;
            }
        }

        // Evaluate final moments at optimal x
        let (mean, std_dev) = estimate_moments(f, &x, &config.noise_std, config.n_mc * 5, &mut rng);
        let robust_obj = mean + k * std_dev;

        let mut row = vec![k, mean, std_dev, robust_obj];
        row.extend_from_slice(&x);
        rows.push(row);
    }

    Value::Table { columns, rows }
}

/// Compute robust objective at a single point (for display/debugging).
pub fn robust_single<F>(f: &F, x: &[f64], noise_std: &[f64], k: f64, n_mc: usize, seed: u64) -> Value
where
    F: Fn(&[f64]) -> f64,
{
    let mut rng = Rng(seed);
    let (mean, sigma) = estimate_moments(f, x, noise_std, n_mc, &mut rng);
    let robust_obj = mean + k * sigma;
    Value::Table {
        columns: vec!["mean".to_string(), "std".to_string(), "robust_obj".to_string()],
        rows: vec![vec![mean, sigma, robust_obj]],
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::optim::DesignVar;

    fn var(name: &str, min: f64, max: f64, init: f64) -> DesignVar {
        DesignVar { name: name.into(), min, max, initial: init, step: 0.01 }
    }

    /// f = x² — deterministic minimum at 0. Robust optimum also at 0 for any k.
    #[test]
    fn robust_sphere_no_noise() {
        let vars = vec![var("x", -5.0, 5.0, 2.0)];
        let f = |x: &[f64]| x[0] * x[0];
        let config = RobustConfig {
            noise_std: vec![0.0],
            n_mc: 20,
            n_pareto: 3,
            k_min: 0.0,
            k_max: 2.0,
            ..Default::default()
        };
        let result = robust_pareto(&f, &vars, &config);
        if let Value::Table { rows, .. } = &result {
            assert_eq!(rows.len(), 3, "expected 3 Pareto points");
            // Optimal x should be near 0 for k=0
            let x_opt = rows[0].get(4).copied().unwrap_or(f64::NAN);
            assert!(x_opt.abs() < 1.0, "x_opt = {x_opt}");
        } else {
            panic!("Expected Table");
        }
    }

    /// Robust moments estimation: f = x, noise ~ N(0, σ), E[f] ≈ x, std ≈ σ.
    #[test]
    fn moments_linear() {
        let f = |x: &[f64]| x[0];
        let x = vec![3.0_f64];
        let mut rng = Rng(42);
        let (mean, sigma) = estimate_moments(&f, &x, &[0.5], 5000, &mut rng);
        assert!((mean - 3.0).abs() < 0.1, "mean = {mean}");
        assert!((sigma - 0.5).abs() < 0.1, "sigma = {sigma}");
    }

    /// Pareto table has correct columns.
    #[test]
    fn pareto_table_columns() {
        let vars = vec![var("x0", -1.0, 1.0, 0.0), var("x1", -1.0, 1.0, 0.0)];
        let f = |x: &[f64]| x[0] * x[0] + x[1] * x[1];
        let config = RobustConfig { n_pareto: 2, max_iter: 5, n_mc: 5, ..Default::default() };
        let result = robust_pareto(&f, &vars, &config);
        if let Value::Table { columns, rows } = &result {
            assert!(columns.contains(&"k".to_string()));
            assert!(columns.contains(&"mean".to_string()));
            assert!(columns.contains(&"std".to_string()));
            assert!(columns.contains(&"x0".to_string()));
            assert!(columns.contains(&"x1".to_string()));
            assert_eq!(rows.len(), 2);
        } else {
            panic!("Expected Table");
        }
    }
}
