//! `symbolic` — Computer Algebra System (CAS) for symbolic mathematics.
//!
//! Provides a symbolic expression AST (`SymExpr`) stored as a DAG with
//! common subexpression sharing via `Rc`. Supports construction, simplification,
//! symbolic differentiation, polynomial arithmetic, and LaTeX rendering.

use std::collections::HashMap;
use std::fmt;
use std::rc::Rc;

// ── Core AST ────────────────────────────────────────────────────────────────

/// A symbolic expression node, reference-counted for DAG sharing.
pub type Expr = Rc<SymExpr>;

/// Binary operators.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum BinOp {
    Add,
    Sub,
    Mul,
    Div,
    Pow,
}

/// Unary operators.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum UnaryOp {
    Neg,
    Abs,
    Floor,
    Ceil,
    Sign,
}

/// Built-in functions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Func {
    Sin,
    Cos,
    Tan,
    Asin,
    Acos,
    Atan,
    Exp,
    Ln,
    Log10,
    Sqrt,
    Sinh,
    Cosh,
    Tanh,
}

/// Symbolic expression AST node.
///
/// Stored as an `Rc<SymExpr>` (`Expr`) for cheap cloning and DAG sharing.
/// Two structurally identical sub-expressions can share the same `Rc` pointer,
/// avoiding redundant computation during differentiation and simplification.
#[derive(Debug, Clone)]
pub enum SymExpr {
    /// A named variable: x, y, t, ...
    Variable(String),
    /// A numeric constant (exact rational or float).
    Constant(f64),
    /// Binary operation: lhs op rhs
    BinaryOp {
        op: BinOp,
        lhs: Expr,
        rhs: Expr,
    },
    /// Unary operation
    UnaryOp {
        op: UnaryOp,
        operand: Expr,
    },
    /// Named function application: sin(x), exp(x), etc.
    Function {
        func: Func,
        arg: Expr,
    },
    /// Summation of N terms (flattened from nested Add)
    Sum(Vec<Expr>),
    /// Product of N factors (flattened from nested Mul)
    Product(Vec<Expr>),
}

// ── Constructors ────────────────────────────────────────────────────────────

/// Create a variable expression.
pub fn var(name: &str) -> Expr {
    Rc::new(SymExpr::Variable(name.to_string()))
}

/// Create a constant expression.
pub fn con(value: f64) -> Expr {
    Rc::new(SymExpr::Constant(value))
}

/// Shorthand constants.
pub fn zero() -> Expr { con(0.0) }
pub fn one() -> Expr { con(1.0) }
pub fn neg_one() -> Expr { con(-1.0) }
pub fn two() -> Expr { con(2.0) }

/// Create a binary operation.
pub fn binop(op: BinOp, lhs: Expr, rhs: Expr) -> Expr {
    Rc::new(SymExpr::BinaryOp { op, lhs, rhs })
}

/// Create a unary operation.
pub fn unop(op: UnaryOp, operand: Expr) -> Expr {
    Rc::new(SymExpr::UnaryOp { op, operand })
}

/// Create a function application.
pub fn func(f: Func, arg: Expr) -> Expr {
    Rc::new(SymExpr::Function { func: f, arg })
}

/// Arithmetic helpers.
pub fn add(a: Expr, b: Expr) -> Expr { binop(BinOp::Add, a, b) }
pub fn sub(a: Expr, b: Expr) -> Expr { binop(BinOp::Sub, a, b) }
pub fn mul(a: Expr, b: Expr) -> Expr { binop(BinOp::Mul, a, b) }
pub fn div(a: Expr, b: Expr) -> Expr { binop(BinOp::Div, a, b) }
pub fn pow(base: Expr, exp: Expr) -> Expr { binop(BinOp::Pow, base, exp) }
pub fn neg(a: Expr) -> Expr { unop(UnaryOp::Neg, a) }

/// Function helpers.
pub fn sin(a: Expr) -> Expr { func(Func::Sin, a) }
pub fn cos(a: Expr) -> Expr { func(Func::Cos, a) }
pub fn tan(a: Expr) -> Expr { func(Func::Tan, a) }
pub fn exp(a: Expr) -> Expr { func(Func::Exp, a) }
pub fn ln(a: Expr) -> Expr { func(Func::Ln, a) }
pub fn sqrt(a: Expr) -> Expr { func(Func::Sqrt, a) }

// ── Evaluation ──────────────────────────────────────────────────────────────

/// Evaluate a symbolic expression numerically given variable bindings.
pub fn eval(expr: &Expr, vars: &HashMap<String, f64>) -> f64 {
    match expr.as_ref() {
        SymExpr::Variable(name) => *vars.get(name.as_str()).unwrap_or(&f64::NAN),
        SymExpr::Constant(v) => *v,
        SymExpr::BinaryOp { op, lhs, rhs } => {
            let l = eval(lhs, vars);
            let r = eval(rhs, vars);
            match op {
                BinOp::Add => l + r,
                BinOp::Sub => l - r,
                BinOp::Mul => l * r,
                BinOp::Div => l / r,
                BinOp::Pow => l.powf(r),
            }
        }
        SymExpr::UnaryOp { op, operand } => {
            let v = eval(operand, vars);
            match op {
                UnaryOp::Neg => -v,
                UnaryOp::Abs => v.abs(),
                UnaryOp::Floor => v.floor(),
                UnaryOp::Ceil => v.ceil(),
                UnaryOp::Sign => v.signum(),
            }
        }
        SymExpr::Function { func: f, arg } => {
            let v = eval(arg, vars);
            match f {
                Func::Sin => v.sin(),
                Func::Cos => v.cos(),
                Func::Tan => v.tan(),
                Func::Asin => v.asin(),
                Func::Acos => v.acos(),
                Func::Atan => v.atan(),
                Func::Exp => v.exp(),
                Func::Ln => v.ln(),
                Func::Log10 => v.log10(),
                Func::Sqrt => v.sqrt(),
                Func::Sinh => v.sinh(),
                Func::Cosh => v.cosh(),
                Func::Tanh => v.tanh(),
            }
        }
        SymExpr::Sum(terms) => terms.iter().map(|t| eval(t, vars)).sum(),
        SymExpr::Product(factors) => factors.iter().map(|f| eval(f, vars)).product(),
    }
}

// ── Symbolic Differentiation ────────────────────────────────────────────────

/// Compute the symbolic derivative d(expr)/d(var).
///
/// Applies standard differentiation rules: chain rule, product rule,
/// quotient rule, power rule, and function derivatives.
/// The result is NOT automatically simplified — call `simplify()` afterward.
pub fn differentiate(expr: &Expr, var: &str) -> Expr {
    match expr.as_ref() {
        SymExpr::Variable(name) => {
            if name == var { one() } else { zero() }
        }
        SymExpr::Constant(_) => zero(),
        SymExpr::BinaryOp { op, lhs, rhs } => {
            let dl = differentiate(lhs, var);
            let dr = differentiate(rhs, var);
            match op {
                // d(f+g) = f' + g'
                BinOp::Add => add(dl, dr),
                // d(f-g) = f' - g'
                BinOp::Sub => sub(dl, dr),
                // d(f*g) = f'*g + f*g'  (product rule)
                BinOp::Mul => add(
                    mul(dl, rhs.clone()),
                    mul(lhs.clone(), dr),
                ),
                // d(f/g) = (f'*g - f*g') / g^2  (quotient rule)
                BinOp::Div => div(
                    sub(
                        mul(dl, rhs.clone()),
                        mul(lhs.clone(), dr),
                    ),
                    pow(rhs.clone(), two()),
                ),
                // d(f^g):
                // If g is constant: g * f^(g-1) * f'
                // General: f^g * (g' * ln(f) + g * f'/f)
                BinOp::Pow => {
                    if is_constant(rhs, var) {
                        // Power rule: g * f^(g-1) * f'
                        mul(
                            mul(rhs.clone(), pow(lhs.clone(), sub(rhs.clone(), one()))),
                            dl,
                        )
                    } else if is_constant(lhs, var) {
                        // d(a^g) = a^g * ln(a) * g'
                        mul(
                            mul(pow(lhs.clone(), rhs.clone()), ln(lhs.clone())),
                            dr,
                        )
                    } else {
                        // General: f^g * (g'*ln(f) + g*f'/f)
                        mul(
                            pow(lhs.clone(), rhs.clone()),
                            add(
                                mul(dr, ln(lhs.clone())),
                                mul(rhs.clone(), div(dl, lhs.clone())),
                            ),
                        )
                    }
                }
            }
        }
        SymExpr::UnaryOp { op, operand } => {
            let df = differentiate(operand, var);
            match op {
                UnaryOp::Neg => neg(df),
                UnaryOp::Abs => {
                    // d|f| = f/|f| * f' (undefined at f=0)
                    mul(div(operand.clone(), unop(UnaryOp::Abs, operand.clone())), df)
                }
                _ => {
                    // Floor, Ceil, Sign have zero derivative almost everywhere
                    zero()
                }
            }
        }
        SymExpr::Function { func: f, arg } => {
            let da = differentiate(arg, var);
            let inner_deriv = match f {
                // d(sin(u)) = cos(u)
                Func::Sin => cos(arg.clone()),
                // d(cos(u)) = -sin(u)
                Func::Cos => neg(sin(arg.clone())),
                // d(tan(u)) = 1/cos^2(u)
                Func::Tan => div(one(), pow(cos(arg.clone()), two())),
                // d(asin(u)) = 1/sqrt(1-u^2)
                Func::Asin => div(one(), sqrt(sub(one(), pow(arg.clone(), two())))),
                // d(acos(u)) = -1/sqrt(1-u^2)
                Func::Acos => neg(div(one(), sqrt(sub(one(), pow(arg.clone(), two()))))),
                // d(atan(u)) = 1/(1+u^2)
                Func::Atan => div(one(), add(one(), pow(arg.clone(), two()))),
                // d(exp(u)) = exp(u)
                Func::Exp => exp(arg.clone()),
                // d(ln(u)) = 1/u
                Func::Ln => div(one(), arg.clone()),
                // d(log10(u)) = 1/(u*ln(10))
                Func::Log10 => div(one(), mul(arg.clone(), ln(con(10.0)))),
                // d(sqrt(u)) = 1/(2*sqrt(u))
                Func::Sqrt => div(one(), mul(two(), sqrt(arg.clone()))),
                // d(sinh(u)) = cosh(u)
                Func::Sinh => func(Func::Cosh, arg.clone()),
                // d(cosh(u)) = sinh(u)
                Func::Cosh => func(Func::Sinh, arg.clone()),
                // d(tanh(u)) = 1 - tanh^2(u)
                Func::Tanh => sub(one(), pow(func(Func::Tanh, arg.clone()), two())),
            };
            // Chain rule: d(f(u))/dx = f'(u) * du/dx
            mul(inner_deriv, da)
        }
        SymExpr::Sum(terms) => {
            let dterms: Vec<Expr> = terms.iter().map(|t| differentiate(t, var)).collect();
            Rc::new(SymExpr::Sum(dterms))
        }
        SymExpr::Product(factors) => {
            // Generalized product rule: d(f1*f2*...*fn)/dx = sum_i (fi' * prod_{j!=i} fj)
            let n = factors.len();
            let terms: Vec<Expr> = (0..n)
                .map(|i| {
                    let di = differentiate(&factors[i], var);
                    let others: Vec<Expr> = factors
                        .iter()
                        .enumerate()
                        .filter(|(j, _)| *j != i)
                        .map(|(_, f)| f.clone())
                        .collect();
                    if others.is_empty() {
                        di
                    } else if others.len() == 1 {
                        mul(di, others[0].clone())
                    } else {
                        mul(di, Rc::new(SymExpr::Product(others)))
                    }
                })
                .collect();
            Rc::new(SymExpr::Sum(terms))
        }
    }
}

/// Check if an expression is constant with respect to a variable.
fn is_constant(expr: &Expr, var: &str) -> bool {
    match expr.as_ref() {
        SymExpr::Variable(name) => name != var,
        SymExpr::Constant(_) => true,
        SymExpr::BinaryOp { lhs, rhs, .. } => is_constant(lhs, var) && is_constant(rhs, var),
        SymExpr::UnaryOp { operand, .. } => is_constant(operand, var),
        SymExpr::Function { arg, .. } => is_constant(arg, var),
        SymExpr::Sum(terms) => terms.iter().all(|t| is_constant(t, var)),
        SymExpr::Product(factors) => factors.iter().all(|f| is_constant(f, var)),
    }
}

// ── Symbolic Integration ────────────────────────────────────────────────────

