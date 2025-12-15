import fs from "fs";
import path from "path";

/**
 * JSON 배열 → CSV 변환기
 * @param {Array<Object>} jsonArray - 변환할 JSON 배열
 * @param {string} savePath - 저장할 CSV 경로
 */
export function jsonToCsv(jsonArray, savePath) {
  if (!Array.isArray(jsonArray)) {
    throw new Error("jsonToCsv: 입력은 반드시 JSON 배열이어야 합니다.");
  }

  if (jsonArray.length === 0) {
    throw new Error("jsonToCsv: 변환할 데이터가 없습니다.");
  }

  // 1) CSV 헤더 구성
  const headers = Object.keys(jsonArray[0]);
  const csvRows = [];

  csvRows.push(headers.join(",")); // 첫 줄 = 헤더

  // 2) 데이터 행 구성
  jsonArray.forEach(obj => {
    const row = headers.map(header => {
      let value = obj[header];

      // null 또는 undefined 처리
      if (value === null || value === undefined) return "";

      // 콤마 포함 시 Excel 깨짐 → 따옴표 처리
      if (typeof value === "string" && value.includes(",")) {
        return `"${value}"`;
      }

      return value;
    });

    csvRows.push(row.join(","));
  });

  // 3) 저장
  fs.mkdirSync(path.dirname(savePath), { recursive: true });
  fs.writeFileSync(savePath, csvRows.join("\n"), "utf-8");

  console.log(`✅ CSV 저장 완료: ${savePath}`);
  return savePath;
}
