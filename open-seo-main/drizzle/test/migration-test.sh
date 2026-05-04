#!/usr/bin/env bash
# Migration Testing Script
# Phase 71-03: Test migrations against a fresh database
#
# Usage:
#   ./drizzle/test/migration-test.sh [migration_file]
#
# Examples:
#   ./drizzle/test/migration-test.sh                    # Run all migrations
#   ./drizzle/test/migration-test.sh 0034_client_id_to_uuid.sql  # Test specific migration

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRIZZLE_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$DRIZZLE_DIR")"
TEST_DB_NAME="open_seo_migration_test_$$"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Cleanup function
cleanup() {
    local exit_code=$?
    echo -e "\n${YELLOW}Cleaning up test database...${NC}"

    # Drop test database
    PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d postgres \
        -c "DROP DATABASE IF EXISTS $TEST_DB_NAME;" 2>/dev/null || true

    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}Cleanup complete.${NC}"
    else
        echo -e "${RED}Cleanup complete (test failed with exit code $exit_code).${NC}"
    fi

    exit $exit_code
}

# Set up cleanup trap
trap cleanup EXIT INT TERM

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Run psql command
run_psql() {
    local db="${1:-postgres}"
    shift
    PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$db" \
        "$@"
}

# Create fresh test database
create_test_db() {
    log_info "Creating test database: $TEST_DB_NAME"

    run_psql postgres -c "CREATE DATABASE $TEST_DB_NAME;"

    # Enable required extensions
    run_psql "$TEST_DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
    run_psql "$TEST_DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";"

    log_info "Test database created successfully."
}

# Get migration files in order
get_migration_files() {
    local target="${1:-}"

    if [ -n "$target" ]; then
        # Single migration mode - need all dependencies
        echo "$DRIZZLE_DIR/0000_init.sql"

        # Find the target migration and all migrations before it
        local target_num
        target_num=$(echo "$target" | sed 's/^0*//' | cut -d'_' -f1)

        for f in "$DRIZZLE_DIR"/0*.sql; do
            if [ -f "$f" ] && [ "$(basename "$f")" != "0000_init.sql" ]; then
                local file_num
                file_num=$(basename "$f" | sed 's/^0*//' | cut -d'_' -f1)

                if [ "$file_num" -le "$target_num" ] 2>/dev/null; then
                    echo "$f"
                fi
            fi
        done | sort -V
    else
        # All migrations
        for f in "$DRIZZLE_DIR"/0*.sql; do
            if [ -f "$f" ]; then
                echo "$f"
            fi
        done | sort -V
    fi
}

# Run a single migration
run_migration() {
    local migration_file="$1"
    local filename
    filename=$(basename "$migration_file")

    log_info "Running migration: $filename"

    if ! run_psql "$TEST_DB_NAME" -f "$migration_file" > /dev/null 2>&1; then
        log_error "Migration failed: $filename"

        # Show actual error
        echo -e "${RED}Error details:${NC}"
        run_psql "$TEST_DB_NAME" -f "$migration_file" 2>&1 || true

        return 1
    fi

    log_info "Migration passed: $filename"
    return 0
}

# Verify schema matches expected structure
verify_schema() {
    log_info "Verifying schema structure..."

    local errors=0

    # Check critical tables exist
    local required_tables=(
        "clients"
        "audits"
        "reports"
        "site_connections"
        "voice_profiles"
    )

    for table in "${required_tables[@]}"; do
        if ! run_psql "$TEST_DB_NAME" -tAc "SELECT 1 FROM information_schema.tables WHERE table_name = '$table';" | grep -q 1; then
            log_error "Missing required table: $table"
            ((errors++))
        fi
    done

    # Check drizzle migration tracking table
    if ! run_psql "$TEST_DB_NAME" -tAc "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'drizzle';" | grep -q 1; then
        log_warn "Drizzle schema not found (expected if running individual migrations)"
    fi

    # Check for any invalid foreign keys
    local invalid_fks
    invalid_fks=$(run_psql "$TEST_DB_NAME" -tAc "
        SELECT COUNT(*)
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.contype = 'f'
        AND NOT EXISTS (
            SELECT 1 FROM pg_class r WHERE r.oid = c.confrelid
        );
    ")

    if [ "$invalid_fks" -gt 0 ]; then
        log_error "Found $invalid_fks invalid foreign key constraints"
        ((errors++))
    fi

    if [ $errors -gt 0 ]; then
        log_error "Schema verification failed with $errors errors"
        return 1
    fi

    log_info "Schema verification passed"
    return 0
}

# Test rollback for a specific migration
test_rollback() {
    local migration_file="$1"
    local filename
    filename=$(basename "$migration_file")
    local migration_num
    migration_num=$(echo "$filename" | cut -d'_' -f1)
    local rollback_file="$DRIZZLE_DIR/rollback/${migration_num}_rollback.sql"

    if [ -f "$rollback_file" ]; then
        log_info "Testing rollback: $rollback_file"

        if ! run_psql "$TEST_DB_NAME" -f "$rollback_file" > /dev/null 2>&1; then
            log_warn "Rollback script failed for $filename (may be expected if dependencies exist)"
            return 0  # Non-fatal - rollbacks may fail due to data dependencies
        fi

        log_info "Rollback successful: $filename"
    else
        log_warn "No rollback script found for: $filename"
    fi

    return 0
}

# Print summary report
print_summary() {
    local total=$1
    local passed=$2
    local failed=$3

    echo ""
    echo "=================================================="
    echo "Migration Test Summary"
    echo "=================================================="
    echo "Total migrations: $total"
    echo -e "Passed: ${GREEN}$passed${NC}"

    if [ "$failed" -gt 0 ]; then
        echo -e "Failed: ${RED}$failed${NC}"
        return 1
    else
        echo -e "${GREEN}All migrations passed!${NC}"
        return 0
    fi
}

# Main execution
main() {
    local target_migration="${1:-}"

    echo "=================================================="
    echo "Migration Test Runner"
    echo "=================================================="
    echo "Test database: $TEST_DB_NAME"
    echo "Postgres host: $POSTGRES_HOST:$POSTGRES_PORT"
    echo ""

    # Validate postgres connection
    if ! run_psql postgres -c "SELECT 1;" > /dev/null 2>&1; then
        log_error "Cannot connect to PostgreSQL. Check POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD"
        exit 1
    fi

    # Create test database
    create_test_db

    # Get migrations to run
    local migrations
    migrations=$(get_migration_files "$target_migration")

    local total=0
    local passed=0
    local failed=0

    # Run each migration
    while IFS= read -r migration; do
        if [ -n "$migration" ]; then
            ((total++))

            if run_migration "$migration"; then
                ((passed++))
            else
                ((failed++))
                # Continue to show all failures
            fi
        fi
    done <<< "$migrations"

    # Verify final schema
    if [ "$failed" -eq 0 ]; then
        verify_schema || ((failed++))
    fi

    # Print summary
    print_summary "$total" "$passed" "$failed"
}

# Run main with arguments
main "$@"
