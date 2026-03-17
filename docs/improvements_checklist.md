# ChainSolve: Definitive Improvements Checklist

> **Vision:** Displace MATLAB, Simulink, and Excel by combining a Rust-powered computation engine with a React node-graph UI, delivering browser-native performance that rivals desktop tools at a fraction of the cost.
>
> **Architecture:** Rust + WebAssembly + WebGPU core, React Flow frontend, Supabase backend.
>
> **Evaluation philosophy:** Reactive — evaluates once when inputs/blocks/chains change. Never loops continuously. Simulations have defined endpoints. Users can opt-in to looping simulations (e.g., pendulum over N periods).

---

## Category 1 — Core Computation Engine

### 1A — Numerical Kernel (Foundation)

- [x] **1.1** f64 arithmetic with IEEE 754 compliance throughout all operations
- [x] **1.2** Arbitrary-precision via `dashu-float` (pure Rust, WASM-safe) behind `high-precision` feature flag
- [x] **1.3** `Value::HighPrecision { display, approx, precision }` variant in types.rs
- [x] **1.4** `precision.rs` — HP add/sub/mul/div using dashu-float DBig (4 tests)
- [x] **1.5** Per-node precision override via `data.precision` in ops.rs (`hp_or_broadcast`)
- [x] **1.6** `compensated.rs` — Neumaier sum + Ogita-Rump-Oishi dot product (7 tests)
- [x] **1.7** Kahan/Neumaier compensated summation already used in all vector/stats ops
- [x] **1.8** Complex number support (Value::Complex, complex arithmetic blocks)
- [x] **1.9** `rustfft` FFT blocks (magnitude, power spectrum, freq bins, window functions, FIR filters)
- [x] **1.10** Interval arithmetic (Value::Interval, interval add/sub/mul/div/pow)
- [ ] **1.11** Add `faer` crate for dense linear algebra (outperforms nalgebra at large sizes: 1024×1024 Cholesky in 2.4ms)
- [ ] **1.12** Sparse matrix support: CSR/CSC/COO formats in a new `sparse.rs` module
- [ ] **1.13** Sparse iterative solvers: CG, GMRES, BiCGStab with ILU preconditioner
- [ ] **1.14** Matrix decompositions via faer: LU, QR, SVD, Cholesky, eigendecomposition, Schur
- [ ] **1.15** Condition number estimation with warning when ill-conditioned (κ > 10^12)
- [ ] **1.16** Rootfinding: Newton-Raphson, Brent's method, polynomial roots (companion matrix)
- [ ] **1.17** Numerical integration: adaptive Gauss-Kronrod, Clenshaw-Curtis, Monte Carlo quadrature
- [ ] **1.18** Interpolation: cubic spline, Akima, B-spline, NURBS evaluation (extend existing lookup blocks)
- [ ] **1.19** Random number generation: Xoshiro256++ with seed control, Latin Hypercube, Sobol sequence, Halton
- [ ] **1.20** NaN/Inf propagation with clear error reporting identifying which block produced the invalid value

### 1B — Symbolic Computation

- [ ] **1.21** Symbolic expression type: `SymbolicExpr` in Rust AST (variables, constants, operations, functions)
- [ ] **1.22** Polynomial arithmetic: add, multiply, GCD, factoring, resultants
- [ ] **1.23** Rational function simplification
- [ ] **1.24** Symbolic differentiation (chain rule, product rule, quotient rule)
- [ ] **1.25** Symbolic integration (table-based + Risch algorithm for elementary functions)
- [ ] **1.26** Equation solving: polynomial systems via Gröbner bases
- [ ] **1.27** LaTeX rendering of symbolic expressions (KaTeX already in deps)
- [ ] **1.28** Units tracking system: SI, CGS, imperial with dimensional analysis at graph-validation time
- [ ] **1.29** Symbolic-to-numeric compilation: compile expressions to optimised evaluation for loops

### 1C — Automatic Differentiation

- [ ] **1.30** Forward-mode AD via dual numbers (efficient when inputs << outputs)
- [ ] **1.31** Reverse-mode AD via tape-based recording (efficient for scalar loss functions)
- [ ] **1.32** Mixed-mode: auto-select forward/reverse based on input/output dimensions
- [ ] **1.33** AD through ODE solvers (discrete adjoint with checkpointing)
- [ ] **1.34** AD through linear solvers (implicit function theorem)
- [ ] **1.35** Custom VJP/JVP rules on user-defined blocks
- [ ] **1.36** Gradient checkpointing (Revolve binomial schedule)
- [ ] **1.37** Higher-order: Hessians via forward-over-reverse, Hessian-vector products

