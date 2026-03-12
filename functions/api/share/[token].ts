/**
 * GET /api/share/:token — Serve project data for a share link.
 *
 * Steps:
 *   1. Look up share_links row by token.
 *   2. Validate: active, not expired.
 *   3. Increment view_count.
 *   4. Fetch project row + canvases list.
 *   5. Download all canvas graphs from storage using service role.
 *   6. Return { project, canvases, canvasData } to the client.
 *
 * Accessible without auth (public endpoint for shared projects).
 */

import { createClient } from '@supabase/supabase-js'

type Env = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

type CanvasRow = {
  id: string
  name: string
  position: number
  is_active: boolean
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const token = params['token'] as string

  if (!token) {
    return json({ ok: false, error: 'Missing token' }, 400)
  }

  const missingEnv = (['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const).filter((k) => !env[k])
  if (missingEnv.length > 0) {
    return json({ ok: false, error: `Missing env: ${missingEnv.join(', ')}` }, 500)
  }

  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  // ── Step 1: Look up share link ──────────────────────────────────────────────
  const { data: link, error: linkErr } = await admin
    .from('share_links')
    .select('id,project_id,created_by,expires_at,is_active,view_count')
    .eq('token', token)
    .single()

  if (linkErr || !link) {
    return json({ ok: false, error: 'Share link not found' }, 404)
  }

  // ── Step 2: Validate ────────────────────────────────────────────────────────
  if (!link.is_active) {
    return json({ ok: false, error: 'This share link has been revoked' }, 410)
  }
  if (link.expires_at && new Date(link.expires_at as string) < new Date()) {
    return json({ ok: false, error: 'This share link has expired' }, 410)
  }

  // ── Step 3: Increment view_count (fire-and-forget) ─────────────────────────
  void admin
    .from('share_links')
    .update({ view_count: (link.view_count as number) + 1 })
    .eq('id', link.id)

  const projectId = link.project_id as string
  const ownerId = link.created_by as string

  // ── Step 4: Fetch project row ───────────────────────────────────────────────
  const { data: project, error: projErr } = await admin
    .from('projects')
    .select('id,name,description,updated_at')
    .eq('id', projectId)
    .single()

  if (projErr || !project) {
    return json({ ok: false, error: 'Project not found' }, 404)
  }

  // ── Step 4b: Fetch canvases list ────────────────────────────────────────────
  const { data: canvasRows } = await admin
    .from('canvases')
    .select('id,name,position,is_active')
    .eq('project_id', projectId)
    .order('position', { ascending: true })

  const canvases: CanvasRow[] = (canvasRows ?? []) as CanvasRow[]

  // ── Step 5: Download canvas graphs ─────────────────────────────────────────
  const canvasData: Record<string, unknown> = {}

  for (const canvas of canvases) {
    const path = `${ownerId}/${projectId}/canvases/${canvas.id}.json`
    try {
      const { data: blob, error: dlErr } = await admin.storage.from('projects').download(path)
      if (!dlErr && blob) {
        const text = await blob.text()
        canvasData[canvas.id] = JSON.parse(text)
      }
    } catch {
      // Skip canvases that fail to load
    }
  }

  // If no multi-canvas data, try legacy project.json
  if (Object.keys(canvasData).length === 0) {
    const legacyPath = `${ownerId}/${projectId}/project.json`
    try {
      const { data: blob } = await admin.storage.from('projects').download(legacyPath)
      if (blob) {
        const text = await blob.text()
        canvasData['__legacy__'] = JSON.parse(text)
      }
    } catch {
      // No canvas data available
    }
  }

  return json(
    {
      ok: true,
      project: {
        id: project.id,
        name: project.name,
        description: (project as { description: string | null }).description,
        updatedAt: (project as { updated_at: string }).updated_at,
      },
      canvases: canvases.map((c) => ({
        id: c.id,
        name: c.name,
        position: c.position,
        isActive: c.is_active,
      })),
      canvasData,
    },
    200,
  )
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}
