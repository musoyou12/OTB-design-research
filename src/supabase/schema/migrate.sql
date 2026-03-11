-- ============================================================
-- OTB Design Research — Full Migration
-- Supabase SQL Editor에서 이 파일 하나만 실행하면 됩니다.
-- ============================================================

-- 0. pgvector 확장 활성화 (최우선)
CREATE EXTENSION IF NOT EXISTS vector;


-- ============================================================
-- MODULE A 테이블
-- ============================================================

-- 1. 수집된 레퍼런스 원문
CREATE TABLE IF NOT EXISTS design_references (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url   text NOT NULL UNIQUE,
  title        text,
  body_text    text,
  industry     text,
  domain       text,
  tags         text[],
  crawl_status text CHECK (crawl_status IN ('success', 'partial', 'blocked')),
  crawled_at   timestamptz,
  created_at   timestamptz DEFAULT now()
);

-- 2. 청크 단위 벡터 저장소
CREATE TABLE IF NOT EXISTS reference_chunks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id uuid REFERENCES design_references(id) ON DELETE CASCADE,
  chunk_index  int NOT NULL,
  chunk_text   text NOT NULL,
  embedding    vector(1536),
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reference_chunks_embedding_idx
  ON reference_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 3. 16축 스코어링
CREATE TABLE IF NOT EXISTS axis_scores (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id          uuid REFERENCES design_references(id) ON DELETE CASCADE UNIQUE,
  visual_clarity        float,
  color_expressiveness  float,
  typography_strength   float,
  layout_complexity     float,
  ux_flow_clarity       float,
  interaction_richness  float,
  mobile_readiness      float,
  hierarchy_strength    float,
  content_density       float,
  whitespace_usage      float,
  cta_prominence        float,
  conversion_focus      float,
  brand_distinctiveness float,
  emotional_tone        float,
  innovation_level      float,
  reference_quality     float,
  scored_at             timestamptz DEFAULT now()
);

-- 4. 산업별 패턴 누적
CREATE TABLE IF NOT EXISTS industry_patterns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry      text NOT NULL,
  pattern_key   text NOT NULL,
  pattern_value jsonb,
  weight        float DEFAULT 1.0,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (industry, pattern_key)
);

-- 5. UX 근거 문서
CREATE TABLE IF NOT EXISTS ux_evidence_documents (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text,
  content    text,
  embedding  vector(1536),
  tags       text[],
  source_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ux_evidence_embedding_idx
  ON ux_evidence_documents USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- 6. 파이프라인 실행 로그
CREATE TABLE IF NOT EXISTS pipeline_runs (
  run_id           uuid PRIMARY KEY,
  run_date         date,
  pipeline_version text,
  status           text CHECK (status IN ('running', 'success', 'failed')),
  started_at       timestamptz,
  finished_at      timestamptz,
  error_message    text,
  stack_trace      text,
  stats            jsonb
);

-- 7. 크롤러 소스별 수집 상태 로그
CREATE TABLE IF NOT EXISTS retrieval_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          uuid REFERENCES pipeline_runs(run_id),
  source_url      text,
  crawl_status    text CHECK (crawl_status IN ('success', 'partial', 'blocked')),
  retrieved_count int DEFAULT 0,
  error_message   text,
  logged_at       timestamptz DEFAULT now()
);


-- ============================================================
-- MODULE B 테이블
-- ============================================================

-- 8. 브리프 입력
CREATE TABLE IF NOT EXISTS briefs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name    text,
  raw_text        text NOT NULL,
  parsed          jsonb,
  industry        text,
  goal            text[],
  target_audience text[],
  channel         text[],
  constraints     text[],
  competitors     text[],
  embedding       vector(1536),
  created_at      timestamptz DEFAULT now()
);

-- 9. 브리프 ↔ 레퍼런스 매칭 결과
CREATE TABLE IF NOT EXISTS brief_reference_matches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id        uuid REFERENCES briefs(id) ON DELETE CASCADE,
  reference_id    uuid REFERENCES design_references(id) ON DELETE CASCADE,
  similarity      float,
  composite_score float,
  rerank_reason   text,
  created_at      timestamptz DEFAULT now()
);

-- 10. 전략 A/B/C
CREATE TABLE IF NOT EXISTS strategy_variants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id         uuid REFERENCES briefs(id) ON DELETE CASCADE,
  variant          text CHECK (variant IN ('A', 'B', 'C')),
  title            text,
  design_direction text,
  ux_reasoning     text,
  explanation      text,
  created_at       timestamptz DEFAULT now()
);

-- 11. 전략별 프롬프트 팩
CREATE TABLE IF NOT EXISTS prompt_outputs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id    uuid REFERENCES strategy_variants(id) ON DELETE CASCADE,
  visual_prompt  text,
  layout_prompt  text,
  tone_prompt    text,
  keyword_pack   text[],
  created_at     timestamptz DEFAULT now()
);

-- 12. 피드백 로그 (Phase 3)
CREATE TABLE IF NOT EXISTS feedback_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id    uuid REFERENCES briefs(id),
  strategy_id uuid REFERENCES strategy_variants(id),
  rating      int CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  created_at  timestamptz DEFAULT now()
);


-- ============================================================
-- RPC 함수
-- ============================================================

-- 레퍼런스 벡터 검색 (Module B - vectorRetriever)
CREATE OR REPLACE FUNCTION match_references(
  query_embedding  vector(1536),
  match_count      int  DEFAULT 50,
  industry_filter  text DEFAULT NULL
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

-- UX 근거 문서 벡터 검색 (Module B - uxEvidenceRetriever)
CREATE OR REPLACE FUNCTION match_ux_evidence(
  query_embedding vector(1536),
  match_count     int DEFAULT 5
)
RETURNS TABLE (
  id         uuid,
  title      text,
  content    text,
  tags       text[],
  source_url text,
  distance   float
)
LANGUAGE sql STABLE AS $$
  SELECT
    id,
    title,
    content,
    tags,
    source_url,
    embedding <=> query_embedding AS distance
  FROM ux_evidence_documents
  ORDER BY distance ASC
  LIMIT match_count;
$$;
