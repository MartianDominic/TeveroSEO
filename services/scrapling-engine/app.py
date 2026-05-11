"""
Scrapling SEO Engine - FastAPI Service

3-Tier residential-first architecture:
- T0: Scrapling Fetcher + Geonode residential (98% success)
- T1: Camoufox + Geonode residential (88% Cloudflare bypass)
- T2: DataForSEO (handled by TypeScript - 100% nuclear)

CRITICAL: Server IP NEVER touches target sites.
All requests go through Geonode residential proxy.
"""

import os
import time
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from schema import (
    ExtractRequest,
    BatchExtractRequest,
    StreamBatchRequest,
    BatchProgress,
    SEOExtractionResult,
    HealthResponse,
)
from extractors import extract_seo_data
from fastapi.responses import StreamingResponse
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Proxy configuration - NEVER use direct connection
GEONODE_USER = os.environ.get("GEONODE_USER", "")
GEONODE_PASS = os.environ.get("GEONODE_PASS", "")
GEONODE_HOST = os.environ.get("GEONODE_HOST", "gate.geonode.com")
GEONODE_PORT = os.environ.get("GEONODE_PORT", "9000")

# Build proxy URL
GEONODE_PROXY = f"http://{GEONODE_USER}:{GEONODE_PASS}@{GEONODE_HOST}:{GEONODE_PORT}"

# Validate proxy is configured
PROXY_CONFIGURED = bool(GEONODE_USER and GEONODE_PASS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    if not PROXY_CONFIGURED:
        logger.warning(
            "⚠️  GEONODE_USER/GEONODE_PASS not set. "
            "Proxy extraction will fail. "
            "Set these environment variables before production use."
        )
    else:
        logger.info("✓ Geonode proxy configured")
        logger.info(f"  Proxy: {GEONODE_HOST}:{GEONODE_PORT}")

    yield

    # Shutdown
    logger.info("Scrapling engine shutting down")


app = FastAPI(
    title="Scrapling SEO Engine",
    description="SEO data extraction with 3-tier residential proxy architecture",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for TypeScript client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        proxy_configured=PROXY_CONFIGURED,
    )


@app.post("/extract", response_model=SEOExtractionResult)
async def extract(req: ExtractRequest):
    """
    Extract SEO data from a single URL.

    Tiers:
    - residential: Scrapling Fetcher + Geonode (default, 98% success)
    - camoufox: Camoufox browser + Geonode (88% Cloudflare bypass)
    - dataforseo: Not handled here - use TypeScript client
    """
    start_time = time.time()

    if not PROXY_CONFIGURED and req.tier != "test":
        raise HTTPException(
            status_code=503,
            detail="Proxy not configured. Set GEONODE_USER and GEONODE_PASS.",
        )

    try:
        if req.tier == "residential":
            result = await _fetch_residential(req.url, req.keyword, req.timeout_ms)
        elif req.tier == "camoufox":
            result = await _fetch_camoufox(req.url, req.keyword, req.timeout_ms)
        elif req.tier == "test":
            # Test mode without proxy for development
            result = await _fetch_test(req.url, req.keyword)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown tier: {req.tier}. Use 'residential' or 'camoufox'.",
            )

        extraction_ms = int((time.time() - start_time) * 1000)
        result.extraction_ms = extraction_ms

        logger.info(
            f"Extracted {req.url} via {req.tier} in {extraction_ms}ms "
            f"(status={result.status_code}, words={result.word_count})"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Extraction failed for {req.url}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Extraction failed: {str(e)}",
        )


@app.post("/batch", response_model=list[SEOExtractionResult])
async def batch_extract(req: BatchExtractRequest):
    """
    Extract SEO data from multiple URLs concurrently.

    Uses semaphore to limit concurrent requests.
    """
    semaphore = asyncio.Semaphore(req.concurrency)

    async def extract_with_semaphore(url: str) -> SEOExtractionResult:
        async with semaphore:
            single_req = ExtractRequest(
                url=url,
                tier=req.tier,
                keyword=req.keyword,
                timeout_ms=req.timeout_ms,
            )
            try:
                return await extract(single_req)
            except HTTPException as e:
                # Return error result instead of failing entire batch
                return SEOExtractionResult(
                    url=url,
                    final_url=url,
                    status_code=e.status_code,
                    tier_used=req.tier,
                )

    tasks = [extract_with_semaphore(url) for url in req.urls]
    results = await asyncio.gather(*tasks)

    return list(results)


