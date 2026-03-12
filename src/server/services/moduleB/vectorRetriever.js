/**
 * vectorRetriever.js
 *
 * pgvector 기반 레퍼런스 후보 검색
 * Supabase RPC: match_references (013_rpc_match_references.sql)
 *
 * 크롤링 없음. DB 검색만.
 */

import { supabase } from "../../../supabase/supabase.js";

// 다양한 표기 → DB 저장 키값으로 정규화
const INDUSTRY_MAP = {
  "f&b": "f&b", "f&B": "f&b", "F&B": "f&b",
  "food": "f&b", "beverage": "f&b", "cafe": "f&b", "restaurant": "f&b",
  "beauty": "beauty", "skincare": "beauty", "cosmetics": "beauty",
  "fashion": "fashion", "luxury": "fashion", "apparel": "fashion",
  "saas": "saas", "b2b saas": "saas", "software": "saas", "tech": "saas",
  "lifestyle": "lifestyle", "wellness": "lifestyle",
  "finance": "finance", "fintech": "finance",
  "healthcare": "healthcare", "health": "healthcare",
  "education": "education", "edtech": "education",
};

function normalizeIndustry(industry) {
  if (!industry) return null;
  const key = industry.trim().toLowerCase();
  return INDUSTRY_MAP[key] || key;
}

/**
 * @param {number[]} embedding  - 브리프 임베딩 (1536차원)
 * @param {string|null} industry - 산업 필터 (null이면 전체)
 * @param {number} matchCount   - 후보 수 (default 50)
 * @returns {Promise<Array>}    - [{ reference_id, title, source_url, industry, chunk_text, distance }]
 */
export async function retrieveCandidates(embedding, industry = null, matchCount = 50) {
  const normalizedIndustry = normalizeIndustry(industry);

  // 1차: industry 필터 적용
  const { data, error } = await supabase.rpc("match_references", {
    query_embedding: embedding,
    match_count: matchCount,
    industry_filter: normalizedIndustry,
  });

  if (error) throw new Error(`vectorRetriever RPC error: ${error.message}`);

  // industry 필터 결과가 없으면 축소된 전체 검색으로 폴백 (timeout 방지)
  if ((!data || data.length === 0) && normalizedIndustry) {
    console.log(`[RETRIEVER] industry="${normalizedIndustry}" 결과 없음 → 전체 검색 폴백 (limit 20)`);
    const { data: fallback, error: fallbackError } = await supabase.rpc("match_references", {
      query_embedding: embedding,
      match_count: 20,
      industry_filter: null,
    });
    if (fallbackError) throw new Error(`vectorRetriever fallback error: ${fallbackError.message}`);
    return fallback || [];
  }

  return data || [];
}
