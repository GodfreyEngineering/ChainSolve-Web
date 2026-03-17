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

- [x] **2.1** Add `variadic: Option<bool>`, `min_inputs: Option<u32>`, `max_inputs: Option<u32>` fields to `CatalogEntry` in `catalog.rs`. Converted all 347 entries to use `entry()`/`variadic_entry()` helpers.
- [x] **2.2** Mark ops as variadic: `add`, `multiply`, `max`, `min`, `vectorConcat`, `text_concat` — `min_inputs: 2, max_inputs: 64`
- [x] **2.3** Create `nary_broadcast()` in `ops.rs` — left-fold with broadcasting across `in_0`..`in_N`, falls back to `a`/`b` for backward compat
- [x] **2.4** `nary_broadcast` handles both scalar reduction and vector broadcasting via `binary_broadcast_two_values()` helper
- [x] **2.5** Updated `add`, `multiply`, `max`, `min` match arms to use `nary_broadcast`
- [ ] **2.6** Update `validate_pre_eval()` to skip fixed-port validation for variadic ops *(deferred — validation already works with variadic since it checks catalog inputs which list the default a/b ports)*
- [x] **2.7** 8 unit tests: add with 3/5/10 inputs, multiply with 3, max/min with 4, scalar+vector mix, backward compat
- [ ] **2.8** Golden fixtures: `variadic_add.fixture.json`, `variadic_multiply.fixture.json`

### 2B — TypeScript Variadic Support

- [x] **2.9** Add `variadic?: boolean`, `minInputs?: number`, `maxInputs?: number` to `BlockDef` in `src/blocks/types.ts`
- [x] **2.10** Add variadic fields to `CatalogEntry` in `wasm-types.ts` for WASM bridge
- [x] **2.11** Mark add, multiply, max, min as variadic in `registry.ts` block definitions
- [ ] **2.12** Update `diffGraph.ts` to handle dynamic port changes (new/removed ports emit appropriate ops)

### 2C — Variadic Node UI

- [x] **2.13** In `OperationNode.tsx`, detect variadic blocks → render "+" button below last input handle
- [x] **2.14** "Add input" action: increment `dynamicInputCount` in node data, re-render handles with `in_0`...`in_N` IDs
- [x] **2.15** "Remove input" button (×) on each port beyond `minInputs`
- [ ] **2.16** Drag-to-expand: dragging a wire to the bottom of a variadic node auto-creates a new port *(deferred — requires React Flow connection event interception)*
- [ ] **2.17** i18n keys for add/remove port tooltips across all 7 locales *(deferred to housekeeping)*
- [ ] **2.18** E2E test: create add block with 4 inputs, wire numbers, verify sum *(blocked: browser)*

---

## Phase 3 — Scientific Accuracy & Precision

Make ChainSolve trustworthy for PhD-level research and production vehicle calculations.

### 3A — Arbitrary Precision Foundation

- [x] **3.1** Add `dashu-float` 0.4 to `engine-core/Cargo.toml` behind `high-precision` feature flag
- [x] **3.2** Enable feature in `engine-wasm/Cargo.toml`
- [x] **3.3** Add `Value::HighPrecision { display, approx, precision }` to `types.rs` with serde tagged variant
- [x] **3.4** Handle in `kind_str()`, `summarize()`, `compute_value_hash()`
- [x] **3.5** Update `canonicalize_value()` to pass through HP values unchanged
- [x] **3.6** Create `precision.rs` — HP arithmetic: add, sub, mul, div using dashu-float DBig (sqrt/pow/trig deferred)
- [x] **3.7** Add `precision: Option<u32>` to `EvalOptions`
- [x] **3.8** In `ops.rs`, `hp_or_broadcast()` checks `data.precision` and uses HP arithmetic for scalar add/sub/mul/div
- [x] **3.9** Per-node precision override via `data.precision` — returns `Value::HighPrecision` when set
- [x] **3.10** Mirror `HighPrecisionValue` in `src/engine/value.ts`, update Value union type
- [x] **3.11** Handle `highPrecision` in `formatValue`, `valueFormat.ts`, `expressionExtractor.ts`
- [ ] **3.12** Precision mode selector in settings panel
- [ ] **3.13** Golden fixture: `1/3 * 3 = 1.000...` at 100 digits
- [ ] **3.14** Golden fixture: pi to 1000 digits
- [ ] **3.15** Verify WASM size stays within 250KB gzip budget

### 3B — Compensated Arithmetic

