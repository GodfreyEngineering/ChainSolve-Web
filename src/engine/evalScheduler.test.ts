import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EvalScheduler, suggestEvalMode } from './evalScheduler'
import type { PatchOp } from './wasm-types'

const dataOp: PatchOp = {
  op: 'updateNodeData',
  nodeId: 'n1',
  data: { blockType: 'number', value: 42 },
}

const structuralOp: PatchOp = {
  op: 'addNode',
  node: { id: 'n2', blockType: 'add', data: {} },
}

describe('EvalScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('auto mode', () => {
    it('dispatches data-only ops after debounce', () => {
      const flush = vi.fn()
      const scheduler = new EvalScheduler('auto')
      scheduler.onFlush(flush)

      scheduler.enqueue([dataOp])
      expect(flush).not.toHaveBeenCalled()

      vi.advanceTimersByTime(50)
      expect(flush).toHaveBeenCalledTimes(1)
      expect(flush).toHaveBeenCalledWith([dataOp])
    })

    it('dispatches structural ops immediately', () => {
      const flush = vi.fn()
      const scheduler = new EvalScheduler('auto')
      scheduler.onFlush(flush)

      scheduler.enqueue([structuralOp])
      expect(flush).toHaveBeenCalledTimes(1)
      expect(flush).toHaveBeenCalledWith([structuralOp])
    })

    it('coalesces rapid data-only ops', () => {
      const flush = vi.fn()
      const scheduler = new EvalScheduler('auto')
      scheduler.onFlush(flush)

      scheduler.enqueue([dataOp])
      vi.advanceTimersByTime(20)
      scheduler.enqueue([
        { op: 'updateNodeData', nodeId: 'n1', data: { blockType: 'number', value: 99 } },
      ])

      vi.advanceTimersByTime(50)
      expect(flush).toHaveBeenCalledTimes(1)
      // Should contain both ops
      expect(flush.mock.calls[0][0]).toHaveLength(2)
    })
  })

  describe('deferred mode', () => {
    it('dispatches after timeout fallback', () => {
      const flush = vi.fn()
      const scheduler = new EvalScheduler('deferred')
      scheduler.onFlush(flush)

      scheduler.enqueue([dataOp])
      expect(flush).not.toHaveBeenCalled()

      vi.advanceTimersByTime(2000)
      expect(flush).toHaveBeenCalledTimes(1)
    })

    it('dispatches structural ops immediately even in deferred mode', () => {
      const flush = vi.fn()
      const scheduler = new EvalScheduler('deferred')
      scheduler.onFlush(flush)

      scheduler.enqueue([structuralOp])
      expect(flush).toHaveBeenCalledTimes(1)
    })
  })

  describe('manual mode', () => {
    it('does not dispatch automatically', () => {
      const flush = vi.fn()
      const scheduler = new EvalScheduler('manual')
      scheduler.onFlush(flush)

      scheduler.enqueue([dataOp])
      vi.advanceTimersByTime(10000)
      expect(flush).not.toHaveBeenCalled()
      expect(scheduler.pendingCount).toBe(1)
    })

    it('dispatches on explicit flush', () => {
      const flush = vi.fn()
      const scheduler = new EvalScheduler('manual')
      scheduler.onFlush(flush)

      scheduler.enqueue([dataOp])
      scheduler.flush()
      expect(flush).toHaveBeenCalledTimes(1)
      expect(scheduler.pendingCount).toBe(0)
    })

    it('does not dispatch structural ops automatically in manual mode', () => {
      const flush = vi.fn()
      const scheduler = new EvalScheduler('manual')
      scheduler.onFlush(flush)

      scheduler.enqueue([structuralOp])
      vi.advanceTimersByTime(10000)
      // Manual mode: even structural ops wait for explicit flush
      // Wait — the checklist says manual mode only fires on flush.
      // But structural changes need immediate dispatch for graph consistency...
      // Actually for manual mode, structural changes should also wait.
      // The user explicitly chose manual control.
      expect(flush).not.toHaveBeenCalled()
    })
  })

  describe('pendingCount', () => {
    it('notifies on pending change', () => {
      const onChange = vi.fn()
      const scheduler = new EvalScheduler('manual')
      scheduler.onFlush(vi.fn())
      scheduler.onPendingChange(onChange)

      scheduler.enqueue([dataOp])
      expect(onChange).toHaveBeenCalledWith(1)

      scheduler.enqueue([structuralOp])
      expect(onChange).toHaveBeenCalledWith(2)

      scheduler.flush()
      expect(onChange).toHaveBeenCalledWith(0)
    })
  })

  describe('clear', () => {
    it('discards pending ops', () => {
      const flush = vi.fn()
      const scheduler = new EvalScheduler('auto')
      scheduler.onFlush(flush)

      scheduler.enqueue([dataOp])
      scheduler.clear()

      vi.advanceTimersByTime(100)
      expect(flush).not.toHaveBeenCalled()
      expect(scheduler.pendingCount).toBe(0)
    })
  })

  describe('dispose', () => {
    it('cancels timers and prevents further dispatches', () => {
      const flush = vi.fn()
      const scheduler = new EvalScheduler('auto')
      scheduler.onFlush(flush)

      scheduler.enqueue([dataOp])
      scheduler.dispose()

      vi.advanceTimersByTime(100)
      expect(flush).not.toHaveBeenCalled()
    })
  })

  describe('mode switching', () => {
    it('flushes pending ops when switching to auto', () => {
      const flush = vi.fn()
      const scheduler = new EvalScheduler('manual')
      scheduler.onFlush(flush)

      scheduler.enqueue([dataOp])
      expect(flush).not.toHaveBeenCalled()

      scheduler.mode = 'auto'
      // Should schedule auto dispatch
      vi.advanceTimersByTime(50)
      expect(flush).toHaveBeenCalledTimes(1)
    })
  })
})

describe('suggestEvalMode', () => {
  it('returns auto for small graphs', () => {
    expect(suggestEvalMode(10)).toBe('auto')
    expect(suggestEvalMode(49)).toBe('auto')
  })

  it('returns deferred for medium graphs', () => {
    expect(suggestEvalMode(50)).toBe('deferred')
    expect(suggestEvalMode(299)).toBe('deferred')
  })

  it('returns manual for large graphs', () => {
    expect(suggestEvalMode(300)).toBe('manual')
    expect(suggestEvalMode(1000)).toBe('manual')
  })
})
