#!/bin/bash
# TeveroSEO Camoufox - Setup Xvfb Virtual Display
# Run as root

set -e

echo "========================================"
echo "Setting up Xvfb virtual display"
echo "========================================"

# Create Xvfb systemd service
cat > /etc/systemd/system/xvfb.service << 'EOF'
[Unit]
Description=X Virtual Frame Buffer for Camoufox
After=network.target

[Service]
Type=simple
User=root
Group=root

# Display :99 with 1920x1080 resolution, 24-bit color
ExecStart=/usr/bin/Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset

# Resource limits
LimitNOFILE=65535
MemoryMax=512M

# Restart configuration
Restart=always
RestartSec=5

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=xvfb

[Install]
WantedBy=multi-user.target
EOF

echo "Created /etc/systemd/system/xvfb.service"

# Set DISPLAY environment variable globally
cat > /etc/profile.d/xvfb.sh << 'EOF'
export DISPLAY=:99
EOF
chmod +x /etc/profile.d/xvfb.sh

echo "Created /etc/profile.d/xvfb.sh"

# Reload systemd and start service
systemctl daemon-reload
systemctl enable xvfb
systemctl start xvfb

# Wait for Xvfb to start
sleep 2

# Verify Xvfb is running
if systemctl is-active --quiet xvfb; then
    echo ""
    echo "Xvfb service started successfully."
    echo "Display :99 is available."
else
    echo "ERROR: Xvfb failed to start"
    systemctl status xvfb
    exit 1
fi

# Export for current session
export DISPLAY=:99

echo ""
echo "Virtual display setup complete."
echo "DISPLAY=:99 is now available."
