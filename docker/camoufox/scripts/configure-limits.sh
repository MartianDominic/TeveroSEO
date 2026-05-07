#!/bin/bash
# TeveroSEO Camoufox - Configure System Limits
# Run as root. REQUIRES REBOOT to fully apply.

set -e

echo "========================================"
echo "Configuring system limits for browser pool"
echo "========================================"

# Create limits configuration for file descriptors and processes
cat > /etc/security/limits.d/90-tevero-camoufox.conf << 'EOF'
# TeveroSEO Camoufox Browser Pool Limits
# Required for 60+ concurrent browser instances

# File descriptor limits (browsers need many FDs)
* soft nofile 65535
* hard nofile 65535
root soft nofile 65535
root hard nofile 65535

# Process limits
* soft nproc 65535
* hard nproc 65535
root soft nproc 65535
root hard nproc 65535

# Memory lock (for shared memory)
* soft memlock unlimited
* hard memlock unlimited
root soft memlock unlimited
root hard memlock unlimited
EOF

echo "Created /etc/security/limits.d/90-tevero-camoufox.conf"

# Configure sysctl for network and file operations
cat > /etc/sysctl.d/90-tevero-camoufox.conf << 'EOF'
# TeveroSEO Camoufox Network Tuning

# Maximum file handles for the system
fs.file-max = 2097152

# inotify limits for file watchers
fs.inotify.max_user_watches = 524288
fs.inotify.max_user_instances = 8192

# TCP connection tuning for many concurrent requests
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 4096
net.core.netdev_max_backlog = 5000

# Faster TCP connection recycling
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_tw_reuse = 1

# More ephemeral ports for outgoing connections
net.ipv4.ip_local_port_range = 1024 65535

# Shared memory for IPC (required for browser instances)
kernel.shmmax = 4294967296
kernel.shmall = 4294967296
EOF

echo "Created /etc/sysctl.d/90-tevero-camoufox.conf"

# Apply sysctl changes immediately
sysctl -p /etc/sysctl.d/90-tevero-camoufox.conf

# Ensure PAM loads limits
if ! grep -q "pam_limits.so" /etc/pam.d/common-session 2>/dev/null; then
    echo "session required pam_limits.so" >> /etc/pam.d/common-session
fi

if ! grep -q "pam_limits.so" /etc/pam.d/common-session-noninteractive 2>/dev/null; then
    echo "session required pam_limits.so" >> /etc/pam.d/common-session-noninteractive
fi

echo ""
echo "System limits configured."
echo ""
echo "IMPORTANT: You must REBOOT for all changes to take effect."
echo "Run: sudo reboot"
