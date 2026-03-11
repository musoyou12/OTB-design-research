-- 크롤러 소스별 수집 상태 로그
CREATE TABLE IF NOT EXISTS retrieval_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          uuid REFERENCES pipeline_runs(run_id),
  source_url      text,
  crawl_status    text CHECK (crawl_status IN ('success', 'partial', 'blocked')),
  retrieved_count int DEFAULT 0,
  error_message   text,
  logged_at       timestamptz DEFAULT now()
);
