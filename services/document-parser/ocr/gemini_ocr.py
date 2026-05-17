"""
Gemini OCR module for premium text extraction.
Phase 102-09: Tier 3 - Premium AI OCR processing.

Gemini is the third tier in our OCR pipeline:
- Cost: ~$0.003 per page
- Speed: 5-15 seconds per page
- Accuracy: 98-99%
- Best for: Difficult documents, semantic structure needed, highest quality
"""

import google.generativeai as genai
import asyncio
import base64
import logging
import os
import time
import json
from dataclasses import dataclass, field
from typing import List, Dict, Any


logger = logging.getLogger(__name__)


@dataclass
class GeminiResult:
    """Result from Gemini OCR extraction."""
    text: str
    confidence: float  # 0-100
    cost: float  # USD
    processing_time: float
    structured_data: Dict[str, Any] = field(default_factory=dict)


# Configure Gemini API with validation
_gemini_api_key = os.getenv("GEMINI_API_KEY")
if not _gemini_api_key:
    logger.warning("GEMINI_API_KEY not set - Gemini OCR will fail at runtime")
try:
    genai.configure(api_key=_gemini_api_key)
except Exception as e:
    logger.error(f"Failed to configure Gemini API: {e}")

# System prompt for structured OCR extraction
OCR_PROMPT = """Extract ALL text from this document image with semantic understanding.

Return a JSON object with:
1. "text": The full extracted text with preserved formatting
2. "sections": Array of detected sections with type hints (heading, paragraph, list, table, etc.)
3. "confidence": Your confidence score 0-100

Preserve:
- Paragraph structure
- List formatting
- Table structure (as markdown tables)
- Lithuanian characters

Return valid JSON only."""


async def extract_with_gemini(
    page_images: List[bytes],
    max_retries: int = 3,
    timeout_seconds: int = 60
) -> GeminiResult:
    """
    Extract text using Gemini 3.1 Pro Vision.

    Tier 3: ~$0.003/page (premium)
    Best for: Difficult documents, semantic structure needed

    Args:
        page_images: List of image bytes (PNG/JPEG)
        max_retries: Number of retry attempts on rate limit (429)
        timeout_seconds: Timeout for each API call

    Returns:
        GeminiResult with extracted text, confidence, cost, timing, and structure
    """
    start = time.time()
    all_text = []
    all_structured = []
    total_cost = 0
    confidence_scores = []

    model = genai.GenerativeModel("gemini-3.1-pro")

    for idx, image_bytes in enumerate(page_images):
        base64_image = base64.b64encode(image_bytes).decode("utf-8")

        # Prepare image part for Gemini
        image_part = {
            "mime_type": "image/png",
            "data": base64_image,
        }

        page_text = ""
        page_confidence = 0

        for attempt in range(max_retries):
            try:
                # Call Gemini API with timeout
                response = await asyncio.wait_for(
                    model.generate_content_async([
                        OCR_PROMPT,
                        image_part,
                    ]),
                    timeout=timeout_seconds
                )

                try:
                    # Parse structured JSON response
                    data = json.loads(response.text)
                    page_text = data.get("text", response.text)
                    page_confidence = data.get("confidence", 98)
                    sections = data.get("sections", [])
                    all_structured.extend(sections)
                except json.JSONDecodeError:
                    # Fallback if not valid JSON
                    page_text = response.text
                    page_confidence = 95

                # Success - break retry loop
                break

            except asyncio.TimeoutError:
                logger.warning(f"Gemini API timeout on page {idx + 1} (attempt {attempt + 1}/{max_retries})")
                if attempt == max_retries - 1:
                    logger.error(f"Gemini API timeout after {max_retries} attempts on page {idx + 1}")
                    page_text = ""
                    page_confidence = 0
                continue

            except Exception as e:
                error_str = str(e).lower()
                # Handle rate limiting (429) with exponential backoff
                if "429" in str(e) or "resource exhausted" in error_str or "rate limit" in error_str:
                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt
                        logger.warning(f"Gemini rate limited on page {idx + 1}, waiting {wait_time}s (attempt {attempt + 1}/{max_retries})")
                        await asyncio.sleep(wait_time)
                        continue
                # Non-retryable error or max retries exceeded
                logger.error(f"Gemini API error on page {idx + 1}: {e}")
                page_text = ""
                page_confidence = 0
                break

        all_text.append(f"--- PAGE {idx + 1} ---\n{page_text}")
        confidence_scores.append(page_confidence)

        # Gemini pricing: ~$1.25/1M input tokens, ~$5.00/1M output tokens
        # Estimate: ~1000 tokens per page image + ~500 output
        page_cost = (1000 * 1.25 + 500 * 5.0) / 1_000_000  # ~$0.00375
        total_cost += page_cost

    avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0

    return GeminiResult(
        text="\n\n".join(all_text),
        confidence=avg_confidence,
        cost=total_cost,
        processing_time=time.time() - start,
        structured_data={"sections": all_structured} if all_structured else {},
    )
