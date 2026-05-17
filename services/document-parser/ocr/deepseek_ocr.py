"""
DeepSeek OCR module via OpenRouter API.
Phase 102-09: Tier 2 - Cheap AI OCR processing.

DeepSeek is the second tier in our OCR pipeline:
- Cost: ~$0.001-0.003 per page
- Speed: 3-8 seconds per page
- Accuracy: 95-98%
- Best for: Complex layouts, unusual fonts, context-aware fixes
"""

import logging
import httpx
import asyncio
import base64
import os
import time
from dataclasses import dataclass
from typing import List

logger = logging.getLogger(__name__)


@dataclass
class DeepSeekResult:
    """Result from DeepSeek OCR extraction."""
    text: str
    confidence: float  # 0-100
    cost: float  # USD
    processing_time: float


# OpenRouter configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
DEEPSEEK_MODEL = "deepseek/deepseek-chat"  # Use deepseek-vl2 when available

# System prompt for OCR extraction
OCR_PROMPT = """Extract ALL text from this document image.

Rules:
1. Preserve paragraph structure with blank lines between sections
2. Preserve list formatting (bullets, numbers)
3. For tables, use | column | separators |
4. Include ALL text, even small print
5. Fix obvious OCR-like errors based on context
6. If text is in Lithuanian, preserve Lithuanian characters correctly

Return ONLY the extracted text, no commentary."""


async def extract_with_deepseek(
    page_images: List[bytes],
    max_retries: int = 3
) -> DeepSeekResult:
    """
    Extract text using DeepSeek via OpenRouter.

    Tier 2: ~$0.001-0.003/page
    Best for: Complex layouts, unusual fonts, context-aware fixes

    Args:
        page_images: List of image bytes (PNG/JPEG)
        max_retries: Number of retry attempts on rate limit

    Returns:
        DeepSeekResult with extracted text, confidence, cost, and timing
    """
    start = time.time()
    all_text = []
    total_cost = 0
    logger.info("DeepSeek OCR starting for %d page(s)", len(page_images))

    async with httpx.AsyncClient(timeout=60) as client:
        for idx, image_bytes in enumerate(page_images):
            base64_image = base64.b64encode(image_bytes).decode("utf-8")

            for attempt in range(max_retries):
                try:
                    response = await client.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                            "HTTP-Referer": "https://tevero.lt",
                            "X-Title": "TeveroSEO Document Processing",
                        },
                        json={
                            "model": DEEPSEEK_MODEL,
                            "messages": [
                                {
                                    "role": "user",
                                    "content": [
                                        {
                                            "type": "image_url",
                                            "image_url": {
                                                "url": f"data:image/png;base64,{base64_image}"
                                            },
                                        },
                                        {"type": "text", "text": OCR_PROMPT},
                                    ],
                                }
                            ],
                            "max_tokens": 4000,
                            "temperature": 0.1,
                        },
                    )
                    response.raise_for_status()
                    data = response.json()

                    page_text = data["choices"][0]["message"]["content"]
                    all_text.append(f"--- PAGE {idx + 1} ---\n{page_text}")

                    # Calculate cost based on token usage
                    # DeepSeek pricing: $0.07/1M input, $0.27/1M output (via OpenRouter)
                    usage = data.get("usage", {})
                    input_tokens = usage.get("prompt_tokens", 1000)
                    output_tokens = usage.get("completion_tokens", 500)
                    page_cost = (input_tokens * 0.07 + output_tokens * 0.27) / 1_000_000
                    total_cost += page_cost
                    break

                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 429 and attempt < max_retries - 1:
                        # Rate limited - exponential backoff
                        logger.warning("Rate limited on page %d, attempt %d - retrying", idx + 1, attempt + 1)
                        await asyncio.sleep(2 ** attempt)
                        continue
                    # Non-retryable HTTP error or max retries exceeded
                    logger.error(
                        "DeepSeek API HTTP error on page %d after %d attempts: %s (status=%d)",
                        idx + 1, attempt + 1, e, e.response.status_code
                    )
                    all_text.append(f"--- PAGE {idx + 1} ---\n[OCR failed: HTTP {e.response.status_code}]")
                    break
                except (httpx.ConnectError, httpx.TimeoutException) as e:
                    if attempt < max_retries - 1:
                        logger.warning(
                            "Connection error on page %d, attempt %d: %s - retrying",
                            idx + 1, attempt + 1, type(e).__name__
                        )
                        await asyncio.sleep(2 ** attempt)
                        continue
                    # Max retries exceeded for connection errors
                    logger.error(
                        "DeepSeek connection failed on page %d after %d attempts: %s",
                        idx + 1, attempt + 1, type(e).__name__
                    )
                    all_text.append(f"--- PAGE {idx + 1} ---\n[OCR failed: {type(e).__name__}]")
                    break
                except Exception as e:
                    # Catch-all for unexpected errors (JSON decode, key errors, etc.)
                    logger.error(
                        "Unexpected error during DeepSeek OCR on page %d: %s",
                        idx + 1, e
                    )
                    all_text.append(f"--- PAGE {idx + 1} ---\n[OCR failed: {type(e).__name__}]")
                    break

    processing_time = time.time() - start
    combined_text = "\n\n".join(all_text)

    # Estimate confidence based on text quality indicators:
    # - Base confidence of 85% (DeepSeek is generally reliable)
    # - Boost based on text density (more text = higher confidence)
    # - This is an estimate since DeepSeek doesn't return confidence scores
    if not combined_text.strip():
        confidence = 0.0
    else:
        # Calculate text density: characters per page (excluding page markers)
        text_without_markers = "\n".join(
            line for line in combined_text.split("\n")
            if not line.startswith("--- PAGE")
        )
        chars_per_page = len(text_without_markers) / max(len(page_images), 1)
        # Scale: 0 chars = 85%, 500+ chars = 95% (capped)
        density_boost = min(chars_per_page / 500, 1.0) * 10
        confidence = 85.0 + density_boost

    logger.info(
        "DeepSeek OCR complete: confidence=%.1f%%, cost=$%.4f, time=%.2fs, pages=%d",
        confidence, total_cost, processing_time, len(page_images)
    )

    return DeepSeekResult(
        text=combined_text,
        confidence=confidence,
        cost=total_cost,
        processing_time=processing_time,
    )
