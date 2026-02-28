import { useState, useRef, useMemo, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../ui/Modal'
import { searchDocs, DOCS_INDEX, type DocsEntry } from '../../docs/docsIndex'

interface Props {
  open: boolean
  onClose: () => void
}

export function DocsSearchModal({ open, onClose }: Props) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus the search input after mount (DOM is ready in layout effect).
  useLayoutEffect(() => {
    inputRef.current?.focus()
  }, [])

  const results = useMemo<DocsEntry[]>(() => {
    if (!query.trim()) return []
    return searchDocs(query)
  }, [query])

  // Group results by section
  const grouped = useMemo(() => {
    const map = new Map<string, DocsEntry[]>()
    for (const entry of results) {
      const existing = map.get(entry.section) ?? []
      map.set(entry.section, [...existing, entry])
    }
    return [...map.entries()]
  }, [results])

  // Show a flat browse list when nothing is typed
  const sections = useMemo(() => {
    const map = new Map<string, DocsEntry[]>()
    for (const entry of DOCS_INDEX) {
      const existing = map.get(entry.section) ?? []
      map.set(entry.section, [...existing, entry])
    }
    return [...map.entries()]
  }, [])

  const hasResults = results.length > 0
  const isSearching = query.trim().length > 0

  return (
    <Modal open={open} onClose={onClose} title={t('docs.title')} width={580}>
      {/* Search input */}
      <input
        ref={inputRef}
        style={inputStyle}
        type="search"
        placeholder={t('docs.searchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t('docs.searchPlaceholder')}
        autoComplete="off"
        spellCheck={false}
      />

      {/* Results / browse */}
      <div style={listStyle} role="list" aria-label={t('docs.results')}>
        {isSearching && !hasResults && <p style={emptyStyle}>{t('docs.noResults', { query })}</p>}

        {isSearching && hasResults && (
          <>
            {grouped.map(([section, entries]) => (
              <section key={section} aria-label={section}>
                <h3 style={sectionHeadingStyle}>{section}</h3>
                {entries.map((entry) => (
                  <DocsItem key={entry.id} entry={entry} />
                ))}
              </section>
            ))}
          </>
        )}

        {!isSearching && (
          <>
            <p style={browseHintStyle}>{t('docs.browseHint')}</p>
            {sections.map(([section, entries]) => (
              <section key={section} aria-label={section}>
                <h3 style={sectionHeadingStyle}>{section}</h3>
                {entries.map((entry) => (
                  <DocsItem key={entry.id} entry={entry} />
                ))}
              </section>
            ))}
          </>
        )}
      </div>
    </Modal>
  )
}

// ── DocsItem ─────────────────────────────────────────────────────────────────

function DocsItem({ entry }: { entry: DocsEntry }) {
  return (
    <div style={itemStyle} role="listitem">
      <p style={itemTitleStyle}>{entry.title}</p>
      <p style={itemDescStyle}>{entry.description}</p>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.55rem 0.75rem',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--input-bg)',
  color: 'var(--text)',
  fontSize: '0.9rem',
  outline: 'none',
  marginBottom: '1rem',
}

const listStyle: React.CSSProperties = {
  maxHeight: '60vh',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
}

const sectionHeadingStyle: React.CSSProperties = {
  margin: '0.75rem 0 0.35rem 0',
  fontSize: '0.72rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: 'var(--primary)',
}

const itemStyle: React.CSSProperties = {
  padding: '0.45rem 0.5rem',
  borderRadius: 5,
  cursor: 'default',
  borderBottom: '1px solid var(--border)',
}

const itemTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.88rem',
  fontWeight: 600,
  color: 'var(--text)',
}

const itemDescStyle: React.CSSProperties = {
  margin: '0.2rem 0 0 0',
  fontSize: '0.8rem',
  color: 'var(--text-muted)',
  lineHeight: 1.4,
}

const emptyStyle: React.CSSProperties = {
  margin: '1.5rem 0',
  textAlign: 'center',
  color: 'var(--text-muted)',
  fontSize: '0.875rem',
}

const browseHintStyle: React.CSSProperties = {
  margin: '0 0 0.5rem 0',
  fontSize: '0.82rem',
  color: 'var(--text-muted)',
}
