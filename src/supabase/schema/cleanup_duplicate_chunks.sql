-- 중복 청크 제거: reference_id + chunk_index 기준으로 최신 1개만 유지
DELETE FROM reference_chunks
WHERE id NOT IN (
  SELECT DISTINCT ON (reference_id, chunk_index) id
  FROM reference_chunks
  ORDER BY reference_id, chunk_index, created_at DESC
);
