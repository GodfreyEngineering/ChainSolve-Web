# AI Privacy Policy

This document describes how ChainSolve handles data in the AI Copilot feature.

## What is sent to OpenAI

When you use the AI Copilot, the following is sent to OpenAI's API:

1. **Your prompt** — the natural language instruction you type.
2. **Canvas context** — a compact summary of your current canvas nodes and edges (block types, labels, values, connections). Limited to 50 nodes/edges.
3. **System instructions** — a fixed prompt that tells the AI how to generate valid ChainSolve graph operations.

## What is NOT sent

- Your email address, user ID, or any personal information.
- Your full project history or other canvases.
- Any billing or subscription details.

## Response storage

- **OpenAI side**: All requests are made with `store: false`, which means OpenAI does not retain your inputs or outputs for model training or improvement.
- **ChainSolve side**: We do NOT store your prompts or AI responses in our database. We only store anonymised usage metadata:
  - Timestamp, mode (plan/edit/bypass), model used
  - Token counts (input/output)
  - Number of operations proposed and risk level
  - OpenAI response ID (for debugging, not content)

## Data retention

- Usage counters (`ai_usage_monthly`) are per-month and indefinitely retained for billing purposes.
- Request metadata (`ai_request_log`) is retained for operational monitoring.
- No raw content is ever persisted.

## OpenAI's data usage policy

By default, OpenAI does not use API data for training models. The `store: false` flag provides additional assurance that responses are not stored.

For enterprise customers requiring additional guarantees:

- **Zero Data Retention (ZDR)**: OpenAI offers ZDR agreements where inputs and outputs are not stored at all, even for abuse monitoring. This is available as a contractual option.
- **Modified Abuse Monitoring**: Enterprise API customers can request modified abuse monitoring that limits human review. Contact OpenAI for details.

> Note: ChainSolve does not currently have a ZDR agreement with OpenAI. Enterprise customers with strict data requirements should contact us to discuss options.

## Server-side proxy

All AI traffic is routed through our Cloudflare Pages Function (`POST /api/ai`). The browser never communicates directly with OpenAI. The API key is stored as a Cloudflare Pages secret and is never exposed to the client.

## Local development

For local development, set `OPEN_AI_API_KEY` in a `.dev.vars` file (gitignored) in the project root. This file is used by Cloudflare's Wrangler CLI during local development.

## Questions

Contact support at info@chainsolve.co.uk for privacy-related questions about the AI Copilot.
