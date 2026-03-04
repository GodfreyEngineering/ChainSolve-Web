# Dependency Update Policy

This document explains the Dependabot configuration in
`.github/dependabot.yml`.

## Goals

1. **Reduce PR noise** — batch low-risk updates into single grouped PRs.
2. **Surface breaking changes** — major npm bumps get individual PRs so they
   can be reviewed and tested in isolation.
3. **Keep CI green** — weekly cadence avoids mid-sprint disruptions.

## Grouping strategy

| Ecosystem | Group | What's included | PRs / week |
|---|---|---|---|
| npm | `npm-patch-minor` | All minor + patch version updates | 1 grouped PR |
| npm | (ungrouped) | Major version updates | Up to 5 individual PRs |
| Cargo | `cargo-all` | All major, minor, and patch updates | 1 grouped PR |
| GitHub Actions | `gha-all` | All action version updates | 1 grouped PR |

## Schedule

All ecosystems are checked **weekly on Monday**.  This gives the team a full
work week to review and merge dependency PRs before the next batch arrives.

## Review

All dependency PRs are assigned to `@GodfreyEngineering`.

## When to override

- **Security advisories**: Dependabot security updates are separate from
  version updates and are created immediately regardless of schedule.
- **Urgent patches**: Manually run `npm update <pkg>` or `cargo update -p
  <crate>` and commit directly if a fix cannot wait for the next Monday.
