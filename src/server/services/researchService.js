/**
 * description:
 *   ResearchOps 전체 흐름을 조립하는 서비스 레이어.
 *   - 브리프 기반 1차 패킷 생성
 *   - URL 텍스트/스크린샷 크롤링
 *   - HTML 클린 텍스트 추출
 *   - 1차 + 텍스트 기반 2차 패킷 생성
 *   - 이미지 라벨링
 *
 * used in:
 *   server/controllers/researchController.js
 */

import { generateResearchV1, generateResearchV2 } from "../controllers/researchController.js";
import { crawl } from "../../crawlers/textCrawler.js";
import { extractCleanText } from "../../crawlers/cleanText.js";
import { labelImage } from "./labelService.js";
import path from "path";

export const researchService = {
  /**
   * 브리프 + URL 기반 전체 ResearchOps 실행
   */
  async runFullAnalysis(brief, targetUrl) {
    try {
      console.log("🟦 Step 1: 1차 패킷 생성");
      const v1 = await generateResearchV1(brief);

      console.log("🟦 Step 2: 텍스트/스크린샷 크롤링");
      const crawlResult = await crawl(targetUrl);

      console.log("🟦 Step 3: 텍스트 클린업");
      const htmlPath = "src/outputs/meta/page.html";
      const textData = await extractCleanText(htmlPath);

      console.log("🟦 Step 4: 2차 패킷 생성");
      const v2 = await generateResearchV2(v1, textData);

      console.log("🟦 Step 5: 이미지 라벨링");
      const screenshotPath = path.resolve("src/outputs/images/screenshot.png");
      const labels = await labelImage(screenshotPath);

      console.log("✨ ResearchOps pipeline completed.");

      return {
        success: true,
        v1,
        crawlResult,
        textData,
        v2,
        labels
      };

    } catch (err) {
      console.error(" ResearchOps Pipeline Error:", err);
      return {
        success: false,
        error: err.message
      };
    }
  }
};
