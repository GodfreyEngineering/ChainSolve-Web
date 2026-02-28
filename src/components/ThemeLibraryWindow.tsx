/**
 * ThemeLibraryWindow.tsx — D8-3 saved themes library + upload to Explore.
 *
 * Opens as an AppWindow via the WindowManager. Lists all locally saved
 * custom themes with apply/delete actions. Pro users can upload a theme
 * to Explore as a marketplace item.
 */

import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppWindow } from './ui/AppWindow'
import { Button } from './ui/Button'
import { useWindowManager } from '../contexts/WindowManagerContext'
import { useCustomThemesStore } from '../stores/customThemesStore'
import type { CustomTheme } from '../lib/customThemes'
import { isPro, type Plan } from '../lib/entitlements'
import {
  createAuthorItem,
  updateItemPayload,
  type MarketplaceCategory,
} from '../lib/marketplaceService'
import type { MarketplaceThemePayload } from '../lib/marketplaceThemeService'

export const THEME_LIBRARY_WINDOW_ID = 'theme-library'

interface Props {
  plan?: Plan
}

/**
 * Self-contained AppWindow for the theme library.
 * The parent only needs to render this when `isOpen(THEME_LIBRARY_WINDOW_ID)`.
 */
export const ThemeLibraryWindow = memo(function ThemeLibraryWindow({ plan = 'free' }: Props) {
  const { t } = useTranslation()
  const { closeWindow } = useWindowManager()
  const { themes, activeThemeId, activateTheme, deleteTheme } = useCustomThemesStore()
  const pro = isPro(plan)

  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadedIds, setUploadedIds] = useState<Set<string>>(new Set())

  const handleUpload = useCallback(async (theme: CustomTheme) => {
    setUploadError(null)
    setUploadingId(theme.id)
    try {
      const category: MarketplaceCategory = 'theme'
      const item = await createAuthorItem({
        name: theme.name,
        category,
        version: '1.0.0',
        description: `${theme.baseMode === 'dark' ? 'Dark' : 'Light'} theme with ${Object.keys(theme.variables).length} custom properties.`,
      })

      const payload: MarketplaceThemePayload = {
        minContractVersion: 1,
        variables: { ...theme.variables },
      }
      await updateItemPayload(item.id, payload)

      setUploadedIds((prev) => new Set([...prev, theme.id]))
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploadingId(null)
    }
  }, [])

  return (
    <AppWindow
      windowId={THEME_LIBRARY_WINDOW_ID}
      title={t('settings.themeLibraryTitle')}
      minWidth={420}
      minHeight={320}
    >
      <div style={containerStyle}>
        {/* Description */}
        <p style={descStyle}>{t('settings.themeLibraryDesc')}</p>

        {/* Upload error banner */}
        {uploadError && (
          <div style={errorBannerStyle} role="alert">
            {uploadError}
          </div>
        )}

        {/* Empty state */}
        {themes.length === 0 && (
          <div style={emptyStyle} data-testid="theme-library-empty">
            {t('settings.themeLibraryEmpty')}
          </div>
        )}

        {/* Theme list */}
        {themes.map((th) => (
          <div key={th.id} style={rowStyle} data-testid="theme-library-row">
            <div style={rowLeftStyle}>
              <span
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: th.variables['--primary'] ?? 'var(--primary)',
                  border: '1px solid var(--border)',
                  flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={nameStyle}>{th.name}</div>
                <div style={metaStyle}>
                  {th.baseMode} · {Object.keys(th.variables).length} {t('settings.themeVarCount')}
                </div>
              </div>
              {activeThemeId === th.id && (
                <span style={activeBadgeStyle}>{t('settings.activeThemeBadge')}</span>
              )}
            </div>
            <div style={rowActionsStyle}>
              {activeThemeId === th.id ? (
                <Button variant="secondary" size="sm" onClick={() => activateTheme(null)}>
                  {t('settings.deactivateTheme')}
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={() => activateTheme(th.id)}>
                  {t('settings.applyTheme')}
                </Button>
              )}
              {pro && !uploadedIds.has(th.id) && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={uploadingId === th.id}
                  onClick={() => void handleUpload(th)}
                >
                  {uploadingId === th.id
                    ? t('settings.themeUploading')
                    : t('settings.themeUploadToExplore')}
                </Button>
              )}
              {uploadedIds.has(th.id) && (
                <span style={uploadedBadgeStyle}>{t('settings.themeUploaded')}</span>
              )}
              <Button variant="secondary" size="sm" onClick={() => deleteTheme(th.id)}>
                {t('settings.deleteTheme')}
              </Button>
            </div>
          </div>
        ))}

        {/* Pro upsell for upload */}
        {!pro && themes.length > 0 && (
          <div style={proNoticeStyle}>{t('settings.themeUploadProNotice')}</div>
        )}

        {/* Close button */}
        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => closeWindow(THEME_LIBRARY_WINDOW_ID)}
          >
            {t('settings.cancel')}
          </Button>
        </div>
      </div>
    </AppWindow>
  )
})

// ── Styles ──────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  padding: '1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  height: '100%',
  overflowY: 'auto',
}

const descStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.82rem',
  opacity: 0.6,
}

const emptyStyle: React.CSSProperties = {
  padding: '2rem',
  textAlign: 'center',
  opacity: 0.35,
  fontSize: '0.85rem',
}

const errorBannerStyle: React.CSSProperties = {
  padding: '0.6rem 0.85rem',
  borderRadius: 8,
  background: 'rgba(239,68,68,0.08)',
  border: '1px solid rgba(239,68,68,0.25)',
  color: '#f87171',
  fontSize: '0.82rem',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.6rem 0',
  borderBottom: '1px solid var(--border)',
  gap: '0.5rem',
  flexWrap: 'wrap',
}

const rowLeftStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flex: 1,
  minWidth: 0,
}

const nameStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const metaStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  opacity: 0.45,
}

const rowActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.3rem',
  flexShrink: 0,
  alignItems: 'center',
}

const activeBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.05rem 0.35rem',
  borderRadius: 4,
  fontSize: '0.6rem',
  fontWeight: 700,
  background: 'rgba(34,197,94,0.15)',
  color: 'var(--success)',
  flexShrink: 0,
}

const uploadedBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.15rem 0.5rem',
  borderRadius: 4,
  fontSize: '0.65rem',
  fontWeight: 600,
  background: 'rgba(34,197,94,0.12)',
  color: 'var(--success)',
}

const proNoticeStyle: React.CSSProperties = {
  padding: '0.6rem 0.85rem',
  borderRadius: 8,
  background: 'rgba(28,171,176,0.08)',
  border: '1px solid rgba(28,171,176,0.2)',
  color: 'var(--primary)',
  fontSize: '0.78rem',
  marginTop: '0.25rem',
}
