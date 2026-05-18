# Phase 102: Environment Variables

Centralized documentation of all environment variables required for Phase 102 Advanced Document Builder.

## Required Variables

### R2 Storage (Cloudflare)

| Variable | Required | Description |
|----------|----------|-------------|
| `R2_ENDPOINT` | Yes | R2 S3-compatible endpoint (e.g., `https://<account_id>.r2.cloudflarestorage.com`) |
| `R2_ACCOUNT_ID` | Yes | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | Yes | R2 API access key ID |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 API secret access key |
| `R2_BUCKET_NAME` | Yes | Bucket name for document storage (e.g., `tevero-documents`) |

### Document Parser Service

| Variable | Required | Description |
|----------|----------|-------------|
| `DOCUMENT_PARSER_URL` | Yes | URL of document parser service (e.g., `http://localhost:8001`) |

### OCR Services

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | For Tier 2 | DeepSeek OCR via OpenRouter (~$0.001-0.003/page) |
| `GEMINI_API_KEY` | For Tier 3 | Gemini Vision OCR (~$0.003/page) |

**Note:** Tesseract (Tier 1) is free and requires no API key, only local installation.

### Authentication (Clerk)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key (already in project) |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key (already in project) |

## Configuration by Service

### Next.js Frontend (`apps/web`)

```env
# R2 Storage
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=tevero-documents

# Document Parser
DOCUMENT_PARSER_URL=http://localhost:8002

# Clerk (existing)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
```

### Document Parser Service (`services/document-parser`)

```env
# OCR API Keys (optional - enables AI OCR tiers)
OPENROUTER_API_KEY=your_openrouter_key
GEMINI_API_KEY=your_gemini_key

# CORS (optional)
CORS_ORIGINS=http://localhost:3000,https://tevero.lt
```

## OCR Tier Cost Summary

| Tier | Provider | Cost | Confidence Threshold |
|------|----------|------|---------------------|
| Tier 1 | Tesseract | FREE | >= 80% to accept |
| Tier 2 | DeepSeek | ~$0.001-0.003/page | >= 85% to accept |
| Tier 3 | Gemini | ~$0.003/page | Final fallback |

Cost optimization: System always starts with free Tier 1 and only escalates when confidence is insufficient.

## Docker Compose Example

```yaml
services:
  web:
    build: ./apps/web
    environment:
      - R2_ENDPOINT=${R2_ENDPOINT}
      - R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
      - R2_BUCKET_NAME=${R2_BUCKET_NAME}
      - DOCUMENT_PARSER_URL=http://document-parser:8002
      - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${CLERK_PUBLISHABLE_KEY}
      - CLERK_SECRET_KEY=${CLERK_SECRET_KEY}

  document-parser:
    build: ./services/document-parser
    environment:
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - CORS_ORIGINS=http://web:3000
```

## Validation

The document parser service logs warnings at startup if OCR API keys are missing:

```
WARNING - GEMINI_API_KEY not set - Gemini OCR will fail at runtime
```

This is acceptable for development if you only need Tier 1 (Tesseract) OCR.

## Related Files

- Parser service: `services/document-parser/main.py`
- OCR orchestrator: `services/document-parser/ocr/orchestrator.py`
- Upload service: `apps/web/src/lib/document-builder/upload-service.ts`
