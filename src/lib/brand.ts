/**
 * brand.ts — Centralized brand asset paths for ChainSolve.
 *
 * Only logo-wide-text.svg (42KB) is small enough for Vite bundle import.
 * All other SVGs (~1MB each, embedded raster) are served statically from /brand/.
 */

import logoWideTextSvg from '../assets/brand/logo-wide-text.svg'

export const BRAND = {
  /** Wide logo with text — 42KB SVG, bundled by Vite. Best for headers. */
  logoWideText: logoWideTextSvg,
  /** Wide logo without text — 1MB, served statically. */
  logoWide: '/brand/logo-wide.svg',
  /** Square icon — 1MB, served statically. */
  iconSquare: '/brand/icon-square.svg',
  /** Tiny icon — 1MB SVG, served statically. Used for favicon. */
  iconTiny: '/brand/icon-tiny.svg',
  /** Square icon with overlay — served statically. */
  iconSquareOverlay: '/brand/icon-square-overlay.svg',
  /** Square icon with text — served statically. */
  iconSquareText: '/brand/icon-square-text.svg',
  // PNG fallbacks
  logoWideTextPng: '/brand/logo-wide-text.png',
  iconTinyPng: '/brand/icon-tiny.png',
  iconSquarePng: '/brand/icon-square.png',
} as const

/** Centralized contact emails — no hardcoded emails elsewhere. */
export const CONTACT = {
  support: 'support@chainsolve.co.uk',
  info: 'info@chainsolve.co.uk',
} as const

/** Company legal details for footer and legal pages. */
export const COMPANY = {
  name: 'Godfrey Engineering Ltd',
  jurisdiction: 'England & Wales',
  companyNumber: '16845827',
} as const
