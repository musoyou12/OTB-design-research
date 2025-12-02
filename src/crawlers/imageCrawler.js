/**
 * description:
 *   URL 기반 이미지 스크린샷 + 원본 이미지 메타 크롤러
 *   - 웹페이지 fullPage 스크린샷
 *   - 페이지 내 이미지 src/alt 수집
 *   - 출처/저작권 메타 포함
 *   - AI 라벨링 및 ComfyUI 재생성용 데이터 확보
 *
 * output:
 *   - /src/outputs/images/screenshot-*.png
 *   - /src/outputs/meta/meta-*.json
 */

import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";

export async function crawlImage(url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const timestamp = Date.now();
  const outputDir = "src/outputs/images";
  await fs.mkdir(outputDir, { recursive: true });

  await page.goto(url, { waitUntil: "networkidle" });

  // 1) 스크린샷 저장
  const screenshotPath = path.join(
    "src/outputs/images",
    `screenshot-${Date.now()}.png`
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });

  // 2) 페이지 내 원본 이미지 목록 수집
  const images = await page.$$eval("img", (els) =>
    els.map((img) => ({
      src: img.src,
      alt: img.alt || null,
      width: img.width,
      height: img.height,
    }))
  );

  // 3) 헤더 구조 (AI 분석에 중요)
  const headers = await page.$$eval("h1, h2, h3", (els) =>
    els.map((h) => h.innerText.trim())
  );

  // 4) 메타데이터 구성
  const meta = {
    url,
    title: await page.title(),
    screenshotPath,
    capturedAt: new Date().toISOString(),
    copyright: {
      source: url,
      usage: "For UX pattern analysis and research only",
      note: "Not used for commercial redistribution",
    },
    images,     // 원본 이미지 전체 목록
    headers,    // 문맥 정보
  };

  // 5) 저장
  const metaPath = path.join(
    "src/outputs/meta",
    `meta-${Date.now()}.json`
  );

  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));

  await browser.close();

  return meta;
}
