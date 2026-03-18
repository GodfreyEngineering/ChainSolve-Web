//! Simple math expression evaluator for custom function blocks (H5-1).
//!
//! Supports:
//! - Arithmetic: +, -, *, /, ^ (power)
//! - Unary minus: -x
//! - Parentheses: (expr)
//! - Named variables: a, b, x1, rate, etc.
//! - Numeric literals: 3.14, 1e-3, .5
//! - Built-in functions: sqrt, abs, sin, cos, tan, asin, acos, atan,
//!   ln, log10, exp, ceil, floor, round, min, max
//! - Constants: pi, e
//!
//! Grammar (recursive descent):
//!   expr     = term (('+' | '-') term)*
//!   term     = power (('*' | '/') power)*
//!   power    = unary ('^' unary)*
//!   unary    = '-' unary | call
//!   call     = IDENT '(' args ')' | atom
//!   atom     = NUMBER | IDENT | '(' expr ')'
//!   args     = expr (',' expr)*

use std::collections::HashMap;

// ── Compiled Expression AST (1.29) ───────────────────────────────────────────

/// AST node for a compiled expression. Avoids re-parsing on repeated evaluation.
#[derive(Debug, Clone)]
pub enum ExprNode {
    Number(f64),
    Variable(String),
    Constant(f64), // pi, e — resolved at compile time
    BinOp { op: BinOpKind, left: Box<ExprNode>, right: Box<ExprNode> },
    UnaryMinus(Box<ExprNode>),
    FnCall { name: FnKind, args: Vec<ExprNode> },
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BinOpKind { Add, Sub, Mul, Div, Pow }

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FnKind {
    Sqrt, Abs, Sin, Cos, Tan, Asin, Acos, Atan, Ln, Log10, Exp,
    Ceil, Floor, Round, Min, Max, Pow2, Atan2,
}

/// A pre-parsed expression that can be evaluated repeatedly without re-parsing.
///
/// Use `compile()` once, then call `eval()` in a loop for maximum performance.
#[derive(Debug, Clone)]
pub struct CompiledExpr {
    root: ExprNode,
}

impl CompiledExpr {
    /// Evaluate the compiled expression with the given variable bindings.
    pub fn eval(&self, vars: &HashMap<String, f64>) -> Result<f64, String> {
        eval_node(&self.root, vars)
    }
}

/// Compile a formula string into a `CompiledExpr` AST.
///
/// Returns an error if the formula cannot be parsed. After compilation,
/// calling `eval()` is significantly faster than `eval_expr()` for repeated
/// evaluations (no tokenisation/parsing overhead).
pub fn compile(formula: &str) -> Result<CompiledExpr, String> {
    let tokens = tokenize(formula)?;
    let mut parser = AstParser { tokens: &tokens, pos: 0 };
    let root = parser.parse_expr()?;
    if parser.pos < parser.tokens.len() {
        return Err(format!("Unexpected token at position {}", parser.pos));
    }
    Ok(CompiledExpr { root })
}

fn eval_node(node: &ExprNode, vars: &HashMap<String, f64>) -> Result<f64, String> {
    match node {
        ExprNode::Number(n) => Ok(*n),
        ExprNode::Constant(c) => Ok(*c),
        ExprNode::Variable(name) => vars.get(name.as_str())
            .copied()
            .ok_or_else(|| format!("Unknown variable: {name}")),
        ExprNode::UnaryMinus(inner) => Ok(-eval_node(inner, vars)?),
        ExprNode::BinOp { op, left, right } => {
            let l = eval_node(left, vars)?;
            let r = eval_node(right, vars)?;
            Ok(match op {
                BinOpKind::Add => l + r,
                BinOpKind::Sub => l - r,
                BinOpKind::Mul => l * r,
                BinOpKind::Div => l / r,
                BinOpKind::Pow => l.powf(r),
            })
        }
        ExprNode::FnCall { name, args } => {
            let vals: Result<Vec<f64>, String> = args.iter().map(|a| eval_node(a, vars)).collect();
            let vals = vals?;
            Ok(match name {
                FnKind::Sqrt  => vals[0].sqrt(),
                FnKind::Abs   => vals[0].abs(),
                FnKind::Sin   => vals[0].sin(),
                FnKind::Cos   => vals[0].cos(),
                FnKind::Tan   => vals[0].tan(),
                FnKind::Asin  => vals[0].asin(),
                FnKind::Acos  => vals[0].acos(),
                FnKind::Atan  => vals[0].atan(),
                FnKind::Ln    => vals[0].ln(),
                FnKind::Log10 => vals[0].log10(),
                FnKind::Exp   => vals[0].exp(),
                FnKind::Ceil  => vals[0].ceil(),
                FnKind::Floor => vals[0].floor(),
                FnKind::Round => vals[0].round(),
                FnKind::Min   => vals[0].min(vals[1]),
                FnKind::Max   => vals[0].max(vals[1]),
                FnKind::Pow2  => vals[0].powf(vals[1]),
                FnKind::Atan2 => vals[0].atan2(vals[1]),
            })
        }
    }
}

/// AST-building parser (compile-time, not eval-time).
struct AstParser<'a> {
    tokens: &'a [Token],
    pos: usize,
}

