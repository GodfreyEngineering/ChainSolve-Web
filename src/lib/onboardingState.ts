/**
 * Onboarding checklist state — persisted in localStorage.
 *
 * Tracks which guided steps the user has completed. The checklist
 * is shown on first login and remains accessible from the Help menu
 * until all steps are done.
 */

const STORAGE_KEY = 'cs:onboarding-checklist'

/** Ordered step identifiers matching the guided walkthrough. */
export const ONBOARDING_STEPS = [
  'open_projects',
  'create_project',
  'add_input',
  'add_function',
  'add_output',
  'connect_chains',
  'use_inspector',
  'save_project',
  'open_reporting',
] as const

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]

export interface OnboardingState {
  /** Which steps are completed (step id -> true). */
  completed: Partial<Record<OnboardingStepId, boolean>>
  /** Whether the user explicitly dismissed the overlay. */
  dismissed: boolean
}

const DEFAULT_STATE: OnboardingState = {
  completed: {},
  dismissed: false,
}

/** Read persisted state from localStorage. */
export function getOnboardingState(): OnboardingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE, completed: {} }
    const parsed = JSON.parse(raw) as Partial<OnboardingState>
    return {
      completed: parsed.completed && typeof parsed.completed === 'object' ? parsed.completed : {},
      dismissed: typeof parsed.dismissed === 'boolean' ? parsed.dismissed : false,
    }
  } catch {
    return { ...DEFAULT_STATE, completed: {} }
  }
}

/** Persist state to localStorage. */
function saveState(state: OnboardingState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Private browsing — ignore
  }
}

/** Mark a single step as completed. */
export function completeStep(stepId: OnboardingStepId): OnboardingState {
  const state = getOnboardingState()
  state.completed[stepId] = true
  saveState(state)
  return state
}

/** Dismiss the overlay (user chose to close it). */
export function dismissOnboarding(): OnboardingState {
  const state = getOnboardingState()
  state.dismissed = true
  saveState(state)
  return state
}

/** Reset onboarding so the checklist shows again (for Help menu restart). */
export function resetOnboarding(): OnboardingState {
  const state = getOnboardingState()
  state.dismissed = false
  saveState(state)
  return state
}

/** Clear all onboarding data (used by admin reset). */
export function clearOnboarding(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore
  }
}

/** Count how many steps are completed. */
export function completedCount(state: OnboardingState): number {
  return ONBOARDING_STEPS.filter((id) => state.completed[id]).length
}

/** Whether all steps are completed. */
export function allCompleted(state: OnboardingState): boolean {
  return completedCount(state) === ONBOARDING_STEPS.length
}

/** Whether the onboarding overlay should show automatically. */
export function shouldShowOnboarding(): boolean {
  const state = getOnboardingState()
  // Show if not dismissed and not all completed
  return !state.dismissed && !allCompleted(state)
}
