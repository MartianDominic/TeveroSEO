# Agent 12: TypeScript Type Safety - open-seo-main

## Summary

Fixed critical TypeScript type safety issues in the open-seo-main TanStack Start application. Created reusable type guard utilities and database validators to eliminate unsafe patterns like `as any` casts and non-null assertions.

## Issues Fixed

- [x] CRITICAL: Fixed pool export in db/index.ts (was causing build errors in worker-entry.ts and server.ts)
- [x] CRITICAL: Created type guard utilities (`src/lib/type-guards.ts`)
- [x] CRITICAL: Created database validators (`src/lib/db-validators.ts`)
- [x] CRITICAL: Replaced unsafe casts in TriggerService.ts (4 `as any` casts removed)
- [x] CRITICAL: Replaced non-null assertions in LinkApplyService.ts (4 `!` assertions removed)
- [x] CRITICAL: Replaced unsafe cast in ProspectService.ts (1 `as any` cast removed)
- [x] CRITICAL: Replaced non-null assertion in ClassificationSingleflight.ts (1 `!` assertion removed)

## Files Created

### `/home/dominic/Documents/TeveroSEO/open-seo-main/src/lib/type-guards.ts`

Type-safe utilities including:
- `assertFound<T>()` - Assert database result exists, throws NotFoundError
- `firstOrNull<T>()` - Safe access to first query result
- `assertNonEmpty<T>()` - Assert array is not empty with type narrowing
- `isDefined<T>()` - Type guard for null/undefined check
- `filterDefined<T>()` - Filter out null/undefined with type narrowing
- `parseIntOrNull()` / `parseFloatOrNull()` - Safe numeric parsing
- `isEnumValue()` / `assertEnumValue()` - Type-safe enum validation
- `isRecord()` / `assertRecord()` / `hasKey()` - Object type guards
- `safeCast<T>()` - Runtime-validated type casting
- `extractNumber()` / `extractString()` / `extractBoolean()` / `extractStringArray()` - Safe property extraction from unknown objects

Custom error classes:
- `NotFoundError` (statusCode: 404)
- `ValidationError` (statusCode: 400)

### `/home/dominic/Documents/TeveroSEO/open-seo-main/src/lib/db-validators.ts`

Zod-based database validation including:
- `validateRow<T>()` - Validate single database row
- `validateRows<T>()` - Validate array of rows
- `validateRowOrNull<T>()` - Graceful validation (returns null on failure)
- `validateRowsFiltered<T>()` - Filter invalid rows instead of throwing
- `parseJsonbConfig<T>()` - Safe JSONB field parsing with defaults

Common schemas:
- `IdSchema`, `TimestampSchema`, `NullableTimestampSchema`
- `PositiveIntSchema`, `NonNegativeIntSchema`, `PercentageSchema`
- `UrlSchema`, `DomainSchema`, `EmailSchema`

Trigger config schemas (for TriggerService):
- `TrafficDropConfigSchema`
- `RankingDropConfigSchema`
- `RollbackScopeSchema`

Custom error class:
- `DatabaseValidationError` (statusCode: 500)

## Files Modified

### `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/index.ts`

**Change:** Added `export` to pool declaration

```typescript
// Before
const pool = new pg.Pool({...});

// After
export const pool = new pg.Pool({...});
```

### `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/features/changes/services/TriggerService.ts`

**Changes:**
1. Added imports for type guards and validators
2. Replaced `(config as any)?.cooldownHours` with `extractNumber(config, 'cooldownHours', 24)`
3. Replaced `config as any` in checkTrafficDrop with `parseJsonbConfig(config, TrafficDropConfigSchema, {...})`
4. Replaced `config as any` in checkRankingDrop with `parseJsonbConfig(config, RankingDropConfigSchema, {...})`
5. Changed function signatures to use typed configs (`TrafficDropConfig`, `RankingDropConfig`)
6. Replaced `any` type in updateTriggerTimestamps with proper typed object
7. Replaced `scope: any` in parseRollbackScope with `scope: unknown` and Zod validation

### `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/features/linking/services/LinkApplyService.ts`

**Changes:**
1. Added import for `assertFound`
2. Replaced `suggestion.sourcePageId!` with validated variable after `assertFound()`
3. Replaced `suggestion.replacementText!` with validated access after `assertFound()`
4. Replaced `suggestion.newSentence!` with validated access after `assertFound()`

### `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/features/prospects/services/ProspectService.ts`

**Changes:**
1. Added import for `isEnumValue`
2. Replaced `PROSPECT_STATUS.includes(input.status as any)` with `isEnumValue(input.status, PROSPECT_STATUS)`

### `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/features/keywords/services/ClassificationSingleflight.ts`

**Changes:**
1. Replaced `this.claimScript!()` with explicit null check before usage

## Build Errors Fixed

| File | Line | Error | Fix |
|------|------|-------|-----|
| worker-entry.ts | 23 | Module '"@/db"' has no exported member 'pool' | Added `export` to pool in db/index.ts |
| server.ts | 10 | Module '"@/db"' has no exported member 'pool' | Added `export` to pool in db/index.ts |

## Remaining Unsafe Patterns (Test Files Only)

The following `as any` patterns remain in **test files only** (acceptable for mocking):
- `VoiceAnalysisService.test.ts` - Mock implementations
- `prospectAutomation.test.ts` - Mock data
- `payment.test.ts` - Stripe mock events
- `dlq.test.ts` - Route handler access for testing
- `CsvImportService.test.ts` - Mock call assertions
- `health.$clientId.test.ts` - Route handler access for testing
- `PipelineService.test.ts` - Mock data

The `@ts-expect-error` patterns in `LithuanianNormalizer.test.ts` are intentional for testing runtime behavior with invalid inputs.

## Type Safety Improvements Summary

| Metric | Before | After |
|--------|--------|-------|
| `as any` casts in production code | 6 | 0 |
| Non-null assertions in production code | 5 | 0 |
| Type guard utilities | 0 | 15+ |
| Database validators | 0 | 10+ |
| Zod config schemas | 0 | 3 |

## Usage Examples

### Using assertFound for database queries

```typescript
import { assertFound } from '@/lib/type-guards';

const result = await db.query.keywords.findFirst({...});
assertFound(result, 'Keyword', keywordId);
// result is now typed as non-null
```

### Using validateRow for unknown data

```typescript
import { validateRow, TrafficDropConfigSchema } from '@/lib/db-validators';

const config = parseJsonbConfig(
  rawConfig,
  TrafficDropConfigSchema,
  { threshold: 20, comparisonPeriod: '7d' }
);
// config is now typed as TrafficDropConfig
```

### Using isEnumValue for status validation

```typescript
import { isEnumValue } from '@/lib/type-guards';

if (input.status && !isEnumValue(input.status, VALID_STATUSES)) {
  throw new ValidationError('Invalid status');
}
// status is now typed as enum member
```
