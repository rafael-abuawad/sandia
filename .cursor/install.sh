#!/usr/bin/env bash
# Idempotent bootstrap for the Payrequest Cloud Agent environment.
# Installs JS dependencies and initializes a local (anonymous) Convex backend
# so `NEXT_PUBLIC_CONVEX_URL` is written to .env.local and functions are pushed.
set -euo pipefail

log() { printf '\n[install] %s\n' "$1"; }

cd "$(dirname "$0")/.."

log "Installing dependencies with pnpm (frozen lockfile)"
pnpm install --frozen-lockfile

# Ensure a local env file exists so Next.js and Convex can read config.
if [ ! -f .env.local ]; then
  log "Creating .env.local from .env.example"
  cp .env.example .env.local
fi

# Convex runs in anonymous agent mode: an isolated local backend that needs no
# login and never touches a shared cloud deployment.
export CONVEX_AGENT_MODE=anonymous

# First pass configures the local deployment and writes NEXT_PUBLIC_CONVEX_URL.
# It can fail while pushing functions because the auth config references
# PRIVY_APP_ID, which is not set on a brand-new deployment yet — that is fine.
log "Configuring local Convex deployment"
pnpm exec convex dev --once || true

# The auth config (convex/auth.config.ts) requires PRIVY_APP_ID on the backend.
# Use the real Privy App ID when provided as a secret, otherwise a placeholder
# so functions still deploy and the stack boots for local development.
PRIVY_ID="${NEXT_PUBLIC_PRIVY_APP_ID:-placeholder-privy-app-id}"
log "Setting PRIVY_APP_ID on the local Convex deployment"
pnpm exec convex env set PRIVY_APP_ID "$PRIVY_ID"

# Second pass pushes schema + functions now that the env var is present.
log "Pushing Convex schema and functions"
pnpm exec convex dev --once

log "Done. Start services with the 'convex' and 'next' terminals."