### 1D — GPU Acceleration

- [ ] **1.38** WebGPU compute shaders via `wgpu` crate
- [ ] **1.39** WGSL shaders for: dense GEMM, sparse SpMV, element-wise ops, reductions, FFT
- [ ] **1.40** Auto GPU offloading: matrices >512×512 dispatched to GPU
- [ ] **1.41** Shader compilation cache
- [ ] **1.42** Persistent GPU buffers with lazy transfer, SoA layout
- [ ] **1.43** Native CUDA path (optional feature flag) for server-side execution

### 1E — WASM & Performance

- [x] **1.44** Full engine compiles to WASM via wasm-pack
- [x] **1.45** Web Worker execution with worker pool (1-4 workers per canvas)
- [x] **1.46** Binary result encoding (Float64Array Transferable) for zero-copy scalar transfer
- [x] **1.47** SharedArrayBuffer dataset transfer (COOP+COEP headers)
- [x] **1.48** Watchdog timer (5s) with auto-restart
- [x] **1.49** Incremental evaluation with dirty-set propagation + value hash pruning
- [ ] **1.50** WASM SIMD (128-bit fixed-width) for numerical kernels
- [ ] **1.51** wasm-bindgen-rayon for multi-threaded WASM execution
- [ ] **1.52** Memory64 proposal support for >4GB working sets
- [ ] **1.53** Streaming compilation for <2s startup

---

## Category 2 — Block Library

### 2A — Input Blocks

- [x] **2.1** ScalarInput (Number, Slider) with optional unit
- [x] **2.2** VectorInput (Array) with CSV paste
- [x] **2.3** TableInput with column types
- [x] **2.4** CSV import block
- [x] **2.5** Constant picker (π, e, τ, φ, 30+ CODATA constants)
- [x] **2.6** Variable source block
- [ ] **2.7** MatrixInput with spreadsheet-like editor
- [ ] **2.8** BooleanInput (toggle switch)
- [ ] **2.9** FileInput: drag-and-drop for CSV, Excel, HDF5, Parquet, JSON, .mat, .npy
- [ ] **2.10** ParameterSweep: defines range (start, stop, step) for DOE
- [ ] **2.11** TimeSeriesInput with resampling
- [ ] **2.12** ExpressionInput with LaTeX preview (symbolic)
- [ ] **2.13** UnitInput: physical quantity with unit picker (500+ units)

### 2B — Math & Linear Algebra Blocks

- [x] **2.14** Arithmetic: add, sub, mul, div, power, mod, negate, abs, sqrt, floor, ceil, round (all with variadic N-input support for add/mul/max/min)
- [x] **2.15** Trig: sin, cos, tan, asin, acos, atan, atan2, degToRad, radToDeg
- [x] **2.16** Logic: greater, less, equal, ifthenelse, max, min
- [x] **2.17** Matrix: multiply, transpose, inverse, determinant, trace, solve Ax=b
- [x] **2.18** Statistics: mean, median, mode, std, variance, range, zscore, correlation, regression
- [x] **2.19** Probability distributions: normal, t, chi², F, binomial, Poisson, exponential, beta, gamma, Weibull
- [x] **2.20** Combinatorics: factorial, permutation, combination
- [x] **2.21** Lookup table: 1D and 2D interpolation
- [ ] **2.22** LU, QR, SVD, Cholesky, eigendecomposition blocks (expose faer)
- [ ] **2.23** Symbolic math blocks: differentiate, integrate, simplify, expand, substitute
- [ ] **2.24** Numerical integration blocks: adaptive quadrature, Monte Carlo
- [ ] **2.25** Curve fitting: Levenberg-Marquardt, polynomial fit, spline smoothing
- [ ] **2.26** Filter design: Butterworth, Chebyshev, elliptic (FIR/IIR)

### 2C — ODE/DAE/PDE Solver Blocks

- [x] **2.27** ODE RK4 (fixed-step, expression-based RHS, 4 tests)
- [x] **2.28** ODE RK45 Dormand-Prince (adaptive step, error control, 2 tests)
- [ ] **2.29** ODE implicit BDF (stiff systems, Newton iteration)
- [ ] **2.30** ODE symplectic (Störmer-Verlet, symplectic Euler for Hamiltonian systems)
- [ ] **2.31** ODE event detection (zero-crossing)
- [ ] **2.32** DAE solver (index-1 via implicit methods)
- [ ] **2.33** DAE index reduction (Pantelides algorithm)
- [ ] **2.34** PDE solver: 1D/2D FEM with mesh generation, BC specification
- [ ] **2.35** Steady-state solver: Newton iteration to find equilibrium
- [ ] **2.36** Parameter estimation: fit ODE model parameters to experimental data

