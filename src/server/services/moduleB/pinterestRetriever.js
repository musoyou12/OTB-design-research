/**
 * pinterestRetriever.js
 *
 * Playwright XHR 인터셉션 → Pinterest 핀 이미지 수집
 * BaseSearchResource API 응답 파싱 (인증 불필요)
 */

import { chromium } from "playwright";

const TIMEOUT   = 18000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function extractPins(data) {
  try {
    const results = data?.resource_response?.data?.results;
    if (!Array.isArray(results)) return [];
    return results.flatMap(p => {
      const images = p?.images || {};
      const imgUrl =
        images["736x"]?.url || images.orig?.url || images["474x"]?.url || "";
      if (!imgUrl.includes("pinimg.com")) return [];
      return [{
        id:            String(p.id || ""),
        title:         (p.title || p.grid_title || "").trim().slice(0, 120),
        description:   (p.description || "").trim().slice(0, 200),
        link:          p.link || `https://www.pinterest.com/pin/${p.id}/`,
        image_url:     imgUrl,
        dominant_color: p.dominant_color || "",
      }];
    });
  } catch { return []; }
}

/**
 * @param {string[]} keywords  - 브리프 키워드 배열
 * @param {string}   market    - "KR" | "JP" | "GLOBAL" 등
 * @param {number}   limit     - 최대 수집 개수 (기본 9)
 * @returns {Promise<Array>}
 */
export async function retrievePinterestImages(keywords = [], market = "GLOBAL", limit = 9) {
  if (!keywords.length) return [];

  const query = keywords.slice(0, 4).join(" ");
  const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}&rs=typed`;

  const collected = [];
  const seenIds   = new Set();

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx  = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    page.on("response", async (response) => {
      if (!response.url().includes("/resource/")) return;
      try {
        const body = await response.body();
        for (const pin of extractPins(JSON.parse(body.toString()))) {
          if (!seenIds.has(pin.id)) {
            seenIds.add(pin.id);
            collected.push(pin);
          }
        }
      } catch { /* ignore parse errors */ }
    });

    await page.goto(searchUrl, { timeout: TIMEOUT, waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    let scrolls = 0;
    while (collected.length < limit && scrolls < 3) {
      await page.evaluate("window.scrollBy(0, window.innerHeight * 2)");
      await page.waitForTimeout(1200);
      scrolls++;
    }

    console.log(`[PINTEREST] "${query}" → ${collected.length}개 수집`);
  } catch (e) {
    console.error(`[PINTEREST] 수집 실패: ${e.message}`);
  } finally {
    await browser.close();
  }

  return collected.slice(0, limit);
}
