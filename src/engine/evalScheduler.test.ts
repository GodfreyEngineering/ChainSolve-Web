import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EvalScheduler } from './evalScheduler'
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

  describe('reactive mode', () => {
    it('dispatches data-only ops after 50ms debounce', () => {
      const flush = vi.fn()
      const scheduler = new EvalScheduler('reactive')
      scheduler.onFlush(flush)

      scheduler.enqueue([dataOp])
      expect(flush).not.toHaveBeenCalled()

      vi.advanceTimersByTime(50)
      expect(flush).toHaveBeenCalledTimes(1)
      expect(flush).toHaveBeenCalledWith([dataOp])
    })

    it('dispatches structural ops immediately', () => {
      const flush = vi.fn()
      const scheduler = new EvalScheduler('reactive')
      scheduler.onFlush(flush)

      scheduler.enqueue([structuralOp])
      expect(flush).toHaveBeenCalledTimes(1)
      expect(flush).toHaveBeenCalledWith([structuralOp])
    })

    it('coalesces rapid data-only ops within debounce window', () => {
      const flush = vi.fn()
      const scheduler = new EvalScheduler('reactive')
      scheduler.onFlush(flush)

      scheduler.enqueue([dataOp])
      vi.advanceTimersByTime(20)
      scheduler.enqueue([
        { op: 'updateNodeData', nodeId: 'n1', data: { blockType: 'number', value: 99 } },
      ])

      vi.advanceTimersByTime(50)
      expect(flush).toHaveBeenCalledTimes(1)
      expect(flush.mock.calls[0][0]).toHaveLength(2)
    })

    it('fires exactly once per change, not continuously', () => {
      const flush = vi.fn()
      const scheduler = new EvalScheduler('reactive')
      scheduler.onFlush(flush)

      scheduler.enqueue([dataOp])
      vi.advanceTimersByTime(50)
      expect(flush).toHaveBeenCalledTimes(1)

      // No more calls without new enqueue
      vi.advanceTimersByTime(5000)
      expect(flush).toHaveBeenCalledTimes(1)
    })

    it('fires again when a new change is enqueued after previous dispatch', () => {
      const flush = vi.fn()
      const scheduler = new EvalScheduler('reactive')
      scheduler.onFlush(flush)

      scheduler.enqueue([dataOp])
      vi.advanceTimersByTime(50)
      expect(flush).toHaveBeenCalledTimes(1)

      scheduler.enqueue([dataOp])
      vi.advanceTimersByTime(50)
      expect(flush).toHaveBeenCalledTimes(2)
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

    it('does not dispatch structural ops automatically', () => {
      const flush = vi.fn()
      const scheduler = new EvalScheduler('manual')
      scheduler.onFlush(flush)

      scheduler.enqueue([structuralOp])
      vi.advanceTimersByTime(10000)
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
    it('discards pending ops without dispatching', () => {
      const flush = vi.fn()
      const scheduler = new EvalScheduler('reactive')
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
      const scheduler = new EvalScheduler('reactive')
      scheduler.onFlush(flush)

      scheduler.enqueue([dataOp])
      scheduler.dispose()

      vi.advanceTimersByTime(100)
      expect(flush).not.toHaveBeenCalled()
    })

    it('ignores enqueue after dispose', () => {
      const flush = vi.fn()
      const scheduler = new EvalScheduler('reactive')
      scheduler.onFlush(flush)
      scheduler.dispose()

      scheduler.enqueue([structuralOp])
      expect(flush).not.toHaveBeenCalled()
    })
  })

  describe('mode switching', () => {
    it('schedules pending ops when switching to reactive', () => {
      const flush = vi.fn()
      const scheduler = new EvalScheduler('manual')
      scheduler.onFlush(flush)

      scheduler.enqueue([dataOp])
      expect(flush).not.toHaveBeenCalled()

      scheduler.mode = 'reactive'
      vi.advanceTimersByTime(50)
      expect(flush).toHaveBeenCalledTimes(1)
    })

    it('defaults to reactive mode', () => {
      const scheduler = new EvalScheduler()
      expect(scheduler.mode).toBe('reactive')
    })
  })
})
