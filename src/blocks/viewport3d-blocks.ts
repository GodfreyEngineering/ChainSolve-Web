/**
 * viewport3d-blocks.ts — 6.16: 3D viewport block.
 *
 * Renders a 3D mesh (vertices + triangle faces) or point cloud using
 * Canvas 2D perspective projection with an orbit camera.
 *
 * Input: DataTable with columns x, y, z (vertices).
 *        Optional columns fi, fj, fk add triangle faces.
 *        If no input connected, shows a demo wireframe cube.
 *
 * Render modes: wireframe, solid (flat shading), transparent.
 * Controls: mouse-drag to orbit, wheel to zoom.
 */

import type { BlockDef } from './types'

export function registerViewport3DBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'viewport3d',
    label: '3D Viewport',
    category: 'visualization',
    nodeKind: 'csViewport3D',
    inputs: [{ id: 'mesh', label: 'Mesh' }],
    defaultData: {
      blockType: 'viewport3d',
      label: '3D Viewport',
      vp3dMode: 'wireframe' as 'wireframe' | 'solid' | 'transparent',
      vp3dAzimuth: 45,
      vp3dElevation: 30,
      vp3dZoom: 1.5,
      vp3dBgColor: '#1a1a1a',
      vp3dMeshColor: '#1CABB0',
    },
  })
}
