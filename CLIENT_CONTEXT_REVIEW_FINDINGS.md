# Client Context Review Findings

*Agent: Client Context Integration Specialist*
*Date: 2026-05-03*

---

## Client Context Architecture Overview

The TeveroSEO platform implements multi-tenant isolation using `client_id` as the shared entity identifier across all three services:

1. **apps/web (Next.js)**: Manages client state via Zustand store with cookie persistence (`tevero-active-client-id`)
2. **open-seo-main (TanStack Start)**: Receives client context via `X-Client-ID` header, validates ownership via cached lookups
3. **AI-Writer (FastAPI)**: Receives `X-Client-ID` header, enforces RBAC via `ClientUserAccess` table

**Cross-Service Client Flow**:
- User selects client in apps/web UI -> Zustand store updates -> Cookie persisted
- API calls include `X-Client-ID` header extracted from store/cookie
- Backends validate user has access to that client before processing

---

## CRITICAL Issues

### [CRITICAL-01] Empty X-Client-ID Header Passed When Client ID is Null

- **Location**: `/open-seo-main/src/serverFunctions/briefs.ts:86,117,150,181,213,246,283,323`
- **Description**: Multiple server functions pass empty string when `context.clientId` is null/undefined using the pattern `"X-Client-ID": context.clientId || ""`. AI-Writer's `get_client_context()` returns `None` when the header is empty, potentially bypassing client-scoped authorization.
- **Impact**: If AI-Writer endpoints don't explicitly require client context, requests with empty `X-Client-ID` could access global/default data or cause authorization bypasses.
- **Evidence**:
```typescript
// briefs.ts line 86
const response = await fetch(`${AI_WRITER_URL}/api/content/briefs`, {
  headers: {
    "X-Client-ID": context.clientId || "",  // Empty string when null
    // ...
  },
});
```
```python
# AI-Writer client_context.py
async def get_client_context(..., x_client_id: str = Header(None)):
    if not x_client_id:
        return None  # Returns None, not error
```
- **Recommendation**: 
  1. Fail-fast when `context.clientId` is null in open-seo-main server functions
  2. Add `require_client_context` dependency in AI-Writer that throws 400 if client ID is missing
  3. Audit all AI-Writer endpoints to ensure they handle `None` client context safely

---

## HIGH Issues

### [HIGH-01] Race Condition During Client Switching

- **Location**: `/apps/web/src/stores/clientStore.ts:129-139`
- **Description**: When switching clients via `setActiveClient()`, the store updates immediately but dependent API calls may still be in-flight with the previous client ID. The `isInitialized` flag and `lastValidatedAt` timestamp help but don't fully prevent race conditions.
- **Impact**: During rapid client switching, API responses for client A could be displayed while client B is now active, causing data confusion.
- **Evidence**:
```typescript
setActiveClient: (client) => {
  const prev = get().activeClient;
  if (prev?.id !== client.id) {
    set({
      activeClient: client,
      activeClientId: client.id,
      lastValidatedAt: Date.now(),
    });
    // FIX-17: Invalidate dependent caches
    get()._invalidateDependentCaches(client.id);
  }
}
```
- **Recommendation**: 
  1. Add request-scoping by including client ID in request keys
  2. Cancel in-flight requests when client changes using AbortController
  3. Add optimistic UI locking during client switch until dependent data refreshes

---

### [HIGH-02] Ownership Cache TTL Mismatch Between Services

- **Location**: 
  - `/open-seo-main/src/lib/auth/client-ownership.ts:9`: `OWNERSHIP_CACHE_TTL = 30` seconds
  - AI-Writer uses real-time `ClientUserAccess` table lookup (no TTL)
- **Description**: open-seo-main caches ownership verification for 30 seconds in Redis, while AI-Writer performs fresh DB lookups. If a user's access is revoked, open-seo-main may continue allowing requests for up to 30 seconds.
- **Impact**: 30-second window where revoked access is still valid in open-seo-main while AI-Writer immediately blocks.
- **Evidence**:
```typescript
// client-ownership.ts
const OWNERSHIP_CACHE_TTL = 30; // seconds
export async function getCachedOwnership(userId: string, clientId: string) {
  const cacheKey = `ownership:${userId}:${clientId}`;
  // ... Redis lookup with TTL
}
```
- **Recommendation**: 
  1. Reduce cache TTL to 5-10 seconds for security-sensitive operations
  2. Implement cache invalidation via Redis pub/sub (AI-Writer already has `_emit_access_revoked_event()`)
  3. Have open-seo-main subscribe to revocation events and clear specific cache keys