- [x] **3.16** Create `compensated.rs` — Neumaier compensated sum, Ogita-Rump-Oishi dot product, Dekker two-product (7 tests)
- [x] **3.17** `kahan_sum` in ops.rs IS already Neumaier compensated summation (identical to compensated.rs)
- [x] **3.18** Statistics blocks already use Neumaier compensated sum (kahan_sum). `compensated_dot` available for future matrix ops.
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

- [x] **4.1** Create `crates/engine-core/src/ode/mod.rs` with `rk4`, `types` submodules (rk45, bdf deferred)
- [x] **4.2** `ode/types.rs` — `OdeSystem`, `OdeResult`, `OdeSolverConfig` structs
- [x] **4.3** `ode/rk4.rs` — classic 4th-order Runge-Kutta with expression-based RHS, parameter support, 4 tests
- [x] **4.4** `ode/rk45.rs` — Dormand-Prince RK4(5) adaptive step with automatic step control and error estimation
- [ ] **4.5** `ode/bdf.rs` — implicit BDF for stiff systems (deferred — complex implicit solver with Newton iteration)
- [x] **4.6** Register `ode` module in `lib.rs`
- [x] **4.7** Unit tests: exponential growth (RK4+RK45), harmonic oscillator (RK4+RK45, energy conservation), parametric, structure

### 4B — ODE Blocks

- [x] **4.8** Match arms in `ops.rs` for `ode.rk4`, `ode.rk45` (bdf/stateSpace/initialCondition/systemDef deferred)
- [x] **4.9** ODE blocks added directly to `registry.ts` (ode.rk4, ode.rk45) with descriptions
- [x] **4.10** `BlockCategory 'odeSolvers'` registered, blocks in taxonomy
- [ ] **4.11** i18n labels across all 7 locales *(deferred to housekeeping)*
- [x] **4.12** Catalog entries in `catalog.rs` (ode.rk4, ode.rk45 + 3 tire blocks = 347 total)
- [ ] **4.13** Golden fixtures: exponential, harmonic, stiff

---

## Phase 5 — Vehicle Simulation

Ref: Pacejka 2012, Milliken & Milliken 1995, Dixon 2009.

### 5A — Tire (Pacejka Magic Formula)

- [x] **5.1** Create `vehicle/mod.rs` with `tire` submodule (suspension/aero/powertrain/lap/thermal deferred)
- [x] **5.2** `vehicle/tire.rs` — Pacejka Magic Formula: lateral/longitudinal force, sweep, 4 presets, 6 tests
- [x] **5.3** Match arms in `ops.rs` for `veh.tire.lateralForce`, `veh.tire.longForce`, `veh.tire.sweep`
- [x] **5.4** 6 unit tests: zero-slip, monotonicity, Fz proportionality, antisymmetry, sweep, presets

### 5B — Suspension

- [x] **5.5** `vehicle/suspension.rs` — quarter-car 2-DOF model using RK45, DEFAULT_PASSENGER preset, 2 tests
- [x] **5.6** Match arms for `veh.suspension.quarterCar` + catalog + TS block

### 5C — Aero, Powertrain, Lap Sim

- [x] **5.7** `vehicle/aero.rs` — drag, downforce, side_force, aero_balance, cd_a + 4 presets + 5 tests
- [x] **5.8** `vehicle/powertrain.rs` — torque_from_map, gear_ratio, drivetrain_loss, wheel_speed + 4 tests
- [x] **5.9** `vehicle/lap.rs` — point-mass lap sim with forward/backward speed integration, 2 tests
- [x] **5.10** Match arms for `veh.aero.drag`, `veh.aero.downforce`, `veh.aero.balance`, `veh.powertrain.gearRatio`, `veh.powertrain.wheelSpeed`, `veh.powertrain.drivetrainLoss` (lap sim deferred)

### 5D — Telemetry & Thermal

- [ ] **5.11** `veh.telemetry.compare` — overlay sim vs actual data
- [x] **5.12** `vehicle/thermal.rs` — brake_temp_derivative, brake_energy, brake_power (4 tests)
- [x] **5.13** Match arms for `veh.brake.energy`, `veh.brake.power` + catalog entries + TS blocks

### 5E — Block Definitions & Registration

- [x] **5.14** Vehicle blocks added directly to `registry.ts` (tire, aero, powertrain, suspension, lap, brake)
- [x] **5.15** `BlockCategory 'vehicleSim'` added, all blocks registered
- [x] **5.16** Catalog entries (361 total), descriptions in blockDescriptions.ts *(i18n locales deferred to housekeeping)*
- [ ] **5.17** Golden fixtures *(deferred)*

---

## Phase 6 — Neural Network Training Pipeline

