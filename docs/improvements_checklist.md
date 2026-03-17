# ChainSolve Engine & Platform Improvements Checklist

> **Goal:** Transform ChainSolve into the obvious best-in-class computation workbench — faster than MATLAB, more accurate than Excel, better workflow than Altair HyperStudy. The UI must feel buttery smooth, the engine must be scientifically trustworthy, and the platform must scale from simple `1+1` to full vehicle simulations with neural networks.
>
> **Core pillars (priority order):**
>
> 1. **Performance** — 60fps canvas, zero wasted computation, reactive-only evaluation
> 2. **Accuracy** — IEEE 754 rigour, compensated algorithms, optional arbitrary precision to 9,999 decimal places
> 3. **UX** — Formula bar expression language, variadic blocks, magnetic snapping, professional polish
> 4. **Capability** — ODE solvers, vehicle simulation, neural network training, LP/QP optimization
>
> **Evaluation philosophy:** ChainSolve evaluates **reactively** — when inputs, blocks, or chains change. Never continuously in the background. Simulations have defined endpoints. Users can opt-in to **looping simulations** (e.g., pendulum over 10 periods with live plotting) — this is explicit, user-initiated, and runs on a dedicated worker. Simple and efficient.

---

## Phase 0 — Drag Performance Fix (DONE)

The canvas must feel instant. Dragging blocks no longer triggers eval cycles or graph health checks.

- [x] **0.1** Add `isDragging` ref to `CanvasArea.tsx` to track drag state without re-renders
- [x] **0.2** Pause engine on `onNodeDragStart`
- [x] **0.3** Unpause on `onNodeDragStop` with 200ms settle delay (prevents thrash on rapid drag-release-drag)
- [x] **0.4** Selection drags covered by 0.2/0.3 (React Flow v12 uses same events)
- [x] **0.5** Pause/unpause on `onMoveStart`/`onMoveEnd` for viewport pan/zoom
- [x] **0.6** Remove `computeGraphHealth()` from the snapshot eval hot path in `useGraphEngine.ts`
- [x] **0.7** Graph health now on-demand only (GraphHealthPanel lazy-loads and computes its own)
- [x] **0.8** Optimised unpause transition — skip full snapshot reload when only positions changed
- [ ] **0.9** [BLOCKED: browser] Unit test: `paused=true` → zero engine calls
- [ ] **0.10** [BLOCKED: browser] Manual verification: 60fps drag on 50+ node project

---

## Phase 1 — Reactive Evaluation Model (REWORK from previous auto/deferred/manual)

Evaluation is **reactive**: fires once when inputs/blocks/chains change, never continuously. Optional manual mode for users who want explicit Run control.

### 1A — Simplify EvalScheduler

- [x] **1.1** `EvalScheduler` class created in `src/engine/evalScheduler.ts`
- [x] **1.2** [REWORK] Change `EvalMode` type from `'auto' | 'deferred' | 'manual'` to `'reactive' | 'manual'`
- [x] **1.3** [REWORK] Remove `_scheduleDeferred()` method and all `requestIdleCallback` / idle-fallback logic
- [x] **1.4** [REWORK] Rename `_scheduleAuto()` to `_scheduleReactive()` — structural changes fire immediately, data-only changes debounce 50ms for keystroke coalescing then fire once
- [x] **1.5** [REWORK] Remove `suggestEvalMode()` — no auto-detection by node count. Default is always `'reactive'`
- [x] **1.6** [REWORK] Update constructor default from `'auto'` to `'reactive'`
- [x] **1.7** [REWORK] Update all evalScheduler tests: reactive/manual modes, coalescing, dispose, mode switching

### 1B — Update useGraphEngine

- [x] **1.8** `useGraphEngine` refactored to use scheduler
- [x] **1.9** `triggerEval` callback in return value
- [x] **1.10** `pendingPatchCount` in return value
- [x] **1.11** [REWORK] Update `evalMode` parameter type to `'reactive' | 'manual'`

### 1C — Simplify CanvasToolbar

- [x] **1.12** Run button added to toolbar
- [x] **1.13** [REWORK] Always show Run button (useful for force-refresh in both modes). Remove Zap auto-run indicator entirely.
- [x] **1.14** [REWORK] Remove `evalMode` and mode-switching from toolbar props — no user-facing mode selection
- [x] **1.15** Ctrl+Enter / F5 keyboard shortcuts wired
- [x] **1.16** i18n keys added across all 7 locales

### 1D — Pre-Run Validation

