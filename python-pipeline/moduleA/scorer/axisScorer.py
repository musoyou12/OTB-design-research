"""
axisScorer.py

Module A - Scorer
- 레퍼런스 1개당 16축 스코어를 GPT-4o mini로 자동 산출
- 스코어 기준 0.0 ~ 1.0
- 전략 생성 / 추천 / 요약 금지 — 스코어 산출만 수행

16 Axes (Phase 2 스펙):
  Brand:         brand_concept, tone_manner, color_mood, brand_distinctiveness
  Visual Depth:  effect_2d, effect_3d, effect_spatial
  Structure:     layout_structure, interaction_pattern, hierarchy_strength
  Content:       channel_fit, image_category, conversion_focus
  Quality:       ux_flow_clarity, mobile_readiness, reference_quality
"""

import os
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional

from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

AXES = [
    # Brand
    "brand_concept", "tone_manner", "color_mood", "brand_distinctiveness",
    # Visual Depth
    "effect_2d", "effect_3d", "effect_spatial",
    # Structure
    "layout_structure", "interaction_pattern", "hierarchy_strength",
    # Content
    "channel_fit", "image_category", "conversion_focus",
    # Quality
    "ux_flow_clarity", "mobile_readiness", "reference_quality",
]

SYSTEM_PROMPT = """You are a design analyst. Score the given design reference on 16 axes.
Each score must be a float between 0.0 and 1.0.
Return ONLY valid JSON with exactly these 16 keys, no explanation:

Brand axes:
- brand_concept: how clearly the brand concept is expressed (Minimal / Luxury Calm / Raw Nature / Witty)
- tone_manner: tone & manner clarity (Calm / Bold / Friendly / Clinical)
- color_mood: color mood coherence (Warm Natural / Pastel / High Contrast / Monotone)
- brand_distinctiveness: overall brand uniqueness and differentiation

Visual Depth axes:
- effect_2d: 2D visual quality (Clean / Bold / High Clarity)
- effect_3d: 3D depth quality (Soft Shadow / Layered Depth / Materiality)
- effect_spatial: spatial atmosphere (Luxury Space / Natural Atmosphere / Urban Modern)

Structure axes:
- layout_structure: layout appropriateness (1 Column / Split / Grid / Masonry)
- interaction_pattern: interaction pattern richness (Sticky Header / Stepper / Floating CTA)
- hierarchy_strength: information hierarchy clarity

Content axes:
- channel_fit: channel suitability (PDP / PLP / Landing / SNS / Ads / Lookbook)
- image_category: image category clarity (Product / Model / Lifestyle / Abstract / Texture)
- conversion_focus: conversion optimization strength

Quality axes:
- ux_flow_clarity: UX flow legibility
- mobile_readiness: mobile optimization
- reference_quality: overall reference quality"""


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


def score_items(items: List[Dict], max_workers: int = 8) -> List[Dict]:
    """
    레퍼런스 리스트 → 스코어 리스트 (None 제외)
    ThreadPoolExecutor로 병렬 처리 (순차 대비 ~6-8배 속도)
    """
    results = []
    completed = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(score_item, item): item for item in items}
        for future in as_completed(futures):
            completed += 1
            score = future.result()
            if score:
                results.append(score)
            if completed % 20 == 0:
                print(f"[SCORER] {completed}/{len(items)} scored")

    print(f"[SCORER] 완료: {len(results)}/{len(items)}")
    return results
