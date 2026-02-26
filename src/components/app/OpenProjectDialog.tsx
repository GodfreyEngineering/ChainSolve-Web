/**
 * OpenProjectDialog — lightweight project picker modal.
 *
 * Fetches the user's projects on open, provides search filtering and
 * keyboard navigation (Arrow Up/Down, Enter, Escape).
 */

import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../ui/Modal'
import { listProjects, type ProjectRow } from '../../lib/projects'

interface OpenProjectDialogProps {
  open: boolean
  onClose: () => void
  onSelect: (projectId: string) => void
}

const MAX_RESULTS = 50

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function OpenProjectDialog({ open, onClose, onSelect }: OpenProjectDialogProps) {
  const { t } = useTranslation()
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await listProjects()
      setProjects(rows)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIdx(0)
    void fetchProjects()
    // Focus input after modal animation
    const t = setTimeout(() => inputRef.current?.focus(), 100)
    return () => clearTimeout(t)
  }, [open, fetchProjects])

  const q = query.trim().toLowerCase()
  const filtered = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects
  const results = filtered.slice(0, MAX_RESULTS)
  const clampedIdx = Math.min(activeIdx, Math.max(0, results.length - 1))

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const active = list.children[clampedIdx] as HTMLElement | undefined
    active?.scrollIntoView({ block: 'nearest' })
  }, [clampedIdx])

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const proj = results[clampedIdx]
      if (proj) onSelect(proj.id)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('project.openProject')} width={480}>
      {/* Search */}
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActiveIdx(0)
        }}
        onKeyDown={onKeyDown}
        placeholder={t('project.searchPlaceholder')}
        style={{
          width: '100%',
          padding: '0.45rem 0.65rem',
          fontSize: '0.85rem',
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          color: 'var(--text)',
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          marginBottom: '0.75rem',
        }}
      />

      {/* Results */}
      <div
        ref={listRef}
        style={{
          maxHeight: 320,
          overflowY: 'auto',
          borderRadius: 6,
          border: '1px solid var(--border)',
        }}
      >
        {loading && (
          <div style={emptyStyle}>Loading…</div>
        )}
        {!loading && error && (
          <div style={emptyStyle}>
            <span>{t('project.loadError')}</span>
            <button onClick={() => void fetchProjects()} style={retryStyle}>
              {t('project.retry')}
            </button>
          </div>
        )}
        {!loading && !error && results.length === 0 && (
          <div style={emptyStyle}>{t('project.noProjects')}</div>
        )}
        {!loading &&
          !error &&
          results.map((proj, i) => {
            const isActive = i === clampedIdx
            return (
              <div
                key={proj.id}
                onClick={() => onSelect(proj.id)}
                onMouseEnter={() => setActiveIdx(i)}
                style={{
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.75rem',
                  background: isActive ? 'var(--primary-dim)' : 'transparent',
                  borderLeft: `2px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                }}
              >
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: isActive ? 'var(--primary)' : 'var(--text)',
                  }}
                >
                  {proj.name}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    opacity: 0.45,
                    flexShrink: 0,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {fmtDate(proj.updated_at)}
                </span>
              </div>
            )
          })}
      </div>
    </Modal>
  )
}

const emptyStyle: React.CSSProperties = {
  padding: '2rem 1rem',
  textAlign: 'center',
  fontSize: '0.82rem',
  color: 'var(--text-muted)',
  opacity: 0.6,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
}

const retryStyle: React.CSSProperties = {
  padding: '0.3rem 0.8rem',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: '0.78rem',
  fontFamily: 'inherit',
}
