//! SIMP Topology Optimisation (item 2.119).
//!
//! Minimises structural compliance (= maximises stiffness) for a 2D rectangular
//! domain using the SIMP (Solid Isotropic Material with Penalization) method.
//!
//! ## Problem
//!
//! ```text
//! min C(ρ) = uᵀKu = fᵀu
//! s.t. V(ρ)/V₀ = f_vol (volume fraction)
//!      0 < ρ_min ≤ ρ_e ≤ 1
//! ```
//!
//! where K(ρ) = Σ_e ρ_e^p · k₀ (global stiffness, SIMP penalisation p=3).
//!
//! ## FEM discretization
//!
//! Q4 bilinear quadrilateral elements on a regular n_x × n_y mesh.
//! Plane-stress material: E=1, ν=0.3.
//! Degrees of freedom: 2 per node = 2(n_x+1)(n_y+1).
//!
//! ## Boundary conditions
//!
//! - **Cantilever beam** (default): left edge fixed (all DOF = 0), point load F=-1
//!   applied at mid-height of the right edge in the y-direction.
//!
//! ## Update scheme
//!
//! Optimality Criteria (OC) with bisection to enforce the volume constraint.
//! Sensitivity filter: weighted average with radius r_min.
//!
//! ## Output
//!
//! Returns a Table with columns `["x", "y", "density"]` — one row per element.

use crate::types::Value;

// ── Constants ────────────────────────────────────────────────────────────────

const NU: f64 = 0.3;      // Poisson's ratio
const PENAL: f64 = 3.0;   // SIMP penalisation
const RHO_MIN: f64 = 1e-3; // Void stiffness (avoids singularity)
const MOVE: f64 = 0.2;    // OC move limit

/// Topology optimisation configuration.
pub struct TopoConfig {
    /// Number of elements in x direction.
    pub nx: usize,
    /// Number of elements in y direction.
    pub ny: usize,
    /// Target volume fraction (fraction of solid material).
    pub vol_frac: f64,
    /// Density filter radius (in element lengths).
    pub r_min: f64,
    /// Maximum number of OC iterations.
    pub max_iter: usize,
    /// Convergence tolerance on change in density field.
    pub tol: f64,
}

impl Default for TopoConfig {
    fn default() -> Self {
        Self {
            nx: 40,
            ny: 20,
            vol_frac: 0.4,
            r_min: 1.5,
            max_iter: 100,
            tol: 1e-3,
        }
    }
}

