# Devcontainer / Codespaces Setup (W0)

## Overview

The `.devcontainer/` configuration ensures GitHub Codespaces (and any
devcontainer-compatible tool) provides a complete development environment:
Rust + wasm-pack + Node 20 + all project dependencies — ready to run the full
CI pipeline on first terminal open.

## What's included

| Tool              | Source                                       | Version     |
|-------------------|----------------------------------------------|-------------|
| Rust (cargo/rustc)| `mcr.microsoft.com/devcontainers/rust:1-bookworm` | stable      |
| wasm32 target     | `rust-toolchain.toml` + `post-create.sh`     | (bundled)   |
| wasm-pack         | `post-create.sh` (curl installer)            | latest      |
| Node.js           | `ghcr.io/devcontainers/features/node:1`      | 20.x        |
| Claude Code       | `ghcr.io/anthropics/devcontainer-features/claude-code:latest` | latest |
| VS Code extensions| `devcontainer.json` customizations           | —           |

## Files

```
.devcontainer/
  devcontainer.json    — Image, features, env, VS Code extensions
  post-create.sh       — Installs wasm-pack, wasm32 target, npm ci, WASM dev build
rust-toolchain.toml    — Pins stable channel + wasm32-unknown-unknown target
```

## First use

1. Open the repo in GitHub Codespaces (or `devcontainer open` locally).
2. Wait for `post-create.sh` to finish (~2 min on first create).
3. Verify everything works:

```bash
npm run verify:ci    # Full CI-equivalent (Rust + Node + WASM build)
npm run verify:fast  # Quick checks (no Rust required)
npm run dev          # Start dev server at http://localhost:5173
```

## Manual recovery

If Rust tools are missing (e.g., Codespace was rebuilt without the Rust image):

```bash
# Re-run the post-create setup
bash .devcontainer/post-create.sh
```

Or install manually:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
. "$HOME/.cargo/env"
rustup target add wasm32-unknown-unknown
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
npm ci
npm run wasm:build:dev
```

## How verify-ci.sh finds tools

`verify-ci.sh` sources `$HOME/.cargo/env` at startup so cargo/rustup are
available even in non-interactive shells (e.g., VS Code tasks, CI runners).
If tools are still missing, it prints clear error messages with install
commands and suggests running `bash .devcontainer/post-create.sh`.

## rust-toolchain.toml

```toml
[toolchain]
channel = "stable"
targets = ["wasm32-unknown-unknown"]
```

This file is read by `rustup` automatically. Any `cargo` or `rustc` invocation
will install the specified toolchain and targets on first use.

## Forwarded ports

| Port | Service         |
|------|-----------------|
| 5173 | Vite dev server |
