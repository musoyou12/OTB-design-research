"""
similarityCluster.py

Module A - Internal Utility

Responsibility:
- embedding 기반 유사도 계산
- cluster 내부 응집도 / cluster 간 분리도 산출
- clustering 품질 검증 보조

Rules:
- cluster 생성 ❌
- cluster 병합/분리 ❌
- 의미/키워드/해석 ❌
- 단독 출력(JSON write) ❌
"""

from typing import Dict, List
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity


# =========================
# Utils
# =========================

def _build_cluster_index(labels: List[int]) -> Dict[int, List[int]]:
    clusters = {}
    for idx, label in enumerate(labels):
        clusters.setdefault(label, []).append(idx)
    return clusters


def _cosine_matrix(vectors: np.ndarray) -> np.ndarray:
    return cosine_similarity(vectors)


# =========================
# Metrics
# =========================

def intra_cluster_similarity(
    vectors: np.ndarray,
    labels: List[int]
) -> Dict[str, float]:
    """
    평균 cluster 내부 cosine similarity
    """
    sim_matrix = _cosine_matrix(vectors)
    clusters = _build_cluster_index(labels)

    result = {}

    for label, indices in clusters.items():
        if len(indices) < 2:
            result[f"cluster_{label}"] = 1.0
            continue

        sims = []
        for i in range(len(indices)):
            for j in range(i + 1, len(indices)):
                sims.append(sim_matrix[indices[i]][indices[j]])

        result[f"cluster_{label}"] = float(np.mean(sims))

    return result


def inter_cluster_similarity(
    vectors: np.ndarray,
    labels: List[int]
) -> float:
    """
    평균 cluster 간 cosine similarity
    """
    sim_matrix = _cosine_matrix(vectors)
    clusters = _build_cluster_index(labels)

    keys = list(clusters.keys())
    sims = []

    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            for idx_i in clusters[keys[i]]:
                for idx_j in clusters[keys[j]]:
                    sims.append(sim_matrix[idx_i][idx_j])

    return float(np.mean(sims)) if sims else 0.0


# =========================
# Public Interface
# =========================

def compute_similarity_stats(
    vectors: np.ndarray,
    labels: List[int]
) -> Dict[str, object]:
    """
    clustering 품질 참고용 통계 (Module A 내부용)
    """
    return {
        "metric": "cosine_similarity",
        "intra_cluster_similarity": intra_cluster_similarity(vectors, labels),
        "inter_cluster_similarity": inter_cluster_similarity(vectors, labels)
    }
