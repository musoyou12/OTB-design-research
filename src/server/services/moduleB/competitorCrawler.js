/**
 * competitorCrawler.js
 *
 * 경쟁사 URL → Playwright 크롤링 → GPT-4o 분석
 * → mock data와 동일한 구조로 반환
 * {
 *   name, url, scores, strengths, weaknesses, takeaways, pages
 * }
 */

import { chromium } from "playwright";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const TIMEOUT = 15000;
const DEEP_LIMIT = 3;   // Playwright + GPT 딥 분석
const MAX_TOTAL  = 10;  // 링크만 전달하는 나머지 최대 수

// ── 크롤링 ───────────────────────────────────────────────
async function crawlOne(browser, url) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT });

    const raw = await page.evaluate(() => {
      const getText = (sel, limit = 5) =>
        [...document.querySelectorAll(sel)]
          .map(el => el.innerText?.trim())
          .filter(Boolean)
          .slice(0, limit);

      const getMeta = (name) =>
        document.querySelector(`meta[name="${name}"]`)?.content ||
        document.querySelector(`meta[property="og:${name}"]`)?.content || "";

      // 섹션별 구조 추출
      const sections = [...document.querySelectorAll("section, [class*='section'], main > div")]
        .slice(0, 10)
        .map(el => ({
          tag: el.tagName,
          className: el.className?.slice(0, 80),
          text: el.innerText?.slice(0, 300),
        }));

      return {
        title:       document.title || "",
        description: getMeta("description"),
        h1:          getText("h1", 3),
        h2:          getText("h2", 6),
        nav:         getText("nav a, header a", 8),
        cta:         getText("button, [class*='btn'], [class*='cta']", 6),
        sections,
      };
    });

    return { url, ...raw, status: "success" };
  } catch (e) {
    return { url, status: "failed", error: e.message };
  } finally {
    await page.close();
  }
}

// ── GPT 분석 ─────────────────────────────────────────────
async function analyzeWithGPT(crawled, brief) {
  const domain = (() => {
    try { return new URL(crawled.url).hostname.replace("www.", ""); } catch { return crawled.url; }
  })();

  const context = `
URL: ${crawled.url}
Title: ${crawled.title}
Description: ${crawled.description}
H1: ${crawled.h1.join(" / ")}
H2: ${crawled.h2.join(" / ")}
Navigation: ${crawled.nav.join(", ")}
CTA: ${crawled.cta.join(", ")}
Sections:
${crawled.sections.map((s, i) => `[${i + 1}] ${s.text}`).join("\n")}
`;

  const briefContext = brief
    ? `Project Brief — Industry: ${brief.industry}, Goal: ${brief.goal || brief.req}, Target: ${brief.target}`
    : "";

  const prompt = `You are a senior UX analyst. Analyze this competitor website and return ONLY valid JSON.

${briefContext}

Website Data:
${context}

Return this exact structure:
{
  "name": "brand or company name",
  "scores": {
    "fit": <0-10 float, how relevant to brief>,
    "clarity": <0-10 float, UX clarity>,
    "conversion": <0-10 float, conversion optimization>,
    "innovation": <0-10 float, design innovation>
  },
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "takeaways": ["actionable insight 1", "actionable insight 2"],
  "pages": [
    {
      "section": "section name (e.g. Hero, Navigation, Proof Strip)",
      "type": "hero|nav|strip|grid|comparison|social|cta|interactive|mobile",
      "tags": ["tag1", "tag2", "tag3"],
      "annotation": "detailed UX analysis of this section (2-3 sentences in Korean)",
      "insight": "one actionable design insight in Korean"
    }
  ]
}

Analyze 4-6 key sections. Write annotations and insights in Korean. Be specific and actionable.`;

  const res = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const result = JSON.parse(res.choices[0].message.content);
  return { ...result, url: domain };
}

// ── 메인 익스포트 ─────────────────────────────────────────
/**
 * @param {string[]} urls   - 경쟁사 URL 목록
 * @param {Object}   brief  - 브리프 (fit 점수 계산용)
 * @returns {Promise<Array>} - mock data 구조의 경쟁사 분석 결과
 */
export async function crawlCompetitors(urls, brief = {}) {
  if (!urls || urls.length === 0) return [];

  const validUrls = urls.filter(u => u && u.startsWith("http")).slice(0, MAX_TOTAL);
  if (validUrls.length === 0) return [];

  const deepTargets    = validUrls.slice(0, DEEP_LIMIT);
  const shallowTargets = validUrls.slice(DEEP_LIMIT);

  // ── 상위 3개: Playwright 크롤링 + GPT 딥 분석 ──────────
  const browser = await chromium.launch({ headless: true });
  const analyzed = [];

  try {
    const crawled = await Promise.all(deepTargets.map(url => crawlOne(browser, url)));
    const succeeded = crawled.filter(c => c.status === "success");
    console.log(`[CRAWLER] deep: ${succeeded.length}/${deepTargets.length} crawled`);

    for (const c of succeeded) {
      try {
        const result = await analyzeWithGPT(c, brief);
        analyzed.push({ ...result, shallow: false });
        console.log(`[CRAWLER] analyzed: ${result.name}`);
      } catch (e) {
        console.error(`[CRAWLER] GPT analysis failed for ${c.url}: ${e.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  // ── 나머지: URL + 도메인명만 ────────────────────────────
  for (const url of shallowTargets) {
    let domain = url;
    try { domain = new URL(url).hostname.replace("www.", ""); } catch {}
    analyzed.push({
      name:    domain,
      url:     domain,
      fullUrl: url,
      shallow: true,
      scores:  null,
      strengths:  [],
      weaknesses: [],
      takeaways:  [],
      pages:      [],
    });
  }

  return analyzed;
}

/**
 * 전략 생성용 텍스트 요약 (strategyGenerator 컨텍스트용)
 */
export function formatCompetitorContext(analyzed) {
  return analyzed.map((c, i) => {
    if (c.shallow) {
      return `[Competitor ${i + 1}] ${c.name} (${c.fullUrl || c.url}) — URL only, no deep analysis`;
    }
    return `[Competitor ${i + 1}] ${c.name} (${c.url})
Scores — Fit: ${c.scores?.fit}, Clarity: ${c.scores?.clarity}, Conversion: ${c.scores?.conversion}, Innovation: ${c.scores?.innovation}
Strengths: ${c.strengths?.join(", ")}
Weaknesses: ${c.weaknesses?.join(", ")}
Takeaways: ${c.takeaways?.join(", ")}`;
  }).join("\n\n");
}
