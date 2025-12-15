/**
 * competitor 자동 추천 서비스
 *
 * 역할:
 *  - brief(프로젝트 설명)를 입력받아서
 *    도메인/키워드 기반으로 경쟁사를 추천해주는 기능
 *
 * NOTE:
 *  - 간단한 버전: OpenAI로 설명→경쟁사 추천
 *  - 이후 고도화: 검색 기반 / 벤치마킹 데이터셋 기반 확장 가능
 */

import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function findCompetitorsByBrief(brief) {
  const prompt = `
브리프를 기반으로 경쟁사를 3~5개 추천해줘.
형식은 JSON 배열만 출력:

[
  { "name": "", "url": "", "reason": "" },
  { "name": "", "url": "", "reason": "" }
]

브리프:
${brief}
  `;

  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  let raw = resp.choices[0].message.content.trim();

  // 코드블럭 제거
  if (raw.startsWith("```")) {
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();
  }

  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("❌ competitor JSON parsing error:", raw);
    return [];
  }
}
