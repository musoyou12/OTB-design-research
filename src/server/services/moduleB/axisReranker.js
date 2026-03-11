/**
 * axisReranker.js
 *
 * 16축 스코어 기반 composite_score 계산 후 재랭킹
 * - axis_scores 테이블 조인
 * - composite = (1 - distance) + industryBonus + axisScore * weight
 * - 상위 TOP_K 선별
 */

import { supabase } from "../../../supabase/supabase.js";

const TOP_K = 10;

// 기본 축 가중치 (산업 패턴이 없을 때 사용)
const DEFAULT_AXIS_WEIGHTS = {
  visual_clarity: 0.8,
  ux_flow_clarity: 1.0,
  mobile_readiness: 0.9,
  hierarchy_strength: 0.8,
  brand_distinctiveness: 0.7,
  innovation_level: 0.6,
  reference_quality: 1.0,
  conversion_focus: 0.7,
  content_density: 0.5,
  whitespace_usage: 0.5,
  cta_prominence: 0.6,
  color_expressiveness: 0.5,
  typography_strength: 0.5,
  layout_complexity: 0.4,
  emotional_tone: 0.6,
  interaction_richness: 0.5,
};

/**
 * reference_id 목록으로 axis_scores 로드
 */
async function loadAxisScores(referenceIds) {
  const { data } = await supabase
    .from("axis_scores")
    .select("reference_id, visual_clarity, color_expressiveness, typography_strength, layout_complexity, ux_flow_clarity, interaction_richness, mobile_readiness, hierarchy_strength, content_density, whitespace_usage, cta_prominence, conversion_focus, brand_distinctiveness, emotional_tone, innovation_level, reference_quality")
    .in("reference_id", referenceIds);

  const map = {};
  for (const row of data || []) {
    map[row.reference_id] = row;
  }
  return map;
}

/**
 * 단일 레퍼런스의 axis composite score 계산
 */
function computeAxisScore(axisRow, industryPattern) {
  const weights = industryPattern || DEFAULT_AXIS_WEIGHTS;
  let total = 0;
  let weightSum = 0;

  for (const [axis, weight] of Object.entries(DEFAULT_AXIS_WEIGHTS)) {
    const axisVal = axisRow?.[axis];
    const w = weights[axis] ?? weight;
    if (axisVal != null) {
      total += axisVal * w;
      weightSum += w;
    }
  }

  return weightSum > 0 ? total / weightSum : 0;
}

/**
 * @param {Array} candidates  - industryFilter 결과
 * @returns {Promise<Array>}  - composite_score 기준 상위 TOP_K
 */
export async function rerank(candidates) {
  if (candidates.length === 0) return [];

  const refIds = [...new Set(candidates.map((c) => c.reference_id))];
  const axisMap = await loadAxisScores(refIds);

  const scored = candidates.map((c) => {
    const axisRow = axisMap[c.reference_id];
    const axisScore = computeAxisScore(axisRow, c.industryPattern);
    const similarity = 1 - c.distance;

    const compositeScore =
      similarity * 0.5 + axisScore * 0.35 + c.industryBonus * 0.15;

    return { ...c, axisScore, similarity, compositeScore };
  });

  // 중복 reference_id 제거 후 점수 정렬
  const seen = new Set();
  const deduped = scored.filter((c) => {
    if (seen.has(c.reference_id)) return false;
    seen.add(c.reference_id);
    return true;
  });

  return deduped.sort((a, b) => b.compositeScore - a.compositeScore).slice(0, TOP_K);
}