- [x] **1.17** `validate_pre_eval()` in Rust `graph.rs` — cycles, missing inputs, dangling edges
- [x] **1.18** `run_validate()` in `lib.rs` with catalog-aware port checking
- [x] **1.19** `validate_graph` WASM export in `engine-wasm/src/lib.rs`
- [x] **1.20** Worker handles `'validateGraph'` message
- [x] **1.21** `EngineAPI.validateGraph()` method
- [ ] **1.22** Wire validation into Run button flow: validate → show diagnostics → eval only if clean
- [ ] **1.23** Wire `ProblemsPanel` to display validation diagnostics

### 1E — Status Bar & Stale Tracking

- [x] **1.24** `statusBarStore` has `evalMode`, `isStale`, `lastEvalMs`, `lastEvalNodeCount`, `pendingPatchCount`
- [x] **1.25** [REWORK] Update `EvalMode` type in statusBarStore to `'reactive' | 'manual'`, migrate stored `'auto'`/`'deferred'` values
- [x] **1.26** `useGraphEngine` sets `isStale=true` on enqueue, `isStale=false` after eval
- [x] **1.27** `StatusBar.tsx` shows timing, stale state, mode indicator
- [x] **1.28** [REWORK] Remove "Deferred" status text. Show "Manual" only when set.

---

## Phase 2 — Multi-Input Variadic Blocks (NEW)

Operator blocks (add, multiply, max, min, etc.) currently have exactly 2 inputs. Users need N inputs — drag more connections or click "+" to expand.

### 2A — Rust Engine Variadic Support

- [ ] **2.1** Add `variadic: bool`, `min_inputs: Option<u32>`, `max_inputs: Option<u32>` fields to `CatalogEntry` in `catalog.rs`
- [ ] **2.2** Mark ops as variadic in the catalog: `add`, `multiply`, `max`, `min`, `vec.concat`, `text.concat` — with `min_inputs: 2, max_inputs: 64`
- [ ] **2.3** Create `nary_broadcast()` in `ops.rs` — applies a binary associative op across N inputs (`in_0`, `in_1`, ..., `in_N`) by left-fold with broadcasting
- [ ] **2.4** Create `nary_reduce()` in `ops.rs` — similar for non-broadcasting scalar reduction (max/min across many scalars)
- [ ] **2.5** Update `add`, `multiply`, `max`, `min` match arms: if inputs contain `in_0`, use nary path; else fall back to existing `binary_broadcast` with `a`/`b` for backward compatibility
- [ ] **2.6** Update `validate_pre_eval()` to skip fixed-port validation for variadic ops
- [ ] **2.7** Unit tests: add with 3, 5, 10 inputs; multiply with 3; max/min with 4; scalar+vector mixing
- [ ] **2.8** Golden fixtures: `variadic_add.fixture.json`, `variadic_multiply.fixture.json`

### 2B — TypeScript Variadic Support

- [ ] **2.9** Add `variadic?: boolean`, `minInputs?: number`, `maxInputs?: number` to `BlockDef` in `src/blocks/types.ts`
- [ ] **2.10** Read variadic fields from catalog in WASM bridge
- [ ] **2.11** Mark add, multiply, max, min as variadic in block definitions
- [ ] **2.12** Update `diffGraph.ts` to handle dynamic port changes (new/removed ports emit appropriate ops)

### 2C — Variadic Node UI

- [ ] **2.13** In `OperationNode.tsx`, detect variadic blocks → render "+" button below last input handle
- [ ] **2.14** "Add input" action: increment `dynamicInputCount` in node data, re-render handles with `in_0`...`in_N` IDs
- [ ] **2.15** "Remove input" button on hover of each port beyond `minInputs` — removes port and disconnects edge
- [ ] **2.16** Drag-to-expand: dragging a wire to the bottom of a variadic node auto-creates a new port
- [ ] **2.17** i18n keys for add/remove port tooltips across all 7 locales
- [ ] **2.18** E2E test: create add block with 4 inputs, wire numbers, verify sum

---

## Phase 3 — Scientific Accuracy & Precision

Make ChainSolve trustworthy for PhD-level research and production vehicle calculations.

### 3A — Arbitrary Precision Foundation

