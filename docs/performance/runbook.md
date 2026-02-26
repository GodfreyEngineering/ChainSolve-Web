# Performance Runbook

> W9.9 | Added 2026-02-26

Triage checklist for performance incidents. Start at the symptom, follow the
steps, check the probable causes.

---

## Symptom: Bundle size check failed in CI

**Signal:** CI `node_checks` → `Bundle size check` step fails.

### Triage steps

1. **Read the table** — the CI output shows which file exceeded which budget.

2. **Identify the cause:**
   - `main-*.js` over 900 KB → new dependency added to the main bundle
   - `total JS` over 1 600 KB → large new dependency added anywhere
   - `*.wasm` over 600 KB → new Rust code added to `engine-wasm`

3. **Check recent PRs:**
   ```bash
   git log --oneline --diff-filter=M -- package.json Cargo.toml
   ```

4. **Analyse the bundle:**
   ```bash
   npm run build
   npx vite-bundle-visualizer  # or use rollup-plugin-visualizer
   ```

5. **If the size increase is intentional** (new feature), raise the budget in
   `scripts/check-bundle-size.mjs` AND document the reason in
   `docs/performance/budgets.md`.

6. **If the size increase is unintentional** (accidental tree-shaking regression,
   wrong import, duplicate dependency):
   - Check for non-tree-shakeable imports: `import * as _ from 'large-lib'`
   - Check for duplicate dependency versions: `npm ls <lib>`
   - Consider lazy-loading: any large lib only used on a specific page can be
     dynamically imported

---

## Symptom: Engine eval too slow (canvas feels sluggish)

**Signal:** PerfHud (`?perf=1`) shows `lastEvalMs` > 300 ms, or `isPartial: true`.

### Triage steps

1. **Check node count:**
   - PerfHud shows `nodesEvaluated / totalNodes`
   - 300 ms budget applies to `applyPatch` (incremental) only
   - `loadSnapshot` (first load) has no budget

2. **Is it partial?**
   - `isPartial: true` means the 300 ms budget was hit
   - The canvas shows partial results; subsequent eval will fill in the rest
   - This is expected behaviour for large graphs (> 5 000 nodes typical)

3. **Profile the Rust engine:**
   ```bash
   cargo bench --package engine-core
   open target/criterion/report/index.html
   ```

4. **Check for O(N²) ops:**
   - `diffGraph.ts` diffs React Flow state → PatchOp[]
   - Large numbers of `UpdateNodeData` ops in one diff can trigger many dirty nodes

5. **Add a `cs:eval:patch` mark manually:**
   ```javascript
   // Browser console:
   const m = performance.getEntriesByType('measure')
     .find(m => m.name === 'cs:eval:patch')
   console.log(m?.duration)
   // Note: marks are cleared after capture — time the call directly instead:
   const t = performance.now()
   await window.__chainsolve_engine.applyPatch([{
     op: 'updateNodeData', nodeId: 'n0', data: { value: 99 }
   }])
   console.log(performance.now() - t, 'ms')
   ```

---

## Symptom: Worker watchdog fired (canvas recovered after ~5 s blank)

**Signal:** `console.warn: [cs:engine] Watchdog fired — recreating worker`.
Canvas was blank for ~5 seconds then recovered.

### Triage steps

1. **Identify the graph that triggered it:**
   - The watchdog fires when a `loadSnapshot` or `applyPatch` takes > 5 s
   - Check PerfHud for `totalNodes` before the hang
   - Check browser console for the requestId

2. **Reproduce in Rust:**
   ```bash
   # Build the graph with ~that many nodes and run perf_smoke
   cargo test --package engine-core perf_smoke -- --nocapture
   ```

3. **Check for cycles:**
   - The WASM engine's topological sort detects cycles but reports them as
     diagnostics, not infinite loops
   - A true infinite loop in Rust eval would require a Rust bug

4. **Check for very large datasets:**
   - A 10M-element dataset + vectorSum could take > 5 s
   - Solution: increase the budget or break the data into chunks

5. **After watchdog recovery:**
   - Datasets are NOT preserved (they must be re-registered)
   - Canvas state is reset to the last `loadSnapshot` snapshot
   - User's current patch state may be lost

---

## Symptom: Memory growing without bound

**Signal:** Chrome Task Manager shows the tab using > 500 MB, growing over time.

### Triage steps

1. **Check dataset count:**
   ```javascript
   const stats = await window.__chainsolve_engine?.getStats()
   console.log(stats)
   // { datasetCount: N, datasetTotalBytes: N }
   ```
   Expected: `datasetCount` matches visible DataNodes. If it's much higher, a
   dataset is not being released on unmount.

2. **Check WASM heap:**
   - Chrome DevTools → Memory → "Allocation instrumentation on timeline"
   - Look for growing allocations in the WASM heap

3. **Check JS heap:**
   ```javascript
   // Chrome 89+, cross-origin isolated pages only:
   if ('measureUserAgentSpecificMemory' in performance) {
     const mem = await performance.measureUserAgentSpecificMemory()
     console.log((mem.bytes / 1024 / 1024).toFixed(1), 'MB')
   }
   ```

4. **Heap snapshot comparison:**
   - DevTools → Memory → Snapshot 1
   - Interact with canvas (add DataNodes, load large CSVs)
   - Snapshot 2
   - Compare: look for growing `Float64Array` or Rust WASM heap

5. **Check for missing cleanup:**
   - `DataNode.tsx` `useEffect` cleanup MUST call `engine.releaseDataset(id)`
   - Search for `releaseDataset` calls to verify

---

## Symptom: Playwright perf smoke failed (nightly CI)

**Signal:** `perf.yml` → `perf_ui` job fails.

### Triage steps

1. **Read the test output** — the spec logs timing summary:
   ```
   applyPatch 2k-chain (20 rounds): min=12ms p50=18ms p95=45ms max=102ms
   ```

2. **Was it a transient runner hiccup?**
   - Re-run the workflow manually (GitHub UI → Actions → Performance → Run workflow)
   - If it passes on retry, it was transient

3. **Is the p95 legitimately slow?**
   - Budget: p50 < 500 ms, p95 < 1 000 ms on 2 000 nodes
   - These budgets are very conservative; slowness at this level means a serious regression

4. **Check recent commits:**
   - Large new Rust dependencies in engine-core?
   - New `applyPatch` overhead in `diffGraph.ts`?
   - Memory pressure from other tests in the same run?

5. **Run locally:**
   ```bash
   npm run build && npx playwright test --project=perf
   ```

---

## Escalation

If none of the above resolves the issue, check:
- `docs/performance/budgets.md` — current budget values
- `docs/performance/baseline.md` — known baseline numbers
- `docs/DECISIONS/ADR-0005-worker-cancellation.md` — watchdog design decisions
