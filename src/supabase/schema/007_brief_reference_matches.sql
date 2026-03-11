-- MODULE B: 브리프 ↔ 레퍼런스 매칭 결과
CREATE TABLE IF NOT EXISTS brief_reference_matches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id        uuid REFERENCES briefs(id) ON DELETE CASCADE,
  reference_id    uuid REFERENCES design_references(id) ON DELETE CASCADE,
  similarity      float,
  composite_score float,
  rerank_reason   text,
  created_at      timestamptz DEFAULT now()
);
