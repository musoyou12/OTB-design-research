/**
 * industryFilter.js
 *
 * industry_patterns 테이블 기반 가중치 적용
 * - 해당 산업에서 중요한 축(axis)에 높은 가중치 부여
 * - 패턴이 없으면 기본 가중치(1.0) 유지
 */

import { supabase } from "../../../supabase/supabase.js";

/**
 * 산업별 패턴 로드
 * @param {string} industry
 * @returns {Promise<Object|null>}  axis_avg 패턴 객체
 */
async function loadIndustryPattern(industry) {
  if (!industry) return null;

  const { data } = await supabase
    .from("industry_patterns")
    .select("pattern_value")
    .eq("industry", industry)
    .eq("pattern_key", "axis_avg")
    .single();

  return data?.pattern_value || null;
}

/**
 * 후보 레퍼런스에 산업 관련성 보너스 적용
 *
 * @param {Array} candidates  - vectorRetriever 결과
 * @param {string} industry   - 브리프 산업
 * @returns {Promise<Array>}  - industry_bonus 필드 추가된 candidates
 */
export async function applyIndustryFilter(candidates, industry) {
  const pattern = await loadIndustryPattern(industry);

  return candidates.map((c) => {
    // 같은 산업 레퍼런스에 보너스
    const sameIndustry = c.industry === industry;
    const industryBonus = sameIndustry ? 0.15 : 0;

    return { ...c, industryBonus, industryPattern: pattern };
  });
}
