//! 2D Finite Element Method (FEM) solver (2.38).
//!
//! Solves the 2D Poisson equation −∇·(k∇u) = f on a rectangular domain
//! using P1 (linear) triangular elements on a structured mesh.
//!
//! ## Formulation
//!
//! −k∇²u = f  on Ω = [x0, x1] × [y0, y1]
//! u = g_D     on Γ_D  (Dirichlet boundary, currently all boundaries)
//! k∂u/∂n = g_N on Γ_N  (Neumann, optional on specified edges)
//!
//! ## Mesh
//!
//! Structured grid with `nx × ny` cells, each split into 2 triangles:
//!
//!   (i,j+1)----(i+1,j+1)
//!     |   \        |
//!     |    \       |
//!   (i,j)----(i+1,j)
//!
//! Triangle 1: (i,j), (i+1,j), (i+1,j+1)
//! Triangle 2: (i,j), (i+1,j+1), (i,j+1)
//!
//! ## Assembly
//!
//! For each triangle, assemble local stiffness matrix K_local (3×3) and
//! load vector f_local (3×1), accumulate into global K and f.
//! Apply Dirichlet conditions by row-zeroing and setting K_ii=1, f_i=g_D.
//! Solve K·u = f using Gauss elimination.
//!
//! Reference: Brenner & Scott "The Mathematical Theory of Finite Element Methods" (2008).

use crate::autodiff_linsolve::gauss_solve;
use std::collections::HashMap;

/// Node coordinates and connectivity for a 2D triangular mesh.
#[derive(Debug, Clone)]
pub struct Mesh2D {
    /// Node coordinates: nodes[i] = (x, y).
    pub nodes: Vec<(f64, f64)>,
    /// Triangular elements: tris[e] = [node0, node1, node2].
    pub tris: Vec<[usize; 3]>,
    /// Number of nodes in x direction (nx_nodes = nx + 1).
    pub nx_nodes: usize,
    /// Number of nodes in y direction.
    pub ny_nodes: usize,
}

/// Generate a structured triangular mesh on [x0, x1] × [y0, y1].
pub fn generate_mesh(x0: f64, x1: f64, y0: f64, y1: f64, nx: usize, ny: usize) -> Mesh2D {
    let nx_nodes = nx + 1;
    let ny_nodes = ny + 1;
    let n_nodes = nx_nodes * ny_nodes;

    let mut nodes = Vec::with_capacity(n_nodes);
    let hx = (x1 - x0) / nx as f64;
    let hy = (y1 - y0) / ny as f64;

    for j in 0..ny_nodes {
        for i in 0..nx_nodes {
            nodes.push((x0 + i as f64 * hx, y0 + j as f64 * hy));
        }
    }

    let mut tris = Vec::with_capacity(2 * nx * ny);
    let idx = |i: usize, j: usize| j * nx_nodes + i;

    for j in 0..ny {
        for i in 0..nx {
            // Triangle 1: lower-right
            tris.push([idx(i, j), idx(i + 1, j), idx(i + 1, j + 1)]);
            // Triangle 2: upper-left
            tris.push([idx(i, j), idx(i + 1, j + 1), idx(i, j + 1)]);
        }
    }

    Mesh2D { nodes, tris, nx_nodes, ny_nodes }
}

/// P1 local stiffness matrix for a triangle with vertices (x0,y0), (x1,y1), (x2,y2).
/// K_local[i][j] = k × ∫ ∇φ_i · ∇φ_j dA
/// where φ_i are the barycentric basis functions.
fn local_stiffness(nodes: &[(f64, f64)], tri: &[usize; 3], k: f64) -> [[f64; 3]; 3] {
    let (x0, y0) = nodes[tri[0]];
    let (x1, y1) = nodes[tri[1]];
    let (x2, y2) = nodes[tri[2]];

    // Area via cross product
    let area = 0.5 * ((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0));
    let area = area.abs();

    if area < 1e-14 { return [[0.0; 3]; 3]; }

    // Gradients of basis functions: ∇φ_i = (b_i, c_i) / (2A)
    // b_i = y_{i+1} - y_{i-1}, c_i = x_{i-1} - x_{i+1} (cyclic)
    let b = [y1 - y2, y2 - y0, y0 - y1];
    let c = [x2 - x1, x0 - x2, x1 - x0];

    let mut k_local = [[0.0f64; 3]; 3];
    for i in 0..3 {
        for j in 0..3 {
            k_local[i][j] = k * (b[i] * b[j] + c[i] * c[j]) / (4.0 * area);
        }
    }
    k_local
}

/// P1 local load vector for a triangle: f_local[i] = ∫ f × φ_i dA ≈ f(centroid) × A/3.
fn local_load(nodes: &[(f64, f64)], tri: &[usize; 3], rhs_fn: &dyn Fn(f64, f64) -> f64) -> [f64; 3] {
    let (x0, y0) = nodes[tri[0]];
    let (x1, y1) = nodes[tri[1]];
    let (x2, y2) = nodes[tri[2]];

    let area = 0.5 * ((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)).abs();
    let xc = (x0 + x1 + x2) / 3.0;
    let yc = (y0 + y1 + y2) / 3.0;
    let f_val = rhs_fn(xc, yc);
    [f_val * area / 3.0; 3]
}

