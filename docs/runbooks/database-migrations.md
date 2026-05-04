# Database Migrations Runbook

Operational guide for running database migrations in TeveroSEO across both Drizzle (open-seo-main) and Alembic (AI-Writer) stacks.

## Overview

TeveroSEO uses two database migration systems:

| System | Stack | Database | Location |
|--------|-------|----------|----------|
| Drizzle | open-seo-main | open_seo | `open-seo-main/drizzle/*.sql` |
| Alembic | AI-Writer | alwrity | `AI-Writer/backend/alembic/versions/*.py` |

**Risk Level:** Medium-High (schema changes can cause data loss or downtime)

## Pre-Migration Checklist

Complete ALL items before running any migration:

### Database Backup
- [ ] Create full backup of target database
  ```bash
  # For open_seo (Drizzle)
  pg_dump -Fc -d open_seo -f backup_open_seo_$(date +%Y%m%d_%H%M%S).dump

  # For alwrity (Alembic)
  pg_dump -Fc -d alwrity -f backup_alwrity_$(date +%Y%m%d_%H%M%S).dump
  ```
- [ ] Verify backup integrity
  ```bash
  pg_restore --list backup_*.dump | head -20
  ```
- [ ] Store backup in safe location (not on same disk as database)

### Environment Verification
- [ ] Confirm you are targeting the correct database
  ```bash
  echo $DATABASE_URL | grep -o 'postgresql://[^:]*:[^@]*@[^/]*/' 
  ```
- [ ] Check disk space (migrations may need temp space)
  ```bash
  df -h /var/lib/postgresql
  ```
- [ ] Verify no long-running transactions
  ```sql
  SELECT pid, age(clock_timestamp(), query_start), query
  FROM pg_stat_activity
  WHERE state != 'idle'
  AND query_start < NOW() - INTERVAL '5 minutes';
  ```

### Application Preparation
- [ ] Notify team of planned migration
- [ ] Schedule maintenance window (if schema change affects running code)
- [ ] For breaking changes: deploy new code AFTER migration completes

### Migration Review
- [ ] Review migration SQL/Python for potential issues
- [ ] Check for DROP or ALTER operations
- [ ] Verify transaction wrapping (BEGIN/COMMIT)
- [ ] Test in staging/local environment first

## Step-by-Step Execution

### Drizzle Migrations (open-seo-main)

Drizzle uses raw SQL files. Each migration should be wrapped in a transaction.

**Run a single migration:**
```bash
cd open-seo-main

# Dry run (transaction that rolls back)
psql -d open_seo -c "BEGIN; \i drizzle/XXXX_migration_name.sql; ROLLBACK;"

# Execute for real
psql -d open_seo -f drizzle/XXXX_migration_name.sql
```

**Run all pending migrations:**
```bash
# Using drizzle-kit
npx drizzle-kit push:pg

# Or manually in order
for f in drizzle/0*.sql; do
  echo "Running $f..."
  psql -d open_seo -f "$f"
done
```

**Test migrations first:**
```bash
./drizzle/test/migration-test.sh XXXX_migration_name.sql
```

### Alembic Migrations (AI-Writer)

Alembic has built-in migration management with upgrade/downgrade tracking.

**Check current version:**
```bash
cd AI-Writer/backend
alembic current
```

**Run pending migrations:**
```bash
# Upgrade to latest
alembic upgrade head

# Upgrade to specific revision
alembic upgrade 0022_add_apikey_cascade
```

**Preview migration SQL without running:**
```bash
alembic upgrade head --sql > preview.sql
cat preview.sql
```

### Production Execution

For production deployments:

1. **Enable maintenance mode** (if needed)
   ```bash
   # Set environment variable to show maintenance page
   export MAINTENANCE_MODE=true
   docker compose restart web
   ```

2. **Run migration with output logging**
   ```bash
   # Drizzle
   psql -d open_seo -f drizzle/XXXX_migration.sql 2>&1 | tee migration_$(date +%Y%m%d_%H%M%S).log

   # Alembic
   alembic upgrade head 2>&1 | tee migration_$(date +%Y%m%d_%H%M%S).log
   ```

3. **Verify success**
   ```sql
   -- Check for errors in recent queries
   SELECT query, state, wait_event_type
   FROM pg_stat_activity
   WHERE datname = 'open_seo'
   AND state = 'active';
   ```

4. **Disable maintenance mode**
   ```bash
   unset MAINTENANCE_MODE
   docker compose restart web
   ```

## Rollback Procedure

### Immediate Rollback (< 1 minute)

If migration fails mid-execution and was transaction-wrapped:
- Transaction automatically rolls back
- No manual action needed
- Verify state: `SELECT COUNT(*) FROM [affected_table];`

