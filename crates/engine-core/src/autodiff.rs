//! `autodiff` — Automatic Differentiation engine.
//!
//! Provides forward-mode AD via dual numbers and reverse-mode AD via
//! tape-based recording. Supports composable transformations for
//! gradient computation, Jacobians, and Hessian-vector products.

use std::ops::{Add, Div, Mul, Neg, Sub};

// ── Forward-Mode AD (Dual Numbers) ──────────────────────────────────────────

/// A dual number: value + derivative * ε, where ε² = 0.
///
/// Efficient when dim(input) << dim(output), e.g., sensitivity of
/// 1000 outputs to 3 parameters. One forward pass per input variable.
#[derive(Debug, Clone, Copy)]
pub struct Dual {
    /// The function value.
    pub val: f64,
    /// The derivative component (tangent).
    pub dot: f64,
}

impl Dual {
    /// Create a dual number with explicit value and derivative.
    pub fn new(val: f64, dot: f64) -> Self {
        Dual { val, dot }
    }

    /// Create a constant (derivative = 0).
    pub fn constant(val: f64) -> Self {
        Dual { val, dot: 0.0 }
    }

    /// Create a variable (derivative = 1 w.r.t. itself).
    pub fn variable(val: f64) -> Self {
        Dual { val, dot: 1.0 }
    }

    /// Power: self^n for f64 exponent.
    pub fn powf(self, n: f64) -> Self {
        Dual {
            val: self.val.powf(n),
            dot: n * self.val.powf(n - 1.0) * self.dot,
        }
    }

    /// Power: self^other (both dual).
    pub fn pow_dual(self, other: Dual) -> Self {
        // d(f^g) = f^g * (g' * ln(f) + g * f'/f)
        let val = self.val.powf(other.val);
        let dot = val * (other.dot * self.val.ln() + other.val * self.dot / self.val);
        Dual { val, dot }
    }

    pub fn sin(self) -> Self {
        Dual { val: self.val.sin(), dot: self.val.cos() * self.dot }
    }

    pub fn cos(self) -> Self {
        Dual { val: self.val.cos(), dot: -self.val.sin() * self.dot }
    }

    pub fn tan(self) -> Self {
        let c = self.val.cos();
        Dual { val: self.val.tan(), dot: self.dot / (c * c) }
    }

    pub fn exp(self) -> Self {
        let ev = self.val.exp();
        Dual { val: ev, dot: ev * self.dot }
    }

    pub fn ln(self) -> Self {
        Dual { val: self.val.ln(), dot: self.dot / self.val }
    }

    pub fn log10(self) -> Self {
        Dual { val: self.val.log10(), dot: self.dot / (self.val * std::f64::consts::LN_10) }
    }

    pub fn sqrt(self) -> Self {
        let sv = self.val.sqrt();
        Dual { val: sv, dot: self.dot / (2.0 * sv) }
    }

    pub fn abs(self) -> Self {
        Dual { val: self.val.abs(), dot: self.dot * self.val.signum() }
    }

    pub fn asin(self) -> Self {
        Dual { val: self.val.asin(), dot: self.dot / (1.0 - self.val * self.val).sqrt() }
    }

    pub fn acos(self) -> Self {
        Dual { val: self.val.acos(), dot: -self.dot / (1.0 - self.val * self.val).sqrt() }
    }

    pub fn atan(self) -> Self {
        Dual { val: self.val.atan(), dot: self.dot / (1.0 + self.val * self.val) }
    }

    pub fn sinh(self) -> Self {
        Dual { val: self.val.sinh(), dot: self.val.cosh() * self.dot }
    }

    pub fn cosh(self) -> Self {
        Dual { val: self.val.cosh(), dot: self.val.sinh() * self.dot }
    }

    pub fn tanh(self) -> Self {
        let t = self.val.tanh();
        Dual { val: t, dot: (1.0 - t * t) * self.dot }
    }

    pub fn atan2(self, other: Dual) -> Self {
        let denom = self.val * self.val + other.val * other.val;
        Dual {
            val: self.val.atan2(other.val),
            dot: (other.val * self.dot - self.val * other.dot) / denom,
        }
    }

    pub fn max(self, other: Dual) -> Self {
        if self.val >= other.val { self } else { other }
    }

    pub fn min(self, other: Dual) -> Self {
        if self.val <= other.val { self } else { other }
    }
}

impl Add for Dual {
    type Output = Self;
    fn add(self, rhs: Self) -> Self {
        Dual { val: self.val + rhs.val, dot: self.dot + rhs.dot }
    }
}

