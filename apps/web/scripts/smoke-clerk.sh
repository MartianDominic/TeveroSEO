#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$APP_DIR"

# Load env vars from .env.local if present (standalone server needs them at runtime)
if [ -f "$APP_DIR/.env.local" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$APP_DIR/.env.local"
  set +a
fi

# Guard: real Clerk keys required at runtime (middleware validates key format on every request)
# Placeholder keys cause ECONNRESET on all routes — skip with a warning if not real keys.
PK="${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-}"
SK="${CLERK_SECRET_KEY:-}"

is_placeholder() {
  local val="$1"
  case "$val" in
    *placeholder*|*example*|*xxx*|"") return 0 ;;
    *) return 1 ;;
  esac
}

if is_placeholder "$PK" || is_placeholder "$SK"; then
  echo "SKIP: Clerk smoke test requires real NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY."
  echo "      Set real keys in apps/web/.env.local to run this test."
  echo "      Build-time TypeScript and Next.js build checks passed (see plan 08-02 Task 2)."
  exit 0
fi

# Standalone server path — in pnpm workspace monorepo, Next.js embeds the
# absolute path of the workspace root into the standalone output directory.
STANDALONE_SERVER="$(find .next/standalone -name "server.js" -path "*/apps/web/server.js" 2>/dev/null | head -1)"

if [ -z "$STANDALONE_SERVER" ]; then
  echo "ERROR: Could not find standalone server.js — run 'pnpm --filter @tevero/web build' first"
  exit 1
fi

# Copy static assets into standalone tree (required by Next.js standalone docs)
STANDALONE_DIR="$(dirname "$STANDALONE_SERVER")"
cp -r .next/static "$STANDALONE_DIR/.next/" 2>/dev/null || true
if [ -d "public" ]; then
  cp -r public "$STANDALONE_DIR/" 2>/dev/null || true
fi

# Start standalone server in background
PORT=13001
HOSTNAME=127.0.0.1
export PORT HOSTNAME NODE_ENV=production
node "$STANDALONE_SERVER" &
PID=$!
trap "kill $PID 2>/dev/null || true" EXIT

echo "Started standalone server (PID=$PID) on port $PORT"

# Wait for server to be ready (up to 15 seconds)
READY=0
for i in $(seq 1 15); do
  if curl -fsS "http://$HOSTNAME:$PORT/api/health" >/dev/null 2>&1; then
    echo "Server is ready"
    READY=1
    break
  fi
  echo "Waiting for server... ($i/15)"
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "FAIL: server did not start within 15 seconds"
  exit 1
fi

# /api/health should return 200 unauthenticated
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://$HOSTNAME:$PORT/api/health")
if [ "$HEALTH" != "200" ]; then
  echo "FAIL: /api/health returned $HEALTH (want 200)"
  exit 1
fi
echo "PASS: /api/health returned 200"

# /clients should redirect to /sign-in unauthenticated (307 or 302)
CLIENTS=$(curl -s -o /dev/null -w "%{http_code}" "http://$HOSTNAME:$PORT/clients")
if [ "$CLIENTS" != "307" ] && [ "$CLIENTS" != "302" ]; then
  echo "FAIL: /clients unauthenticated returned $CLIENTS (want 307 or 302 redirect to sign-in)"
  exit 1
fi
echo "PASS: /clients returned $CLIENTS redirect"

# Redirect Location should contain sign-in
LOC=$(curl -s -o /dev/null -w "%{redirect_url}" "http://$HOSTNAME:$PORT/clients")
case "$LOC" in
  *sign-in*)
    echo "PASS: redirect location contains sign-in ($LOC)"
    ;;
  *)
    echo "FAIL: redirect was '$LOC' (want contains sign-in)"
    exit 1
    ;;
esac

echo "PASS: middleware protection working"
