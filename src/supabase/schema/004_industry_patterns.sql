-- MODULE A: 산업별 패턴 누적
CREATE TABLE IF NOT EXISTS industry_patterns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry      text NOT NULL,
  pattern_key   text NOT NULL,
  pattern_value jsonb,
  weight        float DEFAULT 1.0,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (industry, pattern_key)
);
