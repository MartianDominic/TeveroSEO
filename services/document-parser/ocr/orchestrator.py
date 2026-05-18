"""
OCR Orchestrator with tiered escalation.
Phase 102-09: Confidence-based escalation from free to premium.

Tier escalation logic:
- Tier 1 (Tesseract): FREE - use if confidence >= 80%
- Tier 2 (DeepSeek): ~$0.001-0.003/page - use if confidence >= 85%
- Tier 3 (Gemini): ~$0.003/page - final fallback (highest quality)

Cost optimization: Always start with free tier and only escalate when needed.
"""

from dataclasses import dataclass
from typing import List, Literal, Optional

from .tesseract_ocr import extract_with_tesseract
from .deepseek_ocr import extract_with_deepseek
from .gemini_ocr import extract_with_gemini

# Type alias for OCR tier names
OcrTier = Literal["tesseract", "deepseek", "gemini"]

# Confidence thresholds for tier escalation
TESSERACT_THRESHOLD = 80.0
DEEPSEEK_THRESHOLD = 85.0


@dataclass
class OcrResult:
    """Unified result from tiered OCR extraction."""
    text: str
    confidence: float  # 0-100
    tier: OcrTier
    cost: float  # USD
    processing_time: float
    escalation_reason: Optional[str]


async def extract_text_tiered(
    page_images: List[bytes],
    language: str = "eng+lit"
) -> OcrResult:
    """
    Tiered OCR extraction with confidence-based escalation.

    Escalation logic:
    - Tier 1: Tesseract (FREE) - use if confidence >= 80%
    - Tier 2: DeepSeek (cheap) - use if confidence >= 85%
    - Tier 3: Gemini (premium) - final fallback

    Args:
        page_images: List of image bytes (PNG/JPEG)
        language: Language code for Tesseract (default: English + Lithuanian)

    Returns:
        OcrResult with text, confidence, tier used, cost, and escalation reason
    """
    total_cost = 0

    # Tier 1: Try Tesseract first (FREE)
    tesseract_result = await extract_with_tesseract(page_images, language)

    if tesseract_result.confidence >= TESSERACT_THRESHOLD:
        return OcrResult(
            text=tesseract_result.text,
            confidence=tesseract_result.confidence,
            tier="tesseract",
            cost=0,  # Tesseract is free
            processing_time=tesseract_result.processing_time,
            escalation_reason=None,
        )

    # Tier 2: Escalate to DeepSeek (cheap AI)
    escalation_reason = (
        f"Tesseract confidence {tesseract_result.confidence:.1f}% "
        f"< {TESSERACT_THRESHOLD}%"
    )

    deepseek_result = await extract_with_deepseek(page_images)
    total_cost += deepseek_result.cost

    if deepseek_result.confidence >= DEEPSEEK_THRESHOLD:
        return OcrResult(
            text=deepseek_result.text,
            confidence=deepseek_result.confidence,
            tier="deepseek",
            cost=total_cost,
            processing_time=tesseract_result.processing_time + deepseek_result.processing_time,
            escalation_reason=escalation_reason,
        )

    # Tier 3: Escalate to Gemini (premium)
    escalation_reason += (
        f"; DeepSeek confidence {deepseek_result.confidence:.1f}% "
        f"< {DEEPSEEK_THRESHOLD}%"
    )

    gemini_result = await extract_with_gemini(page_images)
    total_cost += gemini_result.cost

    return OcrResult(
        text=gemini_result.text,
        confidence=gemini_result.confidence,
        tier="gemini",
        cost=total_cost,
        processing_time=(
            tesseract_result.processing_time +
            deepseek_result.processing_time +
            gemini_result.processing_time
        ),
        escalation_reason=escalation_reason,
    )
