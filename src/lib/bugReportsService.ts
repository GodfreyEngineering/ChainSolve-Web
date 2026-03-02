/**
 * bugReportsService.ts — Supabase bug_reports table operations.
 */

import { supabase } from './supabase'
import { redactString, redactObject } from '../observability/redact'

export interface BugReportData {
  userId: string
  title: string
  description: string
  metadata: Record<string, unknown>
  /** H9-2: optional storage path to an uploaded screenshot. */
  screenshotPath?: string | null
}

/** E9-2: Redact title, description, and metadata before storage. */
export async function submitBugReport(data: BugReportData): Promise<void> {
  const row: Record<string, unknown> = {
    user_id: data.userId,
    title: redactString(data.title),
    description: redactString(data.description),
    metadata: redactObject(data.metadata) as Record<string, unknown>,
  }
  if (data.screenshotPath) {
    row.screenshot_path = data.screenshotPath
  }
  const { error } = await supabase.from('bug_reports').insert(row)
  if (error) throw error
}

/** H9-2: Upload a screenshot to the uploads bucket for a bug report. */
export async function uploadBugScreenshot(userId: string, file: File): Promise<string> {
  const ts = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${userId}/bug-reports/${ts}_${safeName}`
  const { error } = await supabase.storage
    .from('uploads')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return path
}