/// Run SIMP topology optimisation.
///
/// Returns a Table with columns `["x", "y", "density"]`.
pub fn simp_topology(config: &TopoConfig) -> Value {
    let nx = config.nx.max(2);
    let ny = config.ny.max(2);
    let n_el = nx * ny;
    let n_node = (nx + 1) * (ny + 1);
    let n_dof = 2 * n_node;

    // ── Element stiffness matrix (8×8, computed once) ─────────────────────
    let ke = element_stiffness_matrix();

    // ── DOF map: element e → [u1,v1, u2,v2, u3,v3, u4,v4] ───────────────
    // Node numbering: row-major, node(ix, iy) = iy*(nx+1) + ix
    // Element(ix, iy): nodes (ix,iy), (ix+1,iy), (ix+1,iy+1), (ix,iy+1)
    let edof: Vec<[usize; 8]> = {
        let mut v = Vec::with_capacity(n_el);
        for iy in 0..ny {
            for ix in 0..nx {
                let n1 = iy * (nx + 1) + ix;
                let n2 = iy * (nx + 1) + ix + 1;
                let n3 = (iy + 1) * (nx + 1) + ix + 1;
                let n4 = (iy + 1) * (nx + 1) + ix;
                v.push([
                    2 * n1, 2 * n1 + 1,
                    2 * n2, 2 * n2 + 1,
                    2 * n3, 2 * n3 + 1,
                    2 * n4, 2 * n4 + 1,
                ]);
            }
        }
        v
    };

    // ── Fixed DOF (cantilever: left edge, ix=0) ───────────────────────────
    let mut fixed: Vec<bool> = vec![false; n_dof];
    for iy in 0..=ny {
        let nid = iy * (nx + 1); // ix=0
        fixed[2 * nid] = true;
        fixed[2 * nid + 1] = true;
    }
    // Free DOF list
    let free: Vec<usize> = (0..n_dof).filter(|&d| !fixed[d]).collect();
    let n_free = free.len();

    // ── Force vector (point load at mid-right, y-direction) ───────────────
    let mut f_full = vec![0.0_f64; n_dof];
    {
        let iy_mid = ny / 2;
        let nid = iy_mid * (nx + 1) + nx; // ix=nx (rightmost)
        f_full[2 * nid + 1] = -1.0; // downward load
    }
    let f_free: Vec<f64> = free.iter().map(|&d| f_full[d]).collect();

    // ── Sensitivity filter weights ─────────────────────────────────────────
    // For each element e, precompute (neighbor, weight) pairs
    let r_min = config.r_min.max(1.0);
    let filter: Vec<Vec<(usize, f64)>> = {
        let mut flt = Vec::with_capacity(n_el);
        for iy in 0..ny {
            for ix in 0..nx {
                let iy_i = iy as isize;
                let ix_i = ix as isize;
                let r_ceil = r_min.ceil() as isize;
                let mut neighbours: Vec<(usize, f64)> = Vec::new();
                for jy in (iy_i - r_ceil)..=(iy_i + r_ceil) {
                    for jx in (ix_i - r_ceil)..=(ix_i + r_ceil) {
                        if jx < 0 || jy < 0 || jx >= nx as isize || jy >= ny as isize {
                            continue;
                        }
                        let dist = ((ix_i - jx).pow(2) + (iy_i - jy).pow(2)) as f64;
                        let dist = dist.sqrt();
                        let w = (r_min - dist).max(0.0);
                        if w > 0.0 {
                            let je = jy as usize * nx + jx as usize;
                            neighbours.push((je, w));
                        }
                    }
                }
                flt.push(neighbours);
            }
        }
        flt
    };

    // ── Initial density ────────────────────────────────────────────────────
    let mut rho: Vec<f64> = vec![config.vol_frac; n_el];

    // ── Main OC loop ───────────────────────────────────────────────────────
    for _iter in 0..config.max_iter {
        // Assemble global stiffness (free DOF only)
        let mut k_free = vec![0.0_f64; n_free * n_free];

        for (e, dofs) in edof.iter().enumerate() {
            let rho_e = rho[e].max(RHO_MIN);
            let scale = rho_e.powf(PENAL);
            for (li, &di) in dofs.iter().enumerate() {
                let fi = free.iter().position(|&d| d == di);
                let Some(fi) = fi else { continue };
                for (lj, &dj) in dofs.iter().enumerate() {
                    let fj = free.iter().position(|&d| d == dj);
                    let Some(fj) = fj else { continue };
                    k_free[fi * n_free + fj] += scale * ke[li][lj];
                }
            }
        }

        // Solve K_free * u_free = f_free via conjugate gradient
        let u_free = conjugate_gradient(&k_free, &f_free, n_free, 1e-8, 2 * n_free);

        // Reconstruct full displacement
        let mut u = vec![0.0_f64; n_dof];
        for (i, &d) in free.iter().enumerate() {
            u[d] = u_free[i];
        }

        // Compliance
        let compliance: f64 = f_full.iter().zip(u.iter()).map(|(&fi, &ui)| fi * ui).sum();

        // Sensitivities ∂C/∂ρ_e = -p * ρ_e^(p-1) * u_e^T * k0 * u_e
        let mut dc = vec![0.0_f64; n_el];
        for (e, dofs) in edof.iter().enumerate() {
            let ue: Vec<f64> = dofs.iter().map(|&d| u[d]).collect();
            // u_e^T * k0 * u_e
            let mut utku = 0.0_f64;
            for i in 0..8 {
                for j in 0..8 {
                    utku += ue[i] * ke[i][j] * ue[j];
                }
            }
            dc[e] = -PENAL * rho[e].max(RHO_MIN).powf(PENAL - 1.0) * utku;
        }

        // Apply sensitivity filter
        let dc_filt = apply_filter(&dc, &rho, &filter);

        // OC update with bisection for volume constraint
        let rho_new = oc_update(&rho, &dc_filt, config.vol_frac);

        // Check convergence
        let max_change: f64 = rho_new
            .iter()
            .zip(rho.iter())
            .map(|(a, b)| (a - b).abs())
            .fold(0.0_f64, f64::max);

        rho = rho_new;

        let _ = compliance; // used for potential early exit
        if max_change < config.tol {
            break;
        }
    }

    // ── Build output table ─────────────────────────────────────────────────
    let columns = vec!["x".to_string(), "y".to_string(), "density".to_string()];
    let mut rows: Vec<Vec<f64>> = Vec::with_capacity(n_el);
    for iy in 0..ny {
        for ix in 0..nx {
            let e = iy * nx + ix;
            rows.push(vec![ix as f64, iy as f64, rho[e]]);
        }
    }

    Value::Table { columns, rows }
}

