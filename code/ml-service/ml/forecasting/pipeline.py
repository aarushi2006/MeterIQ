"""
Load forecasting (UC2) pipeline.

The current MeterIQ dataset is sampled every 3 minutes, not every 15
minutes. The original pipeline assumed 15-minute data, looked for
non-existent Parquet files in the wrong directory, and used a 672-row
"one week" lag that is only correct for 15-minute sampling. This version
runs against the real Phase A feature cache and uses the already-computed
3-minute lag/rolling features.

Method:
- one chronological holdout per meter (the final ``test_days`` of that
  meter's history),
- a pooled HistGradientBoostingRegressor trained on all meters' earlier
  rows, using only features that are available at prediction time,
- the same-hour-last-week baseline from the existing ``lag_1w`` feature,
- MAE/MAPE reported per meter for both model and baseline.

Run:
    python -m ml.forecasting.pipeline
    python -m ml.forecasting.pipeline --sample-meters BR02 MH01
"""

from __future__ import annotations

import argparse
import glob
import json
import os
from datetime import datetime, timezone
from typing import List, Optional

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

from ml.config import config
from ml.forecasting.evaluation import (
    evaluate_model_performance,
    summarize_performance,
)

# Features produced by Phase A.5 that are known before the target timestamp.
# `consumption` itself is deliberately excluded, as are identifiers and
# free-text fields.
FORECAST_FEATURES = [
    "lag_1_interval",
    "lag_1h",
    "lag_4h",
    "lag_1d",
    "lag_1w",
    "rolling_mean_1h",
    "rolling_std_1h",
    "rolling_mean_1d",
    "rolling_std_1d",
    "abs_change_prev",
    "pct_change_prev",
    "deviation_from_rolling_mean",
    "deviation_z",
    "deviation_from_same_hour_last_week",
    "hour",
    "day_of_week",
    "day",
    "month",
    "is_weekend",
    "is_holiday",
    "temp_proxy_c",
    "is_extreme_temp_proxy",
]

READ_COLUMNS = [
    "meter_id",
    "timestamp",
    "consumption",
    "region",
    "lag_1w",
] + FORECAST_FEATURES


def _latest_features_path() -> str:
    pattern = os.path.join(config.cache_dir, "features_*.parquet")
    matches = sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True)
    if not matches:
        raise FileNotFoundError(
            "No Phase A feature cache found. Run `python -m ml.pipeline` "
            f"first; expected a file matching {pattern}."
        )
    return matches[0]


def _available_columns(path: str, wanted: List[str]) -> List[str]:
    import pyarrow.parquet as pq

    schema = set(pq.ParquetFile(path).schema.names)
    seen = set()
    available = []
    for column in wanted:
        if column in schema and column not in seen:
            available.append(column)
            seen.add(column)
    return available


