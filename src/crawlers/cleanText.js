/**
 * description:
 *   HTML 파일에서 텍스트만 추출하고 정제
 *
 * output:
 *   /src/outputs/text/clean-*.json
 **/

import { load } from "cheerio";
import fs from "fs/promises";
import path from "path";

export async function cleanHtml(filePath) {
  const html = await fs.readFile(filePath, "utf8");
  const $ = load(html);

  $("script, style, noscript").remove();

  const cleanText = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim();

  const savePath = path.join(
    "src/outputs/text",
    `clean-${Date.now()}.json`
  );

  const result = {
    cleaned_text: cleanText,
    createdAt: new Date().toISOString(),
  };

  await fs.writeFile(savePath, JSON.stringify(result, null, 2));
  return result;
}
