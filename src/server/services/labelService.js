/**
 * GPT Vision 파일 업로드 방식 (정상 작동 버전)
 */

import OpenAI from "openai";
import fs from "fs";
import path from "path";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function labelImage(filePath) {
  // 1) 절대경로 변환
  const absolutePath = path.resolve(filePath);
  
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`❌ 이미지 파일이 존재하지 않습니다: ${absolutePath}`);
  }

  console.log("📂 분석할 이미지:", absolutePath);

  // 2) 이미지를 base64로 인코딩
  const imageBuffer = fs.readFileSync(absolutePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = 'image/png'; // 또는 'image/jpeg'
  
  const prompt = `
    아래 이미지를 6가지 속성으로 JSON만 출력:
    {
      "Domain": "",
      "Channel": "",
      "ImageCategory": "",
      "Concept": "",
      "Effect2D": "",
      "ColorMood": ""
    }
  `;

  // 3) Vision 분석 (base64 방식)
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini", // 🔥 모델명 확인 (gpt-4.1-mini는 없어요)
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`
            }
          }
        ]
      }
    ],
    max_tokens: 500
  });

  const raw = res.choices[0].message.content.trim();
  console.log("📝 GPT 응답:", raw);
  
  // 4) JSON 파싱 (마크다운 코드블록 제거)
  let jsonText = raw;
  if (raw.startsWith('```')) {
    jsonText = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  }
  
  const json = JSON.parse(jsonText);

  // 5) 저장
  const savePath = path.join("src/outputs/meta", `label-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(savePath), { recursive: true });
  fs.writeFileSync(savePath, JSON.stringify(json, null, 2));

  console.log("✅ 저장 완료:", savePath);
  return json;
}