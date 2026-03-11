/**
 * packetSaver.js
 *
 * 최종 패킷 결과를 Supabase에 저장
 * 테이블: briefs, strategy_variants, prompt_outputs, brief_reference_matches
 */

import { supabase } from "../../../supabase/supabase.js";

/**
 * briefs 테이블에 저장
 * @param {string}   rawBrief   - 텍스트로 합쳐진 브리프
 * @param {Object}   parsed     - { industry, intent, keywords, constraints }
 * @param {number[]} embedding
 * @param {Object}   briefInput - 원본 폼 입력값 { projectName, industry, goal, target, channel, req, comp, ... }
 */
export async function saveBrief(rawBrief, parsed, embedding, briefInput = {}) {
  const toArr = (v) =>
    Array.isArray(v)
      ? v
      : v
      ? String(v).split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  const { data, error } = await supabase
    .from("briefs")
    .insert({
      project_name:    briefInput.projectName || null,
      raw_text:        rawBrief,
      parsed,
      industry:        toArr(briefInput.industry)[0] || parsed.industry || null,
      goal:            toArr(briefInput.goal),
      target_audience: toArr(briefInput.target),
      channel:         toArr(briefInput.channel),
      constraints:     toArr(briefInput.req ?? briefInput.constraints),
      competitors:     toArr(briefInput.comp ?? briefInput.competitors),
      embedding,
    })
    .select("id")
    .single();

  if (error) throw new Error(`saveBrief error: ${error.message}`);
  return data.id;
}

/**
 * strategy_variants + prompt_outputs 저장
 */
export async function saveStrategiesAndPrompts(briefId, strategies, prompts) {
  const savedIds = {};

  for (const variant of ["A", "B", "C"]) {
    const s = strategies[variant];
    const { data, error } = await supabase
      .from("strategy_variants")
      .insert({
        brief_id: briefId,
        variant,
        title: s.title,
        design_direction: s.design_direction,
        ux_reasoning: s.ux_reasoning,
        explanation: s.explanation,
      })
      .select("id")
      .single();

    if (error) throw new Error(`saveStrategy ${variant} error: ${error.message}`);

    savedIds[variant] = data.id;

    const p = prompts[variant];
    await supabase.from("prompt_outputs").insert({
      strategy_id: data.id,
      visual_prompt: p.visual_prompt,
      layout_prompt: p.layout_prompt,
      tone_prompt: p.tone_prompt,
      keyword_pack: p.keyword_pack,
    });
  }

  return savedIds;
}

/**
 * brief_reference_matches 저장
 */
export async function saveMatches(briefId, topRefs) {
  const rows = topRefs.map((r) => ({
    brief_id: briefId,
    reference_id: r.reference_id,
    similarity: r.similarity,
    composite_score: r.compositeScore,
    rerank_reason: `axis: ${r.axisScore?.toFixed(3)}, industry_bonus: ${r.industryBonus}`,
  }));

  if (rows.length === 0) return;

  const { error } = await supabase.from("brief_reference_matches").insert(rows);
  if (error) throw new Error(`saveMatches error: ${error.message}`);
}
