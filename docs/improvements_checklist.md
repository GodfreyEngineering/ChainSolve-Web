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

- [x] **1.21** Symbolic expression AST in Rust: `SymExpr` enum with variants for Variable, Constant, BinaryOp, UnaryOp, Function, Power, Sum, Product — stored as a DAG for common subexpression sharing
- [x] **1.22** Polynomial arithmetic: add, multiply, GCD (Euclidean algorithm), factoring (Berlekamp/Zassenhaus), resultants — foundation for equation solving
- [x] **1.23** Rational function simplification: cancel common factors, partial fraction decomposition
- [x] **1.24** Symbolic differentiation: chain rule, product rule, quotient rule, trig derivatives, exponential/log derivatives — output simplified via simplification rules
- [x] **1.25** Symbolic integration: table lookup for standard forms + Risch algorithm for elementary functions (algebraic, exponential, logarithmic) — returns "no elementary antiderivative" when none exists
- [x] **1.26** Polynomial system solving via Gröbner bases (Buchberger's algorithm with F4/F5 improvements) — solves systems of polynomial equations symbolically
- [x] **1.27** LaTeX rendering of symbolic expressions via KaTeX (already in deps) — render in block output previews, formula bar, and export
- [x] **1.28** Units tracking system: SI (base + derived), CGS, imperial unit systems with automatic dimensional analysis at graph-validation time (before execution) — inspired by MathCAD's approach. Check dimensional consistency, report unit mismatch errors with suggested fixes, auto-convert compatible units at block boundaries (mm→m)
- [x] **1.29** Symbolic-to-numeric compilation: JIT-compile symbolic expressions to optimised Rust closures for evaluation in loops — avoids re-parsing expressions on every ODE step

### 1C — Automatic Differentiation Engine

*Essential for gradient-based optimisation, neural network training, sensitivity analysis, and physics-informed learning. JAX-style composable transformations.*

- [x] **1.30** Forward-mode AD via dual numbers: `DualNumber { value: f64, derivative: f64 }` — efficient when number of inputs << number of outputs (e.g., sensitivity of 1000 outputs to 3 inputs)
- [x] **1.31** Reverse-mode AD via tape-based recording: build computation graph during forward pass, then traverse backward to compute gradients — efficient for scalar loss functions (neural network training)
- [x] **1.32** Mixed-mode AD: automatically select forward vs reverse based on input/output dimension ratio. If dim(input) < dim(output), use forward; otherwise reverse. Threshold configurable.
- [x] **1.33** AD through ODE solvers: discrete adjoint method with checkpointing — compute gradients of ODE solution w.r.t. parameters without storing full trajectory. Essential for parameter estimation and PINNs.
- [x] **1.34** AD through linear solvers: implicit differentiation via implicit function theorem — if Ax=b and A,b depend on parameters, compute dx/dp without differentiating the solver internals
- [x] **1.35** Custom VJP/JVP rules: allow block authors to define efficient gradient rules for their blocks (like JAX's `custom_vjp`) instead of relying on automatic tracing
- [x] **1.36** Gradient checkpointing with binomial (Revolve) schedule: trade computation for memory in reverse-mode — essential for long ODE integrations and deep networks
- [x] **1.37** Higher-order derivatives: Hessians via forward-over-reverse composition (one forward pass per Hessian column), Hessian-vector products (single reverse pass) — needed for Newton's method and UQ

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
- [x] **1.50** WASM SIMD (128-bit fixed-width, cross-browser since 2024): vectorise inner loops for f64 operations (2x throughput for element-wise ops). Enable via `-C target-feature=+simd128` in Cargo.
- [ ] **1.51** Multi-threaded WASM via `wasm-bindgen-rayon`: spawn thread pool inside WASM module for parallel evaluation of independent DAG branches. Requires SharedArrayBuffer (already enabled via COOP+COEP).
- [ ] **1.52** Memory64 proposal support: when available, enables >4GB WASM address space for very large datasets/meshes. Feature-detect and enable at runtime.
- [x] **1.53** Streaming WASM compilation: use `WebAssembly.compileStreaming()` for <2s startup. Currently loads full module before init. Target: interactive within 2s on 4G connection.

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
- [x] **2.7** MatrixInput: 2D array with spreadsheet-like editor (row/col headers, cell editing), CSV/Excel import, copy-paste from Excel/Sheets
- [x] **2.8** BooleanInput: toggle switch block outputting 0.0/1.0, for if-then-else logic and conditional computation
- [x] **2.9** FileInput: drag-and-drop block accepting CSV, Excel (.xlsx), HDF5, Parquet, JSON, MATLAB .mat (v5 via matfile crate, v7.3 via HDF5), NumPy .npy/.npz, image formats — parses file and outputs DataTable/Matrix/Vector
- [x] **2.10** ParameterSweep: defines a parameter range (start, stop, step OR explicit list) for DOE/optimisation — connects to DOE blocks, output is a vector of values
- [x] **2.11** TimeSeriesInput: time-stamped data with configurable resampling (linear, ZOH, cubic) and time format parsing
- [x] **2.12** ExpressionInput: free-form mathematical expression parsed to symbolic representation with live LaTeX preview — uses the symbolic CAS (Category 1B). Output is SymbolicExpr value type.
- [x] **2.13** UnitInput: physical quantity with unit picker dropdown (search across 500+ units: SI base/derived, CGS, imperial, engineering) — output carries unit metadata for dimensional checking

### 2B — Math & Linear Algebra Blocks

- [x] **2.14** Arithmetic: add, subtract, multiply, divide, power, mod, negate, abs, sqrt, floor, ceil, round, trunc, sign, ln, log10, exp, log_base, roundN — all with variadic N-input support for add/multiply/max/min (2–64 inputs via `nary_broadcast`, backward-compatible with a/b ports)
- [x] **2.15** Trig: sin, cos, tan, asin, acos, atan, atan2, degToRad, radToDeg — with angle unit preference (deg/rad) affecting trig block badge display
- [x] **2.16** Logic: greater, less, equal, ifthenelse, max, min (variadic) — for conditional computation and comparisons
- [x] **2.17** Matrix ops: matrix_multiply, matrix_transpose, matrix_inverse, matrix_det, matrix_trace, matrix_solve (Ax=b), matrix_from_table, matrix_to_table
- [x] **2.18** Descriptive stats: mean, median, mode, stddev, variance, range, zscore, geometric mean (all via compensated Neumaier summation). Relationships: covariance, correlation, linear regression (slope, intercept)
- [x] **2.19** Probability distributions: normal PDF/CDF/InvCDF, t PDF/CDF, chi² PDF/CDF, F PDF/CDF, binomial PMF/CDF, Poisson PMF/CDF, exponential PDF/CDF, beta PDF/CDF, gamma PDF, Weibull PDF
- [x] **2.20** Combinatorics: factorial, permutation, combination
- [x] **2.21** Lookup table: 1D interpolation (linear on x/y vectors), 2D interpolation (bilinear on x/y/z table)
- [x] **2.22** Decomposition blocks exposing faer: `LU_Decompose` (returns L,U,P matrices), `QR_Decompose` (returns Q,R), `SVD` (returns U,S,V), `Cholesky` (returns L), `Eigen` (returns eigenvalues vector + eigenvectors matrix), `Schur` (returns T,Q) — each as a multi-output block
- [x] **2.23** Symbolic math blocks: `Differentiate` (symbolic d/dx), `Integrate` (symbolic ∫dx), `Simplify`, `Expand`, `Substitute` (replace variable with value/expression) — use CAS from 1B, display LaTeX
- [x] **2.24** Numerical integration blocks: `Integrate1D` (adaptive Gauss-Kronrod), `IntegrateMC` (Monte Carlo for high-dim) — input is expression or connected function subgraph
- [x] **2.25** CurveFit: least-squares fitting to user-defined model (Levenberg-Marquardt algorithm), polynomial fit (degree N), spline smoothing — returns fitted parameters + R² + residuals
- [x] **2.26** Filter design: `DesignFilter` (Butterworth/Chebyshev I/II/elliptic, specify order + cutoff), `ApplyFilter` (FIR/IIR), `ZeroPhaseFilter` — for signal processing workflows
- [x] **2.27** Norm blocks: L1, L2, Linf, Frobenius norms — for vectors and matrices
- [x] **2.28** RandomSample: uniform, normal, log-normal, Latin Hypercube, Sobol sequence, Halton sequence — with seed control for reproducibility

### 2C — ODE/DAE/PDE Solver Blocks

*Modeled after Julia's DifferentialEquations.jl API — the gold standard for ODE solver interfaces.*

- [x] **2.29** ODE RK4: classic fixed-step 4th-order Runge-Kutta — expression-based RHS via expr.rs, parameter support, adaptive final step. 4 tests: exponential growth (rel error <1e-8), harmonic oscillator (energy conservation <1e-6), parametric (k=2), structure validation.
- [x] **2.30** ODE RK45 Dormand-Prince: embedded 4(5) pair with automatic step control — h_new = h × clamp(0.9×(tol/err)^0.2, 0.2, 5.0). Step rejection when error exceeds tolerance. 2 tests: adaptive uses fewer steps than RK4, harmonic oscillator full-period return. Ref: Dormand & Prince 1980, equivalent to MATLAB ode45.
- [x] **2.31** ODE implicit BDF: Backward Differentiation Formulas orders 1-5 with Newton iteration — essential for stiff systems (chemical kinetics, some thermal problems). Order and step size adaptation. Ref: Hairer & Wanner "Solving ODEs II".
- [x] **2.32** ODE Radau IIA: implicit Runge-Kutta of order 5 — L-stable, excellent for very stiff problems with discontinuities. Ref: Hairer & Wanner.
- [x] **2.33** ODE symplectic: Störmer-Verlet (2nd order) and symplectic Euler (1st order) — preserve energy for Hamiltonian systems (planetary orbits, molecular dynamics). Essential that total energy drift is O(h²) over long integrations.
- [x] **2.34** ODE event detection: zero-crossing detection with bisection refinement — essential for impact problems, switch events, termination conditions (e.g., "stop when ball hits ground")
- [x] **2.35** DAE solver: index-1 DAE via BDF with consistent initialisation (Brown's method) — for systems with algebraic constraints (e.g., constrained mechanical systems, electrical circuits)
- [x] **2.36** DAE index reduction: Pantelides algorithm to detect high-index DAEs, automatically differentiate constraint equations to reduce to index-1 form, display structural analysis to user
- [x] **2.37** PDE solver (1D): method-of-lines with automatic spatial discretisation (finite differences, configurable order) — convert PDE to system of ODEs and solve with existing ODE solvers. Support: heat equation, wave equation, advection-diffusion.
- [x] **2.38** PDE solver (2D FEM): triangle mesh generation (Delaunay), FEM assembly (P1/P2 elements), boundary condition specification (Dirichlet, Neumann, Robin), material property fields — for Poisson, elasticity, Stokes flow
- [x] **2.39** SteadyState solver: Newton iteration to find equilibrium of dynamic system — given dy/dt = f(y), find y* where f(y*)=0. Uses Jacobian from AD engine (Category 1C).
- [x] **2.40** ParameterEstimation: fit ODE/DAE model parameters to experimental data — Levenberg-Marquardt minimising sum of squared residuals between model output and data, using AD for Jacobian computation

### 2D — Physics Domain Blocks

#### Mechanical (existing + new)

- [x] **2.41** Kinematics: v=u+at, s=ut+½at², v²=u²+2as, F=ma, W=mg, p=mv, KE=½mv², PE=mgh, W=Fs, P=W/t, P=Fv, T=Fr, ω↔RPM, centripetal acc/force, friction, impulse (19 blocks)
- [x] **2.42** Materials: stress σ=F/A, strain ε=ΔL/L, Young's modulus E=σ/ε, pressure p=F/A, safety factor, spring force F=kx, spring energy E=½kx² (7 blocks)
- [x] **2.43** Sections: area circle/annulus, I rectangle/circle, J circle, bending stress σ=My/I, torsional shear τ=Tr/J (7 blocks)
- [x] **2.44** Rotational inertia: solid cylinder ½mr², hollow cylinder, solid sphere ⅖mr², rod (center/end) (5 blocks)
- [x] **2.45** Fluids: Q=Av, v=Q/A, ṁ=ρQ, Reynolds Re, q=½ρv², Hagen-Poiseuille, Darcy-Weisbach, buoyancy F=ρVg (8 blocks)
- [x] **2.46** Thermo: ideal gas PV=nRT (P and T forms), Q=mcΔT, conduction Q̇=kAΔT/L, convection Q̇=hAΔT, Carnot η, thermal expansion ΔL=αLΔT (7 blocks)
- [x] **2.47** Structural: beam deflection (simply supported PL³/48EI, cantilever PL³/3EI), beam moment Pab/L, Euler buckling, Von Mises, combined stress, steel check utilisation, Terzaghi bearing capacity, ACI concrete moment (9 blocks)
- [x] **2.48** Mass, Spring, Damper, RigidBody components: define with properties → connect → automatic equation assembly for multi-body systems
- [x] **2.49** Joint types: revolute (1 DOF rotation), prismatic (1 DOF translation), spherical (3 DOF), universal (2 DOF), fixed (0 DOF) — for mechanism modeling
- [x] **2.50** ContactModel: penalty-based contact with Coulomb friction (μ_s, μ_k) and optional Stribeck curve — essential for impact and mechanism simulation
- [x] **2.51** KinematicChain: forward kinematics (DH parameters → end-effector pose), inverse kinematics (numerical, Jacobian-based) for serial mechanisms/robot arms

#### Electrical (existing + new)

- [x] **2.52** Basic: Ohm's V=IR, power P=VI/I²R/V²R, capacitance C=Q/V, series/parallel resistance (7 blocks)
- [x] **2.53** Extended: RC/RL time constant, RLC resonant frequency/Q factor, voltage/current divider, capacitive/inductive reactance, RC filter cutoff, transformer voltage, three-phase power, Shockley diode (12 blocks)
- [x] **2.54** Active components: Diode (exponential I-V), MOSFET (square-law model), IGBT (on/off with voltage drop) — for power electronics simulation
- [x] **2.55** OpAmp (ideal + finite gain), PWMGenerator (duty cycle, frequency), HBridge (4-switch), ThreePhaseInverter (6-switch SPWM) — for motor drive design
- [x] **2.56** DCMotor (back-EMF, armature resistance, inductance, torque constant), PMSMMotor (dq-frame Park transform, flux linkage, torque equation) — for electromechanical co-simulation
- [x] **2.57** Battery: equivalent circuit model (Thevenin: OCV + R_series + R_parallel||C) with SOC lookup table, thermal coupling (resistive heating), aging model (capacity fade)

#### Thermal (existing + new)

- [x] **2.58** Brake thermal: dT/dt = (P_brake - h×A×(T-T_amb)) / (m×c), brake energy E=½m(v1²-v2²), brake power P=E/Δt (3 blocks, 4 tests)
- [x] **2.59** ThermalConductor (k×A/L), ThermalCapacitor (m×c), Convection (h×A), Radiation (ε×σ×A×(T⁴-T_amb⁴)) — lumped-parameter thermal network components
- [x] **2.60** HeatExchanger: ε-NTU method (effectiveness from NTU and Cr) AND LMTD method (log-mean temperature difference) — for heat exchanger sizing and rating

#### Fluid (new)

- [x] **2.61** Pipe (pressure drop from Darcy-Weisbach + minor losses), Valve (Cv characteristic), Pump (H-Q curve interpolation), Accumulator (gas spring), Orifice (sharp-edged flow coefficient)
- [x] **2.62** HydraulicCylinder (pressure → force, flow → velocity), HydraulicMotor (pressure → torque) — for hydraulic system simulation
- [x] **2.63** FluidProperties: density ρ(T,P), viscosity μ(T), bulk modulus β(T,P) as polynomial fits or lookup tables — for accurate hydraulic simulation

#### Signal/Control (existing + new)

- [x] **2.64** Control: step response (1st/2nd order), PID output, RMS, peak-to-peak, settling time, overshoot, natural frequency, damping ratio, Bode magnitude 1st order (10 blocks)
- [x] **2.65** TransferFunction: define G(s) = num(s)/den(s) as coefficient arrays; evaluate step/impulse response, frequency response (Bode plot data output)
- [x] **2.66** StateSpace: define dx/dt=Ax+Bu, y=Cx+Du; simulate with ODE solver, compute eigenvalues for stability, controllability/observability matrices
- [x] **2.67** Saturation (clamp output), DeadZone (zero within ±band), RateLimiter (max dy/dt), Delay (pure time delay via buffer) — essential nonlinear control elements
- [x] **2.68** MUX (combine N scalars → vector), DEMUX (split vector → N scalars), Switch (select input based on condition) — signal routing
- [x] **2.69** Scope: real-time signal visualisation during simulation — 30fps update, configurable buffer depth (last N points or all), vertical trigger line at current time
- [x] **2.70** ZeroOrderHold (sample continuous → discrete), RateTransition (change sample rate) — for mixed continuous/discrete simulation
- [x] **2.71** StateflowBlock: visual finite state machine editor — define states, transitions with guard conditions, entry/during/exit actions — for mode-switching logic (gear shift, flight modes, battery management)

### 2E — Vehicle Dynamics Domain

*Built-in domain reduces dependence on Adams ($50K+/seat). Enables K&C, full-vehicle events, tire modeling.*

- [x] **2.72** Pacejka Magic Formula tire: Y(x) = D×sin(C×atan(B×x - E×(B×x - atan(B×x)))) — lateral_force, longitudinal_force, combined_slip, force_sweep (plot data), 4 presets (SportRadial μ≈1.0, EconomyRadial μ≈0.8, Slick μ≈1.5, WetWeather μ≈0.7). 6 tests: zero-slip, monotonicity, Fz proportionality, antisymmetry, sweep, preset ordering. Ref: Pacejka "Tire and Vehicle Dynamics" 3rd ed (2012).
- [x] **2.73** Quarter-car suspension: 2-DOF (sprung + unsprung mass) via RK45 ODE solver — m_s×x_s'' = -k_s×(x_s-x_u) - c_s×(x_s'-x_u'), m_u×x_u'' = k_s×(x_s-x_u) + c_s×(x_s'-x_u') - k_t×(x_u-x_r). DEFAULT_PASSENGER preset (250kg/35kg/16kN/m/1kNs/m/160kN/m). 2 tests: settling, oscillation. Ref: Dixon "Suspension Geometry" (2009).
- [x] **2.74** Aero: drag F=0.5ρCdAv², downforce F=0.5ρClAv², side force, aero balance (front%), CdA. 4 presets: Sedan(Cd=0.30), SportsCar(0.32), F1Car(Cd=0.70,Cl=3.50), Truck(0.60). 5 tests. Balance returns 50% for equal split.
- [x] **2.75** Powertrain: torque_from_map (linear interpolation on RPM-torque table), gear_ratio (T_out=T_in×ratio, RPM_out=RPM_in/ratio), drivetrain_loss (P_out=P_in×η), wheel_speed (v=RPM×2π×r/(60×ratio)). 4 tests.
- [x] **2.76** Lap simulation: point-mass quasi-steady-state — 1) corner speed v_max=√(μgR), 2) forward pass: traction-limited acceleration F_drive=min(P/v, μmg) - F_drag, 3) backward pass: braking deceleration a=μg, 4) combine minimum speeds, 5) integrate dt=ds/v. LapVehicle struct. 2 tests: oval track, empty. Ref: Milliken & Milliken (1995).
- [x] **2.77** Brake thermal: dT/dt = (P_brake - h×A×(T-T_amb)) / (m×c), brake_energy = 0.5×m×(v1²-v2²), brake_power = E/Δt. 4 tests: energy, power, heating, cooling.
- [x] **2.78** Half-car (4-DOF: front/rear sprung + unsprung) and full-vehicle (7-DOF: body heave/pitch/roll + 4 wheel DOFs) suspension models — configurable spring/damper curves, anti-roll bar
- [x] **2.79** K&C analysis mode: virtual K&C rig — bump (bounce), roll, lateral compliance, longitudinal compliance, steering. Output: bump steer gradient (deg/mm), bump camber gradient, lateral stiffness (N/mm), roll centre height (mm), anti-dive/anti-squat percentages. This is the key differentiator vs Adams for vehicle dynamics engineers.
- [x] **2.80** Standard .tir file import/export: parse Pacejka MF 6.2 parameter files used across the automotive industry (Adams, CarSim, IPG)
- [x] **2.81** Vehicle event blocks: step steer (ramp input), sinusoidal steer (frequency sweep), lane change (ISO 3888 double lane change profile), braking in turn, constant radius — each generates the steering/throttle/brake time-series input for full-vehicle simulation
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
- [x] **2.92** LSTM layer: Long Short-Term Memory with forget/input/output gates — for time-series prediction and sequence modeling
- [x] **2.93** GRU layer: Gated Recurrent Unit (simpler than LSTM, often similar performance) — for sequence tasks
- [x] **2.94** Attention layer: scaled dot-product attention Q×K^T/√d_k → softmax → ×V — foundation for transformer architectures
- [x] **2.95** Conv2D layer: 2D convolution with configurable kernel size, stride, padding — for image-based tasks
- [ ] **2.96** ONNX model import: load .onnx files for inference using ONNX Runtime compiled to WASM — supports models up to ~500MB (quantized) in browser, larger via server Edge Function. Covers TensorFlow/PyTorch model deployment.
- [ ] **2.97** PINNBlock: physics-informed neural network — configure PDE residual expression + boundary conditions + collocation points. Implements adaptive sampling (residual-based), gradient balancing between loss terms (NTK-based weighting), Fourier feature embedding for spectral bias mitigation. Uses AD engine (1C).
- [ ] **2.98** NeuralOperator: FNO (Fourier Neural Operator) or DeepONet architecture — learn solution mappings across parameter spaces. Configure modes, layers, trunk/branch networks. Train on input-output function pairs. Ref: Mamba Neural Operators achieve 90% error reduction over Transformer baselines.
- [x] **2.99** SurrogateModel: train NN or Gaussian Process surrogate from a connected simulation block — supports active learning with expected improvement sampling for efficient exploration
- [x] **2.100** Hyperparameter optimisation: TPE (Tree-structured Parzen Estimator) / CMA-ES sampler with ASHA/Hyperband pruning — right-click any parameter → "Mark as Hyperparameter" with range/distribution. Dashboard shows trial history, parameter importance.
- [x] **2.101** AutoML block: given DataTable + target column, auto-tries linear, tree ensemble, small NN — reports best with cross-validation scores
- [ ] **2.102** Transfer learning: load pre-trained ONNX model, freeze specified layers, add new trainable layers, fine-tune on user data
- [ ] **2.103** Experiment tracker: log metrics, parameters, model weights per training run to Supabase table — comparison view with parallel coordinates

