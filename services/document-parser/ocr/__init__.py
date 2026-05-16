"""
OCR modules for tiered text extraction.
Phase 102-09: Tesseract (free) -> DeepSeek (cheap) -> Gemini (premium)
"""

from .tesseract_ocr import extract_with_tesseract, TesseractResult

__all__ = [
    "extract_with_tesseract",
    "TesseractResult",
]
