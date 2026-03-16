/**
 * normalizeTemplateNodes — Runtime safety net for starter templates.
 *
 * ReactFlow requires `node.type` to be a registered nodeKind (e.g.
 * 'csSource', 'csOperation', 'csDisplay'), but template files may
 * accidentally set `type` to the block registry key (e.g. 'number',
 * 'multiply', 'display').  This function looks up the correct nodeKind
 * from BLOCK_REGISTRY and patches each node in place.
 *
 * This is a safety net — template files should use the correct nodeKind
 * directly, but this function catches any mismatches at load time.
 */

import { BLOCK_REGISTRY } from '../blocks/registry'
import type { NodeKind } from '../blocks/types'

const VALID_NODE_KINDS = new Set<string>([
  'csSource',
  'csOperation',
  'csDisplay',
  'csData',
  'csPlot',
  'csListTable',
  'csGroup',
  'csPublish',
  'csSubscribe',
  'csAnnotation',
  'csMaterial',
  'csOptimizer',
  'csMLModel',
  'csNeuralNet',
])

interface TemplateNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

/**
 * Ensure every node's `type` field is a valid ReactFlow nodeKind.
 * If `type` is a block registry key instead, look up the correct nodeKind.
 */
export function normalizeTemplateNodes<T extends TemplateNode>(nodes: T[]): T[] {
  return nodes.map((node) => {
    // Already a valid nodeKind — nothing to fix
    if (VALID_NODE_KINDS.has(node.type)) return node

    // type is a block registry key — look up the correct nodeKind
    const blockType = (node.data?.blockType as string) ?? node.type
    const def = BLOCK_REGISTRY.get(blockType)
    if (def) {
      return { ...node, type: def.nodeKind as string }
    }

    // Unknown block — leave as-is (will render as unknown node)
    return node
  })
}

/** Look up the nodeKind for a given block type string. */
export function blockTypeToNodeKind(blockType: string): NodeKind {
  const def = BLOCK_REGISTRY.get(blockType)
  if (!def) throw new Error(`Unknown block type: ${blockType}`)
  return def.nodeKind
}