The NN module has real implementations (Sequential, Dense, Conv1D, backprop) but `nn.trainer` is a stub.

- [x] **6.1** Wire `nn.trainer` in `ops.rs` — parse layers from `data.layers`, build Sequential model, call `nn::train::train()`, return loss Table
- [x] **6.2** Wire `nn.predict` — proper input handling added (model import from JSON deferred)
- [ ] **6.3** Layer configuration UI panel in FloatingInspector
- [x] **6.4** `nn/lr_schedule.rs` — Constant, StepDecay, CosineAnnealing, ExponentialDecay (5 tests)
- [x] **6.5** TrainConfig: patience + validation_split fields added, TrainResult: val_loss_history + early_stopped
- [ ] **6.6** Training always has defined end: `maxEpochs` (required, > 0) or `targetLoss`
- [ ] **6.7** Progress callback: `{ epoch, totalEpochs, trainLoss, valLoss, bestLoss, lr }`
- [ ] **6.8** New blocks: `nn.lrSchedule`, `nn.summary`
- [ ] **6.9** Golden fixture: XOR training, verify loss decreases

---

## Phase 7 — ML Training Workflows

### 7A — Feature Preprocessing

- [x] **7.1** `ml/preprocess.rs` — standardize, normalize, train_test_split (3 tests)
- [x] **7.2** Ops: `ml.featureScale` wired in ops.rs + catalog + TS block (trainTestSplit deferred)
- [ ] **7.3** Block definitions and i18n *(deferred)*

### 7B — Classification Metrics

- [x] **7.4** `ml/classification_metrics.rs` — precision/recall/F1, ROC curve, AUC (4 tests)
- [x] **7.5** Ops: `ml.classMetrics`, `ml.rocCurve`, `ml.auc` wired in ops.rs + catalog + TS blocks
- [x] **7.6** Block definitions + descriptions added to registry.ts and blockDescriptions.ts

### 7C — Cross-Validation & Grid Search

- [ ] **7.7** `ml.kfoldCV` op — k-fold cross-validation as a macro op
- [ ] **7.8** `ml.gridSearch` op — parameter grid search (finite: iterates all combos, no looping)
- [ ] **7.9** Block definitions and i18n
- [ ] **7.10** Golden fixtures for k-fold CV and grid search

---

## Phase 8 — Optimisation Engine

### 8A — LP Solver

- [x] **8.1** `optim/lp.rs` — two-phase simplex with Bland's anti-cycling rule (2 tests)
- [ ] **8.2** `optim.lpSolve` op *(Rust function ready, ops.rs wiring deferred)*
- [ ] **8.3** Golden fixture *(deferred)*

### 8B — QP Solver

- [x] **8.4** `optim/qp.rs` — projected gradient descent for convex QP with boundary constraints (2 tests)
- [ ] **8.5** `optim.qpSolve` op
- [ ] **8.6** Golden fixture

### 8C — Multi-Objective (NSGA-II)

- [x] **8.7** `optim/pareto.rs` — NSGA-II with non-dominated sorting, crowding distance, SBX crossover (2 tests)
- [ ] **8.8** `optim.paretoFront` op, block definition, i18n *(Rust function ready, ops/TS wiring deferred)*

### 8D — Global Sensitivity (Sobol')

- [x] **8.9** `optim/sobol_sensitivity.rs` — Saltelli sampling, S1 + ST indices (2 tests)
- [ ] **8.10** `optim.sobolSensitivity` op, block definition, i18n *(Rust function ready, ops/TS wiring deferred)*
- [ ] **8.11** Golden fixture *(deferred)*

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

- [x] **10.1** Create `src/hooks/useBlockSnapping.ts` — snap detection engine with 6 snap zones
- [x] **10.2** Snap zones: right→left (horizontal chain, 12px gap), bottom→top (vertical), center-align H/V
- [x] **10.3** Snap threshold: 20px default (configurable via hook parameter)
- [x] **10.4** `computeSnap()` finds nearest snap target across all non-annotation/group nodes
- [x] **10.5** Returns `{ x, y, snapped, guides }` with SnapGuide metadata for rendering

### 10B — Visual Guides

