# ChainSolve — Conventions

> Coding conventions, naming rules, error code formats, and design boundaries.
> Follow these to keep the codebase predictable for humans and AI agents alike.

---

## 1. TypeScript Conventions

### File naming

| Type | Convention | Example |
|------|-----------|---------|
| React component | PascalCase `.tsx` | `CanvasArea.tsx`, `BlockLibrary.tsx` |
| React hook | camelCase `.ts`, prefix `use` | `useGraphEngine.ts` |
| Library module | camelCase `.ts` | `entitlements.ts`, `projects.ts` |
| Type-only file | camelCase `.ts` | `wasm-types.ts` |
| Web Worker | camelCase `.ts`, suffix `-worker` | `csv-worker.ts` |
| Block pack | camelCase `.ts`, suffix `-blocks` | `vector-blocks.ts`, `table-blocks.ts` |

### Exports

- **Components:** one default export per file = the component.  Named re-exports
  for types and helpers from the same file only when necessary.
- **Libraries (`src/lib/`):** named exports only (no default).
- **Barrel files (`index.ts`):** used only in `src/components/ui/` for the design
  system.  Do not add barrels elsewhere — they obscure import origins.
- **Type-only imports:** use `import type` or `import { type X }` for anything
  that only exists in the type system (required by `verbatimModuleSyntax`).

### Strict TypeScript settings (tsconfig.app.json)

| Rule | Implication |
|------|------------|
| `noUnusedLocals` | All declared locals must be used; prefix with `_` to suppress |
| `noUnusedParameters` | All function params must be used; prefix with `_param` in callbacks |
| `verbatimModuleSyntax` | Must use `import type` for type-only imports |
| `erasableSyntaxOnly` | No `const enum`, no value-bearing `namespace` |

---

## 2. Rust Conventions

### Module headers

Every `.rs` file starts with a `//!` module-level doc comment explaining:
- What the module is responsible for
- Any invariants callers must uphold

```rust
//! Evaluation engine — topological sort + per-node evaluation.
//!
//! Invariant: the graph must be a DAG. Cycles are detected at eval time
//! and surfaced as `CYCLE_DETECTED` diagnostics.
```

### Item docs

Public functions and structs get a `///` doc comment.  For non-obvious parameters,
add `/// # Panics` or `/// # Errors` sections.

### Naming

- Structs: `PascalCase` (`EngineGraph`, `NodeSpec`)
- Functions: `snake_case` (`evaluate_node`, `apply_patch`)
- Error variants: `SCREAMING_SNAKE_CASE` (`CYCLE_DETECTED`, `UNKNOWN_BLOCK`)
- Constants: `SCREAMING_SNAKE_CASE` (`ENGINE_CONTRACT_VERSION`, `CATALOG`)

### Error codes (Rust side)

Diagnostic codes defined in `crates/engine-core/src/catalog.rs`.
Format: `SCREAMING_SNAKE_CASE`.  Known codes:

| Code | Meaning |
|------|---------|
| `CYCLE_DETECTED` | Graph contains a cycle |
| `UNKNOWN_BLOCK` | Block type not in the catalog |
| `ARITY_MISMATCH` | Wrong number of inputs for the op |
| `TYPE_MISMATCH` | Input types incompatible with op |
| `DIVISION_BY_ZERO` | Division by zero (produces NaN, not a hard error) |

---

## 3. Error Code Format

Error codes used in TypeScript follow a `[CODE]` prefix convention.
They appear in thrown `Error` messages so they can be caught by pattern matching.

| Code | Where thrown | Meaning |
|------|-------------|---------|
| `[CONFIG_INVALID]` | `src/lib/supabase.ts` | Missing/placeholder Supabase credentials in production |
| `[WASM_CSP_BLOCKED]` | `src/engine/worker.ts` | Browser blocked WASM compilation due to missing `'wasm-unsafe-eval'` |
| `[WASM_INIT_FAILED]` | `src/engine/worker.ts` | WASM module failed to load for any other reason |
| `[ENGINE_CONTRACT_MISMATCH]` | `src/engine/index.ts` | TypeScript expected a different `ENGINE_CONTRACT_VERSION` |

**Adding a new error code:**
1. Use `[SCREAMING_SNAKE_CASE]` as the first token in the error message.
2. Document it in this table.
3. If the code surfaces in the UI, add a matching case to `EngineFatalError`
   or the relevant error boundary.

---

## 4. What Goes in Rust vs TypeScript

The engine boundary is intentional and strict:

| Responsibility | Rust (engine-core) | TypeScript |
|----------------|-------------------|------------|
| Mathematical evaluation | ✅ | ❌ |
| NaN/Infinity canonicalization | ✅ | ❌ |
| Topological sort | ✅ | ❌ |
| Dirty propagation / incremental eval | ✅ | ❌ |
| Broadcasting rules | ✅ | ❌ |
| Value type system (runtime) | ✅ | Mirror types in `src/engine/value.ts` |
| Graph snapshot serialization | Bridge (`src/engine/bridge.ts`) | ✅ React Flow → EngineSnapshotV1 |
| Patch diffing | `src/engine/diffGraph.ts` | ✅ Rust only applies patches |
| Block metadata (labels, ports, categories) | ❌ | `src/blocks/` |
| UI rendering | ❌ | `src/components/canvas/` |
| Auth, storage, billing | ❌ | `src/lib/`, `functions/api/` |

**Key principle:** If it affects computed values, it must live in Rust.
If it affects presentation only, it lives in TypeScript.

The `src/engine/value.ts` mirror types exist so the UI can pattern-match on
value kinds (scalar / vector / table / error) without importing from the WASM
pkg.  Do not add evaluation logic to these mirror types.

---

## 5. Adding a New Block Op — End-to-End

This is the most common engine change.  Follow these steps in order.

### Step 1 — Implement in Rust (`crates/engine-core/src/ops.rs`)

Find the appropriate `match` arm for the op's input arity and types.
Add a new arm for your op name (must match what the catalog declares).

```rust
"my_op" => {
    let a = inputs[0].as_scalar()?;
    let b = inputs[1].as_scalar()?;
    Ok(Value::scalar(a + b))  // example
}
```

### Step 2 — Register in catalog (`crates/engine-core/src/catalog.rs`)

Add an entry to the `CATALOG` array:

```rust
OpSpec {
    name: "my_op",
    arity: Arity::Fixed(2),
    output_type: ValueType::Scalar,
    doc: "Adds two numbers.",
},
```

### Step 3 — Write tests

Add a golden fixture to `crates/engine-core/tests/fixtures/my_op.fixture.json`
and run `GOLDEN_UPDATE=1 cargo test -p engine-core --test golden` to populate
the expected values.

### Step 4 — Bump `ENGINE_CONTRACT_VERSION` if needed

If you changed evaluation semantics (broadcasting, NaN handling, etc.), bump
`ENGINE_CONTRACT_VERSION` in `catalog.rs`.  Then update the expected version in
`src/engine/index.ts`.  See `CONTRIBUTING.md §1`.

### Step 5 — Add block metadata in TypeScript

In the appropriate `src/blocks/*-blocks.ts` file:

```typescript
reg({
  blockType: 'myOp',
  label: 'blocks.myOp',        // i18n key
  category: 'math',
  nodeKind: 'csOperation',
  inputs: [portDef('a'), portDef('b')],
})
```

### Step 6 — Add i18n label

In `src/i18n/locales/en.json`:

```json
"blocks": {
  "myOp": "My Op"
}
```

Repeat for `es.json`, `fr.json`, `it.json`, `de.json`.

### Step 7 — Build and test

```bash
npm run wasm:build:dev      # compile Rust → WASM
npm run check               # format + lint + typecheck
npm run test:e2e:smoke      # smoke suite
```

---

## 6. Supabase Migration Conventions

- Files are numbered sequentially: `NNNN_description.sql`
- Migrations are **append-only** — never edit or delete existing files
- Use `IF NOT EXISTS` / `IF EXISTS` guards for idempotency where possible
- Enable RLS immediately: `ALTER TABLE t ENABLE ROW LEVEL SECURITY`
- RLS policies use `(select auth.uid())` (not `auth.uid()`) to avoid
  re-evaluation per row — see [ADR-0004](DECISIONS/ADR-0004-supabase-rls.md)
- Add a `NOTIFY pgrst, 'reload schema'` at the end of migrations that add
  tables, columns, or functions that PostgREST needs to expose
- Add indexes for all foreign keys (Supabase advisor requirement)

---

## 7. CSS / Styling

- Inline styles for node-level theming (React Flow constraint) — use the
  shared constants in `src/components/canvas/nodes/nodeStyles.ts`
- Global design tokens in `src/index.css` (CSS custom properties)
- Component-local CSS modules are not used; prefer inline styles or global CSS
- Design tokens:
  - Primary: `#1CABB0`
  - Background: `#1a1a1a`
  - Card: `#383838`
  - Text: `#F4F4F3`
  - Font (UI): Montserrat
  - Font (numbers): JetBrains Mono
