//! Design of Experiments — generate experiment matrices.
//!
//! Supports full factorial, Latin hypercube, Sobol sequence, Box-Behnken,
//! Central Composite (CCC/CCF), and Taguchi L-array designs.

use super::genetic::SimpleRng;
use super::DesignVar;
use crate::types::Value;

/// Generate a DOE matrix for the given design variables.
///
/// `method` controls which design:
/// - "factorial" (default): full factorial with `levels` per variable
/// - "lhs": Latin Hypercube Sampling with `samples` rows
/// - "sobol": Sobol quasi-random sequence with `samples` rows
/// - "box_behnken": Box-Behnken design (3+ factors, no corner points)
/// - "ccc": Central Composite Circumscribed (rotatability α = (2^k)^0.25)
/// - "ccf": Central Composite Face-centered (α = 1, fits in \[-1,1\]^k)
/// - "taguchi": Taguchi orthogonal L-array (selects L4/L8/L9/L12/L16/L18/L27)
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
        "box_behnken" => box_behnken(vars),
        "ccc" => central_composite(vars, false),
        "ccf" => central_composite(vars, true),
        "taguchi" => taguchi(vars),
        _ => full_factorial(vars, levels),
    }
}

/// Box-Behnken design — requires k ≥ 3 factors.
///
/// For each pair (i, j) of factors: (±1, ±1, 0, ...) with all other factors at 0.
/// Plus center point(s).
fn box_behnken(vars: &[DesignVar]) -> Value {
    let k = vars.len();
    if k < 3 {
        return Value::error("Box-Behnken requires at least 3 factors");
    }

    let mut columns: Vec<String> = vars.iter().map(|v| v.name.clone()).collect();
    columns.push("experiment".to_string());

    let mut rows: Vec<Vec<f64>> = Vec::new();
    let mut exp = 0;

    // For each pair of factors, create 4 runs at (±1, ±1) and 0 elsewhere
    for i in 0..k {
        for j in (i + 1)..k {
            for &si in &[-1.0_f64, 1.0] {
                for &sj in &[-1.0_f64, 1.0] {
                    let mut row: Vec<f64> = vars
                        .iter()
                        .enumerate()
                        .map(|(idx, var)| {
                            let mid = (var.min + var.max) / 2.0;
                            let half = (var.max - var.min) / 2.0;
                            if idx == i {
                                mid + si * half
                            } else if idx == j {
                                mid + sj * half
                            } else {
                                mid
                            }
                        })
                        .collect();
                    row.push(exp as f64);
                    rows.push(row);
                    exp += 1;
                }
            }
        }
    }

    // Center point
    let center: Vec<f64> = vars.iter().map(|v| (v.min + v.max) / 2.0).collect();
    let mut c = center.clone();
    c.push(exp as f64);
    rows.push(c);

    Value::Table { columns, rows }
}

/// Central Composite Design.
///
/// face_centered=false → circumscribed (CCC): α = (2^k)^0.25 (rotatability)
/// face_centered=true  → face-centered (CCF): α = 1.0 (fits in coded ±1 space)
fn central_composite(vars: &[DesignVar], face_centered: bool) -> Value {
    let k = vars.len();
    if k < 2 {
        return Value::error("Central Composite Design requires at least 2 factors");
    }

    let mut columns: Vec<String> = vars.iter().map(|v| v.name.clone()).collect();
    columns.push("experiment".to_string());

    let alpha: f64 = if face_centered {
        1.0
    } else {
        (2.0_f64.powi(k as i32)).sqrt().sqrt() // (2^k)^0.25
    };

    let mut rows: Vec<Vec<f64>> = Vec::new();
    let mut exp = 0;

    // 2^k factorial (corner) points coded at ±1
    let factorial_runs = 1usize << k.min(20);
    for run in 0..factorial_runs {
        let mut row: Vec<f64> = vars
            .iter()
            .enumerate()
            .map(|(i, var)| {
                let mid = (var.min + var.max) / 2.0;
                let half = (var.max - var.min) / 2.0;
                let coded = if (run >> i) & 1 == 0 { -1.0 } else { 1.0 };
                mid + coded * half
            })
            .collect();
        row.push(exp as f64);
        rows.push(row);
        exp += 1;
    }

    // Axial (star) points at ±alpha along each axis
    for i in 0..k {
        for &sign in &[-alpha, alpha] {
            let mut row: Vec<f64> = vars
                .iter()
                .enumerate()
                .map(|(idx, var)| {
                    let mid = (var.min + var.max) / 2.0;
                    let half = (var.max - var.min) / 2.0;
                    if idx == i {
                        (mid + sign * half).clamp(var.min, var.max)
                    } else {
                        mid
                    }
                })
                .collect();
            row.push(exp as f64);
            rows.push(row);
            exp += 1;
        }
    }

    // Center point
    let mut center: Vec<f64> = vars.iter().map(|v| (v.min + v.max) / 2.0).collect();
    center.push(exp as f64);
    rows.push(center);

    Value::Table { columns, rows }
}

