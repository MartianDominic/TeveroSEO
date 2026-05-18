"""
Tesseract OCR module for local text extraction.
Phase 102-09: Tier 1 - FREE local OCR processing.

Tesseract is the first tier in our OCR pipeline:
- Cost: FREE (local processing)
- Speed: 2-5 seconds per page
- Accuracy: 85-95% for clean scans
- Best for: Standard fonts, clean scans, simple layouts
"""

import asyncio
import logging
import pytesseract
from pytesseract import TesseractError
from PIL import Image
import io
import time
from dataclasses import dataclass
from typing import List

logger = logging.getLogger(__name__)


@dataclass
class TesseractResult:
    """Result from Tesseract OCR extraction."""
    text: str
    confidence: float  # 0-100
    processing_time: float
    language: str


def _process_single_image(image_bytes: bytes, idx: int, language: str) -> tuple[str, float]:
    """
    Process a single image with Tesseract OCR (synchronous).

    This is a helper function designed to be run in a thread pool
    to avoid blocking the event loop.

    Args:
        image_bytes: Raw image bytes (PNG/JPEG)
        idx: Image index for logging
        language: Tesseract language codes

    Returns:
        Tuple of (extracted_text, confidence) or ("", 0) on failure
    """
    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            try:
                # Get text with confidence data
                data = pytesseract.image_to_data(
                    image,
                    lang=language,
                    output_type=pytesseract.Output.DICT
                )
            except TesseractError as e:
                logger.warning("Tesseract failed on image %d: %s - skipping", idx + 1, e)
                return "", 0

            # Extract text from words with positive confidence
            page_text = " ".join(
                word for word, conf in zip(data["text"], data["conf"])
                if conf > 0 and word.strip()
            )

            # Calculate average confidence (exclude -1 values which indicate no text)
            valid_conf = [c for c in data["conf"] if c > 0]
            avg_conf = sum(valid_conf) / len(valid_conf) if valid_conf else 0

            return page_text, avg_conf
    except (IOError, OSError) as e:
        logger.warning("Failed to open image %d: %s - skipping", idx + 1, e)
        return "", 0


async def extract_with_tesseract(
    page_images: List[bytes],
    language: str = "eng+lit"  # English + Lithuanian
) -> TesseractResult:
    """
    Extract text using Tesseract OCR (async, non-blocking).

    Tier 1: FREE, local processing
    Best for: Clean scans, standard fonts

    Uses asyncio.to_thread() to run synchronous Tesseract operations
    in a thread pool, preventing event loop blocking.

    Args:
        page_images: List of image bytes (PNG/JPEG)
        language: Tesseract language codes (default: English + Lithuanian)

    Returns:
        TesseractResult with extracted text, confidence, and timing
    """
    start = time.time()
    logger.info("Tesseract OCR starting for %d page(s), language=%s", len(page_images), language)

    all_text = []
    all_confidence = []

    for idx, image_bytes in enumerate(page_images):
        # Run synchronous Tesseract processing in thread pool to avoid blocking
        page_text, conf = await asyncio.to_thread(
            _process_single_image, image_bytes, idx, language
        )

        if page_text:
            all_text.append(page_text)
        if conf > 0:
            all_confidence.append(conf)

    # Calculate overall average confidence
    avg_confidence = sum(all_confidence) / len(all_confidence) if all_confidence else 0
    processing_time = time.time() - start

    logger.info(
        "Tesseract OCR complete: confidence=%.1f%%, time=%.2fs, pages_processed=%d/%d",
        avg_confidence, processing_time, len(all_text), len(page_images)
    )

    return TesseractResult(
        text="\n\n".join(all_text),
        confidence=avg_confidence,
        processing_time=processing_time,
        language=language,
    )
