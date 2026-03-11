-- ============================================================
-- OTB — briefs 테이블 구조 업데이트
-- 기존 Supabase DB에 이미 briefs 테이블이 있을 때 실행
-- Supabase SQL Editor에서 실행
-- ============================================================

ALTER TABLE briefs
  ADD COLUMN IF NOT EXISTS project_name    text,
  ADD COLUMN IF NOT EXISTS industry        text,
  ADD COLUMN IF NOT EXISTS goal            text[],
  ADD COLUMN IF NOT EXISTS target_audience text[],
  ADD COLUMN IF NOT EXISTS channel         text[],
  ADD COLUMN IF NOT EXISTS constraints     text[],
  ADD COLUMN IF NOT EXISTS competitors     text[];
