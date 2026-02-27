import { createContext, useContext } from 'react'

export interface CanvasSettings {
  edgesAnimated: boolean
  badgesEnabled: boolean
  edgeBadgesEnabled: boolean
}

export const CanvasSettingsContext = createContext<CanvasSettings>({
  edgesAnimated: false,
  badgesEnabled: false,
  edgeBadgesEnabled: false,
})

export function useCanvasSettings(): CanvasSettings {
  return useContext(CanvasSettingsContext)
}
