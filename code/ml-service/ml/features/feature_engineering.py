import os
import gc

import pandas as pd
import numpy as np

from ..config import config
from ..logging_config import get_logger

logger = get_logger("features")

# Sampling interval constants now derive from config (Priority 2) instead
# of being hardcoded here. Kept as module-level names too since a lot of
# code/tests reads them directly - they're just no longer the source of
# truth themselves.
INTERVALS_PER_HOUR = config.intervals_per_hour
INTERVALS_PER_DAY = config.intervals_per_day
INTERVALS_PER_WEEK = config.intervals_per_week


def _ensure_sorted(df, meter_col='meter_id', timestamp_col='timestamp'):
    """
    Priority 7 fix: add_lag_features()/add_rolling_features() have a hard
    correctness precondition (input sorted by meter_col, timestamp_col)
    that was previously unenforced - silently wrong output on unsorted
    input.

    Chosen solution: option A (validate + sort internally), because it's
    the one that can never silently produce wrong values regardless of
    what a future caller passes in - a raised exception would be safe too,
    but would just as easily get "fixed" by a future caller adding a sort
    right before the call and immediately forgetting it again next time.
    Sorting here removes the footgun entirely. It still logs a WARNING
    when it had to act, so silently-wrong-shaped input upstream is visible
    rather than invisibly patched over forever.
    """
    is_sorted = (
        df.groupby(meter_col)[timestamp_col]
        .apply(lambda s: s.is_monotonic_increasing)
        .all()
    )
    if is_sorted:
        return df

    logger.warning(
        f"Input to feature engineering was not sorted by ({meter_col}, {timestamp_col}) "
        "- sorting now. This is handled safely, but check the caller: "
        "load_and_clean_all() already returns pre-sorted data, so this "
        "usually means a filter/concat happened after that without re-sorting."
    )
    return df.sort_values([meter_col, timestamp_col]).reset_index(drop=True)


def add_time_features(df, timestamp_col='timestamp'):
    """
    Adds calendar/time-of-day features derived purely from the timestamp
    itself (no external data, no leakage risk).
    """
    df = df.copy()
    ts = df[timestamp_col]

    df['hour'] = ts.dt.hour
    df['day_of_week'] = ts.dt.dayofweek       # 0 = Monday
    df['day'] = ts.dt.day
    df['month'] = ts.dt.month
    df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)

    def bucket(h):
        if 5 <= h < 12:
            return 'morning'
        if 12 <= h < 17:
            return 'afternoon'
        if 17 <= h < 21:
            return 'evening'
        return 'night'

    df['time_of_day'] = df['hour'].apply(bucket)
    return df


def _shifted_lag(series, periods):
    return series.shift(periods)


def add_lag_features(df, meter_col='meter_id', value_col='consumption'):
    """
    Adds lag features. Now enforces the sorted-input contract (Priority 7)
    instead of silently assuming it.
    """
    df = _ensure_sorted(df, meter_col=meter_col)
    grouped = df.groupby(meter_col)[value_col]

    df['lag_1_interval'] = grouped.transform(lambda s: _shifted_lag(s, 1))
    df['lag_1h'] = grouped.transform(lambda s: _shifted_lag(s, INTERVALS_PER_HOUR))
    df['lag_4h'] = grouped.transform(lambda s: _shifted_lag(s, 4 * INTERVALS_PER_HOUR))
    df['lag_1d'] = grouped.transform(lambda s: _shifted_lag(s, INTERVALS_PER_DAY))
    df['lag_1w'] = grouped.transform(lambda s: _shifted_lag(s, INTERVALS_PER_WEEK))

    return df


