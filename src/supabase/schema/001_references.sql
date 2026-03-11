-- MODULE A: 수집된 레퍼런스 원문
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
