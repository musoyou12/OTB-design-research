/**
 * briefParser.js
 *
 * 브리프 원문 → 구조화된 파싱 객체
 * { industry, intent, keywords, constraints }
 *
 * GPT-4o-mini로 추출. 크롤링 없음.
 */

import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `You are a design research analyst.
Parse the user's design brief and extract structured information.
Return ONLY valid JSON with these fields:
{
  "industry": "string (e.g. fashion, beauty, saas, f&b, lifestyle)",
  "intent": "string (core goal of the project in one sentence)",
  "keywords": ["array of 5-10 key design/UX keywords"],
  "constraints": ["array of constraints or requirements mentioned"]
}`;

/**
 * 구조화된 브리프 객체 → parsed 객체 (GPT 없이 직접 변환)
 * @param {Object} briefObj - { projectName, industry, goal, target, channel, req, comp }
 * @returns {{ industry, intent, keywords, constraints }}
 */
export function parseStructuredBrief(briefObj) {
  const toArr = (v) => Array.isArray(v) ? v : (v ? String(v).split(",").map(s => s.trim()).filter(Boolean) : []);
  const market = briefObj.market || "GLOBAL";
  return {
    industry: toArr(briefObj.industry)[0] || "",
    intent: toArr(briefObj.goal).join(", ") || "",
    keywords: [
      ...toArr(briefObj.industry),
      ...toArr(briefObj.goal),
      ...toArr(briefObj.channel),
      ...toArr(briefObj.target),
    ].filter(Boolean).slice(0, 10),
    constraints: toArr(briefObj.req || briefObj.constraints),
    lang: (briefObj.locale || 'en').startsWith('ko') ? 'ko' : 'en',
    market,
    positioning: briefObj.positioning || "",
  };
}

/**
 * @param {string} rawBrief
 * @returns {Promise<{ industry, intent, keywords, constraints }>}
 */
export async function parseBrief(rawBrief) {
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: rawBrief },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  return JSON.parse(res.choices[0].message.content);
}
