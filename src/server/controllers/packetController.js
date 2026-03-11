/**
 * packetController.js
 *
 * Module B 전체 파이프라인 오케스트레이션
 *
 * 실행 순서:
 *   1. 브리프 파싱
 *   2. 브리프 임베딩
 *   3. 벡터 검색 (pgvector)
 *   4. 산업 필터 적용
 *   5. 16축 재랭킹
 *   6. UX 근거 검색
 *   7. 경쟁사 URL 크롤링
 *   8. 전략 A/B/C 생성
 *   9. 프롬프트 팩 생성
 *  10. Supabase 저장
 *  11. 최종 패킷 조립
 */

import { parseBrief, parseStructuredBrief } from "../services/moduleB/briefParser.js";
import { embedBrief } from "../services/moduleB/briefEmbedder.js";
import { retrieveCandidates } from "../services/moduleB/vectorRetriever.js";
import { applyIndustryFilter } from "../services/moduleB/industryFilter.js";
import { rerank } from "../services/moduleB/axisReranker.js";
import { retrieveUxEvidence } from "../services/moduleB/uxEvidenceRetriever.js";
import { generateStrategies } from "../services/moduleB/strategyGenerator.js";
import { generatePrompts } from "../services/moduleB/promptGenerator.js";
import { composePacket } from "../services/moduleB/packetComposer.js";
import { saveBrief, saveStrategiesAndPrompts, saveMatches } from "../services/moduleB/packetSaver.js";
import { crawlCompetitors, formatCompetitorContext } from "../services/moduleB/competitorCrawler.js";
import { discoverCompetitorUrls } from "../services/moduleB/competitorDiscoverer.js";

export async function generatePacket(req, res) {
  try {
    const { brief } = req.body;

    if (!brief) {
      return res.status(400).json({ error: "brief는 필수입니다." });
    }

    // brief가 문자열이면 GPT 파싱, 객체면 직접 변환
    let rawBrief, parsed;
    const lang = (req.body.locale || req.headers['accept-language'] || 'en').startsWith('ko') ? 'ko' : 'en';

    if (typeof brief === "string") {
      if (!brief.trim()) return res.status(400).json({ error: "brief 문자열이 비어있습니다." });
      rawBrief = brief;
      parsed = await parseBrief(brief);
      parsed.lang = lang;
    } else if (typeof brief === "object") {
      // 구조화된 브리프 객체 → 임베딩용 텍스트 생성
      const toArr = (v) => Array.isArray(v) ? v : (v ? [v] : []);
      rawBrief = [
        brief.projectName ? `Project: ${brief.projectName}` : "",
        toArr(brief.industry).length ? `Industry: ${toArr(brief.industry).join(", ")}` : "",
        toArr(brief.goal).length ? `Goal: ${toArr(brief.goal).join(", ")}` : "",
        toArr(brief.target).length ? `Target: ${toArr(brief.target).join(", ")}` : "",
        toArr(brief.channel).length ? `Channel: ${toArr(brief.channel).join(", ")}` : "",
        toArr(brief.req || brief.constraints).length ? `Constraints: ${toArr(brief.req || brief.constraints).join(", ")}` : "",
      ].filter(Boolean).join("\n");
      parsed = parseStructuredBrief(brief);
    } else {
      return res.status(400).json({ error: "brief는 문자열 또는 객체여야 합니다." });
    }

    // ── 1. 브리프 파싱 ─────────────────────────────
    console.log("[B-1] 브리프 파싱 완료:", parsed.industry);

    // ── 2. 브리프 임베딩 ───────────────────────────
    console.log("[B-2] 브리프 임베딩");
    const embedding = await embedBrief(rawBrief);

    // ── 3. 벡터 검색 ──────────────────────────────
    console.log("[B-3] 벡터 검색");
    const candidates = await retrieveCandidates(embedding, parsed.industry);

    // ── 4. 산업 필터 ──────────────────────────────
    console.log("[B-4] 산업 필터");
    const filtered = await applyIndustryFilter(candidates, parsed.industry);

    // ── 5. 16축 재랭킹 ────────────────────────────
    console.log("[B-5] 16축 재랭킹");
    const topRefs = await rerank(filtered, parsed);

    // ── 6. UX 근거 검색 ───────────────────────────
    console.log("[B-6] UX 근거 검색");
    const uxEvidence = await retrieveUxEvidence(parsed.keywords);

    // ── 7. 경쟁사 크롤링 ──────────────────────────
    console.log("[B-7] 경쟁사 크롤링");
    let compUrls = typeof brief === "object"
      ? (Array.isArray(brief.comp) ? brief.comp : [brief.comp].filter(Boolean))
      : [];

    // URL 없으면 트렌드 DB + 레퍼런스 기반으로 자동 탐색
    if (compUrls.length === 0) {
      console.log("[B-7] 경쟁사 URL 없음 → 자동 탐색");
      compUrls = await discoverCompetitorUrls(topRefs, parsed);
    }

    const competitorData = await crawlCompetitors(compUrls, parsed);
    const competitorContext = formatCompetitorContext(competitorData);

    // ── 8. 전략 생성 ──────────────────────────────
    console.log("[B-8] 전략 A/B/C 생성");
    const strategies = await generateStrategies(parsed, topRefs, uxEvidence, competitorContext);

    // ── 9. 프롬프트 팩 생성 ───────────────────────
    console.log("[B-9] 프롬프트 팩 생성");
    const prompts = await generatePrompts(strategies, parsed);

    // ── 10. Supabase 저장 ──────────────────────────
    console.log("[B-10] Supabase 저장");
    const briefId = await saveBrief(rawBrief, parsed, embedding, typeof brief === "object" ? brief : {});
    await saveStrategiesAndPrompts(briefId, strategies, prompts);
    await saveMatches(briefId, topRefs);

    // ── 11. 패킷 조립 & 응답 ─────────────────────
    console.log("[B-11] 패킷 조립");
    const packet = composePacket({
      briefId,
      rawBrief,
      parsed,
      topRefs,
      uxEvidence,
      competitorData,
      strategies,
      prompts,
    });

    return res.json({ status: "success", packet });

  } catch (err) {
    console.error("❌ generatePacket error:", err);
    return res.status(500).json({ error: err.message });
  }
}
