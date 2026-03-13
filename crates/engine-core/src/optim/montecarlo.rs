//! Monte Carlo simulation — run N random samples and compute statistics.

use super::genetic::SimpleRng;
use super::DesignVar;
use crate::types::Value;

/// Run a Monte Carlo simulation: sample each variable uniformly within its
/// bounds `samples` times, evaluate `f`, and return statistical summary.
///
/// Returns a Table with columns:
/// - "statistic": [mean, std, min, max, p5, p25, p50, p75, p95, samples_used]
/// - "value": corresponding numeric value
/// - Plus a "histogram" column with bin counts (10 bins).
pub fn monte_carlo<F>(f: &F, vars: &[DesignVar], samples: usize, seed: u64) -> Value
where
    F: Fn(&[f64]) -> f64,
{
    let samples = samples.max(10);
    let mut rng = SimpleRng::new(seed);

    // Generate samples and evaluate
    let mut results = Vec::with_capacity(samples);
    for _ in 0..samples {
        let x: Vec<f64> = vars
            .iter()
            .map(|v| v.min + rng.next_f64() * (v.max - v.min))
            .collect();
        results.push(f(&x));
    }

    // Filter out NaN/Inf
    let mut valid: Vec<f64> = results.iter().copied().filter(|v| v.is_finite()).collect();
    if valid.is_empty() {
        return Value::error("Monte Carlo: all samples produced NaN/Inf");
    }
    valid.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let n = valid.len();
    let mean = valid.iter().sum::<f64>() / n as f64;
    let variance = valid.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / n as f64;
    let std_dev = variance.sqrt();
    let min = valid[0];
    let max = valid[n - 1];
    let p5 = percentile(&valid, 5.0);
    let p25 = percentile(&valid, 25.0);
    let p50 = percentile(&valid, 50.0);
    let p75 = percentile(&valid, 75.0);
    let p95 = percentile(&valid, 95.0);

    // Histogram: 10 equal-width bins
    let bin_count = 10usize;
    let bin_width = if (max - min).abs() > 1e-15 {
        (max - min) / bin_count as f64
    } else {
        1.0
    };
    let mut bins = vec![0.0f64; bin_count];
    for &v in &valid {
        let idx = ((v - min) / bin_width).floor() as usize;
        let idx = idx.min(bin_count - 1);
        bins[idx] += 1.0;
    }

    // Build result table
    let columns = vec![
        "statistic".to_string(),
        "value".to_string(),
        "histogram".to_string(),
    ];
    let stat_labels = [
        0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0,
    ];
    let stat_values = [mean, std_dev, min, max, p5, p25, p50, p75, p95, n as f64];

    let mut rows = Vec::with_capacity(stat_labels.len().max(bin_count));
    for i in 0..stat_labels.len().max(bin_count) {
        let stat_id = if i < stat_labels.len() {
            stat_labels[i]
        } else {
            f64::NAN
        };
        let stat_val = if i < stat_values.len() {
            stat_values[i]
        } else {
            f64::NAN
        };
        let hist_val = if i < bins.len() { bins[i] } else { f64::NAN };
        rows.push(vec![stat_id, stat_val, hist_val]);
    }

    Value::Table { columns, rows }
}

fn percentile(sorted: &[f64], p: f64) -> f64 {
    if sorted.is_empty() {
        return f64::NAN;
    }
    let k = (p / 100.0) * (sorted.len() - 1) as f64;
    let lo = k.floor() as usize;
    let hi = k.ceil() as usize;
    if lo == hi || hi >= sorted.len() {
        sorted[lo.min(sorted.len() - 1)]
    } else {
        let frac = k - lo as f64;
        sorted[lo] * (1.0 - frac) + sorted[hi] * frac
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn monte_carlo_uniform_mean() {
        // f(x) = x, x ∈ [0, 10] → mean ≈ 5
        let vars = vec![DesignVar {
            name: "x".into(),
            min: 0.0,
            max: 10.0,
            initial: 5.0,
            step: 0.1,
        }];
        let result = monte_carlo(&|x: &[f64]| x[0], &vars, 10_000, 42);
        if let Value::Table { rows, .. } = &result {
            let mean = rows[0][1]; // first row, value column
            assert!((mean - 5.0).abs() < 0.2, "mean={}", mean);
        } else {
            panic!("Expected Table");
        }
    }

    #[test]
    fn monte_carlo_histogram_has_bins() {
        let vars = vec![DesignVar {
            name: "x".into(),
            min: 0.0,
            max: 1.0,
            initial: 0.5,
            step: 0.1,
        }];
        let result = monte_carlo(&|x: &[f64]| x[0], &vars, 1000, 7);
        if let Value::Table { columns, rows } = &result {
            assert_eq!(columns[2], "histogram");
            // All bins should have some counts for a uniform distribution
            let total_hist: f64 = rows.iter().map(|r| r[2]).filter(|v| v.is_finite()).sum();
            assert!((total_hist - 1000.0).abs() < 1.0);
        } else {
            panic!("Expected Table");
        }
    }
}