### 2G — Optimisation Blocks

*All implemented in Rust for WASM compatibility. No Python/scipy dependency.*

- [x] **2.104** LP solver: revised simplex with Bland's anti-cycling rule. solve_lp(c, A, b) for minimize c'x s.t. Ax≤b, x≥0. LpResult: status (Optimal/Infeasible/Unbounded/MaxIter), x, objective, iterations. 2 tests. Ref: Nocedal & Wright (2006).
- [x] **2.105** QP solver: projected gradient descent for convex QP. solve_qp(H, f) for minimize 0.5×x'Hx + f'x s.t. x≥0. Armijo backtracking. 2 tests: unconstrained optimum, boundary-constrained.
- [x] **2.106** NSGA-II: non-dominated sorting + crowding distance + SBX crossover + polynomial mutation + tournament selection. ParetoResult: solutions, objectives, generations. Configurable pop_size, generations, crossover_rate, mutation_rate. 2 tests: dominance, bi-objective Pareto. Ref: Deb et al. (2002).
- [x] **2.107** Sobol sensitivity: Saltelli sampling scheme (A, B, AB_i matrices). First-order S1 and total-order ST indices. SobolResult: s1, st, names, n_evals. 2 tests: x1 dominates x2, constant function. Ref: Saltelli (2002).
- [x] **2.108** Existing optimisers: gradient descent (step + convergence), genetic algorithm (tournament + crossover + mutation), Nelder-Mead (simplex reflection/expansion/contraction), parametric sweep, Monte Carlo simulation, DOE (Sobol/LHS/factorial)
- [x] **2.109** L-BFGS-B: limited-memory BFGS with bound constraints — the workhorse gradient-based optimiser for medium-scale problems (100-10000 variables). Uses AD for gradients.
- [x] **2.110** SQP: Sequential Quadratic Programming with augmented Lagrangian — handles equality + inequality constraints. Solves QP subproblem at each iteration.
- [x] **2.111** Trust-region (dogleg): globally convergent, robust for non-convex problems. Adaptively adjusts trust-region radius.
- [x] **2.112** CMA-ES: Covariance Matrix Adaptation Evolution Strategy — gradient-free, excellent for non-convex, multimodal problems. sep-CMA-ES variant for high-dimensional (>100 vars).
- [x] **2.113** Bayesian optimisation: GP surrogate with Matérn 5/2 kernel, acquisition functions (Expected Improvement, Upper Confidence Bound, Knowledge Gradient). Multi-objective via qNEHVI. Multi-fidelity via multi-task GP. Ref: BoTorch principles.
- [x] **2.114** NSGA-III: reference-direction-based multi-objective (better than NSGA-II for >3 objectives). MOEA/D with Tchebycheff decomposition.
- [x] **2.115** Enhanced DOE: Taguchi orthogonal arrays, D-optimal (coordinate exchange), Box-Behnken, Central Composite (face/inscribed/circumscribed) — add to existing factorial/LHS/Sobol
- [x] **2.116** Response surface: fit polynomial/RBF/Kriging metamodel to DOE results — visualise as contour + 3D surface + sensitivity tornado
- [x] **2.117** UQ: Polynomial Chaos Expansion (Legendre/Hermite bases up to degree 5 with LAR sparse selection), reliability (FORM with HLRF algorithm, importance sampling, subset simulation) — output: failure probability, reliability index β
- [x] **2.118** Robust design: objective = weighted mean + k×std under uncertainty — Pareto optimisation of mean performance vs variance
- [x] **2.119** Topology optimisation: SIMP method on 2D FEM mesh with density filtering and projection — output optimised material distribution as density field

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
- [x] **2.130** Assertion: runtime check — verify value is in range, correct type, correct dimensions. Pass = green indicator, Fail = red with message. For validation workflows.
- [x] **2.131** Timer: measure wall-clock and CPU time for connected computation — identify performance bottlenecks
- [x] **2.132** Logger: record time-series data from any port to structured log (Supabase table) — for post-processing and experiment tracking
- [x] **2.133** MathSheet: spreadsheet-like block within the node graph — accepts input ports as named variables, cells support unit-aware formulas, outputs computed columns. The "Excel-killer" feature: lets Excel users bring their mental model into ChainSolve while gaining units, version control, reproducibility.
- [x] **2.134** CodeBlock: write Rust/Python expressions inline with autocomplete, type inference, instant evaluation — variables from connected inputs available by name, output auto-typed. The "MATLAB-killer" feature: like MATLAB Live Editor but in a node graph.

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
- [x] **3.15** Port type colours: float=blue, vector=green, matrix=purple, signal=orange, physical=red, string=gray, boolean=yellow, any=white — visual distinction helps users understand data flow at a glance
- [x] **3.16** Port type compatibility: incompatible connections show red snap indicator, compatible show green — prevent wiring errors before they happen
- [x] **3.17** Auto type coercion indicators: when scalar→vector broadcast happens, show a small "↗" icon on the port to indicate the coercion
- [x] **3.18** Inline value display upgrades: vectors show sparkline (tiny line chart), matrices show heatmap thumbnail (colour-coded density), signals show waveform preview, booleans show LED indicator (green/red)
- [x] **3.19** Double-click node → open full config panel as side sheet (slide from right, 400px wide) instead of requiring separate inspector — faster workflow
- [x] **3.20** Edge labels: on hover, show data shape label ("[3×3]", "[1024]", "5.23 N") — understand data flow without clicking
- [x] **3.21** Smart edge routing: Bezier curves with obstacle avoidance — route around other nodes instead of through them (A* pathfinding on grid)
- [x] **3.22** Animated flow direction: subtle particle animation along edge during execution — shows data flowing through the graph
- [x] **3.23** Edge bundling: when many edges share source/target regions, bundle them visually for cleaner appearance — unbundle on hover

