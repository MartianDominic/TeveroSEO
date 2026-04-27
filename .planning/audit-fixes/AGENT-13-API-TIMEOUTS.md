# Agent 13: External API Timeouts

## Issues Fixed

- [x] CRITICAL: Created TypeScript HTTP client with timeouts, retries, and circuit breaker
- [x] CRITICAL: Created Python HTTP client with timeouts, retries, and circuit breaker
- [x] CRITICAL: Implemented circuit breaker pattern for cascading failure prevention
- [x] CRITICAL: Added webhook timeout and HMAC-SHA256 signing
- [x] CRITICAL: Updated external API calls to use wrapped clients with proper timeouts

## Files Created

### TypeScript HTTP Client
- `open-seo-main/src/server/lib/http-client.ts`
  - `HttpClient` class with configurable timeouts, retries, exponential backoff
  - `CircuitBreaker` class for cascading failure prevention
  - `sendWebhook()` function with timeout and HMAC signing
  - Pre-configured clients: `dataForSeoClient`, `serpApiClient`, `loopsClient`, `jinaClient`, `anthropicClient`, `openaiClient`
  - Error classes: `HttpError`, `TimeoutError`, `CircuitBreakerOpenError`

### Python HTTP Client
- `AI-Writer/backend/utils/http_client.py`
  - `ResilientHttpClient` class with timeouts, retries, circuit breaker
  - `CircuitBreaker` dataclass for failure tracking
  - `send_webhook()` function with timeout and HMAC signing
  - Pre-configured clients: `gemini_client`, `tavily_client`, `anthropic_client`, `openai_client`, `stability_client`, `dataforseo_client`
  - Complements existing `services/http_client.py` with circuit breaker integration

## Files Modified

### Email Services
- `open-seo-main/src/server/email/loops.ts`
  - Replaced raw fetch with `loopsClient`
  - Added 15s timeout for transactional emails

### Webhook/Notification Services
- `open-seo-main/src/server/features/proposals/onboarding/notifications.ts`
  - Replaced raw fetch with `sendWebhook()`
  - Added 10s timeout for Slack webhooks
  - Added retry logic (2 retries)

### LLM API Clients
- `open-seo-main/src/server/features/keywords/services/ResilientClassifier.ts`
  - Claude classifier now uses `anthropicClient` with 120s timeout
  - OpenAI classifier now uses `openaiClient` with 120s timeout
  - Limited retries (1) to avoid excessive costs

### Embedding Services
- `open-seo-main/src/server/features/keywords/services/ResilientEmbedding.ts`
  - Jina API now uses `jinaClient` with 30s timeout
  - Added 2 retries for transient failures

### DataForSEO API
- `open-seo-main/src/server/lib/dataforseo.ts`
  - Now uses `dataForSeoClient` with 60s timeout
  - Added proper error handling for timeout and HTTP errors

### Platform Adapters (CMS connections)
- `open-seo-main/src/server/features/connections/adapters/WordPressAdapter.ts`
  - Added 30s timeout with AbortController
- `open-seo-main/src/server/features/connections/adapters/ShopifyAdapter.ts`
  - Added 30s timeout with AbortController
- `open-seo-main/src/server/features/connections/adapters/SquarespaceAdapter.ts`
  - Added 30s timeout with AbortController
- `open-seo-main/src/server/features/connections/adapters/WebflowAdapter.ts`
  - Added 30s timeout with AbortController
- `open-seo-main/src/server/features/connections/adapters/WixAdapter.ts`
  - Added 30s timeout with AbortController

### Platform Detection
- `open-seo-main/src/server/features/connections/services/PlatformDetector.ts`
  - Added 15s timeout for main detection request
  - Added 5s timeout for WordPress API probe

## Timeout Configurations

| Service | Timeout | Retries | Circuit Breaker |
|---------|---------|---------|-----------------|
| DataForSEO | 60s | 2 | Yes (5 failures, 2min recovery) |
| SERP APIs | 30s | 3 | No |
| Claude/Anthropic | 120s | 2 | Yes (3 failures, 60s recovery) |
| OpenAI | 120s | 2 | Yes (3 failures, 60s recovery) |
| Gemini | 120s | 2 | Yes (3 failures, 60s recovery) |
| Jina Embeddings | 30s | 2 | No |
| Loops Email | 15s | 2 | No |
| Webhooks | 10s | 2 | No |
| Platform Adapters | 30s | 0 | No |
| Platform Detection | 15s | 0 | No |
| WP API Probe | 5s | 0 | No |

## Circuit Breaker Settings

Default settings (can be customized per client):
- **Failure threshold**: 5 failures to open circuit
- **Recovery time**: 60 seconds before half-open test
- **Half-open**: Allows 1 request to test recovery

High-value APIs (LLMs):
- **Failure threshold**: 3 failures (lower to protect expensive APIs)
- **Recovery time**: 60 seconds

DataForSEO:
- **Failure threshold**: 5 failures
- **Recovery time**: 120 seconds (longer to avoid excessive costs)

## Retry Strategy

- **Exponential backoff**: `delay * 2^attempt`
- **Jitter**: 0-10% random delay to prevent thundering herd
- **Max delay**: Capped at 60 seconds
- **Retryable errors**:
  - HTTP 5xx (server errors)
  - HTTP 429 (rate limiting)
  - Timeout errors
  - Network errors
- **Non-retryable errors**:
  - HTTP 4xx (except 429)
  - Circuit breaker open

## Webhook Security

- HMAC-SHA256 signing with configurable secret
- Timestamp header for replay protection
- Signature verification helper function
- Headers: `X-Webhook-Signature`, `X-Webhook-Timestamp`

## Usage Examples

### TypeScript
```typescript
import { dataForSeoClient, HttpError, TimeoutError } from '@/server/lib/http-client';

try {
  const data = await dataForSeoClient.post('/v3/keywords', payload, {
    headers: { Authorization: `Basic ${auth}` },
    timeout: 60000,
  });
} catch (error) {
  if (error instanceof TimeoutError) {
    // Handle timeout
  } else if (error instanceof HttpError) {
    // Handle HTTP error
  }
}
```

### Python
```python
from utils.http_client import gemini_client, RequestTimeoutError

try:
    response = await gemini_client.post('/v1/models/...', json=payload)
except RequestTimeoutError as e:
    # Handle timeout
```

## Testing Recommendations

1. Unit test circuit breaker state transitions
2. Integration test timeout behavior with mock servers
3. Load test retry behavior under high concurrency
4. Verify webhook signatures in receiving services

## Monitoring Recommendations

1. Track circuit breaker state changes (open/closed)
2. Alert on high timeout rates
3. Monitor retry counts per endpoint
4. Log webhook delivery success/failure rates
