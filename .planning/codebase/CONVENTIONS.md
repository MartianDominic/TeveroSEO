# Coding Conventions

**Analysis Date:** 2026-04-22

## Naming Patterns

**Files:**
- Components: PascalCase (`AnimatedCounter.tsx`, `StickyCtaButton.tsx`, `AddProspectDialog.tsx`)
- Hooks: camelCase with `use` prefix (`useScrollSection.ts`, `useRoiCalculator.ts`, `usePaginatedClients.ts`)
- Utilities: camelCase (`server-fetch.ts`, `error-messages.ts`, `clientOAuth.ts`)
- Stores: camelCase with `Store` suffix (`clientStore.ts`, `contentCalendarStore.ts`)
- Schemas: kebab-case with `-schema` suffix (`ranking-schema.ts`, `prospect-schema.ts`)
- Tests: Same name as source file with `.test.ts` or `.test.tsx` suffix

**Functions:**
- camelCase for all functions (`fetchClients`, `setActiveClient`, `getProspects`)
- Async functions: often prefixed with action verb (`fetchKeywordIdeasRaw`, `createDataforseoClient`)
- Event handlers: `handle` prefix not required, but common in React components

**Variables:**
- camelCase for regular variables (`activeClientId`, `remainingAnalyses`)
- SCREAMING_SNAKE_CASE for constants (`RANKING_QUEUE_NAME`, `AUTUMN_SEO_DATA_BALANCE_FEATURE_ID`)

**Types:**
- PascalCase for interfaces and types (`Prospect`, `ClientStore`, `KeywordRankingSelect`)
- Type suffixes: `Select` for DB select types, `Insert` for DB insert types
- Schema exports: `z.infer<typeof schema>` pattern for Zod-derived types

## Code Style

**Formatting:**
- Tool: Prettier (open-seo-main)
- ESLint: `next/core-web-vitals` (apps/web)
- Linting: oxlint with `--type-aware` (open-seo-main)

**Key settings:**
- Double quotes for strings
- Semicolons at end of statements
- 2-space indentation
- Trailing commas in multi-line structures

## Import Organization

**Order:**
1. External packages (React, Next.js, libraries)
2. Internal aliases (`@/`, `@tevero/types`, `@tevero/ui`)
3. Relative imports (same directory or child)

**Path Aliases:**
- `@/*` - Maps to `./src/*` in both apps/web and open-seo-main
- `@tevero/types` - Shared types package (`packages/types/src`)
- `@tevero/ui` - Shared UI components (`packages/ui/src`)

**Import examples:**
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { PageHeader } from "@tevero/ui";
import { getProspects, getRemainingAnalyses } from "./actions";
```

## Error Handling

**Patterns:**
- Centralized error codes in `@/shared/error-codes.ts` with Zod schema validation
- `AppError` class wraps error codes for typed error handling
- `toClientError()` sanitizes internal errors for client-facing responses
- Server actions return typed results or throw `AppError`

**Error code pattern:**
```typescript
const ERROR_CODES = [
  "UNAUTHENTICATED",
  "PAYMENT_REQUIRED",
  "NOT_FOUND",
  "INTERNAL_ERROR",
  // ...
] as const;

export type ErrorCode = z.infer<typeof errorCodeSchema>;
```

**Server-side error handling:**
```typescript
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AppError";
  }
}
```

## Logging

**Framework:** No centralized logging framework detected in apps/web. open-seo-main uses `createLogger()` pattern.

**Patterns:**
- Use `createLogger()` factory for module-specific loggers
- Log levels: `info`, `error`, `warn`
- Avoid `console.log` in production code

## Comments

**When to Comment:**
- File header docblocks for modules (`/** ... */`)
- Phase references in test files (`Phase 30: Interactive Proposal Page`)
- TDD markers in test files (`TDD: Tests written FIRST before implementation`)
- Complex logic explanations when intent is non-obvious

**JSDoc/TSDoc:**
- Used for exported functions and types
- Drizzle schema tables have description comments
- Test files include docblocks explaining test purpose

**Example:**
```typescript
/**
 * Daily rank position snapshots for saved keywords.
 * One row per keyword per day, storing position and SERP features.
 */
export const keywordRankings = pgTable("keyword_rankings", { ... });
```

## Function Design

**Size:** Keep functions focused; extract helpers for complex logic

**Parameters:** 
- Use object destructuring for multiple parameters
- Configuration objects for hooks and factories

**Return Values:**
- Explicit return types on public functions
- Async functions return `Promise<T>`
- Hooks return object with state and actions

**Hook pattern:**
```typescript
export const useClientStore = create<ClientStore>()(
  persist(
    (set, get) => ({
      // State
      clients: [],
      activeClientId: null,
      // Actions
      fetchClients: async () => { ... },
      setActiveClient: (id: string) => { ... },
    }),
    { ... }
  )
);
```

## Module Design

**Exports:**
- Named exports preferred over default exports
- Barrel files (`index.ts`) for package entry points
- Type exports alongside value exports

**Barrel Files:**
- `packages/ui/src/index.ts` - Exports all UI components
- `src/db/schema.ts` - Re-exports all schema modules
- Keep barrel files alphabetically sorted

**Example barrel:**
```typescript
export { cn } from "./lib/utils";
export { Badge, badgeVariants } from "./components/badge";
export type { BadgeProps } from "./components/badge";
export { Button, buttonVariants } from "./components/button";
```

## React Component Patterns

**Component structure:**
```typescript
"use client"; // Client directive when needed

import * as React from "react";
import { cn } from "@tevero/ui";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
```

**Styling:**
- Tailwind CSS for all styling
- `cn()` utility for conditional class merging
- `cva` (class-variance-authority) for component variants

## Server Actions (Next.js)

**Pattern:**
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { getOpenSeo, postOpenSeo } from "@/lib/server-fetch";

export async function getProspects(params: { pageSize: number }) {
  return getOpenSeo<ProspectResponse>(`/prospects?pageSize=${params.pageSize}`);
}
```

## Database Schema (Drizzle ORM)

**Pattern:**
```typescript
import { pgTable, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const tableName = pgTable(
  "table_name",
  {
    id: text("id").primaryKey(),
    fieldName: text("field_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_table_field").on(table.fieldName),
  ],
);

export type TableSelect = typeof tableName.$inferSelect;
export type TableInsert = typeof tableName.$inferInsert;
```

## State Management

**Zustand stores:**
- Separate state interface from actions interface
- Use `persist` middleware for client-side persistence
- Cookie storage for cross-tab sync when needed

**React Query:**
- TanStack Query for server state
- Queries in custom hooks or direct usage
- Mutations with optimistic updates where appropriate

## Validation

**Zod schemas:**
- Define schemas alongside types
- Use `z.infer<typeof schema>` for type derivation
- Schema-based validation at API boundaries

```typescript
import { z } from "zod";

const ERROR_CODES = ["UNAUTHENTICATED", "PAYMENT_REQUIRED"] as const;
export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;
```

---

*Convention analysis: 2026-04-22*
