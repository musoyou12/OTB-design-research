"""
visualTrendCollector.py

Module A - 비주얼 트렌드 수집기
HOW 신호: 디자인/형태로 어떻게 번졌는가
→ visual_trends 테이블에 저장

Behance RSS + Dribbble RSS + Awwwards 활용
"""

import uuid
import feedparser
from datetime import datetime
from typing import List, Dict

VISUAL_SOURCES = [
    {"name": "Behance / Branding",    "url": "https://www.behance.net/feeds/projects?field=branding",       "industry": "general"},
    {"name": "Behance / UI UX",       "url": "https://www.behance.net/feeds/projects?field=ui%2Fux",        "industry": "general"},
    {"name": "Behance / Web Design",  "url": "https://www.behance.net/feeds/projects?field=web+design",     "industry": "general"},
    {"name": "Behance / Fashion",     "url": "https://www.behance.net/feeds/projects?field=fashion",        "industry": "fashion"},
    {"name": "Behance / Typography",  "url": "https://www.behance.net/feeds/projects?field=typography",     "industry": "general"},
    {"name": "Dribbble / Popular",    "url": "https://dribbble.com/shots/popular.rss",                      "industry": "general"},
    {"name": "Dribbble / Branding",   "url": "https://dribbble.com/shots/popular/branding.rss",             "industry": "general"},
    {"name": "Dribbble / Web Design", "url": "https://dribbble.com/shots/popular/web-design.rss",           "industry": "general"},
    {"name": "Awwwards / Winners",    "url": "https://www.awwwards.com/awwwards/rss/",                      "industry": "general"},
]

MAX_PER_SOURCE = 10


def collect_visual_trends(run_id: str) -> List[Dict]:
    """
    Returns: visual_trends 테이블 구조의 row 리스트 (embedding은 textEmbedder가 이후 처리)
    """
    rows = []
    now = datetime.utcnow().isoformat()

    for source in VISUAL_SOURCES:
        try:
            feed = feedparser.parse(source["url"])
            entries = feed.entries[:MAX_PER_SOURCE]

            for entry in entries:
                url = entry.get("link", "")
                if not url:
                    continue
                rows.append({
                    "id":           str(uuid.uuid4()),
                    "run_id":       run_id,
                    "source_name":  source["name"],
                    "source_url":   url,
                    "title":        entry.get("title", ""),
                    "description":  entry.get("summary", "")[:500],
                    "industry":     source["industry"],
                    "tags":         ["visual", "design", "trend"],
                    "embedding":    None,   # textEmbedder에서 채움
                    "collected_at": now,
                })

            print(f"[VISUAL] {source['name']}: {len(entries)}개")

        except Exception as e:
            print(f"[VISUAL] {source['name']} 실패: {e}")

    return rows
