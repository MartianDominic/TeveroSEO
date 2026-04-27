# Security Remediation Checklist

**Generated:** 2026-04-27  
**Status:** 17 of 19 agents completed (59 Critical, 22 High fixes)

---

## Immediate Actions (P0)

### Secret Rotation (CRITICAL)

- [ ] Rotate Clerk secret key at https://dashboard.clerk.com
- [ ] Rotate Gemini API key at https://console.cloud.google.com
- [ ] Generate new Fernet key: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
- [ ] Re-encrypt all CMS credentials with new Fernet key
- [ ] Update production `.env` files with rotated secrets
- [ ] Verify no secrets in git history (consider `git filter-branch` or BFG if needed)

### Dependencies

- [ ] Install missing dependencies:
  ```bash
  cd apps/web && pnpm add dompurify @types/dompurify
  ```

---

## Verify Fixes

### Build Verification

- [ ] Run TypeScript checks:
  ```bash
  cd apps/web && pnpm tsc --noEmit
  cd open-seo-main && pnpm tsc --noEmit
  ```

- [ ] Run full builds:
  ```bash
  cd apps/web && pnpm build
  cd open-seo-main && pnpm build
  cd AI-Writer/backend && python -m py_compile main.py
  ```

### Test Suites

- [ ] Run apps/web tests: `cd apps/web && pnpm test`
- [ ] Run open-seo-main tests: `cd open-seo-main && pnpm test`
- [ ] Run AI-Writer tests: `cd AI-Writer/backend && pytest`

### Manual Security Testing

- [ ] Test authentication flows (login, logout, token refresh)
- [ ] Verify rate limiting triggers 429 after threshold
- [ ] Test CORS with cross-origin requests
- [ ] Verify security headers with browser DevTools
- [ ] Test env validation fails on missing required vars:
  ```bash
  cd AI-Writer/backend && python -c "from config.env_validator import validate_env; validate_env()"
  ```

---

## Deployment

### Pre-Deployment

- [ ] Update production `.env` files with rotated secrets
- [ ] Review all modified files for unintended changes
- [ ] Create deployment rollback plan

### Deployment Steps

- [ ] Deploy AI-Writer backend
- [ ] Deploy open-seo-main
- [ ] Deploy apps/web
- [ ] Verify all services start successfully

### Post-Deployment Verification

- [ ] Monitor error logs for 30 minutes
- [ ] Verify security headers: https://securityheaders.com
- [ ] Test authentication on production
- [ ] Verify rate limiting on production
- [ ] Check BullMQ workers are processing jobs

---

## Ongoing Maintenance

### Weekly

- [ ] Review audit logs for suspicious activity
- [ ] Check rate limit hit metrics
- [ ] Review background job failure rates

### Monthly

- [ ] Review and update CSP policy if needed
- [ ] Check for dependency security updates
- [ ] Review access patterns in auth logs

### Quarterly

- [ ] Full security review
- [ ] Secret rotation (even if not compromised)
- [ ] Penetration testing
- [ ] Update threat model

---

## Incomplete Agent Work

The following agents did not complete their work and require manual intervention:

| Agent | Area | Action Required |
|-------|------|-----------------|
| 17 | RLS & Audit Logging | Add RLS policies and audit tables |
| 18 | LLM Input Sanitization | Sanitize user input in prompts |

## Database Migrations Required

- [ ] Run idempotency keys migration (created by Agent 15):
  ```bash
  cd open-seo-main && pnpm drizzle-kit push
  # OR manually:
  psql -d open_seo -f src/db/migrations/add_idempotency_keys.sql
  ```

---

## TypeScript Errors to Fix

### apps/web (10 errors)

1. `src/actions/analytics/get-opportunities.ts:109` - Add `potentialClicks` to Opportunity type
2. `src/app/.../VoiceModeCard.tsx:5` - Fix import path for `@tevero/ui/lib/utils`
3. `src/app/.../keywords/import/page.tsx:302` - Fix route type
4. `src/app/.../keywords/page.tsx:163,178,301` - Fix route types
5. `src/lib/auth/action-auth.ts:54` - Fix route type
6. `src/lib/middleware/rate-limit.ts:180,187` - Await headers() Promise

### open-seo-main (37+ errors)

1. Missing schema exports - Add to `src/db/schema.ts`:
   - `clientBranding`
   - `reports`
   - `gscSnapshots`
   - `gscQuerySnapshots`
   - `ga4Snapshots`
   - `reportSchedules`

2. ZodError issues - Use `.format()` instead of `.errors`:
   - `src/routes/api/keywords/competitor-spy.ts:60,65`
   - `src/routes/api/keywords/quick-check.ts:64,69`
   - `src/routes/api/prospects/$id/keywords/import.ts:123,125`

3. Type inference issues - Add explicit types or fix assertions

---

## Verification Commands

```bash
# Test env validation
cd /home/dominic/Documents/TeveroSEO/AI-Writer/backend
python -c "from config.env_validator import validate_env; validate_env()"

# Test security headers (local)
curl -I http://localhost:8000/health | grep -E "(Content-Security|X-Frame|X-Content)"
curl -I http://localhost:3000 | grep -E "(Content-Security|X-Frame|X-Content)"
curl -I http://localhost:3001 | grep -E "(Content-Security|X-Frame|X-Content)"

# Test rate limiting
for i in {1..15}; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/auth/test; done

# Check Redis connections
redis-cli info clients | grep connected_clients

# Check BullMQ queues
redis-cli keys "bull:*" | wc -l
```

---

*Checklist created by Agent 20 (Consolidation)*  
*Date: 2026-04-27*