/// Result of symbolic integration.
#[derive(Debug)]
pub enum IntegrateResult {
    /// Successfully found an antiderivative.
    Ok(Expr),
    /// No elementary antiderivative found.
    NoElementary,
}

/// Compute the symbolic integral ∫ expr dx.
///
/// Uses table lookup for standard forms and linearity.
/// Returns `IntegrateResult::NoElementary` when no closed form is found.
/// Does NOT add a constant of integration.
pub fn integrate(expr: &Expr, var: &str) -> IntegrateResult {
    // If expression is constant w.r.t. var: ∫c dx = c*x
    if is_constant(expr, var) {
        return IntegrateResult::Ok(mul(expr.clone(), self::var(var)));
    }

    match expr.as_ref() {
        // ∫x dx = x^2/2
        SymExpr::Variable(name) if name == var => {
            IntegrateResult::Ok(div(pow(self::var(var), two()), two()))
        }

        // ∫(f + g) dx = ∫f dx + ∫g dx (linearity)
        SymExpr::BinaryOp { op: BinOp::Add, lhs, rhs } => {
            match (integrate(lhs, var), integrate(rhs, var)) {
                (IntegrateResult::Ok(il), IntegrateResult::Ok(ir)) => {
                    IntegrateResult::Ok(add(il, ir))
                }
                _ => IntegrateResult::NoElementary,
            }
        }

        // ∫(f - g) dx = ∫f dx - ∫g dx
        SymExpr::BinaryOp { op: BinOp::Sub, lhs, rhs } => {
            match (integrate(lhs, var), integrate(rhs, var)) {
                (IntegrateResult::Ok(il), IntegrateResult::Ok(ir)) => {
                    IntegrateResult::Ok(sub(il, ir))
                }
                _ => IntegrateResult::NoElementary,
            }
        }

        // ∫(c * f) dx = c * ∫f dx  (constant factor)
        SymExpr::BinaryOp { op: BinOp::Mul, lhs, rhs } => {
            if is_constant(lhs, var) {
                if let IntegrateResult::Ok(ir) = integrate(rhs, var) {
                    return IntegrateResult::Ok(mul(lhs.clone(), ir));
                }
            }
            if is_constant(rhs, var) {
                if let IntegrateResult::Ok(il) = integrate(lhs, var) {
                    return IntegrateResult::Ok(mul(il, rhs.clone()));
                }
            }
            IntegrateResult::NoElementary
        }

        // ∫(f / c) dx = (1/c) * ∫f dx
        SymExpr::BinaryOp { op: BinOp::Div, lhs, rhs } => {
            if is_constant(rhs, var) {
                if let IntegrateResult::Ok(il) = integrate(lhs, var) {
                    return IntegrateResult::Ok(div(il, rhs.clone()));
                }
            }
            // ∫(1/x) dx = ln|x|
            if is_one(lhs) {
                if let SymExpr::Variable(name) = rhs.as_ref() {
                    if name == var {
                        return IntegrateResult::Ok(ln(unop(UnaryOp::Abs, self::var(var))));
                    }
                }
            }
            IntegrateResult::NoElementary
        }

        // ∫x^n dx = x^(n+1)/(n+1)  for constant n ≠ -1
        SymExpr::BinaryOp { op: BinOp::Pow, lhs, rhs } => {
            if let SymExpr::Variable(name) = lhs.as_ref() {
                if name == var && is_constant(rhs, var) {
                    // Check for n = -1
                    if let SymExpr::Constant(n) = rhs.as_ref() {
                        if (*n + 1.0).abs() < 1e-15 {
                            // ∫x^(-1) dx = ln|x|
                            return IntegrateResult::Ok(ln(unop(UnaryOp::Abs, self::var(var))));
                        }
                    }
                    let n_plus_1 = add(rhs.clone(), one());
                    return IntegrateResult::Ok(div(
                        pow(self::var(var), n_plus_1.clone()),
                        n_plus_1,
                    ));
                }
            }
            // ∫a^x dx = a^x / ln(a)  for constant a
            if is_constant(lhs, var) {
                if let SymExpr::Variable(name) = rhs.as_ref() {
                    if name == var {
                        return IntegrateResult::Ok(div(
                            pow(lhs.clone(), self::var(var)),
                            ln(lhs.clone()),
                        ));
                    }
                }
            }
            IntegrateResult::NoElementary
        }

        // ∫(-f) dx = -∫f dx
        SymExpr::UnaryOp { op: UnaryOp::Neg, operand } => {
            if let IntegrateResult::Ok(result) = integrate(operand, var) {
                IntegrateResult::Ok(neg(result))
            } else {
                IntegrateResult::NoElementary
            }
        }

        // Standard function integrals (for f(x) where arg is just x)
        SymExpr::Function { func: f, arg } => {
            // Only handle simple case: arg is exactly the variable
            if let SymExpr::Variable(name) = arg.as_ref() {
                if name == var {
                    let x = self::var(var);
                    return match f {
                        // ∫sin(x) dx = -cos(x)
                        Func::Sin => IntegrateResult::Ok(neg(cos(x))),
                        // ∫cos(x) dx = sin(x)
                        Func::Cos => IntegrateResult::Ok(sin(x)),
                        // ∫tan(x) dx = -ln|cos(x)|
                        Func::Tan => IntegrateResult::Ok(neg(ln(unop(UnaryOp::Abs, cos(x))))),
                        // ∫exp(x) dx = exp(x)
                        Func::Exp => IntegrateResult::Ok(exp(x)),
                        // ∫ln(x) dx = x*ln(x) - x
                        Func::Ln => IntegrateResult::Ok(sub(mul(x.clone(), ln(x.clone())), x)),
                        // ∫1/sqrt(x) via x^(-1/2) handled by power rule; sqrt(x) = x^(1/2):
                        // ∫sqrt(x) dx = (2/3)*x^(3/2)
                        Func::Sqrt => IntegrateResult::Ok(
                            mul(div(two(), con(3.0)), pow(x, div(con(3.0), two())))
                        ),
                        // ∫sinh(x) dx = cosh(x)
                        Func::Sinh => IntegrateResult::Ok(func(Func::Cosh, x)),
                        // ∫cosh(x) dx = sinh(x)
                        Func::Cosh => IntegrateResult::Ok(func(Func::Sinh, x)),
                        // ∫tanh(x) dx = ln(cosh(x))
                        Func::Tanh => IntegrateResult::Ok(ln(func(Func::Cosh, x))),
                        _ => IntegrateResult::NoElementary,
                    };
                }
            }
            IntegrateResult::NoElementary
        }

        // ∫(f1 + f2 + ... + fn) dx = ∫f1 + ∫f2 + ... + ∫fn
        SymExpr::Sum(terms) => {
            let mut results = Vec::new();
            for t in terms {
                match integrate(t, var) {
                    IntegrateResult::Ok(r) => results.push(r),
                    IntegrateResult::NoElementary => return IntegrateResult::NoElementary,
                }
            }
            match results.len() {
                0 => IntegrateResult::Ok(zero()),
                1 => IntegrateResult::Ok(results.pop().unwrap()),
                _ => IntegrateResult::Ok(Rc::new(SymExpr::Sum(results))),
            }
        }

        // Product: try to pull out constant factors
        SymExpr::Product(factors) => {
            let (const_factors, var_factors): (Vec<_>, Vec<_>) =
                factors.iter().partition(|f| is_constant(f, var));
            if var_factors.is_empty() {
                // All constant
                return IntegrateResult::Ok(mul(expr.clone(), self::var(var)));
            }
            if const_factors.is_empty() {
                return IntegrateResult::NoElementary;
            }
            // Build the variable part
            let var_expr = if var_factors.len() == 1 {
                var_factors[0].clone()
            } else {
                Rc::new(SymExpr::Product(var_factors.into_iter().cloned().collect()))
            };
            let const_expr = if const_factors.len() == 1 {
                const_factors[0].clone()
            } else {
                Rc::new(SymExpr::Product(const_factors.into_iter().cloned().collect()))
            };
            if let IntegrateResult::Ok(result) = integrate(&var_expr, var) {
                IntegrateResult::Ok(mul(const_expr, result))
            } else {
                IntegrateResult::NoElementary
            }
        }

        _ => IntegrateResult::NoElementary,
    }
}

// ── Simplification ──────────────────────────────────────────────────────────

/// Apply algebraic simplification rules to reduce expression size.
///
/// Rules applied (one pass, bottom-up):
/// - Constant folding: 2+3 → 5
/// - Identity: x+0 → x, x*1 → x, x^1 → x, x^0 → 1
/// - Annihilation: x*0 → 0, 0/x → 0
/// - Double negation: -(-x) → x
/// - Negation of constant: -(c) → (-c)
/// - x - x → 0  (pointer equality check)
/// - x / x → 1  (pointer equality check)
pub fn simplify(expr: &Expr) -> Expr {
    match expr.as_ref() {
        SymExpr::Variable(_) | SymExpr::Constant(_) => expr.clone(),
        SymExpr::BinaryOp { op, lhs, rhs } => {
            let sl = simplify(lhs);
            let sr = simplify(rhs);
            simplify_binop(*op, sl, sr)
        }
        SymExpr::UnaryOp { op, operand } => {
            let so = simplify(operand);
            simplify_unop(*op, so)
        }
        SymExpr::Function { func: f, arg } => {
            let sa = simplify(arg);
            // Constant fold
            if let SymExpr::Constant(v) = sa.as_ref() {
                let result = match f {
                    Func::Sin => v.sin(),
                    Func::Cos => v.cos(),
                    Func::Tan => v.tan(),
                    Func::Asin => v.asin(),
                    Func::Acos => v.acos(),
                    Func::Atan => v.atan(),
                    Func::Exp => v.exp(),
                    Func::Ln => v.ln(),
                    Func::Log10 => v.log10(),
                    Func::Sqrt => v.sqrt(),
                    Func::Sinh => v.sinh(),
                    Func::Cosh => v.cosh(),
                    Func::Tanh => v.tanh(),
                };
                con(result)
            } else {
                func(*f, sa)
            }
        }
        SymExpr::Sum(terms) => {
            let simplified: Vec<Expr> = terms
                .iter()
                .map(|t| simplify(t))
                .filter(|t| !is_zero(t))
                .collect();
            match simplified.len() {
                0 => zero(),
                1 => simplified[0].clone(),
                _ => {
                    // Fold constants
                    let mut constant_sum = 0.0;
                    let mut non_const: Vec<Expr> = Vec::new();
                    for t in &simplified {
                        if let SymExpr::Constant(v) = t.as_ref() {
                            constant_sum += v;
                        } else {
                            non_const.push(t.clone());
                        }
                    }
                    if constant_sum != 0.0 {
                        non_const.push(con(constant_sum));
                    }
                    match non_const.len() {
                        0 => zero(),
                        1 => non_const[0].clone(),
                        _ => Rc::new(SymExpr::Sum(non_const)),
                    }
                }
            }
        }
        SymExpr::Product(factors) => {
            let simplified: Vec<Expr> = factors.iter().map(|f| simplify(f)).collect();
            // If any factor is zero, result is zero
            if simplified.iter().any(|f| is_zero(f)) {
                return zero();
            }
            let non_one: Vec<Expr> = simplified
                .into_iter()
                .filter(|f| !is_one(f))
                .collect();
            match non_one.len() {
                0 => one(),
                1 => non_one[0].clone(),
                _ => {
                    // Fold constants
                    let mut constant_prod = 1.0;
                    let mut non_const: Vec<Expr> = Vec::new();
                    for f in &non_one {
                        if let SymExpr::Constant(v) = f.as_ref() {
                            constant_prod *= v;
                        } else {
                            non_const.push(f.clone());
                        }
                    }
                    if constant_prod != 1.0 {
                        non_const.insert(0, con(constant_prod));
                    }
                    match non_const.len() {
                        0 => one(),
                        1 => non_const[0].clone(),
                        _ => Rc::new(SymExpr::Product(non_const)),
                    }
                }
            }
        }
    }
}

