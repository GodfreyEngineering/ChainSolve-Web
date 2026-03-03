/**
 * sessionBroadcast.ts — Cross-tab session coordination (L3-1).
 *
 * Uses the BroadcastChannel API to instantly notify all tabs in the
 * same browser when the current session is revoked.  Without this,
 * each tab independently polls every 60 seconds and can show stale
 * state or duplicate "session revoked" modals.
 *
 * Falls back gracefully when BroadcastChannel is not available
 * (SSR, older browsers, WebKit private browsing before Safari 15.4).
 */

const CHANNEL_NAME = 'cs:session'

interface SessionMessage {
  type: 'SESSION_REVOKED'
}

type Listener = () => void

let channel: BroadcastChannel | null = null
const listeners: Set<Listener> = new Set()

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME)
      channel.onmessage = (event: MessageEvent<SessionMessage>) => {
        if (event.data?.type === 'SESSION_REVOKED') {
          for (const fn of listeners) fn()
        }
      }
    } catch {
      // BroadcastChannel creation can throw in restricted contexts.
      return null
    }
  }
  return channel
}

/**
 * Notify all other tabs that the current session has been revoked.
 * Call this when a validity check detects the session is gone.
 */
export function broadcastSessionRevoked(): void {
  const ch = getChannel()
  if (!ch) return
  try {
    ch.postMessage({ type: 'SESSION_REVOKED' } satisfies SessionMessage)
  } catch {
    // postMessage can throw if the channel is closed.
  }
}

/**
 * Subscribe to session-revoked events from other tabs.
 * Returns an unsubscribe function.
 */
export function onSessionRevoked(callback: Listener): () => void {
  // Ensure the channel is initialised so we receive messages.
  getChannel()
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

/** Close the channel and clear all listeners. For testing. */
export function destroySessionBroadcast(): void {
  listeners.clear()
  if (channel) {
    try {
      channel.close()
    } catch {
      // ignore
    }
    channel = null
  }
}
