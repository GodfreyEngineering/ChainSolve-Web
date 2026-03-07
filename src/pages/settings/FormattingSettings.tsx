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

export function FormattingSettings({
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
          label={t('settings.decimalPlaces')}
          hint={t('settings.decimalPlacesHint')}
          options={[
            { value: '-1', label: t('settings.decimalAuto') },
            { value: '0', label: '0' },
            { value: '1', label: '1' },
            { value: '2', label: '2' },
            { value: '3', label: '3' },
            { value: '4', label: '4' },
            { value: '6', label: '6' },
            { value: '8', label: '8' },
          ]}
          value={String(prefs.decimalPlaces)}
          onChange={(e) => prefs.update({ decimalPlaces: parseInt(e.target.value) })}
        />

        <Select
          label={t('settings.sciNotation')}
          hint={t('settings.sciNotationHint')}
          options={[
            { value: '1000', label: '1,000' },
            { value: '10000', label: '10,000' },
            { value: '100000', label: '100,000' },
            { value: '1000000', label: t('settings.sciDefault') },
            { value: '1000000000', label: '1,000,000,000' },
          ]}
          value={String(prefs.scientificNotationThreshold)}
          onChange={(e) =>
            prefs.update({ scientificNotationThreshold: parseFloat(e.target.value) })
          }
        />

        <label style={checkRowStyle}>
          <input
            type="checkbox"
            checked={prefs.thousandsSeparator}
            onChange={(e) => prefs.update({ thousandsSeparator: e.target.checked })}
            style={checkboxStyle}
          />
          <div>
            <span style={checkLabelStyle}>{t('settings.thousandsSep')}</span>
            <span style={checkHintStyle}>{t('settings.thousandsSepHint')}</span>
          </div>
        </label>
      </div>
    </div>
  )
}
