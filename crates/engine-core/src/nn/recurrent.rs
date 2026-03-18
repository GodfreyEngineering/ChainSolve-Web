//! Recurrent neural network layers: LSTM and GRU (items 2.92, 2.93).
//!
//! ## LSTM (Long Short-Term Memory)
//!
//! Standard LSTM cell (Hochreiter & Schmidhuber 1997):
//! ```text
//! [f, i, g, o] = σ/tanh( W·[h_{t-1}, x_t] + b )
//! c_t = f ⊙ c_{t-1} + i ⊙ g
//! h_t = o ⊙ tanh(c_t)
//! ```
//!
//! ## GRU (Gated Recurrent Unit)
//!
//! Cho et al. 2014:
//! ```text
//! r_t = σ( W_r·[h_{t-1}, x_t] + b_r )
//! z_t = σ( W_z·[h_{t-1}, x_t] + b_z )
//! n_t = tanh( W_n·[r_t ⊙ h_{t-1}, x_t] + b_n )
//! h_t = (1 − z_t) ⊙ n_t + z_t ⊙ h_{t-1}
//! ```
//!
//! ## Usage in blocks
//!
//! Both take a sequence Table `[T × D_in]` and output either:
//! - The final hidden state vector `[D_h]` (default), or
//! - The full hidden sequence Table `[T × D_h]` (when `return_sequences = true`).
//!
//! Weights are Xavier-initialised from a configurable seed.
//! For trained weights, load from a JSON blob in block data.

use crate::types::Value;
use super::activation;

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Simple xorshift Gaussian RNG (Box-Muller).
struct WeightInit(u64);

impl WeightInit {
    fn next_f64(&mut self) -> f64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        (self.0 as f64) / (u64::MAX as f64)
    }

    fn next_normal(&mut self) -> f64 {
        let u1 = self.next_f64().max(1e-15);
        let u2 = self.next_f64();
        (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos()
    }

    /// Xavier uniform ±sqrt(6 / (fan_in + fan_out)).
    fn xavier_vec(&mut self, n: usize, fan_in: usize, fan_out: usize) -> Vec<f64> {
        let limit = (6.0 / (fan_in + fan_out) as f64).sqrt();
        (0..n).map(|_| (self.next_f64() * 2.0 - 1.0) * limit).collect()
    }
}

fn sigmoid(x: f64) -> f64 { 1.0 / (1.0 + (-x).exp()) }
fn tanh_f(x: f64) -> f64 { x.tanh() }

/// Matrix-vector multiply: y[i] = Σ_j A[i*n + j] * x[j], A is m×n.
fn matvec(a: &[f64], x: &[f64], m: usize, n: usize) -> Vec<f64> {
    (0..m).map(|i| (0..n).map(|j| a[i * n + j] * x.get(j).copied().unwrap_or(0.0)).sum()).collect()
}

/// Concatenate two slices.
fn concat(a: &[f64], b: &[f64]) -> Vec<f64> {
    let mut v = a.to_vec();
    v.extend_from_slice(b);
    v
}

// ── LSTM ─────────────────────────────────────────────────────────────────────

/// LSTM layer with Xavier-initialised weights.
pub struct LstmLayer {
    input_size: usize,
    hidden_size: usize,
    /// W_f, W_i, W_g, W_o — each (hidden_size × (input_size + hidden_size))
    /// Stored as one flat [4 * hidden_size * (input+hidden)] matrix: [f|i|g|o].
    w: Vec<f64>,
    /// Biases [4 * hidden_size]: [b_f | b_i | b_g | b_o].
    b: Vec<f64>,
}

impl LstmLayer {
    /// Create LSTM with Xavier-initialised weights.
    pub fn new(input_size: usize, hidden_size: usize, seed: u64) -> Self {
        let concat_size = input_size + hidden_size;
        let mut rng = WeightInit(seed.max(1));
        let w = rng.xavier_vec(4 * hidden_size * concat_size, concat_size, hidden_size);
        let b = vec![0.0_f64; 4 * hidden_size];
        Self { input_size, hidden_size, w, b }
    }

