# Agent 07: API Authentication - open-seo-main

## Summary

Enhanced the authentication system in open-seo-main to provide comprehensive security coverage for all API endpoints. Implemented unified authentication supporting both API keys and JWT sessions, plus webhook signature verification for external providers.

## Issues Fixed

- [x] CRITICAL: Enhanced auth middleware with unified API key + JWT session support
- [x] CRITICAL: Created webhook signature verification middleware for Stripe, Clerk, GitHub
- [x] CRITICAL: API keys properly hashed with SHA-256 before storage (already implemented)
- [x] HIGH: Applied auth middleware to previously unprotected routes (`/api/proposals/generate`, `/api/detect-platform`)
- [x] HIGH: Updated SEO middleware to use proper authentication instead of placeholder
- [x] MEDIUM: Exported authorization helpers from middleware index
- [x] MEDIUM: Added timing-safe comparison utility for secret validation

## Files Created

### `/open-seo-main/src/server/middleware/webhook-auth.ts`
New webhook signature verification middleware supporting:
- **Stripe**: Uses `stripe-signature` header with timestamp validation
- **Clerk**: Uses Svix signatures (`svix-signature`, `svix-timestamp`)
- **GitHub**: Uses `x-hub-signature-256` with HMAC-SHA256
- **Generic**: Extensible for custom webhook providers

Key features:
- Timing-safe signature comparison to prevent timing attacks
- Timestamp validation for replay attack protection (configurable max age)
- Extensible provider registration for custom webhooks
- Middleware factory for easy route integration

## Files Modified

### `/open-seo-main/src/server/middleware/auth.ts`
Enhanced with:
- `authenticateRequest()`: Unified auth supporting API keys (oseo_ prefix) and Clerk JWT
- `requireUnifiedAuth()`: Route wrapper for dual authentication
- `hashApiKeyForStorage()`: Explicit export for API key hashing
- `secureCompare()`: Timing-safe string comparison utility
- `authMethod` field in `AuthContext` to track authentication type

### `/open-seo-main/src/server/middleware/index.ts`
Expanded exports to include:
- All auth functions including new unified auth
- Authorization helpers (`checkClientAccess`, `requireClientAccess`, etc.)
- Webhook verification functions
- Rate limiting utilities

### `/open-seo-main/src/routes/api/seo/-middleware.ts`
Replaced placeholder authentication with:
- Real authentication using `authenticateRequest()`
- Support for both API key and JWT auth methods
- Proper error handling with AppError
- `requireApiAuthWithScope()` for permission-based access control

### `/open-seo-main/src/routes/api/proposals/generate.ts`
Added:
- Authentication requirement via `requireApiAuth()`
- Proper error handling for UNAUTHENTICATED/FORBIDDEN responses

### `/open-seo-main/src/routes/api/detect-platform.ts`
Added:
- Authentication requirement via `requireApiAuth()`
- Proper error handling for authentication failures

## Authentication Flow

### 1. API Key Authentication
```
Request with Authorization: Bearer oseo_xxx
    |
    v
extractApiKey() -> hashApiKey() -> DB lookup
    |
    v
Validate: enabled=true, not expired
    |
    v
Return AuthContext with organizationId, userId, scopes
```

### 2. JWT Session Authentication
```
Request with Authorization: Bearer <jwt>
    |
    v
verifyClerkJWT() -> JWKS validation
    |
    v
Extract userId, email from claims
    |
    v
Return AuthContext with authMethod="jwt"
```

### 3. Webhook Verification
```
Incoming webhook POST
    |
    v
Extract signature header (provider-specific)
    |
    v
Compute expected HMAC signature
    |
    v
Timing-safe comparison
    |
    v
Timestamp validation (if applicable)
    |
    v
Return verified payload or 401
```

## Security Patterns Implemented

### API Key Security
- Keys stored as SHA-256 hashes (never raw)
- Key format validation (`oseo_` prefix required)
- Expiration checking
- Scope-based permission model
- Last-used timestamp tracking (fire-and-forget)

### Webhook Security
- HMAC signature verification
- Timing-safe comparisons (prevents timing attacks)
- Timestamp validation (prevents replay attacks)
- Provider-specific signature parsing (Stripe, Svix formats)

### Route Protection
- All protected routes require authentication
- AppError with proper HTTP status codes (401/403)
- Logging of authentication failures for security audit

## Environment Variables Required

```bash
# API Authentication
CLERK_PUBLISHABLE_KEY=pk_xxx  # For JWT verification

# Webhook Secrets
STRIPE_WEBHOOK_SECRET=whsec_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx
GITHUB_WEBHOOK_SECRET=xxx

# Internal API (admin routes)
INTERNAL_API_KEY=xxx
```

## Usage Examples

### Protecting a Route with Unified Auth
```typescript
import { requireUnifiedAuth } from "@/server/middleware";

export async function GET({ request }) {
  return requireUnifiedAuth(request, async (auth) => {
    // auth.authMethod is "api_key" or "jwt"
    const data = await fetchData(auth.organizationId);
    return Response.json(data);
  });
}
```

### Verifying Webhook Signatures
```typescript
import { verifyWebhookSignature } from "@/server/middleware";

export async function POST({ request }) {
  const result = await verifyWebhookSignature("clerk", request);
  if (!result.verified) {
    return Response.json({ error: result.error }, { status: 401 });
  }
  
  const payload = JSON.parse(result.payload!);
  // Process webhook...
}
```

### Using Webhook Middleware Factory
```typescript
import { createWebhookAuthMiddleware } from "@/server/middleware";

const verifyGithub = createWebhookAuthMiddleware("github");

export async function POST({ request }) {
  const authResponse = await verifyGithub(request);
  if (authResponse) return authResponse; // 401 on failure
  
  const payload = (request as any).webhookPayload;
  // Process webhook...
}
```

## Testing Recommendations

1. **Unit Tests**: Add tests for `authenticateRequest()` with various auth scenarios
2. **Integration Tests**: Test webhook signature verification with real signatures
3. **Security Tests**: Verify timing-safe comparisons work correctly
4. **E2E Tests**: Test protected routes return 401 without auth

## Pre-existing Issues (Not Fixed)

The following TypeScript errors existed before this work and are unrelated:
- `/api/proposals/generate.ts`: TanStack import issues (`json`, `APIEvent`)
- Various routes: Missing schema exports (`reports`, `clientBranding`, etc.)

These are infrastructure issues that need separate attention.

## Verification

```bash
# Check middleware compiles
cd open-seo-main
npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "(middleware|webhook-auth)"
# Should return no output (no errors)
```
