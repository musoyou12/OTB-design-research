// src/server/services/comfyService.js

/**
 * description:
 *   ComfyUI 호출용 서비스 (현재는 드라이런 + 옵션 HTTP 호출)
 *
 * env:
 *   COMFY_ENDPOINT      = ComfyUI 서버 주소 (기본: http://127.0.0.1:8188)
 *   ENABLE_COMFY_HTTP   = "true" 일 때만 실제 HTTP 요청 수행
 *
 * input:
 *   imagePrompt: { positive, negative, meta }
 *
 * output:
 *   { payload, data?, savePath }
 */

import fs from "fs";
import path from "path";

const COMFY_ENDPOINT =
  process.env.COMFY_ENDPOINT || "http://127.0.0.1:8188";

export async function requestComfyGeneration(imagePrompt) {
  // 1) ComfyUI에 넘길 최소 payload 구조 (나중에 workflow JSON에 맞게 확장)
  const payload = {
    prompt: imagePrompt.positive,
    negative: imagePrompt.negative,
    meta: imagePrompt.meta
  };

  // 2) 실제 HTTP 호출 ON 모드
  if (process.env.ENABLE_COMFY_HTTP === "true") {
    const res = await fetch(`${COMFY_ENDPOINT}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => null);

    const savePath = path.join(
      "src/outputs/packets",
      `comfyResponse-${Date.now()}.json`
    );
    fs.writeFileSync(
      savePath,
      JSON.stringify({ payload, data }, null, 2),
      "utf8"
    );

    return { payload, data, savePath };
  }

  // 3) 기본(default): HTTP는 안 날리고, payload만 저장해서 검토
  const dryRunPath = path.join(
    "src/outputs/packets",
    `comfyDryRun-${Date.now()}.json`
  );
  fs.writeFileSync(dryRunPath, JSON.stringify({ payload }, null, 2), "utf8");

  return { payload, savePath: dryRunPath };
}
