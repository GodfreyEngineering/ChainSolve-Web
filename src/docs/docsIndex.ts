/**
 * docsIndex.ts — Static local index of help topics for the in-app docs search.
 *
 * No network requests. All content is bundled at build time.
 * Each entry maps to a topic that the user can search for.
 * The `href` field (if present) opens the relevant section in the external
 * docs site; entries without an href show the description inline only.
 */

export interface DocsEntry {
  id: string
  section: string
  title: string
  description: string
  keywords: string[]
}

export const DOCS_INDEX: DocsEntry[] = [
  // ── Quick guides ───────────────────────────────────────────────────────
  {
    id: 'qg-ten-nodes',
    section: 'Quick guides',
    title: '10 nodes in 2 minutes',
    description:
      '1) Add two Number blocks. 2) Add an Add block — connect both numbers into it. 3) Add a Multiply block — connect the sum into it, then add a third Number as the multiplier. 4) Add a Display block to see the result. 5) Duplicate this pattern: Subtract → Divide → Display. You now have 10 blocks forming a live calculation chain. Edit any number to see every result update instantly.',
    keywords: [
      'quick start',
      'tutorial',
      'first',
      'beginner',
      'walkthrough',
      '10 nodes',
      'two minutes',
    ],
  },
  {
    id: 'qg-variables',
    section: 'Quick guides',
    title: 'Variables & constants',
    description:
      'Open the Variables panel (View menu) to create named values. A variable can be bound to any block input — change the variable once and every bound input updates. Set min/max/step to get a slider for interactive exploration. Use constants (gravity, π, e) by typing the name into a Number block.',
    keywords: [
      'variable',
      'constant',
      'bind',
      'slider',
      'named value',
      'pi',
      'gravity',
      'parameter',
    ],
  },
  {
    id: 'qg-exports',
    section: 'Quick guides',
    title: 'Exports (Pro)',
    description:
      'Pro users can export their work in three formats: File → Export → Audit PDF for a formatted calculation report, File → Export → Excel for a structured .xlsx workbook with one sheet per canvas, and File → Export → Project for a portable .chainsolvejson backup. Free-tier users can view results on-screen but exports require a Pro subscription.',
    keywords: ['export', 'pdf', 'excel', 'json', 'pro', 'download', 'report', 'backup'],
  },
  {
    id: 'qg-explore',
    section: 'Quick guides',
    title: 'Installing from Explore',
    description:
      'Browse the Explore page to find community templates, block packs, and themes. Click an item to see details, then press Install to add it to your project. Templates create a new canvas; block packs add reusable blocks to your library. Check the compatibility badge to ensure the item works with your engine version.',
    keywords: ['explore', 'marketplace', 'install', 'template', 'block pack', 'theme', 'community'],
  },

  // ── Getting Started ──────────────────────────────────────────────────────
  {
    id: 'gs-overview',
    section: 'Getting started',
    title: 'What is ChainSolve?',
    description:
      'ChainSolve is a visual calculation engine. Connect blocks to build live calculation chains without writing code.',
    keywords: ['intro', 'overview', 'what is', 'start', 'welcome'],
  },
  {
    id: 'gs-first-canvas',
    section: 'Getting started',
    title: 'Create your first canvas',
    description:
      'Open a project, click "+ Canvas", then drag blocks from the sidebar onto the canvas and connect them.',
    keywords: ['create', 'new canvas', 'first', 'tutorial', 'begin', 'start'],
  },
  {
    id: 'gs-connect',
    section: 'Getting started',
    title: 'Connecting blocks',
    description:
      'Drag from an output port (right side of a block) to an input port (left side). A live chain appears and values update immediately.',
    keywords: ['connect', 'chain', 'wire', 'port', 'link', 'drag'],
  },
  {
    id: 'gs-templates',
    section: 'Getting started',
    title: 'Starting from a template',
    description:
      'Use Insert → Template to load a pre-built example (Physics 101, Finance 101, Stats 101).',
    keywords: ['template', 'example', 'sample', 'starter', 'physics', 'finance', 'stats'],
  },

  // ── Blocks ───────────────────────────────────────────────────────────────
  {
    id: 'block-number',
    section: 'Blocks',
    title: 'Number block',
    description:
      'Emits a constant scalar. Double-click the value to edit. Use as a source for any calculation.',
    keywords: ['number', 'constant', 'input', 'source', 'scalar', 'value'],
  },
  {
    id: 'block-display',
    section: 'Blocks',
    title: 'Display block',
    description:
      'Shows the computed result. Supports scalars, vectors, and tables. Click the expand icon to see full precision.',
    keywords: ['display', 'output', 'result', 'show', 'view', 'read'],
  },
  {
    id: 'block-math',
    section: 'Blocks',
    title: 'Math operations',
    description:
      'Add, subtract, multiply, divide, power, abs, sin, cos, tan, atan2, clamp, round, and more.',
    keywords: ['math', 'add', 'subtract', 'multiply', 'divide', 'sin', 'cos', 'power', 'abs'],
  },
  {
    id: 'block-engineering',
    section: 'Blocks',
    title: 'Engineering blocks',
    description:
      "F=ma, KE=½mv², Reynolds number, bending stress, Ohm's law, ideal gas, heat transfer, and more.",
    keywords: [
      'engineering',
      'force',
      'kinetic energy',
      'reynolds',
      'stress',
      'ohm',
      'heat',
      'fluid',
    ],
  },
  {
    id: 'block-finance',
    section: 'Blocks',
    title: 'Finance blocks',
    description:
      'Compound future value, NPV, IRR, annuity, CAGR, Sharpe ratio, depreciation, and more.',
    keywords: ['finance', 'npv', 'irr', 'compound', 'annuity', 'cagr', 'sharpe', 'depreciation'],
  },
  {
    id: 'block-stats',
    section: 'Blocks',
    title: 'Statistics blocks',
    description:
      'Mean, standard deviation, median, mode, variance, linear regression, correlation, and more.',
    keywords: ['stats', 'statistics', 'mean', 'stddev', 'median', 'regression', 'correlation'],
  },
  {
    id: 'block-plot',
    section: 'Blocks',
    title: 'Plot blocks (Pro)',
    description:
      'Scatter, line, bar, and histogram plots. Connect a vector to the X and Y ports. Pro feature.',
    keywords: ['plot', 'chart', 'graph', 'scatter', 'bar', 'histogram', 'visualise'],
  },
  {
    id: 'block-vector',
    section: 'Blocks',
    title: 'Vector / Array blocks (Pro)',
    description:
      'Create and manipulate ordered sequences of numbers. Sum, sort, filter, and vectorised math.',
    keywords: ['vector', 'array', 'list', 'sequence', 'sum vector', 'sort'],
  },

  {
    id: 'block-annotations',
    section: 'Blocks',
    title: 'Annotation blocks',
    description:
      'Add non-computational blocks to document your canvas. Text blocks display rich text notes, Callout blocks highlight important information with colour-coded borders, Highlight blocks draw a coloured background behind a region, and Arrow blocks point between elements for visual clarity. Annotations do not affect calculations.',
    keywords: [
      'annotation',
      'text',
      'callout',
      'highlight',
      'arrow',
      'note',
      'label',
      'comment',
      'documentation',
    ],
  },
  {
    id: 'block-constants',
    section: 'Blocks',
    title: 'Constant blocks',
    description:
      'Insert commonly used constants directly into your canvas. Math constants include π, e, and the golden ratio. Physics constants include gravity (g), speed of light (c), and Boltzmann constant. Atmospheric constants include sea-level pressure, air density, and lapse rate. Electrical constants include vacuum permittivity and permeability.',
    keywords: [
      'constant',
      'pi',
      'gravity',
      'speed of light',
      'boltzmann',
      'atmospheric',
      'electrical',
      'permittivity',
      'golden ratio',
    ],
  },

  // ── Units ──────────────────────────────────────────────────────────────
  {
    id: 'units-overview',
    section: 'Units',
    title: 'Dimension support & automatic conversion',
    description:
      'ChainSolve tracks physical dimensions (length, mass, time, etc.) through chains. When two blocks use compatible units the engine converts automatically — for example, connecting a result in metres to an input expecting centimetres. Hover over a port to see its current unit. Use the unit picker on Number blocks to set or override units.',
    keywords: [
      'units',
      'dimensions',
      'conversion',
      'metres',
      'feet',
      'SI',
      'imperial',
      'unit picker',
      'automatic',
    ],
  },

  // ── Materials ─────────────────────────────────────────────────────────
  {
    id: 'materials-overview',
    section: 'Materials',
    title: 'Material presets & custom materials',
    description:
      "Use built-in material presets (steel, aluminium, concrete, water, air, etc.) or define custom materials with your own density, Young's modulus, thermal conductivity, and other properties. Fluid properties (viscosity, specific heat) are also available for fluids blocks. Select a material from the sidebar or create one in Project → Materials.",
    keywords: [
      'material',
      'preset',
      'custom',
      'density',
      'steel',
      'aluminium',
      'concrete',
      'fluid',
      'viscosity',
      'properties',
    ],
  },

  // ── Variables ────────────────────────────────────────────────────────────
  {
    id: 'var-overview',
    section: 'Variables',
    title: 'Using variables',
    description:
      'Variables let you name values and bind them to block inputs. Open the Variables panel from the View menu.',
    keywords: ['variable', 'binding', 'named value', 'slider', 'bind'],
  },
  {
    id: 'var-slider',
    section: 'Variables',
    title: 'Slider controls',
    description:
      'Set min/max/step on a variable to get a slider. Dragging it updates all bound inputs in real time.',
    keywords: ['slider', 'range', 'min', 'max', 'step', 'drag', 'interactive'],
  },

  // ── Canvas ───────────────────────────────────────────────────────────────
  {
    id: 'canvas-save',
    section: 'Canvas',
    title: 'Saving your work',
    description:
      'Canvases auto-save every 5 seconds. Press Ctrl+S (Cmd+S on Mac) to save immediately.',
    keywords: ['save', 'autosave', 'ctrl s', 'auto save', 'persist'],
  },
  {
    id: 'canvas-undo',
    section: 'Canvas',
    title: 'Undo / Redo',
    description: 'Press Ctrl+Z to undo and Ctrl+Y (or Ctrl+Shift+Z) to redo any canvas change.',
    keywords: ['undo', 'redo', 'ctrl z', 'ctrl y', 'history'],
  },
  {
    id: 'canvas-delete',
    section: 'Canvas',
    title: 'Deleting blocks and chains',
    description:
      'Select a block or chain and press Delete or Backspace. Hold Ctrl to multi-select and delete several at once.',
    keywords: ['delete', 'remove', 'backspace', 'erase', 'clear'],
  },
  {
    id: 'canvas-groups',
    section: 'Canvas',
    title: 'Block groups (Pro)',
    description:
      'Select multiple blocks and press Ctrl+G to group them. Groups can be collapsed to reduce clutter.',
    keywords: ['group', 'collapse', 'ctrl g', 'organise', 'cluster'],
  },
  {
    id: 'canvas-autoorganise',
    section: 'Canvas',
    title: 'Auto-organise layout',
    description:
      'Use View → Auto-organise layout to automatically arrange all blocks on the canvas.',
    keywords: ['auto organise', 'layout', 'arrange', 'tidy', 'reflow'],
  },
  {
    id: 'canvas-validate',
    section: 'Canvas',
    title: 'Graph health check',
    description:
      'Use View → Validate graph to see warnings about disconnected ports, NaN propagation, or cycle detection.',
    keywords: ['validate', 'health', 'check', 'warn', 'error', 'cycle', 'nan', 'disconnect'],
  },

  // ── Data ─────────────────────────────────────────────────────────────────
  {
    id: 'data-csv',
    section: 'Data',
    title: 'Importing CSV data (Pro)',
    description:
      'Click a CSV Import block to upload a .csv file up to 50 MB. The data is held in the browser; nothing is sent to a server.',
    keywords: ['csv', 'import', 'upload', 'data', 'table', 'file'],
  },

  // ── Export ───────────────────────────────────────────────────────────────
  {
    id: 'export-pdf',
    section: 'Export',
    title: 'Export to PDF',
    description:
      'File → Export → Audit PDF generates a formatted report including all block values, diagrams, and a calculation trace.',
    keywords: ['export', 'pdf', 'report', 'audit', 'print', 'download'],
  },
  {
    id: 'export-excel',
    section: 'Export',
    title: 'Export to Excel',
    description:
      'File → Export → Excel exports all results into a structured .xlsx file with one worksheet per canvas.',
    keywords: ['export', 'excel', 'xlsx', 'spreadsheet', 'download'],
  },
  {
    id: 'export-json',
    section: 'Export',
    title: 'Export project (JSON)',
    description:
      'File → Export → Project saves the full project including all canvases as a .chainsolvejson file for backup or sharing.',
    keywords: ['export', 'json', 'backup', 'project', 'share', 'chainsolvejson'],
  },

  // ── Shortcuts ────────────────────────────────────────────────────────────
  {
    id: 'shortcut-palette',
    section: 'Keyboard shortcuts',
    title: 'Command palette',
    description: 'Press Ctrl+K (Cmd+K) to open the command palette and search any menu action.',
    keywords: ['palette', 'command', 'ctrl k', 'search', 'shortcut'],
  },
  {
    id: 'shortcut-help',
    section: 'Keyboard shortcuts',
    title: 'All shortcuts',
    description: 'Help → Keyboard shortcuts shows all available keyboard shortcuts in one place.',
    keywords: ['shortcut', 'keyboard', 'hotkey', 'binding', 'all shortcuts'],
  },

  // ── AI assistant ────────────────────────────────────────────────────────
  {
    id: 'ai-overview',
    section: 'AI assistant',
    title: 'AI copilot — plan & edit modes',
    description:
      'The AI assistant helps you build and refine calculation chains. In Plan mode it suggests which blocks and connections to add based on your goal. In Edit mode it can modify existing blocks, rewire chains, and fix errors. Open the assistant from the toolbar or press Ctrl+Shift+A. The AI never modifies your canvas without confirmation.',
    keywords: [
      'ai',
      'copilot',
      'assistant',
      'plan mode',
      'edit mode',
      'suggest',
      'automate',
      'help',
      'smart',
    ],
  },

  // ── Publishing ────────────────────────────────────────────────────────
  {
    id: 'publish-overview',
    section: 'Publishing',
    title: 'Publish to Explore',
    description:
      'Share your work with the community by publishing canvases, block packs, or themes to Explore. Go to File → Publish, add a title and description, then submit for review. The review process typically takes 1–2 business days. Once approved, your item appears on the Explore page and other users can install it.',
    keywords: [
      'publish',
      'explore',
      'share',
      'community',
      'review',
      'submit',
      'marketplace',
      'public',
      'approve',
    ],
  },

  // ── Billing ──────────────────────────────────────────────────────────────
  {
    id: 'billing-plans',
    section: 'Billing & plans',
    title: 'Free vs Pro plan',
    description:
      'Free: 1 project, 2 canvases. Pro: unlimited projects, canvases, CSV import, arrays, plots, groups.',
    keywords: ['plan', 'free', 'pro', 'upgrade', 'billing', 'limit', 'feature'],
  },
  {
    id: 'billing-trial',
    section: 'Billing & plans',
    title: 'Free trial',
    description:
      'New accounts get a free trial of Pro features. After the trial, Pro features require a paid subscription.',
    keywords: ['trial', 'trialing', 'free trial', 'subscription'],
  },

  {
    id: 'billing-compare',
    section: 'Billing & plans',
    title: 'Plan comparison — Free, Pro, Student & Enterprise',
    description:
      'Free: 1 project, 2 canvases, basic blocks. Pro: unlimited projects and canvases, CSV import, vectors, plots, groups, exports, and priority support. Student: Pro features at a discounted rate with a valid .edu email. Enterprise: custom limits, SSO, audit logs, dedicated support, and on-premise deployment options. Compare plans at Settings → Billing.',
    keywords: [
      'compare',
      'free',
      'pro',
      'student',
      'enterprise',
      'plan',
      'pricing',
      'features',
      'sso',
      'edu',
      'discount',
    ],
  },

  // ── Troubleshooting ───────────────────────────────────────────────────
  {
    id: 'trouble-overview',
    section: 'Troubleshooting',
    title: 'Common issues — NaN, cycles, slow eval, save errors',
    description:
      'NaN results usually mean a missing or invalid input — check that all ports are connected and values are finite. Cycle detected errors appear when blocks form a loop; break the loop by removing one connection. Slow evaluation can be caused by very large vectors or deeply nested chains — try splitting into smaller canvases. Save errors are often caused by network interruptions; check your connection and retry. Use View → Validate graph for a full diagnostic report.',
    keywords: [
      'troubleshoot',
      'nan',
      'cycle',
      'loop',
      'slow',
      'performance',
      'save error',
      'network',
      'debug',
      'fix',
      'broken',
    ],
  },

  // ── UI & navigation ──────────────────────────────────────────────────────
  {
    id: 'ui-overview',
    section: 'Getting started',
    title: 'UI overview',
    description:
      'Tour of the ChainSolve interface: header bar, canvas, toolbar, inspector panel, side panels, and floating windows.',
    keywords: ['ui', 'interface', 'toolbar', 'inspector', 'panel', 'window', 'layout', 'overview'],
  },
  {
    id: 'chains',
    section: 'Canvas',
    title: 'Chains (connections)',
    description:
      'Chains connect block outputs to inputs. Values flow downstream automatically. Supports multiple outputs, animated flow, and incremental evaluation.',
    keywords: [
      'chain',
      'connection',
      'edge',
      'wire',
      'link',
      'data flow',
      'connect',
      'disconnect',
      'animated',
    ],
  },
  {
    id: 'projects',
    section: 'Getting started',
    title: 'Projects and saving',
    description:
      'Create projects, auto-save, multi-sheet canvases (Pro), import/export .chainsolvejson files, and scratch canvases.',
    keywords: [
      'project',
      'save',
      'auto-save',
      'sheet',
      'canvas',
      'import',
      'export',
      'scratch',
      'delete',
    ],
  },
  {
    id: 'groups',
    section: 'Canvas',
    title: 'Groups',
    description:
      'Visually group related blocks on the canvas. Create, edit, move, and colour groups. Pro feature.',
    keywords: ['group', 'organise', 'organize', 'colour', 'color', 'label', 'select'],
  },
  {
    id: 'saved-groups',
    section: 'Canvas',
    title: 'Saved groups (templates)',
    description:
      'Save groups of blocks as reusable templates. Insert, manage, and share saved groups across projects.',
    keywords: ['template', 'saved group', 'reuse', 'insert', 'share', 'publish'],
  },
  // ── Saved groups ────────────────────────────────────────────────────────
  {
    id: 'saved-groups-overview',
    section: 'Saved groups',
    title: 'Save, insert & manage group templates',
    description:
      'Select a group of blocks and use Edit → Save as Template to store it for reuse. Saved groups appear in the Insert menu under Templates → My Groups. You can rename, delete, or re-save a group at any time. Share saved groups with teammates by publishing them to Explore or exporting the project file.',
    keywords: [
      'saved group',
      'template',
      'reuse',
      'insert',
      'manage',
      'rename',
      'delete',
      'share',
      'my groups',
    ],
  },

  // ── Settings ──────────────────────────────────────────────────────────
  {
    id: 'settings-overview',
    section: 'Settings',
    title: 'Account, canvas & display settings',
    description:
      'Access settings from the gear icon or Settings menu. Account settings let you update your profile, email, and password. Canvas settings control grid snap, default zoom, and auto-save interval. Display settings adjust number formatting, decimal places, and scientific notation. The Theme Wizard lets you create and preview custom colour schemes for light and dark modes.',
    keywords: [
      'account',
      'profile',
      'canvas settings',
      'display',
      'formatting',
      'decimal',
      'scientific notation',
      'theme wizard',
      'grid snap',
      'zoom',
    ],
  },
  {
    id: 'settings-themes',
    section: 'Settings',
    title: 'Settings and themes',
    description:
      'Account settings (profile, billing, security) and app settings (general, canvas, values, performance, themes). Theme Wizard for custom colour schemes.',
    keywords: [
      'settings',
      'theme',
      'dark mode',
      'light mode',
      'wizard',
      'colour',
      'color',
      'preset',
      'preferences',
    ],
  },
]

// ── Search ────────────────────────────────────────────────────────────────────

/**
 * Filter DOCS_INDEX by a freetext query.
 * Matches against title, description, keywords, and section (case-insensitive).
 */
export function searchDocs(query: string): DocsEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return DOCS_INDEX.filter((entry) => {
    return (
      entry.title.toLowerCase().includes(q) ||
      entry.description.toLowerCase().includes(q) ||
      entry.section.toLowerCase().includes(q) ||
      entry.keywords.some((k) => k.toLowerCase().includes(q))
    )
  })
}
