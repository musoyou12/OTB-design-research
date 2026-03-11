-- MODULE A: 청크 단위 벡터 저장소 (pgvector 필요)
-- Supabase에서 먼저 실행: CREATE EXTENSION IF NOT EXISTS vector;

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
