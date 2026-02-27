# Golden Tests — .chainsolvejson Round-Trip (W14c.4)

## Overview

The round-trip golden test suite (`src/lib/chainsolvejson/roundtrip/`) proves
that the `.chainsolvejson` export/import pipeline is correct, deterministic,
and preserves project data integrity.

## What is tested

| Property                     | How verified                                              |
|------------------------------|-----------------------------------------------------------|
| Export determinism            | Same args produce identical hashes across runs             |
| Parse + validate integrity   | Exported JSON passes strict re-import validation           |
| Graph data identity          | `stableStringify(nodes, edges)` identical before vs after  |
| Variable identity            | `stableStringify(variables)` identical before vs after     |
| Asset byte identity          | Base64 decode matches original bytes; sha256 verified      |
| Hash integrity               | Per-canvas and project hashes match on re-import           |
| No secrets                   | No forbidden fields in exported text                       |
| No NaN/Infinity              | Validation catches non-finite numbers                      |
| ID normalization             | Import plan rewrites canvasId/projectId correctly          |
| Position compaction           | Positions compacted to 0..N-1 after sort                   |

## Fixtures

Three deterministic fixtures are built programmatically in `fixtures.ts`:

| Fixture | Purpose                        | Canvases | Assets | Variables |
|---------|--------------------------------|----------|--------|-----------|
| A       | Multi-canvas basic math        | 2        | 0      | 2         |
| B       | Division by zero (diagnostics) | 1        | 0      | 0         |
| C       | Embedded CSV asset             | 1        | 1      | 0         |

All fixture data is hardcoded (no external files, no randomness). Timestamps,
versions, and IDs are deterministic so hash outputs are stable.

## What is excluded

- **Timing fields**: `elapsedUs` and similar non-deterministic metadata are
  never part of the comparison.
- **Auth tokens/keys**: Never present in fixtures or exported text.
- **Email addresses**: Never present in fixture data.
- **Engine evaluation results**: The WASM engine requires a browser worker and
  cannot run in vitest. Instead, we prove that the graph data (nodes + edges +
  variables) fed to the engine is byte-identical before and after round-trip.
  Identical inputs guarantee identical engine outputs.

## How to run

```bash
# Run only the golden tests
npx vitest run src/lib/chainsolvejson/roundtrip/roundTrip.test.ts

# Run all unit tests (includes goldens)
npm run test:unit
```

## How determinism is enforced

1. **Stable serialization**: All hash inputs use `stableStringify()` which
   sorts object keys alphabetically.
2. **Deterministic ID generator**: Tests use `createDeterministicIdGenerator()`
   which produces predictable IDs (`new-id-0`, `new-id-1`, etc.) instead of
   `crypto.randomUUID()`.
3. **Fixed timestamps**: All fixture timestamps are hardcoded ISO strings.
4. **No random data**: Fixture content is static strings and numbers.

## Architecture

```
src/lib/chainsolvejson/roundtrip/
  fixtures.ts        — 3 programmatic fixtures (A, B, C)
  memoryStore.ts     — In-memory persistence harness (no Supabase)
  roundTrip.ts       — Export → serialize → parse → validate → normalize orchestrator
  roundTrip.test.ts  — 28 golden tests with vitest
```

Key extraction: `normalizeImportPlan()` in `importProject.ts` is a **pure
function** that computes the full import plan (ID remapping, position compaction,
graph normalization) without any network I/O. This enables testing the import
logic without a Supabase backend.