// ── OC update ────────────────────────────────────────────────────────────────

fn oc_update(rho: &[f64], dc: &[f64], vol_frac: f64) -> Vec<f64> {
    let n = rho.len();
    let n_f64 = n as f64;

    let mut lo = 0.0_f64;
    let mut hi = 1e10_f64;

    let mut rho_new = rho.to_vec();

    for _ in 0..50 {
        let mid = (lo + hi) / 2.0;
        for e in 0..n {
            let b_e = (-dc[e] / mid).max(0.0).sqrt();
            rho_new[e] = (rho[e] * b_e)
                .clamp(
                    (rho[e] - MOVE).max(RHO_MIN),
                    (rho[e] + MOVE).min(1.0),
                );
        }
        let vol: f64 = rho_new.iter().sum::<f64>() / n_f64;
        if vol > vol_frac {
            lo = mid;
        } else {
            hi = mid;
        }
        if hi - lo < 1e-6 {
            break;
        }
    }

    rho_new
}

// ── Sensitivity filter ────────────────────────────────────────────────────────

fn apply_filter(dc: &[f64], rho: &[f64], filter: &[Vec<(usize, f64)>]) -> Vec<f64> {
    let n = dc.len();
    let mut dc_filt = vec![0.0_f64; n];

    for e in 0..n {
        let mut sum_w = 0.0_f64;
        let mut sum_wr = 0.0_f64;
        for &(j, w) in &filter[e] {
            sum_w += w * rho[j];
            sum_wr += w * rho[j] * dc[j];
        }
        if sum_w.abs() > 1e-15 {
            dc_filt[e] = sum_wr / (rho[e].max(RHO_MIN) * sum_w);
        } else {
            dc_filt[e] = dc[e];
        }
    }

    dc_filt
}

// ── Conjugate Gradient solver ─────────────────────────────────────────────────

fn conjugate_gradient(
    a: &[f64],   // n×n row-major
    b: &[f64],   // n
    n: usize,
    tol: f64,
    max_iter: usize,
) -> Vec<f64> {
    let mut x = vec![0.0_f64; n];
    let mut r: Vec<f64> = b.iter().enumerate().map(|(i, &bi)| {
        bi - (0..n).map(|j| a[i * n + j] * x[j]).sum::<f64>()
    }).collect();
    let mut p = r.clone();
    let mut r_sq: f64 = r.iter().map(|&ri| ri * ri).sum();

    for _ in 0..max_iter {
        if r_sq < tol * tol {
            break;
        }
        // Ap
        let ap: Vec<f64> = (0..n)
            .map(|i| (0..n).map(|j| a[i * n + j] * p[j]).sum::<f64>())
            .collect();
        let p_ap: f64 = p.iter().zip(ap.iter()).map(|(&pi, &api)| pi * api).sum();
        if p_ap.abs() < 1e-20 {
            break;
        }
        let alpha = r_sq / p_ap;
        for i in 0..n {
            x[i] += alpha * p[i];
            r[i] -= alpha * ap[i];
        }
        let r_sq_new: f64 = r.iter().map(|&ri| ri * ri).sum();
        let beta = r_sq_new / r_sq;
        r_sq = r_sq_new;
        for i in 0..n {
            p[i] = r[i] + beta * p[i];
        }
    }
    x
}

// ── Q4 element stiffness (8×8) ────────────────────────────────────────────────

