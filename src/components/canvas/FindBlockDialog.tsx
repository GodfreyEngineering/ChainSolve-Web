/**
 * FindBlockDialog — lightweight floating search for canvas nodes.
 *
 * Filters by node label and block type. Arrow keys navigate, Enter
 * selects and zooms to the node, Escape closes.
 */

import { useState, useEffect, useRef, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Node } from '@xyflow/react'
import type { NodeData } from '../../blocks/types'

interface FindBlockDialogProps {
  nodes: Node<NodeData>[]
  onFocusNode: (nodeId: string) => void
  onClose: () => void
}

const MAX_RESULTS = 10

export function FindBlockDialog({ nodes, onFocusNode, onClose }: FindBlockDialogProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? nodes.filter(
        (n) =>
          (n.data as NodeData).label?.toLowerCase().includes(q) ||
          (n.data as NodeData).blockType?.toLowerCase().includes(q),
      )
    : nodes

  const results = filtered.slice(0, MAX_RESULTS)
  const clampedIdx = Math.min(activeIdx, Math.max(0, results.length - 1))

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const active = list.children[clampedIdx] as HTMLElement | undefined
    active?.scrollIntoView({ block: 'nearest' })
  }, [clampedIdx])

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const node = results[clampedIdx]
      if (node) onFocusNode(node.id)
    }
  }

  return (
    <>
      {/* Invisible overlay — captures outside clicks */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 1001 }} onClick={onClose} />

      <div
        style={{
          position: 'absolute',
          top: 56,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1002,
          width: 260,
          maxHeight: 340,
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: '0 16px 48px rgba(0,0,0,0.65)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: "'Montserrat', system-ui, sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '0.35rem 0.65rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: '0.6rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              userSelect: 'none',
            }}
          >
            {t('menu.findBlock')}
          </span>
          <span
            style={{
              fontSize: '0.6rem',
              color: 'var(--text-muted)',
              fontFamily: "'JetBrains Mono', monospace",
              userSelect: 'none',
              opacity: 0.6,
            }}
          >
            {t('canvas.findHint')}
          </span>
        </div>

        {/* Search input */}
        <div
          style={{
            padding: '0.3rem 0.45rem',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIdx(0)
            }}
            onKeyDown={onKeyDown}
            placeholder={t('canvas.findPlaceholder')}
            style={{
              width: '100%',
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text)',
              fontSize: '0.8rem',
              padding: '0.3rem 0.5rem',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: 'auto', flex: 1, paddingBottom: '0.2rem' }}>
          {results.length === 0 ? (
            <div
              style={{
                padding: '1.2rem',
                textAlign: 'center',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                opacity: 0.5,
              }}
            >
              {t('canvas.noMatches')}
            </div>
          ) : (
            results.map((node, i) => {
              const isActive = i === clampedIdx
              const nd = node.data as NodeData
              return (
                <div
                  key={node.id}
                  onClick={() => onFocusNode(node.id)}
                  onMouseEnter={() => setActiveIdx(i)}
                  style={{
                    padding: '0.3rem 0.7rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    background: isActive ? 'var(--primary-dim)' : 'transparent',
                    color: isActive ? 'var(--primary)' : 'var(--text)',
                    borderLeft: `2px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                    userSelect: 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {nd.label}
                  </span>
                  <span
                    style={{
                      fontSize: '0.62rem',
                      opacity: 0.5,
                      flexShrink: 0,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {nd.blockType}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
