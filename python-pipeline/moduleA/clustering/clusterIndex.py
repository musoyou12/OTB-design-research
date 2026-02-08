"""
similarityCluster.py

Module A - Internal Utility

Responsibility:
- embedding 기반 유사도 계산
- cluster 내부/간 거리 통계 산출
- clustering 품질을 보조적으로 검증

This module:
- DOES NOT create clusters
- DOES NOT merge/split clusters
- DOES NOT assign meaning or labels
- DOES NOT produce final outputs

Used internally by Module A only.
"""

import numpy as np
from typing import Dict, List
from sklearn.metrics.pairwise import cosine_similarity


# =========================
# Utils
# =========================

def cosine_sim_matrix(vectors: np.ndarray) -> np.ndarray:
    """
    Compute cosine similarity matrix for embeddings
    """
    return cosine_similarity(vectors)


def cluster_indices(labels: List[int]) -> Dict[int, List[int]]:
    """
    Map cluster label → item indices
    """
    clusters = {}
    for idx, label in enumerate(labels):
        clusters.setdefault(label, []).append(idx)
    return clusters


# =========================
# Core Metrics
# =========================

def intra_cluster_similarity(
    vectors: np.ndarray,
    labels: List[int]
) -> Dict[str, float]:
    """
    Calculate average intra-cluster cosine similarity
    """
    sim_matrix = cosine_sim_matrix(vectors)
    clusters = cluster_indices(labels)

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
    Calculate average inter-cluster cosine similarity
    """
    sim_matrix = cosine_sim_matrix(vectors)
    clusters = cluster_indices(labels)

    cluster_keys = list(clusters.keys())
    sims = []

    for i in range(len(cluster_keys)):
        for j in range(i + 1, len(cluster_keys)):
            for idx_i in clusters[cluster_keys[i]]:
                for idx_j in clusters[cluster_keys[j]]:
                    sims.append(sim_matrix[idx_i][idx_j])

    if not sims:
        return 0.0

    return float(np.mean(sims))


# =========================
# Public Interface
# =========================

def compute_similarity_stats(
    vectors: np.ndarray,
    labels: List[int]
) -> Dict[str, object]:
    """
    Summary statistics for clustering quality inspection
    """
    return {
        "intra_cluster_similarity": intra_cluster_similarity(vectors, labels),
        "inter_cluster_similarity": inter_cluster_similarity(vectors, labels),
        "metric": "cosine_similarity"
    }