### Manual Rollback - Drizzle

Drizzle doesn't have built-in downgrade. Use rollback scripts:

```bash
# Find rollback script
ls open-seo-main/drizzle/rollback/XXXX_rollback.sql

# Execute rollback
psql -d open_seo -f open-seo-main/drizzle/rollback/XXXX_rollback.sql

# Remove from migration tracking
psql -d open_seo -c "DELETE FROM drizzle.__drizzle_migrations WHERE id = 'XXXX...';"
```

### Manual Rollback - Alembic

Alembic has built-in downgrade support:

```bash
# Rollback one migration
alembic downgrade -1

# Rollback to specific revision
alembic downgrade 0021_schema_integrity

# Rollback all the way
alembic downgrade base
```

### Restore from Backup (Last Resort)

If rollback fails or data is corrupted:

```bash
# Stop all applications
docker compose stop

# Drop and recreate database
psql -c "DROP DATABASE open_seo;"
psql -c "CREATE DATABASE open_seo;"

# Restore from backup
pg_restore -d open_seo backup_open_seo_YYYYMMDD_HHMMSS.dump

# Restart applications
docker compose start
```

**Time estimate:** 5-30 minutes depending on database size

## Common Issues

### Lock Timeout

**Symptom:** Migration hangs or times out
```
ERROR: canceling statement due to lock timeout
```

**Solution:**
```sql
-- Find blocking queries
SELECT pid, query FROM pg_stat_activity WHERE state = 'active';

-- Terminate blocking query (carefully!)
SELECT pg_terminate_backend(pid);
```

### Constraint Violation

**Symptom:** FK or unique constraint error
```
ERROR: insert or update on table "X" violates foreign key constraint
```

**Solution:**
1. Check for orphaned records before migration
   ```sql
   SELECT id FROM child_table c
   LEFT JOIN parent_table p ON c.parent_id = p.id
   WHERE p.id IS NULL;
   ```
2. Clean up orphans or disable constraint temporarily

### Out of Disk Space

**Symptom:** Migration fails with disk space error

**Solution:**
1. Clear PostgreSQL temp files: `rm -rf /var/lib/postgresql/data/pg_tmp/*`
2. Vacuum database: `VACUUM FULL;` (warning: locks tables)
3. Add disk space and retry

### Type Conversion Failure

**Symptom:** Cannot cast column to new type
```
ERROR: column "X" cannot be cast automatically to type uuid
```

**Solution:**
1. Check for invalid data:
   ```sql
   SELECT * FROM table WHERE column !~ '^[0-9a-f-]{36}$';
   ```
2. Fix or delete invalid rows
3. Retry migration

## Migration Best Practices

1. **Always use transactions** - Wrap DDL in BEGIN/COMMIT
2. **Test locally first** - Run `migration-test.sh` before production
3. **Backup before every migration** - No exceptions
4. **Deploy code changes after schema changes** - Unless migration is backward compatible
5. **Keep migrations small** - One logical change per migration
6. **Name migrations descriptively** - `0034_client_id_to_uuid.sql` not `0034_fix.sql`
7. **Include rollback scripts** - For every Drizzle migration
8. **Monitor after migration** - Check for slow queries, errors

## Emergency Contacts

| Role | Contact | When to Contact |
|------|---------|-----------------|
| DBA / Database Lead | [contact info] | Data corruption, major performance issues |
| DevOps Lead | [contact info] | Infrastructure failures, deployment issues |
| On-call Engineer | [pagerduty/rotation] | Any production incident |
| Product Owner | [contact info] | Business impact assessment |

## Verification Queries

### Post-Migration Health Check

```sql
-- Check table counts haven't changed unexpectedly
SELECT schemaname, relname, n_live_tup
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC
LIMIT 20;

-- Check for invalid indexes
SELECT indexrelid::regclass AS index,
       indrelid::regclass AS table,
       indisvalid
FROM pg_index
WHERE NOT indisvalid;

-- Check for bloated tables (after large updates)
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
LIMIT 10;
```

### Data Integrity Checks

```sql
-- Check all foreign keys are valid
SELECT conname, conrelid::regclass AS table_name
FROM pg_constraint
WHERE contype = 'f'
AND NOT convalidated;

-- Check for orphaned records (example for clients -> audits)
SELECT a.id FROM audits a
LEFT JOIN clients c ON a.client_id = c.id
WHERE c.id IS NULL;
```

## Related Runbooks

- [Database Cutover](./database-cutover.md) - For major database consolidation
- Incident Response (link) - For production incidents
- Backup & Recovery (link) - For detailed restore procedures
