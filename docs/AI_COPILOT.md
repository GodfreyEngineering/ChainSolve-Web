# AI Copilot (AI-1 / AI-2 / AI-3)

ChainSolve Copilot is an AI-assisted graph building feature available to **Pro** and **Enterprise** users.

## Modes

| Mode    | Behaviour                                                         | Auto-apply |
|---------|------------------------------------------------------------------|------------|
| Plan    | Proposes steps only, no graph changes.                            | N/A        |
| Edit    | Proposes a patch (ops list); auto-applies LOW risk only.          | LOW        |
| Bypass  | Enterprise only — auto-applies LOW + MEDIUM if org policy allows. | LOW+MED*   |

\* HIGH risk always requires explicit user confirmation, even in Bypass mode.

## Scopes

- **Active sheet** — AI considers all nodes/edges on the current canvas.
- **Selected nodes** — AI considers only selected nodes + their 1-hop neighbours.

## Workflow Tasks (AI-3)

| Task             | Description                                                      | Mode          |
|------------------|------------------------------------------------------------------|---------------|
| Chat             | General-purpose conversation and graph building                  | User-selected |
| Fix Graph        | Propose patches to fix diagnostics/health issues                 | Edit          |
| Explain Node     | Read-only explanation of a node's role, bindings, and upstream   | Plan (forced) |
| Generate Template| Generate a reusable template from selection                      | Plan (forced) |
| Generate Theme   | Generate a CSS theme from description                            | Plan          |

### Quick Action Entrypoints

- **Graph Health panel** → "Fix with Copilot" / "Explain issues"
- **Node context menu** → "Explain this node"
- **Canvas context menu** → "Insert blocks from prompt…"

## Enterprise Controls (AI-2)

| Control                  | Description                                     | Default |
|--------------------------|-------------------------------------------------|---------|
| `ai_enabled`             | Master toggle — disable Copilot for the org     | true    |
| `ai_allowed_modes`       | Restrict available modes (plan/edit/bypass)      | all     |
| `allow_bypass`           | Allow Bypass mode                                | false   |
| `monthly_token_limit_per_seat` | Per-seat monthly token budget              | 200,000 |

Enterprise admins (org owners) configure these in `ai_org_policies`.

## Architecture

```
Browser ──POST /api/ai──> Cloudflare Pages Function ──> OpenAI Responses API
                                │
                                ├── Auth: Supabase JWT verification
                                ├── Plan check: reject Free/past_due/canceled
                                ├── Enterprise policy: ai_enabled, allowed_modes
                                ├── Quota: monthly token budget enforcement
                                ├── Task routing: task-specific system prompts
                                ├── Context minimizer: bounded subgraph + diagnostics
                                └── Response: validated JSON patch ops
```

- The AI key (`OPEN_AI_API_KEY`) is a Cloudflare Pages secret — never exposed to the browser.
- All OpenAI calls use `store: false` to disable response storage on OpenAI's side.
- No prompts or responses are stored in our database.

## Context Minimizer

The context minimizer (`contextMinimizer.ts`) builds a bounded context pack:

- Selects nodes within `depth` hops of selected nodes (default: 1)
- Caps at `maxNodes` (default: 50)
- Strips to minimal fields: id, blockType, label, inputBindings, value
- Optionally includes diagnostics for fix_graph tasks
- `stripLabels` option removes user-entered labels for privacy

## Patch Format

The AI returns JSON with this structure:

```json
{
  "mode": "edit",
  "task": "chat",
  "message": "Added a force × distance power calculation",
  "assumptions": ["Using SI units"],
  "risk": { "level": "low", "reasons": ["3 operations"] },
  "patch": {
    "ops": [
      { "op": "addNode", "node": { "id": "ai_node_1", "blockType": "number", ... } },
      { "op": "addEdge", "edge": { "id": "ai_edge_1", "source": "ai_node_1", ... } },
      { "op": "updateNodeData", "nodeId": "existing_id", "data": { ... } },
      { "op": "removeNode", "nodeId": "..." },
      { "op": "removeEdge", "edgeId": "..." }
    ]
  }
}
```

For explain_node task, the response includes an `explanation` object:

```json
{
  "explanation": {
    "block": { "type": "add", "whatItDoes": "Adds two numbers", "inputs": ["a", "b"], "outputs": ["out"] },
    "bindings": [{ "portId": "a", "source": "edge", "value": 10 }],
    "upstream": [{ "nodeId": "n1", "label": "Force", "blockType": "number" }],
    "diagnostics": [{ "level": "warn", "code": "orphan", "message": "..." }]
  }
}
```

## Risk Scoring

Deterministic, client-side risk assessment:

| Level  | Criteria                                                           |
|--------|--------------------------------------------------------------------|
| LOW    | ≤3 node/edge adds, simple bindings/value edits                     |
| MEDIUM | >10 ops, variable updates, >20 node adds                          |
| HIGH   | >5 removals, any removeNode, variable deletions, large rewires     |

## Token Quotas

| Plan       | Monthly limit          |
|------------|------------------------|
| Pro        | 200,000 tokens/month   |
| Enterprise | Org policy (default 1M)|

Usage is tracked per-user per-month in `ai_usage_monthly`. The response includes `tokensRemaining` so the UI can display a budget bar.

## Limitations

- Maximum prompt length: 4,000 characters.
- Only block types from the ChainSolve catalog are supported — AI cannot invent new types.
- Canvas context is truncated to 50 nodes/edges to stay within token budgets.
- Plan mode does not apply changes — it only describes what would happen.
- Explain task is read-only and never produces patch ops.
