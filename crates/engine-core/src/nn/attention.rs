//! Scaled dot-product attention and multi-head attention (item 2.94).
//!
//! ## Scaled dot-product attention (Vaswani et al. 2017)
//!
//! ```text
//! Attention(Q, K, V) = softmax( Q·Kᵀ / √d_k ) · V
//! ```
//!
//! - Q: [seq_q × d_k] — query matrix
//! - K: [seq_k × d_k] — key matrix
//! - V: [seq_k × d_v] — value matrix
//! - Output: [seq_q × d_v]
//!
//! ## Causal masking (optional)
//!
//! When `causal = true`, the attention is masked so position t can only attend
//! to positions ≤ t (upper triangular mask set to -∞ before softmax).
//! Essential for autoregressive sequence modelling.

use crate::types::Value;

/// Compute softmax over a slice in place.
fn softmax_inplace(v: &mut [f64]) {
    let max = v.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let sum: f64 = v.iter().map(|&x| (x - max).exp()).sum();
    for x in v.iter_mut() {
        *x = (*x - max).exp() / sum.max(1e-15);
    }
}

/// Scaled dot-product attention.
///
/// `q` — Query matrix [seq_q × d_k] (row-major flat).
/// `k` — Key matrix   [seq_k × d_k] (row-major flat).
/// `v` — Value matrix [seq_k × d_v] (row-major flat).
/// `seq_q`, `seq_k`, `d_k`, `d_v` — dimensions.
/// `causal` — mask future positions.
///
/// Returns output [seq_q × d_v] flat.
pub fn scaled_dot_product_attention(
    q: &[f64], k: &[f64], v: &[f64],
    seq_q: usize, seq_k: usize, d_k: usize, d_v: usize,
    causal: bool,
) -> Vec<f64> {
    let scale = (d_k as f64).sqrt().max(1e-15);

    // Compute attention scores S = Q·Kᵀ / √d_k  [seq_q × seq_k]
    let mut scores = vec![0.0_f64; seq_q * seq_k];
    for i in 0..seq_q {
        for j in 0..seq_k {
            let mut dot = 0.0_f64;
            for dk in 0..d_k {
                dot += q.get(i * d_k + dk).copied().unwrap_or(0.0)
                     * k.get(j * d_k + dk).copied().unwrap_or(0.0);
            }
            scores[i * seq_k + j] = dot / scale;
        }
    }

    // Apply causal mask: set future positions to -∞
    if causal {
        for i in 0..seq_q {
            for j in (i + 1)..seq_k {
                scores[i * seq_k + j] = f64::NEG_INFINITY;
            }
        }
    }

    // Softmax over each query row
    for i in 0..seq_q {
        softmax_inplace(&mut scores[i * seq_k..(i + 1) * seq_k]);
    }

    // Compute output = scores · V  [seq_q × d_v]
    let mut output = vec![0.0_f64; seq_q * d_v];
    for i in 0..seq_q {
        for dv in 0..d_v {
            let mut sum = 0.0_f64;
            for j in 0..seq_k {
                sum += scores[i * seq_k + j]
                     * v.get(j * d_v + dv).copied().unwrap_or(0.0);
            }
            output[i * d_v + dv] = sum;
        }
    }

    output
}

/// Attention block: given Q, K, V tables, return attended output as Table.
pub fn attention_block(
    q_table: &[Vec<f64>],
    k_table: &[Vec<f64>],
    v_table: &[Vec<f64>],
    causal: bool,
) -> Value {
    let seq_q = q_table.len();
    let seq_k = k_table.len();

    if seq_q == 0 || seq_k == 0 {
        return Value::error("attention: empty Q or K sequence");
    }
    if v_table.len() != seq_k {
        return Value::error("attention: K and V must have same sequence length");
    }

    let d_k = q_table[0].len();
    let d_v = if v_table.is_empty() { d_k } else { v_table[0].len() };

    if k_table[0].len() != d_k {
        return Value::error("attention: Q and K must have same d_k dimension");
    }

    // Flatten to row-major
    let q_flat: Vec<f64> = q_table.iter().flat_map(|r| r.iter().cloned()).collect();
    let k_flat: Vec<f64> = k_table.iter().flat_map(|r| r.iter().cloned()).collect();
    let v_flat: Vec<f64> = v_table.iter().flat_map(|r| r.iter().cloned()).collect();

    let out_flat = scaled_dot_product_attention(
        &q_flat, &k_flat, &v_flat,
        seq_q, seq_k, d_k, d_v,
        causal,
    );

    // Reshape to [seq_q × d_v] Table
    let columns: Vec<String> = (0..d_v).map(|i| format!("v{i}")).collect();
    let rows: Vec<Vec<f64>> = (0..seq_q)
        .map(|i| out_flat[i * d_v..(i + 1) * d_v].to_vec())
        .collect();

    Value::Table { columns, rows }
}

/// Self-attention: Q = K = V = same sequence.
pub fn self_attention_block(seq_table: &[Vec<f64>], causal: bool) -> Value {
    attention_block(seq_table, seq_table, seq_table, causal)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn attention_output_shape() {
        // Q: 3×4, K: 5×4, V: 5×6 → output: 3×6
        let q: Vec<f64> = vec![1.0; 3 * 4];
        let k: Vec<f64> = vec![0.5; 5 * 4];
        let v: Vec<f64> = vec![2.0; 5 * 6];
        let out = scaled_dot_product_attention(&q, &k, &v, 3, 5, 4, 6, false);
        assert_eq!(out.len(), 3 * 6);
    }

    #[test]
    fn attention_uniform_keys_uniform_output() {
        // When all keys identical, attention is uniform, output = mean of V rows
        let seq = 4_usize;
        let d = 3_usize;
        let q: Vec<f64> = vec![1.0; seq * d];
        let k: Vec<f64> = vec![1.0; seq * d]; // identical keys
        let v: Vec<f64> = (0..seq).flat_map(|i| vec![i as f64; d]).collect();
        let out = scaled_dot_product_attention(&q, &k, &v, seq, seq, d, d, false);
        // All attention weights = 1/seq, output = mean of v rows = [1.5, 1.5, 1.5] for each query
        let expected_val = (0..seq).map(|i| i as f64).sum::<f64>() / seq as f64;
        for &o in &out {
            assert!((o - expected_val).abs() < 1e-6, "o={o}, expected={expected_val}");
        }
    }

    #[test]
    fn causal_mask_blocks_future() {
        // With causal mask, position 0 should only see itself
        let q = vec![1.0, 0.0, 0.0, 1.0]; // 2×2
        let k = vec![1.0, 0.0, 0.0, 1.0]; // 2×2
        let v = vec![10.0, 20.0, 30.0, 40.0]; // 2×2: row0=[10,20], row1=[30,40]
        let out = scaled_dot_product_attention(&q, &k, &v, 2, 2, 2, 2, true);
        // Position 0 attends only to itself: output[0] = v[0] = [10, 20]
        assert!((out[0] - 10.0).abs() < 1e-6, "out[0]={}", out[0]);
        assert!((out[1] - 20.0).abs() < 1e-6, "out[1]={}", out[1]);
    }

    #[test]
    fn self_attention_identity_for_single_token() {
        let seq = vec![vec![1.0_f64, 2.0, 3.0]];
        let result = self_attention_block(&seq, false);
        if let crate::types::Value::Table { rows, .. } = result {
            assert_eq!(rows.len(), 1);
            // With one token, attention is trivially weight=1.0, output = v[0] = input
            assert!((rows[0][0] - 1.0).abs() < 1e-6);
        }
    }
}
