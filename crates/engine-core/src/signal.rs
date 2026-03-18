//! Digital IIR filter design and application.
//!
//! Implements Butterworth and Chebyshev Type I lowpass/highpass/bandpass
//! filter design via the bilinear transform, plus SOS (second-order sections)
//! filter application and zero-phase (forward-backward) filtering.
//!
//! All cutoff frequencies are normalised: 0 < fc < 1, where 1 = Nyquist (fs/2).

use std::f64::consts::PI;

/// One second-order section: H(z) = (b0 + b1*z⁻¹ + b2*z⁻²) / (a0 + a1*z⁻¹ + a2*z⁻²).
/// Stored as [b0, b1, b2, a0, a1, a2].
#[derive(Debug, Clone, Copy)]
pub struct Sos {
    pub b: [f64; 3],
    pub a: [f64; 3],
}

/// Filter type.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FilterPass {
    Lowpass,
    Highpass,
}

/// Design a digital Butterworth IIR filter and return it as SOS.
///
/// * `order`  — filter order (1–8)
/// * `cutoff` — cutoff frequency normalised to Nyquist (0 < cutoff < 1)
/// * `pass`   — Lowpass or Highpass
pub fn butterworth(order: usize, cutoff: f64, pass: FilterPass) -> Result<Vec<Sos>, String> {
    if order == 0 || order > 8 {
        return Err("butterworth: order must be 1..8".into());
    }
    if !(cutoff > 0.0 && cutoff < 1.0) {
        return Err("butterworth: cutoff must be in (0, 1)".into());
    }

    // Analog prewarped cutoff (bilinear mapping)
    let wa = (PI * cutoff / 2.0).tan();

    // Analog prototype poles for normalised Butterworth (unit cutoff):
    // pk = exp(j * π * (2k + N - 1) / (2N)), k = 0..N-1, left half-plane only
    let n = order;
    let mut analog_poles: Vec<(f64, f64)> = Vec::new(); // (re, im)
    for k in 0..n {
        let angle = PI * (2.0 * k as f64 + n as f64 - 1.0) / (2.0 * n as f64);
        let (re, im) = (angle.cos(), angle.sin());
        // Only poles in left half-plane (re < 0)
        if re < 0.0 {
            analog_poles.push((re, im));
        }
    }

    // Scale by prewarped cutoff
    let scaled: Vec<(f64, f64)> = analog_poles.iter().map(|&(r, i)| (r * wa, i * wa)).collect();

    // Convert to digital poles via bilinear: z = (1 + s) / (1 - s)
    let digital: Vec<(f64, f64)> = scaled
        .iter()
        .map(|&(sr, si)| {
            // z = (1 + (sr+j*si)) / (1 - (sr+j*si))
            let nr = 1.0 + sr;
            let ni = si;
            let dr = 1.0 - sr;
            let di = -si;
            let denom = dr * dr + di * di;
            ((nr * dr + ni * di) / denom, (ni * dr - nr * di) / denom)
        })
        .collect();

    // Pair complex conjugate poles into SOS
    // For real pole (im ≈ 0): first-order section
    // For complex conjugate pair: second-order section
    let mut sections: Vec<Sos> = Vec::new();
    let mut i = 0;
    while i < digital.len() {
        let (zr, zi) = digital[i];
        if zi.abs() < 1e-10 {
            // Real pole → first-order section (padded to SOS with b2=0, a2=0)
            let sos = match pass {
                FilterPass::Lowpass => {
                    // zeros at z=-1 → numerator (z+1), normalise gain
                    let b0 = 1.0;
                    let b1 = 1.0;
                    let a0 = 1.0;
                    let a1 = -zr;
                    let gain = (b0 + b1) / (a0 + a1); // H(1) DC gain factor
                    Sos {
                        b: [b0 / gain, b1 / gain, 0.0],
                        a: [a0, a1, 0.0],
                    }
                }
                FilterPass::Highpass => {
                    // zeros at z=+1 → numerator (z-1), normalise gain at Nyquist z=-1
                    let b0 = 1.0;
                    let b1 = -1.0;
                    let a0 = 1.0;
                    let a1 = -zr;
                    let gain_ny = (b0 - b1) / (a0 - a1); // H(-1)
                    Sos {
                        b: [b0 / gain_ny, b1 / gain_ny, 0.0],
                        a: [a0, a1, 0.0],
                    }
                }
            };
            sections.push(sos);
            i += 1;
        } else {
            // Complex conjugate pair z1 = zr+j*zi, z2 = zr-j*zi
            // Denominator: z² - 2*zr*z + (zr²+zi²)
            let a1 = -2.0 * zr;
            let a2 = zr * zr + zi * zi;
            let sos = match pass {
                FilterPass::Lowpass => {
                    // Zeros at z=-1 (double) → numerator z²+2z+1
                    let b0 = 1.0;
                    let b1 = 2.0;
                    let b2 = 1.0;
                    // DC gain: H(1) = (1+2+1)/(1+a1+a2)
                    let gain = (b0 + b1 + b2) / (1.0 + a1 + a2);
                    Sos {
                        b: [b0 / gain, b1 / gain, b2 / gain],
                        a: [1.0, a1, a2],
                    }
                }
                FilterPass::Highpass => {
                    // Zeros at z=+1 (double) → numerator z²-2z+1
                    let b0 = 1.0;
                    let b1 = -2.0;
                    let b2 = 1.0;
                    // Nyquist gain: H(-1) = (1-2+1)/(1-a1+a2) = 0/(1-a1+a2)
                    // Use opposite sign convention: zeros at z=-1 for HP
                    // Actually for highpass, zeros should be at DC (z=1), so:
                    // b = [1, -2, 1] and normalise at Nyquist z=-1
                    let gain = (b0 - b1 + b2) / (1.0 - a1 + a2);
                    Sos {
                        b: [b0 / gain, b1 / gain, b2 / gain],
                        a: [1.0, a1, a2],
                    }
                }
            };
            sections.push(sos);
            i += 2; // consumed conjugate pair
        }
    }

    Ok(sections)
}