impl<'a> AstParser<'a> {
    fn peek(&self) -> Option<&Token> { self.tokens.get(self.pos) }
    fn advance(&mut self) -> Option<&Token> {
        let tok = self.tokens.get(self.pos);
        if tok.is_some() { self.pos += 1; }
        tok
    }
    fn expect(&mut self, expected: &Token) -> Result<(), String> {
        match self.advance() {
            Some(tok) if tok == expected => Ok(()),
            Some(tok) => Err(format!("Expected {:?}, got {:?}", expected, tok)),
            None => Err(format!("Expected {:?}, got end of input", expected)),
        }
    }

    fn parse_expr(&mut self) -> Result<ExprNode, String> {
        let mut left = self.parse_term()?;
        while let Some(tok) = self.peek() {
            match tok {
                Token::Plus  => { self.advance(); left = ExprNode::BinOp { op: BinOpKind::Add, left: Box::new(left), right: Box::new(self.parse_term()?) }; }
                Token::Minus => { self.advance(); left = ExprNode::BinOp { op: BinOpKind::Sub, left: Box::new(left), right: Box::new(self.parse_term()?) }; }
                _ => break,
            }
        }
        Ok(left)
    }

    fn parse_term(&mut self) -> Result<ExprNode, String> {
        let mut left = self.parse_power()?;
        while let Some(tok) = self.peek() {
            match tok {
                Token::Star  => { self.advance(); left = ExprNode::BinOp { op: BinOpKind::Mul, left: Box::new(left), right: Box::new(self.parse_power()?) }; }
                Token::Slash => { self.advance(); left = ExprNode::BinOp { op: BinOpKind::Div, left: Box::new(left), right: Box::new(self.parse_power()?) }; }
                _ => break,
            }
        }
        Ok(left)
    }

    fn parse_power(&mut self) -> Result<ExprNode, String> {
        let base = self.parse_unary()?;
        if let Some(Token::Caret) = self.peek() {
            self.advance();
            let exp = self.parse_power()?;
            Ok(ExprNode::BinOp { op: BinOpKind::Pow, left: Box::new(base), right: Box::new(exp) })
        } else {
            Ok(base)
        }
    }

    fn parse_unary(&mut self) -> Result<ExprNode, String> {
        if let Some(Token::Minus) = self.peek() {
            self.advance();
            Ok(ExprNode::UnaryMinus(Box::new(self.parse_unary()?)))
        } else {
            self.parse_call()
        }
    }

