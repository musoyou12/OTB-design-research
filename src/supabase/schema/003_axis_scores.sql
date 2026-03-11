-- MODULE A: 16축 스코어링
CREATE TABLE IF NOT EXISTS axis_scores (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id          uuid REFERENCES design_references(id) ON DELETE CASCADE,

  -- Visual
  visual_clarity        float,
  color_expressiveness  float,
  typography_strength   float,
  layout_complexity     float,

  -- UX
  ux_flow_clarity       float,
  interaction_richness  float,
  mobile_readiness      float,
  hierarchy_strength    float,

  -- Content
  content_density       float,
  whitespace_usage      float,
  cta_prominence        float,
  conversion_focus      float,

  -- Brand
  brand_distinctiveness float,
  emotional_tone        float,
  innovation_level      float,
  reference_quality     float,

  scored_at timestamptz DEFAULT now()
);
