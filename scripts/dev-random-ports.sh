#!/bin/bash
# TeveroSEO Development Server with Randomized Ports
# Avoids conflicts when running multiple dev instances
#
# Usage: ./scripts/dev-random-ports.sh [service]
#   service: web | api | all (default: web)

set -e

# Generate random 5-digit ports (10000-65000 range)
random_port() {
  shuf -i 10000-65000 -n 1
}

# Check if port is available
port_available() {
  ! ss -tlnp 2>/dev/null | grep -q ":$1 "
}

# Find available random port
find_available_port() {
  local port
  for _ in {1..10}; do
    port=$(random_port)
    if port_available "$port"; then
      echo "$port"
      return 0
    fi
  done
  echo "ERROR: Could not find available port after 10 attempts" >&2
  return 1
}

SERVICE="${1:-web}"

case "$SERVICE" in
  web)
    PORT=$(find_available_port)
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Starting apps/web on port $PORT"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  URL: http://localhost:$PORT"
    echo ""
    cd apps/web && pnpm next dev -p "$PORT"
    ;;

  api)
    PORT=$(find_available_port)
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Starting open-seo-main on port $PORT"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  URL: http://localhost:$PORT"
    echo ""
    cd open-seo-main && PORT="$PORT" pnpm dev
    ;;

  all)
    WEB_PORT=$(find_available_port)
    API_PORT=$(find_available_port)
    WS_PORT=$(find_available_port)

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  TeveroSEO Dev Environment"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  apps/web:      http://localhost:$WEB_PORT"
    echo "  open-seo-main: http://localhost:$API_PORT"
    echo "  WebSocket:     ws://localhost:$WS_PORT"
    echo ""
    echo "  Update your apps/web/.env.local:"
    echo "    OPEN_SEO_URL=http://localhost:$API_PORT"
    echo "    NEXT_PUBLIC_METRICS_WS_URL=ws://localhost:$WS_PORT"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Starting services in background..."
    echo "(Press Ctrl+C to stop all)"
    echo ""

    # Start API in background
    (cd open-seo-main && PORT="$API_PORT" WS_PORT="$WS_PORT" pnpm dev) &
    API_PID=$!

    # Wait for API to start
    sleep 3

    # Start web with updated env
    (cd apps/web && OPEN_SEO_URL="http://localhost:$API_PORT" NEXT_PUBLIC_METRICS_WS_URL="ws://localhost:$WS_PORT" pnpm next dev -p "$WEB_PORT") &
    WEB_PID=$!

    # Trap Ctrl+C to kill both
    trap "kill $API_PID $WEB_PID 2>/dev/null; exit 0" INT TERM

    wait
    ;;

  *)
    echo "Usage: $0 [web|api|all]"
    echo ""
    echo "  web  - Start apps/web on random port (default)"
    echo "  api  - Start open-seo-main on random port"
    echo "  all  - Start both with coordinated random ports"
    exit 1
    ;;
esac
