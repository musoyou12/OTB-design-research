# python-pipeline/preprocess.py

import os
import json
import uuid
from datetime import datetime

# 🔥 핵심: 이 파일 기준으로 프로젝트 루트 계산
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

RAW_DIR = os.path.join(BASE_DIR, "data", "raw")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs", "preprocessed")

os.makedirs(OUTPUT_DIR, exist_ok=True)


def load_json_files(path):
    files = []
    for file in os.listdir(path):
        if file.endswith(".json"):
            with open(os.path.join(path, file), "r", encoding="utf-8") as f:
                files.append(json.load(f))
    return files


def normalize_item(item, source):
    return {
        "id": str(uuid.uuid4()),
        "source": source,
        "source_url": item.get("url", ""),
        "domain": item.get("domain", ""),
        "title": item.get("title", "")[:300],
        "content": item.get("content", "")[:3000],
        "tags": item.get("tags", []),
        "published_at": item.get("published_at"),
        "collected_at": datetime.utcnow().isoformat(),
        "language": item.get("language", "unknown"),
        "meta": {
            "author": item.get("author"),
            "likes": item.get("likes", 0),
            "shares": item.get("shares", 0)
        }
    }


def run_preprocess():
    all_results = []

    for source in ["news", "pinterest", "instagram"]:
        source_path = os.path.join(RAW_DIR, source)
        if not os.path.exists(source_path):
            print(f"[PREPROCESS] Skip: {source_path} not found")
            continue

        raw_files = load_json_files(source_path)
        for file_data in raw_files:
            # 🔥 여기 중요: crawler는 "파일 안에 리스트"를 저장함
            for item in file_data:
                normalized = normalize_item(item, source)
                all_results.append(normalized)

    output_path = os.path.join(
        OUTPUT_DIR,
        f"preprocessed_{datetime.utcnow().date().isoformat()}.json"
    )

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)

    print(f"[PREPROCESS] {len(all_results)} items processed → {output_path}")


if __name__ == "__main__":
    run_preprocess()
