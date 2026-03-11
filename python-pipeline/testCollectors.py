"""
testCollectors.py

수집기 결과 빠르게 확인용 (Supabase 저장 없음)
실행: python testCollectors.py
"""

import sys
import os
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

from moduleA.collectors.googleTrendsCollector import collect_trends
from moduleA.collectors.visualTrendCollector import collect_visual_trends

RUN_ID = "test-run-001"

print("\n" + "="*50)
print("[ Google Trends — INTENT 신호 ]")
print("="*50)
trends = collect_trends(RUN_ID)
for item in trends:
    print(f"\n  [{item['industry']}] {item['keyword']} (평균 관심도: {item['interest_avg']})")
    print(f"  상위 키워드: {', '.join(item['top_keywords'])}")
    print(f"  요약: {item['summary']}")

print("\n" + "="*50)
print("[ Visual Trends — HOW 신호 ]")
print("="*50)
visuals = collect_visual_trends(RUN_ID)
for item in visuals[:10]:
    print(f"\n  [{item['source_name']}] {item['title']}")
    print(f"  {item['source_url']}")

print(f"\n총 수집: Trends {len(trends)}개 / Visual {len(visuals)}개")
