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
      'Drag from an output port (right side of a block) to an input port (left side). A live edge appears and values update immediately.',
    keywords: ['connect', 'edge', 'wire', 'port', 'link', 'drag'],
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
    title: 'Deleting blocks and edges',
    description:
      'Select a block or edge and press Delete or Backspace. Hold Ctrl to multi-select and delete several at once.',
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
