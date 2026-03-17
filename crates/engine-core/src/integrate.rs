//! Numerical integration (quadrature) algorithms.
//!
//! - [`gauss_kronrod`] — Adaptive Gauss-Kronrod G7-K15 quadrature
//! - [`clenshaw_curtis`] — Clenshaw-Curtis quadrature for smooth integrands
//! - [`monte_carlo`] — Monte Carlo quadrature for high-dimensional integrals

/// Result from a numerical integration method.
#[derive(Debug)]
pub struct IntegrationResult {
    pub value: f64,
    pub error_estimate: f64,
    pub evaluations: usize,
}

// ── Gauss-Kronrod G7-K15 ────────────────────────────────────────────────────

/// Gauss-Kronrod 15-point nodes (on [-1, 1]).
/// The 7 Gauss nodes are a subset at indices 1, 3, 5, 7, 9, 11, 13.
const GK15_NODES: [f64; 15] = [
    -0.991455371120813,
    -0.949107912342759,
    -0.864864423359769,
    -0.741531185599394,
    -0.586087235467691,
    -0.405845151377397,
    -0.207784955007898,
     0.0,
     0.207784955007898,
     0.405845151377397,
     0.586087235467691,
     0.741531185599394,
     0.864864423359769,
     0.949107912342759,
     0.991455371120813,
];

/// Kronrod 15-point weights.
const GK15_WEIGHTS_K: [f64; 15] = [
    0.022935322010529,
    0.063092092629979,
    0.104790010322250,
    0.140653259715525,
    0.169004726639268,
    0.190350578064785,
    0.204432940075298,
    0.209482141084728,
    0.204432940075298,
    0.190350578064785,
    0.169004726639268,
    0.140653259715525,
    0.104790010322250,
    0.063092092629979,
    0.022935322010529,
];

/// Gauss 7-point weights (embedded in the K15 scheme).
const GK15_WEIGHTS_G: [f64; 7] = [
    0.129484966168870,
    0.279705391489277,
    0.381830050505119,
    0.417959183673469,
    0.381830050505119,
    0.279705391489277,
    0.129484966168870,
];

/// Adaptive Gauss-Kronrod G7-K15 quadrature.
///
/// Integrates `f` over `[a, b]` using adaptive subdivision.
/// The error is estimated as |K15 - G7|. If the error exceeds
/// `tol`, the interval is split in half and each half is integrated
/// recursively.
pub fn gauss_kronrod<F: Fn(f64) -> f64>(
    f: &F,
    a: f64,
    b: f64,
    tol: f64,
    max_depth: usize,
) -> IntegrationResult {
    let mut total = 0.0;
    let mut total_error = 0.0;
    let mut total_evals = 0;
    gk_recursive(f, a, b, tol, max_depth, 0, &mut total, &mut total_error, &mut total_evals);
    IntegrationResult {
        value: total,
        error_estimate: total_error,
        evaluations: total_evals,
    }
}

fn gk_recursive<F: Fn(f64) -> f64>(
    f: &F,
    a: f64,
    b: f64,
    tol: f64,
    max_depth: usize,
    depth: usize,
    total: &mut f64,
    total_error: &mut f64,
    total_evals: &mut usize,
) {
    let mid = 0.5 * (a + b);
    let half_len = 0.5 * (b - a);

    // Evaluate at 15 Kronrod points
    let mut fvals = [0.0f64; 15];
    for (i, &node) in GK15_NODES.iter().enumerate() {
        fvals[i] = f(mid + half_len * node);
    }
    *total_evals += 15;

    // Kronrod estimate (15-point)
    let kronrod: f64 = fvals.iter().zip(GK15_WEIGHTS_K.iter()).map(|(&fv, &w)| fv * w).sum::<f64>() * half_len;

    // Gauss estimate (7-point, using odd indices: 1,3,5,7,9,11,13)
    let gauss: f64 = [1, 3, 5, 7, 9, 11, 13]
        .iter()
        .zip(GK15_WEIGHTS_G.iter())
        .map(|(&idx, &w)| fvals[idx] * w)
        .sum::<f64>() * half_len;

    let error = (kronrod - gauss).abs();

    if error < tol || depth >= max_depth {
        *total += kronrod;
        *total_error += error;
    } else {
        // Subdivide
        gk_recursive(f, a, mid, tol / 2.0, max_depth, depth + 1, total, total_error, total_evals);
        gk_recursive(f, mid, b, tol / 2.0, max_depth, depth + 1, total, total_error, total_evals);
    }
}

