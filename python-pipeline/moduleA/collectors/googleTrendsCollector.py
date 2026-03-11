"""
googleTrendsCollector.py

Module A - Google Trends 수집기
INTENT 신호: 사람들이 이 키워드를 검색하기 시작했는가
→ trend_signals 테이블에 저장

pytrends 라이브러리 사용 (pip install pytrends)
"""

import time
from datetime import datetime
from typing import List, Dict

try:
    from pytrends.request import TrendReq
except ImportError:
    TrendReq = None

INDUSTRY_KEYWORDS = {
    "fashion":   ["패션 브랜드", "fashion UX", "fashion ecommerce design", "온라인 쇼핑몰"],
    "beauty":    ["뷰티 브랜드", "beauty website design", "skincare UX", "화장품 웹"],
    "f&b":       ["식음료 브랜드", "restaurant website", "F&B UX", "음식 브랜드 디자인"],
    "saas":      ["SaaS design", "dashboard UX", "B2B product design", "SaaS 랜딩"],
    "lifestyle": ["lifestyle brand", "라이프스타일 웹", "wellness design", "브랜드 리뉴얼"],
    "general":   ["웹 리디자인", "브랜드 아이덴티티", "UX design trend", "web design 2025"],
}

TIMEFRAMES = "today 3-m"


def collect_trends(run_id: str) -> List[Dict]:
    """
    Returns: trend_signals 테이블 구조의 row 리스트
    """
    if TrendReq is None:
        print("[TRENDS] pytrends 미설치 → 건너뜀 (pip install pytrends)")
        return []

    pytrends = TrendReq(hl="ko", tz=540)
    rows = []
    now = datetime.utcnow().isoformat()

    for industry, keywords in INDUSTRY_KEYWORDS.items():
        try:
            pytrends.build_payload(keywords[:5], timeframe=TIMEFRAMES, geo="KR")
            interest = pytrends.interest_over_time()

            if interest.empty:
                continue

            avg = interest.mean().to_dict()
            top_kw = [(k, v) for k, v in sorted(avg.items(), key=lambda x: x[1], reverse=True)
                      if k != "isPartial"]

            summary = ", ".join([f"{k}({int(v)})" for k, v in top_kw])

            rows.append({
                "run_id":       run_id,
                "industry":     industry,
                "keyword":      top_kw[0][0] if top_kw else keywords[0],
                "interest_avg": round(top_kw[0][1], 2) if top_kw else 0,
                "top_keywords": [k for k, _ in top_kw[:5]],
                "summary":      summary,
                "timeframe":    TIMEFRAMES,
                "geo":          "KR",
                "collected_at": now,
            })

            print(f"[TRENDS] {industry}: {summary}")
            time.sleep(1)

        except Exception as e:
            print(f"[TRENDS] {industry} 실패: {e}")

    return rows
