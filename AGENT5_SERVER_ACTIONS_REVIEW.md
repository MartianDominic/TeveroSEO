# Agent 5: Server Actions Review (apps/web)

## Scope
- All Next.js server actions in apps/web/src/actions/
- Data mutation patterns
- Error handling
- Validation logic

## Action Inventory (19 files, 50+ exported actions)

| File | Key Actions | Dependencies |
|------|-------------|--------------|
| alerts.ts | getAlertCount, getClientAlerts, updateAlertStatus, createAlertRule, deleteAlertRule | getOpenSeo, patchOpenSeo, postOpenSeo, deleteOpenSeo |
| analytics/detect-patterns.ts | detectPatterns, getPatterns, dismissPattern, resolvePattern | getOpenSeo, patchOpenSeo, pattern-detection lib |
| analytics/get-opportunities.ts | getClientOpportunities, getTopOpportunities, getOpportunityCount | findOpportunities, getOpenSeo |
| analytics/get-predictions.ts | getGoalProjections, getClientPredictions, getWorkspacePredictions, getPredictionCounts | getFastApi, predictions lib |
| changes.ts | getChanges, getChange, previewRevert, executeRevert, revertSingleChange | getOpenSeo, postOpenSeo |
| cms/test-connection.ts | testCmsConnection | postFastApi |
| dashboard/get-clients-paginated.ts | getClientsPaginated | getFastApi, cache lib |
| dashboard/get-portfolio-aggregates.ts | getPortfolioAggregates | getFastApi, cache lib |
| seo/audit.ts | startAudit, getAuditStatus, getAuditResults, getAuditHistory, deleteAudit | getOpenSeo, postOpenSeo |
| seo/backlinks.ts | getBacklinksOverview, getBacklinksReferringDomains, getBacklinksTopPages | postOpenSeo |
| seo/domain.ts | getDomainOverview | postOpenSeo |
| seo/findings.ts | getPageFindings, getAuditFindings, exportFindingsCSV | getOpenSeo |
| seo/keywords.ts | researchKeywords, saveKeywords, getSerpAnalysis, getKeywordHistory | getOpenSeo, postOpenSeo |
| seo/mapping.ts | getMappings, suggestMappings, overrideMapping | getOpenSeo, postOpenSeo |
| seo/projects.ts | getDefaultProject, getProject | getOpenSeo |
| team/get-team-metrics.ts | getTeamMetrics, reassignClient | getFastApi, getOpenSeo, cache lib |
| views/saved-views.ts | getSavedView, createSavedViewWithConfig, updateSavedViewWithConfig, deleteSavedViewById | getFastApi, postFastApi, patchFastApi, deleteFastApi |
| voice.ts | getVoiceProfile, saveVoiceProfile, analyzeVoice, getProtectionRules, addProtectionRule | voiceApi lib |
| webhooks.ts | getClientWebhooks, getWebhook, createWebhook, updateWebhook, deleteWebhookAction | getOpenSeo, postOpenSeo, patchOpenSeo, deleteOpenSeo |

## Findings

### MEDIUM-IDOR-01: `getWebhook` and `getWebhookDeliveries` Validate Ownership After Data Fetch
**File:** `apps/web/src/actions/webhooks.ts` (lines 135-148)

The `getWebhook` and `getWebhookDeliveries` functions fetch webhook data BEFORE validating client ownership. While they check ownership afterward, the data has already been fetched from the backend.

```typescript
const webhook = await getOpenSeo<...>(`/api/webhooks/${validated}${query}`);
// Ownership validated AFTER fetch
if (webhook.scope === "client" && webhook.scopeId) {
  await validateClientOwnership(webhook.scopeId, auth);
}
```

**Impact:** Information disclosure if backend lacks authorization checks.
**Recommendation:** Backend MUST enforce authorization atomically, or restructure to validate ownership before fetch.

---

### MEDIUM-IDOR-02: `getChange` Fetches Data Before Ownership Validation
**File:** `apps/web/src/actions/changes.ts` (lines 196-205)

