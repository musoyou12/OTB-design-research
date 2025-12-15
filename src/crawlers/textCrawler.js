/**
 * description:
 *   Playwright 기반 Research 전용 텍스트 크롤러
 *   - HTML 저장
 *   - h태그/p태그 + 버튼/링크/aria-label 등 UI 텍스트 수집
 *   - NLP-friendly 전처리 포함
 */

import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";

export async function crawlText(url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { timeout: 60000, waitUntil: "domcontentloaded" });

  // ----------------------------------------
  // 1) HTML 원본 저장
  // ----------------------------------------
  const html = await page.content();
  const htmlPath = path.join("src/outputs/text", `page-${Date.now()}.html`);
  await fs.writeFile(htmlPath, html, "utf8");

  // ----------------------------------------
  // 2) 텍스트 추출
  // ----------------------------------------
  const title = await page.title();
  const fullText = await page.evaluate(() => document.body.innerText);

  const headers = await page.$$eval("h1, h2, h3", els =>
    els.map(el => el.innerText.trim()).filter(Boolean)
  );

  const paragraphs = await page.$$eval("p", els =>
    els.map(el => el.innerText.trim()).filter(Boolean)
  );

  // ----------------------------------------
  // 3) UI 요소 텍스트 추가 추출 ⭐ (UX 분석용)
  // ----------------------------------------
  const uiTexts = await page.evaluate(() => {
    const selectors = [
      "button",
      "a",
      "[role='button']",
      "[aria-label]",
      "input::placeholder",
    ];

    let values = [];

    document.querySelectorAll(selectors.join(", ")).forEach(el => {
      const text = el.innerText || el.getAttribute("aria-label") || "";
      if (text.trim().length > 0) {
        values.push(text.trim());
      }
    });

    return values;
  });

  // ----------------------------------------
  // 4) 메타데이터
  // ----------------------------------------
  const meta = {
    domain: new URL(url).hostname,
    length: fullText.length,
    headerCount: headers.length,
    paragraphCount: paragraphs.length,
    uiTextCount: uiTexts.length,
  };

  // ----------------------------------------
  // 5) 구조화된 결과
  // ----------------------------------------
  const result = {
    url,
    title,
    meta,
    headers,
    paragraphs,
    uiTexts,
    fullText,
    htmlPath,
    crawledAt: new Date().toISOString(),
  };

  // ----------------------------------------
  // 6) JSON 저장
  // ----------------------------------------
  const jsonPath = path.join(
    "src/outputs/text",
    `text-${Date.now()}.json`
  );

  await fs.writeFile(jsonPath, JSON.stringify(result, null, 2));

  await browser.close();

  return result;
}
