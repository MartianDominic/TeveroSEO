# Embedding Server Dockerfile
# Phase 83: v5-nano embedding infrastructure
#
# Build: docker build -t embedding-server .
# Run: docker run -p 8001:8001 embedding-server
#
# Memory requirements:
# - v5-nano model: ~300MB
# - Runtime overhead: ~700MB
# - Recommended container limit: 2GB

FROM python:3.11-slim

LABEL maintainer="TeveroSEO"
LABEL description="Jina v5-nano embedding server for keyword intelligence"

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the model during build (avoids cold start)
# This adds ~300MB to the image but eliminates startup delay
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('jinaai/jina-embeddings-v5-text-nano', trust_remote_code=True)"

# Copy server code
COPY server.py .

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Run server
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
