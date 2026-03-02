/**
 * UnitPicker — searchable unit dropdown for H1-1 units system.
 *
 * Renders as a compact badge/select when `compact` is true (for use on nodes),
 * or a full-width select when false (for the Inspector panel).
 * Units are grouped by physical dimension with i18n dimension labels.
 *
 * The full UNIT_DIMENSIONS catalog is lazy-loaded on first dropdown open
 * to keep it out of the initial JS bundle.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { UnitDimension } from '../../../units/unitCatalog'
import { getUnitSymbol } from '../../../units/unitSymbols'

interface UnitPickerProps {
  /** Current unit id, or undefined for "none". */
  value: string | undefined
  /** Called when the user selects a unit. undefined = cleared to "none". */
  onChange: (unitId: string | undefined) => void
  /** Compact mode — smaller for inline use on nodes. */
  compact?: boolean
}

/** Lazily resolved catalog. Shared across all UnitPicker instances. */
let _cachedDimensions: readonly UnitDimension[] | null = null

export function UnitPicker({ value, onChange, compact }: UnitPickerProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [dimensions, setDimensions] = useState<readonly UnitDimension[]>(_cachedDimensions ?? [])
  const containerRef = useRef<HTMLDivElement>(null)

  // Lazy-load the full catalog when the dropdown is first opened
  useEffect(() => {
    if (!open || _cachedDimensions) return
    import('../../../units/unitCatalog').then((m) => {
      _cachedDimensions = m.UNIT_DIMENSIONS
      setDimensions(m.UNIT_DIMENSIONS)
    })
  }, [open])

  // If cache was already populated by another instance, use it
  useEffect(() => {
    if (_cachedDimensions && dimensions.length === 0) {
      setDimensions(_cachedDimensions)
    }
  }, [dimensions.length])

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Close only if focus moved outside the container
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
      setOpen(false)
      setSearch('')
    }
  }, [])

  const filteredDimensions = useMemo(() => {
    if (!search) return dimensions
    const q = search.toLowerCase()
    return dimensions
      .map((dim) => ({
        ...dim,
        units: dim.units.filter(
          (u) =>
            u.id.toLowerCase().includes(q) ||
            u.symbol.toLowerCase().includes(q) ||
            t(dim.labelKey).toLowerCase().includes(q),
        ),
      }))
      .filter((dim) => dim.units.length > 0)
  }, [search, t, dimensions])

  const symbol = value ? getUnitSymbol(value) : null

  // Compact badge style for nodes
  if (compact) {
    return (
      <div
        ref={containerRef}
        style={{ position: 'relative', display: 'inline-block' }}
        onBlur={handleBlur}
      >
        <button
          type="button"
          className="nodrag"
          onClick={() => setOpen(!open)}
          style={{
            padding: '0.1rem 0.35rem',
            borderRadius: 4,
            border: `1px solid ${value ? 'rgba(28,171,176,0.3)' : 'rgba(255,255,255,0.12)'}`,
            background: value ? 'rgba(28,171,176,0.08)' : 'rgba(0,0,0,0.15)',
            color: value ? '#1CABB0' : 'rgba(244,244,243,0.35)',
            fontSize: '0.62rem',
            fontFamily: 'inherit',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            lineHeight: 1.3,
          }}
          title={t('units.selectUnit')}
        >
          {symbol ?? t('units.none')}
        </button>
        {open && (
          <UnitDropdown
            search={search}
            onSearch={setSearch}
            dimensions={filteredDimensions}
            value={value}
            onChange={(id) => {
              onChange(id)
              setOpen(false)
              setSearch('')
            }}
            compact
            t={t}
          />
        )}
      </div>
    )
  }

  // Full-width mode for Inspector
  return (
    <div ref={containerRef} style={{ position: 'relative' }} onBlur={handleBlur}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: '0.28rem 0.45rem',
          borderRadius: 6,
          border: `1px solid ${value ? 'rgba(28,171,176,0.25)' : 'rgba(255,255,255,0.12)'}`,
          background: 'rgba(0,0,0,0.2)',
          color: value ? '#93c5fd' : 'rgba(244,244,243,0.4)',
          fontSize: '0.8rem',
          fontFamily: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxSizing: 'border-box',
        }}
      >
        <span>{symbol ?? t('units.none')}</span>
        <span style={{ fontSize: '0.6rem', opacity: 0.5 }}>{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && (
        <UnitDropdown
          search={search}
          onSearch={setSearch}
          dimensions={filteredDimensions}
          value={value}
          onChange={(id) => {
            onChange(id)
            setOpen(false)
            setSearch('')
          }}
          compact={false}
          t={t}
        />
      )}
    </div>
  )
}

// ── Dropdown panel ──────────────────────────────────────────────────────────

interface UnitDropdownProps {
  search: string
  onSearch: (q: string) => void
  dimensions: readonly {
    id: string
    labelKey: string
    units: readonly { id: string; symbol: string }[]
  }[]
  value: string | undefined
  onChange: (id: string | undefined) => void
  compact: boolean
  t: (key: string) => string
}

function UnitDropdown({
  search,
  onSearch,
  dimensions,
  value,
  onChange,
  compact,
  t,
}: UnitDropdownProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: compact ? 0 : undefined,
        right: compact ? undefined : 0,
        zIndex: 50,
        marginTop: 2,
        width: compact ? 200 : '100%',
        minWidth: 180,
        maxHeight: 260,
        background: 'var(--card-bg, #1a1a2e)',
        border: '1px solid var(--border, rgba(255,255,255,0.1))',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Search input */}
      <div style={{ padding: '0.35rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <input
          autoFocus
          type="text"
          placeholder={t('units.search')}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '0.22rem 0.4rem',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.25)',
            color: '#F4F4F3',
            fontSize: '0.72rem',
            fontFamily: 'inherit',
            outline: 'none',
            boxSizing: 'border-box',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onChange(value) // close without changing
            }
          }}
        />
      </div>

      {/* Options list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.2rem 0' }}>
        {/* None option */}
        <button
          type="button"
          onClick={() => onChange(undefined)}
          style={{
            ...optionStyle,
            color: !value ? '#1CABB0' : 'rgba(244,244,243,0.5)',
            fontStyle: 'italic',
          }}
        >
          {t('units.none')}
        </button>

        {dimensions.map((dim) => (
          <div key={dim.id}>
            <div style={groupLabelStyle}>{t(dim.labelKey)}</div>
            {dim.units.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => onChange(u.id)}
                style={{
                  ...optionStyle,
                  color: value === u.id ? '#1CABB0' : '#F4F4F3',
                  background: value === u.id ? 'rgba(28,171,176,0.1)' : undefined,
                  fontWeight: value === u.id ? 600 : 400,
                }}
              >
                <span>{u.symbol}</span>
                {u.symbol !== u.id && (
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.62rem', opacity: 0.4 }}>
                    {u.id}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}

        {dimensions.length === 0 && (
          <div
            style={{
              padding: '0.6rem',
              textAlign: 'center',
              fontSize: '0.7rem',
              color: 'rgba(244,244,243,0.35)',
            }}
          >
            {t('units.noResults')}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const optionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  padding: '0.22rem 0.6rem',
  border: 'none',
  background: 'none',
  color: '#F4F4F3',
  fontSize: '0.72rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
}

const groupLabelStyle: React.CSSProperties = {
  fontSize: '0.58rem',
  fontWeight: 700,
  letterSpacing: '0.05em',
  color: 'rgba(244,244,243,0.3)',
  textTransform: 'uppercase',
  padding: '0.35rem 0.6rem 0.1rem',
  userSelect: 'none',
}