fn simplify_binop(op: BinOp, lhs: Expr, rhs: Expr) -> Expr {
    // Constant folding
    if let (SymExpr::Constant(a), SymExpr::Constant(b)) = (lhs.as_ref(), rhs.as_ref()) {
        return con(match op {
            BinOp::Add => a + b,
            BinOp::Sub => a - b,
            BinOp::Mul => a * b,
            BinOp::Div => a / b,
            BinOp::Pow => a.powf(*b),
        });
    }
    match op {
        BinOp::Add => {
            if is_zero(&lhs) { return rhs; }
            if is_zero(&rhs) { return lhs; }
            binop(BinOp::Add, lhs, rhs)
        }
        BinOp::Sub => {
            if is_zero(&rhs) { return lhs; }
            if is_zero(&lhs) { return neg(rhs); }
            if Rc::ptr_eq(&lhs, &rhs) { return zero(); }
            binop(BinOp::Sub, lhs, rhs)
        }
        BinOp::Mul => {
            if is_zero(&lhs) || is_zero(&rhs) { return zero(); }
            if is_one(&lhs) { return rhs; }
            if is_one(&rhs) { return lhs; }
            if is_neg_one(&lhs) { return neg(rhs); }
            if is_neg_one(&rhs) { return neg(lhs); }
            binop(BinOp::Mul, lhs, rhs)
        }
        BinOp::Div => {
            if is_zero(&lhs) { return zero(); }
            if is_one(&rhs) { return lhs; }
            if Rc::ptr_eq(&lhs, &rhs) { return one(); }
            binop(BinOp::Div, lhs, rhs)
        }
        BinOp::Pow => {
            if is_zero(&rhs) { return one(); }
            if is_one(&rhs) { return lhs; }
            if is_zero(&lhs) { return zero(); }
            if is_one(&lhs) { return one(); }
            binop(BinOp::Pow, lhs, rhs)
        }
    }
}

fn simplify_unop(op: UnaryOp, operand: Expr) -> Expr {
    match op {
        UnaryOp::Neg => {
            // -(-x) → x
            if let SymExpr::UnaryOp { op: UnaryOp::Neg, operand: inner } = operand.as_ref() {
                return inner.clone();
            }
            // -(c) → (-c)
            if let SymExpr::Constant(v) = operand.as_ref() {
                return con(-v);
            }
            unop(UnaryOp::Neg, operand)
        }
        _ => {
            // Constant fold
            if let SymExpr::Constant(v) = operand.as_ref() {
                return con(match op {
                    UnaryOp::Neg => unreachable!(),
                    UnaryOp::Abs => v.abs(),
                    UnaryOp::Floor => v.floor(),
                    UnaryOp::Ceil => v.ceil(),
                    UnaryOp::Sign => v.signum(),
                });
            }
            unop(op, operand)
        }
    }
}

fn is_zero(expr: &Expr) -> bool {
    matches!(expr.as_ref(), SymExpr::Constant(v) if *v == 0.0)
}

fn is_one(expr: &Expr) -> bool {
    matches!(expr.as_ref(), SymExpr::Constant(v) if *v == 1.0)
}

fn is_neg_one(expr: &Expr) -> bool {
    matches!(expr.as_ref(), SymExpr::Constant(v) if *v == -1.0)
}

// ── Variable Collection ─────────────────────────────────────────────────────

/// Collect all free variable names in an expression.
pub fn free_variables(expr: &Expr) -> Vec<String> {
    let mut vars = Vec::new();
    collect_vars(expr, &mut vars);
    vars.sort();
    vars.dedup();
    vars
}

fn collect_vars(expr: &Expr, out: &mut Vec<String>) {
    match expr.as_ref() {
        SymExpr::Variable(name) => out.push(name.clone()),
        SymExpr::Constant(_) => {}
        SymExpr::BinaryOp { lhs, rhs, .. } => {
            collect_vars(lhs, out);
            collect_vars(rhs, out);
        }
        SymExpr::UnaryOp { operand, .. } => collect_vars(operand, out),
        SymExpr::Function { arg, .. } => collect_vars(arg, out),
        SymExpr::Sum(terms) => terms.iter().for_each(|t| collect_vars(t, out)),
        SymExpr::Product(factors) => factors.iter().for_each(|f| collect_vars(f, out)),
    }
}

// ── Substitution ────────────────────────────────────────────────────────────

/// Substitute a variable with an expression throughout the tree.
pub fn substitute(expr: &Expr, var: &str, replacement: &Expr) -> Expr {
    match expr.as_ref() {
        SymExpr::Variable(name) => {
            if name == var { replacement.clone() } else { expr.clone() }
        }
        SymExpr::Constant(_) => expr.clone(),
        SymExpr::BinaryOp { op, lhs, rhs } => {
            binop(*op, substitute(lhs, var, replacement), substitute(rhs, var, replacement))
        }
        SymExpr::UnaryOp { op, operand } => {
            unop(*op, substitute(operand, var, replacement))
        }
        SymExpr::Function { func: f, arg } => {
            func(*f, substitute(arg, var, replacement))
        }
        SymExpr::Sum(terms) => {
            Rc::new(SymExpr::Sum(terms.iter().map(|t| substitute(t, var, replacement)).collect()))
        }
        SymExpr::Product(factors) => {
            Rc::new(SymExpr::Product(factors.iter().map(|f| substitute(f, var, replacement)).collect()))
        }
    }
}

// ── Display / LaTeX ─────────────────────────────────────────────────────────

impl fmt::Display for SymExpr {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SymExpr::Variable(name) => write!(f, "{name}"),
            SymExpr::Constant(v) => {
                if *v == std::f64::consts::PI {
                    write!(f, "π")
                } else if *v == std::f64::consts::E {
                    write!(f, "e")
                } else if v.fract() == 0.0 && v.abs() < 1e15 {
                    write!(f, "{}", *v as i64)
                } else {
                    write!(f, "{v}")
                }
            }
            SymExpr::BinaryOp { op, lhs, rhs } => {
                let sym = match op {
                    BinOp::Add => " + ",
                    BinOp::Sub => " - ",
                    BinOp::Mul => " * ",
                    BinOp::Div => " / ",
                    BinOp::Pow => "^",
                };
                write!(f, "({lhs}{sym}{rhs})")
            }
            SymExpr::UnaryOp { op, operand } => {
                match op {
                    UnaryOp::Neg => write!(f, "(-{operand})"),
                    UnaryOp::Abs => write!(f, "|{operand}|"),
                    UnaryOp::Floor => write!(f, "floor({operand})"),
                    UnaryOp::Ceil => write!(f, "ceil({operand})"),
                    UnaryOp::Sign => write!(f, "sign({operand})"),
                }
            }
            SymExpr::Function { func: fn_, arg } => {
                let name = match fn_ {
                    Func::Sin => "sin",
                    Func::Cos => "cos",
                    Func::Tan => "tan",
                    Func::Asin => "asin",
                    Func::Acos => "acos",
                    Func::Atan => "atan",
                    Func::Exp => "exp",
                    Func::Ln => "ln",
                    Func::Log10 => "log10",
                    Func::Sqrt => "sqrt",
                    Func::Sinh => "sinh",
                    Func::Cosh => "cosh",
                    Func::Tanh => "tanh",
                };
                write!(f, "{name}({arg})")
            }
            SymExpr::Sum(terms) => {
                write!(f, "(")?;
                for (i, t) in terms.iter().enumerate() {
                    if i > 0 { write!(f, " + ")?; }
                    write!(f, "{t}")?;
                }
                write!(f, ")")
            }
            SymExpr::Product(factors) => {
                write!(f, "(")?;
                for (i, fac) in factors.iter().enumerate() {
                    if i > 0 { write!(f, " * ")?; }
                    write!(f, "{fac}")?;
                }
                write!(f, ")")
            }
        }
    }
}

/// Render expression as LaTeX string.
pub fn to_latex(expr: &Expr) -> String {
    match expr.as_ref() {
        SymExpr::Variable(name) => name.clone(),
        SymExpr::Constant(v) => {
            if *v == std::f64::consts::PI {
                "\\pi".to_string()
            } else if *v == std::f64::consts::E {
                "e".to_string()
            } else if v.fract() == 0.0 && v.abs() < 1e15 {
                format!("{}", *v as i64)
            } else {
                format!("{v}")
            }
        }
        SymExpr::BinaryOp { op, lhs, rhs } => {
            match op {
                BinOp::Add => format!("{} + {}", to_latex(lhs), to_latex(rhs)),
                BinOp::Sub => format!("{} - {}", to_latex(lhs), to_latex_paren_if_sum(rhs)),
                BinOp::Mul => format!("{} \\cdot {}", to_latex_paren_if_add(lhs), to_latex_paren_if_add(rhs)),
                BinOp::Div => format!("\\frac{{{}}}{{{}}}", to_latex(lhs), to_latex(rhs)),
                BinOp::Pow => format!("{}^{{{}}}", to_latex_paren_if_compound(lhs), to_latex(rhs)),
            }
        }
        SymExpr::UnaryOp { op, operand } => {
            match op {
                UnaryOp::Neg => format!("-{}", to_latex_paren_if_compound(operand)),
                UnaryOp::Abs => format!("\\left|{}\\right|", to_latex(operand)),
                UnaryOp::Floor => format!("\\lfloor {} \\rfloor", to_latex(operand)),
                UnaryOp::Ceil => format!("\\lceil {} \\rceil", to_latex(operand)),
                UnaryOp::Sign => format!("\\operatorname{{sgn}}({})", to_latex(operand)),
            }
        }
        SymExpr::Function { func: f, arg } => {
            let name = match f {
                Func::Sin => "\\sin",
                Func::Cos => "\\cos",
                Func::Tan => "\\tan",
                Func::Asin => "\\arcsin",
                Func::Acos => "\\arccos",
                Func::Atan => "\\arctan",
                Func::Exp => "\\exp",
                Func::Ln => "\\ln",
                Func::Log10 => "\\log_{10}",
                Func::Sqrt => return format!("\\sqrt{{{}}}", to_latex(arg)),
                Func::Sinh => "\\sinh",
                Func::Cosh => "\\cosh",
                Func::Tanh => "\\tanh",
            };
            format!("{}\\left({}\\right)", name, to_latex(arg))
        }
        SymExpr::Sum(terms) => {
            terms
                .iter()
                .map(|t| to_latex(t))
                .collect::<Vec<_>>()
                .join(" + ")
        }
        SymExpr::Product(factors) => {
            factors
                .iter()
                .map(|f| to_latex_paren_if_add(f))
                .collect::<Vec<_>>()
                .join(" \\cdot ")
        }
    }
}

fn to_latex_paren_if_sum(expr: &Expr) -> String {
    match expr.as_ref() {
        SymExpr::BinaryOp { op: BinOp::Add | BinOp::Sub, .. } | SymExpr::Sum(_) => {
            format!("\\left({}\\right)", to_latex(expr))
        }
        _ => to_latex(expr),
    }
}

fn to_latex_paren_if_add(expr: &Expr) -> String {
    match expr.as_ref() {
        SymExpr::BinaryOp { op: BinOp::Add | BinOp::Sub, .. } | SymExpr::Sum(_) => {
            format!("\\left({}\\right)", to_latex(expr))
        }
        _ => to_latex(expr),
    }
}

fn to_latex_paren_if_compound(expr: &Expr) -> String {
    match expr.as_ref() {
        SymExpr::Variable(_) | SymExpr::Constant(_) => to_latex(expr),
        _ => format!("\\left({}\\right)", to_latex(expr)),
    }
}

// ── Polynomial Utilities ────────────────────────────────────────────────────

/// Represents a univariate polynomial: coeffs[i] is the coefficient of x^i.
/// E.g., 3 + 2x + x^2 → coeffs = [3.0, 2.0, 1.0]
#[derive(Debug, Clone, PartialEq)]
pub struct Polynomial {
    pub coeffs: Vec<f64>,
}

impl Polynomial {
    /// Create from coefficient vector [c0, c1, ..., cn].
    pub fn new(coeffs: Vec<f64>) -> Self {
        let mut p = Polynomial { coeffs };
        p.trim();
        p
    }

    /// Zero polynomial.
    pub fn zero() -> Self {
        Polynomial { coeffs: vec![] }
    }

    /// Constant polynomial.
    pub fn constant(c: f64) -> Self {
        if c == 0.0 { Self::zero() } else { Polynomial { coeffs: vec![c] } }
    }

    /// Monomial x^n.
    pub fn monomial(n: usize) -> Self {
        let mut coeffs = vec![0.0; n + 1];
        coeffs[n] = 1.0;
        Polynomial { coeffs }
    }

    /// Degree of the polynomial (-1 for zero polynomial).
    pub fn degree(&self) -> i32 {
        if self.coeffs.is_empty() { -1 } else { self.coeffs.len() as i32 - 1 }
    }

    /// Evaluate at a point.
    pub fn eval_at(&self, x: f64) -> f64 {
        // Horner's method
        let mut result = 0.0;
        for c in self.coeffs.iter().rev() {
            result = result * x + c;
        }
        result
    }

