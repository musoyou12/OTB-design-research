import "dotenv/config";
import { supabase } from "./supabase.js"; // 옳음

async function test() {
  console.log("🔍 Supabase 연결 테스트 중...");

  const { data, error } = await supabase
    .from("dataset_records")
    .select("*");

  if (error) {
    console.error("❌ Supabase 연결 실패:", error);
  } else {
    console.log("🟢 Supabase 연결 성공:", data);
  }
}

test();
