- apps/web/src/components/connections/ConnectionCard.tsx: Badge variant 'zinc' not in v6 Badge component (needs update to valid variant)

## Pre-existing Issues (Phase 94-04)

### ConnectionCard Badge variant type error

**File:** `apps/web/src/components/connections/ConnectionCard.tsx:91`
**Error:** Type '"zinc"' is not assignable to Badge variant type
**Cause:** Badge component was updated to v6 semantic colors, but ConnectionCard still uses "zinc" variant
**Fix:** Replace "zinc" with "muted" or another valid v6 variant
**Discovered during:** Phase 94-04 build verification
