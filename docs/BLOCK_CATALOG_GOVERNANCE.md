# Block Catalog Governance

> How to add, name, categorize, test, and version blocks in ChainSolve.

---

## 1. Architecture Overview

Blocks live in two layers:

| Layer | Responsibility | Key files |
|-------|---------------|-----------|
| **Rust engine** (`crates/engine-core/src/`) | Evaluation logic + canonical metadata | `ops.rs`, `catalog.rs` |
| **TypeScript UI** (`src/blocks/`) | Display config + feature gating | `registry.ts`, `types.ts`, `*-blocks.ts` |

Rust is the single source of truth for computation. TypeScript handles presentation. The two layers are validated at boot via `validateCatalog()` in `src/blocks/registry.ts`.

---

## 2. Naming Conventions

### Op IDs

Format: `[namespace].[domain].[operation]`

| Pattern | Example | When to use |
|---------|---------|-------------|
| `name` | `add`, `sin`, `sqrt` | Core math (no prefix) |
| `eng.domain.op` | `eng.mechanics.force_ma` | Engineering formulas |
| `fin.domain.op` | `fin.tvm.compound_fv` | Finance formulas |
| `stats.domain.op` | `stats.desc.mean` | Statistics formulas |
| `const.domain.name` | `const.physics.g0` | Physical / math constants |
| `preset.domain.name` | `preset.materials.steel_rho` | Material / fluid presets |

Rules:
- Use `snake_case` for multi-word ops: `power_work_time`, not `powerWorkTime`
- Use standard abbreviations from the domain: `rho`, `mu`, `sigma`
- Keep IDs stable once shipped — they are persisted in saved projects

### Port IDs

| Pattern | Example | When to use |
|---------|---------|-------------|
| `a`, `b` | Binary math ops | Default for two-input ops |
| Domain symbol | `W`, `t`, `rho`, `mu` | Engineering / science ops |
| `base`, `exp` | Power | Semantic names when `a/b` is unclear |
| `cond`, `then`, `else` | ifthenelse | Control flow |
| `c`, `x1`..`x6`, `y1`..`y6` | Stats ops | Count + data series |

### Category IDs

Use camelCase with domain prefix:

| Prefix | Categories |
|--------|-----------|
| (none) | `input`, `math`, `trig`, `constants`, `logic`, `output` |
| `eng` | `engMechanics`, `engMaterials`, `engSections`, `engInertia`, `engFluids`, `engThermo`, `engElectrical`, `engConversions` |
| `fin` | `finTvm`, `finReturns`, `finDepr` |
| `stats` | `statsDesc`, `statsRel` |
| `prob` | `probComb`, `probDist` |
| `const` | `constMath`, `constPhysics`, `constAtmos`, `constThermo`, `constElec` |
| `preset` | `presetMaterials`, `presetFluids` |
| `data/vector/table/plot` | `data`, `vectorOps`, `tableOps`, `plot` |
| `util` | `utilCalc` |

---

## 3. Categories Taxonomy

### Current Hierarchy (32 categories, ~203 ops)

```
Inputs           → input (number, slider, variableSource)
Constants        → constants, constMath, constPhysics, constAtmos, constThermo, constElec
Materials        → presetMaterials, presetFluids
Functions
  Core Math      → math (13 ops), trig (8 ops), logic (6 ops)
  Engineering    → engMechanics, engMaterials, engSections, engInertia,
                   engFluids, engThermo, engElectrical, engConversions
  Finance        → finTvm, finReturns, finDepr
  Statistics     → statsDesc, statsRel, probComb, probDist
  Utilities      → utilCalc
Outputs          → output (display, probe)
Data (Pro)       → data, vectorOps, tableOps
Plots (Pro)      → plot
```

### Adding a New Category

1. Add the ID to `BlockCategory` union in `src/blocks/types.ts`
2. Add a label to `CATEGORY_LABELS` in `src/blocks/registry.ts`
3. Insert in `CATEGORY_ORDER` at the appropriate position
4. Assign to a `LIBRARY_FAMILIES` group in `src/blocks/registry.ts`

---

## 4. How to Add a Block (End-to-End)

### Step 1 — Implement evaluation (Rust)

In `crates/engine-core/src/ops.rs`, add a match arm to `evaluate_node_inner()`:

```rust
"my.domain.new_op" => {
    let a = scalar_or_nan(inputs, "a");
    let b = scalar_or_nan(inputs, "b");
    if b == 0.0 {
        Value::error("NewOp: b = 0")
    } else {
        Value::scalar(a / b)
    }
}
```