    /// Add two polynomials.
    pub fn add(&self, other: &Polynomial) -> Polynomial {
        let n = self.coeffs.len().max(other.coeffs.len());
        let mut coeffs = vec![0.0; n];
        for (i, c) in self.coeffs.iter().enumerate() {
            coeffs[i] += c;
        }
        for (i, c) in other.coeffs.iter().enumerate() {
            coeffs[i] += c;
        }
        Polynomial::new(coeffs)
    }

    /// Subtract two polynomials.
    pub fn sub(&self, other: &Polynomial) -> Polynomial {
        let n = self.coeffs.len().max(other.coeffs.len());
        let mut coeffs = vec![0.0; n];
        for (i, c) in self.coeffs.iter().enumerate() {
            coeffs[i] += c;
        }
        for (i, c) in other.coeffs.iter().enumerate() {
            coeffs[i] -= c;
        }
        Polynomial::new(coeffs)
    }

    /// Multiply two polynomials.
    pub fn mul(&self, other: &Polynomial) -> Polynomial {
        if self.coeffs.is_empty() || other.coeffs.is_empty() {
            return Polynomial::zero();
        }
        let n = self.coeffs.len() + other.coeffs.len() - 1;
        let mut coeffs = vec![0.0; n];
        for (i, a) in self.coeffs.iter().enumerate() {
            for (j, b) in other.coeffs.iter().enumerate() {
                coeffs[i + j] += a * b;
            }
        }
        Polynomial::new(coeffs)
    }

    /// Scalar multiply.
    pub fn scale(&self, s: f64) -> Polynomial {
        Polynomial::new(self.coeffs.iter().map(|c| c * s).collect())
    }

    /// Polynomial long division: returns (quotient, remainder).
    pub fn div_rem(&self, divisor: &Polynomial) -> (Polynomial, Polynomial) {
        if divisor.coeffs.is_empty() {
            panic!("Division by zero polynomial");
        }
        if self.degree() < divisor.degree() {
            return (Polynomial::zero(), self.clone());
        }
        let mut remainder = self.coeffs.clone();
        let d_lead = *divisor.coeffs.last().unwrap();
        let d_deg = divisor.degree() as usize;
        let q_len = self.coeffs.len() - d_deg;
        let mut quotient = vec![0.0; q_len];

        for i in (0..q_len).rev() {
            let q = remainder[i + d_deg] / d_lead;
            quotient[i] = q;
            for (j, c) in divisor.coeffs.iter().enumerate() {
                remainder[i + j] -= q * c;
            }
        }
        (Polynomial::new(quotient), Polynomial::new(remainder))
    }

    /// GCD of two polynomials (Euclidean algorithm).
    pub fn gcd(&self, other: &Polynomial) -> Polynomial {
        let mut a = self.clone();
        let mut b = other.clone();
        while !b.coeffs.is_empty() {
            let (_, r) = a.div_rem(&b);
            a = b;
            b = r;
        }
        // Normalize: make leading coefficient 1
        if let Some(&lead) = a.coeffs.last() {
            if lead != 0.0 {
                a = a.scale(1.0 / lead);
            }
        }
        a
    }

    /// Formal derivative.
    pub fn derivative(&self) -> Polynomial {
        if self.coeffs.len() <= 1 {
            return Polynomial::zero();
        }
        let coeffs: Vec<f64> = self.coeffs[1..]
            .iter()
            .enumerate()
            .map(|(i, c)| c * (i + 1) as f64)
            .collect();
        Polynomial::new(coeffs)
    }

    /// Convert to symbolic expression in given variable.
    pub fn to_expr(&self, var: &str) -> Expr {
        if self.coeffs.is_empty() {
            return zero();
        }
        let x = self::var(var);
        let mut terms: Vec<Expr> = Vec::new();
        for (i, &c) in self.coeffs.iter().enumerate() {
            if c == 0.0 { continue; }
            let term = if i == 0 {
                con(c)
            } else if i == 1 {
                if c == 1.0 { x.clone() } else { mul(con(c), x.clone()) }
            } else {
                let x_pow = pow(x.clone(), con(i as f64));
                if c == 1.0 { x_pow } else { mul(con(c), x_pow) }
            };
            terms.push(term);
        }
        match terms.len() {
            0 => zero(),
            1 => terms.pop().unwrap(),
            _ => Rc::new(SymExpr::Sum(terms)),
        }
    }

    /// Remove trailing zeros.
    fn trim(&mut self) {
        while self.coeffs.last() == Some(&0.0) {
            self.coeffs.pop();
        }
    }
}

impl fmt::Display for Polynomial {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.coeffs.is_empty() {
            return write!(f, "0");
        }
        let mut first = true;
        for (i, &c) in self.coeffs.iter().enumerate().rev() {
            if c == 0.0 { continue; }
            if !first && c > 0.0 { write!(f, " + ")?; }
            if !first && c < 0.0 { write!(f, " - ")?; }
            if first && c < 0.0 { write!(f, "-")?; }
            let ac = c.abs();
            match i {
                0 => write!(f, "{ac}")?,
                1 => {
                    if ac != 1.0 { write!(f, "{ac}")?; }
                    write!(f, "x")?;
                }
                _ => {
                    if ac != 1.0 { write!(f, "{ac}")?; }
                    write!(f, "x^{i}")?;
                }
            }
            first = false;
        }
        Ok(())
    }
}

// ── Multivariate Polynomials & Gröbner Bases ────────────────────────────────

/// Monomial ordering for Gröbner basis computation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MonomialOrder {
    /// Graded reverse lexicographic (grevlex) — the standard choice.
    GrevLex,
    /// Pure lexicographic — useful for elimination.
    Lex,
    /// Graded lexicographic.
    GrLex,
}

/// A monomial exponent vector. `exponents[i]` is the power of variable i.
/// E.g., for variables [x, y, z], the monomial x²yz³ is [2, 1, 3].
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct Monomial {
    pub exponents: Vec<u32>,
}

impl Monomial {
    /// Total degree of this monomial.
    pub fn total_degree(&self) -> u32 {
        self.exponents.iter().sum()
    }

    /// Multiply two monomials (add exponents).
    pub fn mul(&self, other: &Monomial) -> Monomial {
        let n = self.exponents.len().max(other.exponents.len());
        let mut exponents = vec![0u32; n];
        for (i, &e) in self.exponents.iter().enumerate() {
            exponents[i] += e;
        }
        for (i, &e) in other.exponents.iter().enumerate() {
            exponents[i] += e;
        }
        Monomial { exponents }
    }

    /// Check if `self` is divisible by `other` (component-wise >=).
    pub fn is_divisible_by(&self, other: &Monomial) -> bool {
        let n = other.exponents.len();
        if self.exponents.len() < n {
            return other.exponents[self.exponents.len()..].iter().all(|&e| e == 0);
        }
        for i in 0..n {
            if self.exponents[i] < other.exponents[i] {
                return false;
            }
        }
        true
    }

    /// Divide `self` by `other` (subtract exponents). Panics if not divisible.
    pub fn div(&self, other: &Monomial) -> Monomial {
        let n = self.exponents.len().max(other.exponents.len());
        let mut exponents = vec![0u32; n];
        for i in 0..n {
            let a = if i < self.exponents.len() { self.exponents[i] } else { 0 };
            let b = if i < other.exponents.len() { other.exponents[i] } else { 0 };
            debug_assert!(a >= b, "Monomial not divisible");
            exponents[i] = a - b;
        }
        Monomial { exponents }
    }

    /// Least common multiple of two monomials (component-wise max).
    pub fn lcm(&self, other: &Monomial) -> Monomial {
        let n = self.exponents.len().max(other.exponents.len());
        let mut exponents = vec![0u32; n];
        for i in 0..n {
            let a = if i < self.exponents.len() { self.exponents[i] } else { 0 };
            let b = if i < other.exponents.len() { other.exponents[i] } else { 0 };
            exponents[i] = a.max(b);
        }
        Monomial { exponents }
    }

    /// GCD of two monomials (component-wise min).
    pub fn gcd(&self, other: &Monomial) -> Monomial {
        let n = self.exponents.len().max(other.exponents.len());
        let mut exponents = vec![0u32; n];
        for i in 0..n {
            let a = if i < self.exponents.len() { self.exponents[i] } else { 0 };
            let b = if i < other.exponents.len() { other.exponents[i] } else { 0 };
            exponents[i] = a.min(b);
        }
        Monomial { exponents }
    }

    /// Check if two monomials are coprime (gcd = 1).
    pub fn is_coprime(&self, other: &Monomial) -> bool {
        let n = self.exponents.len().min(other.exponents.len());
        for i in 0..n {
            if self.exponents[i] > 0 && other.exponents[i] > 0 {
                return false;
            }
        }
        true
    }

    /// Compare monomials under grevlex ordering.
    fn cmp_grevlex(&self, other: &Monomial) -> std::cmp::Ordering {
        let td_a = self.total_degree();
        let td_b = other.total_degree();
        if td_a != td_b {
            return td_a.cmp(&td_b);
        }
        // Reverse lexicographic: compare from last variable, prefer *smaller* exponent
        let n = self.exponents.len().max(other.exponents.len());
        for i in (0..n).rev() {
            let a = if i < self.exponents.len() { self.exponents[i] } else { 0 };
            let b = if i < other.exponents.len() { other.exponents[i] } else { 0 };
            if a != b {
                // In grevlex, *smaller* last exponent is *larger* — reversed
                return b.cmp(&a);
            }
        }
        std::cmp::Ordering::Equal
    }

    /// Compare monomials under lex ordering.
    fn cmp_lex(&self, other: &Monomial) -> std::cmp::Ordering {
        let n = self.exponents.len().max(other.exponents.len());
        for i in 0..n {
            let a = if i < self.exponents.len() { self.exponents[i] } else { 0 };
            let b = if i < other.exponents.len() { other.exponents[i] } else { 0 };
            if a != b {
                return a.cmp(&b).reverse();
            }
        }
        std::cmp::Ordering::Equal
    }

    /// Compare monomials under grlex ordering.
    fn cmp_grlex(&self, other: &Monomial) -> std::cmp::Ordering {
        let td_a = self.total_degree();
        let td_b = other.total_degree();
        if td_a != td_b {
            return td_a.cmp(&td_b);
        }
        self.cmp_lex(other)
    }

    /// Compare monomials under the given ordering.
    pub fn cmp_order(&self, other: &Monomial, order: MonomialOrder) -> std::cmp::Ordering {
        match order {
            MonomialOrder::GrevLex => self.cmp_grevlex(other),
            MonomialOrder::Lex => self.cmp_lex(other),
            MonomialOrder::GrLex => self.cmp_grlex(other),
        }
    }

    /// True if this monomial is the constant 1 (all exponents zero).
    pub fn is_one(&self) -> bool {
        self.exponents.iter().all(|&e| e == 0)
    }
}

/// A multivariate polynomial: sparse representation as a list of (coefficient, monomial) pairs.
#[derive(Debug, Clone)]
pub struct MultiPoly {
    /// Variable names for display. E.g., ["x", "y", "z"].
    pub var_names: Vec<String>,
    /// Terms sorted in descending order by the chosen monomial ordering.
    /// Invariant: no two terms share the same monomial; no zero-coefficient terms.
    pub terms: Vec<(f64, Monomial)>,
    /// Monomial ordering used for this polynomial.
    pub order: MonomialOrder,
}

/// Tolerance for treating coefficients as zero.
const COEFF_EPS: f64 = 1e-12;

impl MultiPoly {
    /// Create from raw terms, normalizing (sorting + combining like terms).
    pub fn new(var_names: Vec<String>, terms: Vec<(f64, Monomial)>, order: MonomialOrder) -> Self {
        let mut poly = MultiPoly { var_names, terms, order };
        poly.normalize();
        poly
    }

    /// Zero polynomial.
    pub fn zero(var_names: Vec<String>, order: MonomialOrder) -> Self {
        MultiPoly { var_names, terms: vec![], order }
    }

    /// Constant polynomial.
    pub fn constant(var_names: Vec<String>, c: f64, order: MonomialOrder) -> Self {
        if c.abs() < COEFF_EPS {
            return Self::zero(var_names, order);
        }
        let n = var_names.len();
        MultiPoly {
            var_names,
            terms: vec![(c, Monomial { exponents: vec![0; n] })],
            order,
        }
    }

    /// Create a single-variable polynomial: variable `var_idx` raised to power `exp`.
    pub fn var_power(var_names: Vec<String>, var_idx: usize, exp: u32, order: MonomialOrder) -> Self {
        let n = var_names.len();
        let mut exponents = vec![0u32; n];
        exponents[var_idx] = exp;
        MultiPoly {
            var_names,
            terms: vec![(1.0, Monomial { exponents })],
            order,
        }
    }

    /// Is this the zero polynomial?
    pub fn is_zero(&self) -> bool {
        self.terms.is_empty()
    }

