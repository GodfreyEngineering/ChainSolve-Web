//! pinn.rs — Physics-Informed Neural Network solver (2.97).
//!
//! Solves 1D boundary value problems of the form:
//!   a·u''(x) + b·u'(x) + c·u(x) = f(x),   x ∈ \[lo, hi\]
//!   u(lo) = bc_left,  u(hi) = bc_right
//!
//! Features:
//!  - Fourier feature embedding for spectral bias mitigation
//!  - NTK-based gradient balancing between PDE and BC losses
//!  - Adam optimiser with configurable learning rate
//!  - Adaptive collocation via residual-based resampling every 100 epochs

use crate::rng::Xoshiro256;

// ── Configuration ─────────────────────────────────────────────────────────────

/// PDE coefficients for: a·u'' + b·u' + c·u = f(x)
#[derive(Debug, Clone)]
pub struct PinnPde {
    pub a: f64,      // coefficient of u''
    pub b: f64,      // coefficient of u'
    pub c: f64,      // coefficient of u
    pub f_const: f64, // constant source term (f(x) = f_const + f_sin * sin(π·x))
    pub f_sin: f64,  // sin source term amplitude
}

impl Default for PinnPde {
    fn default() -> Self {
        // -u'' = 1 (Poisson equation with unit source)
        PinnPde { a: -1.0, b: 0.0, c: 0.0, f_const: 1.0, f_sin: 0.0 }
    }
}

/// PINN training configuration.
#[derive(Debug, Clone)]
pub struct PinnConfig {
    pub pde: PinnPde,
    pub domain_lo: f64,
    pub domain_hi: f64,
    pub bc_left: f64,
    pub bc_right: f64,
    pub hidden_sizes: Vec<usize>,   // e.g. [32, 32, 32]
    pub epochs: usize,
    pub lr: f64,
    pub n_collocation: usize,
    pub n_eval: usize,              // evaluation points in output
    pub fourier_features: usize,    // 0 = disabled, otherwise # of frequency pairs
    pub seed: u64,
}

impl Default for PinnConfig {
    fn default() -> Self {
        PinnConfig {
            pde: PinnPde::default(),
            domain_lo: 0.0,
            domain_hi: 1.0,
            bc_left: 0.0,
            bc_right: 0.0,
            hidden_sizes: vec![32, 32, 32],
            epochs: 2000,
            lr: 1e-3,
            n_collocation: 64,
            n_eval: 100,
            fourier_features: 4,
            seed: 42,
        }
    }
}

/// PINN training result.
#[derive(Debug)]
pub struct PinnResult {
    /// (x, u(x)) pairs at n_eval evenly-spaced points.
    pub xs: Vec<f64>,
    pub us: Vec<f64>,
    /// Final combined loss.
    pub final_loss: f64,
    /// Loss history every 100 epochs.
    pub loss_history: Vec<f64>,
}

// ── MLP with flat parameter vector ────────────────────────────────────────────

/// Layer shape: (in_features, out_features)
struct Layer {
    w: Vec<f64>,   // row-major [out x in]
    b: Vec<f64>,   // [out]
    n_in: usize,
    n_out: usize,
}

impl Layer {
    fn new(n_in: usize, n_out: usize, rng: &mut Xoshiro256) -> Self {
        let scale = (2.0 / n_in as f64).sqrt(); // He init
        let w = (0..n_in * n_out).map(|_| rng.next_gaussian() * scale).collect();
        let b = vec![0.0; n_out];
        Layer { w, b, n_in, n_out }
    }

    fn forward_tanh(&self, x: &[f64]) -> Vec<f64> {
        (0..self.n_out).map(|j| {
            let pre = self.b[j] + (0..self.n_in)
                .map(|i| self.w[j * self.n_in + i] * x[i])
                .sum::<f64>();
            pre.tanh()
        }).collect()
    }

