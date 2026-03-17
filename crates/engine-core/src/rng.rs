//! Random number generation and quasi-random sequences.
//!
//! - [`Xoshiro256`] — Xoshiro256++ PRNG (deterministic with seed control)
//! - [`latin_hypercube`] — Latin Hypercube Sampling for stratified random sampling
//! - [`sobol_points`] — Sobol/Van der Corput quasi-random low-discrepancy sequence
//! - [`halton_points`] — Halton quasi-random sequence using co-prime bases

// ── Xoshiro256++ ────────────────────────────────────────────────────────────

/// Xoshiro256++ pseudo-random number generator.
///
/// Fast, high-quality PRNG with 256-bit state. Deterministic given a seed.
pub struct Xoshiro256 {
    state: [u64; 4],
}

impl Xoshiro256 {
    /// Create a new PRNG seeded with `seed`.
    /// Uses SplitMix64 to expand the seed into 256-bit state.
    pub fn new(seed: u64) -> Self {
        let mut s = seed;
        let mut state = [0u64; 4];
        for slot in &mut state {
            s = s.wrapping_add(0x9e3779b97f4a7c15);
            let mut z = s;
            z = (z ^ (z >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
            z = (z ^ (z >> 27)).wrapping_mul(0x94d049bb133111eb);
            *slot = z ^ (z >> 31);
        }
        Self { state }
    }

    /// Generate next u64 value.
    pub fn next_u64(&mut self) -> u64 {
        let result = self.state[0]
            .wrapping_add(self.state[3])
            .rotate_left(23)
            .wrapping_add(self.state[0]);
        let t = self.state[1] << 17;
        self.state[2] ^= self.state[0];
        self.state[3] ^= self.state[1];
        self.state[1] ^= self.state[2];
        self.state[0] ^= self.state[3];
        self.state[2] ^= t;
        self.state[3] = self.state[3].rotate_left(45);
        result
    }

    /// Generate a uniform f64 in [0, 1).
    pub fn next_f64(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 * (1.0 / (1u64 << 53) as f64)
    }

    /// Generate a uniform f64 in [lo, hi).
    pub fn next_range(&mut self, lo: f64, hi: f64) -> f64 {
        lo + self.next_f64() * (hi - lo)
    }

    /// Fill a vector with `n` uniform random f64 values in [0, 1).
    pub fn fill_uniform(&mut self, n: usize) -> Vec<f64> {
        (0..n).map(|_| self.next_f64()).collect()
    }

    /// Generate a standard normal variate using Box-Muller transform.
    pub fn next_gaussian(&mut self) -> f64 {
        let u1 = self.next_f64().max(f64::MIN_POSITIVE);
        let u2 = self.next_f64();
        (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos()
    }
}

// ── Latin Hypercube Sampling ────────────────────────────────────────────────

/// Generate an `n_samples × n_dims` Latin Hypercube Sample.
///
/// Each dimension is stratified into `n_samples` equal bins, and exactly one
/// sample falls in each bin. Returns a flat row-major `Vec<Vec<f64>>` where
/// each inner vec has `n_dims` values in [0, 1).
pub fn latin_hypercube(n_samples: usize, n_dims: usize, seed: u64) -> Vec<Vec<f64>> {
    if n_samples == 0 || n_dims == 0 {
        return vec![];
    }
    let mut rng = Xoshiro256::new(seed);

    // Create a permutation for each dimension
    let mut perms: Vec<Vec<usize>> = Vec::with_capacity(n_dims);
    for _ in 0..n_dims {
        let mut perm: Vec<usize> = (0..n_samples).collect();
        // Fisher-Yates shuffle
        for i in (1..n_samples).rev() {
            let j = (rng.next_u64() as usize) % (i + 1);
            perm.swap(i, j);
        }
        perms.push(perm);
    }

    let mut samples = Vec::with_capacity(n_samples);
    for i in 0..n_samples {
        let mut row = Vec::with_capacity(n_dims);
        for d in 0..n_dims {
            let stratum = perms[d][i];
            let u = (stratum as f64 + rng.next_f64()) / n_samples as f64;
            row.push(u);
        }
        samples.push(row);
    }
    samples
}

// ── Sobol / Van der Corput ──────────────────────────────────────────────────

/// Van der Corput sequence value for index `n` (1-based) in given `base`.
pub fn van_der_corput(mut n: usize, base: usize) -> f64 {
    let mut result = 0.0;
    let mut denom = 1.0;
    while n > 0 {
        denom *= base as f64;
        result += (n % base) as f64 / denom;
        n /= base;
    }
    result
}

/// Generate `n_samples` points of a Sobol-like quasi-random sequence in `n_dims` dimensions.
///
/// Uses Van der Corput sequences with co-prime bases for each dimension.
/// Returns row-major `Vec<Vec<f64>>`, each value in [0, 1).
pub fn sobol_points(n_samples: usize, n_dims: usize) -> Vec<Vec<f64>> {
    if n_samples == 0 || n_dims == 0 {
        return vec![];
    }
    let primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71];
    let mut samples = Vec::with_capacity(n_samples);
    for i in 0..n_samples {
        let mut row = Vec::with_capacity(n_dims);
        for d in 0..n_dims {
            let base = primes[d % primes.len()];
            row.push(van_der_corput(i + 1, base));
        }
        samples.push(row);
    }
    samples
}

// ── Halton sequence ─────────────────────────────────────────────────────────

/// Generate `n_samples` points of a Halton quasi-random sequence in `n_dims` dimensions.
///
/// The Halton sequence generalizes Van der Corput to multiple dimensions using
/// consecutive prime bases. Identical to Sobol for 1D but uses the standard
/// naming convention. Values in [0, 1).
///
/// Optionally skip the first `skip` points to avoid initial correlations
/// (recommended: skip ≥ 20 for dimensions > 5).
pub fn halton_points(n_samples: usize, n_dims: usize, skip: usize) -> Vec<Vec<f64>> {
    if n_samples == 0 || n_dims == 0 {
        return vec![];
    }
    let primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71];
    let mut samples = Vec::with_capacity(n_samples);
    for i in 0..n_samples {
        let mut row = Vec::with_capacity(n_dims);
        for d in 0..n_dims {
            let base = primes[d % primes.len()];
            row.push(van_der_corput(i + 1 + skip, base));
        }
        samples.push(row);
    }
    samples
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn xoshiro_deterministic() {
        let mut rng1 = Xoshiro256::new(42);
        let mut rng2 = Xoshiro256::new(42);
        for _ in 0..100 {
            assert_eq!(rng1.next_u64(), rng2.next_u64());
        }
    }

    #[test]
    fn xoshiro_different_seeds() {
        let mut rng1 = Xoshiro256::new(1);
        let mut rng2 = Xoshiro256::new(2);
        // Very unlikely all 10 match
        let same = (0..10).filter(|_| rng1.next_u64() == rng2.next_u64()).count();
        assert!(same < 10);
    }

    #[test]
    fn xoshiro_range_01() {
        let mut rng = Xoshiro256::new(0);
        for _ in 0..1000 {
            let v = rng.next_f64();
            assert!(v >= 0.0 && v < 1.0);
        }
    }

    #[test]
    fn xoshiro_fill_uniform() {
        let mut rng = Xoshiro256::new(42);
        let vals = rng.fill_uniform(100);
        assert_eq!(vals.len(), 100);
        assert!(vals.iter().all(|&v| v >= 0.0 && v < 1.0));
    }

    #[test]
    fn xoshiro_gaussian_reasonable() {
        let mut rng = Xoshiro256::new(42);
        let vals: Vec<f64> = (0..10000).map(|_| rng.next_gaussian()).collect();
        let mean = vals.iter().sum::<f64>() / vals.len() as f64;
        let var = vals.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / vals.len() as f64;
        // Mean should be near 0, variance near 1
        assert!(mean.abs() < 0.05, "mean = {mean}");
        assert!((var - 1.0).abs() < 0.1, "var = {var}");
    }

    #[test]
    fn lhs_stratified() {
        let samples = latin_hypercube(100, 2, 42);
        assert_eq!(samples.len(), 100);
        assert!(samples.iter().all(|r| r.len() == 2));
        // All values in [0, 1)
        for row in &samples {
            for &v in row {
                assert!(v >= 0.0 && v < 1.0, "v = {v}");
            }
        }
    }

    #[test]
    fn lhs_empty() {
        assert!(latin_hypercube(0, 3, 0).is_empty());
        assert!(latin_hypercube(5, 0, 0).is_empty());
    }

    #[test]
    fn sobol_low_discrepancy() {
        let pts = sobol_points(8, 1);
        assert_eq!(pts.len(), 8);
        // Van der Corput base 2: 0.5, 0.25, 0.75, 0.125, ...
        assert!((pts[0][0] - 0.5).abs() < 1e-10);
        assert!((pts[1][0] - 0.25).abs() < 1e-10);
        assert!((pts[2][0] - 0.75).abs() < 1e-10);
    }

    #[test]
    fn halton_2d() {
        let pts = halton_points(4, 2, 0);
        assert_eq!(pts.len(), 4);
        // dim 0 (base 2): 0.5, 0.25, 0.75, 0.125
        // dim 1 (base 3): 1/3, 2/3, 1/9, 4/9
        assert!((pts[0][0] - 0.5).abs() < 1e-10);
        assert!((pts[0][1] - 1.0 / 3.0).abs() < 1e-10);
        assert!((pts[1][0] - 0.25).abs() < 1e-10);
        assert!((pts[1][1] - 2.0 / 3.0).abs() < 1e-10);
    }

    #[test]
    fn halton_skip() {
        let pts_no_skip = halton_points(10, 1, 0);
        let pts_skip = halton_points(8, 1, 2);
        // pts_skip[0] should equal pts_no_skip[2]
        assert!((pts_skip[0][0] - pts_no_skip[2][0]).abs() < 1e-15);
    }

    #[test]
    fn van_der_corput_base2() {
        assert!((van_der_corput(1, 2) - 0.5).abs() < 1e-15);
        assert!((van_der_corput(2, 2) - 0.25).abs() < 1e-15);
        assert!((van_der_corput(3, 2) - 0.75).abs() < 1e-15);
        assert!((van_der_corput(4, 2) - 0.125).abs() < 1e-15);
    }
}
