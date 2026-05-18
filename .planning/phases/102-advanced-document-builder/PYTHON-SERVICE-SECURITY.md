# Document Parser Service Security Specification

Phase 102 Security Hardening for `services/document-parser/`

## 1. Threat Model

### Attack Surface

| ID | Threat | Impact | Current Status |
|----|--------|--------|----------------|
| T1 | **Unauthorized Access** | Attacker parses documents, extracts data | VULNERABLE - No auth |
| T2 | **Request Forgery** | Malicious actor spoofs requests | VULNERABLE - No signing |
| T3 | **DoS via Volume** | Service overwhelmed by requests | VULNERABLE - No rate limit |
| T4 | **Malformed Input** | Parser crash or memory exhaustion | PARTIAL - 20MB limit exists |
| T5 | **Path Traversal** | Temp file manipulation | MITIGATED - Uses tempfile module |
| T6 | **Information Disclosure** | Stack traces leak internals | MITIGATED - Sanitized errors |

### Trust Boundaries

```
Internet
    |
    v
[Next.js App] <-- Clerk auth, user-facing
    |
    | (internal network, port 8001)
    v
[Document Parser] <-- MUST verify caller is Next.js app
```

### Security Goals

1. **Only Next.js app can call /parse** - Shared secret authentication
2. **Requests cannot be replayed** - Timestamp + HMAC signing
3. **Service stays available** - Rate limiting per client
4. **Fail securely** - No information leakage on errors

---

## 2. Auth Implementation (Python)

### 2.1 Middleware: `middleware/auth.py`

```python
"""
Internal service authentication middleware.
Validates X-Service-Secret header and optional HMAC signature.
"""

import hmac
import hashlib
import time
import os
from typing import Optional
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

# Configuration
SERVICE_SECRET = os.getenv("DOCUMENT_PARSER_SECRET")
HMAC_SECRET = os.getenv("DOCUMENT_PARSER_HMAC_SECRET")  # Optional
REQUEST_TIMESTAMP_TOLERANCE_SECONDS = 300  # 5 minutes


class ServiceAuthMiddleware(BaseHTTPMiddleware):
    """
    Authenticates internal service requests.
    
    Required header:
        X-Service-Secret: <shared secret>
    
    Optional headers (if HMAC enabled):
        X-Request-Timestamp: <unix timestamp>
        X-Request-Signature: <HMAC-SHA256 signature>
    """

    async def dispatch(self, request: Request, call_next):
        # Skip auth for health endpoint
        if request.url.path == "/health":
            return await call_next(request)

        # Validate service secret
        if not SERVICE_SECRET:
            # Fail closed - if secret not configured, reject all
            raise HTTPException(503, "Service not configured")

        provided_secret = request.headers.get("X-Service-Secret")
        if not provided_secret:
            raise HTTPException(401, "Missing authentication")

        if not hmac.compare_digest(provided_secret, SERVICE_SECRET):
            raise HTTPException(403, "Invalid authentication")

        # Optional HMAC signature validation
        if HMAC_SECRET:
            timestamp = request.headers.get("X-Request-Timestamp")
            signature = request.headers.get("X-Request-Signature")

            if not timestamp or not signature:
                raise HTTPException(401, "Missing request signature")

            # Validate timestamp (prevent replay attacks)
            try:
                request_time = int(timestamp)
                current_time = int(time.time())
                if abs(current_time - request_time) > REQUEST_TIMESTAMP_TOLERANCE_SECONDS:
                    raise HTTPException(401, "Request expired")
            except ValueError:
                raise HTTPException(400, "Invalid timestamp")

            # Validate HMAC signature
            expected_sig = compute_signature(
                method=request.method,
                path=request.url.path,
                timestamp=timestamp,
            )
            if not hmac.compare_digest(signature, expected_sig):
                raise HTTPException(403, "Invalid signature")

        return await call_next(request)


def compute_signature(method: str, path: str, timestamp: str) -> str:
    """Compute HMAC-SHA256 signature for request."""
    message = f"{method}:{path}:{timestamp}"
    return hmac.new(
        HMAC_SECRET.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
```

### 2.2 Rate Limiting: `middleware/rate_limit.py`

