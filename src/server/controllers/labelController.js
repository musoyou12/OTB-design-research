/**
 * description:
 *   GPT Vision 기반 이미지 라벨링 (6축 완성형)
 *   OpenAI 최신 파일 업로드 방식 (file)
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

    {
        "Domain": "",
        "Channel": "",
        "ImageCategory": "",
        "Concept": "",
        "Effect2D": "",
        "ColorMood": ""
    }
  `;

  // 1) 파일 업로드 (이 부분이 핵심)
  const uploaded = await client.files.create({
    file: fs.createReadStream(filePath),
    purpose: "vision",
  });

  // 2) GPT Vision 호출
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: prompt
      },
      {
        role: "user",
        content: [
          {
            type: "file",
            file: uploaded.id    // 🔥 여기가 핵심
          }
        ]
      }
    ]
  });

  // 3) JSON 파싱
  const raw = res.choices[0].message.content.trim();
  const json = JSON.parse(raw);

  // 4) 저장
  const savePath = path.join("src/outputs/meta", `label-${Date.now()}.json`);
  fs.writeFileSync(savePath, JSON.stringify(json, null, 2));

  return json;
}