---

### [HIGH-03] apps/web API Routes Missing Defense-in-Depth Verification

- **Location**: `/apps/web/src/app/api/` (multiple routes)
- **Description**: Several API routes in apps/web accept `X-Client-ID` from the client and forward it to backends without verifying the current user has access to that client. The backends perform authorization, but apps/web doesn't apply defense-in-depth.
- **Impact**: If a backend authorization check has a bug, apps/web provides no fallback protection.
- **Evidence**:
```typescript
// Example pattern in multiple routes
const clientId = request.headers.get('X-Client-ID');
// Forwarded without checking user's ClientUserAccess
const response = await fetch(`${backendUrl}/api/...`, {
  headers: { 'X-Client-ID': clientId }
});
```
- **Recommendation**: Add middleware or utility in apps/web that validates `X-Client-ID` against user's accessible clients before forwarding requests.

---

## MEDIUM Issues

### [MEDIUM-01] Client ID Cookie Accessible to JavaScript

- **Location**: `/apps/web/src/lib/cookies.ts:5-19`
- **Description**: The `ACTIVE_CLIENT_COOKIE` is stored without `httpOnly` flag, making it accessible to JavaScript and vulnerable to XSS-based tampering.
- **Impact**: An XSS attack could modify the active client cookie to access different client data.
- **Evidence**:
```typescript
// cookies.ts
import Cookies from 'js-cookie';
export const ACTIVE_CLIENT_COOKIE = "tevero-active-client-id";

export const cookieStorage = {
  getItem: (name: string) => {
    const value = Cookies.get(name);  // Client-side accessible
    return value ? JSON.stringify(value) : null;
  },
  setItem: (name: string, value: string) => {
    Cookies.set(name, JSON.parse(value), { expires: 365 });  // No httpOnly
  },
  // ...
};
```
- **Recommendation**: Since the cookie is used for client-side state hydration, consider:
  1. Adding `SameSite: Strict` and `Secure` flags
  2. Validating cookie value server-side before trusting it
  3. The store's `validateActiveClient()` already helps but runs asynchronously

---

### [MEDIUM-02] Optional client_id Parameter Inconsistency

- **Location**: Various AI-Writer endpoints
- **Description**: Some AI-Writer endpoints have `client_id` as optional query parameter, others as required path parameter, and others read from header only. This inconsistency can lead to confusion about which client's data is being accessed.
- **Impact**: Developers may incorrectly assume client scoping is applied when it isn't.
- **Evidence**:
```python
# Pattern A: Required path param
@router.get("/clients/{client_id}/briefs")

# Pattern B: Optional query param
@router.get("/briefs")
def get_briefs(client_id: Optional[str] = None):

# Pattern C: Header only
@router.get("/voice-profiles")
def get_profiles(client_ctx: ClientContext = Depends(get_client_context)):
```
- **Recommendation**: Standardize on header-based client context for all endpoints, with explicit `require_client_context` dependency for client-scoped operations.

---

### [MEDIUM-03] Background Job Context Propagation Not Verified

- **Location**: `/AI-Writer/backend/services/background_jobs.py`, `/open-seo-main/src/server/workers/`
- **Description**: When jobs are queued, `client_id` is stored in job data but not verified at execution time against any current authorization state.
- **Impact**: If a user's access to a client is revoked between job queuing and execution, the job still runs with that client context.
- **Evidence**:
```python
# background_jobs.py
job = scheduler.add_job(
    func=process_brief,
    kwargs={"client_id": client_id, ...}  # Captured at queue time
)
# No re-verification at execution
```
- **Recommendation**: For sensitive operations, re-verify user-client access at job execution time, or use short-lived job authorization tokens.

---

### [MEDIUM-04] Client Context Parameter Naming Inconsistency

