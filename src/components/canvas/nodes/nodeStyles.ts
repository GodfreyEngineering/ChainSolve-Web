/**
 * Shared inline styles for all custom canvas node types.
 *
 * D8-2: Uses CSS custom properties so themes can override node colours.
 * V3-UI: Redesigned with larger nodes, type-colored accents, improved
 *        handles, and layered shadows for a premium feel.
 */

import type { CSSProperties } from 'react'

export const HANDLE_SIZE = 12

/** UX-14: Returns a background override when the node has a user-chosen color. */
export function userColorBg(userColor?: string): CSSProperties {
  if (!userColor) return {}
  return { background: `color-mix(in srgb, ${userColor} 18%, var(--node-bg))` }
}

export const NODE_STYLES = {
  node: {
    minWidth: 190,
    maxWidth: 280,
    background: 'var(--node-bg)',
    border: '1.5px solid var(--node-border)',
    borderRadius: 'var(--canvas-node-border-radius, 12px)',
    boxShadow: 'var(--canvas-node-shadow, 0 1px 3px rgba(0,0,0,0.12) , 0 4px 16px rgba(0,0,0,0.2))',
    fontFamily: "'Montserrat', system-ui, sans-serif",
    fontSize: '0.8rem',
    color: 'var(--text)',
    overflow: 'visible',
    transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
  } as CSSProperties,

  nodeSelected: {
    border: '2px solid var(--node-selected-border)',
    boxShadow:
      '0 0 0 2px var(--primary-glow), 0 1px 3px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.2)',
  } as CSSProperties,

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.4rem 0.65rem',
    background: 'var(--node-header-bg)',
    borderBottom: '1px solid var(--node-border)',
    borderRadius:
      'var(--canvas-node-border-radius, 12px) var(--canvas-node-border-radius, 12px) 0 0',
    gap: '0.5rem',
    minHeight: 32,
  } as CSSProperties,

  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  } as CSSProperties,

  headerIcon: {
    flexShrink: 0,
    opacity: 0.7,
  } as CSSProperties,

  headerLabel: {
    fontWeight: 700,
    fontSize: '0.73rem',
    letterSpacing: '0.03em',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textTransform: 'uppercase' as const,
  } as CSSProperties,

  headerValue: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.72rem',
    color: 'var(--primary)',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
    maxWidth: 180,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as CSSProperties,

  body: {
    padding: '0.45rem 0.65rem',
  } as CSSProperties,

  portRow: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative' as const,
    padding: '0.2rem 0',
    minHeight: 26,
    gap: '0.35rem',
  } as CSSProperties,

  portLabel: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    flex: 1,
    paddingLeft: '0.5rem',
    minWidth: 0,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as CSSProperties,

  /** Inline input for port values (wider than before for usability) */
  inlineInput: {
    width: 72,
    flexShrink: 0,
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid var(--node-border)',
    borderRadius: 5,
    color: 'var(--text)',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.72rem',
    padding: '0.15rem 0.35rem',
    outline: 'none',
    textAlign: 'right' as const,
    transition: 'border-color 0.15s ease',
  } as CSSProperties,

  inlineInputFocus: {
    borderColor: 'var(--primary)',
    boxShadow: '0 0 0 1px var(--primary-dim)',
  } as CSSProperties,

  numInput: {
    width: '100%',
    background: 'rgba(0,0,0,0.15)',
    border: '1px solid var(--node-border)',
    borderRadius: 6,
    color: 'var(--text)',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.82rem',
    padding: '0.25rem 0.4rem',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s ease',
  } as CSSProperties,

  constValue: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--primary)',
  } as CSSProperties,

  displayValue: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '1.3rem',
    fontWeight: 700,
    textAlign: 'center' as const,
    padding: '0.3rem 0',
    color: 'var(--primary)',
    maxWidth: 400,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as CSSProperties,

  handleLeft: {
    left: -(HANDLE_SIZE / 2),
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    background: 'var(--handle-input)',
    border: '2px solid var(--node-bg)',
    borderRadius: '50%',
    transition: 'transform 0.1s ease',
  } as CSSProperties,

  handleLeftDisconnected: {
    left: -(HANDLE_SIZE / 2),
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    background: 'var(--surface-3, #555)',
    border: '2px dashed var(--text-faint)',
    borderRadius: '50%',
    transition: 'transform 0.1s ease',
  } as CSSProperties,

  handleRight: {
    right: -(HANDLE_SIZE / 2),
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    background: 'var(--handle-output)',
    border: '2px solid var(--node-bg)',
    borderRadius: '50%',
    transition: 'transform 0.1s ease',
  } as CSSProperties,

  /** Error footer shown below node body when value is an error */
  errorFooter: {
    fontSize: 'var(--font-xs)',
    color: 'var(--danger-text)',
    background: 'var(--danger-dim)',
    padding: '0.2rem 0.65rem',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    borderTop: '1px solid rgba(239,68,68,0.2)',
  } as CSSProperties,

  /** Port value badge (read-only display of incoming value) */
  portValueBadge: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.68rem',
    color: 'var(--text-faint)',
    flexShrink: 0,
    padding: '0 0.25rem',
    borderRadius: 3,
    background: 'rgba(0,0,0,0.1)',
  } as CSSProperties,

  /** 4.04: Unit badge shown next to output handle */
  outputUnitBadge: {
    position: 'absolute' as const,
    right: HANDLE_SIZE + 2,
    top: '50%',
    transform: 'translateY(-50%)',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.58rem',
    fontWeight: 600,
    color: 'var(--primary)',
    background: 'rgba(28,171,176,0.1)',
    border: '1px solid rgba(28,171,176,0.2)',
    borderRadius: 3,
    padding: '0 0.2rem',
    lineHeight: 1.4,
    whiteSpace: 'nowrap' as const,
    pointerEvents: 'none' as const,
  } as CSSProperties,
}
