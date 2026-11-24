import os
import gc

import pandas as pd

from ..schema import normalize_columns, REQUIRED_FIELDS
from ..config import config
from ..logging_config import get_logger

logger = get_logger("cleaning")


def standardize_dataset(df):
    """
    Standardizes the dataset columns and types.

    Behavior-preserving update for Phase A.5 / Priority 3: the raw->
    normalized column mapping now lives in schema.py (normalize_columns())
    instead of being duplicated here, and the raw electrical sensor
    columns (voltage/current/frequency) are also normalized to clean
    names. Values are unchanged - only column names.

    Everything else (datetime conversion, numeric coercion, sort,
    dedupe) is exactly the original logic.
    """
    df = normalize_columns(df)

    if 'timestamp' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestamp'])
    if 'consumption' in df.columns:
        df['consumption'] = pd.to_numeric(df['consumption'], errors='coerce')

    df = df.sort_values(by=['meter_id', 'timestamp'])
    df = df.drop_duplicates(subset=['meter_id', 'timestamp'], keep='first')

    return df


def clean_dataset(df):
    """
    Performs general cleaning operations.

    (Original function — unchanged.)
    """
    # Remove rows with missing essential values
    df = df.dropna(subset=REQUIRED_FIELDS)

    # Remove negative consumption
    df = df[df['consumption'] >= 0]

    return df


# ---------------------------------------------------------------------------
# Additions below (unchanged from Phase A except where noted for A.5).
# ---------------------------------------------------------------------------

VOLTAGE_COL = 'average_voltage'
CURRENT_COL = 'average_current'
FREQ_COL = 'frequency_hz'


def add_region(df):
    """
    Derives region from the meter_id prefix (BR -> Bareilly, MH -> Mathura).
    Must be called AFTER standardize_dataset() (needs the meter_id column).
    Meter IDs that don't match a known prefix get region 'Unknown' rather
    than being dropped, so the caller can decide how to handle them
    (validation.py's validate_region() treats 'Unknown' as a failure).
    """
    def region_from_id(meter_id):
        m = str(meter_id).upper()
        if m.startswith('BR'):
            return 'Bareilly'
        if m.startswith('MH'):
            return 'Mathura'
        return 'Unknown'

    df = df.copy()
    df['region'] = df['meter_id'].map(region_from_id)
    return df


def flag_sensor_dropout(df):
    """
    Flags rows that are very likely a gap-fill / sensor-dropout artifact
    (consumption, voltage, current AND frequency simultaneously exactly 0)
    rather than a genuine reading. See Phase A README for the measured
    rationale. Adds `is_dropout_artifact`; does not drop rows itself.
    """
    df = df.copy()
    has_sensor_cols = all(c in df.columns for c in (VOLTAGE_COL, CURRENT_COL, FREQ_COL))

    if not has_sensor_cols:
        df['is_dropout_artifact'] = False
        return df

    df['is_dropout_artifact'] = (
        (df['consumption'] == 0)
        & (df[VOLTAGE_COL] == 0)
        & (df[CURRENT_COL] == 0)
        & (df[FREQ_COL] == 0)
    )
    return df


def flag_voltage_outliers(df, voltage_min=None, voltage_max=None):
    """
    Flags rows where voltage is outside a plausible single-phase range.
    Adds `is_voltage_outlier`; does not drop rows. Bounds now come from
    config by default rather than being hardcoded (Priority 2).
    """
    df = df.copy()
    voltage_min = config.plausible_voltage_min if voltage_min is None else voltage_min
    voltage_max = config.plausible_voltage_max if voltage_max is None else voltage_max

    if VOLTAGE_COL not in df.columns:
        df['is_voltage_outlier'] = False
        return df

    df['is_voltage_outlier'] = ~df[VOLTAGE_COL].between(voltage_min, voltage_max)
    return df


def run_dropout_policy(df, drop_dropout_rows=None):
    """
    Applies the sensor-dropout flag and, by default (from config), removes
    those rows. Set drop_dropout_rows=False to override and keep them with
    the flag column intact.
    """
    drop_dropout_rows = config.drop_dropout_rows if drop_dropout_rows is None else drop_dropout_rows

    df = flag_sensor_dropout(df)
    n_flagged = int(df['is_dropout_artifact'].sum())

    if drop_dropout_rows:
        df = df[~df['is_dropout_artifact']].drop(columns=['is_dropout_artifact'])

    return df, n_flagged


def load_raw_file(filepath):
    """
    Reads one raw CEEW CSV with memory-efficient dtypes. Raw column names
    at this point (dtype keys reference the RAW names since dtype= is
    applied before renaming).
    """
    dtypes = {
        't_kWh': 'float32',
        'z_Avg Voltage (Volt)': 'float32',
        'z_Avg Current (Amp)': 'float32',
        'y_Freq (Hz)': 'float32',
    }
    return pd.read_csv(filepath, dtype=dtypes)


