-- ============================================================
-- OTB — 트렌드 신호 테이블 분리
-- Supabase SQL Editor에서 실행
-- ============================================================

-- INTENT: Google Trends 수치 데이터 (임베딩 불필요)
CREATE TABLE IF NOT EXISTS trend_signals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         text,
  industry       text NOT NULL,
  keyword        text NOT NULL,
  interest_avg   float,          -- 3개월 평균 관심도 (0~100)
  top_keywords   text[],         -- 상위 키워드 목록
  summary        text,           -- "패션 브랜드(82), fashion UX(67)..."
  timeframe      text DEFAULT 'today 3-m',
  geo            text DEFAULT 'KR',
  collected_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trend_signals_industry ON trend_signals (industry);
CREATE INDEX IF NOT EXISTS idx_trend_signals_collected ON trend_signals (collected_at DESC);

-- HOW: Behance / Dribbble 비주얼 트렌드 (임베딩 있음)
CREATE TABLE IF NOT EXISTS visual_trends (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       text,
  source_name  text,           -- "Behance / Branding", "Dribbble / Popular"
  source_url   text UNIQUE,
  title        text,
  description  text,
  industry     text,
  tags         text[],
  embedding    vector(1536),
  collected_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visual_trends_industry ON visual_trends (industry);

-- 비주얼 트렌드 벡터 인덱스
CREATE INDEX IF NOT EXISTS idx_visual_trends_embedding
  ON visual_trends USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- ============================================================
-- RPC: 비주얼 트렌드 벡터 검색
-- ============================================================
CREATE OR REPLACE FUNCTION match_visual_trends(
  query_embedding vector(1536),
  match_count     int  DEFAULT 10,
  industry_filter text DEFAULT NULL
)
RETURNS TABLE (
  id          uuid,
  title       text,
  source_url  text,
  description text,
  industry    text,
  tags        text[],
  distance    float
)
LANGUAGE sql STABLE AS $$
  SELECT
    id,
    title,
    source_url,
    description,
    industry,
    tags,
    embedding <=> query_embedding AS distance
  FROM visual_trends
  WHERE (industry_filter IS NULL OR industry = industry_filter)
  ORDER BY distance ASC
  LIMIT match_count;
$$;
