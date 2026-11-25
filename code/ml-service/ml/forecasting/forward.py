"""Train and materialize honest hourly, seven-day-ahead meter forecasts.

The serving API reads the compact artifact written here; it never invents a
future chart from a historical backtest.  Forecasts begin immediately after
each meter's final recorded hour, which is important because this dataset is
historical rather than a live telemetry stream.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

from ml import api_data
from ml.config import config

FEATURES = ["meter_code", "hour_num", "day_of_week", "is_weekend", "lag_1h", "lag_24h", "lag_168h", "mean_24h", "mean_168h", "trend_24h"]


def _features(frame: pd.DataFrame, meter_codes: dict[str, int]) -> pd.DataFrame:
    out = frame.sort_values(["meter_id", "hour"]).copy()
    g = out.groupby("meter_id", observed=True)["consumption"]
    out["lag_1h"] = g.shift(1)
    out["lag_24h"] = g.shift(24)
    out["lag_168h"] = g.shift(168)
    shifted = g.shift(1)
    out["mean_24h"] = shifted.groupby(out["meter_id"], observed=True).transform(lambda x: x.rolling(24, min_periods=12).mean())
    out["mean_168h"] = shifted.groupby(out["meter_id"], observed=True).transform(lambda x: x.rolling(168, min_periods=48).mean())
    out["trend_24h"] = out["mean_24h"] - out["mean_168h"]
    out["hour_num"] = out["hour"].dt.hour
    out["day_of_week"] = out["hour"].dt.dayofweek
    out["is_weekend"] = (out["day_of_week"] >= 5).astype("int8")
    out["meter_code"] = out["meter_id"].astype(str).map(meter_codes).astype("int16")
    return out


def _next_features(meter_id: str, timestamp: pd.Timestamp, values: list[float], meter_code: int) -> dict:
    def lag(n: int) -> float:
        return float(values[-n]) if len(values) >= n else float(values[-1])
    mean24 = float(np.mean(values[-24:]))
    mean168 = float(np.mean(values[-168:]))
    return {
        "meter_code": meter_code, "hour_num": timestamp.hour, "day_of_week": timestamp.dayofweek,
        "is_weekend": int(timestamp.dayofweek >= 5), "lag_1h": lag(1), "lag_24h": lag(24),
        "lag_168h": lag(168), "mean_24h": mean24, "mean_168h": mean168,
        "trend_24h": mean24 - mean168,
    }


def run_forward_forecast_pipeline(horizon_hours: int = 168, train_days: int = 60) -> dict:
    hourly = api_data.get_hourly().copy()
    hourly["hour"] = pd.to_datetime(hourly["hour"], errors="coerce")
    hourly = hourly.dropna(subset=["hour", "meter_id", "consumption"])
    hourly["meter_id"] = hourly["meter_id"].astype(str)
    meter_ids = sorted(hourly["meter_id"].unique())
    meter_codes = {meter_id: index for index, meter_id in enumerate(meter_ids)}

    cutoff = hourly.groupby("meter_id", observed=True)["hour"].transform("max") - pd.Timedelta(days=train_days)
    training_source = hourly.loc[hourly["hour"] >= cutoff, ["meter_id", "hour", "consumption"]]
    featured = _features(training_source, meter_codes).dropna(subset=FEATURES + ["consumption"])
    validation_cutoff = featured.groupby("meter_id", observed=True)["hour"].transform("max") - pd.Timedelta(days=14)
    validation = featured.loc[featured["hour"] > validation_cutoff].copy()
    train = featured.loc[featured["hour"] <= validation_cutoff]
    if train.empty or validation.empty:
        raise ValueError("Insufficient hourly history for forward forecast training")

    model = HistGradientBoostingRegressor(
        random_state=config.random_seed, max_iter=60, learning_rate=0.08,
        max_leaf_nodes=31, l2_regularization=1.0,
    ).fit(train[FEATURES].astype("float32"), train["consumption"].astype("float32"))
    validation["prediction"] = model.predict(validation[FEATURES].astype("float32"))
    validation["residual"] = validation["consumption"] - validation["prediction"]
    residual_std = validation.groupby("meter_id", observed=True)["residual"].std().fillna(validation["residual"].std()).to_dict()

    rows = []
    for meter_id, group in hourly.groupby("meter_id", observed=True):
        group = group.sort_values("hour")
        values = group["consumption"].astype(float).tolist()
        timestamp = pd.Timestamp(group["hour"].iloc[-1]).floor("h")
        interval = float(residual_std.get(meter_id, validation["residual"].std() or 0)) * 1.96
        code = meter_codes[str(meter_id)]
        for step in range(1, horizon_hours + 1):
            future_time = timestamp + pd.Timedelta(hours=step)
            baseline = values[-168] if len(values) >= 168 else values[-1]
            prediction = max(0.0, float(model.predict(pd.DataFrame([_next_features(str(meter_id), future_time, values, code)])[FEATURES])[0]))
            rows.append({"meter_id": str(meter_id), "timestamp": future_time, "predicted": prediction,
                         "baseline": float(baseline), "lower_bound": max(0.0, prediction - interval),
                         "upper_bound": prediction + interval, "step_hour": step})
            values.append(prediction)

    output_dir = os.path.dirname(api_data.FORWARD_FORECASTS_PATH)
    os.makedirs(output_dir, exist_ok=True)
    predictions = pd.DataFrame(rows)
    predictions.to_parquet(api_data.FORWARD_FORECASTS_PATH, index=False)
    joblib.dump({"model": model, "features": FEATURES, "meter_codes": meter_codes}, api_data.FORWARD_FORECAST_MODEL_PATH)
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(), "model_name": "HistGradientBoostingRegressor (hourly recursive forward forecast)",
        "horizon_hours": horizon_hours, "training_days_per_meter": train_days, "n_train_rows": int(len(train)),
        "validation_mae": float(validation["residual"].abs().mean()), "feature_columns": FEATURES,
        "coverage": {"start": predictions["timestamp"].min().isoformat(), "end": predictions["timestamp"].max().isoformat()},
        "note": "Forecasts start after each meter's last recorded hour; they are not a substitute for live telemetry.",
    }
    with open(api_data.FORWARD_FORECAST_REPORT_PATH, "w") as handle:
        json.dump(report, handle, indent=2)
    return report


if __name__ == "__main__":
    print(json.dumps(run_forward_forecast_pipeline(), indent=2))
