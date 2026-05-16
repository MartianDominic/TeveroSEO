"""
Tests for Gemini OCR module.
Phase 102-09: TDD tests for tier 3 (premium AI) OCR.
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import json


class TestGeminiOcr:
    """Test suite for Gemini OCR extraction."""

    @pytest.mark.asyncio
    async def test_extract_calls_gemini_api(self):
        """Test 1: extract_with_gemini calls Gemini API."""
        from ocr.gemini_ocr import extract_with_gemini, GeminiResult

        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "text": "Extracted content from Gemini",
            "confidence": 98,
            "sections": [{"type": "paragraph", "text": "Extracted content from Gemini"}],
        })

        mock_model = MagicMock()
        mock_model.generate_content_async = AsyncMock(return_value=mock_response)

        with patch("ocr.gemini_ocr.genai") as mock_genai:
            mock_genai.GenerativeModel.return_value = mock_model

            from PIL import Image
            import io
            img = Image.new("RGB", (100, 50), color="white")
            img_bytes = io.BytesIO()
            img.save(img_bytes, format="PNG")

            result = await extract_with_gemini([img_bytes.getvalue()])

            assert isinstance(result, GeminiResult)
            mock_model.generate_content_async.assert_called_once()

    @pytest.mark.asyncio
    async def test_extract_returns_structured_text(self):
        """Test 2: extract_with_gemini returns structured text with semantic understanding."""
        from ocr.gemini_ocr import extract_with_gemini

        structured_response = {
            "text": "Document title here\n\nFirst section content.\n\nSecond section content.",
            "confidence": 98,
            "sections": [
                {"type": "heading", "text": "Document title here"},
                {"type": "paragraph", "text": "First section content."},
                {"type": "paragraph", "text": "Second section content."},
            ],
        }

        mock_response = MagicMock()
        mock_response.text = json.dumps(structured_response)

        mock_model = MagicMock()
        mock_model.generate_content_async = AsyncMock(return_value=mock_response)

        with patch("ocr.gemini_ocr.genai") as mock_genai:
            mock_genai.GenerativeModel.return_value = mock_model

            from PIL import Image
            import io
            img = Image.new("RGB", (100, 50), color="white")
            img_bytes = io.BytesIO()
            img.save(img_bytes, format="PNG")

            result = await extract_with_gemini([img_bytes.getvalue()])

            assert "Document title here" in result.text
            assert "First section" in result.text
            assert result.structured_data is not None

    @pytest.mark.asyncio
    async def test_extract_tracks_cost(self):
        """Test 3: extract_with_gemini tracks cost."""
        from ocr.gemini_ocr import extract_with_gemini

        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "text": "Some extracted text",
            "confidence": 98,
            "sections": [],
        })

        mock_model = MagicMock()
        mock_model.generate_content_async = AsyncMock(return_value=mock_response)

        with patch("ocr.gemini_ocr.genai") as mock_genai:
            mock_genai.GenerativeModel.return_value = mock_model

            from PIL import Image
            import io
            img = Image.new("RGB", (100, 50), color="white")
            img_bytes = io.BytesIO()
            img.save(img_bytes, format="PNG")

            result = await extract_with_gemini([img_bytes.getvalue()])

            assert result.cost > 0
            # Premium tier is more expensive, but still under $0.01 per page
            assert result.cost < 0.01

    @pytest.mark.asyncio
    async def test_extract_handles_complex_layouts(self):
        """Test 4: extract_with_gemini handles complex layouts (tables, columns)."""
        from ocr.gemini_ocr import extract_with_gemini

        complex_response = {
            "text": "| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |",
            "confidence": 97,
            "sections": [
                {"type": "table", "text": "| Header 1 | Header 2 |\n| Cell 1 | Cell 2 |"},
            ],
        }

        mock_response = MagicMock()
        mock_response.text = json.dumps(complex_response)

        mock_model = MagicMock()
        mock_model.generate_content_async = AsyncMock(return_value=mock_response)

        with patch("ocr.gemini_ocr.genai") as mock_genai:
            mock_genai.GenerativeModel.return_value = mock_model

            from PIL import Image
            import io
            img = Image.new("RGB", (200, 100), color="white")
            img_bytes = io.BytesIO()
            img.save(img_bytes, format="PNG")

            result = await extract_with_gemini([img_bytes.getvalue()])

            assert "Header 1" in result.text
            assert "Cell 1" in result.text

    @pytest.mark.asyncio
    async def test_extract_returns_highest_confidence(self):
        """Test 5: Returns highest confidence scores."""
        from ocr.gemini_ocr import extract_with_gemini

        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "text": "High confidence text",
            "confidence": 99,
            "sections": [],
        })

        mock_model = MagicMock()
        mock_model.generate_content_async = AsyncMock(return_value=mock_response)

        with patch("ocr.gemini_ocr.genai") as mock_genai:
            mock_genai.GenerativeModel.return_value = mock_model

            from PIL import Image
            import io
            img = Image.new("RGB", (100, 50), color="white")
            img_bytes = io.BytesIO()
            img.save(img_bytes, format="PNG")

            result = await extract_with_gemini([img_bytes.getvalue()])

            # Gemini should return very high confidence
            assert result.confidence >= 95