### 3C — Graph Organisation

- [x] **3.24** Groups: select → G to create named group with coloured background. Collapsible. Auto-resize when members dragged.
- [x] **3.25** Annotations: text, callout, highlight, arrow, rectangle, ellipse, diamond, rounded rectangle, sticky note. Rich text with bold/italic/underline. KaTeX math rendering.
- [x] **3.26** Block library palette: left sidebar with category tabs, fuzzy search, drag to add. Pro-only gating on advanced blocks.
- [x] **3.27** Command palette: Ctrl+K opens global command search across all actions.
- [x] **3.28** Auto-layout: dagre LR/TB directions. Triggered via toolbar button or Shift+click.
- [x] **3.29** Alignment: distribute horizontally/vertically, align left/right/top/bottom/center. alignmentHelpers.ts with full implementation.
- [x] **3.30** Domain-coloured backgrounds: auto-tint node backgrounds by physics domain — mechanical=blue, electrical=yellow, thermal=red, control=green, ML=purple, optimisation=orange — for instant visual parsing of complex multi-domain graphs
- [x] **3.31** SubGraph collapse: right-click group → "Collapse to SubGraph" — creates a composite block with exposed input/output ports (ports are the edges that cross the group boundary). Can be saved to template library. Like Houdini's Digital Assets.

