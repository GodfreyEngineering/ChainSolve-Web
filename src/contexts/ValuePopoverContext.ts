import { createContext, useContext } from 'react'

export type ShowValuePopover = (nodeId: string, x: number, y: number) => void

export const ValuePopoverContext = createContext<ShowValuePopover>(() => {})

export function useShowValuePopover(): ShowValuePopover {
  return useContext(ValuePopoverContext)
}
