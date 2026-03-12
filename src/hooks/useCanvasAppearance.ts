/**
 * useCanvasAppearance — THEME-02: Apply canvas appearance CSS variables from user preferences.
 *
 * Call once at the app root. Watches preferences and updates
 * CSS custom properties on document.documentElement whenever they change.
 *
 * Controlled variables:
 *   --canvas-node-border-radius  node corner radius
 *   --canvas-node-shadow         node box-shadow
 *   --canvas-edge-width          edge stroke width
 *   --canvas-anim-duration       animation transition speed
 */

import { useEffect } from 'react'
import { usePreferencesStore } from '../stores/preferencesStore'

export function useCanvasAppearance() {
  const borderRadius = usePreferencesStore((s) => s.canvasNodeBorderRadius)
  const shadow = usePreferencesStore((s) => s.canvasNodeShadow)
  const edgeWidth = usePreferencesStore((s) => s.canvasEdgeWidth)
  const animSpeed = usePreferencesStore((s) => s.canvasAnimationSpeed)

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--canvas-node-border-radius', `${borderRadius}px`)
  }, [borderRadius])

  useEffect(() => {
    const root = document.documentElement
    const shadowVal =
      shadow === 'none'
        ? 'none'
        : shadow === 'subtle'
          ? '0 2px 8px rgba(0,0,0,0.18)'
          : '0 4px 20px rgba(0,0,0,0.38)'
    root.style.setProperty('--canvas-node-shadow', shadowVal)
  }, [shadow])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--canvas-edge-width', `${edgeWidth}`)
  }, [edgeWidth])

  useEffect(() => {
    const root = document.documentElement
    const dur =
      animSpeed === 'none'
        ? '0ms'
        : animSpeed === 'slow'
          ? '1200ms'
          : animSpeed === 'medium'
            ? '600ms'
            : '250ms'
    root.style.setProperty('--canvas-anim-duration', dur)
  }, [animSpeed])
}
