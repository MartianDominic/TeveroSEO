# Camoufox VPS Infrastructure Setup Guide

**Date:** 2026-05-07  
**Target:** Contabo VPS - 8 vCPU AMD EPYC, 24GB RAM, Ubuntu 22.04  
**Purpose:** Production-ready Camoufox browser pool deployment

---

## Table of Contents

1. [Prerequisites Check](#1-prerequisites-check)
2. [System Preparation](#2-system-preparation)
3. [Camoufox Installation](#3-camoufox-installation)
4. [Virtual Display Setup](#4-virtual-display-setup)
5. [Resource Limits (cgroups)](#5-resource-limits-cgroups)
6. [PM2 Service Configuration](#6-pm2-service-configuration)
7. [Health Monitoring](#7-health-monitoring)
8. [Log Rotation](#8-log-rotation)
9. [Integration with Existing Services](#9-integration-with-existing-services)
10. [Deployment Scripts](#10-deployment-scripts)

---

## 1. Prerequisites Check

### 1.1 Verify System Resources

```bash
#!/bin/bash
# File: /opt/tevero/scripts/check-prerequisites.sh

echo "=== TeveroSEO Camoufox Prerequisites Check ==="
echo ""

# Check CPU
echo "CPU Cores: $(nproc)"
if [ $(nproc) -lt 8 ]; then
    echo "WARNING: Less than 8 CPU cores. Recommend 8+ for production."
fi

# Check RAM
TOTAL_RAM_GB=$(free -g | awk '/^Mem:/{print $2}')
echo "Total RAM: ${TOTAL_RAM_GB}GB"
if [ $TOTAL_RAM_GB -lt 24 ]; then
    echo "WARNING: Less than 24GB RAM. Browser pool will be limited."
fi

# Check disk space
FREE_DISK_GB=$(df -BG / | awk 'NR==2{print $4}' | tr -d 'G')
echo "Free Disk: ${FREE_DISK_GB}GB"
if [ $FREE_DISK_GB -lt 50 ]; then
    echo "WARNING: Less than 50GB free disk space."
fi

# Check existing services
echo ""
echo "=== Existing Services ==="
systemctl is-active postgresql --quiet && echo "PostgreSQL: Running" || echo "PostgreSQL: Not running"
systemctl is-active redis --quiet && echo "Redis: Running" || echo "Redis: Not running"
docker ps --format '{{.Names}}' 2>/dev/null | head -5

# Check file descriptor limits
SOFT_LIMIT=$(ulimit -Sn)
HARD_LIMIT=$(ulimit -Hn)
echo ""
echo "File Descriptor Limits: soft=$SOFT_LIMIT, hard=$HARD_LIMIT"
if [ $SOFT_LIMIT -lt 65535 ]; then
    echo "WARNING: File descriptor limit too low. Must be 65535+."
fi

echo ""
echo "=== Check Complete ==="
```

### 1.2 Required Packages Check

```bash
# Check Node.js version (need 18+)
node --version || echo "Node.js not installed"

# Check if pm2 is available
pm2 --version 2>/dev/null || echo "PM2 not installed"

# Check Python (for camoufox-fetch fallback)
python3 --version || echo "Python3 not installed"
```

---

## 2. System Preparation

### 2.1 Install System Dependencies

```bash
#!/bin/bash
# File: /opt/tevero/scripts/install-dependencies.sh

set -e

echo "Installing Camoufox system dependencies..."

# Update package lists
apt-get update

# Core dependencies for headless Firefox
apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxkbcommon0 \
    libxrandr2 \
    libxrender1 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    wget \
    curl

# Virtual display dependencies
apt-get install -y \
    xvfb \
    x11vnc \
    fluxbox \
    xauth

# Process management and monitoring
apt-get install -y \
    htop \
    iotop \
    procps \
    psmisc

echo "System dependencies installed."
```

### 2.2 Configure File Descriptor Limits

```bash
#!/bin/bash
# File: /opt/tevero/scripts/configure-limits.sh

set -e

echo "Configuring system limits for browser pool..."

# Create limits configuration
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

# Apply sysctl changes immediately
sysctl -p /etc/sysctl.d/90-tevero-camoufox.conf

echo "System limits configured. REBOOT REQUIRED for /etc/security/limits.d changes."
```

### 2.3 PAM Configuration for Limits

```bash
# Ensure PAM loads limits
grep -q "session required pam_limits.so" /etc/pam.d/common-session || \
    echo "session required pam_limits.so" >> /etc/pam.d/common-session

grep -q "session required pam_limits.so" /etc/pam.d/common-session-noninteractive || \
    echo "session required pam_limits.so" >> /etc/pam.d/common-session-noninteractive
```

---

## 3. Camoufox Installation

### 3.1 Install via npm (TypeScript/Node.js)

```bash
#!/bin/bash
# File: /opt/tevero/scripts/install-camoufox.sh

set -e

CAMOUFOX_DIR="/opt/tevero/camoufox"
mkdir -p $CAMOUFOX_DIR
cd $CAMOUFOX_DIR

# Initialize package.json if not exists
if [ ! -f package.json ]; then
    cat > package.json << 'EOF'
{
  "name": "tevero-camoufox-pool",
  "version": "1.0.0",
  "description": "TeveroSEO Camoufox Browser Pool",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node --expose-gc dist/index.js",
    "dev": "tsx watch src/index.ts"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF
fi

# Install camoufox and dependencies
npm install camoufox-js playwright-core bullmq ioredis prom-client

# Install TypeScript dependencies
npm install -D typescript @types/node tsx

# Create tsconfig
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

# Download Camoufox binary (happens on first launch, but pre-download for faster starts)
echo "Pre-downloading Camoufox binary..."
node -e "
const { Camoufox } = require('camoufox-js');
(async () => {
  try {
    const browser = await Camoufox({ headless: 'virtual' });
    console.log('Binary downloaded successfully');
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error('Binary download failed:', e.message);
    process.exit(1);
  }
})();
"

echo "Camoufox installation complete."
```

### 3.2 Verify Installation

```bash
#!/bin/bash
# File: /opt/tevero/scripts/verify-camoufox.sh

set -e

cd /opt/tevero/camoufox

echo "Verifying Camoufox installation..."

# Test browser launch
node -e "
const { Camoufox } = require('camoufox-js');
(async () => {
  const start = Date.now();
  const browser = await Camoufox({ 
    headless: 'virtual',
    blockImages: true 
  });
  const launchTime = Date.now() - start;
  console.log('Launch time:', launchTime, 'ms');
  
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://httpbin.org/ip');
  const content = await page.textContent('body');
  console.log('Test fetch result:', content);
  
  await browser.close();
  console.log('Camoufox verification: PASSED');
})();
"
```

---

## 4. Virtual Display Setup

### 4.1 Xvfb Service Configuration

Camoufox's `headless: 'virtual'` mode uses Xvfb internally, but for better stealth and debugging options, we can manage Xvfb externally.

```bash
#!/bin/bash
# File: /opt/tevero/scripts/setup-xvfb.sh

set -e

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

# Enable and start
systemctl daemon-reload
systemctl enable xvfb
systemctl start xvfb

# Set DISPLAY environment variable globally
echo 'export DISPLAY=:99' >> /etc/profile.d/xvfb.sh
chmod +x /etc/profile.d/xvfb.sh

echo "Xvfb service configured. Display :99 available."
```

### 4.2 Environment Variables for Camoufox

```bash
# File: /opt/tevero/camoufox/.env.production

# Display configuration
DISPLAY=:99

# Node.js optimization
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=4096 --expose-gc"

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
GEONODE_PASSWORD=${GEONODE_PASSWORD}

# Redis connection (same as existing services)
REDIS_URL=redis://localhost:6379

# Health check configuration
HEALTH_CHECK_PORT=3150
METRICS_PORT=3151

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

---

## 5. Resource Limits (cgroups)

### 5.1 Create cgroup v2 Slice for Camoufox

```bash
#!/bin/bash
# File: /opt/tevero/scripts/configure-cgroups.sh

set -e

echo "Configuring cgroups v2 for Camoufox browser pool..."

# Create systemd slice for camoufox
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

# Create drop-in for camoufox pool service
mkdir -p /etc/systemd/system/pm2-camoufox.service.d/
cat > /etc/systemd/system/pm2-camoufox.service.d/cgroup.conf << 'EOF'
[Service]
Slice=camoufox.slice
EOF

systemctl daemon-reload

echo "cgroups configuration complete."
```

### 5.2 Verify cgroup Limits

```bash
#!/bin/bash
# File: /opt/tevero/scripts/verify-cgroups.sh

# Check if cgroups v2 is active
if [ -f /sys/fs/cgroup/cgroup.controllers ]; then
    echo "cgroups v2 is active"
    echo "Available controllers: $(cat /sys/fs/cgroup/cgroup.controllers)"
else
    echo "WARNING: cgroups v2 not detected. Memory limits may not work."
fi

# Check slice status
systemctl status camoufox.slice --no-pager || echo "Slice not yet activated"

# Show resource limits
echo ""
echo "Configured limits:"
systemctl show camoufox.slice | grep -E "^(Memory|CPU|Tasks)"
```

---

## 6. PM2 Service Configuration

### 6.1 PM2 Ecosystem Configuration

```javascript
// File: /opt/tevero/camoufox/ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: 'camoufox-pool',
      script: 'dist/index.js',
      cwd: '/opt/tevero/camoufox',
      
      // Node.js arguments
      node_args: [
        '--max-old-space-size=4096',
        '--expose-gc',
        '--enable-source-maps'
      ].join(' '),
      
      // Environment
      env_production: {
        NODE_ENV: 'production',
        DISPLAY: ':99',
      },
      
      // Process management
      instances: 1, // Single process manages the browser pool
      exec_mode: 'fork',
      
      // Startup behavior
      wait_ready: true,
      listen_timeout: 30000,
      
      // Auto-restart configuration
      autorestart: true,
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 5000,
      
      // Memory management
      max_memory_restart: '3500M', // Restart if pool manager itself exceeds 3.5GB
      
      // Logging
      log_file: '/var/log/tevero/camoufox-pool.log',
      error_file: '/var/log/tevero/camoufox-error.log',
      out_file: '/var/log/tevero/camoufox-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
      merge_logs: true,
      
      // Graceful shutdown
      kill_timeout: 30000,
      shutdown_with_message: true,
      
      // Watch (disabled in production)
      watch: false,
    },
    
    // Optional: Metrics exporter as separate process
    {
      name: 'camoufox-metrics',
      script: 'dist/metrics-server.js',
      cwd: '/opt/tevero/camoufox',
      
      env_production: {
        NODE_ENV: 'production',
        METRICS_PORT: 3151,
      },
      
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 5,
      
      log_file: '/var/log/tevero/camoufox-metrics.log',
      error_file: '/var/log/tevero/camoufox-metrics-error.log',
    }
  ],
};
```

### 6.2 PM2 Systemd Integration

```bash
#!/bin/bash
# File: /opt/tevero/scripts/setup-pm2-systemd.sh

set -e

# Create log directory
mkdir -p /var/log/tevero
chown -R root:root /var/log/tevero

# Setup PM2 startup
pm2 startup systemd -u root --hp /root

# Start the application
cd /opt/tevero/camoufox
npm run build
pm2 start ecosystem.config.cjs --env production

# Save PM2 process list
pm2 save

# Create systemd drop-in for cgroup integration
mkdir -p /etc/systemd/system/pm2-root.service.d/
cat > /etc/systemd/system/pm2-root.service.d/override.conf << 'EOF'
[Service]
# Resource limits
LimitNOFILE=65535
LimitNPROC=65535
LimitMEMLOCK=infinity

# Environment
Environment=DISPLAY=:99
Environment=NODE_ENV=production

# cgroup slice
Slice=camoufox.slice

# Graceful shutdown timeout
TimeoutStopSec=60
EOF

systemctl daemon-reload
systemctl restart pm2-root

echo "PM2 systemd integration complete."
```

### 6.3 PM2 Commands Reference

```bash
# View status
pm2 status

# View logs
pm2 logs camoufox-pool --lines 100

# Monitor resources
pm2 monit

# Restart with zero downtime
pm2 reload camoufox-pool

# Force restart
pm2 restart camoufox-pool

# Stop gracefully
pm2 stop camoufox-pool

# Delete from PM2
pm2 delete camoufox-pool

# View detailed info
pm2 describe camoufox-pool
```

---

## 7. Health Monitoring

### 7.1 Health Check Endpoint Implementation

```typescript
// File: /opt/tevero/camoufox/src/health.ts

import http from 'http';
import { CamoufoxPool } from './pool';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  pool: {
    totalInstances: number;
    healthyInstances: number;
    activeRequests: number;
    queueDepth: number;
    memoryUsedGB: number;
  };
  system: {
    memoryUsedPercent: number;
    cpuUsedPercent: number;
    fileDescriptors: {
      used: number;
      limit: number;
    };
  };
}

export function createHealthServer(pool: CamoufoxPool, port: number): http.Server {
  const startTime = Date.now();
  
  const server = http.createServer(async (req, res) => {
    if (req.url === '/healthz' || req.url === '/health') {
      const metrics = pool.getMetrics();
      const memInfo = process.memoryUsage();
      
      const healthyPercent = metrics.totalInstances > 0 
        ? (metrics.healthyInstances / metrics.totalInstances) * 100 
        : 0;
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (healthyPercent >= 90 && metrics.queueDepth < 100) {
        status = 'healthy';
      } else if (healthyPercent >= 70 && metrics.queueDepth < 300) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }
      
      const health: HealthStatus = {
        status,
        timestamp: new Date().toISOString(),
        uptime: Date.now() - startTime,
        pool: {
          totalInstances: metrics.totalInstances,
          healthyInstances: metrics.healthyInstances,
          activeRequests: metrics.activeRequests,
          queueDepth: metrics.queueDepth,
          memoryUsedGB: metrics.memoryUsedGB,
        },
        system: {
          memoryUsedPercent: (memInfo.heapUsed / memInfo.heapTotal) * 100,
          cpuUsedPercent: 0, // Populated by external monitoring
          fileDescriptors: {
            used: 0, // Populated below
            limit: 65535,
          },
        },
      };
      
      const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health, null, 2));
      
    } else if (req.url === '/ready') {
      const metrics = pool.getMetrics();
      const ready = metrics.totalInstances >= 10 && metrics.healthyInstances >= 5;
      
      res.writeHead(ready ? 200 : 503);
      res.end(ready ? 'ready' : 'not ready');
      
    } else if (req.url === '/metrics') {
      // Prometheus metrics format
      const metrics = pool.getMetrics();
      const lines = [
        `# HELP camoufox_instances_total Total browser instances`,
        `# TYPE camoufox_instances_total gauge`,
        `camoufox_instances_total ${metrics.totalInstances}`,
        ``,
        `# HELP camoufox_instances_healthy Healthy browser instances`,
        `# TYPE camoufox_instances_healthy gauge`,
        `camoufox_instances_healthy ${metrics.healthyInstances}`,
        ``,
        `# HELP camoufox_requests_active Active scraping requests`,
        `# TYPE camoufox_requests_active gauge`,
        `camoufox_requests_active ${metrics.activeRequests}`,
        ``,
        `# HELP camoufox_queue_depth Requests waiting in queue`,
        `# TYPE camoufox_queue_depth gauge`,
        `camoufox_queue_depth ${metrics.queueDepth}`,
        ``,
        `# HELP camoufox_requests_total Total requests processed`,
        `# TYPE camoufox_requests_total counter`,
        `camoufox_requests_total ${metrics.totalRequests}`,
        ``,
        `# HELP camoufox_requests_success Successful requests`,
        `# TYPE camoufox_requests_success counter`,
        `camoufox_requests_success ${metrics.successfulRequests}`,
        ``,
        `# HELP camoufox_requests_failed Failed requests`,
        `# TYPE camoufox_requests_failed counter`,
        `camoufox_requests_failed ${metrics.failedRequests}`,
        ``,
        `# HELP camoufox_response_time_avg Average response time in ms`,
        `# TYPE camoufox_response_time_avg gauge`,
        `camoufox_response_time_avg ${metrics.avgResponseTimeMs}`,
        ``,
        `# HELP camoufox_memory_used_gb Memory used by browser pool in GB`,
        `# TYPE camoufox_memory_used_gb gauge`,
        `camoufox_memory_used_gb ${metrics.memoryUsedGB}`,
      ];
      
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(lines.join('\n'));
      
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  
  server.listen(port, '0.0.0.0', () => {
    console.log(`Health server listening on port ${port}`);
  });
  
  return server;
}
```

### 7.2 External Health Check Script

```bash
#!/bin/bash
# File: /opt/tevero/scripts/check-camoufox-health.sh
# Called by monitoring systems (Uptime Kuma, external monitors)

HEALTH_URL="http://localhost:3150/health"
TIMEOUT=10

response=$(curl -sf --max-time $TIMEOUT "$HEALTH_URL" 2>/dev/null)
exit_code=$?

if [ $exit_code -ne 0 ]; then
    echo "CRITICAL: Health endpoint unreachable"
    exit 2
fi

status=$(echo "$response" | jq -r '.status' 2>/dev/null)
healthy_instances=$(echo "$response" | jq -r '.pool.healthyInstances' 2>/dev/null)
queue_depth=$(echo "$response" | jq -r '.pool.queueDepth' 2>/dev/null)

case "$status" in
    "healthy")
        echo "OK: Pool healthy - $healthy_instances instances, queue: $queue_depth"
        exit 0
        ;;
    "degraded")
        echo "WARNING: Pool degraded - $healthy_instances instances, queue: $queue_depth"
        exit 1
        ;;
    *)
        echo "CRITICAL: Pool unhealthy - $healthy_instances instances, queue: $queue_depth"
        exit 2
        ;;
esac
```

### 7.3 Prometheus Scrape Configuration

```yaml
# Add to /etc/prometheus/prometheus.yml

scrape_configs:
  - job_name: 'camoufox-pool'
    static_configs:
      - targets: ['localhost:3151']
    scrape_interval: 15s
    scrape_timeout: 10s
```

### 7.4 Alert Rules

```yaml
# File: /etc/prometheus/rules/camoufox.yml

groups:
  - name: camoufox
    interval: 30s
    rules:
      # High failure rate
      - alert: CamoufoxHighFailureRate
        expr: |
          rate(camoufox_requests_failed[5m]) / 
          (rate(camoufox_requests_success[5m]) + rate(camoufox_requests_failed[5m])) > 0.15
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Camoufox pool failure rate above 15%"
          description: "{{ $value | humanizePercentage }} of requests are failing"
      
      # Queue depth too high
      - alert: CamoufoxQueueBacklog
        expr: camoufox_queue_depth > 200
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Camoufox queue depth high"
          description: "{{ $value }} requests waiting in queue"
      
      # Critical queue depth
      - alert: CamoufoxQueueCritical
        expr: camoufox_queue_depth > 400
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Camoufox queue depth critical"
          description: "{{ $value }} requests in queue - pool may be overwhelmed"
      
      # Low healthy instances
      - alert: CamoufoxLowHealthyInstances
        expr: camoufox_instances_healthy < 10
        for: 3m
        labels:
          severity: critical
        annotations:
          summary: "Camoufox healthy instances critically low"
          description: "Only {{ $value }} healthy instances available"
      
      # Memory pressure
      - alert: CamoufoxMemoryPressure
        expr: camoufox_memory_used_gb > 14
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Camoufox memory usage high"
          description: "{{ $value }}GB used out of 16GB limit"
      
      # Pool down
      - alert: CamoufoxPoolDown
        expr: up{job="camoufox-pool"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Camoufox pool unreachable"
          description: "Cannot scrape metrics from Camoufox pool"
```

---

## 8. Log Rotation

### 8.1 Logrotate Configuration

```bash
# File: /etc/logrotate.d/tevero-camoufox

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
        # Tell PM2 to reopen log files
        pm2 reloadLogs > /dev/null 2>&1 || true
    endscript
}
```

### 8.2 Log Directory Setup

```bash
#!/bin/bash
# File: /opt/tevero/scripts/setup-logs.sh

mkdir -p /var/log/tevero
chmod 755 /var/log/tevero

# Initial log files
touch /var/log/tevero/camoufox-pool.log
touch /var/log/tevero/camoufox-error.log
touch /var/log/tevero/camoufox-out.log
touch /var/log/tevero/camoufox-metrics.log

chmod 640 /var/log/tevero/*.log
```

---

## 9. Integration with Existing Services

### 9.1 Redis Integration

The Camoufox pool uses the same Redis instance as the existing TeveroSEO services.

```typescript
// File: /opt/tevero/camoufox/src/redis.ts

import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Use Redis database 2 for camoufox (DB 0-1 used by other services)
export const redis = new Redis(REDIS_URL, {
  db: 2,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
  keyPrefix: 'camoufox:',
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});
```

### 9.2 BullMQ Integration

```typescript
// File: /opt/tevero/camoufox/src/worker.ts

import { Worker, Job } from 'bullmq';
import { CamoufoxPool } from './pool';
import { redis } from './redis';

interface ScrapeJob {
  url: string;
  clientId: string;
  tier: 'camoufox'; // This worker only handles camoufox tier
  options?: {
    waitForSelector?: string;
    scrollDepth?: number;
    timeout?: number;
  };
}

interface ScrapeResult {
  html: string;
  statusCode: number;
  timing: {
    queuedMs: number;
    acquireMs: number;
    scrapeMs: number;
    totalMs: number;
  };
  tier: 'camoufox';
}

export function createScrapeWorker(pool: CamoufoxPool): Worker<ScrapeJob, ScrapeResult> {
  return new Worker<ScrapeJob, ScrapeResult>(
    'scrape-camoufox',
    async (job: Job<ScrapeJob>) => {
      const startTime = Date.now();
      const queuedMs = startTime - job.timestamp;
      
      const acquireStart = Date.now();
      const handle = await pool.acquirePage(30000);
      const acquireMs = Date.now() - acquireStart;
      
      const scrapeStart = Date.now();
      
      try {
        const { url, options } = job.data;
        const timeout = options?.timeout || 30000;
        
        const response = await handle.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout,
        });
        
        if (options?.waitForSelector) {
          await handle.page.waitForSelector(options.waitForSelector, {
            timeout: 10000,
          });
        }
        
        if (options?.scrollDepth) {
          await scrollPage(handle.page, options.scrollDepth);
        }
        
        const html = await handle.page.content();
        const statusCode = response?.status() || 200;
        const scrapeMs = Date.now() - scrapeStart;
        
        await pool.releasePage(handle, true);
        
        return {
          html,
          statusCode,
          timing: {
            queuedMs,
            acquireMs,
            scrapeMs,
            totalMs: Date.now() - startTime,
          },
          tier: 'camoufox',
        };
        
      } catch (error) {
        await pool.releasePage(handle, false);
        throw error;
      }
    },
    {
      connection: redis,
      concurrency: 50, // Match pool page capacity
      limiter: {
        max: 100,
        duration: 1000, // 100 jobs per second max
      },
    }
  );
}

async function scrollPage(page: any, depth: number): Promise<void> {
  const pageHeight = await page.evaluate(() => document.body.scrollHeight);
  const targetScroll = pageHeight * depth;
  let currentScroll = 0;
  
  while (currentScroll < targetScroll) {
    const scrollAmount = Math.min(300 + Math.random() * 200, targetScroll - currentScroll);
    await page.evaluate((amount: number) => window.scrollBy(0, amount), scrollAmount);
    currentScroll += scrollAmount;
    await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
  }
}
```

### 9.3 Docker Integration (if using Docker)

If you prefer Docker over PM2, add this to the existing `docker-compose.vps.yml`:

```yaml
# Add to docker-compose.vps.yml

services:
  # ... existing services ...
  
  camoufox-pool:
    build:
      context: ./camoufox
      dockerfile: Dockerfile
    image: teveroseo/camoufox-pool:latest
    restart: unless-stopped
    
    # Required for browser instances
    shm_size: '4gb'
    
    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '6.0'
          memory: 16G
        reservations:
          cpus: '2.0'
          memory: 4G
    
    # File descriptor limits
    ulimits:
      nofile:
        soft: 65535
        hard: 65535
    
    environment:
      NODE_ENV: production
      DISPLAY: :99
      REDIS_URL: "redis://redis:6379"
      GEONODE_USERNAME: ${GEONODE_USERNAME}
      GEONODE_PASSWORD: ${GEONODE_PASSWORD}
      HEALTH_CHECK_PORT: "3150"
      METRICS_PORT: "3151"
    
    volumes:
      - /tmp/.X11-unix:/tmp/.X11-unix:ro
    
    depends_on:
      redis:
        condition: service_healthy
      xvfb:
        condition: service_started
    
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:3150/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    
    networks:
      - teveroseo-net
  
  # Xvfb sidecar container
  xvfb:
    image: ubuntu:22.04
    command: ["Xvfb", ":99", "-screen", "0", "1920x1080x24", "-ac"]
    restart: unless-stopped
    volumes:
      - /tmp/.X11-unix:/tmp/.X11-unix
    networks:
      - teveroseo-net
```

---

## 10. Deployment Scripts

### 10.1 Full Installation Script

```bash
#!/bin/bash
# File: /opt/tevero/scripts/install-camoufox-full.sh
# Run as root on a fresh Contabo VPS

set -e

SCRIPTS_DIR="/opt/tevero/scripts"
mkdir -p $SCRIPTS_DIR

echo "=========================================="
echo "TeveroSEO Camoufox Full Installation"
echo "=========================================="
echo ""

# Step 1: System dependencies
echo "[1/8] Installing system dependencies..."
/opt/tevero/scripts/install-dependencies.sh

# Step 2: Configure limits
echo "[2/8] Configuring system limits..."
/opt/tevero/scripts/configure-limits.sh

# Step 3: Setup Xvfb
echo "[3/8] Setting up virtual display..."
/opt/tevero/scripts/setup-xvfb.sh

# Step 4: Configure cgroups
echo "[4/8] Configuring cgroups..."
/opt/tevero/scripts/configure-cgroups.sh

# Step 5: Install Camoufox
echo "[5/8] Installing Camoufox..."
/opt/tevero/scripts/install-camoufox.sh

# Step 6: Setup logs
echo "[6/8] Setting up log rotation..."
/opt/tevero/scripts/setup-logs.sh

# Step 7: Setup PM2
echo "[7/8] Configuring PM2..."
/opt/tevero/scripts/setup-pm2-systemd.sh

# Step 8: Verify installation
echo "[8/8] Verifying installation..."
/opt/tevero/scripts/verify-camoufox.sh

echo ""
echo "=========================================="
echo "Installation Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Edit /opt/tevero/camoufox/.env.production with your credentials"
echo "2. Reboot the system to apply all limits"
echo "3. After reboot, run: pm2 start ecosystem.config.cjs --env production"
echo "4. Monitor with: pm2 monit"
echo ""
echo "Health check: curl http://localhost:3150/health"
echo "Metrics: curl http://localhost:3151/metrics"
```

### 10.2 Graceful Restart Script

```bash
#!/bin/bash
# File: /opt/tevero/scripts/restart-camoufox.sh
# Graceful restart with connection draining

set -e

echo "Initiating graceful restart of Camoufox pool..."

# Wait for queue to drain (max 5 minutes)
TIMEOUT=300
ELAPSED=0
INTERVAL=5

while [ $ELAPSED -lt $TIMEOUT ]; do
    QUEUE_DEPTH=$(curl -sf http://localhost:3150/health | jq -r '.pool.queueDepth' 2>/dev/null || echo "999")
    ACTIVE=$(curl -sf http://localhost:3150/health | jq -r '.pool.activeRequests' 2>/dev/null || echo "999")
    
    echo "Queue: $QUEUE_DEPTH, Active: $ACTIVE"
    
    if [ "$QUEUE_DEPTH" = "0" ] && [ "$ACTIVE" = "0" ]; then
        echo "Queue drained. Proceeding with restart."
        break
    fi
    
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "WARNING: Timeout waiting for queue to drain. Forcing restart."
fi

# Reload PM2 (graceful)
pm2 reload camoufox-pool

# Wait for health check to pass
echo "Waiting for health check..."
sleep 10

for i in {1..30}; do
    STATUS=$(curl -sf http://localhost:3150/health | jq -r '.status' 2>/dev/null || echo "unknown")
    if [ "$STATUS" = "healthy" ]; then
        echo "Restart complete. Pool is healthy."
        exit 0
    fi
    echo "Status: $STATUS. Waiting..."
    sleep 2
done

echo "WARNING: Pool not healthy after restart. Check logs."
pm2 logs camoufox-pool --lines 50
exit 1
```

### 10.3 Emergency Cleanup Script

```bash
#!/bin/bash
# File: /opt/tevero/scripts/emergency-cleanup.sh
# Kill all browser processes and restart

set -e

echo "EMERGENCY: Stopping all browser processes..."

# Stop PM2 process
pm2 stop camoufox-pool || true

# Kill all Firefox/Camoufox processes
pkill -9 -f firefox || true
pkill -9 -f camoufox || true

# Wait for processes to die
sleep 5

# Verify all cleaned up
REMAINING=$(pgrep -c -f "firefox\|camoufox" || echo "0")
if [ "$REMAINING" != "0" ]; then
    echo "WARNING: $REMAINING browser processes still running"
    pgrep -f "firefox\|camoufox"
else
    echo "All browser processes terminated."
fi

# Clear shared memory
ipcrm --all 2>/dev/null || true

# Restart
echo "Restarting Camoufox pool..."
pm2 start camoufox-pool

echo "Emergency cleanup complete."
```

### 10.4 Deploy Update Script

```bash
#!/bin/bash
# File: /opt/tevero/scripts/deploy-camoufox-update.sh
# Deploy new version of Camoufox pool code

set -e

cd /opt/tevero/camoufox

echo "Deploying Camoufox update..."

# Pull latest code (if using git)
# git pull origin main

# Install dependencies
npm ci --production

# Build TypeScript
npm run build

# Graceful restart
/opt/tevero/scripts/restart-camoufox.sh

echo "Update deployed successfully."
```

---

## Summary

This infrastructure setup provides:

| Component | Configuration |
|-----------|---------------|
| **Memory Limit** | 16GB via cgroups (8GB reserved for other services) |
| **CPU Limit** | 6 cores (600% quota) |
| **File Descriptors** | 65535 (soft/hard) |
| **Pool Size** | 20-60 instances |
| **Pages per Instance** | 5 |
| **Instance Lifetime** | 100 requests OR 30 minutes |
| **Health Check** | Port 3150 |
| **Metrics** | Port 3151 (Prometheus format) |
| **Log Rotation** | Daily, 7-day retention |
| **Process Manager** | PM2 with systemd integration |

### Quick Commands

```bash
# View status
pm2 status
curl http://localhost:3150/health | jq

# View logs
pm2 logs camoufox-pool --lines 100

# Graceful restart
/opt/tevero/scripts/restart-camoufox.sh

# Emergency cleanup
/opt/tevero/scripts/emergency-cleanup.sh

# Check metrics
curl http://localhost:3151/metrics
```
