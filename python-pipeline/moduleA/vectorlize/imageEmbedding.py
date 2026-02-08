"""
imageEmbedding.py

Module A responsibility:
- 이미지 → 의미 임베딩 벡터 생성
- 해석 / 분류 / 판단 금지
- clustering 전 단계(vectorize layer)

Output:
- image_id
- embedding (list[float])
"""

import os
import json
from datetime import datetime
from typing import List, Dict

import torch
import clip
from PIL import Image
from tqdm import tqdm


# =========================
# Config
# =========================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
INPUT_DIR = os.path.join(BASE_DIR, "outputs", "images")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs", "embedded")

os.makedirs(OUTPUT_DIR, exist_ok=True)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MODEL_NAME = "ViT-B/32"


# =========================
# Model Load
# =========================

model, preprocess = clip.load(MODEL_NAME, device=DEVICE)
model.eval()


# =========================
# Core
# =========================

def embed_image(image_path: str) -> List[float]:
    image = preprocess(Image.open(image_path).convert("RGB")).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        embedding = model.encode_image(image)
        embedding = embedding / embedding.norm(dim=-1, keepdim=True)

    return embedding.squeeze(0).cpu().tolist()


def run_image_embedding():
    print("[EMBED] loading images...")

    results: List[Dict] = []

    image_files = [
        f for f in os.listdir(INPUT_DIR)
        if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
    ]

    if not image_files:
        raise FileNotFoundError("No image files found")

    for filename in tqdm(image_files):
        image_path = os.path.join(INPUT_DIR, filename)

        try:
            embedding = embed_image(image_path)
        except Exception as e:
            print(f"[EMBED] failed: {filename} ({e})")
            continue

        results.append({
            "id": filename,
            "source": "image",
            "path": image_path,
            "embedding": embedding,
            "created_at": datetime.utcnow().isoformat()
        })

    output_path = os.path.join(
        OUTPUT_DIR,
        f"image_embeddings_{datetime.utcnow().date().isoformat()}.json"
    )

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"[EMBED] embeddings written → {output_path}")
    return output_path


# =========================
# Entry
# =========================

if __name__ == "__main__":
    run_image_embedding()