- [ ] **3.1** Add `dashu-float` dependency to `engine-core/Cargo.toml` behind `high-precision` feature flag
- [ ] **3.2** Enable feature in `engine-wasm/Cargo.toml`
- [ ] **3.3** Add `Value::HighPrecision { display: String, approx: f64, precision: u32 }` to `types.rs`
- [ ] **3.4** Update serde for new variant
- [ ] **3.5** Update `canonicalize_value()` to pass through HP values
- [ ] **3.6** Create `precision.rs` — HP arithmetic: add, sub, mul, div, sqrt, pow, sin, cos, pi (Chudnovsky)
- [ ] **3.7** Add `precision: Option<u32>` to `EvalOptions`
- [ ] **3.8** In `ops.rs`, branch to HP path when precision set
- [ ] **3.9** Per-node precision override via `data.precision`
- [ ] **3.10** Mirror `HighPrecision` in `src/engine/value.ts`
- [ ] **3.11** Format HP values in `formatValue` — display string, truncated to user's display precision
- [ ] **3.12** Precision mode selector in settings panel
- [ ] **3.13** Golden fixture: `1/3 * 3 = 1.000...` at 100 digits
- [ ] **3.14** Golden fixture: pi to 1000 digits
- [ ] **3.15** Verify WASM size stays within 250KB gzip budget

### 3B — Compensated Arithmetic

- [ ] **3.16** Create `compensated.rs` — Ogita-Rump-Oishi dot product, Kahan-Babuska-Neumaier sum, compensated two-product
- [ ] **3.17** Replace `kahan_sum` in vector ops with `compensated_sum`
- [ ] **3.18** Use `compensated_dot` in matrix multiply and statistics blocks
- [ ] **3.19** Golden fixture: `sum(1e16, 1, -1e16) = 1`
- [ ] **3.20** Benchmark: compensated within 2x of naive

### 3C — Uncertainty Propagation

- [ ] **3.21** Design `Value::Uncertain { value, uncertainty, confidence }` variant
- [ ] **3.22** Implement standard error propagation for arithmetic ops
- [ ] **3.23** Opt-in via `EvalOptions`
- [ ] **3.24** Mirror in TypeScript
- [ ] **3.25** Display as `value ± uncertainty` in Display nodes

---

## Phase 4 — ODE/PDE Solvers

Required before vehicle simulation — suspension, thermal models, and lap sim need ODE solvers.

### 4A — Core ODE Module

- [ ] **4.1** Create `crates/engine-core/src/ode/mod.rs` with `rk4`, `rk45`, `bdf`, `types` submodules
- [ ] **4.2** `ode/types.rs` — `OdeSystem`, `OdeResult`, `OdeSolverConfig` structs
- [ ] **4.3** `ode/rk4.rs` — classic 4th-order Runge-Kutta (fixed step, expression-based RHS via `expr.rs`)
- [ ] **4.4** `ode/rk45.rs` — Dormand-Prince adaptive step with error control (ref: Dormand & Prince 1980)
- [ ] **4.5** `ode/bdf.rs` — implicit BDF for stiff systems with Newton iteration (ref: Hairer & Wanner 1996)
- [ ] **4.6** Register `ode` module in `lib.rs`
- [ ] **4.7** Unit tests: `y'=y` → `e^t`, stiff decay, harmonic oscillator energy conservation, Lorenz determinism

### 4B — ODE Blocks

- [ ] **4.8** Match arms in `ops.rs` for `ode.rk4`, `ode.rk45`, `ode.bdf`, `ode.stateSpace`, `ode.initialCondition`, `ode.systemDef`
- [ ] **4.9** Create `src/blocks/ode-blocks.ts` with 6 block definitions
- [ ] **4.10** Register in `registry.ts`, add `BlockCategory` `'odeSolvers'`
- [ ] **4.11** i18n labels across all 7 locales
- [ ] **4.12** Catalog entries in `catalog.rs`
- [ ] **4.13** Golden fixtures: exponential, harmonic, stiff

---

## Phase 5 — Vehicle Simulation

Ref: Pacejka 2012, Milliken & Milliken 1995, Dixon 2009.

### 5A — Tire (Pacejka Magic Formula)

- [ ] **5.1** Create `vehicle/mod.rs` with `tire`, `suspension`, `aero`, `powertrain`, `lap`, `thermal` submodules
- [ ] **5.2** `vehicle/tire.rs` — lateral force, longitudinal force, combined slip, tire sweep, presets
- [ ] **5.3** Match arms in `ops.rs` for `veh.tire.*`
- [ ] **5.4** Unit tests against published Pacejka data

### 5B — Suspension

- [ ] **5.5** `vehicle/suspension.rs` — quarter-car, half-car, full vehicle 7-DOF (uses ODE solvers)
- [ ] **5.6** Match arms for `veh.suspension.*`

### 5C — Aero, Powertrain, Lap Sim

