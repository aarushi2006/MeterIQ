"""
Shared, cached API data access for the MeterIQ FastAPI layer.

The processed smart-meter CSVs are far too large (~20M rows) to re-read on
every HTTP request. This module builds a compact per-meter-per-hour Parquet
cache once (on first request, or explicitly at startup) and serves every
analytics endpoint from it. Raw values are summed per hour, so no values are
interpolated or fabricated.
"""

from __future__ import annotations

import glob
import json
import math
import os
import threading
from datetime import datetime, timezone
from typing import Dict, List, Optional

import pandas as pd

from ml.config import config

CACHE_VERSION = "v1"
HOURLY_CACHE_PATH = os.path.join(config.output_dir, "api", "hourly_consumption.parquet")
ANOMALY_OBSERVATIONS_PATH = os.path.join(
    config.output_dir, "anomaly", "observations_compact.parquet"
)

ANOMALY_DATASET_GLOB = ANOMALY_OBSERVATIONS_PATH
ANOMALY_SUMMARY_PATH = os.path.join(
    config.output_dir, "anomaly", "meter_anomaly_summary.parquet"
)
ANOMALY_RUN_PATH = os.path.join(config.output_dir, "anomaly", "anomaly_run.json")
FORECAST_PREDICTIONS_PATH = os.path.join(
    config.output_dir, "forecasting", "forecast_predictions.parquet"
)
FORECAST_REPORT_PATH = os.path.join(
    config.output_dir, "forecasting", "forecast_report.json"
)
PIPELINE_RUN_PATH = os.path.join(config.output_dir, "pipeline_run.json")

_hourly_cache: Optional[pd.DataFrame] = None
_summary_cache: Optional[pd.DataFrame] = None

# DuckDB gives each anomaly query its own in-memory connection. Two at a
# time bounds the worst case well below Render Free's 512 MB: one query
# peaks around 120 MB, so 2 x 120 MB + the hourly cache + the interpreter
# stays inside the limit. A third concurrent request waits its turn
# instead of pushing the process into swap/OOM.
_ANOMALY_QUERY_SEMAPHORE = threading.BoundedSemaphore(2)


def _log(message: str) -> None:
    print(f"[api-data] {message}", flush=True)


def _optimize_hourly_frame(frame: pd.DataFrame) -> pd.DataFrame:
    """Downcast the hourly cache to compact dtypes.

    The cache is ~1.07M rows. As read from the original Parquet it is
    ~174 MB in pandas - almost exactly a third of Render Free's 512 MB
    budget - because ``meter_id`` and ``region`` are stored as Python
    objects (~50-60 MB each). They have 84 and 2 distinct values, so
    categoricals are lossless and cut that to ~2 MB. ``interval_count``
    and ``day_of_week`` are small integers and fit in int32/int8.
    ``consumption``/``peak_consumption`` stay float64 so the totals the
    API returns are bit-for-bit identical to before.
    """
    for column in ("meter_id", "region"):
        if column in frame.columns and frame[column].dtype == object:
            frame[column] = frame[column].astype("category")
    if (
        "interval_count" in frame.columns
        and frame["interval_count"].dtype == "int64"
    ):
        frame["interval_count"] = frame["interval_count"].astype("int32")
    if (
        "day_of_week" in frame.columns
        and frame["day_of_week"].dtype != "int8"
    ):
        frame["day_of_week"] = frame["day_of_week"].astype("int8")
    return frame


def load_anomaly_summary() -> pd.DataFrame:
    global _summary_cache
    if _summary_cache is not None:
        return _summary_cache

    if not os.path.exists(ANOMALY_SUMMARY_PATH):
        _summary_cache = pd.DataFrame()
        return _summary_cache

    summary = pd.read_parquet(ANOMALY_SUMMARY_PATH)
    if "region" not in summary.columns:
        summary["region"] = "Unknown"
    summary["region"] = summary["region"].fillna("Unknown")
    _summary_cache = summary
    return summary


def region_map() -> Dict[str, str]:
    summary = load_anomaly_summary()
    if summary.empty or "meter_id" not in summary.columns:
        return {}
    return {
        str(row["meter_id"]): str(row.get("region") or "Unknown")
        for _, row in summary.iterrows()
    }