    fn parse_call(&mut self) -> Result<ExprNode, String> {
        if let Some(Token::Ident(name)) = self.peek() {
            let name = name.clone();
            if self.pos + 1 < self.tokens.len() && self.tokens[self.pos + 1] == Token::LParen {
                self.advance(); // consume ident
                self.advance(); // consume '('
                let mut args = vec![self.parse_expr()?];
                while let Some(Token::Comma) = self.peek() {
                    self.advance();
                    args.push(self.parse_expr()?);
                }
                self.expect(&Token::RParen)?;
                let kind = match name.as_str() {
                    "sqrt"  => FnKind::Sqrt,
                    "abs"   => FnKind::Abs,
                    "sin"   => FnKind::Sin,
                    "cos"   => FnKind::Cos,
                    "tan"   => FnKind::Tan,
                    "asin"  => FnKind::Asin,
                    "acos"  => FnKind::Acos,
                    "atan"  => FnKind::Atan,
                    "ln"    => FnKind::Ln,
                    "log" | "log10" => FnKind::Log10,
                    "exp"   => FnKind::Exp,
                    "ceil"  => FnKind::Ceil,
                    "floor" => FnKind::Floor,
                    "round" => FnKind::Round,
                    "min"   => FnKind::Min,
                    "max"   => FnKind::Max,
                    "pow"   => FnKind::Pow2,
                    "atan2" => FnKind::Atan2,
                    _ => return Err(format!("Unknown function: {}", name)),
                };
                return Ok(ExprNode::FnCall { name: kind, args });
            }
        }
        self.parse_atom()
    }

    fn parse_atom(&mut self) -> Result<ExprNode, String> {
        let tok = self.advance().cloned();
        match tok {
            Some(Token::Number(n)) => Ok(ExprNode::Number(n)),
            Some(Token::Ident(ref name)) => match name.as_str() {
                "pi" | "PI" => Ok(ExprNode::Constant(std::f64::consts::PI)),
                "e" | "E"   => Ok(ExprNode::Constant(std::f64::consts::E)),
                _ => Ok(ExprNode::Variable(name.clone())),
            },
            Some(Token::LParen) => {
                let val = self.parse_expr()?;
                self.expect(&Token::RParen)?;
                Ok(val)
            }
            Some(ref tok) => Err(format!("Unexpected token: {:?}", tok)),
            None => Err("Unexpected end of expression".to_string()),
        }
    }
}

/// Evaluate a formula string with the given variable bindings.
/// Returns f64 (may be NaN or Inf for invalid operations).
pub fn eval_expr(formula: &str, vars: &HashMap<String, f64>) -> Result<f64, String> {
    let tokens = tokenize(formula)?;
    let mut parser = Parser {
        tokens: &tokens,
        pos: 0,
        vars,
    };
    let result = parser.parse_expr()?;
    if parser.pos < parser.tokens.len() {
        return Err(format!(
            "Unexpected token at position {}",
            parser.pos
        ));
    }
    Ok(result)
}

// ── Tokenizer ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq)]
enum Token {
    Number(f64),
    Ident(String),
    Plus,
    Minus,
    Star,
    Slash,
    Caret,
    LParen,
    RParen,
    Comma,
}