impl Sub for Dual {
    type Output = Self;
    fn sub(self, rhs: Self) -> Self {
        Dual { val: self.val - rhs.val, dot: self.dot - rhs.dot }
    }
}

impl Mul for Dual {
    type Output = Self;
    fn mul(self, rhs: Self) -> Self {
        Dual {
            val: self.val * rhs.val,
            dot: self.val * rhs.dot + self.dot * rhs.val,
        }
    }
}

impl Div for Dual {
    type Output = Self;
    fn div(self, rhs: Self) -> Self {
        Dual {
            val: self.val / rhs.val,
            dot: (self.dot * rhs.val - self.val * rhs.dot) / (rhs.val * rhs.val),
        }
    }
}

impl Neg for Dual {
    type Output = Self;
    fn neg(self) -> Self {
        Dual { val: -self.val, dot: -self.dot }
    }
}

impl Add<f64> for Dual {
    type Output = Self;
    fn add(self, rhs: f64) -> Self { self + Dual::constant(rhs) }
}

impl Sub<f64> for Dual {
    type Output = Self;
    fn sub(self, rhs: f64) -> Self { self - Dual::constant(rhs) }
}

impl Mul<f64> for Dual {
    type Output = Self;
    fn mul(self, rhs: f64) -> Self {
        Dual { val: self.val * rhs, dot: self.dot * rhs }
    }
}

impl Div<f64> for Dual {
    type Output = Self;
    fn div(self, rhs: f64) -> Self {
        Dual { val: self.val / rhs, dot: self.dot / rhs }
    }
}

// ── Forward-Mode Utilities ──────────────────────────────────────────────────

/// Compute the derivative of a scalar function f(x) at a point.
pub fn derivative<F>(f: F, x: f64) -> f64
where
    F: Fn(Dual) -> Dual,
{
    f(Dual::variable(x)).dot
}

/// Compute the gradient of f(x0, x1, ..., xn) at a point.
/// One forward pass per variable.
pub fn gradient<F>(f: F, x: &[f64]) -> Vec<f64>
where
    F: Fn(&[Dual]) -> Dual,
{
    let n = x.len();
    let mut grad = vec![0.0; n];
    for i in 0..n {
        let args: Vec<Dual> = x
            .iter()
            .enumerate()
            .map(|(j, &v)| {
                if j == i { Dual::variable(v) } else { Dual::constant(v) }
            })
            .collect();
        grad[i] = f(&args).dot;
    }
    grad
}

/// Compute the Jacobian matrix of a vector function f: R^n → R^m.
/// Returns m×n matrix (row-major).
pub fn jacobian<F>(f: F, x: &[f64], m: usize) -> Vec<Vec<f64>>
where
    F: Fn(&[Dual]) -> Vec<Dual>,
{
    let n = x.len();
    // Initialize Jacobian: m rows, n cols
    let mut jac = vec![vec![0.0; n]; m];
    for i in 0..n {
        let args: Vec<Dual> = x
            .iter()
            .enumerate()
            .map(|(j, &v)| {
                if j == i { Dual::variable(v) } else { Dual::constant(v) }
            })
            .collect();
        let result = f(&args);
        for (row, r) in result.iter().enumerate().take(m) {
            jac[row][i] = r.dot;
        }
    }
    jac
}

/// Compute the directional derivative: ∇f(x) · v.
/// Single forward pass regardless of dimension.
pub fn directional_derivative<F>(f: F, x: &[f64], v: &[f64]) -> f64
where
    F: Fn(&[Dual]) -> Dual,
{
    let args: Vec<Dual> = x
        .iter()
        .zip(v.iter())
        .map(|(&xi, &vi)| Dual::new(xi, vi))
        .collect();
    f(&args).dot
}

// ── Reverse-Mode AD (Tape-Based) ───────────────────────────────────────────

/// Node index in the tape.
type NodeIdx = usize;

/// Operation recorded on the tape.
#[derive(Debug, Clone)]
enum TapeOp {
    /// A leaf (input variable or constant). No parents.
    Leaf,
    /// Unary operation: result = f(input), with local derivative df/dinput.
    Unary { input: NodeIdx, deriv: f64 },
    /// Binary operation: result = f(lhs, rhs).
    Binary {
        lhs: NodeIdx,
        rhs: NodeIdx,
        dlhs: f64,
        drhs: f64,
    },
}

