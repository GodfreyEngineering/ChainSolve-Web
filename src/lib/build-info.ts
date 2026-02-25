/**
 * build-info.ts — Build metadata injected at build time by Vite `define`.
 *
 * Values are replaced at compile time via vite.config.ts.
 * At dev time they resolve to fallback strings.
 */

export const BUILD_VERSION: string = __CS_VERSION__
export const BUILD_SHA: string = __CS_SHA__
export const BUILD_TIME: string = __CS_BUILD_TIME__
export const BUILD_ENV: string = __CS_ENV__
