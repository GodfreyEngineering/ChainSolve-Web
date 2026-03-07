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
  const prefs = usePreferencesStore()

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Select
          label={t('settings.exportFormat')}
          options={[
            { value: 'pdf', label: 'PDF' },
            { value: 'xlsx', label: 'Excel (XLSX)' },
          ]}
          value={prefs.defaultExportFormat}
          onChange={(e) => prefs.update({ defaultExportFormat: e.target.value as 'pdf' | 'xlsx' })}
        />

        <Select
          label={t('settings.exportPageSize')}
          hint={t('settings.exportPageSizeHint')}
          options={[
            { value: 'a4', label: 'A4' },
            { value: 'letter', label: 'Letter' },
          ]}
          value={prefs.exportPageSize}
          onChange={(e) => prefs.update({ exportPageSize: e.target.value as 'a4' | 'letter' })}
        />

        <label style={checkRowStyle}>
          <input
            type="checkbox"
            checked={prefs.exportIncludeImages}
            onChange={(e) => prefs.update({ exportIncludeImages: e.target.checked })}
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
            checked={prefs.exportIncludeAnnotations}
            onChange={(e) => prefs.update({ exportIncludeAnnotations: e.target.checked })}
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
