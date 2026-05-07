#!/bin/bash
# TeveroSEO Camoufox - Graceful Restart Script
# Waits for queue to drain before restarting

set -e

HEALTH_URL="${CAMOUFOX_HEALTH_URL:-http://localhost:3150/health}"
TIMEOUT=300  # 5 minutes max wait
INTERVAL=5

echo "=========================================="
echo "Initiating graceful restart of Camoufox pool"
echo "=========================================="
echo ""

# Check if pool is running
if ! pm2 list | grep -q "camoufox-pool"; then
    echo "ERROR: camoufox-pool is not running"
    exit 1
fi

echo "Waiting for queue to drain (max ${TIMEOUT}s)..."
echo ""

ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    # Get queue status
    response=$(curl -sf --max-time 10 "$HEALTH_URL" 2>/dev/null || echo '{}')

    queue_depth=$(echo "$response" | jq -r '.pool.queueDepth // 999' 2>/dev/null)
    active=$(echo "$response" | jq -r '.pool.activeRequests // 999' 2>/dev/null)

    echo "  Queue: $queue_depth | Active: $active | Elapsed: ${ELAPSED}s"

    if [ "$queue_depth" = "0" ] && [ "$active" = "0" ]; then
        echo ""
        echo "Queue drained. Proceeding with restart."
        break
    fi

    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo ""
    echo "WARNING: Timeout waiting for queue to drain."
    echo "Current state: queue=$queue_depth active=$active"
    read -p "Force restart anyway? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Restart cancelled."
        exit 1
    fi
fi

# Perform graceful reload
echo ""
echo "Reloading camoufox-pool..."
pm2 reload camoufox-pool

# Wait for health check to pass
echo "Waiting for pool to become healthy..."
sleep 10

for i in {1..30}; do
    response=$(curl -sf --max-time 5 "$HEALTH_URL" 2>/dev/null || echo '{}')
    status=$(echo "$response" | jq -r '.status // "unknown"' 2>/dev/null)

    if [ "$status" = "healthy" ]; then
        healthy=$(echo "$response" | jq -r '.pool.healthyInstances' 2>/dev/null)
        total=$(echo "$response" | jq -r '.pool.totalInstances' 2>/dev/null)
        echo ""
        echo "=========================================="
        echo "Restart complete!"
        echo "=========================================="
        echo "Status: $status"
        echo "Instances: $healthy/$total healthy"
        exit 0
    fi

    echo "  Status: $status (waiting...)"
    sleep 2
done

echo ""
echo "WARNING: Pool not healthy after restart."
echo "Check logs: pm2 logs camoufox-pool --lines 50"
exit 1
