# AI Copilot Workflows

This document describes the AI Copilot workflow tasks available in ChainSolve.

## Fix Graph

**Task ID:** `fix_graph`
**Trigger:** Graph Health panel → "Fix with Copilot"

### How it works

1. User sees health warnings (orphans, crossing edges, cycles, etc.)
2. Clicks "Fix with Copilot" button in the Graph Health panel
3. Copilot opens with `fix_graph` task pre-selected
4. Diagnostics are attached to the request context
5. AI proposes patch ops to resolve issues:
   - Missing connections → add edges
   - Disconnected outputs → wire to display nodes
   - Fan-in violations → remove duplicate edges
   - Cycles → explain and suggest edge removal (HIGH risk)
6. User previews and confirms changes

### Guardrails

- No deletions unless explicitly allowed (and always HIGH risk confirmation)
- Deterministic node IDs (`ai_node_1`, etc.)
- Single-canvas scope only

## Explain Node

**Task ID:** `explain_node`
**Trigger:** Node context menu → "Explain this node"

### How it works

1. User right-clicks a node → "Explain this node"
2. Copilot opens in Plan mode with `explain_node` task
3. AI returns a structured explanation:
   - Block type and what it computes
   - Current input bindings (edge, literal, default)
   - Upstream dependency chain
   - Any active diagnostics
4. No graph changes are made (read-only)

### Response Format

The `explanation` field in the response contains:

```json
{
  "block": { "type": "add", "whatItDoes": "...", "inputs": ["a", "b"], "outputs": ["out"] },
  "bindings": [{ "portId": "a", "source": "edge", "value": 10 }],
  "upstream": [{ "nodeId": "n1", "label": "Force", "blockType": "number" }],
  "diagnostics": [{ "level": "warn", "code": "orphan", "message": "..." }]
}
```

## Generate Template

**Task ID:** `generate_template`
**Trigger:** Context menu → "Make reusable template from selection"

### How it works

1. User selects a group of nodes
2. Requests template generation
3. AI analyzes the selection and produces metadata:
   - Template name and description
   - Tags for categorization
4. The selection's nodes and edges become the template payload
5. Pro users can publish templates to Explore

### Requirements

- Pro plan required
- Enterprise users follow org policy for Explore publishing

## Generate Theme

**Task ID:** `generate_theme`
**Trigger:** AI Copilot window → Theme tab

### How it works

1. User describes a theme (e.g., "dark ocean theme with blue accents")
2. AI generates CSS variable values for all 19 theme variables
3. Response includes `theme.variables` map
4. User can preview in Theme Wizard before saving

### CSS Variables

The 19 editable variables span 5 categories:
- Backgrounds: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`
- Text: `--text-primary`, `--text-secondary`
- Accent: `--accent`, `--accent-hover`, `--accent-active`
- Node: `--node-bg`, `--node-border`, `--node-header`, `--node-header-text`, `--node-text`, `--node-port`
- Edge: `--edge-default`, `--edge-selected`, `--edge-animated`, `--handle-bg`, `--handle-border`

## Permissions & Risk Scoring

### Plan Gating

| Plan       | Chat | Fix | Explain | Template | Theme |
|------------|------|-----|---------|----------|-------|
| Free       | ---  | --- | ---     | ---      | ---   |
| Pro        | Yes  | Yes | Yes     | Yes      | Yes   |
| Enterprise | Yes  | Yes | Yes     | Yes      | Yes   |

Enterprise users are additionally governed by org policy (`ai_enabled`, `ai_allowed_modes`).

### Risk Levels

| Level  | Auto-apply (Edit) | Auto-apply (Bypass) | User Confirmation |
|--------|-------------------|---------------------|-------------------|
| LOW    | Yes               | Yes                 | No                |
| MEDIUM | No                | Yes*                | Edit: Yes         |
| HIGH   | No                | No                  | Always            |

\* Only if org policy `allow_bypass` is true.

### Atomic Apply

All patch ops from a single AI action are applied atomically:
- Single undo entry per workflow action
- History snapshot saved before apply
- If any op fails validation, no ops are applied