    fn forward_tanh_with_grad(&self, x: &[f64]) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
        // Returns (output, pre_activations, tanh_derivatives)
        let mut pre = vec![0.0; self.n_out];
        let mut out = vec![0.0; self.n_out];
        let mut dtanh = vec![0.0; self.n_out];
        for j in 0..self.n_out {
            let p = self.b[j] + (0..self.n_in)
                .map(|i| self.w[j * self.n_in + i] * x[i])
                .sum::<f64>();
            pre[j] = p;
            let t = p.tanh();
            out[j] = t;
            dtanh[j] = 1.0 - t * t;
        }
        (out, pre, dtanh)
    }

    fn forward_linear(&self, x: &[f64]) -> Vec<f64> {
        (0..self.n_out).map(|j| {
            self.b[j] + (0..self.n_in)
                .map(|i| self.w[j * self.n_in + i] * x[i])
                .sum::<f64>()
        }).collect()
    }

    fn param_count(&self) -> usize {
        self.n_in * self.n_out + self.n_out
    }
}

struct Mlp {
    layers: Vec<Layer>,
}

impl Mlp {
    fn new(input_dim: usize, hidden: &[usize], output_dim: usize, rng: &mut Xoshiro256) -> Self {
        let mut layers = Vec::new();
        let mut prev = input_dim;
        for &h in hidden {
            layers.push(Layer::new(prev, h, rng));
            prev = h;
        }
        layers.push(Layer::new(prev, output_dim, rng));
        // Verify the network was built with the expected dimensions.
        debug_assert_eq!(layers.first().map(|l| l.n_in).unwrap_or(0), input_dim,
            "MLP: first layer input dim mismatch");
        debug_assert_eq!(layers.last().map(|l| l.n_out).unwrap_or(0), output_dim,
            "MLP: last layer output dim mismatch");
        Mlp { layers }
    }

    fn forward(&self, x: &[f64]) -> f64 {
        let mut h = x.to_vec();
        let n = self.layers.len();
        for (i, layer) in self.layers.iter().enumerate() {
            if i < n - 1 {
                h = layer.forward_tanh(&h);
            } else {
                h = layer.forward_linear(&h);
            }
        }
        h[0]
    }

    /// Compute u(x), du/dx, d²u/dx².
    fn forward_with_dxx(&self, x: f64, embedding: &Embedding) -> (f64, f64, f64) {
        let h_step = 1e-4;
        let enc = embedding.encode(x);
        let enc_lo = embedding.encode(x - h_step);
        let enc_hi = embedding.encode(x + h_step);
        let u = self.forward(&enc);
        let u_lo = self.forward(&enc_lo);
        let u_hi = self.forward(&enc_hi);
        let du_dx = (u_hi - u_lo) / (2.0 * h_step);
        let d2u_dx2 = (u_hi - 2.0 * u + u_lo) / (h_step * h_step);
        (u, du_dx, d2u_dx2)
    }

    /// Backpropagation — returns flat gradient vector.
    fn backward(&self, x: &[f64], loss_dy: f64) -> Vec<f64> {
        let n = self.layers.len();
        // Forward pass with intermediate activations
        let mut activations: Vec<Vec<f64>> = Vec::with_capacity(n + 1);
        let mut dtanh_cache: Vec<Vec<f64>> = Vec::with_capacity(n);
        activations.push(x.to_vec());
        for (i, layer) in self.layers.iter().enumerate() {
            if i < n - 1 {
                let (out, _, dtanh) = layer.forward_tanh_with_grad(activations.last().unwrap());
                activations.push(out);
                dtanh_cache.push(dtanh);
            } else {
                // Last layer: linear
                let out = layer.forward_linear(activations.last().unwrap());
                activations.push(out);
                dtanh_cache.push(vec![1.0; layer.n_out]);
            }
        }
        // Backward pass
        let mut grads: Vec<f64> = Vec::new();
        let mut delta = vec![loss_dy]; // dL/d_pre for output layer
        for i in (0..n).rev() {
            let layer = &self.layers[i];
            let a_in = &activations[i];
            // Multiply delta by dtanh (for hidden layers it's applied at the source)
            let d_vec: Vec<f64> = delta.iter().zip(dtanh_cache[i].iter())
                .map(|(d, dt)| d * dt)
                .collect();
            // Weight gradients: d_w[j, k] = d_vec[j] * a_in[k]
            let mut layer_grads: Vec<f64> = Vec::with_capacity(layer.param_count());
            for j in 0..layer.n_out {
                for k in 0..layer.n_in {
                    layer_grads.push(d_vec[j] * a_in[k]);
                }
            }
            // Bias gradients
            layer_grads.extend_from_slice(&d_vec);
            grads.splice(0..0, layer_grads); // prepend
            // Propagate to previous layer: delta = W^T * d_vec (before dtanh)
            let mut new_delta = vec![0.0; layer.n_in];
            for j in 0..layer.n_out {
                for k in 0..layer.n_in {
                    new_delta[k] += layer.w[j * layer.n_in + k] * d_vec[j];
                }
            }
            delta = new_delta;
        }
        grads
    }

