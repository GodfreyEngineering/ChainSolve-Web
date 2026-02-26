# Performance Instrumentation

> W9.9 | Added 2026-02-26

ChainSolve uses the standard **User Timing API** (Level 2) for performance marks
and measures.  No third-party tracing SDK is used.

---

## Naming convention

All marks and measures use the prefix `cs:` followed by component and span:

```
cs:<component>:<span>
```

| Name | Type | Emitted by | Meaning |
|------|------|-----------|---------|
| `cs:eval:snapshot` | measure | `useGraphEngine` | Full snapshot load (first render or after worker recreate) |
| `cs:eval:patch` | measure | `useGraphEngine` | Incremental patch round-trip |
| `cs:eval:partial` | mark | `useGraphEngine` | Eval returned `partial: true` (time budget hit) |
| `cs:engine:boot` | measure | (future) `index.ts` | Time from Worker creation to `ready` message |

---

## How to emit marks/measures

```typescript
import { perfMark, perfMeasure } from '../perf/marks.ts'

// At the start of a span:
perfMark('cs:eval:start')

// At the end:
const durationMs = perfMeasure('cs:eval:patch', 'cs:eval:start')
// → durationMs is the wall-clock duration in ms (float)
// → the measure appears in DevTools Performance panel
// → a copy is pushed to the in-memory ring buffer
```

Both functions silently no-op if the User Timing API is unavailable.

---

## Querying measures in the browser

### DevTools Performance panel
1. Start recording (Ctrl+Shift+E / Cmd+Shift+E)
2. Interact with the canvas
3. Stop recording
4. In the "Timings" track, look for `cs:eval:*` spans

### Console
```javascript
performance.getEntriesByType('measure')
  .filter(m => m.name.startsWith('cs:'))
  .map(m => ({ name: m.name, ms: m.duration.toFixed(2) }))
```

### Via the diagnostics page
Navigate to `/diagnostics` → **Export JSON** → look for `userTimingMeasures` array.
This includes the last 20 measures captured since page load.

---

## Ring buffer

`src/perf/marks.ts` maintains an in-memory ring buffer of the last 30 measures.
This is what gets exported to the diagnostics bundle.

```typescript
import { getRecentMeasures } from '../perf/marks.ts'

const measures = getRecentMeasures()
// → ReadonlyArray<{ name: string, durationMs: number, startTime: number }>
```

Each entry is < 100 bytes JSON.  The buffer is never flushed to the server automatically.

---

## Adding a new mark/measure

1. Choose a name following the convention: `cs:<component>:<span>`
2. Document it in the table above
3. Import `perfMark` / `perfMeasure` from `src/perf/marks.ts`
4. Emit the mark at the start of the operation
5. Emit the measure when it completes

Do **not** use raw `performance.mark()` — always go through `marks.ts` so the
ring buffer is populated and the measure appears in diagnostics exports.

---

## Integration with diagnostics export (W9.8)

`src/engine/perfMetrics.ts` exports `userTimingExport()`:

```typescript
import { userTimingExport } from '../engine/perfMetrics.ts'

const measures = await userTimingExport()
// Returns the last 20 measures from the ring buffer
```

This is called by `DiagnosticsPage.tsx` when building the diagnostics bundle.
The field `userTimingMeasures` appears in the exported JSON.

---

## Production considerations

- User Timing API calls are **always safe to emit** — browsers ignore marks/measures
  unless DevTools or a `PerformanceObserver` is actively listening.
- The ring buffer is bounded (30 entries, ~3 KB max) — no memory concern.
- No PII or dataset contents are ever recorded in marks or measures.
