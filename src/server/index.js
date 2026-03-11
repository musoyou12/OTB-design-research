/**
 * Module B — Research Packet Generator
 * Express 서버 엔트리포인트
 */

import express from "express";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import { swaggerSpec, swaggerUiHandler } from "../config/swagger.js";
import { generatePacket } from "./controllers/packetController.js";
import { testSupabaseConnection } from "../supabase/supabaseService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/* ── Static (viewer) ────────────────────────────── */
app.use(express.static(path.join(__dirname, "../../viewer")));

/* ── Swagger ─────────────────────────────────────── */
app.use("/api-docs", swaggerUiHandler.serve, swaggerUiHandler.setup(swaggerSpec));

app.get("/", (req, res) => res.redirect("/otb_entry.html"));

app.post("/generate", generatePacket);

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * @openapi
 * /test-db:
 *   get:
 *     summary: Supabase 연결 확인
 */
app.get("/test-db", async (req, res) => {
  try {
    const { data, error } = await testSupabaseConnection();
    if (error) return res.status(500).json({ status: "failed", error: error.message });
    return res.json({ status: "connected", sample: data });
  } catch (err) {
    return res.status(500).json({ status: "failed", error: err.message });
  }
});

app.listen(3000, () =>
  console.log("🚀 Server running on http://localhost:3000")
);
