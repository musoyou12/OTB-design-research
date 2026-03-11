/**
 * axisReranker.js
 *
 * 브리프 기반 동적 축 가중치 계산 후 composite_score 재랭킹
 *
 * composite = similarity × 0.5 + axisScore × 0.35 + industryBonus × 0.15
 *
 * 가중치 레이어:
 *   1. DEFAULT_AXIS_WEIGHTS  — 베이스라인
 *   2. INDUSTRY_BOOST        — industry별 축 강조
 *   3. CHANNEL_BOOST         — channel별 축 강조
 *   4. KEYWORD_BOOST         — 브리프 키워드에서 추출한 힌트
 */

import { supabase } from "../../../supabase/supabase.js";

const TOP_K = 10;

const DEFAULT_AXIS_WEIGHTS = {
  brand_concept:         0.8,
  tone_manner:           0.7,
  color_mood:            0.7,
  brand_distinctiveness: 0.8,
  effect_2d:             0.6,
  effect_3d:             0.5,
  effect_spatial:        0.5,
  layout_structure:      0.7,
  interaction_pattern:   0.6,
  hierarchy_strength:    0.8,
  channel_fit:           0.9,
  image_category:        0.6,
  conversion_focus:      0.7,
  ux_flow_clarity:       1.0,
  mobile_readiness:      0.9,
  reference_quality:     1.0,
};

// ── Industry별 부스트 ──────────────────────────────────────
const INDUSTRY_BOOST = {
  fashion: {
    brand_concept: 0.3, effect_spatial: 0.3, brand_distinctiveness: 0.2,
    image_category: 0.2, color_mood: 0.2,
  },
  beauty: {
    tone_manner: 0.3, color_mood: 0.3, channel_fit: 0.2,
    image_category: 0.2, brand_concept: 0.1,
  },
  "f&b": {
    color_mood: 0.4, image_category: 0.3, brand_concept: 0.2,
    effect_spatial: 0.2,
  },
  saas: {
    ux_flow_clarity: 0.3, hierarchy_strength: 0.3,
    conversion_focus: 0.3, interaction_pattern: 0.2,
  },
  fintech: {
    ux_flow_clarity: 0.3, mobile_readiness: 0.3,
    hierarchy_strength: 0.3, tone_manner: 0.2,
  },
  lifestyle: {
    brand_concept: 0.3, color_mood: 0.2, image_category: 0.2,
    effect_spatial: 0.2,
  },
  real_estate: {
    layout_structure: 0.3, ux_flow_clarity: 0.3,
    hierarchy_strength: 0.2, channel_fit: 0.2,
  },
};

// ── Channel별 부스트 ──────────────────────────────────────
const CHANNEL_BOOST = {
  pdp:      { channel_fit: 0.4, image_category: 0.3, conversion_focus: 0.2 },
  plp:      { channel_fit: 0.4, layout_structure: 0.3, image_category: 0.2 },
  landing:  { channel_fit: 0.3, conversion_focus: 0.4, hierarchy_strength: 0.2 },
  sns:      { channel_fit: 0.3, image_category: 0.4, color_mood: 0.2 },
  ads:      { channel_fit: 0.3, image_category: 0.3, conversion_focus: 0.3 },
  lookbook: { channel_fit: 0.3, image_category: 0.4, effect_spatial: 0.3 },
};

// ── 키워드 힌트 → 축 부스트 ───────────────────────────────
const KEYWORD_HINTS = [
  { match: /minimal|clean|simple/i,         boost: { brand_concept: 0.2, effect_2d: 0.2 } },
  { match: /luxury|premium|editorial/i,     boost: { effect_spatial: 0.2, brand_concept: 0.2, brand_distinctiveness: 0.1 } },
  { match: /warm|organic|natural|earthy/i,  boost: { color_mood: 0.25, image_category: 0.15 } },
  { match: /clinical|trust|medical|proof/i, boost: { tone_manner: 0.25, hierarchy_strength: 0.15 } },
  { match: /bold|strong|high.contrast/i,    boost: { brand_distinctiveness: 0.2, effect_2d: 0.2 } },
  { match: /mobile|responsive/i,            boost: { mobile_readiness: 0.3 } },
  { match: /conversion|cta|signup/i,        boost: { conversion_focus: 0.3, interaction_pattern: 0.15 } },
  { match: /3d|depth|material|shadow/i,     boost: { effect_3d: 0.3, effect_spatial: 0.15 } },
  { match: /grid|masonry|layout/i,          boost: { layout_structure: 0.25 } },
  { match: /interactive|animation|motion/i, boost: { interaction_pattern: 0.3 } },
];

