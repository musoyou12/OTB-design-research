"""
trendAnalyzer.py
- Google Trends Raw 데이터 분석 파이프라인
- 일일 집계 / 변화량 계산 / 트렌드 라벨링
- 리스트 기반 데이터를 Dict 인덱스로 구조화

INPUT:
- data/raw/google_trends/*.json

OUTPUT:
- outputs/trends/daily_trend_summary.json
- outputs/trends/trend_index.json
"""

import json
import pandas as pd
from pathlib import Path
from collections import defaultdict

# =========================
# Path 설정
# =========================

RAW_PATH = Path("data/raw/google_trends")
OUTPUT_DIR = Path("outputs/trends")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# =========================
# 1️⃣ Raw Data 로드
# =========================

def load_trends() -> pd.DataFrame:
    files = list(RAW_PATH.glob("*.json"))
    rows = []

    for file in files:
        with open(file, "r", encoding="utf-8") as f:
            rows.extend(json.load(f))

    if not rows:
        raise ValueError("❌ Google Trends raw 데이터가 없습니다.")

    return pd.DataFrame(rows)


# =========================
# 2️⃣ 일일 집계
# =========================

def aggregate_daily(df: pd.DataFrame) -> pd.DataFrame:
    df["date"] = pd.to_datetime(df["date"]).dt.date

    daily = (
        df.groupby(["keyword", "date"])
        .agg(
            avg_value=("value", "mean"),
            peak_value=("value", "max"),
            count=("value", "count"),
        )
        .reset_index()
    )

    return daily


# =========================
# 3️⃣ 변화량 계산
# =========================

def compute_delta(daily_df: pd.DataFrame) -> pd.DataFrame:
    daily_df = daily_df.sort_values(["keyword", "date"])

    daily_df["prev_avg"] = (
        daily_df.groupby("keyword")["avg_value"].shift(1)
    )

    daily_df["delta"] = (
        (daily_df["avg_value"] - daily_df["prev_avg"])
        / daily_df["prev_avg"]
    )

    return daily_df


# =========================
# 4️⃣ 트렌드 라벨링
# =========================

def label_trend(delta: float) -> str:
    if pd.isna(delta):
        return "new"
    if delta > 0.15:
        return "rising"
    if delta < -0.15:
        return "falling"
    return "stable"


def apply_labels(df: pd.DataFrame) -> pd.DataFrame:
    df["trend_label"] = df["delta"].apply(label_trend)
    return df


# =========================
# 5️⃣ 🔥 인덱싱 구조 생성 (핵심)
# =========================

def build_trend_index(df: pd.DataFrame) -> dict:
    """
    keyword → 시계열 데이터 리스트
    """
    trend_index = defaultdict(list)

    for _, row in df.iterrows():
        trend_index[row["keyword"]].append({
            "date": str(row["date"]),
            "avg_value": round(row["avg_value"], 2),
            "peak_value": int(row["peak_value"]),
            "delta": None if pd.isna(row["delta"]) else round(row["delta"], 3),
            "trend_label": row["trend_label"],
        })

    return trend_index


# =========================
# 6️⃣ 결과 저장
# =========================

def save_outputs(df: pd.DataFrame, trend_index: dict):
    # 1) 집계 결과 저장
    summary_path = OUTPUT_DIR / "daily_trend_summary.json"
    df.to_json(summary_path, orient="records", force_ascii=False, indent=2)

    # 2) 인덱스 저장
    index_path = OUTPUT_DIR / "trend_index.json"
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(trend_index, f, ensure_ascii=False, indent=2)

    print(f"[ANALYZER] Summary saved → {summary_path}")
    print(f"[ANALYZER] Index saved → {index_path}")


# =========================
# Entry Point
# =========================

def run_trend_analysis():
    print("[ANALYZER] Loading raw data...")
    df = load_trends()

    print("[ANALYZER] Aggregating daily trends...")
    daily = aggregate_daily(df)

    print("[ANALYZER] Computing deltas...")
    with_delta = compute_delta(daily)

    print("[ANALYZER] Applying trend labels...")
    labeled = apply_labels(with_delta)

    print("[ANALYZER] Building indexed structure...")
    trend_index = build_trend_index(labeled)

    print("[ANALYZER] Saving outputs...")
    save_outputs(labeled, trend_index)

    print("[ANALYZER] ✅ Trend analysis completed.")


if __name__ == "__main__":
    run_trend_analysis()
