/**
 * PlotInspector — Inspector sub-panel for plot node configuration.
 *
 * Rendered inside Inspector when the inspected node uses csPlot nodeKind.
 * All changes applied via onUpdate() → merges into data.plotConfig.
 */

import { useTranslation } from 'react-i18next'
import type {
  PlotConfig,
  ChartType,
  ScaleType,
  LegendPosition,
  PlotThemePreset,
} from '../../blocks/types'
import type { Value } from '../../engine/value'
import { isTable } from '../../engine/value'

interface PlotInspectorProps {
  config: PlotConfig
  inputValue: Value | undefined
  onUpdate: (patch: Partial<PlotConfig>) => void
}

const fieldLabel: React.CSSProperties = {
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.05em',
  color: 'rgba(244,244,243,0.4)',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: '0.2rem',
  userSelect: 'none',
}

const inp: React.CSSProperties = {
  width: '100%',
  padding: '0.28rem 0.45rem',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(0,0,0,0.2)',
  color: 'var(--text)',
  fontSize: '0.8rem',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inp,
  appearance: 'auto',
  cursor: 'pointer',
}

const checkRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  marginBottom: '0.3rem',
  fontSize: '0.78rem',
  color: 'rgba(244,244,243,0.7)',
  cursor: 'pointer',
}