/// Design a digital Chebyshev Type I IIR filter.
///
/// * `order`     — filter order (1–8)
/// * `cutoff`    — cutoff normalised to Nyquist (0 < cutoff < 1)
/// * `ripple_db` — passband ripple in dB (e.g. 0.5)
/// * `pass`      — Lowpass or Highpass
pub fn chebyshev1(
    order: usize,
    cutoff: f64,
    ripple_db: f64,
    pass: FilterPass,
) -> Result<Vec<Sos>, String> {
    if order == 0 || order > 8 {
        return Err("chebyshev1: order must be 1..8".into());
    }
    if !(cutoff > 0.0 && cutoff < 1.0) {
        return Err("chebyshev1: cutoff must be in (0, 1)".into());
    }
    if ripple_db <= 0.0 {
        return Err("chebyshev1: ripple_db must be positive".into());
    }

    let wa = (PI * cutoff / 2.0).tan();
    let n = order;

    // ε from ripple: ε = sqrt(10^(ripple_db/10) - 1)
    let eps = ((10.0_f64.powf(ripple_db / 10.0) - 1.0)).sqrt();
    // β = asinh(1/ε) / N
    let beta = (1.0 / eps).asinh() / n as f64;

    // Chebyshev prototype poles:
    // σk = -sinh(β)*sin((2k-1)*π/(2N))
    // ωk =  cosh(β)*cos((2k-1)*π/(2N))
    // for k = 1..N (left half-plane selection by sign of σ)
    let mut analog_poles: Vec<(f64, f64)> = Vec::new();
    for k in 1..=n {
        let theta = PI * (2 * k - 1) as f64 / (2.0 * n as f64);
        let sr = -beta.sinh() * theta.sin();
        let si = beta.cosh() * theta.cos();
        if sr < 0.0 {
            analog_poles.push((sr, si));
        }
    }

    // Scale to prewarped cutoff
    let scaled: Vec<(f64, f64)> = analog_poles.iter().map(|&(r, i)| (r * wa, i * wa)).collect();

    // Bilinear: z = (1 + s) / (1 - s)
    let digital: Vec<(f64, f64)> = scaled
        .iter()
        .map(|&(sr, si)| {
            let nr = 1.0 + sr;
            let ni = si;
            let dr = 1.0 - sr;
            let di = -si;
            let denom = dr * dr + di * di;
            ((nr * dr + ni * di) / denom, (ni * dr - nr * di) / denom)
        })
        .collect();

    // Build SOS (same structure as Butterworth)
    let mut sections: Vec<Sos> = Vec::new();
    let mut i = 0;
    while i < digital.len() {
        let (zr, zi) = digital[i];
        if zi.abs() < 1e-10 {
            let sos = match pass {
                FilterPass::Lowpass => {
                    let a1 = -zr;
                    let gain = 2.0 / (1.0 + a1); // H(1) normalised
                    Sos { b: [1.0 / gain, 1.0 / gain, 0.0], a: [1.0, a1, 0.0] }
                }
                FilterPass::Highpass => {
                    let a1 = -zr;
                    let gain = 2.0 / (1.0 - a1); // H(-1) normalised
                    Sos { b: [1.0 / gain, -1.0 / gain, 0.0], a: [1.0, a1, 0.0] }
                }
            };
            sections.push(sos);
            i += 1;
        } else {
            let a1 = -2.0 * zr;
            let a2 = zr * zr + zi * zi;
            let sos = match pass {
                FilterPass::Lowpass => {
                    let (b0, b1, b2) = (1.0, 2.0, 1.0);
                    let gain = (b0 + b1 + b2) / (1.0 + a1 + a2);
                    Sos { b: [b0 / gain, b1 / gain, b2 / gain], a: [1.0, a1, a2] }
                }
                FilterPass::Highpass => {
                    let (b0, b1, b2) = (1.0, -2.0, 1.0);
                    let gain = (b0 - b1 + b2) / (1.0 - a1 + a2);
                    Sos { b: [b0 / gain, b1 / gain, b2 / gain], a: [1.0, a1, a2] }
                }
            };
            sections.push(sos);
            i += 2;
        }
    }

    Ok(sections)
}

