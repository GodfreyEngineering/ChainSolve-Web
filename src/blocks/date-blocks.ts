/**
 * date-blocks.ts — Date and Time calculation block pack (BLK-09).
 *
 * 8 blocks: date encoding, decomposition, arithmetic, calendar helpers.
 * Dates are represented as integers: days since 2000-01-01.
 * Evaluation handled by Rust/WASM engine ops (date.* namespace).
 */

import type { BlockDef } from './types'

export function registerDateBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'date.from_ymd',
    label: 'Date from Y/M/D',
    category: 'dateTime',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'y', label: 'Year' },
      { id: 'm', label: 'Month' },
      { id: 'd', label: 'Day' },
    ],
    defaultData: { blockType: 'date.from_ymd', label: 'Date from Y/M/D' },
    synonyms: ['date', 'year month day', 'date encode'],
    tags: ['date', 'time'],
  })

  register({
    type: 'date.year',
    label: 'Year of date',
    category: 'dateTime',
    nodeKind: 'csOperation',
    inputs: [{ id: 'day', label: 'date (days)' }],
    defaultData: { blockType: 'date.year', label: 'Year' },
    synonyms: ['year', 'date component'],
  })

  register({
    type: 'date.month',
    label: 'Month of date',
    category: 'dateTime',
    nodeKind: 'csOperation',
    inputs: [{ id: 'day', label: 'date (days)' }],
    defaultData: { blockType: 'date.month', label: 'Month' },
    synonyms: ['month', 'date component'],
  })

  register({
    type: 'date.day_of_month',
    label: 'Day of month',
    category: 'dateTime',
    nodeKind: 'csOperation',
    inputs: [{ id: 'day', label: 'date (days)' }],
    defaultData: { blockType: 'date.day_of_month', label: 'Day of Month' },
    synonyms: ['day', 'date component'],
  })

  register({
    type: 'date.days_between',
    label: 'Days Between',
    category: 'dateTime',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'd1', label: 'Date 1' },
      { id: 'd2', label: 'Date 2' },
    ],
    defaultData: { blockType: 'date.days_between', label: 'Days Between' },
    synonyms: ['days between', 'date difference', 'duration'],
  })

  register({
    type: 'date.add_days',
    label: 'Add Days',
    category: 'dateTime',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'd', label: 'Date' },
      { id: 'n', label: 'n (days)' },
    ],
    defaultData: { blockType: 'date.add_days', label: 'Add Days' },
    synonyms: ['add days', 'date arithmetic', 'date offset'],
  })

  register({
    type: 'date.is_leap_year',
    label: 'Is Leap Year',
    category: 'dateTime',
    nodeKind: 'csOperation',
    inputs: [{ id: 'y', label: 'Year' }],
    defaultData: { blockType: 'date.is_leap_year', label: 'Is Leap Year' },
    synonyms: ['leap year', 'calendar'],
  })

  register({
    type: 'date.days_in_month',
    label: 'Days in Month',
    category: 'dateTime',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'm', label: 'Month' },
      { id: 'y', label: 'Year' },
    ],
    defaultData: { blockType: 'date.days_in_month', label: 'Days in Month' },
    synonyms: ['days in month', 'calendar', 'month length'],
  })
}
