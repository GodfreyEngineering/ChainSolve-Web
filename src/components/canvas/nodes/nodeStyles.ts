/**
 * Shared inline styles for all custom canvas node types.
 *
 * D8-2: Refactored to use CSS custom properties so themes can override
 * node colours via the theme wizard.
 */

import type { CSSProperties } from 'react'

const HANDLE_SIZE = 10

export const NODE_STYLES = {
  node: {
    minWidth: 168,
    maxWidth: 240,
    background: 'var(--node-bg)',
    border: '1px solid var(--node-border)',
    borderRadius: 10,
    boxShadow: '0 3px 12px rgba(0,0,0,0.4)',
    fontFamily: "'Montserrat', system-ui, sans-serif",
    fontSize: '0.8rem',
    color: 'var(--text)',
    overflow: 'hidden',
  } as CSSProperties,

  nodeSelected: {
    border: '1px solid var(--node-selected-border)',
    boxShadow: '0 0 0 2px var(--primary-glow), 0 3px 12px rgba(0,0,0,0.4)',
  } as CSSProperties,

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.32rem 0.6rem',
    background: 'var(--node-header-bg)',
    borderBottom: '1px solid var(--node-border)',
    gap: '0.5rem',
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
  } as CSSProperties,

  body: {
    padding: '0.45rem 0.6rem',
  } as CSSProperties,

  portRow: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative' as const,
    padding: '0.18rem 0',
    minHeight: 24,
    gap: '0.3rem',
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

  inlineInput: {
    width: 60,
    flexShrink: 0,
    background: 'rgba(0,0,0,0.25)',
    border: '1px solid var(--node-border)',
    borderRadius: 4,
    color: 'var(--text)',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.72rem',
    padding: '0.1rem 0.3rem',
    outline: 'none',
    textAlign: 'right' as const,
  } as CSSProperties,

  numInput: {
    width: '100%',
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid var(--node-border)',
    borderRadius: 6,
    color: 'var(--text)',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.82rem',
    padding: '0.22rem 0.4rem',
    outline: 'none',
    boxSizing: 'border-box' as const,
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
    padding: '0.2rem 0',
    color: 'var(--primary)',
  } as CSSProperties,

  handleLeft: {
    left: -(HANDLE_SIZE / 2),
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    background: 'var(--handle-input)',
    border: '2px solid var(--node-bg)',
  } as CSSProperties,

  handleLeftDisconnected: {
    left: -(HANDLE_SIZE / 2),
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    background: '#555',
    border: '2px solid var(--node-bg)',
  } as CSSProperties,

  handleRight: {
    right: -(HANDLE_SIZE / 2),
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    background: 'var(--handle-output)',
    border: '2px solid var(--node-bg)',
  } as CSSProperties,
}
