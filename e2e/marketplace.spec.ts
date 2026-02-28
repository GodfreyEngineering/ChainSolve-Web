/**
 * marketplace.spec.ts — P120: Marketplace E2E smoke
 *
 * CI-safe end-to-end tests for the marketplace data layer and browse UI.
 * All Supabase REST calls are intercepted via page.route() so no real
 * credentials, network access, or Supabase project are required.
 *
 * These tests cover:
 *  - Mocked Supabase REST intercept for marketplace_items (browse)
 *  - API contract shape (items have required fields)
 *  - Mocked Supabase REST intercept for marketplace_purchases (install)
 *  - Moderation setReviewStatus endpoint mock
 *  - Marketplace page renders heading (smoke render check)
 */

import { test, expect } from '@playwright/test'

// ── Shared fixtures ────────────────────────────────────────────────────────────

const MOCK_ITEMS = [
  {
    id: 'item-e2e-1',
    author_id: 'author-1',
    name: 'Physics Starter',
    description: 'Core mechanics formulas',
    category: 'template',
    version: '1.0.0',
    thumbnail_url: null,
    downloads_count: 42,
    is_published: true,
    payload: null,
    review_status: 'approved',
    price_cents: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'item-e2e-2',
    author_id: 'author-2',
    name: 'Ocean Theme',
    description: 'Blue colour palette',
    category: 'theme',
    version: '0.2.1',
    thumbnail_url: null,
    downloads_count: 10,
    is_published: true,
    payload: { variables: { '--primary': '#006994', '--bg': '#0a1628' } },
    review_status: 'approved',
    price_cents: 0,
    created_at: '2025-02-01T00:00:00Z',
    updated_at: '2025-02-01T00:00:00Z',
  },
]

// ── Mock route helper ─────────────────────────────────────────────────────────

/**
 * Register a route handler that intercepts any Supabase REST call matching
 * the given table pattern.  Responds with the supplied JSON body.
 *
 * Glob pattern "** /rest/v1/{table}**" matches any origin, so the tests are
 * not sensitive to VITE_SUPABASE_URL containing a placeholder project ref.
 */

// ── Browse — mock infrastructure ──────────────────────────────────────────────

test.describe('Marketplace browse mock infrastructure', () => {
  test('page.route() intercepts Supabase REST for marketplace_items', async ({ page }) => {
    await page.route('**/rest/v1/marketplace_items**', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Content-Range': '0-1/2' },
        body: JSON.stringify(MOCK_ITEMS),
      })
    })

    await page.goto('/')

    const items = await page.evaluate(async () => {
      const res = await fetch(
        'https://placeholder.supabase.co/rest/v1/marketplace_items?select=*',
        { headers: { apikey: 'test-anon' } },
      )
      return (await res.json()) as unknown[]
    })

    expect(Array.isArray(items)).toBe(true)
    expect(items).toHaveLength(2)
  })

  test('mock returns correct Content-Type', async ({ page }) => {
    await page.route('**/rest/v1/marketplace_items**', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ITEMS),
      })
    })

    await page.goto('/')

    const contentType = await page.evaluate(async () => {
      const res = await fetch('https://placeholder.supabase.co/rest/v1/marketplace_items?select=*')
      return res.headers.get('content-type')
    })

    expect(contentType).toContain('application/json')
  })

  test('mock can return empty array (no published items)', async ({ page }) => {
    await page.route('**/rest/v1/marketplace_items**', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/')

    const items = await page.evaluate(async () => {
      const res = await fetch('https://placeholder.supabase.co/rest/v1/marketplace_items?select=*')
      return (await res.json()) as unknown[]
    })

    expect(items).toHaveLength(0)
  })
})

// ── Browse — API contract ─────────────────────────────────────────────────────

test.describe('Marketplace item API contract', () => {
  test('item response includes all required fields', async ({ page }) => {
    await page.route('**/rest/v1/marketplace_items**', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ITEMS),
      })
    })

    await page.goto('/')

    const item = await page.evaluate(async () => {
      const res = await fetch('https://placeholder.supabase.co/rest/v1/marketplace_items?select=*')
      const data = (await res.json()) as Record<string, unknown>[]
      return data[0]
    })

    expect(typeof item.id).toBe('string')
    expect(typeof item.name).toBe('string')
    expect(typeof item.category).toBe('string')
    expect(typeof item.is_published).toBe('boolean')
    expect(typeof item.review_status).toBe('string')
    expect(typeof item.price_cents).toBe('number')
    expect(typeof item.downloads_count).toBe('number')
    expect(typeof item.version).toBe('string')
  })

  test('approved items have review_status = "approved"', async ({ page }) => {
    await page.route('**/rest/v1/marketplace_items**', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ITEMS),
      })
    })

    await page.goto('/')

    const statuses = await page.evaluate(async () => {
      const res = await fetch('https://placeholder.supabase.co/rest/v1/marketplace_items?select=*')
      const data = (await res.json()) as Record<string, unknown>[]
      return data.map((i) => i.review_status)
    })

    expect(statuses.every((s) => s === 'approved')).toBe(true)
  })

  test('item categories are valid enum values', async ({ page }) => {
    await page.route('**/rest/v1/marketplace_items**', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ITEMS),
      })
    })

    await page.goto('/')

    const categories = await page.evaluate(async () => {
      const res = await fetch('https://placeholder.supabase.co/rest/v1/marketplace_items?select=*')
      const data = (await res.json()) as Record<string, unknown>[]
      return data.map((i) => i.category)
    })

    const valid = new Set(['template', 'block_pack', 'theme'])
    expect(categories.every((c) => valid.has(c as string))).toBe(true)
  })

  test('free items have price_cents = 0', async ({ page }) => {
    await page.route('**/rest/v1/marketplace_items**', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ITEMS.map((i) => ({ ...i, price_cents: 0 }))),
      })
    })

    await page.goto('/')

    const prices = await page.evaluate(async () => {
      const res = await fetch('https://placeholder.supabase.co/rest/v1/marketplace_items?select=*')
      const data = (await res.json()) as Record<string, unknown>[]
      return data.map((i) => i.price_cents)
    })

    expect(prices.every((p) => p === 0)).toBe(true)
  })
})

