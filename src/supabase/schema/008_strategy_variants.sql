-- MODULE B: 전략 A/B/C
CREATE TABLE IF NOT EXISTS strategy_variants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id         uuid REFERENCES briefs(id) ON DELETE CASCADE,
  variant          text CHECK (variant IN ('A', 'B', 'C')),
  title            text,
  design_direction text,
  ux_reasoning     text,
  explanation      text,
  created_at       timestamptz DEFAULT now()
);


