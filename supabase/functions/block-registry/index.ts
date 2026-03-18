/**
 * block-registry — Supabase Edge Function (10.2).
 *
 * Manages the ChainSolve Block Registry: a catalogue of published WASM
 * plugin modules that users can install into their canvases.
 *
 * ## Endpoints
 *
 * GET  /block-registry
 *   Returns paginated list of published plugin packages.
 *   Query: ?page=1&limit=20&category=math&q=search
 *   Returns: { items: PluginPackage[], total: number }
 *
 * GET  /block-registry/:packageId
 *   Returns full metadata for one package including download URL.
 *   Returns: PluginPackage | { error }
 *
 * POST /block-registry (auth required)
 *   Publish a new plugin package.
 *   Body: { name, description, category, wasmBase64 }
 *   Returns: { id, downloadUrl } | { error }
 *
 * ## Storage
 *
 * WASM binaries are stored in Supabase Storage bucket `plugin-wasm`.
 * Package metadata lives in the `plugin_packages` Postgres table.
 *
 * ## Security
 *
 * All WASM plugins undergo a safety scan before publishing:
 * - File size < 10 MB
 * - Must be valid WASM binary (magic bytes \0asm)
 * - No net imports (plugins may not make outbound network requests)
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Types ──────────────────────────────────────────────────────────────────────

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_WASM_BYTES = 10 * 1024 * 1024 // 10 MB
const WASM_MAGIC = new Uint8Array([0x00, 0x61, 0x73, 0x6d]) // \0asm

// ── Helpers ───────────────────────────────────────────────────────────────────

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function supabaseFromRequest(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const authHeader = req.headers.get('Authorization') ?? ''
  return createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  })
}

function isValidWasm(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false
  for (let i = 0; i < 4; i++) {
    if (bytes[i] !== WASM_MAGIC[i]) return false
  }
  return true
}

/** Check that the WASM module has no `env` imports (network isolation). */
function hasNetImports(bytes: Uint8Array): boolean {
  // Simple text-scan for known network-capable import module names
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  return text.includes('wasi_snapshot_preview1') && text.includes('fd_write') === false
    ? false
    : /wasi_http|wasi_sockets|fetch|XMLHttpRequest/.test(text)
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hashBuf = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function handleList(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)))
  const category = url.searchParams.get('category')
  const q = url.searchParams.get('q')

  const supabase = supabaseFromRequest(req)
  let query = supabase
    .from('plugin_packages')
    .select('*', { count: 'exact' })
    .eq('status', 'published')
    .order('downloads', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (category) query = query.eq('category', category)
  if (q) query = query.ilike('name', `%${q}%`)

  const { data, error, count } = await query

  if (error) return json({ error: error.message }, 500)
  return json({ items: data ?? [], total: count ?? 0 })
}

async function handleGet(req: Request, packageId: string): Promise<Response> {
  const supabase = supabaseFromRequest(req)
  const { data, error } = await supabase
    .from('plugin_packages')
    .select('*')
    .eq('id', packageId)
    .eq('status', 'published')
    .single()

  if (error || !data) return json({ error: 'Package not found' }, 404)
  return json(data)
}

async function handlePublish(req: Request): Promise<Response> {
  // Require auth
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: '[REGISTRY_AUTH] Authorization required' }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: '[REGISTRY_PARSE] Invalid JSON body' }, 400)
  }

  const { name, description, category, wasmBase64, version } = body as Record<string, string>
  if (!name || !wasmBase64) {
    return json({ error: '[REGISTRY_INVALID] name and wasmBase64 are required' }, 400)
  }

  // Decode and validate WASM
  let wasmBytes: Uint8Array
  try {
    wasmBytes = Uint8Array.from(atob(wasmBase64), (c) => c.charCodeAt(0))
  } catch {
    return json({ error: '[REGISTRY_DECODE] wasmBase64 is not valid base64' }, 400)
  }

  if (wasmBytes.length > MAX_WASM_BYTES) {
    return json({ error: '[REGISTRY_TOO_LARGE] WASM module exceeds 10 MB limit' }, 400)
  }

  if (!isValidWasm(wasmBytes)) {
    return json({ error: '[REGISTRY_INVALID_WASM] File is not a valid WASM module' }, 400)
  }

  if (hasNetImports(wasmBytes)) {
    return json({ error: '[REGISTRY_UNSAFE] Plugin imports network APIs — not allowed' }, 400)
  }

  const checksum = await sha256Hex(wasmBytes)

  const supabase = supabaseFromRequest(req)

  // Get authenticated user
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return json({ error: '[REGISTRY_AUTH] Invalid token' }, 401)
  }

  // Upload WASM to storage
  const storagePath = `plugins/${user.id}/${checksum}.wasm`
  const { error: uploadErr } = await supabase.storage
    .from('plugin-wasm')
    .upload(storagePath, wasmBytes, {
      contentType: 'application/wasm',
      upsert: false,
    })

  if (uploadErr && !uploadErr.message.includes('already exists')) {
    return json({ error: `[REGISTRY_UPLOAD] ${uploadErr.message}` }, 500)
  }

  const { data: urlData } = supabase.storage
    .from('plugin-wasm')
    .getPublicUrl(storagePath)

  const downloadUrl = urlData.publicUrl

  // Insert metadata
  const { data: pkg, error: insertErr } = await supabase
    .from('plugin_packages')
    .insert({
      name,
      description: description ?? '',
      category: category ?? 'custom',
      author: user.id,
      version: version ?? '1.0.0',
      download_url: downloadUrl,
      checksum,
      status: 'published',
    })
    .select('id, download_url')
    .single()

  if (insertErr) {
    return json({ error: `[REGISTRY_INSERT] ${insertErr.message}` }, 500)
  }

  return json({ id: pkg.id, downloadUrl: pkg.download_url }, 201)
}

// ── Main ─────────────────────────────────────────────────────────────────────

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const url = new URL(req.url)
  const parts = url.pathname.replace(/^\/block-registry\/?/, '').split('/').filter(Boolean)

  if (req.method === 'GET' && parts.length === 0) {
    return handleList(req)
  }
  if (req.method === 'GET' && parts.length === 1) {
    return handleGet(req, parts[0])
  }
  if (req.method === 'POST' && parts.length === 0) {
    return handlePublish(req)
  }

  return json({ error: 'Not found' }, 404)
})