Similar to IDOR-01, `getChange` fetches the change record before validating ownership:

```typescript
const response = await getOpenSeo<...>(`/api/changes/${validatedChangeId}`);
await validateClientOwnership(response.data.clientId, auth); // After fetch
```

**Impact:** Potential data leakage if backend doesn't enforce authorization.
**Recommendation:** Add clientId as required parameter to validate ownership upfront.

---

### MEDIUM-RACE-01: TOCTOU in `updateWebhook` Despite Mitigation Attempt
**File:** `apps/web/src/actions/webhooks.ts` (lines 248-259)

The function fetches webhook, validates ownership, then sends update with `expectedScope`/`expectedScopeId`. If backend doesn't atomically check these values in its WHERE clause, a race condition remains.

**Impact:** Ownership could change between fetch and update.
**Recommendation:** Verify backend implements `WHERE scope = ? AND scope_id = ?` in update query.

---

### LOW-ERR-01: Inconsistent Return Value on Validation Failures in `detectPatterns`
**File:** `apps/web/src/actions/analytics/detect-patterns.ts` (lines 137-140)

When workspaceId validation fails, returns empty array instead of error. Impossible to distinguish "no patterns" from "invalid input."

**Recommendation:** Throw validation errors or return `ActionResult` type with error info.

---

### LOW-ERR-02: `getOpportunityCount` Swallows All Errors
**File:** `apps/web/src/actions/analytics/get-opportunities.ts` (lines 241-244)

Catch block returns 0 for any error, including auth failures. Badge shows 0 even on backend failure.

**Recommendation:** Return result type distinguishing errors from zero-count.

---

### LOW-TYPE-01: Inconsistent Return Types in voice.ts
**File:** `apps/web/src/actions/voice.ts`

`saveVoiceProfile` returns `VoiceProfile | null` and throws, while other voice actions return `VoiceActionResult<T>`.

**Recommendation:** Standardize on `VoiceActionResult` return type.

---

### LOW-VALID-01: Missing Rate Limiting on Expensive Read Operations
**Files:** seo/findings.ts, seo/keywords.ts, seo/mapping.ts

Expensive reads like `getAuditFindings`, `getSavedKeywordsWithRankings`, `getMappings` lack rate limiting.

**Impact:** Resource exhaustion through repeated expensive queries.
**Recommendation:** Add rate limiting to expensive read operations.

---

### LOW-VALID-02: `viewConfigSchema` Allows Arbitrary Filter Objects
**File:** `apps/web/src/actions/views/saved-views.ts` (line 26)

Filters typed as `z.record(z.string(), z.unknown())` allows arbitrary data storage.

**Recommendation:** Define specific filter schema or validate before use downstream.

---

## Positive Observations

1. **Consistent Authentication:** All actions use `requireActionAuth()` + ownership validation
2. **Input Validation:** Zod schemas used consistently with proper error messages
3. **Rate Limiting:** Most mutations have `checkActionRateLimit()`
4. **Idempotency Keys:** Create operations include idempotency keys (createAlertRule, createWebhook, startAudit)
5. **Error Logging:** Server-side logging with sanitized client-facing messages
6. **Cache Stampede Prevention:** `getCachedWithSingleflight` used appropriately
7. **Resource Limits:** Bounded queries (MAX_CLIENTS=50, MAX_SAVED_VIEWS_PER_USER=50)
8. **HTTPS Enforcement:** Webhook URLs validated for HTTPS

## Summary

| Severity | Count | Categories |
|----------|-------|------------|
| CRITICAL | 0 | - |
| HIGH | 0 | - |
| MEDIUM | 3 | IDOR (2), TOCTOU (1) |
| LOW | 5 | Error handling (2), Type consistency (1), Validation (2) |

**Key Findings:** Server actions are well-structured with good security practices. Main concerns are some actions fetching data before validating ownership (requires backend to enforce auth atomically) and inconsistent error return types. No critical issues found.
