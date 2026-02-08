"""
languageDetect.py

Module A - Preprocess responsibility:
- 텍스트의 언어 코드 감지
- 의미 해석 / 번역 / 판단 금지
- 감지 결과를 메타데이터로만 추가

Used before:
- textEmbedding.py
"""

from typing import Dict, Optional
from langdetect import detect, DetectorFactory, LangDetectException

# 재현성 보장
DetectorFactory.seed = 42


# =========================
# Core
# =========================

def detect_language(text: str) -> Optional[str]:
    """
    단일 텍스트 언어 감지
    실패 시 None 반환
    """
    if not isinstance(text, str) or not text.strip():
        return None

    try:
        return detect(text)
    except LangDetectException:
        return None


def detect_item_language(item: Dict) -> Dict:
    """
    item 단위 언어 감지
    - title / summary / content를 단순 결합
    - 결과는 item["language"]에 저장
    """
    parts = [
        item.get("title", ""),
        item.get("summary", ""),
        item.get("content", "")
    ]
    text = " ".join([p for p in parts if isinstance(p, str) and p.strip()])

    item["language"] = detect_language(text)
    return item