- [ ] **5.7** `vehicle/aero.rs` — drag, downforce, side force, balance, presets
- [ ] **5.8** `vehicle/powertrain.rs` — torque map interpolation, gear ratios, drivetrain loss
- [ ] **5.9** `vehicle/lap.rs` — point-mass quasi-steady-state lap simulation
- [ ] **5.10** Match arms for all `veh.aero.*`, `veh.powertrain.*`, `veh.lap.*`

### 5D — Telemetry & Thermal

- [ ] **5.11** `veh.telemetry.compare` — overlay sim vs actual data
- [ ] **5.12** `vehicle/thermal.rs` — brake thermal model with ODE solver
- [ ] **5.13** Match arms for `veh.brake.*`

### 5E — Block Definitions & Registration

- [ ] **5.14** Create `src/blocks/vehicle-blocks.ts` with ~25 block definitions
- [ ] **5.15** Add `BlockCategory` `'vehicleSim'`, register all in `registry.ts`
- [ ] **5.16** Catalog entries, i18n labels across 7 locales
- [ ] **5.17** Golden fixtures: Pacejka force, quarter-car step response, simple lap time

---

## Phase 6 — Neural Network Training Pipeline

The NN module has real implementations (Sequential, Dense, Conv1D, backprop) but `nn.trainer` is a stub.

- [ ] **6.1** Wire `nn.trainer` in `ops.rs` — parse layers from `data.layers`, call `nn::train::train()`, return loss history + serialised model
- [ ] **6.2** Wire `nn.predict` — deserialise model, run `Sequential::forward()`
- [ ] **6.3** Layer configuration UI panel in FloatingInspector
- [ ] **6.4** `nn/lr_schedule.rs` — constant, step decay, cosine annealing, exponential decay
- [ ] **6.5** Early stopping with validation split and patience
- [ ] **6.6** Training always has defined end: `maxEpochs` (required, > 0) or `targetLoss`
- [ ] **6.7** Progress callback: `{ epoch, totalEpochs, trainLoss, valLoss, bestLoss, lr }`
- [ ] **6.8** New blocks: `nn.lrSchedule`, `nn.summary`
- [ ] **6.9** Golden fixture: XOR training, verify loss decreases

---

## Phase 7 — ML Training Workflows

### 7A — Feature Preprocessing

- [ ] **7.1** `ml/preprocess.rs` — standardise, normalise, train/test split
- [ ] **7.2** Ops: `ml.featureScale`, `ml.trainTestSplit`
- [ ] **7.3** Block definitions and i18n

### 7B — Classification Metrics

- [ ] **7.4** `ml/classification_metrics.rs` — precision/recall/F1, ROC curve, AUC
- [ ] **7.5** Ops: `ml.classMetrics`, `ml.rocCurve`, `ml.auc`
- [ ] **7.6** Block definitions and i18n

### 7C — Cross-Validation & Grid Search

- [ ] **7.7** `ml.kfoldCV` op — k-fold cross-validation as a macro op
- [ ] **7.8** `ml.gridSearch` op — parameter grid search (finite: iterates all combos, no looping)
- [ ] **7.9** Block definitions and i18n
- [ ] **7.10** Golden fixtures for k-fold CV and grid search

---

## Phase 8 — Optimisation Engine

### 8A — LP Solver

- [ ] **8.1** `optim/lp.rs` — revised simplex with Bland's anti-cycling (ref: Nocedal & Wright 2006)
- [ ] **8.2** `optim.lpSolve` op
- [ ] **8.3** Golden fixture

### 8B — QP Solver

- [ ] **8.4** `optim/qp.rs` — Mehrotra interior point for convex QP
- [ ] **8.5** `optim.qpSolve` op
- [ ] **8.6** Golden fixture

### 8C — Multi-Objective (NSGA-II)

- [ ] **8.7** `optim/pareto.rs` — NSGA-II (ref: Deb et al. 2002)
- [ ] **8.8** `optim.paretoFront` op, block definition, i18n

### 8D — Global Sensitivity (Sobol')

- [ ] **8.9** `optim/sobol_sensitivity.rs` — Sobol' indices (ref: Saltelli 2002)
- [ ] **8.10** `optim.sobolSensitivity` op, block definition, i18n
- [ ] **8.11** Golden fixture with known analytical indices

---

## Phase 9 — Long-Running & Looping Simulation Infrastructure

Simulations and training run on a dedicated worker. Most tasks are **finite** (defined end). Some simulations support **looping** — the user explicitly opts in, the simulation runs for N cycles or until stopped, and results stream to a live graph (e.g., pendulum angle vs time showing periodic motion). Looping is user-initiated, never automatic.

