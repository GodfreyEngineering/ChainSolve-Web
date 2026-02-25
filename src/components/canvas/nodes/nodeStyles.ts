/**
 * Shared inline styles for all custom canvas node types.
 * Kept in one place so tweaks propagate everywhere.
 */

import type { CSSProperties } from 'react'

const HANDLE_SIZE = 10

export const NODE_STYLES = {
  node: {
    minWidth: 160,
    maxWidth: 220,
    background: 'var(--card-bg)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    fontFamily: 'inherit',
    fontSize: '0.82rem',
    overflow: 'hidden',
  } as CSSProperties,

  nodeSelected: {
    border: '1px solid #646cff',
    boxShadow: '0 0 0 2px rgba(100,108,255,0.35)',
  } as CSSProperties,

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.35rem 0.6rem',
    background: 'rgba(100,108,255,0.12)',
    borderBottom: '1px solid var(--border)',
    gap: '0.5rem',
  } as CSSProperties,

  headerLabel: {
    fontWeight: 700,
    fontSize: '0.78rem',
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as CSSProperties,

  headerValue: {
    fontFamily: 'monospace',
    fontSize: '0.72rem',
    opacity: 0.7,
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  } as CSSProperties,

  body: {
    padding: '0.5rem 0.6rem',
  } as CSSProperties,

  portRow: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative' as const,
    padding: '0.2rem 0',
    minHeight: 22,
  } as CSSProperties,

  portLabel: {
    fontSize: '0.75rem',
    opacity: 0.65,
    paddingLeft: '1rem',
  } as CSSProperties,

  numInput: {
    width: '100%',
    background: 'var(--input-bg)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'inherit',
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    padding: '0.25rem 0.4rem',
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as CSSProperties,

  constValue: {
    fontFamily: 'monospace',
    fontSize: '1rem',
    fontWeight: 700,
  } as CSSProperties,

  displayValue: {
    fontFamily: 'monospace',
    fontSize: '1.25rem',
    fontWeight: 700,
    textAlign: 'center' as const,
    padding: '0.25rem 0',
    color: '#22c55e',
  } as CSSProperties,

  handleLeft: {
    left: -HANDLE_SIZE / 2,
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    background: '#646cff',
    border: '2px solid var(--card-bg)',
  } as CSSProperties,

  handleRight: {
    right: -HANDLE_SIZE / 2,
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    background: '#22c55e',
    border: '2px solid var(--card-bg)',
  } as CSSProperties,
}