def _processed_files() -> List[str]:
    processed_dir = os.path.join(config.data_dir, "processed")
    if not os.path.isdir(processed_dir):
        return []
    return sorted(
        os.path.join(processed_dir, name)
        for name in os.listdir(processed_dir)
        if name.startswith("processed_") and name.lower().endswith(".csv")
    )


def _cache_is_stale(files: List[str]) -> bool:
    if not os.path.exists(HOURLY_CACHE_PATH):
        return True
    cache_mtime = os.path.getmtime(HOURLY_CACHE_PATH)
    return any(os.path.getmtime(path) > cache_mtime for path in files)


def build_hourly_cache(force: bool = False) -> pd.DataFrame:
    """
    Aggregate processed 3-minute telemetry into per-meter hourly sums.
    The resulting table is ~1M rows and is persisted to disk so subsequent
    startups do not pay the CSV scan cost again.
    """
    global _hourly_cache

    files = _processed_files()
    if not files:
        raise RuntimeError(
            f"No processed CSV files found in {os.path.join(config.data_dir, 'processed')}"
        )

    if not force and os.path.exists(HOURLY_CACHE_PATH) and not _cache_is_stale(files):
        _log(f"Loading hourly cache from {HOURLY_CACHE_PATH}")
        _hourly_cache = _optimize_hourly_frame(
            pd.read_parquet(HOURLY_CACHE_PATH)
        )
        return _hourly_cache

    _log(f"Building hourly cache from {len(files)} processed files")
    partials = []

    for path in files:
        _log(f"Reading {os.path.basename(path)}")
        for chunk in pd.read_csv(
            path,
            usecols=["timestamp", "consumption", "meter_id"],
            chunksize=1_000_000,
        ):
            chunk["timestamp"] = pd.to_datetime(chunk["timestamp"], errors="coerce")
            chunk = chunk.dropna(subset=["timestamp", "meter_id"])
            if chunk.empty:
                continue

            chunk["consumption"] = pd.to_numeric(
                chunk["consumption"], errors="coerce"
            ).fillna(0.0)
            chunk["hour"] = chunk["timestamp"].dt.floor("h")

            grouped = (
                chunk.groupby(["meter_id", "hour"], as_index=False)
                .agg(
                    consumption=("consumption", "sum"),
                    interval_count=("consumption", "size"),
                    peak_consumption=("consumption", "max"),
                )
            )
            partials.append(grouped)

    if not partials:
        raise RuntimeError("Processed files contained no usable telemetry rows")

    combined = pd.concat(partials, ignore_index=True)
    del partials

    hourly = (
        combined.groupby(["meter_id", "hour"], as_index=False)
        .agg(
            consumption=("consumption", "sum"),
            interval_count=("interval_count", "sum"),
            peak_consumption=("peak_consumption", "max"),
        )
        .sort_values(["meter_id", "hour"])
    )

    mapping = region_map()
    hourly["region"] = hourly["meter_id"].map(mapping).fillna("Unknown")
    hourly["meter_id"] = hourly["meter_id"].astype(str)
    hourly["day_of_week"] = hourly["hour"].dt.dayofweek
    hourly["is_weekend"] = hourly["day_of_week"].isin([5, 6])

    hourly = _optimize_hourly_frame(hourly)

    os.makedirs(os.path.dirname(HOURLY_CACHE_PATH), exist_ok=True)
    hourly.to_parquet(HOURLY_CACHE_PATH, index=False)

    _log(
        f"Hourly cache written: {len(hourly):,} rows, "
        f"{hourly['meter_id'].nunique()} meters"
    )
    _hourly_cache = hourly
    return hourly


def get_hourly() -> pd.DataFrame:
    global _hourly_cache
    if _hourly_cache is None:
        if os.path.exists(HOURLY_CACHE_PATH) and not _cache_is_stale(_processed_files()):
            _hourly_cache = _optimize_hourly_frame(
                pd.read_parquet(HOURLY_CACHE_PATH)
            )
        else:
            return build_hourly_cache()
    return _hourly_cache


