/**
 * description:
 *   Playwright 기반 텍스트 크롤러
 *   - HTML 저장 + 텍스트 추출
 *   - h1/h2/h3, p, fullText
 */

import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";

export async function crawlText(url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { timeout: 60000, waitUntil: "domcontentloaded" });

  // 1) HTML 원본 저장
  const html = await page.content();
  const htmlPath = path.join("src/outputs/text", `page-${Date.now()}.html`);
  await fs.writeFile(htmlPath, html, "utf8");

  // 2) 텍스트 추출
  const title = await page.title();
  const fullText = await page.evaluate(() => document.body.innerText);

  const headers = await page.$$eval("h1, h2, h3", els =>
    els.map(el => el.innerText.trim())
  );

  const paragraphs = await page.$$eval("p", els =>
    els.map(el => el.innerText.trim())
  );

  const result = {
    url,
    title,
    headers,
    paragraphs,
    fullText,
    htmlPath,       // ⭐ cleanHtml()가 이걸 사용해야 함
    crawledAt: new Date().toISOString(),
  };

  // 3) 텍스트 JSON 저장
  const filePath = path.join("src/outputs/text", `text-${Date.now()}.json`);
  await fs.writeFile(filePath, JSON.stringify(result, null, 2));

  await browser.close();

  return result;
}
