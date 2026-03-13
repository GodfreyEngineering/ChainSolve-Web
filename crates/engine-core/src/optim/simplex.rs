//! Nelder-Mead simplex optimizer — derivative-free optimization.

use super::{DesignVar, OptimResult};

/// Run Nelder-Mead simplex optimization to minimize `f`.
///
/// Parameters:
/// - `alpha`: reflection coefficient (default 1.0)
/// - `gamma`: expansion coefficient (default 2.0)
/// - `rho`: contraction coefficient (default 0.5)
/// - `sigma`: shrink coefficient (default 0.5)
pub fn nelder_mead<F>(
    f: &F,
    vars: &[DesignVar],
    max_iter: usize,
    tol: f64,
    alpha: f64,
    gamma: f64,
    rho: f64,
    sigma: f64,
) -> OptimResult
where
    F: Fn(&[f64]) -> f64,
{
    let n = vars.len();

    // Build initial simplex: starting point + n vertices offset along each axis
    let x0: Vec<f64> = vars.iter().map(|v| v.initial).collect();
    let mut simplex: Vec<Vec<f64>> = Vec::with_capacity(n + 1);
    simplex.push(x0.clone());

    for i in 0..n {
        let mut vertex = x0.clone();
        let step = (vars[i].max - vars[i].min) * 0.05;
        vertex[i] += if step.abs() > 1e-12 { step } else { 1.0 };
        clamp_to_bounds(&mut vertex, vars);
        simplex.push(vertex);
    }

    let mut fvals: Vec<f64> = simplex.iter().map(|v| f(v)).collect();
    let mut history = Vec::with_capacity(max_iter);
    let mut best_obj = f64::INFINITY;
    let mut best_x = x0;

    for _iter in 0..max_iter {
        // Sort simplex by function value
        let mut order: Vec<usize> = (0..=n).collect();
        order.sort_by(|&a, &b| fvals[a].partial_cmp(&fvals[b]).unwrap_or(std::cmp::Ordering::Equal));

        let best_idx = order[0];
        let worst_idx = order[n];
        let second_worst_idx = order[n - 1];

        if fvals[best_idx] < best_obj {
            best_obj = fvals[best_idx];
            best_x = simplex[best_idx].clone();
        }
        history.push(best_obj);

        // Check convergence: simplex size
        let size = simplex_size(&simplex, &order);
        if size < tol {
            return OptimResult {
                optimal_values: best_x,
                best_objective: best_obj,
                history,
                converged: true,
                iterations: _iter + 1,
            };
        }

        // Compute centroid of all points except the worst
        let mut centroid = vec![0.0; n];
        for &idx in &order[..n] {
            for j in 0..n {
                centroid[j] += simplex[idx][j];
            }
        }
        for j in 0..n {
            centroid[j] /= n as f64;
        }

        // Reflection
        let mut xr = vec![0.0; n];
        for j in 0..n {
            xr[j] = centroid[j] + alpha * (centroid[j] - simplex[worst_idx][j]);
        }
        clamp_to_bounds(&mut xr, vars);
        let fr = f(&xr);

        if fr < fvals[second_worst_idx] && fr >= fvals[best_idx] {
            // Accept reflection
            simplex[worst_idx] = xr;
            fvals[worst_idx] = fr;
            continue;
        }

        if fr < fvals[best_idx] {
            // Expansion
            let mut xe = vec![0.0; n];
            for j in 0..n {
                xe[j] = centroid[j] + gamma * (xr[j] - centroid[j]);
            }
            clamp_to_bounds(&mut xe, vars);
            let fe = f(&xe);

            if fe < fr {
                simplex[worst_idx] = xe;
                fvals[worst_idx] = fe;
            } else {
                simplex[worst_idx] = xr;
                fvals[worst_idx] = fr;
            }
            continue;
        }

        // Contraction
        let mut xc = vec![0.0; n];
        for j in 0..n {
            xc[j] = centroid[j] + rho * (simplex[worst_idx][j] - centroid[j]);
        }
        clamp_to_bounds(&mut xc, vars);
        let fc = f(&xc);

        if fc < fvals[worst_idx] {
            simplex[worst_idx] = xc;
            fvals[worst_idx] = fc;
            continue;
        }

        // Shrink: move all points toward the best
        let best = simplex[best_idx].clone();
        for i in 0..=n {
            if i == best_idx {
                continue;
            }
            for j in 0..n {
                simplex[i][j] = best[j] + sigma * (simplex[i][j] - best[j]);
            }
            clamp_to_bounds(&mut simplex[i], vars);
            fvals[i] = f(&simplex[i]);
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

fn clamp_to_bounds(x: &mut [f64], vars: &[DesignVar]) {
    for (i, v) in vars.iter().enumerate() {
        x[i] = x[i].clamp(v.min, v.max);
    }
}

fn simplex_size(simplex: &[Vec<f64>], order: &[usize]) -> f64 {
    let n = simplex[0].len();
    let best = &simplex[order[0]];
    let mut max_dist: f64 = 0.0;
    for &idx in &order[1..] {
        let dist: f64 = (0..n)
            .map(|j| (simplex[idx][j] - best[j]).powi(2))
            .sum::<f64>()
            .sqrt();
        max_dist = max_dist.max(dist);
    }
    max_dist
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn minimize_quadratic_nm() {
        // f(x) = x² - 4x + 3 = (x-2)² - 1, minimum at x=2
        let vars = vec![DesignVar {
            name: "x".into(),
            min: -10.0,
            max: 10.0,
            initial: 0.0,
            step: 0.1,
        }];
        let result = nelder_mead(
            &|x: &[f64]| x[0] * x[0] - 4.0 * x[0] + 3.0,
            &vars,
            500,
            1e-10,
            1.0,
            2.0,
            0.5,
            0.5,
        );
        assert!(result.converged);
        assert!((result.optimal_values[0] - 2.0).abs() < 0.01);
        assert!((result.best_objective - -1.0).abs() < 0.01);
    }

    #[test]
    fn minimize_rosenbrock_nm() {
        // f(x,y) = (1-x)² + 100(y-x²)², minimum at (1,1)
        let vars = vec![
            DesignVar { name: "x".into(), min: -5.0, max: 5.0, initial: -1.0, step: 0.1 },
            DesignVar { name: "y".into(), min: -5.0, max: 5.0, initial: -1.0, step: 0.1 },
        ];
        let result = nelder_mead(
            &|x: &[f64]| (1.0 - x[0]).powi(2) + 100.0 * (x[1] - x[0].powi(2)).powi(2),
            &vars,
            5000,
            1e-10,
            1.0,
            2.0,
            0.5,
            0.5,
        );
        assert!((result.optimal_values[0] - 1.0).abs() < 0.1);
        assert!((result.optimal_values[1] - 1.0).abs() < 0.1);
    }
}