### 2D — Physics Domain Blocks

*Mechanical:*
- [x] **2.37** Kinematics: v=u+at, s=ut+½at², v²=u²+2as, F=ma, W=mg, p=mv, KE, PE, work, power, torque, centripetal
- [x] **2.38** Materials: stress, strain, Young's modulus, safety factor, spring force/energy
- [x] **2.39** Sections: area circle/annulus, I rect/circle, bending stress, torsional shear
- [x] **2.40** Inertia: solid cylinder, hollow cylinder, solid sphere, rod
- [x] **2.41** Fluids: flow rate, Reynolds, dynamic pressure, Hagen-Poiseuille, Darcy-Weisbach, buoyancy
- [x] **2.42** Thermo: ideal gas, heat Q=mcΔT, conduction, convection, Carnot, thermal expansion
- [x] **2.43** Structural: beam deflection, Euler buckling, Von Mises, bearing capacity
- [ ] **2.44** Contact: penalty-based, Coulomb/Stribeck friction
- [ ] **2.45** Flexible body: modal superposition with Craig-Bampton modes
- [ ] **2.46** Kinematic chain: forward/inverse kinematics for serial mechanisms

*Electrical:*
- [x] **2.47** Ohm's law, power, capacitance, series/parallel resistance, RC/RL tau, RLC resonance, voltage/current divider, transformer, three-phase, Shockley diode
- [ ] **2.48** Diode, MOSFET, IGBT component models
- [ ] **2.49** OpAmp, PWM generator, H-bridge, 3-phase inverter
- [ ] **2.50** DC motor, PMSM motor (dq-frame)
- [ ] **2.51** Battery (equivalent circuit model with SOC + thermal)

*Thermal:*
- [x] **2.52** Brake thermal model (temperature derivative, energy, power)
- [ ] **2.53** ThermalConductor, ThermalCapacitor, Convection, Radiation blocks
- [ ] **2.54** Heat exchanger (ε-NTU and LMTD methods)

*Fluid:*
- [ ] **2.55** Pipe, Valve, Pump, Accumulator, Orifice blocks
- [ ] **2.56** Hydraulic cylinder, hydraulic motor
- [ ] **2.57** Fluid properties (density, viscosity vs T/P)

*Signal/Control:*
- [x] **2.58** Transfer function step response (1st/2nd order), PID, settling time, overshoot, natural freq, damping ratio, Bode magnitude
- [ ] **2.59** State space block (A, B, C, D matrices)
- [ ] **2.60** Saturation, dead zone, rate limiter, delay blocks
- [ ] **2.61** MUX/DEMUX, switch blocks
- [ ] **2.62** Scope block (real-time signal viz during simulation)
- [ ] **2.63** Zero-order hold, rate transition for mixed continuous/discrete
- [ ] **2.64** Stateflow block: FSM editor with states, transitions, guards, actions

### 2E — Vehicle Dynamics Domain

- [x] **2.65** Pacejka Magic Formula tire (lateral, longitudinal, combined slip, sweep, 4 presets, 6 tests)
- [x] **2.66** Quarter-car suspension (2-DOF via RK45, DEFAULT_PASSENGER preset, 2 tests)
- [x] **2.67** Aero: drag, downforce, side force, balance, CdA, 4 presets (5 tests)
- [x] **2.68** Powertrain: torque map interpolation, gear ratio, drivetrain loss, wheel speed (4 tests)
- [x] **2.69** Lap simulation: point-mass quasi-steady-state (forward/backward integration, 2 tests)
- [x] **2.70** Brake thermal: temperature derivative, brake energy, brake power (4 tests)
- [ ] **2.71** Half-car and full vehicle 7-DOF suspension models
- [ ] **2.72** K&C analysis mode (virtual K&C rig)
- [ ] **2.73** Standard .tir file import/export
- [ ] **2.74** Pre-built vehicle event blocks: step steer, sine steer, lane change (ISO 3888)
- [ ] **2.75** Full-vehicle model template with chassis, 4 corners, steering, powertrain, brakes

