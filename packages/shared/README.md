# @chainsolveweb/shared

Platform-agnostic shared code for all ChainSolve targets (web, desktop,
mobile).

## Status

**Placeholder** -- this package is not yet a separate build artifact. It
exists to document the intended module boundaries for a future monorepo
migration.

## Candidates for extraction

The following `src/` modules are platform-agnostic and can be moved here
when the project adopts a workspace/monorepo tool (Turborepo, Nx, or plain
npm workspaces):

| Module | Description |
| --- | --- |
| `src/lib/entitlements.ts` | Plan entitlements and feature gates |
| `src/lib/platform.ts` | Platform detection flags |
| `src/lib/validateProjectName.ts` | Input validators |
| `src/lib/validateVariables.ts` | Variable name validation |
| `src/lib/orgPolicyEnforcement.ts` | Org policy override logic |
| `src/lib/formatValue.ts` | Numeric display formatting |
| `src/blocks/` | Block definitions and registry |
| `src/units/` | Unit conversion tables |
| `src/i18n/` | Translation bundles |
| `src/engine/` | WASM engine bridge |

## Rules

1. No DOM or browser-only APIs (use `src/lib/platform.ts` flags to branch).
2. No Supabase, Stripe, or other SaaS SDK imports.
3. Pure functions preferred; side effects must be explicit and documented.
