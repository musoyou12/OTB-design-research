/**
 * Server + Swagger + ResearchOps Full Pipeline
 */

import express from "express";
import "dotenv/config";
import { swaggerSpec, swaggerUiHandler } from "../config/swagger.js";

import { generateResearchV1, generateResearchV2 } from "./controllers/researchController.js";
import { crawlText } from "../crawlers/textCrawler.js";
import { crawlImage } from "../crawlers/imageCrawler.js";
import { cleanHtml } from "../crawlers/cleanText.js";

import { findCompetitorsByBrief } from "./services/competitionService.js";
import { labelImage } from "./services/labelService.js";
import { buildImagePrompt } from "./services/promptBuilder.js";

import { requestComfyGeneration } from "./services/comfyDryRunService.js";
import { requestComfyReal } from "./services/comfyRealService.js";

// import { supabase } from "../supabase/supabase.js";
import { testSupabaseConnection } from "../supabase/supabaseService.js";
import { uploadToSupabase, saveDatasetRecord } 
  from "../supabase/supabaseService.js";


const app = express();
app.use(express.json());

/* ----------------------------------------------
   🔵 Swagger API Docs 연결
------------------------------------------------*/
app.use("/api-docs", swaggerUiHandler.serve, swaggerUiHandler.setup(swaggerSpec));

/**
 * @openapi
 * /run-analysis:
 *   post:
 *     summary: Full ResearchOps Pipeline
 *     description: >
 *       브리프 + URL 기반 전체 자동화 파이프라인 실행
 *       - V1 생성
 *       - 이미지/텍스트 크롤링
 *       - HTML 정제
 *       - V2 생성
 *       - Vision 라벨링
 *       - 이미지 프롬프트 생성
 *       - Comfy UI 합성
 *       - Supabase 저장까지 자동 수행
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - brief
 *               - targetUrl
 *             properties:
 *               brief:
 *                 type: string
 *                 example: "패션 커머스 고도화"
 *               targetUrl:
 *                 type: string
 *                 example: "https://musinsa.com"
 *     responses:
 *       200:
 *         description: 분석 성공
 *       500:
 *         description: 서버 내부 오류
 */


app.post("/run-analysis", async (req, res) => {
  try {
    const { brief, targetUrl } = req.body;

    console.log("🟦 입력값 brief:", brief);
    console.log("🟦 입력값 targetUrl:", targetUrl);

    // 1) V1 생성 -------------------------------------
    let v1 = await generateResearchV1(brief);
    console.log("🟦 V1 생성 완료");

    // 경쟁사 입력 없으면 자동 추천
    if (!v1.competitors || v1.competitors.length === 0) {
      v1.competitors = await findCompetitorsByBrief(brief);
    }

    // 2) 이미지 크롤링 --------------------------------
    const img = await crawlImage(targetUrl);
    console.log("🟦 이미지 크롤링 결과:", img);

    if (!img || !img.screenshotPath) {
      console.error("❌ img.screenshotPath 없음:", img);
      throw new Error("❌ screenshotPath가 undefined입니다.");
    }

    // 3) 텍스트 크롤링 --------------------------------
    const text = await crawlText(targetUrl);
    console.log("🟦 텍스트 크롤링 완료");

    // 4) HTML 정제 -----------------------------------
    const cleaned = await cleanHtml(text.htmlPath);
    console.log("🟦 HTML 정제 완료");

    // 5) V2 생성 -------------------------------------
    const v2 = await generateResearchV2(v1, cleaned);
    console.log("🟦 V2 생성 완료");

    // 6) Vision 라벨링 --------------------------------
    console.log("🟦 라벨링 시작: 파일 =", img.screenshotPath);
    const labels = await labelImage(img.screenshotPath);
    console.log("🟦 라벨링 결과 labels:", labels);

    if (!labels || !labels.savePath) {
      console.error("❌ labels.savePath 없음:", labels);
      throw new Error("❌ labels.savePath가 undefined입니다.");
    }

    // 7) 이미지 프롬프트 생성 --------------------------
    const { prompt: imagePrompt, savePath: imagePromptPath } =
      await buildImagePrompt(v2, v1);
    console.log("🟦 프롬프트 생성 완료:", imagePromptPath);

    // 8) ComfyUI 합성 이미지 생성 ---------------------
    let comfy;
    if (process.env.MODE === "real") {
      console.log("🟢 MODE = real → ComfyRealService 실행");
      comfy = await requestComfyReal(imagePrompt);
    } else {
      console.log("🟡 MODE = dry → ComfyDryRunService 실행");
      comfy = await requestComfyGeneration(imagePrompt);
    }
    console.log("🟦 Comfy 실행 결과:", comfy);

    // 9) Supabase Storage 업로드 -----------------------
    const bucket = process.env.SUPABASE_BUCKET;

    console.log("🟦 Supabase upload - screenshot:", img.screenshotPath);
    const screenshotUrl = await uploadToSupabase(bucket, img.screenshotPath);

    console.log("🟦 Supabase upload - label:", labels.savePath);
    const labelUrl = await uploadToSupabase(bucket, labels.savePath);

    console.log("🟦 Supabase upload - prompt:", imagePromptPath);
    const promptUrl = await uploadToSupabase(bucket, imagePromptPath);

    let comfyImageUrl = null;
    if (comfy.imagePath) {
      console.log("🟦 Supabase upload - comfy image:", comfy.imagePath);
      comfyImageUrl = await uploadToSupabase(bucket, comfy.imagePath);
    }

    // 10) Supabase DB에 dataset 레코드 저장 ------------
    const record = await saveDatasetRecord({
      brief,
      targetUrl,
      v1,
      v2,
      domains: v2?.domains,
      screenshotUrl,
      labelUrl,
      promptUrl,
      comfyImageUrl,
      competitors: v1.competitors,
      createdAt: new Date().toISOString()
    });

    console.log("🟦 Supabase DB 저장 완료:", record);

    // 응답 반환 ---------------------------------------
    return res.json({
      status: "success",
      datasetId: record?.id,
      viewerUrl: `${process.env.PUBLIC_VIEWER_URL}?id=${record?.id}`,
      v1,
      v2,
      img,
      text,
      cleaned,
      labels,
      comfy,
      uploaded: {
        screenshotUrl,
        labelUrl,
        promptUrl,
        comfyImageUrl
      }
    });

  } catch (err) {
    console.error("❌ Error in /run-analysis:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.get("/test-supabase-db", async (req, res) => {
  try {
    const { data, error } = await testSupabaseConnection();

    if (error) {
      return res.status(500).json({
        status: "failed",
        error: error.message
      });
    }

    return res.json({
      status: "connected",
      sample: data
    });
  } catch (err) {
    return res.status(500).json({
      status: "failed",
      error: err.message
    });
  }
});



app.listen(3000, () =>
  console.log("🚀 Server running on http://localhost:3000")
);
