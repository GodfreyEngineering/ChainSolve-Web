//! neural_operator.rs — Fourier Neural Operator (FNO) and DeepONet (2.98).
//!
//! Implements:
//!   - FNO: learns solution operators of PDEs from input/output function pairs
//!     using Fourier spectral convolution layers.
//!   - DeepONet: trunk-branch decomposition for operator learning.
//!
//! Architecture (FNO-1D):
//!   Input u(x) ∈ R^N  →  Lift(W_0) → [FNO_layer × D] → Project(W_proj) → v(x) ∈ R^M
//!
//! FNO layer:
//!   h → FFT(h) → truncate to n_modes → R*h_hat + IFFT → W_local*h → GELU → out
//!
//! DeepONet:
//!   branch: u(x_1..x_m) → MLP → [b_1..b_p]
//!   trunk:  y (query point) → MLP → [t_1..t_p]
//!   output: sum(b_i * t_i) + bias

use crate::rng::Xoshiro256;

// ── Complex arithmetic ────────────────────────────────────────────────────────

#[allow(dead_code)]
#[derive(Clone, Copy, Debug, Default)]
struct C {
    re: f64,
    im: f64,
}

#[allow(dead_code)]
impl C {
    fn mul(self, rhs: C) -> C {
        C { re: self.re * rhs.re - self.im * rhs.im, im: self.re * rhs.im + self.im * rhs.re }
    }
    fn add(self, rhs: C) -> C { C { re: self.re + rhs.re, im: self.im + rhs.im } }
    fn scale(self, s: f64) -> C { C { re: self.re * s, im: self.im * s } }
}

// ── FFT helpers ───────────────────────────────────────────────────────────────

/// Pad or truncate signal to next power of two.
#[allow(dead_code)]
fn pad_to_pow2(x: &[f64]) -> Vec<f64> {
    let n = x.len();
    let mut p = 1usize;
    while p < n { p <<= 1; }
    let mut out = vec![0.0; p];
    out[..n].copy_from_slice(x);
    out
}

/// Cooley-Tukey radix-2 FFT (power-of-two length only).
fn fft_r2(re: &mut [f64], im: &mut [f64], inverse: bool) {
    let n = re.len();
    debug_assert!(n.is_power_of_two());
    let mut j = 0usize;
    for i in 1..n {
        let mut bit = n >> 1;
        while j & bit != 0 { j ^= bit; bit >>= 1; }
        j ^= bit;
        if i < j { re.swap(i, j); im.swap(i, j); }
    }
    let mut len = 2usize;
    while len <= n {
        let sign = if inverse { 1.0 } else { -1.0 };
        let ang = sign * 2.0 * std::f64::consts::PI / len as f64;
        let (wre, wim) = (ang.cos(), ang.sin());
        for i in (0..n).step_by(len) {
            let (mut ure, mut uim) = (1.0f64, 0.0f64);
            for k in 0..len / 2 {
                let tre = re[i + k + len / 2] * ure - im[i + k + len / 2] * uim;
                let tim = re[i + k + len / 2] * uim + im[i + k + len / 2] * ure;
                re[i + k + len / 2] = re[i + k] - tre;
                im[i + k + len / 2] = im[i + k] - tim;
                re[i + k] += tre;
                im[i + k] += tim;
                (ure, uim) = (ure * wre - uim * wim, ure * wim + uim * wre);
            }
        }
        len <<= 1;
    }
    if inverse {
        let nf = n as f64;
        for x in re.iter_mut() { *x /= nf; }
        for x in im.iter_mut() { *x /= nf; }
    }
}

// ── FNO layer ─────────────────────────────────────────────────────────────────

/// Fourier layer spectral weights: [n_modes × width_in × width_out] complex
struct SpectralConv {
    /// Complex weights for Fourier modes: [n_modes][w_in × w_out] as (re, im) pairs.
    w_re: Vec<f64>, // [n_modes * w_in * w_out]
    w_im: Vec<f64>, // [n_modes * w_in * w_out]
    n_modes: usize,
    w_in: usize,
    w_out: usize,
}

impl SpectralConv {
    fn new(n_modes: usize, w_in: usize, w_out: usize, rng: &mut Xoshiro256) -> Self {
        let n = n_modes * w_in * w_out;
        let scale = (2.0 / (w_in * w_out) as f64).sqrt();
        let w_re: Vec<f64> = (0..n).map(|_| rng.next_gaussian() * scale).collect();
        let w_im: Vec<f64> = (0..n).map(|_| rng.next_gaussian() * scale).collect();
        SpectralConv { w_re, w_im, n_modes, w_in, w_out }
    }