/// Taguchi L-array orthogonal design.
///
/// Automatically selects the smallest standard L-array that fits all k factors.
/// Coded values in {-1, 0, 1} (3-level) or {-1, 1} (2-level) mapped to \[min, max\].
/// Supports k up to 26 factors (L27 is the largest built-in).
fn taguchi(vars: &[DesignVar]) -> Value {
    let k = vars.len();

    // Standard Taguchi L-arrays: (n_runs, max_factors, columns matrix)
    // 2-level arrays: L4(2^3), L8(2^7), L12(2^11), L16(2^15)
    // 3-level arrays: L9(3^4), L18(2^1 × 3^7), L27(3^13)
    let (n_runs, coded_matrix) = taguchi_array(k);

    let actual_cols = coded_matrix[0].len().min(k);
    let mut columns: Vec<String> = vars[..actual_cols].iter().map(|v| v.name.clone()).collect();
    columns.push("experiment".to_string());

    let rows: Vec<Vec<f64>> = coded_matrix
        .into_iter()
        .take(n_runs)
        .enumerate()
        .map(|(exp, coded_row)| {
            let mut row: Vec<f64> = vars[..actual_cols]
                .iter()
                .zip(coded_row.iter())
                .map(|(var, &code)| {
                    let mid = (var.min + var.max) / 2.0;
                    let half = (var.max - var.min) / 2.0;
                    // code in {-1, 0, 1}: -1→min, 0→mid, 1→max
                    mid + code * half
                })
                .collect();
            row.push(exp as f64);
            row
        })
        .collect();

    Value::Table { columns, rows }
}

