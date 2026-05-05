# Coding Conventions

**Analysis Date:** 2026-05-05

## Naming Patterns

**Files:**
- TypeScript: kebab-case for files (`constraint-filter.ts`, `voice-schema.ts`)
- React components: kebab-case files, PascalCase exports (`step-indicator.tsx` exports `ConnectionStepIndicator`)
- Tests: `*.test.ts`, `*.test.tsx`, `*.spec.ts` co-located with source
- Python: snake_case (`voice_constraint_service.py`, `test_internal_link_inserter.py`)

**Functions:**
- TypeScript: camelCase (`sanitizeHtml`, `checkGeoFilter`, `runWithRequestId`)
- Python: snake_case (`fetch_voice_constraints`, `_build_fallback_constraints`)

**Variables:**
- TypeScript: camelCase for variables, SCREAMING_SNAKE_CASE for constants
- Python: snake_case, SCREAMING_SNAKE_CASE for constants

**Types/Interfaces:**
- TypeScript: PascalCase (`FilterConstraints`, `WizardState`, `VoiceConstraintResult`)
- Prefix interfaces with purpose, not `I` (`FilterResult`, not `IFilterResult`)
- Python: PascalCase for classes, dataclasses for structured data

**Enums:**
- TypeScript: Zod schemas with `z.enum()` preferred over TypeScript enums
- Python: `Enum` class with `value` attribute (`VoiceConstraintStatus.SUCCESS.value == "success"`)

## Code Style

**Formatting:**
- TypeScript: Prettier
- open-seo-main: `prettier --check .` / `prettier . --write`
- apps/web: ESLint + Prettier integration
- Python: No explicit formatter config (likely Black/Ruff by convention)

**Linting:**
- open-seo-main: OxLint with type-aware rules (`oxlint . --type-aware`)
- apps/web: ESLint with `next/core-web-vitals` + import ordering rules
- Python: No explicit config (likely Ruff/Flake8)

**Key Rules:**
- `no-console` in apps/web (warn level, `console.error` allowed)
- Strict import ordering enforced via `eslint-plugin-import`

## Import Organization

**Order (apps/web .eslintrc.json enforced):**
1. Built-in modules (`react`, `next/*`)
2. External packages (npm dependencies)
3. Internal aliases (`@/*`, `@tevero/*`)
4. Parent/sibling imports
5. Index imports
6. Type imports (last)

**Example:**
```typescript
import { useState, useCallback } from "react";

import { z } from "zod";

import { connectApi } from "@/lib/api/connect";
import { getAdaptiveDelay } from "@/lib/polling/adaptive-poll";

import type { DetectionResult } from "./types";
```

**Path Aliases:**
- open-seo-main: `@/` -> `src/`, `@/db` -> `src/db/`, `@/server` -> `src/server/`
- apps/web: `@/` -> `src/`, `@tevero/types`, `@tevero/ui`, `@tevero/utils`

## Error Handling

**Patterns:**

TypeScript - Zod validation at boundaries:
```typescript
const schema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  platform: z.enum(["wordpress", "shopify", "wix"]),
  siteUrl: z.string().url("Invalid site URL"),
});
const result = schema.safeParse(input);
if (!result.success) {
  throw new Error(result.error.message);
}
```

TypeScript - Error codes with `errorCodeSchema`:
```typescript
// src/shared/error-codes.ts
export const errorCodeSchema = z.enum([
  "UNAUTHENTICATED",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "INTERNAL_ERROR",
  // ...
]);
```

Python - Result objects with status enums:
```python
@dataclass
class VoiceConstraintResult:
    status: VoiceConstraintStatus
    constraints: Optional[str]
    error_message: Optional[str] = None
    
    @property
    def is_success(self) -> bool:
        return self.status == VoiceConstraintStatus.SUCCESS
    
    @property
    def is_error(self) -> bool:
        return self.status in (VoiceConstraintStatus.API_ERROR, ...)
```

**API Error Classes:**
```typescript
// apps/web - Custom error class
export class ConnectApiError extends Error {
  status: number;
  code?: string;
  
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ConnectApiError";
    this.status = status;
    this.code = code;
  }
}
```

