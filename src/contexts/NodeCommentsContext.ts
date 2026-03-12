/**
 * NodeCommentsContext — provides comment counts per node and a handler
 * to open the comment thread dialog for a specific node.
 *
 * Provided by CanvasArea. Consumed by NodeCommentBadge (rendered via
 * NodeToolbar overlays) and the context menu handler.
 */

import { createContext, useContext } from 'react'

export interface NodeCommentsContextValue {
  /** Map of nodeId → active (unresolved) comment count. */
  commentCounts: ReadonlyMap<string, number>
  /** Open the comment thread dialog for the given node. */
  openThread: (nodeId: string) => void
}

export const NodeCommentsContext = createContext<NodeCommentsContextValue>({
  commentCounts: new Map(),
  openThread: () => undefined,
})

export function useNodeComments(): NodeCommentsContextValue {
  return useContext(NodeCommentsContext)
}
