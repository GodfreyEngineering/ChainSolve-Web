# React Flow / XYFlow Licensing Compliance

This document records ChainSolve's compliance stance for the React Flow
library (@xyflow/react), which powers the node-graph canvas.

## Package details

| Field | Value |
|-------|-------|
| Package | @xyflow/react |
| Installed version | 12.10.1 |
| License | MIT |
| Copyright | 2019-2025 webkid GmbH |
| Repository | https://github.com/xyflow/xyflow |
| License URL | https://github.com/xyflow/xyflow/blob/main/LICENSE |

## License analysis

React Flow is distributed under the **MIT License**, which permits
unrestricted commercial use, modification, and distribution. The xyflow
team has publicly stated they will keep the library MIT-licensed
permanently (see https://xyflow.com/open-source).

The MIT License requires only that the copyright notice and permission
notice are included in copies of the software. ChainSolve satisfies
this by listing @xyflow/react in `THIRD_PARTY_NOTICES.md` with its
license type and copyright holder.

## Attribution watermark

React Flow renders a small attribution watermark in the bottom-right
corner of the canvas by default. ChainSolve hides this watermark using
the built-in `proOptions={{ hideAttribution: true }}` configuration in
`src/components/canvas/CanvasArea.tsx`.

**This is permitted under the MIT License.** The `proOptions` property
is part of the free, MIT-licensed package. Despite the name, it is not
a paid "Pro" feature. The xyflow maintainer confirmed in GitHub
Discussion #3397 that no payment or subscription is required for
commercial use, and there are no locked premium features in the library.

### Why we hide the watermark

ChainSolve is a commercial product where visual cleanliness of the
canvas matters for the user experience. The watermark is hidden to
maintain a polished UI. This is a common practice among commercial
React Flow users.

### Supporting the project

While not legally required, we acknowledge the value of the xyflow
project and recommend considering a Pro subscription
(https://reactflow.dev/pro/pricing) to support continued development
if the project budget allows. This is optional and does not affect
our licensing compliance.

## Pro features assessment

xyflow uses a "thin-crust open-core" model:

- **MIT-licensed (free):** The full React Flow library, all components,
  hooks, types, documentation, and community Discord support.
- **Pro subscription (paid):** Access to advanced code examples,
  prioritized bug fixes, and email support. No library features are
  locked behind the subscription.

ChainSolve uses only the MIT-licensed library. No Pro subscription
features are used or required.

## Usage scope

ChainSolve imports the following from @xyflow/react:

- **Components:** ReactFlow, Background, MiniMap, Handle, BaseEdge,
  EdgeLabelRenderer, ReactFlowProvider
- **Hooks:** useReactFlow, useNodesState, useEdgesState, useNodes,
  useEdges, useViewport, useOnViewportChange
- **Types:** Node, Edge, Connection, NodeProps, EdgeProps, Position,
  BackgroundVariant, IsValidConnection
- **Utilities:** addEdge, getBezierPath
- **CSS:** @xyflow/react/dist/style.css (with custom overrides in
  src/index.css)

All of these are part of the MIT-licensed public API.

## Compliance checklist

- [x] License is MIT (permissive, commercial-friendly)
- [x] Copyright notice preserved in THIRD_PARTY_NOTICES.md
- [x] No Pro/paid features used
- [x] Attribution hiding uses documented, free configuration option
- [x] No custom license agreement or subscription required
- [x] No source code modifications to @xyflow/react (used as-is)

## Conclusion

ChainSolve's use of @xyflow/react is fully compliant with the MIT
License. No licensing breach exists. The attribution watermark is hidden
using a documented, free configuration option. No paid features or
subscriptions are required for our usage.

---

Last reviewed: 2026-03-03
Reviewed by: Engineering team (automated audit)