fn tokenize(input: &str) -> Result<Vec<Token>, String> {
    let mut tokens = Vec::new();
    let chars: Vec<char> = input.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        let c = chars[i];
        match c {
            ' ' | '\t' | '\n' | '\r' => i += 1,
            '+' => { tokens.push(Token::Plus); i += 1; }
            '-' => { tokens.push(Token::Minus); i += 1; }
            '*' => { tokens.push(Token::Star); i += 1; }
            '/' => { tokens.push(Token::Slash); i += 1; }
            '^' => { tokens.push(Token::Caret); i += 1; }
            '(' => { tokens.push(Token::LParen); i += 1; }
            ')' => { tokens.push(Token::RParen); i += 1; }
            ',' => { tokens.push(Token::Comma); i += 1; }
            '0'..='9' | '.' => {
                let start = i;
                while i < chars.len() && (chars[i].is_ascii_digit() || chars[i] == '.') {
                    i += 1;
                }
                // Handle scientific notation: e.g. 1e-3, 2.5E+10
                if i < chars.len() && (chars[i] == 'e' || chars[i] == 'E') {
                    i += 1;
                    if i < chars.len() && (chars[i] == '+' || chars[i] == '-') {
                        i += 1;
                    }
                    while i < chars.len() && chars[i].is_ascii_digit() {
                        i += 1;
                    }
                }
                let s: String = chars[start..i].iter().collect();
                let num = s.parse::<f64>().map_err(|_| format!("Invalid number: {}", s))?;
                tokens.push(Token::Number(num));
            }
            'a'..='z' | 'A'..='Z' | '_' => {
                let start = i;
                while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_') {
                    i += 1;
                }
                let s: String = chars[start..i].iter().collect();
                tokens.push(Token::Ident(s));
            }
            _ => return Err(format!("Unexpected character: '{}'", c)),
        }
    }

    Ok(tokens)
}

// ── Parser ───────────────────────────────────────────────────────────────────

struct Parser<'a> {
    tokens: &'a [Token],
    pos: usize,
    vars: &'a HashMap<String, f64>,
}

