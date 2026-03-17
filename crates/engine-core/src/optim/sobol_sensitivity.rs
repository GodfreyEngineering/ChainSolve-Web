//! Sobol' sensitivity indices — global sensitivity analysis.
//!
//! Computes first-order (S1) and total-order (ST) sensitivity indices
//! for each input variable, indicating how much each variable contributes
//! to the output variance.
//!
//! Reference: Saltelli "Making Best Use of Model Evaluations to Compute
//! Sensitivity Indices" (2002), Computer Physics Communications.

use crate::optim::genetic::SimpleRng;

/// Result of Sobol' sensitivity analysis.
#[derive(Debug, Clone)]
pub struct SobolResult {
    /// First-order sensitivity indices (one per variable).
    pub s1: Vec<f64>,
    /// Total-order sensitivity indices (one per variable).
    pub st: Vec<f64>,
    /// Variable names.
    pub names: Vec<String>,
    /// Number of model evaluations performed.
    pub n_evals: usize,
}

/// Compute Sobol' sensitivity indices using Saltelli's sampling scheme.
///
/// `objective` is the model function f(x) -> scalar.
/// `bounds` is (min, max) for each variable.
/// `n_samples` is the base sample size (total evals ≈ n_samples * (n_vars + 2)).
pub fn sobol_indices(
    objective: &dyn Fn(&[f64]) -> f64,
    bounds: &[(f64, f64)],
    names: &[String],
    n_samples: usize,
) -> SobolResult {
    let k = bounds.len(); // number of variables
    let n = n_samples;
    let mut rng = SimpleRng::new(12345);

    // Generate two independent sample matrices A and B (n × k)
    let a_matrix: Vec<Vec<f64>> = (0..n)
        .map(|_| {
            bounds
                .iter()
                .map(|(lo, hi)| lo + rng.next_f64() * (hi - lo))
                .collect()
        })
        .collect();

    let b_matrix: Vec<Vec<f64>> = (0..n)
        .map(|_| {
            bounds
                .iter()
                .map(|(lo, hi)| lo + rng.next_f64() * (hi - lo))
                .collect()
        })
        .collect();

    // Evaluate f(A) and f(B)
    let f_a: Vec<f64> = a_matrix.iter().map(|x| objective(x)).collect();
    let f_b: Vec<f64> = b_matrix.iter().map(|x| objective(x)).collect();

    // For each variable i, create AB_i matrix (A with column i replaced by B's column i)
    let mut s1 = vec![0.0; k];
    let mut st = vec![0.0; k];
    let mut n_evals = 2 * n;

    let f_a_mean: f64 = f_a.iter().sum::<f64>() / n as f64;
    let f_a_var: f64 = f_a.iter().map(|y| (y - f_a_mean).powi(2)).sum::<f64>() / n as f64;

    if f_a_var < 1e-15 {
        // Constant output — all sensitivities zero
        return SobolResult {
            s1: vec![0.0; k],
            st: vec![0.0; k],
            names: names.to_vec(),
            n_evals,
        };
    }

    for i in 0..k {
        // AB_i: A with column i from B
        let f_ab_i: Vec<f64> = (0..n)
            .map(|j| {
                let mut x = a_matrix[j].clone();
                x[i] = b_matrix[j][i];
                objective(&x)
            })
            .collect();
        n_evals += n;

        // First-order: S1_i = (1/N) * sum(f_B * (f_AB_i - f_A)) / Var(f_A)
        let v1: f64 = (0..n).map(|j| f_b[j] * (f_ab_i[j] - f_a[j])).sum::<f64>() / n as f64;
        s1[i] = v1 / f_a_var;

        // Total-order: ST_i = (1/(2N)) * sum((f_A - f_AB_i)^2) / Var(f_A)
        let vt: f64 = (0..n)
            .map(|j| (f_a[j] - f_ab_i[j]).powi(2))
            .sum::<f64>()
            / (2.0 * n as f64);
        st[i] = vt / f_a_var;
    }

    SobolResult {
        s1,
        st,
        names: names.to_vec(),
        n_evals,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ishigami_like_sensitivity() {
        // f(x1, x2) = x1^2 + 0.1 * x2
        // x1 dominates, x2 has small influence
        let bounds = vec![(-1.0, 1.0), (-1.0, 1.0)];
        let names = vec!["x1".to_string(), "x2".to_string()];
        let result = sobol_indices(
            &|x: &[f64]| x[0] * x[0] + 0.1 * x[1],
            &bounds,
            &names,
            500,
        );

        // x1 should have much higher sensitivity than x2
        assert!(
            result.s1[0] > result.s1[1],
            "S1[x1]={} should be > S1[x2]={}",
            result.s1[0],
            result.s1[1]
        );
        assert!(
            result.st[0] > result.st[1],
            "ST[x1]={} should be > ST[x2]={}",
            result.st[0],
            result.st[1]
        );
    }

    #[test]
    fn constant_function_zero_sensitivity() {
        let bounds = vec![(-1.0, 1.0), (-1.0, 1.0)];
        let names = vec!["x1".to_string(), "x2".to_string()];
        let result = sobol_indices(&|_x: &[f64]| 5.0, &bounds, &names, 100);
        assert_eq!(result.s1, vec![0.0, 0.0]);
        assert_eq!(result.st, vec![0.0, 0.0]);
    }
}