### 2F — ML/AI Blocks

- [x] **2.76** NN trainer wired to real backprop (parse layers, build Sequential, train, return loss table)
- [x] **2.77** LR schedules: constant, step decay, cosine annealing, exponential (5 tests)
- [x] **2.78** Early stopping config (patience, validation_split)
- [x] **2.79** Epochs > 0 enforcement (no indefinite training)
- [x] **2.80** Dense, Conv1D, Dropout, Activation layers
- [x] **2.81** ML: linear regression, polynomial regression, KNN, decision tree, predict, MSE, R², confusion matrix
- [x] **2.82** ML preprocessing: standardize, normalize, train/test split
- [x] **2.83** Classification metrics: precision/recall/F1, ROC curve, AUC
- [x] **2.84** Feature scale block wired in ops.rs
- [ ] **2.85** LSTM, GRU, Attention layers
- [ ] **2.86** Conv2D layer
- [ ] **2.87** ONNX model import for inference (ONNX Runtime WASM)
- [ ] **2.88** PINNBlock: physics-informed NN with PDE residual loss, adaptive collocation
- [ ] **2.89** Neural operator: FNO/DeepONet architecture
- [ ] **2.90** Surrogate model: train NN or GP from simulation block with active learning
- [ ] **2.91** Hyperparameter optimization: TPE/CMA-ES with pruning
- [ ] **2.92** AutoML block: auto-try models, report best with CV scores
- [ ] **2.93** Transfer learning: load ONNX, freeze layers, add trainable, fine-tune
- [ ] **2.94** Experiment tracker: log metrics/params/artifacts to Supabase

### 2G — Optimization Blocks

