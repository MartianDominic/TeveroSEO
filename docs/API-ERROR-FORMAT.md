# API Error Response Format Standard

> M-12 FIX: Standardized error response format across all backends.

## Standard Error Response

All API endpoints MUST return errors in this format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `error` | string | Human-readable error message (max 200 chars) |
| `code` | string | Machine-readable error code (SCREAMING_SNAKE_CASE) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `details` | array | Validation error details (Zod issues) |
| `meta` | object | Additional context (request IDs, timestamps) |

## Error Codes

### Authentication/Authorization

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHENTICATED` | 401 | No valid auth token provided |
| `FORBIDDEN` | 403 | User lacks permission |
| `TOKEN_EXPIRED` | 401 | Auth token has expired |

### Validation

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_PARAMS` | 400 | Request parameters invalid |
| `MISSING_REQUIRED` | 400 | Required field missing |
| `VALIDATION_ERROR` | 400 | General validation failure |

### Resource Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict (duplicate) |
| `GONE` | 410 | Resource permanently deleted |

### Rate Limiting

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `RATE_LIMITED` | 429 | Too many requests |
| `QUOTA_EXCEEDED` | 429 | API quota exceeded |

### Server Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503 | Backend service down |
| `TIMEOUT` | 504 | Request timed out |

## Implementation Examples

### open-seo-main (TanStack Start)

```typescript
// Standard error response
return Response.json(
  { error: "Goal not found", code: "NOT_FOUND" },
  { status: 404 }
);

// With validation details
return Response.json(
  {
    error: "Invalid request parameters",
    code: "INVALID_PARAMS",
    details: parsed.error.issues,
  },
  { status: 400 }
);
```

### AI-Writer (FastAPI)

```python
from fastapi import HTTPException
from fastapi.responses import JSONResponse

# Standard error response
raise HTTPException(
    status_code=404,
    detail={"error": "Article not found", "code": "NOT_FOUND"}
)

# Or using JSONResponse
return JSONResponse(
    status_code=400,
    content={"error": "Invalid voice profile", "code": "VALIDATION_ERROR"}
)
```

### apps/web (Error Handler)

The `server-fetch.ts` module sanitizes both formats:

```typescript
// Both formats are normalized to { error: string }
// AI-Writer: {"detail": "..."} -> {"error": "..."}
// open-seo-main: {"error": "..."} -> {"error": "..."}

function sanitizeErrorBody(body: unknown): { error: string } {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const error = (body as { error: unknown }).error;
    if (typeof error === 'string' && error.length < 200) {
      return { error };
    }
  }
  if (typeof body === 'object' && body !== null && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === 'string' && detail.length < 200) {
      return { error: detail };
    }
  }
  return { error: 'An error occurred' };
}
```

## Migration Notes

### Legacy Format (AI-Writer)

Old format:
```json
{"detail": "Error message"}
```

New format:
```json
{"error": "Error message", "code": "ERROR_CODE"}
```

### Backward Compatibility

The `server-fetch.ts` sanitizer handles both formats during migration.
New endpoints should use the standard format immediately.

## Security Considerations

1. **Never expose stack traces** in error responses
2. **Limit error message length** to 200 characters
3. **Use generic messages** for auth failures (don't reveal if user exists)
4. **Log detailed errors** server-side, return sanitized errors to clients
