---
status: testing
phase: 90-client-portal
source: [90-01-SUMMARY.md, 90-02-SUMMARY.md, 90-03-SUMMARY.md]
started: 2026-05-05T22:45:00Z
updated: 2026-05-05T22:45:00Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Start the dev server for apps/web (cd apps/web && pnpm dev).
  Server boots without errors. Navigate to http://localhost:3000.
  The Next.js app loads without build errors or 500s.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Start apps/web dev server with random port (./scripts/dev-random-ports.sh web OR cd apps/web && pnpm dev:random). Server boots on a 5-digit port, URL loads without errors.
result: [pending]

### 2. Portal Dashboard Page Loads
expected: Navigate to /portal/[any-client-id]. The page structure renders: header with nav links (Dashboard/Keywords/Activity), hero metric area (even if empty), Recent Wins and Needs Attention sections (even if showing "no data" states).
result: [pending]

### 3. V6 Design System Applied
expected: On the portal dashboard, verify: large numbers use serif font (Newsreader), body text uses sans font (Geist), cards have subtle shadow (ghost-edge), background is off-white (#FAFAF7 canvas).
result: [pending]

### 4. Portal Navigation Works
expected: From the dashboard, click "Keywords" in the nav. Page changes to /portal/[clientId]/keywords. Click "Activity". Page changes to /portal/[clientId]/activity. Click "Dashboard" to return.
result: [pending]

### 5. Keywords Page Structure
expected: Keywords page shows: filter buttons (All/Top 10/Improving/Declining), a table with columns (Keyword, Position, Clicks, Volume), pagination controls at bottom.
result: [pending]

### 6. Activity Page Structure
expected: Activity page shows: category filter chips, activity entries grouped by date headers (Today/Yesterday/This Week/Older), each entry has icon, description, and timestamp.
result: [pending]

### 7. PWA Manifest Loads
expected: Open Chrome DevTools > Application > Manifest. Manifest loads showing name "TeveroSEO Portal", theme_color #0F4F3D, background_color #FAFAF7.
result: [pending]

### 8. Service Worker Registers
expected: In Chrome DevTools > Application > Service Workers, sw.js is registered and active for localhost:3000.
result: [pending]

### 9. Dashboard API Returns Data Structure
expected: With a valid portal token, call GET /api/portal/dashboard/[clientId]. Response has { success: true, data: { metrics, wins, attention } } structure (data may be empty arrays if no GSC data).
result: [pending]

### 10. Keywords API With Pagination
expected: Call GET /api/portal/keywords/[clientId]?page=1&limit=10. Response has { success: true, data: { keywords, pagination: { page, limit, total } } } structure.
result: [pending]

### 11. Token Validation Rejects Invalid Token
expected: Call any portal API endpoint with Authorization: Bearer invalid-token. Response is 401 { success: false, error: "Invalid or expired token" }.
result: [pending]

## Summary

total: 11
passed: 0
issues: 0
pending: 11
skipped: 0
blocked: 0

## Gaps

[none yet]
