"""
tests/test_deduplicate.py

deduplicate 순수 함수 단위 테스트.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from moduleA.preprocess.deduplicate import deduplicate, _hash_text, _build_text


# ── _hash_text ─────────────────────────────────────────

def test_hash_text_deterministic():
    assert _hash_text("hello") == _hash_text("hello")


def test_hash_text_different():
    assert _hash_text("hello") != _hash_text("world")


# ── _build_text ────────────────────────────────────────

def test_build_text_combines_fields():
    item = {"title": "A", "summary": "B", "content": "C"}
    assert _build_text(item) == "A B C"


def test_build_text_missing_fields():
    item = {"title": "Only title"}
    assert _build_text(item) == "Only title"


# ── deduplicate ────────────────────────────────────────

def test_deduplicate_removes_duplicate_url():
    items = [
        {"url": "https://a.com", "title": "A", "summary": "", "content": ""},
        {"url": "https://a.com", "title": "A dup", "summary": "", "content": ""},
    ]
    result = deduplicate(items)
    assert len(result) == 1


def test_deduplicate_removes_duplicate_text():
    items = [
        {"url": "https://a.com", "title": "Same", "summary": "text", "content": ""},
        {"url": "https://b.com", "title": "Same", "summary": "text", "content": ""},
    ]
    result = deduplicate(items)
    assert len(result) == 1


def test_deduplicate_keeps_unique():
    items = [
        {"url": "https://a.com", "title": "First", "summary": "aaa", "content": ""},
        {"url": "https://b.com", "title": "Second", "summary": "bbb", "content": ""},
    ]
    result = deduplicate(items)
    assert len(result) == 2


def test_deduplicate_empty():
    assert deduplicate([]) == []