def _clean_one_file(path, drop_dropout_rows, flag_voltage):
    """
    Runs the full per-file pipeline (load -> standardize -> region ->
    dropout -> voltage flag -> clean_dataset) and returns
    (cleaned_df, stats_dict). Factored out of load_and_clean_all so both
    the in-memory and streaming code paths share exactly one
    implementation.
    """
    raw = load_raw_file(path)
    rows_in = len(raw)

    std = standardize_dataset(raw)
    std = add_region(std)

    std, n_dropout = run_dropout_policy(std, drop_dropout_rows=drop_dropout_rows)
    if flag_voltage:
        std = flag_voltage_outliers(std)

    cleaned = clean_dataset(std)
    rows_out = len(cleaned)
    rows_removed_by_clean_dataset = (rows_in - n_dropout) - rows_out

    stats = {
        'status': 'ok',
        'rows_in': rows_in,
        'dropout_rows_removed': n_dropout,
        'rows_removed_by_clean_dataset': rows_removed_by_clean_dataset,
        'rows_out': rows_out,
    }

    del raw, std
    gc.collect()

    return cleaned, stats


def load_and_clean_all(data_dir, filenames=None, drop_dropout_rows=None,
                        flag_voltage=None, output_path=None):
    """
    Orchestrates cleaning across all known raw files.

    Two modes:

    1. output_path=None (default, used by tests and small samples): holds
       all cleaned per-file frames in memory and returns a single combined
       DataFrame, exactly like Phase A. Fine for small/sample data.

    2. output_path given (used for the full ~19.6M-row production run):
       STREAMS each file's cleaned rows straight to a single Parquet file
       via pyarrow, one file at a time, never holding more than one
       cleaned file's worth of rows in memory at once and never building
       the audit-flagged "list of frames + separate concat" that doubled
       peak memory in Phase A. Returns (output_path, report, total_rows)
       instead of a DataFrame - the caller reads it back with only the
       columns it actually needs (see pipeline.py).
    """
    filenames = filenames or config.input_files
    report = {}

    if output_path is None:
        frames = []
        for fname in filenames:
            path = os.path.join(data_dir, fname)
            if not os.path.exists(path):
                report[fname] = {'status': 'not found'}
                logger.warning(f"Source file not found, skipping: {path}")
                continue
            cleaned, stats = _clean_one_file(path, drop_dropout_rows,
                                              flag_voltage if flag_voltage is not None else config.flag_voltage_outliers)
            report[fname] = stats
            logger.info(f"Cleaned {fname}: {stats}")
            frames.append(cleaned)

        if not frames:
            raise FileNotFoundError(f"None of the known source files were found in {data_dir}")

        combined = pd.concat(frames, ignore_index=True)
        combined = combined.sort_values(['meter_id', 'timestamp']).reset_index(drop=True)
        return combined, report

    # --- streaming path ---
    import pyarrow as pa
    import pyarrow.parquet as pq

    writer = None
    total_rows = 0
    try:
        for fname in filenames:
            path = os.path.join(data_dir, fname)
            if not os.path.exists(path):
                report[fname] = {'status': 'not found'}
                logger.warning(f"Source file not found, skipping: {path}")
                continue

            cleaned, stats = _clean_one_file(
                path, drop_dropout_rows,
                flag_voltage if flag_voltage is not None else config.flag_voltage_outliers,
            )
            report[fname] = stats
            logger.info(f"Cleaned {fname}: {stats}")

            table = pa.Table.from_pandas(cleaned, preserve_index=False)
            if writer is None:
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                writer = pq.ParquetWriter(output_path, table.schema)
            writer.write_table(table)
            total_rows += len(cleaned)

            del cleaned, table
            gc.collect()
    finally:
        if writer is not None:
            writer.close()

    if total_rows == 0:
        raise FileNotFoundError(f"None of the known source files were found in {data_dir}")

    logger.info(f"Streamed {total_rows:,} cleaned rows across all files to {output_path}")
    return output_path, report, total_rows


def _resort_parquet_by_meter_and_time(path):
    """
    Reads a Parquet file back fully, sorts by (meter_id, timestamp), and
    rewrites it in place. Used once, after streaming all source files, to
    fix the file-processing-order-vs-chronological-order mismatch above.

    This does require holding the full cleaned (post-dropout-removal)
    dataset in memory for this one operation - there's no way to globally
    sort across file boundaries without seeing all the rows at least once.
    It's still far cheaper than the raw CSVs: dropout rows are already
    removed (~15% fewer rows) and dtypes are already optimized. Measured
    peak memory for this step is reported in the Phase A.5 benchmark in
    the README rather than assumed safe.
    """
    df = pd.read_parquet(path)
    df = df.sort_values(['meter_id', 'timestamp']).reset_index(drop=True)
    # row_group_size matters a lot here: the streaming writer above created
    # one huge row group PER SOURCE FILE (up to ~6.6M rows). A per-meter
    # filtered read (used by build_features_in_batches) still has to
    # decompress an entire matching row group before filtering, so a
    # 6.6M-row row group makes "read just 15 meters" cost almost as much
    # memory as reading everything - this caused a real OOM kill during
    # the first full-scale benchmark attempt (see README). Since the data
    # is now sorted by meter_id, a few hundred thousand rows per row group
    # keeps each group to roughly 1-2 meters' worth of data, so a filtered
    # read only has to touch a small, bounded number of row groups.
    df.to_parquet(path, index=False, row_group_size=200_000)
    del df
    gc.collect()
