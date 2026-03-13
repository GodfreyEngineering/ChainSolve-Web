//! Ordinary Least Squares linear regression.

use crate::types::Value;

/// Trained linear regression model: y = coeffs[0] + coeffs[1]*x1 + coeffs[2]*x2 + ...
#[derive(Debug, Clone)]
pub struct LinearModel {
    pub coefficients: Vec<f64>,
}

/// Fit a linear regression model using OLS (normal equation).
///
/// `x_rows`: each inner Vec is one sample's features.
/// `y`: target values (one per sample).
///
/// Returns coefficients [intercept, w1, w2, ...].
pub fn fit(x_rows: &[Vec<f64>], y: &[f64]) -> Result<LinearModel, String> {
    let n = x_rows.len();
    if n == 0 {
        return Err("No training data".into());
    }
    if n != y.len() {
        return Err("X and Y length mismatch".into());
    }

    let p = x_rows[0].len(); // number of features

    // Build X matrix with intercept column: [1, x1, x2, ...]
    // Normal equation: β = (X'X)^{-1} X'y
    let cols = p + 1;

    // X'X (cols × cols)
    let mut xtx = vec![0.0; cols * cols];
    // X'y (cols × 1)
    let mut xty = vec![0.0; cols];

    for i in 0..n {
        let row = &x_rows[i];
        // Build augmented row [1, x1, x2, ...]
        let mut aug = Vec::with_capacity(cols);
        aug.push(1.0);
        aug.extend_from_slice(row);

        for j in 0..cols {
            xty[j] += aug[j] * y[i];
            for k in 0..cols {
                xtx[j * cols + k] += aug[j] * aug[k];
            }
        }
    }

    // Solve X'X β = X'y using Gaussian elimination with partial pivoting
    let coefficients = solve_linear_system(&xtx, &xty, cols)?;

    Ok(LinearModel { coefficients })
}

/// Predict using a trained linear model.
pub fn predict(model: &LinearModel, x_rows: &[Vec<f64>]) -> Vec<f64> {
    x_rows
        .iter()
        .map(|row| {
            let mut val = model.coefficients[0]; // intercept
            for (i, &x) in row.iter().enumerate() {
                if i + 1 < model.coefficients.len() {
                    val += model.coefficients[i + 1] * x;
                }
            }
            val
        })
        .collect()
}

/// Convert model to Value::Table for downstream consumption.
pub fn model_to_value(model: &LinearModel) -> Value {
    let columns = vec!["coefficient_index".to_string(), "value".to_string()];
    let rows: Vec<Vec<f64>> = model
        .coefficients
        .iter()
        .enumerate()
        .map(|(i, &c)| vec![i as f64, c])
        .collect();
    Value::Table { columns, rows }
}

/// Solve Ax = b using Gaussian elimination with partial pivoting.
fn solve_linear_system(a: &[f64], b: &[f64], n: usize) -> Result<Vec<f64>, String> {
    // Augmented matrix [A | b]
    let cols = n + 1;
    let mut aug = vec![0.0; n * cols];
    for i in 0..n {
        for j in 0..n {
            aug[i * cols + j] = a[i * n + j];
        }
        aug[i * cols + n] = b[i];
    }

    // Forward elimination with partial pivoting
    for col in 0..n {
        // Find pivot
        let mut max_val = aug[col * cols + col].abs();
        let mut max_row = col;
        for row in (col + 1)..n {
            let val = aug[row * cols + col].abs();
            if val > max_val {
                max_val = val;
                max_row = row;
            }
        }

        if max_val < 1e-15 {
            return Err("Singular matrix in linear regression".into());
        }

        // Swap rows
        if max_row != col {
            for j in 0..cols {
                let tmp = aug[col * cols + j];
                aug[col * cols + j] = aug[max_row * cols + j];
                aug[max_row * cols + j] = tmp;
            }
        }

        // Eliminate below
        let pivot = aug[col * cols + col];
        for row in (col + 1)..n {
            let factor = aug[row * cols + col] / pivot;
            for j in col..cols {
                let v = aug[col * cols + j];
                aug[row * cols + j] -= factor * v;
            }
        }
    }

    // Back substitution
    let mut x = vec![0.0; n];
    for i in (0..n).rev() {
        let mut sum = aug[i * cols + n];
        for j in (i + 1)..n {
            sum -= aug[i * cols + j] * x[j];
        }
        x[i] = sum / aug[i * cols + i];
    }

    Ok(x)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fit_simple_line() {
        // y = 2x + 1
        let x = vec![vec![1.0], vec![2.0], vec![3.0], vec![4.0], vec![5.0]];
        let y = vec![3.0, 5.0, 7.0, 9.0, 11.0];
        let model = fit(&x, &y).unwrap();
        assert!((model.coefficients[0] - 1.0).abs() < 1e-10); // intercept
        assert!((model.coefficients[1] - 2.0).abs() < 1e-10); // slope
    }

    #[test]
    fn predict_works() {
        let model = LinearModel {
            coefficients: vec![1.0, 2.0],
        };
        let preds = predict(&model, &[vec![3.0], vec![5.0]]);
        assert!((preds[0] - 7.0).abs() < 1e-10);
        assert!((preds[1] - 11.0).abs() < 1e-10);
    }

    #[test]
    fn fit_multivariate() {
        // y = 1 + 2*x1 + 3*x2
        let x = vec![
            vec![1.0, 0.0],
            vec![0.0, 1.0],
            vec![1.0, 1.0],
            vec![2.0, 1.0],
        ];
        let y = vec![3.0, 4.0, 6.0, 8.0];
        let model = fit(&x, &y).unwrap();
        assert!((model.coefficients[0] - 1.0).abs() < 1e-8);
        assert!((model.coefficients[1] - 2.0).abs() < 1e-8);
        assert!((model.coefficients[2] - 3.0).abs() < 1e-8);
    }
}
