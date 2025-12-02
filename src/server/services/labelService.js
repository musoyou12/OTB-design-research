/**
 * description:
 *   GPT Vision 기반 이미지 라벨링 (6축 완성형)
 *   - Domain / Channel / ImageCategory / Concept / Effect2D / ColorMood
 *   - Unknown 허용 → 안정성 증가
 *   - Concept vs Effect2D 구분 문장 추가
 *   - Domain vs Channel 혼동 방지
 */

import OpenAI from "openai";
import fs from "fs";
import path from "path";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function labelImage(filePath) {
    
    const prompt = `
    당신은 브랜드 디자인·UX 분석 전문가입니다.

    아래 이미지를 기반으로 “6가지 속성”을 *정확한 JSON 형식으로만* 출력하세요.
    해설/문장/설명 절대 금지 — 오직 JSON만.

    규칙
    - 값이 불명확하거나 확신이 없으면 "Unknown"을 사용
    - Domain은 산업 카테고리 (Beauty / Fashion / F&B / Tech / Living …)
    - Channel은 페이지/콘텐츠의 종류 (PDP / Landing / SNS Feed / Magazine / Lookbook …)
    - Concept은 분위기·브랜드 톤
    - Effect2D는 시각적 후처리/질감 (Concept과 혼동 금지)
    - ColorMood는 색상 톤

    출력 필드 구조 (절대 변경 금지)

    {
        "Domain": "",
        "Channel": "",
        "ImageCategory": "",
        "Concept": "",
        "Effect2D": "",
        "ColorMood": ""
    }
  `;

  const res = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "user", content: prompt },
      {
        role: "user",
        content: [
          {
            type: "input_image",
            image_url: `file://${filePath}`
          }
        ]
      }
    ]
  });

  const json = JSON.parse(res.choices[0].message.content);

  const savePath = path.join("src/outputs/meta", `label-${Date.now()}.json`);
  fs.writeFileSync(savePath, JSON.stringify(json, null, 2));

  return json;
}
