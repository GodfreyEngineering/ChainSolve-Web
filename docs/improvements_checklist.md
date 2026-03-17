# ChainSolve: Definitive Improvements Checklist

> **Vision:** Displace MATLAB ($940–$5,000+/yr), Simulink ($2,000–$15,000+/yr), and Excel by combining a Rust-powered computation engine with a React node-graph UI, delivering browser-native performance at a fraction of the cost. No single tool today offers block-based visual programming + symbolic+numeric+GPU computation + built-in ML/physics pipelines + real-time collaboration + browser-native deployment. ChainSolve fills that gap.
>
> **Architecture:** Rust + WebAssembly + WebGPU core, React Flow v12 frontend, Supabase backend.
>
> **Evaluation philosophy:** Reactive — evaluates once when inputs/blocks/chains change. Never loops continuously. Simulations have defined endpoints. Users can opt-in to looping simulations (e.g., pendulum over N periods with live graph).
>
> **Competitive insight:** The survey of 30+ tools confirms scientists/engineers cobble together 3–7 tools. Node-based paradigm is proven (Grasshopper, Houdini, LabVIEW, KNIME). Key weaknesses of competitors — no real-time collaboration, poor version control, single-threaded execution — are all solvable with modern web technology.

---

## Category 1 — Core Computation Engine

*The Rust engine must provide a multi-precision, GPU-accelerated numerical and symbolic solver compiling to both native and WASM targets.*

### 1A — Numerical Kernel

- [x] **1.1** IEEE 754 f64 arithmetic throughout all operations with NaN/Inf propagation and deterministic evaluation order
- [x] **1.2** Arbitrary-precision via `dashu-float` (pure Rust, WASM-safe) behind `high-precision` Cargo feature flag — for cases requiring >64-bit precision (up to 9,999 decimal places for atomic physics)
- [x] **1.3** `Value::HighPrecision { display: String, approx: f64, precision: u32 }` variant — string carries full decimal expansion losslessly across WASM boundary, approx provides fast UI preview
- [x] **1.4** `precision.rs` — HP add/sub/mul/div using dashu-float DBig with `with_precision()` context (4 tests including 1/3×3 precision test)
- [x] **1.5** Per-node precision override via `data.precision` field — `hp_or_broadcast()` in ops.rs checks field, calls HP for scalar a/b inputs, falls back to nary_broadcast for vectors/variadic
- [x] **1.6** `compensated.rs` — Neumaier compensated sum (handles catastrophic cancellation: sum(1e16,1,-1e16)=1) + Ogita-Rump-Oishi dot product + Dekker two-product error-free transformation (7 tests)
- [x] **1.7** Neumaier compensated summation already used in all vector/stats ops (kahan_sum in ops.rs is identical to Neumaier algorithm)
- [x] **1.8** Complex number support: Value::Complex{re,im}, complex_from/re/im/mag/arg/conj/add/mul/div/exp/ln/pow blocks
- [x] **1.9** FFT via `rustfft`: fft_magnitude, fft_power, fft_freq_bins, window functions (Hann/Hamming/Blackman), FIR low-pass/high-pass filters
- [x] **1.10** Interval arithmetic: Value::Interval{lo,hi}, interval_from/bounds/lo/hi/mid/width/contains/add/sub/mul/div/pow — guaranteed bounds propagation
- [x] **1.11** Add `faer` crate (pure Rust, outperforms nalgebra at large sizes: 1024×1024 Cholesky in 2.4ms parallel) for dense linear algebra — replace nalgebra for matrices >64×64, keep nalgebra for small fixed-size. Faer provides: matrix multiply, eigendecomposition, SVD, QR, LU with partial/full pivoting
- [x] **1.12** Sparse matrix module (`sparse.rs`): CSR/CSC/COO/BSR storage formats, sparse-dense conversion, sparse matrix-vector multiply
- [x] **1.13** Sparse iterative solvers: CG (symmetric positive definite), GMRES (general), BiCGStab (non-symmetric) with ILU/AMG preconditioners — essential for FEM and large-scale systems
- [x] **1.14** Expose faer decompositions as blocks: LU, QR, SVD, Cholesky, eigendecomposition, Schur — each as a separate block returning the factored components
- [x] **1.15** Condition number estimation (`cond()`) with automatic UI warning when ill-conditioned (κ > 10^12) — prevents silent numerical failures
- [x] **1.16** Rootfinding module: Newton-Raphson (with backtracking line search), Brent's method (guaranteed convergence for bracketed roots), polynomial roots via companion matrix eigenvalues
- [x] **1.17** Numerical integration: adaptive Gauss-Kronrod (7-15 point), Clenshaw-Curtis (for smooth integrands), Monte Carlo quadrature (for high-dimensional integrals)
- [x] **1.18** Enhanced interpolation: cubic spline (natural/clamped/not-a-knot), Akima (avoids oscillation), B-spline fitting, NURBS evaluation — extend existing 1D/2D lookup blocks
- [x] **1.19** Random number generation: Xoshiro256++ (reproducible with seed control), Latin Hypercube sampling, Sobol quasi-random sequence, Halton sequence — essential for Monte Carlo and DOE
- [x] **1.20** Enhanced NaN/Inf error reporting: when a NaN is produced, trace it back through the graph to identify the originating block and show the user exactly which input caused it — display in Problems panel

### 1B — Symbolic Computation (CAS in Rust)

*Inspired by Mathematica/Maple but implemented in Rust for WASM. Key for ExpressionInput blocks, LaTeX display, and units enforcement.*