// ── Clenshaw-Curtis ─────────────────────────────────────────────────────────

/// Clenshaw-Curtis quadrature on `[a, b]` using `n` points.
///
/// Excellent for smooth integrands; converges exponentially fast for
/// analytic functions. Uses Chebyshev points and DCT-based weight
/// computation.
///
/// `n` should be odd for best results (default: 65).
pub fn clenshaw_curtis<F: Fn(f64) -> f64>(f: &F, a: f64, b: f64, n: usize) -> IntegrationResult {
    let n = n.max(3); // minimum 3 points
    let nm1 = n - 1;

    // Chebyshev points on [0, π]
    let mut fvals = Vec::with_capacity(n);
    let mid = 0.5 * (a + b);
    let half_len = 0.5 * (b - a);

    for k in 0..n {
        let theta = std::f64::consts::PI * k as f64 / nm1 as f64;
        let x = mid - half_len * theta.cos();
        fvals.push(f(x));
    }

    // Compute weights via DCT-I type approach
    let mut weights = vec![0.0f64; n];
    for k in 0..n {
        let mut wk = 0.0;
        for j in 0..=(nm1 / 2) {
            let theta = std::f64::consts::PI * k as f64 / nm1 as f64;
            let bj = if j == 0 || j == nm1 / 2 { 1.0 } else { 2.0 };
            let contrib = bj * (2.0 * j as f64 * theta).cos() / (1.0 - 4.0 * (j * j) as f64);
            wk += contrib;
        }
        let ck = if k == 0 || k == nm1 { 0.5 } else { 1.0 };
        weights[k] = ck * wk * 2.0 / nm1 as f64;
    }

    let value: f64 = fvals.iter().zip(weights.iter()).map(|(&fv, &w)| fv * w).sum::<f64>() * half_len;

    IntegrationResult {
        value,
        error_estimate: 0.0, // Clenshaw-Curtis doesn't provide a built-in error estimate
        evaluations: n,
    }
}

// ── Monte Carlo quadrature ──────────────────────────────────────────────────

/// Monte Carlo quadrature: estimate ∫f(x)dx over `[a, b]` using `n` random samples.
///
/// Uses a simple PRNG (xoshiro256++) seeded deterministically from `seed`.
/// Returns the integral estimate with a statistical error estimate (σ/√n).
pub fn monte_carlo<F: Fn(f64) -> f64>(
    f: &F,
    a: f64,
    b: f64,
    n: usize,
    seed: u64,
) -> IntegrationResult {
    let n = n.max(1);
    let length = b - a;

    // Simple xoshiro256++ PRNG
    let mut state = [seed, seed.wrapping_mul(6364136223846793005).wrapping_add(1),
                     seed.wrapping_mul(1442695040888963407).wrapping_add(3),
                     seed.wrapping_mul(2891336453).wrapping_add(7)];

    let mut sum = 0.0;
    let mut sum_sq = 0.0;

    for _ in 0..n {
        let u = xoshiro_next_f64(&mut state);
        let x = a + u * length;
        let fv = f(x);
        sum += fv;
        sum_sq += fv * fv;
    }

    let mean = sum / n as f64;
    let variance = sum_sq / n as f64 - mean * mean;
    let value = mean * length;
    let error_estimate = length * (variance / n as f64).sqrt();

    IntegrationResult {
        value,
        error_estimate,
        evaluations: n,
    }
}

