/**
 * description:
 *   GPT Vision 기반 이미지 라벨링 (6축)
 */

import OpenAI from "openai";
import fs from "fs";
import path from "path";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function labelImage(filePath) {
  const prompt = `
  이미지를 아래 5개의 속성으로 JSON 출력:

  - Domain
  - Channel
  - ImageCategory
  - Concept
  - ColorMood
  `;

  const res = await client.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      { role: "user", content: prompt },
      {
        role: "user",
        content: [{ type: "input_image", image_url: `file://${filePath}` }],
      }
    ],
  });

  const json = JSON.parse(res.choices[0].message.content);

  const savePath = path.join("src/outputs/meta", `label-${Date.now()}.json`);
  fs.writeFileSync(savePath, JSON.stringify(json, null, 2));

  return json;
}
