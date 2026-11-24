"""
End-to-end Phase A/A.5 pipeline: raw CEEW files -> cleaned, validated,
feature-engineered dataset.

Run as a module (no sys.path manipulation needed - Priority 11):

    cd backend
    python -m ml.pipeline                       # full run, default config
    python -m ml.pipeline --sample-meters BR02 MH01
    python -m ml.pipeline --force-recompute
    python -m ml.pipeline --log-level DEBUG
"""

import argparse
import json
import os
import time
from datetime import datetime, timezone

import pandas as pd

from .config import config
from .schema import SCHEMA_VERSION
from .logging_config import setup_logging, get_logger
from .cache import compute_cache_key, cache_path, load_if_cached, save_to_cache
from .preprocessing.cleaning import load_and_clean_all, _resort_parquet_by_meter_and_time
from .preprocessing.validation import run_all_validations
from .features.feature_engineering import build_features, build_features_in_batches
from .features.calendar_features import add_calendar_features
from .features.weather_proxy import add_weather_proxy_features

logger = get_logger("pipeline")


def _version_tag():
    return f"{config.pipeline_version}|{SCHEMA_VERSION.value}"


def _write_manifest(manifest_path, **fields):
    fields['generated_at'] = datetime.now(timezone.utc).isoformat()
    os.makedirs(os.path.dirname(manifest_path), exist_ok=True)
    with open(manifest_path, 'w') as f:
        json.dump(fields, f, indent=2, default=str)
    logger.info(f"Wrote run manifest to {manifest_path}")