```python
"""
Token bucket rate limiter for document parsing.
Limits: 100 requests/minute per service (not per user).
"""

import time
import asyncio
from collections import defaultdict
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

# Configuration
RATE_LIMIT_REQUESTS = 100  # Max requests
RATE_LIMIT_WINDOW_SECONDS = 60  # Per minute


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.requests = defaultdict(list)
        self._lock = asyncio.Lock()

    async def dispatch(self, request: Request, call_next):
        # Skip for health checks
        if request.url.path == "/health":
            return await call_next(request)

        # Use client IP as identifier (internal service, so this is the app server)
        client_ip = request.client.host if request.client else "unknown"

        async with self._lock:
            current_time = time.time()
            window_start = current_time - RATE_LIMIT_WINDOW_SECONDS

            # Clean old requests
            self.requests[client_ip] = [
                t for t in self.requests[client_ip] if t > window_start
            ]

            # Check limit
            if len(self.requests[client_ip]) >= RATE_LIMIT_REQUESTS:
                raise HTTPException(
                    429,
                    "Rate limit exceeded. Try again later.",
                    headers={"Retry-After": str(RATE_LIMIT_WINDOW_SECONDS)}
                )

            # Record request
            self.requests[client_ip].append(current_time)

        return await call_next(request)
```

### 2.3 Updated `main.py`

```python
# Add after existing imports
from middleware.auth import ServiceAuthMiddleware
from middleware.rate_limit import RateLimitMiddleware

# Add middleware BEFORE CORS (order matters)
app.add_middleware(ServiceAuthMiddleware)
app.add_middleware(RateLimitMiddleware)

# Existing CORS middleware follows...
```

---

## 3. Client Updates (TypeScript)

### 3.1 Updated `parser-client.ts`

```typescript
import crypto from "crypto";

const PARSER_SERVICE_URL =
  process.env.DOCUMENT_PARSER_URL || "http://localhost:8001";
const SERVICE_SECRET = process.env.DOCUMENT_PARSER_SECRET;
const HMAC_SECRET = process.env.DOCUMENT_PARSER_HMAC_SECRET; // Optional

/**
 * Generate authentication headers for parser service.
 */
function getAuthHeaders(method: string, path: string): Record<string, string> {
  if (!SERVICE_SECRET) {
    throw new Error(
      "DOCUMENT_PARSER_SECRET not configured. Cannot call parser service."
    );
  }

  const headers: Record<string, string> = {
    "X-Service-Secret": SERVICE_SECRET,
  };

  // Add HMAC signature if configured
  if (HMAC_SECRET) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = `${method}:${path}:${timestamp}`;
    const signature = crypto
      .createHmac("sha256", HMAC_SECRET)
      .update(message)
      .digest("hex");

    headers["X-Request-Timestamp"] = timestamp;
    headers["X-Request-Signature"] = signature;
  }

  return headers;
}

// Update fetch calls in parseDocument and parseDocumentFromBuffer:
const response = await fetch(`${PARSER_SERVICE_URL}/parse`, {
  method: "POST",
  body: formData,
  signal: controller.signal,
  headers: getAuthHeaders("POST", "/parse"),
});
```

---

## 4. Environment Setup

### Required Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `DOCUMENT_PARSER_SECRET` | Both | Shared secret (min 32 chars) |
| `DOCUMENT_PARSER_HMAC_SECRET` | Both | Optional HMAC key (min 32 chars) |

### Generate Secrets

```bash
# Generate secure secrets
openssl rand -hex 32  # For DOCUMENT_PARSER_SECRET
openssl rand -hex 32  # For DOCUMENT_PARSER_HMAC_SECRET
```

### `.env.local` (Next.js)

```env
DOCUMENT_PARSER_URL=http://localhost:8001
DOCUMENT_PARSER_SECRET=<32-char-hex>
DOCUMENT_PARSER_HMAC_SECRET=<32-char-hex>  # Optional
```

### `.env` (Python service)

```env
DOCUMENT_PARSER_SECRET=<same-32-char-hex>
DOCUMENT_PARSER_HMAC_SECRET=<same-32-char-hex>  # Optional, must match
```

---

## 5. Input Validation Hardening

### Additional Checks for `main.py`

```python
# Add to parse_document() after content_type check

# 1. Validate filename (prevent path injection in logs)
import re
filename = file.filename or "unknown"
if not re.match(r'^[\w\-. ]+$', filename):
    filename = "sanitized_upload"

# 2. Magic byte validation (don't trust content-type header)
MAGIC_BYTES = {
    "pdf": b"%PDF",
    "docx": b"PK\x03\x04",  # ZIP format (DOCX is ZIP)
}

content_start = content[:4]
expected_magic = MAGIC_BYTES.get(file_type)
if expected_magic and not content_start.startswith(expected_magic):
    raise HTTPException(400, "File content does not match declared type")

# 3. Limit concurrent processing (memory protection)
import asyncio
PARSE_SEMAPHORE = asyncio.Semaphore(5)  # Max 5 concurrent parses

async with PARSE_SEMAPHORE:
    # ... parsing logic ...
```

