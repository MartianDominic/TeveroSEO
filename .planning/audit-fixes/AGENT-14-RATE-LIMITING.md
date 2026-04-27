# Agent 14: Rate Limiting

## Issues Fixed

- [x] CRITICAL: Enhanced rate limiting for open-seo-main with auth-specific limits
- [x] CRITICAL: Created rate limiting middleware for apps/web
- [x] HIGH: Added authentication endpoint rate limiters (login, signup, password reset)
- [x] HIGH: Added resource-intensive endpoint rate limiters (content generation, SERP analysis)
- [x] HIGH: Created server action rate limiting for Next.js
- [x] Added comprehensive test coverage for apps/web rate limiting

## Files Created

| File | Purpose |
|------|---------|
| `apps/web/src/lib/middleware/rate-limit.ts` | Next.js rate limiting middleware |
| `apps/web/src/lib/middleware/index.ts` | Middleware exports |
| `apps/web/src/lib/middleware/rate-limit.test.ts` | Test coverage for rate limiting |

## Files Modified

| File | Changes |
|------|---------|
| `open-seo-main/src/server/middleware/rate-limit.ts` | Added auth, password reset, signup, content generation, brief, keyword, SERP rate limiters |
| `open-seo-main/src/server/middleware/index.ts` | Exported new rate limiters |

## Rate Limits Configuration

### open-seo-main (Redis-based, distributed)

| Endpoint Type | Limit | Window | Key Prefix |
|--------------|-------|--------|------------|
| Auth (login/token) | 10 req | 1 min | `ratelimit:auth:` |
| Password Reset | 3 req | 5 min | `ratelimit:auth:password-reset:` |
| Signup | 5 req | 5 min | `ratelimit:auth:signup:` |
| API Key Generate | 5 req | 1 min | `ratelimit:auth:api-key:` |
| Audit Run Checks | 10 req | 1 min | `ratelimit:audit:run-checks:` |
| Content Validate | 10 req | 1 min | `ratelimit:seo:content:validate:` |
| Content Generate | 20 req | 1 min | `ratelimit:content:generate:` |
| Brief Generate | 10 req | 1 min | `ratelimit:brief:generate:` |
| Keyword Enrich | 30 req | 1 min | `ratelimit:keyword:enrich:` |
| SERP Analyze | 20 req | 1 min | `ratelimit:serp:analyze:` |
| Link Suggestions | 30 req | 1 min | `ratelimit:seo:links:suggestions:` |
| Default | 60 req | 1 min | `ratelimit:default:` |

### apps/web (In-memory, single instance)

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| AUTH | 10 req | 1 min |
| API (general) | 100 req | 1 min |
| HEAVY (generate/audit) | 20 req | 1 min |
| ACTION (server actions) | 30 req | 1 min |
| PASSWORD_RESET | 3 req | 5 min |
| SIGNUP | 5 req | 5 min |

## Usage Examples

### open-seo-main API Routes

```typescript
import { 
  authRateLimiter, 
  contentGenerateRateLimiter,
  withRateLimit 
} from '@/server/middleware';

// Using pre-configured rate limiter
export async function POST(request: Request) {
  const clientId = await extractClientIdFromRequest(request);
  const result = await authRateLimiter(clientId);
  
  if (!result.allowed) {
    return rateLimitExceededResponse(result);
  }
  
  // ... handler logic
}

// Using withRateLimit wrapper
export const POST = withRateLimit(
  {
    key: (req) => extractClientIdFromRequest(req),
    limit: 10,
    window: 60,
  },
  async (request) => {
    // ... handler logic
    return Response.json({ success: true });
  }
);
```

### apps/web API Routes

```typescript
import { withRateLimit, withAuthRateLimit } from '@/lib/middleware';

// General API endpoint
export const POST = withRateLimit(
  async (req) => {
    const data = await req.json();
    return NextResponse.json({ success: true });
  },
  { limit: 100, windowMs: 60000 }
);

// Auth endpoint with stricter limits
export const POST = withAuthRateLimit(async (req) => {
  // Login logic
  return NextResponse.json({ token: '...' });
});
```

### apps/web Server Actions

```typescript
'use server';

import { rateLimitAction } from '@/lib/middleware';
import { auth } from '@clerk/nextjs/server';

export async function submitForm(data: FormData) {
  const { userId } = await auth();
  
  // Rate limit: 5 requests per minute per user
  await rateLimitAction('submitForm', userId, { 
    limit: 5, 
    windowMs: 60000 
  });
  
  // ... action logic
}
```

## Architecture

### open-seo-main
- **Algorithm**: Sliding window using Redis sorted sets
- **Storage**: Redis (distributed, production-ready)
- **Fail Mode**: Fail open (allow request on Redis error)
- **Headers**: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After

### apps/web
- **Algorithm**: Fixed window with in-memory Map
- **Storage**: In-memory (single instance)
- **Fail Mode**: N/A (in-memory always available)
- **Headers**: Same as open-seo-main
- **Cleanup**: Automatic cleanup every 60 seconds

## Production Considerations

### Scaling apps/web

For multi-instance deployments of apps/web, replace the in-memory store with Redis:

```typescript
// Replace rateLimitMap with Redis client
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

// Use sliding window algorithm similar to open-seo-main
```

### Monitoring

Both implementations include rate limit headers for client-side handling:
- `X-RateLimit-Limit`: Total requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Unix timestamp when window resets
- `Retry-After`: Seconds until retry is allowed (on 429)

## Security Considerations

1. **IP Spoofing**: X-Forwarded-For can be spoofed; configure trusted proxies
2. **Distributed Attacks**: In-memory rate limiting won't protect against distributed attacks
3. **User vs IP**: Prefer user-based rate limiting when authenticated
4. **Fail Open**: Redis failures allow requests through; monitor Redis health

## Test Results

```bash
# Run tests for apps/web rate limiting
cd apps/web && pnpm test src/lib/middleware/rate-limit.test.ts

# Run tests for open-seo-main rate limiting  
cd open-seo-main && pnpm test src/server/middleware/rate-limit.test.ts
```

## Verification Checklist

- [x] Rate limiting middleware created for both applications
- [x] Authentication endpoints have strict limits (10 req/min)
- [x] Password reset has very strict limits (3 req/5 min)
- [x] Resource-intensive endpoints have moderate limits (20 req/min)
- [x] Server actions have rate limiting support
- [x] Rate limit headers included in responses
- [x] Proper 429 responses with Retry-After
- [x] Test coverage for all rate limiting functions
- [x] Documentation complete
