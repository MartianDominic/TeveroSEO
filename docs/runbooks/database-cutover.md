# Database Consolidation Cutover Runbook

Phase 67-03: Zero-downtime migration from separate databases to unified tevero database.

## Overview

This runbook guides the migration from:
- `open_seo` database (open-seo-main)
- `alwrity` database (AI-Writer)

To:
- `tevero` database (unified)

**Duration:** 3 weeks total
**Risk Level:** Medium (zero-downtime design with instant rollback)

## Pre-Cutover Checklist

Complete all items before starting Phase 1:

### Database Preparation
- [ ] Verify migration scripts passed (`scripts/db/verify_migration.sql`)
- [ ] Confirm row counts match between source and target
- [ ] Verify foreign key constraints are valid
- [ ] Check for ORPHAN_ prefixed records and resolve manually
- [ ] Verify shared_clients and shared_voice_profiles schemas match expectations

### Infrastructure
- [ ] Backup all databases (open_seo, alwrity, tevero)
- [ ] Verify TEVERO_DATABASE_URL is configured in all services
- [ ] Test database connectivity from all services
- [ ] Verify Redis is healthy (used for caching during migration)
- [ ] Check disk space on database server (>20% free)

### Monitoring
- [ ] Set up alerts for database errors
- [ ] Create dashboard for dual-write error rates
- [ ] Monitor connection pool metrics
- [ ] Set up latency monitoring for reads

### Communication
- [ ] Schedule maintenance window (recommend: low traffic period)
- [ ] Notify team of migration timeline
- [ ] Prepare rollback communication template

## Phase 1: Enable Shadow Write (Week 1)

**Objective:** Validate that dual-write works correctly before routing any reads.

### Step 1.1: Enable Shadow Writes

```bash
# Update environment variables
SHADOW_WRITE_ENABLED=true
DB_READ_PERCENTAGE_TEVERO=0

# Deploy all services
docker compose -f docker-compose.vps.yml up -d
```

### Step 1.2: Monitor for 48 Hours

Watch for:
- Shadow write errors in logs: `grep "dual-write" /var/log/syslog`
- Connection pool exhaustion
- Latency increases on primary writes

Expected log patterns:
```
[dual-write] Shadow insert successful
[dual-write] Shadow update successful
```

Error patterns to investigate:
```
[dual-write] Shadow write failed: <error>
[dual-write] TEVERO_DATABASE_URL not set
```

### Step 1.3: Verify Data Consistency

```sql
-- Run on tevero database
SELECT COUNT(*) FROM shared_clients;

-- Compare with open_seo
SELECT COUNT(*) FROM clients;

-- Check recent writes are syncing
SELECT id, name, updated_at
FROM shared_clients
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC
LIMIT 10;
```

### Step 1.4: Phase 1 Completion Criteria

- [ ] No shadow write errors for 48 consecutive hours
- [ ] Row counts within acceptable delta (<1% difference)
- [ ] No latency degradation on primary writes
- [ ] All services healthy

## Phase 2: Gradual Read Migration (Week 2)

**Objective:** Incrementally shift reads to tevero database.

### Step 2.1: Start at 10%

```bash
DB_READ_PERCENTAGE_TEVERO=10
docker compose -f docker-compose.vps.yml up -d
```

Monitor for 24 hours:
- Read latency from tevero vs primary
- Error rates on reads
- Application behavior

### Step 2.2: Increase to 50%

```bash
DB_READ_PERCENTAGE_TEVERO=50
docker compose -f docker-compose.vps.yml up -d
```

Monitor for 24 hours. At 50%, any data inconsistencies will become apparent.

### Step 2.3: Increase to 90%

```bash
DB_READ_PERCENTAGE_TEVERO=90
docker compose -f docker-compose.vps.yml up -d
```

Monitor for 24 hours. Most traffic now using tevero.

### Step 2.4: Full Read Migration (100%)

```bash
DB_READ_PERCENTAGE_TEVERO=100
docker compose -f docker-compose.vps.yml up -d
```

All reads now from tevero. Continue dual-writes as safety net.

### Step 2.5: Phase 2 Completion Criteria

- [ ] 100% reads from tevero
- [ ] No read errors for 24 hours
- [ ] Latency within acceptable bounds
- [ ] Application functionality verified

