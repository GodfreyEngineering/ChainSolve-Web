/**
 * videoWalkthroughs.ts
 *
 * Catalog of 5-minute video walkthroughs for each ChainSolve feature area.
 * Videos are embedded inline in the DocsSearchWindow when a user opens
 * a help topic with an associated walkthrough.
 *
 * Each VideoWalkthrough has:
 * - A unique id matching the feature area
 * - A YouTube video ID (populated once the video is produced)
 * - Duration string for display
 * - Chapter markers for in-video navigation
 *
 * Placeholder video IDs (prefixed "PLACEHOLDER_") are used until real recordings
 * are uploaded. The VideoEmbed component hides itself when the ID is a placeholder.
 */

export interface VideoChapter {
  /** Timestamp in seconds from the start of the video */
  t: number
  label: string
}

export interface VideoWalkthrough {
  id: string
  /** Feature area / docs section this video belongs to */
  featureArea: string
  title: string
  description: string
  /** YouTube video ID (or PLACEHOLDER_<id> until recorded) */
  youtubeId: string
  durationLabel: string
  chapters: VideoChapter[]
  /** Tags for search */
  tags: string[]
}

export const VIDEO_WALKTHROUGHS: VideoWalkthrough[] = [
  // ── Getting Started ────────────────────────────────────────────────────
  {
    id: 'intro-first-chain',
    featureArea: 'Getting started',
    title: 'Your First Calculation Chain (5 min)',
    description:
      'Build a live calculation from scratch: add number blocks, connect them, and see results update in real time. Covers block library, connections, and the Display block.',
    youtubeId: 'PLACEHOLDER_intro_first_chain',
    durationLabel: '5:00',
    chapters: [
      { t: 0, label: 'Opening ChainSolve' },
      { t: 30, label: 'Adding number blocks' },
      { t: 90, label: 'Connecting blocks' },
      { t: 160, label: 'Using the Display block' },
      { t: 220, label: 'Editing values live' },
    ],
    tags: ['getting started', 'beginner', 'first chain', 'tutorial'],
  },
  {
    id: 'intro-variables',
    featureArea: 'Getting started',
    title: 'Variables & Parametric Studies (5 min)',
    description:
      'Create named variables, bind them to block inputs, and use sliders to explore your design space interactively.',
    youtubeId: 'PLACEHOLDER_intro_variables',
    durationLabel: '5:00',
    chapters: [
      { t: 0, label: 'Opening the Variables panel' },
      { t: 45, label: 'Creating a variable' },
      { t: 100, label: 'Binding to a block input' },
      { t: 165, label: 'Setting slider range' },
      { t: 240, label: 'Parametric sweep' },
    ],
    tags: ['variables', 'slider', 'parametric', 'design space'],
  },

  // ── ODE Solvers ────────────────────────────────────────────────────────
  {
    id: 'ode-solvers',
    featureArea: 'Simulation',
    title: 'ODE Solvers: RK4 & RK45 (5 min)',
    description:
      'Simulate a spring-mass system with RK4. Switch to RK45 for adaptive step control. Compare stability and accuracy. Export time-series results to a plot.',
    youtubeId: 'PLACEHOLDER_ode_solvers',
    durationLabel: '5:00',
    chapters: [
      { t: 0, label: 'Setting up an ODE block' },
      { t: 60, label: 'Configuring RK4 step size' },
      { t: 120, label: 'Switching to RK45 adaptive' },
      { t: 200, label: 'Plotting the time series' },
      { t: 260, label: 'Stiff problems: when to use BDF' },
    ],
    tags: ['ODE', 'RK4', 'RK45', 'differential equations', 'simulation', 'spring mass'],
  },

  // ── Optimisation ──────────────────────────────────────────────────────
  {
    id: 'optimisation-nsga2',
    featureArea: 'Optimisation',
    title: 'Multi-Objective Optimisation with NSGA-II (5 min)',
    description:
      'Set up a two-objective design problem, configure NSGA-II, and interpret the Pareto front. Covers population size, generations, and result export.',
    youtubeId: 'PLACEHOLDER_optimisation_nsga2',
    durationLabel: '5:10',
    chapters: [
      { t: 0, label: 'Framing the optimisation problem' },
      { t: 55, label: 'Adding the NSGA-II block' },
      { t: 120, label: 'Configuring objectives and constraints' },
      { t: 185, label: 'Running and reading the Pareto front' },
      { t: 260, label: 'Exporting results' },
    ],
    tags: ['NSGA-II', 'multi-objective', 'Pareto', 'genetic algorithm', 'optimisation'],
  },
  {
    id: 'optimisation-lp',
    featureArea: 'Optimisation',
    title: 'Linear Programming (Simplex) in 5 Minutes',
    description:
      'Formulate a linear program (production planning), solve with the Simplex block, and read the optimal vertex from the output.',
    youtubeId: 'PLACEHOLDER_optimisation_lp',
    durationLabel: '4:55',
    chapters: [
      { t: 0, label: 'What is LP?' },
      { t: 40, label: 'Building the constraint matrix' },
      { t: 110, label: 'Connecting the LP Solve block' },
      { t: 185, label: 'Reading the result' },
      { t: 245, label: 'Sensitivity analysis' },
    ],
    tags: ['linear programming', 'LP', 'simplex', 'constraints', 'optimisation'],
  },

  // ── Neural Networks / ML ───────────────────────────────────────────────
  {
    id: 'ml-neural-network',
    featureArea: 'Machine Learning',
    title: 'Training a Neural Network in ChainSolve (5 min)',
    description:
      'Build a 2-layer sequential network, load training data from a CSV table, train with backpropagation, and visualise the loss curve.',
    youtubeId: 'PLACEHOLDER_ml_neural_network',
    durationLabel: '5:20',
    chapters: [
      { t: 0, label: 'Adding Dense layers' },
      { t: 70, label: 'Loading training data' },
      { t: 140, label: 'Configuring loss and learning rate' },
      { t: 200, label: 'Running training' },
      { t: 270, label: 'Inspecting the loss curve' },
    ],
    tags: ['neural network', 'deep learning', 'training', 'backprop', 'ML', 'dense layers'],
  },
  {
    id: 'ml-regression',
    featureArea: 'Machine Learning',
    title: 'Linear & Polynomial Regression (5 min)',
    description:
      'Fit a dataset with linear and polynomial regression blocks. Compare R² scores. Use the model for prediction on new inputs.',
    youtubeId: 'PLACEHOLDER_ml_regression',
    durationLabel: '4:50',
    chapters: [
      { t: 0, label: 'Importing data' },
      { t: 50, label: 'Linear regression block' },
      { t: 120, label: 'Polynomial degree sweep' },
      { t: 185, label: 'Reading R² and residuals' },
      { t: 240, label: 'Prediction on new inputs' },
    ],
    tags: ['regression', 'linear regression', 'polynomial', 'R-squared', 'prediction', 'ML'],
  },

  // ── Automatic Differentiation ──────────────────────────────────────────
  {
    id: 'autodiff',
    featureArea: 'Automatic Differentiation',
    title: 'Automatic Differentiation: Gradients on Any Graph (5 min)',
    description:
      'Enable AD on any computation graph. Wire the gradient output to visualise sensitivities, drive gradient descent, or verify your analytical derivatives.',
    youtubeId: 'PLACEHOLDER_autodiff',
    durationLabel: '5:05',
    chapters: [
      { t: 0, label: 'What is automatic differentiation?' },
      { t: 45, label: 'Enabling AD mode on a graph' },
      { t: 110, label: 'Reading gradient outputs' },
      { t: 170, label: 'Gradient descent example' },
      { t: 240, label: 'Forward vs reverse mode' },
    ],
    tags: ['autodiff', 'automatic differentiation', 'gradient', 'AD', 'backprop', 'sensitivity'],
  },

  // ── Signal Processing ──────────────────────────────────────────────────
  {
    id: 'signal-fft',
    featureArea: 'Signal Processing',
    title: 'FFT & Spectral Analysis (5 min)',
    description:
      'Import a time-series signal, apply FFT, select a window function, and identify dominant frequencies. Export the spectrum to a magnitude plot.',
    youtubeId: 'PLACEHOLDER_signal_fft',
    durationLabel: '4:55',
    chapters: [
      { t: 0, label: 'Generating a test signal' },
      { t: 50, label: 'FFT block configuration' },
      { t: 110, label: 'Choosing a window (Hann/Hamming)' },
      { t: 175, label: 'Plotting the magnitude spectrum' },
      { t: 235, label: 'Identifying peaks' },
    ],
    tags: ['FFT', 'signal', 'spectrum', 'frequency', 'Hann window', 'spectral analysis'],
  },

  // ── Vehicle Simulation ────────────────────────────────────────────────
  {
    id: 'vehicle-lap-sim',
    featureArea: 'Vehicle Dynamics',
    title: 'Lap Simulation with Pacejka Tire Model (5 min)',
    description:
      'Configure a Pacejka Magic Formula tire, set up a quarter-car suspension, and run a lap simulation. Analyse G-G diagram and lap time sensitivity.',
    youtubeId: 'PLACEHOLDER_vehicle_lap_sim',
    durationLabel: '5:15',
    chapters: [
      { t: 0, label: 'Pacejka tire block setup' },
      { t: 75, label: 'Quarter-car suspension' },
      { t: 155, label: 'Lap sim configuration' },
      { t: 220, label: 'Reading the G-G diagram' },
      { t: 280, label: 'Lap time sensitivity sweep' },
    ],
    tags: ['vehicle', 'Pacejka', 'tire model', 'lap simulation', 'G-G diagram', 'suspension'],
  },

  // ── Collaboration ──────────────────────────────────────────────────────
  {
    id: 'collaboration',
    featureArea: 'Collaboration',
    title: 'Real-Time Collaboration (5 min)',
    description:
      'Invite a teammate to your project, edit blocks simultaneously, resolve conflicts, and use the version history to review changes.',
    youtubeId: 'PLACEHOLDER_collaboration',
    durationLabel: '5:00',
    chapters: [
      { t: 0, label: 'Sharing a project' },
      { t: 60, label: 'Simultaneous editing' },
      { t: 130, label: 'Conflict resolution' },
      { t: 195, label: 'Version history panel' },
      { t: 255, label: 'Comments and review' },
    ],
    tags: ['collaboration', 'real-time', 'sharing', 'version history', 'multi-user', 'Yjs'],
  },

  // ── Export & Reporting ────────────────────────────────────────────────
  {
    id: 'export-pdf',
    featureArea: 'Export',
    title: 'Generating Audit-Trail PDFs (5 min)',
    description:
      'Export a calculation as a traceable PDF report with block values, formula audit trail, SHA-256 integrity hash, and regulatory context.',
    youtubeId: 'PLACEHOLDER_export_pdf',
    durationLabel: '4:50',
    chapters: [
      { t: 0, label: 'File → Export → Audit PDF' },
      { t: 50, label: 'Configuring report sections' },
      { t: 120, label: 'Reading the audit trail' },
      { t: 185, label: 'SHA-256 integrity hash' },
      { t: 230, label: 'Solver verification report' },
    ],
    tags: ['PDF', 'export', 'audit', 'report', 'integrity', 'SHA-256', 'regulatory'],
  },

  // ── FMU Export ────────────────────────────────────────────────────────
  {
    id: 'fmu-export',
    featureArea: 'FMI / FMU',
    title: 'Exporting an FMU (FMI 2.0 Co-Simulation) (5 min)',
    description:
      'Wrap a ChainSolve block as an FMI 2.0 Co-Simulation FMU. Export the modelDescription.xml and C stub, then import into OpenModelica or Simulink.',
    youtubeId: 'PLACEHOLDER_fmu_export',
    durationLabel: '5:10',
    chapters: [
      { t: 0, label: 'FMU Export block setup' },
      { t: 60, label: 'Configuring inputs and outputs' },
      { t: 130, label: 'Generating modelDescription.xml' },
      { t: 200, label: 'Building the FMU package' },
      { t: 265, label: 'Importing into OpenModelica' },
    ],
    tags: ['FMU', 'FMI', 'Co-Simulation', 'modelDescription', 'OpenModelica', 'Simulink', 'export'],
  },

  // ── GPU Compute ───────────────────────────────────────────────────────
  {
    id: 'gpu-gemm',
    featureArea: 'GPU Compute',
    title: 'WebGPU Matrix Multiply: 1000×1000 in the Browser (5 min)',
    description:
      'Enable WebGPU, wire a GPU GEMM block, benchmark against the CPU path, and understand when hybrid compute routes to the GPU automatically.',
    youtubeId: 'PLACEHOLDER_gpu_gemm',
    durationLabel: '5:05',
    chapters: [
      { t: 0, label: 'Checking WebGPU support' },
      { t: 60, label: 'GPU GEMM block' },
      { t: 130, label: 'Benchmark output' },
      { t: 200, label: 'Hybrid compute routing' },
      { t: 265, label: 'When to use GPU vs CPU' },
    ],
    tags: ['WebGPU', 'GPU', 'GEMM', 'matrix multiply', 'benchmark', 'hybrid compute', 'performance'],
  },

  // ── Block SDK ────────────────────────────────────────────────────────
  {
    id: 'block-sdk',
    featureArea: 'Block SDK',
    title: 'Writing a Custom WASM Block (5 min)',
    description:
      'Author a custom computation block in Rust using the chainsolve-block-sdk, compile to WASM, and load it into ChainSolve as a plugin.',
    youtubeId: 'PLACEHOLDER_block_sdk',
    durationLabel: '5:20',
    chapters: [
      { t: 0, label: 'Setting up the SDK crate' },
      { t: 70, label: 'Implementing BlockDef' },
      { t: 145, label: 'Using export_blocks! macro' },
      { t: 210, label: 'Compiling to WASM' },
      { t: 265, label: 'Loading the plugin in-app' },
    ],
    tags: ['block SDK', 'custom block', 'plugin', 'WASM', 'Rust', 'export_blocks'],
  },
]

/** Look up a walkthrough by feature area. */
export function getWalkthroughForArea(featureArea: string): VideoWalkthrough | undefined {
  return VIDEO_WALKTHROUGHS.find(
    (v) => v.featureArea.toLowerCase() === featureArea.toLowerCase(),
  )
}

/** Look up a walkthrough by its unique id. */
export function getWalkthroughById(id: string): VideoWalkthrough | undefined {
  return VIDEO_WALKTHROUGHS.find((v) => v.id === id)
}

/** Full-text search across title, description, and tags. */
export function searchWalkthroughs(query: string): VideoWalkthrough[] {
  const q = query.toLowerCase()
  return VIDEO_WALKTHROUGHS.filter(
    (v) =>
      v.title.toLowerCase().includes(q) ||
      v.description.toLowerCase().includes(q) ||
      v.featureArea.toLowerCase().includes(q) ||
      v.tags.some((tag) => tag.toLowerCase().includes(q)),
  )
}

/** Returns true if the video ID is a placeholder (not yet recorded). */
export function isPlaceholder(youtubeId: string): boolean {
  return youtubeId.startsWith('PLACEHOLDER_')
}
