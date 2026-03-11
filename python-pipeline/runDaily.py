"""
runDaily.py

Module A 일일 파이프라인 엔트리포인트

실행 순서:
  1. RSS 수집 (rssCollector)
  2. 텍스트 정제 (textCleaner)
  3. 중복 제거 (deduplicate)
  4. Supabase references 저장
  5. 문서 청킹 (documentChunker)
  6. 임베딩 생성 (textEmbedder)
  7. reference_chunks 저장
  8. 16축 스코어링 (axisScorer)
  9. axis_scores 저장
  10. 산업 패턴 누적 (industryPatternBuilder)
  11. industry_patterns 저장
  12. retrieval_logs 저장
"""

import os
import sys
import uuid
import time
import argparse
import traceback
from datetime import datetime
from dotenv import load_dotenv

# Windows 터미널 UTF-8 출력
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

from moduleA.collectors.rssCollector import collect_rss
from moduleA.collectors.googleTrendsCollector import collect_trends
from moduleA.collectors.visualTrendCollector import collect_visual_trends
from moduleA.chunker.documentChunker import chunk_items
from moduleA.embedder.textEmbedder import embed_chunks
from moduleA.scorer.axisScorer import score_items
from moduleA.patterns.industryPatternBuilder import compute_industry_averages
from moduleA.writers.supabaseWriter import (
    create_run, mark_run_success, mark_run_failed,
    upsert_references, insert_chunks, upsert_axis_scores,
    upsert_industry_patterns, insert_retrieval_logs,
    upsert_trend_signals, upsert_visual_trends,
)

# 기존 공통 유틸 재사용
from common.utils.textCleaner import clean_item_text
from moduleA.preprocess.deduplicate import deduplicate

PIPELINE_VERSION = "v2.0.0"


def run():
    run_id = str(uuid.uuid4())
    run_date = datetime.utcnow().date().isoformat()

    print(f"\n{'='*50}")
    print(f"[PIPELINE] run_id: {run_id}")
    print(f"[PIPELINE] date:   {run_date}")
    print(f"{'='*50}\n")

    create_run(run_id, run_date, PIPELINE_VERSION)

    stats = {
        "collected": 0,
        "after_dedup": 0,
        "chunks": 0,
        "embedded": 0,
        "scored": 0,
        "patterns": 0,
    }

    try:
        # ── 1. 수집 ────────────────────────────────────
        print("[STEP 1] 데이터 수집")
        rss_items, logs = collect_rss(run_id)
        trend_rows = collect_trends(run_id)
        visual_rows = collect_visual_trends(run_id)
        stats["collected"] = len(rss_items)
        print(f"  → RSS: {len(rss_items)}, Trends: {len(trend_rows)}, Visual: {len(visual_rows)}")

        # ── 2. 트렌드 별도 저장 (테이블 분리) ───────────
        print("[STEP 2] 트렌드 신호 저장")
        upsert_trend_signals(trend_rows)
        upsert_visual_trends(visual_rows)

        # ── 3. RSS 정제 ────────────────────────────────
        print("[STEP 3] 텍스트 정제")
        items = [clean_item_text(item) for item in rss_items]

        # ── 4. 중복 제거 ───────────────────────────────
        print("[STEP 4] 중복 제거")
        items = deduplicate(items)
        stats["after_dedup"] = len(items)
        print(f"  → {len(items)} items after dedup")

        # ── 5. references 저장 ─────────────────────────
        print("[STEP 5] Supabase references 저장")
        saved_refs = upsert_references(items)

        # ── 6. 청킹 ────────────────────────────────────
        print("[STEP 6] 문서 청킹")
        chunks = chunk_items(items)
        stats["chunks"] = len(chunks)
        print(f"  → {len(chunks)} chunks created")

        # ── 7. 임베딩 ──────────────────────────────────
        print("[STEP 7] 임베딩 생성 (OpenAI)")
        chunks_with_embedding = embed_chunks(chunks)
        stats["embedded"] = sum(1 for c in chunks_with_embedding if c.get("embedding"))
        print(f"  → {stats['embedded']} chunks embedded")

        # ── 8. reference_chunks 저장 ───────────────────
        print("[STEP 8] reference_chunks 저장")
        insert_chunks(chunks_with_embedding, saved_refs, items)

        # ── 9. 16축 스코어링 ───────────────────────────
        print("[STEP 9] 16축 스코어링 (GPT-4o mini)")
        scores = score_items(items)
        stats["scored"] = len(scores)
        print(f"  → {len(scores)} items scored")

        # ── 10. axis_scores 저장 ───────────────────────
        print("[STEP 10] axis_scores 저장")
        upsert_axis_scores(scores, saved_refs, items)

        # ── 11. 산업 패턴 누적 ─────────────────────────
        print("[STEP 11] 산업 패턴 누적")
        patterns = compute_industry_averages(scores, items)
        stats["patterns"] = len(patterns)
        print(f"  → {len(patterns)} industry patterns computed")

        # ── 12. industry_patterns 저장 ─────────────────
        print("[STEP 12] industry_patterns 저장")
        upsert_industry_patterns(patterns)

        # ── 13. retrieval_logs 저장 ────────────────────
        print("[STEP 13] retrieval_logs 저장")
        insert_retrieval_logs(logs)

        # ── 완료 ───────────────────────────────────────
        mark_run_success(run_id, stats)
        print(f"\n[PIPELINE] ✅ 완료: {stats}")

    except Exception as e:
        tb = traceback.format_exc()
        mark_run_failed(run_id, str(e), tb)
        print(f"\n[PIPELINE] ❌ 실패: {e}")
        raise


