# TeveroSEO Document Parser Service

Document parsing microservice for Phase 102 Advanced Document Builder. Extracts text with rich metadata from PDF and DOCX files, with tiered AI OCR for scanned documents.

## Purpose

This FastAPI service handles document parsing for the Upload-First Architecture:
- **PDF Parsing**: Text extraction with fonts, colors, positions (PyMuPDF)
- **DOCX Parsing**: Text with formatting, tables, headers (python-docx)
- **Tiered OCR**: Confidence-based escalation from free to premium AI

## Prerequisites

- Python 3.11+
- Tesseract OCR (for Tier 1 free OCR)

### Installing Tesseract

**Ubuntu/Debian:**
```bash
sudo apt-get install tesseract-ocr tesseract-ocr-lit
```

**macOS:**
```bash
brew install tesseract tesseract-lang
```

**Windows:**
Download installer from https://github.com/UB-Mannheim/tesseract/wiki

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | For Tier 2 | DeepSeek OCR via OpenRouter (~$0.001-0.003/page) |
| `GEMINI_API_KEY` | For Tier 3 | Gemini Vision OCR (~$0.003/page) |
| `CORS_ORIGINS` | No | Comma-separated allowed origins (default: `*`) |

### OCR Tier Escalation

1. **Tier 1 (Tesseract)**: FREE - Used if confidence >= 80%
2. **Tier 2 (DeepSeek)**: ~$0.001-0.003/page - Used if confidence >= 85%
3. **Tier 3 (Gemini)**: ~$0.003/page - Final fallback (highest quality)

## API Endpoints

### `POST /parse`

Parse uploaded document and extract text with metadata.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `file` (PDF or DOCX, max 20MB)

**Response:**
```json
{
  "success": true,
  "file_type": "pdf",
  "text": "Extracted text content...",
  "page_count": 5,
  "metadata": {
    "title": "Document Title",
    "author": "Author Name"
  },
  "fonts": [
    {"name": "Arial", "size": 12, "count": 150}
  ],
  "colors": ["#000000", "#1a1a1a"],
  "has_images": true,
  "needs_ocr": false,
  "ocr_tier": null,
  "ocr_confidence": null,
  "ocr_cost": null
}
```

**Error Response (password-protected PDF):**
```json
{
  "success": false,
  "file_type": "pdf",
  "text": "",
  "error": "Password-protected PDF detected. Please remove password protection and re-upload."
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "document-parser",
  "version": "1.0.0"
}
```

## Docker

### Build

```bash
docker build -t tevero/document-parser:latest .
```

### Run

```bash
docker run -d \
  -p 8001:8001 \
  -e OPENROUTER_API_KEY=your_key \
  -e GEMINI_API_KEY=your_key \
  --name document-parser \
  tevero/document-parser:latest
```

### Docker Compose (with AI-Writer)

```yaml
services:
  document-parser:
    build: ./services/document-parser
    ports:
      - "8001:8001"
    environment:
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Local Development

### Setup

```bash
cd services/document-parser
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
```

### Run

```bash
python main.py
# or with uvicorn
uvicorn main:app --reload --port 8001
```

### Test

```bash
pytest tests/ -v
```

### Example Request

```bash
curl -X POST http://localhost:8001/parse \
  -F "file=@document.pdf" \
  | jq
```

## Architecture

```
services/document-parser/
├── main.py              # FastAPI application entry point
├── parsers/
│   ├── pdf_parser.py    # PyMuPDF text/font/color extraction
│   └── docx_parser.py   # python-docx parsing
├── ocr/
│   ├── orchestrator.py  # Tiered OCR orchestration
│   ├── tesseract_ocr.py # Tier 1: Free local OCR
│   ├── deepseek_ocr.py  # Tier 2: DeepSeek via OpenRouter
│   └── gemini_ocr.py    # Tier 3: Gemini Vision (premium)
├── tests/               # pytest test suite
├── Dockerfile
└── requirements.txt
```

## Integration

The Next.js frontend calls this service via `DOCUMENT_PARSER_URL`:

```typescript
// apps/web/src/lib/document-builder/upload-service.ts
const response = await fetch(`${DOCUMENT_PARSER_URL}/parse`, {
  method: 'POST',
  body: formData,
});
```

## Related Documentation

- Phase 102 PRD: `.planning/phases/102-advanced-document-builder/102-PRD.md`
- Upload Architecture: `.planning/phases/102-advanced-document-builder/UPLOAD-FIRST-ARCHITECTURE.md`
- Plan 102-08: `.planning/phases/102-advanced-document-builder/102-08-PLAN.md`
