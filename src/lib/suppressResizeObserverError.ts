/**
 * suppressResizeObserverError.ts — G0-4
 *
 * Suppresses the benign "ResizeObserver loop" browser error.
 *
 * All major browsers fire this error when a ResizeObserver callback causes
 * layout changes that produce further resize notifications that cannot be
 * delivered in the same frame. The browser catches up in the next frame
 * automatically — no data is lost, no layout is wrong.
 *
 * Libraries like React Flow (@xyflow/react) use ResizeObserver internally
 * and are particularly prone to triggering this during rapid container
 * resizing (e.g. panel drag-resize).
 *
 * This is the industry-standard suppression pattern recommended by the
 * ResizeObserver spec authors. See:
 *   https://github.com/WICG/resize-observer/issues/38
 *
 * The handler must be installed BEFORE the observability pipeline
 * (initObservability) so it can prevent the error from propagating
 * to error reporting.
 */

const RESIZE_OBSERVER_MSG = 'ResizeObserver loop'

/** Returns true if the error message matches the benign ResizeObserver loop error. */
export function isResizeObserverLoopError(message: string): boolean {
  return message.includes(RESIZE_OBSERVER_MSG)
}

let _installed = false

/**
 * Install a global error handler that swallows the ResizeObserver loop error.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function installResizeObserverErrorSuppressor(): void {
  if (_installed) return
  _installed = true

  window.addEventListener(
    'error',
    (e: ErrorEvent) => {
      if (e.message && isResizeObserverLoopError(e.message)) {
        e.stopImmediatePropagation()
        e.preventDefault()
      }
    },
    // Capture phase — runs before any other error handlers.
    true,
  )
}