impl<'a> Parser<'a> {
    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.pos)
    }

    fn advance(&mut self) -> Option<&Token> {
        let tok = self.tokens.get(self.pos);
        if tok.is_some() {
            self.pos += 1;
        }
        tok
    }

    fn expect(&mut self, expected: &Token) -> Result<(), String> {
        match self.advance() {
            Some(tok) if tok == expected => Ok(()),
            Some(tok) => Err(format!("Expected {:?}, got {:?}", expected, tok)),
            None => Err(format!("Expected {:?}, got end of input", expected)),
        }
    }

    // expr = term (('+' | '-') term)*
    fn parse_expr(&mut self) -> Result<f64, String> {
        let mut left = self.parse_term()?;
        while let Some(tok) = self.peek() {
            match tok {
                Token::Plus => {
                    self.advance();
                    left += self.parse_term()?;
                }
                Token::Minus => {
                    self.advance();
                    left -= self.parse_term()?;
                }
                _ => break,
            }
        }
        Ok(left)
    }

    // term = power (('*' | '/') power)*
    fn parse_term(&mut self) -> Result<f64, String> {
        let mut left = self.parse_power()?;
        while let Some(tok) = self.peek() {
            match tok {
                Token::Star => {
                    self.advance();
                    left *= self.parse_power()?;
                }
                Token::Slash => {
                    self.advance();
                    left /= self.parse_power()?;
                }
                _ => break,
            }
        }
        Ok(left)
    }

    // power = unary ('^' unary)*   (right-associative)
    fn parse_power(&mut self) -> Result<f64, String> {
        let base = self.parse_unary()?;
        if let Some(Token::Caret) = self.peek() {
            self.advance();
            let exp = self.parse_power()?; // right-associative recursion
            Ok(base.powf(exp))
        } else {
            Ok(base)
        }
    }

    // unary = '-' unary | call
    fn parse_unary(&mut self) -> Result<f64, String> {
        if let Some(Token::Minus) = self.peek() {
            self.advance();
            Ok(-self.parse_unary()?)
        } else {
            self.parse_call()
        }
    }

    // call = IDENT '(' args ')' | atom
    fn parse_call(&mut self) -> Result<f64, String> {
        if let Some(Token::Ident(name)) = self.peek() {
            let name = name.clone();
            // Check if next token is '(' → function call
            if self.pos + 1 < self.tokens.len() && self.tokens[self.pos + 1] == Token::LParen {
                self.advance(); // consume ident
                self.advance(); // consume '('
                let mut args = vec![self.parse_expr()?];
                while let Some(Token::Comma) = self.peek() {
                    self.advance();
                    args.push(self.parse_expr()?);
                }
                self.expect(&Token::RParen)?;
                return self.call_function(&name, &args);
            }
        }
        self.parse_atom()
    }

    // atom = NUMBER | IDENT | '(' expr ')'
    fn parse_atom(&mut self) -> Result<f64, String> {
        let tok = self.advance().cloned();
        match tok {
            Some(Token::Number(n)) => Ok(n),
            Some(Token::Ident(ref name)) => {
                // Built-in constants
                match name.as_str() {
                    "pi" | "PI" => Ok(std::f64::consts::PI),
                    "e" | "E" => Ok(std::f64::consts::E),
                    _ => {
                        self.vars
                            .get(name.as_str())
                            .copied()
                            .ok_or_else(|| format!("Unknown variable: {}", name))
                    }
                }
            }
            Some(Token::LParen) => {
                let val = self.parse_expr()?;
                self.expect(&Token::RParen)?;
                Ok(val)
            }
            Some(ref tok) => Err(format!("Unexpected token: {:?}", tok)),
            None => Err("Unexpected end of expression".to_string()),
        }
    }

    fn call_function(&self, name: &str, args: &[f64]) -> Result<f64, String> {
        match name {
            // 1-arg functions
            "sqrt" => { check_arity(name, args, 1)?; Ok(args[0].sqrt()) }
            "abs" => { check_arity(name, args, 1)?; Ok(args[0].abs()) }
            "sin" => { check_arity(name, args, 1)?; Ok(args[0].sin()) }
            "cos" => { check_arity(name, args, 1)?; Ok(args[0].cos()) }
            "tan" => { check_arity(name, args, 1)?; Ok(args[0].tan()) }
            "asin" => { check_arity(name, args, 1)?; Ok(args[0].asin()) }
            "acos" => { check_arity(name, args, 1)?; Ok(args[0].acos()) }
            "atan" => { check_arity(name, args, 1)?; Ok(args[0].atan()) }
            "ln" => { check_arity(name, args, 1)?; Ok(args[0].ln()) }
            "log" | "log10" => { check_arity(name, args, 1)?; Ok(args[0].log10()) }
            "exp" => { check_arity(name, args, 1)?; Ok(args[0].exp()) }
            "ceil" => { check_arity(name, args, 1)?; Ok(args[0].ceil()) }
            "floor" => { check_arity(name, args, 1)?; Ok(args[0].floor()) }
            "round" => { check_arity(name, args, 1)?; Ok(args[0].round()) }
            // 2-arg functions
            "min" => { check_arity(name, args, 2)?; Ok(args[0].min(args[1])) }
            "max" => { check_arity(name, args, 2)?; Ok(args[0].max(args[1])) }
            "pow" => { check_arity(name, args, 2)?; Ok(args[0].powf(args[1])) }
            "atan2" => { check_arity(name, args, 2)?; Ok(args[0].atan2(args[1])) }
            _ => Err(format!("Unknown function: {}", name)),
        }
    }
}

