-- 017_axis_scores_v2.sql
-- 기존 axis_scores 테이블을 Phase 2 16축으로 업데이트
-- Supabase SQL Editor에서 실행

-- 기존 축 제거 (새 축으로 대체)
ALTER TABLE axis_scores
  DROP COLUMN IF EXISTS visual_clarity,
  DROP COLUMN IF EXISTS color_expressiveness,
  DROP COLUMN IF EXISTS typography_strength,
  DROP COLUMN IF EXISTS layout_complexity,
  DROP COLUMN IF EXISTS interaction_richness,
  DROP COLUMN IF EXISTS content_density,
  DROP COLUMN IF EXISTS whitespace_usage,
  DROP COLUMN IF EXISTS cta_prominence,
  DROP COLUMN IF EXISTS emotional_tone,
  DROP COLUMN IF EXISTS innovation_level;

-- 신규 축 추가
ALTER TABLE axis_scores
  ADD COLUMN IF NOT EXISTS brand_concept        float DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS tone_manner          float DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS color_mood           float DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS effect_2d            float DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS effect_3d            float DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS effect_spatial       float DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS layout_structure     float DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS interaction_pattern  float DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS channel_fit          float DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS image_category       float DEFAULT 0.5;

-- 유지: brand_distinctiveness, hierarchy_strength, conversion_focus,
--        ux_flow_clarity, mobile_readiness, reference_quality
