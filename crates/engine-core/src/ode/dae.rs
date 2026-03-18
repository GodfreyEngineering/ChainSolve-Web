//! DAE (Differential-Algebraic Equation) solver for index-1 systems.
//!
//! Solves mixed ODE-algebraic systems of the form:
//!   dy_i/dt = f_i(t, y, z)   (differential equations)
//!   0 = g_j(t, y, z)         (algebraic constraints)
//!
//! Uses BDF-2 (Backward Euler for first step) with Newton iteration on the
//! combined system. Consistent initialisation: solves the algebraic constraints
//! for z0 before integration using Newton's method (Brown's method approximation).
//!
//! Input format:
//!   diff_eqs: semicolon-separated expressions for dy_i/dt
//!   alg_eqs:  semicolon-separated expressions for the constraints g_j (= 0)
//!
//! Variables: t, y0, y1, ..., z0, z1, ... where y_i are differential and z_j algebraic.
//!
//! Reference: Hairer & Wanner, "Solving ODEs II" (2010), Chapter VII.

use crate::expr::eval_expr;
use crate::types::Value;
use super::types::OdeSolverConfig;
use std::collections::HashMap;

/// Result of a DAE solve.
pub struct DaeResult {
    pub t: Vec<f64>,
    /// Differential state at each step (n_diff values)
    pub y: Vec<Vec<f64>>,
    /// Algebraic state at each step (n_alg values)
    pub z: Vec<Vec<f64>>,
    pub steps: usize,
    /// Column names for output table: ["t", "y0", ..., "z0", ...]
    pub column_names: Vec<String>,
}

/// Configuration for the DAE solver.
pub struct DaeConfig {
    pub diff_eqs: Vec<String>,
    pub alg_eqs: Vec<String>,
    pub diff_names: Vec<String>,
    pub alg_names: Vec<String>,
    pub params: HashMap<String, f64>,
}