    /// Total degree of the polynomial.
    pub fn total_degree(&self) -> Option<u32> {
        self.terms.iter().map(|(_, m)| m.total_degree()).max()
    }

    /// Leading term (coefficient, monomial) under the current ordering.
    pub fn leading_term(&self) -> Option<&(f64, Monomial)> {
        self.terms.first()
    }

    /// Leading monomial.
    pub fn leading_monomial(&self) -> Option<&Monomial> {
        self.terms.first().map(|(_, m)| m)
    }

    /// Leading coefficient.
    pub fn leading_coeff(&self) -> Option<f64> {
        self.terms.first().map(|(c, _)| *c)
    }

    /// Add two multivariate polynomials.
    pub fn add(&self, other: &MultiPoly) -> MultiPoly {
        let mut terms: Vec<(f64, Monomial)> = self.terms.clone();
        terms.extend(other.terms.iter().cloned());
        MultiPoly::new(self.var_names.clone(), terms, self.order)
    }

    /// Subtract two multivariate polynomials.
    pub fn sub(&self, other: &MultiPoly) -> MultiPoly {
        let neg: Vec<(f64, Monomial)> = other.terms.iter().map(|(c, m)| (-c, m.clone())).collect();
        let mut terms = self.terms.clone();
        terms.extend(neg);
        MultiPoly::new(self.var_names.clone(), terms, self.order)
    }

    /// Multiply two multivariate polynomials.
    pub fn mul(&self, other: &MultiPoly) -> MultiPoly {
        let mut terms = Vec::with_capacity(self.terms.len() * other.terms.len());
        for (ca, ma) in &self.terms {
            for (cb, mb) in &other.terms {
                terms.push((ca * cb, ma.mul(mb)));
            }
        }
        MultiPoly::new(self.var_names.clone(), terms, self.order)
    }

    /// Scalar multiplication.
    pub fn scale(&self, s: f64) -> MultiPoly {
        let terms: Vec<(f64, Monomial)> = self.terms.iter().map(|(c, m)| (c * s, m.clone())).collect();
        MultiPoly::new(self.var_names.clone(), terms, self.order)
    }

    /// Multiply by a monomial.
    pub fn mul_monomial(&self, coeff: f64, mono: &Monomial) -> MultiPoly {
        let terms: Vec<(f64, Monomial)> = self.terms.iter().map(|(c, m)| (c * coeff, m.mul(mono))).collect();
        MultiPoly::new(self.var_names.clone(), terms, self.order)
    }

    /// Make the leading coefficient 1 (monic normalization).
    pub fn make_monic(&self) -> MultiPoly {
        if let Some(lc) = self.leading_coeff() {
            if lc.abs() > COEFF_EPS {
                return self.scale(1.0 / lc);
            }
        }
        self.clone()
    }

    /// Multivariate polynomial division.
    /// Returns (quotients, remainder) where `self = q[0]*divisors[0] + ... + q[n]*divisors[n] + remainder`.
    pub fn divide(&self, divisors: &[MultiPoly]) -> (Vec<MultiPoly>, MultiPoly) {
        let order = self.order;
        let vars = self.var_names.clone();
        let n = divisors.len();
        let mut quotients: Vec<MultiPoly> = (0..n).map(|_| MultiPoly::zero(vars.clone(), order)).collect();
        let mut remainder = MultiPoly::zero(vars.clone(), order);
        let mut p = self.clone();

        while !p.is_zero() {
            let mut divided = false;
            for i in 0..n {
                if let (Some(lt_p), Some(lt_d)) = (p.leading_term(), divisors[i].leading_term()) {
                    if lt_p.1.is_divisible_by(&lt_d.1) {
                        let coeff = lt_p.0 / lt_d.0;
                        let mono = lt_p.1.div(&lt_d.1);
                        // quotients[i] += coeff * mono
                        quotients[i] = quotients[i].add(&MultiPoly {
                            var_names: vars.clone(),
                            terms: vec![(coeff, mono.clone())],
                            order,
                        });
                        // p -= coeff * mono * divisors[i]
                        let sub_term = divisors[i].mul_monomial(coeff, &mono);
                        p = p.sub(&sub_term);
                        divided = true;
                        break;
                    }
                }
            }
            if !divided {
                // Move leading term of p to remainder
                if let Some(lt) = p.leading_term().cloned() {
                    remainder = remainder.add(&MultiPoly {
                        var_names: vars.clone(),
                        terms: vec![lt.clone()],
                        order,
                    });
                    // Remove leading term from p
                    p.terms.remove(0);
                }
            }
        }

        (quotients, remainder)
    }

    /// Reduce `self` modulo a set of polynomials (compute normal form).
    pub fn reduce(&self, basis: &[MultiPoly]) -> MultiPoly {
        let (_, remainder) = self.divide(basis);
        remainder
    }

    /// Evaluate at a point (variable values).
    pub fn eval_at(&self, values: &[f64]) -> f64 {
        let mut result = 0.0;
        for (coeff, mono) in &self.terms {
            let mut term_val = *coeff;
            for (i, &exp) in mono.exponents.iter().enumerate() {
                if exp > 0 && i < values.len() {
                    term_val *= values[i].powi(exp as i32);
                }
            }
            result += term_val;
        }
        result
    }

    /// Normalize: sort terms in descending order, combine like terms, remove zeros.
    fn normalize(&mut self) {
        let order = self.order;
        // Sort descending by monomial order
        self.terms.sort_by(|a, b| b.1.cmp_order(&a.1, order));

        // Combine like terms
        let mut combined: Vec<(f64, Monomial)> = Vec::with_capacity(self.terms.len());
        for (c, m) in self.terms.drain(..) {
            if let Some(last) = combined.last_mut() {
                if last.1 == m {
                    last.0 += c;
                    continue;
                }
            }
            combined.push((c, m));
        }

        // Remove near-zero coefficients
        combined.retain(|(c, _)| c.abs() > COEFF_EPS);
        self.terms = combined;
    }
}

impl fmt::Display for MultiPoly {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.terms.is_empty() {
            return write!(f, "0");
        }
        let mut first = true;
        for (coeff, mono) in &self.terms {
            let c = *coeff;
            if !first && c > 0.0 {
                write!(f, " + ")?;
            } else if !first && c < 0.0 {
                write!(f, " - ")?;
            } else if first && c < 0.0 {
                write!(f, "-")?;
            }
            let ac = c.abs();
            let is_const = mono.is_one();
            if is_const || (ac - 1.0).abs() > COEFF_EPS {
                if is_const {
                    write!(f, "{ac}")?;
                } else {
                    write!(f, "{ac}")?;
                }
            }
            if !is_const {
                for (i, &exp) in mono.exponents.iter().enumerate() {
                    if exp > 0 {
                        if i < self.var_names.len() {
                            write!(f, "{}", self.var_names[i])?;
                        } else {
                            write!(f, "x{i}")?;
                        }
                        if exp > 1 {
                            write!(f, "^{exp}")?;
                        }
                    }
                }
            }
            first = false;
        }
        Ok(())
    }
}

// ── Gröbner Basis Computation ───────────────────────────────────────────────

/// S-polynomial of two polynomials f, g.
///
/// S(f,g) = (lcm(LM(f),LM(g)) / LT(f)) * f  -  (lcm(LM(f),LM(g)) / LT(g)) * g
pub fn s_polynomial(f: &MultiPoly, g: &MultiPoly) -> MultiPoly {
    let lt_f = match f.leading_term() {
        Some(t) => t,
        None => return MultiPoly::zero(f.var_names.clone(), f.order),
    };
    let lt_g = match g.leading_term() {
        Some(t) => t,
        None => return MultiPoly::zero(f.var_names.clone(), f.order),
    };

    let lcm_mono = lt_f.1.lcm(&lt_g.1);

    // lcm / LM(f) with coefficient adjustment
    let div_f = lcm_mono.div(&lt_f.1);
    let div_g = lcm_mono.div(&lt_g.1);

    let scaled_f = f.mul_monomial(1.0 / lt_f.0, &div_f);
    let scaled_g = g.mul_monomial(1.0 / lt_g.0, &div_g);

    scaled_f.sub(&scaled_g)
}

/// Result of Gröbner basis computation.
#[derive(Debug, Clone)]
pub struct GroebnerResult {
    /// The computed Gröbner basis.
    pub basis: Vec<MultiPoly>,
    /// Number of S-polynomials computed during the algorithm.
    pub s_poly_count: usize,
    /// Number of reductions to zero (indicates efficiency of criteria).
    pub zero_reductions: usize,
}

/// Compute a Gröbner basis using Buchberger's algorithm with improvements:
/// - Buchberger's first criterion: skip if LMs are coprime
/// - Buchberger's second criterion (chain criterion): skip redundant pairs
/// - Auto-reduction of the final basis (reduced Gröbner basis)
///
/// # Arguments
/// * `generators` - Input polynomial system (the ideal generators)
/// * `max_iterations` - Safety limit on number of iterations (default: 10000)
///
/// # Returns
/// A `GroebnerResult` containing the reduced Gröbner basis.
pub fn groebner_basis(generators: &[MultiPoly], max_iterations: usize) -> GroebnerResult {
    if generators.is_empty() {
        return GroebnerResult {
            basis: vec![],
            s_poly_count: 0,
            zero_reductions: 0,
        };
    }

    let order = generators[0].order;
    let vars = generators[0].var_names.clone();

    // Start with normalized copies
    let mut basis: Vec<MultiPoly> = generators.iter()
        .filter(|g| !g.is_zero())
        .map(|g| g.make_monic())
        .collect();

    if basis.is_empty() {
        return GroebnerResult {
            basis: vec![],
            s_poly_count: 0,
            zero_reductions: 0,
        };
    }

    // Collect all pairs to process
    let mut pairs: Vec<(usize, usize)> = Vec::new();
    for i in 0..basis.len() {
        for j in (i + 1)..basis.len() {
            pairs.push((i, j));
        }
    }

    let mut s_poly_count = 0;
    let mut zero_reductions = 0;
    let mut iterations = 0;

    while let Some((i, j)) = pairs.pop() {
        iterations += 1;
        if iterations > max_iterations {
            break;
        }

        // Both indices must still be valid
        if i >= basis.len() || j >= basis.len() {
            continue;
        }

        // Buchberger's first criterion: if LMs are coprime, S-poly reduces to zero
        if let (Some(lm_i), Some(lm_j)) = (basis[i].leading_monomial(), basis[j].leading_monomial()) {
            if lm_i.is_coprime(lm_j) {
                zero_reductions += 1;
                continue;
            }
        }

        // Buchberger's second criterion (simplified chain criterion):
        // If there exists k != i,j such that LM(basis[k]) divides lcm(LM(f_i), LM(f_j))
        // and pairs (i,k) and (j,k) have already been processed, skip.
        let skip = {
            if let (Some(lm_i), Some(lm_j)) = (basis[i].leading_monomial(), basis[j].leading_monomial()) {
                let lcm_ij = lm_i.lcm(lm_j);
                let mut should_skip = false;
                for k in 0..basis.len() {
                    if k == i || k == j { continue; }
                    if let Some(lm_k) = basis[k].leading_monomial() {
                        if lcm_ij.is_divisible_by(lm_k) {
                            // Check that the lcm of (i,k) and (j,k) are strictly smaller
                            let lcm_ik = lm_i.lcm(lm_k);
                            let lcm_jk = lm_j.lcm(lm_k);
                            if lcm_ik != lcm_ij && lcm_jk != lcm_ij {
                                should_skip = true;
                                break;
                            }
                        }
                    }
                }
                should_skip
            } else {
                false
            }
        };
        if skip {
            zero_reductions += 1;
            continue;
        }

        s_poly_count += 1;
        let s = s_polynomial(&basis[i], &basis[j]);

        // Reduce s modulo current basis
        let remainder = s.reduce(&basis);

        if !remainder.is_zero() {
            let new_poly = remainder.make_monic();
            let new_idx = basis.len();
            // Add new pairs with existing basis elements
            for k in 0..new_idx {
                pairs.push((k, new_idx));
            }
            basis.push(new_poly);
        } else {
            zero_reductions += 1;
        }
    }

    // Auto-reduce to get minimal/reduced Gröbner basis
    let reduced = reduce_basis(&basis, &vars, order);

    GroebnerResult {
        basis: reduced,
        s_poly_count,
        zero_reductions,
    }
}

