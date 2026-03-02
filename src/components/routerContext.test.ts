/**
 * routerContext.test.ts — Structural test for Router context availability (G0-2).
 *
 * Verifies that BrowserRouter is hoisted above WindowManagerProvider in main.tsx
 * so that all window-rendered components (SettingsModal, WindowDock, etc.)
 * have access to React Router hooks.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const MAIN_SRC = fs.readFileSync(path.resolve(__dirname, '../main.tsx'), 'utf-8')
const APP_SRC = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf-8')

describe('Router context architecture (G0-2)', () => {
  it('BrowserRouter is in main.tsx, not App.tsx', () => {
    expect(MAIN_SRC).toContain('BrowserRouter')
    // App.tsx should use Routes but NOT wrap in BrowserRouter
    expect(APP_SRC).not.toContain('BrowserRouter')
    expect(APP_SRC).toContain('<Routes>')
  })

  it('BrowserRouter wraps WindowManagerProvider', () => {
    const browserRouterIdx = MAIN_SRC.indexOf('<BrowserRouter>')
    const windowManagerIdx = MAIN_SRC.indexOf('<WindowManagerProvider>')
    const closingRouterIdx = MAIN_SRC.indexOf('</BrowserRouter>')
    const closingWindowIdx = MAIN_SRC.indexOf('</WindowManagerProvider>')

    expect(browserRouterIdx).toBeGreaterThan(-1)
    expect(windowManagerIdx).toBeGreaterThan(-1)
    // BrowserRouter must open before WindowManagerProvider
    expect(browserRouterIdx).toBeLessThan(windowManagerIdx)
    // WindowManagerProvider must close before BrowserRouter
    expect(closingWindowIdx).toBeLessThan(closingRouterIdx)
  })

  it('SettingsModalProvider is inside BrowserRouter', () => {
    const browserRouterIdx = MAIN_SRC.indexOf('<BrowserRouter>')
    const settingsIdx = MAIN_SRC.indexOf('<SettingsModalProvider>')
    const closingRouterIdx = MAIN_SRC.indexOf('</BrowserRouter>')

    expect(settingsIdx).toBeGreaterThan(browserRouterIdx)
    expect(settingsIdx).toBeLessThan(closingRouterIdx)
  })

  it('WindowDock is inside BrowserRouter', () => {
    const browserRouterIdx = MAIN_SRC.indexOf('<BrowserRouter>')
    const dockIdx = MAIN_SRC.indexOf('<WindowDock')
    const closingRouterIdx = MAIN_SRC.indexOf('</BrowserRouter>')

    expect(dockIdx).toBeGreaterThan(browserRouterIdx)
    expect(dockIdx).toBeLessThan(closingRouterIdx)
  })
})
