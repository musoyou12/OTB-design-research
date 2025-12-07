/**
 * @file imagePreprocessor.js
 * @description 이미지 전처리 파이프라인 (리사이즈, 증강, 품질평가)
 * 
 * @reference
 *   - 이주혁, 김미희 (2022). "웹 크롤링과 전이학습을 활용한 이미지 분류 모델"
 *     대한전기전자학회 논문지, Vol.26, No.4, pp.639-646
 *     DOI: 10.7471/ikeee.2022.26.4.639
 * 
 *   - 논문 적용 내용:
 *     1) Section 3.1 - 보간법 기반 이미지 리사이즈
 *        → 확대: lanczos3, 축소: lanczos2 (Fig. 5)
 *     2) Section 3.1 - 품질 평가 (Fig. 3c)
 *        → 원본 특성 보존 확인
 *     3) Section 3.1 - 데이터 증강 (Fig. 4)
 *        → 회전, 반전으로 데이터셋 확장
 * 
 * @input  크롤링 메타 파일 (imageCrawler 결과)
 * @output 전처리된 이미지 + 메타 JSON
 */

import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { createHash } from "crypto";

// ============================================
// 설정
// ============================================
const CONFIG = {
  // 논문 기준: ResNet-50 입력 크기
  targetSize: { width: 224, height: 224 },
  
  outputDirs: {
    processed: "src/outputs/images/processed",
    augmented: "src/outputs/images/augmented",
    meta: "src/outputs/meta"
  },
  
  jpeg: { quality: 90 },
  
  // 논문 Fig. 4 기반 증강 옵션
  augmentation: {
    rotations: [90, 180, 270],
    enableFlip: true,
    enableBrightness: true,
    brightnessLevel: 1.2
  }
};

// ============================================
// 단일 이미지 전처리
// ============================================
export async function preprocessImage(imageSource, options = {}) {
  const { outputName = `img-${Date.now()}` } = options;

  await fs.mkdir(CONFIG.outputDirs.processed, { recursive: true });

  // 버퍼 획득
  let buffer;
  if (typeof imageSource === "string") {
    if (imageSource.startsWith("http")) {
      const response = await fetch(imageSource);
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      buffer = Buffer.from(await response.arrayBuffer());
    } else {
      buffer = await fs.readFile(imageSource);
    }
  } else {
    buffer = imageSource;
  }

  const metadata = await sharp(buffer).metadata();
  
  // 논문 방식: 보간법 선택 (Section 3.1, Fig. 5)
  const isUpscale = metadata.width < CONFIG.targetSize.width;
  const kernel = isUpscale ? sharp.kernel.lanczos3 : sharp.kernel.lanczos2;

  const hash = createHash("md5").update(buffer).digest("hex").slice(0, 8);
  const filename = `${outputName}-${hash}.jpg`;
  const outputPath = path.join(CONFIG.outputDirs.processed, filename);

  await sharp(buffer)
    .resize(CONFIG.targetSize.width, CONFIG.targetSize.height, {
      fit: "cover",
      position: "center",
      kernel
    })
    .jpeg(CONFIG.jpeg)
    .toFile(outputPath);

  // 품질 점수 (논문 Section 3.1 - Fig. 3c 간이 구현)
  const outputStats = await fs.stat(outputPath);
  const qualityScore = Math.min(outputStats.size / 10000, 1);

  return {
    originalSize: { width: metadata.width, height: metadata.height },
    processedSize: CONFIG.targetSize,
    processedPath: outputPath,
    interpolation: isUpscale ? "lanczos3" : "lanczos2",
    qualityScore: qualityScore.toFixed(2),
    hash
  };
}

// ============================================
// 데이터 증강 (논문 Section 3.1, Fig. 4)
// ============================================
export async function augmentImage(imagePath, options = {}) {
  const {
    rotations = CONFIG.augmentation.rotations,
    enableFlip = CONFIG.augmentation.enableFlip,
    enableBrightness = CONFIG.augmentation.enableBrightness
  } = options;

  await fs.mkdir(CONFIG.outputDirs.augmented, { recursive: true });

  const buffer = await fs.readFile(imagePath);
  const baseName = path.basename(imagePath, path.extname(imagePath));
  const augmented = [];

  // 회전 (논문 Fig. 4)
  for (const angle of rotations) {
    const outputPath = path.join(CONFIG.outputDirs.augmented, `${baseName}_rot${angle}.jpg`);
    await sharp(buffer).rotate(angle).toFile(outputPath);
    augmented.push({ type: "rotation", angle, path: outputPath });
  }

  // 좌우 반전
  if (enableFlip) {
    const outputPath = path.join(CONFIG.outputDirs.augmented, `${baseName}_flip.jpg`);
    await sharp(buffer).flop().toFile(outputPath);
    augmented.push({ type: "flip", path: outputPath });
  }

  // 밝기 조정
  if (enableBrightness) {
    const outputPath = path.join(CONFIG.outputDirs.augmented, `${baseName}_bright.jpg`);
    await sharp(buffer)
      .modulate({ brightness: CONFIG.augmentation.brightnessLevel })
      .toFile(outputPath);
    augmented.push({ type: "brightness", path: outputPath });
  }

  return augmented;
}

// ============================================
// 배치 전처리 (크롤링 메타 기반)
// ============================================
export async function preprocessFromMeta(metaPath, options = {}) {
  const { enableAugment = false, maxImages = 50 } = options;

  const meta = JSON.parse(await fs.readFile(metaPath, "utf-8"));
  const timestamp = Date.now();
  
  const results = {
    source: metaPath,
    processed: [],
    augmented: []
  };

  const images = (meta.images || [])
    .filter((img) => img.src && img.width > 100 && img.height > 100)
    .slice(0, maxImages);

  console.log(`🔧 전처리 시작: ${images.length}개 이미지`);

  for (let i = 0; i < images.length; i++) {
    try {
      const processed = await preprocessImage(images[i].src, {
        outputName: `${meta.id || "img"}-${i}`
      });
      
      results.processed.push({ original: images[i], ...processed });

      if (enableAugment) {
        const augmented = await augmentImage(processed.processedPath);
        results.augmented.push(...augmented);
      }

      console.log(`  ✅ [${i + 1}/${images.length}] 완료`);
    } catch (error) {
      console.warn(`  ❌ [${i + 1}/${images.length}] ${error.message}`);
    }
  }

  // 메타 저장
  const resultMeta = {
    ...results,
    processedAt: new Date().toISOString(),
    reference: {
      paper: "이주혁, 김미희 (2022). 웹 크롤링과 전이학습을 활용한 이미지 분류 모델",
      doi: "10.7471/ikeee.2022.26.4.639",
      appliedTechniques: [
        "보간법 기반 리사이즈 (Section 3.1)",
        "품질 평가 (Fig. 3c)",
        "데이터 증강 (Fig. 4)"
      ]
    },
    stats: {
      total: images.length,
      processed: results.processed.length,
      augmented: results.augmented.length
    }
  };

  const outputMetaPath = path.join(CONFIG.outputDirs.meta, `preprocess-${timestamp}.json`);
  await fs.writeFile(outputMetaPath, JSON.stringify(resultMeta, null, 2));

  console.log(`💾 메타 저장: ${outputMetaPath}`);
  return { meta: resultMeta, savePath: outputMetaPath };
}