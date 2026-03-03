/**
 * platform.ts — Platform detection flags (I9-1).
 *
 * When ChainSolve ships on desktop (Tauri) or mobile (Capacitor), these
 * flags allow feature code to branch without pulling in platform SDKs.
 *
 * For now only the web platform is supported; the flags are compile-time
 * constants so dead-code elimination removes unused branches.
 */

/** True when running in a standard browser (Cloudflare Pages build). */
export const IS_WEB = true as const

/** True when running inside a Tauri desktop shell. */
export const IS_DESKTOP = false as const

/** True when running inside a Capacitor mobile shell. */
export const IS_MOBILE = false as const

/** Union of supported platform identifiers. */
export type Platform = 'web' | 'desktop' | 'mobile'

/** The current platform at runtime. */
export const PLATFORM: Platform = 'web'

/**
 * Returns true if the platform supports filesystem access (desktop only).
 * On web and mobile, projects are stored in Supabase.
 */
export function supportsNativeFs(): boolean {
  return IS_DESKTOP
}

/**
 * Returns true if the platform supports push notifications (mobile only).
 */
export function supportsPushNotifications(): boolean {
  return IS_MOBILE
}

/**
 * Returns true if the platform runs inside a webview (desktop or mobile).
 */
export function isWebview(): boolean {
  return IS_DESKTOP || IS_MOBILE
}
