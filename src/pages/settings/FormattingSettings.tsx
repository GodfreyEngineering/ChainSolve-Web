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
  const mode = prefs.numberDisplayMode

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* SCI-05: Number display mode */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Select
            label={t('settings.numberDisplayMode', 'Number display')}
            hint={t('settings.numberDisplayModeHint', 'Controls how numeric values are shown.')}
            options={[
              { value: 'auto', label: t('settings.displayAuto', 'Auto (smart)') },
              { value: 'decimal', label: t('settings.displayDecimal', 'Fixed decimal places') },
              { value: 'sig_figs', label: t('settings.displaySigFigs', 'Significant figures') },
              { value: 'scientific', label: t('settings.displayScientific', 'Scientific notation always') },
            ]}
            value={mode}
            onChange={(e) =>
              prefs.update({ numberDisplayMode: e.target.value as typeof prefs.numberDisplayMode })
            }
          />

          {(mode === 'auto' || mode === 'decimal') && (
            <Select
              label={t('settings.decimalPlaces', 'Decimal places')}
              hint={t('settings.decimalPlacesHint', 'Number of digits after the decimal point.')}
              options={[
                { value: '-1', label: t('settings.decimalAuto', 'Auto') },
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
          )}

          {mode === 'sig_figs' && (
            <Select
              label={t('settings.sigFigs', 'Significant figures')}
              hint={t('settings.sigFigsHint', 'Total number of meaningful digits.')}
              options={[
                { value: '2', label: '2' },
                { value: '3', label: '3' },
                { value: '4', label: '4' },
                { value: '5', label: '5' },
                { value: '6', label: '6' },
                { value: '8', label: '8' },
                { value: '10', label: '10' },
              ]}
              value={String(prefs.sigFigs)}
              onChange={(e) => prefs.update({ sigFigs: parseInt(e.target.value) })}
            />
          )}

          {mode === 'auto' && (
            <Select
              label={t('settings.sciNotation', 'Scientific notation threshold')}
              hint={t('settings.sciNotationHint', 'Values above this use scientific notation.')}
              options={[
                { value: '1000', label: '1,000' },
                { value: '10000', label: '10,000' },
                { value: '100000', label: '100,000' },
                { value: '1000000', label: t('settings.sciDefault', '1,000,000 (default)') },
                { value: '1000000000', label: '1,000,000,000' },
              ]}
              value={String(prefs.scientificNotationThreshold)}
              onChange={(e) =>
                prefs.update({ scientificNotationThreshold: parseFloat(e.target.value) })
              }
            />
          )}
        </div>
      </div>

      {/* SCI-07: Separators */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Select
            label={t('settings.decimalSeparator', 'Decimal separator')}
            hint={t('settings.decimalSeparatorHint', 'Character used between integer and fractional parts.')}
            options={[
              { value: '.', label: t('settings.decimalPeriod', 'Period (1.23)') },
              { value: ',', label: t('settings.decimalComma', 'Comma (1,23)') },
            ]}
            value={prefs.decimalSeparator}
            onChange={(e) => prefs.update({ decimalSeparator: e.target.value as '.' | ',' })}
          />

          <label style={checkRowStyle}>
            <input
              type="checkbox"
              checked={prefs.thousandsSeparator}
              onChange={(e) => prefs.update({ thousandsSeparator: e.target.checked })}
              style={checkboxStyle}
            />
            <div>
              <span style={checkLabelStyle}>{t('settings.thousandsSep', 'Thousands separator')}</span>
              <span style={checkHintStyle}>{t('settings.thousandsSepHint', 'Group digits in threes.')}</span>
            </div>
          </label>

          {prefs.thousandsSeparator && (
            <Select
              label={t('settings.thousandsSepChar', 'Thousands separator style')}
              options={[
                { value: 'comma', label: t('settings.sepComma', 'Comma (1,000)') },
                { value: 'period', label: t('settings.sepPeriod', 'Period (1.000)') },
                { value: 'space', label: t('settings.sepSpace', 'Thin space (1\u2009000)') },
                { value: 'underscore', label: t('settings.sepUnderscore', 'Underscore (1_000)') },
                { value: 'apostrophe', label: t('settings.sepApostrophe', "Apostrophe (1'000)") },
              ]}
              value={prefs.thousandsSeparatorChar}
              onChange={(e) =>
                prefs.update({
                  thousandsSeparatorChar: e.target.value as typeof prefs.thousandsSeparatorChar,
                })
              }
            />
          )}
        </div>
      </div>

      {/* SCI-02: High-precision constants */}
      <div style={cardStyle}>
        <label style={checkRowStyle}>
          <input
            type="checkbox"
            checked={prefs.highPrecisionConstants}
            onChange={(e) => prefs.update({ highPrecisionConstants: e.target.checked })}
            style={checkboxStyle}
          />
          <div>
            <span style={checkLabelStyle}>
              {t('settings.highPrecisionConstants', 'High-precision constants')}
            </span>
            <span style={checkHintStyle}>
              {t(
                'settings.highPrecisionConstantsHint',
                'Show \u03C0, e, \u03C6, \u221A2 at full precision (100 decimal places) when matched.',
              )}
            </span>
          </div>
        </label>
      </div>
    </div>
  )
}