def add_rolling_features(df, meter_col='meter_id', value_col='consumption', windows=None):
    """
    Adds rolling mean/median/std/min/max. Now enforces the sorted-input
    contract (Priority 7). Also fixes a Phase-A inefficiency flagged in
    the audit: the per-meter shift was recomputed once per window even
    though it doesn't depend on the window - now computed once.
    """
    df = _ensure_sorted(df, meter_col=meter_col)
    windows = windows or config.rolling_windows

    shifted = df.groupby(meter_col)[value_col].transform(lambda s: s.shift(1))
    df['_shifted_tmp'] = shifted

    for suffix, w in windows.items():
        roll = df.groupby(meter_col)['_shifted_tmp'].rolling(window=w, min_periods=max(3, w // 4))

        # .astype('float32') immediately after each rolling reduction: pandas'
        # rolling aggregations default to float64 regardless of the input
        # dtype, which doubles the memory of every rolling column versus the
        # float32 used everywhere else in this pipeline. This doesn't fix
        # the transient peak DURING the rolling computation itself (that's
        # addressed by batch size - see build_features_in_batches), but it
        # does cut the steady-state size of the output the caller holds.
        df[f'rolling_mean_{suffix}'] = roll.mean().reset_index(level=0, drop=True).astype('float32')
        df[f'rolling_median_{suffix}'] = roll.median().reset_index(level=0, drop=True).astype('float32')
        df[f'rolling_std_{suffix}'] = roll.std().reset_index(level=0, drop=True).astype('float32')
        df[f'rolling_min_{suffix}'] = roll.min().reset_index(level=0, drop=True).astype('float32')
        df[f'rolling_max_{suffix}'] = roll.max().reset_index(level=0, drop=True).astype('float32')

    df = df.drop(columns=['_shifted_tmp'])
    return df


def add_change_features(df, value_col='consumption'):
    """Unchanged from Phase A."""
    df = df.copy()

    if 'lag_1_interval' in df.columns:
        df['abs_change_prev'] = df[value_col] - df['lag_1_interval']
        df['pct_change_prev'] = np.where(
            df['lag_1_interval'].abs() > 1e-6,
            (df[value_col] - df['lag_1_interval']) / df['lag_1_interval'],
            np.nan,
        ).astype('float32')

    if 'rolling_mean_1d' in df.columns and 'rolling_std_1d' in df.columns:
        df['deviation_from_rolling_mean'] = df[value_col] - df['rolling_mean_1d']
        df['deviation_z'] = np.where(
            df['rolling_std_1d'].abs() > 1e-6,
            df['deviation_from_rolling_mean'] / df['rolling_std_1d'],
            np.nan,
        ).astype('float32')

    if 'lag_1w' in df.columns:
        df['deviation_from_same_hour_last_week'] = df[value_col] - df['lag_1w']

    return df


def build_features(df, meter_col='meter_id', value_col='consumption', timestamp_col='timestamp'):
    """Runs the full feature set in the correct order."""
    df = add_time_features(df, timestamp_col=timestamp_col)
    df = add_lag_features(df, meter_col=meter_col, value_col=value_col)
    df = add_rolling_features(df, meter_col=meter_col, value_col=value_col)
    df = add_change_features(df, value_col=value_col)
    return df


def build_features_in_batches(input_parquet_path, output_path, meter_col='meter_id',
                                batch_size=10, extra_steps=None):
    """
    Priority 9 memory fix: computes build_features() (and optionally
    calendar/weather steps via extra_steps) one BATCH OF METERS at a time,
    streaming each batch's result straight to a combined Parquet file,
    instead of ever holding the full ~19.6M-row featured dataset in memory
    at once.

    This is safe because every feature in this module is computed
    per-meter (groupby(meter_col)) - a batch of meters' lag/rolling
    features are completely independent of every other meter, so nothing
    is lost by processing them in separate batches.

    extra_steps: optional list of functions(df) -> df to run after
    build_features() on each batch (e.g. add_calendar_features,
    add_weather_proxy_features), so the whole feature stage - not just the
    lag/rolling part - benefits from batched, low-memory processing.

    Returns (output_path, total_rows).
    """
    import pyarrow as pa
    import pyarrow.parquet as pq

    # Read only the meter_id column first to get the batch plan without
    # loading the full dataset - this list is small (84 meters, not 19.6M
    # rows) regardless of dataset size.
    meter_ids = pd.read_parquet(input_parquet_path, columns=[meter_col])[meter_col].unique().tolist()
    logger.info(f"build_features_in_batches: {len(meter_ids)} meters, batch_size={batch_size}")

    writer = None
    total_rows = 0

    for i in range(0, len(meter_ids), batch_size):
        batch_meters = meter_ids[i:i + batch_size]

        # pandas' read_parquet doesn't support arbitrary row filtering by
        # value at the C++ level for object columns cheaply across all
        # pyarrow versions, so we read the batch via a filters= pushdown
        # where supported and fall back to pandas filtering otherwise.
        try:
            batch_df = pd.read_parquet(input_parquet_path, filters=[(meter_col, 'in', batch_meters)])
        except Exception:
            batch_df = pd.read_parquet(input_parquet_path)
            batch_df = batch_df[batch_df[meter_col].isin(batch_meters)]

        batch_df = build_features(batch_df, meter_col=meter_col)
        for step in (extra_steps or []):
            batch_df = step(batch_df)

        table = pa.Table.from_pandas(batch_df, preserve_index=False)
        if writer is None:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            writer = pq.ParquetWriter(output_path, table.schema)
        writer.write_table(table)
        total_rows += len(batch_df)

        logger.info(f"  batch {i // batch_size + 1}: meters={batch_meters}, rows={len(batch_df):,}")

        del batch_df, table
        gc.collect()

    if writer is not None:
        writer.close()

    logger.info(f"build_features_in_batches: wrote {total_rows:,} rows to {output_path}")
    return output_path, total_rows
