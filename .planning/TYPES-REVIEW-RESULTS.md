# Type Safety & Error Handling Review
*Reviewer: Agent TYPES*

**Review Status:** COMPLETE
**Files Reviewed:** 1750+ TypeScript files (~28,700 lines)
**Issues Found:** Critical: 2, High: 6

## Critical Type Safety Issues

### CRIT-TYPES-01: `as any` usage for dynamic activity data access
- **File:** `/apps/web/src/app/(shell)/prospects/[prospectId]/contracts/[contractId]/page.tsx:134-135`
- **Issue:** `(activity.activityData as any).fromStatus` and `(activity.activityData as any).toStatus`
- **Risk:** No compile-time validation of activity data structure, null pointer exceptions possible
- **Fix:** Create discriminated union types for activity data based on activityType

### CRIT-TYPES-02: Explicit `type AnyRoute = any` declaration
- **File:** `/apps/web/src/app/page.tsx:3`
- **Issue:** Deliberate `any` type to bypass Next.js routing type checks
- **Risk:** Runtime navigation errors silently pass type checks
- **Fix:** Use proper Next.js Link/redirect types or type assertion with narrower type

## High Priority Type Issues

### HIGH-TYPES-01: Type assertions on database column reads without validation
- **File:** `/open-seo-main/src/server/features/prospects/services/PipelineService.ts:61`
- **Code:** `const fromStage = prospect.pipelineStage as PipelineStage`
- **Risk:** Database value could be invalid if enum changes
- **Fix:** Add runtime validation or use Drizzle's enum type

### HIGH-TYPES-02: Type assertions in TemplateService for enum validation
- **File:** `/open-seo-main/src/server/features/proposals/services/TemplateService.ts:111-132`
- **Pattern:** Multiple `as ProposalTemplateType` and `as ProposalTemplateCategory` casts
- **Risk:** Validation happens but assertion still required
- **Better:** Return validated type from guard function using type predicate

### HIGH-TYPES-03: Schema completeness checks using `as Record<string, unknown>`
- **File:** `/open-seo-main/src/server/lib/audit/checks/tier2/schema-completeness.ts`
- **Lines:** 41, 92, 155, 224, 275, 356, 369, 457
- **Risk:** JSON schema parsing without proper type guards
- **Fix:** Create Zod schemas for expected JSON-LD structures

### HIGH-TYPES-04: Language resolution service type assertions
- **File:** `/open-seo-main/src/server/services/LanguageResolutionService.ts:146-259`
- **Multiple:** `as SupportedLocale`, `as Formality` assertions on database values
- **Risk:** Database corruption could cause runtime failures
- **Fix:** Parse with validation functions that return Result types

### HIGH-TYPES-05: Webhook payload casting in Stripe handler
- **File:** `/open-seo-main/src/routes/api/webhooks/stripe.ts:59-70`
- **Code:** `const invoice = event.data.object as Stripe.Invoice`
- **Risk:** Event type might not match Invoice at runtime
- **Fix:** Use Stripe's built-in type guards or add runtime check

### HIGH-TYPES-06: Generic `Record<string, unknown>` for webhook/event payloads
- **Files:** Multiple services use `Record<string, unknown>` for event payloads
- **Locations:** `webhook-dispatcher.ts`, `event-registry.ts`, `alerts.ts`
- **Risk:** No type safety for payload structure
- **Fix:** Create typed event payload discriminated unions

## `any` Type Usage

| File | Line | Context | Should Be |
|------|------|---------|-----------|
| `apps/web/src/app/page.tsx` | 3 | `type AnyRoute = any` | `Route` from next/navigation |
| `apps/web/.../contracts/[contractId]/page.tsx` | 134-135 | `activity.activityData as any` | `StatusChangedActivityData` |
| `open-seo-main/src/routeTree.gen.ts` | 206+ | Auto-generated TanStack Router (acceptable) | N/A - generated |

## Type Assertion Audit

| File | Line | Assertion | Risk |
|------|------|-----------|------|
| `PipelineService.ts` | 61 | `as PipelineStage` | Medium - DB enum mismatch |
| `TemplateService.ts` | 111+ | `as ProposalTemplateType` | Low - validated before |
| `schema-completeness.ts` | 41+ | `as Record<string, unknown>` | Medium - JSON structure |
| `LanguageResolutionService.ts` | 146+ | `as SupportedLocale` | Medium - DB corruption |
| `pixel-analytics.service.ts` | 220 | `as DailyDataRow[]` | Medium - SQL result shape |
| `graph-service.ts` | 48, 59 | `as Record<string, ...>` | Low - FalkorDB typing gap |
| `singleflight.ts` | 106-108 | `as unknown as {...}` | Low - ioredis typing gap |

## Null Safety Gaps

1. **Optional chaining already widely used** - Good pattern observed across codebase
2. **Potential issue:** `activity.activityData` access without null check before property access
3. **DeltaResult.newHeaders** properly typed as `CachedHeaders | undefined`
4. **PaymentSession.rawResponse** typed as `unknown` - could benefit from typed discriminant

## Error Handling Patterns

| Pattern | Status | Notes |
|---------|--------|-------|
| Result types | PARTIAL | `AppError` class used, but no formal Result<T,E> |
| Error boundaries | OK | `ErrorBoundary` component in apps/web with proper props |
| Error typing | OK | `catch (error: unknown)` used in helper functions |
| Typed errors | OK | Custom errors (PaymentProviderNotConfiguredError, PaymentSessionError) |
| Error propagation | OK | Errors properly re-thrown after logging/handling |

## Positive Patterns Observed

1. **Discriminated unions for status enums**: `PROPOSAL_STATUS`, `PAYMENT_STATUS`, `CONTRACT_STATUS` use `as const` arrays with derived types
2. **Zod validation**: Input validators use Zod schemas with proper type inference
3. **Drizzle type inference**: `$inferSelect` and `$inferInsert` used consistently
4. **DB constraint checks**: SQL CHECK constraints mirror TypeScript enum values
5. **Generic type parameters**: `Singleflight<T>`, `SingleflightResult<T>` properly typed
6. **Type exports**: All schemas export Select/Insert types for consistent usage

## Recommendations

1. **Create ActivityDataMap discriminated union** for type-safe activity data access
2. **Add runtime enum validation functions** for database column reads
3. **Replace `Record<string, unknown>` with specific payload types** for webhook events
4. **Consider adding `strict: true` verification** to CI to prevent future regressions
5. **Create type guards for JSON-LD schema parsing** instead of unsafe casts
