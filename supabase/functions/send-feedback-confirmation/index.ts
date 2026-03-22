/**
 * send-feedback-confirmation — Supabase Edge Function.
 *
 * Sends a confirmation email to the user after they submit feedback
 * via the in-app FeedbackWidget. Uses the Resend API directly.
 *
 * Request body (POST, application/json):
 *   { user_email: string, ticket_id: string, feedback_type: string, title: string }
 *
 * Environment variables:
 *   RESEND_API_KEY — API key from resend.com
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const RESEND_API_URL = 'https://api.resend.com/emails'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const typeLabels: Record<string, string> = {
  bug: 'Bug Report',
  improvement: 'Suggestion',
  question: 'Question',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('[send-feedback-confirmation] RESEND_API_KEY not configured')
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { user_email, ticket_id, feedback_type, title } = await req.json()

    if (!user_email || !ticket_id || !feedback_type || !title) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const refId = ticket_id.substring(0, 8).toUpperCase()
    const typeLabel = typeLabels[feedback_type] ?? feedback_type

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f4f4f3;color:#1a1a1a;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
    <div style="background:#1CABB0;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">ChainSolve</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hi there,</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
        Thank you for your feedback. We've received your <strong>${typeLabel}</strong> and assigned it reference number:
      </p>
      <div style="background:#f0fafb;border:1px solid #d0ecee;border-radius:8px;padding:16px 20px;margin:0 0 16px;text-align:center;">
        <span style="font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:700;color:#1CABB0;">CS-${refId}</span>
      </div>
      <p style="margin:0 0 8px;font-size:14px;color:#666;"><strong>Type:</strong> ${typeLabel}</p>
      <p style="margin:0 0 16px;font-size:14px;color:#666;"><strong>Subject:</strong> ${escapeHtml(title)}</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
        Our team reviews reports regularly. Critical bugs are actioned same-day. You'll receive updates if we need more information.
      </p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">
        ChainSolve — <a href="https://app.chainsolve.co.uk" style="color:#1CABB0;">app.chainsolve.co.uk</a> | <a href="mailto:support@chainsolve.co.uk" style="color:#1CABB0;">support@chainsolve.co.uk</a>
      </p>
    </div>
  </div>
</body>
</html>`.trim()

    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'ChainSolve <noreply@chainsolve.co.uk>',
        to: [user_email],
        subject: `Your ChainSolve ${typeLabel} has been received — Ref #${refId}`,
        html: htmlBody,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('[send-feedback-confirmation] Resend error:', res.status, errBody)
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[send-feedback-confirmation] Unhandled error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
