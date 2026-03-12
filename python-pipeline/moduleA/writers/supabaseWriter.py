"""
supabaseWriter.py

Module A - Writer
- 수집/처리된 데이터를 Supabase에 저장
- references, reference_chunks, axis_scores, industry_patterns,
  retrieval_logs, pipeline_runs 테이블 담당

원칙:
- references: source_url 기준 upsert (중복 삽입 방지)
- reference_chunks: reference_id 기준 insert (기존 청크 교체)
- axis_scores: reference_id 기준 upsert
- industry_patterns: (industry, pattern_key) 기준 upsert
"""

import os
from typing import List, Dict, Optional

from supabase import create_client, Client

_client: Optional[Client] = None


def get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_KEY"]  # 쓰기 권한용 service key
        _client = create_client(url, key)
    return _client


# ──────────────────────────────────────────
# References
# ──────────────────────────────────────────

def upsert_references(items: List[Dict]) -> List[Dict]:
    """
    source_url 기준 upsert. 저장된 레코드 반환.
    """
    sb = get_client()
    rows = [
        {
            "source_url": item["source_url"],
            "title":       item.get("title"),
            "body_text":   item.get("body_text"),
            "industry":    item.get("industry"),
            "domain":      item.get("domain"),
            "tags":        item.get("tags", []),
            "crawl_status": item.get("crawl_status", "success"),
            "crawled_at":  item.get("collected_at"),
        }
        for item in items
        if item.get("source_url")
    ]
    if not rows:
        return []

    res = sb.table("design_references").upsert(rows, on_conflict="source_url").execute()
    print(f"[WRITER] references upserted: {len(rows)}")
    return res.data or []


# ──────────────────────────────────────────
# Reference Chunks
# ──────────────────────────────────────────

CHUNK_BATCH_SIZE = 50  # 타임아웃 방지용 배치 크기


def insert_chunks(
    chunks: List[Dict],
    saved_refs: List[Dict],
    original_items: List[Dict],
) -> None:
    sb = get_client()

    url_to_db_id = {r["source_url"]: r["id"] for r in saved_refs}
    tmp_id_to_url = {item["id"]: item["source_url"] for item in original_items}

    rows = []
    for chunk in chunks:
        if chunk.get("embedding") is None:
            continue
        tmp_ref_id = chunk["reference_id"]
        url = tmp_id_to_url.get(tmp_ref_id)
        db_id = url_to_db_id.get(url) if url else None
        if not db_id:
            continue
        rows.append({
            "reference_id": db_id,
            "chunk_index":  chunk["chunk_index"],
            "chunk_text":   chunk["chunk_text"],
            "embedding":    chunk["embedding"],
        })

    if not rows:
        return

    # 기존 청크 삭제 후 재삽입 (중복 방지)
    db_ids = list({r["reference_id"] for r in rows})
    for i in range(0, len(db_ids), 50):
        sb.table("reference_chunks").delete().in_("reference_id", db_ids[i:i+50]).execute()

    # 타임아웃 방지: CHUNK_BATCH_SIZE 단위로 나눠서 insert
    for i in range(0, len(rows), CHUNK_BATCH_SIZE):
        batch = rows[i: i + CHUNK_BATCH_SIZE]
        sb.table("reference_chunks").insert(batch).execute()
        print(f"[WRITER] reference_chunks batch {i // CHUNK_BATCH_SIZE + 1}: {len(batch)} rows inserted")

    print(f"[WRITER] reference_chunks total inserted: {len(rows)}")


# ──────────────────────────────────────────
# Axis Scores
# ──────────────────────────────────────────

def upsert_axis_scores(
    scores: List[Dict],
    saved_refs: List[Dict],
    original_items: List[Dict],
) -> None:
    sb = get_client()

    url_to_db_id = {r["source_url"]: r["id"] for r in saved_refs}
    tmp_id_to_url = {item["id"]: item["source_url"] for item in original_items}

    rows = []
    for score in scores:
        tmp_ref_id = score.get("reference_id")
        url = tmp_id_to_url.get(tmp_ref_id)
        db_id = url_to_db_id.get(url) if url else None
        if not db_id:
            continue
        row = {"reference_id": db_id}
        row.update({k: v for k, v in score.items() if k != "reference_id"})
        rows.append(row)

    if not rows:
        return

    for i in range(0, len(rows), 50):
        batch = rows[i: i + 50]
        sb.table("axis_scores").upsert(batch, on_conflict="reference_id").execute()

    print(f"[WRITER] axis_scores upserted: {len(rows)}")


