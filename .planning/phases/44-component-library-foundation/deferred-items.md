# Deferred Items - Phase 44

## Out-of-Scope Issues Discovered During Plan 44-02

### typography.tsx TypeScript Errors

**File:** `packages/ui/src/components/typography.tsx` (untracked, created by 44-03)

**Errors:**
- `error TS2503: Cannot find namespace 'JSX'`
- `error TS2604: JSX element type 'Component' does not have any construct or call signatures`
- `error TS2786: 'Component' cannot be used as a JSX component`

**Status:** Untracked file - should be fixed and committed by the plan that created it (44-03)

**Root cause:** The `as` prop pattern needs proper typing with `React.ElementType` instead of using raw keyof intrinsic elements.

---

**Logged by:** Plan 44-02 executor
**Date:** 2026-04-30
