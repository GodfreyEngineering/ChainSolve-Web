import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSettingsModal } from '../contexts/SettingsModalContext'
import type { SettingsTab } from '../contexts/SettingsModalContext'

const VALID_TABS = new Set<string>(['profile', 'billing', 'preferences'])

export function SettingsRedirect() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { openSettings } = useSettingsModal()

  useEffect(() => {
    const raw = searchParams.get('tab')
    const tab = raw && VALID_TABS.has(raw) ? (raw as SettingsTab) : 'profile'
    openSettings(tab)
    navigate('/app', { replace: true })
  }, [searchParams, openSettings, navigate])

  return null
}
