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
}

/** E9-2: Redact title, description, and metadata before storage. */
export async function submitBugReport(data: BugReportData): Promise<void> {
  const { error } = await supabase.from('bug_reports').insert({
    user_id: data.userId,
    title: redactString(data.title),
    description: redactString(data.description),
    metadata: redactObject(data.metadata) as Record<string, unknown>,
  })
  if (error) throw error
}