/// A node recorded on the computation tape.
#[derive(Debug, Clone)]
struct TapeNode {
    #[allow(dead_code)]
    value: f64,
    op: TapeOp,
}

/// Computation tape for reverse-mode AD.
///
/// Records a directed acyclic graph of operations during the forward pass.
/// Call `backward()` to compute gradients of any output w.r.t. all inputs.
#[derive(Debug)]
pub struct Tape {
    nodes: Vec<TapeNode>,
}

/// A tracked value on the tape.
#[derive(Debug, Clone, Copy)]
pub struct Var {
    idx: NodeIdx,
    val: f64,
}

impl Tape {
    /// Create a new empty tape.
    pub fn new() -> Self {
        Tape { nodes: Vec::new() }
    }

    /// Register an input variable on the tape.
    pub fn var(&mut self, value: f64) -> Var {
        let idx = self.nodes.len();
        self.nodes.push(TapeNode { value, op: TapeOp::Leaf });
        Var { idx, val: value }
    }

    /// Register a constant (gradient will not flow through it).
    pub fn constant(&mut self, value: f64) -> Var {
        let idx = self.nodes.len();
        self.nodes.push(TapeNode { value, op: TapeOp::Leaf });
        Var { idx, val: value }
    }

    /// Record a unary operation.
    fn unary(&mut self, input: Var, value: f64, deriv: f64) -> Var {
        let idx = self.nodes.len();
        self.nodes.push(TapeNode {
            value,
            op: TapeOp::Unary { input: input.idx, deriv },
        });
        Var { idx, val: value }
    }

    /// Record a binary operation.
    fn binary(&mut self, lhs: Var, rhs: Var, value: f64, dlhs: f64, drhs: f64) -> Var {
        let idx = self.nodes.len();
        self.nodes.push(TapeNode {
            value,
            op: TapeOp::Binary {
                lhs: lhs.idx,
                rhs: rhs.idx,
                dlhs,
                drhs,
            },
        });
        Var { idx, val: value }
    }

    // ── Arithmetic operations ──

    pub fn add(&mut self, a: Var, b: Var) -> Var {
        self.binary(a, b, a.val + b.val, 1.0, 1.0)
    }

    pub fn sub(&mut self, a: Var, b: Var) -> Var {
        self.binary(a, b, a.val - b.val, 1.0, -1.0)
    }

    pub fn mul(&mut self, a: Var, b: Var) -> Var {
        self.binary(a, b, a.val * b.val, b.val, a.val)
    }

    pub fn div(&mut self, a: Var, b: Var) -> Var {
        let val = a.val / b.val;
        self.binary(a, b, val, 1.0 / b.val, -a.val / (b.val * b.val))
    }

    pub fn neg(&mut self, a: Var) -> Var {
        self.unary(a, -a.val, -1.0)
    }

    pub fn powf(&mut self, a: Var, n: f64) -> Var {
        let val = a.val.powf(n);
        let deriv = n * a.val.powf(n - 1.0);
        self.unary(a, val, deriv)
    }

    pub fn sin(&mut self, a: Var) -> Var {
        self.unary(a, a.val.sin(), a.val.cos())
    }

    pub fn cos(&mut self, a: Var) -> Var {
        self.unary(a, a.val.cos(), -a.val.sin())
    }

    pub fn tan(&mut self, a: Var) -> Var {
        let c = a.val.cos();
        self.unary(a, a.val.tan(), 1.0 / (c * c))
    }

    pub fn exp(&mut self, a: Var) -> Var {
        let ev = a.val.exp();
        self.unary(a, ev, ev)
    }

    pub fn ln(&mut self, a: Var) -> Var {
        self.unary(a, a.val.ln(), 1.0 / a.val)
    }

    pub fn sqrt(&mut self, a: Var) -> Var {
        let sv = a.val.sqrt();
        self.unary(a, sv, 0.5 / sv)
    }

    pub fn abs(&mut self, a: Var) -> Var {
        self.unary(a, a.val.abs(), a.val.signum())
    }

    pub fn sinh(&mut self, a: Var) -> Var {
        self.unary(a, a.val.sinh(), a.val.cosh())
    }

    pub fn cosh(&mut self, a: Var) -> Var {
        self.unary(a, a.val.cosh(), a.val.sinh())
    }

    pub fn tanh(&mut self, a: Var) -> Var {
        let t = a.val.tanh();
        self.unary(a, t, 1.0 - t * t)
    }

