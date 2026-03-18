/**
 * timeseries-blocks.ts — 2.11: TimeSeriesInput block.
 *
 * A specialised input block for time-stamped data. Accepts CSV files where
 * one column contains timestamps (ISO 8601, Unix seconds, or plain seconds)
 * and the remaining columns are numeric signals. Resamples to a uniform
 * time grid and outputs the result as a DataTable.
 *
 * Resampling methods:
 *   - linear   — linear interpolation between adjacent samples
 *   - zoh      — zero-order hold (previous sample value)
 *   - cubic    — monotone cubic spline (Fritsch-Carlson)
 *
 * Bridge: blockType='timeSeries' → 'tableInput' (cached tableData).
 */

import type { BlockDef } from './registry'

export function registerTimeSeriesBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'timeSeries',
    label: 'Time Series Input',
    category: 'data',
    nodeKind: 'csTimeSeries',
    inputs: [],
    proOnly: false,
    defaultData: {
      blockType: 'timeSeries',
      label: 'Time Series Input',
      /** Parsed and resampled data ready for the engine. */
      tableData: { columns: [] as string[], rows: [] as number[][] },
      /** Original file name. */
      fileName: '',
      /** Column name (or index) used as the time axis. */
      timeColumn: 'time',
      /** Resampling method: linear | zoh | cubic. */
      resampleMethod: 'linear',
      /** Uniform sample interval in seconds. 0 = keep original spacing. */
      sampleInterval: 0,
      /** Start time override (seconds). Empty = use data minimum. */
      startTime: '',
      /** End time override (seconds). Empty = use data maximum. */
      endTime: '',
      /** Whether the first row of the CSV is a header. */
      hasHeader: true,
      /** Parse error message. */
      parseError: '',
    },
    synonyms: [
      'time series', 'timeseries', 'signal', 'waveform', 'resample', 'interpolate',
      'timestamp', 'sensor', 'log', 'telemetry',
    ],
    tags: ['data', 'time', 'signal', 'resample'],
    description:
      'Time-stamped data input. Parses CSV with a time column and resamples to a uniform grid using linear, ZOH, or cubic interpolation.',
  })
}
