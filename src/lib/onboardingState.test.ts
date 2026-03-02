import { describe, it, expect, beforeEach } from 'vitest'
import {
  getOnboardingState,
  completeStep,
  dismissOnboarding,
  resetOnboarding,
  clearOnboarding,
  completedCount,
  allCompleted,
  shouldShowOnboarding,
  ONBOARDING_STEPS,
} from './onboardingState'

beforeEach(() => {
  localStorage.clear()
})

describe('onboardingState', () => {
  it('returns default state when nothing stored', () => {
    const s = getOnboardingState()
    expect(s.completed).toEqual({})
    expect(s.dismissed).toBe(false)
  })

  it('completeStep marks a step and persists', () => {
    completeStep('open_projects')
    const s = getOnboardingState()
    expect(s.completed.open_projects).toBe(true)
    expect(s.completed.create_project).toBeUndefined()
  })

  it('completeStep is idempotent', () => {
    completeStep('add_input')
    completeStep('add_input')
    expect(completedCount(getOnboardingState())).toBe(1)
  })

  it('dismissOnboarding sets dismissed flag', () => {
    dismissOnboarding()
    expect(getOnboardingState().dismissed).toBe(true)
  })

  it('resetOnboarding clears dismissed but keeps completed steps', () => {
    completeStep('open_projects')
    dismissOnboarding()
    expect(getOnboardingState().dismissed).toBe(true)
    resetOnboarding()
    const s = getOnboardingState()
    expect(s.dismissed).toBe(false)
    expect(s.completed.open_projects).toBe(true)
  })

  it('clearOnboarding removes all data', () => {
    completeStep('open_projects')
    dismissOnboarding()
    clearOnboarding()
    const s = getOnboardingState()
    expect(s.completed).toEqual({})
    expect(s.dismissed).toBe(false)
  })

  it('completedCount counts correctly', () => {
    expect(completedCount(getOnboardingState())).toBe(0)
    completeStep('open_projects')
    completeStep('create_project')
    expect(completedCount(getOnboardingState())).toBe(2)
  })

  it('allCompleted returns true when all steps done', () => {
    expect(allCompleted(getOnboardingState())).toBe(false)
    for (const step of ONBOARDING_STEPS) {
      completeStep(step)
    }
    expect(allCompleted(getOnboardingState())).toBe(true)
  })

  it('shouldShowOnboarding returns true for fresh user', () => {
    expect(shouldShowOnboarding()).toBe(true)
  })

  it('shouldShowOnboarding returns false when dismissed', () => {
    dismissOnboarding()
    expect(shouldShowOnboarding()).toBe(false)
  })

  it('shouldShowOnboarding returns false when all steps completed', () => {
    for (const step of ONBOARDING_STEPS) {
      completeStep(step)
    }
    expect(shouldShowOnboarding()).toBe(false)
  })

  it('shouldShowOnboarding returns true after reset (with partial progress)', () => {
    completeStep('open_projects')
    dismissOnboarding()
    resetOnboarding()
    expect(shouldShowOnboarding()).toBe(true)
  })

  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem('cs:onboarding-checklist', 'not-json')
    const s = getOnboardingState()
    expect(s.completed).toEqual({})
    expect(s.dismissed).toBe(false)
  })

  it('handles partial localStorage object gracefully', () => {
    localStorage.setItem('cs:onboarding-checklist', '{"dismissed":true}')
    const s = getOnboardingState()
    expect(s.dismissed).toBe(true)
    expect(s.completed).toEqual({})
  })
})