/// Compute 8×8 element stiffness matrix for unit square Q4, plane stress E=1, ν=NU.
/// Uses 2×2 Gauss quadrature.
fn element_stiffness_matrix() -> [[f64; 8]; 8] {
    let nu = NU;
    // D matrix (plane stress, E=1)
    let d11 = 1.0 / (1.0 - nu * nu);
    let d12 = nu / (1.0 - nu * nu);
    let d33 = 0.5 * (1.0 - nu) / (1.0 - nu * nu);

    let d = [[d11, d12, 0.0], [d12, d11, 0.0], [0.0, 0.0, d33]];

    // Gauss points in [-1,1]: ±1/√3, weights = 1
    let gp = 1.0_f64 / 3.0_f64.sqrt();
    let gpts = [(-gp, -gp), (gp, -gp), (gp, gp), (-gp, gp)];

    let mut ke = [[0.0_f64; 8]; 8];

    for &(xi, eta) in &gpts {
        // Shape function derivatives in natural coords
        // N1=(1-ξ)(1-η)/4, N2=(1+ξ)(1-η)/4, N3=(1+ξ)(1+η)/4, N4=(1-ξ)(1+η)/4
        let dn_dxi = [
            -(1.0 - eta) / 4.0,
             (1.0 - eta) / 4.0,
             (1.0 + eta) / 4.0,
            -(1.0 + eta) / 4.0,
        ];
        let dn_deta = [
            -(1.0 - xi) / 4.0,
            -(1.0 + xi) / 4.0,
             (1.0 + xi) / 4.0,
             (1.0 - xi) / 4.0,
        ];

        // Jacobian for unit square (physical coords x=ξ/2+0.5, y=η/2+0.5)
        // J = 0.5 * I, det(J) = 0.25
        let det_j = 0.25_f64;
        // ∂N/∂x = 2*∂N/∂ξ, ∂N/∂y = 2*∂N/∂η
        let dn_dx: Vec<f64> = dn_dxi.iter().map(|&v| 2.0 * v).collect();
        let dn_dy: Vec<f64> = dn_deta.iter().map(|&v| 2.0 * v).collect();

        // B matrix (3×8):
        // row 0: [∂N1/∂x, 0,       ∂N2/∂x, 0,       ∂N3/∂x, 0,       ∂N4/∂x, 0      ]
        // row 1: [0,       ∂N1/∂y, 0,       ∂N2/∂y, 0,       ∂N3/∂y, 0,       ∂N4/∂y]
        // row 2: [∂N1/∂y, ∂N1/∂x, ∂N2/∂y, ∂N2/∂x, ∂N3/∂y, ∂N3/∂x, ∂N4/∂y, ∂N4/∂x]

        let mut b = [[0.0_f64; 8]; 3];
        for i in 0..4 {
            b[0][2 * i] = dn_dx[i];
            b[1][2 * i + 1] = dn_dy[i];
            b[2][2 * i] = dn_dy[i];
            b[2][2 * i + 1] = dn_dx[i];
        }

        // ke += B^T * D * B * det_j * weight (weight=1 for each Gauss point)
        // D*B (3×8)
        let mut db = [[0.0_f64; 8]; 3];
        for row in 0..3 {
            for col in 0..8 {
                for k in 0..3 {
                    db[row][col] += d[row][k] * b[k][col];
                }
            }
        }
        // B^T * D * B (8×8)
        for i in 0..8 {
            for j in 0..8 {
                let mut sum = 0.0;
                for k in 0..3 {
                    sum += b[k][i] * db[k][j];
                }
                ke[i][j] += sum * det_j;
            }
        }
    }

    ke
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn element_stiffness_positive_definite() {
        // ke should be symmetric and positive semi-definite
        let ke = element_stiffness_matrix();
        for i in 0..8 {
            for j in 0..8 {
                assert!((ke[i][j] - ke[j][i]).abs() < 1e-10, "Not symmetric at ({i},{j})");
            }
        }
        // Diagonal elements should be positive
        for i in 0..8 {
            assert!(ke[i][i] > 0.0, "Diagonal ke[{i}][{i}] = {}", ke[i][i]);
        }
    }

    #[test]
    fn simp_small_mesh() {
        let config = TopoConfig {
            nx: 6,
            ny: 4,
            vol_frac: 0.5,
            r_min: 1.5,
            max_iter: 30,
            tol: 1e-2,
        };
        let result = simp_topology(&config);
        if let Value::Table { columns, rows } = &result {
            assert!(columns.contains(&"density".to_string()));
            assert_eq!(rows.len(), 6 * 4, "expected 24 elements");
            // All densities in [rho_min, 1]
            for row in rows {
                let d = row[2];
                assert!(d >= 1e-4 && d <= 1.0 + 1e-10, "density = {d}");
            }
        } else {
            panic!("Expected Table");
        }
    }

    #[test]
    fn simp_volume_fraction_respected() {
        let config = TopoConfig {
            nx: 10,
            ny: 5,
            vol_frac: 0.4,
            r_min: 1.5,
            max_iter: 50,
            tol: 1e-3,
        };
        let result = simp_topology(&config);
        if let Value::Table { rows, .. } = &result {
            let total_vol: f64 = rows.iter().map(|r| r[2]).sum::<f64>() / rows.len() as f64;
            assert!((total_vol - 0.4).abs() < 0.05, "vol = {total_vol}");
        } else {
            panic!("Expected Table");
        }
    }
}
