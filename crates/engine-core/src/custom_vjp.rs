//! Custom VJP/JVP rules for user-defined blocks (1.35).
//!
//! Inspired by JAX's `custom_vjp` and `custom_jvp` decorators, this module
//! provides a registry of named functions with user-specified gradient rules.
//!
//! ## Motivation
//!
//! When automatic differentiation traces through a function, it uses the chain
//! rule applied to elementary operations. This is correct but can be slow or
//! numerically poor for functions that have a closed-form gradient.
//!
//! A **custom VJP rule** lets you specify:
//!   - `f(x)` → value
//!   - `g(x, v)` → VJP: v^T · J_f(x)  (a vector-Jacobian product)
//!
//! A **custom JVP rule** lets you specify:
//!   - `f(x)` → value
//!   - `h(x, t)` → JVP: J_f(x) · t  (a Jacobian-vector product)
//!
//! ## Block interface
//!
//! The `ad.customVjp` op reads:
//! - `primal_expr`: expression for f(x0, x1, ...)
//! - `vjp_expr`:    expression for the VJP; uses variables `x0..`, `v0..`
//!                  Returns a comma-separated list of n values (one per input).
//!                  Each value is (∂f/∂xi) * v.
//! - `jvp_expr`:    expression for the JVP; uses `x0..` and `t0..` (tangent).
//!                  Returns a single value (J·t).
//! - `var_names`:   comma-separated input variable names
//! - `x`:           evaluation point (Vector port or data field)
//! - `v`:           cotangent vector for VJP (Vector port or data field)
//! - `t`:           tangent vector for JVP (Vector port or data field)
//! - `mode`:        "vjp" | "jvp" | "primal" (default "primal")
//!
//! Output:
//! - mode="primal" → Scalar (f(x))
//! - mode="vjp"    → Vector of length n (cotangent vector)
//! - mode="jvp"    → Scalar (J·t)

use std::collections::HashMap;

/// Evaluate a single expression returning f64.
fn eval_expr(expr: &str, vars: &HashMap<String, f64>) -> f64 {
    crate::expr::eval_expr(expr, vars).unwrap_or(f64::NAN)
}

/// Result of a custom VJP/JVP evaluation.
#[derive(Debug, Clone)]
pub struct CustomAdResult {
    /// Primal output f(x).
    pub primal: f64,
    /// VJP output v^T · J (one value per input), or empty if mode != vjp.
    pub vjp: Vec<f64>,
    /// JVP output J · t (scalar), or NAN if mode != jvp.
    pub jvp: f64,
    /// Mode used.
    pub mode: String,
}