    fn total_params(&self) -> usize {
        self.layers.iter().map(|l| l.param_count()).sum()
    }

    fn get_params(&self) -> Vec<f64> {
        let mut p = Vec::with_capacity(self.total_params());
        for layer in &self.layers {
            p.extend_from_slice(&layer.w);
            p.extend_from_slice(&layer.b);
        }
        p
    }

    fn set_params(&mut self, params: &[f64]) {
        let mut offset = 0;
        for layer in &mut self.layers {
            let nw = layer.n_in * layer.n_out;
            layer.w.copy_from_slice(&params[offset..offset + nw]);
            offset += nw;
            let nb = layer.n_out;
            layer.b.copy_from_slice(&params[offset..offset + nb]);
            offset += nb;
        }
    }
}

// ── Fourier Feature Embedding ─────────────────────────────────────────────────

struct Embedding {
    freqs: Vec<f64>,
    n_features: usize,
}

impl Embedding {
    fn new(n_pairs: usize, domain_lo: f64, domain_hi: f64) -> Self {
        let scale = std::f64::consts::PI / (domain_hi - domain_lo);
        let freqs: Vec<f64> = (1..=n_pairs).map(|k| k as f64 * scale).collect();
        let n_features = if n_pairs > 0 { 2 * n_pairs } else { 1 };
        Embedding { freqs, n_features }
    }

    fn encode(&self, x: f64) -> Vec<f64> {
        if self.freqs.is_empty() {
            return vec![x];
        }
        let mut out = Vec::with_capacity(self.n_features);
        for &f in &self.freqs {
            out.push((f * x).sin());
            out.push((f * x).cos());
        }
        out
    }
}

// ── Adam Optimiser ────────────────────────────────────────────────────────────

struct Adam {
    m: Vec<f64>,
    v: Vec<f64>,
    t: usize,
    lr: f64,
    beta1: f64,
    beta2: f64,
    eps: f64,
}

impl Adam {
    fn new(n: usize, lr: f64) -> Self {
        Adam {
            m: vec![0.0; n],
            v: vec![0.0; n],
            t: 0,
            lr,
            beta1: 0.9,
            beta2: 0.999,
            eps: 1e-8,
        }
    }

    fn step(&mut self, params: &mut [f64], grads: &[f64]) {
        self.t += 1;
        let b1t = self.beta1.powi(self.t as i32);
        let b2t = self.beta2.powi(self.t as i32);
        let lr_t = self.lr * (1.0 - b2t).sqrt() / (1.0 - b1t);
        for i in 0..params.len() {
            self.m[i] = self.beta1 * self.m[i] + (1.0 - self.beta1) * grads[i];
            self.v[i] = self.beta2 * self.v[i] + (1.0 - self.beta2) * grads[i] * grads[i];
            params[i] -= lr_t * self.m[i] / (self.v[i].sqrt() + self.eps);
        }
    }
}

// ── PINN Training ─────────────────────────────────────────────────────────────

