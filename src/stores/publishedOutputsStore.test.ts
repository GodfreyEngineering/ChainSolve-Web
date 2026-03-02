/**
 * publishedOutputsStore.test.ts — Unit tests for cross-sheet publish/subscribe store (H7-1).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { usePublishedOutputsStore } from './publishedOutputsStore'

const { getState } = usePublishedOutputsStore

function reset() {
  getState().reset()
}

beforeEach(reset)

describe('publishedOutputsStore', () => {
  it('starts with empty channels', () => {
    expect(getState().channels).toEqual({})
  })

  it('updateFromCanvas adds channels for a canvas', () => {
    getState().updateFromCanvas('c1', [
      { channelName: 'velocity', value: 42, sourceNodeId: 'n1' },
      { channelName: 'force', value: 100, sourceNodeId: 'n2' },
    ])
    const ch = getState().channels
    expect(ch.velocity).toEqual({ value: 42, sourceNodeId: 'n1', sourceCanvasId: 'c1' })
    expect(ch.force).toEqual({ value: 100, sourceNodeId: 'n2', sourceCanvasId: 'c1' })
  })

  it('updateFromCanvas replaces stale entries from same canvas', () => {
    getState().updateFromCanvas('c1', [{ channelName: 'velocity', value: 42, sourceNodeId: 'n1' }])
    getState().updateFromCanvas('c1', [{ channelName: 'velocity', value: 99, sourceNodeId: 'n1' }])
    expect(getState().channels.velocity.value).toBe(99)
  })

  it('updateFromCanvas removes deleted channels from same canvas', () => {
    getState().updateFromCanvas('c1', [
      { channelName: 'velocity', value: 42, sourceNodeId: 'n1' },
      { channelName: 'force', value: 100, sourceNodeId: 'n2' },
    ])
    // Only velocity remains
    getState().updateFromCanvas('c1', [{ channelName: 'velocity', value: 42, sourceNodeId: 'n1' }])
    expect(getState().channels.force).toBeUndefined()
    expect(getState().channels.velocity).toBeDefined()
  })

  it('updateFromCanvas preserves channels from other canvases', () => {
    getState().updateFromCanvas('c1', [{ channelName: 'velocity', value: 42, sourceNodeId: 'n1' }])
    getState().updateFromCanvas('c2', [{ channelName: 'force', value: 100, sourceNodeId: 'n3' }])
    const ch = getState().channels
    expect(ch.velocity.sourceCanvasId).toBe('c1')
    expect(ch.force.sourceCanvasId).toBe('c2')
  })

  it('skips entries with empty channel name', () => {
    getState().updateFromCanvas('c1', [{ channelName: '', value: 42, sourceNodeId: 'n1' }])
    expect(Object.keys(getState().channels)).toHaveLength(0)
  })

  it('removeCanvas removes all entries from a canvas', () => {
    getState().updateFromCanvas('c1', [{ channelName: 'velocity', value: 42, sourceNodeId: 'n1' }])
    getState().updateFromCanvas('c2', [{ channelName: 'force', value: 100, sourceNodeId: 'n3' }])
    getState().removeCanvas('c1')
    expect(getState().channels.velocity).toBeUndefined()
    expect(getState().channels.force).toBeDefined()
  })

  it('reset clears all channels', () => {
    getState().updateFromCanvas('c1', [{ channelName: 'velocity', value: 42, sourceNodeId: 'n1' }])
    getState().reset()
    expect(getState().channels).toEqual({})
  })
})
