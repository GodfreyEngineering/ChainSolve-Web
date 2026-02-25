/** Default starter graph — split out for react-refresh compatibility. */

import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '../../blocks/registry'

export const INITIAL_NODES: Node<NodeData>[] = [
  {
    id: 'n1',
    type: 'csSource',
    position: { x: 80, y: 120 },
    data: { blockType: 'number', label: 'Number', value: 3 },
  },
  {
    id: 'n2',
    type: 'csSource',
    position: { x: 80, y: 240 },
    data: { blockType: 'number', label: 'Number', value: 4 },
  },
  {
    id: 'n3',
    type: 'csOperation',
    position: { x: 320, y: 160 },
    data: { blockType: 'add', label: 'Add' },
  },
  {
    id: 'n4',
    type: 'csDisplay',
    position: { x: 540, y: 180 },
    data: { blockType: 'display', label: 'Result' },
  },
]

export const INITIAL_EDGES: Edge[] = [
  { id: 'e1', source: 'n1', sourceHandle: 'out', target: 'n3', targetHandle: 'a', animated: true },
  { id: 'e2', source: 'n2', sourceHandle: 'out', target: 'n3', targetHandle: 'b', animated: true },
  {
    id: 'e3',
    source: 'n3',
    sourceHandle: 'out',
    target: 'n4',
    targetHandle: 'value',
    animated: true,
  },
]
