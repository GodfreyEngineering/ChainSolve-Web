# ChainSolve Engine & Platform Improvements Checklist

> **Goal:** Transform ChainSolve into the best-in-class computation workbench — faster than MATLAB, more accurate than Excel, with a UI that feels buttery smooth. Every step below is a concrete, implementable micro-task ordered by priority and dependency.
>
> **Core pillars (priority order):**
> 1. **Performance** — 60fps canvas, instant feedback, zero wasted computation
> 2. **Accuracy** — IEEE 754 rigour, compensated algorithms, optional arbitrary precision to 9,999 decimal places
> 3. **Capability** — ODE solvers, vehicle simulation, neural network training, LP/QP optimization
> 4. **UX** — Run button, stale indicators, progress feedback, pre-run validation

---

## Phase 0 — Drag Performance Fix (Critical / Immediate)

The canvas must feel instant. Dragging blocks currently triggers constant eval cycles and graph health checks.

- [x] **0.1** In `CanvasArea.tsx`, add a `isDragging` ref (`useRef(false)`) to track drag state without re-renders
- [x] **0.2** In `onNodeDragStart` callback, call `setPaused(true)` and set `isDragging.current = true`
- [x] **0.3** In `onNodeDragStop` callback, set `isDragging.current = false` then use `setTimeout(() => setPaused(false), 200)` as a 200ms settle delay so rapid drag-release-drag doesn't thrash the engine
- [x] **0.4** Wire `onSelectionDragStart` / `onSelectionDragStop` with the same pause/unpause logic for multi-select drags *(React Flow v12 uses onNodeDragStart/Stop for selection drags — covered by 0.2/0.3)*
- [x] **0.5** Wire React Flow `onMoveStart` / `onMoveEnd` with the same logic for viewport pan/zoom (these also trigger re-renders via `onNodesChange`)
- [x] **0.6** In `useGraphEngine.ts` line 206, remove the `computeGraphHealth()` call from the snapshot eval `.then()` callback — this O(V+E) computation runs on every snapshot eval and is the main source of the "Graph health" console spam
- [x] **0.7** Move `computeGraphHealth` to be called on-demand only: when `GraphHealthPanel` is open (it's already lazy-loaded), and as part of pre-run validation (Phase 1)
- [x] **0.8** In `useGraphEngine.ts`, on the unpause transition (line 158-159), check if `diffGraph` produces any ops before forcing a full snapshot reload — if only positions changed during drag, skip the reload entirely and just update refs
- [ ] **0.9** [BLOCKED: requires browser environment] Add a unit test: mock `useGraphEngine` with `paused=true`, verify zero engine calls are made
- [ ] **0.10** [BLOCKED: requires browser environment] Manual verification: open a 50+ node project, drag a block — confirm zero "Graph health" / "snapshot eval" messages in debug console, confirm 60fps in Chrome DevTools Performance tab

---

## Phase 1 — Evaluation Model Redesign

Replace the "always auto-eval" model with a smart hybrid that auto-evals small graphs and requires manual runs for large ones.

### 1A — Eval Scheduler

- [x] **1.1** Create `src/engine/evalScheduler.ts` — a class (not a hook) that encapsulates patch accumulation and dispatch:
  - `pendingOps: PatchOp[]` — accumulated patches
  - `mode: 'auto' | 'deferred' | 'manual'` — current eval mode
  - `enqueue(ops: PatchOp[]): void` — adds ops, schedules dispatch based on mode
  - `flush(): void` — dispatches all pending ops to the engine immediately
  - `clear(): void` — discards pending ops (for navigation/disposal)
  - `pendingCount: number` — getter for UI
- [x] **1.2** Auto mode: `enqueue` calls `flush` after `PATCH_DEBOUNCE_MS` (50ms) for data-only changes, immediately for structural changes (existing behavior)
- [x] **1.3** Deferred mode: `enqueue` schedules via `requestIdleCallback` with a 2000ms timeout fallback — evaluation fires after 2s of idle or immediately if the user presses Run
- [x] **1.4** Manual mode: `enqueue` only updates `pendingCount` in the status bar store — evaluation only fires on explicit `flush()` call (Run button)
- [x] **1.5** Add auto-detection logic: `mode = nodeCount < 50 ? 'auto' : nodeCount < 300 ? 'deferred' : 'manual'` — user can override per project
- [x] **1.6** Write unit tests for `evalScheduler`: verify auto dispatches after debounce, deferred dispatches on idle, manual only on flush

### 1B — Refactor useGraphEngine to Use Scheduler

- [x] **1.7** Add `evalMode: 'auto' | 'deferred' | 'manual'` parameter to `useGraphEngine` hook
- [x] **1.8** Replace the inline debounce/dispatch logic (lines 260-349) with calls to `evalScheduler.enqueue()` and `evalScheduler.flush()`
- [x] **1.9** Add `triggerEval` callback to the hook's return value — calls `evalScheduler.flush()`, used by the Run button
- [x] **1.10** Add `pendingPatchCount` to the hook's return value — read from scheduler, used by status bar
- [x] **1.11** Ensure the scheduler is disposed on hook cleanup (return function in useEffect)

### 1C — Run / Stop / Auto-Run Buttons

- [x] **1.12** In `CanvasToolbar.tsx`, replace the existing Pause/Play + Refresh button group in the Engine section with:
  - **Run button** (Play icon, `#1CABB0` accent): visible when `evalMode !== 'auto'` or when stale. Calls `onRun()` prop
  - **Stop button** (Square icon, red accent): visible when `engineStatus === 'computing'`. Calls `onStop()` prop (cancels in-flight eval)
  - **Auto-run toggle** (Zap icon): toggles between auto and manual mode. When toggling to auto, immediately calls `onRun()` if stale
  - Keep the existing Refresh button for "force full snapshot reload"
- [x] **1.13** Add `CanvasToolbarProps`: `onRun`, `onStop`, `evalMode`, `onToggleEvalMode`, `isStale`, `pendingPatchCount`
- [x] **1.14** Wire props through `CanvasArea.tsx` → `CanvasToolbar` — triggerEval and pendingPatchCount from useGraphEngine
- [x] **1.15** Add keyboard shortcuts in `CanvasArea.tsx` `onKeyDown` handler:
  - `Ctrl+Enter` or `F5` → trigger eval (call `triggerEval`)
  - *(Ctrl+Shift+Enter and Escape stop deferred to future iteration)*
- [x] **1.16** Add i18n keys: `toolbar.run`, `toolbar.stop`, `toolbar.autoRun`, `toolbar.manualMode`, `toolbar.pendingChanges` — across all 7 locales (en, es, fr, it, de, he, ja)

### 1D — Pre-Run Validation

- [x] **1.17** In `crates/engine-core/src/graph.rs`, add `validate_pre_eval(catalog_inputs) -> Vec<Diagnostic>`:
  - Cycle detection via Kahn's algorithm (reused from rebuild_topo)
  - Missing required inputs: catalog-aware port checking against edges + manualValues
  - Dangling edges: source/target node existence
  - Returns diagnostics without running any evaluation
- [x] **1.18** *(Deferred — value_type on PortDef not needed for Phase 1; catalog inputs map used instead)*
- [x] **1.19** In `crates/engine-core/src/lib.rs`, add `pub fn run_validate(graph: &EngineGraph) -> Vec<Diagnostic>` — builds catalog inputs map, delegates to validate_pre_eval
- [x] **1.20** In `crates/engine-wasm/src/lib.rs`, expose `validate_graph` via `#[wasm_bindgen]`
- [x] **1.21** In `src/engine/worker.ts`, handle new `'validateGraph'` message type
- [x] **1.22** In `src/engine/index.ts`, add `validateGraph(): Promise<EngineDiagnostic[]>` to `EngineAPI`
- [ ] **1.23** Wire validation into the Run button flow: validate first → show diagnostics if errors → evaluate only if clean (or user force-runs) *(deferred — requires ProblemsPanel UI work)*
- [ ] **1.24** Wire `ProblemsPanel.tsx` (already exists, lazy-loaded) to display validation diagnostics *(deferred — UI integration)*
- [ ] **1.25** [BLOCKED: requires wasm:build to generate .d.ts] Add golden fixture for validation errors
- [ ] **1.26** [BLOCKED: requires wasm:build] Add Rust unit tests for validate_pre_eval — will add inline tests once verified end-to-end

### 1E — Stale Result Tracking

- [ ] **1.27** Add to `statusBarStore.ts`:
  - `evalMode: 'auto' | 'deferred' | 'manual'` with localStorage persistence (`cs:evalMode`)
  - `isStale: boolean` — true when graph changed since last eval in non-auto mode
  - `lastEvalMs: number | null` — elapsed time of last successful eval
  - `lastEvalNodeCount: number` — nodes computed in last eval
  - `pendingPatchCount: number` — patches waiting to be dispatched
  - `setEvalMode`, `setIsStale`, `setLastEvalMs`, `setLastEvalNodeCount`, `setPendingPatchCount` actions
- [ ] **1.28** In `useGraphEngine.ts`, when `evalMode !== 'auto'` and `diffGraph` produces ops, set `isStale = true`
- [ ] **1.29** After successful eval, set `isStale = false` and update `lastEvalMs` / `lastEvalNodeCount`
- [ ] **1.30** Create `useIsStale(nodeId)` hook in `src/contexts/ComputedStore.ts` — returns true if node is in stale set
- [ ] **1.31** In node components (`OperationNode.tsx`, `DisplayNode.tsx`, `DataNode.tsx`, `PlotNode.tsx`), when stale: apply `opacity: 0.5` and dashed border style
- [ ] **1.32** Add stale overlay CSS constants to `src/components/canvas/nodes/nodeStyles.ts`

### 1F — Enhanced Status Bar

- [ ] **1.33** Expand `EngineStatus` type from `'idle' | 'computing' | 'error'` to include richer state:
  ```typescript
  type EngineStatus =
    | { state: 'idle' }
    | { state: 'computing'; progress?: { completed: number; total: number } }
    | { state: 'complete'; nodeCount: number; evalMs: number }
    | { state: 'error'; errorCount: number }
    | { state: 'stale'; pendingCount: number }
  ```
- [ ] **1.34** Update `StatusBar.tsx` to render: "Ready" / "Running (X/Y)..." / "Complete (X nodes, Y ms)" / "Stale (N changes)" / "Error (N issues)"
- [ ] **1.35** Add precision mode indicator reading from `usePreferencesStore((s) => s.numberDisplayMode)`
- [ ] **1.36** Add thin progress bar element (CSS animation) visible only during `state: 'computing'`
- [ ] **1.37** Add i18n keys: `statusBar.ready`, `statusBar.running`, `statusBar.complete`, `statusBar.stale`, `statusBar.error`, `statusBar.precisionMode` — across all 7 locales

---

## Phase 2 — Scientific Accuracy & Precision

Make ChainSolve trustworthy for PhD-level research and production vehicle calculations.

### 2A — Arbitrary Precision Foundation

- [ ] **2.1** Add `dashu-float` dependency to `crates/engine-core/Cargo.toml` behind a `high-precision` feature flag:
  ```toml
  [features]
  default = []
  high-precision = ["dashu-float"]

  [dependencies]
  dashu-float = { version = "0.4", optional = true }
  ```
- [ ] **2.2** Enable the feature in `crates/engine-wasm/Cargo.toml` so it compiles into the WASM binary:
  ```toml
  engine-core = { path = "../engine-core", features = ["high-precision"] }
  ```
- [ ] **2.3** Add `Value::HighPrecision` variant to `crates/engine-core/src/types.rs`:
  ```rust
  HighPrecision {
      /// Full decimal string representation (lossless across WASM boundary)
      display: String,
      /// f64 approximation for fast UI preview / comparisons
      approx: f64,
      /// Decimal digits of precision used
      precision: u32,
  }
  ```
- [ ] **2.4** Update serde serialization for the new variant — tagged as `"kind": "highPrecision"`
- [ ] **2.5** Update `canonicalize_value()` in `ops.rs` to handle the new variant (pass through unchanged)
- [ ] **2.6** Create `crates/engine-core/src/precision.rs` — high-precision arithmetic helpers:
  - `hp_add(a: &str, b: &str, precision: u32) -> String`
  - `hp_sub(a: &str, b: &str, precision: u32) -> String`
  - `hp_mul(a: &str, b: &str, precision: u32) -> String`
  - `hp_div(a: &str, b: &str, precision: u32) -> String`
  - `hp_sqrt(a: &str, precision: u32) -> String`
  - `hp_pow(base: &str, exp: &str, precision: u32) -> String`
  - `hp_sin(a: &str, precision: u32) -> String` (Taylor series at arbitrary precision)
  - `hp_cos(a: &str, precision: u32) -> String`
  - `hp_pi(precision: u32) -> String` (Chudnovsky algorithm for ultra-fast pi)
- [ ] **2.7** Add `precision: Option<u32>` to `EvalOptions` in `types.rs`
- [ ] **2.8** In `ops.rs`, for arithmetic ops (add, sub, mul, div, sqrt, pow), add a branch: if `options.precision.is_some()`, call `precision.rs` functions instead of f64 arithmetic
- [ ] **2.9** Add per-node precision override: read `data.precision` from `NodeDef` — if present, that node evaluates in HP mode regardless of global setting
- [ ] **2.10** Mirror `HighPrecision` in `src/engine/value.ts`:
  ```typescript
  interface HighPrecisionValue {
    kind: 'highPrecision'
    display: string
    approx: number
    precision: number
  }
  ```
- [ ] **2.11** Update `formatValue` in `src/engine/value.ts` to handle `HighPrecisionValue` — display the string directly, truncated to the user's display precision setting
- [ ] **2.12** Add precision mode selector to canvas settings or project settings panel — dropdown: "Standard (f64)" / "High (100 digits)" / "Ultra (1000 digits)" / "Custom..."
- [ ] **2.13** Add golden fixture: `hp_arithmetic.fixture.json` — test `1/3 * 3 = 1.000...` at 100 digits
- [ ] **2.14** Add golden fixture: `hp_pi.fixture.json` — test pi to 1000 digits against known value
- [ ] **2.15** Measure WASM size impact — `dashu-float` should add ~50-70KB gzipped, verify under 250KB gzip budget
- [ ] **2.16** Add Rust unit tests: HP add/sub/mul/div roundtrip, HP vs f64 consistency for standard-precision values

### 2B — Compensated Arithmetic

- [ ] **2.17** Create `crates/engine-core/src/compensated.rs`:
  - `compensated_dot(a: &[f64], b: &[f64]) -> f64` — Ogita-Rump-Oishi algorithm for accurate dot products
  - `compensated_sum(vals: &[f64]) -> f64` — Kahan-Babuskha-Neumaier (upgrade existing Kahan in ops.rs)
  - `compensated_two_product(a: f64, b: f64) -> (f64, f64)` — error-free transformation for multiplication
- [ ] **2.18** Replace existing `kahan_sum` usage in `ops.rs` vector ops with `compensated_sum`
- [ ] **2.19** Use `compensated_dot` in matrix multiplication ops and statistics blocks (correlation, regression)
- [ ] **2.20** Add golden fixture: `compensated_arithmetic.fixture.json` — test `sum(1e16, 1, -1e16) = 1` (naive gives 0)
- [ ] **2.21** Benchmark: verify compensated algorithms are within 2x of naive performance for typical workloads

### 2C — Uncertainty Propagation (Future Enhancement)

- [ ] **2.22** Design `Value::Uncertain { value: f64, uncertainty: f64, confidence: f64 }` variant
- [ ] **2.23** Implement standard error propagation for arithmetic ops:
  - Addition/subtraction: `delta_z = sqrt(delta_x^2 + delta_y^2)`
  - Multiplication: `delta_z/z = sqrt((delta_x/x)^2 + (delta_y/y)^2)`
- [ ] **2.24** Add opt-in uncertainty mode via `EvalOptions`
- [ ] **2.25** Mirror in TypeScript value types
- [ ] **2.26** Display uncertainty as `value ± uncertainty` in Display nodes

---

## Phase 3 — ODE/PDE Solvers (Physics Foundation)

These are required before vehicle simulation (Phase 4) — suspension models, thermal models, and lap simulation all need ODE solvers.

### 3A — Core ODE Module

- [ ] **3.1** Create `crates/engine-core/src/ode/mod.rs` — module declaration with `pub mod rk4; pub mod rk45; pub mod bdf; pub mod types;`
- [ ] **3.2** Create `crates/engine-core/src/ode/types.rs`:
  - `OdeSystem` struct: `{ equations: Vec<String>, state_names: Vec<String>, params: HashMap<String, f64> }`
  - `OdeResult` struct: `{ t: Vec<f64>, states: Vec<Vec<f64>> }` (time series of state variables)
  - `OdeSolverConfig`: `{ t_start, t_end, dt, tolerance, max_steps }`
- [ ] **3.3** Create `crates/engine-core/src/ode/rk4.rs` — classic 4th-order Runge-Kutta:
  - `solve_rk4(system: &OdeSystem, y0: &[f64], config: &OdeSolverConfig) -> OdeResult`
  - Fixed step size, O(h^4) accuracy
  - Evaluate RHS using existing `expr::eval_expr` for each equation
  - Ref: Hairer, Norsett, Wanner "Solving Ordinary Differential Equations I" (1993)
- [ ] **3.4** Create `crates/engine-core/src/ode/rk45.rs` — Dormand-Prince adaptive step:
  - `solve_rk45(system: &OdeSystem, y0: &[f64], config: &OdeSolverConfig) -> OdeResult`
  - Embedded 4(5) pair for error estimation
  - Automatic step size control: `h_new = h * min(5, max(0.2, 0.9 * (tol/err)^(1/5)))`
  - Step rejection when error exceeds tolerance
  - Ref: Dormand & Prince (1980), equivalent to MATLAB's `ode45`
- [ ] **3.5** Create `crates/engine-core/src/ode/bdf.rs` — implicit BDF for stiff systems:
  - `solve_bdf(system: &OdeSystem, y0: &[f64], config: &OdeSolverConfig) -> OdeResult`
  - Backward Differentiation Formula orders 1-5
  - Newton iteration at each step for the implicit solve
  - Order and step size adaptation
  - Ref: Hairer & Wanner "Solving ODEs II: Stiff and Differential-Algebraic Problems" (1996)
- [ ] **3.6** Register `ode` module in `crates/engine-core/src/lib.rs`
- [ ] **3.7** Add unit tests for each solver:
  - `y' = y, y(0) = 1` — must match `e^t` to 10^-8 relative error (RK4/RK45)
  - `y' = -1000*y, y(0) = 1` — stiff system, BDF must converge, RK4 should need tiny step
  - Harmonic oscillator `x'' = -x` — energy conservation check
  - Lorenz attractor (chaotic) — determinism check (same initial conditions → same trajectory)

### 3B — ODE Blocks

- [ ] **3.8** Add match arms in `ops.rs` for ODE blocks:
  - `ode.rk4` — inputs: equations (Text), initial_state (Vector), t_start, t_end, dt. Output: Table
  - `ode.rk45` — inputs: equations (Text), initial_state (Vector), t_start, t_end, tolerance. Output: Table
  - `ode.bdf` — same interface as rk45 but for stiff systems. Output: Table
  - `ode.stateSpace` — inputs: A (Matrix), B (Matrix), C (Matrix), D (Matrix), u (Vector), x0 (Vector), t_end, dt. Output: Table (state trajectory + output)
  - `ode.initialCondition` — source block that outputs a Vector of initial conditions
  - `ode.systemDef` — source block that outputs a Text containing equation definitions
- [ ] **3.9** Create `src/blocks/ode-blocks.ts` with block definitions for all 6 ODE blocks
- [ ] **3.10** Register in `src/blocks/registry.ts`
- [ ] **3.11** Add `BlockCategory` value `'odeSolvers'` in `src/blocks/types.ts`
- [ ] **3.12** Add i18n labels in all 7 locales under `"blocks"` namespace
- [ ] **3.13** Add catalog entries in `crates/engine-core/src/catalog.rs` for all ODE ops
- [ ] **3.14** Add golden fixtures:
  - `ode_exponential.fixture.json` — `y' = y` → `e^t`
  - `ode_harmonic.fixture.json` — `x'' = -x` → sin/cos
  - `ode_stiff.fixture.json` — stiff decay system with BDF

---

## Phase 4 — Vehicle Simulation

Reference texts: Pacejka "Tire and Vehicle Dynamics" 3rd ed (2012), Milliken & Milliken "Race Car Vehicle Dynamics" (1995), Dixon "Suspension Geometry and Computation" (2009).

### 4A — Tire Model (Pacejka Magic Formula)

- [ ] **4.1** Create `crates/engine-core/src/vehicle/mod.rs` with `pub mod tire; pub mod suspension; pub mod aero; pub mod powertrain; pub mod lap; pub mod thermal;`
- [ ] **4.2** Create `crates/engine-core/src/vehicle/tire.rs`:
  - `pacejka_lateral(slip_angle: f64, fz: f64, b: f64, c: f64, d: f64, e: f64) -> f64`
    Formula: `Fy = D * sin(C * atan(B*alpha - E*(B*alpha - atan(B*alpha))))`
  - `pacejka_longitudinal(slip_ratio: f64, fz: f64, b: f64, c: f64, d: f64, e: f64) -> f64`
    Same formula with slip ratio instead of slip angle
  - `pacejka_combined(slip_angle: f64, slip_ratio: f64, fz: f64, params: &TireParams) -> (f64, f64)`
    Combined slip using Pacejka's similarity method
  - `TireParams` struct with B, C, D, E coefficients + combined slip parameters
  - `TirePreset` enum with typical coefficients for: `SportRadial`, `EconomyRadial`, `WetWeather`, `Slick`, `AllSeason`
- [ ] **4.3** Register `vehicle` module in `crates/engine-core/src/lib.rs`
- [ ] **4.4** Add match arms in `ops.rs` for tire blocks:
  - `veh.tire.lateralForce` — inputs: slip_angle, Fz, B, C, D, E → Scalar (Fy)
  - `veh.tire.longForce` — inputs: slip_ratio, Fz, B, C, D, E → Scalar (Fx)
  - `veh.tire.combinedSlip` — inputs: slip_angle, slip_ratio, Fz, params → Table (Fx, Fy)
  - `veh.tire.sweep` — inputs: Fz, B, C, D, E, slip_range → Table (slip vs force curve for plotting)
  - `veh.tire.preset` — input: tire_type dropdown → outputs B, C, D, E coefficients
- [ ] **4.5** Add unit tests: verify Pacejka output against published data (e.g., Fy at alpha=5deg for typical sport tire)

### 4B — Suspension Models

- [ ] **4.6** Create `crates/engine-core/src/vehicle/suspension.rs`:
  - `quarter_car(m_s, m_u, k_s, c_s, k_t, road_input, config) -> OdeResult`
    2-DOF: `m_s*x_s'' = -k_s*(x_s-x_u) - c_s*(x_s'-x_u')` and `m_u*x_u'' = k_s*(x_s-x_u) + c_s*(x_s'-x_u') - k_t*(x_u-x_r)`
  - `half_car(params, road_inputs, config) -> OdeResult` — 4-DOF: front/rear sprung + unsprung
  - `full_vehicle(params, road_inputs, config) -> OdeResult` — 7-DOF: body (heave, pitch, roll) + 4 wheels
  - Uses RK45 solver from Phase 3 internally
- [ ] **4.7** Add match arms in `ops.rs`:
  - `veh.suspension.quarterCar` — inputs: m_s, m_u, k_s, c_s, k_t, road_profile (Vector), dt → Table (displacement, velocity vs time)
  - `veh.suspension.halfCar` — inputs: front/rear params + road profiles → Table
  - `veh.suspension.fullVehicle` — inputs: vehicle params + 4 road profiles → Table
  - `veh.suspension.springDamper` — F = kx + cv (simple force element)
  - `veh.suspension.arb` — anti-roll bar contribution to roll stiffness

### 4C — Vehicle Aerodynamics

- [ ] **4.8** Create `crates/engine-core/src/vehicle/aero.rs`:
  - `drag_force(rho, cd, area, velocity) -> f64` — `F = 0.5 * rho * Cd * A * v^2`
  - `downforce(rho, cl, area, velocity) -> f64` — `F = 0.5 * rho * Cl * A * v^2`
  - `side_force(rho, cs, area, velocity) -> f64`
  - `aero_balance(f_front, f_total) -> f64` — front downforce percentage
  - `AeroPreset` enum: `Sedan`, `SportsCar`, `F1Car`, `Truck`, `Motorcycle`
- [ ] **4.9** Add match arms in `ops.rs`:
  - `veh.aero.drag`, `veh.aero.downforce`, `veh.aero.sideForce`, `veh.aero.balance`, `veh.aero.cdA`, `veh.aero.preset`

### 4D — Powertrain

- [ ] **4.10** Create `crates/engine-core/src/vehicle/powertrain.rs`:
  - `torque_from_map(rpm: f64, torque_curve: &[(f64, f64)]) -> f64` — linear interpolation on torque vs RPM table
  - `gear_ratio(torque_in: f64, rpm_in: f64, ratio: f64) -> (f64, f64)` — torque_out, rpm_out
  - `drivetrain_loss(power: f64, efficiency: f64) -> f64`
  - `wheel_speed(rpm: f64, tire_radius: f64, gear_ratio: f64, final_drive: f64) -> f64`
- [ ] **4.11** Add match arms in `ops.rs`:
  - `veh.powertrain.torqueMap`, `veh.powertrain.gearRatio`, `veh.powertrain.finalDrive`, `veh.powertrain.drivetrainLoss`, `veh.powertrain.wheelTorque`, `veh.powertrain.wheelSpeed`

### 4E — Lap Simulation

- [ ] **4.12** Create `crates/engine-core/src/vehicle/lap.rs`:
  - Point-mass quasi-steady-state lap simulation (ref: Milliken & Milliken):
    1. Discretize track into segments: `(distance, curvature)` pairs
    2. For each segment: `v_max = sqrt(mu * g / curvature)` (grip limited)
    3. Forward pass: acceleration limited by traction `a_max = (F_drive - F_drag) / m`
    4. Backward pass: braking limited by traction `a_brake = (F_brake + F_drag) / m`
    5. Combine: speed at each point = `min(forward_speed, backward_speed, corner_speed)`
    6. Integrate time: `dt = ds / v` for each segment
  - `simulate_lap(track: &[(f64, f64)], vehicle: &VehicleParams) -> LapResult`
  - `VehicleParams`: mass, power, Cd, Cl, A, mu, tire params, gear ratios
  - `LapResult`: lap_time, sector_times, speed_trace (Table), gear_trace
- [ ] **4.13** Add match arms in `ops.rs`:
  - `veh.lap.track` — source block: define track as Table (distance, curvature)
  - `veh.lap.simulate` — inputs: track (Table), vehicle params → Table (results)
  - `veh.lap.results` — display: lap time, speed trace, gear usage

### 4F — Telemetry & Thermal

- [ ] **4.14** Add `veh.telemetry.compare` — overlay simulation vs actual data (two Table inputs → merged Table for plotting)
- [ ] **4.15** Add `veh.telemetry.channelMath` — derivative, integral, moving average on telemetry channels
- [ ] **4.16** Create `crates/engine-core/src/vehicle/thermal.rs`:
  - `brake_thermal(power, h, area, t_ambient, mass, specific_heat, dt) -> OdeResult`
    `dT/dt = (P_brake - h*A*(T - T_amb)) / (m*c)`
  - `brake_energy(mass, v1, v2) -> f64` — `E = 0.5 * m * (v1^2 - v2^2)`
- [ ] **4.17** Add match arms for `veh.brake.thermal`, `veh.brake.energy`

### 4G — Vehicle Block Definitions & Registration

- [ ] **4.18** Create `src/blocks/vehicle-blocks.ts` with all ~25 vehicle block definitions
- [ ] **4.19** Add `BlockCategory` value `'vehicleSim'` in `src/blocks/types.ts`
- [ ] **4.20** Register all vehicle blocks in `src/blocks/registry.ts`
- [ ] **4.21** Add catalog entries in `crates/engine-core/src/catalog.rs` for all vehicle ops
- [ ] **4.22** Add i18n labels for all vehicle blocks across all 7 locales
- [ ] **4.23** Add golden fixtures:
  - `veh_pacejka.fixture.json` — Pacejka lateral force at known slip angles
  - `veh_quarter_car.fixture.json` — quarter-car step response
  - `veh_lap_simple.fixture.json` — simple oval track lap time
- [ ] **4.24** Add property tests: tire force symmetry properties, energy conservation in suspension

---

## Phase 5 — Neural Network Training Pipeline

The NN module (`crates/engine-core/src/nn/`) already has `Sequential`, `DenseLayer`, `Conv1DLayer`, backpropagation training, and JSON export/import. The `nn.trainer` op in `ops.rs` is a stub that needs wiring.

### 5A — Wire nn.trainer to Real Training

- [ ] **5.1** In `ops.rs`, replace the `nn.trainer` stub with real implementation:
  - Parse `data.layers` JSON array → build `Sequential` model
  - Parse trainX/trainY from input ports (Vector → reshape based on `data.inputSize`)
  - Parse training config: epochs, batchSize, learningRate, lossFunction from `data`
  - Call `nn::train::train()` with the parsed config
  - Return result: loss_history as Vector + serialized model as Text (JSON via `nn::export`)
- [ ] **5.2** In `nn.predict` op, replace stub:
  - Accept `model` input (Text containing JSON ModelExport)
  - Accept `data` input (Vector or Table)
  - Deserialize model via `nn::export::import_model()`
  - Run `Sequential::forward()` for each sample
  - Return Vector of predictions
- [ ] **5.3** Add layer configuration UI panel for `nn.trainer` in the FloatingInspector — layer list editor with add/remove/reorder, each layer has type (dense/conv1d/dropout), units, activation

### 5B — Training Enhancements

- [ ] **5.4** Create `crates/engine-core/src/nn/lr_schedule.rs`:
  - `LRSchedule` enum: `Constant`, `StepDecay { drop_factor, drop_every }`, `CosineAnnealing { t_max }`, `ExponentialDecay { gamma }`
  - `fn get_lr(schedule: &LRSchedule, base_lr: f64, epoch: usize) -> f64`
- [ ] **5.5** Integrate LR schedule into `nn::train::train()` — apply schedule per epoch
- [ ] **5.6** Add early stopping to `TrainConfig`:
  - `patience: usize` (epochs without improvement before stopping)
  - `validation_split: f64` (fraction of data held out)
  - Split data, track validation loss, stop early when val loss doesn't improve for `patience` epochs
- [ ] **5.7** Add progress callback to `train()` — reports `(epoch, total_epochs, train_loss, val_loss)` for streaming to UI

### 5C — New NN Blocks

- [ ] **5.8** Add blocks to `src/blocks/nn-blocks.ts`:
  - `nn.lrSchedule` — configure learning rate schedule (dropdown: constant/step/cosine/exp)
  - `nn.summary` — takes model Text, displays layer shapes and param counts as Table
- [ ] **5.9** Register new blocks, add catalog entries, add i18n labels
- [ ] **5.10** Add golden fixture: `nn_xor_training.fixture.json` — full XOR training graph, verify loss decreases

---

## Phase 6 — ML Training Workflows

### 6A — Feature Preprocessing

- [ ] **6.1** Create `crates/engine-core/src/ml/preprocess.rs`:
  - `standardize(data: &[Vec<f64>]) -> (Vec<Vec<f64>>, Vec<f64>, Vec<f64>)` — z-score normalization, returns (scaled, means, stds)
  - `normalize(data: &[Vec<f64>]) -> (Vec<Vec<f64>>, Vec<f64>, Vec<f64>)` — min-max to [0,1], returns (scaled, mins, maxs)
  - `train_test_split(data: &[Vec<f64>], labels: &[f64], ratio: f64, seed: u64) -> (train_x, train_y, test_x, test_y)`
- [ ] **6.2** Add ops: `ml.featureScale`, `ml.trainTestSplit` (verify existing one works or replace)
- [ ] **6.3** Add block definitions and i18n labels

### 6B — Classification Metrics

- [ ] **6.4** Create `crates/engine-core/src/ml/classification_metrics.rs`:
  - `precision_recall_f1(y_true: &[f64], y_pred: &[f64]) -> Table` — per-class + macro/weighted averages
  - `roc_curve(y_true: &[f64], y_scores: &[f64]) -> Vec<(f64, f64)>` — (FPR, TPR) pairs
  - `auc(roc_points: &[(f64, f64)]) -> f64` — trapezoidal rule
- [ ] **6.5** Add ops: `ml.classMetrics`, `ml.rocCurve`, `ml.auc`
- [ ] **6.6** Add block definitions and i18n labels

### 6C — Cross-Validation & Grid Search

- [ ] **6.7** Add `ml.kfoldCV` op:
  - Inputs: data Table, model type enum (linreg/polyreg/knn/dtree), model params, k, metric (mse/r2/accuracy)
  - Internally: split data into k folds, train/predict/score for each fold
  - Output: Table with fold scores + mean + std
- [ ] **6.8** Add `ml.gridSearch` op:
  - Inputs: model type, data, parameter grid (Table of param name + values)
  - Internal loop: for each param combo, run k-fold CV
  - Output: Table of param combos + scores, sorted by best
  - Uses progress callback for long runs
- [ ] **6.9** Add block definitions and i18n labels
- [ ] **6.10** Add golden fixtures for k-fold CV and grid search with known datasets (e.g., iris-like synthetic data)

---

## Phase 7 — Optimization Engine

### 7A — LP Solver (Revised Simplex)

- [ ] **7.1** Create `crates/engine-core/src/optim/lp.rs`:
  - `solve_lp(c: &[f64], a_ub: &[Vec<f64>], b_ub: &[f64], bounds: &[(f64, f64)]) -> LpResult`
  - Implement revised simplex method with Bland's anti-cycling rule
  - Handle infeasible and unbounded cases with clear error diagnostics
  - `LpResult`: optimal values, optimal objective, status (optimal/infeasible/unbounded)
  - Ref: Nocedal & Wright "Numerical Optimization" (2006)
- [ ] **7.2** Add `optim.lpSolve` op: inputs: objective (Vector), constraints (Matrix), bounds (Table) → Table (optimal values + objective)
- [ ] **7.3** Add golden fixture: `lp_simple.fixture.json` — 2-variable LP with known optimal

### 7B — QP Solver (Interior Point)

- [ ] **7.4** Create `crates/engine-core/src/optim/qp.rs`:
  - `solve_qp(h: &[Vec<f64>], f: &[f64], a_eq, b_eq, a_ineq, b_ineq) -> QpResult`
  - Implement Mehrotra's predictor-corrector interior point method
  - Convex QP only (positive semidefinite H)
  - Ref: Nocedal & Wright "Numerical Optimization" (2006), Chapter 16
- [ ] **7.5** Add `optim.qpSolve` op
- [ ] **7.6** Add golden fixture: `qp_simple.fixture.json`

### 7C — Multi-Objective Optimization (NSGA-II)

- [ ] **7.7** Create `crates/engine-core/src/optim/pareto.rs`:
  - `nsga2(objectives: &[&dyn Fn(&[f64]) -> f64], bounds: &[(f64, f64)], pop_size, generations) -> Vec<Vec<f64>>`
  - Non-dominated sorting + crowding distance
  - Ref: Deb et al. "A Fast and Elitist Multiobjective Genetic Algorithm: NSGA-II" (2002)
- [ ] **7.8** Add `optim.paretoFront` op
- [ ] **7.9** Add block definition and i18n labels

### 7D — Global Sensitivity (Sobol')

- [ ] **7.10** Create `crates/engine-core/src/optim/sobol_sensitivity.rs`:
  - `sobol_indices(objective, bounds, n_samples) -> Table` (S1 first-order + ST total-order per variable)
  - Uses existing DOE Sobol sequence generator for sampling
  - Ref: Saltelli "Making Best Use of Model Evaluations to Compute Sensitivity Indices" (2002)
- [ ] **7.11** Add `optim.sobolSensitivity` op
- [ ] **7.12** Add golden fixture with known analytical Sobol indices

---

## Phase 8 — Long-Running & Continuous Simulation Infrastructure

Neural network training, lap simulation, and grid search can take seconds to minutes — or run indefinitely until the user stops them. They must not block the normal eval worker. The simulation worker supports two modes: **single-shot** (run once → return result) and **continuous** (loop until stopped, streaming results each iteration).

### 8A — Simulation Worker Core

- [ ] **8.1** Create `src/engine/simulationWorker.ts`:
  - `SimulationWorkerAPI` class: spawns a dedicated Web Worker on demand
  - Loads the same WASM module as the eval worker
  - Handles messages: `runSimulation`, `cancelSimulation`, `pauseSimulation`, `resumeSimulation`
  - Supports `mode: 'single' | 'continuous'` in the simulation config
  - **Single mode**: runs the computation once, streams progress, returns final result
  - **Continuous mode**: loops indefinitely (epoch after epoch, timestep after timestep), streaming partial results after each iteration, until the user sends `cancelSimulation` or `pauseSimulation`
  - Streams progress: `{ type: 'simulationProgress', requestId, iteration, totalIterations?, partialResults, metrics }`
  - On stop/complete: `{ type: 'simulationResult', requestId, result, iterationsCompleted }`
- [ ] **8.2** In `crates/engine-wasm/src/lib.rs`, add `#[wasm_bindgen] pub fn run_simulation(config_json: &str, progress_cb: &js_sys::Function) -> String`:
  - Parses simulation config: `{ op, inputs, mode, maxIterations?, batchSize? }`
  - For single mode: runs the computation, calls `progress_cb` periodically, returns final JSON
  - For continuous mode: runs in a loop calling `progress_cb` after each iteration with partial results — the JS callback returns `EvalSignal::Continue | EvalSignal::Abort` to control the loop
  - The progress callback is the cancellation mechanism: when the user clicks Stop, the main thread sets a flag that the callback reads, returning `Abort` to break the Rust loop
- [ ] **8.3** In `src/engine/index.ts`, add to `EngineAPI`:
  - `runSimulation(config, onProgress) → Promise<SimulationResult>` — delegates to SimulationWorker
  - `stopSimulation(requestId) → void` — sends cancel signal
  - `pauseSimulation(requestId) → void` — pauses continuous loop (can be resumed)
  - `resumeSimulation(requestId) → void` — resumes paused simulation
  - `isSimulationRunning() → boolean` — check if sim worker is busy

### 8B — Continuous Mode for NN Training

- [ ] **8.4** Update `nn.trainer` op to support `mode: 'continuous'` in config:
  - When `maxEpochs` is set: train for that many epochs (single mode)
  - When `maxEpochs` is 0 or absent: train indefinitely until stopped (continuous mode)
  - After each epoch, call progress callback with `{ epoch, trainLoss, valLoss, bestLoss, learningRate }`
  - On stop: return the model at its best validation loss (not the final epoch)
- [ ] **8.5** Update `nn.trainer` inspector panel UI:
  - "Train" button starts training, transforms into "Stop" button while running
  - "Pause" / "Resume" buttons for continuous mode
  - Live loss chart that updates after each epoch (connects to plot block)
  - Display: current epoch, train loss, val loss, best loss, learning rate, elapsed time

### 8C — Continuous Mode for Simulations

- [ ] **8.6** For ODE/vehicle simulation blocks that support continuous mode:
  - ODE solvers can run with `t_end = Infinity` (continuous time integration, streaming state each step)
  - Vehicle lap sim can run multiple laps continuously (accumulating statistics)
  - Monte Carlo can accumulate samples indefinitely, refining estimates until stopped
- [ ] **8.7** Add a `SimulationStatusStore` Zustand store (`src/stores/simulationStatusStore.ts`):
  - Tracks active simulations: `{ nodeId, requestId, mode, status: 'running' | 'paused' | 'complete', iteration, metrics }`
  - Node components read this to show live status
  - Status bar shows "Simulation running (epoch 47, loss: 0.023)" when active

### 8D — UI Integration & Testing

- [ ] **8.8** In NN/ML/optimization/vehicle node components, add "Train" / "Run Simulation" / "Stop" buttons that trigger `runSimulation` with appropriate mode
- [ ] **8.9** Add progress UI: progress bar + iteration counter + estimated time remaining in the node's inspector panel
- [ ] **8.10** Ensure normal graph evaluation continues working while a simulation runs on the separate worker — the two workers must be independent
- [ ] **8.11** Test single mode: run a fixed-epoch NN training, verify it completes and returns results
- [ ] **8.12** Test continuous mode: start NN training with no epoch limit, verify loss streams to UI each epoch, click Stop, verify model is returned at best loss
- [ ] **8.13** Test pause/resume: start continuous training, pause at epoch 10, resume, verify it continues from epoch 10
- [ ] **8.14** Test independence: while a simulation runs, edit a different part of the graph and verify normal eval still works

---

## Phase 9 — Frontend Polish

### 9A — CanvasArea Decomposition

- [ ] **9.1** Extract keyboard shortcut handler (~200 lines) from `CanvasArea.tsx` into `src/hooks/useCanvasKeyboard.ts`
- [ ] **9.2** Extract context menu logic (~150 lines) into `src/hooks/useCanvasContextMenu.ts`
- [ ] **9.3** Extract drag/drop handlers (~100 lines) into `src/hooks/useCanvasDragDrop.ts`
- [ ] **9.4** Extract clipboard operations into `src/hooks/useCanvasClipboard.ts`
- [ ] **9.5** Extract template/group operations into `src/hooks/useCanvasGroups.ts`
- [ ] **9.6** Verify no behavior changes — run full E2E smoke suite after each extraction

### 9B — Enhanced Node Visual States

- [ ] **9.7** In `nodeStyles.ts`, add visual style constants:
  - `staleOverlay`: `{ opacity: 0.5, filter: 'grayscale(30%)', borderStyle: 'dashed' }`
  - `computingOverlay`: pulsing border animation `@keyframes pulse { 0% { borderColor: #1CABB0 } 50% { borderColor: transparent } }`
  - `errorBadge`: small red dot in top-right corner of node
- [ ] **9.8** Update `OperationNode.tsx`, `DisplayNode.tsx`, `DataNode.tsx`, `PlotNode.tsx` to read `useIsStale(id)` and apply stale styles
- [ ] **9.9** Add computing spinner overlay when `engineStatus === 'computing'` and node is in the current eval batch

### 9C — Auto-Run Intelligence

- [ ] **9.10** In the eval scheduler, add smart debouncing that adapts to graph size:
  - < 20 nodes: 50ms debounce (near-instant)
  - 20-100 nodes: 150ms debounce
  - 100-300 nodes: 500ms debounce
  - 300+: manual only
- [ ] **9.11** Add "Quick eval" mode for number/slider inputs: when user is actively typing in a number field, evaluate only the immediate downstream chain (not the full graph) for instant feedback, then full eval on blur

---

## Phase 10 — Housekeeping & Professional Audit

### 10A — Code Quality

- [ ] **10.1** Run `npx tsc -b --noEmit` — fix any type errors introduced by new code
- [ ] **10.2** Run `npm run lint` — fix all ESLint violations
- [ ] **10.3** Run `npm run format` — apply Prettier to all new/modified files
- [ ] **10.4** Scan for TODO/FIXME/HACK comments across the repo — resolve or convert to tracked GitHub issues
- [ ] **10.5** Audit all `catch` blocks in `src/lib/` — ensure they use the `[ERROR_CODE]` pattern consistently
- [ ] **10.6** Audit all `.catch` in `src/engine/` — ensure engine-disposed errors are silently swallowed, others logged
- [ ] **10.7** Move `@types/dagre` from `dependencies` to `devDependencies` in `package.json`
- [ ] **10.8** Run `npx depcheck` — identify and remove unused npm dependencies
- [ ] **10.9** Run `npm audit` — fix any security vulnerabilities
- [ ] **10.10** Run `cargo audit` — fix any Rust security advisories
- [ ] **10.11** Run `cargo update` — apply patch-level Rust dependency updates
- [ ] **10.12** Review `Cargo.toml` for unused optional features

### 10B — Documentation

- [ ] **10.13** Update `CLAUDE.md`:
  - Add new eval model (auto/deferred/manual) to Architecture → Data flow section
  - Add Run button and keyboard shortcuts to Key commands
  - Add ODE, vehicle, NN training, LP/QP to "Adding a new block op" workflow
  - Add `dashu-float` and high-precision mode to Hard invariants section
  - Update ENGINE_CONTRACT_VERSION if bumped
- [ ] **10.14** Update `docs/ARCHITECTURE.md`:
  - Add eval scheduler to data flow diagram
  - Add ODE/vehicle/NN modules to Rust engine section
  - Add simulation worker to worker pool section
- [ ] **10.15** Update `README.md`:
  - Update block count (299 → ~350+)
  - Add vehicle simulation, neural networks, ODE solvers to capabilities list
  - Add arbitrary precision to key features
- [ ] **10.16** Update `CHANGELOG.md` with entries for all new features
- [ ] **10.17** Create new ADRs:
  - `docs/adr/ADR-0014-eval-mode-hybrid.md` — decision to add manual eval alongside auto-eval
  - `docs/adr/ADR-0015-drag-pause-optimization.md` — pausing engine during drag
  - `docs/adr/ADR-0016-arbitrary-precision.md` — dashu-float, dual-path evaluation, WASM size tradeoff
  - `docs/adr/ADR-0017-ode-solvers.md` — RK4/RK45/BDF solver selection
  - `docs/adr/ADR-0018-vehicle-simulation.md` — Pacejka, quasi-steady-state lap sim approach
  - `docs/adr/ADR-0019-simulation-worker.md` — dedicated worker for long-running computations
- [ ] **10.18** Update `docs/W9_ENGINE.md` with new Rust modules and evaluation modes
- [ ] **10.19** Update `docs/W9_3_CORRECTNESS.md` with compensated arithmetic and arbitrary precision
- [ ] **10.20** Update `docs/UX.md` with Run button behavior, stale indicators, keyboard shortcuts
- [ ] **10.21** Review and clean up any outdated docs (check for stale references, dead links)

### 10C — i18n Completeness

- [ ] **10.22** Run `node scripts/check-i18n-keys.mjs` — verify all new keys present across all 7 locales
- [ ] **10.23** Add translations for all new block labels (ODE, vehicle, NN enhancements, optimization)
- [ ] **10.24** Add translations for new UI strings (toolbar, status bar, validation panel, precision selector)
- [ ] **10.25** Verify no hardcoded strings with `node scripts/check-i18n-hardcoded.mjs`

### 10D — Database & Migrations

- [ ] **10.26** Audit all 15 migrations for idempotency — verify re-runnable (IF NOT EXISTS, CREATE OR REPLACE)
- [ ] **10.27** Verify all tables in `src/lib/` have corresponding RLS policies (cross-reference with migration 0013)
- [ ] **10.28** Verify foreign key cascades are correct (cross-reference with migration 0012)
- [ ] **10.29** Check for unused tables/columns that can be cleaned up
- [ ] **10.30** Consider squashing all 15 migrations into a single clean baseline (pre-release, no deployed data)

### 10E — Testing Completeness

- [ ] **10.31** Ensure every new Rust module has inline `#[cfg(test)]` unit tests
- [ ] **10.32** Add golden fixtures for all new op categories (listed in each phase above)
- [ ] **10.33** Add property tests for new ops: determinism, incremental consistency, no-panic on random inputs
- [ ] **10.34** Add Criterion benchmarks for: NN training throughput, ODE solver performance, Pacejka evaluation throughput, LP solver scaling
- [ ] **10.35** Add Vitest unit tests for: evalScheduler, useIsStale hook, statusBar state transitions
- [ ] **10.36** Add Playwright E2E test: drag a block → verify no console eval spam
- [ ] **10.37** Add Playwright E2E test: click Run button → verify evaluation triggers
- [ ] **10.38** Add Playwright E2E test: stale indicator appears after graph change in manual mode

### 10F — CI & Scripts

- [ ] **10.39** Verify `scripts/verify-fast.sh` passes with all changes
- [ ] **10.40** Verify `scripts/verify-ci.sh` passes with all changes (including WASM build with `high-precision` feature)
- [ ] **10.41** Verify bundle size stays within budget (400KB JS gzip, 250KB WASM gzip) — check `dashu-float` impact
- [ ] **10.42** Update `scripts/check-wasm-exports.mjs` if new WASM exports added (`validate_graph`, `run_simulation`)
- [ ] **10.43** Run `CI=true npx playwright test --project=smoke --repeat-each=5` — flakiness check
- [ ] **10.44** Full `npm run verify:ci` pass — all gates green

### 10G — Final Verification

- [ ] **10.45** Manual smoke test: create a simple 3-node graph (Number → Add → Display), verify auto-eval works instantly
- [ ] **10.46** Manual smoke test: create a 100-node graph, drag blocks — verify 60fps, zero console spam
- [ ] **10.47** Manual smoke test: switch to manual mode, edit values, verify stale indicators, click Run
- [ ] **10.48** Manual smoke test: build an ODE graph (simple exponential), verify result matches e^t
- [ ] **10.49** Manual smoke test: build a Pacejka tire sweep graph, verify force vs slip curve plots correctly
- [ ] **10.50** Manual smoke test: train an XOR neural network, verify loss decreases over epochs
- [ ] **10.51** Manual smoke test: enable high-precision mode (100 digits), compute `1/3 * 3`, verify exact 1.0
- [ ] **10.52** Run full E2E suite: `npm run test:e2e` — all tests pass
- [ ] **10.53** Run full Rust tests: `cargo test --workspace` — all tests pass
- [ ] **10.54** Final `npm run verify:ci` — clean pass, ready for merge

---

## Summary

| Phase | Steps | New Rust Modules | New Blocks | Key Files |
|-------|-------|-----------------|------------|-----------|
| 0 — Drag Fix | 10 | — | — | CanvasArea.tsx, useGraphEngine.ts |
| 1 — Eval Model | 37 | validate.rs extension | — | evalScheduler.ts, CanvasToolbar.tsx, statusBarStore.ts |
| 2 — Precision | 26 | precision.rs, compensated.rs | — | types.rs, ops.rs, value.ts |
| 3 — ODE Solvers | 14 | ode/rk4.rs, ode/rk45.rs, ode/bdf.rs | 6 | ode-blocks.ts |
| 4 — Vehicle Sim | 24 | vehicle/tire.rs, suspension.rs, aero.rs, powertrain.rs, lap.rs, thermal.rs | ~25 | vehicle-blocks.ts |
| 5 — NN Training | 10 | nn/lr_schedule.rs | 2 | nn-blocks.ts, ops.rs |
| 6 — ML Workflows | 10 | ml/preprocess.rs, ml/classification_metrics.rs | ~6 | ml-blocks.ts |
| 7 — Optimization | 12 | optim/lp.rs, optim/qp.rs, optim/pareto.rs, optim/sobol_sensitivity.rs | 4 | optim-blocks.ts |
| 8 — Sim Worker | 14 | — | — | simulationWorker.ts, simulationStatusStore.ts, engine-wasm/lib.rs |
| 9 — Frontend | 11 | — | — | CanvasArea.tsx (decomposition), nodeStyles.ts |
| 10 — Housekeeping | 54 | — | — | All docs, scripts, CI |
| **Total** | **222** | **~15 new modules** | **~43 new blocks** | |

---

*This checklist is the single source of truth for the ChainSolve improvements roadmap. Each item is designed to be independently implementable, testable, and verifiable. Phases are ordered by dependency — later phases build on earlier ones.*
