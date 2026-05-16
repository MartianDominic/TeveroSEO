"""
OCR modules for tiered text extraction.
Phase 102-09: Tesseract (free) -> DeepSeek (cheap) -> Gemini (premium)

Tiered OCR pipeline with confidence-based escalation:
- Tier 1: Tesseract (FREE, 80% threshold)
- Tier 2: DeepSeek via OpenRouter (~$0.002/page, 85% threshold)
- Tier 3: Gemini Vision (~$0.004/page, final fallback)
"""

from .tesseract_ocr import extract_with_tesseract, TesseractResult
from .deepseek_ocr import extract_with_deepseek, DeepSeekResult
from .gemini_ocr import extract_with_gemini, GeminiResult
from .orchestrator import extract_text_tiered, OcrResult, OcrTier

__all__ = [
    # Tier 1: Tesseract
    "extract_with_tesseract",
    "TesseractResult",
    # Tier 2: DeepSeek
    "extract_with_deepseek",
    "DeepSeekResult",
    # Tier 3: Gemini
    "extract_with_gemini",
    "GeminiResult",
    # Orchestrator
    "extract_text_tiered",
    "OcrResult",
    "OcrTier",
]
