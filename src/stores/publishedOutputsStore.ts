/**
 * publishedOutputsStore — Zustand store for cross-sheet published values (H7-1).
 *
 * Publish blocks write their computed value under a channel name.
 * Subscribe blocks on any sheet read the latest value from a channel.
 *
 * The store is project-scoped: reset when a project closes.
 */

import { create } from 'zustand'

/** A single published channel entry. */
export interface PublishedChannel {
  /** The numeric value published. */
  value: number
  /** Node ID of the publish block that owns this channel. */
  sourceNodeId: string
  /** Canvas ID where the publish block lives. */
  sourceCanvasId: string
}

/** Map of channelName → PublishedChannel. */
export type PublishedOutputsMap = Record<string, PublishedChannel>

interface PublishedOutputsState {
  channels: PublishedOutputsMap

  /**
   * Bulk-update published channels from a single canvas evaluation.
   * Replaces all entries from the given canvasId, removes stale ones,
   * and merges with entries from other canvases.
   */
  updateFromCanvas: (
    canvasId: string,
    entries: { channelName: string; value: number; sourceNodeId: string }[],
  ) => void

  /** Remove all channels published from a specific canvas. */
  removeCanvas: (canvasId: string) => void

  /** Reset store (called on project close). */
  reset: () => void
}

export const usePublishedOutputsStore = create<PublishedOutputsState>((set) => ({
  channels: {},

  updateFromCanvas: (canvasId, entries) =>
    set((s) => {
      // Remove old entries from this canvas
      const next: PublishedOutputsMap = {}
      for (const [name, ch] of Object.entries(s.channels)) {
        if (ch.sourceCanvasId !== canvasId) {
          next[name] = ch
        }
      }
      // Add new entries from this canvas
      for (const e of entries) {
        if (e.channelName) {
          next[e.channelName] = {
            value: e.value,
            sourceNodeId: e.sourceNodeId,
            sourceCanvasId: canvasId,
          }
        }
      }
      return { channels: next }
    }),

  removeCanvas: (canvasId) =>
    set((s) => {
      const next: PublishedOutputsMap = {}
      for (const [name, ch] of Object.entries(s.channels)) {
        if (ch.sourceCanvasId !== canvasId) {
          next[name] = ch
        }
      }
      return { channels: next }
    }),

  reset: () => set({ channels: {} }),
}))
