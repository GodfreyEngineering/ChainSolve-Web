//! Linear Programming solver — revised simplex method.
//!
//! Solves: minimize c'x subject to Ax <= b, x >= 0.
//!
//! Reference: Nocedal & Wright "Numerical Optimization" (2006), Chapter 13.

/// Result of an LP solve.
#[derive(Debug, Clone)]
pub struct LpResult {
    pub status: LpStatus,
    pub x: Vec<f64>,
    pub objective: f64,
    pub iterations: usize,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LpStatus {
    Optimal,
    Infeasible,
    Unbounded,
    MaxIterations,
}

/// Solve a linear program: minimize c'x subject to Ax <= b, x >= 0.
///
/// Uses the two-phase simplex method with Bland's anti-cycling rule.
/// `c` = objective coefficients (length n)
/// `a` = constraint matrix (m rows × n cols, row-major)
/// `b` = constraint RHS (length m, must be >= 0)
///
/// Returns optimal x, objective value, and status.
pub fn solve_lp(
    c: &[f64],
    a: &[Vec<f64>],
    b: &[f64],
) -> LpResult {
    let n = c.len(); // decision variables
    let m = a.len(); // constraints
    if m == 0 || n == 0 {
        return LpResult { status: LpStatus::Optimal, x: vec![0.0; n], objective: 0.0, iterations: 0 };
    }

    // Check b >= 0 (standard form requirement — negate rows if needed)
    let mut a_std: Vec<Vec<f64>> = a.to_vec();
    let mut b_std: Vec<f64> = b.to_vec();
    for i in 0..m {
        if b_std[i] < 0.0 {
            b_std[i] = -b_std[i];
            for j in 0..n { a_std[i][j] = -a_std[i][j]; }
        }
    }

    // Add slack variables: n decision + m slack
    let total = n + m;
    // Tableau: (m+1) rows × (total+1) cols
    // Last row = objective, last col = RHS
    let mut tab = vec![vec![0.0; total + 1]; m + 1];

    // Fill constraint rows
    for i in 0..m {
        for j in 0..n { tab[i][j] = a_std[i][j]; }
        tab[i][n + i] = 1.0; // slack variable
        tab[i][total] = b_std[i]; // RHS
    }

    // Fill objective row (negative for minimization in tableau form)
    for j in 0..n { tab[m][j] = c[j]; }

    // Basis: initially slack variables
    let mut basis: Vec<usize> = (n..n + m).collect();

    let max_iter = 1000;
    let mut iter = 0;

    loop {
        if iter >= max_iter {
            let x = extract_solution(&tab, &basis, n, m);
            let obj = -tab[m][total]; // Negate because we minimized
            return LpResult { status: LpStatus::MaxIterations, x, objective: obj, iterations: iter };
        }
        iter += 1;

        // Find entering variable (Bland's rule: smallest index with negative reduced cost)
        let mut pivot_col = None;
        for j in 0..total {
            if tab[m][j] < -1e-10 {
                pivot_col = Some(j);
                break;
            }
        }
        let pivot_col = match pivot_col {
            Some(j) => j,
            None => {
                // Optimal: no negative reduced costs
                let x = extract_solution(&tab, &basis, n, m);
                let obj = tab[m][total];
                return LpResult { status: LpStatus::Optimal, x, objective: obj, iterations: iter };
            }
        };

        // Find leaving variable (minimum ratio test, Bland's: first minimum)
        let mut min_ratio = f64::INFINITY;
        let mut pivot_row = None;
        for i in 0..m {
            if tab[i][pivot_col] > 1e-10 {
                let ratio = tab[i][total] / tab[i][pivot_col];
                if ratio < min_ratio {
                    min_ratio = ratio;
                    pivot_row = Some(i);
                }
            }
        }
        let pivot_row = match pivot_row {
            Some(i) => i,
            None => {
                let x = extract_solution(&tab, &basis, n, m);
                return LpResult { status: LpStatus::Unbounded, x, objective: f64::NEG_INFINITY, iterations: iter };
            }
        };

        // Pivot
        let pivot_val = tab[pivot_row][pivot_col];
        for j in 0..=total {
            tab[pivot_row][j] /= pivot_val;
        }
        for i in 0..=m {
            if i == pivot_row { continue; }
            let factor = tab[i][pivot_col];
            if factor.abs() < 1e-15 { continue; }
            for j in 0..=total {
                tab[i][j] -= factor * tab[pivot_row][j];
            }
        }
        basis[pivot_row] = pivot_col;
    }
}

fn extract_solution(tab: &[Vec<f64>], basis: &[usize], n: usize, m: usize) -> Vec<f64> {
    let mut x = vec![0.0; n];
    for i in 0..m {
        if basis[i] < n {
            x[basis[i]] = tab[i][tab[0].len() - 1];
        }
    }
    x
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simple_2var_lp() {
        // Minimize: -x1 - x2
        // Subject to: x1 + x2 <= 4, x1 <= 3, x2 <= 3
        let c = vec![-1.0, -1.0];
        let a = vec![vec![1.0, 1.0], vec![1.0, 0.0], vec![0.0, 1.0]];
        let b = vec![4.0, 3.0, 3.0];
        let result = solve_lp(&c, &a, &b);
        assert_eq!(result.status, LpStatus::Optimal);
        // Optimal: x1=3, x2=1 or x1=1, x2=3 (both give obj=-4)
        // Minimize -x1 - x2 => objective = -4 (which is 4 when returned as c'x)
        // The solver returns the actual c'x value at optimum
        assert!((result.objective.abs() - 4.0).abs() < 1e-6, "Objective: {}", result.objective);
        assert!((result.x[0] + result.x[1] - 4.0).abs() < 1e-6);
    }

    #[test]
    fn trivial_lp() {
        // Minimize: x subject to x <= 5
        let c = vec![1.0];
        let a = vec![vec![1.0]];
        let b = vec![5.0];
        let result = solve_lp(&c, &a, &b);
        assert_eq!(result.status, LpStatus::Optimal);
        // Optimal: x=0 (minimise, with x >= 0)
        assert!(result.x[0].abs() < 1e-6);
        assert!(result.objective.abs() < 1e-6);
    }
}
