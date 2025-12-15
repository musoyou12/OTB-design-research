// src/server/services/promptBuilder.js

/**
 * description:
 *   2차 리서치 패킷(JSON) → ComfyUI 이미지 프롬프트 생성
 *
 * input:
 *   researchV2: 2차 패킷 객체
 *
 * output:
 *   { prompt, savePath }
 *   - prompt: { positive, negative, meta }
 *   - savePath: 프롬프트 JSON이 저장된 경로
 */

import fs from "fs";
import path from "path";

export function buildImagePrompt(researchV2) {
  // 1) 2차 패킷에서 주요 필드 뽑기 (키 이름은 나중에 맞춰가면 됨)
  const domain =
    researchV2.domain ||
    researchV2.domainSummary ||
    researchV2?.meta?.domain;

  const channel =
    researchV2.channel ||
    researchV2.mainChannel ||
    researchV2?.meta?.channel;

  const concept =
    researchV2?.visual?.concept
    researchV2?.toneStyle?.concept;

  const colorMood =
    researchV2?.visual?.colorMood ||
    researchV2.colorMood;

  const tone =
    researchV2.brandTone ||
    researchV2?.toneStyle?.label;

  // 2) ComfyUI text prompt 구성
  const positive = [
    `Web / app UI hero visual for a ${domain} ${channel}`,
    `Concept: ${concept}`,
    `Color mood: ${colorMood}`,
    `Brand tone: ${tone}`,
    "high resolution, detailed, clean composition, dribbble style shot, professional art direction"
  ].join(", ");

  const negative = [
    "low quality",
    "blurry",
    "noisy",
    "overexposed",
    "distorted text",
    "watermark",
    "logo artifacts",
    "extra limbs",
    "deformed hands",
    "jpeg artifacts"
  ].join(", ");

  const prompt = {
    positive,
    negative,
    meta: {
      domain,
      channel,
      concept,
      colorMood,
      tone,
      source: "research_v2"
    }
  };

  // 3) 프롬프트 JSON 저장 (데이터셋/재현용)
  const savePath = path.join(
    "src/outputs/packets",
    `imagePrompt-${Date.now()}.json`
  );
  fs.writeFileSync(savePath, JSON.stringify(prompt, null, 2), "utf8");

  return { prompt, savePath };
}
