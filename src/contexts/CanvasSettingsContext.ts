import { createContext, useContext } from 'react'

export interface CanvasSettings {
  edgesAnimated: boolean
}

export const CanvasSettingsContext = createContext<CanvasSettings>({
  edgesAnimated: false,
})

export function useCanvasSettings(): CanvasSettings {
  return useContext(CanvasSettingsContext)
}
