import json
import pandas as pd
from pathlib import Path

RAW_PATH = Path("data/raw/google_trends")

# =========================
# Raw Data 로드
# =========================
def load_trends():
    files = list(RAW_PATH.glob("*.json"))
    rows = []

    for file in files:
        with open(file, "r", encoding="utf-8") as f:
            rows.extend(json.load(f))

    return pd.DataFrame(rows)


# =========================
# 일일 집계
# =========================
def aggregate_daily(df: pd.DataFrame):
    df["date"] = pd.to_datetime(df["date"]).dt.date

    daily = (
        df.groupby(["keyword", "date"])
        .agg(
            avg_value=("value", "mean"),
            peak_value=("value", "max"),
            count=("value", "count")
        )
        .reset_index()
    )

    return daily


# =========================
# 변화량 계산
# =========================
def compute_delta(daily_df: pd.DataFrame):
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
# 트렌드 라벨링
# =========================
def label_trend(delta):
    if pd.isna(delta):
        return "new"
    if delta > 0.15:
        return "rising"
    if delta < -0.15:
        return "falling"
    return "stable"


def apply_labels(df):
    df["trend_label"] = df["delta"].apply(label_trend)
    return df


# =========================
# Output 저장
# =========================
def save_output(df):
    output_dir = Path("outputs/trends")
    output_dir.mkdir(parents=True, exist_ok=True)

    output_path = output_dir / "daily_trend_summary.json"
    df.to_json(output_path, orient="records", force_ascii=False, indent=2)

    print(f"[ANALYZER] Saved → {output_path}")


# =========================
# Entry Point
# =========================
if __name__ == "__main__":
    df = load_trends()
    daily = aggregate_daily(df)
    with_delta = compute_delta(daily)
    final = apply_labels(with_delta)
    save_output(final)