/**
 * 브리프 기반으로 동적 축 가중치 계산
 * @param {Object} parsed - briefParser 결과 (industry, keywords, intent, constraints)
 */
function buildDynamicWeights(parsed = {}) {
  const weights = { ...DEFAULT_AXIS_WEIGHTS };

  // 1. Industry 부스트
  const industryKey = (parsed.industry || "")
    .toLowerCase().replace(/[\s\/\-]/g, "_");
  const indBoost =
    INDUSTRY_BOOST[industryKey] ||
    INDUSTRY_BOOST[Object.keys(INDUSTRY_BOOST).find(k => industryKey.includes(k))] ||
    {};
  for (const [axis, delta] of Object.entries(indBoost)) {
    if (weights[axis] != null) weights[axis] += delta;
  }

  // 2. Channel 부스트 (constraints / keywords에서 채널 감지)
  const haystack = [
    ...(parsed.keywords || []),
    ...(parsed.constraints || []),
    parsed.intent || "",
  ].join(" ").toLowerCase();

  for (const [channel, boost] of Object.entries(CHANNEL_BOOST)) {
    if (haystack.includes(channel)) {
      for (const [axis, delta] of Object.entries(boost)) {
        if (weights[axis] != null) weights[axis] += delta;
      }
    }
  }

  // 3. 키워드 힌트 부스트
  for (const hint of KEYWORD_HINTS) {
    if (hint.match.test(haystack)) {
      for (const [axis, delta] of Object.entries(hint.boost)) {
        if (weights[axis] != null) weights[axis] += delta;
      }
    }
  }

  return weights;
}

/**
 * reference_id 목록으로 axis_scores 로드
 */
async function loadAxisScores(referenceIds) {
  const { data } = await supabase
    .from("axis_scores")
    .select("reference_id, brand_concept, tone_manner, color_mood, brand_distinctiveness, effect_2d, effect_3d, effect_spatial, layout_structure, interaction_pattern, hierarchy_strength, channel_fit, image_category, conversion_focus, ux_flow_clarity, mobile_readiness, reference_quality")
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
function computeAxisScore(axisRow, weights) {
  let total = 0, weightSum = 0;
  for (const [axis, weight] of Object.entries(weights)) {
    const val = axisRow?.[axis];
    if (val != null) {
      total += val * weight;
      weightSum += weight;
    }
  }
  return weightSum > 0 ? total / weightSum : 0;
}

/**
 * @param {Array}  candidates - industryFilter 결과
 * @param {Object} parsed     - briefParser 결과 (dynamic weights 계산용)
 * @returns {Promise<Array>}  - composite_score 기준 상위 TOP_K
 */
export async function rerank(candidates, parsed = {}) {
  if (candidates.length === 0) return [];

  const dynamicWeights = buildDynamicWeights(parsed);

  const refIds = [...new Set(candidates.map((c) => c.reference_id))];
  const axisMap = await loadAxisScores(refIds);

  const scored = candidates.map((c) => {
    const axisRow  = axisMap[c.reference_id];
    // industryPattern이 있으면 병합, 없으면 dynamic weights 사용
    const weights  = c.industryPattern
      ? Object.fromEntries(
          Object.entries(dynamicWeights).map(([k, v]) => [k, v + (c.industryPattern[k] ?? 0)])
        )
      : dynamicWeights;

    const axisScore  = computeAxisScore(axisRow, weights);
    const similarity = 1 - c.distance;
    const compositeScore = similarity * 0.5 + axisScore * 0.35 + (c.industryBonus || 0) * 0.15;

    return { ...c, axisScore, similarity, compositeScore };
  });

  const seen = new Set();
  const deduped = scored.filter((c) => {
    if (seen.has(c.reference_id)) return false;
    seen.add(c.reference_id);
    return true;
  });

  return deduped.sort((a, b) => b.compositeScore - a.compositeScore).slice(0, TOP_K);
}
