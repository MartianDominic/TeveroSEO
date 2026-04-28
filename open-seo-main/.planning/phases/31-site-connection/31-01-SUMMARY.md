---
phase: 31-site-connection
plan: 01
subsystem: database, security
tags: [schema, encryption, credentials, aes-256-gcm]
dependency_graph:
  requires: []
  provides: [site_connections_table, credential_encryption]
  affects: [client_connections, platform_integrations]
tech_stack:
  added: []
  patterns: [aes-256-gcm, iv-tag-ciphertext-packing]
key_files:
  created:
    - src/db/connection-schema.ts
    - src/server/features/connections/services/CredentialEncryption.ts
    - src/server/features/connections/services/CredentialEncryption.test.ts
    - drizzle/0020_site_connections.sql
  modified:
    - src/db/schema.ts
    - src/server/lib/runtime-env.ts
    - drizzle/meta/_journal.json
decisions:
  - "AES-256-GCM with IV || TAG || CIPHERTEXT packing for credential storage"
  - "Fresh 12-byte IV per encryption to prevent IV reuse attacks"
  - "SITE_ENCRYPTION_KEY as base64-encoded 32-byte key from environment"
metrics:
  duration_minutes: 6
  completed: "2026-04-22T14:01:00Z"
  tasks_completed: 3
  files_changed: 7
---

# Phase 31 Plan 01: Site Connections Schema Summary

AES-256-GCM credential encryption with PostgreSQL site_connections table for secure platform integration storage.

## What Was Built

### 1. Credential Encryption Service

`src/server/features/connections/services/CredentialEncryption.ts`:
- `encryptCredential(plaintext)` - AES-256-GCM encryption returning IV || TAG || CIPHERTEXT Buffer
- `decryptCredential(packed)` - Decryption with auth tag verification
- `validateEncryptionKey()` - Validates 32-byte base64 key from environment
- `encryptCredentialsToBase64()` / `decryptCredentialsFromBase64()` - Database storage helpers

Security properties:
- Fresh 12-byte random IV per encryption (no IV reuse)
- GCM authentication prevents tampering
- Key validation at startup prevents misconfiguration

### 2. Site Connections Schema

`src/db/connection-schema.ts`:
- `site_connections` table with encrypted credentials column
- Foreign key to `clients` table with cascade delete
- Indexes on `clientId`, `platform`, `status`
- Types: `SiteConnectionSelect`, `SiteConnectionInsert`

Schema columns:
- `id` (text, PK)
- `clientId` (text, FK to clients)
- `platform` (text) - wordpress, shopify, wix, squarespace, webflow, custom, pixel
- `siteUrl` (text)
- `displayName` (text, nullable)
- `encryptedCredentials` (text, base64 encrypted)
- `capabilities` (text[], nullable)
- `status` (text) - pending, active, error, disconnected
- `lastVerifiedAt`, `lastErrorMessage`, `createdAt`, `updatedAt`

### 3. Environment Validation

`src/server/lib/runtime-env.ts`:
- `validateSiteEncryptionKey()` - Validates key format when present
- `REQUIRED_ENV_CONNECTIONS` constant for connections feature
- Clear error message with key generation command

## Test Coverage

10 tests passing in `CredentialEncryption.test.ts`:
- Round-trip encryption/decryption
- Unique IV per encryption
- Tampered ciphertext detection
- Missing/invalid key validation
- Edge cases: empty, large, Unicode payloads

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 4ac7cfa | test | Add failing tests for AES-256-GCM credential encryption |
| 5c91e12 | feat | Implement AES-256-GCM credential encryption |
| a569026 | feat | Add site_connections schema and migration |
| f07524c | feat | Add SITE_ENCRYPTION_KEY env validation |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

```bash
# All tests pass
pnpm test src/server/features/connections/services/CredentialEncryption.test.ts
# 10 passed

# TypeScript compiles
pnpm tsc --noEmit
# No errors in connection schema files

# Env validation present
grep -q "SITE_ENCRYPTION_KEY" src/server/lib/runtime-env.ts
# Found
```

## Self-Check: PASSED

- [x] src/db/connection-schema.ts exists
- [x] src/server/features/connections/services/CredentialEncryption.ts exists
- [x] src/server/features/connections/services/CredentialEncryption.test.ts exists
- [x] drizzle/0020_site_connections.sql exists
- [x] Commit 4ac7cfa exists
- [x] Commit 5c91e12 exists
- [x] Commit a569026 exists
- [x] Commit f07524c exists
