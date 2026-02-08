"""
textCleaner.py

Module A - Preprocess responsibility:
- 텍스트 정규화 및 노이즈 제거
- HTML / URL / 이메일 / 이모지 제거
- 의미 해석, 요약, 판단, 키워드 생성 금지

Used before:
- textEmbedding.py
"""

import re
from typing import Dict


# =========================
# Regex Patterns
# =========================

RE_HTML = re.compile(r"<[^>]+>")
RE_URL = re.compile(r"http[s]?://\S+")
RE_EMAIL = re.compile(r"\S+@\S+")
RE_EMOJI = re.compile(
    "["
    "\U0001F600-\U0001F64F"
    "\U0001F300-\U0001F5FF"
    "\U0001F680-\U0001F6FF"
    "\U0001F1E0-\U0001F1FF"
    "]+",
    flags=re.UNICODE
)
RE_WHITESPACE = re.compile(r"\s+")


# =========================
# Core
# =========================

def clean_text(text: str) -> str:
    if not isinstance(text, str):
        return ""

    text = text.lower()
    text = RE_HTML.sub(" ", text)
    text = RE_URL.sub(" ", text)
    text = RE_EMAIL.sub(" ", text)
    text = RE_EMOJI.sub(" ", text)

    # 최소한의 특수문자 제거 (의미 손상 방지)
    text = re.sub(r"[^\w\s\-]", " ", text)

    text = RE_WHITESPACE.sub(" ", text).strip()
    return text


def clean_item_text(item: Dict) -> Dict:
    """
    item 단위 텍스트 필드 정제
    """
    for field in ("title", "summary", "content"):
        if field in item:
            item[field] = clean_text(item.get(field))
    return item