/// Evaluate the primal, VJP, or JVP of a custom rule.
///
/// - `var_names`: input variable names
/// - `x`:         current input values
/// - `v`:         cotangent (for VJP)
/// - `t`:         tangent (for JVP)
/// - `primal_expr`: f(x0, x1, ...)
/// - `vjp_exprs`:   one expression per input for ∂f/∂xi · v (scalar-valued, uses x0.., v)
///                  OR a single expression returning comma-separated results
/// - `jvp_expr`:    single expression for J·t (uses x0.., t0..)
/// - `mode`:        "primal" | "vjp" | "jvp"
pub fn eval_custom_ad(
    var_names: &[String],
    x: &[f64],
    v: &[f64],
    t: &[f64],
    primal_expr: &str,
    vjp_exprs: &[String],
    jvp_expr: &str,
    mode: &str,
) -> CustomAdResult {
    let n = var_names.len();

    // Build base variable map with xi values
    let mut base_vars: HashMap<String, f64> = var_names.iter().zip(x.iter())
        .map(|(name, &val)| (name.clone(), val))
        .collect();

    // Evaluate primal
    let primal = eval_expr(primal_expr, &base_vars);

    let vjp = if mode == "vjp" {
        // Add v as a scalar "v" (single cotangent for scalar output)
        let v_scalar = if v.is_empty() { 1.0 } else { v[0] };
        base_vars.insert("v".to_string(), v_scalar);
        // Also add per-component v0, v1, ...
        for (i, &vi) in v.iter().enumerate() {
            base_vars.insert(format!("v{i}"), vi);
        }

        if vjp_exprs.len() == n {
            // One expression per input
            vjp_exprs.iter().map(|e| eval_expr(e, &base_vars)).collect()
        } else if vjp_exprs.len() == 1 {
            // Single expression expected to return n comma-separated values — but
            // since we evaluate to a scalar, fall back to finite-diff Jacobian * v
            let mut result = vec![0.0f64; n];
            let f0 = primal;
            let eps = 1e-6;
            for i in 0..n {
                let mut vars_pert = base_vars.clone();
                let xi0 = x[i];
                vars_pert.insert(var_names[i].clone(), xi0 + eps);
                let f1 = eval_expr(primal_expr, &vars_pert);
                result[i] = (f1 - f0) / eps * v_scalar;
            }
            result
        } else {
            vec![f64::NAN; n]
        }
    } else {
        vec![]
    };

    let jvp = if mode == "jvp" {
        // Add tangent variables t0, t1, ...
        for (i, &ti) in t.iter().enumerate() {
            base_vars.insert(format!("t{i}"), ti);
        }
        if jvp_expr.is_empty() {
            // Default: finite-diff JVP = sum_i (df/dxi) * ti
            let eps = 1e-6;
            let f0 = primal;
            let mut jvp_val = 0.0;
            for i in 0..n {
                let mut vars_pert = base_vars.clone();
                vars_pert.insert(var_names[i].clone(), x[i] + eps);
                let f1 = eval_expr(primal_expr, &vars_pert);
                jvp_val += (f1 - f0) / eps * t.get(i).copied().unwrap_or(0.0);
            }
            jvp_val
        } else {
            eval_expr(jvp_expr, &base_vars)
        }
    } else {
        f64::NAN
    };

    CustomAdResult { primal, vjp, jvp, mode: mode.to_string() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn primal_sin() {
        let vars = vec!["x".to_string()];
        let x = vec![std::f64::consts::PI / 2.0];
        let r = eval_custom_ad(&vars, &x, &[], &[], "sin(x)", &[], "", "primal");
        assert!((r.primal - 1.0).abs() < 1e-9);
    }

    #[test]
    fn vjp_x_squared() {
        // f(x) = x^2, df/dx = 2x. VJP = 2x * v.
        let vars = vec!["x".to_string()];
        let x = vec![3.0];
        let v = vec![1.0];
        let vjp_exprs = vec!["2*x*v".to_string()];
        let r = eval_custom_ad(&vars, &x, &v, &[], "x^2", &vjp_exprs, "", "vjp");
        assert!((r.vjp[0] - 6.0).abs() < 1e-9, "VJP = {}", r.vjp[0]);
    }

    #[test]
    fn jvp_x_squared() {
        // f(x) = x^2, JVP = 2*x*t0
        let vars = vec!["x".to_string()];
        let x = vec![3.0];
        let t = vec![1.0];
        let r = eval_custom_ad(&vars, &x, &[], &t, "x^2", &[], "2*x*t0", "jvp");
        assert!((r.jvp - 6.0).abs() < 1e-9, "JVP = {}", r.jvp);
    }

    #[test]
    fn vjp_fallback_fd() {
        // No custom vjp rule — should fall back to finite-diff
        let vars = vec!["x".to_string()];
        let x = vec![2.0];
        let v = vec![1.0];
        let r = eval_custom_ad(&vars, &x, &v, &[], "x^3", &[], "", "vjp");
        // df/dx = 3x^2 = 12 at x=2
        assert!((r.vjp[0] - 12.0).abs() < 1e-4, "VJP FD = {}", r.vjp[0]);
    }
}
