import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '../../components/ui/Input'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../../lib/profilesService'
import { updateDisplayName, uploadAvatar, getAvatarUrl } from '../../lib/profilesService'

interface Props {
  user: User | null
  profile: Profile | null
  onProfileUpdated?: () => void
}

export function ProfileSettings({ user, profile, onProfileUpdated }: Props) {
  const { t } = useTranslation()
  const plan = profile?.plan ?? 'free'

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '\u2014'

  // ── Display name editing ──────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(profile?.full_name ?? '')
  const [nameEditing, setNameEditing] = useState(false)
  const [nameSaving, setNameSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  useEffect(() => {
    setDisplayName(profile?.full_name ?? '')
  }, [profile?.full_name])

  const handleSaveName = useCallback(async () => {
    setNameSaving(true)
    setNameError(null)
    try {
      await updateDisplayName(displayName)
      setNameEditing(false)
      onProfileUpdated?.()
    } catch (err: unknown) {
      setNameError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setNameSaving(false)
    }
  }, [displayName, onProfileUpdated])

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.avatar_url) {
      setAvatarSrc(null)
      return
    }
    let cancelled = false
    getAvatarUrl(profile.avatar_url).then((url) => {
      if (!cancelled) setAvatarSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [profile?.avatar_url])

  const handleAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      setAvatarUploading(true)
      setAvatarError(null)
      try {
        const path = await uploadAvatar(file)
        const url = await getAvatarUrl(path)
        setAvatarSrc(url)
        onProfileUpdated?.()
      } catch (err: unknown) {
        setAvatarError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setAvatarUploading(false)
      }
    },
    [onProfileUpdated],
  )

  return (
    <div>
      <h2 style={headingStyle}>{t('settings.profile')}</h2>

      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Avatar */}
          <div style={fieldStyle}>
            <span style={fieldLabel}>{t('settings.avatarLabel', 'Profile image')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={avatarCircle}>
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt="Avatar"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: '50%',
                    }}
                  />
                ) : (
                  <span style={{ fontSize: '1.5rem', opacity: 0.4 }}>
                    {(profile?.full_name ?? user?.email ?? '?')[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <button
                style={smallBtn}
                disabled={avatarUploading}
                onClick={() => fileRef.current?.click()}
              >
                {avatarUploading
                  ? t('settings.avatarUploading', 'Uploading\u2026')
                  : t('settings.avatarUpload', 'Upload image')}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => void handleAvatarChange(e)}
              />
            </div>
            {avatarError && <span style={errorText}>{avatarError}</span>}
          </div>

          {/* Display name */}
          <div style={fieldStyle}>
            <span style={fieldLabel}>{t('settings.displayNameLabel', 'Display name')}</span>
            {nameEditing ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  style={nameInput}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('settings.displayNamePlaceholder', 'Your name')}
                  maxLength={100}
                  disabled={nameSaving}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveName()
                    if (e.key === 'Escape') {
                      setDisplayName(profile?.full_name ?? '')
                      setNameEditing(false)
                    }
                  }}
                />
                <button
                  style={smallBtn}
                  onClick={() => void handleSaveName()}
                  disabled={nameSaving}
                >
                  {nameSaving ? '\u2026' : t('settings.save', 'Save')}
                </button>
                <button
                  style={{
                    ...smallBtn,
                    background: 'transparent',
                    border: '1px solid var(--border)',
                  }}
                  onClick={() => {
                    setDisplayName(profile?.full_name ?? '')
                    setNameEditing(false)
                    setNameError(null)
                  }}
                >
                  {t('settings.cancel', 'Cancel')}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.88rem', opacity: displayName ? 1 : 0.4 }}>
                  {displayName || t('settings.displayNameEmpty', 'Not set')}
                </span>
                <button style={smallBtn} onClick={() => setNameEditing(true)}>
                  {t('settings.edit', 'Edit')}
                </button>
              </div>
            )}
            {nameError && <span style={errorText}>{nameError}</span>}
          </div>

          {/* Email (read-only) */}
          <Input
            label={t('settings.emailLabel')}
            value={user?.email ?? ''}
            readOnly
            hint={t('settings.emailHint')}
            style={{ opacity: 0.7, cursor: 'default' }}
          />

          {/* User ID (read-only) */}
          <Input
            label={t('settings.userIdLabel')}
            value={user?.id ?? ''}
            readOnly
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.78rem',
              opacity: 0.5,
              cursor: 'default',
            }}
          />

          {/* Member since */}
          <div style={fieldStyle}>
            <span style={fieldLabel}>{t('settings.memberSince')}</span>
            <span style={{ fontSize: '0.88rem' }}>{memberSince}</span>
          </div>

          {/* Plan badge */}
          <div style={fieldStyle}>
            <span style={fieldLabel}>{t('settings.planLabel')}</span>
            <span style={planBadgeStyle(plan)}>{t(`plans.${plan}`)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const headingStyle: React.CSSProperties = {
  margin: '0 0 1.25rem',
  fontSize: '1.15rem',
  fontWeight: 700,
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '1.5rem',
  background: 'var(--card-bg)',
}

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
}

const fieldLabel: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  opacity: 0.7,
}

const avatarCircle: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: '50%',
  border: '2px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  flexShrink: 0,
  background: 'var(--bg)',
}

const smallBtn: React.CSSProperties = {
  padding: '0.3rem 0.75rem',
  border: 'none',
  borderRadius: 6,
  background: 'var(--primary)',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.78rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const nameInput: React.CSSProperties = {
  flex: 1,
  padding: '0.4rem 0.6rem',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: '0.88rem',
  fontFamily: 'inherit',
  background: 'var(--bg)',
  color: 'inherit',
}

const errorText: React.CSSProperties = {
  fontSize: '0.78rem',
  color: '#f87171',
}

const PLAN_COLORS: Record<string, string> = {
  free: '#6b7280',
  trialing: '#3b82f6',
  pro: '#22c55e',
  enterprise: '#8b5cf6',
  past_due: '#f59e0b',
  canceled: '#ef4444',
}

function planBadgeStyle(plan: string): React.CSSProperties {
  const color = PLAN_COLORS[plan] ?? '#6b7280'
  return {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    borderRadius: 999,
    fontSize: '0.8rem',
    fontWeight: 700,
    background: `${color}22`,
    color,
    border: `1px solid ${color}44`,
    width: 'fit-content',
  }
}
