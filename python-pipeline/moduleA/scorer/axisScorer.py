"""
axisScorer.py

Module A - Scorer
- 레퍼런스 1개당 16축 스코어를 GPT-4o mini로 자동 산출
- 스코어 기준 0.0 ~ 1.0
- 전략 생성 / 추천 / 요약 금지
- 스코어 산출만 수행

16 Axes:
  Visual:   visual_clarity, color_expressiveness, typography_strength, layout_complexity
  UX:       ux_flow_clarity, interaction_richness, mobile_readiness, hierarchy_strength
  Content:  content_density, whitespace_usage, cta_prominence, conversion_focus
  Brand:    brand_distinctiveness, emotional_tone, innovation_level, reference_quality
"""

import os
import json
import time
from typing import Dict, List, Optional

from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

AXES = [
    "visual_clarity", "color_expressiveness", "typography_strength", "layout_complexity",
    "ux_flow_clarity", "interaction_richness", "mobile_readiness", "hierarchy_strength",
    "content_density", "whitespace_usage", "cta_prominence", "conversion_focus",
    "brand_distinctiveness", "emotional_tone", "innovation_level", "reference_quality",
]

SYSTEM_PROMPT = """You are a design analyst. Score the given design reference on 16 axes.
Each axis must be a float between 0.0 and 1.0.
Return ONLY valid JSON with exactly these 16 keys, no explanation:
visual_clarity, color_expressiveness, typography_strength, layout_complexity,
ux_flow_clarity, interaction_richness, mobile_readiness, hierarchy_strength,
content_density, whitespace_usage, cta_prominence, conversion_focus,
brand_distinctiveness, emotional_tone, innovation_level, reference_quality"""


def _build_user_prompt(item: Dict) -> str:
    return f"""Title: {item.get('title', '')}
Industry: {item.get('industry', 'unknown')}
Category: {item.get('domain', '')}
Content: {item.get('body_text', '')[:800]}"""


def _parse_scores(raw: str) -> Optional[Dict[str, float]]:
    try:
        data = json.loads(raw)
        return {axis: float(data.get(axis, 0.5)) for axis in AXES}
    except Exception:
        return None


def score_item(item: Dict) -> Optional[Dict]:
    """
    레퍼런스 1개 → 16축 스코어 dict 반환
    실패 시 None 반환
    """
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": _build_user_prompt(item)},
            ],
            response_format={"type": "json_object"},
            temperature=0,
        )
        raw = response.choices[0].message.content
        scores = _parse_scores(raw)
        if scores:
            return {"reference_id": item["id"], **scores}
        return None

    except Exception as e:
        print(f"[SCORER] Failed for {item.get('source_url', '')}: {e}")
        return None


def score_items(items: List[Dict], delay: float = 0.3) -> List[Dict]:
    """
    레퍼런스 리스트 → 스코어 리스트 (None 제외)
    """
    results = []
    for i, item in enumerate(items):
        score = score_item(item)
        if score:
            results.append(score)
        if i % 20 == 0:
            print(f"[SCORER] {i}/{len(items)} scored")
        time.sleep(delay)
    return results