## Phase 3: Full Cutover (Week 3)

**Objective:** Complete migration and decommission old databases.

### Step 3.1: Disable Shadow Write

```bash
SHADOW_WRITE_ENABLED=false
DB_READ_PERCENTAGE_TEVERO=100
docker compose -f docker-compose.vps.yml up -d
```

### Step 3.2: Update DATABASE_URL (Optional)

If desired, update primary DATABASE_URL to point to tevero:

```bash
# In docker-compose.vps.yml, update DATABASE_URL
DATABASE_URL: "postgresql://tevero_user:${POSTGRES_PASSWORD}@postgres:5432/tevero"
```

### Step 3.3: Mark Old Databases Read-Only

```sql
-- On open_seo database
ALTER DATABASE open_seo SET default_transaction_read_only = on;

-- On alwrity database
ALTER DATABASE alwrity SET default_transaction_read_only = on;
```

### Step 3.4: Archive Old Databases

```bash
# Create final backups
pg_dump -h localhost -U postgres open_seo > open_seo_final_backup.sql
pg_dump -h localhost -U postgres alwrity > alwrity_final_backup.sql

# Upload to cold storage
aws s3 cp open_seo_final_backup.sql s3://tevero-backups/archive/
aws s3 cp alwrity_final_backup.sql s3://tevero-backups/archive/
```

### Step 3.5: Phase 3 Completion Criteria

- [ ] Shadow writes disabled
- [ ] Old databases marked read-only
- [ ] Backups archived
- [ ] All services using tevero exclusively

## Rollback Procedure

**Time to rollback:** < 1 minute

### Immediate Rollback (Any Phase)

```bash
# Instant rollback - all reads return to primary
DB_READ_PERCENTAGE_TEVERO=0
SHADOW_WRITE_ENABLED=false
docker compose -f docker-compose.vps.yml up -d
```

### Rollback from Phase 3 (Post-Cutover)

If rollback needed after Phase 3 completion:

1. Restore read-write on old databases:
```sql
ALTER DATABASE open_seo SET default_transaction_read_only = off;
ALTER DATABASE alwrity SET default_transaction_read_only = off;
```

2. Re-enable dual-write to sync any tevero-only changes:
```bash
SHADOW_WRITE_ENABLED=true
DB_READ_PERCENTAGE_TEVERO=0
docker compose -f docker-compose.vps.yml up -d
```

3. Run data sync to copy tevero changes back to primary:
```sql
-- Identify records changed in tevero but not in primary
INSERT INTO clients (id, name, domain, ...)
SELECT id, name, domain, ...
FROM shared_clients sc
WHERE sc.updated_at > (SELECT MAX(updated_at) FROM clients WHERE id = sc.id)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  updated_at = EXCLUDED.updated_at;
```

## Emergency Contacts

| Role | Contact | When to Contact |
|------|---------|-----------------|
| DBA | [DBA contact info] | Database connection issues, corruption |
| DevOps | [DevOps contact info] | Service deployment issues |
| On-call | [On-call rotation] | Any production incident |

## Monitoring Dashboards

- Database Connections: [link]
- Dual-Write Errors: [link]
- Read Latency: [link]
- Service Health: [link]

## Appendix: Verification Queries

### Check Data Consistency

```sql
-- Compare client counts
SELECT 'open_seo' as db, COUNT(*) FROM clients
UNION ALL
SELECT 'tevero' as db, COUNT(*) FROM shared_clients;

-- Find missing records
SELECT c.id, c.name
FROM clients c
LEFT JOIN shared_clients sc ON c.id::uuid = sc.id
WHERE sc.id IS NULL;

-- Find orphaned records
SELECT id, workspace_id
FROM shared_clients
WHERE workspace_id LIKE 'ORPHAN_%';
```

### Check Shadow Write Status

```sql
-- Recent shadow writes
SELECT id, name, updated_at
FROM shared_clients
WHERE updated_at > NOW() - INTERVAL '5 minutes'
ORDER BY updated_at DESC
LIMIT 20;
```

### Check Read Routing

```bash
# View current read percentage
curl -s http://localhost:3001/api/health | jq '.readRouter'
```
