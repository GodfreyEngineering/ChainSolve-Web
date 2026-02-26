# W9.5 — Golden Tests + Scientific Reference Harness

Engine-core verification: golden fixtures, property-based tests, and reference validation.

## Overview

| Layer | What it tests | Files |
|---|---|---|
| Golden fixtures | Pin specific outputs; fail if results change | `tests/golden.rs`, `tests/fixtures/*.fixture.json` |
| Property tests | Mathematical invariants across random inputs | `tests/properties.rs` |
| Reference values | Known constants and trig identities | `reference_constants`, `trig_special_angles`, `trig_roundtrip` fixtures |
| Determinism | Bitwise-identical results across repeated runs | Golden runner (3x per fixture), `determinism_100_node_chain` test |

## Golden Fixtures

### Format

Each fixture is a JSON file in `crates/engine-core/tests/fixtures/` named `*.fixture.json`:

```json
{
  "name": "basic_add",
  "description": "Number(3) + Number(4) → Add → 7",
  "contractVersion": 1,
  "snapshot": {
    "version": 1,
    "nodes": [...],
    "edges": [...]
  },
  "expected": {
    "nodeId": { "kind": "scalar", "value": 7.0 }
  },
  "diagnostics": [
    { "code": "CYCLE_DETECTED", "level": "error" }
  ],
  "tolerance": null
}
```

Fields:
- `name` — unique identifier
- `snapshot` — `EngineSnapshotV1` (nodes + edges)
- `expected` — `HashMap<nodeId, Value>` — only nodes we want to pin
- `diagnostics` — expected diagnostic codes and levels (not volatile messages)
- `tolerance` — `null` for exact bitwise match via `to_bits()`, or `f64` for approximate

### Fixture suite (16 fixtures)

| Fixture | Tests |
|---|---|
| `basic_add` | 3 + 4 = 7 |
| `chain_negate` | 5 → negate × 3 = -5 |
| `arithmetic_chain` | (3+4) × 2 = 14 |
| `division_by_zero` | 10/2=5, 10/5=2 (finite division) |
| `identity_elements` | x+0=x, x×1=x, x^1=x |
| `negative_zero_canon` | -1×0 = +0 (not -0) |
| `vector_broadcast` | 10 + [1,2,3] = [11,12,13] |
| `vector_ops_suite` | sum, mean, min, max, length, sort, reverse |
| `table_broadcast` | scalar + 2×2 table |
| `disconnected_ports` | manual values on unconnected inputs |
| `unknown_block` | UNKNOWN_BLOCK diagnostic |
| `cycle_detection` | CYCLE_DETECTED diagnostic |
| `trig_special_angles` | sin(0)=0, cos(0)=1, sin(π/2)≈1, cos(π)≈-1, tan(π/4)≈1 |
| `trig_roundtrip` | asin(sin(0.5))≈0.5, acos(cos(1))≈1, atan(tan(0.7))≈0.7 |
| `reference_math` | sqrt(2), abs(-7), floor(3.7), ceil(3.2), round(3.5) |
| `reference_constants` | π, e, τ, φ, ln2, ln10, √2 |

### Programmatic tests (non-JSON)

NaN and Infinity can't be represented in JSON, so these are tested programmatically in `golden.rs`:

- `nan_propagation` — 0/0=NaN, NaN+5=NaN, NaN×0=NaN, canonical NaN bits
- `infinity_division` — 1/0=+Inf, -1/0=-Inf
- `determinism_100_node_chain` — 100-node chain, 3 runs, bitwise identical

### Adding a new fixture

1. Create `crates/engine-core/tests/fixtures/my_test.fixture.json`
2. Define `snapshot` with nodes and edges
3. Run with update mode to populate expected values:
   ```bash
   GOLDEN_UPDATE=1 cargo test -p engine-core --test golden
   ```
4. Review the generated expected values
5. Set `tolerance` (null for exact, or e.g. `1e-15` for approximate)

### Regenerating goldens

After changing ops or evaluation logic:

```bash
# See what changed
cargo test -p engine-core --test golden

# Regenerate expected values
GOLDEN_UPDATE=1 cargo test -p engine-core --test golden

# Review changes
git diff crates/engine-core/tests/fixtures/

# Verify clean
cargo test -p engine-core --test golden
```

Or use the convenience binary:
```bash
cargo run -p engine-core --bin update_goldens
```

## Property-Based Tests

`tests/properties.rs` uses [proptest](https://crates.io/crates/proptest) to verify invariants across random inputs (256 cases per property by default).

### Properties tested (18 total)

**Arithmetic identities:**
- `add_commutative` — a + b = b + a
- `mul_commutative` — a × b = b × a
- `add_identity` — x + 0 = x
- `mul_identity` — x × 1 = x
- `power_identity` — x^1 = x (nonzero x)
- `negate_involution` — -(-x) = x
- `abs_non_negative` — |x| ≥ 0
- `abs_symmetric` — |x| = |-x|
- `subtract_self_is_zero` — x - x = +0
- `divide_self_is_one` — x / x = 1 (nonzero x)

**Canonicalization:**
- `nan_canonical_bits` — NaN propagation preserves canonical bit pattern
- `neg_zero_canonical` — -1 × 0 = +0 (not -0)

**Trig identities (tolerance 1e-10):**
- `sin_cos_pythagorean` — sin²(x) + cos²(x) ≈ 1
- `sin_negate_odd` — sin(-x) = -sin(x)
- `cos_even` — cos(-x) = cos(x)

**Broadcasting:**
- `scalar_plus_vector_elementwise` — broadcast matches per-element eval
- `scalar_times_vector_elementwise` — broadcast matches per-element eval

**Determinism:**
- `eval_deterministic` — 3 runs produce bitwise-identical results

### Design notes

- Identity tests compare within the engine's JSON domain (both sides go through the same serialization path)
- Input strategy excludes -0.0 (engine canonicalizes to +0.0)
- Trig tests use bounded range [-100, 100] to avoid precision degradation at extreme values

## Determinism Policy

The engine guarantees bitwise-identical output for identical input:

1. **NaN canonicalization** — All NaN values are mapped to the canonical `f64::NAN` bit pattern
2. **Negative zero canonicalization** — `-0.0` is mapped to `+0.0`
3. **Deterministic evaluation order** — Kahn's topological sort produces a stable ordering
4. **No floating-point non-determinism** — Pure Rust f64 ops, no threading, no SIMD

The golden test runner verifies this by running each fixture 3 times and comparing all output values bitwise.

## Running Tests

```bash
# All Rust tests (unit + golden + property + perf smoke)
cargo test --workspace

# Golden tests only
cargo test -p engine-core --test golden

# Property tests only
cargo test -p engine-core --test properties

# Regenerate golden expected values
GOLDEN_UPDATE=1 cargo test -p engine-core --test golden

# Full CI pipeline
npm run build && npm run test:e2e
```