    /// Single cell step: returns (h_new, c_new).
    pub fn step(&self, x: &[f64], h: &[f64], c: &[f64]) -> (Vec<f64>, Vec<f64>) {
        let concat_size = self.input_size + self.hidden_size;
        let xh = concat(x, h);

        // Preactivations: wa = W·xh (4*hidden_size)
        let wa = matvec(&self.w, &xh, 4 * self.hidden_size, concat_size);

        let h_s = self.hidden_size;
        let mut h_new = vec![0.0_f64; h_s];
        let mut c_new = vec![0.0_f64; h_s];

        for j in 0..h_s {
            let f = sigmoid(wa[j]           + self.b[j]);
            let i = sigmoid(wa[h_s + j]     + self.b[h_s + j]);
            let g = tanh_f(wa[2 * h_s + j] + self.b[2 * h_s + j]);
            let o = sigmoid(wa[3 * h_s + j] + self.b[3 * h_s + j]);
            c_new[j] = f * c[j] + i * g;
            h_new[j] = o * tanh_f(c_new[j]);
        }

        (h_new, c_new)
    }

    /// Forward pass over a sequence.
    ///
    /// `x_seq` — list of timestep vectors, each of length `input_size`.
    /// Returns list of hidden states (one per timestep) if `return_sequences`,
    /// or just the last hidden state.
    pub fn forward(&self, x_seq: &[Vec<f64>], return_sequences: bool) -> Vec<Vec<f64>> {
        let mut h = vec![0.0_f64; self.hidden_size];
        let mut c = vec![0.0_f64; self.hidden_size];
        let mut outputs = Vec::new();

        for x in x_seq {
            let (h_new, c_new) = self.step(x, &h, &c);
            h = h_new;
            c = c_new;
            if return_sequences {
                outputs.push(h.clone());
            }
        }

        if !return_sequences {
            outputs.push(h);
        }
        outputs
    }
}

// ── GRU ──────────────────────────────────────────────────────────────────────

/// GRU layer with Xavier-initialised weights.
pub struct GruLayer {
    input_size: usize,
    hidden_size: usize,
    /// W_r, W_z — each (hidden_size × (input+hidden)), stored as [r|z] flat.
    w_rz: Vec<f64>,
    /// W_n — (hidden_size × (input+hidden)).
    w_n: Vec<f64>,
    /// Biases b_r, b_z, b_n — each [hidden_size].
    b_rz: Vec<f64>,
    b_n: Vec<f64>,
}

impl GruLayer {
    pub fn new(input_size: usize, hidden_size: usize, seed: u64) -> Self {
        let concat_size = input_size + hidden_size;
        let mut rng = WeightInit(seed.max(1));
        let w_rz = rng.xavier_vec(2 * hidden_size * concat_size, concat_size, hidden_size);
        let w_n  = rng.xavier_vec(    hidden_size * concat_size, concat_size, hidden_size);
        let b_rz = vec![0.0_f64; 2 * hidden_size];
        let b_n  = vec![0.0_f64;     hidden_size];
        Self { input_size, hidden_size, w_rz, w_n, b_rz, b_n }
    }

    /// Single GRU step.
    pub fn step(&self, x: &[f64], h: &[f64]) -> Vec<f64> {
        let concat_size = self.input_size + self.hidden_size;
        let xh = concat(x, h);
        let h_s = self.hidden_size;

        // Reset and update gates
        let rz = matvec(&self.w_rz, &xh, 2 * h_s, concat_size);
        let r: Vec<f64> = (0..h_s).map(|j| sigmoid(rz[j]       + self.b_rz[j])).collect();
        let z: Vec<f64> = (0..h_s).map(|j| sigmoid(rz[h_s + j] + self.b_rz[h_s + j])).collect();

        // New gate — uses r ⊙ h as the recurrent component
        let rh: Vec<f64> = (0..h_s).map(|j| r[j] * h[j]).collect();
        let xrh = concat(x, &rh);
        let n_pre = matvec(&self.w_n, &xrh, h_s, concat_size);
        let n: Vec<f64> = (0..h_s).map(|j| tanh_f(n_pre[j] + self.b_n[j])).collect();

        // Output
        (0..h_s).map(|j| (1.0 - z[j]) * n[j] + z[j] * h[j]).collect()
    }

