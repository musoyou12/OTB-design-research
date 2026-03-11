-- MODULE B: 브리프 입력 저장
CREATE TABLE IF NOT EXISTS briefs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name    text,
  raw_text        text NOT NULL,
  parsed          jsonb,        -- { industry, intent, keywords, constraints }
  industry        text,
  goal            text[],
  target_audience text[],
  channel         text[],
  constraints     text[],
  competitors     text[],
  embedding       vector(1536),
  created_at      timestamptz DEFAULT now()
);
