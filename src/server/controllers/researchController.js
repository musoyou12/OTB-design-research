import OpenAI from "openai";
import fs from "fs";
import path from "path";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------------- 1차 패킷 ---------------------- */
export async function generateResearchV1(brief) {
  const prompt = `
    당신은 Senior UX Researcher입니다.
    아래 브리프를 기반으로 '1차 리서치 패킷(Research V1)'을 생성하세요.

    반드시 아래 JSON 스키마와 동일한 형태로 출력하세요.
    절대로 필드명, 구조, 타입을 바꾸지 마세요.
    절대로 문자열 배열 competitors를 만들지 마세요.
    반드시 객체 배열 competitors만 출력하세요.
    절대로 설명 문장 넣지 말고 JSON만 출력하세요.

    ### 출력 JSON 스키마
    {
      "projectName": "",
      "domainCandidates": [],
      "channelCandidates": [],
      "competitors": [
        {
          "name": "",
          "url": "",
          "reason": ""
        }
      ],
      "uxKeywords": [],
      "iaHypothesis": {
        "globalStructure": [],
        "primaryFlows": [],
        "keyComponents": []
      }
    }

    ### 브리프:
    ${JSON.stringify(brief, null, 2)}

    위 스키마의 모든 필드를 실제 브리프에 맞춰 채워서
    JSON만 출력하세요.
    `;
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  let raw = res.choices[0].message.content;

  // 코드블록 제거
  raw = raw.replace(/```json|```/g, "").trim();

  // 파싱
  const output = JSON.parse(raw);

  const savePath = path.join("src/outputs/packets", `v1-${Date.now()}.json`);
  fs.writeFileSync(savePath, JSON.stringify(output, null, 2));

  return output;
}

/* ---------------------- 2차 패킷 ---------------------- */
export async function generateResearchV2(v1, text) {
  const prompt = `
[1차 패킷]
${JSON.stringify(v1, null, 2)}

[텍스트]
${text.cleaned_text?.slice(0, 5000)}

아래 구조로 2차 UX 패킷(JSON) 생성:
{
  "competitorPatterns": [],
  "uxStructure": [],
  "iaStructure": [],
  "featureAnalysis": [],
  "insights": []
}
`;

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  const output = JSON.parse(res.choices[0].message.content);

  const savePath = path.join("src/outputs/packets", `v2-${Date.now()}.json`);
  fs.writeFileSync(savePath, JSON.stringify(output, null, 2));

  return output;
}