/// Result of a 2D FEM solve.
#[derive(Debug, Clone)]
pub struct Fem2DResult {
    /// Solution u at each node.
    pub u: Vec<f64>,
    /// Node coordinates.
    pub nodes: Vec<(f64, f64)>,
    /// Triangle connectivity.
    pub tris: Vec<[usize; 3]>,
    /// Number of interior nodes (Dirichlet conditions).
    pub n_dirichlet: usize,
}

/// Solve −k∇²u = f on [x0,x1]×[y0,y1] with Dirichlet u=g_D on all boundaries.
///
/// - `nx`, `ny`: number of cells in each direction
/// - `k`: diffusion coefficient (scalar, uniform)
/// - `rhs_expr`: expression for f(x,y) — available vars: x, y
/// - `dirichlet_expr`: expression for g_D(x,y) on boundary — available vars: x, y
pub fn solve_fem2d(
    x0: f64, x1: f64,
    y0: f64, y1: f64,
    nx: usize, ny: usize,
    k: f64,
    rhs_expr: &str,
    dirichlet_expr: &str,
) -> Result<Fem2DResult, String> {
    let mesh = generate_mesh(x0, x1, y0, y1, nx.max(1), ny.max(1));
    let n = mesh.nodes.len();

    // Evaluate RHS and Dirichlet functions via expression evaluator
    let eval = |expr: &str, x: f64, y: f64| -> f64 {
        let mut vars = HashMap::new();
        vars.insert("x".to_string(), x);
        vars.insert("y".to_string(), y);
        crate::expr::eval_expr(expr, &vars).unwrap_or(0.0)
    };

    let rhs_fn = |x: f64, y: f64| eval(rhs_expr, x, y);

    // Detect boundary nodes
    let eps = 1e-10;
    let is_boundary = |node_idx: usize| -> bool {
        let (x, y) = mesh.nodes[node_idx];
        (x - x0).abs() < eps || (x - x1).abs() < eps ||
        (y - y0).abs() < eps || (y - y1).abs() < eps
    };

    // Global stiffness (dense, row-major) and load vector
    let mut k_global = vec![0.0f64; n * n];
    let mut f_global = vec![0.0f64; n];

    // Assembly
    for tri in &mesh.tris {
        let k_loc = local_stiffness(&mesh.nodes, tri, k);
        let f_loc = local_load(&mesh.nodes, tri, &rhs_fn);
        for (li, &gi) in tri.iter().enumerate() {
            f_global[gi] += f_loc[li];
            for (lj, &gj) in tri.iter().enumerate() {
                k_global[gi * n + gj] += k_loc[li][lj];
            }
        }
    }

    // Apply Dirichlet boundary conditions
    // Standard elimination: for each boundary node i with value g_i,
    // subtract K[j,i]*g_i from f[j] for all other nodes j, then zero
    // row/column i and set K[i,i]=1, f[i]=g_i.
    let mut n_dirichlet = 0;
    for i in 0..n {
        if is_boundary(i) {
            n_dirichlet += 1;
            let (x, y) = mesh.nodes[i];
            let g = eval(dirichlet_expr, x, y);
            for j in 0..n {
                if j != i {
                    f_global[j] -= k_global[j * n + i] * g;
                    k_global[j * n + i] = 0.0;
                    k_global[i * n + j] = 0.0;
                }
            }
            k_global[i * n + i] = 1.0;
            f_global[i] = g;
        }
    }

    let u = gauss_solve(&k_global, &f_global)
        .ok_or_else(|| "fem2d: stiffness matrix is singular".to_string())?;

    Ok(Fem2DResult {
        u,
        nodes: mesh.nodes,
        tris: mesh.tris,
        n_dirichlet,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn poisson_constant_source() {
        // −∇²u = 1 on [0,1]², u=0 on boundary
        // Exact solution: u(x,y) = 0.25 - sum_mn Fourier terms
        // Maximum near (0.5, 0.5) ≈ 0.0736957...
        let result = solve_fem2d(0.0, 1.0, 0.0, 1.0, 8, 8, 1.0, "1", "0").unwrap();
        let (x_mid, y_mid) = (0.5, 0.5);
        let idx_mid = result.nodes.iter().position(|&(x, y)| (x - x_mid).abs() < 0.07 && (y - y_mid).abs() < 0.07);
        if let Some(i) = idx_mid {
            let u_approx = result.u[i];
            // Should be roughly 0.07 at centre
            assert!(u_approx > 0.05 && u_approx < 0.12,
                "u at center ≈ {:.5}, expected ~0.07", u_approx);
        }
    }

    #[test]
    fn dirichlet_constant_bc() {
        // u = 5 everywhere on boundary, f=0 → u=5 everywhere
        let result = solve_fem2d(0.0, 1.0, 0.0, 1.0, 4, 4, 1.0, "0", "5").unwrap();
        for u_val in &result.u {
            assert!((u_val - 5.0).abs() < 1e-8, "u should be 5, got {}", u_val);
        }
    }

    #[test]
    fn mesh_size() {
        let mesh = generate_mesh(0.0, 1.0, 0.0, 1.0, 4, 4);
        assert_eq!(mesh.nodes.len(), 25); // 5×5 nodes
        assert_eq!(mesh.tris.len(), 32);  // 2×4×4 triangles
    }
}
