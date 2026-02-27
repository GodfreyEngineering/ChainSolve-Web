/**
 * saveStatusLabel — pure helper that computes the save-status badge text/color
 * shown in AppHeader.
 *
 * Extracted as a pure function so it can be unit-tested without React or i18n
 * setup. The caller supplies `t` (the i18next translate function) and
 * `fmtTime` (a locale-aware time formatter).
 */

import type { SaveStatus } from '../stores/projectStore'

export interface SaveStatusLabel {
  /** Short badge text shown in the header bar. */
  text: string
  /** CSS color value for the badge. */
  color: string
  /** When true the badge is rendered as a clickable element. */
  clickable?: boolean
  /**
   * Rich tooltip shown on hover. Includes the last-saved timestamp and the
   * project name so users can confirm exactly what was saved and when.
   */
  tooltip?: string
}

/**
 * Derive the save-status badge from store values.
 *
 * @param saveStatus  Current save lifecycle state.
 * @param lastSavedAt Timestamp of the last successful save, or null.
 * @param isDirty     Whether there are unsaved local changes.
 * @param projectId   Current project ID; null means scratch (no badge shown).
 * @param projectName Human-readable project name (included in the tooltip).
 * @param fmtTime     Formatter that converts a Date to a short "HH:MM" string.
 * @param t           i18next translation function.
 * @returns A badge descriptor, or null if no badge should be shown.
 */
export function computeSaveStatusLabel(
  saveStatus: SaveStatus,
  lastSavedAt: Date | null,
  isDirty: boolean,
  projectId: string | undefined,
  projectName: string,
  fmtTime: (d: Date) => string,
  t: (key: string, opts?: Record<string, string>) => string,
): SaveStatusLabel | null {
  if (!projectId) return null

  switch (saveStatus) {
    case 'saving':
      return { text: t('canvas.saving'), color: 'rgba(244,244,243,0.45)' }

    case 'saved': {
      const timeStr = lastSavedAt ? ' \u00b7 ' + fmtTime(lastSavedAt) : ''
      return {
        text: `${t('canvas.saved')}${timeStr}`,
        color: '#22c55e',
        tooltip: lastSavedAt
          ? t('canvas.lastSaved', { time: fmtTime(lastSavedAt), target: projectName })
          : undefined,
      }
    }

    case 'conflict':
      return { text: `\u26a0 ${t('canvas.conflict')}`, color: '#f59e0b' }

    case 'error':
      return { text: `\u26a0 ${t('canvas.error')}`, color: '#ef4444', clickable: true }

    case 'offline-queued':
      return { text: `\u23f3 ${t('canvas.offlineQueued')}`, color: '#f59e0b', clickable: true }

    default:
      return isDirty ? { text: t('canvas.unsaved'), color: 'rgba(244,244,243,0.45)' } : null
  }
}