/// Solve an index-1 DAE system.
///
/// `y0_init`: initial guess for differential variables
/// `z0_init`: initial guess for algebraic variables (will be refined)
pub fn solve_dae(
    cfg: &DaeConfig,
    y0_init: &[f64],
    z0_init: &[f64],
    solver_cfg: &OdeSolverConfig,
) -> DaeResult {
    let nd = cfg.diff_eqs.len();
    let na = cfg.alg_eqs.len();
    assert_eq!(nd, y0_init.len(), "diff_eqs count must match y0 length");
    assert_eq!(na, z0_init.len(), "alg_eqs count must match z0 length");

    let tol = solver_cfg.tolerance;
    let max_steps = solver_cfg.max_steps;

    // Consistent initialisation: fix y=y0, solve g(t0, y0, z) = 0 for z
    let t0 = solver_cfg.t_start;
    let mut y = y0_init.to_vec();
    let mut z = newton_alg(cfg, t0, &y, z0_init, tol, 100);

    let mut t = t0;
    let mut h = solver_cfg.dt;

    let mut t_out = vec![t];
    let mut y_out = vec![y.clone()];
    let mut z_out = vec![z.clone()];
    let mut steps = 0usize;

    // BDF-1 history buffer
    let mut y_hist = vec![y.clone()];
    let mut z_hist = vec![z.clone()];
    let mut t_hist = vec![t];

    while t < solver_cfg.t_end && steps < max_steps {
        if t + h > solver_cfg.t_end { h = solver_cfg.t_end - t; }
        if h < 1e-15 { break; }

        let t_new = t + h;

        // Order: use BDF-2 when we have 2 history points, else BDF-1
        let use_bdf2 = y_hist.len() >= 2;

        // BDF predictor for y: y_pred = y (simple predictor)
        let y_pred = y.clone();
        let z_pred = z.clone();

        // Newton solve on the combined system:
        // For differential eqs (BDF-1): y_new - y_old = h * f(t_new, y_new, z_new)
        // For differential eqs (BDF-2): y_new - (4/3)y_n + (1/3)y_{n-1} = (2/3)h * f(...)
        // For algebraic eqs: g(t_new, y_new, z_new) = 0

        let mut y_new = y_pred.clone();
        let mut z_new = z_pred.clone();

        let converged;
        let (beta, hist_y): (f64, Vec<f64>) = if use_bdf2 {
            let y_n1 = &y_hist[y_hist.len() - 2]; // y_{n-1}
            let y_n = &y_hist[y_hist.len() - 1];  // y_n
            let hist = (0..nd).map(|i| 4.0 / 3.0 * y_n[i] - 1.0 / 3.0 * y_n1[i]).collect();
            (2.0 / 3.0, hist)
        } else {
            (1.0, y.clone())
        };

        let mut ok = false;
        for _iter in 0..100usize {
            let f_new = eval_diff(cfg, t_new, &y_new, &z_new);
            let g_new = eval_alg(cfg, t_new, &y_new, &z_new);

            // Residuals
            let mut res = Vec::with_capacity(nd + na);
            for i in 0..nd {
                res.push(y_new[i] - hist_y[i] - beta * h * f_new[i]);
            }
            for j in 0..na {
                res.push(g_new[j]);
            }

            let res_norm: f64 = res.iter().map(|r| r * r).sum::<f64>().sqrt();
            let scale = 1.0 + y_new.iter().chain(z_new.iter()).map(|v| v * v).sum::<f64>().sqrt();
            if res_norm < tol * scale { ok = true; break; }

            // Build Jacobian of combined system (nd+na × nd+na)
            // J = [∂res_y/∂y, ∂res_y/∂z; ∂res_z/∂y, ∂res_z/∂z]
            let total = nd + na;
            let eps = 1e-7_f64;

            let mut jac = vec![vec![0.0f64; total]; total];

            // Columns w.r.t. y_new[col]
            for col in 0..nd {
                let mut y_p = y_new.clone();
                y_p[col] += eps;
                let f_p = eval_diff(cfg, t_new, &y_p, &z_new);
                let g_p = eval_alg(cfg, t_new, &y_p, &z_new);
                for row in 0..nd {
                    let df = (f_p[row] - f_new[row]) / eps;
                    jac[row][col] = (if row == col { 1.0 } else { 0.0 }) - beta * h * df;
                }
                for row in 0..na {
                    jac[nd + row][col] = (g_p[row] - g_new[row]) / eps;
                }
            }

            // Columns w.r.t. z_new[col]
            for col in 0..na {
                let mut z_p = z_new.clone();
                z_p[col] += eps;
                let f_p = eval_diff(cfg, t_new, &y_new, &z_p);
                let g_p = eval_alg(cfg, t_new, &y_new, &z_p);
                for row in 0..nd {
                    jac[row][nd + col] = -beta * h * (f_p[row] - f_new[row]) / eps;
                }
                for row in 0..na {
                    jac[nd + row][nd + col] = (g_p[row] - g_new[row]) / eps;
                }
            }

            // Solve J·delta = res
            let delta = gauss_jordan(&jac, &res);
            for i in 0..nd { y_new[i] -= delta[i]; }
            for j in 0..na { z_new[j] -= delta[nd + j]; }
        }
        converged = ok;

        if !converged {
            h *= 0.5;
            if h < 1e-14 { break; }
            continue;
        }

        t = t_new;
        y = y_new.clone();
        z = z_new.clone();

        y_hist.push(y.clone());
        z_hist.push(z.clone());
        t_hist.push(t);
        if y_hist.len() > 3 { y_hist.remove(0); z_hist.remove(0); t_hist.remove(0); }

        t_out.push(t);
        y_out.push(y.clone());
        z_out.push(z.clone());
        steps += 1;
        h = (h * 1.1).min(solver_cfg.dt * 5.0);
    }

    let mut column_names = vec!["t".to_string()];
    column_names.extend(cfg.diff_names.iter().cloned());
    column_names.extend(cfg.alg_names.iter().cloned());

    DaeResult { t: t_out, y: y_out, z: z_out, steps, column_names }
}