def run_forecasting_pipeline(
    sample_meters: Optional[List[str]] = None,
    force_recompute: bool = False,
    features_path: Optional[str] = None,
    test_days: int = 30,
    output_dir: Optional[str] = None,
):
    """
    Train and evaluate the load forecaster, then write the artifacts read by
    the FastAPI `/forecast/*` endpoints.

    ``force_recompute`` is accepted for compatibility with the pipeline
    runner. The artifact is always recomputed when this function is called;
    there is no cache for the trained model.
    """
    del force_recompute  # kept so callers/CLI remain compatible

    features_path = features_path or _latest_features_path()
    output_dir = output_dir or os.path.join(config.output_dir, "forecasting")
    os.makedirs(output_dir, exist_ok=True)

    wanted = _available_columns(features_path, READ_COLUMNS)
    missing = [column for column in ["meter_id", "timestamp", "consumption"] if column not in wanted]
    if missing:
        raise ValueError(f"Feature file is missing required columns: {missing}")

    filters = None
    if sample_meters:
        filters = [("meter_id", "in", [str(meter) for meter in sample_meters])]

    print(f"[forecast] reading features from {features_path}", flush=True)
    frame = pd.read_parquet(features_path, columns=wanted, filters=filters)
    if frame.empty:
        raise ValueError("No rows matched the requested meters/features")

    frame["timestamp"] = pd.to_datetime(frame["timestamp"], errors="coerce")
    frame = frame.dropna(subset=["timestamp", "consumption", "meter_id"])
    frame = frame.sort_values(["meter_id", "timestamp"]).reset_index(drop=True)

    # Per-meter chronological holdout: the final `test_days` of each meter's
    # own history. Using a single global cut-off would leave meters with
    # shorter coverage with little or no test data.
    max_timestamp = frame.groupby("meter_id")["timestamp"].transform("max")
    test_mask = frame["timestamp"] > (max_timestamp - pd.Timedelta(days=test_days))
    test = frame.loc[test_mask].copy()
    train = frame.loc[~test_mask].copy()
    del frame

    if test.empty:
        raise ValueError("Chronological holdout is empty; check timestamps/test_days")
    if train.empty:
        raise ValueError("Training split is empty; check timestamps/test_days")

    feature_columns = [column for column in FORECAST_FEATURES if column in train.columns]
    if not feature_columns:
        raise ValueError("No forecasting feature columns are available in the feature file")

    # float32 keeps the full-history training matrix within a reasonable
    # memory footprint. HistGradientBoostingRegressor handles NaN features
    # natively, so no imputation/fabrication is introduced here.
    n_train_rows = len(train)
    X_train = train[feature_columns].astype("float32")
    y_train = train["consumption"].astype("float32")
    del train

    print(
        f"[forecast] training on {len(X_train):,} rows x {len(feature_columns)} features",
        flush=True,
    )
    model = HistGradientBoostingRegressor(
        random_state=config.random_seed,
        max_iter=100,
        learning_rate=0.1,
        max_leaf_nodes=31,
        l2_regularization=1.0,
    )
    model.fit(X_train, y_train)
    del X_train, y_train

    X_test = test[feature_columns].astype("float32")
    test["model_pred"] = model.predict(X_test).astype("float64")
    del X_test

    # The Phase A feature `lag_1w` is the same-hour-last-week baseline for
    # this 3-minute dataset. It was already computed per meter, so no
    # 15-minute lag constant is applied here.
    if "lag_1w" in test.columns:
        test["baseline_pred"] = pd.to_numeric(test["lag_1w"], errors="coerce")
    else:
        test["baseline_pred"] = np.nan

    before = len(test)
    test = test.dropna(subset=["baseline_pred", "model_pred", "consumption"]).copy()
    if test.empty:
        raise ValueError(
            "No test rows had both a model prediction and a same-week-last-hour "
            "baseline; regenerate Phase A features first."
        )
    if len(test) < before:
        print(
            f"[forecast] dropped {before - len(test):,} test rows without a "
            "same-week baseline/prediction",
            flush=True,
        )

    model_metrics = evaluate_model_performance(test, "consumption", "model_pred")
    baseline_metrics = evaluate_model_performance(test, "consumption", "baseline_pred")

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "model_name": "HistGradientBoostingRegressor (per-meter chronological holdout)",
        "sampling_interval": f"{60 // config.intervals_per_hour} minutes",
        "test_days": test_days,
        "features_path": features_path,
        "feature_columns": feature_columns,
        "n_train_rows": n_train_rows,
        "n_test_rows": int(len(test)),
        "model_summary": summarize_performance(model_metrics),
        "baseline_summary": summarize_performance(baseline_metrics),
        "per_meter_metrics": model_metrics.to_dict(orient="index"),
        "per_meter_baseline_metrics": baseline_metrics.to_dict(orient="index"),
    }

    summary_path = os.path.join(output_dir, "forecast_predictions.parquet")
    predictions = test[
        ["meter_id", "timestamp", "consumption", "model_pred", "baseline_pred"]
    ].copy()
    predictions["meter_id"] = predictions["meter_id"].astype(str)
    predictions.to_parquet(summary_path, index=False)

    report_path = os.path.join(output_dir, "forecast_report.json")
    with open(report_path, "w") as handle:
        json.dump(report, handle, indent=2, default=float)

    print(
        f"[forecast] wrote {len(predictions):,} predictions for "
        f"{predictions['meter_id'].nunique()} meters to {summary_path}",
        flush=True,
    )
    print(f"[forecast] report: {report_path}", flush=True)
    return report


def _parse_args():
    parser = argparse.ArgumentParser(description="MeterIQ load forecasting pipeline")
    parser.add_argument("--sample-meters", nargs="*", default=None)
    parser.add_argument("--features-path", default=None)
    parser.add_argument("--output-dir", default=None)
    parser.add_argument("--test-days", type=int, default=30)
    parser.add_argument("--force-recompute", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    run_forecasting_pipeline(
        sample_meters=args.sample_meters,
        force_recompute=args.force_recompute,
        features_path=args.features_path,
        test_days=args.test_days,
        output_dir=args.output_dir,
    )
