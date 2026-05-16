"""
Tests for DeepSeek OCR module.
Phase 102-09: TDD tests for tier 2 (cheap AI) OCR.
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
import httpx


class TestDeepSeekOcr:
    """Test suite for DeepSeek OCR extraction via OpenRouter."""

    @pytest.mark.asyncio
    async def test_extract_calls_openrouter_api(self):
        """Test 1: extract_with_deepseek calls OpenRouter API."""
        from ocr.deepseek_ocr import extract_with_deepseek, DeepSeekResult

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Extracted text from document"}}],
            "usage": {"prompt_tokens": 500, "completion_tokens": 200},
        }
        mock_response.raise_for_status = MagicMock()

        with patch("ocr.deepseek_ocr.httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.post = AsyncMock(return_value=mock_response)
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_instance

            # Create test image bytes
            from PIL import Image
            import io
            img = Image.new("RGB", (100, 50), color="white")
            img_bytes = io.BytesIO()
            img.save(img_bytes, format="PNG")

            result = await extract_with_deepseek([img_bytes.getvalue()])

            # Verify OpenRouter was called
            mock_instance.post.assert_called_once()
            call_args = mock_instance.post.call_args
            assert "openrouter.ai" in call_args.args[0]
            assert isinstance(result, DeepSeekResult)

    @pytest.mark.asyncio
    async def test_extract_returns_text_and_cost(self):
        """Test 2: extract_with_deepseek returns text and cost."""
        from ocr.deepseek_ocr import extract_with_deepseek

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "Document content here"}}],
            "usage": {"prompt_tokens": 1000, "completion_tokens": 500},
        }
        mock_response.raise_for_status = MagicMock()

        with patch("ocr.deepseek_ocr.httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.post = AsyncMock(return_value=mock_response)
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_instance

            from PIL import Image
            import io
            img = Image.new("RGB", (100, 50), color="white")
            img_bytes = io.BytesIO()
            img.save(img_bytes, format="PNG")

            result = await extract_with_deepseek([img_bytes.getvalue()])

            assert "Document content here" in result.text
            assert result.cost > 0  # Cost should be calculated
            assert result.cost < 0.01  # Should be cheap (< $0.01 per page)

    @pytest.mark.asyncio
    async def test_extract_handles_rate_limits_with_retry(self):
        """Test 3: extract_with_deepseek handles rate limits with retry."""
        from ocr.deepseek_ocr import extract_with_deepseek

        call_count = [0]

        async def create_response(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                # First call: rate limited
                error_response = MagicMock()
                error_response.status_code = 429
                raise httpx.HTTPStatusError(
                    "Rate limited",
                    request=MagicMock(),
                    response=error_response
                )
            else:
                # Retry succeeds
                mock_response = MagicMock()
                mock_response.json.return_value = {
                    "choices": [{"message": {"content": "Success after retry"}}],
                    "usage": {"prompt_tokens": 500, "completion_tokens": 200},
                }
                mock_response.raise_for_status = MagicMock()
                return mock_response

        with patch("ocr.deepseek_ocr.httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.post = create_response
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_instance

            with patch("ocr.deepseek_ocr.asyncio.sleep", new_callable=AsyncMock):
                from PIL import Image
                import io
                img = Image.new("RGB", (100, 50), color="white")
                img_bytes = io.BytesIO()
                img.save(img_bytes, format="PNG")

                result = await extract_with_deepseek([img_bytes.getvalue()])

                assert "Success after retry" in result.text
                assert call_count[0] == 2  # Should have retried

    @pytest.mark.asyncio
    async def test_extract_preserves_paragraph_structure(self):
        """Test 4: extract_with_deepseek preserves paragraph structure."""
        from ocr.deepseek_ocr import extract_with_deepseek

        # Response with paragraph breaks
        structured_text = """First paragraph with some content.

Second paragraph continues here.

Third paragraph ends the document."""

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": structured_text}}],
            "usage": {"prompt_tokens": 500, "completion_tokens": 300},
        }
        mock_response.raise_for_status = MagicMock()

        with patch("ocr.deepseek_ocr.httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.post = AsyncMock(return_value=mock_response)
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_instance

            from PIL import Image
            import io
            img = Image.new("RGB", (100, 50), color="white")
            img_bytes = io.BytesIO()
            img.save(img_bytes, format="PNG")

            result = await extract_with_deepseek([img_bytes.getvalue()])

            # Verify structure is preserved
            assert "First paragraph" in result.text
            assert "Second paragraph" in result.text
            assert "Third paragraph" in result.text

    @pytest.mark.asyncio
    async def test_api_errors_return_graceful_fallback(self):
        """Test 5: API errors return graceful fallback."""
        from ocr.deepseek_ocr import extract_with_deepseek, DeepSeekResult

        # Simulate 500 error on all retries
        error_response = MagicMock()
        error_response.status_code = 500

        with patch("ocr.deepseek_ocr.httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.post = AsyncMock(side_effect=httpx.HTTPStatusError(
                "Server error",
                request=MagicMock(),
                response=error_response
            ))
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_instance

            from PIL import Image
            import io
            img = Image.new("RGB", (100, 50), color="white")
            img_bytes = io.BytesIO()
            img.save(img_bytes, format="PNG")

            with pytest.raises(httpx.HTTPStatusError):
                await extract_with_deepseek([img_bytes.getvalue()])
