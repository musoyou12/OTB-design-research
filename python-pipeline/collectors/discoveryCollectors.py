"""
discoveryCollectors.py

Purpose
-------
- Topic Modeling 결과를 입력으로 받아
- 관련 레퍼런스 / 브랜드 / 프로덕트 후보를 탐색·수집
- 데이터셋의 탐색 범위와 최신성을 확장

❌ 판단
❌ 추천
❌ 우선순위 결정
"""

import os
import json
import uuid
from datetime import datetime
from typing import List, Dict

import openai

OUTPUT_DIR = "outputs/discovery"
os.makedirs(OUTPUT_DIR, exist_ok=True)

NOW = datetime.utcnow().isoformat()


class DiscoveryCollector:
    def __init__(self, openai_key: str):
        self.client = openai.Client(api_key=openai_key)

    def collect_from_topics(
        self,
        run_id: str,
        topic_result: Dict
    ) -> List[Dict]:
        """
        topic_result 예시:
        {
          "topic_id": "t-123",
          "domain": "Beauty",
          "keywords": ["serum", "ingredient", "clinical"],
          "country": "KR",
          "period": "2024-Q4"
        }
        """

        query_text = self._build_query(topic_result)

        references = self._search_references(query_text)

        results = []
        for ref in references:
            results.append({
                "discovery_id": str(uuid.uuid4()),
                "run_id": run_id,
                "topic_id": topic_result["topic_id"],
                "domain": topic_result.get("domain"),
                "country": topic_result.get("country"),
                "period": topic_result.get("period"),
                "source": ref.get("source"),
                "title": ref.get("title"),
                "url": ref.get("url"),
                "snippet": ref.get("snippet"),
                "collected_at": NOW
            })

        return results

    def _build_query(self, topic_result: Dict) -> str:
        """
        Topic → 탐색용 쿼리 변환
        """
        keywords = ", ".join(topic_result["keywords"])
        domain = topic_result.get("domain", "")

        return f"{domain} design references related to {keywords}"

    def _search_references(self, query: str) -> List[Dict]:
        """
        실제 구현 시:
        - Perplexity
        - Google Custom Search
        - Bing Search API
        """

        # Stub (의도 명확화용)
        return [
            {
                "source": "web",
                "title": "Sample Design Reference",
                "url": "https://example.com",
                "snippet": f"Reference related to {query}"
            }
        ]


def save_discovery_results(run_id: str, results: List[Dict]):
    output_path = os.path.join(
        OUTPUT_DIR,
        f"discovery_{run_id}_{datetime.utcnow().date().isoformat()}.json"
    )

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"[DISCOVERY] {len(results)} items saved")


def run_discovery(run_id: str, topic_results: List[Dict]):
    collector = DiscoveryCollector(openai_key=os.getenv("OPENAI_KEY"))

    all_results = []

    for topic in topic_results:
        discovered = collector.collect_from_topics(run_id, topic)
        all_results.extend(discovered)

    save_discovery_results(run_id, all_results)
