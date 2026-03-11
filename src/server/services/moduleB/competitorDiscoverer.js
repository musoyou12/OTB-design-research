/**
 * competitorDiscoverer.js
 *
 * 경쟁사 URL이 없을 때 → 배치 크롤링 데이터(trend_signals, visual_trends, topRefs)
 * 기반으로 브리프에 맞는 실제 브랜드 웹사이트 URL을 자동 탐색
 *
 * 반환: string[] — https:// 로 시작하는 URL 목록 (최대 8개)
 */

import OpenAI from "openai";
import { supabase } from "../../../supabase/supabase.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Supabase에서 브리프 산업 관련 트렌드 컨텍스트 조회
 */
async function fetchTrendContext(industry) {
  const lines = [];

  try {
    const { data: signals } = await supabase
      .from("trend_signals")
      .select("industry, keyword, interest_avg, top_keywords, summary")
      .or(`industry.eq.${industry},industry.eq.general`)
      .order("collected_at", { ascending: false })
      .limit(8);

    if (signals?.length) {
      lines.push("## Google Trends (INTENT)");
      for (const t of signals) {
        lines.push(`[${t.industry}] ${t.keyword} avg:${t.interest_avg} — ${t.summary || t.top_keywords?.join(", ")}`);
      }
    }
  } catch (_) {}

  try {
    const { data: visuals } = await supabase
      .from("visual_trends")
      .select("source_name, title, description, industry, tags")
      .or(`industry.eq.${industry},industry.eq.general`)
      .order("collected_at", { ascending: false })
      .limit(10);

    if (visuals?.length) {
      lines.push("\n## Visual Trends (HOW — Behance/Dribbble)");
      for (const v of visuals) {
        lines.push(`[${v.source_name}] ${v.title} — ${v.description?.slice(0, 100)} tags:${v.tags?.join(", ")}`);
      }
    }
  } catch (_) {}

  return lines.join("\n");
}

/**
 * topRefs(axisReranker 결과) + 트렌드 데이터 → GPT로 경쟁사 URL 탐색
 *
 * @param {Array}  topRefs  - axisReranker 결과 (reference_id, title, source_url, chunk_text)
 * @param {Object} parsed   - briefParser 결과 (industry, keywords, intent, target)
 * @returns {Promise<string[]>} https:// 로 시작하는 URL 목록 (최대 8개)
 */
export async function discoverCompetitorUrls(topRefs, parsed) {
  const trendContext = await fetchTrendContext(parsed.industry);

  const refSummary = topRefs.slice(0, 12).map(r =>
    `- "${r.title || ''}" | ${r.source_url || ''} | tags: ${r.tags?.join(", ") || ""} | ${r.chunk_text?.slice(0, 120) || ""}`
  ).join("\n");

  const hasTrendData = trendContext.trim().length > 0;
  const hasRefData   = refSummary.trim().length > 0;

  if (!hasTrendData && !hasRefData) {
    console.log("[DISCOVERER] 트렌드/레퍼런스 데이터 없음 — 산업 기반 fallback 사용");
  }

  const prompt = `You are a UX research strategist specializing in competitive analysis.

Based on the design research data below, identify 5–8 real brand websites that are the most relevant competitors for this project. Return their actual main website URLs (not article or portfolio URLs).

## Project Brief
- Industry: ${parsed.industry}
- Goal: ${parsed.intent || parsed.goal || ""}
- Target audience: ${parsed.target || ""}
- Keywords: ${parsed.keywords?.join(", ") || ""}

## Retrieved Design References (from research DB)
${hasRefData ? refSummary : "(none)"}

## Trend Context
${hasTrendData ? trendContext : "(none — use industry knowledge)"}

## Instructions
- Return real brands with actual websites relevant to the industry and brief
- If reference data is sparse, use your knowledge of the ${parsed.industry} industry
- URLs must start with https://
- Do NOT return design media sites (e.g. designboom.com, behance.net, dribbble.com)
- Max 8 entries, ranked by relevance to the brief

Return ONLY valid JSON:
{
  "competitors": [
    { "name": "Brand Name", "url": "https://www.brand.com" },
    ...
  ]
}`;

  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const result = JSON.parse(res.choices[0].message.content);
    const urls = (result.competitors || [])
      .map(c => c.url)
      .filter(u => typeof u === "string" && u.startsWith("https://"));

    console.log(`[DISCOVERER] 발견된 경쟁사 URL: ${urls.length}개`);
    return urls;
  } catch (e) {
    console.error("[DISCOVERER] GPT 탐색 실패:", e.message);
    return [];
  }
}