/// Apply SOS filter to a signal using direct form II transposed (causal, one-pass).
pub fn apply_sos(sections: &[Sos], signal: &[f64]) -> Vec<f64> {
    if sections.is_empty() || signal.is_empty() {
        return signal.to_vec();
    }
    let mut x = signal.to_vec();
    for sos in sections {
        x = apply_one_sos(sos, &x);
    }
    x
}

/// Zero-phase (forward-backward) SOS filtering — no phase distortion.
/// Applies the filter twice: once forward, once backward.
pub fn apply_sos_zero_phase(sections: &[Sos], signal: &[f64]) -> Vec<f64> {
    if sections.is_empty() || signal.is_empty() {
        return signal.to_vec();
    }
    // Forward pass
    let mut x = apply_sos(sections, signal);
    // Reverse
    x.reverse();
    // Backward pass
    x = apply_sos(sections, &x);
    // Reverse again
    x.reverse();
    x
}

/// Apply a single SOS biquad (direct form II transposed).
fn apply_one_sos(sos: &Sos, x: &[f64]) -> Vec<f64> {
    let [b0, b1, b2] = sos.b;
    let [_a0, a1, a2] = sos.a;
    // Normalise by a0 (should be 1.0)
    let (b0, b1, b2) = (b0 / sos.a[0], b1 / sos.a[0], b2 / sos.a[0]);
    let (a1, a2) = (a1 / sos.a[0], a2 / sos.a[0]);

    let mut y = vec![0.0_f64; x.len()];
    let mut w1 = 0.0_f64; // delay line state
    let mut w2 = 0.0_f64;

    for (i, &xi) in x.iter().enumerate() {
        let yi = b0 * xi + w1;
        w1 = b1 * xi - a1 * yi + w2;
        w2 = b2 * xi - a2 * yi;
        y[i] = yi;
    }
    y
}

