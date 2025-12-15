/**
 * Supabase Storage Uploading Service
 * -----------------------------------
 * 사용 목적:
 *   - ResearchOps 결과물(스크린샷, 라벨링 JSON, 프롬프트, 합성 이미지)을
 *     Supabase Storage에 업로드하여 “웹 URL 기반 데이터셋”으로 제공하기 위함
 * 역할:
 *   - 로컬에 생성된 이미지/JSON/합성데이터 등을 Supabase Storage로 업로드
 *   - 업로드 후 웹에서 접근 가능한 퍼블릭 URL 반환
 *
 * 사용 이유:
 *   - 데이터 바우처 제출용 “웹 데이터 형식” 제공을 위해
 *   - AWS S3와 거의 동일한 방식 (향후 확장 가능)
 *   - 서버 구축 안 해도 Web URL로 외부 공개 가능하다는 장점
 */

import { supabase } from "./supabase.js";
import fs from "fs";
import path from "path";

/**
 * 파일을 Supabase Storage에 업로드하고, 퍼블릭 URL을 반환하는 함수
 *
 * @param {string} bucket - Supabase Storage 버킷명
 * @param {string} filePath - 업로드할 로컬 파일 경로
 * @returns {string} publicURL - Web에서 접근 가능한 URL
 */
export async function uploadToSupabase(bucket, filePath) {

      console.log("🟢🟢DEBUG label savePath:", filePath);
  if (!filePath) {
    throw new Error(`❌ uploadToSupabase(): filePath가 undefined입니다.`);
  }

  // 1) 파일 읽기
  const fileBuffer = fs.readFileSync(filePath)
  const fileName = path.basename(filePath);

  // 2) Supabase 업로드
  const { error } = await supabase.storage
    .from(bucket)
    .upload(`dataset/${fileName}`, fileBuffer, {
      upsert: true,
      contentType: detectContentType(fileName),
    });

  if (error) {
    throw new Error(`❌ Supabase upload failed: ${error.message}`);
  }

  // 3) public URL 생성
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(`dataset/${fileName}`);

  if (!data?.publicUrl) {
    throw new Error("❌ Failed to generate Supabase public URL");
  }

  return data.publicUrl;

}

export async function saveDatasetRecord(record) {
  const payload = {
    brief: record.brief,
    target_url: record.targetUrl,
    v1_json: record.v1,
    v2_json: record.v2,
    domains: record.domains,
    screenshot_url: record.screenshotUrl,
    label_url: record.labelUrl,
    prompt_url: record.promptUrl,
    comfy_image_url: record.comfyImageUrl,
    competitors: record.competitors,
    created_at: record.createdAt
  };

  const { data, error } = await supabase
    .from("dataset_records")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("❌ Supabase insert error:", error);
    throw new Error(error.message);
  }

  console.log("🟢 DB 저장 성공:", data);
  
  return data;
}

/**
 * content-type 자동 감지
 */
function detectContentType(fileName) {
  if (fileName.endsWith(".png")) return "image/png";
  if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg"))
    return "image/jpeg";
  if (fileName.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

// DB 연결 테스트용 (SELECT 1 FROM dataset_records)
export async function testSupabaseConnection() {
  const { data, error } = await supabase
    .from("dataset_records")
    .select("*")
    .limit(1);

  return { data, error };
}