- [ ] **1.21** Symbolic expression AST in Rust: `SymExpr` enum with variants for Variable, Constant, BinaryOp, UnaryOp, Function, Power, Sum, Product — stored as a DAG for common subexpression sharing
- [ ] **1.22** Polynomial arithmetic: add, multiply, GCD (Euclidean algorithm), factoring (Berlekamp/Zassenhaus), resultants — foundation for equation solving
- [ ] **1.23** Rational function simplification: cancel common factors, partial fraction decomposition
- [ ] **1.24** Symbolic differentiation: chain rule, product rule, quotient rule, trig derivatives, exponential/log derivatives — output simplified via simplification rules
- [ ] **1.25** Symbolic integration: table lookup for standard forms + Risch algorithm for elementary functions (algebraic, exponential, logarithmic) — returns "no elementary antiderivative" when none exists
- [ ] **1.26** Polynomial system solving via Gröbner bases (Buchberger's algorithm with F4/F5 improvements) — solves systems of polynomial equations symbolically
- [ ] **1.27** LaTeX rendering of symbolic expressions via KaTeX (already in deps) — render in block output previews, formula bar, and export
- [ ] **1.28** Units tracking system: SI (base + derived), CGS, imperial unit systems with automatic dimensional analysis at graph-validation time (before execution) — inspired by MathCAD's approach. Check dimensional consistency, report unit mismatch errors with suggested fixes, auto-convert compatible units at block boundaries (mm→m)
- [ ] **1.29** Symbolic-to-numeric compilation: JIT-compile symbolic expressions to optimised Rust closures for evaluation in loops — avoids re-parsing expressions on every ODE step

### 1C — Automatic Differentiation Engine

*Essential for gradient-based optimisation, neural network training, sensitivity analysis, and physics-informed learning. JAX-style composable transformations.*

- [ ] **1.30** Forward-mode AD via dual numbers: `DualNumber { value: f64, derivative: f64 }` — efficient when number of inputs << number of outputs (e.g., sensitivity of 1000 outputs to 3 inputs)
- [ ] **1.31** Reverse-mode AD via tape-based recording: build computation graph during forward pass, then traverse backward to compute gradients — efficient for scalar loss functions (neural network training)
- [ ] **1.32** Mixed-mode AD: automatically select forward vs reverse based on input/output dimension ratio. If dim(input) < dim(output), use forward; otherwise reverse. Threshold configurable.
- [ ] **1.33** AD through ODE solvers: discrete adjoint method with checkpointing — compute gradients of ODE solution w.r.t. parameters without storing full trajectory. Essential for parameter estimation and PINNs.
- [ ] **1.34** AD through linear solvers: implicit differentiation via implicit function theorem — if Ax=b and A,b depend on parameters, compute dx/dp without differentiating the solver internals
- [ ] **1.35** Custom VJP/JVP rules: allow block authors to define efficient gradient rules for their blocks (like JAX's `custom_vjp`) instead of relying on automatic tracing
- [ ] **1.36** Gradient checkpointing with binomial (Revolve) schedule: trade computation for memory in reverse-mode — essential for long ODE integrations and deep networks
- [ ] **1.37** Higher-order derivatives: Hessians via forward-over-reverse composition (one forward pass per Hessian column), Hessian-vector products (single reverse pass) — needed for Newton's method and UQ

### 1D — GPU Acceleration (WebGPU)

*All major browsers support WebGPU since mid-2025. This is the key performance lever for large numerical workloads.*

- [ ] **1.38** WebGPU compute shaders via `wgpu` crate (pure Rust, compiles to WASM): initialise GPU device, create compute pipelines, manage buffer allocation
- [ ] **1.39** WGSL compute shaders for: dense GEMM (tiled, 16×16 workgroup), batch GEMM, sparse SpMV (CSR format), element-wise ops (add/mul/exp/sin over arrays), reduction (sum/max/min), FFT (Cooley-Tukey radix-2)
- [ ] **1.40** Auto GPU offloading: when a matrix operation exceeds configurable size threshold (default 512×512), transparently dispatch to GPU shader instead of CPU. Fall back to CPU if GPU unavailable.
- [ ] **1.41** Shader compilation cache: store compiled pipelines in IndexedDB keyed by shader hash to avoid recompilation on page reload
- [ ] **1.42** GPU memory management: persistent GPU buffers with lazy CPU↔GPU transfer, structure-of-arrays layout for coalesced memory access, explicit buffer lifecycle management
- [ ] **1.43** Optional native CUDA path (behind feature flag) for server-side execution on NVIDIA hardware via `cudarc` crate — for jobs dispatched to server compute

### 1E — WASM & Runtime Performance

- [x] **1.44** Full engine compiles to WASM via wasm-pack with wasm-opt -O3 optimisation
- [x] **1.45** Web Worker execution with pool of 1-4 dedicated workers per canvas, LRU eviction, primary/dedicated engine transition
- [x] **1.46** Binary result encoding (ENG-03): scalar values as Float64Array Transferable for zero-copy main↔worker transfer
- [x] **1.47** SharedArrayBuffer dataset transfer (ENG-02): COOP+COEP headers enable zero-copy for large datasets
- [x] **1.48** Watchdog timer (5s timeout, W9.9): detects WASM hangs, auto-recreates worker, reloads snapshot from cache
- [x] **1.49** Incremental evaluation with dirty-set propagation: only recompute nodes whose inputs changed. ENG-05 value hash pruning: skip downstream when output unchanged.
- [ ] **1.50** WASM SIMD (128-bit fixed-width, cross-browser since 2024): vectorise inner loops for f64 operations (2x throughput for element-wise ops). Enable via `-C target-feature=+simd128` in Cargo.
- [ ] **1.51** Multi-threaded WASM via `wasm-bindgen-rayon`: spawn thread pool inside WASM module for parallel evaluation of independent DAG branches. Requires SharedArrayBuffer (already enabled via COOP+COEP).
- [ ] **1.52** Memory64 proposal support: when available, enables >4GB WASM address space for very large datasets/meshes. Feature-detect and enable at runtime.
- [ ] **1.53** Streaming WASM compilation: use `WebAssembly.compileStreaming()` for <2s startup. Currently loads full module before init. Target: interactive within 2s on 4G connection.

---

## Category 2 — Block Library

*ChainSolve's primary user interface to computation. Every block has typed input ports, typed output ports, a configuration panel, and an evaluation function. Blocks must be lazy-evaluated with caching. Currently 361+ blocks across 20+ categories.*

### 2A — Input Blocks

- [x] **2.1** ScalarInput (Number block): numeric value with optional unit, slider mode, manual value override
- [x] **2.2** VectorInput (Array block): 1D array with CSV paste, manual entry, dataset reference (SharedArrayBuffer zero-copy)
- [x] **2.3** TableInput: inline editable data table with column types (numeric), CSV import
- [x] **2.4** CSV import block: parse CSV files, auto-detect delimiters, handle headers
- [x] **2.5** Constant picker: unified dropdown with π, e, τ, φ, 30+ CODATA 2022 physical constants (g₀, c, h, kB, etc.)
- [x] **2.6** Variable source block: named variable with cross-sheet publish/subscribe
- [ ] **2.7** MatrixInput: 2D array with spreadsheet-like editor (row/col headers, cell editing), CSV/Excel import, copy-paste from Excel/Sheets
- [ ] **2.8** BooleanInput: toggle switch block outputting 0.0/1.0, for if-then-else logic and conditional computation
- [ ] **2.9** FileInput: drag-and-drop block accepting CSV, Excel (.xlsx), HDF5, Parquet, JSON, MATLAB .mat (v5 via matfile crate, v7.3 via HDF5), NumPy .npy/.npz, image formats — parses file and outputs DataTable/Matrix/Vector
- [ ] **2.10** ParameterSweep: defines a parameter range (start, stop, step OR explicit list) for DOE/optimisation — connects to DOE blocks, output is a vector of values
- [ ] **2.11** TimeSeriesInput: time-stamped data with configurable resampling (linear, ZOH, cubic) and time format parsing
- [ ] **2.12** ExpressionInput: free-form mathematical expression parsed to symbolic representation with live LaTeX preview — uses the symbolic CAS (Category 1B). Output is SymbolicExpr value type.
- [ ] **2.13** UnitInput: physical quantity with unit picker dropdown (search across 500+ units: SI base/derived, CGS, imperial, engineering) — output carries unit metadata for dimensional checking

### 2B — Math & Linear Algebra Blocks

- [x] **2.14** Arithmetic: add, subtract, multiply, divide, power, mod, negate, abs, sqrt, floor, ceil, round, trunc, sign, ln, log10, exp, log_base, roundN — all with variadic N-input support for add/multiply/max/min (2–64 inputs via `nary_broadcast`, backward-compatible with a/b ports)
- [x] **2.15** Trig: sin, cos, tan, asin, acos, atan, atan2, degToRad, radToDeg — with angle unit preference (deg/rad) affecting trig block badge display
- [x] **2.16** Logic: greater, less, equal, ifthenelse, max, min (variadic) — for conditional computation and comparisons
- [x] **2.17** Matrix ops: matrix_multiply, matrix_transpose, matrix_inverse, matrix_det, matrix_trace, matrix_solve (Ax=b), matrix_from_table, matrix_to_table
- [x] **2.18** Descriptive stats: mean, median, mode, stddev, variance, range, zscore, geometric mean (all via compensated Neumaier summation). Relationships: covariance, correlation, linear regression (slope, intercept)
- [x] **2.19** Probability distributions: normal PDF/CDF/InvCDF, t PDF/CDF, chi² PDF/CDF, F PDF/CDF, binomial PMF/CDF, Poisson PMF/CDF, exponential PDF/CDF, beta PDF/CDF, gamma PDF, Weibull PDF
- [x] **2.20** Combinatorics: factorial, permutation, combination
- [x] **2.21** Lookup table: 1D interpolation (linear on x/y vectors), 2D interpolation (bilinear on x/y/z table)
- [ ] **2.22** Decomposition blocks exposing faer: `LU_Decompose` (returns L,U,P matrices), `QR_Decompose` (returns Q,R), `SVD` (returns U,S,V), `Cholesky` (returns L), `Eigen` (returns eigenvalues vector + eigenvectors matrix), `Schur` (returns T,Q) — each as a multi-output block
- [ ] **2.23** Symbolic math blocks: `Differentiate` (symbolic d/dx), `Integrate` (symbolic ∫dx), `Simplify`, `Expand`, `Substitute` (replace variable with value/expression) — use CAS from 1B, display LaTeX
- [ ] **2.24** Numerical integration blocks: `Integrate1D` (adaptive Gauss-Kronrod), `IntegrateMC` (Monte Carlo for high-dim) — input is expression or connected function subgraph
- [ ] **2.25** CurveFit: least-squares fitting to user-defined model (Levenberg-Marquardt algorithm), polynomial fit (degree N), spline smoothing — returns fitted parameters + R² + residuals
- [ ] **2.26** Filter design: `DesignFilter` (Butterworth/Chebyshev I/II/elliptic, specify order + cutoff), `ApplyFilter` (FIR/IIR), `ZeroPhaseFilter` — for signal processing workflows
- [ ] **2.27** Norm blocks: L1, L2, Linf, Frobenius norms — for vectors and matrices
- [ ] **2.28** RandomSample: uniform, normal, log-normal, Latin Hypercube, Sobol sequence, Halton sequence — with seed control for reproducibility

### 2C — ODE/DAE/PDE Solver Blocks

*Modeled after Julia's DifferentialEquations.jl API — the gold standard for ODE solver interfaces.*

- [x] **2.29** ODE RK4: classic fixed-step 4th-order Runge-Kutta — expression-based RHS via expr.rs, parameter support, adaptive final step. 4 tests: exponential growth (rel error <1e-8), harmonic oscillator (energy conservation <1e-6), parametric (k=2), structure validation.
- [x] **2.30** ODE RK45 Dormand-Prince: embedded 4(5) pair with automatic step control — h_new = h × clamp(0.9×(tol/err)^0.2, 0.2, 5.0). Step rejection when error exceeds tolerance. 2 tests: adaptive uses fewer steps than RK4, harmonic oscillator full-period return. Ref: Dormand & Prince 1980, equivalent to MATLAB ode45.
- [ ] **2.31** ODE implicit BDF: Backward Differentiation Formulas orders 1-5 with Newton iteration — essential for stiff systems (chemical kinetics, some thermal problems). Order and step size adaptation. Ref: Hairer & Wanner "Solving ODEs II".
- [ ] **2.32** ODE Radau IIA: implicit Runge-Kutta of order 5 — L-stable, excellent for very stiff problems with discontinuities. Ref: Hairer & Wanner.
- [ ] **2.33** ODE symplectic: Störmer-Verlet (2nd order) and symplectic Euler (1st order) — preserve energy for Hamiltonian systems (planetary orbits, molecular dynamics). Essential that total energy drift is O(h²) over long integrations.
- [ ] **2.34** ODE event detection: zero-crossing detection with bisection refinement — essential for impact problems, switch events, termination conditions (e.g., "stop when ball hits ground")
- [ ] **2.35** DAE solver: index-1 DAE via BDF with consistent initialisation (Brown's method) — for systems with algebraic constraints (e.g., constrained mechanical systems, electrical circuits)
- [ ] **2.36** DAE index reduction: Pantelides algorithm to detect high-index DAEs, automatically differentiate constraint equations to reduce to index-1 form, display structural analysis to user
- [ ] **2.37** PDE solver (1D): method-of-lines with automatic spatial discretisation (finite differences, configurable order) — convert PDE to system of ODEs and solve with existing ODE solvers. Support: heat equation, wave equation, advection-diffusion.
- [ ] **2.38** PDE solver (2D FEM): triangle mesh generation (Delaunay), FEM assembly (P1/P2 elements), boundary condition specification (Dirichlet, Neumann, Robin), material property fields — for Poisson, elasticity, Stokes flow
- [ ] **2.39** SteadyState solver: Newton iteration to find equilibrium of dynamic system — given dy/dt = f(y), find y* where f(y*)=0. Uses Jacobian from AD engine (Category 1C).
- [ ] **2.40** ParameterEstimation: fit ODE/DAE model parameters to experimental data — Levenberg-Marquardt minimising sum of squared residuals between model output and data, using AD for Jacobian computation

### 2D — Physics Domain Blocks

#### Mechanical (existing + new)

- [x] **2.41** Kinematics: v=u+at, s=ut+½at², v²=u²+2as, F=ma, W=mg, p=mv, KE=½mv², PE=mgh, W=Fs, P=W/t, P=Fv, T=Fr, ω↔RPM, centripetal acc/force, friction, impulse (19 blocks)
- [x] **2.42** Materials: stress σ=F/A, strain ε=ΔL/L, Young's modulus E=σ/ε, pressure p=F/A, safety factor, spring force F=kx, spring energy E=½kx² (7 blocks)
- [x] **2.43** Sections: area circle/annulus, I rectangle/circle, J circle, bending stress σ=My/I, torsional shear τ=Tr/J (7 blocks)
- [x] **2.44** Rotational inertia: solid cylinder ½mr², hollow cylinder, solid sphere ⅖mr², rod (center/end) (5 blocks)
- [x] **2.45** Fluids: Q=Av, v=Q/A, ṁ=ρQ, Reynolds Re, q=½ρv², Hagen-Poiseuille, Darcy-Weisbach, buoyancy F=ρVg (8 blocks)
- [x] **2.46** Thermo: ideal gas PV=nRT (P and T forms), Q=mcΔT, conduction Q̇=kAΔT/L, convection Q̇=hAΔT, Carnot η, thermal expansion ΔL=αLΔT (7 blocks)
- [x] **2.47** Structural: beam deflection (simply supported PL³/48EI, cantilever PL³/3EI), beam moment Pab/L, Euler buckling, Von Mises, combined stress, steel check utilisation, Terzaghi bearing capacity, ACI concrete moment (9 blocks)
- [ ] **2.48** Mass, Spring, Damper, RigidBody components: define with properties → connect → automatic equation assembly for multi-body systems
- [ ] **2.49** Joint types: revolute (1 DOF rotation), prismatic (1 DOF translation), spherical (3 DOF), universal (2 DOF), fixed (0 DOF) — for mechanism modeling
- [ ] **2.50** ContactModel: penalty-based contact with Coulomb friction (μ_s, μ_k) and optional Stribeck curve — essential for impact and mechanism simulation
- [ ] **2.51** KinematicChain: forward kinematics (DH parameters → end-effector pose), inverse kinematics (numerical, Jacobian-based) for serial mechanisms/robot arms

#### Electrical (existing + new)

- [x] **2.52** Basic: Ohm's V=IR, power P=VI/I²R/V²R, capacitance C=Q/V, series/parallel resistance (7 blocks)
- [x] **2.53** Extended: RC/RL time constant, RLC resonant frequency/Q factor, voltage/current divider, capacitive/inductive reactance, RC filter cutoff, transformer voltage, three-phase power, Shockley diode (12 blocks)
- [ ] **2.54** Active components: Diode (exponential I-V), MOSFET (square-law model), IGBT (on/off with voltage drop) — for power electronics simulation
- [ ] **2.55** OpAmp (ideal + finite gain), PWMGenerator (duty cycle, frequency), HBridge (4-switch), ThreePhaseInverter (6-switch SPWM) — for motor drive design
- [ ] **2.56** DCMotor (back-EMF, armature resistance, inductance, torque constant), PMSMMotor (dq-frame Park transform, flux linkage, torque equation) — for electromechanical co-simulation
- [ ] **2.57** Battery: equivalent circuit model (Thevenin: OCV + R_series + R_parallel||C) with SOC lookup table, thermal coupling (resistive heating), aging model (capacity fade)

#### Thermal (existing + new)

- [x] **2.58** Brake thermal: dT/dt = (P_brake - h×A×(T-T_amb)) / (m×c), brake energy E=½m(v1²-v2²), brake power P=E/Δt (3 blocks, 4 tests)
- [ ] **2.59** ThermalConductor (k×A/L), ThermalCapacitor (m×c), Convection (h×A), Radiation (ε×σ×A×(T⁴-T_amb⁴)) — lumped-parameter thermal network components
- [ ] **2.60** HeatExchanger: ε-NTU method (effectiveness from NTU and Cr) AND LMTD method (log-mean temperature difference) — for heat exchanger sizing and rating

#### Fluid (new)

- [ ] **2.61** Pipe (pressure drop from Darcy-Weisbach + minor losses), Valve (Cv characteristic), Pump (H-Q curve interpolation), Accumulator (gas spring), Orifice (sharp-edged flow coefficient)
- [ ] **2.62** HydraulicCylinder (pressure → force, flow → velocity), HydraulicMotor (pressure → torque) — for hydraulic system simulation
- [ ] **2.63** FluidProperties: density ρ(T,P), viscosity μ(T), bulk modulus β(T,P) as polynomial fits or lookup tables — for accurate hydraulic simulation

#### Signal/Control (existing + new)

- [x] **2.64** Control: step response (1st/2nd order), PID output, RMS, peak-to-peak, settling time, overshoot, natural frequency, damping ratio, Bode magnitude 1st order (10 blocks)
- [ ] **2.65** TransferFunction: define G(s) = num(s)/den(s) as coefficient arrays; evaluate step/impulse response, frequency response (Bode plot data output)
- [ ] **2.66** StateSpace: define dx/dt=Ax+Bu, y=Cx+Du; simulate with ODE solver, compute eigenvalues for stability, controllability/observability matrices
- [ ] **2.67** Saturation (clamp output), DeadZone (zero within ±band), RateLimiter (max dy/dt), Delay (pure time delay via buffer) — essential nonlinear control elements
- [ ] **2.68** MUX (combine N scalars → vector), DEMUX (split vector → N scalars), Switch (select input based on condition) — signal routing
- [ ] **2.69** Scope: real-time signal visualisation during simulation — 30fps update, configurable buffer depth (last N points or all), vertical trigger line at current time
- [ ] **2.70** ZeroOrderHold (sample continuous → discrete), RateTransition (change sample rate) — for mixed continuous/discrete simulation
- [ ] **2.71** StateflowBlock: visual finite state machine editor — define states, transitions with guard conditions, entry/during/exit actions — for mode-switching logic (gear shift, flight modes, battery management)

### 2E — Vehicle Dynamics Domain

*Built-in domain reduces dependence on Adams ($50K+/seat). Enables K&C, full-vehicle events, tire modeling.*

- [x] **2.72** Pacejka Magic Formula tire: Y(x) = D×sin(C×atan(B×x - E×(B×x - atan(B×x)))) — lateral_force, longitudinal_force, combined_slip, force_sweep (plot data), 4 presets (SportRadial μ≈1.0, EconomyRadial μ≈0.8, Slick μ≈1.5, WetWeather μ≈0.7). 6 tests: zero-slip, monotonicity, Fz proportionality, antisymmetry, sweep, preset ordering. Ref: Pacejka "Tire and Vehicle Dynamics" 3rd ed (2012).
- [x] **2.73** Quarter-car suspension: 2-DOF (sprung + unsprung mass) via RK45 ODE solver — m_s×x_s'' = -k_s×(x_s-x_u) - c_s×(x_s'-x_u'), m_u×x_u'' = k_s×(x_s-x_u) + c_s×(x_s'-x_u') - k_t×(x_u-x_r). DEFAULT_PASSENGER preset (250kg/35kg/16kN/m/1kNs/m/160kN/m). 2 tests: settling, oscillation. Ref: Dixon "Suspension Geometry" (2009).
- [x] **2.74** Aero: drag F=0.5ρCdAv², downforce F=0.5ρClAv², side force, aero balance (front%), CdA. 4 presets: Sedan(Cd=0.30), SportsCar(0.32), F1Car(Cd=0.70,Cl=3.50), Truck(0.60). 5 tests. Balance returns 50% for equal split.
- [x] **2.75** Powertrain: torque_from_map (linear interpolation on RPM-torque table), gear_ratio (T_out=T_in×ratio, RPM_out=RPM_in/ratio), drivetrain_loss (P_out=P_in×η), wheel_speed (v=RPM×2π×r/(60×ratio)). 4 tests.
- [x] **2.76** Lap simulation: point-mass quasi-steady-state — 1) corner speed v_max=√(μgR), 2) forward pass: traction-limited acceleration F_drive=min(P/v, μmg) - F_drag, 3) backward pass: braking deceleration a=μg, 4) combine minimum speeds, 5) integrate dt=ds/v. LapVehicle struct. 2 tests: oval track, empty. Ref: Milliken & Milliken (1995).
- [x] **2.77** Brake thermal: dT/dt = (P_brake - h×A×(T-T_amb)) / (m×c), brake_energy = 0.5×m×(v1²-v2²), brake_power = E/Δt. 4 tests: energy, power, heating, cooling.
- [ ] **2.78** Half-car (4-DOF: front/rear sprung + unsprung) and full-vehicle (7-DOF: body heave/pitch/roll + 4 wheel DOFs) suspension models — configurable spring/damper curves, anti-roll bar
- [ ] **2.79** K&C analysis mode: virtual K&C rig — bump (bounce), roll, lateral compliance, longitudinal compliance, steering. Output: bump steer gradient (deg/mm), bump camber gradient, lateral stiffness (N/mm), roll centre height (mm), anti-dive/anti-squat percentages. This is the key differentiator vs Adams for vehicle dynamics engineers.
- [ ] **2.80** Standard .tir file import/export: parse Pacejka MF 6.2 parameter files used across the automotive industry (Adams, CarSim, IPG)
- [ ] **2.81** Vehicle event blocks: step steer (ramp input), sinusoidal steer (frequency sweep), lane change (ISO 3888 double lane change profile), braking in turn, constant radius — each generates the steering/throttle/brake time-series input for full-vehicle simulation
- [ ] **2.82** Full-vehicle model template: pre-wired graph with chassis (mass, inertia, CG), 4 suspension corners (parameterised), steering (ratio, compliance), powertrain (engine map + gearbox), brake system (proportioning valve + disc thermal), tire models — user fills in parameters or loads from .tir/.csv

