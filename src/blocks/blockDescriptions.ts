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

  // ── Constants (core) ──────────────────────────────────────────────────────
  pi: "Mathematical constant pi (3.14159...). Ratio of a circle's circumference to its diameter.",
  euler:
    "Euler's number e (2.71828...). Base of natural logarithms, used in exponential growth and calculus.",
  tau: 'Tau (6.28318...), equal to 2pi. Represents one full turn in radians.',
  phi: 'Golden ratio phi (1.61803...). Appears in geometry, art, architecture, and natural growth patterns.',
  constant:
    'Unified constant picker. Search and select from the full catalog of math, physics, and engineering constants.',
  material:
    'Unified material picker. Search and select density, modulus, or viscosity values for common engineering materials and fluids.',

  // ── Math constants ────────────────────────────────────────────────────────
  'const.math.sqrt2': 'Square root of 2 (1.41421...). Diagonal of a unit square.',
  'const.math.ln2': 'Natural logarithm of 2 (0.69315...). Used in doubling-time calculations.',
  'const.math.ln10':
    'Natural logarithm of 10 (2.30259...). Converts between natural and common logarithms.',

  // ── Physics constants ─────────────────────────────────────────────────────
  'const.physics.g0':
    'Standard gravitational acceleration (9.80665 m/s2). Used in weight and free-fall calculations.',
  'const.physics.R_molar':
    'Universal gas constant R (8.314 J/mol K). Relates pressure, volume, temperature, and amount of gas.',
  'const.physics.c':
    'Speed of light in vacuum (299 792 458 m/s). Fundamental constant of special relativity.',
  'const.physics.h': 'Planck constant (6.626e-34 J s). Relates photon energy to frequency.',
  'const.physics.hbar':
    'Reduced Planck constant h-bar (1.055e-34 J s). Equal to h/(2pi), used in quantum mechanics.',
  'const.physics.kB':
    'Boltzmann constant (1.381e-23 J/K). Relates temperature to average particle kinetic energy.',
  'const.physics.Na':
    "Avogadro's number (6.022e23 mol-1). Number of particles in one mole of substance.",
  'const.physics.qe':
    'Elementary charge (1.602e-19 C). Magnitude of electric charge on one electron or proton.',
  'const.physics.F':
    'Faraday constant (96 485 C/mol). Charge per mole of electrons, used in electrochemistry.',
  'const.physics.me':
    'Electron rest mass (9.109e-31 kg). Used in atomic and particle physics calculations.',
  'const.physics.mp': 'Proton rest mass (1.673e-27 kg). About 1836 times the electron mass.',
  'const.physics.G':
    'Gravitational constant (6.674e-11 N m2/kg2). Governs the strength of gravitational attraction.',
  'const.physics.mu0':
    'Vacuum permeability (1.257e-6 H/m). Magnetic constant used in electromagnetism.',
  'const.physics.eps0':
    'Vacuum permittivity (8.854e-12 F/m). Electric constant used in electrostatics.',
  'const.physics.sigma_sb':
    'Stefan-Boltzmann constant (5.670e-8 W/m2 K4). Relates blackbody radiation to temperature.',

  // ── Atmospheric constants ─────────────────────────────────────────────────
  'const.atmos.p0_pa': 'Standard atmospheric pressure at sea level (101 325 Pa).',
  'const.atmos.t0_k': 'ISA sea-level temperature (288.15 K = 15 C).',
  'const.atmos.rho_air_sl': 'Air density at sea level, standard conditions (1.225 kg/m3).',
  'const.atmos.gamma_air':
    'Ratio of specific heats for air (1.4). Used in compressible flow and acoustics.',
  'const.atmos.R_air': 'Specific gas constant for dry air (287.05 J/kg K).',
  'const.atmos.mu_air_20c': 'Dynamic viscosity of air at 20 C (1.81e-5 Pa s).',
  'const.atmos.a_air_20c': 'Speed of sound in air at 20 C (343 m/s).',

  // ── Thermodynamic constants ───────────────────────────────────────────────
  'const.thermo.cp_air': 'Specific heat capacity of air at constant pressure (1005 J/kg K).',
  'const.thermo.cv_air': 'Specific heat capacity of air at constant volume (718 J/kg K).',
  'const.thermo.k_air': 'Thermal conductivity of air at 20 C (0.026 W/m K).',
  'const.thermo.k_water': 'Thermal conductivity of water at 25 C (0.606 W/m K).',

  // ── Electrical constants ──────────────────────────────────────────────────
  'const.elec.rho_copper':
    'Electrical resistivity of copper at 20 C (1.68e-8 ohm m). Benchmark conductor.',
  'const.elec.rho_aluminium': 'Electrical resistivity of aluminium at 20 C (2.65e-8 ohm m).',

  // ── Material presets ──────────────────────────────────────────────────────
  'preset.materials.steel_rho': 'Density of structural steel (7850 kg/m3).',
  'preset.materials.steel_E': "Young's modulus of structural steel (200 GPa).",
  'preset.materials.steel_nu': "Poisson's ratio of structural steel (0.30).",
  'preset.materials.al_rho': 'Density of aluminium alloy (2700 kg/m3).',
  'preset.materials.al_E': "Young's modulus of aluminium alloy (69 GPa).",
  'preset.materials.al_nu': "Poisson's ratio of aluminium alloy (0.33).",
  'preset.materials.ti_rho': 'Density of titanium alloy (4507 kg/m3).',
  'preset.materials.ti_E': "Young's modulus of titanium alloy (116 GPa).",
  'preset.materials.ti_nu': "Poisson's ratio of titanium alloy (0.34).",

  // ── Fluid presets ─────────────────────────────────────────────────────────
  'preset.fluids.water_rho_20c': 'Density of water at 20 C (998 kg/m3).',
  'preset.fluids.water_mu_20c': 'Dynamic viscosity of water at 20 C (1.002e-3 Pa s).',
  'preset.fluids.gasoline_rho': 'Density of gasoline (750 kg/m3).',
  'preset.fluids.diesel_rho': 'Density of diesel fuel (832 kg/m3).',

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
  probe: 'Lightweight debug output. Shows the value inline without the full display chrome.',

  // ── Annotations ───────────────────────────────────────────────────────────
  annotation_text: 'Floating text label for annotating the canvas. Does not affect computation.',
  annotation_callout: 'Callout box for notes and explanations. Does not affect computation.',
  annotation_highlight:
    'Colored highlight region to visually group related blocks. Does not affect computation.',
  annotation_arrow:
    'Directional arrow for pointing at or connecting visual elements. Does not affect computation.',

  // ── Data inputs (Pro) ─────────────────────────────────────────────────────
  vectorInput: 'Enter a list of numbers directly. Used as input to vector operations and plots.',
  tableInput: 'Enter tabular data with named columns. Used with table operations and plots.',
  csvImport: 'Import data from a CSV file. Uploads and parses the file into a table.',

  // ── Vector operations (Pro) ───────────────────────────────────────────────
  vectorLength: 'Returns the number of elements in a vector.',
  vectorSum: 'Sums all elements of a vector.',
  vectorMean: 'Computes the arithmetic mean of all elements in a vector.',
  vectorMin: 'Returns the minimum value in a vector.',
  vectorMax: 'Returns the maximum value in a vector.',
  vectorSort: 'Sorts a vector in ascending order.',
  vectorReverse: 'Reverses the order of elements in a vector.',
  vectorSlice: 'Extracts a sub-vector from Start to End index (0-based).',
  vectorConcat: 'Concatenates two vectors into one.',
  vectorMap: 'Multiplies every element of a vector by a scalar.',

  // ── Table operations (Pro) ────────────────────────────────────────────────
  tableFilter: 'Filters table rows where the value in column Col exceeds Threshold.',
  tableSort: 'Sorts table rows by the values in column Col.',
  tableColumn: 'Extracts a single column from a table as a vector.',
  tableAddColumn: 'Appends a vector as a new column to a table.',
  tableJoin: 'Joins two tables side by side (horizontal concatenation).',

  // ── Plot blocks (Pro) ─────────────────────────────────────────────────────
  xyPlot: 'XY line or scatter plot. Connect vector or table data to visualize trends.',
  histogram: 'Histogram chart. Shows the frequency distribution of a data set.',
  barChart: 'Bar chart. Displays categorical data as vertical bars.',
  heatmap: 'Heatmap visualization. Renders a table as a color-coded grid.',

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
}
