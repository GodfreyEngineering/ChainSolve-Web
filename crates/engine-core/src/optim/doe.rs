//! Design of Experiments — generate experiment matrices.
//!
//! Supports full factorial, Latin hypercube, and Sobol sequence designs.

use super::genetic::SimpleRng;
use super::DesignVar;
use crate::types::Value;

/// Generate a DOE matrix for the given design variables.
///
/// `method` controls which design:
/// - "factorial" (default): full factorial with `levels` per variable
/// - "lhs": Latin Hypercube Sampling with `samples` rows
/// - "sobol": Sobol quasi-random sequence with `samples` rows
pub fn design_of_experiments(
    vars: &[DesignVar],
    method: &str,
    levels: usize,
    samples: usize,
    seed: u64,
) -> Value {
    if vars.is_empty() {
        return Value::error("DOE requires at least one variable");
    }

    match method {
        "lhs" => latin_hypercube(vars, samples, seed),
        "sobol" => sobol_sequence(vars, samples),
        _ => full_factorial(vars, levels),
    }
}

/// Full factorial design: all combinations of `levels` evenly spaced values.
fn full_factorial(vars: &[DesignVar], levels: usize) -> Value {
    let levels = levels.max(2);
    let n = vars.len();
    let total_rows = levels.checked_pow(n as u32).unwrap_or(10_000).min(10_000);

    let mut columns: Vec<String> = vars.iter().map(|v| v.name.clone()).collect();
    columns.push("experiment".to_string());

    let mut rows = Vec::with_capacity(total_rows);

    // Generate all combinations using mixed-radix counting
    for i in 0..total_rows {
        let mut row = Vec::with_capacity(n + 1);
        let mut idx = i;
        for var in vars {
            let level_idx = idx % levels;
            idx /= levels;
            let t = level_idx as f64 / (levels - 1).max(1) as f64;
            row.push(var.min + t * (var.max - var.min));
        }
        row.push(i as f64); // experiment number
        rows.push(row);
    }

    Value::Table { columns, rows }
}

/// Latin Hypercube Sampling: stratified random sampling.
fn latin_hypercube(vars: &[DesignVar], samples: usize, seed: u64) -> Value {
    let samples = samples.max(2);
    let n = vars.len();
    let mut rng = SimpleRng::new(seed);

    // For each variable, create a permutation of [0..samples]
    let mut perms: Vec<Vec<usize>> = Vec::with_capacity(n);
    for _ in 0..n {
        let mut perm: Vec<usize> = (0..samples).collect();
        // Fisher-Yates shuffle
        for i in (1..samples).rev() {
            let j = rng.next_usize(i + 1);
            perm.swap(i, j);
        }
        perms.push(perm);
    }

    let mut columns: Vec<String> = vars.iter().map(|v| v.name.clone()).collect();
    columns.push("experiment".to_string());

    let mut rows = Vec::with_capacity(samples);
    for i in 0..samples {
        let mut row = Vec::with_capacity(n + 1);
        for (j, var) in vars.iter().enumerate() {
            let stratum = perms[j][i];
            let u = (stratum as f64 + rng.next_f64()) / samples as f64;
            row.push(var.min + u * (var.max - var.min));
        }
        row.push(i as f64);
        rows.push(row);
    }

    Value::Table { columns, rows }
}

/// Sobol quasi-random sequence (simplified: uses Van der Corput sequence).
fn sobol_sequence(vars: &[DesignVar], samples: usize) -> Value {
    let samples = samples.max(2);
    let n = vars.len();

    let mut columns: Vec<String> = vars.iter().map(|v| v.name.clone()).collect();
    columns.push("experiment".to_string());

    let mut rows = Vec::with_capacity(samples);
    // Use different prime bases for each dimension
    let primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];

    for i in 0..samples {
        let mut row = Vec::with_capacity(n + 1);
        for (j, var) in vars.iter().enumerate() {
            let base = primes[j % primes.len()];
            let u = van_der_corput(i + 1, base);
            row.push(var.min + u * (var.max - var.min));
        }
        row.push(i as f64);
        rows.push(row);
    }

    Value::Table { columns, rows }
}

/// Van der Corput sequence in given base — low-discrepancy quasi-random.
fn van_der_corput(mut n: usize, base: usize) -> f64 {
    let mut result = 0.0;
    let mut denom = 1.0;
    while n > 0 {
        denom *= base as f64;
        result += (n % base) as f64 / denom;
        n /= base;
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn factorial_3vars_3levels() {
        let vars = vec![
            DesignVar { name: "x".into(), min: 0.0, max: 1.0, initial: 0.5, step: 0.1 },
            DesignVar { name: "y".into(), min: 0.0, max: 1.0, initial: 0.5, step: 0.1 },
            DesignVar { name: "z".into(), min: 0.0, max: 1.0, initial: 0.5, step: 0.1 },
        ];
        let result = full_factorial(&vars, 3);
        if let Value::Table { columns, rows } = &result {
            assert_eq!(rows.len(), 27); // 3³ = 27
            assert_eq!(columns.len(), 4); // x, y, z, experiment
        } else {
            panic!("Expected Table");
        }
    }

    #[test]
    fn lhs_samples_correct_count() {
        let vars = vec![
            DesignVar { name: "x".into(), min: 0.0, max: 10.0, initial: 5.0, step: 0.1 },
            DesignVar { name: "y".into(), min: -5.0, max: 5.0, initial: 0.0, step: 0.1 },
        ];
        let result = latin_hypercube(&vars, 50, 42);
        if let Value::Table { rows, .. } = &result {
            assert_eq!(rows.len(), 50);
            // All values within bounds
            for row in rows {
                assert!(row[0] >= 0.0 && row[0] <= 10.0);
                assert!(row[1] >= -5.0 && row[1] <= 5.0);
            }
        } else {
            panic!("Expected Table");
        }
    }

    #[test]
    fn sobol_low_discrepancy() {
        let vars = vec![DesignVar {
            name: "x".into(),
            min: 0.0,
            max: 1.0,
            initial: 0.5,
            step: 0.1,
        }];
        let result = sobol_sequence(&vars, 8);
        if let Value::Table { rows, .. } = &result {
            assert_eq!(rows.len(), 8);
            // Van der Corput base 2: 0.5, 0.25, 0.75, 0.125, 0.625, 0.375, 0.875, 0.0625
            assert!((rows[0][0] - 0.5).abs() < 1e-10);
            assert!((rows[1][0] - 0.25).abs() < 1e-10);
            assert!((rows[2][0] - 0.75).abs() < 1e-10);
        } else {
            panic!("Expected Table");
        }
    }

    #[test]
    fn doe_dispatch() {
        let vars = vec![
            DesignVar { name: "a".into(), min: 0.0, max: 1.0, initial: 0.5, step: 0.1 },
            DesignVar { name: "b".into(), min: 0.0, max: 1.0, initial: 0.5, step: 0.1 },
        ];
        // Default = factorial
        let r = design_of_experiments(&vars, "factorial", 3, 50, 0);
        assert!(matches!(r, Value::Table { .. }));

        let r = design_of_experiments(&vars, "lhs", 3, 50, 42);
        assert!(matches!(r, Value::Table { .. }));

        let r = design_of_experiments(&vars, "sobol", 3, 50, 0);
        assert!(matches!(r, Value::Table { .. }));
    }
}
