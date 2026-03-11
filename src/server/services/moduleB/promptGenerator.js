/**
 * promptGenerator.js
 *
 * 전략 A/B/C → 각각의 프롬프트 팩 생성
 * { visual_prompt, layout_prompt, tone_prompt, keyword_pack }
 *
 * GPT-4o-mini 사용. 크롤링 없음.
 */

import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = (lang) => `You are a design prompt engineer.
Given a design strategy, generate a prompt pack for designers.
${lang === 'ko' ? '모든 응답은 반드시 한국어로 작성하세요.' : 'Write all responses in English.'}
Return ONLY valid JSON:
{
  "visual_prompt": "string (visual style direction for designers/AI tools)",
  "layout_prompt": "string (layout and composition direction)",
  "tone_prompt": "string (copy tone, voice, and messaging direction)",
  "keyword_pack": ["5-8 concise design keywords"]
}`;

const VARIANT_POSTURE = {
  A: "Trend-aligned — safe, data-backed, follows domain rules strictly",
  B: "Differentiated — counter-competitor, partial trend twist, brand identity led",
  C: "Experimental — minority rising patterns, challenges norms, high risk/reward",
};

/**
 * 단일 전략 → 프롬프트 팩
 */
async function generatePromptForStrategy(variant, strategy, parsed) {
  const userMsg = `Strategy ${variant} (${VARIANT_POSTURE[variant] || ""}): ${strategy.title}
Direction: ${strategy.design_direction}
UX Reasoning: ${strategy.ux_reasoning}
Explanation: ${strategy.explanation}
Industry: ${parsed.industry}
Keywords: ${parsed.keywords?.join(", ")}

Generate the prompt pack aligned with this posture.`;

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM(parsed.lang || 'en') },
      { role: "user", content: userMsg },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  return JSON.parse(res.choices[0].message.content);
}

/**
 * @param {Object} strategies  - { A, B, C }
 * @param {Object} parsed      - briefParser 결과
 * @returns {Promise<Object>}  - { A: { visual_prompt, layout_prompt, tone_prompt, keyword_pack }, B, C }
 */
export async function generatePrompts(strategies, parsed) {
  const [A, B, C] = await Promise.all([
    generatePromptForStrategy("A", strategies.A, parsed),
    generatePromptForStrategy("B", strategies.B, parsed),
    generatePromptForStrategy("C", strategies.C, parsed),
  ]);

  return { A, B, C };
}
