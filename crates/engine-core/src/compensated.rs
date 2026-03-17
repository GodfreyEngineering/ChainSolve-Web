//! Compensated arithmetic algorithms for improved numerical accuracy.
//!
//! These replace naive summation/dot-product with error-compensating variants
//! that achieve near-full f64 precision even for ill-conditioned inputs.
//!
//! References:
//! - Ogita, Rump, Oishi "Accurate Sum and Dot Product" (2005)
//! - Kahan, "Pracniques: Further Remarks on Reducing Truncation Errors" (1965)
//! - Neumaier, "Rundungsfehleranalyse einiger Verfahren zur Summation..." (1974)

/// Neumaier compensated summation — strictly better than Kahan's original.
///
/// Handles both |sum| >> |x| and |x| >> |sum| orderings correctly.
/// For `sum(1e16, 1, -1e16)`, this returns exactly 1.0 (naive gives 0.0).
pub fn compensated_sum(iter: impl Iterator<Item = f64>) -> f64 {
    let mut sum = 0.0_f64;
    let mut comp = 0.0_f64;
    for x in iter {
        let t = sum + x;
        comp += if sum.abs() >= x.abs() {
            (sum - t) + x
        } else {
            (x - t) + sum
        };
        sum = t;
    }
    sum + comp
}

/// Error-free transformation for multiplication: a*b = p + e exactly.
///
/// Uses Dekker's algorithm (requires IEEE 754 arithmetic).
/// Returns (product, error) where product + error = a * b exactly.
fn two_product(a: f64, b: f64) -> (f64, f64) {
    let p = a * b;
    let e = a.mul_add(b, -p); // fma: a*b - p without intermediate rounding
    (p, e)
}

/// Compensated dot product using error-free transformations.
///
/// Achieves near-full precision for dot products of vectors where naive
/// computation suffers from catastrophic cancellation.
///
/// Based on Ogita-Rump-Oishi (2005) Algorithm 5.3.
pub fn compensated_dot(a: &[f64], b: &[f64]) -> f64 {
    assert_eq!(a.len(), b.len(), "Dot product vectors must have same length");
    let n = a.len();
    if n == 0 {
        return 0.0;
    }

    let (mut p, mut s) = two_product(a[0], b[0]);
    let mut comp = 0.0_f64;

    for i in 1..n {
        let (pi, ei) = two_product(a[i], b[i]);
        let t = p + pi;
        let z = if p.abs() >= pi.abs() {
            (p - t) + pi
        } else {
            (pi - t) + p
        };
        comp += z + ei + s;
        p = t;
        s = ei; // carry forward the product error
    }

    p + (comp + s)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sum_catastrophic_cancellation() {
        // Classic test: 1e16 + 1 - 1e16 should be 1, not 0
        let result = compensated_sum([1e16, 1.0, -1e16].into_iter());
        assert_eq!(result, 1.0, "Expected 1.0, got {}", result);
    }

    #[test]
    fn sum_basic() {
        let result = compensated_sum([1.0, 2.0, 3.0, 4.0, 5.0].into_iter());
        assert_eq!(result, 15.0);
    }

    #[test]
    fn sum_empty() {
        let result = compensated_sum(std::iter::empty());
        assert_eq!(result, 0.0);
    }

    #[test]
    fn sum_many_small_values() {
        // Sum of 1000 copies of 0.1 — naive gives ~99.9999...998
        let result = compensated_sum(std::iter::repeat(0.1).take(1000));
        assert!(
            (result - 100.0).abs() < 1e-10,
            "Expected ~100.0, got {}",
            result
        );
    }

    #[test]
    fn dot_basic() {
        let a = [1.0, 2.0, 3.0];
        let b = [4.0, 5.0, 6.0];
        let result = compensated_dot(&a, &b);
        assert_eq!(result, 32.0); // 4 + 10 + 18
    }

    #[test]
    fn dot_empty() {
        let result = compensated_dot(&[], &[]);
        assert_eq!(result, 0.0);
    }

    #[test]
    fn dot_orthogonal() {
        let a = [1.0, 0.0];
        let b = [0.0, 1.0];
        let result = compensated_dot(&a, &b);
        assert_eq!(result, 0.0);
    }
}
