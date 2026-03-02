/**
 * HelpLink — Subtle contextual help icon that opens docs in a new tab (I1-2).
 *
 * Renders a small ⓘ icon. Default color is faint; turns teal on hover.
 * Opens /docs?section=<id> in a new browser tab without leaving the current page.
 */

import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { DocsSection } from '../../pages/DocsPage'

interface HelpLinkProps {
  section: DocsSection
  tooltip?: string
  style?: React.CSSProperties
}

export function HelpLink({ section, tooltip, style }: HelpLinkProps) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      window.open(`/docs?section=${section}`, '_blank', 'noopener')
    },
    [section],
  )

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={tooltip ?? t('help.learnMore')}
      aria-label={tooltip ?? t('help.learnMore')}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.6rem',
        lineHeight: 1,
        padding: '0 2px',
        color: hovered ? 'var(--primary)' : 'var(--text-faint)',
        transition: 'color 0.15s ease',
        fontFamily: 'inherit',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      }}
    >
      {'\u24d8'}
    </button>
  )
}