# ──────────────────────────────────────────
# Industry Patterns
# ──────────────────────────────────────────

def upsert_industry_patterns(patterns: List[Dict]) -> None:
    sb = get_client()
    if not patterns:
        return
    sb.table("industry_patterns").upsert(
        patterns, on_conflict="industry,pattern_key"
    ).execute()
    print(f"[WRITER] industry_patterns upserted: {len(patterns)}")


# ──────────────────────────────────────────
# Retrieval Logs
# ──────────────────────────────────────────

def insert_retrieval_logs(logs: List[Dict]) -> None:
    sb = get_client()
    if not logs:
        return
    sb.table("retrieval_logs").insert(logs).execute()
    print(f"[WRITER] retrieval_logs inserted: {len(logs)}")


# ──────────────────────────────────────────
# Trend Signals (Google Trends → INTENT)
# ──────────────────────────────────────────

def upsert_trend_signals(rows: List[Dict]) -> None:
    sb = get_client()
    if not rows:
        return
    # industry + keyword 기준 upsert (중복 방지)
    sb.table("trend_signals").insert(rows).execute()
    print(f"[WRITER] trend_signals inserted: {len(rows)}")


# ──────────────────────────────────────────
# Visual Trends (Behance/Dribbble → HOW)
# ──────────────────────────────────────────

def upsert_visual_trends(rows: List[Dict]) -> None:
    sb = get_client()
    if not rows:
        return
    # source_url 기준 upsert
    clean = [
        {k: v for k, v in row.items() if k != "id" and k != "run_id"}
        for row in rows
        if row.get("source_url")
    ]
    if not clean:
        return
    sb.table("visual_trends").upsert(clean, on_conflict="source_url").execute()
    print(f"[WRITER] visual_trends upserted: {len(clean)}")


# ──────────────────────────────────────────
# Pipeline Runs
# ──────────────────────────────────────────

def create_run(run_id: str, run_date: str, version: str) -> None:
    sb = get_client()
    sb.table("pipeline_runs").insert({
        "run_id": run_id,
        "run_date": run_date,
        "pipeline_version": version,
        "status": "running",
        "started_at": "now()",
    }).execute()


def mark_run_success(run_id: str, stats: Dict) -> None:
    sb = get_client()
    sb.table("pipeline_runs").update({
        "status": "success",
        "finished_at": "now()",
        "stats": stats,
    }).eq("run_id", run_id).execute()


def mark_run_failed(run_id: str, error: str, trace: str) -> None:
    sb = get_client()
    sb.table("pipeline_runs").update({
        "status": "failed",
        "finished_at": "now()",
        "error_message": error,
        "stack_trace": trace,
    }).eq("run_id", run_id).execute()


def get_existing_chunk_hashes() -> set:
    """
    reference_chunks 테이블에서 chunk_hash 목록 조회 → set 반환.
    embed_chunks 중복 스킵에 사용.
    chunk_hash 컬럼이 없으면 빈 set 반환 (하위 호환).
    """
    sb = get_client()
    try:
        hashes = set()
        offset, page = 0, 1000
        while True:
            res = sb.table("reference_chunks") \
                .select("chunk_hash") \
                .not_.is_("chunk_hash", "null") \
                .range(offset, offset + page - 1) \
                .execute()
            batch = res.data or []
            hashes.update(r["chunk_hash"] for r in batch if r.get("chunk_hash"))
            if len(batch) < page:
                break
            offset += page
        print(f"[EMBED] 기존 chunk_hash {len(hashes)}개 로드")
        return hashes
    except Exception as e:
        print(f"[EMBED] chunk_hash 조회 실패 (스킵 없이 진행): {e}")
        return set()
