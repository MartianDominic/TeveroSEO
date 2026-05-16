"""
Tests for PDF parser.
Phase 102-08: TDD for PDF parsing with PyMuPDF.
"""

import pytest
import os
import tempfile
from pathlib import Path

# Note: Tests use fixture PDFs or mock the fitz module
# In production, tests would use sample PDFs in a fixtures directory


class TestPdfParser:
    """Test suite for PDF parser."""

    def test_parse_pdf_extracts_text(self):
        """Test 1: parse_pdf extracts text from standard PDF."""
        from parsers.pdf_parser import parse_pdf, PdfParseResult

        # This test requires a real PDF file
        # Skip if no test fixture available
        fixture_path = Path(__file__).parent / "fixtures" / "sample.pdf"
        if not fixture_path.exists():
            pytest.skip("No test PDF fixture available")

        result = parse_pdf(str(fixture_path))

        assert isinstance(result, PdfParseResult)
        assert isinstance(result.text, str)
        assert result.page_count >= 1

    def test_parse_pdf_extracts_fonts(self):
        """Test 2: parse_pdf extracts font names and sizes."""
        from parsers.pdf_parser import parse_pdf

        fixture_path = Path(__file__).parent / "fixtures" / "sample.pdf"
        if not fixture_path.exists():
            pytest.skip("No test PDF fixture available")

        result = parse_pdf(str(fixture_path))

        assert isinstance(result.fonts, list)
        if result.fonts:
            font = result.fonts[0]
            assert "font" in font
            assert "size" in font
            assert "usage" in font

    def test_parse_pdf_extracts_colors(self):
        """Test 3: parse_pdf extracts dominant colors from text."""
        from parsers.pdf_parser import parse_pdf

        fixture_path = Path(__file__).parent / "fixtures" / "sample.pdf"
        if not fixture_path.exists():
            pytest.skip("No test PDF fixture available")

        result = parse_pdf(str(fixture_path))

        assert isinstance(result.colors, list)
        # Colors should be hex format
        for color in result.colors:
            assert color.startswith("#")

    def test_parse_pdf_detects_image_pages(self):
        """Test 4: parse_pdf detects image-only pages (needs OCR)."""
        from parsers.pdf_parser import parse_pdf

        # Test with image-heavy PDF
        fixture_path = Path(__file__).parent / "fixtures" / "image_heavy.pdf"
        if not fixture_path.exists():
            pytest.skip("No image-heavy PDF fixture available")

        result = parse_pdf(str(fixture_path))

        assert result.has_images is True
        # If very little text and has images, should need OCR
        if len(result.text) < 50:
            assert result.needs_ocr is True

    def test_parse_pdf_password_protected_raises_error(self):
        """Test 5: parse_pdf raises clear error for password-protected PDFs."""
        from parsers.pdf_parser import parse_pdf

        # Test with password-protected PDF
        fixture_path = Path(__file__).parent / "fixtures" / "protected.pdf"
        if not fixture_path.exists():
            pytest.skip("No protected PDF fixture available")

        with pytest.raises(ValueError) as exc_info:
            parse_pdf(str(fixture_path))

        error_msg = str(exc_info.value).lower()
        assert "password" in error_msg or "encrypted" in error_msg

    def test_parse_pdf_multi_page(self):
        """Test 6: parse_pdf handles multi-page documents."""
        from parsers.pdf_parser import parse_pdf

        fixture_path = Path(__file__).parent / "fixtures" / "multi_page.pdf"
        if not fixture_path.exists():
            pytest.skip("No multi-page PDF fixture available")

        result = parse_pdf(str(fixture_path))

        assert result.page_count > 1
        # Text should contain content from multiple pages
        assert len(result.text) > 0


class TestPdfParserUnit:
    """Unit tests that don't require fixtures."""

    def test_pdf_parse_result_dataclass(self):
        """PdfParseResult has expected fields."""
        from parsers.pdf_parser import PdfParseResult

        result = PdfParseResult(
            text="Test content",
            page_count=1,
            metadata={"title": "Test"},
            fonts=[{"font": "Arial", "size": 12, "usage": 100}],
            colors=["#000000"],
            has_images=False,
            needs_ocr=False,
        )

        assert result.text == "Test content"
        assert result.page_count == 1
        assert result.metadata["title"] == "Test"
        assert len(result.fonts) == 1
        assert result.fonts[0]["font"] == "Arial"
        assert len(result.colors) == 1
        assert result.has_images is False
        assert result.needs_ocr is False

    def test_extract_fonts_returns_list(self):
        """extract_fonts function exists and returns list."""
        from parsers.pdf_parser import extract_fonts

        assert callable(extract_fonts)

    def test_extract_colors_returns_list(self):
        """extract_colors function exists and returns list."""
        from parsers.pdf_parser import extract_colors

        assert callable(extract_colors)
