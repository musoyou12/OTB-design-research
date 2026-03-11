-- MODULE B: 벡터 검색 RPC 함수
-- Module B의 vectorRetriever가 이 함수를 호출합니다.

CREATE OR REPLACE FUNCTION match_references(
  query_embedding  vector(1536),
  match_count      int     DEFAULT 50,
  industry_filter  text    DEFAULT NULL
)
RETURNS TABLE (
  reference_id uuid,
  title        text,
  source_url   text,
  industry     text,
  chunk_text   text,
  distance     float
)
LANGUAGE sql STABLE AS $$
  SELECT
    r.id          AS reference_id,
    r.title,
    r.source_url,
    r.industry,
    rc.chunk_text,
    rc.embedding <=> query_embedding AS distance
  FROM reference_chunks rc
  JOIN design_references r ON r.id = rc.reference_id
  WHERE
    r.crawl_status IN ('success', 'partial')
    AND (industry_filter IS NULL OR r.industry = industry_filter)
  ORDER BY distance ASC
  LIMIT match_count;
$$;