    /// Apply spectral convolution to batched input h: [n_points × w_in].
    /// Returns [n_points × w_out].
    fn forward(&self, h: &[f64], n_pts: usize) -> Vec<f64> {
        assert_eq!(h.len(), n_pts * self.w_in);
        let n_padded = {
            let mut p = 1usize;
            while p < n_pts { p <<= 1; }
            p
        };

        // For each output channel, accumulate spectral contributions
        let mut out = vec![0.0; n_pts * self.w_out];

        for ci in 0..self.w_in {
            for co in 0..self.w_out {
                // Extract channel ci
                let mut re: Vec<f64> = (0..n_padded).map(|i| if i < n_pts { h[i * self.w_in + ci] } else { 0.0 }).collect();
                let mut im: Vec<f64> = vec![0.0; n_padded];
                fft_r2(&mut re, &mut im, false);

                // Multiply first n_modes by spectral weights
                let modes = self.n_modes.min(n_padded / 2 + 1);
                for k in 0..modes {
                    let w = k * self.w_in * self.w_out + ci * self.w_out + co;
                    let wr = self.w_re[w];
                    let wi = self.w_im[w];
                    let (new_re, new_im) = (re[k] * wr - im[k] * wi, re[k] * wi + im[k] * wr);
                    re[k] = new_re;
                    im[k] = new_im;
                    // Zero out remaining frequencies
                }
                // Zero out modes > n_modes
                for k in modes..n_padded {
                    re[k] = 0.0;
                    im[k] = 0.0;
                }
                // Also handle conjugate symmetry for last modes
                fft_r2(&mut re, &mut im, true);

                // Accumulate into output channel co
                for i in 0..n_pts {
                    out[i * self.w_out + co] += re[i];
                }
            }
        }
        out
    }

    fn param_count(&self) -> usize {
        self.n_modes * self.w_in * self.w_out * 2
    }

    fn get_params(&self) -> Vec<f64> {
        let mut p = self.w_re.clone();
        p.extend_from_slice(&self.w_im);
        p
    }

    fn set_params(&mut self, params: &[f64]) {
        let n = self.n_modes * self.w_in * self.w_out;
        self.w_re.copy_from_slice(&params[..n]);
        self.w_im.copy_from_slice(&params[n..2 * n]);
    }
}

/// Local linear layer: W [w_in × w_out] applied pointwise.
struct PointwiseLinear {
    w: Vec<f64>,
    b: Vec<f64>,
    w_in: usize,
    w_out: usize,
}

impl PointwiseLinear {
    fn new(w_in: usize, w_out: usize, rng: &mut Xoshiro256) -> Self {
        let scale = (2.0 / w_in as f64).sqrt();
        let w: Vec<f64> = (0..w_in * w_out).map(|_| rng.next_gaussian() * scale).collect();
        let b = vec![0.0; w_out];
        PointwiseLinear { w, b, w_in, w_out }
    }

    fn forward_point(&self, x: &[f64]) -> Vec<f64> {
        (0..self.w_out).map(|j| {
            self.b[j] + (0..self.w_in).map(|i| self.w[j * self.w_in + i] * x[i]).sum::<f64>()
        }).collect()
    }

    fn forward_seq(&self, h: &[f64], n_pts: usize) -> Vec<f64> {
        let mut out = Vec::with_capacity(n_pts * self.w_out);
        for i in 0..n_pts {
            out.extend(self.forward_point(&h[i * self.w_in..(i + 1) * self.w_in]));
        }
        out
    }

    fn param_count(&self) -> usize { self.w_in * self.w_out + self.w_out }

    fn get_params(&self) -> Vec<f64> {
        let mut p = self.w.clone();
        p.extend_from_slice(&self.b);
        p
    }

    fn set_params(&mut self, params: &[f64]) {
        let nw = self.w_in * self.w_out;
        self.w.copy_from_slice(&params[..nw]);
        self.b.copy_from_slice(&params[nw..]);
    }
}

// ── FNO Model ─────────────────────────────────────────────────────────────────

struct FnoLayer {
    spectral: SpectralConv,
    local: PointwiseLinear,
}