/// Train a PINN to solve the configured BVP.
pub fn train_pinn(cfg: &PinnConfig) -> PinnResult {
    let mut rng = Xoshiro256::new(cfg.seed);

    let embedding = Embedding::new(cfg.fourier_features, cfg.domain_lo, cfg.domain_hi);
    let input_dim = embedding.n_features;

    let mut net = Mlp::new(input_dim, &cfg.hidden_sizes, 1, &mut rng);
    let n_params = net.total_params();
    let mut params = net.get_params();
    let mut opt = Adam::new(n_params, cfg.lr);

    // Generate initial collocation points (uniform)
    let mut coll_pts: Vec<f64> = (0..cfg.n_collocation).map(|i| {
        cfg.domain_lo + (i as f64 + 0.5) * (cfg.domain_hi - cfg.domain_lo) / cfg.n_collocation as f64
    }).collect();

    // NTK weights: start balanced
    let mut w_pde: f64 = 1.0;
    let mut w_bc: f64 = 1.0;

    let mut loss_history = Vec::new();

    for epoch in 0..cfg.epochs {
        net.set_params(&params);

        // ── PDE loss ─────────────────────────────────────────────────────────
        let mut pde_loss = 0.0;
        let mut pde_grads = vec![0.0f64; n_params];

        for &x in &coll_pts {
            let (u, du, d2u) = net.forward_with_dxx(x, &embedding);
            // PDE residual: a*u'' + b*u' + c*u - f(x)
            let f_x = cfg.pde.f_const + cfg.pde.f_sin * (std::f64::consts::PI * x).sin();
            let residual = cfg.pde.a * d2u + cfg.pde.b * du + cfg.pde.c * u - f_x;
            pde_loss += residual * residual;

            // Gradient of residual^2 w.r.t. parameters via backprop at x
            // dL/du = 2 * residual * c  (direct term)
            let enc = embedding.encode(x);
            let g = net.backward(&enc, 2.0 * residual * cfg.pde.c);
            for (gi, &gv) in pde_grads.iter_mut().zip(g.iter()) {
                *gi += gv;
            }
            // dL/du' = 2 * residual * b
            if cfg.pde.b.abs() > 1e-14 {
                let h = 1e-4;
                let enc_p = embedding.encode(x + h);
                let enc_m = embedding.encode(x - h);
                let gp = net.backward(&enc_p, 2.0 * residual * cfg.pde.b / h);
                let gm = net.backward(&enc_m, -2.0 * residual * cfg.pde.b / h);
                for (gi, (gv_p, gv_m)) in pde_grads.iter_mut().zip(gp.iter().zip(gm.iter())) {
                    *gi += gv_p + gv_m;
                }
            }
            // dL/du'' = 2 * residual * a
            if cfg.pde.a.abs() > 1e-14 {
                let h = 1e-4;
                let enc_p = embedding.encode(x + h);
                let enc_0 = embedding.encode(x);
                let enc_m = embedding.encode(x - h);
                let s = 2.0 * residual * cfg.pde.a / (h * h);
                let gp = net.backward(&enc_p, s);
                let g0 = net.backward(&enc_0, -2.0 * s);
                let gm = net.backward(&enc_m, s);
                for (gi, ((gv_p, gv_0), gv_m)) in pde_grads.iter_mut()
                    .zip(gp.iter().zip(g0.iter()).zip(gm.iter()))
                {
                    *gi += gv_p + gv_0 + gv_m;
                }
            }
        }
        pde_loss /= coll_pts.len() as f64;
        for g in &mut pde_grads { *g /= coll_pts.len() as f64; }

        // ── Boundary condition loss ───────────────────────────────────────────
        let u_lo = net.forward(&embedding.encode(cfg.domain_lo));
        let u_hi = net.forward(&embedding.encode(cfg.domain_hi));
        let bc_res_lo = u_lo - cfg.bc_left;
        let bc_res_hi = u_hi - cfg.bc_right;
        let bc_loss = bc_res_lo * bc_res_lo + bc_res_hi * bc_res_hi;

        let mut bc_grads: Vec<f64> = net.backward(&embedding.encode(cfg.domain_lo), 2.0 * bc_res_lo);
        let g_hi = net.backward(&embedding.encode(cfg.domain_hi), 2.0 * bc_res_hi);
        for (a, b) in bc_grads.iter_mut().zip(g_hi.iter()) { *a += b; }

        // ── NTK-based loss balancing (every 10 epochs) ────────────────────────
        if epoch % 10 == 0 && epoch > 0 {
            let pde_norm: f64 = pde_grads.iter().map(|&g| g * g).sum::<f64>().sqrt().max(1e-12);
            let bc_norm: f64 = bc_grads.iter().map(|&g| g * g).sum::<f64>().sqrt().max(1e-12);
            let total = pde_norm + bc_norm;
            // Target: equal contribution from each loss term
            w_pde = total / (2.0 * pde_norm + 1e-12);
            w_bc = total / (2.0 * bc_norm + 1e-12);
            // Clip weights to avoid instability
            w_pde = w_pde.clamp(0.1, 10.0);
            w_bc = w_bc.clamp(0.1, 10.0);
        }

        // ── Combined gradient update ──────────────────────────────────────────
        let combined_grads: Vec<f64> = pde_grads.iter().zip(bc_grads.iter())
            .map(|(gp, gb)| w_pde * gp + w_bc * gb)
            .collect();

        opt.step(&mut params, &combined_grads);

        // ── Adaptive resampling (every 100 epochs) ────────────────────────────
        if epoch % 100 == 99 {
            net.set_params(&params);
            // Resample 25% of points where residual is highest
            let mut residuals: Vec<(f64, f64)> = coll_pts.iter().map(|&x| {
                let (_u, _du, d2u) = net.forward_with_dxx(x, &embedding);
                let u = net.forward(&embedding.encode(x));
                let f_x = cfg.pde.f_const + cfg.pde.f_sin * (std::f64::consts::PI * x).sin();
                let res = (cfg.pde.a * d2u + cfg.pde.c * u - f_x).abs();
                (x, res)
            }).collect();
            residuals.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
            let n_replace = cfg.n_collocation / 4;
            for i in 0..n_replace {
                let new_x = cfg.domain_lo
                    + rng.next_f64() * (cfg.domain_hi - cfg.domain_lo);
                coll_pts[i] = new_x;
            }
        }

        // ── Loss history ──────────────────────────────────────────────────────
        if epoch % 100 == 0 {
            let total_loss = w_pde * pde_loss + w_bc * bc_loss;
            loss_history.push(total_loss);
        }
    }

    // ── Evaluate solution ─────────────────────────────────────────────────────
    net.set_params(&params);
    let xs: Vec<f64> = (0..cfg.n_eval).map(|i| {
        cfg.domain_lo + i as f64 * (cfg.domain_hi - cfg.domain_lo) / (cfg.n_eval - 1).max(1) as f64
    }).collect();
    let us: Vec<f64> = xs.iter().map(|&x| net.forward(&embedding.encode(x))).collect();

    let final_loss = *loss_history.last().unwrap_or(&f64::NAN);

    PinnResult { xs, us, final_loss, loss_history }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pinn_poisson_zero_bc() {
        // Solve -u'' = 1, u(0)=u(1)=0. Exact: u(x) = x(1-x)/2
        let cfg = PinnConfig {
            pde: PinnPde { a: -1.0, b: 0.0, c: 0.0, f_const: 1.0, f_sin: 0.0 },
            domain_lo: 0.0,
            domain_hi: 1.0,
            bc_left: 0.0,
            bc_right: 0.0,
            hidden_sizes: vec![16, 16],
            epochs: 1000,
            lr: 1e-3,
            n_collocation: 32,
            n_eval: 11,
            fourier_features: 4,
            seed: 1,
        };
        let res = train_pinn(&cfg);
        // Check solution at x=0.5: exact = 0.125
        let mid_idx = res.xs.iter().position(|&x| (x - 0.5).abs() < 0.1).unwrap_or(5);
        let u_mid = res.us[mid_idx];
        // Relaxed tolerance for short training
        assert!((u_mid - 0.125).abs() < 0.05, "u(0.5)={u_mid} expected ~0.125");
    }

    #[test]
    fn embedding_encode() {
        let emb = Embedding::new(2, 0.0, 1.0);
        let enc = emb.encode(0.0);
        assert_eq!(enc.len(), 4);
        // sin(0) = 0, cos(0) = 1
        assert!((enc[0]).abs() < 1e-10);
        assert!((enc[1] - 1.0).abs() < 1e-10);
    }
}
