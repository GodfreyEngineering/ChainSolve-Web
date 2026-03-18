# ── Stage 1: Build the frontend ──────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder

WORKDIR /app

# Install Rust + wasm-pack for WASM build
RUN apk add --no-cache curl build-base openssl-dev pkgconfig
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal --target wasm32-unknown-unknown
ENV PATH="/root/.cargo/bin:${PATH}"
RUN curl -sSfL https://github.com/rustwasm/wasm-pack/releases/download/v0.14.0/wasm-pack-v0.14.0-x86_64-unknown-linux-musl.tar.gz \
    | tar xz -C /usr/local/bin --strip-components=1 wasm-pack-v0.14.0-x86_64-unknown-linux-musl/wasm-pack

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
# Remove src-tauri from workspace for this build (no Tauri deps in container)
RUN sed -i 's|, "src-tauri"||g' Cargo.toml

# Build WASM
RUN wasm-pack build crates/engine-wasm --target web --release

# Install npm dependencies
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source
COPY . .

# Build frontend (Vite + TypeScript)
ARG VITE_SUPABASE_URL=http://localhost:8000
ARG VITE_SUPABASE_ANON_KEY=
RUN npx tsc -b && npx vite build

# ── Stage 2: Native compute engine server ────────────────────────────────────
FROM rust:1.82-alpine AS engine-builder

WORKDIR /app
RUN apk add --no-cache musl-dev openssl-dev pkgconfig

COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
# Remove src-tauri which depends on Tauri
RUN sed -i 's|, "src-tauri"||g' Cargo.toml

# Build the native HTTP server binary (serve.rs)
RUN cargo build -p engine-core --bin serve --release

# ── Stage 3: Final runtime image ─────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Install Node for serving static + edge functions locally (optional)
RUN apk add --no-cache ca-certificates tzdata

# Copy compiled frontend
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copy native engine server binary
COPY --from=engine-builder /app/target/release/serve /usr/local/bin/chainsolve-engine

# Copy nginx config
COPY deploy/docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY deploy/docker/nginx/default.conf /etc/nginx/conf.d/default.conf

# Startup script
COPY deploy/docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80
EXPOSE 3099

ENTRYPOINT ["/entrypoint.sh"]
