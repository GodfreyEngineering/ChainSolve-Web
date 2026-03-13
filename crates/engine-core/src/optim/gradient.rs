//! Gradient descent optimizer with configurable learning rate and momentum.

use super::{DesignVar, OptimResult};

/// Run gradient descent to minimize `f` over the given design variables.
///
/// Uses numerical gradient (central differences) and optional momentum.
pub fn gradient_descent<F>(
    f: &F,
    vars: &[DesignVar],
    max_iter: usize,
    learning_rate: f64,
    momentum: f64,
    tol: f64,
) -> OptimResult
where
    F: Fn(&[f64]) -> f64,
{
    let n = vars.len();
    let mut x: Vec<f64> = vars.iter().map(|v| v.initial).collect();
    let mut velocity = vec![0.0; n];
    let mut history = Vec::with_capacity(max_iter);
    let mut best_obj = f64::INFINITY;
    let mut best_x = x.clone();

    let h = 1e-7; // finite difference step

    for iter in 0..max_iter {
        let obj = f(&x);
        history.push(obj);

        if obj < best_obj {
            best_obj = obj;
            best_x = x.clone();
        }

        // Check convergence
        if iter > 0 && (history[iter - 1] - obj).abs() < tol {
            return OptimResult {
                optimal_values: best_x,
                best_objective: best_obj,
                history,
                converged: true,
                iterations: iter + 1,
            };
        }

        // Compute numerical gradient (central differences)
        let mut grad = vec![0.0; n];
        for i in 0..n {
            let mut x_plus = x.clone();
            let mut x_minus = x.clone();
            x_plus[i] += h;
            x_minus[i] -= h;
            grad[i] = (f(&x_plus) - f(&x_minus)) / (2.0 * h);
        }

        // Update with momentum
        for i in 0..n {
            velocity[i] = momentum * velocity[i] - learning_rate * grad[i];
            x[i] += velocity[i];
            // Clamp to bounds
            x[i] = x[i].clamp(vars[i].min, vars[i].max);
        }
    }

    OptimResult {
        optimal_values: best_x,
        best_objective: best_obj,
        history,
        converged: false,
        iterations: max_iter,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn minimize_quadratic() {
        // f(x) = x² - 4x + 3 = (x-2)² - 1, minimum at x=2
        let vars = vec![DesignVar {
            name: "x".into(),
            min: -10.0,
            max: 10.0,
            initial: 0.0,
            step: 0.1,
        }];
        let result = gradient_descent(
            &|x: &[f64]| x[0] * x[0] - 4.0 * x[0] + 3.0,
            &vars,
            1000,
            0.1,
            0.0,
            1e-10,
        );
        assert!(result.converged);
        assert!((result.optimal_values[0] - 2.0).abs() < 0.01);
        assert!((result.best_objective - -1.0).abs() < 0.01);
    }

    #[test]
    fn minimize_quadratic_with_momentum() {
        let vars = vec![DesignVar {
            name: "x".into(),
            min: -10.0,
            max: 10.0,
            initial: 5.0,
            step: 0.1,
        }];
        let result = gradient_descent(
            &|x: &[f64]| x[0] * x[0] - 4.0 * x[0] + 3.0,
            &vars,
            500,
            0.05,
            0.9,
            1e-10,
        );
        assert!((result.optimal_values[0] - 2.0).abs() < 0.05);
    }

    #[test]
    fn minimize_2d_paraboloid() {
        // f(x,y) = x² + y², minimum at (0,0)
        let vars = vec![
            DesignVar { name: "x".into(), min: -10.0, max: 10.0, initial: 5.0, step: 0.1 },
            DesignVar { name: "y".into(), min: -10.0, max: 10.0, initial: -3.0, step: 0.1 },
        ];
        let result = gradient_descent(
            &|x: &[f64]| x[0] * x[0] + x[1] * x[1],
            &vars,
            1000,
            0.1,
            0.0,
            1e-12,
        );
        assert!(result.optimal_values[0].abs() < 0.01);
        assert!(result.optimal_values[1].abs() < 0.01);
    }
}
