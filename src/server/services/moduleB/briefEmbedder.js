/**
 * briefEmbedder.js
 *
 * 브리프 텍스트 → OpenAI text-embedding-3-small (1536차원)
 * pgvector match_references RPC와 차원 일치
 */

import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * @param {string} text - 브리프 원문 또는 핵심 키워드 조합
 * @returns {Promise<number[]>} 1536차원 float 배열
 */
export async function embedBrief(text) {
  const res = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}
