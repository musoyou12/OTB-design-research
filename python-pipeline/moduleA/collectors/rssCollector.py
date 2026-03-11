"""
rssCollector.py

Module A - Collector
- RSS 피드 수집
- crawl_status: success / partial / blocked
- 전략/분류/요약 금지. 원문 수집만.
"""

import uuid
import feedparser
from datetime import datetime
from typing import List, Dict, Tuple


RSS_SOURCES = [
    # ── 디자인 종합 ──────────────────────────────────
    {"name": "DesignBoom",        "url": "https://www.designboom.com/feed/",              "category": "Design General",       "language": "en"},
    {"name": "Dezeen",            "url": "https://www.dezeen.com/feed/",                  "category": "Design General",       "language": "en"},
    {"name": "Design Milk",       "url": "https://design-milk.com/feed/",                 "category": "Design General",       "language": "en"},
    {"name": "It's Nice That",    "url": "https://www.itsnicethat.com/feed",              "category": "Design General",       "language": "en"},
    {"name": "Creative Bloq",     "url": "https://www.creativebloq.com/feed",             "category": "Design General",       "language": "en"},
    {"name": "Abduzeedo",         "url": "https://abduzeedo.com/rss.xml",                 "category": "Design Inspiration",   "language": "en"},
    {"name": "Colossal",          "url": "https://www.thisiscolossal.com/feed/",          "category": "Art + Design",         "language": "en"},

    # ── UX/UI ────────────────────────────────────────
    {"name": "Nielsen Norman Group", "url": "https://www.nngroup.com/feed/rss/",          "category": "UX Research",          "language": "en", "priority": "high"},
    {"name": "UX Collective",     "url": "https://uxdesign.cc/feed",                      "category": "UX Design",            "language": "en", "priority": "high"},
    {"name": "Smashing Magazine", "url": "https://www.smashingmagazine.com/feed/",        "category": "Web Design + UX",      "language": "en", "priority": "high"},
    {"name": "UX Matters",        "url": "https://www.uxmatters.com/index.xml",           "category": "UX Strategy",          "language": "en"},
    {"name": "A List Apart",      "url": "https://alistapart.com/main/feed/",             "category": "Web Standards + UX",   "language": "en"},

    # ── 브랜딩 ───────────────────────────────────────
    {"name": "Brand New",         "url": "https://www.underconsideration.com/brandnew/feed/", "category": "Brand Identity",  "language": "en", "priority": "high"},
    {"name": "The Dieline",       "url": "https://thedieline.com/feed/",                  "category": "Packaging Design",     "language": "en"},
    {"name": "BP&O",              "url": "https://bpando.org/feed/",                      "category": "Brand Packaging",      "language": "en"},

    # ── 웹 디자인 ────────────────────────────────────
    {"name": "Awwwards Blog",     "url": "https://www.awwwards.com/blog/feed/",           "category": "Web Design",           "language": "en"},
    {"name": "CSS Design Awards", "url": "https://www.cssdesignawards.com/blog/feed/",    "category": "CSS + Web Design",     "language": "en"},

    # ── 테크/AI ──────────────────────────────────────
    {"name": "Fast Company Design", "url": "https://www.fastcompany.com/section/design/rss", "category": "Design + Innovation", "language": "en"},
    {"name": "Wired Design",      "url": "https://www.wired.com/feed/category/design/latest/rss", "category": "Future Design", "language": "en"},

    # ── 한국어 ───────────────────────────────────────
    {"name": "디자인정글",          "url": "http://www.jungle.co.kr/rss/magazine_list",    "category": "Korean Design",        "language": "ko", "geography": "KR"},
    {"name": "월간 디자인",         "url": "https://mdesign.designhouse.co.kr/feed",       "category": "Korean Design",        "language": "ko", "geography": "KR"},

    # ── 도메인별 ─────────────────────────────────────
    {"name": "WWD",               "url": "https://wwd.com/feed/",                         "category": "Fashion News",         "language": "en", "domain": "fashion"},
    {"name": "BoF",               "url": "https://www.businessoffashion.com/feed",        "category": "Fashion Business",     "language": "en", "domain": "fashion"},
    {"name": "Cosmetics Design",  "url": "https://www.cosmeticsdesign.com/rss",           "category": "Beauty + Packaging",   "language": "en", "domain": "beauty"},
]


def _classify_status(feed, entry_count: int) -> str:
    """수집 결과를 success / partial / blocked 로 분류"""
    if feed.bozo and entry_count == 0:
        return "blocked"
    if entry_count == 0:
        return "blocked"
    if feed.bozo or entry_count < 3:
        return "partial"
    return "success"


def collect_rss(run_id: str, max_per_source: int = 20) -> Tuple[List[Dict], List[Dict]]:
    """
    Returns:
        items: 수집된 레퍼런스 리스트
        logs:  소스별 crawl_status 로그 리스트
    """
    items: List[Dict] = []
    logs: List[Dict] = []
    now = datetime.utcnow().isoformat()

    for source in RSS_SOURCES:
        log = {
            "run_id": run_id,
            "source_url": source["url"],
            "crawl_status": "blocked",
            "retrieved_count": 0,
            "error_message": None,
        }

        try:
            feed = feedparser.parse(source["url"])
            entries = feed.entries[:max_per_source]
            log["crawl_status"] = _classify_status(feed, len(entries))
            log["retrieved_count"] = len(entries)

            for entry in entries:
                items.append({
                    "id": str(uuid.uuid4()),
                    "run_id": run_id,
                    "source_name": source["name"],
                    "source_url": entry.get("link", ""),
                    "title": entry.get("title", ""),
                    "body_text": entry.get("summary", ""),
                    "industry": source.get("domain"),      # fashion / beauty / etc.
                    "domain": source.get("category"),
                    "tags": [],
                    "crawl_status": log["crawl_status"],
                    "language": source.get("language", "en"),
                    "priority": source.get("priority", "normal"),
                    "collected_at": now,
                })

            print(f"[RSS] {source['name']}: {log['crawl_status']} ({len(entries)} items)")

        except Exception as e:
            log["crawl_status"] = "blocked"
            log["error_message"] = str(e)
            print(f"[RSS] {source['name']}: blocked — {e}")

        logs.append(log)

    return items, logs
