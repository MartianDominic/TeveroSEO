# Document Parser Dockerfile
# Multi-stage build for smaller final image

FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Final stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    # PyMuPDF dependencies
    libmupdf-dev \
    # Tesseract OCR with English and Lithuanian language packs (C3 fix)
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-lit \
    # wget for healthcheck
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid 1000 appuser \
    && useradd --uid 1000 --gid 1000 --shell /bin/bash --create-home appuser

# Copy Python packages from builder
COPY --from=builder /root/.local /home/appuser/.local
ENV PATH=/home/appuser/.local/bin:$PATH

# Copy application code
COPY --chown=appuser:appuser main.py .
COPY --chown=appuser:appuser parsers/ ./parsers/
COPY --chown=appuser:appuser ocr/ ./ocr/

# Switch to non-root user
USER appuser

# Expose port (8002 to avoid conflict with scrapling-engine on 8001 - C5 fix)
EXPOSE 8002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8002/health || exit 1

# Run with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