def rescore_all(delay: float = 0.3):
    """
    DB의 모든 design_references를 새 16축으로 재스코어링
    017_axis_scores_v2.sql 실행 후 사용
    """
    from moduleA.writers.supabaseWriter import get_client
    sb = get_client()

    print("\n[RESCORE] 기존 레퍼런스 전체 재스코어링 시작\n")

    # 전체 레퍼런스 페이지네이션 조회
    all_refs, offset, page = [], 0, 100
    while True:
        res = sb.table("design_references") \
            .select("id, title, source_url, industry, domain, body_text") \
            .range(offset, offset + page - 1).execute()
        batch = res.data or []
        all_refs.extend(batch)
        if len(batch) < page:
            break
        offset += page

    total = len(all_refs)
    print(f"[RESCORE] 대상 레퍼런스: {total}개\n")

    success, failed = 0, 0
    for i, ref in enumerate(all_refs):
        item = {
            "id":        ref["id"],
            "title":     ref.get("title", ""),
            "source_url":ref.get("source_url", ""),
            "industry":  ref.get("industry", ""),
            "domain":    ref.get("domain", ""),
            "body_text": ref.get("body_text", ""),
        }
        scores = score_item(item)
        if not scores:
            print(f"  ✗ 실패: {ref.get('source_url', ref['id'])}")
            failed += 1
            continue

        row = {"reference_id": ref["id"]}
        row.update({k: v for k, v in scores.items() if k != "reference_id"})
        try:
            sb.table("axis_scores").upsert(row, on_conflict="reference_id").execute()
            success += 1
        except Exception as e:
            print(f"  ✗ upsert 실패: {e}")
            failed += 1

        if (i + 1) % 20 == 0:
            print(f"  [{i+1}/{total}] success: {success}, failed: {failed}")
        time.sleep(delay)

    print(f"\n[RESCORE] ✅ 완료 — success: {success} / failed: {failed} / total: {total}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--rescore-all", action="store_true",
                        help="DB의 모든 레퍼런스를 새 16축으로 재스코어링")
    parser.add_argument("--delay", type=float, default=0.3,
                        help="API 호출 간격(초), 기본 0.3")
    args = parser.parse_args()

    if args.rescore_all:
        from moduleA.scorer.axisScorer import score_item
        rescore_all(delay=args.delay)
    else:
        run()
