#!/bin/bash
# TeveroSEO Camoufox - Full Installation Script
# Run as root on a fresh Contabo VPS (Ubuntu 22.04)
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/.../install-full.sh | bash
#   OR
#   ./install-full.sh

set -e

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAMOUFOX_DIR="/opt/tevero/camoufox"

echo "=========================================="
echo "TeveroSEO Camoufox Full Installation"
echo "=========================================="
echo ""
echo "Target: Contabo VPS - 8 vCPU, 24GB RAM"
echo "Date: $(date)"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "ERROR: This script must be run as root"
    exit 1
fi

# Check system requirements
echo "[0/9] Checking system requirements..."
TOTAL_RAM_GB=$(free -g | awk '/^Mem:/{print $2}')
CPU_CORES=$(nproc)

echo "  CPU Cores: $CPU_CORES"
echo "  Total RAM: ${TOTAL_RAM_GB}GB"

if [ $TOTAL_RAM_GB -lt 16 ]; then
    echo "WARNING: Less than 16GB RAM. Pool size will be reduced."
fi

if [ $CPU_CORES -lt 4 ]; then
    echo "WARNING: Less than 4 CPU cores. Performance may be limited."
fi

echo ""

# Step 1: Install system dependencies
echo "[1/9] Installing system dependencies..."
"$SCRIPTS_DIR/install-dependencies.sh"
echo ""

# Step 2: Configure limits
echo "[2/9] Configuring system limits..."
"$SCRIPTS_DIR/configure-limits.sh"
echo ""

# Step 3: Setup Xvfb
echo "[3/9] Setting up virtual display..."
"$SCRIPTS_DIR/setup-xvfb.sh"
echo ""

# Step 4: Configure cgroups
echo "[4/9] Configuring cgroups..."
"$SCRIPTS_DIR/configure-cgroups.sh"
echo ""

# Step 5: Create application directory
echo "[5/9] Setting up application directory..."
mkdir -p "$CAMOUFOX_DIR"
cd "$CAMOUFOX_DIR"

# Step 6: Create package.json
echo "[6/9] Creating package.json..."
cat > package.json << 'EOF'
{
  "name": "tevero-camoufox-pool",
  "version": "1.0.0",
  "description": "TeveroSEO Camoufox Browser Pool",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node --expose-gc --max-old-space-size=4096 dist/index.js",
    "dev": "tsx watch src/index.ts"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Install dependencies
echo "[7/9] Installing npm dependencies..."
npm install camoufox-js playwright-core bullmq ioredis prom-client
npm install -D typescript @types/node tsx

# Create tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# Create ecosystem.config.cjs
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [
    {
      name: 'camoufox-pool',
      script: 'dist/index.js',
      cwd: '/opt/tevero/camoufox',

      node_args: '--max-old-space-size=4096 --expose-gc --enable-source-maps',

      env_production: {
        NODE_ENV: 'production',
        DISPLAY: ':99',
      },

      instances: 1,
      exec_mode: 'fork',

      wait_ready: true,
      listen_timeout: 30000,

      autorestart: true,
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 5000,

      max_memory_restart: '3500M',

      log_file: '/var/log/tevero/camoufox-pool.log',
      error_file: '/var/log/tevero/camoufox-error.log',
      out_file: '/var/log/tevero/camoufox-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
      merge_logs: true,

      kill_timeout: 30000,
      shutdown_with_message: true,

      watch: false,
    }
  ],
};
EOF

# Create .env.example
cat > .env.example << 'EOF'
# Display configuration
DISPLAY=:99

# Node.js optimization
NODE_ENV=production

# Camoufox pool configuration
CAMOUFOX_MIN_INSTANCES=20
CAMOUFOX_MAX_INSTANCES=60
CAMOUFOX_MAX_PAGES_PER_INSTANCE=5
CAMOUFOX_MAX_REQUESTS_PER_INSTANCE=100
CAMOUFOX_MAX_AGE_MINUTES=30
CAMOUFOX_MAX_MEMORY_MB=400

# Geonode proxy credentials
GEONODE_HOST=proxy.geonode.io
GEONODE_PORT_ROTATING=9000
GEONODE_PORT_STICKY=10000
GEONODE_USERNAME=geonode_y9ZVNlVjdE-type-residential
GEONODE_PASSWORD=YOUR_PASSWORD_HERE

# Redis connection
REDIS_URL=redis://localhost:6379

# Health check configuration
HEALTH_CHECK_PORT=3150
METRICS_PORT=3151

# Logging
LOG_LEVEL=info
EOF

echo "  Created package.json, tsconfig.json, ecosystem.config.cjs, .env.example"

# Step 8: Pre-download Camoufox binary
echo "[8/9] Pre-downloading Camoufox binary..."
export DISPLAY=:99
node -e "
const { Camoufox } = require('camoufox-js');
(async () => {
  try {
    console.log('  Starting browser launch test...');
    const browser = await Camoufox({ headless: 'virtual' });
    console.log('  Binary downloaded and browser launched successfully');
    await browser.close();
    console.log('  Browser closed cleanly');
    process.exit(0);
  } catch (e) {
    console.error('  ERROR:', e.message);
    process.exit(1);
  }
})();
"
echo ""

# Step 9: Setup log rotation
echo "[9/9] Setting up log rotation..."
cat > /etc/logrotate.d/tevero-camoufox << 'EOF'
/var/log/tevero/camoufox-*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
    postrotate
        pm2 reloadLogs > /dev/null 2>&1 || true
    endscript
}
EOF

echo ""
echo "=========================================="
echo "Installation Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Configure environment variables:"
echo "   cp $CAMOUFOX_DIR/.env.example $CAMOUFOX_DIR/.env"
echo "   nano $CAMOUFOX_DIR/.env"
echo ""
echo "2. Create your entry point (src/index.ts) with pool logic"
echo ""
echo "3. Build and start:"
echo "   cd $CAMOUFOX_DIR"
echo "   npm run build"
echo "   pm2 start ecosystem.config.cjs --env production"
echo ""
echo "4. IMPORTANT: Reboot to apply all system limits:"
echo "   sudo reboot"
echo ""
echo "After reboot:"
echo "   - Health check: curl http://localhost:3150/health"
echo "   - Metrics: curl http://localhost:3151/metrics"
echo "   - Logs: pm2 logs camoufox-pool"
echo "   - Monitor: pm2 monit"
