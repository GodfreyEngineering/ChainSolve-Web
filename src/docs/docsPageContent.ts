/**
 * docsPageContent.ts — Documentation body text for the /docs page (I1-1).
 *
 * Content lives here (not in locale JSON) so it is tree-shaken into the
 * lazy DocsPage chunk and does not inflate the initial JS bundle.
 * Sidebar labels remain in the locale files for i18n.
 */

export interface DocsSectionContent {
  [key: string]: string
}

export interface DocsContentMap {
  [section: string]: DocsSectionContent
}

export const DOCS_CONTENT: DocsContentMap = {
  uiOverview: {
    intro:
      'ChainSolve has a streamlined interface designed around the canvas. Here is a tour of the main areas you will interact with.',
    headerTitle: 'Header bar',
    headerBody:
      'The top bar shows the project name, undo/redo buttons, the Insert menu for adding blocks, and the Tools menu for AI assistant, exports, and publishing. On the right side you will find the settings gear and your account avatar.',
    canvasTitle: 'Canvas',
    canvasBody:
      'The canvas is the main workspace. It displays blocks and the chains that connect them. You can pan by dragging on empty space, zoom with the scroll wheel, and select blocks by clicking or drawing a selection rectangle. Double-click an empty area to open the block library.',
    toolbarTitle: 'Canvas toolbar',
    toolbarBody:
      'The toolbar at the bottom of the canvas provides quick actions: zoom controls, fit-to-view, auto-layout, undo/redo, and toggle buttons for the variables panel, graph health, and AI assistant.',
    inspectorTitle: 'Inspector panel',
    inspectorBody:
      'Click a block to open the inspector on the right side. The inspector shows the block name, its input and output ports, current values, unit assignments, and any applicable settings. You can rename blocks, change units, and edit input bindings directly from the inspector.',
    panelsTitle: 'Side panels',
    panelsBody:
      'Several features open as collapsible side panels: the Variables panel, the Graph Health panel, and the AI Copilot. These panels dock to the edges of the canvas and can be opened or closed from the toolbar.',
    windowsTitle: 'Floating windows',
    windowsBody:
      'Larger tools such as the Theme Wizard, Block Library, and Settings open as draggable floating windows. You can move, resize, and close them independently.',
  },

  onboarding: {
    intro:
      'Welcome to ChainSolve. This guide covers everything you need to go from zero to a working calculation chain.',
    whatIsTitle: 'What is ChainSolve?',
    whatIsBody:
      'ChainSolve is a visual calculation engine for engineers, scientists, and students. Instead of writing formulas in cells, you connect blocks on a canvas. Each block does one thing — a number, an operation, a display — and values flow through chains in real time. Change any input and every downstream result updates instantly.',
    firstCanvasTitle: 'Creating your first canvas',
    step1: 'Open a project or click Scratch Canvas on the home page.',
    step2: 'Open the block library from the Insert menu or the sidebar.',
    step3: 'Drag a Number block onto the canvas and set its value.',
    step4: 'Add an operation block (e.g. Add) and connect the Number output to one of its inputs.',
    step5:
      'Add a Display block and connect the operation output to it. The result appears immediately.',
    connectingTitle: 'Connecting blocks',
    connectingBody:
      'Drag from an output port (right side) to an input port (left side) to create a chain. Values propagate automatically through chains. You can disconnect a chain by selecting it and pressing Delete.',
    savingTitle: 'Saving your work',
    savingBody:
      'Projects auto-save every few seconds. You can also press Ctrl+S (Cmd+S on Mac) to save immediately. Scratch canvases are stored locally in your browser and are not saved to the cloud.',
    tip: 'Tip: Use Ctrl+K to open the command palette and quickly find any action.',
  },

  blockLibrary: {
    intro:
      'The block library contains every block available in ChainSolve, organised into categories. Each block has typed input and output ports. Connect them to build calculation chains of any complexity.',
    categoriesTitle: 'Categories overview',
    categoriesBody: 'Blocks are grouped into the following top-level categories:',
    catInput: 'Input',
    catInputDesc: 'Number, Slider, Variable Source, Constant, Material.',
    catMath: 'Math and Trigonometry',
    catMathDesc: 'Arithmetic, rounding, powers, logs, trig functions.',
    catEngineering: 'Engineering',
    catEngineeringDesc: 'Mechanics, sections, fluids, thermodynamics, electrical, conversions.',
    catFinance: 'Finance',
    catFinanceDesc: 'Time value of money, returns and risk, depreciation.',
    catStats: 'Statistics and Probability',
    catStatsDesc: 'Descriptive stats, relationships, combinatorics, distributions.',
    catOutput: 'Output',
    catOutputDesc: 'Display blocks to visualise results.',
    addingTitle: 'Adding blocks to the canvas',
    addingBody:
      'Open the block library from the Insert menu, the sidebar button, or by double-clicking an empty area of the canvas. Search by name or browse by category. Click a block to place it, or drag it to a specific position.',
    tip: 'Tip: Star your favourite blocks for quick access at the top of the library.',
  },

  blockInput: {
    intro:
      'Input blocks are the starting point of every calculation chain. They supply values that flow into downstream operations.',
    number: 'Enter a fixed numeric value. Double-click the block to edit.',
    slider:
      'Interactive slider that sweeps through a range. Set min, max, and step in the block settings.',
    variableSource:
      'References a named variable from the Variables panel. Updates when the variable changes.',
    constant:
      'Search and select from the full catalog of math, physics, and engineering constants.',
    material:
      'Search and select material or fluid properties such as density, modulus, or viscosity.',
  },

  blockMath: {
    intro:
      'Math blocks perform arithmetic and algebraic operations. Each block takes one or two inputs and produces one output.',
    arithmeticTitle: 'Arithmetic',
    roundingTitle: 'Rounding',
    floor: 'Rounds down to the nearest integer.',
    ceil: 'Rounds up to the nearest integer.',
    round: 'Rounds to the nearest integer.',
    roundN: 'Rounds to N decimal places.',
    trunc: 'Removes the fractional part, truncating toward zero.',
    sign: 'Returns -1, 0, or 1 depending on the sign of the input.',
    expLogTitle: 'Powers, Roots, and Logarithms',
    sqrt: 'Square root. Returns NaN for negative inputs.',
    abs: 'Absolute value (always non-negative).',
    ln: 'Natural logarithm (base e). Returns NaN for non-positive inputs.',
    log10: 'Common logarithm (base 10).',
    logBase: 'Logarithm with an arbitrary base.',
    clamp: 'Constrains a value between a minimum and maximum.',
  },

  blockTrig: {
    intro:
      'Trigonometry blocks work in radians by default. Use the Deg to Rad block to convert from degrees.',
    sin: 'Sine. Input in radians.',
    cos: 'Cosine. Input in radians.',
    tan: 'Tangent. Input in radians.',
    asin: 'Inverse sine. Output in radians. Domain: [-1, 1].',
    acos: 'Inverse cosine. Output in radians. Domain: [-1, 1].',
    atan: 'Inverse tangent. Output in radians.',
    atan2:
      'Two-argument arctangent. Returns the angle from the positive x-axis to the point (x, y).',
    degToRad: 'Converts degrees to radians.',
    radToDeg: 'Converts radians to degrees.',
  },

  blockLogic: {
    intro:
      'Logic blocks compare values and route computation. Conditions use numeric truthiness: zero is false, non-zero is true.',
    greater: 'Returns 1 if A > B, otherwise 0.',
    less: 'Returns 1 if A < B, otherwise 0.',
    equal: 'Returns 1 if A equals B, otherwise 0.',
    ifThenElse: 'If the condition is non-zero, outputs Then; otherwise outputs Else.',
    max: 'Returns the larger of A and B.',
    min: 'Returns the smaller of A and B.',
  },

  blockOutput: {
    intro: 'Output blocks display computed results on the canvas.',
    display: 'Shows a computed value with full formatting. Supports scalars, vectors, and tables.',
  },

  blockEng: {
    intro:
      'Engineering blocks cover mechanics, structural analysis, fluid dynamics, thermodynamics, and electrical circuits. All formulas use standard SI conventions.',
    mechanicsTitle: 'Mechanics',
    mechanicsBody: 'Classical mechanics formulas: force, energy, power, and spring behaviour.',
    force: "Newton's second law: F = m * a.",
    ke: 'Kinetic energy: KE = 0.5 * m * v^2.',
    power: 'Power from work and time: P = W / t.',
    hooke: "Hooke's law for springs: F = k * x.",
    sectionsTitle: 'Structural Sections',
    sectionsBody:
      'Cross-section property calculations for structural analysis. Includes Second Moment of Area for rectangular, circular, and annular profiles (used in deflection and buckling analysis), Bending Stress (sigma = M * y / I, the fundamental flexure formula), Section Modulus (S = I / y, linking moment capacity to geometry), and Area of Annulus (the cross-sectional area of a hollow circular section). These blocks accept geometric dimensions as inputs and produce the corresponding section property as output.',
    secondMomentRect:
      'Second Moment of Area — Rectangular section: I = b * h^3 / 12, where b is the width and h is the height of the rectangle. Used to assess bending stiffness and deflection of rectangular beams.',
    secondMomentCirc:
      'Second Moment of Area — Circular section: I = pi * d^4 / 64, where d is the diameter. Used for solid circular shafts and columns.',
    secondMomentAnnular:
      'Second Moment of Area — Annular (hollow circular) section: I = pi * (d_outer^4 - d_inner^4) / 64. Used for pipes, tubes, and hollow shafts. Returns an error if d_inner > d_outer.',
    bendingStress:
      'Bending Stress: sigma = M * y / I, where M is the bending moment, y is the distance from the neutral axis, and I is the second moment of area. Returns an error if I = 0. This is the fundamental flexure formula used in beam design.',
    sectionModulus:
      'Section Modulus: S = I / y, where I is the second moment of area and y is the extreme fibre distance. The section modulus simplifies bending stress checks to sigma = M / S.',
    areaAnnulus:
      'Area of Annulus: A = pi / 4 * (d_outer^2 - d_inner^2). Computes the cross-sectional area of a hollow circular section. Returns an error if d_inner > d_outer.',
    fluidsTitle: 'Fluids',
    fluidsBody:
      "Fluid dynamics blocks for pipe flow, open-channel flow, and aerodynamics calculations. Includes Reynolds Number (Re = rho * v * D / mu, the key dimensionless ratio for flow regime classification), Bernoulli's Equation (relating pressure, velocity, and elevation along a streamline), Pipe Head Loss (Darcy-Weisbach friction losses in pipe systems), and Flow Rate (Q = A * v, volumetric flow from cross-section and velocity).",
    reynolds:
      'Reynolds Number: Re = rho * v * D / mu, where rho is the fluid density, v is the velocity, D is the characteristic length (e.g. pipe diameter), and mu is the dynamic viscosity. Re < 2300 indicates laminar flow; Re > 4000 indicates turbulent flow. Returns an error if mu = 0.',
    bernoulli:
      "Bernoulli's Equation: P1 + 0.5 * rho * v1^2 + rho * g * h1 = P2 + 0.5 * rho * v2^2 + rho * g * h2. Relates pressure, velocity, and elevation between two points along a streamline in an ideal (inviscid, incompressible) flow.",
    pipeHeadLoss:
      'Pipe Head Loss (Darcy-Weisbach): h_f = f * (L / D) * (v^2 / (2 * g)), where f is the Darcy friction factor, L is the pipe length, D is the pipe diameter, v is the flow velocity, and g is gravitational acceleration. Used for sizing pumps and estimating pressure drop in pipe networks.',
    flowRate:
      'Volumetric Flow Rate: Q = A * v, where A is the cross-sectional area and v is the average flow velocity. Connect an area block (e.g. Area of Annulus or a manual input) to compute discharge.',
    thermoTitle: 'Thermodynamics',
    thermoBody:
      "Thermodynamics and heat transfer blocks. Includes the Ideal Gas Law (PV = nRT, relating pressure, volume, temperature, and amount of substance), Fourier Conduction (Q = k * A * dT / L, steady-state heat conduction through a slab), Convective Heat Transfer (Q = h * A * dT, Newton's law of cooling for convection), and Linear Thermal Expansion (dL = alpha * L * dT, dimensional change due to temperature).",
    idealGas:
      'Ideal Gas Law: PV = nRT, where P is absolute pressure, V is volume, n is the amount of substance in moles, R is the universal gas constant (8.314 J/mol*K), and T is absolute temperature in Kelvin. Solve for any one variable by supplying the other four.',
    fourierConduction:
      'Fourier Conduction: Q = k * A * dT / L, where k is the thermal conductivity of the material, A is the cross-sectional area perpendicular to heat flow, dT is the temperature difference across the slab, and L is the thickness. Returns an error if L = 0. Used for steady-state conduction through walls, insulation, and flat plates.',
    convection:
      "Convective Heat Transfer (Newton's Law of Cooling): Q = h * A * dT, where h is the convective heat transfer coefficient, A is the surface area, and dT is the temperature difference between the surface and the surrounding fluid. Typical h values: natural convection in air 5-25 W/m^2*K, forced convection in air 25-250 W/m^2*K, forced convection in water 50-20000 W/m^2*K.",
    thermalExpansion:
      'Linear Thermal Expansion: dL = alpha * L * dT, where alpha is the coefficient of linear thermal expansion, L is the original length, and dT is the temperature change. Use this to estimate dimensional changes in structural elements, piping, and rails due to temperature variation.',
    electricalTitle: 'Electrical',
    electricalBody:
      "Electrical circuit analysis blocks. Includes Ohm's Law (V = I * R, the fundamental relationship between voltage, current, and resistance), Power Dissipation (P = I^2 * R or equivalently P = V^2 / R), Series Resistance (R_total = R1 + R2 + ... + Rn), and Parallel Resistance (1/R_total = 1/R1 + 1/R2 + ... + 1/Rn). These blocks can be chained together to model simple DC circuits.",
    ohmsLaw:
      "Ohm's Law: V = I * R, where V is voltage in volts, I is current in amperes, and R is resistance in ohms. This block can solve for any one of the three quantities given the other two. The foundational relationship for all resistive circuit analysis.",
    powerDissipation:
      'Power Dissipation: P = I^2 * R (from current and resistance) or equivalently P = V^2 / R (from voltage and resistance) or P = V * I (from voltage and current). Computes the electrical power consumed or dissipated by a resistive element. Result is in watts.',
    seriesResistance:
      'Series Resistance: R_total = R1 + R2. When resistors are connected end-to-end (in series), their resistances simply add. The same current flows through all resistors, and the total voltage drop is the sum of individual drops.',
    parallelResistance:
      'Parallel Resistance: R_total = (R1 * R2) / (R1 + R2) for two resistors. When resistors are connected across the same two nodes (in parallel), the combined resistance is always less than the smallest individual resistor. Returns an error if R1 + R2 = 0.',
    conversionsTitle: 'Unit Conversions',
    conversionsBody:
      'Dedicated blocks for temperature, pressure, length, and other common engineering unit conversions.',
  },

  blockFin: {
    intro:
      'Finance blocks implement standard financial mathematics. Use them for time value of money calculations, investment analysis, and depreciation schedules.',
    tvmTitle: 'Time Value of Money',
    tvmBody:
      'Core TVM operations for present and future value, net present value, and internal rate of return.',
    compoundFv: 'Future value with compound interest: FV = PV * (1 + r)^n.',
    npv: 'Net present value of a series of cash flows at a discount rate.',
    irr: 'Internal rate of return — the discount rate at which NPV equals zero.',
    annuityPv: 'Present value of an annuity (equal periodic payments).',
    annuityFv:
      'Future Value of an Annuity: FV = PMT * ((1 + r)^n - 1) / r, where PMT is the periodic payment, r is the interest rate per period, and n is the number of periods. Computes how much a series of equal periodic deposits will grow to over time with compound interest.',
    rule72: 'Estimates the number of periods to double an investment: 72 / r.',
    perpetuity:
      'Present Value of a Perpetuity: PV = PMT / r, where PMT is the constant periodic payment and r is the discount rate per period. A perpetuity is an annuity that continues indefinitely. Returns an error if r = 0.',
    returnsTitle: 'Returns and Risk',
    returnsBody: 'CAGR, Sharpe ratio, and other performance metrics for portfolio analysis.',
    cagr: 'Compound Annual Growth Rate: CAGR = (FV / PV)^(1/n) - 1, where FV is the final value, PV is the initial value, and n is the number of years. Measures the mean annual growth rate of an investment over a specified period longer than one year. Returns an error if PV = 0 or n = 0.',
    sharpeRatio:
      'Sharpe Ratio: S = (R_p - R_f) / sigma_p, where R_p is the portfolio return, R_f is the risk-free rate, and sigma_p is the standard deviation of the portfolio return. A higher Sharpe ratio indicates better risk-adjusted performance. Returns an error if sigma_p = 0.',
    deprTitle: 'Depreciation',
    deprBody: 'Straight-line and declining-balance depreciation methods.',
    straightLineDepr:
      'Straight-Line Depreciation: D = (Cost - Salvage) / Life, where Cost is the initial asset cost, Salvage is the estimated residual value, and Life is the useful life in years. Produces equal depreciation expense each period. Returns an error if Life = 0.',
    decliningBalanceDepr:
      'Declining-Balance Depreciation: D_year = Rate * Book_Value, where Rate is the depreciation rate (e.g. 2/Life for double-declining) and Book_Value is the remaining book value at the start of the period. Produces higher depreciation in early years, decreasing over time. Commonly used as double-declining balance (200% DB) or 150% DB.',
  },

  blockStats: {
    intro:
      'Statistics blocks cover descriptive statistics, regression, correlation, combinatorics, and probability distributions.',
    descTitle: 'Descriptive Statistics',
    descBody:
      'Summary statistics for a set of data points. Connect up to 6 values (x1 through x6) and a count (c). The count parameter tells the block how many of the x-inputs to use. For example, setting c = 3 uses x1, x2, and x3. All descriptive blocks follow this convention. These blocks handle edge cases gracefully: a single data point returns that value as the mean and zero as the standard deviation.',
    mean: 'Arithmetic mean of the input values.',
    stddev: 'Standard deviation (population).',
    median: 'Middle value when sorted.',
    variance: 'Variance (population).',
    relTitle: 'Relationships',
    relBody:
      'Blocks for analysing relationships between two variables. Connect paired data as x1..x6 and y1..y6 with a count c. These blocks require at least 2 data points and return an error for degenerate cases such as zero variance in X.',
    linregSlope:
      'Linear Regression Slope: the slope (m) of the best-fit line y = m * x + b, computed via ordinary least squares. Inputs are paired data points x1..x6 and y1..y6 with count c. Returns an error if variance in X is zero (all X values identical).',
    linregIntercept:
      'Linear Regression Intercept: the y-intercept (b) of the best-fit line y = m * x + b. Computed alongside the slope via ordinary least squares. Same inputs and error conditions as the slope block.',
    pearsonCorr:
      'Pearson Correlation Coefficient: r = cov(X, Y) / (sigma_X * sigma_Y). Measures the strength and direction of the linear relationship between two variables. Returns a value between -1 and 1. Returns an error if either variable has zero variance.',
    covariance:
      'Covariance: cov(X, Y) = sum((xi - mean_X) * (yi - mean_Y)) / n. Measures how two variables change together. Positive covariance indicates they tend to increase together; negative indicates an inverse relationship.',
    probTitle: 'Probability and Combinatorics',
    probBody:
      'Blocks for counting arrangements, computing factorials, and evaluating probability distributions. Useful for reliability engineering, quality control, and statistical hypothesis testing.',
    factorial:
      'Factorial: n! = n * (n-1) * ... * 1. Computes the factorial of a non-negative integer. Returns an error for negative inputs. Used as a building block for permutations and combinations.',
    permutation:
      'Permutation: P(n, r) = n! / (n - r)!. The number of ordered arrangements of r items chosen from n distinct items. Returns an error if r > n or if either value is negative.',
    combination:
      'Combination: C(n, r) = n! / (r! * (n - r)!). The number of unordered selections of r items from n distinct items (also called "n choose r"). Returns an error if r > n or if either value is negative.',
    normalCdf:
      'Normal CDF: computes the cumulative distribution function of the standard normal distribution (mean = 0, sigma = 1) at a given z-value. Returns the probability P(Z <= z). Use with a z-score input to find tail probabilities for hypothesis testing and confidence intervals.',
    binomialPmf:
      'Binomial PMF: P(X = k) = C(n, k) * p^k * (1 - p)^(n - k), where n is the number of trials, k is the number of successes, and p is the probability of success on each trial. Returns the probability of exactly k successes. Returns an error if p is outside [0, 1] or k > n.',
  },

  blockData: {
    intro:
      'Data and list blocks let you work with ordered sequences of numbers. These are Pro features.',
    vectorTitle: 'Vector Input',
    vectorBody:
      'Enter a list of numbers directly, or paste from a spreadsheet. Use as input to list operations and plot blocks.',
    csvTitle: 'CSV Import',
    csvBody:
      'Upload a .csv file (up to 50 MB) to import tabular data. The data is processed in the browser and is never sent to a server.',
    opsTitle: 'List Operations',
    opsBody: 'Operations that transform or summarise lists:',
    opLength: 'Returns the number of elements.',
    opSum: 'Sums all elements.',
    opMean: 'Arithmetic mean of all elements.',
    opSort: 'Sorts in ascending order.',
    opReverse: 'Reverses the element order.',
    opSlice: 'Extracts a sub-list by start and end index.',
    opConcat: 'Joins two lists into one.',
    opMap: 'Multiplies every element by a scalar.',
  },

  blockPlot: {
    intro:
      'Plot blocks render charts directly on the canvas. Connect vector data to the X and Y ports. These are Pro features.',
    xy: 'Line or scatter plot for visualising trends and relationships.',
    histogram: 'Frequency distribution chart for a single data set.',
    bar: 'Vertical bar chart for categorical comparisons.',
    tip: 'Tip: Click a plot block to expand it. Drag the corners to resize.',
  },

  blockConst: {
    intro:
      'Constant blocks provide reference values from math, physics, and engineering. Use the unified Constant picker to search by name or symbol.',
    mathTitle: 'Math Constants',
    mathBody:
      "Pi (3.14159265...), Euler's number e (2.71828182...), Golden ratio phi (1.61803398...), and Square root of 2 (1.41421356...). These are the fundamental mathematical constants used across all branches of science and engineering.",
    physicsTitle: 'Physics Constants',
    physicsBody:
      "Speed of light c (299 792 458 m/s), Gravitational constant G (6.674e-11 N*m^2/kg^2), Planck's constant h (6.626e-34 J*s), Boltzmann constant k_B (1.381e-23 J/K), and Avogadro's number N_A (6.022e23 mol^-1). All values follow the latest CODATA recommended values.",
    atmoTitle: 'Atmospheric Constants',
    atmoBody:
      'Standard atmosphere (101 325 Pa), Sea-level temperature (288.15 K / 15 degC), and Air density at STP (1.225 kg/m^3). These are the International Standard Atmosphere (ISA) reference conditions used in aerospace, meteorology, and general engineering calculations.',
    thermoTitle: 'Thermodynamic Constants',
    thermoBody:
      'Universal gas constant R (8.314 J/mol*K), and Stefan-Boltzmann constant sigma (5.670e-8 W/m^2*K^4). R appears in the Ideal Gas Law and many thermodynamic relations. The Stefan-Boltzmann constant governs total radiant heat emission from a black body.',
    elecTitle: 'Electrical Constants',
    elecBody:
      'Vacuum permittivity e0 (8.854e-12 F/m), Vacuum permeability mu0 (1.257e-6 H/m), and Elementary charge e (1.602e-19 C). These electromagnetic constants are essential for capacitor design, inductor calculations, and semiconductor physics.',
  },

  blockAnnot: {
    intro:
      'Annotation blocks add visual notes and labels to your canvas without affecting computation.',
    text: 'Floating text label. Use for titles, section headers, or notes.',
    callout: 'Bordered callout box for longer notes and explanations.',
    highlight: 'Coloured background region to visually group related blocks.',
    arrow: 'Directional arrow for pointing at or connecting visual elements.',
  },

  chains: {
    intro:
      'Chains are the connections between blocks. They carry values from one block to another and define the flow of computation across your canvas.',
    createTitle: 'Creating a chain',
    createBody:
      'Drag from an output port (right side of a block) to an input port (left side of another block). A chain line appears while dragging. Release over a compatible port to complete the connection. The downstream block recalculates immediately.',
    deleteTitle: 'Deleting a chain',
    deleteBody:
      'Click a chain to select it (it highlights), then press Delete or Backspace. You can also right-click a chain and choose Remove from the context menu.',
    dataFlowTitle: 'Data flow',
    dataFlowBody:
      'Values propagate downstream automatically. When you change an input, the engine re-evaluates only the affected path. This incremental evaluation keeps large canvases responsive.',
    typesTitle: 'Port compatibility',
    typesBody:
      'Output ports produce either scalar (single number) or vector (list) values. Input ports accept the same type. Connecting mismatched types shows a warning. The engine does not allow circular connections (cycles).',
    multiTitle: 'Multiple connections',
    multiBody:
      'An output port can feed into many input ports simultaneously. However, each input port accepts only one incoming chain. Connecting a second chain to an occupied input replaces the previous connection.',
    animatedTitle: 'Animated chains',
    animatedBody:
      'You can enable animated chain flow in Settings > Canvas. When enabled, a subtle animation shows the direction values travel along each chain.',
  },

  units: {
    intro:
      'ChainSolve supports physical units on any numeric value. Assign a unit to a block output and the engine automatically converts when units differ across a connection.',
    assignTitle: 'Assigning units',
    assignBody:
      'Click the unit badge on any block to open the unit picker. Select a dimension (e.g. Length) and then a specific unit (e.g. metres, feet). The badge updates to show the selected unit symbol.',
    convertTitle: 'Automatic conversion',
    convertBody:
      'When you connect two blocks with different units of the same dimension, the engine inserts an automatic conversion. For example, connecting a block in metres to one expecting feet will convert the value. Incompatible dimensions (e.g. mass to length) will show a warning.',
    dimensionsTitle: 'Supported dimensions',
    dimensionsBody:
      'Length, mass, time, temperature, force, pressure, energy, power, velocity, acceleration, density, dynamic viscosity, kinematic viscosity, torque, frequency, angle, area, volume, and electric current.',
    dimensionTable:
      'Length: metre (m) — also: km, cm, mm, in, ft, yd, mi\n' +
      'Mass: kilogram (kg) — also: g, mg, lb, oz, tonne\n' +
      'Time: second (s) — also: ms, min, h, day\n' +
      'Temperature: kelvin (K) — also: degC, degF, degR\n' +
      'Force: newton (N) — also: kN, lbf, kgf, dyn\n' +
      'Pressure: pascal (Pa) — also: kPa, MPa, bar, atm, psi, mmHg, torr\n' +
      'Energy: joule (J) — also: kJ, MJ, cal, kcal, kWh, BTU, eV\n' +
      'Power: watt (W) — also: kW, MW, hp, BTU/h\n' +
      'Velocity: metre per second (m/s) — also: km/h, mph, ft/s, knot\n' +
      'Acceleration: metre per second squared (m/s^2) — also: ft/s^2, g0\n' +
      'Density: kilogram per cubic metre (kg/m^3) — also: g/cm^3, g/L, lb/ft^3\n' +
      'Dynamic viscosity: pascal second (Pa*s) — also: mPa*s, cP, P\n' +
      'Kinematic viscosity: square metre per second (m^2/s) — also: cSt, St, mm^2/s\n' +
      'Torque: newton metre (N*m) — also: kN*m, lbf*ft, lbf*in\n' +
      'Frequency: hertz (Hz) — also: kHz, MHz, GHz, rpm\n' +
      'Angle: radian (rad) — also: deg, arcmin, arcsec, rev\n' +
      'Area: square metre (m^2) — also: cm^2, mm^2, km^2, ft^2, in^2, acre, hectare\n' +
      'Volume: cubic metre (m^3) — also: L, mL, cm^3, ft^3, in^3, gal (US), gal (UK)\n' +
      'Electric current: ampere (A) — also: mA, uA, kA',
    tip: 'Tip: Units are optional. If you do not assign a unit, the value is treated as dimensionless.',
  },

  variables: {
    intro:
      'Variables let you define named values that can be referenced by multiple blocks across your canvas. Change a variable once and every reference updates.',
    createTitle: 'Creating a variable',
    createBody:
      'Open the Variables panel from the View menu. Click Add Variable, give it a name, and set an initial value. Variable names must be unique within a project.',
    bindTitle: 'Binding to blocks',
    bindBody:
      'Use a Variable Source block to reference a variable by name. The block output always reflects the current variable value. You can bind the same variable to as many blocks as you need.',
    sliderTitle: 'Slider controls',
    sliderBody:
      'Set min, max, and step on a variable to enable a slider. Drag the slider to sweep the value and see all downstream results update in real time. Sliders are useful for parametric studies and what-if analysis.',
    tip: 'Tip: Combine sliders with plot blocks to visualise how a parameter affects your results.',
  },

  materials: {
    intro:
      'Material blocks provide standard engineering property values for common materials and fluids.',
    presetsTitle: 'Material presets',
    presetsBody:
      "Select from built-in materials such as steel, aluminium, copper, concrete, and wood. Each material provides density, Young's modulus, yield strength, and thermal conductivity where applicable.",
    categoriesBody:
      'Materials are organised into categories: Steels, Aluminium alloys, Other metals, Non-metals, and Fluids. Use the category filter in the material picker to narrow the list quickly.',
    steelTable:
      'Structural Steel (S275): rho = 7850 kg/m^3, E = 200 GPa, sigma_y = 275 MPa, k = 50 W/m*K\n' +
      'Stainless Steel (304): rho = 8000 kg/m^3, E = 193 GPa, sigma_y = 215 MPa, k = 16 W/m*K\n' +
      'Stainless Steel (316): rho = 8000 kg/m^3, E = 193 GPa, sigma_y = 205 MPa, k = 14 W/m*K\n' +
      'High-Strength Steel (S355): rho = 7850 kg/m^3, E = 210 GPa, sigma_y = 355 MPa, k = 50 W/m*K',
    aluminiumTable:
      'Aluminium 6061-T6: rho = 2700 kg/m^3, E = 68.9 GPa, sigma_y = 276 MPa, k = 167 W/m*K\n' +
      'Aluminium 7075-T6: rho = 2810 kg/m^3, E = 71.7 GPa, sigma_y = 503 MPa, k = 130 W/m*K\n' +
      'Aluminium 2024-T3: rho = 2780 kg/m^3, E = 73.1 GPa, sigma_y = 345 MPa, k = 121 W/m*K',
    otherMetalsTable:
      'Copper (C11000, annealed): rho = 8960 kg/m^3, E = 117 GPa, sigma_y = 69 MPa, k = 391 W/m*K\n' +
      'Brass (C26000): rho = 8530 kg/m^3, E = 110 GPa, sigma_y = 200 MPa, k = 120 W/m*K\n' +
      'Titanium (Ti-6Al-4V): rho = 4430 kg/m^3, E = 114 GPa, sigma_y = 880 MPa, k = 6.7 W/m*K',
    nonMetalsTable:
      'Concrete (C30/37): rho = 2400 kg/m^3, E = 33 GPa, compressive strength = 30 MPa, k = 1.7 W/m*K\n' +
      'Wood (Douglas Fir, along grain): rho = 530 kg/m^3, E = 12.4 GPa, sigma_y = 50 MPa, k = 0.12 W/m*K\n' +
      'Glass (soda-lime): rho = 2500 kg/m^3, E = 72 GPa, tensile strength = 45 MPa, k = 1.0 W/m*K\n' +
      'HDPE: rho = 960 kg/m^3, E = 1.1 GPa, sigma_y = 26 MPa, k = 0.50 W/m*K',
    fluidTable:
      'Water (20 degC): rho = 998 kg/m^3, mu = 1.002e-3 Pa*s, nu = 1.004e-6 m^2/s, c_p = 4182 J/kg*K\n' +
      'Air (20 degC, 1 atm): rho = 1.204 kg/m^3, mu = 1.825e-5 Pa*s, nu = 1.516e-5 m^2/s, c_p = 1005 J/kg*K\n' +
      'SAE 30 Oil (40 degC): rho = 876 kg/m^3, mu = 0.10 Pa*s, nu = 1.14e-4 m^2/s',
    customTitle: 'Custom materials',
    customBody:
      'Create custom material definitions with your own property values. Custom materials are saved to your project and can be reused across canvases.',
    fluidsTitle: 'Fluid presets',
    fluidsBody:
      'Built-in fluid definitions for water, air, oil, and other common fluids. Properties include density, dynamic viscosity, and kinematic viscosity at standard conditions.',
  },

  projects: {
    intro:
      'Projects are the top-level containers for your work. Each project contains one or more canvases, shared variables, and settings.',
    createTitle: 'Creating a project',
    createBody:
      'Click New Project on the home page or use File > New Project from the menu. Give it a name (up to 100 characters) and it opens in a fresh canvas.',
    scratchTitle: 'Scratch canvas',
    scratchBody:
      'If you just want to experiment without creating a project, use the Scratch Canvas. Scratch canvases are stored in your browser only and are not synced to the cloud. They are ideal for quick calculations and prototyping.',
    savingTitle: 'Saving',
    savingBody:
      'Projects auto-save every few seconds. You can also press Ctrl+S (Cmd+S on Mac) to save immediately. A small indicator in the toolbar shows the save status. If auto-save fails due to a network issue, you will see a warning.',
    sheetsTitle: 'Multi-sheet canvases',
    sheetsBody:
      'Pro users can add multiple canvases (sheets) to a single project. Use the sheet tab bar at the bottom of the canvas to switch between them. Variables are shared across all sheets in a project.',
    importExportTitle: 'Import and export',
    importExportBody:
      'Use File > Export > Project to save a .chainsolvejson file. This portable format includes all canvases, variables, and settings. You can import it into any account using File > Import.',
    deleteTitle: 'Deleting a project',
    deleteBody:
      'Delete a project from the home page by clicking the menu on its card and selecting Delete. This action is permanent and cannot be undone.',
  },

  groups: {
    intro: 'Groups let you visually organise related blocks on the canvas. They are a Pro feature.',
    createTitle: 'Creating a group',
    createBody:
      'Select two or more blocks, then right-click and choose Group Selection, or press Ctrl+G (Cmd+G on Mac). The selected blocks are enclosed in a coloured region with a label.',
    editTitle: 'Editing a group',
    editBody:
      'Click the group header to rename it. Right-click the group to change its colour or ungroup (dissolve) it. You can also drag blocks in or out of a group.',
    moveTitle: 'Moving groups',
    moveBody:
      'Drag the group header to move the entire group and all its blocks together. Individual blocks inside a group can still be repositioned independently.',
    nestedTitle: 'Nested groups',
    nestedBody:
      'Groups cannot be nested. If you need hierarchical organisation, use separate groups with clear labels and position them near each other.',
  },

  savedGroups: {
    intro:
      'Saved groups (templates) let you save a group of blocks and their connections for reuse across projects.',
    saveTitle: 'Saving a group',
    saveBody:
      'Right-click a group and select Save as Template, or open the Saved Groups manager from the toolbar. Give it a descriptive name. The template stores the block types, positions, connections, and input values.',
    insertTitle: 'Inserting a saved group',
    insertBody:
      'Open the Saved Groups manager and click a template to insert it onto the current canvas. The blocks appear at the centre of the viewport. You can then move and connect them as needed.',
    manageTitle: 'Managing saved groups',
    manageBody:
      'The Saved Groups manager lists all your templates. You can rename, delete, or duplicate them. Templates are stored per account and available across all projects.',
    shareTitle: 'Sharing templates',
    shareBody:
      'To share a template with other users, publish it to Explore. See the Publish section for details.',
  },

  publish: {
    intro:
      'Publish your blocks, templates, and themes to the Explore marketplace so other users can install and use them.',
    howTitle: 'How to publish',
    step1: 'Open your project and ensure it is saved.',
    step2: 'Go to File > Publish to open the publishing dialog.',
    step3: 'Fill in the title, description, category, and tags.',
    step4: 'Submit for review. Once approved, your item appears in Explore.',
    typesTitle: 'What you can publish',
    typesBody:
      'Templates (full canvas examples), block packs (reusable groups of blocks), and themes (visual styles). Each type has its own category in Explore.',
    tip: 'Tip: Add clear descriptions and tags to help users find your published items.',
  },

  explore: {
    intro:
      'Explore is the community marketplace where you can discover templates, block packs, and themes created by other users.',
    browseTitle: 'Browsing',
    browseBody:
      'Visit the Explore page from the main navigation. Filter by category (templates, block packs, themes) or search by keyword. Each item shows a preview, description, author, and compatibility badge.',
    installTitle: 'Installing items',
    installBody:
      'Click an item to see details, then press Install. Templates create a new canvas in your project. Block packs add reusable blocks to your library. Themes change the visual style of your workspace.',
    ratingsTitle: 'Ratings and reviews',
    ratingsBody:
      'Rate items you have installed to help the community identify the best content. Your reviews are public and attributed to your display name.',
  },

  exports: {
    intro:
      'Export your work for sharing, archival, or integration with other tools. Export features require a Pro subscription.',
    pdfTitle: 'Audit PDF',
    pdfBody:
      'File > Export > Audit PDF generates a formatted calculation report. The PDF includes all block values, connection diagrams, and a step-by-step calculation trace. Suitable for engineering sign-off and peer review.',
    excelTitle: 'Excel export',
    excelBody:
      'File > Export > Excel creates a structured .xlsx workbook with one worksheet per canvas. Each row contains a block name, its inputs, and its computed output. Formulas are preserved where possible.',
    jsonTitle: 'Project file',
    jsonBody:
      'File > Export > Project saves the full project as a .chainsolvejson file. This portable format includes all canvases, variables, and settings. Use it for backup or to share projects with colleagues.',
    tip: 'Tip: The project file format is versioned. Older files can always be opened by newer versions of ChainSolve.',
  },

  settingsThemes: {
    intro:
      'ChainSolve settings are split into Account Settings (profile, billing, security) and App Settings (general preferences, canvas behaviour, display values, performance, and themes).',
    accountTitle: 'Account settings',
    accountBody:
      'Profile: change your display name and avatar. Billing: manage your subscription, view invoices, and upgrade or downgrade. Security: change your password and manage sessions.',
    generalTitle: 'General',
    generalBody:
      'Language selection, auto-save toggle and delay, and default export format. Changes apply immediately across all open projects.',
    canvasTitle: 'Canvas',
    canvasBody:
      'Snap-to-grid toggle and animated chains toggle. Snap-to-grid aligns blocks to a grid when you move them, which helps keep layouts tidy.',
    valuesTitle: 'Values',
    valuesBody:
      'Decimal places (auto or fixed 0-12), scientific notation threshold, and thousands separator. These settings affect how numeric results are displayed in blocks and the inspector.',
    perfTitle: 'Performance',
    perfBody:
      'Level-of-detail rendering: when enabled, the engine simplifies block rendering when you are zoomed out far, improving frame rate on large canvases.',
    themeTitle: 'Themes',
    themeBody:
      'Switch between dark and light mode. Open the Theme Wizard to customise colours, or install community themes from Explore. Custom themes override individual CSS variables on top of the base dark or light mode.',
    wizardTitle: 'Theme Wizard',
    wizardBody:
      'The Theme Wizard (Pro) lets you edit every colour token in the UI: backgrounds, text, accents, nodes, chains, and more. Start from a built-in preset (Midnight Blue, Warm Sunset, Forest Green, Glass Panels, Clean Paper) or create your own from scratch. Save your theme and optionally publish it to Explore.',
  },

  ai: {
    intro:
      'The AI assistant helps you build and modify calculation chains using natural language. It is available on Pro and Enterprise plans.',
    openTitle: 'Opening the assistant',
    openBody:
      'Click the AI button in the canvas toolbar, or use Tools > Build with AI from the menu. The assistant opens in a docked side panel.',
    modeTitle: 'Mode selector',
    modeBody:
      'Choose a mode from the dropdown at the top of the panel. Plan mode shows proposed changes without applying them. Edit mode applies changes automatically (with confirmation for risky operations). Bypass mode (Enterprise only) applies changes without confirmation.',
    chatTitle: 'Chat interface',
    chatBody:
      'Type your request in the message box and press Enter or click Send. The assistant responds with a message and, when appropriate, proposes patch operations to add, modify, or remove blocks and chains. You can review proposed changes before applying them.',
    capabilitiesTitle: 'What the assistant can do',
    cap1: "Generate blocks and connections from a text description (e.g. 'calculate beam deflection for a simply supported beam').",
    cap2: 'Modify existing blocks: update values, rename, reconnect, or remove.',
    cap3: 'Create variables, custom materials, and custom function blocks.',
    cap4: 'Answer questions about engineering formulas, units, and best practices.',
    privacyTitle: 'Privacy',
    privacyBody:
      'Your prompts are sent to the AI provider for processing but are not stored. The assistant never accesses other projects or user data beyond the current canvas.',
    tip: 'Tip: Be specific in your prompts. Include the relevant variables, units, and constraints for the best results.',
  },

  shortcuts: {
    intro: 'Keyboard shortcuts for common actions. On Mac, replace Ctrl with Cmd.',
    generalTitle: 'General',
    save: 'Save the current project',
    undo: 'Undo the last action',
    redo: 'Redo the last undone action',
    palette: 'Open the command palette',
    delete: 'Delete selected blocks or chains',
    escape:
      'Deselect all blocks and chains, close any open popover or modal, or cancel the current drag operation.',
    canvasTitle: 'Canvas',
    group: 'Group selected blocks (Pro)',
    duplicate: 'Duplicate selected blocks',
    selectAll: 'Select all blocks',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fitView: 'Fit canvas to view',
    openLibrary:
      'Open the block library panel. Also available by double-clicking an empty area of the canvas.',
    openVariables: 'Open or close the Variables side panel.',
    openAi: 'Open or close the AI assistant side panel (Pro and Enterprise plans).',
    openHelp: 'Open the help and documentation panel.',
    toggleMinimap:
      "Toggle the minimap overlay in the bottom-right corner of the canvas. The minimap shows a bird's-eye view of the entire canvas with a viewport indicator.",
    alignLeft:
      "Align all selected blocks to the leftmost block's x-coordinate. Requires two or more selected blocks.",
    alignTop:
      "Align all selected blocks to the topmost block's y-coordinate. Requires two or more selected blocks.",
  },

  trouble: {
    intro: 'Common issues and how to resolve them.',
    nanTitle: 'NaN in results',
    nanBody:
      'NaN (Not a Number) appears when an operation produces an undefined result, such as dividing zero by zero or taking the square root of a negative number. Check your inputs and ensure they are within the valid domain for the operation.',
    cycleTitle: 'Cycle detected',
    cycleBody:
      'The engine does not allow circular dependencies. If you see a cycle error, trace back from the highlighted blocks and remove the chain that creates the loop.',
    slowTitle: 'Slow evaluation',
    slowBody:
      'Large canvases with many blocks may take longer to evaluate. Try splitting complex chains across multiple canvases. The engine evaluates incrementally, so only changed paths are recomputed.',
    saveTitle: 'Save errors',
    saveBody:
      'If auto-save fails, check your internet connection. You can also save manually with Ctrl+S. If the problem persists, export your project as a .chainsolvejson backup.',
    proTitle: 'Pro features locked',
    proBody:
      'Blocks marked with Pro (plots, lists, CSV import, groups) require an active Pro subscription. Upgrade from Settings > Billing.',
    unitsTitle: 'Unit mismatch warnings',
    unitsBody:
      'A unit mismatch warning appears when you connect two blocks with incompatible dimensions (e.g. a mass output to a length input). The engine cannot convert between unrelated dimensions. To resolve: open the unit picker on the source or target block and assign compatible units, or remove the unit assignment entirely if the value is dimensionless. If you see unexpected conversion factors, verify that both blocks are assigned to the correct dimension and unit.',
    offlineTitle: 'Offline / network issues',
    offlineBody:
      'ChainSolve runs its calculation engine entirely in your browser, so computations continue to work offline. However, saving to the cloud, loading projects, and AI features require an internet connection. If you lose connectivity: your work is cached locally and will sync automatically when the connection is restored. A yellow banner appears at the top of the canvas when the app detects you are offline. If saving repeatedly fails after reconnecting, try refreshing the page.',
    importTitle: 'Import file errors',
    importBody:
      'If importing a .chainsolvejson file fails, check the following: (1) the file is valid JSON — open it in a text editor and look for syntax errors; (2) the file was exported from ChainSolve (third-party JSON files are not supported); (3) the file version is compatible — very old export formats may require updating ChainSolve first. For CSV imports, ensure the file is UTF-8 encoded, uses commas as delimiters, and does not exceed the 50 MB size limit.',
    browserTitle: 'Browser compatibility',
    browserBody:
      'ChainSolve requires a modern browser with WebAssembly support. Supported browsers: Chrome 90+, Firefox 90+, Safari 15+, Edge 90+. If you experience rendering glitches or missing features: (1) update your browser to the latest version; (2) disable browser extensions that modify page content (ad blockers, dark-mode extensions); (3) ensure hardware acceleration is enabled in your browser settings. Internet Explorer is not supported.',
    contactTitle: 'Contact support',
    contactBody:
      'If you cannot resolve an issue, use Help > Bug Report to send a detailed report including screenshots and diagnostics. You can also email support directly.',
  },
}