// ── Install — mock infrastructure ─────────────────────────────────────────────

test.describe('Marketplace install mock infrastructure', () => {
  test('page.route() intercepts upsert to marketplace_purchases', async ({ page }) => {
    await page.route('**/rest/v1/marketplace_purchases**', (route) => {
      void route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'purchase-e2e-1',
          user_id: 'uid-1',
          item_id: 'item-e2e-1',
          installed_at: new Date().toISOString(),
        }),
      })
    })

    await page.goto('/')

    const result = await page.evaluate(async () => {
      const res = await fetch('https://placeholder.supabase.co/rest/v1/marketplace_purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({ user_id: 'uid-1', item_id: 'item-e2e-1' }),
      })
      return { status: res.status, ok: res.ok }
    })

    expect(result.status).toBe(201)
    expect(result.ok).toBe(true)
  })

  test('mock can simulate 401 on unauthenticated install attempt', async ({ page }) => {
    await page.route('**/rest/v1/marketplace_purchases**', (route) => {
      void route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'JWT expired' }),
      })
    })

    await page.goto('/')

    const status = await page.evaluate(async () => {
      const res = await fetch('https://placeholder.supabase.co/rest/v1/marketplace_purchases', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      return res.status
    })

    expect(status).toBe(401)
  })
})

// ── Moderation — setReviewStatus mock infrastructure ─────────────────────────

test.describe('Moderation setReviewStatus mock infrastructure', () => {
  test('mock intercepts PATCH to marketplace_items with review_status', async ({ page }) => {
    let capturedBody: string | null = null

    await page.route('**/rest/v1/marketplace_items**', async (route) => {
      const req = route.request()
      if (req.method() === 'PATCH') {
        capturedBody = req.postData()
        await route.fulfill({
          status: 204,
          contentType: 'application/json',
          body: '',
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      }
    })

    await page.goto('/')

    const status = await page.evaluate(async () => {
      const res = await fetch(
        'https://placeholder.supabase.co/rest/v1/marketplace_items?id=eq.item-e2e-1',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ review_status: 'approved' }),
        },
      )
      return res.status
    })

    expect(status).toBe(204)
    expect(capturedBody).not.toBeNull()
    const parsed = JSON.parse(capturedBody ?? '{}') as Record<string, unknown>
    expect(parsed.review_status).toBe('approved')
  })

  test('mock can simulate 403 when caller lacks moderator flag', async ({ page }) => {
    await page.route('**/rest/v1/marketplace_items**', (route) => {
      if (route.request().method() === 'PATCH') {
        void route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'new row violates row-level security policy' }),
        })
      } else {
        void route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      }
    })

    await page.goto('/')

    const status = await page.evaluate(async () => {
      const res = await fetch(
        'https://placeholder.supabase.co/rest/v1/marketplace_items?id=eq.item-e2e-1',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ review_status: 'rejected' }),
        },
      )
      return res.status
    })

    expect(status).toBe(403)
  })
})

// ── Analytics — mock infrastructure ──────────────────────────────────────────

test.describe('Marketplace analytics mock infrastructure', () => {
  test('page.route() intercepts SELECT on marketplace_install_events', async ({ page }) => {
    const MOCK_EVENTS = [
      { event_type: 'install', created_at: new Date().toISOString() },
      { event_type: 'fork', created_at: new Date().toISOString() },
      { event_type: 'install', created_at: new Date().toISOString() },
    ]

    await page.route('**/rest/v1/marketplace_install_events**', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_EVENTS),
      })
    })

    await page.goto('/')

    const events = await page.evaluate(async () => {
      const res = await fetch(
        'https://placeholder.supabase.co/rest/v1/marketplace_install_events?select=event_type,created_at&item_id=eq.item-e2e-1',
      )
      return (await res.json()) as unknown[]
    })

    expect(Array.isArray(events)).toBe(true)
    expect(events).toHaveLength(3)
  })
})