def coverage_by_meter() -> pd.DataFrame:
    hourly = get_hourly()
    coverage = (
        hourly.groupby("meter_id")
        .agg(
            coverage_start=("hour", "min"),
            coverage_end=("hour", "max"),
            observed_intervals=("interval_count", "sum"),
            observed_hours=("hour", "nunique"),
        )
        .reset_index()
    )
    return coverage


def parse_range_days(range_value: str) -> Optional[int]:
    mapping = {
        "7D": 7,
        "30D": 30,
        "3M": 90,
        "6M": 180,
        "12M": 365,
        "1Y": 365,
    }
    if not range_value or str(range_value).upper() == "ALL":
        return None
    return mapping.get(str(range_value).upper())


def to_iso(value) -> Optional[str]:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def finite(value, default=0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if pd.isna(number) or number in (float("inf"), float("-inf")):
        return default
    return number


# ----------------------------------------------------------------------
# Anomaly observation artifact - DuckDB / partitioned Parquet
# ----------------------------------------------------------------------

def anomaly_status() -> Dict:
    available = os.path.isfile(ANOMALY_OBSERVATIONS_PATH)

    total_size = (
        os.path.getsize(ANOMALY_OBSERVATIONS_PATH)
        if available
        else 0
    )

    return {
        "available": available,
        "message": (
            "Observation-level anomaly records are available."
            if available
            else "Compact observation-level anomaly dataset is unavailable."
        ),
        "path": ANOMALY_OBSERVATIONS_PATH,
        "size_bytes": total_size,
    }


def _anomaly_connection():
    import duckdb

    con = duckdb.connect(":memory:")
    # Each query only needs a COUNT plus a top-50 sort over the compact
    # flagged dataset; 96 MB is comfortably above the observed working set
    # (~120 MB peak measured at the old 180 MB ceiling) while leaving room
    # for a second concurrent query inside 512 MB. If a query ever exceeds
    # this, DuckDB spills to disk rather than being OOM-killed.
    con.execute("SET memory_limit = '96MB'")
    con.execute("SET threads = 1")
    con.execute("SET preserve_insertion_order = false")
    return con


def _derive_anomaly_type(reasons: List[str]) -> Optional[str]:
    text = " ".join(reasons).lower()

    if not text:
        return None
    if "zero" in text:
        return "Unexpected Zero Usage"
    if "above" in text and (
        "standard deviation" in text or "consumption" in text
    ):
        return "Consumption Spike"
    if "below" in text and (
        "standard deviation" in text or "consumption" in text
    ):
        return "Consumption Drop"
    if "night" in text:
        return "Night-time Pattern"
    if "isolated" in text or "learned anomaly model" in text:
        return "Multivariate Outlier"
    return "Statistical Deviation"


def _prepare_anomaly_frame(frame: pd.DataFrame) -> pd.DataFrame:
    if frame.empty:
        return frame

    frame = frame.copy()
    frame["meter_id"] = frame["meter_id"].astype(str)
    frame["timestamp"] = pd.to_datetime(
        frame["timestamp"], errors="coerce"
    )
    frame = frame.dropna(subset=["timestamp"]).copy()

    if "region" not in frame.columns:
        frame["region"] = (
            frame["meter_id"].map(region_map()).fillna("Unknown")
        )
    else:
        frame["region"] = frame["region"].fillna("Unknown")

    def parse_reasons(value):
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                return parsed if isinstance(parsed, list) else [value]
            except Exception:
                return [value] if value else []
        return []

    if "reasons" not in frame.columns:
        frame["reasons"] = [[] for _ in range(len(frame))]
    else:
        frame["reasons"] = frame["reasons"].apply(parse_reasons)

    frame["severity"] = pd.to_numeric(
        frame["combined_severity"], errors="coerce"
    ).fillna(0.0)
    frame["anomaly_type"] = frame["reasons"].apply(_derive_anomaly_type)

    return frame


def query_anomalies(
    risk="all",
    region="all",
    meter_id="all",
    search="",
    page=1,
    page_size=50,
    sort="severity_desc",
):
    if not anomaly_status()["available"]:
        return pd.DataFrame(), 0, 1, page_size, 0

    page = max(1, int(page))
    page_size = max(1, min(500, int(page_size)))

    conditions = []
    params = [ANOMALY_DATASET_GLOB]

    if risk and str(risk).lower() != "all":
        conditions.append("risk_level = ?")
        params.append(str(risk).upper())

    if region and str(region).lower() != "all":
        conditions.append("lower(region) = lower(?)")
        params.append(str(region))

    if meter_id and str(meter_id).lower() != "all":
        conditions.append("meter_id = ?")
        params.append(str(meter_id))

    if search:
        conditions.append(
            """
            (
                strpos(lower(meter_id), lower(?)) > 0
                OR strpos(lower(region), lower(?)) > 0
                OR strpos(lower(CAST(reasons AS VARCHAR)), lower(?)) > 0
            )
            """
        )
        params.extend([str(search), str(search), str(search)])

    where_sql = (
        " WHERE " + " AND ".join(conditions)
        if conditions
        else ""
    )

    order_options = {
        "timestamp_asc": "timestamp ASC",
        "timestamp_desc": "timestamp DESC",
        "severity_desc": "combined_severity DESC, timestamp DESC",
    }
    order_sql = order_options.get(
        sort, "combined_severity DESC, timestamp DESC"
    )

    con = _anomaly_connection()
    source = "read_parquet(?)"

    try:
        total = con.execute(
            f"SELECT COUNT(*) FROM {source}{where_sql}",
            params,
        ).fetchone()[0]

        offset = (page - 1) * page_size

        rows = con.execute(
            f"""
            SELECT
                timestamp,
                meter_id,
                region,
                risk_level,
                combined_severity,
                consumption,
                reasons,
                deviation_z,
                pct_change_prev,
                deviation_from_same_hour_last_week,
                baseline_severity,
                isolation_forest_severity
            FROM {source}
            {where_sql}
            ORDER BY {order_sql}
            LIMIT ? OFFSET ?
            """,
            params + [page_size, offset],
        ).fetchdf()

        frame = _prepare_anomaly_frame(rows)
        total_pages = math.ceil(total / page_size) if total else 0

        return frame, total, page, page_size, total_pages
    finally:
        con.close()


def query_meter_anomalies(
    meter_id,
    page=1,
    page_size=50,
    risk="all",
):
    return query_anomalies(
        meter_id=str(meter_id),
        risk=risk,
        page=page,
        page_size=page_size,
        sort="timestamp_desc",
    )


def load_meter_anomaly_observations(meter_id) -> pd.DataFrame:
    if not anomaly_status()["available"]:
        return pd.DataFrame()

    con = _anomaly_connection()
    try:
        frame = con.execute(
            """
            SELECT timestamp, meter_id, risk_level
            FROM read_parquet(?)
            WHERE meter_id = ?
            """,
            [ANOMALY_DATASET_GLOB, str(meter_id)],
        ).fetchdf()

        if frame.empty:
            return frame

        frame["timestamp"] = pd.to_datetime(
            frame["timestamp"], errors="coerce"
        )
        return frame.dropna(subset=["timestamp"])
    finally:
        con.close()


def serialize_anomaly(row) -> Dict:
    reasons = row.get("reasons") or []
    if not isinstance(reasons, list):
        reasons = [str(reasons)]

    indicators = {}
    for key in [
        "deviation_z",
        "pct_change_prev",
        "deviation_from_same_hour_last_week",
        "baseline_severity",
        "isolation_forest_severity",
    ]:
        value = row.get(key)
        if value is not None and not pd.isna(value):
            indicators[key] = finite(value)

    return {
        "timestamp": to_iso(row.get("timestamp")),
        "meter_id": str(row.get("meter_id")),
        "region": row.get("region") or "Unknown",
        "risk_level": row.get("risk_level"),
        "severity": finite(row.get("severity")),
        "consumption": finite(row.get("consumption")),
        "anomaly_type": row.get("anomaly_type"),
        "type_derived": True,
        "reasons": reasons,
        "indicators": indicators,
    }
