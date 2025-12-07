/**
 * @file labelBatchService.js
 * @description 배치 라벨링 + 전처리 연동 + CSV 내보내기
 * 
 * @reference
 *   - 이주혁, 김미희 (2022). "웹 크롤링과 전이학습을 활용한 이미지 분류 모델"
 *     대한전기전자학회 논문지, Vol.26, No.4, pp.639-646
 *     DOI: 10.7471/ikeee.2022.26.4.639
 * 
 *   - 논문 적용 내용:
 *     1) 웹 크롤링 자동화 (Playwright 기반 구현)
 *     2) 데이터 전처리 파이프라인 (보간법, 품질평가)
 *     3) 이미지 분류 체계 → GPT Vision 6축 라벨링으로 대체
 *     4) 배치 처리로 대량 데이터셋 구축
 * 
 * @input  전처리 메타 파일 or 이미지 디렉토리
 * @output 라벨링 결과 JSON + CSV (데이터 바우처 제출용)
 */

import fs from "fs";
import path from "path";
import { labelImage, LABEL_SCHEMA } from "./labelService.js";

// ============================================
// 배치 라벨링
// ============================================
export async function labelBatch(filePaths, options = {}) {
  const { 
    delay = 1500,  // Rate limit 대응
    onProgress = null 
  } = options;
  
  const results = [];

  console.log(`🚀 배치 라벨링 시작: ${filePaths.length}개 이미지`);

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];

    try {
      const result = await labelImage(filePath);
      results.push({ success: true, ...result });
      console.log(`  ✅ [${i + 1}/${filePaths.length}] ${path.basename(filePath)}`);

      if (onProgress) {
        onProgress({ current: i + 1, total: filePaths.length, filePath });
      }
    } catch (error) {
      console.error(`  ❌ [${i + 1}/${filePaths.length}] ${error.message}`);
      results.push({ success: false, filePath, error: error.message });
    }

    // Rate limit 대응
    if (i < filePaths.length - 1) {
      await sleep(delay);
    }
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(`✅ 배치 완료: ${successCount}/${filePaths.length} 성공`);

  return results;
}

// ============================================
// 디렉토리 일괄 라벨링
// ============================================
export async function labelDirectory(dirPath, options = {}) {
  const { extensions = [".jpg", ".jpeg", ".png"], ...batchOptions } = options;

  const absoluteDir = path.resolve(dirPath);
  
  if (!fs.existsSync(absoluteDir)) {
    throw new Error(`디렉토리가 존재하지 않습니다: ${absoluteDir}`);
  }

  const files = fs.readdirSync(absoluteDir)
    .filter((f) => extensions.includes(path.extname(f).toLowerCase()))
    .map((f) => path.join(absoluteDir, f));

  console.log(`📁 디렉토리: ${absoluteDir}`);
  console.log(`📷 이미지 발견: ${files.length}개`);

  return labelBatch(files, batchOptions);
}

// ============================================
// 전처리 메타 기반 라벨링
// ============================================
export async function labelFromPreprocessMeta(preprocessMetaPath, options = {}) {
  const meta = JSON.parse(fs.readFileSync(preprocessMetaPath, "utf-8"));
  
  const filePaths = (meta.processed || [])
    .map((item) => item.processedPath)
    .filter((p) => fs.existsSync(p));

  console.log(`📋 전처리 메타: ${preprocessMetaPath}`);
  console.log(`📷 라벨링 대상: ${filePaths.length}개`);

  const results = await labelBatch(filePaths, options);

  // 통합 메타 저장
  const combinedMeta = {
    source: preprocessMetaPath,
    labeledAt: new Date().toISOString(),
    reference: {
      paper: "이주혁, 김미희 (2022). 웹 크롤링과 전이학습을 활용한 이미지 분류 모델",
      doi: "10.7471/ikeee.2022.26.4.639"
    },
    schema: LABEL_SCHEMA,
    results: results.map((r, i) => ({
      ...meta.processed[i],
      labels: r.success ? r.labels : null,
      labelError: r.success ? null : r.error
    })),
    stats: {
      total: filePaths.length,
      success: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length
    }
  };

  const savePath = path.join("src/outputs/meta", `labeled-${Date.now()}.json`);
  fs.writeFileSync(savePath, JSON.stringify(combinedMeta, null, 2));

  console.log(`💾 통합 메타 저장: ${savePath}`);
  return { meta: combinedMeta, savePath };
}

// ============================================
// CSV 내보내기 (데이터 바우처 제출용)
// ============================================
export function exportToCSV(labeledMetaPaths, outputPath) {
  const rows = [];

  for (const metaPath of labeledMetaPaths) {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));

    for (const item of meta.results || []) {
      if (!item.labels) continue;

      rows.push({
        id: item.hash || path.basename(item.processedPath, ".jpg"),
        file_path: item.processedPath,
        source_url: item.original?.src || "",
        domain: item.labels.Domain || "",
        channel: item.labels.Channel || "",
        image_category: item.labels.ImageCategory || "",
        concept: item.labels.Concept || "",
        effect_2d: item.labels.Effect2D || "",
        color_mood: item.labels.ColorMood || "",
        quality_score: item.qualityScore || "",
        interpolation: item.interpolation || "",
        labeled_at: meta.labeledAt || ""
      });
    }
  }

  if (rows.length === 0) {
    console.log("⚠️ 내보낼 데이터가 없습니다.");
    return null;
  }

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => `"${row[h] || ""}"`).join(","))
  ].join("\n");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, csv);

  console.log(`📊 CSV 저장: ${outputPath} (${rows.length}행)`);
  return { path: outputPath, rowCount: rows.length };
}

// ============================================
// 유틸리티
// ============================================
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}