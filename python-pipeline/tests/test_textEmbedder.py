"""
tests/test_textEmbedder.py

textEmbedder 단위 테스트.
OpenAI 호출은 mock으로 대체.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch, MagicMock
from moduleA.embedder.textEmbedder import embed_chunks, _text_hash


# ── _text_hash ─────────────────────────────────────────

def test_text_hash_deterministic():
    assert _text_hash("abc") == _text_hash("abc")

def test_text_hash_different():
    assert _text_hash("abc") != _text_hash("xyz")


# ── embed_chunks ───────────────────────────────────────

def _make_embed_response(n: int):
    mock = MagicMock()
    mock.data = [MagicMock(embedding=[0.1] * 1536) for _ in range(n)]
    return mock


@patch("moduleA.embedder.textEmbedder.client")
def test_embed_chunks_basic(mock_client):
    mock_client.embeddings.create.return_value = _make_embed_response(2)
    chunks = [
        {"reference_id": "r1", "chunk_index": 0, "chunk_text": "hello world"},
        {"reference_id": "r1", "chunk_index": 1, "chunk_text": "foo bar"},
    ]
    result = embed_chunks(chunks)
    assert len(result) == 2
    assert all(r["embedding"] is not None for r in result)
    assert all("chunk_hash" in r for r in result)


@patch("moduleA.embedder.textEmbedder.client")
def test_embed_chunks_skips_existing(mock_client):
    chunk_text = "already embedded"
    existing_hash = _text_hash(chunk_text)

    chunks = [{"reference_id": "r1", "chunk_index": 0, "chunk_text": chunk_text}]
    result = embed_chunks(chunks, existing_hashes={existing_hash})

    # API 호출 없어야 함
    mock_client.embeddings.create.assert_not_called()
    assert result[0].get("_skipped") is True


@patch("moduleA.embedder.textEmbedder.client")
def test_embed_chunks_api_failure_returns_none(mock_client):
    mock_client.embeddings.create.side_effect = Exception("rate limit")
    chunks = [{"reference_id": "r1", "chunk_index": 0, "chunk_text": "test"}]
    result = embed_chunks(chunks)
    assert result[0]["embedding"] is None