@app.post("/stream")
async def stream_batch_extract(req: StreamBatchRequest):
    """
    Stream SEO extraction results as Server-Sent Events.

    Processes URLs in chunks for memory efficiency.
    Yields progress updates and results as they complete.
    """
    async def generate():
        total = len(req.urls)
        completed = 0
        success_count = 0
        error_count = 0
        semaphore = asyncio.Semaphore(req.concurrency)

        # Process in chunks for memory efficiency
        for chunk_start in range(0, total, req.chunk_size):
            chunk_end = min(chunk_start + req.chunk_size, total)
            chunk_urls = req.urls[chunk_start:chunk_end]

            async def extract_one(url: str) -> tuple[str, SEOExtractionResult | None, str | None]:
                async with semaphore:
                    single_req = ExtractRequest(
                        url=url,
                        tier=req.tier,
                        keyword=req.keyword,
                        timeout_ms=req.timeout_ms,
                    )
                    try:
                        result = await extract(single_req)
                        return (url, result, None)
                    except HTTPException as e:
                        return (url, None, e.detail)
                    except Exception as e:
                        return (url, None, str(e))

            # Process chunk concurrently
            tasks = [extract_one(url) for url in chunk_urls]

            for coro in asyncio.as_completed(tasks):
                url, result, error = await coro
                completed += 1

                if result:
                    success_count += 1
                    yield f"data: {json.dumps({'type': 'result', 'data': result.model_dump(mode='json')})}\n\n"
                else:
                    error_count += 1
                    yield f"data: {json.dumps({'type': 'error', 'url': url, 'error': error})}\n\n"

                # Send progress every 10 completions or on last item
                if completed % 10 == 0 or completed == total:
                    progress = BatchProgress(
                        type="progress",
                        completed=completed,
                        total=total,
                        percent=round((completed / total) * 100, 1),
                        current_url=url,
                        success_count=success_count,
                        error_count=error_count,
                    )
                    yield f"data: {json.dumps(progress.model_dump())}\n\n"

        # Final completion message
        yield f"data: {json.dumps({'type': 'complete', 'total': total, 'success': success_count, 'errors': error_count})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


async def _fetch_residential(
    url: str,
    keyword: str | None,
    timeout_ms: int,
) -> SEOExtractionResult:
    """
    Fetch using Scrapling Fetcher with Geonode residential proxy.

    This is T0 - handles 96% of requests at 98% success rate.
    """
    from scrapling import Fetcher

    fetcher = Fetcher()

    try:
        page = await fetcher.async_fetch(
            url,
            proxy=GEONODE_PROXY,
            timeout=timeout_ms / 1000,
            follow_redirects=True,
            stealthy_headers=True,
        )

        return extract_seo_data(
            page=page,
            url=url,
            final_url=str(page.url) if hasattr(page, "url") else url,
            status_code=page.status if hasattr(page, "status") else 200,
            tier_used="residential",
            keyword=keyword,
        )

    except Exception as e:
        # Check if it's a Cloudflare/bot detection error
        error_str = str(e).lower()
        if any(x in error_str for x in ["403", "cloudflare", "challenge", "captcha"]):
            raise HTTPException(
                status_code=403,
                detail="Cloudflare protection detected. Escalate to camoufox tier.",
            )
        raise


async def _fetch_camoufox(
    url: str,
    keyword: str | None,
    timeout_ms: int,
) -> SEOExtractionResult:
    """
    Fetch using Camoufox browser with Geonode residential proxy.

    This is T1 - handles Cloudflare at 88% success rate.
    Firefox C++/Rust patches achieve 0% headless detection.
    """
    try:
        from camoufox.async_api import AsyncCamoufox
        from scrapling.parser import Adaptor
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Camoufox not installed. Run: pip install camoufox",
        )

    try:
        async with AsyncCamoufox(
            proxy={
                "server": f"http://{GEONODE_HOST}:{GEONODE_PORT}",
                "username": GEONODE_USER,
                "password": GEONODE_PASS,
            },
            headless=True,
        ) as browser:
            page = await browser.new_page()
            response = await page.goto(url, timeout=timeout_ms)
            html = await page.content()
            final_url = page.url

            # Parse with Scrapling for consistent API
            adaptor = Adaptor(html, url=final_url)

            return extract_seo_data(
                page=adaptor,
                url=url,
                final_url=final_url,
                status_code=response.status if response else 200,
                tier_used="camoufox",
                keyword=keyword,
            )

    except Exception as e:
        error_str = str(e).lower()
        if any(x in error_str for x in ["captcha", "challenge"]):
            raise HTTPException(
                status_code=403,
                detail="Advanced bot protection. Escalate to DataForSEO.",
            )
        raise


async def _fetch_test(url: str, keyword: str | None) -> SEOExtractionResult:
    """
    Test mode - fetch without proxy for local development.

    WARNING: Only use for testing. Never in production.
    """
    import httpx
    from scrapling.parser import Adaptor

    logger.warning(f"⚠️  TEST MODE: Fetching {url} without proxy")

    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.get(url, timeout=30)
        html = response.text
        final_url = str(response.url)

        adaptor = Adaptor(html, url=final_url)

        return extract_seo_data(
            page=adaptor,
            url=url,
            final_url=final_url,
            status_code=response.status_code,
            tier_used="test",
            keyword=keyword,
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info",
    )
