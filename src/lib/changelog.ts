/**
 * changelog.ts — Static list of product changelog entries.
 *
 * Shown in Help → What's New.
 * Add a new entry at the TOP of CHANGELOG_ENTRIES when shipping a release.
 * Entries are displayed in the order they appear here (newest first).
 */

export interface ChangelogEntry {
  /** Release version string, e.g. "1.3.0" */
  version: string
  /** ISO 8601 date string, e.g. "2026-02-28" */
  date: string
  /** Short headline for this release */
  title: string
  /** Short human-readable summary (1–3 sentences) */
  summary: string
  /** Bullet-point features / fixes */
  items: string[]
}

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: '1.3.0',
    date: '2026-02-28',
    title: 'Docs, contrast & templates',
    summary:
      'In-app help search, WCAG AA contrast improvements, sample template packs, and command palette refinements.',
    items: [
      'In-app documentation search (Help → Documentation)',
      'WCAG AA contrast fixes — text-muted and link colours on all backgrounds',
      'Physics 101, Finance 101, and Stats 101 starter templates',
      'Command palette now ranks exact and prefix matches first',
      'Quick-add palette shows recently-used blocks and searches by category',
      'Go-live release checklist (docs/RELEASE.md)',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-01-15',
    title: 'Performance + accessibility',
    summary:
      'Up to 1000-node graphs run smoothly; full WCAG keyboard accessibility and screen-reader support.',
    items: [
      'FPS overlay and eval-scheduling prevent main-thread stalls at 500–1000 nodes',
      'LOD thresholds reduce canvas redraws at scale',
      'WASM bundle further optimised (wasm-opt -Oz)',
      'Full keyboard nav for menubar, modals, and canvas',
      'prefers-reduced-motion respected everywhere',
      'Screen-reader labels sweep across all interactive elements',
    ],
  },
  {
    version: '1.1.0',
    date: '2025-12-10',
    title: 'Billing, onboarding & i18n',
    summary:
      'Stripe billing, first-run onboarding, keyboard shortcuts modal, and multi-language support.',
    items: [
      'Pro plan with Stripe Checkout + webhook idempotency',
      'Trial UX — banner + expiry warning for trialing accounts',
      'First-run onboarding modal with template launcher',
      'Keyboard shortcuts modal (Help → Keyboard shortcuts)',
      'Language selector with locale-aware number formatting',
      'CSP hardening: observability and CSP report endpoints',
    ],
  },
  {
    version: '1.0.0',
    date: '2025-10-01',
    title: 'Initial release',
    summary: 'ChainSolve v1.0 — visual calculation chains powered by Rust/WASM.',
    items: [
      '100+ engineering, finance, and statistics blocks',
      'Live incremental evaluation via Rust/WASM engine',
      'Variables + bindings + sliders',
      'PDF and Excel audit export',
      'CSV import for dataset blocks',
      'Plot blocks (Pro)',
      'Project and canvas management with auto-save',
    ],
  },
]

/**
 * Return the latest entry, or undefined if the list is empty.
 */
export function latestEntry(): ChangelogEntry | undefined {
  return CHANGELOG_ENTRIES[0]
}
