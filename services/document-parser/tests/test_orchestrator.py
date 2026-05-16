"""
Tests for OCR orchestrator module.
Phase 102-09: TDD tests for tiered OCR escalation.
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from PIL import Image
import io


def create_test_image():
    """Create a simple test image."""
    img = Image.new("RGB", (100, 50), color="white")
    img_bytes = io.BytesIO()
    img.save(img_bytes, format="PNG")
    return img_bytes.getvalue()


class TestOcrOrchestrator:
    """Test suite for OCR orchestrator with tiered escalation."""

    @pytest.mark.asyncio
    async def test_high_tesseract_confidence_returns_tesseract(self):
        """Test 1: High Tesseract confidence (>80%) returns Tesseract result."""
        from ocr.orchestrator import extract_text_tiered, OcrResult

        # Mock Tesseract with high confidence
        mock_tesseract_result = MagicMock()
        mock_tesseract_result.text = "High quality text from Tesseract"
        mock_tesseract_result.confidence = 92.0  # Above 80% threshold
        mock_tesseract_result.processing_time = 0.5

        with patch("ocr.orchestrator.extract_with_tesseract", return_value=mock_tesseract_result):
            result = await extract_text_tiered([create_test_image()])

            assert isinstance(result, OcrResult)
            assert result.tier == "tesseract"
            assert result.text == "High quality text from Tesseract"
            assert result.cost == 0  # Tesseract is free
            assert result.escalation_reason is None

    @pytest.mark.asyncio
    async def test_low_tesseract_confidence_escalates_to_deepseek(self):
        """Test 2: Low Tesseract confidence escalates to DeepSeek."""
        from ocr.orchestrator import extract_text_tiered, OcrResult

        # Mock Tesseract with low confidence
        mock_tesseract_result = MagicMock()
        mock_tesseract_result.text = "Poor quality"
        mock_tesseract_result.confidence = 65.0  # Below 80% threshold
        mock_tesseract_result.processing_time = 0.5

        # Mock DeepSeek with good confidence
        mock_deepseek_result = MagicMock()
        mock_deepseek_result.text = "Better quality from DeepSeek"
        mock_deepseek_result.confidence = 92.0  # Above 85% threshold
        mock_deepseek_result.cost = 0.002
        mock_deepseek_result.processing_time = 3.0

        with patch("ocr.orchestrator.extract_with_tesseract", return_value=mock_tesseract_result):
            with patch("ocr.orchestrator.extract_with_deepseek", new_callable=AsyncMock, return_value=mock_deepseek_result):
                result = await extract_text_tiered([create_test_image()])

                assert result.tier == "deepseek"
                assert result.text == "Better quality from DeepSeek"
                assert result.cost > 0
                assert result.escalation_reason is not None
                assert "65.0" in result.escalation_reason  # Mentions original confidence

    @pytest.mark.asyncio
    async def test_low_deepseek_confidence_escalates_to_gemini(self):
        """Test 3: Low DeepSeek confidence (<85%) escalates to Gemini."""
        from ocr.orchestrator import extract_text_tiered, OcrResult

        # Mock Tesseract with low confidence
        mock_tesseract_result = MagicMock()
        mock_tesseract_result.text = "Poor"
        mock_tesseract_result.confidence = 50.0
        mock_tesseract_result.processing_time = 0.5

        # Mock DeepSeek with insufficient confidence
        mock_deepseek_result = MagicMock()
        mock_deepseek_result.text = "Still not great"
        mock_deepseek_result.confidence = 78.0  # Below 85% threshold
        mock_deepseek_result.cost = 0.002
        mock_deepseek_result.processing_time = 3.0

        # Mock Gemini with highest quality
        mock_gemini_result = MagicMock()
        mock_gemini_result.text = "Excellent quality from Gemini"
        mock_gemini_result.confidence = 98.0
        mock_gemini_result.cost = 0.004
        mock_gemini_result.processing_time = 8.0

        with patch("ocr.orchestrator.extract_with_tesseract", return_value=mock_tesseract_result):
            with patch("ocr.orchestrator.extract_with_deepseek", new_callable=AsyncMock, return_value=mock_deepseek_result):
                with patch("ocr.orchestrator.extract_with_gemini", new_callable=AsyncMock, return_value=mock_gemini_result):
                    result = await extract_text_tiered([create_test_image()])

                    assert result.tier == "gemini"
                    assert result.text == "Excellent quality from Gemini"
                    assert "78.0" in result.escalation_reason  # Mentions DeepSeek confidence

    @pytest.mark.asyncio
    async def test_total_cost_tracked_across_tiers(self):
        """Test 4: Total cost tracked across all tiers used."""
        from ocr.orchestrator import extract_text_tiered

        # Mock all tiers needing escalation
        mock_tesseract_result = MagicMock()
        mock_tesseract_result.text = "Poor"
        mock_tesseract_result.confidence = 50.0
        mock_tesseract_result.processing_time = 0.5

        mock_deepseek_result = MagicMock()
        mock_deepseek_result.text = "Better but not enough"
        mock_deepseek_result.confidence = 78.0
        mock_deepseek_result.cost = 0.002
        mock_deepseek_result.processing_time = 3.0

        mock_gemini_result = MagicMock()
        mock_gemini_result.text = "Best quality"
        mock_gemini_result.confidence = 98.0
        mock_gemini_result.cost = 0.004
        mock_gemini_result.processing_time = 8.0

        with patch("ocr.orchestrator.extract_with_tesseract", return_value=mock_tesseract_result):
            with patch("ocr.orchestrator.extract_with_deepseek", new_callable=AsyncMock, return_value=mock_deepseek_result):
                with patch("ocr.orchestrator.extract_with_gemini", new_callable=AsyncMock, return_value=mock_gemini_result):
                    result = await extract_text_tiered([create_test_image()])

                    # Total cost should include both DeepSeek and Gemini
                    expected_cost = 0.002 + 0.004
                    assert result.cost == pytest.approx(expected_cost, rel=0.01)

    @pytest.mark.asyncio
    async def test_returns_tier_used_in_result(self):
        """Test 5: Returns tier used in result."""
        from ocr.orchestrator import extract_text_tiered, OcrResult, OcrTier

        # Test each tier
        tiers_to_test = [
            (85.0, "tesseract"),  # High confidence -> tesseract
        ]

        for confidence, expected_tier in tiers_to_test:
            mock_tesseract_result = MagicMock()
            mock_tesseract_result.text = "Text"
            mock_tesseract_result.confidence = confidence
            mock_tesseract_result.processing_time = 0.5

            with patch("ocr.orchestrator.extract_with_tesseract", return_value=mock_tesseract_result):
                result = await extract_text_tiered([create_test_image()])

                # Verify tier is returned and is valid type
                assert result.tier in ["tesseract", "deepseek", "gemini"]
                assert isinstance(result.tier, str)
