/**
 * PlotInspector — Inspector sub-panel for plot node configuration.
 *
 * Rendered inside Inspector when the inspected node uses csPlot nodeKind.
 * All changes applied via onUpdate() → merges into data.plotConfig.
 */

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
  color: '#F4F4F3',
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
        Plot Settings
      </span>

      {/* Chart Type */}
      {field(
        'Chart Type',
        <select
          value={config.chartType}
          onChange={(e) => onUpdate({ chartType: e.target.value as ChartType })}
          style={selectStyle}
        >
          <option value="xyLine">Line</option>
          <option value="xyScatter">Scatter</option>
          <option value="histogram">Histogram</option>
          <option value="bar">Bar</option>
          <option value="heatmap">Heatmap</option>
        </select>,
      )}

      {/* Theme Preset */}
      {field(
        'Theme',
        <select
          value={config.themePreset ?? 'paper-single'}
          onChange={(e) => onUpdate({ themePreset: e.target.value as PlotThemePreset })}
          style={selectStyle}
        >
          <option value="paper-single">Paper (single col)</option>
          <option value="paper-double">Paper (double col)</option>
          <option value="presentation">Presentation 16:9</option>
          <option value="report">Report (A4)</option>
        </select>,
      )}

      {/* Title */}
      {field(
        'Title',
        <input
          style={inp}
          value={config.title ?? ''}
          onChange={(e) => onUpdate({ title: e.target.value || undefined })}
          placeholder="Chart title..."
        />,
      )}

      {/* Subtitle */}
      {field(
        'Subtitle',
        <input
          style={inp}
          value={config.subtitle ?? ''}
          onChange={(e) => onUpdate({ subtitle: e.target.value || undefined })}
          placeholder="Subtitle..."
        />,
      )}

      {/* Axis Labels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        {field(
          'X Label',
          <input
            style={inp}
            value={config.xLabel ?? ''}
            onChange={(e) => onUpdate({ xLabel: e.target.value || undefined })}
            placeholder="X axis"
          />,
        )}
        {field(
          'Y Label',
          <input
            style={inp}
            value={config.yLabel ?? ''}
            onChange={(e) => onUpdate({ yLabel: e.target.value || undefined })}
            placeholder="Y axis"
          />,
        )}
      </div>

      {/* Scales */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        {field(
          'X Scale',
          <select
            value={config.xScale ?? 'linear'}
            onChange={(e) => onUpdate({ xScale: e.target.value as ScaleType })}
            style={selectStyle}
          >
            <option value="linear">Linear</option>
            <option value="log">Log</option>
          </select>,
        )}
        {field(
          'Y Scale',
          <select
            value={config.yScale ?? 'linear'}
            onChange={(e) => onUpdate({ yScale: e.target.value as ScaleType })}
            style={selectStyle}
          >
            <option value="linear">Linear</option>
            <option value="log">Log</option>
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
            style={{ accentColor: '#1CABB0' }}
          />
          Show grid
        </label>
        <label style={checkRow}>
          <input
            type="checkbox"
            checked={config.showLegend ?? false}
            onChange={(e) => onUpdate({ showLegend: e.target.checked })}
            style={{ accentColor: '#1CABB0' }}
          />
          Show legend
        </label>
        <label style={checkRow}>
          <input
            type="checkbox"
            checked={config.showBranding ?? false}
            onChange={(e) => onUpdate({ showBranding: e.target.checked })}
            style={{ accentColor: '#1CABB0' }}
          />
          Include branding in export
        </label>
      </div>

      {/* Legend Position (only if legend shown) */}
      {config.showLegend &&
        field(
          'Legend Position',
          <select
            value={config.legendPosition ?? 'right'}
            onChange={(e) => onUpdate({ legendPosition: e.target.value as LegendPosition })}
            style={selectStyle}
          >
            <option value="right">Right</option>
            <option value="bottom">Bottom</option>
          </select>,
        )}

      {/* Max Points (line/scatter only) */}
      {(config.chartType === 'xyLine' || config.chartType === 'xyScatter') &&
        field(
          `Max Points (${config.maxPoints ?? 2000})`,
          <input
            type="range"
            min={100}
            max={10000}
            step={100}
            value={config.maxPoints ?? 2000}
            onChange={(e) => onUpdate({ maxPoints: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#1CABB0' }}
          />,
        )}

      {/* Bin Count (histogram only) */}
      {config.chartType === 'histogram' &&
        field(
          `Bins (${config.binCount ?? 30})`,
          <input
            type="range"
            min={5}
            max={100}
            step={1}
            value={config.binCount ?? 30}
            onChange={(e) => onUpdate({ binCount: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#1CABB0' }}
          />,
        )}

      {/* Column selectors (when Table input connected) */}
      {columns.length > 0 && (
        <>
          {field(
            'X Column',
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
              'Y Column(s)',
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
