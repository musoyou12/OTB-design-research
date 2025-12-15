import "dotenv/config"; 
import { createClient } from "@supabase/supabase-js";

console.log("🔍 SUPABASE_URL =", process.env.SUPABASE_URL);
console.log("🔍 SUPABASE_ANON_KEY =", process.env.SUPABASE_ANON_KEY?.slice(0, 10) + "...");

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