fn check_arity(name: &str, args: &[f64], expected: usize) -> Result<(), String> {
    if args.len() != expected {
        Err(format!(
            "{}() expects {} argument(s), got {}",
            name,
            expected,
            args.len()
        ))
    } else {
        Ok(())
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn vars(pairs: &[(&str, f64)]) -> HashMap<String, f64> {
        pairs.iter().map(|(k, v)| (k.to_string(), *v)).collect()
    }

    #[test]
    fn basic_arithmetic() {
        let v = HashMap::new();
        assert!((eval_expr("2 + 3", &v).unwrap() - 5.0).abs() < 1e-10);
        assert!((eval_expr("10 - 4", &v).unwrap() - 6.0).abs() < 1e-10);
        assert!((eval_expr("3 * 7", &v).unwrap() - 21.0).abs() < 1e-10);
        assert!((eval_expr("15 / 4", &v).unwrap() - 3.75).abs() < 1e-10);
    }

    #[test]
    fn operator_precedence() {
        let v = HashMap::new();
        assert!((eval_expr("2 + 3 * 4", &v).unwrap() - 14.0).abs() < 1e-10);
        assert!((eval_expr("(2 + 3) * 4", &v).unwrap() - 20.0).abs() < 1e-10);
    }

    #[test]
    fn power_right_associative() {
        let v = HashMap::new();
        // 2^3^2 = 2^(3^2) = 2^9 = 512
        assert!((eval_expr("2^3^2", &v).unwrap() - 512.0).abs() < 1e-10);
    }

    #[test]
    fn unary_minus() {
        let v = HashMap::new();
        assert!((eval_expr("-5", &v).unwrap() - (-5.0)).abs() < 1e-10);
        assert!((eval_expr("3 + -2", &v).unwrap() - 1.0).abs() < 1e-10);
    }

    #[test]
    fn variables() {
        let v = vars(&[("x", 3.0), ("y", 4.0)]);
        assert!((eval_expr("x + y", &v).unwrap() - 7.0).abs() < 1e-10);
        assert!((eval_expr("x * y - 2", &v).unwrap() - 10.0).abs() < 1e-10);
    }

    #[test]
    fn built_in_constants() {
        let v = HashMap::new();
        assert!((eval_expr("pi", &v).unwrap() - std::f64::consts::PI).abs() < 1e-10);
        assert!((eval_expr("e", &v).unwrap() - std::f64::consts::E).abs() < 1e-10);
    }

    #[test]
    fn function_calls() {
        let v = HashMap::new();
        assert!((eval_expr("sqrt(9)", &v).unwrap() - 3.0).abs() < 1e-10);
        assert!((eval_expr("abs(-7)", &v).unwrap() - 7.0).abs() < 1e-10);
        assert!((eval_expr("sin(0)", &v).unwrap()).abs() < 1e-10);
        assert!((eval_expr("cos(0)", &v).unwrap() - 1.0).abs() < 1e-10);
        assert!((eval_expr("max(3, 7)", &v).unwrap() - 7.0).abs() < 1e-10);
        assert!((eval_expr("min(3, 7)", &v).unwrap() - 3.0).abs() < 1e-10);
    }

    #[test]
    fn nested_functions() {
        let v = HashMap::new();
        assert!((eval_expr("sqrt(abs(-16))", &v).unwrap() - 4.0).abs() < 1e-10);
    }

    #[test]
    fn complex_formula() {
        let v = vars(&[("m", 10.0), ("a", 9.81)]);
        // F = m * a
        assert!((eval_expr("m * a", &v).unwrap() - 98.1).abs() < 1e-10);
    }

    #[test]
    fn scientific_notation() {
        let v = HashMap::new();
        assert!((eval_expr("1e3", &v).unwrap() - 1000.0).abs() < 1e-10);
        assert!((eval_expr("2.5e-2", &v).unwrap() - 0.025).abs() < 1e-10);
    }

    #[test]
    fn division_by_zero() {
        let v = HashMap::new();
        let result = eval_expr("1 / 0", &v).unwrap();
        assert!(result.is_infinite());
    }

    #[test]
    fn unknown_variable() {
        let v = HashMap::new();
        assert!(eval_expr("x + 1", &v).is_err());
    }

    #[test]
    fn unknown_function() {
        let v = HashMap::new();
        assert!(eval_expr("foo(1)", &v).is_err());
    }

    #[test]
    fn empty_expression() {
        let v = HashMap::new();
        assert!(eval_expr("", &v).is_err());
    }

    #[test]
    fn quadratic_formula() {
        // x = (-b + sqrt(b^2 - 4*a*c)) / (2*a) for a=1, b=-3, c=2
        // roots: 2, 1 → positive root = 2
        let v = vars(&[("a", 1.0), ("b", -3.0), ("c", 2.0)]);
        let result = eval_expr("(-b + sqrt(b^2 - 4*a*c)) / (2*a)", &v).unwrap();
        assert!((result - 2.0).abs() < 1e-10);
    }
}