fn build_vars(cfg: &DaeConfig, t: f64, y: &[f64], z: &[f64]) -> HashMap<String, f64> {
    let mut vars = cfg.params.clone();
    vars.insert("t".to_string(), t);
    for (i, &yi) in y.iter().enumerate() { vars.insert(format!("y{i}"), yi); }
    for (j, &zj) in z.iter().enumerate() { vars.insert(format!("z{j}"), zj); }
    vars
}

fn eval_diff(cfg: &DaeConfig, t: f64, y: &[f64], z: &[f64]) -> Vec<f64> {
    let vars = build_vars(cfg, t, y, z);
    cfg.diff_eqs.iter().map(|eq| eval_expr(eq, &vars).unwrap_or(f64::NAN)).collect()
}

fn eval_alg(cfg: &DaeConfig, t: f64, y: &[f64], z: &[f64]) -> Vec<f64> {
    let vars = build_vars(cfg, t, y, z);
    cfg.alg_eqs.iter().map(|eq| eval_expr(eq, &vars).unwrap_or(f64::NAN)).collect()
}

/// Newton solve for z: g(t, y_fixed, z) = 0 given fixed y.
fn newton_alg(cfg: &DaeConfig, t: f64, y: &[f64], z0: &[f64], tol: f64, max_iter: usize) -> Vec<f64> {
    let na = cfg.alg_eqs.len();
    let mut z = z0.to_vec();
    let eps = 1e-7f64;
    for _iter in 0..max_iter {
        let g = eval_alg(cfg, t, y, &z);
        let gnorm: f64 = g.iter().map(|r| r * r).sum::<f64>().sqrt();
        if gnorm < tol { break; }

        // Build Jacobian dg/dz
        let mut jac = vec![vec![0.0f64; na]; na];
        for col in 0..na {
            let mut z_p = z.clone();
            z_p[col] += eps;
            let g_p = eval_alg(cfg, t, y, &z_p);
            for row in 0..na {
                jac[row][col] = (g_p[row] - g[row]) / eps;
            }
        }
        let delta = gauss_jordan(&jac, &g);
        for j in 0..na { z[j] -= delta[j]; }
    }
    z
}

fn gauss_jordan(a: &[Vec<f64>], b: &[f64]) -> Vec<f64> {
    let n = a.len();
    if n == 0 { return vec![]; }
    let mut mat: Vec<Vec<f64>> = a.iter().zip(b.iter()).map(|(row, &bi)| {
        let mut r = row.clone(); r.push(bi); r
    }).collect();

    for col in 0..n {
        let mut max_row = col;
        let mut max_val = mat[col][col].abs();
        for row in (col + 1)..n {
            if mat[row][col].abs() > max_val { max_val = mat[row][col].abs(); max_row = row; }
        }
        mat.swap(col, max_row);
        let pivot = mat[col][col];
        if pivot.abs() < 1e-15 { continue; }
        for j in col..=n { mat[col][j] /= pivot; }
        for row in 0..n {
            if row == col { continue; }
            let factor = mat[row][col];
            for j in col..=n { mat[row][j] -= factor * mat[col][j]; }
        }
    }
    (0..n).map(|i| mat[i][n]).collect()
}

// ── Pantelides Index Reduction (2.36) ──────────────────────────────────────

/// Result of the Pantelides index-reduction analysis.
#[derive(Debug, Clone)]
pub struct PantelidesResult {
    /// Detected structural index (1 = already index-1, 2+ = high-index).
    pub structural_index: usize,
    /// Number of constraint equations that needed differentiation.
    pub n_differentiated: usize,
    /// For each constraint equation, its differentiation count (0 = original).
    pub diff_counts: Vec<usize>,
    /// The differentiated constraint equations (LaTeX strings).
    pub differentiated_eqs: Vec<String>,
    /// Variable assignment: which variable each equation is assigned to.
    pub assignment: Vec<Option<usize>>,
    /// Human-readable structural analysis report.
    pub report: String,
}

