/**
 * ChannelsPanel — 4.13: Shows all active Publish/Subscribe channels.
 *
 * Displays channel name, current value, source canvas, and subscriber count.
 * Rendered as a tab in the BottomDock.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { usePublishedOutputsStore } from '../../stores/publishedOutputsStore'
import { useFormatValue } from '../../hooks/useFormatValue'
import { mkScalar } from '../../engine/value'

export function ChannelsPanel() {
  const { t } = useTranslation()
  const channels = usePublishedOutputsStore((st) => st.channels)
  const formatValue = useFormatValue()

  const entries = useMemo(
    () =>
      Object.entries(channels)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, ch]) => ({ name, ...ch })),
    [channels],
  )

  if (entries.length === 0) {
    return (
      <div style={emptyStyle}>
        {t(
          'channels.empty',
          'No published channels. Add a Publish block to share values across canvases.',
        )}
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      {/* Header row */}
      <div style={headerRowStyle}>
        <span style={{ ...cellStyle, flex: 2 }}>{t('channels.name', 'Channel')}</span>
        <span style={{ ...cellStyle, flex: 1, textAlign: 'right' }}>
          {t('channels.value', 'Value')}
        </span>
        <span style={{ ...cellStyle, flex: 1.5 }}>{t('channels.source', 'Source Canvas')}</span>
      </div>
      {/* Channel rows */}
      {entries.map((ch) => (
        <div key={ch.name} style={rowStyle}>
          <span style={{ ...cellStyle, flex: 2, fontWeight: 600, color: 'var(--primary)' }}>
            {ch.name}
          </span>
          <span
            style={{
              ...cellStyle,
              flex: 1,
              textAlign: 'right',
              fontFamily: "ui-monospace, 'Cascadia Code', monospace",
            }}
          >
            {formatValue(mkScalar(ch.value))}
          </span>
          <span style={{ ...cellStyle, flex: 1.5, opacity: 0.5 }}>
            {ch.sourceCanvasId.slice(0, 8)}
          </span>
        </div>
      ))}
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: '0.72rem',
}

const emptyStyle: React.CSSProperties = {
  padding: '1.5rem',
  textAlign: 'center',
  fontSize: '0.75rem',
  opacity: 0.5,
}

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: '4px 0',
  borderBottom: '1px solid var(--border)',
  fontWeight: 700,
  opacity: 0.6,
  fontSize: '0.65rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: '3px 0',
  borderBottom: '1px solid color-mix(in srgb, var(--border) 40%, transparent)',
}

const cellStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