### 3D — Debugging

- [x] **3.32** Debug console: DebugConsolePanel with engine log output (eval started/complete, patch ops, errors)
- [x] **3.33** Graph health panel: LazyGraphHealthPanel computes health on-demand (orphan nodes, cycles, crossing edges)
- [x] **3.34** Problems panel: validation diagnostics display
- [x] **3.35** Probe mode: click any edge → floating inspector shows data value, type, shape, statistics (min/max/mean/std), and inline mini-plot — like Grasshopper's data viewer
- [ ] **3.36** Breakpoints: right-click node → "Set Breakpoint" — execution pauses before evaluating that node, showing all input values in inspector. Step over to continue.
- [ ] **3.37** Step execution: step through graph one node at a time (forward/backward in topological order) — with current node highlighted and inputs/outputs displayed
- [x] **3.38** Execution timeline: collapsible bottom panel showing Gantt-chart of block execution with durations — identifies bottleneck blocks at a glance
- [x] **3.39** Data flow highlighting: hover over any port → all upstream (feeding) and downstream (consuming) connections highlighted in accent colour — trace data flow through complex graphs
- [x] **3.40** Diff view: compare two execution snapshots side-by-side — value deltas highlighted (green=increased, red=decreased) — for regression analysis

### 3E — Formula Bar & CSEL Expression Language

- [x] **3.41** CSEL lexer: tokenises numbers, identifiers (with dot-namespaced ops), operators (+−×÷^), parens, comma, equals, semicolon, pipe, arrow (→). Handles scientific notation (1e-3), .5-style decimals.
- [x] **3.42** CSEL parser: recursive descent with operator precedence — grammar: program = statement (';' statement)*, statement = assignment | display | expr, expr = term (('+'/'-') term)*, term = power (('*'/'/') power)*, power = unary ('^' unary)* (right-assoc), unary = '-' unary | call, call = IDENT '(' args ')' | primary. 11 tests.
- [x] **3.43** Graph generator: AST → GeneratedNode[] + GeneratedEdge[]. Maps: +→add, −→subtract, ×→multiply, ÷→divide, ^→power, sin→sin, cos→cos, max→max (variadic with dynamicInputCount). Auto-creates Number blocks for literals, Display for trailing '='. Known constants: pi, e, tau, phi.
- [x] **3.44** FormulaBar expression mode: 'fx' toggle button switches to full-width CSEL input. Enter → parseCsel() → generateGraph() → addNodes/addEdges to canvas. Escape exits. Error messages inline.
- [x] **3.45** Variadic: max(a,b,c,d) creates single max block with dynamicInputCount=4 and in_0..in_3 ports
- [x] **3.46** Variables: x=5 creates named Number block; subsequent x references reuse same node ID
- [x] **3.47** Syntax highlighting in expression input: colour operators (cyan), numbers (orange), functions (purple), variables (green), errors (red underline)
- [x] **3.48** Autocomplete: as user types, suggest matching block types, function names, declared variables, and constants — dropdown with signature hints
- [x] **3.49** Expression history: up/down arrow cycles through previously entered expressions (stored in localStorage)
- [x] **3.50** Drag from empty port → open search palette filtered to compatible block types — fastest way to add connected blocks

---

## Category 4 — Data Handling & I/O

*Import: CSV, TSV, Excel, HDF5, Parquet, Arrow IPC, JSON, MATLAB .mat, NumPy .npy/.npz, STEP/IGES, STL, FMU, .tir, MF4, OpenDRIVE. Export: CSV, Excel, HDF5, Parquet, JSON, PDF, MATLAB .mat, FMU, ONNX, LaTeX, SVG/PNG/PDF.*

- [x] **4.1** CSV import/export (csvImport block, CSV picker, csv-worker.ts for parsing)
- [x] **4.2** Excel export (write-excel-file dependency, XLSX audit export with images)
- [x] **4.3** PDF audit report export (pdf-lib + html-to-image for canvas capture)
- [x] **4.4** SVG/PNG plot export (Vega-Lite → SVG/PNG)
- [x] **4.5** Project JSON format (.chainsolvejson schema v3) with version migration
- [x] **4.6** Excel .xlsx read import: parse workbook sheets → DataTable values. Use a WASM-compiled xlsx parser or server-side Edge Function.
- [ ] **4.7** HDF5 import/export: hierarchical datasets for large arrays/matrices. Via `hdf5-rust` or Emscripten-compiled libhdf5.
- [x] **4.8** Parquet import/export: columnar format for large datasets. Via `parquet` Rust crate compiled to WASM.
- [x] **4.9** MATLAB .mat import: v5 format via `matfile` crate (pure Rust), v7.3 via HDF5 layer
- [x] **4.10** NumPy .npy/.npz import: parse NumPy array format (simple binary header + data)
- [ ] **4.11** STEP/IGES geometry import: parse CAD boundary representations → display as 3D mesh in viewport
- [x] **4.12** STL mesh import: parse triangulated surface mesh for FEM preprocessing
- [ ] **4.13** FMU .fmu import/export: zip containing modelDescription.xml + compiled binaries — parse and create block ports
- [x] **4.14** .tir tire parameter file: parse Pacejka MF 6.2 format used across automotive industry
- [ ] **4.15** OpenDRIVE .xodr: parse road geometry description for driving simulation scenarios
- [ ] **4.16** ONNX export: save trained neural network as .onnx file for deployment in other tools
- [x] **4.17** LaTeX export: render symbolic expressions as LaTeX source code for papers/reports
- [x] **4.18** Clipboard paste: detect tabular data from Excel/Sheets clipboard → auto-create DataTable block
- [x] **4.19** WebSocket input: live sensor data at up to 1kHz with ring buffer — for DAQ integration
- [x] **4.20** SQL query block: connect to PostgreSQL (via Supabase), parameterised queries, output as DataTable
- [x] **4.21** REST/GraphQL API client block: request builder with auth (API key, OAuth, Bearer), JSON parsing
- [x] **4.22** Data versioning: SHA-256 content-hash every referenced dataset — graphs reference by hash for reproducibility

