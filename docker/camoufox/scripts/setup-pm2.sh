#!/bin/bash
# TeveroSEO Camoufox - Setup PM2 with Systemd Integration
# Run as root

set -e

CAMOUFOX_DIR="/opt/tevero/camoufox"

echo "========================================"
echo "Setting up PM2 for Camoufox"
echo "========================================"

# Create log directory
mkdir -p /var/log/tevero
chmod 755 /var/log/tevero

# Create initial log files
touch /var/log/tevero/camoufox-pool.log
touch /var/log/tevero/camoufox-error.log
touch /var/log/tevero/camoufox-out.log
chmod 640 /var/log/tevero/*.log

echo "Created log directory: /var/log/tevero"

# Setup PM2 startup (systemd)
pm2 startup systemd -u root --hp /root

# Verify ecosystem.config.cjs exists
if [ ! -f "$CAMOUFOX_DIR/ecosystem.config.cjs" ]; then
    echo "ERROR: ecosystem.config.cjs not found at $CAMOUFOX_DIR"
    echo "Please ensure the Camoufox application is installed first."
    exit 1
fi

# Build TypeScript (if applicable)
if [ -f "$CAMOUFOX_DIR/package.json" ]; then
    cd "$CAMOUFOX_DIR"

    # Install dependencies if node_modules missing
    if [ ! -d "node_modules" ]; then
        echo "Installing npm dependencies..."
        npm ci --production
    fi

    # Build if tsconfig exists
    if [ -f "tsconfig.json" ]; then
        echo "Building TypeScript..."
        npm run build
    fi
fi

# Start the application
cd "$CAMOUFOX_DIR"
pm2 start ecosystem.config.cjs --env production

# Wait for startup
sleep 5

# Check if started successfully
if pm2 list | grep -q "camoufox-pool"; then
    echo "PM2 started camoufox-pool successfully"
else
    echo "ERROR: Failed to start camoufox-pool"
    pm2 logs camoufox-pool --lines 50
    exit 1
fi

# Save PM2 process list (for auto-restart on reboot)
pm2 save

# Restart PM2 service to apply cgroup limits
systemctl restart pm2-root

echo ""
echo "PM2 setup complete."
echo ""
echo "Commands:"
echo "  pm2 status              - View status"
echo "  pm2 logs camoufox-pool  - View logs"
echo "  pm2 monit               - Monitor resources"
echo "  pm2 reload camoufox-pool - Graceful restart"
