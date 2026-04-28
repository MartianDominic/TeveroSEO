# Drizzle Migration Rollback Scripts

This directory contains rollback scripts for each Drizzle migration. Since Drizzle SQL migrations are UP-only, these scripts provide manual rollback capability.

## Usage

```bash
# To rollback a specific migration
psql -d open_seo -f rollback/XXXX_rollback.sql

# Always verify state before and after
psql -d open_seo -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5;"
```

## Important Notes

1. **Run in reverse order**: Roll back migrations from newest to oldest
2. **Backup first**: Always create a database backup before rolling back
3. **Test in staging**: Test rollback scripts in staging before production
4. **Update migration tracking**: After rollback, remove the migration record from `drizzle.__drizzle_migrations`

## Rollback Order

To rollback to a specific version, run all rollback scripts from current down to target+1.

Example: To rollback from 0032 to 0029:
```bash
psql -d open_seo -f rollback/0032_rollback.sql
psql -d open_seo -f rollback/0031_rollback.sql
psql -d open_seo -f rollback/0030_rollback.sql
```

## Script Categories

### Critical (Data Loss Risk)
- `0002_rollback.sql` - Restores dropped auth tables
- `0031_rollback.sql` - Restores deleted orphan records
- `0029_rollback.sql` - Reverses type changes, restores deleted records

### High Priority (Schema Changes)
- `0032_database_schema_improvements_rollback.sql` - Removes indexes, constraints, enums
- `0032_rename_gsc_snapshots_rollback.sql` - Renames table back

### Standard (Additive Changes)
- Most other migrations add tables/columns and are safer to rollback
