//! Polynomial regression — extends linear regression with polynomial features.

use super::linreg::{self, LinearModel};

/// Fit polynomial regression of given `degree` on 1D input.
///
/// Transforms x → [x, x², x³, ...] then applies OLS.
pub fn fit(x: &[f64], y: &[f64], degree: usize) -> Result<LinearModel, String> {
    let degree = degree.max(1).min(10); // cap at degree 10
    let x_poly: Vec<Vec<f64>> = x
        .iter()
        .map(|&xi| (1..=degree).map(|d| xi.powi(d as i32)).collect())
        .collect();
    linreg::fit(&x_poly, y)
}

/// Predict using polynomial model on 1D input.
pub fn predict(model: &LinearModel, x: &[f64], degree: usize) -> Vec<f64> {
    let degree = degree.max(1).min(10);
    let x_poly: Vec<Vec<f64>> = x
        .iter()
        .map(|&xi| (1..=degree).map(|d| xi.powi(d as i32)).collect())
        .collect();
    linreg::predict(model, &x_poly)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fit_quadratic() {
        // y = 1 + 2x + 3x²
        let x: Vec<f64> = (-5..=5).map(|i| i as f64).collect();
        let y: Vec<f64> = x.iter().map(|&xi| 1.0 + 2.0 * xi + 3.0 * xi * xi).collect();
        let model = fit(&x, &y, 2).unwrap();
        assert!((model.coefficients[0] - 1.0).abs() < 1e-6); // intercept
        assert!((model.coefficients[1] - 2.0).abs() < 1e-6); // x
        assert!((model.coefficients[2] - 3.0).abs() < 1e-6); // x²
    }

    #[test]
    fn predict_quadratic() {
        let x: Vec<f64> = (-5..=5).map(|i| i as f64).collect();
        let y: Vec<f64> = x.iter().map(|&xi| 1.0 + 2.0 * xi + 3.0 * xi * xi).collect();
        let model = fit(&x, &y, 2).unwrap();
        let preds = predict(&model, &[10.0], 2);
        let expected = 1.0 + 2.0 * 10.0 + 3.0 * 100.0;
        assert!((preds[0] - expected).abs() < 1e-4);
    }
}