impl FnoLayer {
    fn new(n_modes: usize, width: usize, rng: &mut Xoshiro256) -> Self {
        FnoLayer {
            spectral: SpectralConv::new(n_modes, width, width, rng),
            local: PointwiseLinear::new(width, width, rng),
        }
    }

    fn forward(&self, h: &[f64], n_pts: usize) -> Vec<f64> {
        let spec_out = self.spectral.forward(h, n_pts);
        let local_out = self.local.forward_seq(h, n_pts);
        // GELU activation: x * Φ(x) ≈ x * sigmoid(1.702 * x)
        (0..n_pts * self.spectral.w_out).map(|i| {
            let x = spec_out[i] + local_out[i];
            x * (1.0 / (1.0 + (-1.702 * x).exp())) // approx GELU
        }).collect()
    }

    fn param_count(&self) -> usize {
        self.spectral.param_count() + self.local.param_count()
    }

    fn get_params(&self) -> Vec<f64> {
        let mut p = self.spectral.get_params();
        p.extend(self.local.get_params());
        p
    }

    fn set_params(&mut self, params: &[f64]) {
        let ns = self.spectral.param_count();
        self.spectral.set_params(&params[..ns]);
        self.local.set_params(&params[ns..]);
    }
}

#[allow(dead_code)]
pub struct FnoModel {
    lift: PointwiseLinear,
    layers: Vec<FnoLayer>,
    proj: PointwiseLinear,
    width: usize,
    d_in: usize,
    d_out: usize,
    n_pts: usize,
}

impl FnoModel {
    pub fn new(
        d_in: usize,
        d_out: usize,
        width: usize,
        n_layers: usize,
        n_modes: usize,
        n_pts: usize,
        rng: &mut Xoshiro256,
    ) -> Self {
        let lift = PointwiseLinear::new(d_in, width, rng);
        let layers: Vec<FnoLayer> = (0..n_layers).map(|_| FnoLayer::new(n_modes, width, rng)).collect();
        let proj = PointwiseLinear::new(width, d_out, rng);
        FnoModel { lift, layers, proj, width, d_in, d_out, n_pts }
    }

    /// Forward pass: input h [n_pts × d_in], returns [n_pts × d_out].
    pub fn forward(&self, h: &[f64]) -> Vec<f64> {
        let n_pts = self.n_pts;
        // Lift
        let mut h_curr = self.lift.forward_seq(h, n_pts);
        // FNO layers
        for layer in &self.layers {
            h_curr = layer.forward(&h_curr, n_pts);
        }
        // Project
        self.proj.forward_seq(&h_curr, n_pts)
    }

    pub fn param_count(&self) -> usize {
        self.lift.param_count()
            + self.layers.iter().map(|l| l.param_count()).sum::<usize>()
            + self.proj.param_count()
    }

    pub fn get_params(&self) -> Vec<f64> {
        let mut p = self.lift.get_params();
        for layer in &self.layers {
            p.extend(layer.get_params());
        }
        p.extend(self.proj.get_params());
        p
    }

    pub fn set_params(&mut self, params: &[f64]) {
        let mut offset = 0;
        let nl = self.lift.param_count();
        self.lift.set_params(&params[offset..offset + nl]);
        offset += nl;
        for layer in &mut self.layers {
            let lp = layer.param_count();
            layer.set_params(&params[offset..offset + lp]);
            offset += lp;
        }
        let np = self.proj.param_count();
        self.proj.set_params(&params[offset..offset + np]);
    }
}

// ── Adam optimiser (reused from pinn.rs logic) ────────────────────────────────

struct Adam {
    m: Vec<f64>,
    v: Vec<f64>,
    t: usize,
    lr: f64,
}

impl Adam {
    fn new(n: usize, lr: f64) -> Self {
        Adam { m: vec![0.0; n], v: vec![0.0; n], t: 0, lr }
    }
    fn step(&mut self, params: &mut [f64], grads: &[f64]) {
        self.t += 1;
        let b1t = 0.9f64.powi(self.t as i32);
        let b2t = 0.999f64.powi(self.t as i32);
        let lr_t = self.lr * (1.0 - b2t).sqrt() / (1.0 - b1t);
        for i in 0..params.len() {
            self.m[i] = 0.9 * self.m[i] + 0.1 * grads[i];
            self.v[i] = 0.999 * self.v[i] + 0.001 * grads[i] * grads[i];
            params[i] -= lr_t * self.m[i] / (self.v[i].sqrt() + 1e-8);
        }
    }
}

