# Scraping Infrastructure Environment Variables

This document describes all environment variables used by the scraping infrastructure.

## Table of Contents

1. [Required Variables](#required-variables)
2. [Authentication](#authentication)
3. [DataForSEO Configuration](#dataforseo-configuration)
4. [Proxy Configuration](#proxy-configuration)
5. [Storage (Cloudflare R2)](#storage-cloudflare-r2)
6. [Alerting](#alerting)
7. [Performance Tuning](#performance-tuning)
8. [Cache Configuration](#cache-configuration)
9. [Circuit Breaker](#circuit-breaker)
10. [Core Web Vitals](#core-web-vitals)
11. [Migration Configuration](#migration-configuration)

---

## Required Variables

These variables must be set for the scraping infrastructure to function.

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` | Yes |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost/db` | Yes |
| `DATAFORSEO_API_KEY` | DataForSEO API credentials (login:password, base64) | `bG9naW46cGFzc3dvcmQ=` | Yes (for DFS tiers) |

**Notes:**
- `REDIS_URL` must point to a Redis 6+ instance for Lua script support
- `DATABASE_URL` must include SSL mode for production (`?sslmode=require`)
- `DATAFORSEO_API_KEY` is base64-encoded `login:password` format

---

## Authentication

| Variable | Description | Default |
|----------|-------------|---------|
| `SCRAPING_ADMIN_API_KEY` | API key for admin endpoints | (required in production) |
| `SCRAPING_ADMIN_ALLOWED_IPS` | Comma-separated IP allowlist | (all IPs if not set) |

**Security Notes:**
- `SCRAPING_ADMIN_API_KEY` must be set in production (checked at startup)
- Use `SCRAPING_ADMIN_ALLOWED_IPS` to restrict admin access by IP
- Example: `SCRAPING_ADMIN_ALLOWED_IPS=10.0.0.0/8,172.16.0.0/12`

---

## DataForSEO Configuration

### Budget Controls

| Variable | Description | Default |
|----------|-------------|---------|
| `DFS_DAILY_BUDGET` | Daily budget in USD | `10.0` |
| `DFS_MONTHLY_BUDGET` | Monthly budget in USD | `100.0` |
| `DFS_ENFORCE_HARD_LIMIT` | Block requests at budget limit | `false` |

**Usage:**
- Set `DFS_DAILY_BUDGET` and `DFS_MONTHLY_BUDGET` based on expected usage
- Enable `DFS_ENFORCE_HARD_LIMIT=true` for strict cost control
- Budget resets at 00:00 UTC daily, 1st of month for monthly

### Alerting

| Variable | Description | Default |
|----------|-------------|---------|
| `DFS_ALERT_WEBHOOK_URL` | Webhook URL for budget alerts | - |
| `DFS_ALERT_EMAILS` | Comma-separated alert emails | - |
| `DFS_ALERT_WARNING_PERCENT` | Warning threshold | `75` |
| `DFS_ALERT_CRITICAL_PERCENT` | Critical threshold | `90` |

**Example:**
```bash
DFS_ALERT_WEBHOOK_URL=https://hooks.slack.com/services/XXX
DFS_ALERT_EMAILS=ops@example.com,finance@example.com
```

### API Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DFS_API_BASE_URL` | DataForSEO API base URL | `https://api.dataforseo.com/v3` |
| `DFS_REQUEST_TIMEOUT` | Request timeout in ms | `60000` |
| `DFS_PREFER_STANDARD_QUEUE` | Use async Standard Queue | `false` |
| `DFS_STANDARD_QUEUE_MAX_WAIT` | Max wait for standard queue results in ms | `300000` |

---

## Proxy Configuration

### Geonode (Residential Proxy)

| Variable | Description | Default |
|----------|-------------|---------|
| `GEONODE_USERNAME` | Username with type suffix | - |
| `GEONODE_PASSWORD` | Password (UUID format) | - |
| `GEONODE_HOST` | Proxy host | `proxy.geonode.io` |
| `GEONODE_PORT` | Proxy port | `9000` |
| `GEONODE_DEFAULT_COUNTRY` | Default geo-targeting (ISO 3166-1) | - |

**Username Format:**
- Residential: `{username}-country-{ISO}`
- Sticky session: `{username}-country-{ISO}-session-{sessionId}`

**Example:**
```bash
GEONODE_USERNAME=user123-country-us
GEONODE_PASSWORD=a1b2c3d4-e5f6-7890-abcd-ef1234567890
GEONODE_DEFAULT_COUNTRY=us
```

### Webshare (Datacenter Proxy)

| Variable | Description | Default |
|----------|-------------|---------|
| `WEBSHARE_API_KEY` | Webshare API key | - |
| `WEBSHARE_PROXY_POOL_SIZE` | Number of proxies to rotate | `10` |

### Direct Tier (No Proxy)

| Variable | Description | Default |
|----------|-------------|---------|
| `DIRECT_TIER_ENABLED` | Enable direct requests without proxy | `true` |
| `DIRECT_TIER_USER_AGENT` | User agent for direct requests | (Chrome 120) |

### Camoufox (Stealth Browser)

| Variable | Description | Default |
|----------|-------------|---------|
| `CAMOUFOX_POOL_SIZE` | Browser instances in pool | `5` |
| `CAMOUFOX_MEMORY_LIMIT_MB` | Memory limit per instance | `512` |
| `CAMOUFOX_HEADLESS` | Run in headless mode | `true` |
| `CAMOUFOX_TIMEOUT_MS` | Page load timeout | `30000` |

---

## Storage (Cloudflare R2)

Used for L4 cache archive storage.

| Variable | Description | Default |
|----------|-------------|---------|
| `R2_BUCKET` | R2 bucket name | `scrape-archive` |
| `R2_ACCESS_KEY_ID` | R2 access key | - |
| `R2_SECRET_ACCESS_KEY` | R2 secret key | - |
| `CF_ACCOUNT_ID` | Cloudflare account ID | - |
| `R2_ENABLED` | Enable R2 L4 cache | `true` |

**Notes:**
- R2 is used for long-term HTML archive (L4 cache)
- If not configured, L4 cache falls back to PostgreSQL
- R2 costs approximately $0.015/GB/month

---

## Alerting

### Slack

| Variable | Description | Default |
|----------|-------------|---------|
| `SLACK_WEBHOOK_URL` | Slack incoming webhook URL | - |
| `SLACK_CHANNEL` | Override channel | (webhook default) |
| `SLACK_ALERT_ENABLED` | Enable Slack alerts | `true` |

### PagerDuty

| Variable | Description | Default |
|----------|-------------|---------|
| `PAGERDUTY_ROUTING_KEY` | PagerDuty Events API v2 routing key | - |
| `PAGERDUTY_ENABLED` | Enable PagerDuty for critical alerts | `true` |

### Email

| Variable | Description | Default |
|----------|-------------|---------|
| `ALERT_EMAIL_FROM` | Sender email address | - |
| `ALERT_EMAIL_SMTP_HOST` | SMTP server host | - |
| `ALERT_EMAIL_SMTP_PORT` | SMTP server port | `587` |
| `ALERT_EMAIL_SMTP_USER` | SMTP username | - |
| `ALERT_EMAIL_SMTP_PASS` | SMTP password | - |

---

## Performance Tuning

### Concurrency

| Variable | Description | Default |
|----------|-------------|---------|
| `SCRAPING_MAX_CONCURRENCY` | Global max concurrent requests | `200` |
| `SCRAPING_WORKER_CONCURRENCY` | Jobs processed per worker | `10` |
| `SCRAPING_QUEUE_PRIORITY_CONCURRENCY` | Priority queue concurrent jobs | `50` |
| `SCRAPING_QUEUE_STANDARD_CONCURRENCY` | Standard queue concurrent jobs | `100` |
| `SCRAPING_QUEUE_BACKGROUND_CONCURRENCY` | Background queue concurrent jobs | `50` |

### Rate Limiting

| Variable | Description | Default |
|----------|-------------|---------|
| `RATE_LIMIT_PER_DOMAIN_RPS` | Requests per second per domain | `2` |
| `RATE_LIMIT_GLOBAL_RPS` | Global requests per second | `100` |
| `RATE_LIMIT_BACKOFF_INITIAL_MS` | Initial backoff on 429 | `1000` |
| `RATE_LIMIT_BACKOFF_MAX_MS` | Max backoff multiplier | `16000` |

### Timeouts

| Variable | Description | Default |
|----------|-------------|---------|
| `SCRAPING_REQUEST_TIMEOUT_MS` | HTTP request timeout | `30000` |
| `SCRAPING_PAGE_LOAD_TIMEOUT_MS` | Browser page load timeout | `30000` |
| `SCRAPING_JOB_TIMEOUT_MS` | BullMQ job timeout | `120000` |

---

## Cache Configuration

### L1 (Memory Cache - LRU)

| Variable | Description | Default |
|----------|-------------|---------|
| `L1_CACHE_MAX_SIZE_MB` | Max memory cache size | `100` |
| `L1_CACHE_TTL_SECONDS` | Memory cache TTL | `300` |
| `L1_CACHE_MAX_ITEMS` | Max items in cache | `10000` |

### L2 (Redis Cache)

| Variable | Description | Default |
|----------|-------------|---------|
| `L2_CACHE_TTL_SECONDS` | Redis cache TTL | `3600` |
| `L2_CACHE_MAX_SIZE_MB` | Max Redis cache allocation | `2048` |
| `L2_CACHE_KEY_PREFIX` | Redis key prefix | `scrape:cache:l2:` |

### L3 (PostgreSQL Cache)

| Variable | Description | Default |
|----------|-------------|---------|
| `L3_CACHE_TTL_DAYS` | PostgreSQL cache TTL | `30` |
| `L3_CACHE_TABLE` | Cache table name | `scrape_cache` |
| `L3_CACHE_CLEANUP_INTERVAL_HOURS` | Cleanup job interval | `24` |

### L4 (R2 Archive)

| Variable | Description | Default |
|----------|-------------|---------|
| `L4_CACHE_TTL_DAYS` | R2 archive TTL | `90` |
| `L4_CACHE_ENABLED` | Enable L4 archive | `true` |

### Cache Behavior

| Variable | Description | Default |
|----------|-------------|---------|
| `CACHE_STALE_WHILE_REVALIDATE` | Serve stale during refresh | `true` |
| `CACHE_DEDUP_ENABLED` | Enable content deduplication | `true` |
| `CACHE_URL_NORMALIZE` | Strip tracking params | `true` |

---

## Circuit Breaker

### Global Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `CIRCUIT_BREAKER_ENABLED` | Enable circuit breakers | `true` |
| `CIRCUIT_BREAKER_FAILURE_THRESHOLD` | Failures to open circuit | `5` |
| `CIRCUIT_BREAKER_RESET_TIMEOUT_MS` | Time in open state | `60000` |
| `CIRCUIT_BREAKER_SUCCESS_THRESHOLD` | Successes to close in half-open | `2` |

### Per-Tier Overrides

| Variable | Description | Default |
|----------|-------------|---------|
| `CIRCUIT_{TIER}_FAILURE_THRESHOLD` | Tier-specific failure threshold | (global) |
| `CIRCUIT_{TIER}_RESET_TIMEOUT_MS` | Tier-specific reset timeout | (global) |

**Tier names:** `DIRECT`, `WEBSHARE`, `GEONODE`, `CAMOUFOX`, `DFS_BASIC`, `DFS_JS`, `DFS_BROWSER`

**Example:**
```bash
CIRCUIT_DFS_BROWSER_FAILURE_THRESHOLD=3
CIRCUIT_DFS_BROWSER_RESET_TIMEOUT_MS=300000
```

---

## Core Web Vitals

| Variable | Description | Default |
|----------|-------------|---------|
| `CRUX_API_KEY` | Chrome UX Report API key | - |
| `PSI_API_KEY` | PageSpeed Insights API key | - |
| `PSI_DAILY_BUDGET` | PSI requests per day | `1000` |
| `CWV_CACHE_TTL_HOURS` | CWV data cache TTL | `24` |

---

## Migration Configuration

For gradual rollout from legacy to new infrastructure.

| Variable | Description | Default |
|----------|-------------|---------|
| `MIGRATION_MODE` | Migration phase | `legacy` |
| `MIGRATION_CANARY_PERCENT` | Canary traffic percentage | `10` |
| `MIGRATION_SHADOW_ENABLED` | Run shadow mode comparison | `false` |

**Migration Modes:**
- `legacy` - All traffic to legacy system
- `shadow` - Parallel execution, legacy results returned
- `canary` - Percentage to new system
- `rollout` - Majority to new system
- `migrated` - All traffic to new system

### Feature Flags

| Variable | Description | Default |
|----------|-------------|---------|
| `FF_SCRAPING_NEW_CACHE` | Use new cache system | `legacy` |
| `FF_SCRAPING_NEW_QUEUE` | Use new queue system | `legacy` |
| `FF_SCRAPING_NEW_TIERS` | Use new tier system | `legacy` |

**Flag Values:** `legacy`, `shadow`, `canary`, `rollout`, `migrated`

---

## Example Production Configuration

```bash
# Required
REDIS_URL=redis://redis.internal:6379
DATABASE_URL=postgresql://scraping:xxx@db.internal:5432/scraping?sslmode=require
DATAFORSEO_API_KEY=bG9naW46cGFzc3dvcmQ=

# Authentication
SCRAPING_ADMIN_API_KEY=your-secure-admin-key
SCRAPING_ADMIN_ALLOWED_IPS=10.0.0.0/8

# DataForSEO
DFS_DAILY_BUDGET=100
DFS_MONTHLY_BUDGET=2000
DFS_ENFORCE_HARD_LIMIT=true
DFS_PREFER_STANDARD_QUEUE=true

# Proxies
GEONODE_USERNAME=user-country-us
GEONODE_PASSWORD=uuid-password
WEBSHARE_API_KEY=webshare-key

# Storage
R2_BUCKET=scrape-archive
R2_ACCESS_KEY_ID=r2-access-key
R2_SECRET_ACCESS_KEY=r2-secret-key
CF_ACCOUNT_ID=cloudflare-account-id

# Alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
PAGERDUTY_ROUTING_KEY=pagerduty-key

# Performance
SCRAPING_MAX_CONCURRENCY=200
SCRAPING_WORKER_CONCURRENCY=10

# Cache
L1_CACHE_MAX_SIZE_MB=256
L2_CACHE_TTL_SECONDS=7200
L3_CACHE_TTL_DAYS=30

# Circuit Breaker
CIRCUIT_BREAKER_ENABLED=true
CIRCUIT_DFS_BROWSER_RESET_TIMEOUT_MS=300000
```

---

## Validation

The scraping service validates environment variables at startup:

```typescript
// Required in production
if (process.env.NODE_ENV === 'production') {
  assert(process.env.SCRAPING_ADMIN_API_KEY, 'SCRAPING_ADMIN_API_KEY required');
  assert(process.env.REDIS_URL, 'REDIS_URL required');
  assert(process.env.DATABASE_URL, 'DATABASE_URL required');
}

// Required for DFS tiers
if (!process.env.DATAFORSEO_API_KEY) {
  console.warn('DATAFORSEO_API_KEY not set - DFS tiers disabled');
}
```

Missing required variables will cause startup failure in production.