/// Reduce a Gröbner basis: remove redundant generators and inter-reduce.
fn reduce_basis(basis: &[MultiPoly], vars: &[String], order: MonomialOrder) -> Vec<MultiPoly> {
    // Step 1: Remove generators whose LM is divisible by another generator's LM
    let mut minimal: Vec<MultiPoly> = Vec::new();
    for (i, gi) in basis.iter().enumerate() {
        if gi.is_zero() { continue; }
        let lm_i = match gi.leading_monomial() {
            Some(m) => m,
            None => continue,
        };
        let redundant = basis.iter().enumerate().any(|(j, gj)| {
            if i == j || gj.is_zero() { return false; }
            if let Some(lm_j) = gj.leading_monomial() {
                lm_i.is_divisible_by(lm_j) && lm_i != lm_j
            } else {
                false
            }
        });
        if !redundant {
            minimal.push(gi.clone());
        }
    }

    // Step 2: Inter-reduce: reduce each polynomial modulo the others
    let mut reduced: Vec<MultiPoly> = Vec::with_capacity(minimal.len());
    for i in 0..minimal.len() {
        let others: Vec<MultiPoly> = minimal.iter().enumerate()
            .filter(|&(j, _)| j != i)
            .map(|(_, p)| p.clone())
            .collect();
        let r = minimal[i].reduce(&others);
        if !r.is_zero() {
            reduced.push(r.make_monic());
        }
    }

    // Sort by leading monomial (descending) for consistent output
    reduced.sort_by(|a, b| {
        match (a.leading_monomial(), b.leading_monomial()) {
            (Some(ma), Some(mb)) => mb.cmp_order(ma, order),
            _ => std::cmp::Ordering::Equal,
        }
    });

    reduced
}

/// Solve a system of polynomial equations using Gröbner bases.
///
/// Given polynomials f_1, ..., f_m in variables x_1, ..., x_n, computes a Gröbner
/// basis of the ideal <f_1, ..., f_m> under lex ordering. For zero-dimensional ideals
/// (finitely many solutions), the last polynomial in the lex Gröbner basis is
/// univariate, and back-substitution yields the solutions.
///
/// # Arguments
/// * `system` - Polynomial equations (each assumed = 0)
/// * `var_names` - Variable names in elimination order (first variable eliminated last)
///
/// # Returns
/// * `Ok(solutions)` - List of solution vectors [x_1, x_2, ..., x_n]
/// * `Err(msg)` - If the system cannot be solved (infinite solutions, no solutions, etc.)
pub fn solve_polynomial_system(
    system: &[MultiPoly],
    max_iterations: usize,
) -> Result<Vec<Vec<f64>>, String> {
    if system.is_empty() {
        return Err("Empty polynomial system".to_string());
    }

    let var_names = system[0].var_names.clone();
    let n_vars = var_names.len();

    // Convert to lex order for elimination
    let lex_system: Vec<MultiPoly> = system.iter().map(|p| {
        MultiPoly::new(p.var_names.clone(), p.terms.clone(), MonomialOrder::Lex)
    }).collect();

    let result = groebner_basis(&lex_system, max_iterations);

    if result.basis.is_empty() {
        return Err("System has no solutions (basis is empty or all generators are zero)".to_string());
    }

    // Check for inconsistency: if basis = {1}, no solutions
    if result.basis.len() == 1 {
        if let Some((c, m)) = result.basis[0].leading_term() {
            if m.is_one() && c.abs() > COEFF_EPS {
                return Err("System is inconsistent (no solutions)".to_string());
            }
        }
    }

    // For a zero-dimensional ideal with lex order, the basis is "triangular":
    // last poly is in x_n only, second-to-last in x_{n-1}, x_n, etc.
    // Extract univariate polynomial in the last variable.
    let last_var_idx = n_vars - 1;

    // Find a univariate polynomial in the last variable
    let mut univariate: Option<&MultiPoly> = None;
    for poly in &result.basis {
        let is_univariate = poly.terms.iter().all(|(_, m)| {
            m.exponents.iter().enumerate().all(|(i, &e)| i == last_var_idx || e == 0)
        });
        if is_univariate {
            univariate = Some(poly);
            break;
        }
    }

    let uni_poly = match univariate {
        Some(p) => p,
        None => return Err("System may have infinitely many solutions (no univariate polynomial found)".to_string()),
    };

    // Convert to univariate Polynomial and find roots
    let max_deg = uni_poly.terms.iter()
        .map(|(_, m)| if last_var_idx < m.exponents.len() { m.exponents[last_var_idx] } else { 0 })
        .max()
        .unwrap_or(0);

    let mut coeffs = vec![0.0; (max_deg + 1) as usize];
    for (c, m) in &uni_poly.terms {
        let exp = if last_var_idx < m.exponents.len() { m.exponents[last_var_idx] } else { 0 };
        coeffs[exp as usize] += c;
    }
    let uni = Polynomial::new(coeffs);

    // Find real roots using companion matrix eigenvalues
    let roots = find_real_roots_of_poly(&uni);

    if roots.is_empty() {
        return Err("No real solutions found for the univariate polynomial".to_string());
    }

    // Back-substitute to find solutions
    if n_vars == 1 {
        return Ok(roots.iter().map(|&r| vec![r]).collect());
    }

    let mut solutions: Vec<Vec<f64>> = Vec::new();

    for &root_val in &roots {
        // Substitute the last variable's value into the remaining polynomials
        let mut remaining: Vec<MultiPoly> = Vec::new();
        for poly in &result.basis {
            let substituted = substitute_var_in_multipoly(poly, last_var_idx, root_val);
            if !substituted.is_zero() {
                remaining.push(substituted);
            }
        }

        if remaining.is_empty() {
            // All polynomials vanish — free variables
            continue;
        }

        if n_vars == 2 {
            // Only one variable left — find its roots from remaining polynomials
            let first_var_idx = 0;
            for rpoly in &remaining {
                let is_univariate = rpoly.terms.iter().all(|(_, m)| {
                    m.exponents.iter().enumerate().all(|(i, &e)| i == first_var_idx || e == 0)
                });
                if is_univariate {
                    let max_d = rpoly.terms.iter()
                        .map(|(_, m)| if first_var_idx < m.exponents.len() { m.exponents[first_var_idx] } else { 0 })
                        .max()
                        .unwrap_or(0);
                    let mut c = vec![0.0; (max_d + 1) as usize];
                    for (co, m) in &rpoly.terms {
                        let exp = if first_var_idx < m.exponents.len() { m.exponents[first_var_idx] } else { 0 };
                        c[exp as usize] += co;
                    }
                    let up = Polynomial::new(c);
                    let r = find_real_roots_of_poly(&up);
                    for &rv in &r {
                        solutions.push(vec![rv, root_val]);
                    }
                    break;
                }
            }
        } else {
            // Recurse for n_vars > 2
            let reduced_vars: Vec<String> = var_names.iter().enumerate()
                .filter(|&(i, _)| i != last_var_idx)
                .map(|(_, v)| v.clone())
                .collect();

            // Remap remaining polys to use reduced variable set
            let mut reduced_system: Vec<MultiPoly> = Vec::new();
            for rpoly in &remaining {
                let new_terms: Vec<(f64, Monomial)> = rpoly.terms.iter().map(|(c, m)| {
                    let new_exp: Vec<u32> = m.exponents.iter().enumerate()
                        .filter(|&(i, _)| i != last_var_idx)
                        .map(|(_, &e)| e)
                        .collect();
                    (*c, Monomial { exponents: new_exp })
                }).collect();
                reduced_system.push(MultiPoly::new(reduced_vars.clone(), new_terms, MonomialOrder::Lex));
            }

            match solve_polynomial_system(&reduced_system, max_iterations) {
                Ok(sub_solutions) => {
                    for mut sub_sol in sub_solutions {
                        sub_sol.push(root_val);
                        solutions.push(sub_sol);
                    }
                }
                Err(_) => continue,
            }
        }
    }

    Ok(solutions)
}

/// Substitute a specific value for a variable in a multivariate polynomial.
fn substitute_var_in_multipoly(poly: &MultiPoly, var_idx: usize, value: f64) -> MultiPoly {
    let mut new_terms: Vec<(f64, Monomial)> = Vec::new();
    for (coeff, mono) in &poly.terms {
        let exp = if var_idx < mono.exponents.len() { mono.exponents[var_idx] } else { 0 };
        let factor = value.powi(exp as i32);
        let new_coeff = coeff * factor;
        let mut new_exp = mono.exponents.clone();
        if var_idx < new_exp.len() {
            new_exp[var_idx] = 0;
        }
        new_terms.push((new_coeff, Monomial { exponents: new_exp }));
    }
    MultiPoly::new(poly.var_names.clone(), new_terms, poly.order)
}

/// Find real roots of a univariate polynomial.
/// Uses companion matrix eigenvalue approach for degree > 2,
/// quadratic formula for degree 2, linear for degree 1.
fn find_real_roots_of_poly(poly: &Polynomial) -> Vec<f64> {
    let deg = poly.degree();
    if deg <= 0 {
        return vec![];
    }

    if deg == 1 {
        // ax + b = 0 => x = -b/a
        let a = poly.coeffs[1];
        let b = poly.coeffs[0];
        if a.abs() < COEFF_EPS {
            return vec![];
        }
        return vec![-b / a];
    }

    if deg == 2 {
        let a = poly.coeffs[2];
        let b = poly.coeffs[1];
        let c = poly.coeffs[0];
        let disc = b * b - 4.0 * a * c;
        if disc < -COEFF_EPS {
            return vec![];
        }
        let disc = disc.max(0.0).sqrt();
        let mut roots = vec![(-b + disc) / (2.0 * a), (-b - disc) / (2.0 * a)];
        roots.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        // Deduplicate
        roots.dedup_by(|a, b| (*a - *b).abs() < 1e-8);
        return roots;
    }

    // For higher degrees, use companion matrix eigenvalue method
    let n = deg as usize;
    let lc = *poly.coeffs.last().unwrap();
    if lc.abs() < COEFF_EPS {
        // Degenerate — try reducing degree
        let mut reduced = poly.coeffs.clone();
        while reduced.last() == Some(&0.0) {
            reduced.pop();
        }
        return find_real_roots_of_poly(&Polynomial::new(reduced));
    }

    // Build companion matrix
    let mut companion = vec![vec![0.0; n]; n];
    for i in 0..n {
        // Last column: -c_i / c_n
        companion[i][n - 1] = -poly.coeffs[i] / lc;
        // Sub-diagonal
        if i > 0 {
            companion[i][i - 1] = 1.0;
        }
    }

    // QR iteration to find eigenvalues
    let eigenvalues = qr_eigenvalues(&companion, 1000);

    // Filter for real eigenvalues and refine with Newton's method
    let mut roots: Vec<f64> = Vec::new();
    for ev in &eigenvalues {
        // Verify root by evaluation
        let val = poly.eval_at(*ev);
        if val.abs() < 1e-6 {
            // Refine with Newton's method
            let refined = newton_refine_root(poly, *ev, 20);
            roots.push(refined);
        }
    }

    roots.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    roots.dedup_by(|a, b| (*a - *b).abs() < 1e-8);
    roots
}

/// Simple QR iteration for finding real eigenvalues of a matrix.
/// Returns approximate real eigenvalues.
fn qr_eigenvalues(matrix: &[Vec<f64>], max_iter: usize) -> Vec<f64> {
    let n = matrix.len();
    if n == 0 { return vec![]; }
    if n == 1 { return vec![matrix[0][0]]; }

    // Copy matrix
    let mut a: Vec<Vec<f64>> = matrix.to_vec();

    // Apply QR iteration with shifts
    for _ in 0..max_iter {
        // Wilkinson shift: eigenvalue of bottom-right 2×2 closer to a[n-1][n-1]
        let shift = if n >= 2 {
            let an = a[n - 1][n - 1];
            let an1 = a[n - 2][n - 2];
            let b = a[n - 2][n - 1];
            let delta = (an1 - an) / 2.0;
            let mu = an - b * b / (delta + delta.signum() * (delta * delta + b * b).sqrt());
            if mu.is_finite() { mu } else { 0.0 }
        } else {
            0.0
        };

        // Shift
        for i in 0..n {
            a[i][i] -= shift;
        }

        // QR factorization via Householder
        let (q, r) = qr_decompose(&a);

        // A = R * Q + shift * I
        a = mat_mul(&r, &q);
        for i in 0..n {
            a[i][i] += shift;
        }

        // Check convergence (sub-diagonal elements small)
        let mut converged = true;
        for i in 1..n {
            if a[i][i - 1].abs() > 1e-10 {
                converged = false;
                break;
            }
        }
        if converged { break; }
    }

    // Extract diagonal as eigenvalues (real parts of eigenvalues for converged blocks)
    let mut eigenvalues = Vec::new();
    let mut i = 0;
    while i < n {
        if i + 1 < n && a[i + 1][i].abs() > 1e-10 {
            // 2×2 block — might have complex eigenvalues
            let p = a[i][i] + a[i + 1][i + 1]; // trace
            let q = a[i][i] * a[i + 1][i + 1] - a[i][i + 1] * a[i + 1][i]; // det
            let disc = p * p - 4.0 * q;
            if disc >= 0.0 {
                eigenvalues.push((p + disc.sqrt()) / 2.0);
                eigenvalues.push((p - disc.sqrt()) / 2.0);
            }
            // Skip complex eigenvalues
            i += 2;
        } else {
            eigenvalues.push(a[i][i]);
            i += 1;
        }
    }

    eigenvalues
}

