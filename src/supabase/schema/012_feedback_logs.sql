-- (선택) 패킷 품질 피드백 — Phase 3용
CREATE TABLE IF NOT EXISTS feedback_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id    uuid REFERENCES briefs(id),
  strategy_id uuid REFERENCES strategy_variants(id),
  rating      int CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  created_at  timestamptz DEFAULT now()
);