- **Location**: Multiple files across all services
- **Description**: The client identifier parameter uses different names: `client_id`, `clientId`, `workspace_id`, `workspaceId`. While these may represent different concepts in some contexts, the inconsistency is confusing.
- **Impact**: Code maintenance difficulty, potential bugs from using wrong parameter.
- **Evidence**:
```typescript
// open-seo-main uses clientId (camelCase)
context.clientId

// AI-Writer uses client_id (snake_case)
client_id: str

// Some endpoints use workspace_id
workspace_id: Optional[str]
```
- **Recommendation**: Create TypeScript/Python type aliases that document the relationship between these identifiers and when each should be used.

---

### [MEDIUM-05] Missing workspace_id in Cross-Service Calls

- **Location**: `/open-seo-main/src/serverFunctions/briefs.ts`
- **Description**: Several server functions pass `X-Client-ID` but not `X-Workspace-ID` to AI-Writer, despite workspace being a separate concept in some contexts.
- **Impact**: AI-Writer may not have full context for workspace-scoped operations.
- **Evidence**:
```typescript
const response = await fetch(`${AI_WRITER_URL}/api/content/briefs`, {
  headers: {
    "X-Client-ID": context.clientId || "",
    // Missing X-Workspace-ID
  },
});
```
- **Recommendation**: Audit which operations require workspace context and ensure it's propagated consistently.

---

## LOW Issues

### [LOW-01] Store Persistence May Cause Stale Client on Return Visit

- **Location**: `/apps/web/src/stores/clientStore.ts:22-25`
- **Description**: The Zustand store persists `activeClientId` to cookies. If a user returns after their access to that client was revoked, the stale ID persists until `validateActiveClient()` runs.
- **Impact**: Brief UX confusion; the store does eventually validate and clear invalid state.
- **Evidence**:
```typescript
partialize: (state) => ({
  activeClientId: state.activeClientId,
  // Only persists ID, not full client
}),
```
- **Recommendation**: Current validation logic (FIX-03) handles this case. Consider showing explicit "client access changed" message.

---

### [LOW-02] Inconsistent Naming Between "Client" and "Workspace"

- **Location**: Platform-wide
- **Description**: The codebase uses both "client" and "workspace" terminology. From code analysis: `client_id` is the tenant identifier from AI-Writer's `clients` table, while `workspace_id` appears to be a Clerk organization concept.
- **Impact**: Developer confusion about which ID to use where.
- **Recommendation**: Document the semantic difference in CLAUDE.md or architecture docs.

---

### [LOW-03] TypeScript Types for Client Context Not Strictly Enforced

- **Location**: `/open-seo-main/src/serverFunctions/briefs.ts`
- **Description**: The `context.clientId` is typed as `string | undefined` but used with `|| ""` fallback rather than strict null checking.
- **Impact**: TypeScript doesn't catch the "empty string passed to backend" issue.
- **Evidence**:
```typescript
// Could be undefined, resulting in empty string
"X-Client-ID": context.clientId || "",
```
- **Recommendation**: Change type to `string` (required) or use explicit null handling with early return/error.

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH | 3 |
| MEDIUM | 5 |
| LOW | 3 |
| **TOTAL** | **12** |

---

## Positive Security Patterns Observed

1. **ClientUserAccess RBAC table** in AI-Writer provides granular per-client authorization
2. **Fail-closed authorization** in `require_client_access` dependency
3. **Redis pub/sub for access revocation** events (`_emit_access_revoked_event()`)
4. **Ownership cache with TTL** in open-seo-main prevents repeated DB hits
5. **Store validation on init** (`validateActiveClient()`) catches stale state
6. **Role hierarchy** (admin > editor > viewer) properly enforced

---

## Recommended Priority Actions

1. **CRITICAL**: Fix empty `X-Client-ID` header issue in briefs.ts - add null check and fail-fast
2. **HIGH**: Implement request cancellation on client switch to prevent race conditions
3. **HIGH**: Add cache invalidation subscription in open-seo-main for real-time access revocation
4. **HIGH**: Add defense-in-depth client access verification in apps/web API layer

---

*This content should be merged into COMPREHENSIVE_CODE_REVIEW_V4.md between CLIENT_CONTEXT_START and CLIENT_CONTEXT_END markers.*
