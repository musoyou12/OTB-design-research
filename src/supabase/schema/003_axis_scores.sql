-- MODULE A: 16축 스코어링
-- Phase 2 스펙 분류 체계 반영 (Brand / Visual Depth / Structure / Content / Quality)

CREATE TABLE IF NOT EXISTS axis_scores (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id uuid REFERENCES design_references(id) ON DELETE CASCADE,

  -- Brand (4)
  brand_concept         float DEFAULT 0.5,  -- Minimal / Luxury Calm / Raw Nature / Witty
  tone_manner           float DEFAULT 0.5,  -- Calm / Bold / Friendly / Clinical
  color_mood            float DEFAULT 0.5,  -- Warm Natural / Pastel / High Contrast
  brand_distinctiveness float DEFAULT 0.5,  -- 브랜드 독창성

  -- Visual Depth (3)
  effect_2d             float DEFAULT 0.5,  -- Clean / Bold / High Clarity
  effect_3d             float DEFAULT 0.5,  -- Soft Shadow / Layered Depth / Materiality
  effect_spatial        float DEFAULT 0.5,  -- Luxury Space / Natural Atmosphere / Urban Modern

  -- Structure (3)
  layout_structure      float DEFAULT 0.5,  -- 1 Column / Split / Grid / Masonry
  interaction_pattern   float DEFAULT 0.5,  -- Sticky Header / Stepper / Floating CTA
  hierarchy_strength    float DEFAULT 0.5,  -- 정보 위계 강도

  -- Content (3)
  channel_fit           float DEFAULT 0.5,  -- PDP / PLP / Landing / SNS / Ads / Lookbook
  image_category        float DEFAULT 0.5,  -- Product / Model / Lifestyle / Abstract / Texture
  conversion_focus      float DEFAULT 0.5,  -- 전환 최적화 강도

  -- Quality (3)
  ux_flow_clarity       float DEFAULT 0.5,  -- UX 흐름 명확성
  mobile_readiness      float DEFAULT 0.5,  -- 모바일 최적화
  reference_quality     float DEFAULT 0.5,  -- 레퍼런스 전체 품질

  scored_at timestamptz DEFAULT now()
);
