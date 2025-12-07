/**
 * Server + Swagger 통합 버전
 */

import express from "express";
import "dotenv/config";
import { swaggerSpec, swaggerUiHandler } from "../config/swagger.js";

import { generateResearchV1, generateResearchV2 } from "./controllers/researchController.js";
import { crawlText } from "../crawlers/textCrawler.js";
import { crawlImage } from "../crawlers/imageCrawler.js";
import { cleanHtml } from "../crawlers/cleanText.js";
import { labelImage } from "./services/labelService.js";
import { buildImagePrompt } from "./services/promptBuilder.js";
import { requestComfyGeneration } from "./services/comfyService.js";

const app = express();
app.use(express.json());

/* ----------------------------------------------
   🔵 Swagger API Docs 연결
------------------------------------------------*/
app.use("/api-docs", swaggerUiHandler.serve, swaggerUiHandler.setup(swaggerSpec));


app.post("/run-analysis", async (req, res) => {
  try {
    const { brief, targetUrl } = req.body;

    // -----------------------
    // 1) V1 생성
    // -----------------------
    const v1 = await generateResearchV1(brief);

    // -----------------------
    // 2) 스크린샷 & 이미지 수집
    // -----------------------
    const img = await crawlImage(targetUrl);

    // -----------------------
    // 3) 텍스트 크롤링
    // -----------------------
    const text = await crawlText(targetUrl);

    // -----------------------
    // 4) HTML 클린 텍스트화
    // -----------------------
    const cleaned = await cleanHtml(text.htmlPath);

    // -----------------------
    // 5) V2 생성
    // -----------------------
    const v2 = await generateResearchV2(v1, cleaned);

    // -----------------------
    // 6) Vision 기반 라벨링
    // -----------------------
    const labels = await labelImage(img.screenshotPath);

    // -----------------------
    // 7) 이미지 프롬프트 생성
    // -----------------------
    const { prompt: imagePrompt, savePath: promptPath } =
      await buildImagePrompt(v2);

    // -----------------------
    // 8) ComfyUI 이미지 생성
    // -----------------------
    const comfy = await requestComfyGeneration(imagePrompt);

    return res.json({
      v1,
      img,
      text,
      cleaned,
      v2,
      labels,
      imagePrompt,
      imagePromptPath: promptPath,
      comfy
    });

  } catch (err) {
    console.error("❌ Error in /run-analysis:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () =>
  console.log("🚀 Server running on http://localhost:3000")
);
