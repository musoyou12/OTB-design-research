-- MODULE A: UX 근거 문서
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