---

## 6. Logging and Monitoring

### Security Event Logging

```python
import logging
import json
from datetime import datetime

security_logger = logging.getLogger("security")
security_logger.setLevel(logging.INFO)

def log_security_event(event_type: str, details: dict, request: Request):
    """Log security-relevant events in structured format."""
    security_logger.info(json.dumps({
        "timestamp": datetime.utcnow().isoformat(),
        "event": event_type,
        "client_ip": request.client.host if request.client else "unknown",
        "path": str(request.url.path),
        "user_agent": request.headers.get("User-Agent", "")[:100],
        **details
    }))

# Usage in middleware:
# - AUTH_FAILURE: Invalid secret or signature
# - RATE_LIMIT_EXCEEDED: 429 response
# - PARSE_SUCCESS: Document parsed (file_type, page_count)
# - PARSE_FAILURE: Parse error (sanitized reason)
```

---

## 7. Testing Strategy

### Unit Tests

```python
# tests/test_auth.py
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

def test_missing_auth_header_returns_401(client):
    response = client.post("/parse", files={"file": ("test.pdf", b"%PDF-", "application/pdf")})
    assert response.status_code == 401

def test_invalid_secret_returns_403(client):
    response = client.post(
        "/parse",
        files={"file": ("test.pdf", b"%PDF-", "application/pdf")},
        headers={"X-Service-Secret": "wrong-secret"}
    )
    assert response.status_code == 403

def test_valid_secret_allows_request(client):
    with patch.dict(os.environ, {"DOCUMENT_PARSER_SECRET": "test-secret"}):
        response = client.post(
            "/parse",
            files={"file": ("test.pdf", b"%PDF-", "application/pdf")},
            headers={"X-Service-Secret": "test-secret"}
        )
        assert response.status_code in [200, 400]  # Auth passed
```

### Integration Tests

```typescript
// apps/web/src/lib/document-processing/__tests__/parser-client.test.ts
describe("Parser Client Auth", () => {
  it("includes X-Service-Secret header", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    process.env.DOCUMENT_PARSER_SECRET = "test-secret";

    await parseDocumentFromBuffer(
      new Uint8Array([0x25, 0x50, 0x44, 0x46]), // %PDF
      "pdf",
      "test.pdf"
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Service-Secret": "test-secret",
        }),
      })
    );
  });

  it("throws when DOCUMENT_PARSER_SECRET not set", async () => {
    delete process.env.DOCUMENT_PARSER_SECRET;

    await expect(
      parseDocumentFromBuffer(new Uint8Array(), "pdf", "test.pdf")
    ).rejects.toThrow("DOCUMENT_PARSER_SECRET not configured");
  });
});
```

### Manual Security Verification

```bash
# 1. Test without auth (should fail)
curl -X POST http://localhost:8001/parse \
  -F "file=@test.pdf" \
  # Expected: 401 Unauthorized

# 2. Test with wrong secret (should fail)
curl -X POST http://localhost:8001/parse \
  -H "X-Service-Secret: wrong" \
  -F "file=@test.pdf" \
  # Expected: 403 Forbidden

# 3. Test with correct secret (should work)
curl -X POST http://localhost:8001/parse \
  -H "X-Service-Secret: $DOCUMENT_PARSER_SECRET" \
  -F "file=@test.pdf" \
  # Expected: 200 OK

# 4. Test rate limiting (100 rapid requests)
for i in {1..110}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:8001/parse \
    -H "X-Service-Secret: $DOCUMENT_PARSER_SECRET" \
    -F "file=@small.pdf"
done
# Expected: First 100 return 200, last 10 return 429
```

---

## 8. Implementation Checklist

- [ ] Create `services/document-parser/middleware/__init__.py`
- [ ] Create `services/document-parser/middleware/auth.py`
- [ ] Create `services/document-parser/middleware/rate_limit.py`
- [ ] Update `services/document-parser/main.py` to use middleware
- [ ] Update `apps/web/src/lib/document-processing/parser-client.ts`
- [ ] Add env vars to `.env.example` files
- [ ] Generate production secrets
- [ ] Write unit tests for auth middleware
- [ ] Write integration tests for client
- [ ] Update deployment docs with new env vars
