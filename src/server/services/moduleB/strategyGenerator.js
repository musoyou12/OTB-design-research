/**
 * strategyGenerator.js
 *
 * 3-레이어 아키텍처 기반 전략 A/B/C 생성
 *
 * Layer 1 — Brief (Anchor)   : 브리프 파싱 결과 + 레퍼런스 + UX 근거
 * Layer 2 — Domain Rules     : 산업별 설계 철학 (domainRules.js)
 * Layer 3 — Trend Context    : DB에서 조회한 트렌드 신호 (trendContextRetriever.js)
 *
 * 시안 방향:
 *   A: Trend-aligned   — 현재 트렌드와 가장 강하게 맞는 안전한 최적해
 *   B: Differentiated  — 경쟁사와 명확히 다른 차별화 전략
 *   C: Experimental    — 아직 소수지만 상승 중인 미래 시그널
 */

import OpenAI from "openai";
import { formatDomainRules } from "./domainRules.js";
import { getTrendContext } from "./trendContextRetriever.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = (lang) => `You are a senior UX strategist and design director specializing in brand-aligned digital experience.

You operate on a 3-layer framework:
1. BRIEF (Anchor)       — the client's goals, target, constraints, and retrieved design references
2. DOMAIN RULES (Rules) — industry-specific design philosophy: what to boost, penalize, and mandate
3. TREND CONTEXT (Context) — live signals from Google Trends (INTENT) and Behance/Dribbble (HOW)

Generate exactly 3 strategy options with these distinct postures:

OPTION A — Trend-aligned (안전한 최적해)
  • Aligns most strongly with current trend signals
  • Grounded in the majority of retrieved references
  • Follows domain rules strictly
  • Lowest risk, highest data support

OPTION B — Differentiated (차별화 전략)
  • Clearly diverges from competitor patterns
  • Takes only partial cues from trends, then twists them
  • Leverages brand identity as the primary differentiator
  • Medium risk, strong strategic logic

OPTION C — Experimental (미래 시그널)
  • Built on minority-but-rising patterns in trend data
  • Challenges industry norms — uses penalized patterns intentionally with justification
  • High risk, high potential impact
  • Forward-looking, not yet mainstream

${lang === 'ko' ? '모든 응답은 반드시 한국어로 작성하세요.' : 'Write all responses in English.'}

Return ONLY valid JSON:
{
  "A": {
    "title": "string (concept name, max 6 words)",
    "design_direction": "string (3-4 sentences describing visual/layout direction)",
    "ux_reasoning": "string (why this UX approach works for the target user)",
    "explanation": "string (how trend signals and references support this choice)"
  },
  "B": {
    "title": "string",
    "design_direction": "string",
    "ux_reasoning": "string",
    "explanation": "string (which competitor patterns this avoids and why)"
  },
  "C": {
    "title": "string",
    "design_direction": "string",
    "ux_reasoning": "string",
    "explanation": "string (which rising signals this bets on and the risk/reward)"
  }
}`;

function buildUserPrompt(parsed, topRefs, uxEvidence, domainRulesText, trendContext, competitorContext) {
  const refsText = topRefs
    .slice(0, 8)
    .map(
      (r, i) =>
        `[Ref ${i + 1}] ${r.title} (${r.industry || "general"}) — score: ${r.compositeScore?.toFixed(3)}\n${r.chunk_text?.slice(0, 200)}`
    )
    .join("\n\n");

  const evidenceText = uxEvidence
    .map((e) => `[Evidence] ${e.title}\n${e.content}`)
    .join("\n\n");

  return `## Layer 1 — BRIEF
Industry: ${parsed.industry}
Intent: ${parsed.intent}
Keywords: ${parsed.keywords?.join(", ")}
Constraints: ${parsed.constraints?.join(", ")}

## Retrieved References (RAG)
${refsText || "No references available yet."}

## UX Evidence
${evidenceText || "No UX evidence available yet."}

## Layer 2 — DOMAIN RULES
${domainRulesText}

## Layer 3 — TREND CONTEXT
${trendContext}

## Competitor Landscape
${competitorContext || "No competitor data available."}

---
Generate strategies A (Trend-aligned), B (Differentiated), C (Experimental) as instructed.
${parsed.lang === 'ko' ? '모든 응답은 반드시 한국어로 작성하세요.' : ''}`;
}

/**
 * @param {Object} parsed           - briefParser 결과
 * @param {Array}  topRefs          - axisReranker 결과 (TOP 10)
 * @param {Array}  uxEvidence       - uxEvidenceRetriever 결과
 * @param {string} competitorContext - formatCompetitorContext 결과
 * @returns {Promise<Object>}        - { A, B, C }
 */
export async function generateStrategies(parsed, topRefs, uxEvidence, competitorContext = "") {
  const lang = parsed.lang || "en";

  // Layer 2 & 3 — 병렬 조회
  const [domainRulesText, trendContext] = await Promise.all([
    Promise.resolve(formatDomainRules(parsed.industry)),
    getTrendContext(parsed.industry),
  ]);

  const res = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM(lang) },
      {
        role: "user",
        content: buildUserPrompt(parsed, topRefs, uxEvidence, domainRulesText, trendContext, competitorContext),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.75,
  });

  return JSON.parse(res.choices[0].message.content);
}
