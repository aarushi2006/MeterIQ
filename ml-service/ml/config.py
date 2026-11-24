"""
Central configuration for the MeterIQ ML pipeline.
"""

import os
from dataclasses import dataclass, field
from typing import List

def _env_path(name: str, default: str) -> str:
    return os.environ.get(name, default)

def _env_int(name: str, default: int) -> int:
    val = os.environ.get(name)
    return int(val) if val is not None else default

def _env_float(name: str, default: float) -> float:
    val = os.environ.get(name)
    return float(val) if val is not None else default

def _env_bool(name: str, default: bool) -> bool:
    val = os.environ.get(name)
    if val is None:
        return default
    return val.strip().lower() in ('1', 'true', 'yes')

KNOWN_SOURCE_FILES = [
    "SM Cleaned Data BR2019.csv",
    "CEEW - Smart meter data Bareilly 2020.csv",
    "CEEW - Smart meter data Bareilly 2021.csv",
    "CEEW - Smart meter data Mathura 2019.csv",
    "CEEW - Smart meter data Mathura 2020.csv",
    "SM Cleaned Data MH2021.csv",
]

# Absolute paths for reliability in this environment. Derived from this file
# rather than hard-coded so the service runs from any checkout location.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

@dataclass
class Config:
    data_dir: str = field(default_factory=lambda: _env_path("METERIQ_DATA_DIR", os.path.join(BASE_DIR, "data/Data")))
    output_dir: str = field(default_factory=lambda: _env_path("METERIQ_OUTPUT_DIR", os.path.join(BASE_DIR, "data/output")))
    cache_dir: str = field(default_factory=lambda: _env_path("METERIQ_CACHE_DIR", os.path.join(BASE_DIR, "data/cache")))
    log_dir: str = field(default_factory=lambda: _env_path("METERIQ_LOG_DIR", os.path.join(BASE_DIR, "logs")))
    input_files: List[str] = field(default_factory=lambda: list(KNOWN_SOURCE_FILES))

    intervals_per_hour: int = field(default_factory=lambda: _env_int("METERIQ_INTERVALS_PER_HOUR", 20))

    @property
    def intervals_per_day(self) -> int:
        return self.intervals_per_hour * 24

    @property
    def intervals_per_week(self) -> int:
        return self.intervals_per_day * 7

    drop_dropout_rows: bool = field(default_factory=lambda: _env_bool("METERIQ_DROP_DROPOUT_ROWS", True))
    flag_voltage_outliers: bool = field(default_factory=lambda: _env_bool("METERIQ_FLAG_VOLTAGE_OUTLIERS", True))
    plausible_voltage_min: float = field(default_factory=lambda: _env_float("METERIQ_VOLTAGE_MIN", 100.0))
    plausible_voltage_max: float = field(default_factory=lambda: _env_float("METERIQ_VOLTAGE_MAX", 300.0))
    max_plausible_kwh_per_interval: float = field(default_factory=lambda: _env_float("METERIQ_MAX_KWH_PER_INTERVAL", 1.0))

    rolling_windows: dict = field(default_factory=lambda: {'1h': 20, '1d': 480})
    random_seed: int = field(default_factory=lambda: _env_int("METERIQ_RANDOM_SEED", 42))
    log_level: str = field(default_factory=lambda: _env_path("METERIQ_LOG_LEVEL", "INFO"))
    pipeline_version: str = "phase-a.5"

    anomaly_features: list = field(default_factory=lambda: [
        'consumption', 'lag_1_interval', 'lag_1h', 'lag_4h', 'lag_1d', 'lag_1w',
        'rolling_mean_1h', 'rolling_std_1h', 'rolling_mean_1d', 'rolling_std_1d',
        'abs_change_prev', 'pct_change_prev', 'deviation_from_rolling_mean', 
        'deviation_z', 'deviation_from_same_hour_last_week', 'hour', 'day_of_week', 'is_weekend',
    ])
    electrical_quality_features: list = field(default_factory=lambda: [
        'average_voltage', 'average_current', 'frequency_hz',
    ])

    deviation_z_review_threshold: float = field(default_factory=lambda: _env_float("METERIQ_DEV_Z_REVIEW", 2.0))
    deviation_z_high_threshold: float = field(default_factory=lambda: _env_float("METERIQ_DEV_Z_HIGH", 3.0))
    pct_change_review_threshold: float = field(default_factory=lambda: _env_float("METERIQ_PCT_CHANGE_REVIEW", 1.0))
    pct_change_high_threshold: float = field(default_factory=lambda: _env_float("METERIQ_PCT_CHANGE_HIGH", 2.5))
    same_week_std_floor: float = field(default_factory=lambda: _env_float("METERIQ_WEEK_STD_FLOOR", 0.005))
    same_week_deviation_review_threshold: float = field(default_factory=lambda: _env_float("METERIQ_WEEK_DEV_REVIEW", 3.0))
    same_week_deviation_high_threshold: float = field(default_factory=lambda: _env_float("METERIQ_WEEK_DEV_HIGH", 5.5))

    isolation_forest_n_estimators: int = field(default_factory=lambda: _env_int("METERIQ_IF_N_ESTIMATORS", 100))
    isolation_forest_contamination: float = field(default_factory=lambda: _env_float("METERIQ_IF_CONTAMINATION", 0.01))
    anomaly_train_fraction: float = field(default_factory=lambda: _env_float("METERIQ_ANOMALY_TRAIN_FRACTION", 0.7))
    min_observations_per_meter: int = field(default_factory=lambda: _env_int("METERIQ_MIN_OBS_PER_METER", 2000))
    isolation_forest_review_percentile: float = field(default_factory=lambda: _env_float("METERIQ_IF_REVIEW_PERCENTILE", 90.0))
    isolation_forest_high_percentile: float = field(default_factory=lambda: _env_float("METERIQ_IF_HIGH_PERCENTILE", 97.0))

    risk_review_severity: float = field(default_factory=lambda: _env_float("METERIQ_RISK_REVIEW", 25.0))
    risk_high_severity: float = field(default_factory=lambda: _env_float("METERIQ_RISK_HIGH", 55.0))

config = Config()
