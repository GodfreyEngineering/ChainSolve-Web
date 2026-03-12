/**
 * useKeybinding — KB-01: Read the current key combo for an action.
 *
 * Returns the user-customized combo if set, otherwise the default.
 * useMatchesBinding returns a stable function that checks if an event matches.
 */

import { useCallback } from 'react'
import {
  DEFAULT_KEYBINDINGS,
  matchesBinding,
  type KeybindingAction,
  type KeyCombo,
} from '../lib/keybindings'
import { usePreferencesStore } from '../stores/preferencesStore'

/** Returns the current combo string for an action (user override or default). */
export function useKeybinding(action: KeybindingAction): KeyCombo {
  const keybindings = usePreferencesStore((s) => s.keybindings)
  return keybindings[action] ?? DEFAULT_KEYBINDINGS[action]
}

/** Returns a function that checks whether a KeyboardEvent matches the action. */
export function useMatchesBinding(
  action: KeybindingAction,
): (e: KeyboardEvent | React.KeyboardEvent) => boolean {
  const combo = useKeybinding(action)
  return useCallback((e: KeyboardEvent | React.KeyboardEvent) => matchesBinding(e, combo), [combo])
}

/**
 * Read the effective keybindings map (all actions, user overrides applied).
 * Useful for the settings UI that needs to show all bindings at once.
 */
export function useAllKeybindings(): Record<KeybindingAction, KeyCombo> {
  const overrides = usePreferencesStore((s) => s.keybindings)
  return { ...DEFAULT_KEYBINDINGS, ...overrides } as Record<KeybindingAction, KeyCombo>
}