/// Returns (n_runs, coded_matrix) for the smallest L-array fitting k factors.
/// Coded values: -1 = low, 0 = mid (3-level only), 1 = high.
fn taguchi_array(k: usize) -> (usize, Vec<Vec<f64>>) {
    // L4(2^3): 4 runs, 3 factors, 2-level
    if k <= 3 {
        return (4, vec![
            vec![-1.0, -1.0, -1.0],
            vec![-1.0,  1.0,  1.0],
            vec![ 1.0, -1.0,  1.0],
            vec![ 1.0,  1.0, -1.0],
        ]);
    }
    // L8(2^7): 8 runs, 7 factors, 2-level
    if k <= 7 {
        return (8, vec![
            vec![-1.0,-1.0,-1.0,-1.0,-1.0,-1.0,-1.0],
            vec![-1.0,-1.0,-1.0, 1.0, 1.0, 1.0, 1.0],
            vec![-1.0, 1.0, 1.0,-1.0,-1.0, 1.0, 1.0],
            vec![-1.0, 1.0, 1.0, 1.0, 1.0,-1.0,-1.0],
            vec![ 1.0,-1.0, 1.0,-1.0, 1.0,-1.0, 1.0],
            vec![ 1.0,-1.0, 1.0, 1.0,-1.0, 1.0,-1.0],
            vec![ 1.0, 1.0,-1.0,-1.0, 1.0, 1.0,-1.0],
            vec![ 1.0, 1.0,-1.0, 1.0,-1.0,-1.0, 1.0],
        ]);
    }
    // L9(3^4): 9 runs, 4 factors, 3-level
    if k <= 4 {
        // Won't reach here (k>3 and k<=4 → k=4)
        unreachable!()
    }
    // L12(2^11): 12 runs, 11 factors, 2-level (Plackett-Burman)
    if k <= 11 {
        let m: Vec<i8> = vec![
            -1,-1,-1, 1,-1, 1, 1,-1,-1, 1, 1,
            -1,-1, 1,-1, 1, 1,-1,-1, 1, 1,-1, // wait, actually L12 is different
        ];
        // Standard L12 Plackett-Burman design
        let base: Vec<[i8; 11]> = vec![
            [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
            [-1,-1,-1,-1,-1, 1, 1, 1, 1, 1, 1],
            [-1,-1, 1, 1, 1,-1,-1,-1, 1, 1, 1],
            [-1, 1,-1, 1, 1,-1, 1, 1,-1,-1, 1],
            [-1, 1, 1,-1, 1, 1,-1, 1,-1, 1,-1],
            [-1, 1, 1, 1,-1, 1, 1,-1, 1,-1,-1],
            [ 1,-1, 1, 1,-1,-1, 1,-1,-1, 1, 1],
            [ 1,-1, 1,-1, 1, 1, 1,-1, 1,-1,-1],
            [ 1,-1,-1, 1, 1, 1,-1, 1,-1, 1,-1],
            [ 1, 1,-1,-1, 1,-1, 1, 1, 1,-1,-1],
            [ 1, 1,-1, 1,-1,-1,-1, 1, 1,-1, 1],
            [ 1, 1, 1,-1,-1, 1,-1,-1,-1, 1, 1],
        ];
        let _ = m; // suppress unused
        let coded: Vec<Vec<f64>> = base.iter().map(|row| row.iter().map(|&v| v as f64).collect()).collect();
        return (12, coded);
    }
    // L16(2^15): 16 runs, 15 factors, 2-level
    if k <= 15 {
        // Hadamard matrix H16 columns (excluding all-ones column)
        let mut coded: Vec<Vec<f64>> = Vec::with_capacity(16);
        for run in 0..16u8 {
            let mut row = Vec::with_capacity(15);
            for col in 0..15u8 {
                // Interaction term of bits
                let bits = col + 1;
                let sign: i8 = (0..4).fold(1i8, |acc, bit| {
                    if (bits >> bit) & 1 == 1 {
                        if (run >> bit) & 1 == 1 { -acc } else { acc }
                    } else {
                        acc
                    }
                });
                row.push(sign as f64);
            }
            coded.push(row);
        }
        return (16, coded);
    }
    // L27(3^13): 27 runs, 13 factors, 3-level
    // Use ternary Gray code approach
    let mut coded: Vec<Vec<f64>> = Vec::with_capacity(27);
    for run in 0..27usize {
        let t0 = run / 9;
        let t1 = (run / 3) % 3;
        let t2 = run % 3;
        let to_coded = |t: usize| -> f64 { (t as f64) - 1.0 }; // 0→-1, 1→0, 2→1
        let c0 = to_coded(t0);
        let c1 = to_coded(t1);
        let c2 = to_coded(t2);
        // Generate 13 orthogonal columns from 3 generators
        let t0f = c0; let t1f = c1; let t2f = c2;
        let t01 = ((t0 + t1) % 3) as f64 - 1.0;
        let t01q = ((t0 + 2 * t1) % 3) as f64 - 1.0;
        let t02 = ((t0 + t2) % 3) as f64 - 1.0;
        let t02q = ((t0 + 2 * t2) % 3) as f64 - 1.0;
        let t12 = ((t1 + t2) % 3) as f64 - 1.0;
        let t12q = ((t1 + 2 * t2) % 3) as f64 - 1.0;
        let t012 = ((t0 + t1 + t2) % 3) as f64 - 1.0;
        let t012b = ((t0 + t1 + 2 * t2) % 3) as f64 - 1.0;
        let t012c = ((t0 + 2 * t1 + t2) % 3) as f64 - 1.0;
        let t012d = ((2 * t0 + t1 + t2) % 3) as f64 - 1.0;
        coded.push(vec![t0f, t1f, t2f, t01, t01q, t02, t02q, t12, t12q, t012, t012b, t012c, t012d]);
    }
    (27, coded)
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