export function PlotInspector({ config, inputValue, onUpdate }: PlotInspectorProps) {
  const { t } = useTranslation()
  const columns: string[] =
    inputValue && isTable(inputValue) ? [...(inputValue.columns as string[])] : []

  const field = (label: string, children: React.ReactNode) => (
    <div style={{ marginBottom: '0.7rem' }}>
      <span style={fieldLabel}>{label}</span>
      {children}
    </div>
  )

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <span
        style={{
          ...fieldLabel,
          fontSize: '0.6rem',
          marginBottom: '0.6rem',
          color: 'rgba(28,171,176,0.6)',
        }}
      >
        {t('plot.settings')}
      </span>

      {/* Chart Type */}
      {field(
        t('plot.chartType'),
        <select
          value={config.chartType}
          onChange={(e) => onUpdate({ chartType: e.target.value as ChartType })}
          style={selectStyle}
        >
          <option value="xyLine">{t('plot.chartLine')}</option>
          <option value="xyScatter">{t('plot.chartScatter')}</option>
          <option value="histogram">{t('plot.chartHistogram')}</option>
          <option value="bar">{t('plot.chartBar')}</option>
          <option value="heatmap">{t('plot.chartHeatmap')}</option>
        </select>,
      )}

      {/* Theme Preset */}
      {field(
        t('plot.theme'),
        <select
          value={config.themePreset ?? 'paper-single'}
          onChange={(e) => onUpdate({ themePreset: e.target.value as PlotThemePreset })}
          style={selectStyle}
        >
          <option value="paper-single">{t('plot.themePaperSingle')}</option>
          <option value="paper-double">{t('plot.themePaperDouble')}</option>
          <option value="presentation">{t('plot.themePresentation')}</option>
          <option value="report">{t('plot.themeReport')}</option>
        </select>,
      )}

      {/* Title */}
      {field(
        t('plot.title'),
        <input
          style={inp}
          value={config.title ?? ''}
          onChange={(e) => onUpdate({ title: e.target.value || undefined })}
          placeholder={t('plot.titlePlaceholder')}
        />,
      )}

      {/* Subtitle */}
      {field(
        t('plot.subtitle'),
        <input
          style={inp}
          value={config.subtitle ?? ''}
          onChange={(e) => onUpdate({ subtitle: e.target.value || undefined })}
          placeholder={t('plot.subtitlePlaceholder')}
        />,
      )}

      {/* Axis Labels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        {field(
          t('plot.xLabel'),
          <input
            style={inp}
            value={config.xLabel ?? ''}
            onChange={(e) => onUpdate({ xLabel: e.target.value || undefined })}
            placeholder={t('plot.xAxisPlaceholder')}
          />,
        )}
        {field(
          t('plot.yLabel'),
          <input
            style={inp}
            value={config.yLabel ?? ''}
            onChange={(e) => onUpdate({ yLabel: e.target.value || undefined })}
            placeholder={t('plot.yAxisPlaceholder')}
          />,
        )}
      </div>

      {/* Scales */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        {field(
          t('plot.xScale'),
          <select
            value={config.xScale ?? 'linear'}
            onChange={(e) => onUpdate({ xScale: e.target.value as ScaleType })}
            style={selectStyle}
          >
            <option value="linear">{t('plot.linear')}</option>
            <option value="log">{t('plot.log')}</option>
          </select>,
        )}
        {field(
          t('plot.yScale'),
          <select
            value={config.yScale ?? 'linear'}
            onChange={(e) => onUpdate({ yScale: e.target.value as ScaleType })}
            style={selectStyle}
          >
            <option value="linear">{t('plot.linear')}</option>
            <option value="log">{t('plot.log')}</option>
          </select>,
        )}
      </div>

      {/* Grid + Legend */}
      <div style={{ marginBottom: '0.7rem' }}>
        <label style={checkRow}>
          <input
            type="checkbox"
            checked={config.showGrid ?? true}
            onChange={(e) => onUpdate({ showGrid: e.target.checked })}
            style={{ accentColor: 'var(--primary)' }}
          />
          {t('plot.showGrid')}
        </label>
        <label style={checkRow}>
          <input
            type="checkbox"
            checked={config.showLegend ?? false}
            onChange={(e) => onUpdate({ showLegend: e.target.checked })}
            style={{ accentColor: 'var(--primary)' }}
          />
          {t('plot.showLegend')}
        </label>
        <label style={checkRow}>
          <input
            type="checkbox"
            checked={config.showBranding ?? false}
            onChange={(e) => onUpdate({ showBranding: e.target.checked })}
            style={{ accentColor: 'var(--primary)' }}
          />
          {t('plot.branding')}
        </label>
      </div>

      {/* Legend Position (only if legend shown) */}
      {config.showLegend &&
        field(
          t('plot.legendPosition'),
          <select
            value={config.legendPosition ?? 'right'}
            onChange={(e) => onUpdate({ legendPosition: e.target.value as LegendPosition })}
            style={selectStyle}
          >
            <option value="right">{t('plot.legendRight')}</option>
            <option value="bottom">{t('plot.legendBottom')}</option>
          </select>,
        )}

      {/* Max Points (line/scatter only) */}
      {(config.chartType === 'xyLine' || config.chartType === 'xyScatter') &&
        field(
          `${t('plot.maxPoints')} (${config.maxPoints ?? 2000})`,
          <input
            type="range"
            min={100}
            max={10000}
            step={100}
            value={config.maxPoints ?? 2000}
            onChange={(e) => onUpdate({ maxPoints: Number(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--primary)' }}
          />,
        )}

      {/* Bin Count (histogram only) */}
      {config.chartType === 'histogram' &&
        field(
          `${t('plot.bins')} (${config.binCount ?? 30})`,
          <input
            type="range"
            min={5}
            max={100}
            step={1}
            value={config.binCount ?? 30}
            onChange={(e) => onUpdate({ binCount: Number(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--primary)' }}
          />,
        )}

      {/* Column selectors (when Table input connected) */}
      {columns.length > 0 && (
        <>
          {field(
            t('plot.xColumn'),
            <select
              value={config.xColumn ?? columns[0]}
              onChange={(e) => onUpdate({ xColumn: e.target.value })}
              style={selectStyle}
            >
              {columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>,
          )}

          {config.chartType !== 'histogram' &&
            field(
              t('plot.yColumns'),
              <select
                value={config.yColumns?.[0] ?? columns[1] ?? columns[0]}
                onChange={(e) => onUpdate({ yColumns: [e.target.value] })}
                style={selectStyle}
              >
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>,
            )}
        </>
      )}
    </div>
  )
}
