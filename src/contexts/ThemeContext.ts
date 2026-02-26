import { createContext, useContext } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'

export interface ThemeContextValue {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  /** The resolved theme actually applied (never "system") */
  resolved: 'light' | 'dark'
}

export const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  setMode: () => {},
  resolved: 'dark',
})

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