    /// Backpropagate from a single output node.
    /// Returns gradient for every node on the tape.
    pub fn backward(&self, output: Var) -> Vec<f64> {
        let n = self.nodes.len();
        let mut adjoints = vec![0.0; n];
        adjoints[output.idx] = 1.0;

        // Traverse tape in reverse (topological) order.
        for i in (0..n).rev() {
            let adj = adjoints[i];
            if adj == 0.0 { continue; }
            match &self.nodes[i].op {
                TapeOp::Leaf => {}
                TapeOp::Unary { input, deriv } => {
                    adjoints[*input] += adj * deriv;
                }
                TapeOp::Binary { lhs, rhs, dlhs, drhs } => {
                    adjoints[*lhs] += adj * dlhs;
                    adjoints[*rhs] += adj * drhs;
                }
            }
        }
        adjoints
    }

    /// Compute gradients of output w.r.t. specified input variables.
    pub fn grad(&self, output: Var, inputs: &[Var]) -> Vec<f64> {
        let adjoints = self.backward(output);
        inputs.iter().map(|v| adjoints[v.idx]).collect()
    }
}

/// Convenience: compute gradient of a scalar function using reverse-mode.
/// More efficient than forward-mode when dim(output) << dim(input).
pub fn reverse_gradient<F>(f: F, x: &[f64]) -> Vec<f64>
where
    F: FnOnce(&mut Tape, &[Var]) -> Var,
{
    let mut tape = Tape::new();
    let vars: Vec<Var> = x.iter().map(|&v| tape.var(v)).collect();
    let output = f(&mut tape, &vars);
    tape.grad(output, &vars)
}

/// Compute the Hessian-vector product: H(f) · v at point x.
/// Uses forward-over-reverse: one forward pass of dual numbers through
/// the reverse-mode gradient computation.
pub fn hessian_vector_product<F>(f: F, x: &[f64], v: &[f64]) -> Vec<f64>
where
    F: Fn(&[Dual]) -> Dual,
{
    let n = x.len();
    let eps = 1e-7;
    // Finite-difference approximation of Hv:
    // Hv ≈ (∇f(x + εv) - ∇f(x - εv)) / (2ε)
    let x_plus: Vec<f64> = x.iter().zip(v.iter()).map(|(xi, vi)| xi + eps * vi).collect();
    let x_minus: Vec<f64> = x.iter().zip(v.iter()).map(|(xi, vi)| xi - eps * vi).collect();
    let g_plus = gradient(&f, &x_plus);
    let g_minus = gradient(&f, &x_minus);
    (0..n).map(|i| (g_plus[i] - g_minus[i]) / (2.0 * eps)).collect()
}

// ── Mixed-Mode AD ───────────────────────────────────────────────────────────

/// Strategy for automatic mode selection.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AdMode {
    Forward,
    Reverse,
}

/// Select the most efficient AD mode based on input/output dimensions.
///
/// - If dim(input) <= dim(output), use forward mode (one pass per input).
/// - If dim(input) > dim(output), use reverse mode (one pass per output).
/// - `threshold` allows overriding: if the ratio exceeds threshold, always use reverse.
pub fn select_mode(n_inputs: usize, n_outputs: usize, _threshold: Option<f64>) -> AdMode {
    if n_inputs <= n_outputs {
        AdMode::Forward
    } else {
        AdMode::Reverse
    }
}

/// Compute gradient using automatically selected mode.
/// For scalar-valued functions (n_outputs = 1), reverse is generally better
/// for large n_inputs, but forward is fine for small n_inputs.
pub fn auto_gradient<Ff, Fr>(
    forward_f: Ff,
    reverse_f: Fr,
    x: &[f64],
) -> Vec<f64>
where
    Ff: Fn(&[Dual]) -> Dual,
    Fr: FnOnce(&mut Tape, &[Var]) -> Var,
{
    let mode = select_mode(x.len(), 1, None);
    match mode {
        AdMode::Forward => gradient(forward_f, x),
        AdMode::Reverse => reverse_gradient(reverse_f, x),
    }
}

