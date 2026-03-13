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
  const mode = usePreferencesStore((s) => s.numberDisplayMode)
  const decimalPlaces = usePreferencesStore((s) => s.decimalPlaces)
  const sigFigs = usePreferencesStore((s) => s.sigFigs)
  const scientificNotationThreshold = usePreferencesStore(
    (s) => s.scientificNotationThreshold,
  )
  const trailingZeros = usePreferencesStore((s) => s.trailingZeros)
  const decimalSeparator = usePreferencesStore((s) => s.decimalSeparator)
  const thousandsSeparator = usePreferencesStore((s) => s.thousandsSeparator)
  const thousandsSeparatorChar = usePreferencesStore((s) => s.thousandsSeparatorChar)
  const negativeStyle = usePreferencesStore((s) => s.negativeStyle)
  const angleUnit = usePreferencesStore((s) => s.angleUnit)
  const highPrecisionConstants = usePreferencesStore((s) => s.highPrecisionConstants)
  const updatePrefs = usePreferencesStore((s) => s.update)

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
              {
                value: 'scientific',
                label: t('settings.displayScientific', 'Scientific notation always'),
              },
            ]}
            value={mode}
            onChange={(e) =>
              updatePrefs({ numberDisplayMode: e.target.value as typeof mode })
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
                { value: '10', label: '10' },
                { value: '12', label: '12' },
                { value: '15', label: t('settings.decimal15', '15 (high precision)') },
              ]}
              value={String(decimalPlaces)}
              onChange={(e) => updatePrefs({ decimalPlaces: parseInt(e.target.value) })}
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
              value={String(sigFigs)}
              onChange={(e) => updatePrefs({ sigFigs: parseInt(e.target.value) })}
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
              value={String(scientificNotationThreshold)}
              onChange={(e) =>
                updatePrefs({ scientificNotationThreshold: parseFloat(e.target.value) })
              }
            />
          )}
        </div>
      </div>

      {/* PREC-04: Trailing zeros */}
      {(mode === 'decimal' || mode === 'scientific') && (
        <div style={cardStyle}>
          <label style={checkRowStyle}>
            <input
              type="checkbox"
              checked={trailingZeros}
              onChange={(e) => updatePrefs({ trailingZeros: e.target.checked })}
              style={checkboxStyle}
            />
            <div>
              <span style={checkLabelStyle}>
                {t('settings.trailingZeros', 'Show trailing zeros')}
              </span>
              <span style={checkHintStyle}>
                {t('settings.trailingZerosHint', 'Show 1.50 instead of 1.5 in fixed-decimal mode.')}
              </span>
            </div>
          </label>
        </div>
      )}

      {/* SCI-07: Separators */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Select
            label={t('settings.decimalSeparator', 'Decimal separator')}
            hint={t(
              'settings.decimalSeparatorHint',
              'Character used between integer and fractional parts.',
            )}
            options={[
              { value: '.', label: t('settings.decimalPeriod', 'Period (1.23)') },
              { value: ',', label: t('settings.decimalComma', 'Comma (1,23)') },
            ]}
            value={decimalSeparator}
            onChange={(e) => updatePrefs({ decimalSeparator: e.target.value as '.' | ',' })}
          />

          <label style={checkRowStyle}>
            <input
              type="checkbox"
              checked={thousandsSeparator}
              onChange={(e) => updatePrefs({ thousandsSeparator: e.target.checked })}
              style={checkboxStyle}
            />
            <div>
              <span style={checkLabelStyle}>
                {t('settings.thousandsSep', 'Thousands separator')}
              </span>
              <span style={checkHintStyle}>
                {t('settings.thousandsSepHint', 'Group digits in threes.')}
              </span>
            </div>
          </label>

          {thousandsSeparator && (
            <Select
              label={t('settings.thousandsSepChar', 'Thousands separator style')}
              options={[
                { value: 'comma', label: t('settings.sepComma', 'Comma (1,000)') },
                { value: 'period', label: t('settings.sepPeriod', 'Period (1.000)') },
                { value: 'space', label: t('settings.sepSpace', 'Thin space (1\u2009000)') },
                { value: 'underscore', label: t('settings.sepUnderscore', 'Underscore (1_000)') },
                { value: 'apostrophe', label: t('settings.sepApostrophe', "Apostrophe (1'000)") },
              ]}
              value={thousandsSeparatorChar}
              onChange={(e) =>
                updatePrefs({
                  thousandsSeparatorChar: e.target.value as typeof thousandsSeparatorChar,
                })
              }
            />
          )}

          {/* PREC-04: Negative style */}
          <Select
            label={t('settings.negativeStyle', 'Negative number style')}
            hint={t('settings.negativeStyleHint', 'How negative values are displayed.')}
            options={[
              { value: 'minus', label: t('settings.negMinus', 'Minus sign (−1.5)') },
              { value: 'parens', label: t('settings.negParens', 'Parentheses ((1.5))') },
            ]}
            value={negativeStyle}
            onChange={(e) => updatePrefs({ negativeStyle: e.target.value as 'minus' | 'parens' })}
          />
        </div>
      </div>

      {/* SCI-06: Angle unit preference */}
      <div style={cardStyle}>
        <Select
          label={t('settings.angleUnit', 'Angle unit')}
          hint={t(
            'settings.angleUnitHint',
            'Controls how trig blocks (sin, cos, tan, asin, acos, atan, atan2) interpret and output angles. A ° or rad badge is shown on each trig block.',
          )}
          options={[
            { value: 'rad', label: t('settings.angleUnitRad', 'Radians (rad)') },
            { value: 'deg', label: t('settings.angleUnitDeg', 'Degrees (°)') },
          ]}
          value={angleUnit}
          onChange={(e) => updatePrefs({ angleUnit: e.target.value as 'rad' | 'deg' })}
        />
      </div>

      {/* SCI-02: High-precision constants */}
      <div style={cardStyle}>
        <label style={checkRowStyle}>
          <input
            type="checkbox"
            checked={highPrecisionConstants}
            onChange={(e) => updatePrefs({ highPrecisionConstants: e.target.checked })}
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
