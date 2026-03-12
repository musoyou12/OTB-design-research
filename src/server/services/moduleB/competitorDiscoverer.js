/**
 * competitorDiscoverer.js
 *
 * 경쟁사 URL 자동 탐색 — 2단계 방식
 *
 * Step 1: GPT-4o → 브랜드명 목록만 생성 (URL 추측 금지)
 * Step 2: 브랜드명 → 후보 URL 패턴으로 실제 접속 가능 여부 확인
 *
 * 반환: string[] — 접속 확인된 URL 목록 (최대 8개)
 */

import OpenAI from "openai";
import https from "https";
import http from "http";
import { supabase } from "../../../supabase/supabase.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── 트렌드 컨텍스트 조회 ──────────────────────────────────
async function fetchTrendContext(industry) {
  const lines = [];
  try {
    const { data: signals } = await supabase
      .from("trend_signals")
      .select("industry, keyword, interest_avg, summary")
      .or(`industry.eq.${industry},industry.eq.general`)
      .order("collected_at", { ascending: false })
      .limit(6);
    if (signals?.length) {
      lines.push("## Trend Signals");
      signals.forEach(t => lines.push(`[${t.industry}] ${t.keyword} — ${t.summary || ""}`));
    }
  } catch (_) {}
  return lines.join("\n");
}

// ── URL 접속 + 브랜드명 매칭 검증 (GET + title 확인) ────────
function checkUrlWithValidation(url, brandName, timeoutMs = 8000) {
  // 브랜드명에서 의미 있는 영문 단어 추출 (2자 이상)
  const slugWords = brandName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 2);
  // 순수 한글 브랜드명이면 URL 접속만으로 통과
  const noEnglish = slugWords.length === 0;

  return new Promise((resolve) => {
    const mod = url.startsWith("https") ? https : http;
    let done = false;
    const finish = (result) => { if (!done) { done = true; resolve(result); } };

    try {
      const req = mod.request(url, { method: "GET", timeout: timeoutMs }, (res) => {
        if (res.statusCode >= 400) { res.resume(); finish(null); return; }

        let body = "";
        res.on("data", chunk => {
          body += chunk;
          if (body.length > 4000) { req.destroy(); } // title 확인에 충분
        });
        res.on("end", () => {
          const titleMatch = body.match(/<title[^>]*>([^<]{0,200})<\/title>/i);
          const title    = (titleMatch?.[1] || "").toLowerCase();
          const urlLower = url.toLowerCase();
          const nameInUrl   = slugWords.some(w => urlLower.includes(w));
          const nameInTitle = slugWords.some(w => title.includes(w));
          if (noEnglish || nameInUrl || nameInTitle) {
            finish(url);
          } else {
            console.log(`[DISCOVERER] ✗ ${brandName} — title 불일치: "${title.slice(0, 80)}"`);
            finish(null);
          }
        });
        res.on("close", () => finish(null)); // destroy 시 close로 종료
        res.on("error", () => finish(null));
      });
      req.on("error", () => finish(null));
      req.on("timeout", () => { req.destroy(); finish(null); });
      req.end();
    } catch {
      finish(null);
    }
  });
}

// ── 브랜드명 → 후보 URL 생성 ─────────────────────────────
function brandToUrlCandidates(name, market) {
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9가-힣]/g, "");
  const slugHyphen = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const candidates = [
    `https://www.${slug}.com`,
    `https://${slug}.com`,
    `https://www.${slugHyphen}.com`,
  ];
  if (market === "KR") {
    candidates.push(
      `https://www.${slug}.co.kr`,
      `https://${slug}.co.kr`,
    );
  }
  if (market === "JP") candidates.push(`https://www.${slug}.jp`);
  if (market === "EU") candidates.push(`https://www.${slug}.eu`);

  return candidates;
}

