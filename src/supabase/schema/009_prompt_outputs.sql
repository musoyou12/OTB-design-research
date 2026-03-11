-- MODULE B: 전략별 프롬프트 팩
CREATE TABLE IF NOT EXISTS prompt_outputs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id    uuid REFERENCES strategy_variants(id) ON DELETE CASCADE,
  visual_prompt  text,
  layout_prompt  text,
  tone_prompt    text,
  keyword_pack   text[],
  created_at     timestamptz DEFAULT now()
);

