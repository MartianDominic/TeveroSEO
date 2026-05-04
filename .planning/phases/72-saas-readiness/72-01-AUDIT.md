# Multi-Tenant Query Audit Report

**Phase:** 72-01 Multi-Tenancy Verification
**Date:** 2026-05-04
**Audited By:** GSD Executor

## Summary

Audited all repository files in `open-seo-main/src/server/features/*/repositories/*.ts` for workspace_id filtering compliance.

## Findings

### CRITICAL: getById Methods Without Workspace Filter

These methods retrieve records by ID without verifying workspace ownership, potentially allowing cross-tenant data access:

| Repository | Method | Risk Level | Recommendation |
|------------|--------|------------|----------------|
| FollowUpRepository | `findById(id)` | HIGH | Add workspaceId param or use assertTenantAccess at service layer |
| FollowUpRulesRepository | `findById(id)` | HIGH | Add workspaceId param or use assertTenantAccess at service layer |
| WorkflowRepository | `findById(id)` | HIGH | Add workspaceId param or use assertTenantAccess at service layer |
| WorkflowRepository | `getTemplateById(id)` | HIGH | Add workspaceId param or use assertTenantAccess at service layer |
| SignerRepository | `findById(id)` | MEDIUM | Signers are scoped via agreementId chain |
| SignerRepository | `findByToken(token)` | LOW | Token is secret, acts as auth |
| SignerRepository | `findByDokobitSession(sessionId)` | LOW | SessionId is secret, acts as auth |
| ContractRepository | `getContractById(id)` | HIGH | Add workspaceId param or use assertTenantAccess at service layer |
| InvoiceRepository | `getInvoiceById(id)` | HIGH | Add workspaceId param or use assertTenantAccess at service layer |
| InvoiceRepository | `getInvoiceByStripeId(stripeInvoiceId)` | MEDIUM | Stripe ID is secret, used for webhooks |
| InvoiceRepository | `getInvoiceByRevolutOrderId(revolutOrderId)` | MEDIUM | Revolut ID is secret, used for webhooks |
| ProjectRepository | `getProjectById(projectId)` | HIGH | Add organizationId param or use assertTenantAccess at service layer |

### COMPLIANT: Properly Scoped Methods

These methods correctly filter by workspace/organization:

| Repository | Methods |
|------------|---------|
| FollowUpRepository | `findByWorkspace`, `findUpcoming`, `findOverdue`, `findDueToday`, `countByStatus` |
| FollowUpRulesRepository | `findByWorkspace`, `findByEntityType` |
| WorkflowRepository | `findActiveByWorkspace`, `getTemplates` |
| ContractRepository | `getContractsByWorkspace`, `getContractsByClient` |
| InvoiceRepository | `getInvoicesByWorkspace`, `getInvoicesByClient` |
| ProjectRepository | `listProjects`, `getProjectForOrganization`, `listDeletedProjects` |
| TemplateRepository | `findAllTemplates`, `findDefaultTemplate` |
| PipelineMetricsRepository | All methods scoped by workspaceId |
| DealOutcomeRepository | All methods scoped by workspaceId |
| WorkspacePaymentSettingsRepository | All methods scoped by workspaceId |

### ACCEPTABLE: Entity-Scoped Methods

These methods filter by entity ID (e.g., agreementId), which inherits workspace scope:

| Repository | Method | Scope Chain |
|------------|--------|-------------|
| SignerRepository | `findByAgreement(agreementId)` | agreement -> workspace |
| SignerRepository | `findNextPending(agreementId)` | agreement -> workspace |
| FollowUpRepository | `findByEntity(entityType, entityId)` | entity -> workspace |

### SYSTEM: Global Queries (Authorized)

These methods intentionally query across all tenants for background processing:

| Repository | Method | Justification |
|------------|--------|---------------|
| FollowUpRepository | `findDueForUnsnooze` | System worker processing |
| WorkflowRepository | `findSnoozedDue` | System worker processing |
| WorkflowRepository | `resetWeeklyTouchCounts` | System maintenance |
| PipelineMetricsRepository | `purgeStaleMetrics` | System cleanup |

## Resolution Strategy

### Option A: Service-Layer Enforcement (Recommended)

Use `assertTenantAccess()` at the service layer after retrieval:

```typescript
// In service method:
const contract = await ContractRepository.getContractById(contractId);
assertTenantAccessOrThrow(ctx, contract, "contract");
return contract;
```

**Pros:**
- Repositories remain pure data access
- Service layer owns authorization
- Clear separation of concerns
- Existing repository tests don't break

**Cons:**
- Requires discipline to always call assertion
- Risk of forgetting in new service methods

### Option B: Repository-Level Enforcement

Add workspace parameter to all getById methods:

```typescript
async function getContractById(
  contractId: string,
  workspaceId: string
): Promise<ContractSelect | undefined> {
  return db.query.contracts.findFirst({
    where: and(
      eq(contracts.id, contractId),
      eq(contracts.workspaceId, workspaceId)
    ),
  });
}
```

**Pros:**
- Impossible to forget workspace check
- Query fails fast if wrong workspace

**Cons:**
- Breaking API change for all callers
- Webhook handlers need special treatment
- Some lookups legitimately cross-tenant (e.g., token-based access)

## Implemented Resolution

We chose **Option A** with service-layer enforcement using `assertTenantAccess()` helper created in Task 1.

All service methods that call unscoped repository methods MUST use assertTenantAccess before returning data to ensure cross-tenant access is blocked.

## Verification

E2E tests in `e2e/multi-tenant.spec.ts` verify:
1. User A cannot access User B's contracts/proposals/invoices
2. Cross-tenant API calls return 403
3. Rate limits are isolated per tenant
