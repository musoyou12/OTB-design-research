"""
textEmbedding.py

Module A responsibility:
- 텍스트 → 의미 임베딩 벡터 생성
- 해석 / 요약 / 판단 / 키워드 생성 금지
- clustering 전 단계(vectorize layer)

Output:
- item_id
- embedding (list[float])
"""

import os
import json
import uuid
from datetime import datetime
from typing import List, Dict

import numpy as np
from tqdm import tqdm
from sentence_transformers import SentenceTransformer


# =========================
# Config
# =========================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
INPUT_DIR = os.path.join(BASE_DIR, "outputs", "preprocessed")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs", "embedded")

os.makedirs(OUTPUT_DIR, exist_ok=True)

MODEL_NAME = "all-MiniLM-L6-v2"  # 경량 + cosine similarity 안정적


# =========================
# Model Load
# =========================

model = SentenceTransformer(MODEL_NAME)


# =========================
# Utils
# =========================

def build_text(item: Dict) -> str:
    """
    임베딩 대상 텍스트 구성
    - 의미 해석 없이 단순 결합
    """
    parts = [
        item.get("title", ""),
        item.get("summary", ""),
        item.get("content", "")
    ]
    return " ".join([p for p in parts if p]).strip()


# =========================
# Core
# =========================

def run_text_embedding():
    print("[EMBED] loading preprocessed text data...")

    files = sorted(
        [f for f in os.listdir(INPUT_DIR) if f.startswith("preprocessed_")],
        reverse=True
    )
    if not files:
        raise FileNotFoundError("No preprocessed files found")

    with open(os.path.join(INPUT_DIR, files[0]), "r", encoding="utf-8") as f:
        items: List[Dict] = json.load(f)

    results: List[Dict] = []

    for item in tqdm(items):
        text = build_text(item)
        if not text:
            continue

        embedding = model.encode(
            text,
            normalize_embeddings=True
        ).tolist()

        results.append({
            "id": item.get("id", str(uuid.uuid4())),
            "source": "text",
            "embedding": embedding,
            "created_at": datetime.utcnow().isoformat()
        })

    output_path = os.path.join(
        OUTPUT_DIR,
        f"text_embeddings_{datetime.utcnow().date().isoformat()}.json"
    )

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"[EMBED] embeddings written → {output_path}")
    return output_path


# =========================
# Entry
# =========================

if __name__ == "__main__":
    run_text_embedding()
