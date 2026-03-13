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

export function ExportSettings({
  cardStyle,
  checkRowStyle,
  checkboxStyle,
  checkLabelStyle,
  checkHintStyle,
}: Props) {
  const { t } = useTranslation()
  const defaultExportFormat = usePreferencesStore((s) => s.defaultExportFormat)
  const exportPageSize = usePreferencesStore((s) => s.exportPageSize)
  const exportIncludeImages = usePreferencesStore((s) => s.exportIncludeImages)
  const exportIncludeAnnotations = usePreferencesStore((s) => s.exportIncludeAnnotations)
  const updatePrefs = usePreferencesStore((s) => s.update)

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Select
          label={t('settings.exportFormat')}
          options={[
            { value: 'pdf', label: 'PDF' },
            { value: 'xlsx', label: 'Excel (XLSX)' },
          ]}
          value={defaultExportFormat}
          onChange={(e) => updatePrefs({ defaultExportFormat: e.target.value as 'pdf' | 'xlsx' })}
        />

        <Select
          label={t('settings.exportPageSize')}
          hint={t('settings.exportPageSizeHint')}
          options={[
            { value: 'a4', label: 'A4' },
            { value: 'letter', label: 'Letter' },
          ]}
          value={exportPageSize}
          onChange={(e) => updatePrefs({ exportPageSize: e.target.value as 'a4' | 'letter' })}
        />

        <label style={checkRowStyle}>
          <input
            type="checkbox"
            checked={exportIncludeImages}
            onChange={(e) => updatePrefs({ exportIncludeImages: e.target.checked })}
            style={checkboxStyle}
          />
          <div>
            <span style={checkLabelStyle}>{t('settings.exportImages')}</span>
            <span style={checkHintStyle}>{t('settings.exportImagesHint')}</span>
          </div>
        </label>

        <label style={checkRowStyle}>
          <input
            type="checkbox"
            checked={exportIncludeAnnotations}
            onChange={(e) => updatePrefs({ exportIncludeAnnotations: e.target.checked })}
            style={checkboxStyle}
          />
          <div>
            <span style={checkLabelStyle}>{t('settings.exportAnnotations')}</span>
            <span style={checkHintStyle}>{t('settings.exportAnnotationsHint')}</span>
          </div>
        </label>
      </div>
    </div>
  )
}
