/**
 * errors.ts — Typed error system for the service layer.
 *
 * All service functions throw ServiceError instead of raw Error.
 * The `code` field enables i18n-safe UI messages.
 * The `retryable` flag tells the UI whether a "Retry" button makes sense.
 */

export type ErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'PROJECT_LIMIT_REACHED'
  | 'CANVAS_LIMIT_REACHED'
  | 'DUPLICATE_PROJECT_NAME'
  | 'INVALID_PROJECT_NAME'
  | 'SAVE_CONFLICT'
  | 'NETWORK_ERROR'
  | 'STORAGE_ERROR'
  | 'DB_ERROR'
  | 'READ_ONLY_PLAN'
  | 'FILE_TOO_LARGE'

export class ServiceError extends Error {
  readonly code: ErrorCode
  readonly retryable: boolean
  override readonly cause?: unknown

  constructor(code: ErrorCode, message: string, retryable = false, cause?: unknown) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
    this.retryable = retryable
    this.cause = cause
  }
}

/** True if the error looks like a transient network/server issue worth retrying. */
export function isRetryableError(err: unknown): boolean {
  if (err instanceof ServiceError) return err.retryable
  const msg = err instanceof Error ? err.message : ''
  return (
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('fetch')
  )
}
