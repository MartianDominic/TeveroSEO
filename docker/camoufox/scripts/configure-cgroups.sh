#!/bin/bash
# TeveroSEO Camoufox - Configure cgroups v2 Resource Limits
# Run as root

set -e

echo "========================================"
echo "Configuring cgroups v2 for Camoufox"
echo "========================================"

# Check if cgroups v2 is active
if [ ! -f /sys/fs/cgroup/cgroup.controllers ]; then
    echo "WARNING: cgroups v2 not detected."
    echo "Memory limits may not work correctly."
    echo ""
    echo "To enable cgroups v2, add to GRUB_CMDLINE_LINUX_DEFAULT:"
    echo "  systemd.unified_cgroup_hierarchy=1"
    echo "Then run: update-grub && reboot"
    echo ""
fi

# Create systemd slice for camoufox with memory/CPU limits
cat > /etc/systemd/system/camoufox.slice << 'EOF'
[Unit]
Description=TeveroSEO Camoufox Browser Pool Resource Slice
Before=slices.target

[Slice]
# Memory limit: 16GB (leave 8GB for other services)
MemoryMax=16G
MemoryHigh=14G

# Swap limit (prevent swapping which kills browser perf)
MemorySwapMax=2G

# CPU shares (relative weight)
CPUWeight=100

# CPU quota: 600% of one CPU (6 cores worth max)
# Leaves 2 cores for other services
CPUQuota=600%

# IO weight
IOWeight=100

# Process limits
TasksMax=4096
EOF

echo "Created /etc/systemd/system/camoufox.slice"

# Create drop-in for PM2 camoufox service
mkdir -p /etc/systemd/system/pm2-root.service.d/
cat > /etc/systemd/system/pm2-root.service.d/camoufox-override.conf << 'EOF'
[Service]
# Resource limits for all PM2 processes
LimitNOFILE=65535
LimitNPROC=65535
LimitMEMLOCK=infinity

# Environment
Environment=DISPLAY=:99
Environment=NODE_ENV=production

# cgroup slice (applies memory/CPU limits)
Slice=camoufox.slice

# Graceful shutdown timeout (allow browsers to close)
TimeoutStopSec=60
EOF

echo "Created PM2 service override"

# Reload systemd
systemctl daemon-reload

echo ""
echo "cgroups configuration complete."
echo ""
echo "Limits applied:"
echo "  - Memory: 16GB max (14GB high watermark)"
echo "  - CPU: 600% (6 cores)"
echo "  - Processes: 4096 max"
echo ""
echo "To verify after starting PM2:"
echo "  systemctl show camoufox.slice | grep -E '^(Memory|CPU|Tasks)'"