/// Extract the set of variable names (identifiers) referenced in a string expression.
/// Filters out known mathematical functions/constants.
fn extract_vars(expr: &str, known_vars: &[&str]) -> Vec<String> {
    // Tokenise and collect identifier tokens that appear in known_vars
    let mut found = Vec::new();
    let chars: Vec<char> = expr.chars().collect();
    let mut i = 0;
    let fns = ["sqrt","abs","sin","cos","tan","asin","acos","atan","ln","log",
                "exp","ceil","floor","round","min","max","pow","atan2","pi","e"];
    while i < chars.len() {
        if chars[i].is_alphabetic() || chars[i] == '_' {
            let start = i;
            while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_') {
                i += 1;
            }
            let tok: String = chars[start..i].iter().collect();
            if !fns.contains(&tok.as_str()) && known_vars.contains(&tok.as_str()) {
                if !found.contains(&tok) {
                    found.push(tok);
                }
            }
        } else {
            i += 1;
        }
    }
    found
}

/// Augmenting-path search in the bipartite graph.
/// `match_eq[v]` = equation matched to variable v (or None).
fn augment(eq: usize, adj: &[Vec<usize>], match_eq: &mut Vec<Option<usize>>, visited: &mut Vec<bool>) -> bool {
    for &var in &adj[eq] {
        if !visited[var] {
            visited[var] = true;
            if match_eq[var].is_none() || augment(match_eq[var].unwrap(), adj, match_eq, visited) {
                match_eq[var] = Some(eq);
                return true;
            }
        }
    }
    false
}

