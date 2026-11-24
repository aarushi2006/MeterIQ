"""
Central data schema / contract for the MeterIQ pipeline.

This is the single source of truth for:
- what raw column names map to what normalized names
- which fields are required after cleaning
- what type each field should be

Nothing else in the codebase should hardcode a raw CEEW column name or a
required-columns list — they should import RAW_TO_NORMALIZED / REQUIRED_FIELDS
/ FIELD_DTYPES from here instead.
"""

from dataclasses import dataclass, field
from typing import Optional

# ---------------------------------------------------------------------------
# Raw -> normalized column name mapping.
#
# The raw CEEW files use inconsistent, unit-suffixed names
# (e.g. "z_Avg Voltage (Volt)") that are awkward to carry through a backend
# or serialize in a Pydantic/JSON API later. This mapping is the ONLY place
# that translation happens. It does not change the meaning or values of the
# data - only the column names.
# ---------------------------------------------------------------------------
RAW_TO_NORMALIZED = {
    'meter': 'meter_id',
    'x_Timestamp': 'timestamp',
    'Date': 'timestamp',            # the two "Aggregated" files use 'Date' instead
    't_kWh': 'consumption',
    'z_Avg Voltage (Volt)': 'average_voltage',
    'z_Avg Current (Amp)': 'average_current',
    'y_Freq (Hz)': 'frequency_hz',
}

# Fields that MUST exist, with no nulls, after cleaning. If any of these is
# missing or contains a null, the pipeline stops - this is not something the
# pipeline is allowed to silently repair.
REQUIRED_FIELDS = ['meter_id', 'timestamp', 'consumption']

# Optional fields: present when the source file has them (raw 3-min files),
# absent for the daily "Aggregated" files. Not required for validation to
# pass, but documented here so their expected type is explicit.
OPTIONAL_FIELDS = ['average_voltage', 'average_current', 'frequency_hz', 'region']

FIELD_DTYPES = {
    'meter_id': 'string',           # kept as string/category, not numeric - "BR02" etc.
    'timestamp': 'datetime64[ns]',
    'consumption': 'float32',
    'average_voltage': 'float32',
    'average_current': 'float32',
    'frequency_hz': 'float32',
    'region': 'category',
}

VALID_METER_ID_PREFIXES = ('BR', 'MH')


@dataclass(frozen=True)
class SchemaVersion:
    """
    Bumped whenever RAW_TO_NORMALIZED, REQUIRED_FIELDS, or FIELD_DTYPES
    change in a way that would make previously-cached processed/feature
    Parquet files stale. Used by the cache-invalidation logic in
    pipeline.py so a schema change can't silently serve old-shaped data.
    """
    value: str = "schema-v1"


SCHEMA_VERSION = SchemaVersion()


def normalize_columns(df):
    """
    Renames raw columns to their normalized names per RAW_TO_NORMALIZED.
    Pure renaming - does not touch values, does not drop columns, does not
    fail if a raw file doesn't have every mapped column (e.g. the daily
    aggregated files have no voltage/current/frequency).
    """
    return df.rename(columns=RAW_TO_NORMALIZED)
