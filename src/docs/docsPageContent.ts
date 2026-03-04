/**
 * docsPageContent.ts — Documentation body text for the /docs page (I1-1).
 *
 * Content lives here (not in locale JSON) so it is tree-shaken into the
 * lazy DocsPage chunk and does not inflate the initial JS bundle.
 * Sidebar labels remain in the locale files for i18n.
 */

/* eslint-disable @typescript-eslint/naming-convention */

export interface DocsSectionContent {
  [key: string]: string
}

export interface DocsContentMap {
  [section: string]: DocsSectionContent
}

export const DOCS_CONTENT: DocsContentMap = {
  onboarding: {
    intro:
      'Welcome to ChainSolve. This guide covers everything you need to go from zero to a working calculation chain.',
    whatIsTitle: 'What is ChainSolve?',
    whatIsBody:
      'ChainSolve is a visual calculation engine for engineers, scientists, and students. Instead of writing formulas in cells, you connect blocks on a canvas. Each block does one thing — a number, an operation, a display — and values flow through edges in real time. Change any input and every downstream result updates instantly.',
    firstCanvasTitle: 'Creating your first canvas',
    step1: 'Open a project or click Scratch Canvas on the home page.',
    step2: 'Open the block library from the Insert menu or the sidebar.',
    step3: 'Drag a Number block onto the canvas and set its value.',
    step4: 'Add an operation block (e.g. Add) and connect the Number output to one of its inputs.',
    step5:
      'Add a Display block and connect the operation output to it. The result appears immediately.',
    connectingTitle: 'Connecting blocks',
    connectingBody:
      'Drag from an output port (right side) to an input port (left side) to create an edge. Values propagate automatically through edges. You can disconnect an edge by selecting it and pressing Delete.',
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
      'Second moment of area, bending stress, section modulus, and related cross-section calculations for rectangular, circular, and annular profiles.',
    fluidsTitle: 'Fluids',
    fluidsBody: "Reynolds number, Bernoulli's equation, pipe flow, and viscosity calculations.",
    thermoTitle: 'Thermodynamics',
    thermoBody: 'Ideal gas law, heat transfer (conduction, convection), and thermal expansion.',
    electricalTitle: 'Electrical',
    electricalBody:
      "Ohm's law, power dissipation, series and parallel resistance, and capacitance.",
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
    rule72: 'Estimates the number of periods to double an investment: 72 / r.',
    returnsTitle: 'Returns and Risk',
    returnsBody: 'CAGR, Sharpe ratio, and other performance metrics for portfolio analysis.',
    deprTitle: 'Depreciation',
    deprBody: 'Straight-line and declining-balance depreciation methods.',
  },

  blockStats: {
    intro:
      'Statistics blocks cover descriptive statistics, regression, correlation, combinatorics, and probability distributions.',
    descTitle: 'Descriptive Statistics',
    descBody:
      'Summary statistics for a set of data points. Connect up to 6 values (x1 through x6) and a count.',
    mean: 'Arithmetic mean of the input values.',
    stddev: 'Standard deviation (population).',
    median: 'Middle value when sorted.',
    variance: 'Variance (population).',
    relTitle: 'Relationships',
    relBody: 'Linear regression slope and intercept, Pearson correlation, and covariance.',
    probTitle: 'Probability and Combinatorics',
    probBody:
      'Permutations, combinations, factorial, and standard probability distributions (normal, binomial).',
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
    mathBody: "Pi, Euler's number (e), golden ratio, and other fundamental mathematical constants.",
    physicsTitle: 'Physics Constants',
    physicsBody:
      "Speed of light, gravitational constant, Planck's constant, Boltzmann constant, and more.",
    atmoTitle: 'Atmospheric Constants',
    atmoBody:
      'Standard atmospheric pressure, sea-level temperature, and air density at standard conditions.',
    thermoTitle: 'Thermodynamic Constants',
    thermoBody:
      'Universal gas constant, Stefan-Boltzmann constant, and related thermodynamic reference values.',
    elecTitle: 'Electrical Constants',
    elecBody:
      'Vacuum permittivity, vacuum permeability, electron charge, and other electromagnetic constants.',
  },

  blockAnnot: {
    intro:
      'Annotation blocks add visual notes and labels to your canvas without affecting computation.',
    text: 'Floating text label. Use for titles, section headers, or notes.',
    callout: 'Bordered callout box for longer notes and explanations.',
    highlight: 'Coloured background region to visually group related blocks.',
    arrow: 'Directional arrow for pointing at or connecting visual elements.',
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
    customTitle: 'Custom materials',
    customBody:
      'Create custom material definitions with your own property values. Custom materials are saved to your project and can be reused across canvases.',
    fluidsTitle: 'Fluid presets',
    fluidsBody:
      'Built-in fluid definitions for water, air, oil, and other common fluids. Properties include density, dynamic viscosity, and kinematic viscosity at standard conditions.',
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

  ai: {
    intro:
      'The AI assistant helps you build and understand calculation chains using natural language.',
    openTitle: 'Opening the assistant',
    openBody:
      'Click the AI button in the canvas toolbar, or use Tools > Build with AI from the menu. The assistant opens in a side panel.',
    capabilitiesTitle: 'What the assistant can do',
    cap1: "Generate blocks and connections from a text description (e.g. 'calculate beam deflection for a simply supported beam').",
    cap2: 'Explain what a selected chain of blocks computes and why.',
    cap3: 'Suggest improvements or alternative approaches to your calculation.',
    cap4: 'Answer questions about engineering formulas, units, and best practices.',
    tip: 'Tip: Be specific in your prompts. Include the relevant variables, units, and constraints for the best results.',
  },

  shortcuts: {
    intro: 'Keyboard shortcuts for common actions. On Mac, replace Ctrl with Cmd.',
    generalTitle: 'General',
    save: 'Save the current project',
    undo: 'Undo the last action',
    redo: 'Redo the last undone action',
    palette: 'Open the command palette',
    delete: 'Delete selected blocks or edges',
    canvasTitle: 'Canvas',
    group: 'Group selected blocks (Pro)',
    duplicate: 'Duplicate selected blocks',
    selectAll: 'Select all blocks',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fitView: 'Fit canvas to view',
  },

  trouble: {
    intro: 'Common issues and how to resolve them.',
    nanTitle: 'NaN in results',
    nanBody:
      'NaN (Not a Number) appears when an operation produces an undefined result, such as dividing zero by zero or taking the square root of a negative number. Check your inputs and ensure they are within the valid domain for the operation.',
    cycleTitle: 'Cycle detected',
    cycleBody:
      'The engine does not allow circular dependencies. If you see a cycle error, trace back from the highlighted blocks and remove the edge that creates the loop.',
    slowTitle: 'Slow evaluation',
    slowBody:
      'Large canvases with many blocks may take longer to evaluate. Try splitting complex chains across multiple canvases. The engine evaluates incrementally, so only changed paths are recomputed.',
    saveTitle: 'Save errors',
    saveBody:
      'If auto-save fails, check your internet connection. You can also save manually with Ctrl+S. If the problem persists, export your project as a .chainsolvejson backup.',
    proTitle: 'Pro features locked',
    proBody:
      'Blocks marked with Pro (plots, lists, CSV import, groups) require an active Pro subscription. Upgrade from Settings > Billing.',
    contactTitle: 'Contact support',
    contactBody:
      'If you cannot resolve an issue, use Help > Bug Report to send a detailed report including screenshots and diagnostics. You can also email support directly.',
  },
}
