# ChainSolve — Block Groups & Templates

> W7 feature. Groups are available to all users for viewing; creation/editing/templates require Pro.

---

## What Are Groups?

Groups are visual containers that organize related nodes on the canvas. They use React Flow's native **parent-child** mechanism: a group is a regular node with `type: 'csGroup'` and member nodes store `parentId = groupId`.

**Key properties:**
- Dragging a group drags all its member nodes
- Groups do NOT participate in evaluation (`blockType: '__group__'` is not in `BLOCK_REGISTRY`)
- Member node positions are **relative** to the group node's position
- Groups can be collapsed to a compact box with proxy handles for cross-boundary connections

---

## Creating Groups

1. **Select 2+ nodes** on the canvas
2. Press **Ctrl+G** (or Cmd+G on Mac), or right-click → "Group Selection"
3. A colored container wraps the selected nodes

**Restrictions:**
- Minimum 2 nodes required
- Cannot nest groups (group nodes are excluded from selection)
- Requires `canUseGroups` entitlement (Pro/Trial)

---

## Ungrouping

1. Select the group node
2. Press **Ctrl+Shift+G**, or right-click → "Ungroup"
3. Member nodes return to absolute positions, group node is deleted

---

## Collapse / Expand

When collapsed:
- Member nodes are hidden
- Internal edges (both endpoints inside the group) are hidden
- Cross-boundary edges are rerouted to **proxy handles** on the group node:
  - Inbound edges → proxy target handles (left side)
  - Outbound edges → proxy source handles (right side)
- Original edge routing is stored in `edge.data.__proxyOriginal`

When expanded:
- Members are shown, proxy handles removed
- Original edge routing is restored
- Group auto-resizes to fit members

---

## Group Inspector

When a group node is selected, the Inspector panel shows:
- **Name**: editable text input
- **Color**: 8 preset swatches + custom hex input
- **Notes**: optional textarea for annotations
- **Members**: read-only list of member node labels
- **Actions**: Collapse/Expand toggle, Ungroup button

All fields are read-only for free-tier users.

---

## Templates (Pro)

Templates are saved reusable groups stored in Supabase (`group_templates` table).

### Saving a Template
1. Right-click a group → "Save as template…"
2. Enter a name
3. The template stores the subgraph (nodes + edges) with positions normalized to origin

### Inserting a Template
1. Expand the "Templates" section in the Block Library (left panel)
2. Click a template card to insert it at the viewport center
3. All node/edge IDs are regenerated; a new group wraps the inserted nodes

### Template CRUD
- **Rename**: 3-dot menu → "Rename…"
- **Delete**: 3-dot menu → "Delete"
- Templates use RLS: users can only CRUD their own templates

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+G | Group selected nodes |
| Ctrl+Shift+G | Ungroup selected group |

---

## Schema V3

Groups require `schemaVersion: 3`. Changes from V2:
- Nodes may have `parentId` field pointing to a group node
- Positions with `parentId` are **relative** to the parent (a V2 reader would position them incorrectly)
- V3 readers accept V1/V2/V3 files
- V1/V2 files have no groups and load unchanged

### Canonical Save

The save pipeline calls `getCanonicalSnapshot()` which:
1. Temporarily expands all collapsed groups
2. Restores original (non-proxy) edge routing
3. Preserves `groupCollapsed: true` flag so reload can re-collapse

This ensures saved files always have direct node-to-node edges.

---

## Pro Gating Rules

| Action | Free | Trial/Pro |
|---|---|---|
| View existing groups | Yes | Yes |
| Collapse/expand | Yes | Yes |
| Create groups | No (UpgradeModal) | Yes |
| Edit group properties | No (read-only) | Yes |
| Ungroup | No | Yes |
| Save as template | No | Yes |
| Insert template | No | Yes |

---

## Files

**New:**
- `src/components/canvas/nodes/GroupNode.tsx` — group node renderer
- `src/lib/groups.ts` — group operations (pure functions)
- `src/components/canvas/GroupInspector.tsx` — group property panel
- `src/lib/templates.ts` — template CRUD (Supabase)
- `supabase/migrations/0010_group_templates.sql` — templates table + RLS

**Modified:**
- `src/blocks/types.ts` — NodeKind + NodeData group fields
- `src/components/canvas/CanvasArea.tsx` — register csGroup, group ops, shortcuts
- `src/components/canvas/ContextMenu.tsx` — selection/group menu items
- `src/components/canvas/Inspector.tsx` — delegates to GroupInspector for csGroup
- `src/components/canvas/BlockLibrary.tsx` — templates section
- `src/lib/projects.ts` — schemaVersion 3