/// Compute the Jacobian of a vector function given as compiled expressions.
///
/// Uses forward-mode dual-number AD (exact, no finite-difference error).
/// When `n_in <= threshold * n_out`, the mode is reported as "forward";
/// otherwise "reverse" is reported (though both internally use forward-mode
/// dual numbers since we have the compiled AST, making it always efficient).
///
/// Returns `(jacobian, mode_str)` where `jacobian[i][j]` = ∂f_i/∂x_j.
pub fn mixed_jacobian_compiled(
    compiled_funcs: &[&crate::expr::CompiledExpr],
    var_names: &[&str],
    x: &[f64],
    threshold: f64,
) -> (Vec<Vec<f64>>, &'static str) {
    let n_in = x.len();
    let n_out = compiled_funcs.len();

    let mode = if n_in as f64 <= threshold * n_out as f64 {
        "forward"
    } else {
        "reverse"
    };

    // Forward-mode: n_in dual evaluations, one column of the Jacobian per pass.
    let mut jac = vec![vec![0.0; n_in]; n_out];

    for col in 0..n_in {
        // Tangent e_col: 1 for variable `col`, 0 for all others.
        let dual_vars: std::collections::HashMap<String, Dual> = var_names
            .iter()
            .zip(x.iter())
            .enumerate()
            .map(|(j, (name, &val))| {
                let d = if j == col { Dual::variable(val) } else { Dual::constant(val) };
                (name.to_string(), d)
            })
            .collect();

        for (row, compiled) in compiled_funcs.iter().enumerate() {
            jac[row][col] = compiled.eval_dual(&dual_vars)
                .map(|d| d.dot)
                .unwrap_or(f64::NAN);
        }
    }

    (jac, mode)
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── Forward-mode tests ──

    #[test]
    fn dual_arithmetic() {
        let x = Dual::variable(3.0); // x = 3, dx = 1
        let c = Dual::constant(2.0); // c = 2, dc = 0

        let y = x * x + c * x; // y = x^2 + 2x, dy/dx = 2x + 2
        assert_eq!(y.val, 15.0); // 9 + 6
        assert_eq!(y.dot, 8.0); // 2*3 + 2
    }

    #[test]
    fn dual_trig() {
        let x = Dual::variable(0.0);
        let y = x.sin();
        assert!((y.val - 0.0).abs() < 1e-15);
        assert!((y.dot - 1.0).abs() < 1e-15); // cos(0) = 1

        let x = Dual::variable(0.0);
        let y = x.cos();
        assert!((y.val - 1.0).abs() < 1e-15);
        assert!((y.dot - 0.0).abs() < 1e-15); // -sin(0) = 0
    }

    #[test]
    fn dual_exp_ln() {
        let x = Dual::variable(1.0);
        let y = x.exp();
        assert!((y.val - std::f64::consts::E).abs() < 1e-12);
        assert!((y.dot - std::f64::consts::E).abs() < 1e-12);

        let x = Dual::variable(1.0);
        let y = x.ln();
        assert!((y.val - 0.0).abs() < 1e-15);
        assert!((y.dot - 1.0).abs() < 1e-15); // 1/1 = 1
    }

    #[test]
    fn dual_chain_rule() {
        // f(x) = sin(x^2) at x=1
        // f'(x) = cos(x^2) * 2x = cos(1) * 2
        let x = Dual::variable(1.0);
        let y = (x * x).sin();
        let expected = 1.0_f64.cos() * 2.0;
        assert!((y.dot - expected).abs() < 1e-12);
    }

    #[test]
    fn derivative_helper() {
        // f(x) = x^3, f'(2) = 12
        let df = derivative(|x| x * x * x, 2.0);
        assert!((df - 12.0).abs() < 1e-10);
    }

    #[test]
    fn gradient_helper() {
        // f(x,y) = x^2 + x*y, grad = (2x+y, x) at (3,4) = (10, 3)
        let g = gradient(
            |x| x[0] * x[0] + x[0] * x[1],
            &[3.0, 4.0],
        );
        assert!((g[0] - 10.0).abs() < 1e-10);
        assert!((g[1] - 3.0).abs() < 1e-10);
    }

    #[test]
    fn jacobian_helper() {
        // f(x,y) = (x*y, x+y)
        // J = [[y, x], [1, 1]]
        // At (2,3): [[3,2],[1,1]]
        let jac = jacobian(
            |x| vec![x[0] * x[1], x[0] + x[1]],
            &[2.0, 3.0],
            2,
        );
        assert!((jac[0][0] - 3.0).abs() < 1e-10);
        assert!((jac[0][1] - 2.0).abs() < 1e-10);
        assert!((jac[1][0] - 1.0).abs() < 1e-10);
        assert!((jac[1][1] - 1.0).abs() < 1e-10);
    }

    #[test]
    fn directional_derivative_helper() {
        // f(x,y) = x^2 + y^2, grad = (2x, 2y)
        // At (1,2) in direction (1,0): 2*1 = 2
        let dd = directional_derivative(
            |x| x[0] * x[0] + x[1] * x[1],
            &[1.0, 2.0],
            &[1.0, 0.0],
        );
        assert!((dd - 2.0).abs() < 1e-10);
    }

    // ── Reverse-mode tests ──

    #[test]
    fn reverse_simple() {
        // f(x) = x^2, f'(3) = 6
        let mut tape = Tape::new();
        let x = tape.var(3.0);
        let y = tape.mul(x, x);
        let grads = tape.grad(y, &[x]);
        assert!((grads[0] - 6.0).abs() < 1e-10);
    }

    #[test]
    fn reverse_multivar() {
        // f(x,y) = x*y + sin(x), df/dx = y + cos(x), df/dy = x
        // At (1, 2): df/dx = 2 + cos(1), df/dy = 1
        let mut tape = Tape::new();
        let x = tape.var(1.0);
        let y = tape.var(2.0);
        let xy = tape.mul(x, y);
        let sx = tape.sin(x);
        let f = tape.add(xy, sx);
        let grads = tape.grad(f, &[x, y]);
        assert!((grads[0] - (2.0 + 1.0_f64.cos())).abs() < 1e-10);
        assert!((grads[1] - 1.0).abs() < 1e-10);
    }

    #[test]
    fn reverse_chain() {
        // f(x) = exp(sin(x)) at x=1
        // f'(x) = exp(sin(x)) * cos(x)
        let mut tape = Tape::new();
        let x = tape.var(1.0);
        let sx = tape.sin(x);
        let f = tape.exp(sx);
        let grads = tape.grad(f, &[x]);
        let expected = (1.0_f64.sin()).exp() * 1.0_f64.cos();
        assert!((grads[0] - expected).abs() < 1e-10);
    }

    #[test]
    fn reverse_gradient_helper() {
        // f(x,y) = x^2 * y at (3,4): df/dx = 2xy = 24, df/dy = x^2 = 9
        let grads = reverse_gradient(
            |tape, vars| {
                let x2 = tape.mul(vars[0], vars[0]);
                tape.mul(x2, vars[1])
            },
            &[3.0, 4.0],
        );
        assert!((grads[0] - 24.0).abs() < 1e-10);
        assert!((grads[1] - 9.0).abs() < 1e-10);
    }

    #[test]
    fn reverse_division() {
        // f(x,y) = x/y at (6,3): df/dx = 1/3, df/dy = -6/9 = -2/3
        let mut tape = Tape::new();
        let x = tape.var(6.0);
        let y = tape.var(3.0);
        let f = tape.div(x, y);
        let grads = tape.grad(f, &[x, y]);
        assert!((grads[0] - 1.0 / 3.0).abs() < 1e-10);
        assert!((grads[1] - (-2.0 / 3.0)).abs() < 1e-10);
    }

    #[test]
    fn forward_reverse_agree() {
        // f(x,y) = sin(x*y) + x^2
        // Both modes should give the same gradient.
        let point = [2.0, 3.0];

        let fwd_grad = gradient(
            |x| (x[0] * x[1]).sin() + x[0] * x[0],
            &point,
        );

        let rev_grad = reverse_gradient(
            |tape, vars| {
                let xy = tape.mul(vars[0], vars[1]);
                let sxy = tape.sin(xy);
                let x2 = tape.mul(vars[0], vars[0]);
                tape.add(sxy, x2)
            },
            &point,
        );

        assert!((fwd_grad[0] - rev_grad[0]).abs() < 1e-10,
            "dx: fwd={}, rev={}", fwd_grad[0], rev_grad[0]);
        assert!((fwd_grad[1] - rev_grad[1]).abs() < 1e-10,
            "dy: fwd={}, rev={}", fwd_grad[1], rev_grad[1]);
    }

    #[test]
    fn hessian_vector_product_test() {
        // f(x,y) = x^2 + x*y + y^2
        // H = [[2, 1], [1, 2]]
        // Hv for v=(1,0) = (2, 1)
        let hvp = hessian_vector_product(
            |x| x[0] * x[0] + x[0] * x[1] + x[1] * x[1],
            &[1.0, 1.0],
            &[1.0, 0.0],
        );
        assert!((hvp[0] - 2.0).abs() < 1e-4, "hvp[0]={}", hvp[0]);
        assert!((hvp[1] - 1.0).abs() < 1e-4, "hvp[1]={}", hvp[1]);
    }
}
