/**
 * supabaseService.js
 *
 * Module B용 Supabase 유틸리티
 * - 연결 테스트
 */

import { supabase } from "./supabase.js";

export async function testSupabaseConnection() {
  const { data, error } = await supabase
    .from("briefs")
    .select("id, created_at")
    .limit(3);

  return { data, error };
}