- [x] **10.6** Create `src/components/canvas/SnapGuides.tsx` — SVG overlay rendering alignment guide lines
- [ ] **10.7** Ghost highlight: semi-transparent outline at snap position *(deferred — guide lines sufficient for v1)*
- [x] **10.8** Guide lines: thin cyan (#1CABB0) dashed lines when blocks aligned
- [ ] **10.9** Snap feedback animation *(deferred)*

### 10C — Integration

- [x] **10.10** Wire into `CanvasArea.tsx` `onNodeDrag` — adjusts position in real-time during drag
- [ ] **10.11** "Magnetic snap" toggle in CanvasToolbar *(deferred — state exists, UI toggle not yet added)*
- [x] **10.12** Persist toggle in localStorage (`cs:magneticSnap`)
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
- [x] **11.3** Define AST types in `src/engine/csel/types.ts` — literal, identifier, binary, unary, call, assign, display

### 11B — Parser

- [x] **11.4** `src/engine/csel/lexer.ts` — tokeniser: numbers, identifiers, operators, parens, pipe, arrow, equals, semicolons
- [x] **11.5** `src/engine/csel/parser.ts` — recursive descent parser with operator precedence (right-assoc ^)
- [x] **11.6** Error handling via thrown `{ message, position }` objects with parse position
- [x] **11.7** 11 parser tests + 4 graph generator tests = 15 tests total

### 11C — Graph Generator

- [x] **11.8** `src/engine/csel/graphGen.ts` — converts AST to React Flow nodes + edges
- [x] **11.9** Maps operators to blocks: `+`→add, `*`→multiply, `sin()`→sin, `max()`→max, etc.
- [x] **11.10** Auto-creates Number source blocks for literals and known constants (pi, e, tau, phi)
- [x] **11.11** Trailing `=` creates Display block for the result
- [ ] **11.12** Auto-layout using dagre *(current: simple X-offset layout, dagre integration deferred)*
- [x] **11.13** Variadic: `max(a,b,c,d)` → single max block with dynamicInputCount=4 and in_0..in_3 ports
- [x] **11.14** Variables: `x = 5` → named Number block; `x` references reuse the same node ID
- [x] **11.15** 4 graph generator tests: 1+2=, sin(pi/4)=, named variables, variadic max

### 11D — Enhanced FormulaBar UI

- [x] **11.16** FormulaBar: added 'fx' toggle button to switch to expression mode
- [ ] **11.17** Syntax highlighting *(deferred — basic text input works for v1)*
- [ ] **11.18** Autocomplete in expression mode *(deferred — block type completions for v2)*
- [ ] **11.19** Error preview: inline error messages shown when parse fails
- [ ] **11.20** Expression history *(deferred)*
- [x] **11.21** Enter → parse CSEL, generate blocks via graphGen, add to canvas, clear bar
- [ ] **11.22** Shift+Enter for multi-line *(deferred)*
- [x] **11.23** Toggle between value-edit mode and expression mode (fx button)

### 11E — Integration & Testing

- [x] **11.24** Wire expression submission: handleExpressionSubmit → parseCsel → generateGraph → addNodes/addEdges
- [x] **11.25** Position generated blocks relative to viewport centre using getViewport()
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

- [x] **12.7** `nodeStyles.ts` — staleOverlay + errorBadge CSS style constants added
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

- [x] **14.1** `npx tsc -b --noEmit` — passes cleanly (verified each commit)
- [x] **14.2** `npm run lint` — zero ESLint violations (verified each commit)
- [x] **14.3** `npm run format` — Prettier applied to all modified files (verified each commit)
- [ ] **14.4** Scan TODO/FIXME/HACK comments — resolve or convert to GitHub issues
- [ ] **14.5** Audit catch blocks for consistent `[ERROR_CODE]` pattern
- [x] **14.6** Move `@types/dagre` + `@types/katex` from dependencies to devDependencies
- [ ] **14.7** `npx depcheck` — remove unused npm deps
- [x] **14.8** `npm audit` — 0 vulnerabilities. `cargo audit` not installed (deferred)
- [ ] **14.9** `cargo update` — patch-level updates

### 14B — Documentation

- [x] **14.10** Update `CLAUDE.md` — reactive eval, CSEL, variadic blocks, magnetic snapping, all new Rust modules
- [ ] **14.11** Update `ARCHITECTURE.md` with new modules (ODE, vehicle, CSEL parser)
- [ ] **14.12** Update `README.md` with new block count and capabilities
- [ ] **14.13** Update `CHANGELOG.md`
- [ ] **14.14** New ADRs: reactive eval, variadic blocks, CSEL grammar, magnetic snapping, simulation worker
- [ ] **14.15** Update `W9_ENGINE.md`, `W9_3_CORRECTNESS.md`, `UX.md`
- [ ] **14.16** Clean up outdated docs

### 14C — i18n Completeness

- [x] **14.17** `node scripts/check-i18n-keys.mjs` — passes (2191 keys, verified each commit)
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

- [x] **14.31** `scripts/verify-fast.sh` passes (5159+ tests, verified regularly)
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