def run_phase_a(data_dir=None, sample_meters=None, force_recompute=False,
                 include_weather_proxy=True, use_batched_features=None,
                 feature_batch_size=5):
    """
    sample_meters: restrict to specific meter_ids - always uses the simple
        in-memory path (small data, no need for streaming/caching).
    force_recompute: bypass cache even if a matching one exists.
    use_batched_features: if None, auto-decided (True for a full run
        without sample_meters, False for a sample run). The batched path
        streams feature engineering per meter-batch (Priority 9); the
        simple path builds everything in memory (fine for small data).
    """
    t_start = time.time()
    data_dir = data_dir or config.data_dir
    os.makedirs(config.cache_dir, exist_ok=True)
    os.makedirs(config.output_dir, exist_ok=True)

    logger.info("=" * 70)
    logger.info(f"PHASE A pipeline starting (version={config.pipeline_version}, "
                f"schema={SCHEMA_VERSION.value})")
    logger.info("=" * 70)

    # ------------------------------------------------------------------
    # Stage 1: clean (with caching for the full, non-sampled path)
    # ------------------------------------------------------------------
    if sample_meters:
        logger.info(f"sample_meters active: {sample_meters} - using in-memory path, no cache")
        df, clean_report = load_and_clean_all(data_dir)
        before = len(df)
        df = df[df['meter_id'].isin(sample_meters)].reset_index(drop=True)
        logger.info(f"Restricted to sample_meters: {before:,} -> {len(df):,} rows")
        use_batched_features = False if use_batched_features is None else use_batched_features
    else:
        use_batched_features = True if use_batched_features is None else use_batched_features
        cache_key = compute_cache_key(data_dir, config.input_files, _version_tag())
        processed_path = cache_path(config.cache_dir, "processed", cache_key)

        if not force_recompute and os.path.exists(processed_path):
            logger.info(f"Using cached processed data: {processed_path}")
            clean_report = {'status': 'loaded_from_cache', 'cache_path': processed_path}
        else:
            logger.info("No valid cache found (or force_recompute set) - cleaning from raw CSVs")
            _, clean_report, total_rows = load_and_clean_all(data_dir, output_path=processed_path)
            logger.info(f"Cleaning complete: {total_rows:,} rows written to {processed_path}")

        # Validation needs the full combined data, but only the columns
        # the checks actually use (Priority 9: "read only required
        # columns") - meter_id/timestamp/consumption/region is a small
        # fraction of the full row width.
        df = pd.read_parquet(processed_path, columns=['meter_id', 'timestamp', 'consumption', 'region'])

        # Cheap pre-check: is it actually sorted? (config.input_files is
        # ordered to make this true without any extra work in the normal
        # case - see the comment there.) Only pay for the expensive
        # full-dataset repair sort (measured at ~2.3GB peak - this is what
        # caused two OOM kills during benchmarking before this check was
        # added) if it's actually needed.
        is_sorted = df.groupby('meter_id')['timestamp'].apply(lambda s: s.is_monotonic_increasing).all()
        if not is_sorted:
            logger.warning(
                "Processed data is not chronologically sorted per meter (check config.input_files "
                "ordering) - running the one-time repair sort. This is correct but memory-heavy "
                "(~2.3GB measured on the full dataset) - fixing the input file order is cheaper."
            )
            _resort_parquet_by_meter_and_time(processed_path)
            df = pd.read_parquet(processed_path, columns=['meter_id', 'timestamp', 'consumption', 'region'])

    # ------------------------------------------------------------------
    # Stage 2: validation gate (Priority 1 - THIS now actually enforces)
    # ------------------------------------------------------------------
    all_passed, validation_report = run_all_validations(df)

    if not all_passed:
        logger.error("Validation FAILED - stopping. No ML-ready output will be written.")
        for name, result in validation_report.items():
            if not result['passed']:
                logger.error(f"  {name}: {result['detail']}")
        raise ValueError(f"Validation failed: {[k for k, v in validation_report.items() if not v['passed']]}")

    logger.info("All validation checks passed.")

    # ------------------------------------------------------------------
    # Stage 3: feature engineering (with caching + batching for full runs)
    # ------------------------------------------------------------------
    extra_steps = [add_calendar_features]
    if include_weather_proxy:
        extra_steps.append(add_weather_proxy_features)

    if sample_meters:
        logger.info("Building features (in-memory path)...")
        # Need the full-width dataframe (voltage/current/frequency etc.)
        # for the sample path, not the trimmed validation-only columns.
        full_df, _ = load_and_clean_all(data_dir)
        full_df = full_df[full_df['meter_id'].isin(sample_meters)].reset_index(drop=True)
        result_df = build_features(full_df)
        for step in extra_steps:
            result_df = step(result_df)
        feature_report = {'status': 'in_memory', 'rows': len(result_df)}
        output_path = None
    else:
        feature_cache_key = compute_cache_key(
            data_dir, config.input_files, _version_tag() + "|features"
        )
        features_path = cache_path(config.cache_dir, "features", feature_cache_key)

        if not force_recompute and os.path.exists(features_path):
            logger.info(f"Using cached feature data: {features_path}")
            feature_report = {'status': 'loaded_from_cache', 'cache_path': features_path}
        else:
            logger.info(f"Building features in batches of {feature_batch_size} meters "
                        "(streamed to Parquet - Priority 9 memory fix)...")
            _, total_feature_rows = build_features_in_batches(
                processed_path, features_path,
                batch_size=feature_batch_size, extra_steps=extra_steps,
            )
            feature_report = {'status': 'computed', 'rows': total_feature_rows}

        result_df = None  # intentionally not loaded into memory for the full run
        output_path = features_path

    elapsed = time.time() - t_start
    logger.info(f"Phase A pipeline finished in {elapsed:.1f}s")

    # ------------------------------------------------------------------
    # Stage 4: run manifest (Priority 10)
    # ------------------------------------------------------------------
    manifest_path = os.path.join(config.output_dir, "pipeline_run.json")
    _write_manifest(
        manifest_path,
        pipeline_version=config.pipeline_version,
        schema_version=SCHEMA_VERSION.value,
        input_files=config.input_files,
        sample_meters=sample_meters,
        clean_report=clean_report,
        validation_report={k: v['passed'] for k, v in validation_report.items()},
        feature_report=feature_report,
        include_weather_proxy=include_weather_proxy,
        output_path=output_path,
        elapsed_seconds=round(elapsed, 2),
    )

    return result_df, output_path


def _parse_args():
    p = argparse.ArgumentParser(description="MeterIQ Phase A pipeline")
    p.add_argument("--data-dir", default=None)
    p.add_argument("--sample-meters", nargs="*", default=None)
    p.add_argument("--force-recompute", action="store_true")
    p.add_argument("--no-weather-proxy", action="store_true")
    p.add_argument("--feature-batch-size", type=int, default=5)
    p.add_argument("--log-level", default=None)
    return p.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    setup_logging(args.log_level or config.log_level, config.log_dir)

    run_phase_a(
        data_dir=args.data_dir,
        sample_meters=args.sample_meters,
        force_recompute=args.force_recompute,
        include_weather_proxy=not args.no_weather_proxy,
        feature_batch_size=args.feature_batch_size,
    )
