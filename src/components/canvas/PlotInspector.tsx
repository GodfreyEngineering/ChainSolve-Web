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
  ReferenceLine,
  AnnotationType,
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
          <option value="bode">{t('plot.chartBode')}</option>
          <option value="nyquist">{t('plot.chartNyquist')}</option>
          <option value="boxplot">{t('plot.chartBoxplot')}</option>
          <option value="violin">{t('plot.chartViolin')}</option>
          <option value="parallelCoords">{t('plot.chartParallelCoords')}</option>
          <option value="contour">{t('plot.chartContour')}</option>
          <option value="pareto">{t('plot.chartPareto')}</option>
          <option value="waterfall">{t('plot.chartWaterfall')}</option>
          <option value="sankey">{t('plot.chartSankey', 'Sankey')}</option>
          <option value="surface3d">{t('plot.chartSurface3d', '3D Surface')}</option>
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

          {/* Animation time column (xyLine / xyScatter only) */}
          {(config.chartType === 'xyLine' || config.chartType === 'xyScatter') &&
            field(
              t('plot.animTimeColumn'),
              <select
                value={config.animTimeColumn ?? ''}
                onChange={(e) =>
                  onUpdate({ animTimeColumn: e.target.value || undefined })
                }
                style={selectStyle}
              >
                <option value="">{t('plot.animNone')}</option>
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>,
            )}

          {/* Secondary Y-axis (xyLine / xyScatter only) */}
          {(config.chartType === 'xyLine' || config.chartType === 'xyScatter') && (
            <>
              {field(
                t('plot.y2Column'),
                <select
                  value={config.yColumns2?.[0] ?? ''}
                  onChange={(e) =>
                    onUpdate({ yColumns2: e.target.value ? [e.target.value] : undefined })
                  }
                  style={selectStyle}
                >
                  <option value="">{t('plot.y2None')}</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>,
              )}
              {config.yColumns2 && config.yColumns2.length > 0 && (
                <div
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}
                >
                  {field(
                    t('plot.y2Label'),
                    <input
                      style={inp}
                      value={config.y2Label ?? ''}
                      onChange={(e) => onUpdate({ y2Label: e.target.value || undefined })}
                      placeholder={t('plot.yAxisPlaceholder')}
                    />,
                  )}
                  {field(
                    t('plot.y2Scale'),
                    <select
                      value={config.y2Scale ?? 'linear'}
                      onChange={(e) => onUpdate({ y2Scale: e.target.value as ScaleType })}
                      style={selectStyle}
                    >
                      <option value="linear">{t('plot.linear')}</option>
                      <option value="log">{t('plot.log')}</option>
                    </select>,
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Annotations: reference lines, bands, text labels */}
      <AnnotationEditor
        annotations={config.referenceLines ?? []}
        onUpdate={(annotations) => onUpdate({ referenceLines: annotations })}
      />
    </div>
  )
}

// ── Annotation editor sub-component ────────────────────────────────────────

interface AnnotationEditorProps {
  annotations: ReferenceLine[]
  onUpdate: (annotations: ReferenceLine[]) => void
}

const annotationHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '0.4rem',
  marginTop: '0.7rem',
}

const smallBtn: React.CSSProperties = {
  fontSize: '0.7rem',
  padding: '0.15rem 0.4rem',
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(28,171,176,0.15)',
  color: 'var(--primary)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const annotationCard: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 6,
  padding: '0.4rem 0.5rem',
  marginBottom: '0.4rem',
  background: 'rgba(0,0,0,0.12)',
}

const tinyInp: React.CSSProperties = {
  padding: '0.18rem 0.35rem',
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(0,0,0,0.2)',
  color: 'var(--text)',
  fontSize: '0.75rem',
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

function AnnotationEditor({ annotations, onUpdate }: AnnotationEditorProps) {
  const { t } = useTranslation()

  const updateAt = (idx: number, patch: Partial<ReferenceLine>) => {
    const next = annotations.map((a, i) => (i === idx ? { ...a, ...patch } : a))
    onUpdate(next)
  }

  const removeAt = (idx: number) => {
    onUpdate(annotations.filter((_, i) => i !== idx))
  }

  const addAnnotation = () => {
    onUpdate([...annotations, { type: 'line', axis: 'y', value: 0, color: '#ef4444' }])
  }

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={annotationHeaderStyle}>
        <span
          style={{
            fontSize: '0.6rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            color: 'rgba(28,171,176,0.6)',
            textTransform: 'uppercase',
          }}
        >
          {t('plot.annotations')}
        </span>
        <button style={smallBtn} onClick={addAnnotation}>
          {t('plot.annotationAdd')}
        </button>
      </div>

      {annotations.map((ann, idx) => {
        const kind: AnnotationType = ann.type ?? 'line'
        return (
          <div key={idx} style={annotationCard}>
            {/* Row 1: type + axis + remove */}
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.3rem', marginBottom: '0.3rem' }}
            >
              <select
                style={{ ...tinyInp, appearance: 'auto', cursor: 'pointer' }}
                value={kind}
                onChange={(e) => updateAt(idx, { type: e.target.value as AnnotationType })}
              >
                <option value="line">{t('plot.annotationLine')}</option>
                <option value="band">{t('plot.annotationBand')}</option>
                <option value="text">{t('plot.annotationText')}</option>
              </select>
              {kind !== 'text' && (
                <select
                  style={{ ...tinyInp, appearance: 'auto', cursor: 'pointer' }}
                  value={ann.axis ?? 'y'}
                  onChange={(e) => updateAt(idx, { axis: e.target.value as 'x' | 'y' })}
                >
                  <option value="x">{t('plot.annotationAxisX')}</option>
                  <option value="y">{t('plot.annotationAxisY')}</option>
                </select>
              )}
              {kind === 'text' && <div />}
              <button
                style={{ ...smallBtn, background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                onClick={() => removeAt(idx)}
              >
                ✕
              </button>
            </div>

            {/* Row 2: value fields */}
            {kind === 'line' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', marginBottom: '0.3rem' }}>
                <input
                  type="number"
                  style={tinyInp}
                  value={ann.value ?? 0}
                  placeholder={t('plot.annotationValue')}
                  onChange={(e) => updateAt(idx, { value: Number(e.target.value) })}
                />
                <input
                  type="color"
                  style={{ ...tinyInp, padding: '0.1rem', height: '1.6rem', cursor: 'pointer' }}
                  value={ann.color ?? '#ef4444'}
                  onChange={(e) => updateAt(idx, { color: e.target.value })}
                />
              </div>
            )}

            {kind === 'band' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.3rem', marginBottom: '0.3rem' }}>
                <input
                  type="number"
                  style={tinyInp}
                  value={ann.value ?? 0}
                  placeholder={t('plot.annotationFrom')}
                  onChange={(e) => updateAt(idx, { value: Number(e.target.value) })}
                />
                <input
                  type="number"
                  style={tinyInp}
                  value={ann.value2 ?? 0}
                  placeholder={t('plot.annotationTo')}
                  onChange={(e) => updateAt(idx, { value2: Number(e.target.value) })}
                />
                <input
                  type="color"
                  style={{ ...tinyInp, padding: '0.1rem', height: '1.6rem', cursor: 'pointer' }}
                  value={ann.color ?? '#ef4444'}
                  onChange={(e) => updateAt(idx, { color: e.target.value })}
                />
              </div>
            )}

            {kind === 'text' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.3rem', marginBottom: '0.3rem' }}>
                <input
                  type="number"
                  style={tinyInp}
                  value={ann.x ?? 0}
                  placeholder="X"
                  onChange={(e) => updateAt(idx, { x: Number(e.target.value) })}
                />
                <input
                  type="number"
                  style={tinyInp}
                  value={ann.y ?? 0}
                  placeholder="Y"
                  onChange={(e) => updateAt(idx, { y: Number(e.target.value) })}
                />
                <input
                  type="color"
                  style={{ ...tinyInp, padding: '0.1rem', height: '1.6rem', cursor: 'pointer' }}
                  value={ann.color ?? '#ef4444'}
                  onChange={(e) => updateAt(idx, { color: e.target.value })}
                />
              </div>
            )}

            {/* Row 3: label / text content */}
            <input
              type="text"
              style={tinyInp}
              value={ann.text ?? ann.label ?? ''}
              placeholder={kind === 'text' ? t('plot.annotationTextContent') : t('plot.annotationLabel')}
              onChange={(e) => updateAt(idx, { text: e.target.value || undefined, label: undefined })}
            />
          </div>
        )
      })}
    </div>
  )
}