// ── Step 1: GPT → 브랜드명 목록 ──────────────────────────
async function discoverBrandNames(parsed, trendContext) {
  const MARKET_LABEL = {
    KR: "South Korea",
    JP: "Japan", CN: "China",
    US: "North America", EU: "Europe", GLOBAL: "Global",
  };
  const marketLabel = MARKET_LABEL[parsed.market] || "Global";

  const prompt = `You are a senior UX design director selecting benchmarking targets for a brand project.
Return ONLY brand names — no URLs, no descriptions.

## Project Brief
- Industry: ${parsed.industry}
- Positioning: ${parsed.positioning || "(not specified)"}
- Target Market: ${marketLabel}
- Goal: ${parsed.intent || ""}
- Target audience: ${parsed.target || ""}
- Keywords: ${parsed.keywords?.join(", ") || ""}

## Trend Context
${trendContext || "(none)"}

## Rules — think like a design director benchmarking for UX quality:
- DIRECT (3): Same industry AND positioning. Actual competitors in the same space.
- DESIGN REFERENCE (3): Best UX execution in the same or closely related industry category. Must be directly relevant to ${parsed.industry} — NOT from unrelated industries.
- WILD CARD (1–2): A brand in a DIFFERENT industry that solved a SPECIFIC UX problem this project also faces (explain the exact problem in the reason field).

Critical constraints:
- DIRECT and DESIGN REFERENCE must be from the ${parsed.industry} industry or a closely adjacent category
- WILD CARD may cross industries only if the reason is very specific (e.g. "loyalty program UX", "complex filtering", "storytelling scroll")
- Return only brands with well-known, globally recognizable websites (.com / .co.kr / .jp)
- NO generic mega-platforms (Coupang, Naver, Amazon, Kakao) unless this IS a platform project
- NO design showcase or portfolio sites
- Prefer brands whose website is the main touchpoint (not app-first)

Return ONLY valid JSON:
{
  "brands": [
    { "name": "Brand Name", "type": "direct|design_reference|wild_card", "reason": "why worth benchmarking for this positioning" }
  ]
}`;

  const res = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.5,
  });

  const result = JSON.parse(res.choices[0].message.content);
  return result.brands || [];
}

// ── Step 2: 브랜드명 → URL 검증 ──────────────────────────
async function verifyBrandUrls(brands, market) {
  const verified = [];

  for (const brand of brands) {
    const candidates = brandToUrlCandidates(brand.name, market);
    let found = null;

    for (const url of candidates) {
      const ok = await checkUrlWithValidation(url, brand.name);
      if (ok) { found = ok; break; }
    }

    if (found) {
      console.log(`[DISCOVERER] ✓ ${brand.name} (${brand.type}) → ${found}`);
      verified.push({ ...brand, url: found });
    } else {
      console.log(`[DISCOVERER] ✗ ${brand.name} — URL 확인 실패`);
    }
  }

  return verified;
}

// ── 메인 익스포트 ─────────────────────────────────────────
/**
 * @param {Array}  topRefs - axisReranker 결과
 * @param {Object} parsed  - briefParser 결과 (industry, positioning, market, ...)
 * @returns {Promise<string[]>} 접속 확인된 URL 목록
 */
export async function discoverCompetitorUrls(topRefs, parsed) {
  const trendContext = await fetchTrendContext(parsed.industry);

  // Step 1: GPT → 브랜드명
  let brands = [];
  try {
    brands = await discoverBrandNames(parsed, trendContext);
    console.log(`[DISCOVERER] GPT 브랜드 후보: ${brands.length}개`);
  } catch (e) {
    console.error("[DISCOVERER] 브랜드 탐색 실패:", e.message);
    return [];
  }

  // Step 2: 브랜드명 → URL 검증
  const verified = await verifyBrandUrls(brands, parsed.market || "GLOBAL");
  console.log(`[DISCOVERER] 검증된 URL: ${verified.length}/${brands.length}`);

  return verified.map(b => b.url).slice(0, 8);
}
