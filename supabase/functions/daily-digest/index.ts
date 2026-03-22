/**
 * daily-digest — Supabase Edge Function.
 *
 * Queries feedback from the last 24 hours, formats a summary email,
 * and sends it to the ChainSolve ops inbox via Resend.
 *
 * Triggered by pg_cron at 18:00 UTC daily (see migration 0025).
 *
 * Environment variables:
 *   RESEND_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_URL = 'https://api.resend.com/emails'
const OPS_EMAIL = 'ben.godfrey@godfreyengineering.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FeedbackRow {
  id: string
  type: string
  category: string | null
  title: string
  description: string
  priority: string
  created_at: string
  user_id: string | null
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!resendApiKey || !supabaseUrl || !serviceRoleKey) {
      console.error('[daily-digest] Missing required environment variables')
      return new Response(JSON.stringify({ error: 'Configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Query feedback from the last 24 hours using service role to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: feedback, error: dbError } = await supabase
      .from('feedback')
      .select('*')
      .gte('created_at', since)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })

    if (dbError) {
      console.error('[daily-digest] Database error:', dbError.message)
      return new Response(JSON.stringify({ error: 'Database query failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const items = (feedback ?? []) as FeedbackRow[]

    // Group by type
    const bugs = items.filter((i) => i.type === 'bug')
    const suggestions = items.filter((i) => i.type === 'improvement')
    const questions = items.filter((i) => i.type === 'question')

    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })

    const subject = `ChainSolve Daily — ${today} — ${bugs.length} bugs, ${suggestions.length} suggestions, ${questions.length} questions`

    const htmlBody = buildDigestHtml(today, bugs, suggestions, questions)

    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'ChainSolve Ops <alerts@alerts.godfreyengineering.com>',
        to: [OPS_EMAIL],
        subject,
        html: htmlBody,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('[daily-digest] Resend error:', res.status, errBody)
      return new Response(JSON.stringify({ error: 'Failed to send digest email' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: { bugs: bugs.length, suggestions: suggestions.length, questions: questions.length },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[daily-digest] Unhandled error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ── HTML builder ─────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.substring(0, max) + '...' : str
}

function priorityColor(p: string): string {
  switch (p) {
    case 'critical':
      return '#dc2626'
    case 'high':
      return '#ea580c'
    case 'medium':
      return '#ca8a04'
    case 'low':
      return '#65a30d'
    default:
      return '#888'
  }
}

function priorityBg(p: string): string {
  return p === 'critical' ? '#fef2f2' : '#ffffff'
}

function statBox(label: string, count: number, color: string): string {
  return `
    <div style="flex:1;text-align:center;padding:16px 12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e5e5;">
      <div style="font-size:28px;font-weight:700;color:${color};">${count}</div>
      <div style="font-size:12px;color:#666;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
    </div>
  `
}

function itemRow(item: FeedbackRow, maxDesc: number): string {
  const time = new Date(item.created_at).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const cat = item.category ? `<span style="font-size:11px;color:#888;background:#f3f3f3;padding:2px 6px;border-radius:4px;">${escapeHtml(item.category)}</span>` : ''
  const pColor = priorityColor(item.priority)
  const bgColor = priorityBg(item.priority)

  return `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;background:${bgColor};vertical-align:top;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${pColor};flex-shrink:0;"></span>
          <strong style="font-size:14px;">${escapeHtml(item.title)}</strong>
          ${cat}
        </div>
        <div style="font-size:13px;color:#555;line-height:1.5;margin-left:16px;">
          ${escapeHtml(truncate(item.description, maxDesc))}
        </div>
        <div style="font-size:11px;color:#999;margin-top:6px;margin-left:16px;">
          ${time} · ${item.priority}${item.user_id ? ` · ${item.user_id.substring(0, 8)}` : ''}
        </div>
      </td>
    </tr>
  `
}

function buildDigestHtml(
  dateStr: string,
  bugs: FeedbackRow[],
  suggestions: FeedbackRow[],
  questions: FeedbackRow[],
): string {
  const totalItems = bugs.length + suggestions.length + questions.length
  const allQuiet = totalItems === 0

  let sectionsHtml = ''

  if (allQuiet) {
    sectionsHtml = `
      <div style="text-align:center;padding:32px 0;color:#888;">
        <div style="font-size:24px;margin-bottom:8px;">&#x2714;</div>
        <p style="margin:0;font-size:15px;">All quiet today. No new feedback received.</p>
      </div>
    `
  } else {
    if (bugs.length > 0) {
      const priorityOrder = ['critical', 'high', 'medium', 'low']
      const sorted = [...bugs].sort(
        (a, b) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority),
      )
      sectionsHtml += `
        <h2 style="font-size:16px;margin:24px 0 12px;color:#dc2626;">Bugs (${bugs.length})</h2>
        <table style="width:100%;border-collapse:collapse;">
          ${sorted.map((b) => itemRow(b, 200)).join('')}
        </table>
      `
    }

    if (suggestions.length > 0) {
      sectionsHtml += `
        <h2 style="font-size:16px;margin:24px 0 12px;color:#1CABB0;">Suggestions (${suggestions.length})</h2>
        <table style="width:100%;border-collapse:collapse;">
          ${suggestions.map((s) => itemRow(s, 150)).join('')}
        </table>
      `
    }

    if (questions.length > 0) {
      sectionsHtml += `
        <h2 style="font-size:16px;margin:24px 0 12px;color:#6366f1;">Questions (${questions.length})</h2>
        <table style="width:100%;border-collapse:collapse;">
          ${questions.map((q) => itemRow(q, 150)).join('')}
        </table>
      `
    }
  }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f4f4f3;color:#1a1a1a;">
  <div style="max-width:620px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
    <div style="background:#1a1a1a;padding:20px 32px;display:flex;justify-content:space-between;align-items:center;">
      <h1 style="margin:0;color:#1CABB0;font-size:18px;font-weight:700;">ChainSolve Daily</h1>
      <span style="color:#888;font-size:13px;">${dateStr}</span>
    </div>
    <div style="padding:24px 32px;">
      <div style="display:flex;gap:12px;margin-bottom:24px;">
        ${statBox('Bugs', bugs.length, '#dc2626')}
        ${statBox('Suggestions', suggestions.length, '#1CABB0')}
        ${statBox('Questions', questions.length, '#6366f1')}
      </div>
      ${sectionsHtml}
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:28px 0 16px;" />
      <p style="margin:0;font-size:12px;color:#999;text-align:center;line-height:1.5;">
        <a href="https://admin.godfreyengineering.com" style="color:#1CABB0;">Open Admin Dashboard</a>
        &nbsp;·&nbsp;
        <a href="https://app.chainsolve.co.uk" style="color:#1CABB0;">ChainSolve</a>
      </p>
    </div>
  </div>
</body>
</html>`.trim()
}
