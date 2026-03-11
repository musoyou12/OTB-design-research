"""
industryPatternBuilder.py

Module A - Pattern Accumulator
- 산업별 16축 평균값을 industry_patterns 테이블에 누적
- 신규 데이터가 들어올수록 패턴이 정교해짐
- 전략 생성 금지. 통계 산출만.

Logic:
- industry별 axis_scores 평균 계산
- Supabase industry_patterns에 upsert (가중 이동평균)
"""

from typing import List, Dict
from collections import defaultdict

AXES = [
    "visual_clarity", "color_expressiveness", "typography_strength", "layout_complexity",
    "ux_flow_clarity", "interaction_richness", "mobile_readiness", "hierarchy_strength",
    "content_density", "whitespace_usage", "cta_prominence", "conversion_focus",
    "brand_distinctiveness", "emotional_tone", "innovation_level", "reference_quality",
]

# 가중 이동평균에서 신규 데이터 반영 비율
NEW_DATA_WEIGHT = 0.3


def compute_industry_averages(
    scores: List[Dict],
    references: List[Dict],
) -> List[Dict]:
    """
    scores:     [{ reference_id, axis1..axis16 }]
    references: [{ id, industry }]
    returns:    [{ industry, pattern_key, pattern_value }]
    """
    # reference_id → industry 매핑
    id_to_industry = {r["id"]: r.get("industry") for r in references}

    # industry → axis → 값 리스트
    industry_axis: Dict[str, Dict[str, List[float]]] = defaultdict(lambda: defaultdict(list))

    for score in scores:
        ref_id = score.get("reference_id")
        industry = id_to_industry.get(ref_id)
        if not industry:
            continue
        for axis in AXES:
            val = score.get(axis)
            if val is not None:
                industry_axis[industry][axis].append(float(val))

    patterns = []
    for industry, axis_values in industry_axis.items():
        avg_scores = {
            axis: round(sum(vals) / len(vals), 4)
            for axis, vals in axis_values.items()
            if vals
        }
        patterns.append({
            "industry": industry,
            "pattern_key": "axis_avg",
            "pattern_value": avg_scores,
            "weight": NEW_DATA_WEIGHT,
        })

    return patterns
