/**
 * bugReportsService.ts — Supabase bug_reports table operations.
 */

import { supabase } from './supabase'

export interface BugReportData {
  userId: string
  title: string
  description: string
  metadata: Record<string, unknown>
}

export async function submitBugReport(data: BugReportData): Promise<void> {
  const { error } = await supabase.from('bug_reports').insert({
    user_id: data.userId,
    title: data.title,
    description: data.description,
    metadata: data.metadata,
  })
  if (error) throw error
}