// ── Training configuration ────────────────────────────────────────────────────

/// Configuration for Neural Operator training.
#[derive(Debug, Clone)]
pub struct NeuralOpConfig {
    pub arch: NeuralOpArch,
    /// Training data: rows = samples, cols = [u_1..u_n, v_1..v_m]
    pub n_pts_in: usize,   // grid points for input function
    pub n_pts_out: usize,  // grid points for output function
    pub width: usize,
    pub n_layers: usize,
    pub n_modes: usize,    // FNO: spectral modes to retain
    pub epochs: usize,
    pub lr: f64,
    pub seed: u64,
    /// DeepONet branch/trunk hidden sizes
    pub hidden: Vec<usize>,
    pub basis_size: usize, // DeepONet: number of basis functions
}

#[derive(Debug, Clone, PartialEq)]
pub enum NeuralOpArch {
    Fno,
    DeepONet,
}

impl Default for NeuralOpConfig {
    fn default() -> Self {
        NeuralOpConfig {
            arch: NeuralOpArch::Fno,
            n_pts_in: 64,
            n_pts_out: 64,
            width: 32,
            n_layers: 3,
            n_modes: 16,
            epochs: 1000,
            lr: 1e-3,
            seed: 42,
            hidden: vec![64, 64],
            basis_size: 32,
        }
    }
}

/// Training result.
#[derive(Debug)]
pub struct NeuralOpResult {
    /// Predicted output for each sample: [n_samples × n_pts_out]
    pub predictions: Vec<Vec<f64>>,
    pub final_loss: f64,
    pub loss_history: Vec<f64>,
}

// ── DeepONet ──────────────────────────────────────────────────────────────────

/// Simple MLP for DeepONet branch/trunk networks.
fn mlp_forward(weights: &[(Vec<f64>, Vec<f64>)], x: &[f64]) -> Vec<f64> {
    let mut h = x.to_vec();
    let n = weights.len();
    for (i, (w, b)) in weights.iter().enumerate() {
        let out_sz = b.len();
        let in_sz = h.len();
        let new_h: Vec<f64> = (0..out_sz).map(|j| {
            let pre = b[j] + (0..in_sz).map(|k| w[j * in_sz + k] * h[k]).sum::<f64>();
            if i < n - 1 { pre.tanh() } else { pre }
        }).collect();
        h = new_h;
    }
    h
}

fn init_mlp(sizes: &[usize], rng: &mut Xoshiro256) -> Vec<(Vec<f64>, Vec<f64>)> {
    (0..sizes.len() - 1).map(|i| {
        let (n_in, n_out) = (sizes[i], sizes[i + 1]);
        let scale = (2.0 / n_in as f64).sqrt();
        let w: Vec<f64> = (0..n_in * n_out).map(|_| rng.next_gaussian() * scale).collect();
        let b = vec![0.0; n_out];
        (w, b)
    }).collect()
}

fn mlp_params(weights: &[(Vec<f64>, Vec<f64>)]) -> Vec<f64> {
    weights.iter().flat_map(|(w, b)| w.iter().chain(b.iter()).copied()).collect()
}

fn mlp_set_params(weights: &mut [(Vec<f64>, Vec<f64>)], params: &[f64]) {
    let mut offset = 0;
    for (w, b) in weights.iter_mut() {
        let nw = w.len();
        w.copy_from_slice(&params[offset..offset + nw]);
        offset += nw;
        let nb = b.len();
        b.copy_from_slice(&params[offset..offset + nb]);
        offset += nb;
    }
}

fn mlp_param_count(weights: &[(Vec<f64>, Vec<f64>)]) -> usize {
    weights.iter().map(|(w, b)| w.len() + b.len()).sum()
}

// ── FNO training via finite-difference gradient ────────────────────────────────

/// Numerical gradient of MSE loss via central differences.
fn numerical_grad(
    model: &mut FnoModel,
    x_batch: &[Vec<f64>],
    y_batch: &[Vec<f64>],
    params: &[f64],
    eps: f64,
) -> Vec<f64> {
    let n = params.len();
    let mut grad = vec![0.0; n];
    for i in 0..n {
        let mut p_plus = params.to_vec();
        p_plus[i] += eps;
        model.set_params(&p_plus);
        let loss_plus = mse_loss(model, x_batch, y_batch);

        let mut p_minus = params.to_vec();
        p_minus[i] -= eps;
        model.set_params(&p_minus);
        let loss_minus = mse_loss(model, x_batch, y_batch);

        grad[i] = (loss_plus - loss_minus) / (2.0 * eps);
    }
    grad
}

