# Agent 17: RLS & Audit Logging

## Summary

Implemented comprehensive Row Level Security (RLS) policies and audit logging system to address security audit findings around data isolation and mutation tracking.

## Issues Fixed

- [x] CRITICAL: Created audit logging system with sensitive field redaction
- [x] CRITICAL: Created RLS policies for sensitive tables (clients, prospects, api_keys, etc.)
- [x] CRITICAL: Added RLS context middleware for request-scoped security
- [x] Applied audit logging to critical services (ClientService, ApiKeyService, ProspectService)

## Files Created

| File | Purpose |
|------|---------|
| `open-seo-main/src/db/audit.ts` | Audit logging schema and utilities |
| `open-seo-main/src/db/audit.test.ts` | Unit tests for audit logging |
| `open-seo-main/src/db/migrations/0033_add_rls_policies.sql` | RLS policy migration |
| `open-seo-main/src/server/middleware/rls-context.ts` | RLS context middleware |
| `open-seo-main/src/server/middleware/rls-context.test.ts` | Unit tests for RLS middleware |
| `open-seo-main/src/server/features/clients/services/ClientService.ts` | Client service with audit logging |
| `open-seo-main/src/server/features/api-keys/services/ApiKeyService.ts` | API key service with audit logging |

## Files Modified

| File | Changes |
|------|---------|
| `open-seo-main/src/server/features/prospects/services/ProspectService.ts` | Added audit logging to create, update, delete operations |

## Tables with RLS

| Table | Policy | Description |
|-------|--------|-------------|
| `clients` | `workspace_id` isolation | Users can only access clients in their organization |
| `prospects` | `workspace_id` isolation | Users can only access prospects in their organization |
| `prospect_keywords` | Via `prospect_id` | Isolated through parent prospect's workspace |
| `api_keys` | `organization_id` isolation | Users can only access API keys for their org |
| `audit_logs` | Admin only | Only admins can read audit logs; all can insert |
| `member` | `organization_id` + self | Users can see members in their org or their own membership |
| `invitation` | `organization_id` isolation | Users can only see invitations for their org |

## Audit Coverage

### Entities Tracked

- **Client** - All CRUD operations, GSC connection/disconnection, onboarding completion
- **Prospect** - Create, update, delete operations with before/after values
- **API Key** - Create, update, enable/disable, revoke, rotate operations

### Audit Log Fields

```typescript
{
  id: uuid,
  entityType: string,      // e.g., "client", "prospect", "api_key"
  entityId: string,        // ID of the affected entity
  action: string,          // "create" | "update" | "delete" | "read_sensitive"
  userId: string,          // Who performed the action
  userEmail: string,       // Email for readability
  organizationId: string,  // Org context
  ipAddress: string,       // Request IP
  userAgent: string,       // Browser/client info
  oldValues: jsonb,        // Before values (redacted)
  newValues: jsonb,        // After values (redacted)
  changedFields: string[], // Which fields changed
  requestId: string,       // For request tracing
  metadata: jsonb,         // Additional context
  createdAt: timestamp
}
```

### Sensitive Field Redaction

The following fields are automatically redacted in audit logs:
- `password`, `passwordHash`
- `secret`, `secretKey`
- `apiKey`, `keyHash`
- `refreshToken`, `accessToken`, `gscRefreshToken`
- `privateKey`, `credentials`

## RLS Context Middleware

### Usage

```typescript
import { setRLSContext, withRLSContext } from '@/server/middleware/rls-context';

// Option 1: Manual context setting
await setRLSContext({ userId: 'user_123', orgId: 'org_456' });
const clients = await db.select().from(clients);

// Option 2: Automatic context wrapper
const clients = await withRLSContext(
  { userId: auth.userId, orgId: auth.orgId },
  async () => db.select().from(clients)
);

// Option 3: Handler wrapper
const handler = createRLSHandler(async (input, ctx) => {
  return db.select().from(clients);
});
```

### Integration with Auth Middleware

```typescript
// In your auth middleware
import { setRLSContext } from '@/server/middleware/rls-context';

// After validating the JWT/session:
await setRLSContext({
  userId: decodedToken.sub,
  orgId: decodedToken.org_id,
  isAdmin: decodedToken.role === 'admin',
});
```

## Migration Instructions

1. Run the migration to create audit table and RLS policies:
   ```bash
   psql -d open_seo -f open-seo-main/src/db/migrations/0033_add_rls_policies.sql
   ```

2. Update your auth middleware to call `setRLSContext()` after authentication.

3. Test RLS policies are working:
   ```sql
   -- Set context
   SELECT set_user_context('user_123', 'org_456', false);
   
   -- This should only return clients for org_456
   SELECT * FROM clients;
   
   -- Clear context
   SELECT clear_user_context();
   ```

## Security Considerations

1. **RLS Bypass**: Superuser and table owners bypass RLS by default. Use `ALTER TABLE ... FORCE ROW LEVEL SECURITY` if needed.

2. **Connection Pooling**: RLS context is transaction-scoped. Ensure context is set at the start of each request when using connection pooling.

3. **Audit Log Integrity**: Audit logs allow INSERT from any context but only admin SELECT. Consider using a separate database user for writes if needed.

4. **Performance**: RLS adds overhead to queries. Indexes on `workspace_id`, `organization_id` columns are essential.

## Testing

Run the test suites:
```bash
cd open-seo-main
pnpm test src/db/audit.test.ts
pnpm test src/server/middleware/rls-context.test.ts
```

## Future Improvements

1. Add audit log retention policy (e.g., archive logs older than 90 days)
2. Add audit log search/filtering API for admin dashboard
3. Implement audit log export for compliance reporting
4. Add real-time audit alerts for suspicious activity
5. Consider separate audit database for high-volume scenarios