### 2F — ML/AI Blocks

*Training small models (<10M params) in-browser via Rust engine on WebGPU. Larger models dispatched to server GPU workers.*

- [x] **2.83** NN trainer: wired to real backpropagation — parse layers from data.layers JSON array, build Sequential model, call nn::train::train(), return loss Table (epoch, loss). Supports Dense layers with configurable units and activation.
- [x] **2.84** LR schedules: Constant, StepDecay(factor, step_size), CosineAnnealing(t_max), ExponentialDecay(gamma). get_lr(base_lr, epoch). 5 tests including from_str() parsing.
- [x] **2.85** Early stopping config: TrainConfig has patience (epochs without improvement) and validation_split (fraction held out). TrainResult has val_loss_history, best_val_loss, early_stopped. Full validation loop deferred to simulation worker.
- [x] **2.86** Epochs > 0 enforcement: training always has defined end. If epochs=0, returns error "epochs must be > 0". Default 100 epochs.
- [x] **2.87** Dense, Conv1D, Dropout, Activation layers in nn module. Activation: ReLU, Sigmoid, Tanh, Softmax, Linear. Weight init: Xavier, He (configurable seed).
- [x] **2.88** ML algorithms: linear regression (OLS normal equation), polynomial regression, KNN classifier, decision tree (Gini/entropy split), predict, MSE, R², confusion matrix
- [x] **2.89** ML preprocessing: standardize (z-score per column), normalize (min-max to [0,1]), train_test_split (deterministic by ratio). 3 tests.
- [x] **2.90** Classification metrics: precision/recall/F1 (binary), ROC curve (sweep threshold → FPR/TPR pairs), AUC (trapezoidal rule). 4 tests.
- [x] **2.91** Feature scale block wired in ops.rs: ml.featureScale accepts Table, mode=standardize/normalize
- [ ] **2.92** LSTM layer: Long Short-Term Memory with forget/input/output gates — for time-series prediction and sequence modeling
- [ ] **2.93** GRU layer: Gated Recurrent Unit (simpler than LSTM, often similar performance) — for sequence tasks
- [ ] **2.94** Attention layer: scaled dot-product attention Q×K^T/√d_k → softmax → ×V — foundation for transformer architectures
- [ ] **2.95** Conv2D layer: 2D convolution with configurable kernel size, stride, padding — for image-based tasks
- [ ] **2.96** ONNX model import: load .onnx files for inference using ONNX Runtime compiled to WASM — supports models up to ~500MB (quantized) in browser, larger via server Edge Function. Covers TensorFlow/PyTorch model deployment.
- [ ] **2.97** PINNBlock: physics-informed neural network — configure PDE residual expression + boundary conditions + collocation points. Implements adaptive sampling (residual-based), gradient balancing between loss terms (NTK-based weighting), Fourier feature embedding for spectral bias mitigation. Uses AD engine (1C).
- [ ] **2.98** NeuralOperator: FNO (Fourier Neural Operator) or DeepONet architecture — learn solution mappings across parameter spaces. Configure modes, layers, trunk/branch networks. Train on input-output function pairs. Ref: Mamba Neural Operators achieve 90% error reduction over Transformer baselines.
- [ ] **2.99** SurrogateModel: train NN or Gaussian Process surrogate from a connected simulation block — supports active learning with expected improvement sampling for efficient exploration
- [ ] **2.100** Hyperparameter optimisation: TPE (Tree-structured Parzen Estimator) / CMA-ES sampler with ASHA/Hyperband pruning — right-click any parameter → "Mark as Hyperparameter" with range/distribution. Dashboard shows trial history, parameter importance.
- [ ] **2.101** AutoML block: given DataTable + target column, auto-tries linear, tree ensemble, small NN — reports best with cross-validation scores
- [ ] **2.102** Transfer learning: load pre-trained ONNX model, freeze specified layers, add new trainable layers, fine-tune on user data
- [ ] **2.103** Experiment tracker: log metrics, parameters, model weights per training run to Supabase table — comparison view with parallel coordinates