    pub fn forward(&self, x_seq: &[Vec<f64>], return_sequences: bool) -> Vec<Vec<f64>> {
        let mut h = vec![0.0_f64; self.hidden_size];
        let mut outputs = Vec::new();

        for x in x_seq {
            h = self.step(x, &h);
            if return_sequences {
                outputs.push(h.clone());
            }
        }

        if !return_sequences {
            outputs.push(h);
        }
        outputs
    }
}

// ── Block-level functions ─────────────────────────────────────────────────────

/// Parse a sequence from a Table input: each row is one timestep.
pub fn table_to_sequence(columns: &[String], rows: &[Vec<f64>]) -> Vec<Vec<f64>> {
    rows.to_vec()
}

/// Sequence to Table value.
pub fn sequence_to_table(seq: &[Vec<f64>]) -> Value {
    if seq.is_empty() {
        return Value::Table { columns: vec![], rows: vec![] };
    }
    let n = seq[0].len();
    let columns: Vec<String> = (0..n).map(|i| format!("h{i}")).collect();
    Value::Table { columns, rows: seq.to_vec() }
}

/// LSTM block: sequence [T × D] → hidden states.
pub fn lstm_forward(
    sequence: &[Vec<f64>],
    hidden_size: usize,
    seed: u64,
    return_sequences: bool,
) -> Value {
    if sequence.is_empty() {
        return Value::error("lstm: empty sequence");
    }
    let input_size = sequence[0].len();
    let lstm = LstmLayer::new(input_size, hidden_size, seed);
    let output = lstm.forward(sequence, return_sequences);
    sequence_to_table(&output)
}

/// GRU block: sequence [T × D] → hidden states.
pub fn gru_forward(
    sequence: &[Vec<f64>],
    hidden_size: usize,
    seed: u64,
    return_sequences: bool,
) -> Value {
    if sequence.is_empty() {
        return Value::error("gru: empty sequence");
    }
    let input_size = sequence[0].len();
    let gru = GruLayer::new(input_size, hidden_size, seed);
    let output = gru.forward(sequence, return_sequences);
    sequence_to_table(&output)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_seq(t: usize, d: usize, val: f64) -> Vec<Vec<f64>> {
        vec![vec![val; d]; t]
    }

    #[test]
    fn lstm_output_shape() {
        let seq = make_seq(5, 3, 1.0);
        let lstm = LstmLayer::new(3, 8, 42);
        let out = lstm.forward(&seq, false);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].len(), 8);
    }

    #[test]
    fn lstm_return_sequences() {
        let seq = make_seq(5, 3, 0.5);
        let lstm = LstmLayer::new(3, 8, 42);
        let out = lstm.forward(&seq, true);
        assert_eq!(out.len(), 5);
        assert_eq!(out[0].len(), 8);
    }

    #[test]
    fn lstm_bounded_output() {
        // LSTM output h = o * tanh(c), so |h| ≤ 1
        let seq = make_seq(10, 4, 100.0); // extreme input
        let lstm = LstmLayer::new(4, 16, 123);
        let out = lstm.forward(&seq, false);
        for &v in &out[0] {
            assert!(v.abs() <= 1.0 + 1e-10, "h={v} exceeds 1");
        }
    }

    #[test]
    fn gru_output_shape() {
        let seq = make_seq(7, 4, 0.3);
        let gru = GruLayer::new(4, 12, 99);
        let out = gru.forward(&seq, false);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].len(), 12);
    }

    #[test]
    fn gru_bounded_output() {
        // GRU hidden: convex combination of tanh values → |h| ≤ 1
        let seq = make_seq(10, 3, 50.0);
        let gru = GruLayer::new(3, 8, 77);
        let out = gru.forward(&seq, false);
        for &v in &out[0] {
            assert!(v.abs() <= 1.0 + 1e-10, "h={v}");
        }
    }
}
