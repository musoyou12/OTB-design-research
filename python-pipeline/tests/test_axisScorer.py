"""
tests/test_axisScorer.py

axisScorer 순수 함수 단위 테스트.
GPT 호출은 mock으로 대체 — 네트워크 불필요.
"""

import json
import pytest
from unittest.mock import patch, MagicMock

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from moduleA.scorer.axisScorer import _parse_scores, score_item, AXES


# ── _parse_scores ──────────────────────────────────────

def test_parse_scores_valid():
    raw = json.dumps({axis: 0.7 for axis in AXES})
    result = _parse_scores(raw)
    assert result is not None
    assert len(result) == len(AXES)
    assert all(0.0 <= v <= 1.0 for v in result.values())


def test_parse_scores_partial_fills_default():
    """누락된 축은 0.5로 채워야 함"""
    raw = json.dumps({"brand_concept": 0.9})
    result = _parse_scores(raw)
    assert result["brand_concept"] == 0.9
    assert result["tone_manner"] == 0.5  # 누락 → 기본값


def test_parse_scores_invalid_json():
    assert _parse_scores("not json") is None


def test_parse_scores_empty_string():
    assert _parse_scores("") is None


# ── score_item (GPT mock) ──────────────────────────────

def _make_mock_response(scores: dict):
    mock = MagicMock()
    mock.choices[0].message.content = json.dumps(scores)
    return mock


@patch("moduleA.scorer.axisScorer.client")
def test_score_item_success(mock_client):
    scores = {axis: 0.8 for axis in AXES}
    mock_client.chat.completions.create.return_value = _make_mock_response(scores)

    item = {"id": "ref-001", "title": "Test", "industry": "beauty", "body_text": "sample"}
    result = score_item(item)

    assert result is not None
    assert result["reference_id"] == "ref-001"
    assert result["brand_concept"] == 0.8


@patch("moduleA.scorer.axisScorer.client")
def test_score_item_gpt_failure(mock_client):
    mock_client.chat.completions.create.side_effect = Exception("API error")
    item = {"id": "ref-002", "title": "Test", "body_text": ""}
    result = score_item(item)
    assert result is None
