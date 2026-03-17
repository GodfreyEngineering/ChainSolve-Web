/**
 * blockDescriptions.ts — G4-1: Human-readable descriptions for every block.
 *
 * Shown in the Inspector panel so users understand what each block does,
 * how it works, and typical use cases. Applied by registry.ts after all
 * block registrations complete (same pattern as blockSearchMetadata.ts).
 */

/** Block type → description string. */
export const BLOCK_DESCRIPTIONS: Record<string, string> = {
  // ── Inputs ──────────────────────────────────────────────────────────────────
  number: 'Enter a fixed numeric value. Use as input to any operation block.',
  slider:
    'Interactive slider for exploring a range of values. Drag to sweep through min/max and see results update live.',
  variableSource:
    'Reference a named variable defined in the Variables panel. Output updates when the variable value changes.',

  // ── Constants ────────────────────────────────────────────────────────────
  constant:
    'Unified constant picker. Search and select from the full catalog of math, physics, and engineering constants.',
  material:
    'Material picker. Select a material and get all its properties (density, modulus, conductivity, etc.) as separate output handles. BUG-12: unified block replacing old simple and full variants.',
  // H4-1: Individual constant descriptions removed — unified Constant picker.
  // H3-1: Material/fluid preset descriptions removed — unified Material node.

  // ── Math operations ───────────────────────────────────────────────────────
  add: 'Adds two numbers. Output = A + B.',
  subtract: 'Subtracts B from A. Output = A - B.',
  multiply: 'Multiplies two numbers. Output = A * B.',
  divide: 'Divides A by B. Output = A / B. Returns error if B = 0.',
  negate: 'Flips the sign of the input. Output = -A.',
  abs: 'Absolute value. Returns the magnitude of the input, always non-negative.',
  sqrt: 'Square root. Returns NaN for negative inputs.',
  power: 'Raises Base to the power of Exp. Output = Base^Exp.',
  floor: 'Rounds down to the nearest integer. floor(2.7) = 2, floor(-2.3) = -3.',
  ceil: 'Rounds up to the nearest integer. ceil(2.1) = 3, ceil(-2.7) = -2.',
  round: 'Rounds to the nearest integer. round(2.5) = 3.',
  mod: 'Modulo (remainder). Output = A mod B. Returns error if B = 0.',
  clamp: 'Constrains a value between Min and Max. clamp(Val, Min, Max).',
  trunc: 'Truncates toward zero, removing the fractional part. trunc(2.9) = 2, trunc(-2.9) = -2.',
  sign: 'Returns the sign of the input: -1, 0, or 1.',
  ln: 'Natural logarithm (base e). Returns NaN for non-positive inputs.',
  log10: 'Common logarithm (base 10). Returns NaN for non-positive inputs.',
  exp: 'Exponential function. Output = e^A.',
  log_base: 'Logarithm with arbitrary base. Output = log(Value) / log(Base).',
  roundn: 'Rounds to N decimal places. roundn(3.14159, 2) = 3.14.',

  // ── Trig operations ───────────────────────────────────────────────────────
  sin: 'Sine function. Input in radians.',
  cos: 'Cosine function. Input in radians.',
  tan: 'Tangent function. Input in radians.',
  asin: 'Inverse sine (arcsine). Output in radians. Domain: [-1, 1].',
  acos: 'Inverse cosine (arccosine). Output in radians. Domain: [-1, 1].',
  atan: 'Inverse tangent (arctangent). Output in radians.',
  atan2: 'Two-argument arctangent. Returns angle from positive x-axis to point (X, Y) in radians.',
  degToRad: 'Converts degrees to radians. Output = input * pi / 180.',
  radToDeg: 'Converts radians to degrees. Output = input * 180 / pi.',

  // ── Logic operations ──────────────────────────────────────────────────────
  greater: 'Returns 1 if A > B, otherwise 0.',
  less: 'Returns 1 if A < B, otherwise 0.',
  equal: 'Returns 1 if A equals B, otherwise 0.',
  ifthenelse:
    'Conditional branch. If the condition is non-zero, outputs Then; otherwise outputs Else.',
  max: 'Returns the larger of A and B.',
  min: 'Returns the smaller of A and B.',

  // ── Output ────────────────────────────────────────────────────────────────
  display:
    'Shows a computed value prominently on the canvas. Connect any output to see its result.',

  // ── Data inputs (Pro) ─────────────────────────────────────────────────────
  tableInput:
    'Spreadsheet-style table input with named columns. Each column is a separate output port. Import from CSV or type values directly.',
  table_extract_col:
    'Extracts a single column from a table as an array. Connect a Table Input and specify the column index (0-based).',

  // ── List operations (Pro) ───────────────────────────────────────────────
  vectorLength: 'Returns the number of elements in a list.',
  vectorSum: 'Sums all elements of a list.',
  vectorMean: 'Computes the arithmetic mean of all elements in a list.',
  vectorMin: 'Returns the minimum value in a list.',
  vectorMax: 'Returns the maximum value in a list.',
  vectorSort: 'Sorts a list in ascending order.',
  vectorReverse: 'Reverses the order of elements in a list.',
  vectorSlice: 'Extracts a sub-list from Start to End index (0-based).',
  vectorConcat: 'Concatenates two lists into one.',
  vectorMap: 'Multiplies every element of a list by a scalar.',

  // ── Plot blocks (Pro) ─────────────────────────────────────────────────────
  xyPlot: 'XY line or scatter plot. Connect vector or table data to visualize trends.',
  histogram: 'Histogram chart. Shows the frequency distribution of a data set.',
  barChart: 'Bar chart. Displays categorical data as vertical bars.',
  heatmap: 'Heatmap visualization. Renders a table as a color-coded grid.',
  listTable:
    'List table output. Displays list data in a scrollable table with summary statistics (count, min, max, mean, std dev, sum).',

  // ── Engineering: Mechanics ────────────────────────────────────────────────
  'eng.mechanics.v_from_uat':
    'Final velocity from kinematics. v = u + at. Linear motion with constant acceleration.',
  'eng.mechanics.s_from_ut_a_t':
    'Displacement from kinematics. s = ut + 0.5*a*t2. Constant acceleration.',
  'eng.mechanics.v2_from_u2_as':
    'Final velocity without time. v = sqrt(u2 + 2as). Constant acceleration.',
  'eng.mechanics.force_ma': "Newton's second law. F = ma. Force equals mass times acceleration.",
  'eng.mechanics.weight_mg':
    'Weight force. W = mg. Mass times gravitational acceleration (g defaults to 9.807).',
  'eng.mechanics.momentum_mv': 'Linear momentum. p = mv. Mass times velocity.',
  'eng.mechanics.kinetic_energy': 'Kinetic energy. KE = 0.5*m*v2. Energy of a moving object.',
  'eng.mechanics.potential_energy':
    'Gravitational potential energy. PE = mgh. Energy due to height above a reference.',
  'eng.mechanics.work_Fs':
    'Mechanical work. W = F*s. Force times displacement in direction of force.',
  'eng.mechanics.power_work_time':
    'Power from work and time. P = W/t. Rate of energy transfer. Error if t = 0.',
  'eng.mechanics.power_Fv':
    'Power from force and velocity. P = F*v. Useful for steady-state motion.',
  'eng.mechanics.torque_Fr': 'Torque. T = F*r. Force times moment arm (perpendicular distance).',
  'eng.mechanics.omega_from_rpm':
    'Converts rotational speed from RPM to rad/s. omega = RPM * 2pi / 60.',
  'eng.mechanics.rpm_from_omega':
    'Converts angular velocity from rad/s to RPM. RPM = omega * 60 / (2pi).',
  'eng.mechanics.power_rot_Tomega': 'Rotational power. P = T*omega. Torque times angular velocity.',
  'eng.mechanics.centripetal_acc':
    'Centripetal acceleration. a = v2/r. Directed toward the center of circular motion.',
  'eng.mechanics.centripetal_force':
    'Centripetal force. F = m*v2/r. Net inward force for circular motion.',
  'eng.mechanics.friction_force':
    'Friction force. F = mu*N. Coefficient of friction times normal force.',
  'eng.mechanics.impulse': 'Impulse. J = F*dt. Force times duration, equals change in momentum.',

  // ── Engineering: Materials & Strength ──────────────────────────────────────
  'eng.materials.stress_F_A': 'Normal stress. sigma = F/A. Force per unit area. Error if A = 0.',
  'eng.materials.strain_dL_L':
    'Engineering strain. epsilon = dL/L. Change in length divided by original length.',
  'eng.materials.youngs_modulus':
    "Young's modulus. E = sigma/epsilon. Stress-strain ratio in elastic region.",
  'eng.materials.pressure_F_A':
    'Pressure. p = F/A. Force per unit area, same formula as stress but for fluids/gases.',
  'eng.materials.safety_factor':
    'Factor of safety. FoS = Strength/Stress. Values above 1 indicate safe design.',
  'eng.materials.spring_force_kx':
    "Hooke's law spring force. F = k*x. Spring constant times displacement.",
  'eng.materials.spring_energy':
    'Elastic potential energy. E = 0.5*k*x2. Energy stored in a compressed or stretched spring.',

  // ── Engineering: Section Properties ───────────────────────────────────────
  'eng.sections.area_circle': 'Area of a circle. A = pi*(d/2)2. From diameter.',
  'eng.sections.area_annulus':
    'Area of an annulus (hollow circle). A = pi/4 * (d_outer2 - d_inner2).',
  'eng.sections.I_rect': 'Second moment of area for a rectangle. I = b*h3/12.',
  'eng.sections.I_circle': 'Second moment of area for a circle. I = pi*d4/64.',
  'eng.sections.J_circle': 'Polar moment of area for a circle. J = pi*d4/32. Used in torsion.',
  'eng.sections.bending_stress':
    'Bending stress. sigma = M*y/I. Moment times distance from neutral axis divided by second moment of area.',
  'eng.sections.torsional_shear':
    'Torsional shear stress. tau = T*r/J. Torque times radius divided by polar moment.',

  // ── Engineering: Rotational Inertia ───────────────────────────────────────
  'eng.inertia.solid_cylinder': 'Mass moment of inertia of a solid cylinder. I = 0.5*m*r2.',
  'eng.inertia.hollow_cylinder':
    'Mass moment of inertia of a hollow cylinder. I = 0.5*m*(r_inner2 + r_outer2).',
  'eng.inertia.solid_sphere': 'Mass moment of inertia of a solid sphere. I = 0.4*m*r2.',
  'eng.inertia.rod_center': 'Mass moment of inertia of a rod about its center. I = m*L2/12.',
  'eng.inertia.rod_end': 'Mass moment of inertia of a rod about one end. I = m*L2/3.',

  // ── Engineering: Fluids ───────────────────────────────────────────────────
  'eng.fluids.flow_Q_from_Av':
    'Volumetric flow rate. Q = A*v. Cross-sectional area times flow velocity.',
  'eng.fluids.velocity_from_QA': 'Flow velocity from flow rate and area. v = Q/A.',
  'eng.fluids.mass_flow': 'Mass flow rate. m_dot = rho*Q. Density times volumetric flow rate.',
  'eng.fluids.reynolds':
    'Reynolds number. Re = rho*v*D/mu. Determines flow regime: laminar (Re < 2300) or turbulent.',
  'eng.fluids.dynamic_pressure':
    'Dynamic pressure. q = 0.5*rho*v2. Kinetic energy per unit volume of fluid.',
  'eng.fluids.hagen_poiseuille_dp':
    'Hagen-Poiseuille pressure drop for laminar pipe flow. dp = 128*mu*L*Q / (pi*D4).',
  'eng.fluids.darcy_weisbach_dp':
    'Darcy-Weisbach pressure drop. dp = f*L/D * 0.5*rho*v2. Pipe friction loss.',
  'eng.fluids.buoyancy':
    'Buoyant force (Archimedes). F = rho*V*g. Fluid density times displaced volume times gravity.',

  // ── Engineering: Thermo ───────────────────────────────────────────────────
  'eng.thermo.ideal_gas_P': 'Ideal gas law solved for pressure. P = nRT/V.',
  'eng.thermo.ideal_gas_T': 'Ideal gas law solved for temperature. T = PV/(nR).',
  'eng.thermo.heat_Q_mcDT':
    'Sensible heat. Q = m*c*dT. Mass times specific heat times temperature change.',
  'eng.thermo.conduction_Qdot':
    "Fourier's law of heat conduction. Q_dot = k*A*dT/L. Steady-state through a flat wall.",
  'eng.thermo.convection_Qdot': "Newton's law of convective heat transfer. Q_dot = h*A*dT.",
  'eng.thermo.carnot_efficiency':
    'Carnot efficiency. eta = 1 - T_cold/T_hot. Maximum possible heat engine efficiency.',
  'eng.thermo.thermal_expansion':
    'Linear thermal expansion. dL = alpha*L*dT. Length change due to temperature.',

  // ── Engineering: Electrical ───────────────────────────────────────────────
  'eng.elec.ohms_V': "Ohm's law solved for voltage. V = I*R.",
  'eng.elec.power_VI': 'Electrical power. P = V*I. Voltage times current.',
  'eng.elec.power_I2R': 'Electrical power (resistive). P = I2*R. Current squared times resistance.',
  'eng.elec.power_V2R': 'Electrical power (resistive). P = V2/R. Voltage squared over resistance.',
  'eng.elec.capacitance_Q_V': 'Capacitance. C = Q/V. Charge per unit voltage.',
  'eng.elec.series_resistance':
    'Series resistance. R_total = R1 + R2. Resistances in series add directly.',
  'eng.elec.parallel_resistance':
    'Parallel resistance. R_total = R1*R2/(R1+R2). Equivalent resistance of two parallel resistors.',

  // ── Engineering: Conversions ──────────────────────────────────────────────
  'eng.conv.deg_to_rad': 'Converts degrees to radians.',
  'eng.conv.rad_to_deg': 'Converts radians to degrees.',
  'eng.conv.mm_to_m': 'Converts millimetres to metres. Divides by 1000.',
  'eng.conv.m_to_mm': 'Converts metres to millimetres. Multiplies by 1000.',
  'eng.conv.bar_to_pa': 'Converts bar to pascals. Multiplies by 100 000.',
  'eng.conv.pa_to_bar': 'Converts pascals to bar. Divides by 100 000.',
  'eng.conv.lpm_to_m3s': 'Converts litres per minute to cubic metres per second.',
  'eng.conv.m3s_to_lpm': 'Converts cubic metres per second to litres per minute.',
  unit_convert: 'Generic unit conversion. Pick input and output units from any dimension.',

  // ── Finance: TVM ──────────────────────────────────────────────────────────
  'fin.tvm.simple_interest': 'Simple interest. I = P*r*t. Principal times rate times time.',
  'fin.tvm.compound_fv': 'Compound interest future value. FV = PV*(1+r/n)^(n*t).',
  'fin.tvm.compound_pv': 'Compound interest present value. PV = FV/(1+r/n)^(n*t).',
  'fin.tvm.continuous_fv': 'Continuous compounding future value. FV = PV*e^(r*t).',
  'fin.tvm.annuity_pv': 'Present value of an ordinary annuity. PV = PMT * (1 - (1+r)^-n) / r.',
  'fin.tvm.annuity_fv': 'Future value of an ordinary annuity. FV = PMT * ((1+r)^n - 1) / r.',
  'fin.tvm.annuity_pmt': 'Payment amount for an annuity. PMT = PV * r / (1 - (1+r)^-n).',
  'fin.tvm.npv': 'Net present value. Discounts a series of cash flows at rate r.',
  'fin.tvm.rule_of_72':
    'Rule of 72 approximation. Years to double = 72 / (r*100). Quick doubling-time estimate.',
  'fin.tvm.effective_rate': 'Effective annual rate from nominal rate. EAR = (1+r/n)^n - 1.',

  // ── Finance: Returns & Risk ───────────────────────────────────────────────
  'fin.returns.pct_return': 'Percentage return. (V1 - V0) / V0. Simple holding-period return.',
  'fin.returns.log_return': 'Logarithmic return. ln(V1/V0). Continuously compounded return.',
  'fin.returns.cagr': 'Compound annual growth rate. CAGR = (V1/V0)^(1/t) - 1.',
  'fin.returns.sharpe': 'Sharpe ratio. (Return - Rf) / sigma. Risk-adjusted return measure.',
  'fin.returns.weighted_avg':
    'Weighted average. Sum of X_i * W_i / Sum of W_i. Up to 6 value-weight pairs.',
  'fin.returns.portfolio_variance':
    'Two-asset portfolio variance. Accounts for individual variances and correlation.',

  // ── Finance: Depreciation ─────────────────────────────────────────────────
  'fin.depr.straight_line': 'Straight-line depreciation per period. (Cost - Salvage) / Life.',
  'fin.depr.declining_balance': 'Declining-balance depreciation for a specific period.',

  // ── Stats: Descriptive ────────────────────────────────────────────────────
  'stats.desc.mean': 'Arithmetic mean (average) of up to 6 values.',
  'stats.desc.median': 'Median (middle value) of up to 6 values.',
  'stats.desc.mode_approx': 'Approximate mode (most frequent value) of up to 6 values.',
  'stats.desc.range': 'Range (max minus min) of up to 6 values.',
  'stats.desc.variance': 'Population variance of up to 6 values.',
  'stats.desc.stddev': 'Population standard deviation of up to 6 values.',
  'stats.desc.sum': 'Sum of up to 6 values.',
  'stats.desc.geo_mean': 'Geometric mean of up to 6 positive values. Used for growth rates.',
  'stats.desc.zscore': 'Z-score. (x - mu) / sigma. How many standard deviations from the mean.',

  // ── Stats: Relationships ──────────────────────────────────────────────────
  'stats.rel.covariance': 'Sample covariance between two data series (up to 6 paired values).',
  'stats.rel.correlation':
    'Pearson correlation coefficient between two data series. Range: [-1, 1].',
  'stats.rel.linreg_slope':
    'Linear regression slope (m in y = mx + b). Best-fit line through paired data.',
  'stats.rel.linreg_intercept':
    'Linear regression intercept (b in y = mx + b). Y-value where the line crosses x = 0.',

  // ── Probability: Combinatorics ────────────────────────────────────────────
  'prob.comb.factorial': 'Factorial. n! = n * (n-1) * ... * 1. Number of permutations of n items.',
  'prob.comb.permutation':
    'Permutations. P(n,k) = n! / (n-k)!. Ordered arrangements of k items from n.',
  'prob.comb.combination':
    'Combinations. C(n,k) = n! / (k!(n-k)!). Unordered selections of k items from n.',

  // ── Probability: Distributions ────────────────────────────────────────────
  'prob.dist.binomial_pmf':
    'Binomial PMF. Probability of exactly k successes in n independent trials with success probability p.',
  'prob.dist.poisson_pmf': 'Poisson PMF. Probability of k events given average rate lambda.',
  'prob.dist.exponential_pdf':
    'Exponential PDF. Probability density for time between events at rate lambda.',
  'prob.dist.exponential_cdf':
    'Exponential CDF. Probability that event occurs by time x at rate lambda.',
  'prob.dist.normal_pdf':
    'Normal (Gaussian) PDF. Bell-curve density at x with mean mu and std dev sigma.',

  // ── Utilities ─────────────────────────────────────────────────────────────
  'util.round.to_dp': 'Rounds a value to a specified number of decimal places.',
  'util.pct.to_decimal': 'Converts a percentage to a decimal. Output = input / 100.',

  // ── Publish / Subscribe (H7-1) ──────────────────────────────────────────
  publish:
    'Publishes its input value under a named channel. Subscribe blocks on any sheet can read from this channel.',
  subscribe:
    'Reads the latest value from a named publish channel. Use to share values across sheets.',

  // ── SCI-11: Statistical distributions ────────────────────────────────────
  'prob.dist.normal_cdf':
    'Normal (Gaussian) CDF. Probability P(X ≤ x) for a normal distribution with mean μ and std dev σ.',
  'prob.dist.normal_inv_cdf':
    'Inverse normal CDF (probit). Returns x such that P(X ≤ x) = p for a normal distribution.',
  'prob.dist.t_pdf': "Student's t PDF. Density at x with df degrees of freedom.",
  'prob.dist.t_cdf':
    "Student's t CDF. Probability P(T ≤ x) for t-distribution with df degrees of freedom.",
  'prob.dist.chi2_pdf':
    'Chi-squared PDF. Density at x for chi² distribution with k degrees of freedom.',
  'prob.dist.chi2_cdf':
    'Chi-squared CDF. Probability P(X ≤ x) for chi² distribution with k degrees of freedom.',
  'prob.dist.f_pdf':
    'F-distribution PDF. Density at x with d₁ numerator and d₂ denominator degrees of freedom.',
  'prob.dist.f_cdf':
    'F-distribution CDF. Probability P(F ≤ x) with d₁ numerator and d₂ denominator degrees of freedom.',
  'prob.dist.poisson_cdf':
    'Poisson CDF. Probability of observing at most k events given Poisson rate lambda.',
  'prob.dist.binomial_cdf':
    'Binomial CDF. Probability of at most k successes in n trials each with probability p.',
  'prob.dist.beta_pdf':
    'Beta PDF. Density at x ∈ [0,1] for beta distribution with shape parameters α and β.',
  'prob.dist.beta_cdf':
    'Beta CDF (regularized incomplete beta). Probability P(X ≤ x) for beta distribution.',
  'prob.dist.gamma_pdf': 'Gamma PDF. Density at x for gamma distribution with shape α and scale β.',
  'prob.dist.weibull_pdf':
    'Weibull PDF. Density at x for Weibull distribution with shape k and scale λ. Used in reliability engineering.',

  // ── BLK-05: Expanded Electrical ──────────────────────────────────────────
  'eng.elec.RC_tau':
    'RC time constant τ = R·C. Time for voltage to reach 63.2% of its final value.',
  'eng.elec.RL_tau':
    'RL time constant τ = L/R. Time for current to reach 63.2% of its final value.',
  'eng.elec.RLC_f0': 'RLC resonant (natural) frequency f₀ = 1/(2π√(LC)).',
  'eng.elec.RLC_Q': 'RLC quality factor Q = (1/R)√(L/C). Higher Q means sharper resonance.',
  'eng.elec.V_divider': 'Voltage divider. Output = Vin × R₂/(R₁+R₂).',
  'eng.elec.I_divider': 'Current divider. Output current through R₁ = Iin × R₂/(R₁+R₂).',
  'eng.elec.Z_cap': 'Capacitive reactance Xc = 1/(2πfC). Impedance of a capacitor at frequency f.',
  'eng.elec.Z_ind': 'Inductive reactance XL = 2πfL. Impedance of an inductor at frequency f.',
  'eng.elec.filter_fc': 'RC filter −3 dB cutoff frequency fc = 1/(2πRC).',
  'eng.elec.transformer_v2': 'Ideal transformer secondary voltage V₂ = V₁ × N₂/N₁.',
  'eng.elec.three_phase_P':
    'Three-phase active power P = √3 × VL × IL × pf. VL: line voltage, IL: line current.',
  'eng.elec.diode_shockley':
    'Shockley ideal diode equation I = Is × (e^(V/(η·Vt)) − 1). η: ideality factor, Vt: thermal voltage (~0.02585 V at 300 K).',

  // ── BLK-01: Chemical Engineering ─────────────────────────────────────────
  'chem.ideal_gas_n':
    'Ideal gas law solved for moles: n = PV/(RT). P: pressure (Pa), V: volume (m³), T: temperature (K).',
  'chem.antoine_vp':
    'Antoine equation vapor pressure: log₁₀(P) = A − B/(C+T). Returns P in the same units as the Antoine constants.',
  'chem.raoults_partial':
    "Raoult's law partial pressure: P_i = x_i × P_sat. x_i: mole fraction, P_sat: pure component saturation pressure.",
  'chem.equilibrium_K':
    'Equilibrium constant K = exp(−ΔG/(RT)). ΔG: standard Gibbs free energy change (J/mol).',
  'chem.arrhenius_rate':
    'Arrhenius rate constant k = A × exp(−Ea/(RT)). A: pre-exponential factor, Ea: activation energy (J/mol).',
  'chem.heat_reaction': "Heat of reaction ΔH_rxn = H_products − H_reactants (Hess's law).",
  'chem.mole_fraction': 'Mole fraction x = n_component / n_total.',
  'chem.ficks_flux': "Fick's first law diffusion flux J = −D × dC/dx. D: diffusivity (m²/s).",
  'chem.CSTR_conv':
    'CSTR first-order conversion X = kτ/(1+kτ). k: rate constant, τ: residence time.',
  'chem.enthalpy_sensible':
    'Sensible heat ΔH = Cp × (T₂ − T₁). Enthalpy change for heating/cooling.',

  // ── BLK-02: Structural Engineering ───────────────────────────────────────
  'struct.beam_deflect_ss':
    'Simply-supported beam max deflection δ = PL³/(48EI) under centre point load P.',
  'struct.beam_deflect_cantilever':
    'Cantilever beam max deflection δ = PL³/(3EI) under tip point load P.',
  'struct.beam_moment_ss':
    'Simply-supported beam bending moment at load point M = Pab/L. a + b = L.',
  'struct.euler_buckling':
    'Euler critical buckling load P_cr = π²EI/(KL)². K: effective length factor (1 for pinned-pinned).',
  'struct.von_mises':
    'Von Mises equivalent stress σ_vm = √(σx²−σxσy+σy²+3τxy²). Yield check: σ_vm < σ_y.',
  'struct.combined_stress': 'Combined axial and bending stress σ = σ_axial + σ_bending.',
  'struct.steel_check':
    'Steel utilization ratio U = σ/(Fy × φ). Acceptable when U ≤ 1. φ typically 0.9.',
  'struct.bearing_capacity':
    'Terzaghi bearing capacity q_ult = cNc + qNq + 0.5γBNγ. c: cohesion, q: overburden.',
  'struct.concrete_moment_aci':
    'ACI nominal flexural capacity Mn for rectangular singly-reinforced section.',

  // ── BLK-03: Aerospace Engineering ────────────────────────────────────────
  'aero.ISA_T':
    'ISA standard atmosphere temperature T(h) in Kelvin. Valid to 32 km (troposphere + lower stratosphere).',
  'aero.ISA_P': 'ISA standard atmosphere pressure P(h) in Pa. Valid to 32 km.',
  'aero.ISA_rho': 'ISA standard atmosphere air density ρ(h) in kg/m³. Valid to 32 km.',
  'aero.ISA_a': 'ISA speed of sound a(h) = √(γRT(h)) in m/s. γ = 1.4 for air.',
  'aero.mach_from_v': 'Mach number M = v/a. v: airspeed (m/s), a: local speed of sound (m/s).',
  'aero.dynamic_q': 'Dynamic pressure q = ½ρv². Foundation of aerodynamic force equations.',
  'aero.lift': 'Aerodynamic lift L = CL × q × S. CL: lift coefficient, S: wing reference area.',
  'aero.drag': 'Aerodynamic drag D = CD × q × S. CD: drag coefficient, S: reference area.',
  'aero.tsfc':
    'Thrust-specific fuel consumption TSFC = ṁ_fuel / Thrust (kg/s/N). Lower is more efficient.',
  'aero.tsiolkovsky':
    'Tsiolkovsky rocket equation Δv = Isp × g₀ × ln(m₀/mf). Ideal velocity increment.',
  'aero.orbital_v':
    'Circular orbital velocity v = √(GM/r). GM: gravitational parameter, r: orbit radius.',
  'aero.escape_v': 'Escape velocity v_esc = √(2GM/r). Minimum speed to escape gravitational field.',
  'aero.hohmann_dv1':
    'Hohmann transfer first maneuver Δv₁ at departure orbit. Transfers from r₁ to r₂.',
  'aero.hohmann_dv2': 'Hohmann transfer second maneuver Δv₂ at arrival orbit. Circularizes at r₂.',

  // ── BLK-04: Control Systems ───────────────────────────────────────────────
  'ctrl.step_1st_order':
    'First-order step response y(t) = K(1 − e^(−t/τ)). K: steady-state gain, τ: time constant.',
  'ctrl.step_2nd_order':
    'Second-order step response y(t). Computes output at time t for given natural frequency ωn and damping ratio ζ.',
  'ctrl.pid_output':
    'PID controller output u = Kp·e + Ki·∫e + Kd·(de/dt). Requires pre-integrated error and time step.',
  'ctrl.rms':
    'Root-mean-square of a signal vector. RMS = √(mean(y²)). Useful for AC signal characterization.',
  'ctrl.peak2peak': 'Peak-to-peak amplitude of a signal vector. Output = max(y) − min(y).',
  'ctrl.settling_time_2pct': '2% settling time approximation t_s ≈ 4τ for first-order systems.',
  'ctrl.overshoot_2nd':
    'Percent overshoot for second-order system: %OS = 100 × exp(−πζ/√(1−ζ²)). Valid for ζ < 1.',
  'ctrl.natural_freq': 'Natural frequency ωn = √(k/m) for a spring-mass system.',
  'ctrl.damping_ratio': 'Damping ratio ζ = c/(2√(km)) for a spring-mass-damper system.',
  'ctrl.bode_mag_1st': 'First-order Bode magnitude |H(jω)| = K/√(1+(ωτ)²).',

  // ── BLK-06: Life Sciences ─────────────────────────────────────────────────
  'bio.michaelis_menten':
    'Michaelis-Menten enzyme kinetics v = Vmax×[S]/(Km+[S]). Vmax: max velocity, Km: half-saturation constant.',
  'bio.hill_eq':
    'Hill equation for cooperative binding: θ = [L]^n/(Kd^n+[L]^n). n: Hill coefficient.',
  'bio.logistic_growth':
    'Logistic population growth N(t) = K/(1+((K−N₀)/N₀)×e^(−rt)). K: carrying capacity.',
  'bio.exp_decay':
    'Exponential decay N(t) = N₀ × e^(−λt). Models radioactive decay, drug elimination, etc.',
  'bio.half_life': 'Half-life t₁/₂ = ln(2)/λ from decay constant λ.',
  'bio.drug_1cmp': 'One-compartment pharmacokinetic model C(t) = (D/Vd) × e^(−k_el × t).',
  'bio.henderson_hasselbalch':
    'Henderson-Hasselbalch equation pH = pKa + log₁₀([A⁻]/[HA]). Buffer pH calculation.',
  'bio.nernst':
    'Nernst equation E = (RT/(zF)) × ln([out]/[in]). Electrochemical equilibrium potential.',
  'bio.BMI': 'Body Mass Index BMI = mass(kg) / height(m)². Standard obesity screening metric.',
  'bio.BSA_dubois': 'DuBois formula for body surface area BSA = 0.007184 × W^0.425 × H^0.725 (m²).',

  // ── BLK-07: Finance Options & Risk ───────────────────────────────────────
  'fin.options.bs_call':
    'Black-Scholes call option price. Assumes European exercise, continuous dividends excluded.',
  'fin.options.bs_put': 'Black-Scholes put option price. Uses put-call parity relationship.',
  'fin.options.bs_delta':
    'Black-Scholes Delta (Δ). Rate of change of option price with respect to the underlying spot price.',
  'fin.options.bs_gamma':
    'Black-Scholes Gamma (Γ). Rate of change of Delta; second derivative w.r.t. spot price.',
  'fin.options.bs_vega':
    'Black-Scholes Vega (ν). Sensitivity of option price to a 1-unit change in implied volatility.',
  'fin.options.kelly':
    'Kelly criterion optimal bet fraction f* = p − (1−p)/b. p: win probability, b: payout odds.',
  'fin.options.var_hist':
    'Historical Value at Risk (VaR) at confidence level. The loss not exceeded in (1−conf) of scenarios.',
  'fin.options.cvar_hist':
    'Historical Conditional VaR (CVaR / Expected Shortfall). Average loss in the worst (1−conf) scenarios.',
  'fin.options.bond_duration':
    'Macaulay duration of a bond: weighted average time to receive cash flows. Interest rate sensitivity measure.',
  'fin.options.dcf':
    'DCF terminal value using Gordon growth model: V = FCF×(1+g)/(WACC−g), plus n-year annuity PV.',

  // ── BLK-09: Date & Time ───────────────────────────────────────────────────
  'date.from_ymd': 'Encodes a calendar date (year, month, day) as integer days since 2000-01-01.',
  'date.year': 'Extracts the year component from a date integer (days since 2000-01-01).',
  'date.month': 'Extracts the month component (1–12) from a date integer.',
  'date.day_of_month': 'Extracts the day-of-month (1–31) from a date integer.',
  'date.days_between': 'Number of days between two date integers. Positive if d2 > d1.',
  'date.add_days': 'Adds n days to a date integer. Returns a new date integer.',
  'date.is_leap_year': 'Returns 1 if the given year is a leap year, 0 otherwise.',
  'date.days_in_month':
    'Returns the number of days in the given month and year (accounts for leap years).',

  // ── BLK-08: Text / String ──────────────────────────────────────────────────
  num_to_text:
    'Converts a number to a formatted text string. Format: %.2f (fixed), %e (scientific), %g (auto), %d (integer).',
  text_concat: 'Concatenates two text values: output = A + B.',
  text_length: 'Returns the character length of a text value.',
  text_to_num:
    'Parses a text value as a floating-point number. Returns NaN if the text is not a valid number.',

  // ── BLK-10: Lookup Table Interpolation ────────────────────────────────────
  'lookup.1d':
    '1D lookup table interpolation. Given X and Y vectors, returns Y at query X. Method config: nearest, linear, or cubic spline.',
  'lookup.2d':
    '2D bilinear lookup table. Given X-axis, Y-axis, and Z-matrix (table), returns interpolated Z at query (x, y).',

  // ── SCI-04: Interval Arithmetic ────────────────────────────────────────────
  interval_from:
    'Creates an interval [center - hw, center + hw] from a center value and half-width.',
  interval_from_bounds: 'Creates an interval [lo, hi] from explicit lower and upper bounds.',
  interval_lo: 'Extracts the lower bound of an interval.',
  interval_hi: 'Extracts the upper bound of an interval.',
  interval_mid: 'Returns the midpoint (center) of an interval: (lo + hi) / 2.',
  interval_width: 'Returns the width of an interval: hi - lo.',
  interval_contains: 'Returns 1 if x lies within the interval [lo, hi], 0 otherwise.',
  interval_add: 'Interval addition: [a,b] + [c,d] = [a+c, b+d].',
  interval_sub: 'Interval subtraction: [a,b] - [c,d] = [a-d, b-c].',
  interval_mul: 'Interval multiplication using all four products min/max.',
  interval_div: 'Interval division. Errors if divisor interval contains zero.',
  interval_pow: 'Raises an interval to an integer power n.',

  // ── SCI-08: Complex Numbers ────────────────────────────────────────────────
  complex_from: 'Creates a complex number z = re + im·i from real and imaginary parts.',
  complex_re: 'Extracts the real part Re(z) of a complex number.',
  complex_im: 'Extracts the imaginary part Im(z) of a complex number.',
  complex_mag: 'Computes the magnitude (modulus) |z| = √(re² + im²) of a complex number.',
  complex_arg: 'Computes the argument (angle) ∠z = atan2(im, re) in radians.',
  complex_conj: 'Computes the complex conjugate z* = re - im·i.',
  complex_add: 'Adds two complex numbers: z₁ + z₂.',
  complex_mul: 'Multiplies two complex numbers: z₁ · z₂.',
  complex_div: 'Divides two complex numbers: z₁ / z₂. Errors if z₂ = 0.',
  complex_exp: "Complex exponential: e^z = e^re · (cos(im) + i·sin(im)). Euler's formula.",
  complex_ln: 'Complex natural logarithm: ln|z| + i·arg(z). Errors if z = 0.',
  complex_pow: 'Raises a complex number z to real power n: z^n via polar form.',

  // ── SCI-09: Matrix Operations ──────────────────────────────────────────────
  matrix_from_table:
    'Converts a Table to a Matrix (row-major). Each table row becomes a matrix row.',
  matrix_to_table: 'Converts a Matrix back to a Table with columns named col0, col1, …',
  matrix_multiply: 'Matrix multiplication A · B. Inner dimensions must match.',
  matrix_transpose: 'Transposes a matrix: swaps rows and columns (Aᵀ).',
  matrix_inverse:
    'Computes the inverse of a square matrix (Gauss-Jordan elimination). Errors if singular.',
  matrix_det: 'Computes the determinant of a square matrix via Gaussian elimination.',
  matrix_trace: 'Computes the trace: sum of diagonal elements tr(A).',
  matrix_solve:
    'Solves the linear system Ax = b for x using Gaussian elimination with partial pivoting.',

  // ── SCI-12: Signal Processing / FFT ───────────────────────────────────────
  'signal.fft_magnitude':
    'FFT magnitude spectrum: |FFT[k]| for k = 0..N/2. Input zero-padded to next power of 2.',
  'signal.fft_power':
    'FFT power spectrum: |FFT[k]|² / N for k = 0..N/2. Useful for energy analysis.',
  'signal.fft_freq_bins':
    'Frequency (Hz) for each FFT bin: k · fs / N. Use with FFT Magnitude or Power.',
  'signal.window_hann':
    'Generates a Hann (raised cosine) window of length N. Reduces spectral leakage.',
  'signal.window_hamming':
    'Generates a Hamming window of length N. Less side-lobe suppression than Hann.',
  'signal.window_blackman':
    'Generates a Blackman window of length N. Best side-lobe suppression of common windows.',
  'signal.filter_lowpass_fir':
    'Applies a low-pass FIR filter. cutoff_norm = f_cutoff / f_sample (0..0.5). taps: filter order.',
  'signal.filter_highpass_fir':
    'Applies a high-pass FIR filter. cutoff_norm = f_cutoff / f_sample (0..0.5). taps: filter order.',

  // ── Optimization (5.01) ─────────────────────────────────────────────────
  'optim.designVariable':
    'A variable that the optimizer will adjust. Set the range (min/max) and initial value.',
  'optim.objectiveFunction':
    'Wraps a computed value as the objective (cost) function. The optimizer will try to minimize this value.',
  'optim.gradientDescent':
    'Minimizes the objective using gradient descent. Supports configurable learning rate, momentum, and max iterations.',
  'optim.geneticAlgorithm':
    'Population-based optimizer using selection, crossover, and mutation. Good for non-smooth or multi-modal problems.',
  'optim.nelderMead':
    'Derivative-free simplex optimizer (Nelder-Mead). Works well for low-dimensional smooth problems.',
  'optim.convergencePlot': 'Visualizes optimizer convergence: objective value vs iteration count.',
  'optim.resultsTable':
    'Displays final optimal variable values, objective value, and convergence status.',
  'optim.parametricSweep':
    'Evaluates a function over linearly spaced values of a variable. Outputs an input-output table for sensitivity analysis.',
  'optim.monteCarlo':
    'Runs N random samples from specified distributions. Outputs statistics (mean, std, percentiles) and histogram.',
  'optim.sensitivity':
    'Varies each input one at a time while holding others constant. Produces a tornado chart of parameter sensitivity.',
  'optim.doe':
    'Generates experiment matrices: full factorial, Latin hypercube, or Sobol sequence. Outputs table of configurations.',

  // ── Machine Learning (5.06) ─────────────────────────────────────────────
  'ml.trainTestSplit':
    'Splits a table dataset into training and test sets. Default 80/20 split ratio.',
  'ml.linearRegression':
    'Ordinary Least Squares linear regression. Outputs model coefficients, intercept, and predictions.',
  'ml.polynomialRegression':
    'Polynomial regression with configurable degree. Fits y = a0 + a1x + a2x2 + ... anxn.',
  'ml.knnClassifier': 'K-Nearest Neighbors classifier. Configurable k (number of neighbors).',
  'ml.decisionTree': 'Decision tree for classification or regression. Configurable max depth.',
  'ml.predict': 'Apply a trained model to new data and output predictions.',
  'ml.mse': 'Mean Squared Error between actual and predicted values.',
  'ml.r2':
    'R-squared (coefficient of determination). 1.0 = perfect fit, 0.0 = no better than mean.',
  'ml.confusionMatrix':
    'Displays a confusion matrix for classification results. Shows true/false positives/negatives.',

  // ── Neural Networks (5.09) ──────────────────────────────────────────────
  'nn.input': 'Defines the input shape for a neural network. Set the number of input features.',
  'nn.dense':
    'Fully connected (dense) layer. Configurable number of units and activation function.',
  'nn.conv1d': 'One-dimensional convolution layer. Good for time-series and signal data.',
  'nn.dropout': 'Randomly sets input elements to zero during training to prevent overfitting.',
  'nn.activation': 'Applies an activation function: ReLU, Sigmoid, Tanh, or Softmax.',
  'nn.sequential': 'Chains layers into a sequential neural network model. Connect layers in order.',
  'nn.trainer':
    'Trains a neural network using backpropagation. Configurable epochs, batch size, learning rate, and loss function.',
  'nn.predict': 'Runs inference on a trained neural network. Feed new data to get predictions.',
  'nn.export': 'Exports a trained neural network to ONNX format for use in other tools.',
  // ODE Solvers
  'ode.rk4':
    'Solve a system of ODEs using the classic 4th-order Runge-Kutta method. Output = table of time vs state variables.',
  'ode.rk45':
    'Solve ODEs using the Dormand-Prince adaptive-step method. Automatically adjusts step size for accuracy.',
  // Vehicle Simulation
  'veh.tire.lateralForce': 'Pacejka Magic Formula lateral tire force Fy from slip angle.',
  'veh.tire.longForce': 'Pacejka Magic Formula longitudinal tire force Fx from slip ratio.',
  'veh.tire.sweep': 'Generate a tire force vs slip sweep table for plotting.',
  // Vehicle Aero
  'veh.aero.drag': 'Aerodynamic drag force: F = 0.5 × ρ × Cd × A × v².',
  'veh.aero.downforce': 'Aerodynamic downforce: F = 0.5 × ρ × Cl × A × v².',
  'veh.aero.balance': 'Front downforce percentage: F_front / F_total × 100.',
  // Vehicle Powertrain
  'veh.powertrain.gearRatio':
    'Apply gear ratio: torque_out = torque × ratio, rpm_out = rpm / ratio.',
  'veh.powertrain.wheelSpeed':
    'Vehicle speed from engine RPM, tire radius, and overall gear ratio.',
  'veh.powertrain.drivetrainLoss': 'Apply drivetrain efficiency: P_out = P_in × η.',
  'veh.lap.simulate':
    'Point-mass quasi-steady-state lap simulation. Input = track (distance, curvature table). Output = speed profile table.',
  'veh.brake.energy': 'Kinetic energy dissipated in braking: E = 0.5 × m × (v1² - v2²).',
  'veh.brake.power': 'Braking power: P = E / Δt.',
  'ml.featureScale': 'Standardize (z-score) or normalize (min-max) feature columns.',
  'ml.classMetrics': 'Compute precision, recall, and F1 score for binary classification.',
  'ml.rocCurve': 'Generate ROC curve (FPR vs TPR) by sweeping classification threshold.',
  'ml.auc': 'Area Under the ROC Curve — measures classifier discrimination ability.',
}