- [x] **2.95** LP solver (revised simplex, Bland's anti-cycling, 2 tests)
- [x] **2.96** QP solver (projected gradient descent, boundary constraints, 2 tests)
- [x] **2.97** NSGA-II Pareto front (non-dominated sorting, crowding distance, SBX, 2 tests)
- [x] **2.98** Sobol sensitivity indices (Saltelli sampling, S1+ST, 2 tests)
- [x] **2.99** Gradient descent, genetic algorithm, Nelder-Mead, parametric sweep, Monte Carlo, DOE
- [ ] **2.100** L-BFGS-B (bound-constrained)
- [ ] **2.101** SQP (augmented Lagrangian, equality + inequality constraints)
- [ ] **2.102** Trust-region (dogleg)
- [ ] **2.103** CMA-ES (with sep-CMA-ES for high-dimensional)
- [ ] **2.104** Bayesian optimization: GP surrogate + EI/UCB acquisition
- [ ] **2.105** Multi-fidelity Bayesian: multi-task GP
- [ ] **2.106** DOE: Taguchi, D-optimal, Box-Behnken, Central Composite
- [ ] **2.107** Response surface: RBF/Kriging metamodel + visualization
- [ ] **2.108** UQ: polynomial chaos expansion (Legendre/Hermite, LAR sparse)
- [ ] **2.109** Reliability: FORM (HLRF), importance sampling, subset simulation
- [ ] **2.110** Robust design: mean + k×std Pareto optimization
- [ ] **2.111** Topology optimization: SIMP on 2D FEM mesh

### 2H — Utility Blocks

- [x] **2.112** Display output block
- [x] **2.113** Publish/Subscribe cross-sheet blocks
- [x] **2.114** Text blocks: concat, length, num↔text conversion
- [x] **2.115** Date/time blocks
- [x] **2.116** Unit conversion block
- [ ] **2.117** FMU import block: load FMI 2.0/3.0 FMUs, parse modelDescription.xml, map variables
- [ ] **2.118** FMU export: package subgraph as FMU
- [ ] **2.119** Python script block (Pyodide WASM sandbox)
- [ ] **2.120** Custom Rust block (hot-reloading compilation)
- [ ] **2.121** SubGraph: collapse group into reusable parameterised composite block
- [ ] **2.122** Assertion: runtime value check (range, type, dimension)
- [ ] **2.123** Timer: wall-clock and CPU time measurement
- [ ] **2.124** Logger: structured time-series recording for post-processing
- [ ] **2.125** MathSheet: spreadsheet-in-node-graph with unit-aware formulas
- [ ] **2.126** CodeBlock: inline Rust/Python expressions with autocomplete and instant evaluation

---

## Category 3 — Node Graph & Visual Programming

### 3A — Graph Engine (Already Strong)

- [x] **3.1** React Flow v12 with custom node/edge renderers
- [x] **3.2** Zustand stores for state management
- [x] **3.3** 60fps pan/zoom target (drag pauses engine)
- [x] **3.4** Minimap overlay
- [x] **3.5** Grid snapping toggle
- [x] **3.6** Magnetic block-to-block snapping (useBlockSnapping + SnapGuides)
- [x] **3.7** Topological sort DAG evaluation with cycle detection
- [x] **3.8** Lazy evaluation with dirty-flag caching
- [x] **3.9** Reactive execution (EvalScheduler: reactive/manual modes)
- [x] **3.10** Run button + Ctrl+Enter/F5 shortcut
- [x] **3.11** Pre-run validation (cycles, missing inputs, dangling edges)

### 3B — Node Rendering Improvements

- [x] **3.12** Node status: idle/computing/error indicators in status bar
- [x] **3.13** Stale/error node overlay styles (nodeStyles.ts)
- [x] **3.14** Variadic blocks: +/- buttons for dynamic input ports
- [ ] **3.15** Port type colours: float=blue, vector=green, matrix=purple, signal=orange, string=gray, boolean=yellow
- [ ] **3.16** Port type compatibility enforcement (red/green snap indicators)
- [ ] **3.17** Automatic type coercion (scalar→vector broadcast visual indicator)
- [ ] **3.18** Inline value display: sparkline for vectors, heatmap thumbnail for matrices, waveform for signals
- [ ] **3.19** Double-click node → full config panel as side sheet
- [ ] **3.20** Edge labels showing data shape on hover ("[3×3]", "[1024]")
- [ ] **3.21** Smart edge routing avoiding node crossings
- [ ] **3.22** Animated flow direction on edges during execution
- [ ] **3.23** Edge bundling for clean visual when many edges share regions

### 3C — Graph Organisation

- [x] **3.24** Groups/frames with collapsible backgrounds
- [x] **3.25** Annotations (text, callout, highlight, arrow, shapes, sticky notes)
- [x] **3.26** Block library palette with search
- [x] **3.27** Command palette (Ctrl+K)
- [x] **3.28** Auto-layout (dagre LR/TB)
- [x] **3.29** Alignment tools (distribute, align H/V)
- [ ] **3.30** Colour-coded domain backgrounds (mechanical=blue, electrical=yellow, thermal=red, control=green)
- [ ] **3.31** Subgraph collapse: right-click group → collapse to composite block with exposed ports

### 3D — Debugging

- [x] **3.32** Debug console panel
- [x] **3.33** Graph health panel (on-demand)
- [x] **3.34** Problems panel for validation diagnostics
- [ ] **3.35** Probe mode: click edge → floating inspector with value, type, shape, stats, plot
- [ ] **3.36** Breakpoints: right-click node → pause before evaluation
- [ ] **3.37** Step execution: one node at a time (forward/backward)
- [ ] **3.38** Execution timeline: Gantt-chart of block durations
- [ ] **3.39** Data flow highlighting: hover port → highlight upstream/downstream
- [ ] **3.40** Diff view: compare two execution snapshots side-by-side

### 3E — Formula Bar & Expression Language

- [x] **3.41** CSEL parser: lexer, recursive descent parser, AST types (15 tests)
- [x] **3.42** Graph generator: AST → React Flow nodes + edges
- [x] **3.43** FormulaBar expression mode (fx toggle button)
- [x] **3.44** Enter → parse CSEL → generate blocks → add to canvas
- [x] **3.45** Variadic function support (max(a,b,c,d) → 4-input block)
- [x] **3.46** Variable assignments (x=5; x*2=)
- [ ] **3.47** Syntax highlighting in expression input
- [ ] **3.48** Autocomplete: block types, functions, variables, constants
- [ ] **3.49** Expression history (up/down arrow)
- [ ] **3.50** Drag from empty port → search palette filtered to compatible types

---

## Category 4 — Data Handling & I/O

- [x] **4.1** CSV import/export
- [x] **4.2** Excel export (write-excel-file)
- [x] **4.3** PDF audit report export
- [x] **4.4** SVG/PNG plot export
- [x] **4.5** Project JSON format (.chainsolvejson)
- [ ] **4.6** Excel .xlsx import (read)
- [ ] **4.7** HDF5 import/export
- [ ] **4.8** Parquet import/export (Apache Arrow IPC)
- [ ] **4.9** MATLAB .mat v5/v7.3 import
- [ ] **4.10** NumPy .npy/.npz import
- [ ] **4.11** STEP/IGES geometry import
- [ ] **4.12** STL mesh import
- [ ] **4.13** FMU .fmu import/export
- [ ] **4.14** .tir tire parameter file import/export
- [ ] **4.15** OpenDRIVE .xodr road geometry import
- [ ] **4.16** ONNX model export (trained NN)
- [ ] **4.17** LaTeX export (symbolic expressions)
- [ ] **4.18** Clipboard paste from Excel/Google Sheets → DataTable
- [ ] **4.19** WebSocket input block for live sensor data (up to 1kHz)
- [ ] **4.20** SQL query block (PostgreSQL via Supabase)
- [ ] **4.21** REST/GraphQL API client block
- [ ] **4.22** Data versioning: SHA-256 content-hash for reproducibility

---

## Category 5 — Collaboration & Version Control

- [x] **5.1** Project save/load via Supabase Storage
- [x] **5.2** Multi-canvas sheets (tabs)
- [x] **5.3** Share links (read-only, ADV-02)
- [x] **5.4** Node comments
- [x] **5.5** Audit log
- [x] **5.6** Conflict detection (CAS on updated_at)
- [ ] **5.7** Real-time co-editing via Yjs CRDT (<100ms sync latency)
- [ ] **5.8** Presence indicators (colored cursors, selection highlights)
- [ ] **5.9** Graph versioning with diff view (added/removed/modified nodes)
- [ ] **5.10** Branching: create named branches for experimentation
- [ ] **5.11** Branch merge with conflict resolution UI
- [ ] **5.12** Export as interactive standalone HTML
- [ ] **5.13** Git-friendly JSON format (deterministic key ordering, .chainsolve extension)

---

## Category 6 — Visualization & Plotting

- [x] **6.1** XY Plot (line/scatter via Vega-Lite)
- [x] **6.2** Histogram, Bar Chart, Heatmap
- [x] **6.3** Plot export: SVG/PNG/PDF
- [x] **6.4** Plot CSP compliance
- [ ] **6.5** Bode plot (magnitude + phase)
- [ ] **6.6** Nyquist plot, root locus
- [ ] **6.7** XY animation with playback controls
- [ ] **6.8** Contour plot
- [ ] **6.9** 3D surface plot (Three.js / React Three Fiber)
- [ ] **6.10** Parallel coordinates (multi-dimensional exploration)
- [ ] **6.11** Pareto front plot (2D/3D with dominated region shading)
- [ ] **6.12** Sankey diagram (energy/mass flow)
- [ ] **6.13** Box-and-whisker, violin plots
- [ ] **6.14** Live Scope block: 30fps update during simulation with buffer
- [ ] **6.15** Multi-axis support (secondary Y, stacked panels)
- [ ] **6.16** 3D viewport: mesh viz, vehicle animation, mechanism motion (Three.js orbit camera)
- [ ] **6.17** Annotation: arrows, reference lines, shaded regions (interactive)

---

## Category 7 — Performance & Scalability

- [x] **7.1** 60fps canvas interaction (drag pauses engine)
- [x] **7.2** Reactive eval (no unnecessary recomputation)
- [x] **7.3** Value hash pruning (ENG-05, skip unchanged downstream)
- [x] **7.4** Binary result encoding (ENG-03, zero-copy Float64Array)
- [x] **7.5** Worker pool (ENG-04, 1-4 workers per canvas)
- [x] **7.6** WASM bundle size budget: 1000KB raw, 350KB gzip
- [ ] **7.7** Benchmark: 500 blocks at 60fps pan/zoom
- [ ] **7.8** Benchmark: 1000×1000 matrix multiply <10ms (WebGPU)
- [ ] **7.9** Benchmark: 100-state ODE, 1s sim, <500ms browser
- [ ] **7.10** Streaming evaluation for large parameter sweeps (don't hold all results in memory)
- [ ] **7.11** LRU cache with configurable size (default 1GB browser)
- [ ] **7.12** Hybrid compute: dispatch heavy jobs to server Edge Function
- [ ] **7.13** Cold start <3s on 4G (code splitting, lazy block loading, streaming WASM)
- [ ] **7.14** Offline support via Service Worker + IndexedDB

---

## Category 8 — Simulation Infrastructure

- [ ] **8.1** Dedicated simulation worker (separate from eval worker)
- [ ] **8.2** `run_simulation` WASM export with progress callback
- [ ] **8.3** All simulations have defined end: maxIterations, targetLoss, endTime, convergenceThreshold
- [ ] **8.4** Looping mode: config `loop: true` + `loopCount: N` — restart from initial conditions after each cycle
- [ ] **8.5** Progress streaming: iteration, totalIterations, cycle, partialResults, metrics
- [ ] **8.6** Cancellation: Stop button cleanly ends after current cycle
- [ ] **8.7** Connected Plot blocks update live during looping simulation
- [ ] **8.8** SimulationStatusStore: tracks active sims, StatusBar shows progress
- [ ] **8.9** Normal graph eval continues while sim runs on separate worker

---

## Category 9 — UI/UX & Onboarding

- [x] **9.1** Login/signup with Supabase Auth (email, Turnstile CAPTCHA, MFA)
- [x] **9.2** Onboarding overlay (step-by-step spotlight tour)
- [x] **9.3** First-run modal with templates
- [x] **9.4** Block library palette with category tabs and search
- [x] **9.5** Keyboard shortcuts (Ctrl+Z/Y undo/redo, Delete, Ctrl+G group, Ctrl+D duplicate)
- [x] **9.6** Dark mode default with light mode toggle
- [x] **9.7** Customisable themes
- [x] **9.8** i18n: 7 locales (en, de, es, fr, he, it, ja)
- [x] **9.9** Settings: decimal places, sig figs, scientific notation, angle unit, autosave
- [x] **9.10** Explore/marketplace page
- [ ] **9.11** Interactive 5-minute tutorial (spring-mass-damper from scratch)
- [ ] **9.12** Template gallery on home screen: Vehicle K&C, PID Tuning, Curve Fitting, NN Training, Structural Opt
- [ ] **9.13** AI assistant: natural language → suggested graph (LLM API call)
- [ ] **9.14** Progressive disclosure: simple defaults, "Advanced" toggle for all params
- [ ] **9.15** MathSheet block: spreadsheet within node graph (unit-aware formulas)
- [ ] **9.16** CodeBlock: inline Rust/Python with autocomplete and instant eval

---

## Category 10 — Extensibility & API

- [ ] **10.1** Block SDK: published Rust crate with `Block` trait (metadata, validate, evaluate)
- [ ] **10.2** Plugin system: load custom blocks as WASM modules from registry
- [ ] **10.3** REST API: POST /api/graph/execute, GET /api/graph/{id}/results
- [ ] **10.4** WebSocket /api/graph/{id}/stream for execution progress
- [ ] **10.5** CLI tool: `chainsolve-cli` for headless execution, batch sweeps
- [ ] **10.6** Python bindings: `pip install chainsolve` via PyO3
- [ ] **10.7** JavaScript/TypeScript SDK: `npm install @chainsolve/sdk`
- [ ] **10.8** Webhook support: trigger URLs on execution completion

---

## Category 11 — Testing & Validation

- [x] **11.1** Golden fixture tests (20 fixtures pinning exact outputs)
- [x] **11.2** Property tests (proptest: determinism, incremental consistency, no-panic)
- [x] **11.3** Perf smoke tests (500ms budget)
- [x] **11.4** Criterion benchmarks
- [x] **11.5** Vitest unit tests (5170+ tests)
- [x] **11.6** Playwright E2E (21 spec files)
- [x] **11.7** Catalog sync tests (Rust ↔ TS alignment)
- [ ] **11.8** DETEST ODE benchmark suite (A1-A5, B1-B5, C1-C5, D1-D5, E1-E5)
- [ ] **11.9** Optimisation benchmarks (Rosenbrock, Rastrigin, Ackley, ZDT1-6)
- [ ] **11.10** FEA benchmarks (NAFEMS LE1, LE10, LE11)
- [ ] **11.11** FMU compliance testing (FMI Cross-Check)
- [ ] **11.12** Round-trip testing: save → close → reopen → execute = bit-identical
- [ ] **11.13** Solver verification reports (auto-generated PDF)
- [ ] **11.14** TestBlock/TestSuite: user-defined value assertions

---

## Category 12 — Documentation

- [x] **12.1** CLAUDE.md (comprehensive, updated with new modules)
- [x] **12.2** ARCHITECTURE.md
- [x] **12.3** README.md with block count and capabilities
- [x] **12.4** Block descriptions (blockDescriptions.ts for all 361+ blocks)
- [x] **12.5** 13 ADRs
- [ ] **12.6** CSEL grammar documentation (docs/CSEL.md)
- [ ] **12.7** 20+ guided tutorials as ChainSolve graphs with annotations
- [ ] **12.8** 100+ example graphs by domain
- [ ] **12.9** Mathematical reference: algorithms with convergence proofs, stability regions
- [ ] **12.10** API documentation (auto-generated from Rust doc comments)
- [ ] **12.11** Video walkthroughs (5-min per feature area)
- [ ] **12.12** Community forum (Discourse)
- [ ] **12.13** Changelog with migration notes

---

## Category 13 — Deployment & Licensing

- [x] **13.1** Browser-first: app.chainsolve.co.uk
- [x] **13.2** Cloudflare Pages hosting
- [x] **13.3** Stripe billing (Pro, Enterprise tiers)
- [x] **13.4** Supabase Auth with role-based access
- [ ] **13.5** Tauri desktop app for offline use with native CUDA
- [ ] **13.6** Docker Compose self-hosted deployment
- [ ] **13.7** Kubernetes Helm chart
- [ ] **13.8** Free tier: full engine, 3 projects, 500MB storage
- [ ] **13.9** Academic tier: Pro-equivalent for verified students/faculty

---

## Category 14 — Acausal Physical Modeling

- [ ] **14.1** Port-based connections (through/across variables) between physics blocks
- [ ] **14.2** Automatic DAE generation from network topology (modified nodal analysis)
- [ ] **14.3** Multi-domain coupling (electrical ↔ mechanical ↔ thermal)
- [ ] **14.4** Equation-based block authoring (Modelica-like syntax)
- [ ] **14.5** Symbolic index reduction (Pantelides algorithm)
- [ ] **14.6** FMI 2.0/3.0 model exchange and co-simulation

---

## Category 15 — Housekeeping & Code Quality

- [x] **15.1** TypeScript strict mode: noUnusedLocals, noUnusedParameters, verbatimModuleSyntax
- [x] **15.2** ESLint zero violations
- [x] **15.3** Prettier formatting
- [x] **15.4** @types/dagre + @types/katex moved to devDependencies
- [x] **15.5** npm audit: 0 vulnerabilities
- [x] **15.6** i18n key check passes (2191 keys)
- [x] **15.7** verify:fast passes (5170+ tests)
- [x] **15.8** CLAUDE.md updated with reactive eval, CSEL, variadic, new modules
- [ ] **15.9** TODO/FIXME/HACK scan — resolve or convert to GitHub issues
- [ ] **15.10** Cargo audit for Rust security advisories
- [ ] **15.11** Migration audit and optional squash (pre-release)
- [ ] **15.12** RLS policy completeness check
- [ ] **15.13** New ADRs: CSEL, magnetic snapping, simulation worker, faer integration
- [ ] **15.14** Update all 7 locale files for new block labels

---

## Summary

| Category | Done | Total | Key Areas |
| -------- | ---- | ----- | --------- |
| 1 — Core Engine | 10 | 53 | faer, sparse, symbolic, AD, GPU |
| 2 — Block Library | 46 | 126 | Physics domains, ML/AI, optimization |
| 3 — Node Graph | 22 | 50 | Port types, debugging, edge rendering |
| 4 — Data I/O | 5 | 22 | Excel, HDF5, Parquet, FMU, WebSocket |
| 5 — Collaboration | 6 | 13 | Yjs CRDT, branching, diff view |
| 6 — Visualization | 4 | 17 | 3D, Bode, Scope, Pareto, Sankey |
| 7 — Performance | 6 | 14 | WebGPU, benchmarks, offline |
| 8 — Simulation | 0 | 9 | Dedicated worker, looping, progress |
| 9 — UI/UX | 10 | 16 | Tutorials, AI assistant, MathSheet |
| 10 — Extensibility | 0 | 8 | SDK, CLI, Python, webhooks |
| 11 — Testing | 7 | 14 | DETEST, NAFEMS, FMI compliance |
| 12 — Documentation | 5 | 13 | 100+ examples, tutorials, videos |
| 13 — Deployment | 4 | 9 | Tauri, Docker, academic tier |
| 14 — Acausal | 0 | 6 | Modelica-like, FMI, multi-domain |
| 15 — Housekeeping | 8 | 14 | Audit, ADRs, locales |
| **Total** | **~133** | **~384** | |

---

*This checklist is the single source of truth for ChainSolve development. Organised by the 16 requirement categories from the definitive specification. Every item is independently implementable, testable, and verifiable. The browser is the platform. Rust is the engine. React is the interface.*
