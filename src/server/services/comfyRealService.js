import fs from "fs";
import path from "path";
import WebSocket from "ws";
import { buildSyntheticMetadata } from "./datasetBuilder.js";

const COMFY_ENDPOINT = process.env.COMFY_ENDPOINT || "http://127.0.0.1:8188";
const WORKFLOW_PATH = "src/comfy/workflow.json";
const OUTPUT_DIR = "src/outputs/synthetic";

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// workflow load
function loadWorkflow() {
  return JSON.parse(fs.readFileSync(WORKFLOW_PATH, "utf8"));
}

// inject prompt
function injectPrompts(workflow, positive, negative) {
  const targetNodeId = "3"; 
  workflow[targetNodeId].inputs.text = positive;
  workflow[targetNodeId].inputs.negative = negative;
  return workflow;
}

// download image from Comfy server
async function downloadImage(filename) {
  const url = `${COMFY_ENDPOINT}/view?filename=${filename}&type=output`;
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function requestComfyReal(imagePrompt, sourceInfo) {
  let workflow = loadWorkflow();
  workflow = injectPrompts(workflow, imagePrompt.positive, imagePrompt.negative);

  // send prompt
  const res = await fetch(`${COMFY_ENDPOINT}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workflow)
  });
  const { prompt_id } = await res.json();

  // connect WS
  const ws = new WebSocket(`ws://127.0.0.1:8188/ws`);
  const result = await new Promise((resolve) => {
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "execution_complete") {
        resolve(data);
        ws.close();
      }
    };
  });

  // get image info from history
  const historyRes = await fetch(`${COMFY_ENDPOINT}/history/${prompt_id}`);
  const history = await historyRes.json();
  const outputs = history[prompt_id].outputs;
  const nodeId = Object.keys(outputs)[0];
  const images = outputs[nodeId].images;

  const id = `synthetic-${Date.now()}`;
  const savedFiles = [];

  for (const img of images) {
    const buffer = await downloadImage(img.filename);
    const savePath = path.join(OUTPUT_DIR, `${id}.png`);
    fs.writeFileSync(savePath, buffer);
    savedFiles.push(savePath);
  }

  // build metadata
  const meta = buildSyntheticMetadata({
    id,
    source: {
      url: sourceInfo.url,
      collected_at: new Date().toISOString(),
      original_screenshot: sourceInfo.screenshotPath
    },
    prompt: {
      positive: imagePrompt.positive,
      negative: imagePrompt.negative
    },
    generation: {
      model: "ComfyUI / SDXL Base 1.0",
      seed: workflow["2"]?.inputs.seed || null,
      sampler: workflow["2"]?.inputs.sampler_name || "euler",
      steps: workflow["2"]?.inputs.steps || 25
    },
    labels: {
      ui_type: imagePrompt.ui_type,
      components: imagePrompt.components
    },
    synthetic_image: savedFiles[0]
  });

  // save json
  const metaPath = path.join(OUTPUT_DIR, `${id}.json`);
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  return {
    id,
    imagePath: savedFiles[0],
    metaPath,
    meta
  };
}

// /*
//  * Synthetic 이미지 생성 서비스
//  * - 기존 ComfyUI 코드 제거
//  * - OpenAI 이미지 생성으로 완전 대체
//  * - Supabase 업로드까지 자동 처리
//  * - 추후 수정 필요
//  */

// import OpenAI from "openai";
// import fs from "fs";
// import path from "path";
// import { uploadToSupabase } from "../../supabase/supabaseService.js";

// const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// const OUTPUT_DIR = "src/outputs/synthetic";

// // synthetic 폴더 자동 생성
// if (!fs.existsSync(OUTPUT_DIR)) {
//   fs.mkdirSync(OUTPUT_DIR, { recursive: true });
// }

// /**
//  * input: imagePrompt = { positive, negative, meta }
//  * output: { imagePath, supabaseUrl, meta }
//  */
// export async function requestComfyReal(imagePrompt) {
//   console.log("🟦 [OpenAI Synthetic] 이미지 생성 시작");

//   // 1) 최종 프롬프트 구성
//   const finalPrompt = `
// ${imagePrompt.positive}
// (Avoid: ${imagePrompt.negative})
//   `;

//   // 2) 이미지 생성 요청
//   const res = await client.images.generate({
//     model: "gpt-image-1", // or "dall-e-3"
//     prompt: finalPrompt,
//     size: "1024x1024"
//   });

//   const base64 = res.data[0]?.b64_json;
//   if (!base64) throw new Error("❌ OpenAI 이미지 생성 실패: base64 없음");

//   // 3) synthetic 이미지 저장
//   const fileName = `synthetic-${Date.now()}.png`;
//   const imagePath = path.join(OUTPUT_DIR, fileName);
//   fs.writeFileSync(imagePath, Buffer.from(base64, "base64"));

//   console.log("🟢 synthetic 이미지 저장 완료:", imagePath);

//   // 4) synthetic 메타 파일 저장
//   const meta = {
//     promptUsed: finalPrompt.trim(),
//     originalPrompt: imagePrompt,
//     createdAt: new Date().toISOString()
//   };

//   const metaPath = path.join(OUTPUT_DIR, `${fileName}.json`);
//   fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

//   // 5) Supabase 업로드
//   const bucket = process.env.SUPABASE_BUCKET;
//   const supabaseUrl = await uploadToSupabase(bucket, imagePath);

//   console.log("🟢 Supabase 업로드 완료:", supabaseUrl);

//   return {
//     imagePath,
//     supabaseUrl,
//     meta
//   };
// }
//