fn mse_loss(model: &FnoModel, x_batch: &[Vec<f64>], y_batch: &[Vec<f64>]) -> f64 {
    x_batch.iter().zip(y_batch.iter()).map(|(x, y)| {
        let pred = model.forward(x);
        pred.iter().zip(y.iter()).map(|(&p, &t)| (p - t) * (p - t)).sum::<f64>() / y.len() as f64
    }).sum::<f64>() / x_batch.len() as f64
}

fn deeponet_mse(
    branch: &[(Vec<f64>, Vec<f64>)],
    trunk: &[(Vec<f64>, Vec<f64>)],
    bias: &[f64],
    x_batch: &[Vec<f64>],
    y_batch: &[Vec<f64>],
    query_pts: &[f64],
) -> f64 {
    let n_samples = x_batch.len();
    let mut total = 0.0;
    for (x, y) in x_batch.iter().zip(y_batch.iter()) {
        let b_out = mlp_forward(branch, x);
        for (j, &yj) in y.iter().enumerate() {
            let qj = vec![query_pts[j]];
            let t_out = mlp_forward(trunk, &qj);
            let pred = bias[0] + b_out.iter().zip(t_out.iter()).map(|(&bi, &ti)| bi * ti).sum::<f64>();
            total += (pred - yj) * (pred - yj);
        }
        total /= y.len() as f64;
    }
    total / n_samples as f64
}

// ── Public training function ──────────────────────────────────────────────────

