/**
 * plot-spec.ts — Pure Vega-Lite spec generation.
 *
 * Input: a Value (vector, table) + PlotConfig.
 * Output: a Vega-Lite TopLevelSpec as a plain JSON object.
 *
 * No Vega/Vega-Lite imports here — this is a pure data transform.
 */

import type { Value } from '../engine/value'
import { isVector, isTable, isScalar, isError } from '../engine/value'
import type { PlotConfig, PlotThemePreset } from '../blocks/types'
import { lttbDownsample, type Point } from './downsample'

// ── Theme presets ──────────────────────────────────────────────────────────

export interface ThemeDimensions {
  width: number
  height: number
  fontSize: number
  titleFontSize: number
  padding: number
  background: string
  lineWidth: number
}

export const THEME_PRESETS: Record<PlotThemePreset, ThemeDimensions> = {
  'paper-single': {
    width: 360,
    height: 240,
    fontSize: 10,
    titleFontSize: 12,
    padding: 40,
    background: '#ffffff',
    lineWidth: 1.5,
  },
  'paper-double': {
    width: 720,
    height: 360,
    fontSize: 12,
    titleFontSize: 14,
    padding: 50,
    background: '#ffffff',
    lineWidth: 2,
  },
  presentation: {
    width: 960,
    height: 540,
    fontSize: 16,
    titleFontSize: 20,
    padding: 60,
    background: '#ffffff',
    lineWidth: 3,
  },
  report: {
    width: 680,
    height: 480,
    fontSize: 11,
    titleFontSize: 13,
    padding: 45,
    background: '#ffffff',
    lineWidth: 1.5,
  },
}

// ── Inline node preview dimensions ──────────────────────────────────────────

const INLINE_WIDTH = 280
const INLINE_HEIGHT = 180

// ── Data extraction ─────────────────────────────────────────────────────────

interface PlotData {
  values: Record<string, unknown>[]
  columns: string[]
  isDownsampled: boolean
  originalCount: number
}

function extractPlotData(value: Value, config: PlotConfig): PlotData | { error: string } {
  if (isError(value)) return { error: value.message }
  if (isScalar(value)) return { error: 'Plot needs a Vector or Table input' }

  if (isVector(value)) {
    const raw: Point[] = value.value.map((y, i) => ({ x: i, y }))
    const maxPts = config.maxPoints ?? 2000
    const downsampled = raw.length > maxPts
    const points = downsampled ? lttbDownsample(raw, maxPts) : raw
    return {
      values: points.map((p) => ({ x: p.x, y: p.y })),
      columns: ['x', 'y'],
      isDownsampled: downsampled,
      originalCount: raw.length,
    }
  }

  if (isTable(value)) {
    const cols = value.columns as string[]
    const values = (value.rows as readonly (readonly number[])[]).map((row) => {
      const obj: Record<string, unknown> = {}
      cols.forEach((c, i) => {
        obj[c] = row[i] ?? null
      })
      return obj
    })
    return {
      values,
      columns: cols,
      isDownsampled: false,
      originalCount: values.length,
    }
  }

  return { error: 'Unknown value type' }
}

// ── Spec builders ───────────────────────────────────────────────────────────

export interface SpecResult {
  spec: Record<string, unknown>
  isDownsampled: boolean
  originalCount: number
}

/**
 * Build a Vega-Lite spec for inline (node body) rendering.
 * Uses compact dimensions regardless of theme preset.
 */
export function buildInlineSpec(
  value: Value | undefined,
  config: PlotConfig,
): SpecResult | { error: string } {
  if (!value) return { error: 'No data connected' }
  return buildSpec(value, config, INLINE_WIDTH, INLINE_HEIGHT)
}

/**
 * Build a Vega-Lite spec for full-size (modal) rendering.
 * Uses theme preset dimensions.
 */
export function buildFullSpec(
  value: Value | undefined,
  config: PlotConfig,
): SpecResult | { error: string } {
  if (!value) return { error: 'No data connected' }
  const theme = THEME_PRESETS[config.themePreset ?? 'paper-single']
  return buildSpec(value, config, theme.width, theme.height)
}

