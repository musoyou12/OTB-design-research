/**
 * packetComposer.js
 *
 * 모든 파이프라인 결과물을 최종 리서치 패킷으로 조립
 * 저장/전송 없음. 순수 조립만.
 */

/**
 * @param {Object} params
 * @param {string}   params.briefId
 * @param {string}   params.rawBrief
 * @param {Object}   params.parsed        - briefParser 결과
 * @param {Array}    params.topRefs        - axisReranker TOP 10
 * @param {Array}    params.uxEvidence     - UX 근거 문서
 * @param {Array}    params.competitorData - 경쟁사 분석 결과
 * @param {Object}   params.strategies     - { A, B, C }
 * @param {Object}   params.prompts        - { A, B, C }
 * @returns {Object} 최종 리서치 패킷
 */
export function composePacket({
  briefId,
  rawBrief,
  parsed,
  topRefs,
  uxEvidence,
  competitorData = [],
  strategies,
  prompts,
}) {
  const recommended_references = topRefs.map((r) => ({
    id: r.reference_id,
    title: r.title,
    source_url: r.source_url,
    industry: r.industry,
    relevance_score: parseFloat(r.compositeScore?.toFixed(4) ?? 0),
    relevance_explanation: r.chunk_text?.slice(0, 200),
    tags: [],
    pattern_signals: [],
  }));

  const strategy_entries = ["A", "B", "C"].reduce((acc, v) => {
    acc[v] = {
      title: strategies[v]?.title,
      design_direction: strategies[v]?.design_direction,
      ux_reasoning: strategies[v]?.ux_reasoning,
      explanation: strategies[v]?.explanation,
    };
    return acc;
  }, {});

  const prompt_pack = ["A", "B", "C"].reduce((acc, v) => {
    acc[v] = {
      visual_prompt: prompts[v]?.visual_prompt,
      layout_prompt: prompts[v]?.layout_prompt,
      tone_prompt: prompts[v]?.tone_prompt,
      keyword_pack: prompts[v]?.keyword_pack ?? [],
    };
    return acc;
  }, {});

  return {
    brief_id: briefId,
    generated_at: new Date().toISOString(),
    brief: {
      raw: rawBrief,
      industry: parsed.industry,
      intent: parsed.intent,
      keywords: parsed.keywords,
      constraints: parsed.constraints,
    },
    recommended_references,
    ux_evidence: uxEvidence,
    competitors: competitorData,
    strategies: strategy_entries,
    prompt_pack,
  };
}
