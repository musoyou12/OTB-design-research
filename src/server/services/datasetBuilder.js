// src/server/services/datasetBuilder.js

export function buildSyntheticMetadata({
  id,
  source = {},
  prompt = {},
  generation = {},
  labels = {},
  synthetic_image
}) {
  return {
    schema_version: "1.0",   // 데이터셋 스키마 버전
    id,

    // 수집 출처 정보
    source: {
      url: source.url || null,
      collected_at: source.collected_at || new Date().toISOString(),
      original_screenshot: source.original_screenshot || null
    },

    // 프롬프트 정보
    prompt: {
      positive: prompt.positive || "",
      negative: prompt.negative || ""
    },

    // synthetic 이미지 생성 정보
    generation: {
      model: generation.model || null,
      seed: generation.seed ?? null,
      sampler: generation.sampler ?? null,
      steps: generation.steps ?? null
    },

    // 라벨링 정보(없어도 기본 구조 유지)
    labels: {
      ui_type: labels.ui_type || null,
      components: labels.components || []
    },

    // synthetic 이미지 경로 or URL
    synthetic_image: synthetic_image || null,

    // 데이터셋 생성 시각
    created_at: new Date().toISOString()
  };
}