---

## Category 5 — Collaboration & Version Control

- [x] **5.1** Project save/load: Supabase Storage for canvas blobs, project metadata in PostgreSQL, per-canvas storage paths
- [x] **5.2** Multi-canvas sheets: tabs with position ordering, canvas switching, cross-sheet publish/subscribe
- [x] **5.3** Share links: read-only token-based sharing (ADV-02), SharedProjectPage viewer
- [x] **5.4** Node comments: threaded comments attached to nodes (node_comments table)
- [x] **5.5** Audit log: append-only audit_log table with user, timestamp, event_type, metadata
- [x] **5.6** Conflict detection: Compare-And-Swap on projects.updated_at, ConflictBanner UI
- [ ] **5.7** Real-time co-editing: Yjs CRDT for shared graph state (nodes, edges, params) with <100ms sync via WebSocket — each user sees coloured cursors and selection highlights. Supabase Realtime Presence for online indicators.
- [x] **5.8** Graph versioning: every save = immutable snapshot (JSONB + Storage) — version history panel with diff view showing added/removed/modified nodes (colour-coded)
- [x] **5.9** Branching: create named branches for experimentation — merge with conflict resolution UI (side-by-side node comparison)
- [x] **5.10** Export as interactive standalone HTML: embed graph + results + data in single file — no server needed for review
- [x] **5.11** Git-friendly JSON export: deterministic key ordering, one-node-per-line format with .chainsolve extension — CLI diff/merge tool

---

## Category 6 — Visualisation & Plotting

- [x] **6.1** XY Plot (line/scatter via Vega-Lite), configurable axes, legends
- [x] **6.2** Histogram, Bar Chart, Heatmap blocks via Vega-Lite
- [x] **6.3** Plot export: SVG/PNG/PDF via Vega-Lite export + html-to-image
- [x] **6.4** CSP compliance: Vega with vega-interpreter for CSP-safe rendering
- [x] **6.5** Bode plot: magnitude (dB) + phase (deg) vs frequency (Hz/rad/s) on log scale — standard for control systems. Output from TransferFunction frequency response.
- [x] **6.6** Nyquist plot: Re vs Im of G(jω) — for stability analysis (encirclement criterion). Root locus: poles/zeros vs gain parameter.
- [x] **6.7** XY animation: time-varying plots with playback controls (play/pause/speed/scrub) — for visualising simulation results over time
- [x] **6.8** Contour plot: 2D scalar field with isolines — for response surfaces and field visualisation
- [x] **6.9** 3D surface plot: via Three.js or React Three Fiber — interactive rotation, zoom, colourmap, wireframe toggle
- [x] **6.10** Parallel coordinates: N vertical axes, each data point as a polyline — for multi-dimensional design space exploration
- [x] **6.11** Pareto front plot: 2D/3D with dominated region shading — for multi-objective optimisation results
- [x] **6.12** Sankey diagram: flow quantities between nodes — for energy/mass balance visualisation
- [x] **6.13** Box-and-whisker, violin plots: statistical distribution visualisation
- [x] **6.14** Scope block: 30fps live update during simulation, configurable buffer, vertical trigger line at current time — like Simulink's Scope
- [x] **6.15** Multi-axis: secondary Y-axis, stacked panels with shared X-axis (like Simulink Data Inspector)
- [x] **6.16** 3D viewport: Three.js orbit camera, mesh visualisation (wireframe/solid/transparent), section planes, vehicle animation, mechanism motion — for geometry and dynamics visualisation
- [x] **6.17** Plot annotations: interactive arrows, text labels, reference lines (horizontal/vertical), shaded regions — all draggable

---

## Category 7 — Performance & Scalability

- [x] **7.1** 60fps canvas: drag pauses engine, unpause after 200ms settle
- [x] **7.2** Reactive eval: only recompute dirty nodes
- [x] **7.3** Value hash pruning (ENG-05): skip downstream when output unchanged
- [x] **7.4** Binary encoding (ENG-03): Float64Array Transferable zero-copy
- [x] **7.5** Worker pool (ENG-04): 1-4 workers, LRU eviction, engine switch
- [x] **7.6** Bundle budgets: 1000KB WASM raw, 350KB gzip; 400KB JS gzip
- [x] **7.7** Benchmark: 500 nodes at 60fps pan/zoom (must pass, currently untested at this scale)
- [ ] **7.8** Benchmark: 1000×1000 GEMM <10ms via WebGPU (requires Category 1D)
- [x] **7.9** Benchmark: 100-state ODE, 1s sim, RK45 <500ms in browser
- [x] **7.10** Streaming evaluation: for large parameter sweeps, evaluate and stream results without holding all in memory. Configurable cache 1GB browser / 16GB server.
- [x] **7.11** LRU cache with configurable size: evict least-recently-used cached block results when memory pressure detected
- [ ] **7.12** Hybrid compute: dispatch heavy jobs to Supabase Edge Function calling native Rust binary — graphs >1000 blocks or matrices >10000×10000
- [x] **7.13** Cold start <3s on 4G: code splitting (React.lazy), lazy block pack loading, WASM streaming compilation
- [x] **7.14** Offline support: Service Worker caches WASM + app shell, IndexedDB stores graphs locally, sync to Supabase when online

---

## Category 8 — Simulation Infrastructure

*Dedicated worker for long-running tasks. All have defined endpoints. Optional looping for periodic simulations.*

- [x] **8.1** Dedicated simulation worker: separate Web Worker from eval worker, loads same WASM. SimulationWorkerAPI class.
- [x] **8.2** run_simulation WASM export with progress_cb: config = {op, inputs, maxIterations, endTime?, convergenceThreshold?, batchSize?, loop?, loopCount?}
- [x] **8.3** All tasks finite: maxIterations, targetLoss, endTime, convergenceThreshold — no indefinite execution
- [x] **8.4** Looping: when loop=true + loopCount=N, restart from initial conditions after each cycle. Results append to output table. E.g., pendulum over 10 periods → angle vs time with 10 periods of data for plotting.
- [x] **8.5** Progress streaming: {type: 'simulationProgress', iteration, totalIterations, cycle, totalCycles, partialResults, metrics}
- [x] **8.6** Cancellation: Stop button sends Abort signal. Clean stop after current cycle (no mid-cycle abort unless force-cancelled).
- [x] **8.7** Connected Plot blocks update live during looping: each cycle appends data points, graph extends in real-time
- [x] **8.8** SimulationStatusStore: tracks {nodeId, status, iteration, totalIterations, cycle, totalCycles, metrics}. StatusBar shows "Simulating (cycle 3/10)" or "Training (epoch 47/100)".
- [x] **8.9** Normal graph eval continues while simulation runs on separate worker — two workers must be independent

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
- [x] **9.10** Interactive 5-minute tutorial: build spring-mass-damper from scratch — demonstrates input→compute→visualise workflow. Opens as a ChainSolve graph with step-by-step annotations.
- [x] **9.11** Template gallery on home: "Vehicle Suspension K&C", "PID Controller Tuning", "Curve Fitting", "Neural Network Training", "Structural Optimisation", "Battery Thermal Model" — each fully functional with inline comments
- [x] **9.12** AI assistant (opt-in): natural language → suggested graph via LLM API. User reviews and approves before insertion. Like Mathematica's Notebook Assistant.
- [x] **9.13** Progressive disclosure: simple blocks show minimal config by default. "Advanced" toggle reveals all parameters.
- [x] **9.14** MathSheet block: spreadsheet within node graph. Input ports → named variables. Cells support unit-aware formulas. Outputs computed columns. The Excel-killer feature.
- [x] **9.15** CodeBlock: inline Rust/Python with autocomplete, type inference, instant eval. Connected input variables available by name. Output auto-typed. The MATLAB-killer feature.
- [x] **9.16** Contextual help: hover over block in search palette → 3-sentence description + animated GIF preview

---

## Category 10 — Extensibility & API

