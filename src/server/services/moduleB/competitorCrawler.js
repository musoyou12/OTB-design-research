/**
 * competitorCrawler.js
 *
 * 경쟁사 URL → Playwright 크롤링 → GPT-4o 분석
 *
 * 크롤링 추출 항목:
 *   - 텍스트 구조 (h1/h2/nav/cta)
 *   - 레이아웃 신호 (sticky, grid/flex, max-width, font)
 *   - 색상 (hero/header/CTA 배경·텍스트색)
 *   - 섹션별 구조 + 스크린샷 (base64)
 *   - 인터랙션 힌트 (애니메이션, 스크롤 이벤트)
 */

import { chromium } from "playwright";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const TIMEOUT  = 20000;
const DEEP_LIMIT = 3;
const MAX_TOTAL  = 10;

// ── 크롤링 ────────────────────────────────────────────────
async function crawlOne(browser, url) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: TIMEOUT });
    await page.waitForTimeout(1200); // JS 렌더링 대기

    // ── 전체 뷰포트 스크린샷 (base64) ──
    const screenshotBuf = await page.screenshot({ type: "jpeg", quality: 60, fullPage: false });
    const screenshotB64 = screenshotBuf.toString("base64");

    const raw = await page.evaluate(() => {
      const getText = (sel, limit = 6) =>
        [...document.querySelectorAll(sel)]
          .map(el => el.innerText?.trim())
          .filter(Boolean).slice(0, limit);

      const getMeta = (name) =>
        document.querySelector(`meta[name="${name}"]`)?.content ||
        document.querySelector(`meta[property="og:${name}"]`)?.content || "";

      const getStyle = (el, prop) => {
        try { return window.getComputedStyle(el).getPropertyValue(prop) || ""; }
        catch { return ""; }
      };

      // ── 색상 추출 ──
      const body    = document.body;
      const header  = document.querySelector("header, nav, [class*='header'], [class*='nav']");
      const heroBg  = document.querySelector("section, [class*='hero'], main > div");
      const ctaBtn  = document.querySelector("[class*='btn'], [class*='cta'], button[class*='primary']");

      const colors = {
        bodyBg:      getStyle(body, "background-color"),
        bodyText:    getStyle(body, "color"),
        headerBg:    header   ? getStyle(header,  "background-color") : "",
        heroBg:      heroBg   ? getStyle(heroBg,  "background-color") : "",
        ctaBg:       ctaBtn   ? getStyle(ctaBtn,  "background-color") : "",
        ctaText:     ctaBtn   ? getStyle(ctaBtn,  "color") : "",
      };

      // ── 폰트 ──
      const fonts = [...new Set(
        [...document.querySelectorAll("h1,h2,p,button")]
          .map(el => getStyle(el, "font-family").split(",")[0].replace(/['"]/g,"").trim())
          .filter(Boolean)
      )].slice(0, 4);

      // ── 레이아웃 신호 ──
      const mainEl   = document.querySelector("main, [class*='main'], [class*='container']");
      const isSticky = !!document.querySelector("[style*='sticky'], [class*='sticky'], [class*='fixed']");
      const maxWidth = mainEl ? getStyle(mainEl, "max-width") : "";
      const hasGrid  = !!document.querySelector("[class*='grid'], [style*='grid']");
      const hasFlex  = !!document.querySelector("[class*='flex'], [style*='flex']");

      // ── 인터랙션 힌트 ──
      const hasAnimation = !!document.querySelector("[class*='anim'], [class*='motion'], [data-aos]");
      const hasParallax  = !!document.querySelector("[class*='parallax'], [data-parallax]");
      const hasVideoHero = !!document.querySelector("video, [class*='video-hero']");
      const hasChatWidget= !!document.querySelector("[class*='chat'], [id*='chat'], [class*='intercom']");

      // ── 섹션별 구조 ──
      const sections = [...document.querySelectorAll(
        "section, [class*='section'], [class*='block'], main > div, article > div"
      )].slice(0, 12).map(el => ({
        className: el.className?.slice(0, 100),
        text:      el.innerText?.slice(0, 400),
        hasImg:    el.querySelectorAll("img").length > 0,
        hasVideo:  el.querySelectorAll("video").length > 0,
        hasCta:    el.querySelectorAll("button, a[class*='btn']").length > 0,
      }));

      return {
        title:       document.title || "",
        description: getMeta("description"),
        ogImage:     getMeta("image"),
        h1:          getText("h1", 3),
        h2:          getText("h2", 8),
        nav:         getText("nav a, header a", 10),
        cta:         getText("button, [class*='btn'], [class*='cta']", 8),
        colors, fonts,
        layout: { isSticky, maxWidth, hasGrid, hasFlex },
        interaction: { hasAnimation, hasParallax, hasVideoHero, hasChatWidget },
        sections,
      };
    });

    return { url, ...raw, screenshot: screenshotB64, status: "success" };
  } catch (e) {
    return { url, status: "failed", error: e.message };
  } finally {
    await page.close();
  }
}

// ── GPT 분석 ──────────────────────────────────────────────
async function analyzeWithGPT(crawled, brief) {
  const domain = (() => {
    try { return new URL(crawled.url).hostname.replace("www.", ""); }
    catch { return crawled.url; }
  })();

  const briefCtx = brief ? `
## Our Project Brief (benchmarking context)
- Industry: ${brief.industry || ""}
- Positioning: ${brief.positioning || "(not specified)"}
- Target Market: ${brief.market || "GLOBAL"}
- Goal: ${brief.intent || brief.goal || ""}
- Target audience: ${brief.target || ""}
- Keywords: ${brief.keywords?.join(", ") || ""}
` : "";

  const layoutCtx = `
## Layout & Design Signals
- Fonts in use: ${crawled.fonts?.join(", ") || "unknown"}
- Colors — Body: ${crawled.colors?.bodyBg} / ${crawled.colors?.bodyText}, Header: ${crawled.colors?.headerBg}, CTA: ${crawled.colors?.ctaBg} / ${crawled.colors?.ctaText}
- Layout: sticky=${crawled.layout?.isSticky}, grid=${crawled.layout?.hasGrid}, flex=${crawled.layout?.hasFlex}, maxWidth=${crawled.layout?.maxWidth}
- Interaction: animation=${crawled.interaction?.hasAnimation}, parallax=${crawled.interaction?.hasParallax}, videoHero=${crawled.interaction?.hasVideoHero}
`;

  const structureCtx = `
## Page Structure
Title: ${crawled.title}
Description: ${crawled.description}
H1: ${crawled.h1?.join(" / ")}
H2: ${crawled.h2?.join(" / ")}
Navigation: ${crawled.nav?.join(" | ")}
CTA buttons: ${crawled.cta?.join(" | ")}

Sections (${crawled.sections?.length} detected):
${crawled.sections?.map((s, i) =>
  `[${i+1}] ${s.className?.split(" ").slice(0,3).join(".")} | img:${s.hasImg} cta:${s.hasCta} | ${s.text?.slice(0,300)}`
).join("\n")}
`;

  const prompt = `You are a senior UX design director conducting competitive benchmarking.
Analyze this competitor website with the lens of our project brief — what can we specifically learn or steal for our positioning?
${briefCtx}
${layoutCtx}
${structureCtx}

Return ONLY valid JSON with this exact structure:
{
  "name": "brand name",
  "positioning_read": "1 sentence: what positioning/persona this brand communicates visually",
  "scores": {
    "fit": <0-10, relevance to our brief positioning>,
    "clarity": <0-10, UX clarity and hierarchy>,
    "conversion": <0-10, conversion optimization strength>,
    "innovation": <0-10, design innovation vs industry norm>
  },
  "strengths": ["specific UX/design strength relevant to our brief", "..."],
  "weaknesses": ["specific weakness we can exploit or avoid", "..."],
  "takeaways": ["concrete, specific design decision we should steal or invert", "..."],
  "pages": [
    {
      "section": "section name",
      "type": "hero|nav|strip|grid|comparison|social|cta|interactive|mobile",
      "tags": ["design pattern tag"],
      "annotation": "구체적인 UX 분석 — 레이아웃, 색상, 인터랙션, 카피 전략 포함 (2-3문장)",
      "insight": "우리 브리프 포지셔닝에서 이 섹션을 어떻게 활용/역전할지 (1문장)"
    }
  ]
}

- Analyze 5-7 key sections
- insights must be specific to OUR positioning, not generic
- Write annotations and insights in Korean
- Be specific: mention actual colors, fonts, layout patterns observed`;

  // GPT-4o Vision으로 스크린샷도 함께 전달
  const messages = crawled.screenshot
    ? [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${crawled.screenshot}`, detail: "high" } }
        ]
      }]
    : [{ role: "user", content: prompt }];

  const res = await client.chat.completions.create({
    model: "gpt-4o",
    messages,
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 2000,
  });

  const result = JSON.parse(res.choices[0].message.content);
  return {
    ...result,
    url: domain,
    screenshot: crawled.screenshot ? `data:image/jpeg;base64,${crawled.screenshot}` : null,
  };
}

// ── 메인 익스포트 ─────────────────────────────────────────
export async function crawlCompetitors(urls, brief = {}) {
  if (!urls || urls.length === 0) return [];

  const validUrls = urls.filter(u => u && u.startsWith("http")).slice(0, MAX_TOTAL);
  if (validUrls.length === 0) return [];

  const deepTargets    = validUrls.slice(0, DEEP_LIMIT);
  const shallowTargets = validUrls.slice(DEEP_LIMIT);

  const browser = await chromium.launch({ headless: true });
  const analyzed = [];

  try {
    const crawled = await Promise.all(deepTargets.map(url => crawlOne(browser, url)));
    const succeeded = crawled.filter(c => c.status === "success");
    console.log(`[CRAWLER] deep: ${succeeded.length}/${deepTargets.length} crawled`);

    // GPT 분석 병렬 실행
    const results = await Promise.allSettled(succeeded.map(c => analyzeWithGPT(c, brief)));
    for (const r of results) {
      if (r.status === "fulfilled") {
        analyzed.push({ ...r.value, shallow: false });
        console.log(`[CRAWLER] ✓ analyzed: ${r.value.name} (fit: ${r.value.scores?.fit})`);
      } else {
        console.error(`[CRAWLER] GPT failed: ${r.reason?.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  // 나머지: URL + 도메인명만
  for (const url of shallowTargets) {
    let domain = url;
    try { domain = new URL(url).hostname.replace("www.", ""); } catch {}
    analyzed.push({
      name: domain, url: domain, fullUrl: url,
      shallow: true, scores: null,
      strengths: [], weaknesses: [], takeaways: [], pages: [],
    });
  }

  return analyzed;
}

export function formatCompetitorContext(analyzed) {
  return analyzed.map((c, i) => {
    if (c.shallow) return `[Competitor ${i+1}] ${c.name} (${c.fullUrl || c.url}) — URL only`;
    return `[Competitor ${i+1}] ${c.name} (${c.url})
Positioning: ${c.positioning_read || ""}
Scores — Fit: ${c.scores?.fit}, Clarity: ${c.scores?.clarity}, Conversion: ${c.scores?.conversion}, Innovation: ${c.scores?.innovation}
Strengths: ${c.strengths?.join(" / ")}
Weaknesses: ${c.weaknesses?.join(" / ")}
Takeaways: ${c.takeaways?.join(" / ")}`;
  }).join("\n\n");
}
