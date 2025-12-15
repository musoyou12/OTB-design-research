/**
 * @file labelService.js
 * @description GPT Vision 기반 단일 이미지 6축 라벨링
 * 
 * @reference
 *   - 이주혁, 김미희 (2022). "웹 크롤링과 전이학습을 활용한 이미지 분류 모델"
 *     대한전기전자학회 논문지, Vol.26, No.4, pp.639-646
 *     DOI: 10.7471/ikeee.2022.26.4.639
 *   - 본 논문의 이미지 분류 체계를 GPT Vision으로 대체 구현
 * 
 * @input  로컬 이미지 파일 경로
 * @output 6축 라벨 JSON (src/outputs/meta/label-*.json)
 */

import OpenAI from "openai";
import fs from "fs";
import path from "path";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================
// 6축 라벨 스키마 (OTB MVP 문서 기준)
// ============================================
export const LABEL_SCHEMA = {
  Domain: ["Beauty", "Fashion", "F&B", "Wellness", "Lifestyle", "Commerce", "SaaS", "AI Tools"],
  Channel: ["PDP", "Landing", "SNS Feed", "Lookbook", "PLP", "Ads"],
  ImageCategory: ["Product", "Model", "Lifestyle", "Abstract", "Texture", "Packshot"],
  Concept: ["Minimal", "Luxury Calm", "Raw Nature", "Witty", "Warm Organic", "Scientific Clinical", "Urban Modern"],
  Effect2D: ["Clean", "Bold", "High Clarity", "Soft Shadow", "Fast", "Typography-driven"],
  ColorMood: ["Warm Natural", "Pastel", "Monotone", "High Contrast"]
};

// ============================================
// 단일 이미지 라벨링
// ============================================
export async function labelImage(filePath) {
  const absolutePath = path.resolve(filePath);
  
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`이미지 파일이 존재하지 않습니다: ${absolutePath}`);
  }

  // 이미지 base64 인코딩
  const imageBuffer = fs.readFileSync(absolutePath);
  const base64Image = imageBuffer.toString("base64");
  const ext = path.extname(absolutePath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";

  const prompt = buildPrompt();

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64Image}` }
          }
        ]
      }
    ],
    max_tokens: 500
  });

  const raw = res.choices[0].message.content.trim();
  const labels = parseResponse(raw);

  const result = {
    filePath: absolutePath,
    labels,
    labeledAt: new Date().toISOString()
  };
  // 저장
  const savePath = path.join("src/outputs/meta", `label-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(savePath), { recursive: true });
  fs.writeFileSync(savePath, JSON.stringify(result, null, 2));

  // 🔥 savePath 반드시 포함해서 반환
  return {
    ...result,
    savePath
  };

}


// ============================================
// 프롬프트 생성
// ============================================
function buildPrompt() {
  return `
이 이미지를 브랜딩/UX 관점에서 분석하고, 아래 6축으로 분류해주세요.
JSON 형식으로만 응답하세요.

가능한 값:
- Domain: ${LABEL_SCHEMA.Domain.join(", ")}
- Channel: ${LABEL_SCHEMA.Channel.join(", ")}
- ImageCategory: ${LABEL_SCHEMA.ImageCategory.join(", ")}
- Concept: ${LABEL_SCHEMA.Concept.join(", ")}
- Effect2D: ${LABEL_SCHEMA.Effect2D.join(", ")}
- ColorMood: ${LABEL_SCHEMA.ColorMood.join(", ")}

응답 형식:
{
  "Domain": "",
  "Channel": "",
  "ImageCategory": "",
  "Concept": "",
  "Effect2D": "",
  "ColorMood": ""
}
  `.trim();
}

// ============================================
// 응답 파싱
// ============================================
function parseResponse(raw) {
  let jsonText = raw;
  if (raw.startsWith("```")) {
    jsonText = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  }
  return JSON.parse(jsonText);
}