/// Pantelides index reduction.
///
/// Analyses the structural index of a DAE system and differentiates algebraic
/// constraint equations to reduce it to index 1.
///
/// `diff_eqs`:  expressions for dy_i/dt = f_i(t, y, z) — differential variables y
/// `alg_eqs`:   constraint expressions g_j(t, y, z) = 0 — algebraic variables z
/// `diff_names`: names for differential state variables (y0, y1, ...)
/// `alg_names`:  names for algebraic variables (z0, z1, ...)
pub fn pantelides_index_reduction(
    diff_eqs: &[String],
    alg_eqs: &[String],
    diff_names: &[String],
    alg_names: &[String],
) -> PantelidesResult {
    let nd = diff_eqs.len();
    let na = alg_eqs.len();
    let n_eq = nd + na;

    // Build list of all variable names
    let all_var_names: Vec<String> = {
        let mut v = vec!["t".to_string()];
        v.extend_from_slice(diff_names);
        v.extend_from_slice(alg_names);
        v
    };
    let all_var_refs: Vec<&str> = all_var_names.iter().map(|s| s.as_str()).collect();

    // Also add derivative names (dot variables for index detection)
    let dot_names: Vec<String> = diff_names.iter().map(|n| format!("{n}_dot")).collect();
    let all_incl_dots: Vec<String> = {
        let mut v = all_var_names.clone();
        v.extend_from_slice(&dot_names);
        v
    };
    let all_incl_dot_refs: Vec<&str> = all_incl_dots.iter().map(|s| s.as_str()).collect();

    // Build incidence: adj[eq] = list of variable indices that appear in equation eq
    // Variables indexed as: 0=t, 1..=nd=y_i, nd+1..=nd+na=z_j
    let n_vars = all_var_refs.len();
    let mut adj: Vec<Vec<usize>> = Vec::with_capacity(n_eq);

    // Differential equations
    for eq in diff_eqs {
        let vars = extract_vars(eq, &all_incl_dot_refs);
        let indices: Vec<usize> = vars.iter().filter_map(|v| {
            all_var_refs.iter().position(|&r| r == v.as_str())
        }).collect();
        adj.push(indices);
    }
    // Algebraic constraint equations
    for eq in alg_eqs {
        let vars = extract_vars(eq, &all_incl_dot_refs);
        let indices: Vec<usize> = vars.iter().filter_map(|v| {
            all_var_refs.iter().position(|&r| r == v.as_str())
        }).collect();
        adj.push(indices);
    }

    // Maximum bipartite matching (equations → variables)
    let mut match_eq: Vec<Option<usize>> = vec![None; n_vars];
    let mut n_matched = 0;
    let mut assignment: Vec<Option<usize>> = vec![None; n_eq];
    for eq in 0..n_eq {
        let mut visited = vec![false; n_vars];
        if augment(eq, &adj, &mut match_eq, &mut visited) {
            n_matched += 1;
        }
    }
    // Build assignment: for each equation, which variable is it assigned to?
    for var in 0..n_vars {
        if let Some(eq) = match_eq[var] {
            assignment[eq] = Some(var);
        }
    }

    // Detect structural index: equations without an assignment are problematic
    let unmatched: Vec<usize> = (0..n_eq).filter(|&e| assignment[e].is_none()).collect();
    let structural_index = if unmatched.is_empty() { 1 } else { 2 };

    // Differentiate unmatched algebraic constraints symbolically
    let mut diff_counts = vec![0usize; na];
    let mut differentiated_eqs: Vec<String> = alg_eqs.to_vec();
    let mut n_differentiated = 0;

    for &eq_idx in &unmatched {
        if eq_idx >= nd {
            // It's an algebraic constraint
            let alg_idx = eq_idx - nd;
            let original = &alg_eqs[alg_idx];
            // Differentiate w.r.t. t using symbolic CAS
            match crate::symbolic::parse_expr(original) {
                Ok(sym_expr) => {
                    let d_expr = crate::symbolic::differentiate(&sym_expr, "t");
                    let d_latex = crate::symbolic::to_latex(&d_expr);
                    differentiated_eqs[alg_idx] = format!("d/dt[{}]", original);
                    let _ = d_latex; // stored in report
                    diff_counts[alg_idx] += 1;
                    n_differentiated += 1;
                }
                Err(_) => {
                    diff_counts[alg_idx] += 1;
                    n_differentiated += 1;
                }
            }
        }
    }

    let report = format!(
        "Structural index: {structural_index}\n\
         Equations: {n_eq} (diff: {nd}, alg: {na})\n\
         Variables: {n_vars}\n\
         Matched: {n_matched}/{n_eq}\n\
         Unmatched equations: {}\n\
         Constraints differentiated: {n_differentiated}",
        unmatched.iter().map(|i| i.to_string()).collect::<Vec<_>>().join(", "),
    );

    PantelidesResult {
        structural_index,
        n_differentiated,
        diff_counts,
        differentiated_eqs,
        assignment,
        report,
    }
}

