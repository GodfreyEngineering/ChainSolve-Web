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
    contactTitle: 'Contact support',
    contactBody:
      'If you cannot resolve an issue, use Help > Bug Report to send a detailed report including screenshots and diagnostics. You can also email support directly.',
  },
}