### 2G — Optimisation Blocks

*All implemented in Rust for WASM compatibility. No Python/scipy dependency.*

- [x] **2.104** LP solver: revised simplex with Bland's anti-cycling rule. solve_lp(c, A, b) for minimize c'x s.t. Ax≤b, x≥0. LpResult: status (Optimal/Infeasible/Unbounded/MaxIter), x, objective, iterations. 2 tests. Ref: Nocedal & Wright (2006).
- [x] **2.105** QP solver: projected gradient descent for convex QP. solve_qp(H, f) for minimize 0.5×x'Hx + f'x s.t. x≥0. Armijo backtracking. 2 tests: unconstrained optimum, boundary-constrained.
- [x] **2.106** NSGA-II: non-dominated sorting + crowding distance + SBX crossover + polynomial mutation + tournament selection. ParetoResult: solutions, objectives, generations. Configurable pop_size, generations, crossover_rate, mutation_rate. 2 tests: dominance, bi-objective Pareto. Ref: Deb et al. (2002).
- [x] **2.107** Sobol sensitivity: Saltelli sampling scheme (A, B, AB_i matrices). First-order S1 and total-order ST indices. SobolResult: s1, st, names, n_evals. 2 tests: x1 dominates x2, constant function. Ref: Saltelli (2002).
- [x] **2.108** Existing optimisers: gradient descent (step + convergence), genetic algorithm (tournament + crossover + mutation), Nelder-Mead (simplex reflection/expansion/contraction), parametric sweep, Monte Carlo simulation, DOE (Sobol/LHS/factorial)
- [ ] **2.109** L-BFGS-B: limited-memory BFGS with bound constraints — the workhorse gradient-based optimiser for medium-scale problems (100-10000 variables). Uses AD for gradients.
- [ ] **2.110** SQP: Sequential Quadratic Programming with augmented Lagrangian — handles equality + inequality constraints. Solves QP subproblem at each iteration.
- [ ] **2.111** Trust-region (dogleg): globally convergent, robust for non-convex problems. Adaptively adjusts trust-region radius.
- [ ] **2.112** CMA-ES: Covariance Matrix Adaptation Evolution Strategy — gradient-free, excellent for non-convex, multimodal problems. sep-CMA-ES variant for high-dimensional (>100 vars).
- [ ] **2.113** Bayesian optimisation: GP surrogate with Matérn 5/2 kernel, acquisition functions (Expected Improvement, Upper Confidence Bound, Knowledge Gradient). Multi-objective via qNEHVI. Multi-fidelity via multi-task GP. Ref: BoTorch principles.
- [ ] **2.114** NSGA-III: reference-direction-based multi-objective (better than NSGA-II for >3 objectives). MOEA/D with Tchebycheff decomposition.
- [ ] **2.115** Enhanced DOE: Taguchi orthogonal arrays, D-optimal (coordinate exchange), Box-Behnken, Central Composite (face/inscribed/circumscribed) — add to existing factorial/LHS/Sobol
- [ ] **2.116** Response surface: fit polynomial/RBF/Kriging metamodel to DOE results — visualise as contour + 3D surface + sensitivity tornado
- [ ] **2.117** UQ: Polynomial Chaos Expansion (Legendre/Hermite bases up to degree 5 with LAR sparse selection), reliability (FORM with HLRF algorithm, importance sampling, subset simulation) — output: failure probability, reliability index β
- [ ] **2.118** Robust design: objective = weighted mean + k×std under uncertainty — Pareto optimisation of mean performance vs variance
- [ ] **2.119** Topology optimisation: SIMP method on 2D FEM mesh with density filtering and projection — output optimised material distribution as density field