/// Multi-dimensional Monte Carlo quadrature.
///
/// `bounds` is a slice of (lower, upper) pairs for each dimension.
/// `f` takes a slice of coordinates and returns a scalar.
pub fn monte_carlo_nd<F: Fn(&[f64]) -> f64>(
    f: &F,
    bounds: &[(f64, f64)],
    n: usize,
    seed: u64,
) -> IntegrationResult {
    let n = n.max(1);
    let dim = bounds.len();
    let volume: f64 = bounds.iter().map(|(lo, hi)| hi - lo).product();

    let mut state = [seed, seed.wrapping_mul(6364136223846793005).wrapping_add(1),
                     seed.wrapping_mul(1442695040888963407).wrapping_add(3),
                     seed.wrapping_mul(2891336453).wrapping_add(7)];

    let mut sum = 0.0;
    let mut sum_sq = 0.0;
    let mut point = vec![0.0; dim];

    for _ in 0..n {
        for d in 0..dim {
            let u = xoshiro_next_f64(&mut state);
            point[d] = bounds[d].0 + u * (bounds[d].1 - bounds[d].0);
        }
        let fv = f(&point);
        sum += fv;
        sum_sq += fv * fv;
    }

    let mean = sum / n as f64;
    let variance = sum_sq / n as f64 - mean * mean;
    let value = mean * volume;
    let error_estimate = volume * (variance / n as f64).sqrt();

    IntegrationResult {
        value,
        error_estimate,
        evaluations: n,
    }
}

/// Xoshiro256++ PRNG — produces f64 in [0, 1).
fn xoshiro_next_f64(state: &mut [u64; 4]) -> f64 {
    let result = state[0].wrapping_add(state[3]).rotate_left(23).wrapping_add(state[0]);
    let t = state[1] << 17;
    state[2] ^= state[0];
    state[3] ^= state[1];
    state[1] ^= state[2];
    state[0] ^= state[3];
    state[2] ^= t;
    state[3] = state[3].rotate_left(45);
    // Convert to [0, 1)
    (result >> 11) as f64 * (1.0 / (1u64 << 53) as f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gk_constant() {
        // ∫₀¹ 1 dx = 1
        let result = gauss_kronrod(&|_| 1.0, 0.0, 1.0, 1e-10, 10);
        assert!((result.value - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_gk_linear() {
        // ∫₀¹ x dx = 0.5
        let result = gauss_kronrod(&|x| x, 0.0, 1.0, 1e-10, 10);
        assert!((result.value - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_gk_quadratic() {
        // ∫₀¹ x² dx = 1/3
        let result = gauss_kronrod(&|x| x * x, 0.0, 1.0, 1e-10, 10);
        assert!((result.value - 1.0 / 3.0).abs() < 1e-10);
    }

    #[test]
    fn test_gk_sin() {
        // ∫₀^π sin(x) dx = 2
        let result = gauss_kronrod(&|x| x.sin(), 0.0, std::f64::consts::PI, 1e-10, 10);
        assert!((result.value - 2.0).abs() < 1e-10);
    }

    #[test]
    fn test_gk_exp() {
        // ∫₀¹ e^x dx = e - 1
        let result = gauss_kronrod(&|x| x.exp(), 0.0, 1.0, 1e-10, 10);
        assert!((result.value - (std::f64::consts::E - 1.0)).abs() < 1e-10);
    }

    #[test]
    fn test_cc_constant() {
        let result = clenshaw_curtis(&|_| 1.0, 0.0, 1.0, 33);
        assert!((result.value - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_cc_quadratic() {
        let result = clenshaw_curtis(&|x| x * x, 0.0, 1.0, 33);
        assert!((result.value - 1.0 / 3.0).abs() < 1e-10);
    }

    #[test]
    fn test_cc_sin() {
        let result = clenshaw_curtis(&|x| x.sin(), 0.0, std::f64::consts::PI, 65);
        assert!((result.value - 2.0).abs() < 1e-10);
    }

    #[test]
    fn test_mc_constant() {
        // ∫₀¹ 1 dx = 1
        let result = monte_carlo(&|_| 1.0, 0.0, 1.0, 10000, 42);
        assert!((result.value - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_mc_linear() {
        // ∫₀¹ x dx = 0.5
        let result = monte_carlo(&|x| x, 0.0, 1.0, 100000, 42);
        assert!((result.value - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_mc_nd_unit_cube() {
        // ∫∫∫₀¹ 1 dx dy dz = 1
        let bounds = vec![(0.0, 1.0), (0.0, 1.0), (0.0, 1.0)];
        let result = monte_carlo_nd(&|_| 1.0, &bounds, 10000, 42);
        assert!((result.value - 1.0).abs() < 0.05);
    }

    #[test]
    fn test_mc_has_error_estimate() {
        let result = monte_carlo(&|x| x * x, 0.0, 1.0, 10000, 42);
        assert!(result.error_estimate > 0.0);
        assert!(result.error_estimate < 0.1);
    }
}
