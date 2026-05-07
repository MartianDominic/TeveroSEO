#!/bin/bash
# TeveroSEO Camoufox - Health Check Script
# Called by monitoring systems (Uptime Kuma, external monitors, systemd)
#
# Exit codes:
#   0 - Healthy
#   1 - Degraded (warning)
#   2 - Unhealthy (critical)

HEALTH_URL="${CAMOUFOX_HEALTH_URL:-http://localhost:3150/health}"
TIMEOUT=10

# Fetch health status
response=$(curl -sf --max-time $TIMEOUT "$HEALTH_URL" 2>/dev/null)
exit_code=$?

# Check if curl succeeded
if [ $exit_code -ne 0 ]; then
    echo "CRITICAL: Health endpoint unreachable at $HEALTH_URL"
    exit 2
fi

# Parse JSON response
status=$(echo "$response" | jq -r '.status' 2>/dev/null)
if [ "$status" = "null" ] || [ -z "$status" ]; then
    echo "CRITICAL: Invalid health response format"
    exit 2
fi

# Extract key metrics
total_instances=$(echo "$response" | jq -r '.pool.totalInstances' 2>/dev/null || echo "0")
healthy_instances=$(echo "$response" | jq -r '.pool.healthyInstances' 2>/dev/null || echo "0")
queue_depth=$(echo "$response" | jq -r '.pool.queueDepth' 2>/dev/null || echo "0")
memory_gb=$(echo "$response" | jq -r '.pool.memoryUsedGB' 2>/dev/null || echo "0")
uptime=$(echo "$response" | jq -r '.uptime' 2>/dev/null || echo "0")

# Convert uptime to human readable
uptime_hours=$((uptime / 3600000))
uptime_mins=$(((uptime % 3600000) / 60000))

# Output and exit based on status
case "$status" in
    "healthy")
        echo "OK: Pool healthy | instances=$healthy_instances/$total_instances queue=$queue_depth memory=${memory_gb}GB uptime=${uptime_hours}h${uptime_mins}m"
        exit 0
        ;;
    "degraded")
        echo "WARNING: Pool degraded | instances=$healthy_instances/$total_instances queue=$queue_depth memory=${memory_gb}GB"
        exit 1
        ;;
    *)
        echo "CRITICAL: Pool unhealthy | instances=$healthy_instances/$total_instances queue=$queue_depth memory=${memory_gb}GB"
        exit 2
        ;;
esac
