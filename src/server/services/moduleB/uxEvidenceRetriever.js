/**
 * uxEvidenceRetriever.js
 *
 * 전략 방향에 맞는 UX 근거 문서 검색
 * ux_evidence_documents 테이블에서 키워드 기반 조회
 *
 * 크롤링 없음. DB 검색만.
 */

import { supabase } from "../../../supabase/supabase.js";
import { embedBrief } from "./briefEmbedder.js";

const EVIDENCE_LIMIT = 5;

/**
 * @param {string[]} keywords  - 브리프 파싱 키워드
 * @returns {Promise<Array>}   - [{ title, content, tags, source_url }]
 */
export async function retrieveUxEvidence(keywords) {
  if (!keywords || keywords.length === 0) return [];

  // 키워드 조합으로 임베딩 생성 후 유사 문서 검색
  const queryText = keywords.join(" ");
  const embedding = await embedBrief(queryText);

  const { data, error } = await supabase.rpc("match_ux_evidence", {
    query_embedding: embedding,
    match_count: EVIDENCE_LIMIT,
  });

  // RPC 없거나 테이블 비어 있으면 빈 배열 반환 (비차단)
  if (error || !data) return [];

  return data.map((d) => ({
    title: d.title,
    content: d.content?.slice(0, 500),
    tags: d.tags,
    source_url: d.source_url,
  }));
}