Key helpers: `scalar_or_nan()`, `unary_broadcast()`, `binary_broadcast()`, `Value::scalar()`, `Value::error()`, `Value::vector()`.

### Step 2 — Register catalog entry (Rust)

In `crates/engine-core/src/catalog.rs`, add to the `catalog()` function:

```rust
CatalogEntry {
    op_id: "my.domain.new_op",
    label: "New Op",
    category: "myCategory",
    node_kind: "csOperation",
    inputs: vec![p("a", "A"), p("b", "B")],
    pro_only: false,
}
```

Update the `catalog_has_expected_count` test assertion (currently 203).

### Step 3 — Write tests (Rust)

Add a golden fixture in `crates/engine-core/tests/fixtures/`:

```json
{
  "name": "NewOp",
  "description": "Tests my.domain.new_op",
  "contractVersion": 1,
  "snapshot": {
    "version": 1,
    "nodes": [
      { "id": "a", "blockType": "number", "data": { "value": 10 } },
      { "id": "b", "blockType": "number", "data": { "value": 2 } },
      { "id": "c", "blockType": "my.domain.new_op", "data": {} }
    ],
    "edges": [
      { "id": "e1", "source": "a", "sourceHandle": "out", "target": "c", "targetHandle": "a" },
      { "id": "e2", "source": "b", "sourceHandle": "out", "target": "c", "targetHandle": "b" }
    ]
  },
  "expected": { "c": { "kind": "scalar", "value": 5.0 } },
  "diagnostics": [],
  "tolerance": null
}
```

Run `cargo test -p engine-core` to verify, or `GOLDEN_UPDATE=1 cargo test -p engine-core --test golden` to regenerate expected values.

### Step 4 — Register in TypeScript

In the appropriate block pack file (e.g. `src/blocks/eng-blocks.ts`):

```typescript
register({
  type: 'my.domain.new_op',
  label: 'New Op',
  category: 'myCategory',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  defaultData: { blockType: 'my.domain.new_op', label: 'New Op' },
  proOnly: false,
})
```

If this is a new block pack file, import and call its register function from `src/blocks/registry.ts`.

### Step 5 — Verify

```bash
cargo test -p engine-core              # Rust tests
npm run wasm:build                     # Rebuild WASM
npx tsc --noEmit                       # TypeScript type check
npx vitest run                         # TS unit tests
./scripts/verify-ci.sh                 # Full CI pipeline
```

---

## 5. Versioning and Contract Changes

### Engine Contract Version

Defined in `src/engine/engineContractVersion.ts`. Increment when:
- A block's **port IDs** change (breaking: existing edges break)
- A block's **evaluation semantics** change (breaking: saved results differ)
- A block is **removed** (breaking: saved projects reference it)

Adding new blocks does **not** require a contract version bump.

### Backward Compatibility

- **Never rename** an op ID once shipped — it's persisted in saved projects
- **Never remove** ports from an existing op — add new optional ports instead
- **Never change** evaluation for the same inputs — if semantics must change, create a new op (e.g. `v2` suffix)
- **Safe changes**: adding new ops, adding new categories, adding optional ports, improving error messages

### Manifest File

The structured block manifest lives at `docs/block-manifest.json`. It lists all planned and implemented blocks with metadata for tracking progress. See that file for the current state.

---

## 6. Error Message Conventions

Format: `"OpName: constraint description"`

| Pattern | Example |
|---------|---------|
| Division by zero | `"Power: t = 0"` |
| Geometric constraint | `"Annulus: d_inner > d_outer"` |
| Degenerate input | `"Regression: zero variance in X"` |
| Range violation | `"Probability: p must be in [0, 1]"` |

Rules:
- Use the **display name** of the op, not the op ID
- State the **violated constraint**, not just "invalid input"
- Keep messages under 60 characters
- Use domain-standard variable names (`μ`, `ρ`, `σ`)

---

## 7. Quality Checklist for New Blocks

Before shipping a new block:

- [ ] Rust evaluation added in `ops.rs`
- [ ] Catalog entry added in `catalog.rs` with correct metadata
- [ ] Golden fixture added in `tests/fixtures/`
- [ ] Edge cases tested (zero, negative, NaN, Infinity)
- [ ] Error messages follow convention (§6)
- [ ] TS block registered in appropriate `*-blocks.ts` file
- [ ] `proOnly` flag set correctly (data/vector/plot/group ops are Pro)
- [ ] Port labels include units where applicable (e.g. "t (s)", "W (J)")
- [ ] `cargo test -p engine-core` passes
- [ ] `./scripts/verify-ci.sh` passes
