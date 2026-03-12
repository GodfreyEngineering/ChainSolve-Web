import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '../../components/ui/Input'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../../lib/profilesService'
import {
  updateDisplayName,
  uploadAvatar,
  getAvatarUrl,
  checkDisplayNameAvailable,
  saveDisplayName,
  validateDisplayNameFormat,
} from '../../lib/profilesService'
import {
  resizeAndCropToSquare,
  validateAvatarMimeType,
  createPreviewUrl,
} from '../../lib/imageResize'
import { validateDisplayName } from '../../lib/validateDisplayName'
import { resolveEffectivePlan } from '../../lib/entitlements'
import { PlanBadge } from '../../components/ui/PlanBadge'
import { displayNameStyle } from '../../lib/planStyles'

interface Props {
  user: User | null
  profile: Profile | null
  onProfileUpdated?: () => void
}

export function ProfileSettings({ user, profile, onProfileUpdated }: Props) {
  const { t } = useTranslation()
  const plan = resolveEffectivePlan(profile)

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
    setNameError(null)
    // K5-1: validate display name before saving
    if (displayName.trim()) {
      const v = validateDisplayName(displayName)
      if (!v.ok) {
        setNameError(t(`signupWizard.${v.error}`, v.error ?? 'Invalid name'))
        return
      }
    }
    setNameSaving(true)
    try {
      await updateDisplayName(displayName)
      setNameEditing(false)
      onProfileUpdated?.()
    } catch (err: unknown) {
      setNameError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setNameSaving(false)
    }
  }, [displayName, onProfileUpdated, t])

  // ── Unique handle (display_name) ──────────────────────────────────────────
  const [handle, setHandle] = useState(profile?.display_name ?? '')
  const [handleEditing, setHandleEditing] = useState(false)
  const [handleSaving, setHandleSaving] = useState(false)
  const [handleError, setHandleError] = useState<string | null>(null)
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null)
  const [handleChecking, setHandleChecking] = useState(false)
  const handleCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setHandle(profile?.display_name ?? '')
  }, [profile?.display_name])

  const handleCheckAvailability = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) {
        setHandleAvailable(null)
        return
      }
      const formatErr = validateDisplayNameFormat(trimmed)
      if (formatErr) {
        setHandleAvailable(null)
        return
      }
      // Don't check if it's the current saved value
      if (trimmed === (profile?.display_name ?? '')) {
        setHandleAvailable(null)
        return
      }
      setHandleChecking(true)
      const available = await checkDisplayNameAvailable(trimmed)
      setHandleChecking(false)
      setHandleAvailable(available)
    },
    [profile?.display_name],
  )

  const handleHandleChange = useCallback(
    (value: string) => {
      setHandle(value)
      setHandleError(null)
      setHandleAvailable(null)
      if (handleCheckTimerRef.current) clearTimeout(handleCheckTimerRef.current)
      handleCheckTimerRef.current = setTimeout(() => {
        void handleCheckAvailability(value)
      }, 500)
    },
    [handleCheckAvailability],
  )

  const handleSaveHandle = useCallback(async () => {
    setHandleError(null)
    const trimmed = handle.trim()
    if (trimmed) {
      const formatErr = validateDisplayNameFormat(trimmed)
      if (formatErr) {
        setHandleError(formatErr)
        return
      }
    }
    setHandleSaving(true)
    try {
      await saveDisplayName(trimmed)
      setHandleEditing(false)
      setHandleAvailable(null)
      onProfileUpdated?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save'
      setHandleError(msg.includes('already taken') ? 'That handle is already taken' : msg)
    } finally {
      setHandleSaving(false)
    }
  }, [handle, onProfileUpdated])

  // ── Avatar upload (ACCT-05) ──────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  // Preview state: file is resized/cropped but not yet uploaded
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null)

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

  // Revoke preview blob URL on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl)
    }
  }, [pendingPreviewUrl])

  const handleAvatarFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      setAvatarError(null)

      // Validate MIME type before processing
      const mimeError = validateAvatarMimeType(file)
      if (mimeError) {
        setAvatarError(mimeError)
        return
      }

      try {
        // Resize and center-crop to 256×256
        const resized = await resizeAndCropToSquare(file, 256)
        // Revoke previous preview URL
        if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl)
        const previewUrl = createPreviewUrl(resized)
        setPendingFile(resized)
        setPendingPreviewUrl(previewUrl)
      } catch (err: unknown) {
        setAvatarError(err instanceof Error ? err.message : 'Failed to process image')
      }
    },
    [pendingPreviewUrl],
  )

  const handleAvatarConfirm = useCallback(async () => {
    if (!pendingFile) return
    setAvatarUploading(true)
    setAvatarError(null)
    try {
      const path = await uploadAvatar(pendingFile)
      const url = await getAvatarUrl(path)
      setAvatarSrc(url)
      // Clean up preview
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl)
      setPendingFile(null)
      setPendingPreviewUrl(null)
      onProfileUpdated?.()
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setAvatarUploading(false)
    }
  }, [pendingFile, pendingPreviewUrl, onProfileUpdated])

  const handleAvatarCancel = useCallback(() => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl)
    setPendingFile(null)
    setPendingPreviewUrl(null)
    setAvatarError(null)
  }, [pendingPreviewUrl])

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
                {(pendingPreviewUrl ?? avatarSrc) ? (
                  <img
                    src={pendingPreviewUrl ?? avatarSrc!}
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
              {pendingFile ? (
                <>
                  <button
                    style={smallBtn}
                    disabled={avatarUploading}
                    onClick={() => void handleAvatarConfirm()}
                  >
                    {avatarUploading
                      ? t('settings.avatarUploading', 'Uploading\u2026')
                      : t('settings.avatarConfirm', 'Save photo')}
                  </button>
                  <button
                    style={{ ...smallBtn, background: 'transparent', border: '1px solid var(--border)', color: 'inherit' }}
                    disabled={avatarUploading}
                    onClick={handleAvatarCancel}
                  >
                    {t('settings.cancel', 'Cancel')}
                  </button>
                </>
              ) : (
                <button
                  style={smallBtn}
                  disabled={avatarUploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {t('settings.avatarUpload', 'Upload image')}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => void handleAvatarFileSelect(e)}
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
                <span
                  style={{
                    fontSize: '0.88rem',
                    opacity: displayName ? 1 : 0.4,
                    ...displayNameStyle(plan),
                  }}
                >
                  {displayName || t('settings.displayNameEmpty', 'Not set')}
                </span>
                <button style={smallBtn} onClick={() => setNameEditing(true)}>
                  {t('settings.edit', 'Edit')}
                </button>
              </div>
            )}
            {nameError && <span style={errorText}>{nameError}</span>}
          </div>

          {/* Unique handle (display_name) — ACCT-06 */}
          <div style={fieldStyle}>
            <span style={fieldLabel}>{t('settings.handleLabel', 'Unique handle')}</span>
            <span style={{ fontSize: '0.72rem', opacity: 0.5, marginBottom: 2 }}>
              {t(
                'settings.handleHint',
                'Letters, numbers, _ or - · 3–50 characters · must be unique',
              )}
            </span>
            {handleEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      style={nameInput}
                      value={handle}
                      onChange={(e) => handleHandleChange(e.target.value)}
                      placeholder="e.g. engineer_42"
                      maxLength={50}
                      disabled={handleSaving}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSaveHandle()
                        if (e.key === 'Escape') {
                          setHandle(profile?.display_name ?? '')
                          setHandleEditing(false)
                          setHandleError(null)
                          setHandleAvailable(null)
                        }
                      }}
                    />
                  </div>
                  <button
                    style={smallBtn}
                    onClick={() => void handleSaveHandle()}
                    disabled={handleSaving}
                  >
                    {handleSaving ? '\u2026' : t('settings.save', 'Save')}
                  </button>
                  <button
                    style={{
                      ...smallBtn,
                      background: 'transparent',
                      border: '1px solid var(--border)',
                    }}
                    onClick={() => {
                      setHandle(profile?.display_name ?? '')
                      setHandleEditing(false)
                      setHandleError(null)
                      setHandleAvailable(null)
                    }}
                  >
                    {t('settings.cancel', 'Cancel')}
                  </button>
                </div>
                {/* Availability indicator */}
                {handle.trim() && !handleError && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: handleChecking
                        ? 'rgba(244,244,243,0.4)'
                        : handleAvailable === true
                          ? 'var(--success, #34d399)'
                          : handleAvailable === false
                            ? '#f87171'
                            : 'rgba(244,244,243,0.4)',
                    }}
                  >
                    {handleChecking
                      ? 'Checking\u2026'
                      : handleAvailable === true
                        ? '\u2713 Available'
                        : handleAvailable === false
                          ? '\u2717 Already taken'
                          : validateDisplayNameFormat(handle.trim())
                            ? validateDisplayNameFormat(handle.trim())
                            : null}
                  </span>
                )}
                {handleError && <span style={errorText}>{handleError}</span>}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.88rem', opacity: handle ? 1 : 0.4 }}>
                  {handle ? `@${handle}` : t('settings.handleEmpty', 'Not set')}
                </span>
                <button style={smallBtn} onClick={() => setHandleEditing(true)}>
                  {t('settings.edit', 'Edit')}
                </button>
              </div>
            )}
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
            <PlanBadge plan={plan} />
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
  background: 'var(--surface-2)',
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
