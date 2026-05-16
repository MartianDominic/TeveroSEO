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
import base64
import os
import time
import json
from dataclasses import dataclass, field
from typing import List, Dict, Any


@dataclass
class GeminiResult:
    """Result from Gemini OCR extraction."""
    text: str
    confidence: float  # 0-100
    cost: float  # USD
    processing_time: float
    structured_data: Dict[str, Any] = field(default_factory=dict)


# Configure Gemini API
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

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
    page_images: List[bytes]
) -> GeminiResult:
    """
    Extract text using Gemini 1.5 Pro Vision.

    Tier 3: ~$0.003/page (premium)
    Best for: Difficult documents, semantic structure needed

    Args:
        page_images: List of image bytes (PNG/JPEG)

    Returns:
        GeminiResult with extracted text, confidence, cost, timing, and structure
    """
    start = time.time()
    all_text = []
    all_structured = []
    total_cost = 0
    confidence_scores = []

    model = genai.GenerativeModel("gemini-1.5-pro-latest")

    for idx, image_bytes in enumerate(page_images):
        base64_image = base64.b64encode(image_bytes).decode("utf-8")

        # Prepare image part for Gemini
        image_part = {
            "mime_type": "image/png",
            "data": base64_image,
        }

        # Call Gemini API
        response = await model.generate_content_async([
            OCR_PROMPT,
            image_part,
        ])

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

        all_text.append(f"--- PAGE {idx + 1} ---\n{page_text}")
        confidence_scores.append(page_confidence)

        # Gemini pricing: ~$1.25/1M input tokens, ~$5.00/1M output tokens
        # Estimate: ~1000 tokens per page image + ~500 output
        page_cost = (1000 * 1.25 + 500 * 5.0) / 1_000_000  # ~$0.00375
        total_cost += page_cost

    avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 98

    return GeminiResult(
        text="\n\n".join(all_text),
        confidence=avg_confidence,
        cost=total_cost,
        processing_time=time.time() - start,
        structured_data={"sections": all_structured} if all_structured else {},
    )
