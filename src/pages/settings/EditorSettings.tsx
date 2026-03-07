import { useTranslation } from 'react-i18next'
import { Select } from '../../components/ui/Select'
import { usePreferencesStore } from '../../stores/preferencesStore'

interface Props {
  cardStyle: React.CSSProperties
  checkRowStyle: React.CSSProperties
  checkboxStyle: React.CSSProperties
  checkLabelStyle: React.CSSProperties
  checkHintStyle: React.CSSProperties
}

export function EditorSettings({
  cardStyle,
  checkRowStyle,
  checkboxStyle,
  checkLabelStyle,
  checkHintStyle,
}: Props) {
  const { t } = useTranslation()
  const prefs = usePreferencesStore()

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        <label style={checkRowStyle}>
          <input
            type="checkbox"
            checked={prefs.defaultSnapToGrid}
            onChange={(e) => prefs.update({ defaultSnapToGrid: e.target.checked })}
            style={checkboxStyle}
          />
          <div>
            <span style={checkLabelStyle}>{t('settings.snapToGrid')}</span>
            <span style={checkHintStyle}>{t('settings.snapToGridHint')}</span>
          </div>
        </label>

        <label style={checkRowStyle}>
          <input
            type="checkbox"
            checked={prefs.defaultEdgeAnimation}
            onChange={(e) => prefs.update({ defaultEdgeAnimation: e.target.checked })}
            style={checkboxStyle}
          />
          <div>
            <span style={checkLabelStyle}>{t('settings.animatedChains')}</span>
            <span style={checkHintStyle}>{t('settings.animatedChainsHint')}</span>
          </div>
        </label>

        <label style={checkRowStyle}>
          <input
            type="checkbox"
            checked={prefs.defaultLod}
            onChange={(e) => prefs.update({ defaultLod: e.target.checked })}
            style={checkboxStyle}
          />
          <div>
            <span style={checkLabelStyle}>{t('settings.lodRendering')}</span>
            <span style={checkHintStyle}>{t('settings.lodRenderingHint')}</span>
          </div>
        </label>

        <label style={checkRowStyle}>
          <input
            type="checkbox"
            checked={prefs.showGrid}
            onChange={(e) => prefs.update({ showGrid: e.target.checked })}
            style={checkboxStyle}
          />
          <div>
            <span style={checkLabelStyle}>{t('settings.showGrid')}</span>
            <span style={checkHintStyle}>{t('settings.showGridHint')}</span>
          </div>
        </label>

        <Select
          label={t('settings.defaultZoom')}
          hint={t('settings.defaultZoomHint')}
          options={[
            { value: '50', label: '50%' },
            { value: '75', label: '75%' },
            { value: '100', label: '100%' },
            { value: '125', label: '125%' },
            { value: '150', label: '150%' },
          ]}
          value={String(prefs.defaultZoom)}
          onChange={(e) => prefs.update({ defaultZoom: parseInt(e.target.value) })}
        />
      </div>
    </div>
  )
}
