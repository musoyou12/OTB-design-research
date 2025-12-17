/**
 * description:
 *   URL 기반 이미지 스크린샷 + 원본 이미지 메타 크롤러
 *   + 섹션별 분할 스크린샷 (헤더/바디/푸터)  ← 추가
 */

import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import { detectSections, capturePageSections } from "./sectionDetector.js";  // ← 추가

export async function crawlImage(url, options = {}) {
  const { 
    enableSectionCapture = true,  // ← 옵션 추가
    maxBodyHeight = 3000 
  } = options;
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const timestamp = Date.now();
  const outputDir = "src/outputs/images";
  await fs.mkdir(outputDir, { recursive: true });

  await page.goto(url, { waitUntil: "networkidle" });

  // ========================================
  // ⭐ 새로운 부분: 섹션 감지 & 분할 캡처
  // ========================================
  let sectionData = null;
  let sectionScreenshots = {};
  
  if (enableSectionCapture) {
    console.log("🔍 페이지 섹션 감지 중...");
    sectionData = await detectSections(page);
    
    console.log("📸 섹션별 스크린샷 촬영 중...");
    console.log(`   헤더: ${sectionData.sections.header?.found ? '✓' : '✗'}`);
    console.log(`   바디: ✓`);
    console.log(`   푸터: ${sectionData.sections.footer?.found ? '✓' : '✗'}`);
    
    sectionScreenshots = await capturePageSections(page, sectionData, outputDir);
  } else {
    // 기존 동작: 전체 페이지만
    const screenshotPath = path.join(outputDir, `screenshot-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    sectionScreenshots.full = screenshotPath;
  }

  // ========================================
  // 기존 코드 (그대로 유지)
  // ========================================
  const images = await page.$$eval("img", (els) =>
    els.map((img) => ({
      src: img.src,
      alt: img.alt || null,
      width: img.width,
      height: img.height,
    }))
  );

  const headers = await page.$$eval("h1, h2, h3", (els) =>
    els.map((h) => h.innerText.trim())
  );

  // ========================================
  // 메타데이터 (섹션 정보 추가)
  // ========================================
  const meta = {
    url,
    title: await page.title(),
    screenshots: sectionScreenshots,  // ← 변경: 객체로 (full, header, body, footer)
    sectionData: sectionData,         // ← 추가: 섹션 감지 결과
    capturedAt: new Date().toISOString(),
    copyright: {
      source: url,
      usage: "For UX pattern analysis and research only",
      note: "Not used for commercial redistribution",
    },
    images,
    headers,
  };

  // 저장
  const metaPath = path.join("src/outputs/meta", `meta-${timestamp}.json`);
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));

  await browser.close();

  return meta;
}