/// QR decomposition via Householder reflections.
fn qr_decompose(a: &[Vec<f64>]) -> (Vec<Vec<f64>>, Vec<Vec<f64>>) {
    let n = a.len();
    let mut q = eye(n);
    let mut r: Vec<Vec<f64>> = a.to_vec();

    for j in 0..n.saturating_sub(1) {
        // Extract column below diagonal
        let mut x = vec![0.0; n - j];
        for i in j..n {
            x[i - j] = r[i][j];
        }

        let norm_x = x.iter().map(|v| v * v).sum::<f64>().sqrt();
        if norm_x < 1e-15 { continue; }

        let mut v = x.clone();
        v[0] += v[0].signum() * norm_x;
        let norm_v = v.iter().map(|v| v * v).sum::<f64>().sqrt();
        if norm_v < 1e-15 { continue; }
        for vi in &mut v { *vi /= norm_v; }

        // Apply Householder: R = (I - 2vv^T) * R
        for col in j..n {
            let mut dot = 0.0;
            for i in j..n {
                dot += v[i - j] * r[i][col];
            }
            for i in j..n {
                r[i][col] -= 2.0 * v[i - j] * dot;
            }
        }

        // Accumulate Q = Q * (I - 2vv^T)
        for row in 0..n {
            let mut dot = 0.0;
            for i in j..n {
                dot += q[row][i] * v[i - j];
            }
            for i in j..n {
                q[row][i] -= 2.0 * dot * v[i - j];
            }
        }
    }

    (q, r)
}

/// Identity matrix.
fn eye(n: usize) -> Vec<Vec<f64>> {
    let mut m = vec![vec![0.0; n]; n];
    for i in 0..n { m[i][i] = 1.0; }
    m
}

/// Matrix multiplication.
fn mat_mul(a: &[Vec<f64>], b: &[Vec<f64>]) -> Vec<Vec<f64>> {
    let n = a.len();
    let mut c = vec![vec![0.0; n]; n];
    for i in 0..n {
        for k in 0..n {
            let aik = a[i][k];
            if aik.abs() < 1e-15 { continue; }
            for j in 0..n {
                c[i][j] += aik * b[k][j];
            }
        }
    }
    c
}

