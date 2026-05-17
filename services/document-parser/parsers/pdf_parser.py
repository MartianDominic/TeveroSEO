"""
PDF Parser using PyMuPDF (fitz).
Phase 102-08: Extracts text, fonts, colors, positions.

Key features:
- Full text extraction with position metadata
- Font information (name, size, frequency)
- Color palette extraction
- Image detection for OCR decision
- Password-protected PDF detection
- Memory-efficient streaming for large PDFs
"""

import gc
import fitz  # PyMuPDF
from dataclasses import dataclass, field
from typing import List, Dict, Any
from collections import Counter


@dataclass
class PdfParseResult:
    """Result from PDF parsing."""
    text: str
    page_count: int
    metadata: Dict[str, Any]
    fonts: List[Dict[str, Any]]
    colors: List[str]
    has_images: bool
    needs_ocr: bool
    page_images: List[bytes] = field(default_factory=list)  # For OCR fallback


def parse_pdf(file_path: str) -> PdfParseResult:
    """
    Parse PDF and extract text with rich metadata.

    Returns structured data including:
    - Full text content (page-separated)
    - Font information (name, size, frequency)
    - Color palette (hex colors)
    - Image presence (for OCR decision)

    Raises:
        ValueError: For password-protected PDFs
    """

    # Validate file can be opened and check encryption before processing
    try:
        with fitz.open(file_path) as test_doc:
            if test_doc.is_encrypted:
                raise ValueError("Password-protected PDF detected. Please remove password protection.")
    except fitz.fitz.FileDataError as e:
        error_str = str(e).lower()
        if "password" in error_str or "encrypted" in error_str:
            raise ValueError("Password-protected PDF detected. Please remove password protection.")
        raise

    all_text = []
    all_fonts: Counter = Counter()
    all_colors: Counter = Counter()
    has_images = False
    needs_ocr = False
    page_images = []
    doc_metadata = {}

    # Use context manager to ensure proper cleanup on all code paths
    with fitz.open(file_path) as doc:
        # Extract metadata before iterating
        doc_metadata = {
            "title": doc.metadata.get("title", "") if doc.metadata else "",
            "author": doc.metadata.get("author", "") if doc.metadata else "",
            "creator": doc.metadata.get("creator", "") if doc.metadata else "",
        }

        for page_num in range(len(doc)):
            # Load page explicitly for memory control
            page = doc.load_page(page_num)

            # Extract text with formatting
            blocks = page.get_text("dict")["blocks"]
            page_text = []

            for block in blocks:
                if block["type"] == 0:  # Text block
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            text = span.get("text", "")
                            if text.strip():
                                page_text.append(text)

                                # Track fonts (use | separator to avoid conflicts with font names containing colons)
                                font_name = span.get("font", "unknown")
                                font_size = span.get("size", 12)
                                font_key = f"{font_name}|{font_size:.0f}"
                                all_fonts[font_key] += len(text)

                                # Track colors (as hex)
                                color = span.get("color", 0)
                                if isinstance(color, int):
                                    hex_color = f"#{color:06x}"
                                    all_colors[hex_color] += len(text)

                elif block["type"] == 1:  # Image block
                    has_images = True

            text = " ".join(page_text).strip()
            all_text.append(text)

            # If page has very little text but has images, likely needs OCR
            if len(text) < 50 and has_images:
                needs_ocr = True
                # Render page to image for potential OCR - limit to first 3 pages
                # to avoid memory explosion on large image-heavy PDFs
                if len(page_images) < 3:
                    try:
                        pix = page.get_pixmap(dpi=150)
                        page_images.append(pix.tobytes("png"))
                        del pix  # Release pixmap memory immediately
                    except Exception:
                        # Silently skip if rendering fails
                        pass

            # Release page memory after processing
            del page

            # For large documents (100+ pages), trigger garbage collection periodically
            if page_num > 0 and page_num % 50 == 0:
                gc.collect()

    # Build font list (top 10 by usage)
    fonts = []
    for font_key, count in all_fonts.most_common(10):
        parts = font_key.rsplit("|", 1)
        if len(parts) == 2:
            fonts.append({
                "font": parts[0],
                "size": float(parts[1]),
                "usage": count,
            })

    # Build color list (top 5 by usage)
    colors = [color for color, _ in all_colors.most_common(5)]

    return PdfParseResult(
        text="\n\n".join(all_text),
        page_count=len(all_text),
        metadata=doc_metadata,
        fonts=fonts,
        colors=colors,
        has_images=has_images,
        needs_ocr=needs_ocr,
        page_images=page_images if needs_ocr else [],
    )


def extract_fonts(file_path: str) -> List[Dict[str, Any]]:
    """Extract just font information from PDF."""
    result = parse_pdf(file_path)
    return result.fonts


def extract_colors(file_path: str) -> List[str]:
    """Extract just color palette from PDF."""
    result = parse_pdf(file_path)
    return result.colors
