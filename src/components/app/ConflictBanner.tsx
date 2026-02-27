import { useTranslation } from 'react-i18next'

interface ConflictBannerProps {
  /** Server's updated_at timestamp when the conflict was detected (ISO string). */
  serverTs: string | null
  /** Timestamp of the last successful local save, or null if never saved. */
  lastSavedAt: Date | null
  /** When true, the "Keep mine" overwrite button is hidden. */
  readOnly: boolean
  onKeepMine: () => void
  onReload: () => void
}

function formatTs(ts: string | Date | null): string {
  if (!ts) return '—'
  const d = typeof ts === 'string' ? new Date(ts) : ts
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function ConflictBanner({
  serverTs,
  lastSavedAt,
  readOnly,
  onKeepMine,
  onReload,
}: ConflictBannerProps) {
  const { t } = useTranslation()

  return (
    <div
      style={{
        background: 'rgba(245,158,11,0.1)',
        borderBottom: '1px solid rgba(245,158,11,0.3)',
        padding: '0.45rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        fontSize: '0.82rem',
        color: '#fbbf24',
        flexShrink: 0,
      }}
    >
      <span>
        {t('canvas.conflictBanner')}
        {serverTs && (
          <span style={{ opacity: 0.75 }}>
            {' '}
            ({t('canvas.conflictServerTime', { time: formatTs(serverTs) })})
          </span>
        )}
        {lastSavedAt && (
          <span style={{ opacity: 0.75 }}>
            {' '}
            — {t('canvas.conflictLocalTime', { time: formatTs(lastSavedAt) })}
          </span>
        )}
      </span>
      {!readOnly && (
        <button
          onClick={onKeepMine}
          style={{
            padding: '0.2rem 0.75rem',
            border: '1px solid rgba(245,158,11,0.4)',
            background: 'transparent',
            color: '#fbbf24',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '0.78rem',
            fontFamily: 'inherit',
          }}
        >
          {t('canvas.keepMine')}
        </button>
      )}
      <button
        onClick={onReload}
        style={{
          padding: '0.2rem 0.75rem',
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'transparent',
          color: 'rgba(244,244,243,0.65)',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: '0.78rem',
          fontFamily: 'inherit',
        }}
      >
        {t('canvas.reload')}
      </button>
    </div>
  )
}
