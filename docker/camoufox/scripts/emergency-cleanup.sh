#!/bin/bash
# TeveroSEO Camoufox - Emergency Cleanup Script
# Kills all browser processes and restarts the pool
#
# USE WITH CAUTION: This forcefully terminates all browser instances

set -e

echo "=========================================="
echo "EMERGENCY: Stopping all browser processes"
echo "=========================================="
echo ""

# Stop PM2 process first
echo "Stopping camoufox-pool..."
pm2 stop camoufox-pool 2>/dev/null || echo "  (already stopped)"

# Kill all Firefox/Camoufox processes
echo ""
echo "Killing browser processes..."

FIREFOX_COUNT=$(pgrep -c -f "firefox" 2>/dev/null || echo "0")
CAMOUFOX_COUNT=$(pgrep -c -f "camoufox" 2>/dev/null || echo "0")

echo "  Firefox processes: $FIREFOX_COUNT"
echo "  Camoufox processes: $CAMOUFOX_COUNT"

pkill -9 -f "firefox" 2>/dev/null || true
pkill -9 -f "camoufox" 2>/dev/null || true

# Wait for processes to die
echo ""
echo "Waiting for processes to terminate..."
sleep 5

# Verify cleanup
REMAINING=$(pgrep -c -f "firefox\|camoufox" 2>/dev/null || echo "0")
if [ "$REMAINING" != "0" ]; then
    echo "WARNING: $REMAINING browser processes still running"
    echo "Processes:"
    pgrep -af "firefox\|camoufox" || true
    echo ""
    echo "Attempting SIGKILL..."
    pkill -9 -f "firefox\|camoufox" 2>/dev/null || true
    sleep 3
else
    echo "All browser processes terminated."
fi

# Clear shared memory segments (IPC)
echo ""
echo "Clearing shared memory..."
ipcrm --all 2>/dev/null || true

# Clear /tmp files left by browsers
echo "Cleaning temporary files..."
rm -rf /tmp/.X*-lock 2>/dev/null || true
rm -rf /tmp/rust_mozprofile* 2>/dev/null || true
rm -rf /tmp/mozilla* 2>/dev/null || true

# Verify Xvfb is still running
echo ""
echo "Checking Xvfb..."
if systemctl is-active --quiet xvfb; then
    echo "  Xvfb is running."
else
    echo "  Restarting Xvfb..."
    systemctl restart xvfb
    sleep 2
fi

# Restart the pool
echo ""
echo "Restarting camoufox-pool..."
pm2 start camoufox-pool

# Wait for startup
sleep 10

# Check health
echo ""
echo "Checking health..."
response=$(curl -sf --max-time 10 "http://localhost:3150/health" 2>/dev/null || echo '{}')
status=$(echo "$response" | jq -r '.status // "unknown"' 2>/dev/null)
instances=$(echo "$response" | jq -r '.pool.totalInstances // 0' 2>/dev/null)

echo ""
echo "=========================================="
echo "Emergency cleanup complete"
echo "=========================================="
echo "Status: $status"
echo "Instances: $instances"
echo ""

if [ "$status" != "healthy" ]; then
    echo "WARNING: Pool may not be healthy yet."
    echo "Monitor with: pm2 logs camoufox-pool"
fi
