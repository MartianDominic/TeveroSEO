# TeveroSEO Camoufox Browser Pool

Production-ready Camoufox browser pool infrastructure for the Contabo VPS.

## Overview

This directory contains deployment scripts and configuration for running a pool of Camoufox browser instances for web scraping with anti-bot bypassing capabilities.

**Target Environment:**
- Contabo VPS: 8 vCPU AMD EPYC, 24GB RAM
- OS: Ubuntu 22.04
- Resource allocation: 16GB RAM, 6 CPU cores for browser pool

## Quick Start

### Full Installation (Fresh VPS)

```bash
# SSH to your VPS as root
ssh root@your-vps-ip

# Clone the repository (or copy scripts)
git clone https://github.com/your-org/TeveroSEO.git
cd TeveroSEO/docker/camoufox/scripts

# Run full installation
./install-full.sh

# Reboot to apply system limits
sudo reboot

# After reboot, configure environment
cd /opt/tevero/camoufox
cp .env.example .env
nano .env  # Edit with your Geonode credentials

# Start the pool
pm2 start ecosystem.config.cjs --env production
```

### Verify Installation

```bash
# Check health
curl http://localhost:3150/health | jq

# Check Prometheus metrics
curl http://localhost:3151/metrics

# View logs
pm2 logs camoufox-pool --lines 100

# Monitor resources
pm2 monit
```

## Scripts

| Script | Purpose |
|--------|---------|
| `install-full.sh` | Complete installation (run all steps) |
| `install-dependencies.sh` | Install system packages |
| `configure-limits.sh` | Set file descriptors and sysctl |
| `setup-xvfb.sh` | Configure virtual display |
| `configure-cgroups.sh` | Set memory/CPU limits |
| `setup-pm2.sh` | Configure PM2 with systemd |
| `health-check.sh` | Check pool health (for monitors) |
| `graceful-restart.sh` | Restart with queue drain |
| `emergency-cleanup.sh` | Force kill all browsers |

## Configuration

### Environment Variables

Located at `/opt/tevero/camoufox/.env`:

```bash
# Pool sizing
CAMOUFOX_MIN_INSTANCES=20    # Pre-warmed instances
CAMOUFOX_MAX_INSTANCES=60    # Maximum concurrent
CAMOUFOX_MAX_PAGES_PER_INSTANCE=5

# Instance lifecycle
CAMOUFOX_MAX_REQUESTS_PER_INSTANCE=100
CAMOUFOX_MAX_AGE_MINUTES=30
CAMOUFOX_MAX_MEMORY_MB=400

# Geonode proxy
GEONODE_HOST=proxy.geonode.io
GEONODE_PORT_ROTATING=9000
GEONODE_USERNAME=geonode_y9ZVNlVjdE-type-residential
GEONODE_PASSWORD=your-password-here

# Redis
REDIS_URL=redis://localhost:6379

# Health endpoints
HEALTH_CHECK_PORT=3150
METRICS_PORT=3151
```

### Resource Limits

Configured via systemd slice (`camoufox.slice`):

| Resource | Limit | Purpose |
|----------|-------|---------|
| Memory | 16GB max | Leave 8GB for other services |
| Memory High | 14GB | Soft limit before reclaim |
| Swap | 2GB max | Prevent excessive swapping |
| CPU | 600% (6 cores) | Leave 2 cores for system |
| Processes | 4096 | Max concurrent tasks |
| File Descriptors | 65535 | Required for browsers |

## Monitoring

### Health Check Endpoint

```bash
curl http://localhost:3150/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-05-07T12:00:00.000Z",
  "uptime": 3600000,
  "pool": {
    "totalInstances": 40,
    "healthyInstances": 38,
    "activeRequests": 12,
    "queueDepth": 5,
    "memoryUsedGB": 8.5
  }
}
```

### Prometheus Metrics

```bash
curl http://localhost:3151/metrics
```

Key metrics:
- `camoufox_instances_total` - Total browser instances
- `camoufox_instances_healthy` - Healthy instances
- `camoufox_requests_active` - Active requests
- `camoufox_queue_depth` - Queued requests
- `camoufox_success_rate` - Request success rate
- `camoufox_memory_pool_gb` - Memory used by pool

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Success Rate | <95% | <85% |
| Queue Depth | >100 | >300 |
| Memory Usage | >70% (11.2GB) | >85% (13.6GB) |
| Healthy % | <90% | <70% |

## Operations

### Graceful Restart

```bash
./graceful-restart.sh
```

Waits for queue to drain, then reloads PM2.

### Emergency Cleanup

```bash
./emergency-cleanup.sh
```

Force kills all browser processes and restarts. Use when pool is stuck.

### View Logs

```bash
# Real-time logs
pm2 logs camoufox-pool

# Last 500 lines
pm2 logs camoufox-pool --lines 500

# Error logs only
tail -f /var/log/tevero/camoufox-error.log
```

### Resource Monitoring

```bash
# PM2 monitor
pm2 monit

# System resources
htop

# Memory usage
free -h

# cgroup limits
systemctl show camoufox.slice | grep -E '^(Memory|CPU)'
```

## Troubleshooting

### Pool Not Starting

1. Check Xvfb is running:
   ```bash
   systemctl status xvfb
   ```

2. Check file descriptor limits:
   ```bash
   ulimit -n  # Should be 65535
   ```

3. Check logs:
   ```bash
   pm2 logs camoufox-pool --lines 100
   ```

### High Memory Usage

1. Check for orphan processes:
   ```bash
   pgrep -af firefox
   ```

2. Force cleanup:
   ```bash
   ./emergency-cleanup.sh
   ```

3. Reduce pool size in `.env`:
   ```bash
   CAMOUFOX_MAX_INSTANCES=40
   ```

### Proxy Issues

1. Test proxy directly:
   ```bash
   curl -x http://geonode_user:pass@proxy.geonode.io:9000 https://httpbin.org/ip
   ```

2. Check credentials in `.env`

3. Verify Geonode account has bandwidth

## Integration

### BullMQ Queue

The pool listens on the `scrape-camoufox` queue:

```typescript
import { Queue } from 'bullmq';

const queue = new Queue('scrape-camoufox', {
  connection: { host: 'localhost', port: 6379 }
});

await queue.add('scrape', {
  url: 'https://example.com',
  clientId: 'client-123',
  options: {
    waitForSelector: '.content',
    scrollDepth: 0.8,
    timeout: 30000
  }
});
```

### Health Check Integration

For Uptime Kuma or similar:
```
Monitor Type: HTTP
URL: http://your-vps:3150/health
Expected Status: 200
```

## Architecture

See full documentation at:
- `.planning/phases/95-scraping-infrastructure/CAMOUFOX-VPS-INFRASTRUCTURE.md`
- `.planning/phases/95-scraping-infrastructure/CAMOUFOX-POOL-MANAGEMENT.md`