### 9A — Simulation Worker

- [ ] **9.1** Create `src/engine/simulationWorker.ts` — `SimulationWorkerAPI`, dedicated Web Worker
- [ ] **9.2** Loads same WASM module as eval worker
- [ ] **9.3** Messages: `runSimulation`, `cancelSimulation`
- [ ] **9.4** Simulation config has a defined end: `maxIterations`, `targetLoss`, `endTime`, `convergenceThreshold`
- [ ] **9.5** **Looping mode**: config can set `loop: true` + `loopCount: N` (default 1). When `loop: true` and `loopCount > 1`, the simulation restarts from initial conditions after each cycle for N total cycles. When `loopCount` is omitted, loops until the user clicks Stop. Results from each cycle append to the output table for plotting periodic behaviour (e.g., pendulum: angle vs time over 10 periods).
- [ ] **9.6** Progress: `{ type: 'simulationProgress', iteration, totalIterations, cycle, totalCycles, partialResults, metrics }`
- [ ] **9.7** Completion: `{ type: 'simulationResult', result, status: 'complete' | 'cancelled', cyclesCompleted }`

### 9B — WASM Binding

- [ ] **9.8** `run_simulation(config_json, progress_cb) -> String` in `engine-wasm`
- [ ] **9.9** Config: `{ op, inputs, maxIterations, endTime?, convergenceThreshold?, batchSize?, loop?, loopCount? }`
- [ ] **9.10** For looping: Rust runs the ODE/simulation solver for one cycle, appends results, resets state to initial conditions, repeats. Progress callback fires between cycles with accumulated results.
- [ ] **9.11** Progress callback returns `Continue | Abort` for cancellation (works between cycles for looping sims)

### 9C — Engine API

- [ ] **9.12** `runSimulation(config, onProgress) -> Promise<SimulationResult>` in `EngineAPI`
- [ ] **9.13** `cancelSimulation(requestId) -> void`
- [ ] **9.14** `isSimulationRunning() -> boolean`

### 9D — NN Training Integration

- [ ] **9.15** `nn.trainer` requires `maxEpochs > 0` or `targetLoss` — always finite, no looping
- [ ] **9.16** Stream `{ epoch, totalEpochs, trainLoss, valLoss }` per epoch
- [ ] **9.17** Return model at best validation loss on complete/cancel
- [ ] **9.18** Inspector UI: "Train" starts, "Stop" cancels. Live loss chart.

### 9E — Looping Simulation UI

- [ ] **9.19** ODE/vehicle sim inspector panels: checkbox "Loop simulation" + input "Number of cycles" (default: until stopped)
- [ ] **9.20** When looping, connected Plot blocks update live — each cycle appends data points, graph extends in real-time
- [ ] **9.21** "Stop" button cleanly ends after the current cycle (no mid-cycle abort unless force-cancelled)
- [ ] **9.22** Live cycle counter in inspector: "Cycle 3/10" or "Cycle 7 (running until stopped)"

### 9F — Status & Testing

- [ ] **9.23** `simulationStatusStore.ts` — tracks: `{ nodeId, status, iteration, totalIterations, cycle, totalCycles, metrics }`
- [ ] **9.24** StatusBar shows "Simulating (cycle 3/10)" or "Training (epoch 47/100)"
- [ ] **9.25** Normal graph eval continues while sim runs on separate worker
- [ ] **9.26** Test: finite simulation completes and returns results
- [ ] **9.27** Test: looping pendulum sim for 5 cycles, verify 5x data in output table
- [ ] **9.28** Test: loop until stopped, cancel after 3 cycles, verify partial results returned
- [ ] **9.29** Test: cancel mid-training, model returned at best loss
- [ ] **9.30** Test: normal eval works during active simulation

---

## Phase 10 — Block-to-Block Magnetic Snapping (NEW)

When dragging a block near another, show ghost highlight of snap position before release.

### 10A — Snap Detection

- [ ] **10.1** Create `src/hooks/useBlockSnapping.ts` — calculate snap targets from block positions/dimensions
- [ ] **10.2** Snap zones: right-to-left (horizontal chain), bottom-to-top (vertical), center-align H/V
- [ ] **10.3** Snap threshold: 20px (configurable)
- [ ] **10.4** During drag, compute nearest snap target for each side
- [ ] **10.5** Return adjusted position + snap guide metadata

### 10B — Visual Guides

