-- 파이프라인 실행 로그 (Module A 배치용)
CREATE TABLE IF NOT EXISTS pipeline_runs (
  run_id           uuid PRIMARY KEY,
  run_date         date,
  pipeline_version text,
  status           text CHECK (status IN ('running', 'success', 'failed')),
  started_at       timestamptz,
  finished_at      timestamptz,
  error_message    text,
  stack_trace      text,
  stats            jsonb   -- { collected, embedded, scored, skipped }
);
