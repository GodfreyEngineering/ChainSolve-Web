# Function Pack Staging — v2 / v3 / v4

> Staged milestone plan for advanced function packs (roadmap item E5-4).
> Each sub-version groups blocks by domain affinity and implementation complexity.

---

## Overview

| Sub-version | Theme | Block count | Priority mix |
|-------------|-------|-------------|-------------|
| **v2** | Stats distributions + regression | 7 | 2 high, 3 medium, 2 low |
| **v3** | Combinatorics + vector/matrix foundations | 1 (+future) | 1 low |
| **v4** | Interpolation, utilities, number theory | 4 | 2 medium, 2 low |

Total: **12 blocks** across 3 staged releases.

---

## v2 — Statistical distributions & regression

Ship together because they share mathematical prerequisites (series summation,
rank ordering, cumulative probability) and target the same user profile
(data analysts, QA engineers, students in statistics courses).

| # | Op ID | Label | Category | Priority | Inputs | Notes |
|---|-------|-------|----------|----------|--------|-------|
| 1 | `prob.dist.normal_cdf` | Normal CDF | probDist | high | x, μ, σ | Φ(x). Excel NORM.DIST equivalent. |
| 2 | `prob.dist.normal_inv` | Normal Inverse | probDist | high | p, μ, σ | Φ⁻¹(p). Excel NORM.INV. |
| 3 | `prob.dist.t_cdf` | t-distribution CDF | probDist | medium | x, df | Student's t CDF. |
| 4 | `prob.dist.chi2_cdf` | χ² CDF | probDist | medium | x, df | Chi-squared CDF. |
| 5 | `prob.dist.f_cdf` | F-distribution CDF | probDist | low | x, df₁, df₂ | F CDF for ANOVA-style tests. |
| 6 | `stats.rel.r_squared` | R² | statsRel | high | c, x1…, y1… | Coefficient of determination. |
| 7 | `stats.rel.spearman` | Spearman ρ | statsRel | medium | c, x1…, y1… | Rank correlation coefficient. |

### Implementation notes (v2)

- Distribution CDFs require an error-function approximation or numerical integration in Rust. The Abramowitz & Stegun rational approximation for `erf` is standard and avoids external crate dependencies.
- The t, χ², and F CDFs can be implemented via the regularized incomplete beta function — one shared helper serves all three.
- R² reuses the existing `linreg_slope`/`linreg_intercept` infrastructure (shared series parsing from `stats.rel`).
- Spearman ρ needs a rank-transform helper before applying the Pearson formula on ranks.

### Acceptance criteria (v2)

- All 7 blocks evaluate correctly against reference values (golden fixtures).
- Edge cases: σ = 0 → error, df ≤ 0 → error, p ∉ [0,1] → error.
- `proOnly: false` — these are free-tier blocks.

---

## v3 — Combinatorics + vector/matrix foundations

Ships after v2. Currently contains the multinomial coefficient; future iterations
will add matrix determinant, transpose, and dot product as the vector/table
data model matures.

| # | Op ID | Label | Category | Priority | Inputs | Notes |
|---|-------|-------|----------|----------|--------|-------|
| 1 | `prob.comb.multinomial` | Multinomial | probComb | low | c, n1… | n! / (n1! × n2! × …) |

### Future expansion (v3+)

When the `vectorOps` / `tableOps` data model supports matrix inputs:

- `matrix.determinant` — square matrix → scalar
- `matrix.transpose` — matrix → matrix
- `vector.dot` — two vectors → scalar
- `vector.cross` — two 3-vectors → vector

These are deferred until the data layer supports typed matrix/vector values
beyond the current scalar-series pattern (`x1..x6`). No blocks should be
registered until the data model is ready.

### Acceptance criteria (v3)

- Multinomial: correct for known combinatorial identities.
- Edge cases: any nᵢ < 0 → error, non-integer inputs → floor then compute.

---

## v4 — Interpolation, utilities, number theory

Ships last. These are self-contained utility blocks with no shared
infrastructure dependencies.

| # | Op ID | Label | Category | Priority | Inputs | Notes |
|---|-------|-------|----------|----------|--------|-------|
| 1 | `math.lerp` | LERP | math | medium | a, b, t | a + t × (b − a) |
| 2 | `math.map_range` | Map Range | math | medium | val, inMin, inMax, outMin, outMax | Linear remap between ranges. |
| 3 | `util.calc.is_prime` | IS_PRIME | utilCalc | low | n | 1 if prime, 0 otherwise. |
| 4 | `util.calc.fib` | Fibonacci | utilCalc | low | n | nth Fibonacci number (0-indexed). |

### Implementation notes (v4)

- LERP and Map Range are pure arithmetic — trivial evaluation.
- Map Range: error when inMin = inMax (division by zero).
- IS_PRIME: trial division up to √n is sufficient for f64 range. Non-positive or non-integer → 0.
- Fibonacci: iterative approach. Cap at n = 78 (largest Fibonacci number exactly representable in f64). n > 78 → error.

### Acceptance criteria (v4)

- All 4 blocks evaluate correctly against reference values.
- Edge cases: LERP t outside [0,1] extrapolates (no clamp). Map Range inMin = inMax → error. IS_PRIME(1) → 0. Fibonacci(0) → 0, Fibonacci(1) → 1, Fibonacci(78) → 8944394323791464.

---

## Dependency order

```
v2 (stats/distributions)
 └─ shared erf/incomplete-beta helpers
 └─ shared series-parsing from statsRel

v3 (combinatorics)
 └─ factorial helper (may reuse from prob.comb.*)
 └─ future: vector/matrix data model

v4 (interpolation/utilities)
 └─ no dependencies — self-contained
```

v4 MAY be shipped before v3 if the data model timeline slips.

---

## Governance

- All blocks follow `docs/BLOCK_CATALOG_GOVERNANCE.md` conventions.
- Adding blocks does NOT bump the engine contract version.
- Each sub-version is a separate commit batch (2–4 items per CI run).
- The `docs/block-manifest.json` tracks each block's `subVersion` field (`v2`, `v3`, `v4`).