- [ ] **10.6** Create `src/components/canvas/SnapGuides.tsx` — alignment guide lines on canvas
- [ ] **10.7** Ghost highlight: semi-transparent outline at snap position while dragging near target
- [ ] **10.8** Guide lines: thin cyan (#1CABB0) lines extending across canvas when blocks aligned
- [ ] **10.9** Snap feedback: subtle animation when block snaps

### 10C — Integration

- [ ] **10.10** Wire into `CanvasArea.tsx` `onNodeDrag` — adjust position in real-time
- [ ] **10.11** "Magnetic snap" toggle in CanvasToolbar (separate from grid snap)
- [ ] **10.12** Persist toggle in localStorage
- [ ] **10.13** Works during multi-selection drag
- [ ] **10.14** i18n keys across 7 locales
- [ ] **10.15** Performance: snap computation < 2ms per frame with 500 blocks

---

## Phase 11 — Formula Bar Expression Language (NEW — MAJOR FEATURE)

Users type `1+1=` → auto-creates Number(1), Number(1), Add, Display blocks wired together. Full typed language covering every block type.

### 11A — Language Design (CSEL — ChainSolve Expression Language)

- [ ] **11.1** Design CSEL grammar:
  - Arithmetic: `1 + 2`, `3 * (x + 2)`, `sin(pi/4)`
  - Pipe/chain: `5 | add(3) | multiply(2) | display` or `5 -> add(3) -> display`
  - Assignment: `x = 5; y = x * 2; y + 1 =`
  - Block refs: `Number(5)`, `Slider(0, 100, 50)`, `Pacejka(alpha, Fz, B, C, D, E)`
  - Functions: `sin(x)`, `max(a, b, c)` (maps to variadic blocks)
  - Trailing `=` creates Display block for the result
- [ ] **11.2** Document grammar in `docs/CSEL.md` with comprehensive examples
- [ ] **11.3** Define AST types in `src/engine/csel/types.ts`

### 11B — Parser

- [ ] **11.4** Create `src/engine/csel/lexer.ts` — tokeniser for numbers, identifiers, operators, parens, pipe, arrow, equals
- [ ] **11.5** Create `src/engine/csel/parser.ts` — recursive descent parser producing AST
- [ ] **11.6** `src/engine/csel/errors.ts` — descriptive parse errors with position info
- [ ] **11.7** Unit tests: arithmetic, function calls, pipes, assignments, error cases

### 11C — Graph Generator

- [ ] **11.8** Create `src/engine/csel/graphGen.ts` — converts AST to React Flow nodes + edges
- [ ] **11.9** Map operators to blocks: `+` → `add`, `*` → `multiply`, `sin()` → `trig.sin`
- [ ] **11.10** Auto-create Number source blocks for literals
- [ ] **11.11** Trailing `=` or explicit `display` → create Display block
- [ ] **11.12** Auto-layout using dagre (already a dependency) — left-to-right flow
- [ ] **11.13** Handle variadic: `max(a, b, c, d)` → single max block with 4 inputs
- [ ] **11.14** Handle variables: `x = 5` → named Number block; `x` references wire to it
- [ ] **11.15** Unit tests: expression → node/edge graph, verify wiring

### 11D — Enhanced FormulaBar UI

- [ ] **11.16** Redesign `FormulaBar.tsx` — full-width below sheet tabs, resizable height
- [ ] **11.17** Syntax highlighting (colour operators, numbers, functions, errors)
- [ ] **11.18** Autocomplete: block types, function names, variable names, constants
- [ ] **11.19** Error preview: inline underlines with tooltip messages
- [ ] **11.20** Expression history (up/down arrow cycles previous expressions)
- [ ] **11.21** Enter → parse, generate blocks, add to canvas, clear bar
- [ ] **11.22** Shift+Enter for multi-line, Enter to execute
- [ ] **11.23** Toggle between value-edit mode (current) and expression mode (new)

### 11E — Integration & Testing

- [ ] **11.24** Wire expression submission to canvas: add generated nodes/edges via React Flow
- [ ] **11.25** Position generated blocks relative to viewport centre
- [ ] **11.26** Auto-select generated blocks after creation
- [ ] **11.27** i18n keys across 7 locales
- [ ] **11.28** E2E test: `1 + 2 =` → 3 blocks wired correctly
- [ ] **11.29** E2E test: `sin(pi/4) =` → trig + constant + display
- [ ] **11.30** E2E test: `x = 5; y = 10; x * y =` → named blocks with correct wiring

---

## Phase 12 — Frontend Polish

### 12A — CanvasArea Decomposition

- [ ] **12.1** Extract keyboard shortcuts (~200 lines) to `src/hooks/useCanvasKeyboard.ts`
- [ ] **12.2** Extract context menu logic (~150 lines) to `src/hooks/useCanvasContextMenu.ts`
- [ ] **12.3** Extract drag/drop handlers to `src/hooks/useCanvasDragDrop.ts`
- [ ] **12.4** Extract clipboard ops to `src/hooks/useCanvasClipboard.ts`
- [ ] **12.5** Extract group/template ops to `src/hooks/useCanvasGroups.ts`
- [ ] **12.6** Verify no behaviour changes — run E2E smoke after each extraction

### 12B — Node Visual States

- [ ] **12.7** `nodeStyles.ts` — stale overlay: `opacity: 0.5, filter: grayscale(30%), borderStyle: dashed`
- [ ] **12.8** Computing spinner overlay when engine evaluating a node
- [ ] **12.9** Error badge (red dot) in top-right corner
- [ ] **12.10** Update OperationNode, DisplayNode, DataNode, PlotNode with stale/error styles

---

## Phase 13 — End-to-End UX Audit (NEW)

Every user journey, from first signup to daily power use, must be polished and professional.

### 13A — User Journey Audit

- [ ] **13.1** Map every journey: signup → onboarding → first project → learning → upgrading → settings → power user
- [ ] **13.2** Map collaboration: sharing, exporting, multiplayer considerations
- [ ] **13.3** Map marketplace: publishing, downloading, reviews
- [ ] **13.4** Document friction points, dead ends, confusion risks
- [ ] **13.5** Create `docs/UX_AUDIT.md`

### 13B — Visual Polish

- [ ] **13.6** Audit every component: colour, spacing, typography, border radii, shadows — consistency
- [ ] **13.7** All states visually distinct: hover, active, focused, disabled, loading, error, success
- [ ] **13.8** Animation/transition audit: smooth easing, no jarring jumps
- [ ] **13.9** Marketing readiness: canvas looks beautiful with 20-30 block graph
- [ ] **13.10** Dark/light mode polish: all components correct in both themes

### 13C — Performance at Scale

- [ ] **13.11** Benchmark: 100, 500, 1000, 5000 blocks — FPS, eval time, memory
- [ ] **13.12** Benchmark: 100 projects in list — load time, scroll performance
- [ ] **13.13** Identify and fix performance cliffs
- [ ] **13.14** Canvas virtualisation audit: only visible nodes rendered

### 13D — Stability & Security

- [ ] **13.15** WCAG 2.1 AA compliance: contrast, keyboard nav, screen reader labels
- [ ] **13.16** Error boundary coverage on every lazy-loaded route/panel
- [ ] **13.17** Offline resilience: graceful handling of network drops
- [ ] **13.18** Browser compatibility: Chrome, Firefox, Safari, Edge
- [ ] **13.19** Memory leak audit: open/close projects 50 times, verify stable memory

### 13E — Competitive Benchmarking

- [ ] **13.20** Side-by-side vs MATLAB/Simulink: where ChainSolve wins vs loses
- [ ] **13.21** Side-by-side vs Excel: ease of building computation models
- [ ] **13.22** Side-by-side vs Altair HyperStudy: DOE + optimisation workflow
- [ ] **13.23** Document advantages and remaining gaps in `docs/COMPETITIVE_ANALYSIS.md`

---

## Phase 14 — Housekeeping & Professional Audit

### 14A — Code Quality

- [ ] **14.1** `npx tsc -b --noEmit` — fix all type errors
- [ ] **14.2** `npm run lint` — fix all ESLint violations
- [ ] **14.3** `npm run format` — Prettier on all files
- [ ] **14.4** Scan TODO/FIXME/HACK comments — resolve or convert to GitHub issues
- [ ] **14.5** Audit catch blocks for consistent `[ERROR_CODE]` pattern
- [ ] **14.6** Move `@types/dagre` from dependencies to devDependencies
- [ ] **14.7** `npx depcheck` — remove unused npm deps
- [ ] **14.8** `npm audit` + `cargo audit` — fix security issues
- [ ] **14.9** `cargo update` — patch-level updates

### 14B — Documentation

- [ ] **14.10** Update `CLAUDE.md` with reactive eval model, variadic blocks, CSEL, magnetic snapping
- [ ] **14.11** Update `ARCHITECTURE.md` with new modules (ODE, vehicle, CSEL parser)
- [ ] **14.12** Update `README.md` with new block count and capabilities
- [ ] **14.13** Update `CHANGELOG.md`
- [ ] **14.14** New ADRs: reactive eval, variadic blocks, CSEL grammar, magnetic snapping, simulation worker
- [ ] **14.15** Update `W9_ENGINE.md`, `W9_3_CORRECTNESS.md`, `UX.md`
- [ ] **14.16** Clean up outdated docs

### 14C — i18n Completeness

- [ ] **14.17** `node scripts/check-i18n-keys.mjs` — verify all keys across 7 locales
- [ ] **14.18** Translations for all new block labels
- [ ] **14.19** Translations for all new UI strings
- [ ] **14.20** `node scripts/check-i18n-hardcoded.mjs` — no hardcoded strings

### 14D — Database & Migrations

- [ ] **14.21** Audit all 15 migrations for idempotency
- [ ] **14.22** Verify RLS policies cover all tables
- [ ] **14.23** Verify FK cascades correct
- [ ] **14.24** Consider squashing to single clean baseline (pre-release)

### 14E — Testing

- [ ] **14.25** Every new Rust module has `#[cfg(test)]` unit tests
- [ ] **14.26** Golden fixtures for all new op categories
- [ ] **14.27** Property tests: determinism, incremental consistency, no-panic
- [ ] **14.28** Criterion benchmarks: NN training, ODE solver, Pacejka, LP solver
- [ ] **14.29** Vitest tests: evalScheduler, formula bar parser, snap detection
- [ ] **14.30** Playwright E2E: drag without eval spam, Run button, formula bar expression, variadic blocks

### 14F — CI & Final Verification

- [ ] **14.31** `scripts/verify-fast.sh` passes
- [ ] **14.32** `scripts/verify-ci.sh` passes (including WASM build)
- [ ] **14.33** Bundle size within budget (400KB JS gzip, 250KB WASM gzip)
- [ ] **14.34** `scripts/check-wasm-exports.mjs` updated for new exports
- [ ] **14.35** Flakiness check: `CI=true npx playwright test --project=smoke --repeat-each=5`
- [ ] **14.36** Full `npm run verify:ci` — all gates green

### 14G — Final Smoke Tests

- [ ] **14.37** 3-node graph (Number → Add → Display): reactive eval works instantly
- [ ] **14.38** 100-node graph: drag blocks at 60fps, zero console spam
- [ ] **14.39** Manual mode: edit values, stale indicators show, Run button evaluates
- [ ] **14.40** Formula bar: type `1 + 2 =`, blocks created and wired correctly
- [ ] **14.41** Variadic: add block with 5 inputs, all summed correctly
- [ ] **14.42** Magnetic snap: drag near another block, ghost shows, snap on release
- [ ] **14.43** ODE: exponential growth matches `e^t`
- [ ] **14.44** Pacejka: tire force at known slip angle matches published data
- [ ] **14.45** NN: train XOR, loss decreases, training completes at maxEpochs
- [ ] **14.46** High precision: `1/3 * 3` at 100 digits equals exactly 1
- [ ] **14.47** Full E2E suite: `npm run test:e2e`
- [ ] **14.48** Full Rust tests: `cargo test --workspace`
- [ ] **14.49** Final `npm run verify:ci` — clean pass

---

## Summary

| Phase | Name | Steps | Status |
| ----- | ---- | ----- | ------ |
| 0 | Drag Performance Fix | 10 | DONE |
| 1 | Reactive Evaluation Model | 28 | PARTIAL (rework needed) |
| 2 | Multi-Input Variadic Blocks | 18 | NEW |
| 3 | Scientific Accuracy & Precision | 25 | Pending |
| 4 | ODE/PDE Solvers | 13 | Pending |
| 5 | Vehicle Simulation | 17 | Pending |
| 6 | NN Training Pipeline | 9 | Pending |
| 7 | ML Training Workflows | 10 | Pending |
| 8 | Optimisation Engine | 11 | Pending |
| 9 | Simulation Infra (finite + opt-in looping) | 30 | Pending |
| 10 | Block-to-Block Magnetic Snapping | 15 | NEW |
| 11 | Formula Bar Expression Language | 30 | NEW |
| 12 | Frontend Polish | 10 | Pending |
| 13 | End-to-End UX Audit | 23 | NEW |
| 14 | Housekeeping & Professional Audit | 49 | Pending (updated) |
| **Total** | | **~298** | |

---

*This checklist is the single source of truth for the ChainSolve improvements roadmap. Every item is independently implementable, testable, and verifiable. Phases are ordered by dependency — later phases build on earlier ones. No continuous evaluation. No indefinite loops. Simple, robust, best-in-class.*
