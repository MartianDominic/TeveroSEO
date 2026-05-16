"""
PDF Parser using PyMuPDF (fitz).
Phase 102-08: Extracts text, fonts, colors, positions.

Key features:
- Full text extraction with position metadata
- Font information (name, size, frequency)
- Color palette extraction
- Image detection for OCR decision
- Password-protected PDF detection
"""

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

    doc = None
    try:
        doc = fitz.open(file_path)
    except Exception as e:
        error_str = str(e).lower()
        if "password" in error_str or "encrypted" in error_str:
            raise ValueError("Password-protected PDF detected. Please remove password protection.")
        raise

    # Check if encrypted
    if doc.is_encrypted:
        doc.close()
        raise ValueError("Password-protected PDF detected. Please remove password protection.")

    all_text = []
    all_fonts: Counter = Counter()
    all_colors: Counter = Counter()
    has_images = False
    needs_ocr = False
    page_images = []

    # Extract metadata before iterating
    doc_metadata = {
        "title": doc.metadata.get("title", "") if doc.metadata else "",
        "author": doc.metadata.get("author", "") if doc.metadata else "",
        "creator": doc.metadata.get("creator", "") if doc.metadata else "",
    }

    for page_num, page in enumerate(doc):
        # Extract text with formatting
        blocks = page.get_text("dict")["blocks"]
        page_text = []
        page_has_text = False

        for block in blocks:
            if block["type"] == 0:  # Text block
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        text = span.get("text", "")
                        if text.strip():
                            page_text.append(text)
                            page_has_text = True

                            # Track fonts
                            font_name = span.get("font", "unknown")
                            font_size = span.get("size", 12)
                            font_key = f"{font_name}:{font_size:.0f}"
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
            # Render page to image for potential OCR
            try:
                pix = page.get_pixmap(dpi=150)
                page_images.append(pix.tobytes("png"))
            except Exception:
                # Silently skip if rendering fails
                pass

    doc.close()

    # Build font list (top 10 by usage)
    fonts = []
    for font_key, count in all_fonts.most_common(10):
        parts = font_key.rsplit(":", 1)
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
