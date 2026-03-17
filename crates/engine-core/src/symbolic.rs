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
}