/// Newton's method to refine a root estimate.
fn newton_refine_root(poly: &Polynomial, initial: f64, max_iter: usize) -> f64 {
    let dpoly = poly.derivative();
    let mut x = initial;
    for _ in 0..max_iter {
        let fx = poly.eval_at(x);
        let dfx = dpoly.eval_at(x);
        if dfx.abs() < 1e-15 { break; }
        let step = fx / dfx;
        x -= step;
        if step.abs() < 1e-14 { break; }
    }
    x
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn constant_eval() {
        let e = con(42.0);
        assert_eq!(eval(&e, &HashMap::new()), 42.0);
    }

    #[test]
    fn variable_eval() {
        let e = var("x");
        let mut vars = HashMap::new();
        vars.insert("x".to_string(), 3.0);
        assert_eq!(eval(&e, &vars), 3.0);
    }

    #[test]
    fn arithmetic_eval() {
        // (x + 2) * 3 at x=5 → 21
        let e = mul(add(var("x"), con(2.0)), con(3.0));
        let mut vars = HashMap::new();
        vars.insert("x".to_string(), 5.0);
        assert_eq!(eval(&e, &vars), 21.0);
    }

    #[test]
    fn function_eval() {
        // sin(0) = 0
        let e = sin(con(0.0));
        assert!((eval(&e, &HashMap::new()) - 0.0).abs() < 1e-15);

        // exp(1) = e
        let e = exp(con(1.0));
        assert!((eval(&e, &HashMap::new()) - std::f64::consts::E).abs() < 1e-15);
    }

    #[test]
    fn differentiate_polynomial() {
        // d(x^3)/dx = 3*x^2
        let x = var("x");
        let e = pow(x.clone(), con(3.0));
        let de = differentiate(&e, "x");
        let de = simplify(&de);

        let mut vars = HashMap::new();
        vars.insert("x".to_string(), 2.0);
        // 3 * 2^2 = 12
        let val = eval(&de, &vars);
        assert!((val - 12.0).abs() < 1e-10, "got {val}");
    }

    #[test]
    fn differentiate_sin() {
        // d(sin(x))/dx = cos(x)
        let x = var("x");
        let e = sin(x.clone());
        let de = differentiate(&e, "x");
        let de = simplify(&de);

        let mut vars = HashMap::new();
        vars.insert("x".to_string(), 1.0);
        let expected = 1.0_f64.cos();
        let got = eval(&de, &vars);
        assert!((got - expected).abs() < 1e-10, "expected {expected}, got {got}");
    }

    #[test]
    fn differentiate_product_rule() {
        // d(x * sin(x))/dx = sin(x) + x*cos(x)
        let x = var("x");
        let e = mul(x.clone(), sin(x.clone()));
        let de = differentiate(&e, "x");
        let de = simplify(&de);

        let mut vars = HashMap::new();
        vars.insert("x".to_string(), 2.0);
        let expected = 2.0_f64.sin() + 2.0 * 2.0_f64.cos();
        let got = eval(&de, &vars);
        assert!((got - expected).abs() < 1e-10, "expected {expected}, got {got}");
    }

    #[test]
    fn differentiate_chain_rule() {
        // d(exp(x^2))/dx = 2*x*exp(x^2)
        let x = var("x");
        let e = exp(pow(x.clone(), con(2.0)));
        let de = differentiate(&e, "x");
        let de = simplify(&de);

        let mut vars = HashMap::new();
        vars.insert("x".to_string(), 1.0);
        let expected = 2.0 * (1.0_f64).exp(); // 2*1*exp(1)
        let got = eval(&de, &vars);
        assert!((got - expected).abs() < 1e-10, "expected {expected}, got {got}");
    }

    #[test]
    fn simplify_identity() {
        let x = var("x");
        // x + 0 → x
        let e = add(x.clone(), zero());
        let s = simplify(&e);
        assert!(matches!(s.as_ref(), SymExpr::Variable(n) if n == "x"));

        // x * 1 → x
        let e = mul(x.clone(), one());
        let s = simplify(&e);
        assert!(matches!(s.as_ref(), SymExpr::Variable(n) if n == "x"));

        // x * 0 → 0
        let e = mul(x.clone(), zero());
        let s = simplify(&e);
        assert!(is_zero(&s));
    }

    #[test]
    fn simplify_constant_fold() {
        let e = add(con(2.0), con(3.0));
        let s = simplify(&e);
        assert!(matches!(s.as_ref(), SymExpr::Constant(v) if *v == 5.0));
    }

    #[test]
    fn free_variables_test() {
        let e = add(mul(var("x"), var("y")), sin(var("x")));
        let fv = free_variables(&e);
        assert_eq!(fv, vec!["x", "y"]);
    }

    #[test]
    fn substitute_test() {
        // x + 1, substitute x → 2*y
        let e = add(var("x"), con(1.0));
        let replacement = mul(con(2.0), var("y"));
        let result = substitute(&e, "x", &replacement);
        let mut vars = HashMap::new();
        vars.insert("y".to_string(), 3.0);
        // 2*3 + 1 = 7
        assert_eq!(eval(&result, &vars), 7.0);
    }

    #[test]
    fn latex_rendering() {
        let e = div(sin(var("x")), var("x"));
        let latex = to_latex(&e);
        assert_eq!(latex, "\\frac{\\sin\\left(x\\right)}{x}");
    }

    #[test]
    fn polynomial_arithmetic() {
        // p = 1 + 2x + 3x^2
        let p = Polynomial::new(vec![1.0, 2.0, 3.0]);
        // q = 2 + x
        let q = Polynomial::new(vec![2.0, 1.0]);

        // p + q = 3 + 3x + 3x^2
        let sum = p.add(&q);
        assert_eq!(sum.coeffs, vec![3.0, 3.0, 3.0]);

        // p * q = 2 + 5x + 8x^2 + 3x^3
        let prod = p.mul(&q);
        assert_eq!(prod.coeffs, vec![2.0, 5.0, 8.0, 3.0]);
    }

    #[test]
    fn polynomial_division() {
        // (x^2 - 1) / (x - 1) = (x + 1), remainder 0
        let p = Polynomial::new(vec![-1.0, 0.0, 1.0]); // x^2 - 1
        let q = Polynomial::new(vec![-1.0, 1.0]); // x - 1
        let (quot, rem) = p.div_rem(&q);
        assert_eq!(quot.coeffs, vec![1.0, 1.0]); // x + 1
        assert!(rem.coeffs.is_empty()); // remainder 0
    }

    #[test]
    fn polynomial_gcd() {
        // gcd(x^2 - 1, x - 1) = x - 1 (normalized)
        let p = Polynomial::new(vec![-1.0, 0.0, 1.0]);
        let q = Polynomial::new(vec![-1.0, 1.0]);
        let g = p.gcd(&q);
        // Should be (x - 1) normalized (leading coeff 1)
        assert_eq!(g.degree(), 1);
        assert!((g.coeffs[1] - 1.0).abs() < 1e-10);
    }

    #[test]
    fn polynomial_derivative() {
        // d(1 + 2x + 3x^2)/dx = 2 + 6x
        let p = Polynomial::new(vec![1.0, 2.0, 3.0]);
        let dp = p.derivative();
        assert_eq!(dp.coeffs, vec![2.0, 6.0]);
    }

    #[test]
    fn polynomial_eval_horner() {
        // 1 + 2x + 3x^2 at x=2: 1+4+12=17
        let p = Polynomial::new(vec![1.0, 2.0, 3.0]);
        assert_eq!(p.eval_at(2.0), 17.0);
    }

    #[test]
    fn dag_sharing() {
        // Verify Rc sharing works: x is the same node in x + x
        let x = var("x");
        let e = add(x.clone(), x.clone());
        if let SymExpr::BinaryOp { lhs, rhs, .. } = e.as_ref() {
            assert!(Rc::ptr_eq(lhs, rhs));
        } else {
            panic!("Expected BinaryOp");
        }
    }

    #[test]
    fn display_expr() {
        let e = add(mul(con(2.0), var("x")), con(1.0));
        let s = format!("{e}");
        assert_eq!(s, "((2 * x) + 1)");
    }

    #[test]
    fn integrate_polynomial() {
        // ∫x^2 dx = x^3/3
        let x = var("x");
        let e = pow(x.clone(), con(2.0));
        let result = integrate(&e, "x");
        match result {
            IntegrateResult::Ok(antideriv) => {
                let s = simplify(&antideriv);
                // Check: d/dx of antideriv should give back x^2
                let deriv = simplify(&differentiate(&s, "x"));
                let mut vars = HashMap::new();
                vars.insert("x".to_string(), 3.0);
                let original_val = eval(&e, &vars);
                let deriv_val = eval(&deriv, &vars);
                assert!((original_val - deriv_val).abs() < 1e-10,
                    "original={original_val}, deriv={deriv_val}");
            }
            IntegrateResult::NoElementary => panic!("Should find antiderivative of x^2"),
        }
    }

    #[test]
    fn integrate_sin() {
        // ∫sin(x) dx = -cos(x)
        let e = sin(var("x"));
        match integrate(&e, "x") {
            IntegrateResult::Ok(antideriv) => {
                let deriv = simplify(&differentiate(&antideriv, "x"));
                let mut vars = HashMap::new();
                vars.insert("x".to_string(), 1.5);
                let original = eval(&e, &vars);
                let got = eval(&deriv, &vars);
                assert!((original - got).abs() < 1e-10, "original={original}, got={got}");
            }
            IntegrateResult::NoElementary => panic!("Should find antiderivative of sin(x)"),
        }
    }

    #[test]
    fn integrate_exp() {
        // ∫exp(x) dx = exp(x)
        let e = exp(var("x"));
        match integrate(&e, "x") {
            IntegrateResult::Ok(antideriv) => {
                let deriv = simplify(&differentiate(&antideriv, "x"));
                let mut vars = HashMap::new();
                vars.insert("x".to_string(), 2.0);
                let original = eval(&e, &vars);
                let got = eval(&deriv, &vars);
                assert!((original - got).abs() < 1e-10);
            }
            IntegrateResult::NoElementary => panic!("Should find antiderivative of exp(x)"),
        }
    }

    #[test]
    fn integrate_constant_times_x() {
        // ∫3x dx = 3x^2/2
        let e = mul(con(3.0), var("x"));
        match integrate(&e, "x") {
            IntegrateResult::Ok(antideriv) => {
                let deriv = simplify(&differentiate(&antideriv, "x"));
                let mut vars = HashMap::new();
                vars.insert("x".to_string(), 4.0);
                let original = eval(&e, &vars); // 12
                let got = eval(&deriv, &vars);
                assert!((original - got).abs() < 1e-10, "original={original}, got={got}");
            }
            IntegrateResult::NoElementary => panic!("Should find antiderivative of 3x"),
        }
    }

    #[test]
    fn integrate_sum() {
        // ∫(x + sin(x)) dx = x^2/2 - cos(x)
        let e = add(var("x"), sin(var("x")));
        match integrate(&e, "x") {
            IntegrateResult::Ok(antideriv) => {
                let deriv = simplify(&differentiate(&antideriv, "x"));
                let mut vars = HashMap::new();
                vars.insert("x".to_string(), 1.0);
                let original = eval(&e, &vars);
                let got = eval(&deriv, &vars);
                assert!((original - got).abs() < 1e-10, "original={original}, got={got}");
            }
            IntegrateResult::NoElementary => panic!("Should find antiderivative"),
        }
    }

    #[test]
    fn integrate_no_elementary() {
        // ∫exp(x^2) dx has no elementary antiderivative
        let e = exp(pow(var("x"), con(2.0)));
        assert!(matches!(integrate(&e, "x"), IntegrateResult::NoElementary));
    }

    // ── Multivariate Polynomial Tests ──────────────────────────────────────

    #[test]
    fn multipoly_basic_arithmetic() {
        let vars = vec!["x".to_string(), "y".to_string()];
        let order = MonomialOrder::GrevLex;

        // p = x + y
        let p = MultiPoly::new(vars.clone(), vec![
            (1.0, Monomial { exponents: vec![1, 0] }),
            (1.0, Monomial { exponents: vec![0, 1] }),
        ], order);

        // q = x - y
        let q = MultiPoly::new(vars.clone(), vec![
            (1.0, Monomial { exponents: vec![1, 0] }),
            (-1.0, Monomial { exponents: vec![0, 1] }),
        ], order);

        // p * q = x^2 - y^2
        let product = p.mul(&q);
        // Evaluate at x=3, y=2: should be 9 - 4 = 5
        assert!((product.eval_at(&[3.0, 2.0]) - 5.0).abs() < 1e-10);
    }

    #[test]
    fn multipoly_division() {
        let vars = vec!["x".to_string(), "y".to_string()];
        let order = MonomialOrder::GrevLex;

        // f = x^2*y + x*y^2 + y^2
        let f = MultiPoly::new(vars.clone(), vec![
            (1.0, Monomial { exponents: vec![2, 1] }),
            (1.0, Monomial { exponents: vec![1, 2] }),
            (1.0, Monomial { exponents: vec![0, 2] }),
        ], order);

        // g1 = x*y - 1
        let g1 = MultiPoly::new(vars.clone(), vec![
            (1.0, Monomial { exponents: vec![1, 1] }),
            (-1.0, Monomial { exponents: vec![0, 0] }),
        ], order);

        // g2 = y^2 - 1
        let g2 = MultiPoly::new(vars.clone(), vec![
            (1.0, Monomial { exponents: vec![0, 2] }),
            (-1.0, Monomial { exponents: vec![0, 0] }),
        ], order);

        let (quotients, remainder) = f.divide(&[g1.clone(), g2.clone()]);

        // Verify: f = q1*g1 + q2*g2 + remainder (at a test point)
        let pt = [2.0, 3.0];
        let lhs = f.eval_at(&pt);
        let rhs = quotients[0].eval_at(&pt) * g1.eval_at(&pt)
            + quotients[1].eval_at(&pt) * g2.eval_at(&pt)
            + remainder.eval_at(&pt);
        assert!((lhs - rhs).abs() < 1e-8, "Division identity failed: lhs={lhs}, rhs={rhs}");
    }

    #[test]
    fn monomial_ordering() {
        // Test grevlex: x^2*y > x*y^2 (same total degree 3, but last var y: 1 < 2, so first is bigger)
        let m1 = Monomial { exponents: vec![2, 1] }; // x^2*y
        let m2 = Monomial { exponents: vec![1, 2] }; // x*y^2

        assert_eq!(m1.cmp_order(&m2, MonomialOrder::GrevLex), std::cmp::Ordering::Greater);

        // Test lex: x^2 > x*y
        let m3 = Monomial { exponents: vec![2, 0] }; // x^2
        let m4 = Monomial { exponents: vec![1, 1] }; // x*y
        assert_eq!(m3.cmp_order(&m4, MonomialOrder::Lex), std::cmp::Ordering::Greater);
    }

    #[test]
    fn s_polynomial_basic() {
        let vars = vec!["x".to_string(), "y".to_string()];
        let order = MonomialOrder::GrevLex;

        // f = x^3 - 2*x*y
        let f = MultiPoly::new(vars.clone(), vec![
            (1.0, Monomial { exponents: vec![3, 0] }),
            (-2.0, Monomial { exponents: vec![1, 1] }),
        ], order);

        // g = x^2*y - 2*y^2 + x
        let g = MultiPoly::new(vars.clone(), vec![
            (1.0, Monomial { exponents: vec![2, 1] }),
            (-2.0, Monomial { exponents: vec![0, 2] }),
            (1.0, Monomial { exponents: vec![1, 0] }),
        ], order);

        let s = s_polynomial(&f, &g);
        // S-poly should not be zero
        assert!(!s.is_zero());
    }

    #[test]
    fn groebner_basis_simple_linear() {
        // System: x + y - 3 = 0, x - y - 1 = 0
        // Solution: x = 2, y = 1
        let vars = vec!["x".to_string(), "y".to_string()];
        let order = MonomialOrder::Lex;

        let f1 = MultiPoly::new(vars.clone(), vec![
            (1.0, Monomial { exponents: vec![1, 0] }),
            (1.0, Monomial { exponents: vec![0, 1] }),
            (-3.0, Monomial { exponents: vec![0, 0] }),
        ], order);

        let f2 = MultiPoly::new(vars.clone(), vec![
            (1.0, Monomial { exponents: vec![1, 0] }),
            (-1.0, Monomial { exponents: vec![0, 1] }),
            (-1.0, Monomial { exponents: vec![0, 0] }),
        ], order);

        let result = groebner_basis(&[f1, f2], 1000);
        assert!(!result.basis.is_empty(), "Basis should not be empty");

        // The reduced basis should contain polynomials that allow solving
        // For a linear system with lex order, we expect triangular form
    }

    #[test]
    fn solve_linear_system() {
        // x + y = 3, x - y = 1 => x = 2, y = 1
        let vars = vec!["x".to_string(), "y".to_string()];
        let order = MonomialOrder::Lex;

        let f1 = MultiPoly::new(vars.clone(), vec![
            (1.0, Monomial { exponents: vec![1, 0] }),
            (1.0, Monomial { exponents: vec![0, 1] }),
            (-3.0, Monomial { exponents: vec![0, 0] }),
        ], order);

        let f2 = MultiPoly::new(vars.clone(), vec![
            (1.0, Monomial { exponents: vec![1, 0] }),
            (-1.0, Monomial { exponents: vec![0, 1] }),
            (-1.0, Monomial { exponents: vec![0, 0] }),
        ], order);

        let solutions = solve_polynomial_system(&[f1, f2], 1000).expect("Should find solutions");
        assert!(!solutions.is_empty(), "Should have at least one solution");

        // Find the solution close to (2, 1)
        let found = solutions.iter().any(|s| {
            s.len() == 2 && (s[0] - 2.0).abs() < 1e-6 && (s[1] - 1.0).abs() < 1e-6
        });
        assert!(found, "Should find solution (2, 1), got: {:?}", solutions);
    }

    #[test]
    fn solve_quadratic_system() {
        // x^2 + y^2 = 5, x + y = 3
        // Solutions: (1, 2) and (2, 1)
        let vars = vec!["x".to_string(), "y".to_string()];
        let order = MonomialOrder::Lex;

        let f1 = MultiPoly::new(vars.clone(), vec![
            (1.0, Monomial { exponents: vec![2, 0] }),
            (1.0, Monomial { exponents: vec![0, 2] }),
            (-5.0, Monomial { exponents: vec![0, 0] }),
        ], order);

        let f2 = MultiPoly::new(vars.clone(), vec![
            (1.0, Monomial { exponents: vec![1, 0] }),
            (1.0, Monomial { exponents: vec![0, 1] }),
            (-3.0, Monomial { exponents: vec![0, 0] }),
        ], order);

        let solutions = solve_polynomial_system(&[f1, f2], 10000).expect("Should find solutions");
        assert!(solutions.len() >= 2, "Should have 2 solutions, got {}", solutions.len());

        let has_1_2 = solutions.iter().any(|s| (s[0] - 1.0).abs() < 1e-4 && (s[1] - 2.0).abs() < 1e-4);
        let has_2_1 = solutions.iter().any(|s| (s[0] - 2.0).abs() < 1e-4 && (s[1] - 1.0).abs() < 1e-4);
        assert!(has_1_2, "Should find solution (1, 2), got: {:?}", solutions);
        assert!(has_2_1, "Should find solution (2, 1), got: {:?}", solutions);
    }

    #[test]
    fn groebner_inconsistent_system() {
        // x = 1, x = 2 => no solution
        let vars = vec!["x".to_string()];
        let order = MonomialOrder::Lex;

        let f1 = MultiPoly::new(vars.clone(), vec![
            (1.0, Monomial { exponents: vec![1] }),
            (-1.0, Monomial { exponents: vec![0] }),
        ], order);

        let f2 = MultiPoly::new(vars.clone(), vec![
            (1.0, Monomial { exponents: vec![1] }),
            (-2.0, Monomial { exponents: vec![0] }),
        ], order);

        let result = solve_polynomial_system(&[f1, f2], 1000);
        assert!(result.is_err(), "Inconsistent system should return error");
    }

    #[test]
    fn groebner_coprime_criterion() {
        // Test that coprime leading monomials trigger the first criterion
        let vars = vec!["x".to_string(), "y".to_string()];
        let order = MonomialOrder::GrevLex;

        // f = x^2 + 1, g = y^2 + 1 (LMs x^2 and y^2 are coprime)
        let f = MultiPoly::new(vars.clone(), vec![
            (1.0, Monomial { exponents: vec![2, 0] }),
            (1.0, Monomial { exponents: vec![0, 0] }),
        ], order);

        let g = MultiPoly::new(vars.clone(), vec![
            (1.0, Monomial { exponents: vec![0, 2] }),
            (1.0, Monomial { exponents: vec![0, 0] }),
        ], order);

        let result = groebner_basis(&[f, g], 1000);
        // Coprime criterion should handle this efficiently
        assert!(result.zero_reductions > 0, "Should have zero reductions from coprime criterion");
    }

    #[test]
    fn find_roots_quadratic() {
        // x^2 - 5x + 6 = (x-2)(x-3) => roots 2, 3
        let poly = Polynomial::new(vec![6.0, -5.0, 1.0]);
        let roots = find_real_roots_of_poly(&poly);
        assert_eq!(roots.len(), 2);
        assert!((roots[0] - 2.0).abs() < 1e-10);
        assert!((roots[1] - 3.0).abs() < 1e-10);
    }

    #[test]
    fn find_roots_cubic() {
        // x^3 - 6x^2 + 11x - 6 = (x-1)(x-2)(x-3) => roots 1, 2, 3
        let poly = Polynomial::new(vec![-6.0, 11.0, -6.0, 1.0]);
        let roots = find_real_roots_of_poly(&poly);
        assert_eq!(roots.len(), 3, "Expected 3 roots, got {:?}", roots);
        assert!((roots[0] - 1.0).abs() < 1e-6, "root[0]={}", roots[0]);
        assert!((roots[1] - 2.0).abs() < 1e-6, "root[1]={}", roots[1]);
        assert!((roots[2] - 3.0).abs() < 1e-6, "root[2]={}", roots[2]);
    }
}
