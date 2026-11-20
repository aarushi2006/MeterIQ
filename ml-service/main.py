import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ml import api_data
from ml.config import config
from ml.pipeline import run_phase_a
from ml.forecasting.pipeline import run_forecasting_pipeline

# ----------------------------------------------------------------------
# Setup
# ----------------------------------------------------------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MeterIQ-API")

app = FastAPI(title="MeterIQ ML API", version="1.1.0")

origins = os.environ.get(
    "ML_CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

INVESTIGATIONS_FILE = os.path.join(config.output_dir, "investigations.json")

# ----------------------------------------------------------------------
# Persistence (legacy JSON investigations - the Node API owns cases)
# ----------------------------------------------------------------------


def load_investigations() -> List[Dict]:
    if not os.path.exists(INVESTIGATIONS_FILE):
        return []
    try:
        with open(INVESTIGATIONS_FILE, "r") as file:
            return json.load(file)
    except Exception:
        logger.exception("Unable to load investigations")
        return []


def save_investigations(data: List[Dict]):
    os.makedirs(os.path.dirname(INVESTIGATIONS_FILE), exist_ok=True)
    with open(INVESTIGATIONS_FILE, "w") as file:
        json.dump(data, file, indent=4)


# ----------------------------------------------------------------------
# Pydantic Models
# ----------------------------------------------------------------------


class MeterInfo(BaseModel):
    meter_id: str
    region: Optional[str] = None
    coverage_start: Optional[str] = None
    coverage_end: Optional[str] = None
    total_observations: int = 0
    normal_count: int = 0
    review_count: int = 0
    high_risk_count: int = 0
    anomaly_count: int = 0
    anomaly_rate: float = 0.0
    max_severity: Optional[float] = None
    mean_severity: Optional[float] = None
    data_quality_flag_count: int = 0
    most_common_reasons: List[str] = Field(default_factory=list)
    risk_level: str = "NORMAL"


class ConsumptionPoint(BaseModel):
    timestamp: str
    consumption: float
    is_anomaly: bool = False
    risk_level: Optional[str] = None
    explanation: Optional[str] = None


class ForecastPoint(BaseModel):
    timestamp: str
    actual: Optional[float] = None
    predicted: float
    baseline: float


class Investigation(BaseModel):
    id: str
    meter_id: str
    status: str
    notes: List[str] = Field(default_factory=list)
    assigned_to: Optional[str] = None
    created_at: str


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------


def safe_int(value, default=0) -> int:
    try:
        if pd.isna(value):
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def safe_float(value, default=0.0) -> float:
    return api_data.finite(value, default)


def safe_optional_float(value) -> Optional[float]:
    try:
        if value is None or pd.isna(value):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def classify_meter_risk(high_risk_rate: float) -> str:
    """
    Unchanged from the original implementation:
    >= 10% high-risk observations : HIGH_RISK
    >= 5%                         : REVIEW
    < 5%                          : NORMAL
    """
    if high_risk_rate >= 0.10:
        return "HIGH_RISK"
    if high_risk_rate >= 0.05:
        return "REVIEW"
    return "NORMAL"


def optional_coverage_map() -> Dict[str, Dict]:
    """Only read coverage if the hourly cache already exists (no surprise build)."""
    if not os.path.exists(api_data.HOURLY_CACHE_PATH):
        return {}
    try:
        coverage = api_data.coverage_by_meter()
        return {
            str(row["meter_id"]): {
                "coverage_start": api_data.to_iso(row["coverage_start"]),
                "coverage_end": api_data.to_iso(row["coverage_end"]),
            }
            for _, row in coverage.iterrows()
        }
    except Exception:
        logger.exception("Unable to read coverage cache")
        return {}


def build_meter_list() -> List[Dict]:
    summary = api_data.load_anomaly_summary()
    coverage = optional_coverage_map()

    if summary.empty:
        # No anomaly summary: return IDs only, never fabricated analysis.
        hourly_path = api_data.HOURLY_CACHE_PATH
        if not os.path.exists(hourly_path):
            return []
        hourly = api_data.get_hourly()
        return [
            {
                "meter_id": str(meter_id),
                "region": str(region),
                "coverage_start": coverage.get(str(meter_id), {}).get("coverage_start"),
                "coverage_end": coverage.get(str(meter_id), {}).get("coverage_end"),
            }
            for meter_id, region in hourly.groupby("meter_id")["region"].first().items()
        ]

    results = []
    for _, row in summary.iterrows():
        meter_id = str(row["meter_id"])
        total_observations = safe_int(row.get("total_observations", 0))
        high_risk_count = safe_int(row.get("high_risk_count", 0))
        high_risk_rate = (
            high_risk_count / total_observations if total_observations > 0 else 0.0
        )

        reasons = row.get("most_common_reasons")
        if isinstance(reasons, str):
            try:
                reasons = json.loads(reasons)
            except Exception:
                reasons = [reasons]
        if not isinstance(reasons, list):
            reasons = []

        results.append(
            {
                "meter_id": meter_id,
                "region": row.get("region") or "Unknown",
                "coverage_start": coverage.get(meter_id, {}).get("coverage_start"),
                "coverage_end": coverage.get(meter_id, {}).get("coverage_end"),
                "total_observations": total_observations,
                "normal_count": safe_int(row.get("normal_count", 0)),
                "review_count": safe_int(row.get("review_count", 0)),
                "high_risk_count": high_risk_count,
                "anomaly_count": safe_int(row.get("anomaly_count", 0)),
                "anomaly_rate": safe_float(row.get("anomaly_rate", 0)),
                "max_severity": safe_optional_float(row.get("max_severity")),
                "mean_severity": safe_optional_float(row.get("mean_severity")),
                "data_quality_flag_count": safe_int(
                    row.get("data_quality_flag_count", 0)
                ),
                "most_common_reasons": reasons[:3],
                "risk_level": classify_meter_risk(high_risk_rate),
            }
        )

    return results


def read_json(path: str) -> Optional[Dict]:
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r") as file:
            return json.load(file)
    except Exception:
        logger.exception("Unable to read %s", path)
        return None


def forecast_model_info() -> Optional[Dict]:
    report = read_json(api_data.FORECAST_REPORT_PATH)
    if not report:
        return None
    return {
        "generated_at": report.get("timestamp"),
        "model_summary": report.get("model_summary"),
        "baseline_summary": report.get("baseline_summary"),
        "model_name": report.get(
            "model_name",
            "HistGradientBoostingRegressor with chronological validation",
        ),
    }


def paginate(frame: pd.DataFrame, page: int, page_size: int):
    total = len(frame)
    page = max(1, page)
    page_size = max(1, min(2000, page_size))
    total_pages = max(1, (total + page_size - 1) // page_size)
    page = min(page, total_pages)
    start = (page - 1) * page_size
    return frame.iloc[start : start + page_size], total, page, page_size, total_pages


def meter_anomaly_summary(meter_id: str) -> Dict:
    summary = api_data.load_anomaly_summary()
    if summary.empty:
        return {
            "total_flagged": 0,
            "high_risk_count": 0,
            "review_count": 0,
            "most_common_reasons": [],
        }

    rows = summary[summary["meter_id"].astype(str) == str(meter_id)]
    if rows.empty:
        return {
            "total_flagged": 0,
            "high_risk_count": 0,
            "review_count": 0,
            "most_common_reasons": [],
        }

    row = rows.iloc[0]
    reasons = row.get("most_common_reasons")
    if isinstance(reasons, str):
        try:
            reasons = json.loads(reasons)
        except Exception:
            reasons = [reasons]
    if not isinstance(reasons, list):
        reasons = []

    return {
        "total_flagged": safe_int(row.get("anomaly_count")),
        "high_risk_count": safe_int(row.get("high_risk_count")),
        "review_count": safe_int(row.get("review_count")),
        "anomaly_rate": safe_float(row.get("anomaly_rate")),
        "max_severity": safe_optional_float(row.get("max_severity")),
        "most_common_reasons": reasons,
    }


# ----------------------------------------------------------------------
# Health
# ----------------------------------------------------------------------


@app.get("/health")
def health_check():
    status = api_data.anomaly_status()
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.1.0",
        "data": {
            "anomaly_summary": os.path.exists(api_data.ANOMALY_SUMMARY_PATH),
            "anomaly_observations": status["available"],
            "forecast_predictions": os.path.exists(api_data.FORECAST_PREDICTIONS_PATH),
            "hourly_cache": os.path.exists(api_data.HOURLY_CACHE_PATH),
        },
    }


# ----------------------------------------------------------------------
# Meters
# ----------------------------------------------------------------------


@app.get("/meters", response_model=List[MeterInfo])
def get_meters():
    try:
        return build_meter_list()
    except Exception as error:
        logger.exception("Error fetching meters")
        raise HTTPException(status_code=500, detail=str(error))


@app.get("/meters/health")
def get_meter_health():
    try:
        summary = api_data.load_anomaly_summary()
        if summary.empty:
            raise HTTPException(status_code=404, detail="Anomaly summary not found")

        coverage = api_data.coverage_by_meter()
        merged = summary.merge(coverage, on="meter_id", how="left")
        dataset_end = coverage["coverage_end"].max()

        meters = []
        for _, row in merged.iterrows():
            coverage_end = row.get("coverage_end")
            if pd.isna(coverage_end):
                status = "NO_DATA"
                days_since = None
            else:
                days_since = max(0, (dataset_end - coverage_end).total_seconds() / 86400)
                if days_since <= 7:
                    status = "REPORTING"
                elif days_since <= 30:
                    status = "STALE"
                else:
                    status = "INACTIVE"

            total = safe_int(row.get("total_observations"))
            quality_flags = safe_int(row.get("data_quality_flag_count"))
            quality_ratio = quality_flags / total if total else 0
            anomaly_rate = safe_float(row.get("anomaly_rate"))

            if quality_ratio >= 0.005 or anomaly_rate >= 0.20:
                health = "POOR"
            elif quality_ratio >= 0.001 or anomaly_rate >= 0.10:
                health = "WATCH"
            else:
                health = "GOOD"

            meters.append(
                {
                    "meter_id": str(row["meter_id"]),
                    "region": row.get("region") or "Unknown",
                    "status": status,
                    "health": health,
                    "coverage_start": api_data.to_iso(row.get("coverage_start")),
                    "coverage_end": api_data.to_iso(coverage_end),
                    "days_since_last_reading": (
                        round(days_since, 1) if days_since is not None else None
                    ),
                    "total_observations": total,
                    "observed_hours": safe_int(row.get("observed_hours")),
                    "data_quality_flags": quality_flags,
                    "quality_flag_rate": round(quality_ratio, 6),
                    "anomaly_rate": anomaly_rate,
                    "risk_level": classify_meter_risk(
                        safe_int(row.get("high_risk_count")) / total if total else 0
                    ),
                    "battery_pct": None,
                    "signal_dbm": None,
                    "firmware": None,
                    "hardware_note": (
                        "Battery, signal strength, and firmware are not present in "
                        "the processed smart-meter dataset."
                    ),
                }
            )

        status_counts = {}
        for meter in meters:
            status_counts[meter["status"]] = status_counts.get(meter["status"], 0) + 1

        return {
            "meters": sorted(meters, key=lambda item: item["meter_id"]),
            "summary": {
                "total_meters": len(meters),
                "status_counts": status_counts,
                "health_counts": {
                    label: sum(1 for m in meters if m["health"] == label)
                    for label in ["GOOD", "WATCH", "POOR"]
                },
            },
            "instrumented_fields": {
                "coverage": True,
                "data_quality_flags": True,
                "anomaly_rate": True,
                "battery_pct": False,
                "signal_dbm": False,
                "firmware": False,
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Error building meter health")
        raise HTTPException(status_code=500, detail=str(error))


@app.get("/meters/{meter_id}/consumption")
def get_consumption(
    meter_id: str,
    start: Optional[str] = None,
    end: Optional[str] = None,
    resolution: str = "hourly",
):
    try:
        hourly = api_data.get_hourly()
        meter_data = hourly[hourly["meter_id"].astype(str) == str(meter_id)].copy()

        if meter_data.empty:
            raise HTTPException(
                status_code=404,
                detail=f"No consumption data found for meter {meter_id}",
            )

        meter_data = meter_data.sort_values("hour")

        if resolution == "daily":
            meter_data["timestamp"] = meter_data["hour"].dt.floor("D")
            meter_data = (
                meter_data.groupby("timestamp", as_index=False)
                .agg(
                    consumption=("consumption", "sum"),
                    interval_count=("interval_count", "sum"),
                    peak_consumption=("peak_consumption", "max"),
                )
            )
        else:
            meter_data = meter_data.rename(columns={"hour": "timestamp"})

        if start:
            meter_data = meter_data[
                meter_data["timestamp"] >= pd.to_datetime(start)
            ]
        if end:
            meter_data = meter_data[meter_data["timestamp"] <= pd.to_datetime(end)]

        if meter_data.empty:
            raise HTTPException(
                status_code=404,
                detail=f"No consumption data for meter {meter_id} in the requested range",
            )

        observations = api_data.load_anomaly_observations()
        anomaly_hours = {}
        if not observations.empty:
            flagged = observations[
                observations["meter_id"].astype(str) == str(meter_id)
            ]
            if not flagged.empty:
                flagged = flagged.copy()
                flagged["timestamp"] = pd.to_datetime(
                    flagged["timestamp"], errors="coerce"
                ).dt.floor("D" if resolution == "daily" else "h")
                anomaly_hours = (
                    flagged.groupby("timestamp")["risk_level"]
                    .agg(lambda values: "HIGH_RISK" if "HIGH_RISK" in set(values) else "REVIEW")
                    .to_dict()
                )

        points = []
        for _, row in meter_data.iterrows():
            risk = anomaly_hours.get(row["timestamp"])
            points.append(
                {
                    "timestamp": api_data.to_iso(row["timestamp"]),
                    "consumption": round(safe_float(row["consumption"]), 6),
                    "interval_count": safe_int(row.get("interval_count")),
                    "is_anomaly": risk is not None,
                    "risk_level": risk,
                    "explanation": None,
                }
            )

        return {
            "meter_id": str(meter_id),
            "resolution": resolution,
            "points": points,
            "summary": {
                "total_consumption": round(
                    float(meter_data["consumption"].sum()), 4
                ),
                "average_consumption": round(
                    float(meter_data["consumption"].mean()), 6
                ),
                "peak_consumption": round(
                    float(meter_data["consumption"].max()), 6
                ),
                "peak_timestamp": api_data.to_iso(
                    meter_data.loc[meter_data["consumption"].idxmax(), "timestamp"]
                ),
                "point_count": len(meter_data),
                "observations": safe_int(meter_data["interval_count"].sum()),
                "anomaly_artifact_available": bool(anomaly_hours),
            },
            "coverage": {
                "start": api_data.to_iso(meter_data["timestamp"].min()),
                "end": api_data.to_iso(meter_data["timestamp"].max()),
            },
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Error fetching consumption for %s", meter_id)
        raise HTTPException(status_code=500, detail=str(error))


# ----------------------------------------------------------------------
# Anomalies
# ----------------------------------------------------------------------


@app.get("/anomalies/status")
def anomaly_status():
    return api_data.anomaly_status()


@app.get("/anomalies")
def get_anomalies(
    risk: str = "all",
    region: str = "all",
    meter_id: str = "all",
    search: str = "",
    page: int = 1,
    page_size: int = Query(50, alias="pageSize"),
    sort: str = "severity_desc",
):
    status = api_data.anomaly_status()
    if not status["available"]:
        return {
            "available": False,
            "records": [],
            "total": 0,
            "page": 1,
            "pageSize": page_size,
            "totalPages": 0,
            "message": status["message"],
            "artifact_path": status["path"],
        }

    try:
        frame = api_data.load_anomaly_observations()

        if frame.empty:
            return {
                "available": True,
                "records": [],
                "total": 0,
                "page": 1,
                "pageSize": page_size,
                "totalPages": 0,
                "message": "No flagged observations exist in the anomaly artifact.",
            }

        if risk and risk != "all":
            frame = frame[frame["risk_level"] == risk]
        if region and region != "all":
            frame = frame[
                frame["region"].astype(str).str.lower() == str(region).lower()
            ]
        if meter_id and meter_id != "all":
            frame = frame[frame["meter_id"].astype(str) == str(meter_id)]
        if search:
            needle = str(search).lower()
            reason_text = frame["reasons"].apply(lambda values: " ".join(values or []))
            mask = (
                frame["meter_id"].str.lower().str.contains(needle, regex=False)
                | frame["region"].str.lower().str.contains(needle, regex=False)
                | reason_text.str.lower().str.contains(needle, regex=False)
            )
            frame = frame[mask]

        if sort == "timestamp_asc":
            frame = frame.sort_values("timestamp", ascending=True)
        elif sort == "timestamp_desc":
            frame = frame.sort_values("timestamp", ascending=False)
        else:
            frame = frame.sort_values(["severity", "timestamp"], ascending=[False, False])

        page_frame, total, page, page_size, total_pages = paginate(
            frame, page, page_size
        )
        records = [api_data.serialize_anomaly(row) for _, row in page_frame.iterrows()]

        return {
            "available": True,
            "records": records,
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": total_pages,
            "message": None,
        }
    except Exception as error:
        logger.exception("Error listing anomalies")
        raise HTTPException(status_code=500, detail=str(error))


@app.get("/meters/{meter_id}/anomalies")
def get_meter_anomalies(
    meter_id: str,
    page: int = 1,
    page_size: int = Query(50, alias="pageSize"),
    risk: str = "all",
):
    summary = meter_anomaly_summary(meter_id)
    status = api_data.anomaly_status()

    if not status["available"]:
        return {
            "meter_id": str(meter_id),
            "available": False,
            "records": [],
            "total": 0,
            "summary": summary,
            "message": status["message"],
            "artifact_path": status["path"],
        }

    try:
        frame = api_data.load_anomaly_observations()
        frame = frame[frame["meter_id"].astype(str) == str(meter_id)].copy()

        if risk and risk != "all":
            frame = frame[frame["risk_level"] == risk]

        frame = frame.sort_values("timestamp", ascending=False)
        page_frame, total, page, page_size, total_pages = paginate(
            frame, page, page_size
        )

        return {
            "meter_id": str(meter_id),
            "available": True,
            "records": [
                api_data.serialize_anomaly(row) for _, row in page_frame.iterrows()
            ],
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": total_pages,
            "summary": summary,
            "message": None,
        }
    except Exception as error:
        logger.exception("Error fetching anomalies for %s", meter_id)
        raise HTTPException(status_code=500, detail=str(error))


# ----------------------------------------------------------------------
# Analytics
# ----------------------------------------------------------------------


@app.get("/analytics/consumption")
def get_consumption_analytics(
    range_value: str = Query("7D", alias="range"),
    region: str = "all",
    meter_id: str = "all",
):
    try:
        hourly = api_data.get_hourly()
        end = hourly["hour"].max()
        days = api_data.parse_range_days(range_value)
        start = end - pd.Timedelta(days=days) if days else hourly["hour"].min()

        frame = hourly[
            (hourly["hour"] >= start) & (hourly["hour"] <= end)
        ].copy()

        if region and region != "all":
            frame = frame[
                frame["region"].astype(str).str.lower() == str(region).lower()
            ]
        if meter_id and meter_id != "all":
            frame = frame[frame["meter_id"].astype(str) == str(meter_id)]

        if frame.empty:
            raise HTTPException(
                status_code=404,
                detail="No consumption data matches the selected filters",
            )

        per_hour = (
            frame.groupby("hour", as_index=False)
            .agg(
                consumption=("consumption", "sum"),
                interval_count=("interval_count", "sum"),
                meter_count=("meter_id", "nunique"),
            )
            .sort_values("hour")
        )

        span_days = max(0.0, (per_hour["hour"].max() - per_hour["hour"].min()).total_seconds() / 86400)
        if span_days <= 14:
            bucket = "h"
        elif span_days <= 120:
            bucket = "D"
        else:
            bucket = "W"

        series = (
            per_hour.set_index("hour")["consumption"]
            .resample(bucket)
            .sum()
            .dropna()
        )

        points = [
            {
                "timestamp": api_data.to_iso(timestamp),
                "consumption": round(float(value), 4),
            }
            for timestamp, value in series.items()
        ]

        frame["hour_of_day"] = frame["hour"].dt.hour
        profile = (
            frame.groupby("hour_of_day")["consumption"]
            .mean()
            .reindex(range(24))
        )
        hourly_profile = [
            {
                "hour": int(hour),
                "avg_consumption": (
                    round(float(profile.get(hour)), 6)
                    if pd.notna(profile.get(hour))
                    else None
                ),
            }
            for hour in range(24)
        ]

        peak_hour = int(profile.idxmax()) if profile.notna().any() else None
        peak_timestamp = per_hour.loc[per_hour["consumption"].idxmax(), "hour"]

        return {
            "range": range_value,
            "region": region,
            "meter_id": meter_id,
            "bucket": {"h": "hour", "D": "day", "W": "week"}[bucket],
            "unit": "kWh",
            "points": points,
            "hourly_profile": hourly_profile,
            "summary": {
                "total_consumption": round(float(per_hour["consumption"].sum()), 4),
                "average_per_bucket": round(float(series.mean()), 4),
                "peak_consumption": round(float(per_hour["consumption"].max()), 4),
                "peak_timestamp": api_data.to_iso(peak_timestamp),
                "peak_hour": peak_hour,
                "meters_included": int(frame["meter_id"].nunique()),
                "observations": safe_int(frame["interval_count"].sum()),
                "start": api_data.to_iso(per_hour["hour"].min()),
                "end": api_data.to_iso(per_hour["hour"].max()),
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Consumption analytics error")
        raise HTTPException(status_code=500, detail=str(error))


@app.get("/analytics/diurnal")
def get_diurnal_patterns(region: str = "all"):
    try:
        hourly = api_data.get_hourly().copy()
        if region and region != "all":
            hourly = hourly[
                hourly["region"].astype(str).str.lower() == str(region).lower()
            ]
        if hourly.empty:
            raise HTTPException(status_code=404, detail="No data for the selected region")

        hourly["hour_of_day"] = hourly["hour"].dt.hour

        def build_profile(frame: pd.DataFrame) -> List[Dict]:
            grouped = (
                frame.groupby(["hour_of_day", "is_weekend"])["consumption"]
                .mean()
                .unstack("is_weekend")
            )
            rows = []
            for hour in range(24):
                if hour not in grouped.index:
                    rows.append({"hour": hour, "weekday": None, "weekend": None, "overall": None})
                    continue
                weekday = grouped.loc[hour].get(False)
                weekend = grouped.loc[hour].get(True)
                values = [value for value in [weekday, weekend] if pd.notna(value)]
                rows.append(
                    {
                        "hour": hour,
                        "weekday": round(float(weekday), 6) if pd.notna(weekday) else None,
                        "weekend": round(float(weekend), 6) if pd.notna(weekend) else None,
                        "overall": round(float(sum(values) / len(values)), 6) if values else None,
                    }
                )
            return rows

        regions = {}
        for region_name, frame in hourly.groupby("region"):
            regions[str(region_name)] = build_profile(frame)

        return {
            "hours": build_profile(hourly),
            "regions": regions,
            "unit": "kWh per meter-hour",
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Diurnal analytics error")
        raise HTTPException(status_code=500, detail=str(error))


@app.get("/analytics/regional")
def get_regional_analytics():
    try:
        summary = api_data.load_anomaly_summary()
        if summary.empty:
            raise HTTPException(status_code=404, detail="No anomaly summary data available")

        summary["region"] = summary.get("region", "Unknown").fillna("Unknown")
        regions = {}

        for region_name, group in summary.groupby("region"):
            total_observations = pd.to_numeric(
                group.get("total_observations", 0), errors="coerce"
            ).fillna(0)
            high_risk_counts = pd.to_numeric(
                group.get("high_risk_count", 0), errors="coerce"
            ).fillna(0)
            anomaly_counts = pd.to_numeric(
                group.get("anomaly_count", 0), errors="coerce"
            ).fillna(0)
            anomaly_rates = pd.to_numeric(
                group.get("anomaly_rate", 0), errors="coerce"
            ).fillna(0)

            high_risk_rates = high_risk_counts.div(
                total_observations.where(total_observations > 0)
            ).fillna(0)
            meter_risk_levels = high_risk_rates.apply(classify_meter_risk)

            regions[str(region_name)] = {
                "meter_count": int(group["meter_id"].nunique()),
                "flagged_count": int((anomaly_counts > 0).sum()),
                "high_risk_count": int((meter_risk_levels == "HIGH_RISK").sum()),
                "review_count": int((meter_risk_levels == "REVIEW").sum()),
                "normal_count": int((meter_risk_levels == "NORMAL").sum()),
                "total_anomaly_observations": int(anomaly_counts.sum()),
                "total_observations": int(total_observations.sum()),
                "avg_risk": round(float(anomaly_rates.mean()), 6) if len(group) else 0.0,
            }

        totals = {
            "meter_count": int(summary["meter_id"].nunique()),
            "flagged_count": int(
                (pd.to_numeric(summary.get("anomaly_count", 0), errors="coerce").fillna(0) > 0).sum()
            ),
            "total_observations": int(
                pd.to_numeric(summary.get("total_observations", 0), errors="coerce").fillna(0).sum()
            ),
            "total_anomaly_observations": int(
                pd.to_numeric(summary.get("anomaly_count", 0), errors="coerce").fillna(0).sum()
            ),
        }

        return {
            "regions": regions,
            "totals": totals,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Regional analytics error")
        raise HTTPException(status_code=500, detail=str(error))


@app.get("/analytics/data-quality")
def get_data_quality():
    try:
        summary = api_data.load_anomaly_summary()
        if summary.empty:
            raise HTTPException(status_code=404, detail="No anomaly summary data available")

        hourly = api_data.get_hourly()
        coverage = api_data.coverage_by_meter()

        observed_intervals = safe_int(coverage["observed_intervals"].sum())
        expected_intervals = 0
        for _, row in coverage.iterrows():
            if pd.isna(row["coverage_start"]) or pd.isna(row["coverage_end"]):
                continue
            hours = (
                (row["coverage_end"] - row["coverage_start"]).total_seconds() / 3600
            ) + 1
            expected_intervals += int(hours * config.intervals_per_hour)

        completeness = (
            min(100.0, (observed_intervals / expected_intervals) * 100)
            if expected_intervals
            else None
        )

        quality_flags = pd.to_numeric(
            summary.get("data_quality_flag_count", 0), errors="coerce"
        ).fillna(0)

        pipeline_report = read_json(api_data.PIPELINE_RUN_PATH) or {}
        clean_report = pipeline_report.get("clean_report") or {}
        rows_in = 0
        rows_out = 0
        for entry in clean_report.values():
            if isinstance(entry, dict):
                rows_in += safe_int(entry.get("rows_in"))
                rows_out += safe_int(entry.get("rows_out"))

        total_observations = int(
            pd.to_numeric(summary.get("total_observations", 0), errors="coerce")
            .fillna(0)
            .sum()
        )
        anomaly_observations = int(
            pd.to_numeric(summary.get("anomaly_count", 0), errors="coerce")
            .fillna(0)
            .sum()
        )

        anomaly_status = api_data.anomaly_status()

        return {
            "meters": int(summary["meter_id"].nunique()),
            "total_observations": total_observations,
            "anomaly_observations": anomaly_observations,
            "anomaly_rate": round(
                anomaly_observations / total_observations, 6
            ) if total_observations else 0,
            "data_quality_flags": int(quality_flags.sum()),
            "meters_with_quality_flags": int((quality_flags > 0).sum()),
            "observed_intervals": observed_intervals,
            "expected_intervals": expected_intervals,
            "completeness_pct": round(completeness, 2) if completeness is not None else None,
            "sampling_interval_minutes": round(60 / config.intervals_per_hour, 2),
            "coverage": {
                "start": api_data.to_iso(hourly["hour"].min()),
                "end": api_data.to_iso(hourly["hour"].max()),
                "days": round(
                    (hourly["hour"].max() - hourly["hour"].min()).total_seconds() / 86400,
                    1,
                ),
            },
            "raw_rows": rows_in,
            "cleaned_rows": rows_out,
            "row_dropout_rate_pct": (
                round(((rows_in - rows_out) / rows_in) * 100, 3) if rows_in else None
            ),
            "pipeline_generated_at": pipeline_report.get("generated_at"),
            "anomaly_artifact": anomaly_status,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Data quality error")
        raise HTTPException(status_code=500, detail=str(error))


# ----------------------------------------------------------------------
# Forecasting
# ----------------------------------------------------------------------


@app.get("/forecast/meta")
def get_forecast_meta():
    summary = api_data.load_anomaly_summary()
    meters = sorted(summary["meter_id"].astype(str).tolist()) if not summary.empty else []
    available = os.path.exists(api_data.FORECAST_PREDICTIONS_PATH)
    model_info = forecast_model_info()

    message = None
    horizons: List[int] = [1, 6, 12, 24]
    if available:
        try:
            import pyarrow.parquet as pq

            frame = pd.read_parquet(
                api_data.FORECAST_PREDICTIONS_PATH, columns=["meter_id", "timestamp"]
            )
            meters = sorted(frame["meter_id"].astype(str).unique().tolist())
            points_per_meter = frame.groupby("meter_id").size()
            max_hours = int(
                points_per_meter.max() / config.intervals_per_hour
            ) if len(points_per_meter) else 24
            horizons = [h for h in [1, 6, 12, 24] if h <= max_hours] or [1]
        except Exception as error:
            logger.exception("Unable to inspect forecast artifact")
            available = False
            message = f"Forecast artifact could not be read: {error}"
    else:
        message = (
            "Forecast predictions have not been generated. Expected artifact: "
            f"{api_data.FORECAST_PREDICTIONS_PATH}. Run the forecasting pipeline "
            "to enable this module."
        )

    return {
        "available": available,
        "meters": meters,
        "horizons": horizons,
        "model_info": model_info,
        "artifact_path": api_data.FORECAST_PREDICTIONS_PATH,
        "message": message,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/meters/{meter_id}/forecast")
def get_forecast(meter_id: str, horizon: int = 24):
    if not os.path.exists(api_data.FORECAST_PREDICTIONS_PATH):
        raise HTTPException(
            status_code=503,
            detail=(
                "Forecast predictions are not available. The artifact "
                f"{api_data.FORECAST_PREDICTIONS_PATH} is missing. Generate it with "
                "the load-forecasting pipeline first."
            ),
        )

    try:
        import pyarrow.parquet as pq

        available_columns = set(
            pq.ParquetFile(api_data.FORECAST_PREDICTIONS_PATH).schema.names
        )
        wanted = [
            "meter_id",
            "timestamp",
            "consumption",
            "model_pred",
            "baseline_pred",
        ]
        columns = [column for column in wanted if column in available_columns]

        frame = pd.read_parquet(
            api_data.FORECAST_PREDICTIONS_PATH,
            columns=columns,
            filters=[("meter_id", "==", str(meter_id))],
        )

        if frame.empty:
            raise HTTPException(
                status_code=404,
                detail=f"No forecast found for meter {meter_id}",
            )

        frame["timestamp"] = pd.to_datetime(frame["timestamp"], errors="coerce")
        frame = frame.dropna(subset=["timestamp"]).sort_values("timestamp")

        horizon = max(1, min(int(horizon), 24 * 30))
        limit = max(1, horizon * config.intervals_per_hour)
        frame = frame.head(limit)

        points = []
        for _, row in frame.iterrows():
            points.append(
                {
                    "timestamp": api_data.to_iso(row["timestamp"]),
                    "actual": (
                        safe_optional_float(row.get("consumption"))
                        if "consumption" in frame.columns
                        else None
                    ),
                    "predicted": round(safe_float(row.get("model_pred")), 4),
                    "baseline": round(safe_float(row.get("baseline_pred")), 4),
                }
            )

        report = read_json(api_data.FORECAST_REPORT_PATH) or {}
        metrics = (report.get("per_meter_metrics") or {}).get(str(meter_id))

        return {
            "meter_id": str(meter_id),
            "horizon": horizon,
            "available": True,
            "points": points,
            "unit": "kWh",
            "model_info": forecast_model_info(),
            "metrics": metrics,
            "generated_at": report.get("timestamp"),
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Error fetching forecast for %s", meter_id)
        raise HTTPException(status_code=500, detail=str(error))


# ----------------------------------------------------------------------
# Investigations (legacy JSON store - Node/Express + Mongo owns the UI)
# ----------------------------------------------------------------------


@app.get("/investigations")
def list_investigations():
    return load_investigations()


@app.post("/investigations")
def create_investigation(investigation: Investigation):
    data = load_investigations()
    data.append(investigation.model_dump())
    save_investigations(data)
    return investigation


@app.patch("/investigations/{inv_id}")
def update_investigation(inv_id: str, updates: Dict[str, Any]):
    data = load_investigations()
    for item in data:
        if item["id"] == inv_id:
            item.update(updates)
            save_investigations(data)
            return item
    raise HTTPException(status_code=404, detail="Investigation not found")


# ----------------------------------------------------------------------
# Pipeline Status / Run
# ----------------------------------------------------------------------


@app.get("/pipeline/status")
def get_pipeline_status():
    anomaly_run = read_json(api_data.ANOMALY_RUN_PATH)
    forecast_report = read_json(api_data.FORECAST_REPORT_PATH)

    observations = api_data.anomaly_status()
    forecast_exists = os.path.exists(api_data.FORECAST_PREDICTIONS_PATH)

    return {
        "anomaly_detection": "Completed" if anomaly_run else "Pending",
        "load_forecasting": (
            "Completed" if forecast_report and forecast_exists else "Pending"
        ),
        "details": {
            "anomaly": {
                "generated_at": anomaly_run.get("generated_at") if anomaly_run else None,
                "pipeline_version": anomaly_run.get("pipeline_version") if anomaly_run else None,
                "uc1_version": anomaly_run.get("uc1_version") if anomaly_run else None,
                "model_name": anomaly_run.get("model_name") if anomaly_run else None,
                "risk_thresholds": anomaly_run.get("risk_thresholds") if anomaly_run else None,
                "n_meters": anomaly_run.get("n_meters") if anomaly_run else None,
                "n_observations_scored": anomaly_run.get("n_observations_scored") if anomaly_run else None,
                "observations_artifact": observations,
            },
            "forecast": {
                "generated_at": forecast_report.get("timestamp") if forecast_report else None,
                "model_summary": forecast_report.get("model_summary") if forecast_report else None,
                "baseline_summary": forecast_report.get("baseline_summary") if forecast_report else None,
                "predictions_artifact": {
                    "available": forecast_exists,
                    "path": api_data.FORECAST_PREDICTIONS_PATH,
                },
            },
        },
        "artifacts": {
            "anomaly_summary": os.path.exists(api_data.ANOMALY_SUMMARY_PATH),
            "anomaly_observations": observations["available"],
            "forecast_predictions": forecast_exists,
            "forecast_report": os.path.exists(api_data.FORECAST_REPORT_PATH),
            "hourly_cache": os.path.exists(api_data.HOURLY_CACHE_PATH),
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/pipeline/run")
async def run_pipeline(background_tasks: BackgroundTasks):
    def execute_all():
        try:
            logger.info("Starting anomaly detection pipeline")
            run_phase_a()
            logger.info("Starting forecasting pipeline")
            run_forecasting_pipeline()
            logger.info("Full pipeline completed")
        except Exception:
            logger.exception("Pipeline run failed")

    background_tasks.add_task(execute_all)
    return {
        "status": "Pipeline started in background",
        "message": "Anomaly detection and load forecasting are running.",
    }


# ----------------------------------------------------------------------
# Run Server
# ----------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=os.environ.get("ML_HOST", "127.0.0.1"),
        port=int(os.environ.get("ML_PORT", "8000")),
    )