function buildSpec(
  value: Value,
  config: PlotConfig,
  width: number,
  height: number,
): SpecResult | { error: string } {
  const data = extractPlotData(value, config)
  if ('error' in data) return data

  const theme = THEME_PRESETS[config.themePreset ?? 'paper-single']

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base: Record<string, any> = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width,
    height,
    autosize: { type: 'fit', contains: 'padding' },
    background: theme.background,
    data: { values: data.values },
    config: {
      font: "'Montserrat', system-ui, sans-serif",
      axis: { labelFontSize: theme.fontSize, titleFontSize: theme.fontSize },
      title: { fontSize: theme.titleFontSize },
    },
  }

  if (config.title) {
    base.title = config.subtitle ? { text: config.title, subtitle: config.subtitle } : config.title
  }

  const xScale = config.xScale === 'log' ? { type: 'log' as const } : { type: 'linear' as const }
  const yScale = config.yScale === 'log' ? { type: 'log' as const } : { type: 'linear' as const }

  switch (config.chartType) {
    case 'xyLine':
    case 'xyScatter': {
      const xField = config.xColumn ?? data.columns[0] ?? 'x'
      const yFields = config.yColumns ?? [data.columns[1] ?? data.columns[0] ?? 'y']

      if (yFields.length <= 1) {
        base.mark = {
          type: config.chartType === 'xyLine' ? 'line' : 'point',
          strokeWidth: theme.lineWidth,
        }
        base.encoding = {
          x: { field: xField, type: 'quantitative', scale: xScale, title: config.xLabel },
          y: {
            field: yFields[0],
            type: 'quantitative',
            scale: yScale,
            title: config.yLabel,
          },
        }
      } else {
        // Multi-series: fold yColumns
        base.transform = [{ fold: yFields, as: ['series', 'value'] }]
        base.mark = {
          type: config.chartType === 'xyLine' ? 'line' : 'point',
          strokeWidth: theme.lineWidth,
        }
        base.encoding = {
          x: { field: xField, type: 'quantitative', scale: xScale, title: config.xLabel },
          y: { field: 'value', type: 'quantitative', scale: yScale, title: config.yLabel },
          color: { field: 'series', type: 'nominal' },
        }
      }
      break
    }

    case 'histogram': {
      const field = config.xColumn ?? data.columns[0] ?? 'y'
      base.mark = 'bar'
      base.encoding = {
        x: {
          field,
          type: 'quantitative',
          bin: { maxbins: config.binCount ?? 30 },
          title: config.xLabel,
        },
        y: { aggregate: 'count', title: config.yLabel ?? 'Count' },
      }
      break
    }

    case 'bar': {
      const xField = config.xColumn ?? data.columns[0] ?? 'x'
      const yField = config.yColumns?.[0] ?? data.columns[1] ?? data.columns[0] ?? 'y'
      base.mark = 'bar'
      base.encoding = {
        x: { field: xField, type: 'nominal', title: config.xLabel },
        y: { field: yField, type: 'quantitative', scale: yScale, title: config.yLabel },
      }
      break
    }

    case 'heatmap': {
      const xField = config.xColumn ?? data.columns[0] ?? 'x'
      const yField = config.yColumns?.[0] ?? data.columns[1] ?? 'y'
      const colorField = config.yColumns?.[1] ?? data.columns[2] ?? data.columns[1] ?? 'value'
      base.mark = 'rect'
      base.encoding = {
        x: { field: xField, type: 'ordinal', title: config.xLabel },
        y: { field: yField, type: 'ordinal', title: config.yLabel },
        color: { field: colorField, type: 'quantitative' },
      }
      break
    }
  }

  // Grid
  if (base.encoding) {
    if (base.encoding.x) {
      base.encoding.x.axis = {
        ...(base.encoding.x.axis ?? {}),
        grid: config.showGrid ?? true,
      }
    }
    if (base.encoding.y && !base.encoding.y.aggregate) {
      base.encoding.y.axis = {
        ...(base.encoding.y.axis ?? {}),
        grid: config.showGrid ?? true,
      }
    }
  }

  // Legend
  if (!config.showLegend && base.encoding?.color) {
    base.encoding.color.legend = null
  }

  // Reference lines as layer
  if (config.referenceLines && config.referenceLines.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mainLayer: Record<string, any> = { mark: base.mark, encoding: base.encoding }
    delete base.mark
    delete base.encoding
    if (base.transform) {
      mainLayer.transform = base.transform
      delete base.transform
    }
    const ruleLayers = config.referenceLines.map((rl) => ({
      mark: { type: 'rule', color: rl.color ?? '#ef4444', strokeDash: [4, 4] },
      encoding: {
        [rl.axis]: { datum: rl.value },
      },
    }))
    base.layer = [mainLayer, ...ruleLayers]
  }

  return {
    spec: base,
    isDownsampled: data.isDownsampled,
    originalCount: data.originalCount,
  }
}
