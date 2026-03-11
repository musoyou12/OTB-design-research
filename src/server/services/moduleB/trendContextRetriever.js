/**
 * trendContextRetriever.js
 *
 * Module B — DB에서 트렌드 신호 조회
 * trend_signals (Google Trends) + visual_trends 최근 데이터
 * → 전략 생성의 동적 컨텍스트로 활용
 */

import { supabase } from "../../../supabase/supabase.js";

/**
 * 산업 관련 트렌드 신호 조회
 * @param {string} industry
 * @returns {Promise<string>} 프롬프트용 텍스트
 */
export async function getTrendContext(industry) {
  const lines = [];

  // ── Google Trends (INTENT) ──────────────────────────
  try {
    const { data: trends } = await supabase
      .from("trend_signals")
      .select("industry, keyword, interest_avg, top_keywords, summary, collected_at")
      .or(`industry.eq.${industry},industry.eq.general`)
      .order("collected_at", { ascending: false })
      .limit(6);

    if (trends?.length) {
      lines.push("## Trend Signals (INTENT — Google Trends KR)");
      for (const t of trends) {
        lines.push(`[${t.industry}] ${t.keyword} (avg: ${t.interest_avg}) — ${t.summary}`);
      }
    }
  } catch (e) {
    // trend_signals 테이블 없으면 skip
  }

  // ── Visual Trends (HOW) ────────────────────────────
  try {
    const { data: visuals } = await supabase
      .from("visual_trends")
      .select("source_name, title, industry, tags, collected_at")
      .or(`industry.eq.${industry},industry.eq.general`)
      .order("collected_at", { ascending: false })
      .limit(8);

    if (visuals?.length) {
      lines.push("\n## Visual Trends (HOW — Behance/Dribbble)");
      for (const v of visuals) {
        lines.push(`[${v.source_name}] ${v.title} — tags: ${v.tags?.join(", ")}`);
      }
    }
  } catch (e) {
    // visual_trends 테이블 없으면 skip
  }

  return lines.length > 0
    ? lines.join("\n")
    : "No trend data available yet. Run the pipeline to collect trends.";
}
