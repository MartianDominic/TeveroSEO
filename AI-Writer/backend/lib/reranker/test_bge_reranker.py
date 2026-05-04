"""Tests for BGE Reranker module.

Phase 73-03: Retrieval Quality Enhancement
"""

import pytest
from unittest.mock import MagicMock, patch


class TestBGEReranker:
    """Test suite for BGEReranker class."""

    @pytest.fixture
    def mock_cross_encoder(self):
        """Create a mock CrossEncoder that returns predictable scores."""
        with patch("lib.reranker.bge_reranker.CrossEncoder") as mock_cls:
            mock_instance = MagicMock()
            # Return descending scores based on candidate index for predictability
            mock_instance.predict.side_effect = lambda pairs, **kwargs: [
                1.0 - (i * 0.1) for i in range(len(pairs))
            ]
            mock_cls.return_value = mock_instance
            yield mock_cls

    def test_rerank_returns_sorted_results(self, mock_cross_encoder):
        """Test that rerank returns results sorted by score descending."""
        from lib.reranker.bge_reranker import BGEReranker

        reranker = BGEReranker(device="cpu")
        candidates = ["doc1", "doc2", "doc3"]

        results = reranker.rerank("test query", candidates, top_k=3)

        # Should be sorted by score descending
        scores = [score for _, score in results]
        assert scores == sorted(scores, reverse=True)

    def test_rerank_respects_top_k(self, mock_cross_encoder):
        """Test that rerank returns at most top_k results."""
        from lib.reranker.bge_reranker import BGEReranker

        reranker = BGEReranker(device="cpu")
        candidates = ["doc1", "doc2", "doc3", "doc4", "doc5"]

        results = reranker.rerank("test query", candidates, top_k=2)

        assert len(results) == 2

    def test_rerank_empty_candidates(self, mock_cross_encoder):
        """Test that rerank handles empty candidates list."""
        from lib.reranker.bge_reranker import BGEReranker

        reranker = BGEReranker(device="cpu")

        results = reranker.rerank("test query", [], top_k=10)

        assert results == []

    def test_rerank_empty_query_raises(self, mock_cross_encoder):
        """Test that rerank raises ValueError for empty query."""
        from lib.reranker.bge_reranker import BGEReranker

        reranker = BGEReranker(device="cpu")

        with pytest.raises(ValueError, match="Query cannot be empty"):
            reranker.rerank("", ["doc1", "doc2"])

    def test_rerank_with_metadata_preserves_fields(self, mock_cross_encoder):
        """Test that rerank_with_metadata preserves original fields."""
        from lib.reranker.bge_reranker import BGEReranker

        reranker = BGEReranker(device="cpu")
        candidates = [
            {"id": "1", "text": "laptop notebook", "original_score": 0.8},
            {"id": "2", "text": "desktop PC", "original_score": 0.9},
        ]

        results = reranker.rerank_with_metadata("laptop", candidates, top_k=2)

        # All original fields should be preserved
        for result in results:
            assert "id" in result
            assert "text" in result
            assert "original_score" in result
            # rerank_score should be added
            assert "rerank_score" in result

    def test_rerank_with_metadata_custom_text_key(self, mock_cross_encoder):
        """Test rerank_with_metadata with custom text key."""
        from lib.reranker.bge_reranker import BGEReranker

        reranker = BGEReranker(device="cpu")
        candidates = [
            {"id": "1", "content": "laptop notebook"},
            {"id": "2", "content": "desktop PC"},
        ]

        results = reranker.rerank_with_metadata(
            "laptop", candidates, text_key="content", top_k=2
        )

        assert len(results) == 2
        assert all("rerank_score" in r for r in results)

    def test_rerank_with_metadata_missing_key_raises(self, mock_cross_encoder):
        """Test that missing text key raises KeyError."""
        from lib.reranker.bge_reranker import BGEReranker

        reranker = BGEReranker(device="cpu")
        candidates = [
            {"id": "1", "wrong_key": "laptop notebook"},
        ]

        with pytest.raises(KeyError, match="text"):
            reranker.rerank_with_metadata("laptop", candidates)

    def test_score_pair_returns_float(self, mock_cross_encoder):
        """Test that score_pair returns a float score."""
        from lib.reranker.bge_reranker import BGEReranker

        # Override mock for single pair
        mock_cross_encoder.return_value.predict.return_value = [0.85]

        reranker = BGEReranker(device="cpu")
        score = reranker.score_pair("laptop computer", "laptop notebook")

        assert isinstance(score, float)
        assert score == 0.85


class TestSingleton:
    """Test singleton behavior."""

    def test_get_reranker_returns_singleton(self):
        """Test that get_reranker returns the same instance."""
        from lib.reranker.bge_reranker import get_reranker

        # Reset singleton for test
        import lib.reranker.bge_reranker as module
        module._reranker = None

        with patch("lib.reranker.bge_reranker.CrossEncoder"):
            reranker1 = get_reranker()
            reranker2 = get_reranker()

            assert reranker1 is reranker2


class TestAsyncRerank:
    """Test async reranking function."""

    @pytest.mark.asyncio
    async def test_rerank_candidates_async(self):
        """Test that rerank_candidates works asynchronously."""
        from lib.reranker.bge_reranker import rerank_candidates

        # Reset singleton for test
        import lib.reranker.bge_reranker as module
        module._reranker = None

        with patch("lib.reranker.bge_reranker.CrossEncoder") as mock_cls:
            mock_instance = MagicMock()
            mock_instance.predict.return_value = [0.9, 0.5]
            mock_cls.return_value = mock_instance

            candidates = [
                {"text": "laptop notebook", "id": "1"},
                {"text": "desktop PC", "id": "2"},
            ]

            results = await rerank_candidates("laptop", candidates, top_k=2)

            assert len(results) == 2
            assert all("rerank_score" in r for r in results)


class TestModelLoading:
    """Test model loading behavior."""

    def test_lazy_loading(self):
        """Test that model is loaded lazily on first use."""
        from lib.reranker.bge_reranker import BGEReranker

        with patch("lib.reranker.bge_reranker.CrossEncoder") as mock_cls:
            reranker = BGEReranker(device="cpu")

            # Model should not be loaded yet
            assert reranker._model is None
            mock_cls.assert_not_called()

            # First call should load the model
            mock_cls.return_value.predict.return_value = [0.5]
            reranker.rerank("query", ["candidate"])

            mock_cls.assert_called_once()

    def test_import_error_handling(self):
        """Test graceful handling of missing sentence-transformers."""
        from lib.reranker.bge_reranker import BGEReranker

        reranker = BGEReranker(device="cpu")

        with patch.dict("sys.modules", {"sentence_transformers": None}):
            with patch(
                "lib.reranker.bge_reranker.CrossEncoder",
                side_effect=ImportError("No module named sentence_transformers")
            ):
                with pytest.raises(RuntimeError, match="sentence-transformers is required"):
                    reranker.rerank("query", ["candidate"])
