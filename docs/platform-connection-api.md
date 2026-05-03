# Platform Connection API

> API reference for the TeveroSEO platform connection system.

## Base URL

```
https://api.tevero.io
```

## Authentication

All endpoints require authentication via Bearer token:

```
Authorization: Bearer YOUR_API_KEY
```

Obtain your API key from: Dashboard > Settings > API Keys

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/api/connect/*` | 100 requests/minute |
| `/api/pixel/collect` | 10,000 requests/minute |
| `/api/pixel/:siteId/analytics` | 60 requests/minute |

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Unix timestamp when window resets

---

## Platform Detection

### Detect Platform

Analyze a URL to determine the CMS/platform.

```
POST /api/connect/detect
Content-Type: application/json
```

**Request Body:**

```json
{
  "url": "https://example.com"
}
```

**Response:**

```json
{
  "platform": "shopify",
  "confidence": 100,
  "features": ["ecommerce", "blog"],
  "paidPlanRequired": false,
  "estimatedTime": "2 min",
  "oauthSupported": true
}
```

**Platform Values:**

| Platform | Description |
|----------|-------------|
| `wordpress_self_hosted` | Self-hosted WordPress |
| `wordpress_com` | WordPress.com hosted |
| `shopify` | Shopify store |
| `wix` | Wix website |
| `squarespace` | Squarespace site |
| `webflow` | Webflow project |
| `weebly` | Weebly site |
| `godaddy` | GoDaddy Website Builder |
| `hubspot` | HubSpot CMS |
| `ghost` | Ghost blog |
| `bigcommerce` | BigCommerce store |
| `woocommerce` | WooCommerce (WordPress) |
| `magento` | Magento/Adobe Commerce |
| `custom_html` | Custom HTML/static site |
| `gtm_enabled` | Site has Google Tag Manager |
| `unknown` | Could not detect platform |

**Confidence Levels:**

| Level | Description |
|-------|-------------|
| 100 | Definitive (subdomain pattern) |
| 90-99 | Very likely (multiple signals) |
| 80-89 | Likely (HTML signatures) |
| 70-79 | Possible (response headers) |
| < 70 | Uncertain |

---

## Installation Management

### Create Installation

Register a new pixel installation for a website.

```
POST /api/connect/installation
Content-Type: application/json
```

**Request Body:**

```json
{
  "workspaceId": "ws_abc123",
  "url": "https://example.com"
}
```

**Response:**

```json
{
  "id": "inst_xyz789",
  "siteId": "site_abc123def456",
  "url": "https://example.com",
  "status": "pending",
  "createdAt": "2026-05-03T10:00:00Z",
  "snippet": "<script async src=\"https://pixel.tevero.io/t.js\" data-site=\"site_abc123def456\"></script>"
}
```

### Get Installation Status

Check installation status and verification state.

```
GET /api/connect/installation/:siteId
```

**Response:**

```json
{
  "id": "inst_xyz789",
  "siteId": "site_abc123def456",
  "url": "https://example.com",
  "status": "detected",
  "firstPingAt": "2026-05-03T10:15:30Z",
  "lastPingAt": "2026-05-03T14:22:15Z",
  "pingCount": 1542
}
```

**Status Values:**

| Status | Description |
|--------|-------------|
| `pending` | Installation created, awaiting first ping |
| `detected` | First ping received, pixel is working |
| `verified` | User confirmed installation complete |
| `error` | Installation has issues |

---

## Installation Guides

### Get Platform Guide

Retrieve step-by-step installation guide for a platform.

```
GET /api/connect/guide/:platform?siteId=xxx
```

**Path Parameters:**
- `platform` - Platform identifier (e.g., `shopify`, `wordpress_self_hosted`)

**Query Parameters:**
- `siteId` - (Optional) Site ID to personalize snippet in guide

**Response:**

```json
{
  "guide": {
    "platform": "shopify",
    "name": "Shopify",
    "steps": [
      {
        "number": 1,
        "title": "Go to Online Store",
        "description": "In your Shopify admin, click 'Online Store' in the left sidebar, then click 'Themes'.",
        "screenshot": "https://cdn.tevero.io/guides/shopify/step1.png",
        "code": null,
        "helpLink": null
      },
      {
        "number": 2,
        "title": "Edit Theme Code",
        "description": "Click the '...' button next to your theme, then select 'Edit code'.",
        "screenshot": "https://cdn.tevero.io/guides/shopify/step2.png",
        "code": null,
        "helpLink": null
      },
      {
        "number": 3,
        "title": "Open theme.liquid",
        "description": "In the Layout folder, click 'theme.liquid'.",
        "screenshot": "https://cdn.tevero.io/guides/shopify/step3.png",
        "code": null,
        "helpLink": null
      },
      {
        "number": 4,
        "title": "Add the Code",
        "description": "Find '</head>' in the file. Paste this code just before it:",
        "screenshot": "https://cdn.tevero.io/guides/shopify/step4.png",
        "code": "<script async src=\"https://pixel.tevero.io/t.js\" data-site=\"site_abc123\"></script>",
        "helpLink": "https://help.tevero.io/guides/shopify"
      },
      {
        "number": 5,
        "title": "Save",
        "description": "Click 'Save' in the top right corner.",
        "screenshot": null,
        "code": null,
        "helpLink": null
      }
    ],
    "estimatedTime": "2 min",
    "difficulty": "easy",
    "paidPlanRequired": false,
    "fallbackToGtm": true
  },
  "snippet": "<script async src=\"https://pixel.tevero.io/t.js\" data-site=\"site_abc123\"></script>"
}
```

---

## Verification

### Verify Installation

Long-poll endpoint that waits for pixel ping (up to 30 seconds).

```
GET /api/connect/verify?siteId=xxx
```

**Query Parameters:**
- `siteId` - Site ID to verify

**Response (detected):**

```json
{
  "status": "detected",
  "firstPingAt": "2026-05-03T10:15:30Z"
}
```

**Response (pending):**

```json
{
  "status": "pending",
  "message": "Waiting for pixel ping..."
}
```

**Response (timeout):**

```json
{
  "status": "pending",
  "message": "Verification timed out. Please check installation."
}
```

---

## Developer Handoff

### Create Handoff

Send installation instructions to a developer.

```
POST /api/connect/handoff
Content-Type: application/json
```

**Request Body:**

```json
{
  "siteId": "site_abc123",
  "email": "developer@example.com",
  "senderName": "John from Marketing"
}
```

**Response:**

```json
{
  "success": true,
  "handoffId": "handoff_xyz789",
  "expiresAt": "2026-06-02T10:00:00Z"
}
```

**Error Response (Rate Limited):**

```json
{
  "error": "Rate limited",
  "code": "RATE_LIMITED",
  "message": "Maximum 5 handoffs per site per day",
  "retryAfter": 3600
}
```

### Get Handoff Details

Retrieve handoff information (used by magic link landing page).

```
GET /api/connect/handoff/:token
```

**Response (Valid):**

```json
{
  "valid": true,
  "siteUrl": "https://example.com",
  "platform": "shopify",
  "platformName": "Shopify",
  "snippet": "<script async src=\"https://pixel.tevero.io/t.js\" data-site=\"site_abc123\"></script>",
  "guide": {
    "platform": "shopify",
    "name": "Shopify",
    "steps": [...]
  }
}
```

**Response (Expired):**

```json
{
  "valid": false,
  "error": "Token expired",
  "code": "TOKEN_EXPIRED"
}
```

### Send Reminder

Send a reminder email for pending handoff.

```
POST /api/connect/handoff/:handoffId/reminder
```

**Response:**

```json
{
  "success": true,
  "reminderCount": 2
}
```

**Error Response:**

```json
{
  "error": "Maximum reminders reached",
  "code": "MAX_REMINDERS",
  "message": "Maximum 3 reminders per handoff"
}
```

---

## Pixel Collection

### Collect Event

Endpoint for pixel to send analytics events.

```
POST /api/pixel/collect
Content-Type: application/json
```

**Request Body:**

```json
{
  "siteId": "site_abc123",
  "event": "pageview",
  "data": {
    "url": "/products/widget",
    "referrer": "https://google.com",
    "userAgent": "Mozilla/5.0..."
  },
  "timestamp": 1714730400000,
  "sessionId": "sess_xyz789"
}
```

**Event Types:**

| Type | Description | Data Fields |
|------|-------------|-------------|
| `pageview` | Page load | `url`, `referrer`, `userAgent` |
| `cwv` | Core Web Vitals | `lcp`, `cls`, `inp` |
| `scroll` | Scroll depth | `depth` (0-100) |
| `click` | Click event | `selector`, `href` |
| `ping` | Heartbeat | None |

**Response:**

```json
{
  "success": true,
  "processingTimeMs": 3.2
}
```

**Response (Status Changed):**

```json
{
  "success": true,
  "statusChanged": true,
  "newStatus": "detected",
  "processingTimeMs": 4.1
}
```

---

## Pixel Analytics

### Get Analytics

Retrieve aggregated analytics for a site.

```
GET /api/pixel/:siteId/analytics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

**Query Parameters:**
- `startDate` - Start date (ISO 8601)
- `endDate` - End date (ISO 8601)
- `granularity` - (Optional) `day` or `hour` (default: `day`)

**Response:**

```json
{
  "summary": {
    "totalPageviews": 15234,
    "totalSessions": 8456,
    "totalUniqueVisitors": 6123,
    "avgTimeOnPage": 145,
    "bounceRate": 42.5
  },
  "cwv": {
    "lcp": { "p75": 2100, "rating": "good" },
    "cls": { "p75": 0.08, "rating": "good" },
    "inp": { "p75": 180, "rating": "needs-improvement" }
  },
  "timeseries": [
    { "date": "2026-04-27", "pageviews": 520, "sessions": 290 },
    { "date": "2026-04-28", "pageviews": 580, "sessions": 320 }
  ],
  "topPages": [
    { "path": "/", "pageviews": 3500, "avgTimeOnPage": 120 },
    { "path": "/products", "pageviews": 2800, "avgTimeOnPage": 180 }
  ]
}
```

**CWV Ratings:**

| Rating | Description |
|--------|-------------|
| `good` | Passes Core Web Vitals threshold |
| `needs-improvement` | Moderate, should optimize |
| `poor` | Fails threshold, needs urgent attention |

**CWV Thresholds:**

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | <= 2500ms | <= 4000ms | > 4000ms |
| CLS | <= 0.1 | <= 0.25 | > 0.25 |
| INP | <= 200ms | <= 500ms | > 500ms |

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `SITE_NOT_FOUND` | 404 | Invalid siteId |
| `TOKEN_EXPIRED` | 410 | Magic link expired (30 days) |
| `TOKEN_NOT_FOUND` | 404 | Invalid handoff token |
| `RATE_LIMITED` | 429 | Too many requests |
| `INVALID_URL` | 400 | Malformed URL provided |
| `DETECTION_FAILED` | 500 | Platform detection error |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `FORBIDDEN` | 403 | No access to resource |

---

## Webhooks

### Installation Status Changed

Receive notifications when installation status changes.

```
POST <your-webhook-url>
Content-Type: application/json
X-Tevero-Signature: sha256=...
```

**Payload:**

```json
{
  "event": "installation.status_changed",
  "timestamp": "2026-05-03T10:15:30Z",
  "data": {
    "siteId": "site_abc123",
    "oldStatus": "pending",
    "newStatus": "detected",
    "installationId": "inst_xyz789"
  }
}
```

### Register Webhook

```
POST /api/webhooks
Content-Type: application/json
```

**Request Body:**

```json
{
  "url": "https://your-app.com/webhooks/tevero",
  "events": ["installation.status_changed", "handoff.completed"],
  "secret": "your-webhook-secret"
}
```

---

## SDKs

### JavaScript/TypeScript

```bash
npm install @tevero/sdk
```

```typescript
import { TeveroClient } from '@tevero/sdk';

const client = new TeveroClient({ apiKey: 'YOUR_API_KEY' });

// Detect platform
const result = await client.connect.detect('https://example.com');

// Get analytics
const analytics = await client.pixel.getAnalytics('site_abc123', {
  startDate: '2026-04-01',
  endDate: '2026-05-01'
});
```

### Python

```bash
pip install tevero
```

```python
from tevero import TeveroClient

client = TeveroClient(api_key="YOUR_API_KEY")

# Detect platform
result = client.connect.detect("https://example.com")

# Get analytics
analytics = client.pixel.get_analytics(
    site_id="site_abc123",
    start_date="2026-04-01",
    end_date="2026-05-01"
)
```

---

## Changelog

### 2026-05-03

- Added DOM change approval endpoints
- Added OAuth enhancement endpoints

### 2026-05-02

- Added analytics dashboard endpoints
- Added CWV rating calculation

### 2026-05-01

- Initial API release
- Platform detection
- Installation management
- Developer handoff

---

*Last updated: May 2026*