## Logging

**Framework:**
- open-seo-main: Custom structured logger (`@/server/lib/logger.ts`)
- AI-Writer: Loguru
- apps/web: Sentry for errors, console.error allowed

**Patterns:**

```typescript
// open-seo-main - createLogger with module context
import { createLogger } from "@/server/lib/logger";
const log = createLogger({ module: "server" });
log.info("Processing request");
log.error("Migration failed", err);
```

```python
# AI-Writer - Loguru
from loguru import logger
logger.info("Fetching voice constraints")
logger.error(f"API error: {e}")
```

**Features:**
- Correlation IDs via AsyncLocalStorage (`runWithRequestId()`)
- Environment-aware formatting (JSON in prod, colorized in dev)
- Log level filtering via `LOG_LEVEL` env var

## Comments

**When to Comment:**
- Phase references in headers: `Phase 66-04: Connection Wizard UI`
- Security notes: `SECURITY: This configuration...`
- TODO with phase: `// TODO(P40): Implement topic cluster detection`
- Fix references: `HIGH-V-01 FIX: Makes TypeScript VoiceConstraintBuilder...`

**JSDoc/TSDoc:**
```typescript
/**
 * Sanitize HTML content using DOMPurify with strict configuration.
 *
 * CRITICAL: Always use this function instead of regex-based sanitization.
 *
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string safe for rendering
 *
 * @example
 * const clean = sanitizeHtml(untrustedContent);
 */
export function sanitizeHtml(html: string): string { ... }
```

**Python docstrings:**
```python
"""
Voice Constraint Service

Fetches voice constraints from the TypeScript open-seo-main API.

Phase 37-05: Voice integration for AI-Writer

HIGH-V-01 FIX: Makes TypeScript VoiceConstraintBuilder the single source of truth.
"""
```

## Function Design

**Size:** Functions typically 20-50 lines, max ~100 lines

**Parameters:**
- Use options objects for >3 parameters
- Destructure in function signature when appropriate
```typescript
export interface ConstraintFilterOptions {
  constraints?: FilterConstraints;
  priorities?: CategoryPriorityInput[];
}

constructor(options: ConstraintFilterOptions = {}) { ... }
```

**Return Values:**
- Use result objects for operations that can fail
- Include status, data, and error information
- Use `null` for optional values, not `undefined`

## Module Design

**Exports:**
- Named exports preferred over default exports
- Re-export from index files for clean imports
- Barrel files in `packages/types/src/index.ts`

**Example barrel file:**
```typescript
export type { Client } from "./client";
export type { Project } from "./project";
export * from "./events";
export {
  QUALITY_THRESHOLDS,
  getScoreColorFromThreshold,
  passesQualityGate,
} from "./scoring";
```

**Class Design:**
```typescript
export class ConstraintFilter {
  private constraints: FilterConstraints;
  private scorer: CompositeScorer;
  private stats: FilterStats;

  constructor(options: ConstraintFilterOptions = {}) { ... }

  filter(input: ClassifiedKeywordInput): FilterResult { ... }
}
```

## Security Patterns

**Input Sanitization:**
- DOMPurify with allowlist config for HTML (`sanitizeHtml`, `sanitizeMinimalHtml`, `stripHtml`)
- Zod schemas at API boundaries
- URL validation before use

**Environment Validation:**
```typescript
// Fail fast on missing required environment variables
validateEnv(requiredEnvVars);
```

```python
# SECURITY: Environment validation MUST run before any other imports
from config.env_validator import validate_env
validate_env()
```

**Secrets:**
- Never hardcode secrets
- Validate env vars at startup
- Use encryption for stored credentials

## Immutability

**Spread for updates (not mutation):**
```typescript
// Correct
this.stats = {
  total: 0,
  passed: 0,
  excludedByGeo: 0,
  // ...
};

// For updates, create new object
const newStats = { ...this.stats, total: this.stats.total + 1 };
```

**Python dataclasses:**
```python
@dataclass
class VoiceConstraintResult:
    status: VoiceConstraintStatus
    constraints: Optional[str]
    # Immutable by default
```

---

*Convention analysis: 2026-05-05*
