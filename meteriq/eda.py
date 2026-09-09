"""Dataset inspection utilities for MeterIQ.

This module deliberately does not impose a smart-meter schema.  It profiles the
columns found in a supplied file and reports *candidates* for important fields
that a user must verify before preprocessing or model training.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

SUPPORTED_SUFFIXES = {".csv", ".tsv", ".xlsx", ".xls", ".parquet"}
TIMESTAMP_HINTS = ("time", "date", "timestamp", "datetime", "reading_date")
METER_HINTS = ("meter", "customer", "consumer", "account", "connection", "service", "id")
CONSUMPTION_HINTS = ("consumption", "usage", "energy", "kwh", "load", "unit", "reading")
LABEL_HINTS = ("theft", "fraud", "anomaly", "label", "target", "class", "risk")


def read_dataset(path: str | Path) -> pd.DataFrame:
    """Load a common tabular file without changing its raw contents."""
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"Dataset file does not exist: {file_path}")
    suffix = file_path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(file_path)
    if suffix == ".tsv":
        return pd.read_csv(file_path, sep="\t")
    if suffix in {".xlsx", ".xls"}:
        return pd.read_excel(file_path)
    if suffix == ".parquet":
        return pd.read_parquet(file_path)
    raise ValueError(f"Unsupported file type '{suffix}'. Supported: {sorted(SUPPORTED_SUFFIXES)}")


def discover_files(directory: str | Path) -> list[Path]:
    """Return supported dataset files in a city data directory."""
    folder = Path(directory)
    if not folder.exists():
        return []
    return sorted(path for path in folder.iterdir() if path.is_file() and path.suffix.lower() in SUPPORTED_SUFFIXES)


def _candidate_columns(columns: list[str], hints: tuple[str, ...]) -> list[str]:
    return [column for column in columns if any(hint in column.lower() for hint in hints)]


def _timestamp_summary(series: pd.Series) -> dict[str, Any]:
    parsed = pd.to_datetime(series, errors="coerce", dayfirst=False)
    valid = int(parsed.notna().sum())
    summary: dict[str, Any] = {"parseable_values": valid, "invalid_values": int(parsed.isna().sum())}
    if valid >= 2:
        ordered = parsed.dropna().sort_values()
        intervals = ordered.diff().dropna()
        summary.update(
            {"earliest": ordered.iloc[0].isoformat(), "latest": ordered.iloc[-1].isoformat(),
             "median_interval": str(intervals.median()) if not intervals.empty else None}
        )
    return summary


def _numeric_summary(series: pd.Series) -> dict[str, Any]:
    numeric = pd.to_numeric(series, errors="coerce")
    valid = numeric.dropna()
    if valid.empty:
        return {"numeric_values": 0}
    q1, q3 = valid.quantile([0.25, 0.75])
    iqr = q3 - q1
    outliers = int(((valid < q1 - 1.5 * iqr) | (valid > q3 + 1.5 * iqr)).sum()) if iqr else 0
    return {
        "numeric_values": int(valid.size), "minimum": _json_number(valid.min()),
        "maximum": _json_number(valid.max()), "mean": _json_number(valid.mean()),
        "negative_values": int((valid < 0).sum()), "zero_values": int((valid == 0).sum()),
        "iqr_outlier_count": outliers,
    }


def _json_number(value: Any) -> float | None:
    return None if pd.isna(value) or np.isinf(value) else float(value)


def profile_dataset(frame: pd.DataFrame, dataset_name: str = "dataset") -> dict[str, Any]:
    """Produce JSON-serializable EDA results without mutating ``frame``."""
    columns = [str(column) for column in frame.columns]
    profile: dict[str, Any] = {
        "dataset": dataset_name, "rows": int(len(frame)), "columns": int(len(columns)),
        "column_names": columns, "duplicate_row_count": int(frame.duplicated().sum()),
        "missing_values": {str(k): int(v) for k, v in frame.isna().sum().items()},
        "data_types": {str(k): str(v) for k, v in frame.dtypes.items()},
        "unique_values": {str(k): int(v) for k, v in frame.nunique(dropna=True).items()},
        "candidate_columns": {
            "meter_or_customer_identifier": _candidate_columns(columns, METER_HINTS),
            "timestamp_or_date": _candidate_columns(columns, TIMESTAMP_HINTS),
            "consumption_or_load": _candidate_columns(columns, CONSUMPTION_HINTS),
            "theft_or_anomaly_label": _candidate_columns(columns, LABEL_HINTS),
        },
        "notes": [
            "Candidate columns are name-based suggestions and must be verified against the data dictionary.",
            "IQR outliers are observations to inspect, not confirmed errors or theft events.",
        ],
        "column_profiles": {},
    }
    for name in frame.columns:
        series = frame[name]
        item: dict[str, Any] = {"missing": int(series.isna().sum()), "unique": int(series.nunique(dropna=True))}
        if pd.api.types.is_numeric_dtype(series):
            item["numeric"] = _numeric_summary(series)
        else:
            item["examples"] = [str(value) for value in series.dropna().astype(str).head(5)]
            timestamp_info = _timestamp_summary(series)
            # Avoid interpreting arbitrary categorical text as a date column.
            if timestamp_info["parseable_values"] >= max(2, int(len(series.dropna()) * 0.8)):
                item["timestamp"] = timestamp_info
        profile["column_profiles"][str(name)] = item
    return profile


def write_profile(profile: dict[str, Any], output_path: str | Path) -> Path:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(profile, indent=2, default=str) + "\n", encoding="utf-8")
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description="Profile a MeterIQ smart-meter dataset without changing it.")
    parser.add_argument("dataset", help="Path to a CSV, TSV, Excel, or Parquet dataset")
    parser.add_argument("--name", help="Display name, e.g. Mathura", default=None)
    parser.add_argument("--output", help="Optional JSON report path")
    args = parser.parse_args()
    path = Path(args.dataset)
    result = profile_dataset(read_dataset(path), args.name or path.stem)
    if args.output:
        write_profile(result, args.output)
        print(f"EDA report written to {args.output}")
    else:
        print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