/// Train a neural operator on (input function, output function) pairs.
///
/// `train_data`: each row = [u_1..u_n_pts_in, v_1..v_n_pts_out]
pub fn train_neural_op(
    cfg: &NeuralOpConfig,
    train_data: &[Vec<f64>],
) -> NeuralOpResult {
    let mut rng = Xoshiro256::new(cfg.seed);

    if train_data.is_empty() {
        return NeuralOpResult {
            predictions: vec![],
            final_loss: f64::NAN,
            loss_history: vec![],
        };
    }

    let n_in = cfg.n_pts_in;
    let n_out = cfg.n_pts_out;
    let x_batch: Vec<Vec<f64>> = train_data.iter()
        .map(|row| row[..n_in.min(row.len())].to_vec())
        .collect();
    let y_batch: Vec<Vec<f64>> = train_data.iter()
        .map(|row| row[n_in..].to_vec())
        .collect();

    let mut loss_history = Vec::new();

    match cfg.arch {
        NeuralOpArch::Fno => {
            let mut model = FnoModel::new(
                1, 1, cfg.width, cfg.n_layers, cfg.n_modes, n_in, &mut rng,
            );
            // For FNO: each input sample is treated as [n_pts × 1]
            let x_seq: Vec<Vec<f64>> = x_batch.iter()
                .map(|u| u.iter().map(|&v| v).collect())
                .collect();
            let y_seq = y_batch.clone();

            let n_p = model.param_count();
            let mut params = model.get_params();
            let mut opt = Adam::new(n_p, cfg.lr);
            let eps = 1e-4;

            for epoch in 0..cfg.epochs {
                // Numerical gradient
                let grads = numerical_grad(&mut model, &x_seq, &y_seq, &params, eps);
                model.set_params(&params);
                opt.step(&mut params, &grads);
                model.set_params(&params);

                if epoch % 100 == 0 {
                    let loss = mse_loss(&model, &x_seq, &y_seq);
                    loss_history.push(loss);
                }
            }

            let predictions: Vec<Vec<f64>> = x_seq.iter()
                .map(|x| model.forward(x))
                .collect();
            let final_loss = loss_history.last().copied().unwrap_or(f64::NAN);
            NeuralOpResult { predictions, final_loss, loss_history }
        }

        NeuralOpArch::DeepONet => {
            let p = cfg.basis_size;
            let mut branch_sizes = vec![n_in];
            branch_sizes.extend_from_slice(&cfg.hidden);
            branch_sizes.push(p);
            let mut trunk_sizes = vec![1usize]; // query coordinate
            trunk_sizes.extend_from_slice(&cfg.hidden);
            trunk_sizes.push(p);
            let query_pts: Vec<f64> = (0..n_out)
                .map(|i| i as f64 / (n_out - 1).max(1) as f64)
                .collect();

            let mut branch = init_mlp(&branch_sizes, &mut rng);
            let mut trunk = init_mlp(&trunk_sizes, &mut rng);
            let mut bias = vec![0.0f64];

            let n_b = mlp_param_count(&branch);
            let n_t = mlp_param_count(&trunk);
            let n_params = n_b + n_t + 1;
            let mut params: Vec<f64> = mlp_params(&branch);
            params.extend(mlp_params(&trunk));
            params.push(bias[0]);

            let mut opt = Adam::new(n_params, cfg.lr);
            let eps = 1e-4;

            for epoch in 0..cfg.epochs {
                // Numerical gradient over all params
                let mut grad = vec![0.0; n_params];
                for i in 0..n_params {
                    let mut p_plus = params.clone();
                    p_plus[i] += eps;
                    mlp_set_params(&mut branch, &p_plus[..n_b]);
                    mlp_set_params(&mut trunk, &p_plus[n_b..n_b + n_t]);
                    bias[0] = p_plus[n_b + n_t];
                    let loss_p = deeponet_mse(&branch, &trunk, &bias, &x_batch, &y_batch, &query_pts);

                    let mut p_minus = params.clone();
                    p_minus[i] -= eps;
                    mlp_set_params(&mut branch, &p_minus[..n_b]);
                    mlp_set_params(&mut trunk, &p_minus[n_b..n_b + n_t]);
                    bias[0] = p_minus[n_b + n_t];
                    let loss_m = deeponet_mse(&branch, &trunk, &bias, &x_batch, &y_batch, &query_pts);

                    grad[i] = (loss_p - loss_m) / (2.0 * eps);
                }
                // Restore
                mlp_set_params(&mut branch, &params[..n_b]);
                mlp_set_params(&mut trunk, &params[n_b..n_b + n_t]);
                bias[0] = params[n_b + n_t];

                opt.step(&mut params, &grad);
                mlp_set_params(&mut branch, &params[..n_b]);
                mlp_set_params(&mut trunk, &params[n_b..n_b + n_t]);
                bias[0] = params[n_b + n_t];

                if epoch % 100 == 0 {
                    let loss = deeponet_mse(&branch, &trunk, &bias, &x_batch, &y_batch, &query_pts);
                    loss_history.push(loss);
                }
            }

            let predictions: Vec<Vec<f64>> = x_batch.iter().map(|x| {
                let b_out = mlp_forward(&branch, x);
                (0..n_out).map(|j| {
                    let qj = vec![query_pts[j]];
                    let t_out = mlp_forward(&trunk, &qj);
                    bias[0] + b_out.iter().zip(t_out.iter()).map(|(&bi, &ti)| bi * ti).sum::<f64>()
                }).collect()
            }).collect();

            let final_loss = loss_history.last().copied().unwrap_or(f64::NAN);
            NeuralOpResult { predictions, final_loss, loss_history }
        }
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fno_forward_shape() {
        let mut rng = Xoshiro256::new(1);
        let model = FnoModel::new(1, 1, 8, 2, 4, 16, &mut rng);
        let input: Vec<f64> = (0..16).map(|i| i as f64 / 16.0).collect();
        let out = model.forward(&input);
        assert_eq!(out.len(), 16, "FNO output should be n_pts");
    }

    #[test]
    fn deeponet_train_identity() {
        // Toy: identity operator — output = input
        let n = 8;
        let train_data: Vec<Vec<f64>> = (0..10).map(|k| {
            let u: Vec<f64> = (0..n).map(|i| (i as f64 + k as f64) / n as f64).collect();
            let mut row = u.clone();
            row.extend_from_slice(&u); // target = input
            row
        }).collect();
        let cfg = NeuralOpConfig {
            arch: NeuralOpArch::DeepONet,
            n_pts_in: n,
            n_pts_out: n,
            hidden: vec![16],
            basis_size: 8,
            epochs: 50, // short for test
            lr: 1e-3,
            seed: 1,
            ..Default::default()
        };
        let result = train_neural_op(&cfg, &train_data);
        // Just check it runs and returns correct shape
        assert_eq!(result.predictions.len(), 10);
        assert_eq!(result.predictions[0].len(), n);
    }
}