- [x] **10.1** Block SDK: Rust crate `chainsolve-block-sdk` with Block trait — metadata(), validate(), evaluate(). Blocks compiled to WASM for browser execution.
- [ ] **10.2** Plugin system: publish custom blocks as WASM modules to ChainSolve Block Registry. Dynamic loading at runtime. WASM memory isolation for sandboxing.
- [x] **10.3** REST API: POST /api/graph/execute (returns job ID), GET /api/graph/{id}/results, POST /api/graph/export/fmu, POST /api/graph/export/pdf
- [x] **10.4** WebSocket: /api/graph/{id}/stream for execution progress and intermediate results
- [x] **10.5** CLI: `chainsolve-cli` Rust binary — headless graph execution, CI/CD, batch sweeps. Reads .chainsolve JSON, outputs CSV/HDF5/JSON.
- [x] **10.6** Python bindings: `pip install chainsolve` via PyO3. `chainsolve.Graph.load("model.chainsolve").execute(params={...})` from Jupyter.
- [x] **10.7** JS/TS SDK: `npm install @chainsolve/sdk` — programmatic graph construction and execution.
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
- [x] **11.8** DETEST ODE benchmarks: A1-A5 (non-stiff), B1-B5 (mildly stiff), C1-C5 (stiff), D1-D5 (DAE), E1-E5 (second-order) — compare against published reference solutions
- [x] **11.9** Optimisation benchmarks: Rosenbrock, Rastrigin, Ackley, ZDT1-6 (multi-objective) — verify convergence and Pareto front quality
- [x] **11.10** FEA benchmarks: NAFEMS LE1, LE10, LE11 — standard finite element verification problems
- [ ] **11.11** FMU compliance: exported FMUs pass FMI Cross-Check validation suite
- [x] **11.12** Round-trip: save → close → reopen → execute = bit-identical results
- [ ] **11.13** Solver verification reports: auto-generated PDF documenting algorithm, convergence, error estimates, reference comparison — for regulatory submission
- [x] **11.14** TestBlock/TestSuite: user-defined assertions in graphs. TestBlock compares computed vs expected within tolerance. TestSuite aggregates pass/fail.

---

## Category 12 — Documentation

- [x] **12.1** CLAUDE.md: comprehensive AI-agent guidance — reactive eval, CSEL, variadic, all modules documented
- [x] **12.2** ARCHITECTURE.md: directory map, data model, engine design, milestones
- [x] **12.3** README.md: overview, capabilities, quick start, testing
- [x] **12.4** Block descriptions: blockDescriptions.ts for all 361+ blocks
- [x] **12.5** 13 Architecture Decision Records (ADRs)
- [x] **12.6** CSEL grammar doc: docs/CSEL.md with full grammar, examples, operator precedence table
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
- [x] **15.9** TODO/FIXME/HACK scan: resolve all or convert to tracked GitHub issues
- [BLOCKED: Windows Application Control policy prevents installing cargo-audit binary] **15.10** cargo audit: install cargo-audit, run on all crates, fix any advisories
- [x] **15.11** Migration audit: verify all 15 migrations idempotent, consider squashing to single baseline (pre-release)
- [x] **15.12** RLS policy audit: verify every table has appropriate policies (cross-reference with 0013 migration)
- [x] **15.13** New ADRs: reactive eval model, CSEL grammar, magnetic snapping, simulation worker, faer integration, WebGPU strategy
- [x] **15.14** i18n: add translated labels for all new blocks (ODE, vehicle, ML classification, etc.) across all 7 locales

---
## Category 16 — Legal, Compliance & Commercial Readiness

### Dependency Licence Compliance

- [ ] **16.1** Rust licence audit: run `cargo tree --format '{p} {l}'` across all workspace crates, export full list to `legal/rust-dependency-licences.txt`, flag any crate not MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, Zlib, BSL-1.0, Unicode-DFS-2016, MPL-2.0, CC0-1.0, or Unlicense
- [ ] **16.2** Rust licence gate: create `deny.toml` with allowlist from 16.1 and explicit deny of GPL-2.0, GPL-3.0, AGPL-3.0, SSPL-1.0, CC-BY-NC-\*, CC-BY-ND-\*; run `cargo deny check licenses` with zero violations
- [ ] **16.3** Rust CI integration: add `cargo deny check licenses` as a required CI step that blocks merge on any violation
- [ ] **16.4** Frontend licence audit: run `npx license-checker --json --out legal/frontend-dependency-licences.json`; run `npx license-checker --failOn "GPL-2.0;GPL-3.0;AGPL-3.0;SSPL-1.0;CC-BY-NC-4.0;CC-BY-NC-SA-4.0"` with zero violations
- [ ] **16.5** Frontend CI integration: add licence check as a required CI step (e.g., `license-checker --failOn` in the test/lint pipeline)
- [ ] **16.6** Unlicensed dependency scan: identify any dependency (Rust or JS) with no licence specified or licence field set to "UNLICENSED" / "SEE LICENSE IN" — these are legally unusable in a commercial product; replace each one or obtain written permission from the author
- [ ] **16.7** Transitive dependency audit: verify that no transitive/indirect dependency introduces a copyleft licence — `cargo deny` handles this for Rust; for JS, run `npx license-checker --production` (production deps only) and verify the full tree
- [ ] **16.8** Font licence audit: list every font file bundled in the repo or loaded from a CDN; verify each has a licence permitting commercial web application use (OFL/SIL, Apache 2.0, or commercial web licence); document in `legal/font-licences.md`
- [ ] **16.9** Icon and image asset audit: list every SVG icon set, illustration, stock photo, and graphic asset in the repo; verify each has a licence permitting commercial use without attribution (MIT, Apache, CC0) or that required attribution is present; document in `legal/asset-licences.md`
- [ ] **16.10** THIRD\_PARTY\_LICENCES.md: create a single file at repo root listing every third-party dependency (Rust crates, npm packages, fonts, icons, images) with name, version, licence identifier (SPDX), and URL to the licence text; this file becomes part of enterprise sales collateral and must be regenerated on every dependency update
- [ ] **16.11** Licence attribution in build output: verify that the production build includes or links to third-party licence notices as required by MIT ("shall be included in all copies or substantial portions of the Software") and Apache 2.0 (NOTICE file requirements); typically a `/licences` or `/legal` route in the app or a downloadable text file

### Terms of Service

- [ ] **16.12** ToS document: create a legally complete Terms of Service at `/terms` covering: definitions (Service, User, Account, Content, Calculation Graph), acceptance of terms, account registration and eligibility (13+ age restriction per COPPA/GDPR), licence grant from Godfrey Engineering Ltd to the user (limited, non-exclusive, revocable, non-transferable), licence grant from user to Godfrey Engineering Ltd (limited to storing and processing user content for service provision — you do NOT claim ownership of user graphs or data), prohibited uses (reverse engineering the computation engine, automated scraping, use in violation of export controls, using the service to develop weapons of mass destruction or for any purpose prohibited by applicable law), payment terms (Stripe billing, currency, renewal, cancellation, refund policy), subscription tier descriptions and limitations, free tier limitations (3 projects, 500MB storage, watermarked PDF export)
- [ ] **16.13** Calculation accuracy disclaimer: ToS must contain a prominent clause stating that ChainSolve is provided as a calculation aid, results must be independently verified before reliance for safety-critical, structural, or life-safety applications, and Godfrey Engineering Ltd accepts no liability for losses arising from reliance on calculations performed using the software — model this on MathWorks' and PTC's equivalent disclaimers
- [ ] **16.14** Limitation of liability: ToS must limit aggregate liability to the greater of £100 or the amount the user paid in the preceding 12 months; exclude liability for indirect, incidental, special, consequential, or punitive damages; include a "no warranty" clause (the service is provided "as is" and "as available" without warranty of any kind, express or implied, including but not limited to fitness for a particular purpose, accuracy, or non-infringement)
- [ ] **16.15** Termination clause: specify that Godfrey Engineering Ltd may terminate accounts for ToS violations with notice, and that users may terminate at any time; define what happens to user data on termination (30-day read-only access for export, then deletion within 90 days)
- [ ] **16.16** Governing law: specify that the ToS is governed by the laws of England and Wales, with disputes subject to the exclusive jurisdiction of the courts of England and Wales
- [ ] **16.17** Modification clause: specify that Godfrey Engineering Ltd may modify the ToS with 30 days' email notice; continued use after modification constitutes acceptance
- [ ] **16.18** Consumer rights preservation (UK): include a clause stating that nothing in the ToS affects the user's statutory rights under the Consumer Rights Act 2015 or the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 (14-day cooling-off period for UK consumer purchases)
- [ ] **16.19** ToS acceptance mechanism: verify that account signup flow includes an explicit "I agree to the Terms of Service and Privacy Policy" checkbox (not pre-ticked, per GDPR) with links to both documents; store the timestamp and version of ToS accepted in Supabase `user_metadata` or a dedicated `consents` table
- [ ] **16.20** ToS versioning: implement a version number and last-updated date in the ToS document; when ToS changes, prompt existing users to re-accept on next login; store new acceptance timestamp

### Privacy Policy

