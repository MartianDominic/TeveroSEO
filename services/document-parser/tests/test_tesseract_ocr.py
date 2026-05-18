"""
Tests for Tesseract OCR module.
Phase 102-09: TDD tests for tier 1 (free) OCR.
"""

import pytest
from PIL import Image
import io
from unittest.mock import patch, MagicMock


class TestTesseractOcr:
    """Test suite for Tesseract OCR extraction."""

    @pytest.mark.asyncio
    async def test_extract_returns_text_from_clear_image(self):
        """Test 1: extract_with_tesseract returns text from clear image."""
        from ocr.tesseract_ocr import extract_with_tesseract, TesseractResult

        # Create a simple test image with clear text
        # We'll mock pytesseract since we may not have it installed in test env
        mock_data = {
            "text": ["", "Hello", "World", "Test", ""],
            "conf": [-1, 95, 92, 88, -1],
        }

        with patch("ocr.tesseract_ocr.pytesseract") as mock_tesseract:
            mock_tesseract.image_to_data.return_value = mock_data
            mock_tesseract.Output.DICT = "dict"

            # Create a simple white image
            img = Image.new("RGB", (100, 50), color="white")
            img_bytes = io.BytesIO()
            img.save(img_bytes, format="PNG")
            image_bytes = img_bytes.getvalue()

            result = await extract_with_tesseract([image_bytes])

            assert isinstance(result, TesseractResult)
            assert "Hello" in result.text
            assert "World" in result.text

    @pytest.mark.asyncio
    async def test_extract_returns_confidence_score(self):
        """Test 2: extract_with_tesseract returns confidence score 0-100."""
        from ocr.tesseract_ocr import extract_with_tesseract, TesseractResult

        mock_data = {
            "text": ["Hello", "World"],
            "conf": [95, 88],
        }

        with patch("ocr.tesseract_ocr.pytesseract") as mock_tesseract:
            mock_tesseract.image_to_data.return_value = mock_data
            mock_tesseract.Output.DICT = "dict"

            img = Image.new("RGB", (100, 50), color="white")
            img_bytes = io.BytesIO()
            img.save(img_bytes, format="PNG")

            result = await extract_with_tesseract([img_bytes.getvalue()])

            assert 0 <= result.confidence <= 100
            # Average of 95 and 88 = 91.5
            assert result.confidence == pytest.approx(91.5, rel=0.1)

    @pytest.mark.asyncio
    async def test_extract_supports_lithuanian_language(self):
        """Test 3: extract_with_tesseract supports Lithuanian (lit) language."""
        from ocr.tesseract_ocr import extract_with_tesseract

        mock_data = {
            "text": ["Labas", "Pasauli"],
            "conf": [90, 85],
        }

        with patch("ocr.tesseract_ocr.pytesseract") as mock_tesseract:
            mock_tesseract.image_to_data.return_value = mock_data
            mock_tesseract.Output.DICT = "dict"

            img = Image.new("RGB", (100, 50), color="white")
            img_bytes = io.BytesIO()
            img.save(img_bytes, format="PNG")

            result = await extract_with_tesseract([img_bytes.getvalue()], language="eng+lit")

            # Verify Lithuanian language was passed to pytesseract
            mock_tesseract.image_to_data.assert_called()
            call_args = mock_tesseract.image_to_data.call_args
            assert call_args.kwargs.get("lang") == "eng+lit"
            assert "lit" in result.language

    @pytest.mark.asyncio
    async def test_extract_handles_multiple_pages(self):
        """Test 4: extract_with_tesseract handles multiple pages."""
        from ocr.tesseract_ocr import extract_with_tesseract

        mock_data_page1 = {"text": ["Page", "One"], "conf": [90, 85]}
        mock_data_page2 = {"text": ["Page", "Two"], "conf": [92, 88]}

        call_count = [0]

        def mock_image_to_data(*args, **kwargs):
            result = mock_data_page1 if call_count[0] == 0 else mock_data_page2
            call_count[0] += 1
            return result

        with patch("ocr.tesseract_ocr.pytesseract") as mock_tesseract:
            mock_tesseract.image_to_data.side_effect = mock_image_to_data
            mock_tesseract.Output.DICT = "dict"

            # Create two page images
            pages = []
            for _ in range(2):
                img = Image.new("RGB", (100, 50), color="white")
                img_bytes = io.BytesIO()
                img.save(img_bytes, format="PNG")
                pages.append(img_bytes.getvalue())

            result = await extract_with_tesseract(pages)

            assert "Page One" in result.text
            assert "Page Two" in result.text
            assert mock_tesseract.image_to_data.call_count == 2

    @pytest.mark.asyncio
    async def test_low_quality_images_return_low_confidence(self):
        """Test 5: Low quality images return low confidence."""
        from ocr.tesseract_ocr import extract_with_tesseract

        # Low confidence values indicating poor recognition
        mock_data = {
            "text": ["a", "b", "?"],
            "conf": [25, 30, 15],  # Low confidence values
        }

        with patch("ocr.tesseract_ocr.pytesseract") as mock_tesseract:
            mock_tesseract.image_to_data.return_value = mock_data
            mock_tesseract.Output.DICT = "dict"

            img = Image.new("RGB", (100, 50), color="gray")
            img_bytes = io.BytesIO()
            img.save(img_bytes, format="PNG")

            result = await extract_with_tesseract([img_bytes.getvalue()])

            # Average of 25, 30, 15 = 23.33
            assert result.confidence < 50
            assert result.confidence == pytest.approx(23.33, rel=0.1)