### 2H — Utility Blocks

- [x] **2.120** Display output block (passthrough with value formatting)
- [x] **2.121** Publish/Subscribe: cross-sheet value transfer via named channels
- [x] **2.122** Text: num_to_text, text_concat (variadic), text_length, text_to_num
- [x] **2.123** Date/time: date_from_ymd, year/month/day extraction, days_between, add_days, is_leap_year, days_in_month
- [x] **2.124** Unit conversion: configurable from/to unit pickers with dimensional compatibility checking
- [ ] **2.125** FMU import: load FMI 2.0/3.0 FMUs — parse modelDescription.xml, create block ports from FMU variables, call FMU C API during evaluation via WASM interface. Supports model exchange and co-simulation modes.
- [ ] **2.126** FMU export: package a ChainSolve subgraph as an FMU zip — generate C code from Rust computation graph, produce modelDescription.xml, package as standard FMU. Enables HIL integration.
- [ ] **2.127** PythonScript: execute Python in sandboxed Pyodide (WASM-compiled CPython 3.11) — access NumPy, SciPy, scikit-learn, pandas. Input ports become Python variables, output is Python return value.
- [ ] **2.128** CustomRust: write custom Rust block logic — compiled server-side or to WASM. Hot-reloading for development. Block trait implementation with typed ports.
- [ ] **2.129** SubGraph: collapse group of blocks into reusable parameterised composite block (like Houdini's Digital Assets) — exposed ports become the SubGraph's ports. Saved to user's template library.
- [ ] **2.130** Assertion: runtime check — verify value is in range, correct type, correct dimensions. Pass = green indicator, Fail = red with message. For validation workflows.
- [ ] **2.131** Timer: measure wall-clock and CPU time for connected computation — identify performance bottlenecks
- [ ] **2.132** Logger: record time-series data from any port to structured log (Supabase table) — for post-processing and experiment tracking
- [ ] **2.133** MathSheet: spreadsheet-like block within the node graph — accepts input ports as named variables, cells support unit-aware formulas, outputs computed columns. The "Excel-killer" feature: lets Excel users bring their mental model into ChainSolve while gaining units, version control, reproducibility.
- [ ] **2.134** CodeBlock: write Rust/Python expressions inline with autocomplete, type inference, instant evaluation — variables from connected inputs available by name, output auto-typed. The "MATLAB-killer" feature: like MATLAB Live Editor but in a node graph.

---

## Category 3 — Node Graph & Visual Programming

*Must match Grasshopper's live preview fluidity, Houdini's organisational power, KNIME's guided workflow accessibility.*

### 3A — Graph Engine

- [x] **3.1** React Flow v12 (`@xyflow/react`) with custom node/edge renderers, 15+ node types (csSource, csOperation, csDisplay, csData, csPlot, csListTable, csGroup, csPublish, csSubscribe, csAnnotation, csMaterial, csOptimizer, csMLModel, csNeuralNet)
- [x] **3.2** Zustand stores: preferencesStore, projectStore, canvasesStore, debugConsoleStore, statusBarStore, publishedOutputsStore, variablesStore, sidebarStore, customThemesStore, customFunctionsStore, customMaterialsStore, aiConversationStore
- [x] **3.3** 60fps target: engine pauses during drag/pan via isDraggingRef + 200ms settle timer. computeGraphHealth removed from eval hot path. Unpause optimised to skip snapshot reload for position-only changes.
- [x] **3.4** Minimap with zoom sync (MinimapWrapper)
- [x] **3.5** Grid snapping toggle (snapToGrid state, 16×16 grid)
- [x] **3.6** Magnetic block-to-block snapping: useBlockSnapping hook detects horizontal chain (right→left, 12px gap), vertical stack (bottom→top), center-align H/V. 20px threshold. SnapGuides renders cyan dashed SVG lines. onNodeDrag adjusts position. Persisted to localStorage.
- [x] **3.7** Topological sort (Kahn's algorithm) for evaluation order. Cycle detection reports nodes in cycle via diagnostics.
- [x] **3.8** Lazy evaluation with dirty-set tracking: only recompute nodes whose inputs changed. Value hash pruning (ENG-05) skips downstream when output unchanged.
- [x] **3.9** Reactive EvalScheduler: structural changes fire immediately, data-only changes debounce 50ms. Manual mode accumulates until explicit flush. 15 unit tests.
- [x] **3.10** Run button (Play icon, #1CABB0 accent) always visible in CanvasToolbar. Ctrl+Enter / F5 keyboard shortcuts. Pause/Resume toggle preserved.
- [x] **3.11** Pre-run validation: validate_pre_eval() in Rust checks cycles (Kahn's), missing required inputs (catalog-aware port checking), dangling edges. Exposed via validate_graph WASM export + worker message + EngineAPI.validateGraph().

### 3B — Node Rendering Improvements

- [x] **3.12** Status bar: EngineStatus with timing ("42 blocks · 12 ms"), stale indicator ("Stale — re-run needed"), pending count, eval mode (Manual shown when set)
- [x] **3.13** Node styles: staleOverlay (opacity 0.5, grayscale 30%, dashed border), errorBadge (red dot at top-right corner) — defined in nodeStyles.ts
- [x] **3.14** Variadic blocks: detect via def.variadic, render dynamic input handles (in_0..in_N based on dynamicInputCount). "+" button to add port, "×" to remove beyond minInputs. Body height adjusts. Non-variadic blocks render static a/b ports.
- [ ] **3.15** Port type colours: float=blue, vector=green, matrix=purple, signal=orange, physical=red, string=gray, boolean=yellow, any=white — visual distinction helps users understand data flow at a glance
- [ ] **3.16** Port type compatibility: incompatible connections show red snap indicator, compatible show green — prevent wiring errors before they happen
- [ ] **3.17** Auto type coercion indicators: when scalar→vector broadcast happens, show a small "↗" icon on the port to indicate the coercion
- [ ] **3.18** Inline value display upgrades: vectors show sparkline (tiny line chart), matrices show heatmap thumbnail (colour-coded density), signals show waveform preview, booleans show LED indicator (green/red)
- [ ] **3.19** Double-click node → open full config panel as side sheet (slide from right, 400px wide) instead of requiring separate inspector — faster workflow
- [ ] **3.20** Edge labels: on hover, show data shape label ("[3×3]", "[1024]", "5.23 N") — understand data flow without clicking
- [ ] **3.21** Smart edge routing: Bezier curves with obstacle avoidance — route around other nodes instead of through them (A* pathfinding on grid)
- [ ] **3.22** Animated flow direction: subtle particle animation along edge during execution — shows data flowing through the graph
- [ ] **3.23** Edge bundling: when many edges share source/target regions, bundle them visually for cleaner appearance — unbundle on hover

### 3C — Graph Organisation

- [x] **3.24** Groups: select → G to create named group with coloured background. Collapsible. Auto-resize when members dragged.
- [x] **3.25** Annotations: text, callout, highlight, arrow, rectangle, ellipse, diamond, rounded rectangle, sticky note. Rich text with bold/italic/underline. KaTeX math rendering.
- [x] **3.26** Block library palette: left sidebar with category tabs, fuzzy search, drag to add. Pro-only gating on advanced blocks.
- [x] **3.27** Command palette: Ctrl+K opens global command search across all actions.
- [x] **3.28** Auto-layout: dagre LR/TB directions. Triggered via toolbar button or Shift+click.
- [x] **3.29** Alignment: distribute horizontally/vertically, align left/right/top/bottom/center. alignmentHelpers.ts with full implementation.
- [ ] **3.30** Domain-coloured backgrounds: auto-tint node backgrounds by physics domain — mechanical=blue, electrical=yellow, thermal=red, control=green, ML=purple, optimisation=orange — for instant visual parsing of complex multi-domain graphs
- [ ] **3.31** SubGraph collapse: right-click group → "Collapse to SubGraph" — creates a composite block with exposed input/output ports (ports are the edges that cross the group boundary). Can be saved to template library. Like Houdini's Digital Assets.

### 3D — Debugging

- [x] **3.32** Debug console: DebugConsolePanel with engine log output (eval started/complete, patch ops, errors)
- [x] **3.33** Graph health panel: LazyGraphHealthPanel computes health on-demand (orphan nodes, cycles, crossing edges)
- [x] **3.34** Problems panel: validation diagnostics display
- [ ] **3.35** Probe mode: click any edge → floating inspector shows data value, type, shape, statistics (min/max/mean/std), and inline mini-plot — like Grasshopper's data viewer
- [ ] **3.36** Breakpoints: right-click node → "Set Breakpoint" — execution pauses before evaluating that node, showing all input values in inspector. Step over to continue.
- [ ] **3.37** Step execution: step through graph one node at a time (forward/backward in topological order) — with current node highlighted and inputs/outputs displayed
- [ ] **3.38** Execution timeline: collapsible bottom panel showing Gantt-chart of block execution with durations — identifies bottleneck blocks at a glance
- [ ] **3.39** Data flow highlighting: hover over any port → all upstream (feeding) and downstream (consuming) connections highlighted in accent colour — trace data flow through complex graphs
- [ ] **3.40** Diff view: compare two execution snapshots side-by-side — value deltas highlighted (green=increased, red=decreased) — for regression analysis

### 3E — Formula Bar & CSEL Expression Language

- [x] **3.41** CSEL lexer: tokenises numbers, identifiers (with dot-namespaced ops), operators (+−×÷^), parens, comma, equals, semicolon, pipe, arrow (→). Handles scientific notation (1e-3), .5-style decimals.
- [x] **3.42** CSEL parser: recursive descent with operator precedence — grammar: program = statement (';' statement)*, statement = assignment | display | expr, expr = term (('+'/'-') term)*, term = power (('*'/'/') power)*, power = unary ('^' unary)* (right-assoc), unary = '-' unary | call, call = IDENT '(' args ')' | primary. 11 tests.
- [x] **3.43** Graph generator: AST → GeneratedNode[] + GeneratedEdge[]. Maps: +→add, −→subtract, ×→multiply, ÷→divide, ^→power, sin→sin, cos→cos, max→max (variadic with dynamicInputCount). Auto-creates Number blocks for literals, Display for trailing '='. Known constants: pi, e, tau, phi.
- [x] **3.44** FormulaBar expression mode: 'fx' toggle button switches to full-width CSEL input. Enter → parseCsel() → generateGraph() → addNodes/addEdges to canvas. Escape exits. Error messages inline.
- [x] **3.45** Variadic: max(a,b,c,d) creates single max block with dynamicInputCount=4 and in_0..in_3 ports
- [x] **3.46** Variables: x=5 creates named Number block; subsequent x references reuse same node ID
- [ ] **3.47** Syntax highlighting in expression input: colour operators (cyan), numbers (orange), functions (purple), variables (green), errors (red underline)
- [ ] **3.48** Autocomplete: as user types, suggest matching block types, function names, declared variables, and constants — dropdown with signature hints
- [ ] **3.49** Expression history: up/down arrow cycles through previously entered expressions (stored in localStorage)
- [ ] **3.50** Drag from empty port → open search palette filtered to compatible block types — fastest way to add connected blocks

---

## Category 4 — Data Handling & I/O

*Import: CSV, TSV, Excel, HDF5, Parquet, Arrow IPC, JSON, MATLAB .mat, NumPy .npy/.npz, STEP/IGES, STL, FMU, .tir, MF4, OpenDRIVE. Export: CSV, Excel, HDF5, Parquet, JSON, PDF, MATLAB .mat, FMU, ONNX, LaTeX, SVG/PNG/PDF.*

- [x] **4.1** CSV import/export (csvImport block, CSV picker, csv-worker.ts for parsing)
- [x] **4.2** Excel export (write-excel-file dependency, XLSX audit export with images)
- [x] **4.3** PDF audit report export (pdf-lib + html-to-image for canvas capture)
- [x] **4.4** SVG/PNG plot export (Vega-Lite → SVG/PNG)
- [x] **4.5** Project JSON format (.chainsolvejson schema v3) with version migration
- [ ] **4.6** Excel .xlsx read import: parse workbook sheets → DataTable values. Use a WASM-compiled xlsx parser or server-side Edge Function.
- [ ] **4.7** HDF5 import/export: hierarchical datasets for large arrays/matrices. Via `hdf5-rust` or Emscripten-compiled libhdf5.
- [ ] **4.8** Parquet import/export: columnar format for large datasets. Via `parquet` Rust crate compiled to WASM.
- [ ] **4.9** MATLAB .mat import: v5 format via `matfile` crate (pure Rust), v7.3 via HDF5 layer
- [ ] **4.10** NumPy .npy/.npz import: parse NumPy array format (simple binary header + data)
- [ ] **4.11** STEP/IGES geometry import: parse CAD boundary representations → display as 3D mesh in viewport
- [ ] **4.12** STL mesh import: parse triangulated surface mesh for FEM preprocessing
- [ ] **4.13** FMU .fmu import/export: zip containing modelDescription.xml + compiled binaries — parse and create block ports
- [ ] **4.14** .tir tire parameter file: parse Pacejka MF 6.2 format used across automotive industry
- [ ] **4.15** OpenDRIVE .xodr: parse road geometry description for driving simulation scenarios
- [ ] **4.16** ONNX export: save trained neural network as .onnx file for deployment in other tools
- [ ] **4.17** LaTeX export: render symbolic expressions as LaTeX source code for papers/reports
- [ ] **4.18** Clipboard paste: detect tabular data from Excel/Sheets clipboard → auto-create DataTable block
- [ ] **4.19** WebSocket input: live sensor data at up to 1kHz with ring buffer — for DAQ integration
- [ ] **4.20** SQL query block: connect to PostgreSQL (via Supabase), parameterised queries, output as DataTable
- [ ] **4.21** REST/GraphQL API client block: request builder with auth (API key, OAuth, Bearer), JSON parsing
- [ ] **4.22** Data versioning: SHA-256 content-hash every referenced dataset — graphs reference by hash for reproducibility

---

## Category 5 — Collaboration & Version Control

- [x] **5.1** Project save/load: Supabase Storage for canvas blobs, project metadata in PostgreSQL, per-canvas storage paths
- [x] **5.2** Multi-canvas sheets: tabs with position ordering, canvas switching, cross-sheet publish/subscribe
- [x] **5.3** Share links: read-only token-based sharing (ADV-02), SharedProjectPage viewer
- [x] **5.4** Node comments: threaded comments attached to nodes (node_comments table)
- [x] **5.5** Audit log: append-only audit_log table with user, timestamp, event_type, metadata
- [x] **5.6** Conflict detection: Compare-And-Swap on projects.updated_at, ConflictBanner UI
- [ ] **5.7** Real-time co-editing: Yjs CRDT for shared graph state (nodes, edges, params) with <100ms sync via WebSocket — each user sees coloured cursors and selection highlights. Supabase Realtime Presence for online indicators.
- [ ] **5.8** Graph versioning: every save = immutable snapshot (JSONB + Storage) — version history panel with diff view showing added/removed/modified nodes (colour-coded)
- [ ] **5.9** Branching: create named branches for experimentation — merge with conflict resolution UI (side-by-side node comparison)
- [ ] **5.10** Export as interactive standalone HTML: embed graph + results + data in single file — no server needed for review
- [ ] **5.11** Git-friendly JSON export: deterministic key ordering, one-node-per-line format with .chainsolve extension — CLI diff/merge tool

---

## Category 6 — Visualisation & Plotting

- [x] **6.1** XY Plot (line/scatter via Vega-Lite), configurable axes, legends
- [x] **6.2** Histogram, Bar Chart, Heatmap blocks via Vega-Lite
- [x] **6.3** Plot export: SVG/PNG/PDF via Vega-Lite export + html-to-image
- [x] **6.4** CSP compliance: Vega with vega-interpreter for CSP-safe rendering
- [ ] **6.5** Bode plot: magnitude (dB) + phase (deg) vs frequency (Hz/rad/s) on log scale — standard for control systems. Output from TransferFunction frequency response.
- [ ] **6.6** Nyquist plot: Re vs Im of G(jω) — for stability analysis (encirclement criterion). Root locus: poles/zeros vs gain parameter.
- [ ] **6.7** XY animation: time-varying plots with playback controls (play/pause/speed/scrub) — for visualising simulation results over time
- [ ] **6.8** Contour plot: 2D scalar field with isolines — for response surfaces and field visualisation
- [ ] **6.9** 3D surface plot: via Three.js or React Three Fiber — interactive rotation, zoom, colourmap, wireframe toggle
- [ ] **6.10** Parallel coordinates: N vertical axes, each data point as a polyline — for multi-dimensional design space exploration
- [ ] **6.11** Pareto front plot: 2D/3D with dominated region shading — for multi-objective optimisation results
- [ ] **6.12** Sankey diagram: flow quantities between nodes — for energy/mass balance visualisation
- [ ] **6.13** Box-and-whisker, violin plots: statistical distribution visualisation
- [ ] **6.14** Scope block: 30fps live update during simulation, configurable buffer, vertical trigger line at current time — like Simulink's Scope
- [ ] **6.15** Multi-axis: secondary Y-axis, stacked panels with shared X-axis (like Simulink Data Inspector)
- [ ] **6.16** 3D viewport: Three.js orbit camera, mesh visualisation (wireframe/solid/transparent), section planes, vehicle animation, mechanism motion — for geometry and dynamics visualisation
- [ ] **6.17** Plot annotations: interactive arrows, text labels, reference lines (horizontal/vertical), shaded regions — all draggable

---

## Category 7 — Performance & Scalability

- [x] **7.1** 60fps canvas: drag pauses engine, unpause after 200ms settle
- [x] **7.2** Reactive eval: only recompute dirty nodes
- [x] **7.3** Value hash pruning (ENG-05): skip downstream when output unchanged
- [x] **7.4** Binary encoding (ENG-03): Float64Array Transferable zero-copy
- [x] **7.5** Worker pool (ENG-04): 1-4 workers, LRU eviction, engine switch
- [x] **7.6** Bundle budgets: 1000KB WASM raw, 350KB gzip; 400KB JS gzip
- [ ] **7.7** Benchmark: 500 nodes at 60fps pan/zoom (must pass, currently untested at this scale)
- [ ] **7.8** Benchmark: 1000×1000 GEMM <10ms via WebGPU (requires Category 1D)
- [ ] **7.9** Benchmark: 100-state ODE, 1s sim, RK45 <500ms in browser
- [ ] **7.10** Streaming evaluation: for large parameter sweeps, evaluate and stream results without holding all in memory. Configurable cache 1GB browser / 16GB server.
- [ ] **7.11** LRU cache with configurable size: evict least-recently-used cached block results when memory pressure detected
- [ ] **7.12** Hybrid compute: dispatch heavy jobs to Supabase Edge Function calling native Rust binary — graphs >1000 blocks or matrices >10000×10000
- [ ] **7.13** Cold start <3s on 4G: code splitting (React.lazy), lazy block pack loading, WASM streaming compilation
- [ ] **7.14** Offline support: Service Worker caches WASM + app shell, IndexedDB stores graphs locally, sync to Supabase when online

---

## Category 8 — Simulation Infrastructure

*Dedicated worker for long-running tasks. All have defined endpoints. Optional looping for periodic simulations.*

- [ ] **8.1** Dedicated simulation worker: separate Web Worker from eval worker, loads same WASM. SimulationWorkerAPI class.
- [ ] **8.2** run_simulation WASM export with progress_cb: config = {op, inputs, maxIterations, endTime?, convergenceThreshold?, batchSize?, loop?, loopCount?}
- [ ] **8.3** All tasks finite: maxIterations, targetLoss, endTime, convergenceThreshold — no indefinite execution
- [ ] **8.4** Looping: when loop=true + loopCount=N, restart from initial conditions after each cycle. Results append to output table. E.g., pendulum over 10 periods → angle vs time with 10 periods of data for plotting.
- [ ] **8.5** Progress streaming: {type: 'simulationProgress', iteration, totalIterations, cycle, totalCycles, partialResults, metrics}
- [ ] **8.6** Cancellation: Stop button sends Abort signal. Clean stop after current cycle (no mid-cycle abort unless force-cancelled).
- [ ] **8.7** Connected Plot blocks update live during looping: each cycle appends data points, graph extends in real-time
- [ ] **8.8** SimulationStatusStore: tracks {nodeId, status, iteration, totalIterations, cycle, totalCycles, metrics}. StatusBar shows "Simulating (cycle 3/10)" or "Training (epoch 47/100)".
- [ ] **8.9** Normal graph eval continues while simulation runs on separate worker — two workers must be independent

---

## Category 9 — UI/UX & Onboarding

*Clean modern aesthetic (Figma/Linear-inspired). Dark mode default. Keyboard-first. Progressive disclosure.*

- [x] **9.1** Auth: Supabase email+password, Turnstile CAPTCHA, MFA support, SSO (Google, GitHub, Microsoft)
- [x] **9.2** Onboarding: spotlight tour (data-tour attributes) — steps from open_projects → create_project → add_input → add_function → add_output → connect_chains → inspector → save → reporting
- [x] **9.3** First-run: modal with "start from scratch", templates, explore marketplace, import project
- [x] **9.4** Block library: left sidebar with category tabs, fuzzy search, drag-to-add, pro-only gating
- [x] **9.5** Keyboard shortcuts: Ctrl+Z/Y undo/redo, Delete, Ctrl+G group, Ctrl+D duplicate, Ctrl+C/V/X copy/paste/cut, F2 rename, Space+drag pan, Tab search palette
- [x] **9.6** Dark mode default with light mode toggle + custom themes
- [x] **9.7** Settings: decimal places, sig figs, scientific notation threshold, angle unit (deg/rad), autosave interval, keybinding customisation
- [x] **9.8** i18n: 7 locales (en, de, es, fr, he, it, ja) with 2191+ keys
- [x] **9.9** Explore/marketplace: template gallery, search, categories, likes, downloads
- [ ] **9.10** Interactive 5-minute tutorial: build spring-mass-damper from scratch — demonstrates input→compute→visualise workflow. Opens as a ChainSolve graph with step-by-step annotations.
- [ ] **9.11** Template gallery on home: "Vehicle Suspension K&C", "PID Controller Tuning", "Curve Fitting", "Neural Network Training", "Structural Optimisation", "Battery Thermal Model" — each fully functional with inline comments
- [ ] **9.12** AI assistant (opt-in): natural language → suggested graph via LLM API. User reviews and approves before insertion. Like Mathematica's Notebook Assistant.
- [ ] **9.13** Progressive disclosure: simple blocks show minimal config by default. "Advanced" toggle reveals all parameters.
- [ ] **9.14** MathSheet block: spreadsheet within node graph. Input ports → named variables. Cells support unit-aware formulas. Outputs computed columns. The Excel-killer feature.
- [ ] **9.15** CodeBlock: inline Rust/Python with autocomplete, type inference, instant eval. Connected input variables available by name. Output auto-typed. The MATLAB-killer feature.
- [ ] **9.16** Contextual help: hover over block in search palette → 3-sentence description + animated GIF preview

---

## Category 10 — Extensibility & API

- [ ] **10.1** Block SDK: Rust crate `chainsolve-block-sdk` with Block trait — metadata(), validate(), evaluate(). Blocks compiled to WASM for browser execution.
- [ ] **10.2** Plugin system: publish custom blocks as WASM modules to ChainSolve Block Registry. Dynamic loading at runtime. WASM memory isolation for sandboxing.
- [ ] **10.3** REST API: POST /api/graph/execute (returns job ID), GET /api/graph/{id}/results, POST /api/graph/export/fmu, POST /api/graph/export/pdf
- [ ] **10.4** WebSocket: /api/graph/{id}/stream for execution progress and intermediate results
- [ ] **10.5** CLI: `chainsolve-cli` Rust binary — headless graph execution, CI/CD, batch sweeps. Reads .chainsolve JSON, outputs CSV/HDF5/JSON.
- [ ] **10.6** Python bindings: `pip install chainsolve` via PyO3. `chainsolve.Graph.load("model.chainsolve").execute(params={...})` from Jupyter.
- [ ] **10.7** JS/TS SDK: `npm install @chainsolve/sdk` — programmatic graph construction and execution.
- [ ] **10.8** Webhooks: trigger external URLs on execution completion (CI/CD, notifications, pipelines)

---

## Category 11 — Testing & Validation

- [x] **11.1** Golden fixtures: 20 JSON fixtures pinning exact outputs (GOLDEN_UPDATE=1 to regenerate)
- [x] **11.2** Property tests: proptest-based — determinism, incremental consistency, no-panic on random ops
- [x] **11.3** Perf smoke: 500ms budget, catches catastrophic regressions
- [x] **11.4** Benchmarks: Criterion for engine_benchmarks
- [x] **11.5** Vitest: 5170+ unit tests across 129 test files
- [x] **11.6** Playwright: 21 E2E spec files (smoke, canvas, auth, billing, marketplace, etc.)
- [x] **11.7** Catalog sync: regex-based Rust↔TS alignment tests
- [ ] **11.8** DETEST ODE benchmarks: A1-A5 (non-stiff), B1-B5 (mildly stiff), C1-C5 (stiff), D1-D5 (DAE), E1-E5 (second-order) — compare against published reference solutions
- [ ] **11.9** Optimisation benchmarks: Rosenbrock, Rastrigin, Ackley, ZDT1-6 (multi-objective) — verify convergence and Pareto front quality
- [ ] **11.10** FEA benchmarks: NAFEMS LE1, LE10, LE11 — standard finite element verification problems
- [ ] **11.11** FMU compliance: exported FMUs pass FMI Cross-Check validation suite
- [ ] **11.12** Round-trip: save → close → reopen → execute = bit-identical results
- [ ] **11.13** Solver verification reports: auto-generated PDF documenting algorithm, convergence, error estimates, reference comparison — for regulatory submission
- [ ] **11.14** TestBlock/TestSuite: user-defined assertions in graphs. TestBlock compares computed vs expected within tolerance. TestSuite aggregates pass/fail.

---

## Category 12 — Documentation

- [x] **12.1** CLAUDE.md: comprehensive AI-agent guidance — reactive eval, CSEL, variadic, all modules documented
- [x] **12.2** ARCHITECTURE.md: directory map, data model, engine design, milestones
- [x] **12.3** README.md: overview, capabilities, quick start, testing
- [x] **12.4** Block descriptions: blockDescriptions.ts for all 361+ blocks
- [x] **12.5** 13 Architecture Decision Records (ADRs)
- [ ] **12.6** CSEL grammar doc: docs/CSEL.md with full grammar, examples, operator precedence table
- [ ] **12.7** 20+ guided tutorials as ChainSolve graphs: mechanical dynamics, control design, data fitting, ML training, optimisation, vehicle K&C, FMU co-simulation
- [ ] **12.8** 100+ example graphs by domain: mechanical, electrical, thermal, fluid, control, ML, optimisation, vehicle — one-click open and run
- [ ] **12.9** Mathematical reference: embedded docs for every algorithm — ODE solvers (stability regions, convergence orders), optimisation (convergence proofs), AD (complexity analysis)
- [ ] **12.10** API docs: auto-generated from Rust doc comments at docs.chainsolve.dev. Python/JS SDK guides.
- [ ] **12.11** Video walkthroughs: 5-minute per feature area, embedded in in-app help
- [ ] **12.12** Community forum: Discourse integrated with Supabase Auth — share graphs as "Demonstrations"
- [ ] **12.13** Changelog: every release with migration notes, breaking changes highlighted

---

## Category 13 — Deployment & Licensing

- [x] **13.1** Browser-first: app.chainsolve.co.uk on Cloudflare Pages
- [x] **13.2** Cloudflare Pages: static + Pages Functions, _headers with COOP/COEP/CSP
- [x] **13.3** Stripe billing: Pro ($29/mo), Enterprise (custom), with webhooks + checkout + portal
- [x] **13.4** Supabase Auth: email, Google, GitHub, Microsoft. RLS on all tables. Developer/admin/student roles.
- [ ] **13.5** Tauri desktop app: Rust+WebView wrapper for offline use, native file system access, optional local CUDA. Auto-updates.
- [ ] **13.6** Docker Compose self-hosted: Supabase self-hosted + ChainSolve server + reverse proxy — for enterprise on-prem
- [ ] **13.7** Kubernetes Helm chart: for large-scale deployment with GPU node pools
- [ ] **13.8** Free tier: full engine in browser, 3 projects, 500MB storage, community support — genuinely useful, not a crippled demo (lesson from KNIME's free desktop)
- [ ] **13.9** Academic tier: Pro-equivalent for verified students/faculty (up to 100 seats per campus) — collapses MATLAB's $50K–200K campus license model

---

## Category 14 — Acausal Physical Modeling

*The "Simulink-killer" — acausal modeling (like Simscape/Modelica) with signal-flow control in a single graph.*

- [ ] **14.1** Port-based connections: through variables (force, current, heat flow) and across variables (velocity, voltage, temperature) between physics blocks — engine automatically generates DAE system
- [ ] **14.2** Modified nodal analysis: for electrical networks, generate KCL/KVL equations from topology. Analogous formulations for mechanical (d'Alembert), hydraulic (continuity), thermal (energy balance).
- [ ] **14.3** Multi-domain coupling: electrical motor has mechanical shaft port + electrical terminal port + thermal loss port — seamless cross-domain simulation
- [ ] **14.4** Equation-based block authoring: Modelica-like syntax — declare variables with units, write equations (potentially implicit/acausal), declare ports. Engine applies symbolic processing.
- [ ] **14.5** Symbolic index reduction: Pantelides algorithm to detect and reduce high-index DAEs — display structural analysis to user showing which equations/variables are problematic
- [ ] **14.6** FMI 2.0/3.0: import FMUs as blocks (170+ tools support FMI), export subgraphs as FMUs — enables integration with existing automotive/aerospace toolchains on day one

---

## Category 15 — Housekeeping & Code Quality

- [x] **15.1** TypeScript strict: noUnusedLocals, noUnusedParameters, verbatimModuleSyntax, erasableSyntaxOnly
- [x] **15.2** ESLint: zero violations (adapter-boundary rule, React hooks rules)
- [x] **15.3** Prettier: singleQuote, no semi, tabWidth 2
- [x] **15.4** Dependencies: @types/dagre + @types/katex moved to devDependencies
- [x] **15.5** npm audit: 0 vulnerabilities
- [x] **15.6** i18n: check-i18n-keys.mjs passes (2191 keys, all t() calls resolve)
- [x] **15.7** verify:fast: passes (5170+ tests)
- [x] **15.8** CLAUDE.md: updated with reactive eval, CSEL, variadic blocks, all new Rust modules, updated bundle budgets
- [ ] **15.9** TODO/FIXME/HACK scan: resolve all or convert to tracked GitHub issues
- [ ] **15.10** cargo audit: install cargo-audit, run on all crates, fix any advisories
- [ ] **15.11** Migration audit: verify all 15 migrations idempotent, consider squashing to single baseline (pre-release)
- [ ] **15.12** RLS policy audit: verify every table has appropriate policies (cross-reference with 0013 migration)
- [ ] **15.13** New ADRs: reactive eval model, CSEL grammar, magnetic snapping, simulation worker, faer integration, WebGPU strategy
- [ ] **15.14** i18n: add translated labels for all new blocks (ODE, vehicle, ML classification, etc.) across all 7 locales

---

## Summary

| Category | Done | Total |
| -------- | ---- | ----- |
| 1 — Core Engine | 10 | 53 |
| 2 — Block Library | 46 | 134 |
| 3 — Node Graph | 22 | 50 |
| 4 — Data I/O | 5 | 22 |
| 5 — Collaboration | 6 | 11 |
| 6 — Visualisation | 4 | 17 |
| 7 — Performance | 6 | 14 |
| 8 — Simulation | 0 | 9 |
| 9 — UI/UX | 9 | 16 |
| 10 — Extensibility | 0 | 8 |
| 11 — Testing | 7 | 14 |
| 12 — Documentation | 5 | 13 |
| 13 — Deployment | 4 | 9 |
| 14 — Acausal | 0 | 6 |
| 15 — Housekeeping | 8 | 14 |
| **Total** | **~132** | **~390** |

---

*This checklist is the single source of truth for ChainSolve development. Organised by the 16 requirement categories from the definitive specification. Every item includes enough context for an AI agent to implement it without needing to ask for clarification. The browser is the platform. Rust is the engine. React is the interface.*