/// Return the magnitude response |H(e^{jω})| of an SOS filter at normalised frequencies ω ∈ [0, 1].
/// `freqs` — vector of normalised frequencies in [0, 1] (1 = Nyquist).
/// Returns a vector of magnitude values.
pub fn frequency_response_magnitude(sections: &[Sos], freqs: &[f64]) -> Vec<f64> {
    freqs
        .iter()
        .map(|&f| {
            let omega = PI * f; // digital frequency 0..π
            let z = (std::f64::consts::E.powi(0)).max(0.0); // dummy
            // Evaluate H(e^{jω}) = product of H_k(e^{jω})
            let mut mag_sq = 1.0_f64;
            for sos in sections {
                let [b0, b1, b2] = sos.b;
                let [a0, a1, a2] = sos.a;
                // H(z) at z = e^{jω}
                // N = b0 + b1*e^{-jω} + b2*e^{-2jω}
                // D = a0 + a1*e^{-jω} + a2*e^{-2jω}
                let cos1 = omega.cos();
                let cos2 = (2.0 * omega).cos();
                let sin1 = omega.sin();
                let sin2 = (2.0 * omega).sin();
                let nr = b0 + b1 * cos1 + b2 * cos2;
                let ni = -(b1 * sin1 + b2 * sin2);
                let dr = a0 + a1 * cos1 + a2 * cos2;
                let di = -(a1 * sin1 + a2 * sin2);
                let n_mag_sq = nr * nr + ni * ni;
                let d_mag_sq = dr * dr + di * di;
                if d_mag_sq > 1e-30 {
                    mag_sq *= n_mag_sq / d_mag_sq;
                }
            }
            let _ = z; // suppress unused
            mag_sq.sqrt()
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn approx(a: f64, b: f64, tol: f64) -> bool {
        (a - b).abs() < tol
    }

    #[test]
    fn butter_lowpass_dc_gain_is_1() {
        let sos = butterworth(4, 0.3, FilterPass::Lowpass).unwrap();
        // Apply to DC signal (all-ones) — output should converge to 1
        let ones = vec![1.0_f64; 200];
        let out = apply_sos(&sos, &ones);
        let dc = out[out.len() - 1];
        assert!(approx(dc, 1.0, 0.01), "DC gain = {}", dc);
    }

    #[test]
    fn butter_highpass_dc_is_zero() {
        let sos = butterworth(4, 0.3, FilterPass::Highpass).unwrap();
        let ones = vec![1.0_f64; 200];
        let out = apply_sos(&sos, &ones);
        let dc = out[out.len() - 1].abs();
        assert!(dc < 0.05, "HP DC = {}", dc);
    }

    #[test]
    fn butter_lowpass_attenuation_above_cutoff() {
        // 4th-order Butterworth, cutoff = 0.2 normalised
        let sos = butterworth(4, 0.2, FilterPass::Lowpass).unwrap();
        // At 2× cutoff: Butterworth should be down by ~12 dB (factor ~0.25)
        let freqs: Vec<f64> = vec![0.1, 0.2, 0.4, 0.8];
        let mags = frequency_response_magnitude(&sos, &freqs);
        // DC region should pass
        assert!(mags[0] > 0.9, "passband mag = {}", mags[0]);
        // Near cutoff ~-3dB
        assert!(mags[1] > 0.5 && mags[1] < 0.9, "at-cutoff mag = {}", mags[1]);
        // Stopband should be attenuated
        assert!(mags[2] < 0.5, "stopband mag = {}", mags[2]);
    }

    #[test]
    fn cheby1_lowpass_works() {
        let sos = chebyshev1(4, 0.3, 1.0, FilterPass::Lowpass).unwrap();
        let ones = vec![1.0_f64; 200];
        let out = apply_sos(&sos, &ones);
        let dc = out[out.len() - 1];
        assert!(approx(dc, 1.0, 0.05), "Cheby1 DC = {}", dc);
    }

    #[test]
    fn zero_phase_preserves_dc() {
        let sos = butterworth(4, 0.3, FilterPass::Lowpass).unwrap();
        let ones = vec![1.0_f64; 100];
        let out = apply_sos_zero_phase(&sos, &ones);
        // Middle portion should be ~1.0 (signal edges may be transient)
        let mid = out[40..60].iter().copied().sum::<f64>() / 20.0;
        assert!(approx(mid, 1.0, 0.02), "zero-phase DC = {}", mid);
    }
}
