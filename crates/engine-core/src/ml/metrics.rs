//! ML evaluation metrics: MSE, R², confusion matrix.

use crate::types::Value;

/// Mean Squared Error.
pub fn mse(actual: &[f64], predicted: &[f64]) -> f64 {
    if actual.len() != predicted.len() || actual.is_empty() {
        return f64::NAN;
    }
    actual
        .iter()
        .zip(predicted.iter())
        .map(|(&a, &p)| (a - p).powi(2))
        .sum::<f64>()
        / actual.len() as f64
}

/// Coefficient of determination (R²).
pub fn r_squared(actual: &[f64], predicted: &[f64]) -> f64 {
    if actual.len() != predicted.len() || actual.is_empty() {
        return f64::NAN;
    }
    let mean = actual.iter().sum::<f64>() / actual.len() as f64;
    let ss_res: f64 = actual
        .iter()
        .zip(predicted.iter())
        .map(|(&a, &p)| (a - p).powi(2))
        .sum();
    let ss_tot: f64 = actual.iter().map(|&a| (a - mean).powi(2)).sum();
    if ss_tot < 1e-15 {
        return if ss_res < 1e-15 { 1.0 } else { 0.0 };
    }
    1.0 - ss_res / ss_tot
}

/// Build a confusion matrix as a Table Value.
///
/// Returns a Table where rows and columns correspond to classes,
/// and cell values are counts.
pub fn confusion_matrix(actual: &[f64], predicted: &[f64]) -> Value {
    if actual.len() != predicted.len() || actual.is_empty() {
        return Value::error("Confusion matrix: actual and predicted must have same length");
    }

    // Collect unique classes
    let mut classes: Vec<f64> = Vec::new();
    for &v in actual.iter().chain(predicted.iter()) {
        if !classes.iter().any(|&c| (c - v).abs() < 1e-10) {
            classes.push(v);
        }
    }
    classes.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let n = classes.len();
    let mut matrix = vec![0.0; n * n];

    for (&a, &p) in actual.iter().zip(predicted.iter()) {
        let ai = classes.iter().position(|&c| (c - a).abs() < 1e-10).unwrap_or(0);
        let pi = classes.iter().position(|&c| (c - p).abs() < 1e-10).unwrap_or(0);
        matrix[ai * n + pi] += 1.0;
    }

    let columns: Vec<String> = classes.iter().map(|c| format!("pred_{}", c)).collect();
    let rows: Vec<Vec<f64>> = (0..n).map(|i| matrix[i * n..(i + 1) * n].to_vec()).collect();

    Value::Table { columns, rows }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mse_perfect() {
        assert!((mse(&[1.0, 2.0, 3.0], &[1.0, 2.0, 3.0]) - 0.0).abs() < 1e-15);
    }

    #[test]
    fn mse_nonzero() {
        assert!((mse(&[1.0, 2.0, 3.0], &[1.5, 2.5, 3.5]) - 0.25).abs() < 1e-15);
    }

    #[test]
    fn r2_perfect() {
        assert!((r_squared(&[1.0, 2.0, 3.0], &[1.0, 2.0, 3.0]) - 1.0).abs() < 1e-15);
    }

    #[test]
    fn r2_y_equals_2x_plus_1() {
        let actual = vec![3.0, 5.0, 7.0, 9.0, 11.0];
        let predicted = vec![3.0, 5.0, 7.0, 9.0, 11.0];
        assert!((r_squared(&actual, &predicted) - 1.0).abs() < 1e-15);
    }

    #[test]
    fn confusion_matrix_binary() {
        let actual = vec![0.0, 0.0, 1.0, 1.0];
        let predicted = vec![0.0, 1.0, 0.0, 1.0];
        let result = confusion_matrix(&actual, &predicted);
        if let Value::Table { columns, rows } = &result {
            assert_eq!(columns.len(), 2);
            assert_eq!(rows.len(), 2);
            // TP for class 0: 1, FP: 1, FN: 1, TP for class 1: 1
            assert!((rows[0][0] - 1.0).abs() < 1e-10); // actual=0, pred=0
            assert!((rows[0][1] - 1.0).abs() < 1e-10); // actual=0, pred=1
            assert!((rows[1][0] - 1.0).abs() < 1e-10); // actual=1, pred=0
            assert!((rows[1][1] - 1.0).abs() < 1e-10); // actual=1, pred=1
        } else {
            panic!("Expected Table");
        }
    }
}
