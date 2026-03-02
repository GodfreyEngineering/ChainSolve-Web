/**
 * suggestionsService.ts — Supabase suggestions table operations (H9-2).
 *
 * Stores feature requests, block library additions, and UX feedback.
 * All user-provided text is redacted before storage per E9-2 policy.
 */

import { supabase } from './supabase'
import { redactString, redactObject } from '../observability/redact'

export type SuggestionCategory = 'feature_request' | 'block_library' | 'ux_feedback'

export interface SuggestionData {
  userId: string
  category: SuggestionCategory
  title: string
  description: string
  metadata: Record<string, unknown>
}

/** Submit a suggestion (redacted before storage). */
export async function submitSuggestion(data: SuggestionData): Promise<void> {
  const { error } = await supabase.from('suggestions').insert({
    user_id: data.userId,
    category: data.category,
    title: redactString(data.title),
    description: redactString(data.description),
    metadata: redactObject(data.metadata) as Record<string, unknown>,
  })
  if (error) throw error
}
