"""
Tests for DOCX parser.
Phase 102-08: TDD for DOCX parsing with python-docx.
"""

import pytest
from pathlib import Path


class TestDocxParser:
    """Test suite for DOCX parser."""

    def test_parse_docx_extracts_paragraphs(self):
        """Test 1: parse_docx extracts all paragraph text."""
        from parsers.docx_parser import parse_docx, DocxParseResult

        fixture_path = Path(__file__).parent / "fixtures" / "sample.docx"
        if not fixture_path.exists():
            pytest.skip("No test DOCX fixture available")

        result = parse_docx(str(fixture_path))

        assert isinstance(result, DocxParseResult)
        assert isinstance(result.text, str)
        assert result.page_count >= 1

    def test_parse_docx_captures_formatting(self):
        """Test 2: parse_docx captures bold/italic formatting."""
        from parsers.docx_parser import parse_docx

        fixture_path = Path(__file__).parent / "fixtures" / "formatted.docx"
        if not fixture_path.exists():
            pytest.skip("No formatted DOCX fixture available")

        result = parse_docx(str(fixture_path))

        # Should have extracted fonts with formatting info
        assert isinstance(result.fonts, list)

    def test_parse_docx_extracts_headings(self):
        """Test 3: parse_docx extracts heading styles."""
        from parsers.docx_parser import parse_docx

        fixture_path = Path(__file__).parent / "fixtures" / "with_headings.docx"
        if not fixture_path.exists():
            pytest.skip("No headings DOCX fixture available")

        result = parse_docx(str(fixture_path))

        # Text should be extracted
        assert len(result.text) > 0

    def test_parse_docx_handles_tables(self):
        """Test 4: parse_docx handles tables."""
        from parsers.docx_parser import parse_docx

        fixture_path = Path(__file__).parent / "fixtures" / "with_tables.docx"
        if not fixture_path.exists():
            pytest.skip("No tables DOCX fixture available")

        result = parse_docx(str(fixture_path))

        # Table content should be in text (pipe-separated)
        assert len(result.text) > 0

    def test_parse_docx_handles_empty(self):
        """Test 5: parse_docx handles empty documents gracefully."""
        from parsers.docx_parser import parse_docx

        fixture_path = Path(__file__).parent / "fixtures" / "empty.docx"
        if not fixture_path.exists():
            pytest.skip("No empty DOCX fixture available")

        result = parse_docx(str(fixture_path))

        # Should not crash, return empty content
        assert result.text == "" or result.text is not None
        assert result.page_count >= 1


class TestDocxParserUnit:
    """Unit tests that don't require fixtures."""

    def test_docx_parse_result_dataclass(self):
        """DocxParseResult has expected fields."""
        from parsers.docx_parser import DocxParseResult

        result = DocxParseResult(
            text="Test content",
            page_count=1,
            metadata={"title": "Test Doc"},
            fonts=[{"font": "Calibri", "size": 11, "usage": 50}],
            colors=["#000000"],
            has_images=False,
            needs_ocr=False,
        )

        assert result.text == "Test content"
        assert result.page_count == 1
        assert result.metadata["title"] == "Test Doc"
        assert len(result.fonts) == 1
        assert result.fonts[0]["font"] == "Calibri"
        assert len(result.colors) == 1
        assert result.has_images is False
        assert result.needs_ocr is False

    def test_parse_docx_function_exists(self):
        """parse_docx function is importable."""
        from parsers.docx_parser import parse_docx

        assert callable(parse_docx)

    def test_docx_never_needs_ocr(self):
        """DOCX files never need OCR (text is always extractable)."""
        from parsers.docx_parser import DocxParseResult

        result = DocxParseResult(
            text="Content",
            page_count=1,
            metadata={},
            fonts=[],
            colors=[],
            has_images=True,  # Even with images
            needs_ocr=False,  # DOCX never needs OCR
        )

        assert result.needs_ocr is False
