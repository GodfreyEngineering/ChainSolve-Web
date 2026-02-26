/**
 * observability/logger.ts — Structured logger with level filtering.
 *
 * In development: all levels printed to console (full detail).
 * In production:  only 'warn' and 'error' printed; values are redacted.
 *
 * All log calls pass through redact() before console output in production.
 * Server-side Functions should use this pattern directly (no import).
 *
 * Usage:
 *   import { logger } from './logger'
 *   logger.info('project_saved', { projectId: '...' })
 *   logger.error('save_failed', new Error('...'))
 */

import { redactObject } from './redact'
import { BUILD_ENV } from '../lib/build-info'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

const MIN_LEVEL_PROD: LogLevel = 'warn'
const MIN_LEVEL_DEV: LogLevel = 'debug'

function currentMinLevel(): number {
  const isDev = BUILD_ENV === 'development'
  return LEVELS[isDev ? MIN_LEVEL_DEV : MIN_LEVEL_PROD]
}

function format(level: LogLevel, event: string, context?: unknown): string {
  return `[cs:${level}] ${event}`
}

function safeContext(context: unknown): unknown {
  if (BUILD_ENV === 'development') return context
  try {
    return redactObject(context)
  } catch {
    return '[REDACT_ERROR]'
  }
}

class Logger {
  debug(event: string, context?: unknown): void {
    if (LEVELS.debug < currentMinLevel()) return
    console.debug(format('debug', event), safeContext(context))
  }

  info(event: string, context?: unknown): void {
    if (LEVELS.info < currentMinLevel()) return
    console.info(format('info', event), safeContext(context))
  }

  warn(event: string, context?: unknown): void {
    if (LEVELS.warn < currentMinLevel()) return
    console.warn(format('warn', event), safeContext(context))
  }

  error(event: string, errOrContext?: unknown, context?: unknown): void {
    if (LEVELS.error < currentMinLevel()) return
    if (errOrContext instanceof Error) {
      console.error(format('error', event), errOrContext, safeContext(context))
    } else {
      console.error(format('error', event), safeContext(errOrContext))
    }
  }
}

export const logger = new Logger()
