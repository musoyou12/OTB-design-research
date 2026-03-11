/**
 * vectorRetriever.js
 *
 * pgvector 기반 레퍼런스 후보 검색
 * Supabase RPC: match_references (013_rpc_match_references.sql)
 *
 * 크롤링 없음. DB 검색만.
 */

import { supabase } from "../../../supabase/supabase.js";

/**
 * @param {number[]} embedding  - 브리프 임베딩 (1536차원)
 * @param {string|null} industry - 산업 필터 (null이면 전체)
 * @param {number} matchCount   - 후보 수 (default 50)
 * @returns {Promise<Array>}    - [{ reference_id, title, source_url, industry, chunk_text, distance }]
 */
export async function retrieveCandidates(embedding, industry = null, matchCount = 50) {
  // 1차: industry 필터 적용
  const { data, error } = await supabase.rpc("match_references", {
    query_embedding: embedding,
    match_count: matchCount,
    industry_filter: industry,
  });

  if (error) throw new Error(`vectorRetriever RPC error: ${error.message}`);

  // industry 필터 결과가 없으면 전체 검색으로 폴백
  if ((!data || data.length === 0) && industry) {
    console.log(`[RETRIEVER] industry="${industry}" 결과 없음 → 전체 검색으로 폴백`);
    const { data: fallback, error: fallbackError } = await supabase.rpc("match_references", {
      query_embedding: embedding,
      match_count: matchCount,
      industry_filter: null,
    });
    if (fallbackError) throw new Error(`vectorRetriever fallback error: ${fallbackError.message}`);
    return fallback || [];
  }

  return data || [];
}