- [ ] **16.21** Privacy Policy document: create a legally complete Privacy Policy at `/privacy` compliant with UK GDPR (Data Protection Act 2018), EU GDPR (Regulation 2016/679), and ePrivacy Directive, covering all items below
- [ ] **16.22** Data controller identification: name Godfrey Engineering Ltd as the data controller with registered address, Companies House number, and contact email (e.g., privacy@chainsolve.co.uk or legal@chainsolve.co.uk)
- [ ] **16.23** Personal data inventory: exhaustively list every category of personal data collected — email address, name (if provided), hashed password (or OAuth provider token), IP addresses (in server logs and Supabase logs), browser/device information (user-agent), calculation graphs and associated data files, Stripe customer ID and subscription metadata (not card numbers), authentication tokens, locale/language preference, account creation and last-login timestamps, usage analytics (if collected)
- [ ] **16.24** Legal basis for processing: for each category of data, specify the GDPR legal basis — contract performance (Art. 6(1)(b)) for account data, authentication, and service provision; legitimate interest (Art. 6(1)(f)) for security logging, fraud prevention, and aggregated analytics; consent (Art. 6(1)(a)) for marketing emails and non-essential cookies; legal obligation (Art. 6(1)(c)) for financial records retention
- [ ] **16.25** Data processing purposes: list every purpose — providing the service, authenticating users, processing payments, sending transactional emails (password reset, billing receipts), sending marketing emails (only with consent), improving the service (aggregated analytics), preventing abuse, responding to support requests
- [ ] **16.26** Sub-processors list: name every third-party service that processes user data on your behalf — Supabase (database, auth, storage, realtime — include their DPA link), Stripe (payment processing — include their DPA link), your email service provider (Mailchimp/Buttondown/Resend — include DPA), your analytics provider (Plausible/PostHog — include DPA), your error tracking service if any (Sentry — include DPA), Cloudflare (CDN/WAF — include DPA), Vercel or your hosting provider (include DPA); specify the country/region where each sub-processor stores data
- [ ] **16.27** International data transfers: if any sub-processor stores data outside the UK, document the transfer mechanism (UK adequacy decision, Standard Contractual Clauses, or binding corporate rules); Supabase on AWS typically stores in a specified region — document which one
- [ ] **16.28** Data retention policy: specify retention periods for each data category — account data retained while account is active plus 90 days after deletion request, financial records retained for 7 years per HMRC requirements, server logs retained for 90 days, deleted calculation graphs purged within 30 days of deletion request, anonymised analytics retained indefinitely
- [ ] **16.29** User rights section: document all GDPR data subject rights — right of access (Art. 15), right to rectification (Art. 16), right to erasure (Art. 17), right to restriction of processing (Art. 18), right to data portability (Art. 20), right to object (Art. 21), right to withdraw consent (Art. 7(3)), right to lodge a complaint with the ICO (Information Commissioner's Office, ico.org.uk); provide a contact email and a 30-day response commitment for subject access requests
- [ ] **16.30** Data portability implementation: verify that the application provides a "Download my data" function in account settings that exports all user-created content (calculation graphs as JSON, uploaded data files, account metadata) in a structured, commonly used, machine-readable format; this is a legal requirement under GDPR Art. 20
- [ ] **16.31** Account deletion implementation: verify that the application provides a "Delete my account" function in account settings that triggers: immediate revocation of authentication sessions, deletion of user record from Supabase Auth, deletion of all user data (graphs, files, preferences) from Supabase database and storage within 30 days, cancellation of any active Stripe subscription, and a confirmation email; verify that RLS policies prevent any access to the deleted user's data during the deletion processing window
- [ ] **16.32** Children's data: state that the service is not directed at children under 13 (under 16 in some EU member states) and that you do not knowingly collect personal data from children; if a child's data is discovered, it will be deleted immediately; this satisfies COPPA (if US users register) and GDPR Art. 8
- [ ] **16.33** Privacy Policy versioning: include a version number and "last updated" date; maintain a changelog of material changes; notify users of material changes via email

### Cookie Policy & Consent

- [ ] **16.34** Cookie audit: document every cookie, localStorage key, sessionStorage key, and IndexedDB database used by the application — categorise each as: strictly necessary (authentication tokens, session IDs, CSRF tokens, locale preference), functional (theme preference, editor settings), analytics (any tracking cookies), or marketing (any advertising cookies)
- [ ] **16.35** Cookie Policy document: create a Cookie Policy at `/cookies` listing every cookie/storage item with: name, provider (first-party or third-party with provider name), purpose, type (session/persistent), expiry duration, and category
- [ ] **16.36** Cookie consent banner: implement a PECR/ePrivacy-compliant cookie consent banner that appears on first visit, allows users to accept or reject non-essential cookies by category (analytics, functional, marketing), does NOT use pre-ticked checkboxes (GDPR requires affirmative consent), does NOT set non-essential cookies before consent is given, stores consent preference (in a strictly-necessary cookie or localStorage), and provides a mechanism to change consent preferences later (accessible via footer link "Cookie Settings")
- [ ] **16.37** Consent-gated script loading: verify that analytics scripts (Plausible, PostHog, Google Analytics, or whatever you use) are only loaded AFTER the user consents to analytics cookies; if using Plausible Analytics, note that Plausible does not use cookies and is exempt from consent requirements — document this in the Cookie Policy
- [ ] **16.38** Do Not Track header: optionally respect the DNT browser header by suppressing analytics for users who have it enabled; document this in the Cookie Policy if implemented

### GDPR Technical Compliance

- [ ] **16.39** Supabase DPA: verify that the Supabase Data Processing Agreement is accepted in your Supabase dashboard (Settings → Legal); download and store a copy in `legal/supabase-dpa.pdf`
- [ ] **16.40** Stripe DPA: verify that the Stripe DPA is in effect (Stripe automatically applies their DPA to all accounts as of 2023); download from stripe.com/legal/dpa and store in `legal/stripe-dpa.pdf`
- [ ] **16.41** Email provider DPA: obtain and store the DPA from your email service provider (Mailchimp, Buttondown, Resend, etc.)
- [ ] **16.42** All other sub-processor DPAs: obtain and store DPAs from every service listed in 16.26 — Cloudflare, Vercel/hosting provider, error tracking (Sentry), and any others
- [ ] **16.43** Data Processing Records (Art. 30 ROPA): create a Record of Processing Activities document at `legal/ropa.md` listing: each processing activity, categories of data subjects, categories of personal data, purposes, legal basis, recipients/sub-processors, international transfers, and retention periods; this is legally required for most data controllers under GDPR Art. 30
- [ ] **16.44** Breach notification procedure: document an incident response plan at `legal/breach-response.md` covering: how to detect a breach (Supabase audit logs, Cloudflare security alerts, Stripe webhook anomalies), assessment and containment steps, notification to the ICO within 72 hours if the breach poses a risk to individuals (per GDPR Art. 33), notification to affected users without undue delay if the breach poses a high risk (per GDPR Art. 34), template notification emails for both ICO and users
- [ ] **16.45** Data Protection Impact Assessment: for any high-risk processing (e.g., if you implement profiling, automated decision-making, or large-scale processing of sensitive data), document a DPIA per GDPR Art. 35; for a standard calculation workbench this is likely not required, but document the assessment decision in `legal/dpia-assessment.md`
- [ ] **16.46** ICO registration: UK data controllers who process personal data must register with the Information Commissioner's Office unless exempt; the annual fee is £40 for micro-organisations (fewer than 10 employees, turnover under £632,000); register at ico.org.uk/registration; store your registration number and add it to the Privacy Policy

### Security Headers & Application Security

- [ ] **16.47** HTTPS enforcement: verify that all domains (chainsolve.co.uk, app.chainsolve.co.uk, docs.chainsolve.co.uk) enforce HTTPS with valid TLS 1.2+ certificates; verify HTTP→HTTPS redirect is in place; verify HSTS header is set: `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [ ] **16.48** Security headers: verify the following response headers are set on all pages — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (or SAMEORIGIN if you need iframes), `X-XSS-Protection: 0` (modern best practice — rely on CSP instead), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] **16.49** Content Security Policy: implement a CSP header that whitelists only required origins for scripts, styles, fonts, images, and connections; at minimum: `default-src 'self'; script-src 'self' [CDN origins]; style-src 'self' 'unsafe-inline' [font origins]; connect-src 'self' [Supabase URL] [Stripe URL]; img-src 'self' data: blob:; font-src 'self' [font CDN]`; test with CSP Evaluator (csp-evaluator.withgoogle.com)
- [ ] **16.50** security.txt: create `/.well-known/security.txt` containing: Contact (email for security reports), Preferred-Languages (en), Canonical (URL of this file), and Expires (date); this signals security awareness to researchers and enterprise evaluators
- [ ] **16.51** Rate limiting: verify that authentication endpoints (login, signup, password reset) have rate limiting to prevent brute-force attacks; Supabase Auth has built-in rate limiting — verify it is configured appropriately (default is 30 requests/hour for signup, 30 for token refresh); add application-level rate limiting on any custom API endpoints
- [ ] **16.52** CSRF protection: verify that all state-changing operations use CSRF tokens or are protected by SameSite cookie attributes; Supabase Auth uses SameSite=Lax by default — verify this is not overridden
- [ ] **16.53** Input sanitisation: verify that all user input rendered in the UI is sanitised to prevent XSS — particularly important for: user-supplied block labels, graph names, comment text, expression inputs, and any Markdown rendering; verify that `dangerouslySetInnerHTML` is either not used or only used with sanitised input (DOMPurify)
- [ ] **16.54** SQL injection prevention: verify that all Supabase queries use parameterised queries via the Supabase client library (which parameterises by default) — search the codebase for any raw SQL string concatenation or `.rpc()` calls with string-interpolated parameters
- [ ] **16.55** Authentication security: verify that password requirements meet NIST 800-63B guidelines (minimum 8 characters, no arbitrary complexity rules, check against known-breached passwords if feasible); verify that OAuth flows (Google, GitHub, etc.) use PKCE; verify that session tokens are stored in httpOnly cookies (not accessible to JavaScript) or, if in localStorage, that XSS protections are robust
- [ ] **16.56** Row-Level Security audit: verify that every Supabase table has RLS enabled and that policies correctly restrict access — specifically: users can only read/write their own graphs and data, users cannot access other users' data by manipulating request parameters, shared/collaborative graphs use explicit sharing records (not implicit trust), and the `service_role` key is never exposed to the frontend

### Stripe & Payment Compliance

- [ ] **16.57** PCI DSS compliance: verify that no credit card numbers, CVVs, or full card details ever touch your servers or frontend code; all payment processing must go through Stripe Checkout or Stripe Elements which handle PCI compliance for you; search the codebase for any card-related fields or variables that might indicate custom card handling
- [ ] **16.58** Billing descriptor: configure your Stripe account billing descriptor to clearly identify charges — e.g., "CHAINSOLVE PRO" or "CHAINSOLVE\*PRO" — so users recognise the charge on their bank statement and do not file chargebacks
- [ ] **16.59** Stripe webhook signature verification: verify that all Stripe webhook endpoints verify the webhook signature using `stripe.webhooks.constructEvent()` with your webhook signing secret; without this, anyone could send fake webhook events to your server
- [ ] **16.60** Subscription lifecycle handling: verify that webhook handlers correctly process: `checkout.session.completed` (provision access), `customer.subscription.updated` (plan changes), `customer.subscription.deleted` (revoke access), `invoice.payment_failed` (trigger dunning email, do not immediately revoke access), `invoice.paid` (confirm renewal); verify that if a webhook is missed or fails, the system self-heals on next user login by checking Stripe subscription status
- [ ] **16.61** Refund policy implementation: document your refund policy in the ToS (recommendation: 14-day no-questions-asked for new subscriptions, pro-rated for annual plans); implement a mechanism to process refunds (Stripe dashboard is sufficient initially; API integration for scale)
- [ ] **16.62** Pricing page accuracy: verify that all prices displayed on the website and in the app exactly match the Stripe Price objects; verify that currency is displayed correctly (£ for GBP, € for EUR if applicable); verify that "per month" and "per year" labels are accurate; verify that any "save X%" on annual billing is mathematically correct
- [ ] **16.63** VAT/tax readiness: enable Stripe Tax or configure tax rates for UK VAT (20% standard rate) so that when you register for VAT, the infrastructure is already in place; verify that invoices generated by Stripe include: your company name, address, and (when registered) VAT number, the customer's name and address, a description of the service, the net amount, VAT rate, VAT amount, and gross amount; these are legal requirements for UK VAT invoices under HMRC rules
- [ ] **16.64** Stripe Customer Portal: enable the Stripe Customer Portal so users can self-manage their subscription (update payment method, switch plans, cancel, download invoices) without you handling it manually; link to it from account settings in the app

### Accessibility

- [ ] **16.65** Keyboard navigation audit: verify that the entire application is operable via keyboard alone — all interactive elements (buttons, links, inputs, dropdowns, the node graph canvas) are reachable via Tab, activated via Enter/Space, and dismissable via Escape; focus indicators are visible on all focusable elements
- [ ] **16.66** Screen reader compatibility: verify that all interactive elements have accessible names (aria-label, aria-labelledby, or visible text); verify that dynamic content updates (calculation results, error messages, status changes) are announced to screen readers via aria-live regions; verify that the node graph has a text-based alternative or summary for screen reader users
- [ ] **16.67** Colour contrast: verify that all text meets WCAG 2.1 AA minimum contrast ratios — 4.5:1 for normal text, 3:1 for large text (18pt+ or 14pt+ bold); test both light and dark themes; pay particular attention to your orange (#FA8C00) on white backgrounds which may fail contrast requirements
- [ ] **16.68** Colour independence: verify that no information is conveyed by colour alone — particularly port type differentiation in the node graph (which currently uses colour coding); add shape, icon, or text label as a secondary differentiator
- [ ] **16.69** Accessibility statement: create an accessibility statement at `/accessibility` documenting: the WCAG standard you target (2.1 AA), known limitations, and contact information for accessibility feedback; this is legally required for UK public sector bodies and strongly recommended for any service selling to universities

### Export Control & Sector-Specific

- [ ] **16.70** Export control self-classification: review the UK Strategic Export Control Lists (available at gov.uk) Category 5 Part 2 (Information Security) to confirm that ChainSolve does not incorporate controlled cryptographic functionality beyond standard HTTPS/TLS; for a general-purpose calculation workbench using standard web encryption this is almost certainly not controlled, but document the self-assessment in `legal/export-control-assessment.md`
- [ ] **16.71** US EAR classification (if selling to US customers): general-purpose scientific calculation software is typically classified as EAR99 (not controlled); document this assessment; this becomes relevant if US universities or companies adopt ChainSolve
- [ ] **16.72** ITAR disclaimer: if targeting defence customers, include a disclaimer that ChainSolve is not designed or intended for use with ITAR-controlled technical data; users are responsible for ensuring their use of the service complies with applicable export control regulations

### Legal Page Implementation

- [ ] **16.73** Legal page routing: verify that the following routes exist and render correctly — `/terms` (Terms of Service), `/privacy` (Privacy Policy), `/cookies` (Cookie Policy), `/accessibility` (Accessibility Statement), `/security` (Security overview including security.txt link, responsible disclosure contact, infrastructure overview), `/licences` (third-party licence notices)
- [ ] **16.74** Footer links: verify that the website and application footer includes links to: Terms of Service, Privacy Policy, Cookie Policy, and a "Cookie Settings" link that reopens the consent banner; also include: "© 2026 Godfrey Engineering Ltd" and your Companies House registration number
- [ ] **16.75** i18n for legal pages: verify that all legal pages (ToS, Privacy, Cookies, Accessibility) are available in all supported languages (EN, IT, ES, DE, JA, FR, etc.); the English version is the legally binding version — other languages should state "This is a translation for convenience. The English version at /terms governs." at the top
- [ ] **16.76** Legal document hosting: verify that legal documents are not served from third-party iframes (some generators do this) — they must be hosted on your own domain for SEO, availability, and trust; plain HTML/Markdown rendered by your app is ideal
- [ ] **16.77** Legal document PDF export: provide downloadable PDF versions of ToS and Privacy Policy for enterprise customers who need to attach them to procurement paperwork
- [ ] **16.78** Imprint/Impressum (for German market): German law (TMG §5) requires a commercial website accessible in Germany to include an Impressum with: company name, registered address, managing director name, Companies House equivalent registration, contact email, and VAT number (when registered); create this at `/de/impressum` or as a section on the German landing page; failure to include this can result in fines and cease-and-desist letters from German competitors

### Documentation & Audit Trail

- [ ] **16.79** Legal document version control: store all legal documents (ToS, Privacy Policy, Cookie Policy, DPAs) in the git repository under `legal/` with version history; every published version should be tagged with its effective date
- [ ] **16.80** Consent audit table: create a Supabase table `user_consents` with columns: user_id, consent_type (tos_accepted, privacy_accepted, cookie_analytics, cookie_marketing, marketing_email), consented_at (timestamp), document_version (string), ip_address, user_agent; record every consent event; this is your evidence of lawful consent under GDPR and is essential for any ICO inquiry or enterprise due diligence
- [ ] **16.81** SBOM generation: implement automated Software Bill of Materials generation in CI (e.g., `cargo sbom` for Rust, `npx @cyclonedx/cyclonedx-npm` for JS) outputting CycloneDX or SPDX format; store in `legal/sbom/`; enterprise and defence customers will request this during procurement
- [ ] **16.82** Enterprise-ready legal pack: create a downloadable `ChainSolve_Legal_Pack.zip` containing: ToS PDF, Privacy Policy PDF, Cookie Policy PDF, Security Overview PDF, SBOM, THIRD\_PARTY\_LICENCES.md, sub-processor list, data processing addendum template; this is what enterprise procurement teams need and having it ready accelerates sales cycles from weeks to days

 --

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
