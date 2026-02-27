/**
 * observability/debugLog.ts — Ergonomic logging API for the Debug Console.
 *
 * Usage:
 *   import { dlog } from '../observability/debugLog'
 *   dlog.info('engine', 'Evaluation complete', { durationMs: 42, nodes: 120 })
 *   dlog.warn('bindings', 'Missing variable', { varId: 'var-123' })
 *
 * All entries flow into the debugConsoleStore ring buffer.
 * Redaction is applied inside the store; callers do not need to redact.
 */

import type { LogLevel, LogScope } from '../stores/debugConsoleStore'
import { useDebugConsoleStore } from '../stores/debugConsoleStore'

function emit(level: LogLevel, scope: LogScope, msg: string, meta?: Record<string, unknown>) {
  useDebugConsoleStore.getState().add(level, scope, msg, meta)
}

export const dlog = {
  error: (scope: LogScope, msg: string, meta?: Record<string, unknown>) =>
    emit('error', scope, msg, meta),
  warn: (scope: LogScope, msg: string, meta?: Record<string, unknown>) =>
    emit('warn', scope, msg, meta),
  info: (scope: LogScope, msg: string, meta?: Record<string, unknown>) =>
    emit('info', scope, msg, meta),
  debug: (scope: LogScope, msg: string, meta?: Record<string, unknown>) =>
    emit('debug', scope, msg, meta),
  trace: (scope: LogScope, msg: string, meta?: Record<string, unknown>) =>
    emit('trace', scope, msg, meta),
}
