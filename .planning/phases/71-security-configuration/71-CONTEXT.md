# Phase 71 Context: Security & Configuration

## Source Documents

- `.planning/UNIFIED_REMEDIATION_PLAN.md` - Phase 5 section

## Linked Issues

| ID | Severity | Issue |
|----|----------|-------|
| CONFIG-01 | HIGH | Inconsistent env var naming |
| CONFIG-02 | HIGH | Missing env var validation |
| SEC-01 | HIGH | No pre-commit secret detection |
| SEC-02 | MEDIUM | Security deps unpinned |
| SEC-03 | MEDIUM | CSP nonces incomplete |
| MIG-01 | CRITICAL | 0034 migration no transaction |
| MIG-02 | HIGH | Alembic migrations missing downgrade |

## Dependencies

- Requires Phase 67-03 (unified database) complete
- Plan 71-03 depends on database migration completion