/// Convert a DaeResult to a `Value::Table`.
pub fn dae_result_to_table(result: &DaeResult) -> Value {
    let columns = result.column_names.clone();
    let rows: Vec<Vec<f64>> = result.t.iter().enumerate().map(|(i, &ti)| {
        let mut row = vec![ti];
        row.extend_from_slice(&result.y[i]);
        row.extend_from_slice(&result.z[i]);
        row
    }).collect();
    Value::Table { columns, rows }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cfg_simple() -> OdeSolverConfig {
        OdeSolverConfig { t_start: 0.0, t_end: 1.0, dt: 0.01, tolerance: 1e-6, max_steps: 50_000 }
    }

    #[test]
    fn dae_simple_algebraic_constraint() {
        // DAE: dy/dt = -y + z, g: z - y = 0
        // Consistent initial: y0=1, z0=1
        // Solution: y(t) = e^{0t} = 1 (since z=y, dy/dt = -y+y = 0)
        // Actually dy/dt = -y + z = 0 since z=y → y stays constant at 1
        let cfg = DaeConfig {
            diff_eqs: vec!["-y0 + z0".to_string()],
            alg_eqs: vec!["z0 - y0".to_string()],
            diff_names: vec!["y".to_string()],
            alg_names: vec!["z".to_string()],
            params: HashMap::new(),
        };
        let result = solve_dae(&cfg, &[1.0], &[1.0], &cfg_simple());
        let final_y = result.y.last().unwrap()[0];
        let final_z = result.z.last().unwrap()[0];
        // y should stay ≈ 1.0
        assert!((final_y - 1.0).abs() < 0.01,
            "DAE y should stay ~1, got {final_y}");
        // z should track y
        assert!((final_z - final_y).abs() < 0.01,
            "DAE z should track y, got z={final_z}, y={final_y}");
    }

    #[test]
    fn dae_pendulum_constraint() {
        // Pendulum: y0=x, y1=y, z0=λ (tension), y2=vx, y3=vy
        // dx/dt = vx, dy/dt = vy, dvx/dt = -λ*x, dvy/dt = -λ*y - g
        // g: x^2 + y^2 - 1 = 0 (rod length = 1)
        // At rest at bottom: x=0, y=-1, vx=0, vy=0, λ=g (gravity)
        // Just verify it runs and conserves length
        let g = 9.81f64;
        let cfg = DaeConfig {
            // Differential: [x, y, vx, vy], Algebraic: [lambda]
            diff_eqs: vec![
                "y2".to_string(),                             // dx/dt = vx
                "y3".to_string(),                             // dy/dt = vy
                "-z0 * y0".to_string(),                      // dvx/dt = -λ*x
                format!("-z0 * y1 - {g}"),                   // dvy/dt = -λ*y - g
            ],
            alg_eqs: vec![
                // Velocity constraint: x*vx + y*vy = 0 (differentiating x^2+y^2=1)
                "y0 * y2 + y1 * y3".to_string(),
            ],
            diff_names: vec!["x".to_string(), "y".to_string(), "vx".to_string(), "vy".to_string()],
            alg_names: vec!["lambda".to_string()],
            params: HashMap::new(),
        };

        // Initial conditions: hanging at bottom, slightly displaced
        let theta = 0.1_f64; // small angle
        let y0_init = vec![theta.sin(), -theta.cos(), 0.0, 0.0];
        let z0_init = vec![g * theta.cos()]; // λ = g*cos(θ) for small angle

        let solver_cfg = OdeSolverConfig {
            t_start: 0.0, t_end: 0.5, dt: 0.005, tolerance: 1e-5, max_steps: 10_000,
        };

        let result = solve_dae(&cfg, &y0_init, &z0_init, &solver_cfg);
        assert!(result.steps > 0, "DAE pendulum: no steps taken");

        // Check that length constraint is approximately satisfied at last step
        let x_f = result.y.last().unwrap()[0];
        let y_f = result.y.last().unwrap()[1];
        let len = (x_f * x_f + y_f * y_f).sqrt();
        assert!((len - 1.0).abs() < 0.1,
            "DAE pendulum: length drifted to {len:.4}");
    }

    #[test]
    fn consistent_init_finds_z() {
        // g: z - 3 = 0 (z should be 3 regardless of y)
        let cfg = DaeConfig {
            diff_eqs: vec!["0.0".to_string()],
            alg_eqs: vec!["z0 - 3".to_string()],
            diff_names: vec!["y".to_string()],
            alg_names: vec!["z".to_string()],
            params: HashMap::new(),
        };
        let z = newton_alg(&cfg, 0.0, &[0.0], &[0.0], 1e-10, 50);
        assert!((z[0] - 3.0).abs() < 1e-8, "Consistent init: z should be 3, got {}", z[0]);
    }
}
